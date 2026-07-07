import {
  angleDiff,
  angleTo,
  CLASS_META,
  CLASS_ORDER,
  CLASS_STATS,
  clamp,
  COMBAT,
  distance,
  distanceSq,
  MAP_COLLIDERS,
  mapPropsToColliders,
  normalize,
  project,
  randomBetween,
  resolveMapCollision,
  getSkillCooldownMs,
  WORLD,
  isBlocked,
  type ClassId,
  type Collider,
  type CombatEvent,
  type CombatEventType,
  type EffectState,
  type GameSnapshot,
  type HealthPackState,
  type JoinAccepted,
  type JoinRequest,
  type MapProp,
  type LeaderboardEntry,
  type PlayerActionState,
  type PlayerInput,
  type ProjectileState,
  type ProjectileType,
  type PublicPlayer,
  type RoundPhase,
  type RoundState,
  type SkillKey,
  type TurretState
} from "@renaiss-game/shared";

type Cooldowns = Record<SkillKey, number>;
type CombatEventMeta = Pick<CombatEvent, "participantIds" | "scoreDelta" | "streak">;

interface PlayerEntity extends PublicPlayer {
  socketId: string | null;
  input: PlayerInput;
  lastAttackAt: number;
  archerChargeStartedAt: number;
  action: PlayerActionState | null;
  actionStartedAt: number;
  actionEndsAt: number;
  actionPoseEndsAt: number;
  respawnAt: number;
  shieldEndsAt: number;
  spawnGuardEndsAt: number;
  rootEndsAt: number;
  stunEndsAt: number;
  damageCredits: Map<string, number>;
  aiSeed: number;
  aiNextDecisionAt: number;
}

interface ProjectileEntity extends ProjectileState {
  speed: number;
  damage: number;
  distanceTraveled: number;
  maxDistance: number;
}

interface ProjectileSpawnInput extends Omit<ProjectileEntity, "id" | "distanceTraveled"> {
  distanceTraveled?: number;
}

interface TurretEntity extends TurretState {
  lastAttackAt: number;
  boostEndsAt: number;
}

export interface GameRoomOptions {
  mapProps?: MapProp[];
  noBots?: boolean;
  fixedSpawn?: boolean;
  fixedSpawnPoint?: { x: number; y: number };
}

const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  angle: 0,
  aimX: 0,
  aimY: 0,
  attack: false,
  sprint: false,
  skillQ: false,
  skillE: false,
  skillR: false
};

const BOT_NAMES = ["RIVAL_AZ", "RIVAL_BX", "RIVAL_CQ", "RIVAL_D9", "RIVAL_KI", "RIVAL_N7", "RIVAL_Q3", "RIVAL_VX"];
const EVENT_TTL_MS = 9000;
const EVENT_LIMIT = 18;
const SPAWN_GUARD_MS = 8500;
const TURRET_DEPLOY_DISTANCE = COMBAT.playerRadius + COMBAT.turretRadius + 48;
const TURRET_DEPLOY_ANGLE_OFFSETS = [0, -32, 32, -64, 64, 180] as const;

export class GameRoom {
  private readonly mapColliders: Collider[];
  private readonly botsEnabled: boolean;
  private readonly fixedSpawnEnabled: boolean;
  private readonly fixedSpawnPoint: { x: number; y: number } | null;
  private players = new Map<string, PlayerEntity>();
  private socketToPlayer = new Map<string, string>();
  private projectiles: ProjectileEntity[] = [];
  private turrets: TurretEntity[] = [];
  private healthPacks: HealthPackState[] = [];
  private effects: EffectState[] = [];
  private events: CombatEvent[] = [];
  private nextProjectileId = 1;
  private nextTurretId = 1;
  private nextHealthPackId = 1;
  private nextEffectId = 1;
  private nextEventId = 1;
  private roundNumber = 0;
  private roundPhase: RoundPhase = "playing";
  private roundStartedAt = Date.now();
  private roundEndsAt = this.roundStartedAt + WORLD.roundDurationMs;
  private nextRoundAt: number | null = null;
  private roundWinner: LeaderboardEntry | null = null;

  constructor(options: GameRoomOptions = {}) {
    this.mapColliders = options.mapProps ? mapPropsToColliders(options.mapProps) : MAP_COLLIDERS;
    this.botsEnabled = !options.noBots;
    this.fixedSpawnEnabled = options.fixedSpawn === true;
    this.fixedSpawnPoint = options.fixedSpawnPoint ?? null;
    this.spawnInitialHealthPacks();
    this.ensureBots();
  }

  private resolveMapCollision(position: { x: number; y: number }, radius: number) {
    return resolveMapCollision(position, radius, this.mapColliders);
  }

  private isBlocked(position: { x: number; y: number }, radius = 0) {
    return isBlocked(position, radius, this.mapColliders);
  }

  addHuman(socketId: string, request: JoinRequest): JoinAccepted {
    const hadHumans = this.playerCount() > 0;
    const id = `p_${socketId.slice(0, 8)}`;
    const player = this.createPlayer({
      id,
      socketId,
      name: request.name?.trim().slice(0, 14) || "GUEST_2AC1",
      classId: request.classId
    });
    const spawn = this.humanSpawnPoint(id);
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = -90;

    this.players.set(id, player);
    this.socketToPlayer.set(socketId, id);
    this.ensureBots();
    if (!hadHumans) {
      this.resetRound(Date.now(), false);
    }
    this.pushEvent("join", `${player.name} entered ${WORLD.villageName}`, player);

    return {
      playerId: id,
      world: {
        width: WORLD.width,
        height: WORLD.height,
        villageName: WORLD.villageName
      }
    };
  }

  removeHuman(socketId: string) {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) {
      return;
    }
    this.players.delete(playerId);
    this.socketToPlayer.delete(socketId);
  }

  switchHumanClass(socketId: string, classId: ClassId) {
    const playerId = this.socketToPlayer.get(socketId);
    const player = playerId ? this.players.get(playerId) : null;
    if (!player || player.bot) {
      return false;
    }
    if (player.alive && this.roundPhase === "playing") {
      return false;
    }

    const previousClass = player.classId;
    const stats = CLASS_STATS[classId];
    player.classId = classId;
    player.maxHealth = stats.maxHealth;
    player.health = player.alive ? stats.maxHealth : 0;
    player.stamina = COMBAT.maxStamina;
    player.maxStamina = COMBAT.maxStamina;
    player.cooldowns = { skillQ: 0, skillE: 0, skillR: 0 };
    player.input = { ...EMPTY_INPUT };
    this.resetArcherCharge(player);
    player.action = null;
    player.actionStartedAt = 0;
    player.actionEndsAt = 0;
    player.actionPoseEndsAt = 0;
    player.attacking = false;
    player.shielded = false;
    player.rooted = false;
    player.stunned = false;
    player.sprinting = false;
    player.shieldEndsAt = 0;
    player.rootEndsAt = 0;
    player.stunEndsAt = 0;
    player.damageCredits.clear();
    this.projectiles = this.projectiles.filter((projectile) => projectile.ownerId !== player.id);
    this.turrets = this.turrets.filter((turret) => turret.ownerId !== player.id);

    if (previousClass !== classId) {
      this.pushEvent("control", `${player.name} prepared ${CLASS_META[classId].label}`, player);
    }
    return true;
  }

  setHumanInput(socketId: string, input: PlayerInput) {
    const playerId = this.socketToPlayer.get(socketId);
    const player = playerId ? this.players.get(playerId) : null;
    if (!player || player.bot) {
      return;
    }

    const aimPoint = this.getSanitizedAimPoint(player, input);
    player.input = {
      moveX: clamp(input.moveX, -1, 1),
      moveY: clamp(input.moveY, -1, 1),
      angle: this.getAimAngle(player, aimPoint, Number.isFinite(input.angle) ? input.angle : player.angle),
      aimX: aimPoint.x,
      aimY: aimPoint.y,
      attack: Boolean(input.attack),
      sprint: Boolean(input.sprint),
      skillQ: Boolean(input.skillQ),
      skillE: Boolean(input.skillE),
      skillR: Boolean(input.skillR)
    };
  }

  update(deltaMs: number) {
    const now = Date.now();
    this.ensureBots();
    this.updateStatusFlags(now);
    this.updateRoundLifecycle(now);
    if (this.roundPhase === "playing") {
      this.updateBots(now);
      this.updatePlayers(deltaMs, now);
      this.updateProjectiles(deltaMs, now);
      this.updateTurrets(now);
      this.checkHealthPackPickup(now);
      this.respawnPlayers(now);
      this.updateRoundLifecycle(now);
    }
    this.effects = this.effects.filter((effect) => effect.startedAt + effect.duration > now);
    this.events = this.events.filter((event) => event.at + EVENT_TTL_MS > now).slice(-EVENT_LIMIT);
  }

  snapshotFor(socketId: string): GameSnapshot {
    const selfId = this.socketToPlayer.get(socketId) ?? null;
    const players = [...this.players.values()].map((player) => this.toPublicPlayer(player));
    const leaderboard = this.getLeaderboard(players, 8);

    return {
      serverTime: Date.now(),
      selfId,
      round: this.toRoundState(),
      players,
      projectiles: this.projectiles.map((projectile) => ({
        id: projectile.id,
        ownerId: projectile.ownerId,
        type: projectile.type,
        x: projectile.x,
        y: projectile.y,
        angle: projectile.angle
      })),
      turrets: this.turrets.map(({ id, ownerId, x, y, angle, health, maxHealth, boosted }) => ({
        id,
        ownerId,
        x,
        y,
        angle,
        health,
        maxHealth,
        boosted
      })),
      healthPacks: this.healthPacks,
      effects: this.effects,
      events: this.events.slice(-EVENT_LIMIT),
      leaderboard
    };
  }

  playerCount() {
    return [...this.players.values()].filter((player) => !player.bot).length;
  }

  botCount() {
    return [...this.players.values()].filter((player) => player.bot).length;
  }

  private createPlayer(input: {
    id: string;
    socketId: string | null;
    name: string;
    classId: ClassId;
    bot?: boolean;
  }): PlayerEntity {
    const stats = CLASS_STATS[input.classId];
    const spawn = this.randomSpawnPoint();
    const cooldowns: Cooldowns = { skillQ: 0, skillE: 0, skillR: 0 };

    return {
      id: input.id,
      socketId: input.socketId,
      name: input.name,
      classId: input.classId,
      x: spawn.x,
      y: spawn.y,
      angle: randomBetween(0, 360),
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      stamina: COMBAT.maxStamina,
      maxStamina: COMBAT.maxStamina,
      score: 0,
      killStreak: 0,
      alive: true,
      attacking: false,
      shielded: false,
      spawnProtected: !input.bot,
      rooted: false,
      stunned: false,
      sprinting: false,
      bot: Boolean(input.bot),
      cooldowns,
      input: { ...EMPTY_INPUT },
      lastAttackAt: 0,
      archerChargeStartedAt: 0,
      action: null,
      actionStartedAt: 0,
      actionEndsAt: 0,
      actionPoseEndsAt: 0,
      respawnAt: 0,
      shieldEndsAt: 0,
      spawnGuardEndsAt: input.bot ? 0 : Date.now() + SPAWN_GUARD_MS,
      rootEndsAt: 0,
      stunEndsAt: 0,
      damageCredits: new Map(),
      aiSeed: Math.random(),
      aiNextDecisionAt: 0
    };
  }

  private updateRoundLifecycle(now: number) {
    if (this.roundPhase === "finished") {
      if (this.nextRoundAt && now >= this.nextRoundAt) {
        this.resetRound(now);
      }
      return;
    }

    const leader = this.getLeaderboard(undefined, 1)[0] ?? null;
    if (now >= this.roundEndsAt || (leader?.score ?? 0) >= WORLD.scoreLimit) {
      this.finishRound(now, leader);
    }
  }

  private finishRound(now: number, leader: LeaderboardEntry | null) {
    if (this.roundPhase === "finished") {
      return;
    }

    this.roundPhase = "finished";
    this.nextRoundAt = now + WORLD.roundRestartMs;
    this.projectiles = [];
    this.roundWinner = leader && leader.score > 0 ? leader : null;

    const winner = this.roundWinner ? this.players.get(this.roundWinner.id) : undefined;
    this.pushEvent(
      "round",
      this.roundWinner ? `${this.roundWinner.name} won the round` : "Round ended with no winner",
      winner,
      undefined,
      now
    );
  }

  private resetRound(now: number, announce = true) {
    this.roundNumber += 1;
    this.roundPhase = "playing";
    this.roundStartedAt = now;
    this.roundEndsAt = now + WORLD.roundDurationMs;
    this.nextRoundAt = null;
    this.roundWinner = null;
    this.projectiles = [];
    this.turrets = [];
    this.effects = [];
    this.events = [];
    this.healthPacks = [];
    this.nextHealthPackId = 1;
    this.spawnInitialHealthPacks();

    let botIndex = 0;
    for (const player of this.players.values()) {
      const stats = CLASS_STATS[player.classId];
      const spawn = player.bot ? this.botSpawnPoint(botIndex++) : this.humanSpawnPoint(player.id);
      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = player.bot ? angleTo(player, { x: WORLD.width / 2, y: WORLD.height / 2 }) : -90;
      player.maxHealth = stats.maxHealth;
      player.health = stats.maxHealth;
      player.stamina = COMBAT.maxStamina;
      player.score = 0;
      player.killStreak = 0;
      player.alive = true;
      player.respawnAt = 0;
      player.shielded = false;
      player.spawnProtected = !player.bot;
      player.rooted = false;
      player.stunned = false;
      player.sprinting = false;
      player.cooldowns = { skillQ: 0, skillE: 0, skillR: 0 };
      player.input = { ...EMPTY_INPUT };
      player.lastAttackAt = 0;
      this.resetArcherCharge(player);
      player.actionPoseEndsAt = 0;
      player.action = null;
      player.actionStartedAt = 0;
      player.actionEndsAt = 0;
      player.attacking = false;
      player.shieldEndsAt = 0;
      player.spawnGuardEndsAt = player.bot ? 0 : now + SPAWN_GUARD_MS;
      player.rootEndsAt = 0;
      player.stunEndsAt = 0;
      player.damageCredits.clear();
      player.aiNextDecisionAt = 0;
    }

    if (announce) {
      this.pushEvent("round", "New arena round started", undefined, undefined, now);
    }
  }

  private toRoundState(): RoundState {
    return {
      phase: this.roundPhase,
      roundNumber: this.roundNumber,
      startedAt: this.roundStartedAt,
      endsAt: this.roundEndsAt,
      nextRoundAt: this.nextRoundAt,
      durationMs: WORLD.roundDurationMs,
      restartMs: WORLD.roundRestartMs,
      scoreLimit: WORLD.scoreLimit,
      winner: this.roundWinner
    };
  }

  private getLeaderboard(players?: PublicPlayer[], limit = 8): LeaderboardEntry[] {
    const publicPlayers = players ?? [...this.players.values()].map((player) => this.toPublicPlayer(player));
    return publicPlayers
      .map(({ id, name, score, killStreak, classId, bot }) => ({ id, name, score, killStreak, classId, bot }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  private ensureBots() {
    if (!this.botsEnabled) {
      return;
    }

    const botCount = this.botCount();
    for (let i = botCount; i < BOT_NAMES.length; i += 1) {
      const classId = CLASS_ORDER[i % CLASS_ORDER.length];
      const player = this.createPlayer({
        id: `bot_${i + 1}`,
        socketId: null,
        name: BOT_NAMES[i],
        classId,
        bot: true
      });
      const spawn = this.botSpawnPoint(i);
      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = angleTo(player, { x: WORLD.width / 2, y: WORLD.height / 2 });
      this.players.set(player.id, player);
    }
  }

  private updateStatusFlags(now: number) {
    for (const player of this.players.values()) {
      player.shielded = player.shieldEndsAt > now;
      player.spawnProtected = player.spawnGuardEndsAt > now;
      player.rooted = player.rootEndsAt > now;
      player.stunned = player.stunEndsAt > now;
      if (!player.alive || player.rooted || player.stunned) {
        player.sprinting = false;
      }
      player.attacking = player.alive && player.actionPoseEndsAt > now;
      if (!player.attacking) {
        player.action = null;
        player.actionStartedAt = 0;
        player.actionEndsAt = 0;
      }
    }
  }

  private updateBots(now: number) {
    if (this.playerCount() === 0) {
      return;
    }

    const livePlayers = [...this.players.values()].filter((player) => player.alive);
    for (const bot of livePlayers) {
      if (!bot.bot || bot.aiNextDecisionAt > now) {
        continue;
      }

      const targets = livePlayers.filter((candidate) => candidate.id !== bot.id && !candidate.spawnProtected);
      const target = targets.sort((a, b) => distanceSq(bot, a) - distanceSq(bot, b))[0];
      if (!target) {
        continue;
      }

      const d = distance(bot, target);
      const desiredAngle = angleTo(bot, target);
      const moveToward = d > (bot.classId === "warrior" ? 100 : 330);
      const strafe = Math.sin((now / 600 + bot.aiSeed * 12) % Math.PI) * 0.7;
      const radians = (desiredAngle * Math.PI) / 180;

      bot.input = {
        moveX: moveToward ? Math.cos(radians) + Math.cos(radians + Math.PI / 2) * strafe : Math.cos(radians + Math.PI / 2) * strafe,
        moveY: moveToward ? Math.sin(radians) + Math.sin(radians + Math.PI / 2) * strafe : Math.sin(radians + Math.PI / 2) * strafe,
        angle: desiredAngle,
        aimX: target.x,
        aimY: target.y,
        attack: d < 620,
        sprint: moveToward && d > 520,
        skillQ: d > 220 && d < 540 && Math.random() < 0.35,
        skillE: d < COMBAT.mageBurstRadius + 40 && Math.random() < 0.25,
        skillR: d < COMBAT.mageUltimateRadius + 50 && Math.random() < 0.12
      };
      bot.aiNextDecisionAt = now + randomBetween(160, 320);
    }
  }

  private updatePlayers(deltaMs: number, now: number) {
    const deltaSeconds = deltaMs / 1000;
    for (const player of this.players.values()) {
      if (!player.alive) {
        continue;
      }

      if (player.stunned) {
        this.resetArcherCharge(player);
      }

      const skillUsed = !player.stunned ? this.handleSkills(player, now) : false;

      if (!player.rooted && !player.stunned && !this.isMovementLocked(player, now)) {
        const move = normalize(player.input.moveX, player.input.moveY);
        const isMoving = Math.abs(move.x) + Math.abs(move.y) > 0.01;
        player.sprinting = Boolean(player.input.sprint && isMoving && player.stamina > COMBAT.sprintMinStamina);
        if (isMoving) {
          if (player.sprinting) {
            player.stamina = clamp(player.stamina - COMBAT.sprintDrainPerSecond * deltaSeconds, 0, player.maxStamina);
          } else {
            player.stamina = clamp(player.stamina + COMBAT.sprintRegenPerSecond * deltaSeconds, 0, player.maxStamina);
          }

          const speed = CLASS_STATS[player.classId].moveSpeed * (player.sprinting ? COMBAT.sprintSpeedMultiplier : 1);
          const next = this.resolveMapCollision(
            {
              x: player.x + move.x * speed * deltaSeconds,
              y: player.y + move.y * speed * deltaSeconds
            },
            COMBAT.playerRadius
          );
          player.x = next.x;
          player.y = next.y;
        } else {
          player.sprinting = false;
          player.stamina = clamp(player.stamina + COMBAT.sprintRegenPerSecond * deltaSeconds, 0, player.maxStamina);
        }
      } else {
        player.stamina = clamp(player.stamina + COMBAT.sprintRegenPerSecond * deltaSeconds, 0, player.maxStamina);
        player.sprinting = false;
      }

      player.angle = player.input.angle;

      if (!skillUsed && !player.stunned) {
        if (player.classId === "archer") {
          this.handleArcherChargedAttack(player, now);
        } else if (player.input.attack) {
          this.handleAttack(player, now);
        }
      } else if (skillUsed) {
        this.resetArcherCharge(player);
      }
    }
  }

  private handleArcherChargedAttack(attacker: PlayerEntity, now: number) {
    if (attacker.archerChargeStartedAt > 0) {
      const stage = this.getArcherChargeStage(attacker, now);
      if (!attacker.input.attack || stage >= COMBAT.archerChargeStages) {
        this.fireArcherChargedArrow(attacker, now, stage);
        return;
      }

      this.faceAim(attacker);
      this.setArcherChargePose(attacker, now);
      return;
    }

    if (!attacker.input.attack || attacker.actionPoseEndsAt > now) {
      return;
    }
    if (now - attacker.lastAttackAt < CLASS_STATS.archer.attackCooldownMs) {
      return;
    }

    this.faceAim(attacker);
    this.releaseSpawnGuardForAction(attacker, now);
    attacker.archerChargeStartedAt = now;
    this.setArcherChargePose(attacker, now);
  }

  private fireArcherChargedArrow(attacker: PlayerEntity, now: number, stage: number) {
    if (attacker.archerChargeStartedAt <= 0) {
      return;
    }

    this.faceAim(attacker);
    attacker.lastAttackAt = now;
    this.resetArcherCharge(attacker);
    this.setActionPose(attacker, now, 320, "attack");

    const origin = this.getPlayerProjectileOrigin(attacker, "arrow");
    this.spawnProjectile({
      ownerId: attacker.id,
      type: "arrow",
      x: origin.x,
      y: origin.y,
      angle: attacker.angle,
      damage: this.getArcherChargedArrowDamage(stage),
      speed: this.getArcherChargedArrowSpeed(stage),
      maxDistance: COMBAT.arrowDistance,
      distanceTraveled: origin.distance
    });
  }

  private setArcherChargePose(player: PlayerEntity, now: number) {
    player.action = "attack";
    player.actionStartedAt = player.archerChargeStartedAt;
    player.actionEndsAt = player.archerChargeStartedAt + (COMBAT.archerChargeStages - 1) * COMBAT.archerChargeStageMs;
    player.actionPoseEndsAt = Math.max(player.actionPoseEndsAt, now + 120);
    player.attacking = true;
  }

  private resetArcherCharge(player: PlayerEntity) {
    player.archerChargeStartedAt = 0;
  }

  private getArcherChargeStage(player: PlayerEntity, now: number) {
    if (player.archerChargeStartedAt <= 0) {
      return 1;
    }
    const elapsed = Math.max(0, now - player.archerChargeStartedAt);
    return Math.max(1, Math.min(COMBAT.archerChargeStages, Math.floor(elapsed / COMBAT.archerChargeStageMs) + 1));
  }

  private getArcherChargeRatio(stage: number) {
    if (COMBAT.archerChargeStages <= 1) {
      return 1;
    }
    return (Math.max(1, Math.min(COMBAT.archerChargeStages, stage)) - 1) / (COMBAT.archerChargeStages - 1);
  }

  private getArcherChargedArrowDamage(stage: number) {
    const multiplier = 1 + (COMBAT.archerChargedArrowMaxDamageMultiplier - 1) * this.getArcherChargeRatio(stage);
    return Math.round(CLASS_STATS.archer.attackPower * multiplier);
  }

  private getArcherChargedArrowSpeed(stage: number) {
    const multiplier = 1 + (COMBAT.archerChargedArrowMaxSpeedMultiplier - 1) * this.getArcherChargeRatio(stage);
    return Math.round(COMBAT.arrowSpeed * multiplier);
  }

  private handleAttack(attacker: PlayerEntity, now: number) {
    const stats = CLASS_STATS[attacker.classId];
    if (attacker.actionPoseEndsAt > now) {
      return;
    }
    if (now - attacker.lastAttackAt < stats.attackCooldownMs) {
      return;
    }

    this.faceAim(attacker);
    this.releaseSpawnGuardForAction(attacker, now);
    attacker.lastAttackAt = now;
    this.setActionPose(attacker, now, 320, "attack");

    if (attacker.classId === "archer" || attacker.classId === "mage") {
      const type: ProjectileType = attacker.classId === "archer" ? "arrow" : "magic_ball";
      const origin = this.getPlayerProjectileOrigin(attacker, type);
      this.spawnProjectile({
        ownerId: attacker.id,
        type,
        x: origin.x,
        y: origin.y,
        angle: attacker.angle,
        damage: stats.attackPower,
        speed: attacker.classId === "archer" ? COMBAT.arrowSpeed : COMBAT.magicBallSpeed,
        maxDistance: attacker.classId === "archer" ? COMBAT.arrowDistance : COMBAT.magicBallDistance,
        distanceTraveled: origin.distance
      });
      return;
    }

    this.addEffect("attack_arc", attacker, COMBAT.meleeRange, 380);

    for (const target of this.players.values()) {
      if (target.id === attacker.id || !target.alive) {
        continue;
      }
      if (this.isInMeleeArc(attacker, target)) {
        this.damagePlayer(target, stats.attackPower, attacker.id);
      }
    }

    for (const turret of this.turrets) {
      if (turret.ownerId !== attacker.id && this.isInMeleeArc(attacker, turret)) {
        this.damageTurret(turret, stats.attackPower, attacker.id, now);
      }
    }
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  private isMovementLocked(player: PlayerEntity, now: number) {
    return player.classId === "mage" && player.action === "skillQ" && player.actionPoseEndsAt > now;
  }

  private isInMeleeArc(attacker: PlayerEntity, target: { x: number; y: number }) {
    const targetDistance = distance(attacker, target);
    if (targetDistance > COMBAT.meleeRange) {
      return false;
    }
    if (targetDistance <= COMBAT.playerRadius + 16) {
      return true;
    }
    return angleDiff(attacker.angle, angleTo(attacker, target)) <= 68;
  }

  private handleSkills(player: PlayerEntity, now: number) {
    if (player.actionPoseEndsAt > now) {
      return false;
    }

    const requestedSkills: SkillKey[] = ["skillR", "skillE", "skillQ"];
    for (const skill of requestedSkills) {
      if (!player.input[skill] || !this.canUse(player, skill, now)) {
        continue;
      }

      this.faceAim(player);
      if (skill === "skillR") {
        this.useSkillR(player, now);
      } else if (skill === "skillE") {
        this.useSkillE(player, now);
      } else {
        this.useSkillQ(player, now);
      }
      return true;
    }

    return false;
  }

  private canUse(player: PlayerEntity, skill: SkillKey, now: number) {
    return player.cooldowns[skill] <= now;
  }

  private startCooldown(player: PlayerEntity, skill: SkillKey, now: number) {
    player.cooldowns[skill] = now + getSkillCooldownMs(player.classId, skill);
  }

  private releaseSpawnGuardForAction(player: PlayerEntity, now: number) {
    if (player.spawnGuardEndsAt <= now) {
      return;
    }

    player.spawnGuardEndsAt = now;
    player.spawnProtected = false;
  }

  private useSkillQ(player: PlayerEntity, now: number) {
    if (!this.canUse(player, "skillQ", now)) {
      return;
    }
    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillQ", now);

    if (player.classId === "warrior") {
      this.setActionPose(player, now, 440, "skillQ");
      const next = project(player, player.angle, COMBAT.warriorDashDistance);
      const resolved = this.resolveMapCollision(next, COMBAT.playerRadius);
      player.x = resolved.x;
      player.y = resolved.y;
      this.addEffect("dash", player, 110, 540);
      return;
    }

    if (player.classId === "archer") {
      this.setActionPose(player, now, 440, "skillQ");
      const next = project(player, player.angle, COMBAT.archerRollDistance);
      const resolved = this.resolveMapCollision(next, COMBAT.playerRadius);
      player.x = resolved.x;
      player.y = resolved.y;
      this.addEffect("roll", player, 110, 540);
      return;
    }

    if (player.classId === "engineer") {
      this.setActionPose(player, now, 560, "skillQ");
      const owned = this.turrets.filter((turret) => turret.ownerId === player.id);
      if (owned.length >= COMBAT.engineerMaxTurrets) {
        const oldest = owned.sort((a, b) => a.id.localeCompare(b.id))[0];
        this.turrets = this.turrets.filter((turret) => turret.id !== oldest.id);
      }

      const deployPoint = this.getTurretDeployPoint(player);
      this.turrets.push({
        id: `t_${this.nextTurretId++}`,
        ownerId: player.id,
        x: deployPoint.x,
        y: deployPoint.y,
        angle: player.angle,
        health: COMBAT.turretHealth,
        maxHealth: COMBAT.turretHealth,
        boosted: false,
        lastAttackAt: now,
        boostEndsAt: 0
      });
      this.addEffectAt("turret_deploy", player, deployPoint, player.angle, 90, 600);
      this.pushEvent("turret", `${player.name} deployed an auto turret`, player, undefined, now);
      return;
    }

    this.setActionPose(player, now, 820, "skillQ");
    for (const target of this.players.values()) {
      if (target.id === player.id || !target.alive) {
        continue;
      }
      const d = distance(player, target);
      if (d <= COMBAT.mageBeamLength && angleDiff(angleTo(player, target), player.angle) <= COMBAT.mageBeamHalfAngle) {
        this.damagePlayer(target, COMBAT.mageBeamDamage, player.id);
      }
    }
    this.addEffect("beam", player, COMBAT.mageBeamLength, 1180, undefined, COMBAT.playerRadius + 10);
  }

  private getTurretDeployPoint(player: PlayerEntity) {
    for (const offset of TURRET_DEPLOY_ANGLE_OFFSETS) {
      const candidate = this.resolveMapCollision(project(player, player.angle + offset, TURRET_DEPLOY_DISTANCE), COMBAT.turretRadius);
      const clearOfOwner = distance(candidate, player) >= COMBAT.playerRadius + COMBAT.turretRadius + 12;
      const clearOfTurrets = this.turrets.every((turret) => distance(candidate, turret) >= COMBAT.turretRadius * 2.15);
      if (clearOfOwner && clearOfTurrets && !this.isBlocked(candidate, COMBAT.turretRadius)) {
        return candidate;
      }
    }

    return this.resolveMapCollision(project(player, player.angle, TURRET_DEPLOY_DISTANCE), COMBAT.turretRadius);
  }

  private useSkillE(player: PlayerEntity, now: number) {
    if (!this.canUse(player, "skillE", now)) {
      return;
    }
    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillE", now);

    if (player.classId === "warrior") {
      this.setActionPose(player, now, 520, "skillE");
      player.shieldEndsAt = now + COMBAT.warriorShieldDuration;
      player.shielded = true;
      this.addEffect("shield", player, 115, 900);
      return;
    }

    if (player.classId === "archer") {
      this.setActionPose(player, now, 520, "skillE");
      const center = this.getAimPoint(player);
      for (const target of this.players.values()) {
        if (target.id !== player.id && target.alive && distance(center, target) <= COMBAT.archerRootRadius) {
          target.rootEndsAt = now + COMBAT.archerRootDuration;
          target.rooted = true;
          this.addEffect("root", target, 70, 800);
        }
      }
      return;
    }

    if (player.classId === "engineer") {
      this.setActionPose(player, now, 760, "skillE");
      for (const target of this.players.values()) {
        if (target.id === player.id || !target.alive || distance(player, target) > COMBAT.engineerRepulsorPulseRadius) {
          continue;
        }
        this.damagePlayer(target, COMBAT.engineerRepulsorPulseDamage, player.id);
        const knock = project(target, angleTo(player, target), COMBAT.engineerKnockback);
        const resolved = this.resolveMapCollision(knock, COMBAT.playerRadius);
        target.x = resolved.x;
        target.y = resolved.y;
      }
      this.addEffect("repulsor_pulse", player, COMBAT.engineerRepulsorPulseRadius, 1040);
      return;
    }

    let stunnedTargets = 0;
    const center = this.getAimPoint(player);
    this.setActionPose(player, now, 760, "skillE");
    for (const target of this.players.values()) {
      if (target.id !== player.id && target.alive && distance(center, target) <= COMBAT.mageBurstRadius) {
        this.damagePlayer(target, COMBAT.mageBurstDamage, player.id);
        if (target.alive) {
          target.stunEndsAt = Math.max(target.stunEndsAt, now + COMBAT.mageBurstStunDuration);
          target.stunned = true;
          this.addEffect("stun", target, 82, 900);
          stunnedTargets += 1;
        }
      }
    }
    this.addEffectAt("burst", player, center, angleTo(player, center), COMBAT.mageBurstRadius, 1150);
    if (stunnedTargets > 0) {
      this.pushEvent("control", `${player.name} stunned ${stunnedTargets} rival${stunnedTargets === 1 ? "" : "s"}`, player, undefined, now);
    }
  }

  private useSkillR(player: PlayerEntity, now: number) {
    if (!this.canUse(player, "skillR", now)) {
      return;
    }
    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillR", now);

    if (player.classId === "engineer") {
      this.setActionPose(player, now, 760, "skillR");
      for (const turret of this.turrets) {
        if (turret.ownerId === player.id) {
          turret.boosted = true;
          turret.boostEndsAt = now + COMBAT.turretBoostDuration;
        }
      }
      this.addEffect("ultimate", player, 260, 1200);
      this.pushEvent("ultimate", `${player.name} overclocked the turret grid`, player, undefined, now);
      return;
    }

    this.setActionPose(player, now, player.classId === "mage" ? 920 : 760, "skillR");
    const skill =
      player.classId === "warrior"
        ? { radius: COMBAT.warriorUltimateRadius, damage: COMBAT.warriorUltimateDamage }
        : player.classId === "archer"
          ? { radius: COMBAT.archerUltimateRadius, damage: COMBAT.archerUltimateDamage }
          : { radius: COMBAT.mageUltimateRadius, damage: COMBAT.mageUltimateDamage };

    const center = player.classId === "mage" || player.classId === "archer" ? this.getAimPoint(player) : player;
    for (const target of this.players.values()) {
      if (target.id !== player.id && target.alive && distance(center, target) <= skill.radius) {
        this.damagePlayer(target, skill.damage, player.id);
      }
    }
    const ultimateDuration = player.classId === "mage" ? 1650 : player.classId === "archer" ? 2100 : 1250;
    this.addEffectAt("ultimate", player, center, angleTo(player, center), skill.radius, ultimateDuration);
    this.pushEvent("ultimate", `${player.name} cast ${player.classId === "warrior" ? "Verdict" : player.classId === "archer" ? "Seed Rain" : "Clean Storm"}`, player, undefined, now);
  }

  private spawnProjectile(input: ProjectileSpawnInput) {
    const { distanceTraveled = 0, ...projectile } = input;
    this.projectiles.push({
      id: `pr_${this.nextProjectileId++}`,
      distanceTraveled,
      ...projectile
    });
  }

  private getPlayerProjectileOrigin(player: PlayerEntity, type: ProjectileType) {
    if (type === "arrow") {
      return this.getMuzzlePoint(player, player.angle, 44, 7);
    }

    return this.getMuzzlePoint(player, player.angle, 40, 10);
  }

  private getTurretProjectileOrigin(turret: TurretEntity) {
    return this.getMuzzlePoint(turret, turret.angle, turret.boosted ? 52 : 46, 0);
  }

  private getMuzzlePoint(origin: { x: number; y: number }, angle: number, forward: number, lateral: number) {
    const forwardPoint = project(origin, angle, forward);
    const point = lateral === 0 ? forwardPoint : project(forwardPoint, angle + 90, lateral);
    return {
      ...point,
      distance: forward + Math.abs(lateral) * 0.35
    };
  }

  private getAimPoint(player: PlayerEntity) {
    return {
      x: Number.isFinite(player.input.aimX) ? clamp(player.input.aimX, 0, WORLD.width) : player.x,
      y: Number.isFinite(player.input.aimY) ? clamp(player.input.aimY, 0, WORLD.height) : player.y
    };
  }

  private getSanitizedAimPoint(player: PlayerEntity, input: PlayerInput) {
    return {
      x: Number.isFinite(input.aimX) ? clamp(input.aimX, 0, WORLD.width) : player.x,
      y: Number.isFinite(input.aimY) ? clamp(input.aimY, 0, WORLD.height) : player.y
    };
  }

  private getAimAngle(player: PlayerEntity, aimPoint: { x: number; y: number }, fallback: number) {
    return distance(player, aimPoint) > 1 ? angleTo(player, aimPoint) : fallback;
  }

  private faceAim(player: PlayerEntity) {
    player.angle = this.getAimAngle(player, this.getAimPoint(player), player.angle);
    player.input.angle = player.angle;
  }

  private updateProjectiles(deltaMs: number, now: number) {
    const deltaSeconds = deltaMs / 1000;
    const surviving: ProjectileEntity[] = [];

    for (const projectile of this.projectiles) {
      const travel = projectile.speed * deltaSeconds;
      const next = project(projectile, projectile.angle, travel);
      projectile.x = next.x;
      projectile.y = next.y;
      projectile.distanceTraveled += travel;

      if (
        projectile.distanceTraveled > projectile.maxDistance ||
        projectile.x < 0 ||
        projectile.x > WORLD.width ||
        projectile.y < 0 ||
        projectile.y > WORLD.height
      ) {
        continue;
      }

      if (this.isBlocked(projectile, COMBAT.projectileHitRadius * 0.65)) {
        this.effects.push({
          id: `fx_${this.nextEffectId++}`,
          type: "blocked_hit",
          ownerId: projectile.ownerId,
          x: projectile.x,
          y: projectile.y,
          angle: projectile.angle,
          radius: 34,
          startedAt: now,
          duration: 360
        });
        continue;
      }

      let hit = false;
      for (const target of this.players.values()) {
        if (target.id !== projectile.ownerId && target.alive && distance(projectile, target) <= COMBAT.projectileHitRadius) {
          this.damagePlayer(target, projectile.damage, projectile.ownerId);
          hit = true;
          break;
        }
      }

      if (!hit) {
        for (const turret of this.turrets) {
          if (turret.ownerId !== projectile.ownerId && distance(projectile, turret) <= COMBAT.projectileHitRadius) {
            this.damageTurret(turret, projectile.damage, projectile.ownerId, now);
            hit = true;
            break;
          }
        }
      }

      if (!hit) {
        surviving.push(projectile);
      }
    }

    this.projectiles = surviving;
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  private updateTurrets(now: number) {
    for (const turret of this.turrets) {
      if (turret.boosted && turret.boostEndsAt <= now) {
        turret.boosted = false;
      }

      const interval = turret.boosted ? COMBAT.turretBoostedAttackInterval : COMBAT.turretAttackInterval;
      if (now - turret.lastAttackAt < interval) {
        continue;
      }

      const range = turret.boosted ? COMBAT.turretBoostedRange : COMBAT.turretRange;
      const target = [...this.players.values()]
        .filter((player) => player.id !== turret.ownerId && player.alive && !player.spawnProtected && distance(player, turret) <= range)
        .sort((a, b) => distanceSq(turret, a) - distanceSq(turret, b))[0];

      if (!target) {
        continue;
      }

      turret.lastAttackAt = now;
      turret.angle = angleTo(turret, target);
      if (!turret.boosted) {
        this.damageTurret(turret, COMBAT.turretShotDamage, turret.ownerId, now);
      }

      if (turret.health <= 0) {
        continue;
      }

      const origin = this.getTurretProjectileOrigin(turret);
      this.spawnProjectile({
        ownerId: turret.ownerId,
        type: turret.boosted ? "turret_shot_boosted" : "turret_shot",
        x: origin.x,
        y: origin.y,
        angle: turret.angle,
        damage: turret.boosted ? COMBAT.turretBoostedDamage : COMBAT.turretShotDamage,
        speed: turret.boosted ? COMBAT.turretBoostedShotSpeed : COMBAT.turretShotSpeed,
        maxDistance: turret.boosted ? COMBAT.turretBoostedRange : COMBAT.turretRange,
        distanceTraveled: origin.distance
      });
    }

    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  private damageTurret(turret: TurretEntity, rawDamage: number, attackerId: string, now: number) {
    if (turret.health <= 0) {
      return;
    }
    turret.health -= rawDamage;
    if (turret.health <= 0) {
      this.destroyTurret(turret, attackerId, now);
    }
  }

  private destroyTurret(turret: TurretEntity, attackerId: string, now: number) {
    const owner = this.players.get(turret.ownerId);
    const attacker = this.players.get(attackerId);
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "turret_death",
      ownerId: attackerId,
      classId: owner?.classId ?? attacker?.classId,
      x: turret.x,
      y: turret.y - 4,
      angle: turret.angle,
      radius: 88,
      startedAt: now,
      duration: 820
    });
  }

  private damagePlayer(target: PlayerEntity, rawDamage: number, attackerId: string) {
    const now = Date.now();
    if (!target.alive) {
      return;
    }

    if (target.spawnGuardEndsAt > now) {
      this.effects.push({
        id: `fx_${this.nextEffectId++}`,
        type: "blocked_hit",
        ownerId: attackerId,
        classId: target.classId,
        x: target.x,
        y: target.y,
        angle: angleTo(this.players.get(attackerId) ?? target, target),
        radius: 42,
        startedAt: now,
        duration: 360
      });
      return;
    }

    let damage = rawDamage;
    if (target.shielded) {
      damage = Math.ceil(damage * 0.5);
      const attacker = this.players.get(attackerId);
      if (attacker && attacker.alive) {
        const reflectedDamage = Math.ceil(rawDamage * 0.3);
        this.recordDamageCredit(attacker, target.id, now);
        attacker.health -= reflectedDamage;
        this.addReflectEffects(target, attacker, reflectedDamage, now);
        if (attacker.health <= 0) {
          this.killPlayer(attacker, target.id, now);
        }
      }
    }

    this.recordDamageCredit(target, attackerId, now);
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "damage_number",
      ownerId: attackerId,
      classId: this.players.get(attackerId)?.classId,
      x: target.x,
      y: target.y - 54,
      angle: randomBetween(-12, 12),
      radius: target.shielded ? 44 : 58,
      startedAt: now,
      duration: 760,
      value: damage
    });

    target.health -= damage;
    if (target.health <= 0) {
      this.killPlayer(target, attackerId, now);
    }
  }

  private addReflectEffects(shieldOwner: PlayerEntity, attacker: PlayerEntity, reflectedDamage: number, now: number) {
    const reflectAngle = angleTo(shieldOwner, attacker);
    const reflectPoint = project(shieldOwner, reflectAngle, Math.min(58, Math.max(32, distance(shieldOwner, attacker) * 0.38)));
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "reflect",
      ownerId: shieldOwner.id,
      classId: shieldOwner.classId,
      x: reflectPoint.x,
      y: reflectPoint.y - 22,
      angle: reflectAngle,
      radius: 54,
      startedAt: now,
      duration: 460
    });
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "reflect_damage",
      ownerId: shieldOwner.id,
      classId: shieldOwner.classId,
      x: attacker.x,
      y: attacker.y - 58,
      angle: randomBetween(-12, 12),
      radius: 44,
      startedAt: now,
      duration: 820,
      value: reflectedDamage
    });
  }

  private recordDamageCredit(target: PlayerEntity, attackerId: string, now: number) {
    if (target.id === attackerId || !this.players.has(attackerId)) {
      return;
    }
    target.damageCredits.set(attackerId, now);
    for (const [playerId, creditAt] of target.damageCredits) {
      if (now - creditAt > COMBAT.assistWindowMs) {
        target.damageCredits.delete(playerId);
      }
    }
  }

  private killPlayer(target: PlayerEntity, attackerId: string, now = Date.now()) {
    target.alive = false;
    target.health = 0;
    target.killStreak = 0;
    target.respawnAt = now + WORLD.respawnMs;
    target.input = { ...EMPTY_INPUT };
    this.resetArcherCharge(target);
    target.actionPoseEndsAt = 0;
    target.action = null;
    target.actionStartedAt = 0;
    target.actionEndsAt = 0;
    target.attacking = false;
    this.addEffect("death", target, 120, 900);

    const attacker = this.players.get(attackerId);
    if (attacker && attacker.id !== target.id) {
      attacker.score += 1;
      attacker.killStreak += 1;
      this.pushEvent("kill", `${attacker.name} defeated ${target.name}`, attacker, target, now, {
        scoreDelta: 1,
        streak: attacker.killStreak
      });
      const assists = this.getAssistPlayers(target, attacker.id, now);
      for (const assister of assists) {
        assister.score = Number((assister.score + COMBAT.assistScore).toFixed(1));
      }
      if (assists.length > 0) {
        const names = assists.slice(0, 2).map((assister) => assister.name).join(", ");
        const suffix = assists.length > 2 ? ` +${assists.length - 2}` : "";
        this.pushEvent("assist", `${names}${suffix} assisted on ${target.name}`, assists[0], target, now, {
          participantIds: assists.map((assister) => assister.id),
          scoreDelta: COMBAT.assistScore
        });
      }
      if (attacker.killStreak === 3) {
        attacker.score += 2;
        this.pushEvent("streak", `${attacker.name} reached a 3 streak`, attacker, undefined, now, {
          scoreDelta: 2,
          streak: attacker.killStreak
        });
      }
      if (attacker.killStreak === 5) {
        attacker.score += 5;
        this.pushEvent("streak", `${attacker.name} reached a 5 streak`, attacker, undefined, now, {
          scoreDelta: 5,
          streak: attacker.killStreak
        });
      }
      if (attacker.killStreak === 10) {
        attacker.score += 10;
        this.pushEvent("streak", `${attacker.name} reached a 10 streak`, attacker, undefined, now, {
          scoreDelta: 10,
          streak: attacker.killStreak
        });
      }
    }
    target.damageCredits.clear();
  }

  private getAssistPlayers(target: PlayerEntity, killerId: string, now: number) {
    return [...target.damageCredits.entries()]
      .filter(([playerId, creditAt]) => playerId !== killerId && playerId !== target.id && now - creditAt <= COMBAT.assistWindowMs)
      .map(([playerId]) => this.players.get(playerId))
      .filter((player): player is PlayerEntity => Boolean(player));
  }

  private respawnPlayers(now: number) {
    for (const player of this.players.values()) {
      if (player.alive || player.respawnAt > now) {
        continue;
      }
      const stats = CLASS_STATS[player.classId];
      const spawn = this.randomArenaSpawnPoint(player.id);
      player.x = spawn.x;
      player.y = spawn.y;
      player.maxHealth = stats.maxHealth;
      player.health = stats.maxHealth;
      player.stamina = COMBAT.maxStamina;
      player.alive = true;
      player.sprinting = false;
      this.resetArcherCharge(player);
      player.actionPoseEndsAt = 0;
      player.action = null;
      player.actionStartedAt = 0;
      player.actionEndsAt = 0;
      player.attacking = false;
      player.shieldEndsAt = 0;
      player.spawnGuardEndsAt = now + SPAWN_GUARD_MS;
      player.rootEndsAt = 0;
      player.stunEndsAt = 0;
      player.damageCredits.clear();
      this.addEffect("shield", player, 96, 900);
    }
  }

  private checkHealthPackPickup(now: number) {
    const picked = new Set<string>();
    for (const player of this.players.values()) {
      if (!player.alive) {
        continue;
      }
      for (const healthPack of this.healthPacks) {
        if (distance(player, healthPack) <= WORLD.healthPackRadius) {
          player.health = Math.min(player.maxHealth, player.health + WORLD.healthPackHeal);
          picked.add(healthPack.id);
          this.effects.push({
            id: `fx_${this.nextEffectId++}`,
            type: "heal_pickup",
            ownerId: player.id,
            classId: player.classId,
            x: healthPack.x,
            y: healthPack.y,
            angle: 0,
            radius: 80,
            startedAt: now,
            duration: 700
          });
          this.pushEvent("heal", `${player.name} recovered from a field pickup`, player, undefined, now);
        }
      }
    }

    if (!picked.size) {
      return;
    }

    this.healthPacks = this.healthPacks.filter((healthPack) => !picked.has(healthPack.id));
    while (this.healthPacks.length < WORLD.healthPackCount) {
      this.healthPacks.push(this.createHealthPack());
    }
  }

  private spawnInitialHealthPacks() {
    while (this.healthPacks.length < WORLD.healthPackCount) {
      this.healthPacks.push(this.createHealthPack());
    }
  }

  private createHealthPack(): HealthPackState {
    const position = this.randomSpawnPoint(220);
    return {
      id: `hp_${this.nextHealthPackId++}`,
      x: position.x,
      y: position.y,
      imageIndex: Math.floor(randomBetween(0, WORLD.healthPackVariantCount))
    };
  }

  private addEffect(type: EffectState["type"], owner: PlayerEntity, radius: number, duration: number, value?: number, forwardOffset = 0) {
    const origin = forwardOffset > 0 ? project(owner, owner.angle, forwardOffset) : owner;
    this.addEffectAt(type, owner, origin, owner.angle, radius, duration, value);
  }

  private addEffectAt(
    type: EffectState["type"],
    owner: PlayerEntity,
    origin: { x: number; y: number },
    angle: number,
    radius: number,
    duration: number,
    value?: number
  ) {
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type,
      ownerId: owner.id,
      classId: owner.classId,
      x: origin.x,
      y: origin.y,
      angle,
      radius,
      startedAt: Date.now(),
      duration,
      value
    });
  }

  private setActionPose(player: PlayerEntity, now: number, durationMs: number, action: PlayerActionState) {
    const nextEndsAt = now + durationMs;
    if (!player.action || nextEndsAt >= player.actionPoseEndsAt) {
      player.action = action;
      player.actionStartedAt = now;
    }
    player.actionPoseEndsAt = Math.max(player.actionPoseEndsAt, nextEndsAt);
    player.actionEndsAt = player.actionPoseEndsAt;
    player.attacking = true;
  }

  private pushEvent(type: CombatEventType, message: string, actor?: PlayerEntity, target?: PlayerEntity, now = Date.now(), meta: CombatEventMeta = {}) {
    this.events.push({
      id: `ev_${this.nextEventId++}`,
      type,
      at: now,
      actorId: actor?.id,
      actorName: actor?.name,
      targetId: target?.id,
      targetName: target?.name,
      participantIds: meta.participantIds,
      classId: actor?.classId,
      scoreDelta: meta.scoreDelta,
      streak: meta.streak,
      message
    });

    this.events = this.events.filter((event) => event.at + EVENT_TTL_MS > now).slice(-EVENT_LIMIT);
  }

  private randomSpawnPoint(padding = 180) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const point = {
        x: randomBetween(padding, WORLD.width - padding),
        y: randomBetween(padding, WORLD.height - padding)
      };
      if (!this.isBlocked(point, COMBAT.playerRadius + 12)) {
        return point;
      }
    }

    return this.resolveMapCollision(
      {
        x: randomBetween(padding, WORLD.width - padding),
        y: randomBetween(padding, WORLD.height - padding)
      },
      COMBAT.playerRadius + 12
    );
  }

  private randomArenaSpawnPoint(excludePlayerId?: string) {
    const center = { x: WORLD.width / 2, y: WORLD.height / 2 };
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const radius = randomBetween(1180, 2400);
      const point = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      };
      if (this.isSpawnClear(point, excludePlayerId)) {
        return point;
      }
    }

    return this.randomSpawnPoint(760);
  }

  private isSpawnClear(point: { x: number; y: number }, excludePlayerId?: string) {
    if (this.isBlocked(point, COMBAT.playerRadius + 20)) {
      return false;
    }

    for (const player of this.players.values()) {
      if (player.id === excludePlayerId || !player.alive) {
        continue;
      }
      if (distance(point, player) < 520) {
        return false;
      }
    }

    for (const turret of this.turrets) {
      if (distance(point, turret) < 260) {
        return false;
      }
    }

    return true;
  }

  private humanSpawnPoint(playerId?: string) {
    return this.fixedSpawnEnabled && this.fixedSpawnPoint ? this.fixedReviewSpawnPoint() : this.randomArenaSpawnPoint(playerId);
  }

  private fixedReviewSpawnPoint() {
    if (this.fixedSpawnPoint) {
      return this.resolveMapCollision(this.fixedSpawnPoint, COMBAT.playerRadius + 20);
    }

    const center = { x: WORLD.width / 2, y: WORLD.height / 2 };
    const candidates = [
      center,
      { x: center.x + 360, y: center.y },
      { x: center.x - 360, y: center.y },
      { x: center.x, y: center.y + 360 },
      { x: center.x, y: center.y - 360 },
      { x: center.x + 520, y: center.y + 280 },
      { x: center.x - 520, y: center.y - 280 }
    ];

    for (const point of candidates) {
      if (!this.isBlocked(point, COMBAT.playerRadius + 20)) {
        return point;
      }
    }

    return this.resolveMapCollision(center, COMBAT.playerRadius + 20);
  }

  private botSpawnPoint(index: number) {
    const angle = (Math.PI * 2 * index) / Math.max(1, BOT_NAMES.length);
    const radius = 1850 + (index % 2) * 260;
    const base = {
      x: WORLD.width / 2 + Math.cos(angle) * radius,
      y: WORLD.height / 2 + Math.sin(angle) * radius
    };
    return {
      ...this.resolveMapCollision(
        {
          x: clamp(base.x + randomBetween(-180, 180), 160, WORLD.width - 160),
          y: clamp(base.y + randomBetween(-180, 180), 160, WORLD.height - 160)
        },
        COMBAT.playerRadius + 12
      )
    };
  }

  private toPublicPlayer(player: PlayerEntity): PublicPlayer {
    return {
      id: player.id,
      name: player.name,
      classId: player.classId,
      x: player.x,
      y: player.y,
      angle: player.angle,
      health: player.health,
      maxHealth: player.maxHealth,
      stamina: Number(player.stamina.toFixed(1)),
      maxStamina: player.maxStamina,
      score: player.score,
      killStreak: player.killStreak,
      alive: player.alive,
      respawnAt: player.respawnAt,
      attacking: player.attacking,
      action: player.attacking ? player.action : null,
      actionStartedAt: player.attacking ? player.actionStartedAt : 0,
      actionEndsAt: player.attacking ? player.actionEndsAt : 0,
      shielded: player.shielded,
      spawnProtected: player.spawnProtected,
      rooted: player.rooted,
      stunned: player.stunned,
      sprinting: player.sprinting,
      bot: player.bot,
      cooldowns: player.cooldowns
    };
  }
}

import {
  angleDiff,
  angleTo,
  ARENA_DUEL_REALM,
  CLASS_META,
  CLASS_ORDER,
  CLASS_DAMAGE_MULTIPLIERS,
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
  roundDamage,
  getArcherChargedArrowBaseDamageForStage,
  getDefaultArenaCatalogLoadout,
  getDefaultArenaLoadout,
  getArenaSkillSpec,
  getArenaSkillDamageMultiplier,
  getArenaCatalogSkill,
  getArcherBowAnchor,
  getArcherThrowAnchor,
  getMageStaffAnchor,
  getMageTimedVisual,
  getMageTimedVisualDuration,
  getRuntimeMageSkill,
  getSkillCooldownMs,
  MAGE_TARGET_TORSO_OFFSET_Y,
  WORLD,
  isBlocked,
  type ArenaLoadout,
  type ArenaCatalogLoadout,
  type ArenaCatalogSkillId,
  type ArenaStatusState,
  type ArenaGameMode,
  type ArenaLoadoutSlot,
  type ArenaTeamId,
  type ClassId,
  type Collider,
  type CombatEvent,
  type CombatEventType,
  type DuelRealmState,
  type EffectState,
  type EngineerTurretKind,
  type GameSnapshot,
  type AttackBoostPackState,
  type HealthPackState,
  type JoinAccepted,
  type JoinRequest,
  type MageTimedSkillId,
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
  type TurretState,
  type RuntimeMageSkillId
} from "@renaiss-game/shared";

type Cooldowns = Record<SkillKey, number>;
type CombatEventMeta = Pick<CombatEvent, "participantIds" | "scoreDelta" | "streak">;

interface PlayerEntity extends Omit<PublicPlayer, "statuses"> {
  socketId: string | null;
  input: PlayerInput;
  lastProcessedInputSequence: number;
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
  poisonEndsAt: number;
  slowEndsAt: number;
  vulnerabilityEndsAt: number;
  sunlightBrandStartsAt: number;
  sunlightBrandEndsAt: number;
  silenceStartsAt: number;
  silenceEndsAt: number;
  dashLockEndsAt: number;
  dodgeEndsAt: number;
  counterStanceEndsAt: number;
  counterTriggered: boolean;
  engineerSupportEndsAt: number;
  enchantedMeleeHitsRemaining: number;
  enchantedMeleeEndsAt: number;
  moveSpeedBoostEndsAt: number;
  blazingRampageDamageBoostEndsAt: number;
  steadyAimReady: boolean;
  focusLensStartsAt: number;
  damageBoostMultiplier: number;
  hunterMarkEndsAt: number;
  hunterMarkOwnerId: string | null;
  magicMarkTargetId: string | null;
  magicMarkEndsAt: number;
  duelPartnerId: string | null;
  duelStartedAt: number;
  duelEndsAt: number;
  duelCenterX: number;
  duelCenterY: number;
  damageCredits: Map<string, number>;
  aiSeed: number;
  aiNextDecisionAt: number;
}

interface ProjectileEntity extends ProjectileState {
  speed: number;
  damage: number;
  damageScaling?: "class" | "preset";
  distanceTraveled: number;
  maxDistance: number;
  targetId?: string;
  splitDamage?: number;
  remainingHits?: number;
  hitTargetIds?: Set<string>;
  onHit?: {
    slowMultiplier?: number;
    slowDurationMs?: number;
    rootDurationMs?: number;
    stunDurationMs?: number;
    appliesPoison?: boolean;
    pull?: number;
    vulnerabilityDurationMs?: number;
    dashLockDurationMs?: number;
    returnDamage?: number;
    returnDelayMs?: number;
    consumeHunterMark?: boolean;
  };
  homingTurnRate?: number;
  ignoresTerrain?: boolean;
  /** Keeps hook/vine contact visible for its authored recovery window. */
  contactEndsAt?: number;
  /** Web-runtime boomerang leg that visibly travels back to its owner. */
  returningToOwner?: boolean;
  returnStartsAt?: number;
}

interface ProjectileSpawnInput
  extends Omit<
    ProjectileEntity,
    "id" | "distanceTraveled" | "spawnX" | "spawnY"
  > {
  distanceTraveled?: number;
}

interface TurretEntity extends TurretState {
  lastAttackAt: number;
  deployedAt: number;
  supportEndsAt: number;
  markedTargetId: string | null;
  markedEndsAt: number;
  enhancedShots: number;
  armorCoreEndsAt: number;
}

type DamageableAimTarget =
  | { kind: "player"; target: PlayerEntity }
  | { kind: "turret"; target: TurretEntity };

interface DamageOverTimeEntity {
  id: string;
  ownerId: string;
  targetId: string;
  skillId: ArenaCatalogSkillId;
  damage: number;
  nextTickAt: number;
  tickIntervalMs: number;
  endsAt: number;
}

interface CatalogFieldEntity {
  id: string;
  ownerId: string;
  skillId: ArenaCatalogSkillId;
  x: number;
  y: number;
  radius: number;
  startsAt?: number;
  endsAt: number;
  nextTickAt?: number;
  tickIntervalMs?: number;
  triggeredTargetIds: Set<string>;
}

interface BarrierEntity {
  id: string;
  effectId: string;
  ownerId: string;
  networkId: string;
  startTurretId: string;
  endTurretId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  health: number;
  maxHealth: number;
  thickness: number;
  endsAt: number;
  stunnedTargetIds: Set<string>;
}

interface ScheduledCatalogAction {
  runAt: number;
  ownerId: string;
  execute: (now: number) => void;
}

type ArcherMotionSkillId = "archer_01" | "archer_06" | "archer_14";

interface CatalogPlayerMotion {
  skillId: ArcherMotionSkillId;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startedAt: number;
  endsAt: number;
}

interface ScheduledMagicMissile {
  fireAt: number;
  turretId: string;
  ownerId: string;
  targetId: string;
  type: Extract<ProjectileType, "magic_turret_matrix">;
  damage: number;
}

type MageFieldSkillId = Extract<RuntimeMageSkillId, "mage_08" | "mage_13" | "mage_14">;

interface MageFieldEntity {
  id: string;
  ownerId: string;
  skillId: MageFieldSkillId;
  x: number;
  y: number;
  radius: number;
  startedAt: number;
  endsAt: number;
  nextTickAt: number;
  rootedTargetIds: Set<string>;
}

interface SoulChainEntity {
  ownerId: string;
  targetId: string;
  effectId: string;
  startsAt: number;
  endsAt: number;
}

export interface GameRoomOptions {
  mode?: ArenaGameMode;
  humanCapacity?: number;
  mapProps?: MapProp[];
  noBots?: boolean;
  fixedSpawn?: boolean;
  invulnerableHumans?: boolean;
  fixedSpawnPoint?: { x: number; y: number };
  freezeBots?: boolean;
  invulnerableBots?: boolean;
  reviewBotCount?: number;
  reviewBotHealth?: number;
  fixedBotSpawnPoint?: { x: number; y: number };
}

const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  angle: 0,
  aimX: 0,
  aimY: 0,
  attack: false,
  sprint: false,
  skillF: false,
  skillQ: false,
  skillE: false,
  skillR: false
};

const BOT_NAMES = ["RIVAL_AZ", "RIVAL_BX", "RIVAL_CQ", "RIVAL_D9", "RIVAL_KI", "RIVAL_N7", "RIVAL_Q3", "RIVAL_VX"];
const TARGET_ROOM_POPULATION = BOT_NAMES.length;
const EVENT_TTL_MS = 9000;
const EVENT_LIMIT = 18;
const SPAWN_GUARD_MS = 8500;
const TURRET_DEPLOY_DISTANCE = COMBAT.playerRadius + COMBAT.turretRadius + 48;
const TURRET_DEPLOY_ANGLE_OFFSETS = [0, -32, 32, -64, 64, 180] as const;
// Keep Engineer barrier links outside the 54 px mechanical-turret body. The
// runtime line must meet each turret at its inward-facing visual edge instead
// of crossing through either turret's center.
const ENGINEER_BARRIER_TURRET_VISUAL_RADIUS = 27;
const ENGINEER_SUPPORT_DURATION_MS = 4000;
const ENGINEER_SUPPORT_PLAYER_DAMAGE_MULTIPLIER = 0.8;
const ENGINEER_SUPPORT_TURRET_DAMAGE_MULTIPLIER = 0.2;
const PLAYER_PROJECTILE_HURTBOX = {
  topOffset: -86,
  bottomOffset: -8,
  radius: COMBAT.projectileHitRadius
} as const;

const BLAZING_RAMPAGE = (() => {
  const spec = getArenaSkillSpec("warrior_01");
  const { durationMs, moveSpeedMultiplier, damageMultiplier } = spec?.numbers ?? {};
  if (!durationMs || !moveSpeedMultiplier || !damageMultiplier) {
    throw new Error("warrior_01 requires duration, move-speed and damage multipliers");
  }
  return { durationMs, moveSpeedMultiplier, damageMultiplier };
})();

function getMageTimedEffectState(
  skillId: MageTimedSkillId,
  now: number,
  activeDurationMs?: number
) {
  const timeline = getMageTimedVisual(skillId);
  if (!timeline) {
    throw new Error(`Mage skill ${skillId} has no timed visual contract`);
  }
  const activeDuration = activeDurationMs ?? timeline.activeDurationMs;
  return {
    duration: getMageTimedVisualDuration(
      skillId,
      activeDuration
    ),
    timing: {
      activeStartedAt: now + timeline.introDurationMs,
      activeDuration
    } satisfies Pick<
      EffectState,
      "activeStartedAt" | "activeDuration"
    >
  };
}

export class GameRoom {
  private readonly mode: ArenaGameMode;
  private readonly humanCapacity: number;
  private readonly mapColliders: Collider[];
  private readonly botsEnabled: boolean;
  private readonly fixedSpawnEnabled: boolean;
  private readonly invulnerableHumans: boolean;
  private readonly fixedSpawnPoint: { x: number; y: number } | null;
  private readonly freezeBots: boolean;
  private readonly invulnerableBots: boolean;
  private readonly reviewBotCount: number | null;
  private readonly reviewBotHealth: number | null;
  private readonly fixedBotSpawnPoint: { x: number; y: number } | null;
  private players = new Map<string, PlayerEntity>();
  private socketToPlayer = new Map<string, string>();
  private projectiles: ProjectileEntity[] = [];
  private turrets: TurretEntity[] = [];
  private scheduledMagicMissiles: ScheduledMagicMissile[] = [];
  private mageFields: MageFieldEntity[] = [];
  private damageOverTime: DamageOverTimeEntity[] = [];
  private catalogFields: CatalogFieldEntity[] = [];
  private barriers: BarrierEntity[] = [];
  private soulChains: SoulChainEntity[] = [];
  private scheduledCatalogActions: ScheduledCatalogAction[] = [];
  private catalogPlayerMotions = new Map<string, CatalogPlayerMotion>();
  private healthPacks: HealthPackState[] = [];
  private attackBoostPacks: AttackBoostPackState[] = [];
  private effects: EffectState[] = [];
  private events: CombatEvent[] = [];
  private nextProjectileId = 1;
  private nextTurretId = 1;
  private nextHealthPackId = 1;
  private nextAttackBoostPackId = 1;
  private nextEffectId = 1;
  private nextEventId = 1;
  private roundNumber = 0;
  private roundPhase: RoundPhase = "playing";
  private roundStartedAt = Date.now();
  private roundEndsAt = this.roundStartedAt + WORLD.roundDurationMs;
  private nextRoundAt: number | null = null;
  private roundWinner: LeaderboardEntry | null = null;
  private winningTeam: ArenaTeamId | null = null;
  private teamScores: Record<ArenaTeamId, number> = { red: 0, blue: 0 };

  constructor(options: GameRoomOptions = {}) {
    this.mode = options.mode ?? "free_for_all";
    this.humanCapacity = Math.max(
      1,
      Math.floor(options.humanCapacity ?? (this.mode === "team_3v3" ? 6 : 8))
    );
    this.mapColliders = options.mapProps ? mapPropsToColliders(options.mapProps) : MAP_COLLIDERS;
    this.botsEnabled = !options.noBots;
    this.fixedSpawnEnabled = options.fixedSpawn === true;
    this.invulnerableHumans = options.invulnerableHumans === true;
    this.fixedSpawnPoint = options.fixedSpawnPoint ?? null;
    this.freezeBots = options.freezeBots === true;
    this.invulnerableBots = options.invulnerableBots === true;
    this.reviewBotCount =
      options.reviewBotCount === undefined
        ? null
        : Math.max(0, Math.min(BOT_NAMES.length, Math.floor(options.reviewBotCount)));
    this.reviewBotHealth =
      options.reviewBotHealth === undefined
        ? null
        : Math.max(1, Math.min(10000, options.reviewBotHealth));
    this.fixedBotSpawnPoint = options.fixedBotSpawnPoint ?? null;
    this.spawnInitialHealthPacks();
    this.spawnInitialAttackBoostPacks();
    this.ensureBots();
  }

  private resolveMapCollision(position: { x: number; y: number }, radius: number) {
    return resolveMapCollision(position, radius, this.mapColliders);
  }

  private isBlocked(position: { x: number; y: number }, radius = 0) {
    return isBlocked(position, radius, this.mapColliders);
  }

  addHuman(socketId: string, request: JoinRequest, sessionToken: string): JoinAccepted {
    if (!this.hasHumanCapacity()) {
      throw new Error("Arena match is full.");
    }
    const hadHumans = this.playerCount() > 0;
    const id = this.createHumanId(socketId);
    const player = this.createPlayer({
      id,
      socketId,
      name: request.name?.trim().slice(0, 14) || "GUEST_2AC1",
      classId: request.classId,
      loadout: request.loadout,
      catalogLoadout: request.catalogLoadout,
      team: this.assignHumanTeam(),
      engineerTurretKind: request.engineerTurretKind ?? "mechanical"
    });
    const spawn = this.humanSpawnPoint(id, player.team);
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

    return this.joinAcceptedFor(player, sessionToken, false);
  }

  reconnectHuman(socketId: string, playerId: string, sessionToken: string): JoinAccepted | null {
    const player = this.players.get(playerId);
    if (!player || player.bot || player.socketId !== null || this.socketToPlayer.has(socketId)) {
      return null;
    }
    player.socketId = socketId;
    player.input = { ...EMPTY_INPUT };
    this.socketToPlayer.set(socketId, playerId);
    this.pushEvent("join", `${player.name} reconnected to ${WORLD.villageName}`, player);
    return this.joinAcceptedFor(player, sessionToken, true);
  }

  detachHuman(socketId: string) {
    const playerId = this.socketToPlayer.get(socketId);
    const player = playerId ? this.players.get(playerId) : null;
    if (!player || player.bot) return null;
    player.socketId = null;
    player.input = { ...EMPTY_INPUT };
    player.attacking = false;
    player.sprinting = false;
    this.socketToPlayer.delete(socketId);
    return playerId;
  }

  removeHuman(socketId: string) {
    const playerId = this.socketToPlayer.get(socketId);
    if (playerId) this.removeHumanByPlayerId(playerId);
  }

  removeHumanByPlayerId(playerId: string) {
    const player = this.players.get(playerId);
    if (!player || player.bot) return;
    if (player.socketId) this.socketToPlayer.delete(player.socketId);
    this.endDuelForPlayer(playerId);
    this.players.delete(playerId);
    this.catalogPlayerMotions.delete(playerId);
    this.projectiles = this.projectiles.filter((projectile) => projectile.ownerId !== playerId && projectile.targetId !== playerId);
    this.turrets = this.turrets.filter((turret) => turret.ownerId !== playerId);
    this.scheduledMagicMissiles = this.scheduledMagicMissiles.filter(
      (missile) => missile.ownerId !== playerId && missile.targetId !== playerId
    );
    this.mageFields = this.mageFields.filter((field) => field.ownerId !== playerId);
    this.damageOverTime = this.damageOverTime.filter(
      (effect) => effect.ownerId !== playerId && effect.targetId !== playerId
    );
    this.catalogFields = this.catalogFields.filter((field) => field.ownerId !== playerId);
    this.removeOwnedBarriers(playerId);
    this.removeSoulChainsForPlayer(playerId);
    this.scheduledCatalogActions = this.scheduledCatalogActions.filter(
      (action) => action.ownerId !== playerId
    );
    this.ensureBots();
  }

  private joinAcceptedFor(
    player: PlayerEntity,
    sessionToken: string,
    reconnected: boolean
  ): JoinAccepted {
    return {
      playerId: player.id,
      sessionToken,
      reconnected,
      world: {
        width: WORLD.width,
        height: WORLD.height,
        villageName: WORLD.villageName
      },
      movement: {
        inputRateHz: WORLD.tickRate,
        snapshotRateHz: WORLD.broadcastRate,
        moveSpeed: CLASS_STATS[player.classId].moveSpeed,
        sprintSpeedMultiplier: COMBAT.sprintSpeedMultiplier,
        playerRadius: COMBAT.playerRadius,
        maxStamina: COMBAT.maxStamina,
        sprintMinStamina: COMBAT.sprintMinStamina,
        sprintDrainPerSecond: COMBAT.sprintDrainPerSecond,
        sprintRegenPerSecond: COMBAT.sprintRegenPerSecond
      }
    };
  }

  switchHumanClass(
    socketId: string,
    classId: ClassId,
    loadout: ArenaLoadout,
    catalogLoadout: ArenaCatalogLoadout,
    engineerTurretKind: EngineerTurretKind = "mechanical"
  ) {
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
    player.loadout = { ...loadout };
    player.catalogLoadout = { ...catalogLoadout };
    player.engineerTurretKind = engineerTurretKind;
    player.maxHealth = stats.maxHealth;
    player.health = player.alive ? stats.maxHealth : 0;
    player.stamina = COMBAT.maxStamina;
    player.maxStamina = COMBAT.maxStamina;
    player.cooldowns = { skillF: 0, skillQ: 0, skillE: 0, skillR: 0 };
    player.input = { ...EMPTY_INPUT };
    this.resetArcherCharge(player);
    player.action = null;
    player.actionSkillId = null;
    player.actionStartedAt = 0;
    player.actionEndsAt = 0;
    player.actionPoseEndsAt = 0;
    player.attacking = false;
    player.shielded = false;
    player.attackBoosted = false;
    player.attackBoostEndsAt = 0;
    player.damageBoostMultiplier = 1;
    player.rooted = false;
    player.stunned = false;
    player.poisoned = false;
    player.slowed = false;
    player.slowMultiplier = 1;
    player.sprinting = false;
    player.shieldEndsAt = 0;
    player.rootEndsAt = 0;
    player.stunEndsAt = 0;
    player.poisonEndsAt = 0;
    player.slowEndsAt = 0;
    player.vulnerabilityEndsAt = 0;
    player.sunlightBrandStartsAt = 0;
    player.sunlightBrandEndsAt = 0;
    player.silenceStartsAt = 0;
    player.silenceEndsAt = 0;
    player.dashLockEndsAt = 0;
    player.dodgeEndsAt = 0;
    player.counterStanceEndsAt = 0;
    player.counterTriggered = false;
    player.engineerSupportEndsAt = 0;
    player.enchantedMeleeHitsRemaining = 0;
    player.enchantedMeleeEndsAt = 0;
    player.moveSpeedBoostEndsAt = 0;
    player.blazingRampageDamageBoostEndsAt = 0;
    player.steadyAimReady = false;
    player.focusLensStartsAt = 0;
    player.focusLensEndsAt = 0;
    player.concealmentEndsAt = 0;
    player.hunterMarkEndsAt = 0;
    player.hunterMarkOwnerId = null;
    player.magicMarkTargetId = null;
    player.magicMarkEndsAt = 0;
    player.duelPartnerId = null;
    player.duelStartedAt = 0;
    player.duelEndsAt = 0;
    player.duelCenterX = 0;
    player.duelCenterY = 0;
    player.damageCredits.clear();
    this.projectiles = this.projectiles.filter((projectile) => projectile.ownerId !== player.id);
    this.turrets = this.turrets.filter((turret) => turret.ownerId !== player.id);
    this.scheduledMagicMissiles = this.scheduledMagicMissiles.filter((missile) => missile.ownerId !== player.id);
    this.mageFields = this.mageFields.filter((field) => field.ownerId !== player.id);
    this.damageOverTime = this.damageOverTime.filter(
      (effect) => effect.ownerId !== player.id && effect.targetId !== player.id
    );
    this.catalogFields = this.catalogFields.filter((field) => field.ownerId !== player.id);
    this.removeOwnedBarriers(player.id);
    this.removeSoulChainsForPlayer(player.id);
    this.scheduledCatalogActions = this.scheduledCatalogActions.filter(
      (action) => action.ownerId !== player.id
    );
    this.catalogPlayerMotions.delete(player.id);

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
    const engineerTurretKind: EngineerTurretKind =
      input.engineerTurretKind === undefined
        ? player.engineerTurretKind
        : input.engineerTurretKind === "magic_missile"
          ? "magic_missile"
          : "mechanical";
    player.input = {
      sequence: Number.isFinite(input.sequence)
        ? Math.max(0, Math.floor(input.sequence ?? 0))
        : player.input.sequence,
      moveX: clamp(input.moveX, -1, 1),
      moveY: clamp(input.moveY, -1, 1),
      angle: this.getAimAngle(player, aimPoint, Number.isFinite(input.angle) ? input.angle : player.angle),
      aimX: aimPoint.x,
      aimY: aimPoint.y,
      attack: Boolean(input.attack),
      sprint: Boolean(input.sprint),
      // Skill buttons are edge-like requests carried over a state transport.
      // Latch each positive packet until the next authoritative simulation tick
      // so a 30 Hz client pulse cannot be overwritten by its following false
      // packet before the independently scheduled 30 Hz room update observes it.
      skillF: player.input.skillF || Boolean(input.skillF),
      skillQ: player.input.skillQ || Boolean(input.skillQ),
      skillE: player.input.skillE || Boolean(input.skillE),
      skillR: player.input.skillR || Boolean(input.skillR),
      engineerTurretKind
    };
    player.engineerTurretKind = engineerTurretKind;
  }

  update(deltaMs: number) {
    const now = Date.now();
    this.ensureBots();
    this.updateCatalogStatuses(now);
    this.updateBarriers(now);
    this.updateMageFields(now);
    this.updateStatusFlags(now);
    this.updateRoundLifecycle(now);
    if (this.roundPhase === "playing") {
      this.updateBots(now);
      this.updatePlayers(deltaMs, now);
      this.updateCatalogPlayerMotions(now);
      this.updateSoulChains(now);
      this.updateScheduledCatalogActions(now);
      this.updateScheduledMagicMissiles(now);
      this.updateProjectiles(deltaMs, now);
      this.updateTurrets(now);
      this.checkHealthPackPickup(now);
      this.checkAttackBoostPackPickup(now);
      this.respawnPlayers(now);
      this.updateRoundLifecycle(now);
    }
    this.effects = this.effects.filter((effect) => effect.startedAt + effect.duration > now);
    this.events = this.events.filter((event) => event.at + EVENT_TTL_MS > now).slice(-EVENT_LIMIT);
  }

  snapshotFor(socketId: string): GameSnapshot {
    const now = Date.now();
    const selfId = this.socketToPlayer.get(socketId) ?? null;
    const viewer = selfId ? this.players.get(selfId) ?? null : null;
    const viewerDimensionId = viewer
      ? this.getActiveDuelDimensionId(viewer, now)
      : null;
    const serializedPlayers = [...this.players.values()].map((entity) => ({
      entity,
      publicPlayer: this.toPublicPlayer(entity, now)
    }));
    const allPlayers = serializedPlayers.map(({ publicPlayer }) => publicPlayer);
    const players = serializedPlayers
      .filter(
        ({ entity }) =>
          this.getActiveDuelDimensionId(entity, now) === viewerDimensionId &&
          !this.isConcealedFromViewer(entity, selfId, now)
      )
      .map(({ publicPlayer }) => publicPlayer);
    const leaderboard = this.getLeaderboard(allPlayers, 8);
    const projectiles = this.projectiles.filter(
      (projectile) =>
        (projectile.dimensionId ?? null) === viewerDimensionId
    );
    const effects = this.effects.filter(
      (effect) =>
        this.getEffectDimensionId(effect, now) === viewerDimensionId
    );

    return {
      serverTime: now,
      selfId,
      selfLastProcessedInputSequence: viewer?.lastProcessedInputSequence ?? 0,
      round: this.toRoundState(),
      players,
      projectiles: projectiles.map((projectile) => ({
        id: projectile.id,
        ownerId: projectile.ownerId,
        sourceTurretId: projectile.sourceTurretId,
        skillId: projectile.skillId,
        dimensionId: projectile.dimensionId,
        type: projectile.type,
        spawnX: projectile.spawnX,
        spawnY: projectile.spawnY,
        x: projectile.x,
        y: projectile.y,
        angle: projectile.angle,
        phase: projectile.phase
      })),
      turrets: (viewerDimensionId ? [] : this.turrets).map(({ id, ownerId, x, y, angle, health, maxHealth, shield, shieldEndsAt, kind, deployedAt }) => ({
        id,
        ownerId,
        x,
        y,
        angle,
        health,
        maxHealth,
        shield,
        shieldEndsAt,
        kind,
        deployedAt
      })),
      healthPacks: viewerDimensionId ? [] : this.healthPacks,
      attackBoostPacks: viewerDimensionId ? [] : this.attackBoostPacks,
      effects,
      duelRealm: viewer ? this.getDuelRealmForViewer(viewer, now) : null,
      events: this.events.slice(-EVENT_LIMIT),
      leaderboard
    };
  }

  private createHumanId(socketId: string) {
    const sanitized = socketId.replace(/[^a-zA-Z0-9_-]/g, "") || "player";
    const base = `p_${sanitized.slice(0, 8)}`;
    if (!this.players.has(base)) {
      return base;
    }

    let suffix = 2;
    while (this.players.has(`${base}_${suffix}`)) {
      suffix += 1;
    }
    return `${base}_${suffix}`;
  }

  playerCount() {
    return [...this.players.values()].filter((player) => !player.bot).length;
  }

  hasHumanCapacity() {
    return this.playerCount() < this.humanCapacity;
  }

  capacity() {
    return this.humanCapacity;
  }

  botCount() {
    return [...this.players.values()].filter((player) => player.bot).length;
  }

  contentRequirementsFor(request: JoinRequest) {
    const classIds = new Set<ClassId>([request.classId]);
    const skillIds = new Set<ArenaCatalogSkillId>();
    const addLoadout = (loadout: ArenaCatalogLoadout) => {
      for (const skillId of [loadout.skillQ, loadout.skillE, loadout.skillR]) {
        if (skillId) skillIds.add(skillId);
      }
    };
    addLoadout(request.catalogLoadout);
    for (const player of this.players.values()) {
      classIds.add(player.classId);
      addLoadout(player.catalogLoadout);
    }
    return {
      classIds: [...classIds].sort(),
      skillIds: [...skillIds].sort()
    };
  }

  private createPlayer(input: {
    id: string;
    socketId: string | null;
    name: string;
    classId: ClassId;
    loadout: ArenaLoadout;
    catalogLoadout: ArenaCatalogLoadout;
    team?: ArenaTeamId | null;
    engineerTurretKind?: EngineerTurretKind;
    bot?: boolean;
  }): PlayerEntity {
    const stats = CLASS_STATS[input.classId];
    const spawn = this.randomSpawnPoint();
    const cooldowns: Cooldowns = { skillF: 0, skillQ: 0, skillE: 0, skillR: 0 };

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
      attackBoosted: false,
      attackBoostEndsAt: 0,
      spawnProtected: !input.bot,
      rooted: false,
      stunned: false,
      poisoned: false,
      slowed: false,
      slowMultiplier: 1,
      sprinting: false,
      bot: Boolean(input.bot),
      team: input.team ?? null,
      engineerTurretKind: input.engineerTurretKind ?? "mechanical",
      loadout: { ...input.loadout },
      catalogLoadout: { ...input.catalogLoadout },
      cooldowns,
      input: { ...EMPTY_INPUT },
      lastProcessedInputSequence: 0,
      lastAttackAt: 0,
      archerChargeStartedAt: 0,
      action: null,
      actionSkillId: null,
      actionStartedAt: 0,
      actionEndsAt: 0,
      actionPoseEndsAt: 0,
      respawnAt: 0,
      shieldEndsAt: 0,
      spawnGuardEndsAt: input.bot ? 0 : Date.now() + SPAWN_GUARD_MS,
      rootEndsAt: 0,
      stunEndsAt: 0,
      poisonEndsAt: 0,
      slowEndsAt: 0,
      vulnerabilityEndsAt: 0,
      sunlightBrandStartsAt: 0,
      sunlightBrandEndsAt: 0,
      silenceStartsAt: 0,
      silenceEndsAt: 0,
      dashLockEndsAt: 0,
      dodgeEndsAt: 0,
      counterStanceEndsAt: 0,
      counterTriggered: false,
      engineerSupportEndsAt: 0,
      enchantedMeleeHitsRemaining: 0,
      enchantedMeleeEndsAt: 0,
      moveSpeedBoostEndsAt: 0,
      blazingRampageDamageBoostEndsAt: 0,
      steadyAimReady: false,
      focusLensStartsAt: 0,
      focusLensEndsAt: 0,
      concealmentEndsAt: 0,
      damageBoostMultiplier: 1,
      hunterMarkEndsAt: 0,
      hunterMarkOwnerId: null,
      magicMarkTargetId: null,
      magicMarkEndsAt: 0,
      duelPartnerId: null,
      duelStartedAt: 0,
      duelEndsAt: 0,
      duelCenterX: 0,
      duelCenterY: 0,
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
    const leadingTeam =
      this.teamScores.red === this.teamScores.blue
        ? null
        : this.teamScores.red > this.teamScores.blue
          ? "red"
          : "blue";
    const winningTeam =
      this.mode === "team_3v3" &&
      leadingTeam &&
      this.teamScores[leadingTeam] >= WORLD.scoreLimit
        ? leadingTeam
        : null;
    const scoreLimitReached =
      this.mode === "team_3v3"
        ? winningTeam !== null
        : (leader?.score ?? 0) >= WORLD.scoreLimit;
    if (now >= this.roundEndsAt || scoreLimitReached) {
      this.finishRound(now, leader, winningTeam ?? (now >= this.roundEndsAt ? leadingTeam : null));
    }
  }

  private finishRound(
    now: number,
    leader: LeaderboardEntry | null,
    winningTeam: ArenaTeamId | null
  ) {
    if (this.roundPhase === "finished") {
      return;
    }

    this.roundPhase = "finished";
    this.nextRoundAt = now + WORLD.roundRestartMs;
    this.projectiles = [];
    this.winningTeam = this.mode === "team_3v3" ? winningTeam : null;
    this.roundWinner =
      this.mode === "free_for_all" && leader && leader.score > 0 ? leader : null;

    const winner = this.roundWinner ? this.players.get(this.roundWinner.id) : undefined;
    const resultMessage =
      this.mode === "team_3v3"
        ? this.winningTeam
          ? `${this.winningTeam.toUpperCase()} team won the round`
          : "Round ended in a draw"
        : this.roundWinner
          ? `${this.roundWinner.name} won the round`
          : "Round ended with no winner";
    this.pushEvent(
      "round",
      resultMessage,
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
    this.winningTeam = null;
    this.teamScores = { red: 0, blue: 0 };
    this.projectiles = [];
    this.turrets = [];
    this.scheduledMagicMissiles = [];
    this.mageFields = [];
    this.damageOverTime = [];
    this.catalogFields = [];
    this.barriers = [];
    this.soulChains = [];
    this.scheduledCatalogActions = [];
    this.catalogPlayerMotions.clear();
    this.effects = [];
    this.events = [];
    this.healthPacks = [];
    this.attackBoostPacks = [];
    this.nextHealthPackId = 1;
    this.nextAttackBoostPackId = 1;
    this.spawnInitialHealthPacks();
    this.spawnInitialAttackBoostPacks();

    let botIndex = 0;
    for (const player of this.players.values()) {
      const stats = CLASS_STATS[player.classId];
      const spawn =
        this.mode === "team_3v3" && player.team
          ? this.teamSpawnPoint(player.team, botIndex++)
          : player.bot
            ? this.botSpawnPoint(botIndex++)
            : this.humanSpawnPoint(player.id, player.team);
      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = player.bot ? angleTo(player, { x: WORLD.width / 2, y: WORLD.height / 2 }) : -90;
      const maxHealth =
        player.bot && this.reviewBotHealth !== null
          ? this.reviewBotHealth
          : stats.maxHealth;
      player.maxHealth = maxHealth;
      player.health = maxHealth;
      player.stamina = COMBAT.maxStamina;
      player.score = 0;
      player.killStreak = 0;
      player.alive = true;
      player.respawnAt = 0;
      player.shielded = false;
      player.spawnProtected = !player.bot;
      player.rooted = false;
      player.stunned = false;
      player.poisoned = false;
      player.slowed = false;
      player.slowMultiplier = 1;
      player.sprinting = false;
      player.cooldowns = { skillF: 0, skillQ: 0, skillE: 0, skillR: 0 };
      player.input = { ...EMPTY_INPUT };
      player.lastAttackAt = 0;
      this.resetArcherCharge(player);
      player.actionPoseEndsAt = 0;
      player.action = null;
      player.actionSkillId = null;
      player.actionStartedAt = 0;
      player.actionEndsAt = 0;
      player.attacking = false;
      player.shieldEndsAt = 0;
      player.attackBoosted = false;
      player.attackBoostEndsAt = 0;
      player.damageBoostMultiplier = 1;
      player.spawnGuardEndsAt = player.bot ? 0 : now + SPAWN_GUARD_MS;
      player.rootEndsAt = 0;
      player.stunEndsAt = 0;
      player.poisonEndsAt = 0;
      player.slowEndsAt = 0;
      player.vulnerabilityEndsAt = 0;
      player.sunlightBrandStartsAt = 0;
      player.sunlightBrandEndsAt = 0;
      player.silenceStartsAt = 0;
      player.silenceEndsAt = 0;
      player.dashLockEndsAt = 0;
      player.dodgeEndsAt = 0;
      player.counterStanceEndsAt = 0;
      player.counterTriggered = false;
      player.engineerSupportEndsAt = 0;
      player.enchantedMeleeHitsRemaining = 0;
      player.enchantedMeleeEndsAt = 0;
      player.moveSpeedBoostEndsAt = 0;
      player.blazingRampageDamageBoostEndsAt = 0;
      player.steadyAimReady = false;
      player.focusLensStartsAt = 0;
      player.focusLensEndsAt = 0;
      player.concealmentEndsAt = 0;
      player.hunterMarkEndsAt = 0;
      player.hunterMarkOwnerId = null;
      player.magicMarkTargetId = null;
      player.magicMarkEndsAt = 0;
      player.duelPartnerId = null;
      player.duelStartedAt = 0;
      player.duelEndsAt = 0;
      player.duelCenterX = 0;
      player.duelCenterY = 0;
      player.damageCredits.clear();
      player.aiNextDecisionAt = 0;
    }

    if (announce) {
      this.pushEvent("round", "New arena round started", undefined, undefined, now);
    }
  }

  private toRoundState(): RoundState {
    return {
      mode: this.mode,
      phase: this.roundPhase,
      roundNumber: this.roundNumber,
      startedAt: this.roundStartedAt,
      endsAt: this.roundEndsAt,
      nextRoundAt: this.nextRoundAt,
      durationMs: WORLD.roundDurationMs,
      restartMs: WORLD.roundRestartMs,
      scoreLimit: WORLD.scoreLimit,
      winner: this.roundWinner,
      winningTeam: this.winningTeam,
      teamScores: { ...this.teamScores }
    };
  }

  private getLeaderboard(players?: PublicPlayer[], limit = 8): LeaderboardEntry[] {
    const publicPlayers = players ?? [...this.players.values()].map((player) => this.toPublicPlayer(player, Date.now()));
    return publicPlayers
      .map(({ id, name, score, killStreak, classId, bot, team }) => ({
        id,
        name,
        score,
        killStreak,
        classId,
        bot,
        team
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  private ensureBots() {
    if (!this.botsEnabled) {
      return;
    }
    if (this.mode === "team_3v3") {
      this.ensureTeamBots();
      return;
    }

    const desiredBotCount =
      this.reviewBotCount ?? Math.max(0, TARGET_ROOM_POPULATION - this.playerCount());
    const bots = [...this.players.values()]
      .filter((player) => player.bot)
      .sort((a, b) => this.botIndex(b.id) - this.botIndex(a.id));
    let currentBotCount = bots.length;

    for (const bot of bots) {
      if (currentBotCount <= desiredBotCount) {
        break;
      }
      this.removeBot(bot.id);
      currentBotCount -= 1;
    }

    for (let i = 0; i < BOT_NAMES.length && currentBotCount < desiredBotCount; i += 1) {
      const id = `bot_${i + 1}`;
      if (this.players.has(id)) {
        continue;
      }
      const classId = CLASS_ORDER[i % CLASS_ORDER.length];
      const player = this.createPlayer({
        id,
        socketId: null,
        name: BOT_NAMES[i],
        classId,
        loadout: getDefaultArenaLoadout(classId),
        catalogLoadout: getDefaultArenaCatalogLoadout(classId),
        team: null,
        engineerTurretKind: classId === "engineer" ? "magic_missile" : "mechanical",
        bot: true
      });
      const spawn = this.botSpawnPoint(i);
      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = angleTo(player, { x: WORLD.width / 2, y: WORLD.height / 2 });
      this.players.set(player.id, player);
      currentBotCount += 1;
    }
  }

  private ensureTeamBots() {
    for (const team of ["red", "blue"] as const) {
      const humanCount = [...this.players.values()].filter(
        (player) => !player.bot && player.team === team
      ).length;
      const desiredBotCount = Math.max(0, 3 - humanCount);
      const bots = [...this.players.values()]
        .filter((player) => player.bot && player.team === team)
        .sort((left, right) => this.botIndex(right.id) - this.botIndex(left.id));

      for (const bot of bots.slice(desiredBotCount)) {
        this.removeBot(bot.id);
      }

      let currentBotCount = Math.min(bots.length, desiredBotCount);
      for (let index = 0; currentBotCount < desiredBotCount; index += 1) {
        const id = `bot_${team}_${index + 1}`;
        if (this.players.has(id)) {
          continue;
        }
        const classOffset = team === "red" ? 0 : 2;
        const classId = CLASS_ORDER[(index + classOffset) % CLASS_ORDER.length];
        const nameIndex = (team === "red" ? 0 : 4) + index;
        const player = this.createPlayer({
          id,
          socketId: null,
          name: BOT_NAMES[nameIndex % BOT_NAMES.length],
          classId,
          loadout: getDefaultArenaLoadout(classId),
          catalogLoadout: getDefaultArenaCatalogLoadout(classId),
          team,
          engineerTurretKind: classId === "engineer" ? "magic_missile" : "mechanical",
          bot: true
        });
        const spawn = this.teamSpawnPoint(team, index);
        player.x = spawn.x;
        player.y = spawn.y;
        player.angle = angleTo(player, { x: WORLD.width / 2, y: WORLD.height / 2 });
        this.players.set(player.id, player);
        currentBotCount += 1;
      }
    }
  }

  private assignHumanTeam(): ArenaTeamId | null {
    if (this.mode !== "team_3v3") {
      return null;
    }
    const humanCounts: Record<ArenaTeamId, number> = { red: 0, blue: 0 };
    for (const player of this.players.values()) {
      if (!player.bot && player.team) {
        humanCounts[player.team] += 1;
      }
    }
    return humanCounts.red <= humanCounts.blue ? "red" : "blue";
  }

  private botIndex(id: string) {
    const match = /^bot_(?:(?:red|blue)_)?(\d+)$/.exec(id);
    return match ? Number(match[1]) - 1 : Number.MAX_SAFE_INTEGER;
  }

  private removeBot(botId: string) {
    this.endDuelForPlayer(botId);
    this.players.delete(botId);
    this.catalogPlayerMotions.delete(botId);
    this.projectiles = this.projectiles.filter((projectile) => projectile.ownerId !== botId);
    this.turrets = this.turrets.filter((turret) => turret.ownerId !== botId);
    this.scheduledMagicMissiles = this.scheduledMagicMissiles.filter((missile) => missile.ownerId !== botId && missile.targetId !== botId);
    this.mageFields = this.mageFields.filter((field) => field.ownerId !== botId);
    this.damageOverTime = this.damageOverTime.filter(
      (effect) => effect.ownerId !== botId && effect.targetId !== botId
    );
    this.catalogFields = this.catalogFields.filter((field) => field.ownerId !== botId);
    this.removeOwnedBarriers(botId);
    this.removeSoulChainsForPlayer(botId);
    this.scheduledCatalogActions = this.scheduledCatalogActions.filter(
      (action) => action.ownerId !== botId
    );
    this.effects = this.effects.filter((effect) => effect.ownerId !== botId);
  }

  private updateStatusFlags(now: number) {
    for (const player of this.players.values()) {
      player.shielded = player.shieldEndsAt > now;
      player.attackBoosted =
        player.attackBoostEndsAt > now ||
        player.blazingRampageDamageBoostEndsAt > now;
      if (player.attackBoostEndsAt <= now) {
        player.damageBoostMultiplier = 1;
      }
      player.spawnProtected = player.spawnGuardEndsAt > now;
      if (this.hasEngineerSupportControlImmunity(player, now)) {
        player.rootEndsAt = 0;
        player.stunEndsAt = 0;
        player.slowEndsAt = 0;
        player.silenceStartsAt = 0;
        player.silenceEndsAt = 0;
        player.dashLockEndsAt = 0;
        player.slowMultiplier = 1;
      }
      player.rooted = player.rootEndsAt > now;
      player.stunned = player.stunEndsAt > now;
      player.poisoned = player.poisonEndsAt > now;
      player.slowed = player.slowEndsAt > now;
      if (!player.slowed) {
        player.slowMultiplier = 1;
      }
      if (!player.alive || player.rooted || player.stunned) {
        player.sprinting = false;
      }
      player.attacking = player.alive && player.actionPoseEndsAt > now;
      if (!player.attacking) {
        player.action = null;
        player.actionSkillId = null;
        player.actionStartedAt = 0;
        player.actionEndsAt = 0;
      }
    }
  }

  private updateCatalogStatuses(now: number) {
    for (const player of this.players.values()) {
      if (player.counterStanceEndsAt <= now) {
        player.counterTriggered = false;
      }
      if (player.hunterMarkEndsAt <= now) {
        player.hunterMarkOwnerId = null;
      }
      if (player.magicMarkEndsAt <= now) {
        player.magicMarkTargetId = null;
      }
      if (player.duelPartnerId && player.duelEndsAt <= now) {
        this.endDuelForPlayer(player.id);
      }
      if (player.focusLensEndsAt <= now) {
        player.focusLensStartsAt = 0;
        player.focusLensEndsAt = 0;
      }
      if (player.enchantedMeleeEndsAt <= now) {
        player.enchantedMeleeHitsRemaining = 0;
        player.enchantedMeleeEndsAt = 0;
      }
    }

    for (const effect of this.damageOverTime) {
      const target = this.players.get(effect.targetId);
      const owner = this.players.get(effect.ownerId);
      if (!target?.alive) {
        continue;
      }
      const sharesDimension = Boolean(
        owner?.alive && this.sharesCombatDimension(owner, target, now)
      );
      const tickLimit = Math.min(now, effect.endsAt);
      while (effect.nextTickAt <= tickLimit) {
        if (sharesDimension) {
          this.damagePlayer(
            target,
            effect.damage,
            effect.ownerId,
            effect.skillId,
            "preset"
          );
        }
        effect.nextTickAt += effect.tickIntervalMs;
      }
      if (sharesDimension && now < effect.endsAt) {
        target.poisonEndsAt = Math.max(target.poisonEndsAt, effect.endsAt);
        target.poisoned = true;
      }
    }
    this.damageOverTime = this.damageOverTime.filter(
      (effect) => effect.endsAt > now && this.players.get(effect.targetId)?.alive
    );

    for (const field of this.catalogFields) {
      const owner = this.players.get(field.ownerId);
      if (!owner) {
        continue;
      }
      if (field.startsAt !== undefined && now < field.startsAt) {
        continue;
      }
      if (field.skillId === "mage_10") {
        const spec = getArenaSkillSpec(field.skillId);
        const pull = spec?.numbers.pull;
        const tickIntervalMs = field.tickIntervalMs;
        if (
          pull == null ||
          tickIntervalMs == null ||
          tickIntervalMs <= 0 ||
          field.nextTickAt == null
        ) {
          continue;
        }
        const tickLimit = Math.min(now, field.endsAt);
        while (field.nextTickAt <= tickLimit) {
          for (const target of this.players.values()) {
            if (
              !target.alive ||
              !this.areEnemies(owner, target) ||
              !this.sharesCombatDimension(owner, target, now) ||
              distance(field, target) > field.radius
            ) {
              continue;
            }
            this.moveTargetToward(target, field, pull, now);
            this.applySlow(
              target,
              0.55,
              Math.max(1, field.endsAt - now),
              now
            );
          }
          field.nextTickAt += tickIntervalMs;
        }
        continue;
      }
      for (const target of this.players.values()) {
        if (
          !target.alive ||
          !this.areEnemies(owner, target) ||
          !this.sharesCombatDimension(owner, target, now) ||
          distance(field, target) > field.radius
        ) {
          continue;
        }
        if (field.skillId === "archer_03" && !field.triggeredTargetIds.has(target.id)) {
          field.triggeredTargetIds.add(target.id);
          this.damagePlayer(target, 15, owner.id);
          this.applyRoot(target, 800, now);
          this.applyPoison(owner.id, target, field.skillId, now);
        } else if (field.skillId === "archer_10") {
          this.applySlow(
            target,
            0.4,
            Math.max(1, Math.min(field.endsAt, now + 120) - now),
            now
          );
        }
      }
    }
    this.catalogFields = this.catalogFields.filter((field) => field.endsAt > now);
  }

  private updateSoulChains(now: number) {
    const surviving: SoulChainEntity[] = [];
    const removedEffectIds = new Set<string>();
    for (const chain of this.soulChains) {
      const owner = this.players.get(chain.ownerId);
      const target = this.players.get(chain.targetId);
      if (
        chain.endsAt <= now ||
        !owner?.alive ||
        !target?.alive ||
        !this.areEnemies(owner, target) ||
        !this.sharesCombatDimension(owner, target, now)
      ) {
        removedEffectIds.add(chain.effectId);
        continue;
      }
      if (now < chain.startsAt) {
        surviving.push(chain);
        continue;
      }
      if (distance(owner, target) > COMBAT.mageSoulChainBreakDistance) {
        const excessDistance =
          distance(owner, target) - COMBAT.mageSoulChainBreakDistance;
        this.moveTargetToward(
          target,
          owner,
          excessDistance + 2,
          now
        );
      }
      surviving.push(chain);
    }
    this.soulChains = surviving;
    if (removedEffectIds.size > 0) {
      this.effects = this.effects.filter(
        (effect) => !removedEffectIds.has(effect.id)
      );
    }
  }

  private removeSoulChainsForPlayer(playerId: string) {
    const removedEffectIds = new Set(
      this.soulChains
        .filter(
          (chain) =>
            chain.ownerId === playerId || chain.targetId === playerId
        )
        .map((chain) => chain.effectId)
    );
    this.soulChains = this.soulChains.filter(
      (chain) =>
        chain.ownerId !== playerId && chain.targetId !== playerId
    );
    if (removedEffectIds.size > 0) {
      this.effects = this.effects.filter(
        (effect) => !removedEffectIds.has(effect.id)
      );
    }
  }

  private isDashLocked(player: PlayerEntity, now: number) {
    if (this.hasEngineerSupportControlImmunity(player, now)) {
      return false;
    }
    return (
      player.dashLockEndsAt > now ||
      this.soulChains.some(
        (chain) =>
          chain.targetId === player.id &&
          chain.startsAt <= now &&
          chain.endsAt > now
      )
    );
  }

  private scheduleCatalogAction(
    ownerId: string,
    runAt: number,
    execute: (now: number) => void
  ) {
    this.scheduledCatalogActions.push({ ownerId, runAt, execute });
  }

  private updateCatalogPlayerMotions(now: number) {
    for (const [playerId, motion] of this.catalogPlayerMotions) {
      const player = this.players.get(playerId);
      if (!player?.alive || player.actionSkillId !== motion.skillId) {
        this.catalogPlayerMotions.delete(playerId);
        continue;
      }
      const duration = Math.max(1, motion.endsAt - motion.startedAt);
      const progress = clamp((now - motion.startedAt) / duration, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const intended = this.resolveMapCollision(
        {
          x: motion.startX + (motion.endX - motion.startX) * eased,
          y: motion.startY + (motion.endY - motion.startY) * eased
        },
        COMBAT.playerRadius
      );
      const duelConstrained = this.constrainToDuel(player, intended, now);
      const constrained = this.constrainToBarriers(player, duelConstrained, now);
      player.x = constrained.x;
      player.y = constrained.y;
      if (progress >= 1) {
        this.catalogPlayerMotions.delete(playerId);
      }
    }
  }

  private updateScheduledCatalogActions(now: number) {
    if (this.scheduledCatalogActions.length === 0) {
      return;
    }
    const pending: ScheduledCatalogAction[] = [];
    const ready = this.scheduledCatalogActions
      .filter((action) => action.runAt <= now)
      .sort((left, right) => left.runAt - right.runAt);
    for (const action of this.scheduledCatalogActions) {
      if (action.runAt > now) {
        pending.push(action);
      }
    }
    this.scheduledCatalogActions = pending;
    for (const action of ready) {
      action.execute(now);
    }
  }

  private updateBarriers(now: number) {
    const liveTurretIds = new Set(
      this.turrets
        .filter((turret) => turret.health > 0)
        .map((turret) => turret.id)
    );
    const expiredEffectIds = new Set(
      this.barriers
        .filter(
          (barrier) =>
            barrier.endsAt <= now ||
            barrier.health <= 0 ||
            !liveTurretIds.has(barrier.startTurretId) ||
            !liveTurretIds.has(barrier.endTurretId)
        )
        .map((barrier) => barrier.effectId)
    );
    if (expiredEffectIds.size > 0) {
      this.effects = this.effects.filter(
        (effect) => !expiredEffectIds.has(effect.id)
      );
    }
    this.barriers = this.barriers.filter(
      (barrier) =>
        barrier.endsAt > now &&
        barrier.health > 0 &&
        liveTurretIds.has(barrier.startTurretId) &&
        liveTurretIds.has(barrier.endTurretId)
    );
  }

  private removeOwnedBarriers(ownerId: string) {
    const effectIds = new Set(
      this.barriers
        .filter((barrier) => barrier.ownerId === ownerId)
        .map((barrier) => barrier.effectId)
    );
    this.barriers = this.barriers.filter(
      (barrier) => barrier.ownerId !== ownerId
    );
    if (effectIds.size > 0) {
      this.effects = this.effects.filter(
        (effect) => !effectIds.has(effect.id)
      );
    }
  }

  private constrainToBarriers(
    player: PlayerEntity,
    next: { x: number; y: number },
    now: number
  ) {
    if (this.getActiveDuelDimensionId(player, now)) {
      return next;
    }
    for (const barrier of this.barriers) {
      const owner = this.players.get(barrier.ownerId);
      if (
        !owner ||
        !this.areEnemies(owner, player) ||
        !segmentsWithinDistance(
          player,
          next,
          { x: barrier.x1, y: barrier.y1 },
          { x: barrier.x2, y: barrier.y2 },
          COMBAT.playerRadius + barrier.thickness / 2
        )
      ) {
        continue;
      }
      if (!barrier.stunnedTargetIds.has(player.id)) {
        if (this.applyStun(player, 1000, now)) {
          barrier.stunnedTargetIds.add(player.id);
          this.addEffect("stun", player, 58, 1000);
        }
      }
      return { x: player.x, y: player.y };
    }
    return next;
  }

  private damageBarrier(
    barrier: BarrierEntity,
    damage: number,
    now: number
  ) {
    barrier.health = Math.max(0, barrier.health - damage);
    if (barrier.health <= 0) {
      this.effects = this.effects.filter(
        (effect) => effect.id !== barrier.effectId
      );
      this.effects.push({
        id: `fx_${this.nextEffectId++}`,
        type: "blocked_hit",
        ownerId: barrier.ownerId,
        x: (barrier.x1 + barrier.x2) / 2,
        y: (barrier.y1 + barrier.y2) / 2,
        angle: 0,
        radius: 42,
        startedAt: now,
        duration: 420
      });
      barrier.endsAt = now;
    }
  }

  private updateMageFields(now: number) {
    for (const field of this.mageFields) {
      if (now < field.startedAt) {
        continue;
      }
      const tickLimit = Math.min(now, field.endsAt);
      if (field.skillId === "mage_08") {
        while (field.nextTickAt <= tickLimit) {
          this.damageMageFieldTargets(field, COMBAT.mageMiasmaTickDamage, false);
          field.nextTickAt += COMBAT.mageMiasmaTickInterval;
        }
        if (now <= field.endsAt) {
          for (const target of this.getLivingMageFieldTargets(field)) {
            this.applyPoison(field.ownerId, target, field.skillId, now);
          }
        }
      } else if (field.skillId === "mage_14") {
        while (field.nextTickAt <= tickLimit) {
          this.damageMageFieldTargets(field, COMBAT.mageBloodAltarTickDamage, true);
          field.nextTickAt += COMBAT.mageBloodAltarTickInterval;
        }
      } else if (now <= field.endsAt) {
        this.applyTimeAstrolabeField(field, now);
      }
    }

    this.mageFields = this.mageFields.filter((field) => field.endsAt > now);
  }

  private getLivingMageFieldTargets(field: MageFieldEntity) {
    const owner = this.players.get(field.ownerId);
    const now = Date.now();
    return [...this.players.values()].filter(
      (target) =>
        Boolean(owner && this.areEnemies(owner, target)) &&
        Boolean(owner && this.sharesCombatDimension(owner, target, now)) &&
        target.alive &&
        distance(field, target) <= field.radius
    );
  }

  private damageMageFieldTargets(field: MageFieldEntity, damage: number, healOwner: boolean) {
    let actualDamage = 0;
    for (const target of this.getLivingMageFieldTargets(field)) {
      actualDamage += this.damagePlayer(target, damage, field.ownerId, field.skillId);
    }
    const owner = this.players.get(field.ownerId);
    if (owner) {
      this.damageTurretsInRadius(owner, field.skillId, field, field.radius, damage);
    }

    if (!healOwner || actualDamage <= 0) {
      return;
    }
    if (!owner?.alive) {
      return;
    }
    this.healPlayer(owner, actualDamage * COMBAT.mageBloodAltarLifesteal);
  }

  private applyTimeAstrolabeField(field: MageFieldEntity, now: number) {
    for (const target of this.getLivingMageFieldTargets(field)) {
      this.applySlow(
        target,
        COMBAT.mageTimeAstrolabeSlowMultiplier,
        Math.max(1, field.endsAt - now),
        now
      );
      if (
        distance(field, target) <= COMBAT.mageTimeAstrolabeCenterRadius &&
        !field.rootedTargetIds.has(target.id)
      ) {
        if (
          this.applyRoot(
            target,
            COMBAT.mageTimeAstrolabeRootDuration,
            now
          )
        ) {
          field.rootedTargetIds.add(target.id);
          this.addEffect(
            "root",
            target,
            70,
            COMBAT.mageTimeAstrolabeRootDuration
          );
        }
      }
    }
  }

  private updateBots(now: number) {
    if (this.freezeBots) {
      for (const player of this.players.values()) {
        if (player.bot) {
          player.input = { ...EMPTY_INPUT };
        }
      }
      return;
    }
    if (this.playerCount() === 0) {
      return;
    }

    const livePlayers = [...this.players.values()].filter((player) => player.alive);
    for (const bot of livePlayers) {
      if (!bot.bot || bot.aiNextDecisionAt > now) {
        continue;
      }

      const targets = livePlayers.filter(
        (candidate) =>
          this.areEnemies(bot, candidate) &&
          this.sharesCombatDimension(bot, candidate, now) &&
          !candidate.spawnProtected &&
          candidate.concealmentEndsAt <= now
      );
      const target = targets.sort((a, b) => distanceSq(bot, a) - distanceSq(bot, b))[0];
      if (!target) {
        continue;
      }

      const d = distance(bot, target);
      const desiredAngle = angleTo(bot, target);
      const moveToward = d > (bot.classId === "warrior" ? 100 : 330);
      const strafe = Math.sin((now / 600 + bot.aiSeed * 12) % Math.PI) * 0.7;
      const radians = (desiredAngle * Math.PI) / 180;
      const isChargingArcher = bot.classId === "archer" && bot.archerChargeStartedAt > 0;

      const desiredSkills: Record<SkillKey, boolean> = {
        skillF:
          bot.classId === "engineer" &&
          this.turrets.filter((turret) => turret.ownerId === bot.id).length < COMBAT.engineerMaxTurrets &&
          Math.random() < 0.55,
        skillQ: !isChargingArcher && d > 220 && d < 540 && Math.random() < 0.35,
        skillE: !isChargingArcher && d < COMBAT.mageBurstRadius + 40 && Math.random() < 0.25,
        skillR: !isChargingArcher && d < COMBAT.mageUltimateRadius + 50 && Math.random() < 0.12
      };
      const slotInput: Record<ArenaLoadoutSlot, boolean> = {
        skillQ: desiredSkills[bot.loadout.skillQ],
        skillE: desiredSkills[bot.loadout.skillE],
        skillR: desiredSkills[bot.loadout.skillR]
      };
      bot.input = {
        moveX: moveToward ? Math.cos(radians) + Math.cos(radians + Math.PI / 2) * strafe : Math.cos(radians + Math.PI / 2) * strafe,
        moveY: moveToward ? Math.sin(radians) + Math.sin(radians + Math.PI / 2) * strafe : Math.sin(radians + Math.PI / 2) * strafe,
        angle: desiredAngle,
        aimX: target.x,
        aimY: target.y,
        attack: this.botWantsBasicAttack(bot, d, now),
        sprint: moveToward && d > 520,
        skillF: desiredSkills.skillF,
        ...slotInput
      };
      bot.aiNextDecisionAt = this.getBotNextDecisionAt(bot, now);
    }
  }

  private botWantsBasicAttack(bot: PlayerEntity, targetDistance: number, now: number) {
    if (targetDistance >= 620) {
      return false;
    }
    if (bot.classId !== "archer" || bot.archerChargeStartedAt <= 0) {
      return true;
    }
    return now < bot.archerChargeStartedAt + this.archerFullChargeMs();
  }

  private getBotNextDecisionAt(bot: PlayerEntity, now: number) {
    if (bot.classId === "archer" && bot.archerChargeStartedAt > 0) {
      const fullChargeAt = bot.archerChargeStartedAt + this.archerFullChargeMs();
      return Math.max(now + 60, Math.min(now + 120, fullChargeAt));
    }
    return now + randomBetween(160, 320);
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
      this.consumeSkillInputEdges(player);

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

          const speed =
            CLASS_STATS[player.classId].moveSpeed *
            player.slowMultiplier *
            (player.moveSpeedBoostEndsAt > now ? BLAZING_RAMPAGE.moveSpeedMultiplier : 1) *
            (player.sprinting ? COMBAT.sprintSpeedMultiplier : 1);
          const next = this.resolveMapCollision(
            {
              x: player.x + move.x * speed * deltaSeconds,
              y: player.y + move.y * speed * deltaSeconds
            },
            COMBAT.playerRadius
          );
          const constrained = this.constrainToDuel(player, next, now);
          const barrierConstrained = this.constrainToBarriers(
            player,
            constrained,
            now
          );
          player.x = barrierConstrained.x;
          player.y = barrierConstrained.y;
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

      player.lastProcessedInputSequence = Math.max(
        player.lastProcessedInputSequence,
        player.input.sequence ?? 0
      );
    }
  }

  private consumeSkillInputEdges(player: PlayerEntity) {
    player.input.skillF = false;
    player.input.skillQ = false;
    player.input.skillE = false;
    player.input.skillR = false;
  }

  private handleArcherChargedAttack(attacker: PlayerEntity, now: number) {
    if (attacker.archerChargeStartedAt > 0) {
      const stage = this.getArcherChargeStage(attacker, now);
      if (!attacker.input.attack || this.shouldBotReleaseArcherCharge(attacker, now)) {
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
    player.actionSkillId = null;
    player.actionStartedAt = player.archerChargeStartedAt;
    player.actionEndsAt = player.archerChargeStartedAt + (COMBAT.archerChargeStages - 1) * COMBAT.archerChargeStageMs;
    player.actionPoseEndsAt = Math.max(player.actionPoseEndsAt, now + 120);
    player.attacking = true;
  }

  private resetArcherCharge(player: PlayerEntity) {
    player.archerChargeStartedAt = 0;
  }

  private shouldBotReleaseArcherCharge(player: PlayerEntity, now: number) {
    return player.bot && player.archerChargeStartedAt > 0 && now >= player.archerChargeStartedAt + this.archerFullChargeMs();
  }

  private archerFullChargeMs() {
    return Math.max(0, (COMBAT.archerChargeStages - 1) * COMBAT.archerChargeStageMs);
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
    return getArcherChargedArrowBaseDamageForStage(stage);
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
    const enchantedMelee =
      attacker.classId === "warrior" &&
      attacker.enchantedMeleeHitsRemaining > 0 &&
      attacker.enchantedMeleeEndsAt > now;
    this.setActionPose(
      attacker,
      now,
      320,
      "attack",
      null
    );

    if (attacker.classId === "archer" || attacker.classId === "mage") {
      const type: ProjectileType = attacker.classId === "archer" ? "arrow" : "magic_ball";
      const origin = this.getPlayerProjectileOrigin(attacker, type);
      const steadyAimMultiplier =
        attacker.classId === "archer" && attacker.steadyAimReady ? 1.4 : 1;
      this.spawnProjectile({
        ownerId: attacker.id,
        type,
        x: origin.x,
        y: origin.y,
        angle: attacker.angle,
        damage: roundDamage(stats.attackPower * steadyAimMultiplier),
        speed: attacker.classId === "archer" ? COMBAT.arrowSpeed : COMBAT.magicBallSpeed,
        maxDistance: attacker.classId === "archer" ? COMBAT.arrowDistance : COMBAT.magicBallDistance,
        distanceTraveled: origin.distance,
        remainingHits:
          attacker.classId === "archer" && attacker.steadyAimReady ? 2 : 1
      });
      if (attacker.classId === "archer") {
        attacker.steadyAimReady = false;
      }
      return;
    }

    this.addEffect("attack_arc", attacker, COMBAT.meleeRange, 380);
    const enchantedHitNumber = enchantedMelee
      ? 4 - attacker.enchantedMeleeHitsRemaining
      : 0;
    const meleeDamage =
      enchantedMelee
        ? COMBAT.warriorBladeEnchantDamage[enchantedHitNumber - 1]
        : stats.attackPower;
    const meleeDamageScaling = enchantedMelee ? "preset" : "class";
    if (enchantedMelee) {
      attacker.enchantedMeleeHitsRemaining -= 1;
      if (attacker.enchantedMeleeHitsRemaining <= 0) {
        attacker.enchantedMeleeEndsAt = 0;
      }
    }

    for (const target of this.players.values()) {
      if (!this.areEnemies(attacker, target) || !target.alive) {
        continue;
      }
      if (this.isInMeleeArc(attacker, target)) {
        const actualDamage = this.damagePlayer(
          target,
          meleeDamage,
          attacker.id,
          enchantedMelee ? "warrior_03" : undefined,
          meleeDamageScaling
        );
        if (actualDamage > 0 && enchantedHitNumber === 3) {
          this.applyStun(target, 1000, now);
        }
      }
    }

    for (const turret of this.turrets) {
      const turretOwner = this.players.get(turret.ownerId);
      if (turretOwner && this.areEnemies(attacker, turretOwner) && this.isInMeleeArc(attacker, turret)) {
        this.damageTurret(
          turret,
          meleeDamage,
          attacker.id,
          now,
          enchantedMelee ? "warrior_03" : undefined,
          meleeDamageScaling
        );
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
    if (
      player.actionPoseEndsAt > now ||
      (player.silenceStartsAt <= now && player.silenceEndsAt > now)
    ) {
      return false;
    }

    if (player.input.skillF && this.canUse(player, "skillF", now)) {
      this.faceAim(player);
      if (player.classId === "engineer") {
        return this.deployTurret(player, now);
      }
      this.useSkillF(player, now);
      return true;
    }

    const requestedSlots: ArenaLoadoutSlot[] = ["skillR", "skillE", "skillQ"];
    for (const slot of requestedSlots) {
      if (!player.input[slot] || !this.canUse(player, slot, now)) {
        continue;
      }
      this.faceAim(player);
      if (this.useArenaCatalogSkill(player, slot, now)) {
        return true;
      }
    }

    return false;
  }

  private canUse(player: PlayerEntity, skill: SkillKey, now: number) {
    return player.cooldowns[skill] <= now;
  }

  private startCooldown(player: PlayerEntity, skill: SkillKey, now: number, durationMs?: number) {
    player.cooldowns[skill] = now + (durationMs ?? getSkillCooldownMs(player.classId, skill));
  }

  private useArenaCatalogSkill(
    player: PlayerEntity,
    slot: ArenaLoadoutSlot,
    now: number
  ) {
    const skillId = player.catalogLoadout[slot];
    const spec = getArenaSkillSpec(skillId);
    if (!skillId || !spec || !skillId.startsWith(`${player.classId}_`)) {
      return false;
    }
    const focusLensActive =
      player.classId === "mage" &&
      slot === "skillQ" &&
      player.focusLensStartsAt <= now &&
      player.focusLensEndsAt > now;

    const used =
      player.classId === "warrior"
        ? this.useWarriorCatalogSkill(player, skillId, now)
        : player.classId === "archer"
          ? this.useArcherCatalogSkill(player, skillId, now)
          : player.classId === "engineer"
            ? this.useEngineerCatalogSkill(player, skillId, now)
            : this.useMageCatalogSkillById(player, skillId, now);
    if (!used) {
      return false;
    }
    // Some skills establish a longer internal pose before this common catalog
    // path finishes (for example Solar Beam). Preserve the actual skill ID
    // even when the pose duration must not be shortened.
    player.actionSkillId = skillId;
    if (focusLensActive) {
      player.focusLensStartsAt = 0;
      player.focusLensEndsAt = 0;
      this.removeCatalogEffects(player.id, "mage_09");
    }

    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, slot, now, spec.cooldownMs);
    this.setActionPose(
      player,
      now,
      slot === "skillR" ? 920 : slot === "skillE" ? 720 : 560,
      slot,
      skillId
    );
    if (slot === "skillR") {
      const catalogSkill = getArenaCatalogSkill(skillId);
      this.pushEvent(
        "ultimate",
        `${player.name} cast ${catalogSkill?.name ?? skillId}`,
        player,
        undefined,
        now
      );
    }
    return true;
  }

  private useWarriorCatalogSkill(
    player: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    now: number
  ) {
    if (skillId === "warrior_03") {
      player.enchantedMeleeHitsRemaining = 3;
      player.enchantedMeleeEndsAt = now + 6000;
      return true;
    }
    if (skillId === "warrior_01") {
      player.moveSpeedBoostEndsAt = now + BLAZING_RAMPAGE.durationMs;
      player.blazingRampageDamageBoostEndsAt = now + BLAZING_RAMPAGE.durationMs;
      player.attackBoosted = true;
      this.addCatalogEffect(
        skillId,
        player,
        player,
        78,
        BLAZING_RAMPAGE.durationMs,
        now
      );
      return true;
    }
    if (skillId === "warrior_04") {
      if (this.isDashLocked(player, now)) return false;
      const next = this.resolveMapCollision(
        project(player, player.angle, 280),
        COMBAT.playerRadius
      );
      const constrained = this.constrainToDuel(player, next, now);
      player.x = constrained.x;
      player.y = constrained.y;
      this.addCatalogEffect(skillId, player, player, 140, 620, now);
      return true;
    }
    if (skillId === "warrior_07") {
      player.counterStanceEndsAt = now + 1200;
      player.counterTriggered = false;
      this.addCatalogEffect(skillId, player, player, 118, 1200, now);
      return true;
    }
    if (skillId === "warrior_08") {
      player.shieldEndsAt = now + 3000;
      player.shielded = true;
      this.addCatalogEffect(skillId, player, player, 118, 3000, now);
      return true;
    }
    if (skillId === "warrior_09") {
      for (const ally of this.players.values()) {
        if (
          ally.alive &&
          !this.areEnemies(player, ally) &&
          this.sharesCombatDimension(player, ally, now) &&
          distance(player, ally) <= 260
        ) {
          ally.attackBoostEndsAt = Math.max(ally.attackBoostEndsAt, now + 4000);
          ally.damageBoostMultiplier = Math.max(ally.damageBoostMultiplier, 1.12);
          ally.attackBoosted = true;
          this.addCatalogEffect(skillId, ally, ally, 118, 4000, now, ally);
        }
      }
      return true;
    }
    if (skillId === "warrior_13") {
      const target = this.getAimTarget(
        player,
        ARENA_DUEL_REALM.targetRange
      );
      if (!target) return false;
      const center = {
        x: (player.x + target.x) / 2,
        y: (player.y + target.y) / 2
      };
      for (const duelist of [player, target]) {
        duelist.duelPartnerId = duelist.id === player.id ? target.id : player.id;
        duelist.duelStartedAt = now;
        duelist.duelEndsAt = now + ARENA_DUEL_REALM.durationMs;
        duelist.duelCenterX = center.x;
        duelist.duelCenterY = center.y;
        const constrained = this.constrainToDuel(
          duelist,
          { x: duelist.x, y: duelist.y },
          now
        );
        duelist.x = constrained.x;
        duelist.y = constrained.y;
      }
      this.addCatalogEffect(
        skillId,
        player,
        center,
        ARENA_DUEL_REALM.radiusX,
        ARENA_DUEL_REALM.durationMs,
        now,
        target
      );
      return true;
    }

    const damageTarget =
      skillId === "warrior_05" ||
      skillId === "warrior_06" ||
      skillId === "warrior_10"
        ? this.getAimDamageTarget(player, skillId === "warrior_10" ? 170 : 125)
        : null;
    if (
      (skillId === "warrior_05" ||
        skillId === "warrior_06" ||
        skillId === "warrior_10") &&
      !damageTarget
    ) {
      return false;
    }

    if (damageTarget?.kind === "turret") {
      const turret = damageTarget.target;
      const executeBonus =
        skillId === "warrior_10" && turret.health / turret.maxHealth < 0.25
          ? 16
          : 0;
      const damage =
        skillId === "warrior_05"
          ? 20
          : skillId === "warrior_06"
            ? 18
            : 34 + executeBonus;
      this.damageTurret(turret, damage, player.id, now, skillId);
      this.addCatalogEffect(skillId, player, turret, 90, 760, now);
      return true;
    }
    const target = damageTarget?.kind === "player" ? damageTarget.target : null;
    if (skillId === "warrior_05" && target) {
      this.damagePlayer(target, 20, player.id, skillId);
      this.applyStun(target, 450, now);
      this.addCatalogEffect(skillId, player, target, 90, 620, now, target);
      return true;
    }
    if (skillId === "warrior_06" && target) {
      this.damagePlayer(target, 18, player.id, skillId);
      target.vulnerabilityEndsAt = Math.max(target.vulnerabilityEndsAt, now + 3500);
      this.addCatalogEffect(skillId, player, target, 82, 760, now, target);
      return true;
    }
    if (skillId === "warrior_10" && target) {
      const executeBonus = target.health / target.maxHealth < 0.25 ? 16 : 0;
      this.damagePlayer(target, 34 + executeBonus, player.id, skillId);
      this.addCatalogEffect(skillId, player, target, 96, 760, now, target);
      return true;
    }

    if (skillId === "warrior_00") {
      const origin = this.getMuzzlePoint(
        { x: player.x, y: player.y - 28 },
        player.angle,
        54,
        0
      );
      this.spawnProjectile({
        ownerId: player.id,
        skillId,
        type: "sword_wave",
        x: origin.x,
        y: origin.y,
        angle: player.angle,
        damage: 20,
        speed: 650,
        maxDistance: 400,
        distanceTraveled: origin.distance,
        remainingHits: 99
      });
      // The cast effect remains in the snapshot for skill identity and
      // coverage, while the projectile package is the only rendered VFX.
      this.addCatalogEffect(skillId, player, player, 90, 560, now);
      return true;
    }
    if (skillId === "warrior_02") {
      this.damageRadius(player, skillId, player, 130, 24);
      this.addCatalogEffect(skillId, player, player, 130, 720, now);
      return true;
    }
    if (skillId === "warrior_11") {
      for (const enemy of this.getEnemiesInRadius(player, player, 200)) {
        this.damagePlayer(enemy, 26, player.id, skillId);
        this.applySlow(enemy, 0.55, 1500, now);
      }
      this.damageTurretsInRadius(player, skillId, player, 200, 26);
      this.addCatalogEffect(skillId, player, player, 200, 1500, now);
      return true;
    }
    if (skillId === "warrior_12") {
      for (const enemy of this.getEnemiesInRadius(player, player, 230)) {
        this.damagePlayer(enemy, 48, player.id, skillId);
        this.applyStun(enemy, 1200, now);
      }
      this.damageTurretsInRadius(player, skillId, player, 230, 48);
      this.addCatalogEffect(skillId, player, player, 230, 1300, now);
      return true;
    }
    if (skillId === "warrior_14") {
      for (const target of this.getEnemiesInRadius(player, player, 260)) {
        this.damagePlayer(target, 38, player.id, skillId);
        this.addCatalogEffect(
          skillId,
          player,
          target,
          54,
          1250,
          now,
          target
        );
      }
      this.damageTurretsInRadius(player, skillId, player, 260, 38);
      return true;
    }
    return false;
  }

  private useArcherCatalogSkill(
    player: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    now: number
  ) {
    if (skillId === "archer_01" || skillId === "archer_06") {
      if (this.isDashLocked(player, now)) return false;
      const movement = skillId === "archer_01" ? 330 : 210;
      const next = this.resolveMapCollision(
        project(player, player.angle, movement),
        COMBAT.playerRadius
      );
      const constrained = this.constrainToDuel(player, next, now);
      const durationMs = skillId === "archer_01" ? 520 : 560;
      this.catalogPlayerMotions.set(player.id, {
        skillId,
        startX: player.x,
        startY: player.y,
        endX: constrained.x,
        endY: constrained.y,
        startedAt: now,
        endsAt: now + durationMs
      });
      if (skillId === "archer_06") {
        player.dodgeEndsAt = now + durationMs;
      }
      this.addCatalogEffect(skillId, player, player, 130, 620, now);
      return true;
    }
    if (skillId === "archer_09") {
      player.steadyAimReady = false;
      this.scheduleCatalogAction(player.id, now + 1000, () => {
        const current = this.players.get(player.id);
        if (current?.alive) {
          current.steadyAimReady = true;
        }
      });
      this.addCatalogEffect(skillId, player, player, 96, 1000, now);
      return true;
    }
    if (skillId === "archer_04") {
      const durationMs = getArenaSkillSpec(skillId)?.numbers.durationMs;
      if (durationMs === undefined) {
        throw new Error("Archer invisibility requires a declared duration.");
      }
      player.concealmentEndsAt = Math.max(
        player.concealmentEndsAt,
        now + durationMs
      );
      return true;
    }
    if (skillId === "archer_03" || skillId === "archer_10") {
      const center = this.getAimPoint(player);
      this.catalogFields.push({
        id: `catalog_field_${this.nextEffectId}`,
        ownerId: player.id,
        skillId,
        x: center.x,
        y: center.y,
        radius: skillId === "archer_03" ? 80 : 170,
        endsAt: now + (skillId === "archer_03" ? 6000 : 2000),
        triggeredTargetIds: new Set()
      });
      if (skillId === "archer_10") {
        this.damageRadius(player, skillId, center, 170, 18);
      }
      this.addCatalogEffect(
        skillId,
        player,
        center,
        skillId === "archer_03" ? 80 : 170,
        skillId === "archer_03" ? 6000 : 2000,
        now
      );
      return true;
    }
    if (skillId === "archer_05") {
      const target = this.getAimTarget(player, 520);
      if (!target) return false;
      target.hunterMarkEndsAt = now + 5000;
      target.hunterMarkOwnerId = player.id;
      this.addCatalogEffect(skillId, player, target, 72, 5000, now, target);
      return true;
    }
    if (skillId === "archer_08") {
      const center = this.getAimPoint(player);
      for (const enemy of this.getEnemiesInRadius(player, center, 420)) {
        this.applyRoot(enemy, 2000, now);
        this.addCatalogEffect(
          skillId,
          player,
          enemy,
          52,
          2000,
          now,
          enemy
        );
      }
      return true;
    }
    if (skillId === "archer_13") {
      const seedRainSpec = getArenaSkillSpec(skillId);
      const damageTicks = seedRainSpec?.numbers.damage;
      const radius = seedRainSpec?.numbers.radius;
      const durationMs = seedRainSpec?.numbers.durationMs;
      const firstTickDelayMs = seedRainSpec?.numbers.firstTickDelayMs;
      const tickIntervalMs = seedRainSpec?.numbers.tickIntervalMs;
      if (
        !damageTicks ||
        damageTicks.length !== 3 ||
        radius === undefined ||
        durationMs === undefined ||
        firstTickDelayMs === undefined ||
        tickIntervalMs === undefined
      ) {
        throw new Error("Seed Rain requires three declared damage ticks and a complete timing contract.");
      }
      const center = this.getAimPoint(player);
      for (const [tickIndex, damage] of damageTicks.entries()) {
        this.scheduleCatalogAction(
          player.id,
          now + firstTickDelayMs + tickIndex * tickIntervalMs,
          () => {
            const owner = this.players.get(player.id);
            if (!owner) {
              return;
            }
            this.damageRadius(owner, skillId, center, radius, damage);
          }
        );
      }
      this.addCatalogEffect(skillId, player, center, radius, durationMs, now);
      return true;
    }
    if (skillId === "archer_14") {
      return this.useArcherHawkExecutionAt(
        player,
        this.getAimPoint(player),
        now
      );
    }
    if (skillId === "archer_12") {
      const damageTarget = this.getAimDamageTarget(player, 950);
      if (!damageTarget) return false;
      const target = damageTarget.target;
      const shotOrigin = this.getMuzzlePoint(
        { x: player.x, y: player.y - 28 },
        player.angle,
        54,
        0
      );
      this.addCatalogEffect(
        skillId,
        player,
        target,
        150,
        1100,
        now,
        damageTarget.kind === "player" ? damageTarget.target : undefined,
        undefined,
        {
          startX: shotOrigin.x,
          startY: shotOrigin.y,
          endX: target.x,
          endY: target.y
        }
      );
      const targetId = target.id;
      const targetKind = damageTarget.kind;
      this.scheduleCatalogAction(player.id, now + 650, () => {
        const owner = this.players.get(player.id);
        if (!owner?.alive) return;
        if (targetKind === "player") {
          const currentTarget = this.players.get(targetId);
          if (
            currentTarget?.alive &&
            this.areEnemies(owner, currentTarget) &&
            this.sharesCombatDimension(owner, currentTarget, Date.now())
          ) {
            this.damagePlayer(currentTarget, 54, owner.id, skillId);
          }
          return;
        }
        const currentTurret = this.turrets.find(
          (turret) => turret.id === targetId && turret.health > 0
        );
        if (currentTurret) {
          this.damageTurret(currentTurret, 54, owner.id, Date.now(), skillId);
        }
      });
      return true;
    }

    const projectileConfig: Partial<
      Record<
        ArenaCatalogSkillId,
        {
          damage: number;
          range: number;
          launchDelayMs: number;
          remainingHits?: number;
          onHit?: ProjectileEntity["onHit"];
        }
      >
    > = {
      archer_00: {
        damage: 11,
        range: 420,
        launchDelayMs: 280,
        onHit: { returnDamage: 11, returnDelayMs: 280 }
      },
      archer_02: { damage: 24, range: 680, launchDelayMs: 230 },
      archer_07: {
        damage: 14,
        range: 500,
        launchDelayMs: 300,
        onHit: { pull: 200, rootDurationMs: 2000 }
      },
      archer_11: {
        damage: 32,
        range: 760,
        launchDelayMs: 320,
        remainingHits: 2
      }
    };
    const config = projectileConfig[skillId];
    if (!config) return false;
    const launchAngle = player.angle;
    this.scheduleCatalogAction(player.id, now + config.launchDelayMs, () => {
      const owner = this.players.get(player.id);
      if (!owner?.alive) {
        return;
      }
      this.launchCatalogProjectile(
        owner,
        skillId,
        "arrow",
        config.damage,
        COMBAT.arrowSpeed,
        config.range,
        undefined,
        config.onHit,
        config.remainingHits,
        launchAngle
      );
    });
    this.addCatalogEffect(skillId, player, player, 92, 720, now);
    return true;
  }

  private useArcherHawkExecutionAt(
    player: PlayerEntity,
    aimPoint: { x: number; y: number },
    now: number
  ) {
    const skillId = "archer_14" as const;
    const executionSpec = getArenaSkillSpec(skillId);
    const lungeRange = executionSpec?.numbers.range;
    const impactRadius = executionSpec?.numbers.radius;
    const executionDamage = executionSpec?.numbers.damage?.[0];
    if (
      lungeRange === undefined ||
      impactRadius === undefined ||
      executionDamage === undefined
    ) {
      throw new Error(
        "Hawk Execution requires declared range, radius, and damage values."
      );
    }
    const requestedDistance = Math.min(
      lungeRange,
      distance(player, aimPoint)
    );
    if (requestedDistance < 24) return false;
    const lungeAngle = angleTo(player, aimPoint);
    const landing = this.resolveMapCollision(
      project(player, lungeAngle, requestedDistance),
      COMBAT.playerRadius
    );
    const duelConstrained = this.constrainToDuel(player, landing, now);
    const constrained = this.constrainToBarriers(player, duelConstrained, now);
    this.catalogPlayerMotions.set(player.id, {
      skillId,
      startX: player.x,
      startY: player.y,
      endX: constrained.x,
      endY: constrained.y,
      startedAt: now,
      endsAt: now + 700
    });
    player.dodgeEndsAt = now + 700;
    // The ground point is fixed at cast time. The character's lunge, the
    // hawk impact and the circular 60-damage area all resolve to this exact
    // location; no target is attached, so moving actors cannot drag it.
    this.addCatalogEffect(
      skillId,
      player,
      constrained,
      impactRadius,
      780,
      now
    );
    this.scheduleCatalogAction(player.id, now + 700, () => {
      const owner = this.players.get(player.id);
      if (!owner?.alive) return;
      this.damageRadius(
        owner,
        skillId,
        constrained,
        impactRadius,
        executionDamage
      );
    });
    return true;
  }

  private useMageCatalogSkillById(
    player: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    now: number
  ) {
    const focusLensActive =
      player.focusLensStartsAt <= now && player.focusLensEndsAt > now;
    const focusRangeBonus = focusLensActive
      ? COMBAT.mageFocusLensRangeBonus
      : 0;
    const focusDamageBonus = focusLensActive
      ? COMBAT.mageFocusLensDamageBonus
      : 0;
    const focusStatusDurationBonus = focusLensActive
      ? COMBAT.mageFocusLensStatusDurationBonus
      : 0;
    if (skillId === "mage_00") {
      this.castSolarBeam(player, now);
      return true;
    }
    if (skillId === "mage_07") {
      this.castRenewalBurst(player, now);
      return true;
    }
    if (skillId === "mage_08") {
      this.castMiasmaCrucible(player, now);
      return true;
    }
    if (skillId === "mage_12") {
      this.castCleanStorm(player, now);
      return true;
    }
    if (skillId === "mage_13") {
      this.castTimeAstrolabe(player, now);
      return true;
    }
    if (skillId === "mage_14") {
      this.castBloodMoonAltar(player, now);
      return true;
    }
    if (skillId === "mage_09") {
      const visual = getMageTimedEffectState(
        skillId,
        now,
        COMBAT.mageFocusLensDuration
      );
      player.focusLensStartsAt = visual.timing.activeStartedAt;
      player.focusLensEndsAt =
        visual.timing.activeStartedAt + COMBAT.mageFocusLensDuration;
      this.addCatalogEffect(
        skillId,
        player,
        player,
        104,
        visual.duration,
        now,
        undefined,
        visual.timing
      );
      return true;
    }
    const targetedRange =
      (skillId === "mage_02"
        ? 480
        : skillId === "mage_11"
          ? COMBAT.mageSoulChainRange
          : 520) +
      (skillId === "mage_11" ? 0 : focusRangeBonus);
    const damageTarget =
      skillId === "mage_02" || skillId === "mage_05"
        ? this.getAimDamageTarget(player, targetedRange)
        : null;
    const target =
      (skillId === "mage_02" || skillId === "mage_05") &&
      damageTarget?.kind === "player"
        ? damageTarget.target
        :
      skillId === "mage_02" ||
      skillId === "mage_03" ||
      skillId === "mage_04" ||
      skillId === "mage_05" ||
      skillId === "mage_11"
        ? this.getAimTarget(player, targetedRange)
        : null;
    if (
      (skillId === "mage_02" ||
        skillId === "mage_03" ||
        skillId === "mage_04" ||
        skillId === "mage_05" ||
        skillId === "mage_11") &&
      (skillId === "mage_02" || skillId === "mage_05"
        ? !damageTarget
        : !target)
    ) {
      return false;
    }
    if (
      (skillId === "mage_02" || skillId === "mage_05") &&
      damageTarget?.kind === "turret"
    ) {
      const damage =
        (skillId === "mage_02" ? 16 : 26) + focusDamageBonus;
      this.damageTurret(
        damageTarget.target,
        damage,
        player.id,
        now,
        skillId
      );
      this.addCatalogEffect(
        skillId,
        player,
        damageTarget.target,
        94,
        900,
        now
      );
      return true;
    }
    if (skillId === "mage_02" && target) {
      this.damagePlayer(target, 16 + focusDamageBonus, player.id, skillId);
      this.healPlayer(player, target.poisonEndsAt > now ? 16 : 8);
      this.addCatalogEffect(skillId, player, target, 90, 900, now, target);
      return true;
    }
    if (skillId === "mage_03" && target) {
      const duration = 4000 + focusStatusDurationBonus;
      const visual = getMageTimedEffectState(skillId, now, duration);
      target.sunlightBrandStartsAt =
        target.sunlightBrandEndsAt > now
          ? Math.min(
              target.sunlightBrandStartsAt,
              visual.timing.activeStartedAt
            )
          : visual.timing.activeStartedAt;
      target.sunlightBrandEndsAt = Math.max(
        target.sunlightBrandEndsAt,
        visual.timing.activeStartedAt + duration
      );
      this.addCatalogEffect(
        skillId,
        player,
        target,
        74,
        visual.duration,
        now,
        target,
        visual.timing
      );
      return true;
    }
    if (skillId === "mage_04" && target) {
      // The two intro frames are an authored cast wind-up.  The silence itself
      // begins after that wind-up and lasts the full stated two seconds; the
      // active seal loops source frames 2/3/4 at their native 78ms cadence.
      const silenceDurationMs = 2000 + focusStatusDurationBonus;
      const visual = getMageTimedEffectState(
        skillId,
        now,
        silenceDurationMs
      );
      const silenceStartsAt = visual.timing.activeStartedAt;
      if (!this.hasEngineerSupportControlImmunity(target, now)) {
        target.silenceStartsAt =
          target.silenceEndsAt > now
            ? Math.min(target.silenceStartsAt, silenceStartsAt)
            : silenceStartsAt;
        target.silenceEndsAt = Math.max(
          target.silenceEndsAt,
          silenceStartsAt + silenceDurationMs
        );
      }
      this.addCatalogEffect(
        skillId,
        player,
        target,
        80,
        visual.duration,
        now,
        target,
        visual.timing
      );
      return true;
    }
    if (skillId === "mage_05" && target) {
      this.damagePlayer(target, 26 + focusDamageBonus, player.id, skillId);
      this.addCatalogEffect(skillId, player, target, 94, 850, now, target);
      return true;
    }
    if (skillId === "mage_10") {
      const center = this.getAimPoint(player);
      const spec = getArenaSkillSpec(skillId);
      const radius = spec?.numbers.radius;
      const pull = spec?.numbers.pull;
      const tickIntervalMs = spec?.numbers.tickIntervalMs;
      const durationMs = spec?.numbers.statusDurationMs;
      if (
        radius == null ||
        pull == null ||
        tickIntervalMs == null ||
        durationMs == null
      ) {
        return false;
      }
      const visual = getMageTimedEffectState(skillId, now, durationMs);
      const activeStartsAt = visual.timing.activeStartedAt;
      this.catalogFields.push({
        id: `catalog_field_${this.nextEffectId}`,
        ownerId: player.id,
        skillId,
        x: center.x,
        y: center.y,
        radius,
        startsAt: activeStartsAt,
        endsAt: activeStartsAt + durationMs,
        nextTickAt: activeStartsAt,
        tickIntervalMs,
        triggeredTargetIds: new Set()
      });
      this.addCatalogEffect(
        skillId,
        player,
        center,
        radius,
        visual.duration,
        now,
        undefined,
        visual.timing
      );
      return true;
    }
    if (skillId === "mage_11" && target) {
      const visual = getMageTimedEffectState(
        skillId,
        now,
        COMBAT.mageSoulChainDuration
      );
      const duration = target.alive ? visual.duration : 540;
      const effectId = this.addCatalogEffect(
        skillId,
        player,
        player,
        Math.max(100, distance(player, target)),
        duration,
        now,
        target,
        target.alive ? visual.timing : undefined
      );
      if (target.alive) {
        const targetId = target.id;
        this.scheduleCatalogAction(
          player.id,
          visual.timing.activeStartedAt,
          () => {
            const currentTarget = this.players.get(targetId);
            if (currentTarget?.alive) {
              this.damagePlayer(
                currentTarget,
                COMBAT.mageSoulChainDamage,
                player.id,
                skillId
              );
            }
          }
        );
        this.soulChains.push({
          ownerId: player.id,
          targetId: target.id,
          effectId,
          startsAt: visual.timing.activeStartedAt,
          endsAt:
            visual.timing.activeStartedAt + COMBAT.mageSoulChainDuration
        });
      }
      return true;
    }
    if (skillId === "mage_01") {
      this.launchCatalogProjectile(
        player,
        skillId,
        "magic_ball",
        12 + focusDamageBonus,
        620,
        560 + focusRangeBonus,
        undefined,
        { appliesPoison: true }
      );
      return true;
    }
    if (skillId === "mage_06") {
      this.launchCatalogProjectile(
        player,
        skillId,
        "magic_ball",
        18 + focusDamageBonus,
        520,
        560 + focusRangeBonus,
        undefined,
        { slowMultiplier: 0.5, slowDurationMs: 2000 }
      );
      return true;
    }
    return false;
  }

  private useEngineerCatalogSkill(
    player: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    now: number
  ) {
    if (skillId === "engineer_12") {
      return this.fireSynchronizedSeekers(player, now);
    }
    if (skillId === "engineer_14") {
      return this.fireSplittingStars(player, now);
    }
    if (skillId === "engineer_15") {
      return this.fireMagicMissileMatrix(player, now);
    }
    if (skillId === "engineer_13") {
      const target = this.getAimTarget(player, 520);
      const turrets = this.getOwnedTurrets(player.id, "magic_missile").filter(
        (turret) => target && distance(turret, target) <= COMBAT.magicTurretRange
      );
      if (!target || turrets.length === 0) return false;
      player.magicMarkTargetId = target.id;
      player.magicMarkEndsAt = now + 4000;
      for (const turret of turrets) {
        this.fireMagicTurretMissile(
          turret,
          target,
          "magic_turret_basic",
          7,
          undefined,
          "engineer_13"
        );
      }
      this.addCatalogEffect(skillId, player, target, 86, 4000, now, target);
      return true;
    }

    const ordinary = this.getClosestTurretToAim(player, "mechanical");
    const anyTurret = this.getClosestTurretToAim(player);
    if (skillId === "engineer_01") {
      const target = ordinary ? this.getNearestEnemyToPoint(player, ordinary, 440) : null;
      if (!ordinary || !target) return false;
      ordinary.markedTargetId = target.id;
      ordinary.markedEndsAt = now + 5000;
      ordinary.enhancedShots = 3;
      this.addCatalogEffect(skillId, player, target, 76, 900, now, target);
      return true;
    }
    if (skillId === "engineer_02") {
      if (!ordinary) return false;
      for (const offset of [-24, 0, 24]) {
        this.launchTurretProjectile(
          ordinary,
          skillId,
          9,
          player.angle + offset,
          210
        );
      }
      this.addCatalogEffect(skillId, player, ordinary, 110, 720, now);
      return true;
    }
    if (skillId === "engineer_03") {
      if (!ordinary) return false;
      ordinary.armorCoreEndsAt = now + 5000;
      this.addCatalogEffect(skillId, player, ordinary, 74, 1000, now);
      return true;
    }
    if (skillId === "engineer_04") {
      if (!ordinary) return false;
      const turretId = ordinary.id;
      const lockedAngle = player.angle;
      for (let index = 0; index < 4; index += 1) {
        this.scheduleCatalogAction(
          player.id,
          now + index * 180,
          () => {
            const currentTurret = this.turrets.find(
              (turret) => turret.id === turretId && turret.health > 0
            );
            if (!currentTurret) {
              return;
            }
            this.launchTurretProjectile(
              currentTurret,
              skillId,
              11,
              lockedAngle,
              260,
              { slowMultiplier: 0.8, slowDurationMs: 1000 }
            );
          }
        );
      }
      this.addCatalogEffect(skillId, player, ordinary, 120, 1080, now);
      return true;
    }
    if (skillId === "engineer_05") {
      const target = this.getAimTarget(player, 460);
      if (!target) return false;
      const turrets = this.getOwnedTurrets(player.id, "mechanical").filter(
        (turret) => distance(turret, target) <= 460
      );
      if (turrets.length === 0) return false;
      const enhanced = turrets.some(
        (turret) =>
          turret.markedTargetId === target.id &&
          turret.markedEndsAt > now &&
          turret.enhancedShots >= 3
      );
      for (const turret of turrets) {
        // Lock the release-time position only. These are physical shells, so a
        // moving target can still dodge after the volley leaves the barrels.
        this.launchTurretProjectile(
          turret,
          skillId,
          enhanced ? 24 : 16,
          angleTo(turret, target),
          460
        );
        if (turret.markedTargetId === target.id && turret.markedEndsAt > now) {
          turret.markedTargetId = null;
          turret.markedEndsAt = 0;
          turret.enhancedShots = 0;
        }
      }
      this.addCatalogEffect(skillId, player, turrets[0], 130, 950, now, target);
      return true;
    }
    if (skillId === "engineer_06") {
      if (!ordinary) return false;
      const center = this.getAimPoint(player);
      const turretId = ordinary.id;
      const launchAngle = angleTo(ordinary, center);
      const launchOrigin = project(
        { x: ordinary.x, y: ordinary.y - 18 },
        launchAngle,
        28
      );
      ordinary.angle = launchAngle;
      this.effects.push({
        id: `fx_${this.nextEffectId++}`,
        type: "catalog_skill",
        ownerId: player.id,
        classId: player.classId,
        skillId,
        sourceTurretId: ordinary.id,
        startX: launchOrigin.x,
        startY: launchOrigin.y,
        x: center.x,
        y: center.y,
        angle: launchAngle,
        radius: 280,
        startedAt: now,
        // engineer_06 keeps its original 1.2s damage timing below, while the
        // faster ignition, peak, push-out, and dispersal remain complete.
        duration: 2200,
        dimensionId:
          this.getActiveDuelDimensionId(player, now) ?? undefined
      });
      this.scheduleCatalogAction(player.id, now + 1200, () => {
        const owner = this.players.get(player.id);
        const currentTurret = this.turrets.find(
          (turret) => turret.id === turretId && turret.health > 0
        );
        if (!owner?.alive || !currentTurret) {
          return;
        }
        this.damageRadius(owner, skillId, center, 280, 65);
      });
      return true;
    }
    if (skillId === "engineer_07") {
      if (!anyTurret) return false;
      for (const enemy of this.getEnemiesInRadius(player, anyTurret, 150)) {
        this.damagePlayer(enemy, 18, player.id, skillId);
        this.pushTargetAway(enemy, anyTurret, 115);
      }
      this.damageTurretsInRadius(player, skillId, anyTurret, 150, 18);
      this.addCatalogEffect(skillId, player, anyTurret, 150, 850, now);
      return true;
    }
    if (skillId === "engineer_08") {
      const turrets = this.getOwnedTurrets(player.id);
      if (turrets.length < 2) return false;
      this.removeOwnedBarriers(player.id);
      const link = this.getClosestBarrierLink(turrets, 320);
      if (!link) {
        return false;
      }
      const networkId = `barrier_network_${this.nextEffectId}`;
      const stunnedTargetIds = new Set<string>();
      for (const [start, end] of [link]) {
        const effectId = `fx_${this.nextEffectId++}`;
        const { startEdge, endEdge } = this.getBarrierEdgePoints(start, end);
        const linkDistance = distance(startEdge, endEdge);
        this.effects.push({
          id: effectId,
          type: "catalog_skill",
          ownerId: player.id,
          classId: player.classId,
          skillId,
          x: (startEdge.x + endEdge.x) / 2,
          y: (startEdge.y + endEdge.y) / 2,
          endX: endEdge.x,
          endY: endEdge.y,
          angle: angleTo(startEdge, endEdge),
          radius: linkDistance / 2,
          startedAt: now,
          duration: 4000,
          value: 120
        });
        this.barriers.push({
          id: `${networkId}_${start.id}_${end.id}`,
          effectId,
          ownerId: player.id,
          networkId,
          startTurretId: start.id,
          endTurretId: end.id,
          x1: startEdge.x,
          y1: startEdge.y,
          x2: endEdge.x,
          y2: endEdge.y,
          health: 120,
          maxHealth: 120,
          thickness: 24,
          endsAt: now + 4000,
          stunnedTargetIds
        });
      }
      return true;
    }
    if (skillId === "engineer_09") {
      const turrets = this.getOwnedTurrets(player.id);
      if (turrets.length === 0) return false;
      player.engineerSupportEndsAt = now + ENGINEER_SUPPORT_DURATION_MS;
      player.rootEndsAt = 0;
      player.stunEndsAt = 0;
      player.slowEndsAt = 0;
      player.silenceStartsAt = 0;
      player.silenceEndsAt = 0;
      player.dashLockEndsAt = 0;
      player.rooted = false;
      player.stunned = false;
      player.slowed = false;
      player.slowMultiplier = 1;
      for (const turret of turrets) {
        turret.supportEndsAt = now + ENGINEER_SUPPORT_DURATION_MS;
        this.addCatalogEffect(
          skillId,
          player,
          turret,
          86,
          ENGINEER_SUPPORT_DURATION_MS,
          now
        );
      }
      return true;
    }
    if (skillId === "engineer_10") {
      const target = anyTurret
        ? this.getNearestEnemyToPoint(player, anyTurret, 440)
        : null;
      if (!anyTurret || !target) return false;
      this.launchTurretProjectile(
        anyTurret,
        skillId,
        20,
        angleTo(anyTurret, target),
        440,
        { pull: 100, dashLockDurationMs: 800 }
      );
      this.addCatalogEffect(skillId, player, anyTurret, 110, 900, now, target);
      return true;
    }
    if (skillId === "engineer_11") {
      const turrets = this.getOwnedTurrets(player.id);
      if (turrets.length === 0) return false;
      const turretIds = turrets.map((turret) => turret.id);
      for (const turret of turrets) {
        this.addCatalogEffect(skillId, player, turret, 180, 1100, now);
      }
      this.scheduleCatalogAction(player.id, now + 500, () => {
        const owner = this.players.get(player.id);
        if (!owner) {
          return;
        }
        const liveTurrets = this.turrets.filter(
          (turret) => turretIds.includes(turret.id) && turret.health > 0
        );
        for (const turret of liveTurrets) {
          this.damageRadius(owner, skillId, turret, 180, 60);
        }
        const liveIds = new Set(liveTurrets.map((turret) => turret.id));
        this.turrets = this.turrets.filter(
          (turret) => !liveIds.has(turret.id)
        );
        this.scheduledMagicMissiles =
          this.scheduledMagicMissiles.filter(
            (missile) => !liveIds.has(missile.turretId)
          );
        this.removeOwnedBarriers(owner.id);
      });
      return true;
    }
    return false;
  }

  private getAimTarget(player: PlayerEntity, range: number) {
    const now = Date.now();
    const aim = this.getAimPoint(player);
    return [...this.players.values()]
      .filter(
        (candidate) =>
          candidate.alive &&
          !candidate.spawnProtected &&
          this.areEnemies(player, candidate) &&
          this.sharesCombatDimension(player, candidate, now) &&
          distance(player, candidate) <= range
      )
      .sort(
        (left, right) =>
          distanceSq(aim, left) - distanceSq(aim, right) ||
          distanceSq(player, left) - distanceSq(player, right)
      )[0] ?? null;
  }

  private getAimDamageTarget(
    player: PlayerEntity,
    range: number
  ): DamageableAimTarget | null {
    const aim = this.getAimPoint(player);
    const playerTarget = this.getAimTarget(player, range);
    const now = Date.now();
    const turretTarget = this.getActiveDuelDimensionId(player, now)
      ? null
      : this.turrets
          .filter((turret) => {
            const owner = this.players.get(turret.ownerId);
            return Boolean(
              turret.health > 0 &&
              owner &&
              this.areEnemies(player, owner) &&
              distance(player, turret) <= range
            );
          })
          .sort(
            (left, right) =>
              distanceSq(aim, left) - distanceSq(aim, right) ||
              distanceSq(player, left) - distanceSq(player, right)
          )[0] ?? null;
    if (!playerTarget && !turretTarget) return null;
    if (!turretTarget) return { kind: "player", target: playerTarget! };
    if (!playerTarget) return { kind: "turret", target: turretTarget };
    return distanceSq(aim, turretTarget) < distanceSq(aim, playerTarget)
      ? { kind: "turret", target: turretTarget }
      : { kind: "player", target: playerTarget };
  }

  private getNearestEnemyToPoint(
    owner: PlayerEntity,
    point: { x: number; y: number },
    range: number
  ) {
    const now = Date.now();
    return [...this.players.values()]
      .filter(
        (candidate) =>
          candidate.alive &&
          !candidate.spawnProtected &&
          this.areEnemies(owner, candidate) &&
          this.sharesCombatDimension(owner, candidate, now) &&
          distance(point, candidate) <= range
      )
      .sort((left, right) => distanceSq(point, left) - distanceSq(point, right))[0] ?? null;
  }

  private getEnemiesInRadius(
    owner: PlayerEntity,
    center: { x: number; y: number },
    radius: number
  ) {
    const now = Date.now();
    return [...this.players.values()].filter(
      (candidate) =>
        candidate.alive &&
        this.areEnemies(owner, candidate) &&
        this.sharesCombatDimension(owner, candidate, now) &&
        distance(center, candidate) <= radius
    );
  }

  private getEnemiesInArc(owner: PlayerEntity, range: number, halfAngle: number) {
    const now = Date.now();
    return [...this.players.values()].filter(
      (candidate) =>
        candidate.alive &&
        this.areEnemies(owner, candidate) &&
        this.sharesCombatDimension(owner, candidate, now) &&
        distance(owner, candidate) <= range &&
        angleDiff(owner.angle, angleTo(owner, candidate)) <= halfAngle
    );
  }

  private damageRadius(
    owner: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    center: { x: number; y: number },
    radius: number,
    damage: number
  ) {
    for (const target of this.getEnemiesInRadius(owner, center, radius)) {
      this.damagePlayer(target, damage, owner.id, skillId);
    }
    this.damageTurretsInRadius(owner, skillId, center, radius, damage);
  }

  private damageTurretsInRadius(
    owner: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    center: { x: number; y: number },
    radius: number,
    damage: number
  ) {
    const now = Date.now();
    if (this.getActiveDuelDimensionId(owner, now)) return;
    for (const turret of this.turrets) {
      const turretOwner = this.players.get(turret.ownerId);
      if (
        turret.health <= 0 ||
        !turretOwner ||
        !this.areEnemies(owner, turretOwner) ||
        distance(center, turret) > radius
      ) {
        continue;
      }
      this.damageTurret(turret, damage, owner.id, now, skillId);
    }
  }

  private launchCatalogProjectile(
    owner: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    type: Extract<ProjectileType, "arrow" | "magic_ball">,
    damage: number,
    speed: number,
    range: number,
    target?: PlayerEntity,
    onHit?: ProjectileEntity["onHit"],
    remainingHits = 1,
    launchAngle?: number
  ) {
    const acceptedOrigin =
      owner.classId === "mage" && type === "magic_ball"
        ? getMageStaffAnchor(owner)
        : owner.classId === "archer" && type === "arrow"
          ? skillId === "archer_04" || skillId === "archer_07"
            ? getArcherThrowAnchor(owner)
            : getArcherBowAnchor(owner)
          : this.getPlayerProjectileOrigin(owner, type);
    const origin = {
      ...acceptedOrigin,
      distance: 0
    };
    const angle = target
      ? angleTo(origin, target)
      : launchAngle ?? owner.angle;
    this.spawnProjectile({
      ownerId: owner.id,
      skillId,
      type,
      phase:
        skillId === "archer_04" || skillId === "archer_07"
          ? "flight"
          : undefined,
      x: origin.x,
      y: origin.y,
      angle,
      damage,
      speed,
      maxDistance: range,
      distanceTraveled: origin.distance,
      targetId: target?.id,
      onHit,
      remainingHits
    });
  }

  private launchTurretProjectile(
    turret: TurretEntity,
    skillId: ArenaCatalogSkillId,
    damage: number,
    angle: number,
    range: number,
    onHit?: ProjectileEntity["onHit"],
    target?: PlayerEntity,
    homingTurnRate?: number
  ) {
    turret.angle = angle;
    const origin = project({ x: turret.x, y: turret.y - 18 }, angle, 28);
    this.spawnProjectile({
      ownerId: turret.ownerId,
      sourceTurretId: turret.id,
      skillId,
      type: "mechanical_turret",
      x: origin.x,
      y: origin.y,
      angle,
      damage,
      speed: COMBAT.mechanicalTurretShotSpeed,
      maxDistance: range,
      distanceTraveled: 0,
      targetId: target?.id,
      homingTurnRate,
      onHit
    });
  }

  private getClosestTurretToAim(
    owner: PlayerEntity,
    kind?: EngineerTurretKind
  ) {
    const aim = this.getAimPoint(owner);
    return this.getOwnedTurrets(owner.id, kind)
      .sort((left, right) => distanceSq(aim, left) - distanceSq(aim, right))[0] ?? null;
  }

  private getClosestBarrierLink(
    turrets: TurretEntity[],
    linkRange: number
  ): [TurretEntity, TurretEntity] | null {
    const closest = turrets
      .flatMap((start, startIndex) =>
        turrets.slice(startIndex + 1).map((end) => ({
          start,
          end,
          length: distance(start, end)
        }))
      )
      // A deployment calculated from two exact-radius circles can serialize
      // back as 320.0000000000001. Treat sub-millimetre floating-point noise
      // as the configured 320-unit Engineer barrier limit, while keeping the
      // gameplay range itself unchanged.
      .filter((candidate) => candidate.length <= linkRange + 0.001)
      .sort(
        (left, right) =>
          left.length - right.length ||
          left.start.deployedAt - right.start.deployedAt ||
          left.end.deployedAt - right.end.deployedAt
      )[0];
    return closest ? [closest.start, closest.end] : null;
  }

  private getBarrierEdgePoints(
    start: TurretEntity,
    end: TurretEntity
  ): {
    startEdge: { x: number; y: number };
    endEdge: { x: number; y: number };
  } {
    const centerDistance = distance(start, end);
    if (centerDistance <= 0) {
      return {
        startEdge: { x: start.x, y: start.y },
        endEdge: { x: end.x, y: end.y }
      };
    }
    const inset = Math.min(
      ENGINEER_BARRIER_TURRET_VISUAL_RADIUS,
      centerDistance / 2
    );
    const unitX = (end.x - start.x) / centerDistance;
    const unitY = (end.y - start.y) / centerDistance;
    return {
      startEdge: {
        x: start.x + unitX * inset,
        y: start.y + unitY * inset
      },
      endEdge: {
        x: end.x - unitX * inset,
        y: end.y - unitY * inset
      }
    };
  }

  private addCatalogEffect(
    skillId: ArenaCatalogSkillId,
    owner: PlayerEntity,
    origin: { x: number; y: number },
    radius: number,
    duration: number,
    now: number,
    target?: PlayerEntity,
    timing?: Pick<
      EffectState,
      "activeStartedAt" | "activeDuration"
    >,
    motion?: Pick<EffectState, "startX" | "startY" | "endX" | "endY">
  ) {
    const id = `fx_${this.nextEffectId++}`;
    this.effects.push({
      id,
      type: "catalog_skill",
      ownerId: owner.id,
      targetId: target?.id,
      classId: owner.classId,
      skillId,
      x: origin.x,
      y: origin.y,
      angle: target ? angleTo(origin, target) : owner.angle,
      radius,
      startedAt: now,
      duration,
      ...timing,
      ...motion,
      dimensionId:
        this.getActiveDuelDimensionId(owner, now) ?? undefined
    });
    return id;
  }

  private removeCatalogEffects(
    ownerId: string,
    skillId: ArenaCatalogSkillId
  ) {
    this.effects = this.effects.filter(
      (effect) =>
        effect.ownerId !== ownerId || effect.skillId !== skillId
    );
  }

  private hasEngineerSupportControlImmunity(
    target: PlayerEntity,
    now: number
  ) {
    return (
      target.classId === "engineer" &&
      target.engineerSupportEndsAt > now
    );
  }

  private applyRoot(
    target: PlayerEntity,
    durationMs: number,
    now: number
  ) {
    if (this.hasEngineerSupportControlImmunity(target, now)) {
      return false;
    }
    target.rootEndsAt = Math.max(target.rootEndsAt, now + durationMs);
    target.rooted = true;
    return true;
  }

  private applyStun(
    target: PlayerEntity,
    durationMs: number,
    now: number
  ) {
    if (this.hasEngineerSupportControlImmunity(target, now)) {
      return false;
    }
    target.stunEndsAt = Math.max(target.stunEndsAt, now + durationMs);
    target.stunned = true;
    return true;
  }

  private applySlow(
    target: PlayerEntity,
    multiplier: number,
    durationMs: number,
    now: number
  ) {
    if (this.hasEngineerSupportControlImmunity(target, now)) {
      return false;
    }
    target.slowEndsAt = Math.max(target.slowEndsAt, now + durationMs);
    target.slowMultiplier = Math.min(target.slowMultiplier, multiplier);
    target.slowed = true;
    return true;
  }

  private applyPoison(
    ownerId: string,
    target: PlayerEntity,
    skillId: ArenaCatalogSkillId,
    now: number
  ) {
    const endsAt = now + COMBAT.poisonDuration;
    const existing = this.damageOverTime.find(
      (effect) =>
        effect.ownerId === ownerId &&
        effect.targetId === target.id &&
        effect.skillId === skillId
    );
    if (existing) {
      // Refreshing poison extends the four-second tail without resetting its
      // one-second tick cadence, so standing in poison cannot postpone damage.
      existing.damage = COMBAT.poisonTickDamage;
      existing.tickIntervalMs = COMBAT.poisonTickInterval;
      existing.endsAt = Math.max(existing.endsAt, endsAt);
    } else {
      this.damageOverTime.push({
        id: `dot_${this.nextEffectId++}`,
        ownerId,
        targetId: target.id,
        skillId,
        damage: COMBAT.poisonTickDamage,
        nextTickAt: now + COMBAT.poisonTickInterval,
        tickIntervalMs: COMBAT.poisonTickInterval,
        endsAt
      });
    }
    target.poisonEndsAt = Math.max(target.poisonEndsAt, endsAt);
    target.poisoned = true;
  }

  private moveTargetToward(
    target: PlayerEntity,
    point: { x: number; y: number },
    amount: number,
    now = Date.now()
  ) {
    if (this.hasEngineerSupportControlImmunity(target, now)) {
      return;
    }
    const resolved = this.resolveMapCollision(
      project(target, angleTo(target, point), Math.min(amount, distance(target, point))),
      COMBAT.playerRadius
    );
    const constrained = this.constrainToDuel(target, resolved, now);
    target.x = constrained.x;
    target.y = constrained.y;
  }

  private pushTargetAway(
    target: PlayerEntity,
    point: { x: number; y: number },
    amount: number,
    now = Date.now()
  ) {
    if (this.hasEngineerSupportControlImmunity(target, now)) {
      return;
    }
    const resolved = this.resolveMapCollision(
      project(target, angleTo(point, target), amount),
      COMBAT.playerRadius
    );
    const constrained = this.constrainToDuel(target, resolved, now);
    target.x = constrained.x;
    target.y = constrained.y;
  }

  private duelDimensionId(leftId: string, rightId: string) {
    return `duel:${[leftId, rightId].sort().join(":")}`;
  }

  private getActiveDuelDimensionId(
    player: PlayerEntity,
    now: number
  ): string | null {
    if (
      !player.alive ||
      !player.duelPartnerId ||
      player.duelEndsAt <= now
    ) {
      return null;
    }
    const partner = this.players.get(player.duelPartnerId);
    if (
      !partner?.alive ||
      partner.duelPartnerId !== player.id ||
      partner.duelEndsAt <= now
    ) {
      return null;
    }
    return this.duelDimensionId(player.id, partner.id);
  }

  private sharesCombatDimension(
    left: PlayerEntity,
    right: PlayerEntity,
    now: number
  ) {
    return (
      this.getActiveDuelDimensionId(left, now) ===
      this.getActiveDuelDimensionId(right, now)
    );
  }

  private getEffectDimensionId(effect: EffectState, now: number) {
    if (effect.dimensionId) {
      return effect.dimensionId;
    }
    const owner = effect.ownerId
      ? this.players.get(effect.ownerId)
      : undefined;
    const target = effect.targetId
      ? this.players.get(effect.targetId)
      : undefined;
    return owner
      ? this.getActiveDuelDimensionId(owner, now)
      : target
        ? this.getActiveDuelDimensionId(target, now)
        : null;
  }

  private getDuelRealmForViewer(
    viewer: PlayerEntity,
    now: number
  ): DuelRealmState | null {
    const dimensionId = this.getActiveDuelDimensionId(viewer, now);
    const partner = viewer.duelPartnerId
      ? this.players.get(viewer.duelPartnerId)
      : null;
    if (!dimensionId || !partner) {
      return null;
    }
    return {
      id: dimensionId,
      participantIds: [viewer.id, partner.id],
      centerX: viewer.duelCenterX,
      centerY: viewer.duelCenterY,
      radiusX: ARENA_DUEL_REALM.radiusX,
      radiusY: ARENA_DUEL_REALM.radiusY,
      startedAt: Math.min(viewer.duelStartedAt, partner.duelStartedAt),
      endsAt: Math.min(viewer.duelEndsAt, partner.duelEndsAt)
    };
  }

  private endDuelForPlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player?.duelPartnerId) {
      return;
    }
    const partnerId = player.duelPartnerId;
    const dimensionId = this.duelDimensionId(player.id, partnerId);
    const partner = this.players.get(partnerId);
    for (const duelist of [player, partner]) {
      if (!duelist) {
        continue;
      }
      duelist.duelPartnerId = null;
      duelist.duelStartedAt = 0;
      duelist.duelEndsAt = 0;
      duelist.duelCenterX = 0;
      duelist.duelCenterY = 0;
    }
    this.projectiles = this.projectiles.filter(
      (projectile) => projectile.dimensionId !== dimensionId
    );
    this.effects = this.effects.filter(
      (effect) => effect.dimensionId !== dimensionId
    );
  }

  private constrainToDuel(
    player: PlayerEntity,
    next: { x: number; y: number },
    now: number
  ) {
    if (player.duelEndsAt <= now || !player.duelPartnerId) {
      return next;
    }
    const center = { x: player.duelCenterX, y: player.duelCenterY };
    const radiusX =
      ARENA_DUEL_REALM.radiusX - COMBAT.playerRadius * 0.65;
    const radiusY =
      ARENA_DUEL_REALM.radiusY - COMBAT.playerRadius * 0.65;
    const dx = next.x - center.x;
    const dy = next.y - center.y;
    const normalizedDistance = Math.hypot(dx / radiusX, dy / radiusY);
    if (normalizedDistance <= 1) {
      return next;
    }
    return {
      x: center.x + dx / normalizedDistance,
      y: center.y + dy / normalizedDistance
    };
  }

  private useMageCatalogSkill(player: PlayerEntity, slot: ArenaLoadoutSlot, now: number) {
    const skillId = player.catalogLoadout[slot];
    const spec = getRuntimeMageSkill(skillId);
    if (!spec || spec.slot !== slot) {
      return false;
    }

    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, slot, now, spec.cooldownMs);

    if (skillId === "mage_00") {
      this.castSolarBeam(player, now);
      return true;
    }
    if (skillId === "mage_07") {
      this.castRenewalBurst(player, now);
      return true;
    }
    if (skillId === "mage_08") {
      this.castMiasmaCrucible(player, now);
      return true;
    }
    if (skillId === "mage_12") {
      this.castCleanStorm(player, now);
      return true;
    }
    if (skillId === "mage_13") {
      this.castTimeAstrolabe(player, now);
      return true;
    }
    if (skillId === "mage_14") {
      this.castBloodMoonAltar(player, now);
      return true;
    }

    return false;
  }

  private releaseSpawnGuardForAction(player: PlayerEntity, now: number) {
    if (player.spawnGuardEndsAt <= now) {
      return;
    }

    player.spawnGuardEndsAt = now;
    player.spawnProtected = false;
  }

  private useEngineerSkill(player: PlayerEntity, skill: SkillKey, now: number) {
    if (skill === "skillF") {
      return this.deployTurret(player, now);
    }
    if (skill === "skillQ") {
      return this.fireSynchronizedSeekers(player, now);
    }
    if (skill === "skillE") {
      return this.fireSplittingStars(player, now);
    }
    return this.fireMagicMissileMatrix(player, now);
  }

  private useSkillF(player: PlayerEntity, now: number) {
    if (!this.canUse(player, "skillF", now)) {
      return;
    }
    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillF", now);

    if (player.classId === "warrior") {
      this.setActionPose(player, now, 520, "skillF");
      player.attackBoostEndsAt = Math.max(player.attackBoostEndsAt, now + COMBAT.warriorBattleCryDuration);
      player.damageBoostMultiplier = WORLD.attackBoostMultiplier;
      player.attackBoosted = true;
      this.addEffect("attack_boost", player, 105, 760, Math.round((WORLD.attackBoostMultiplier - 1) * 100));
      return;
    }

    if (player.classId === "archer") {
      this.setActionPose(player, now, 420, "skillF");
      const origin = this.getPlayerProjectileOrigin(player, "arrow");
      this.spawnProjectile({
        ownerId: player.id,
        type: "arrow",
        x: origin.x,
        y: origin.y,
        angle: player.angle,
        damage: COMBAT.archerPiercingShotDamage,
        speed: COMBAT.archerPiercingShotSpeed,
        maxDistance: COMBAT.archerPiercingShotDistance,
        distanceTraveled: origin.distance
      });
      return;
    }

    this.setActionPose(player, now, 520, "skillF");
    player.shieldEndsAt = Math.max(player.shieldEndsAt, now + COMBAT.mageAstralWardDuration);
    player.shielded = true;
    this.addEffect("shield", player, 115, 900);
  }

  private deployTurret(player: PlayerEntity, now: number) {
    const deployPoint = this.getTurretDeployPoint(player);
    const kind = player.engineerTurretKind;
    const maxHealth =
      kind === "mechanical"
        ? COMBAT.mechanicalTurretHealth
        : COMBAT.magicTurretHealth;
    const owned = this.turrets
      .filter((turret) => turret.ownerId === player.id)
      .sort((a, b) => a.deployedAt - b.deployedAt);

    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillF", now);
    this.setActionPose(player, now, 560, "skillF", "engineer_00");

    if (owned.length >= COMBAT.engineerMaxTurrets) {
      const oldest = owned[0];
      const oldestIndex = this.turrets.findIndex((turret) => turret.id === oldest.id);
      if (oldestIndex >= 0) {
        this.turrets.splice(oldestIndex, 1);
      }
    }

    this.turrets.push({
      id: `t_${this.nextTurretId++}`,
      ownerId: player.id,
      x: deployPoint.x,
      y: deployPoint.y,
      angle: 0,
      health: maxHealth,
      maxHealth,
      shield: 0,
      shieldEndsAt: 0,
      kind,
      lastAttackAt: now,
      deployedAt: now,
      supportEndsAt: 0,
      markedTargetId: null,
      markedEndsAt: 0,
      enhancedShots: 0,
      armorCoreEndsAt: 0
    });
    this.addEffectAt(
      "turret_deploy",
      player,
      deployPoint,
      0,
      90,
      14 * 90,
      undefined,
      { turretKind: kind, skillId: "engineer_00" }
    );
    this.pushEvent(
      "turret",
      owned.length >= COMBAT.engineerMaxTurrets
        ? `${player.name} replaced the oldest turret with a full-health ${kind === "mechanical" ? "mechanical" : "magic"} turret`
        : `${player.name} deployed a ${kind === "mechanical" ? "mechanical" : "magic missile"} turret`,
      player,
      undefined,
      now
    );
    return true;
  }

  private fireSynchronizedSeekers(player: PlayerEntity, now: number) {
    const shots = this.getOwnedTurrets(player.id, "magic_missile")
      .map((turret) => ({ turret, target: this.getNearestMagicTurretTarget(turret) }))
      .filter((shot): shot is { turret: TurretEntity; target: PlayerEntity } => Boolean(shot.target));
    if (shots.length === 0) {
      return false;
    }

    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillQ", now);
    this.setActionPose(player, now, 560, "skillQ");
    for (const { turret, target } of shots) {
      this.fireMagicTurretMissile(turret, target, "magic_turret_sync", COMBAT.magicTurretSyncDamage);
      this.addEffectAt("magic_turret_sync", player, turret, 0, 72, 520);
    }
    return true;
  }

  private fireSplittingStars(player: PlayerEntity, now: number) {
    const shots = this.getOwnedTurrets(player.id, "magic_missile")
      .map((turret) => ({ turret, target: this.getNearestMagicTurretTarget(turret) }))
      .filter((shot): shot is { turret: TurretEntity; target: PlayerEntity } => Boolean(shot.target));
    if (shots.length === 0) {
      return false;
    }

    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillE", now);
    this.setActionPose(player, now, 680, "skillE");
    for (const { turret, target } of shots) {
      this.fireMagicTurretMissile(
        turret,
        target,
        "magic_turret_split",
        COMBAT.magicTurretSplitDamage,
        COMBAT.magicTurretSplitFragmentDamage
      );
      this.addEffectAt("magic_turret_split", player, turret, 0, 78, 620);
    }
    return true;
  }

  private fireMagicMissileMatrix(player: PlayerEntity, now: number) {
    const owned = this.getOwnedTurrets(player.id, "magic_missile");
    if (owned.length === 0) {
      return false;
    }

    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillR", now);
    this.setActionPose(player, now, 760, "skillR");

    let lockedTargets = 0;
    for (const turret of owned) {
      turret.shield = COMBAT.magicTurretMatrixShield;
      turret.shieldEndsAt = now + COMBAT.magicTurretMatrixShieldDuration;
      this.addEffectAt("magic_turret_shield", player, turret, 0, 96, COMBAT.magicTurretMatrixShieldDuration);
      this.addEffectAt("magic_turret_matrix", player, turret, 0, 44, 520);
      const targets = this.getMagicTurretTargets(turret);
      lockedTargets += targets.length;
      for (const target of targets) {
        for (let index = 0; index < COMBAT.magicTurretMatrixMissilesPerTarget; index += 1) {
          this.scheduledMagicMissiles.push({
            fireAt: now + index * COMBAT.magicTurretMatrixShotInterval,
            turretId: turret.id,
            ownerId: player.id,
            targetId: target.id,
            type: "magic_turret_matrix",
            damage: COMBAT.magicTurretMatrixDamage
          });
        }
      }
    }

    this.pushEvent(
      "ultimate",
      `${player.name} locked ${lockedTargets} target${lockedTargets === 1 ? "" : "s"} with the missile matrix`,
      player,
      undefined,
      now
    );
    return true;
  }

  private castSolarBeam(player: PlayerEntity, now: number) {
    this.setActionPose(player, now, 980, "skillQ");
    const focusLensActive =
      player.focusLensStartsAt <= now && player.focusLensEndsAt > now;
    const beamRange =
      COMBAT.mageBeamLength +
      (focusLensActive ? COMBAT.mageFocusLensRangeBonus : 0);
    const beamDamage =
      COMBAT.mageBeamDamage +
      (focusLensActive ? COMBAT.mageFocusLensDamageBonus : 0);
    const origin = getMageStaffAnchor(player);
    const playerTarget = [...this.players.values()]
      .filter(
        (candidate) =>
          this.areEnemies(player, candidate) &&
          this.sharesCombatDimension(player, candidate, now) &&
          candidate.alive &&
          distance(player, candidate) <= beamRange &&
          angleDiff(angleTo(player, candidate), player.angle) <= COMBAT.mageBeamHalfAngle
      )
      .sort((left, right) => distanceSq(player, left) - distanceSq(player, right))[0];
    const turretTarget = this.getActiveDuelDimensionId(player, now)
      ? undefined
      : this.turrets
          .filter((turret) => {
            const owner = this.players.get(turret.ownerId);
            return Boolean(
              turret.health > 0 &&
              owner &&
              this.areEnemies(player, owner) &&
              distance(player, turret) <= beamRange &&
              angleDiff(angleTo(player, turret), player.angle) <=
                COMBAT.mageBeamHalfAngle
            );
          })
          .sort(
            (left, right) => distanceSq(player, left) - distanceSq(player, right)
          )[0];
    const target: DamageableAimTarget | null =
      turretTarget &&
      (!playerTarget || distanceSq(player, turretTarget) < distanceSq(player, playerTarget))
        ? { kind: "turret", target: turretTarget }
        : playerTarget
          ? { kind: "player", target: playerTarget }
          : null;
    const end = target
      ? {
          x: target.target.x,
          y:
            target.kind === "player"
              ? target.target.y + MAGE_TARGET_TORSO_OFFSET_Y
              : target.target.y - 20
        }
      : project(origin, player.angle, beamRange);

    if (target?.kind === "player") {
      this.damagePlayer(
        target.target,
        beamDamage,
        player.id,
        "mage_00"
      );
    } else if (target?.kind === "turret") {
      this.damageTurret(
        target.target,
        beamDamage,
        player.id,
        now,
        "mage_00"
      );
    }

    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "beam",
      ownerId: player.id,
      targetId: target?.kind === "player" ? target.target.id : undefined,
      classId: player.classId,
      skillId: "mage_00",
      x: origin.x,
      y: origin.y,
      endX: end.x,
      endY: end.y,
      angle: angleTo(origin, end),
      radius: distance(origin, end),
      startedAt: now,
      duration: 980,
      value: beamDamage,
      dimensionId:
        this.getActiveDuelDimensionId(player, now) ?? undefined
    });
  }

  private castRenewalBurst(player: PlayerEntity, now: number) {
    this.setActionPose(player, now, 820, "skillE");
    const visual = getMageTimedEffectState(
      "mage_07",
      now,
      COMBAT.mageBurstStunDuration
    );
    this.addMageSkillEffect(
      "burst",
      "mage_07",
      player,
      player,
      player.angle,
      COMBAT.mageBurstRadius,
      visual.duration,
      COMBAT.mageBurstDamage,
      now,
      visual.timing
    );
    this.scheduleCatalogAction(
      player.id,
      visual.timing.activeStartedAt,
      (executeAt) => {
        const owner = this.players.get(player.id);
        if (!owner?.alive) {
          return;
        }
        let stunnedTargets = 0;
        for (const target of this.players.values()) {
          if (
            !this.areEnemies(owner, target) ||
            !this.sharesCombatDimension(owner, target, executeAt) ||
            !target.alive ||
            distance(owner, target) > COMBAT.mageBurstRadius
          ) {
            continue;
          }
          this.damagePlayer(
            target,
            COMBAT.mageBurstDamage,
            owner.id,
            "mage_07"
          );
          if (
            target.alive &&
            this.applyStun(
              target,
              COMBAT.mageBurstStunDuration,
              executeAt
            )
          ) {
            this.addEffect(
              "stun",
              target,
              82,
              COMBAT.mageBurstStunDuration
            );
            stunnedTargets += 1;
          }
        }
        if (stunnedTargets > 0) {
          this.pushEvent(
            "control",
            `${owner.name} stunned ${stunnedTargets} rival${stunnedTargets === 1 ? "" : "s"}`,
            owner,
            undefined,
            executeAt
          );
        }
        this.damageTurretsInRadius(
          owner,
          "mage_07",
          owner,
          COMBAT.mageBurstRadius,
          COMBAT.mageBurstDamage
        );
      }
    );
  }

  private castMiasmaCrucible(player: PlayerEntity, now: number) {
    this.setActionPose(player, now, 760, "skillE");
    const center = this.getAimPoint(player);
    const field = this.createMageField(
      player,
      "mage_08",
      center,
      COMBAT.mageMiasmaRadius,
      COMBAT.mageMiasmaDuration,
      now + COMBAT.mageMiasmaTickInterval,
      now
    );
    void field;
  }

  private castCleanStorm(player: PlayerEntity, now: number) {
    this.setActionPose(player, now, 920, "skillR");
    const center = this.getAimPoint(player);
    this.damageRadius(
      player,
      "mage_12",
      center,
      COMBAT.mageUltimateRadius,
      COMBAT.mageUltimateDamage
    );
    this.addMageSkillEffect(
      "ultimate",
      "mage_12",
      player,
      center,
      angleTo(player, center),
      COMBAT.mageUltimateRadius,
      1650,
      COMBAT.mageUltimateDamage,
      now
    );
    this.pushEvent("ultimate", `${player.name} cast Clean Storm`, player, undefined, now);
  }

  private castTimeAstrolabe(player: PlayerEntity, now: number) {
    this.setActionPose(player, now, 920, "skillR");
    const center = this.getAimPoint(player);
    const field = this.createMageField(
      player,
      "mage_13",
      center,
      COMBAT.mageTimeAstrolabeRadius,
      COMBAT.mageTimeAstrolabeDuration,
      Number.POSITIVE_INFINITY,
      now
    );
    void field;
    this.pushEvent("ultimate", `${player.name} cast Forbidden Astrolabe`, player, undefined, now);
  }

  private castBloodMoonAltar(player: PlayerEntity, now: number) {
    this.setActionPose(player, now, 920, "skillR");
    const center = this.getAimPoint(player);
    this.createMageField(
      player,
      "mage_14",
      center,
      COMBAT.mageBloodAltarRadius,
      COMBAT.mageBloodAltarDuration,
      now + COMBAT.mageBloodAltarTickInterval,
      now
    );
    this.pushEvent("ultimate", `${player.name} cast Blood Moon Altar`, player, undefined, now);
  }

  private createMageField(
    player: PlayerEntity,
    skillId: MageFieldSkillId,
    center: { x: number; y: number },
    radius: number,
    duration: number,
    nextTickAt: number,
    now: number
  ) {
    const visual = getMageTimedEffectState(skillId, now, duration);
    const activeStartsAt = visual.timing.activeStartedAt;
    const firstTickDelay = nextTickAt - now;
    const field: MageFieldEntity = {
      id: `mage_field_${this.nextEffectId}`,
      ownerId: player.id,
      skillId,
      x: center.x,
      y: center.y,
      radius,
      startedAt: activeStartsAt,
      endsAt: activeStartsAt + duration,
      nextTickAt: Number.isFinite(firstTickDelay)
        ? activeStartsAt + Math.max(0, firstTickDelay)
        : Number.POSITIVE_INFINITY,
      rootedTargetIds: new Set()
    };
    this.mageFields.push(field);
    this.addMageSkillEffect(
      getRuntimeMageSkill(skillId)!.effectType,
      skillId,
      player,
      center,
      angleTo(player, center),
      radius,
      visual.duration,
      undefined,
      now,
      visual.timing
    );
    return field;
  }

  private addMageSkillEffect(
    type: EffectState["type"],
    skillId: ArenaCatalogSkillId,
    owner: PlayerEntity,
    origin: { x: number; y: number },
    angle: number,
    radius: number,
    duration: number,
    value: number | undefined,
    now: number,
    timing?: Pick<
      EffectState,
      "activeStartedAt" | "activeDuration"
    >
  ) {
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type,
      ownerId: owner.id,
      classId: owner.classId,
      skillId,
      x: origin.x,
      y: origin.y,
      angle,
      radius,
      startedAt: now,
      duration,
      value,
      ...timing,
      dimensionId:
        this.getActiveDuelDimensionId(owner, now) ?? undefined
    });
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
      const constrained = this.constrainToDuel(player, resolved, now);
      player.x = constrained.x;
      player.y = constrained.y;
      this.addEffect("dash", player, 110, 540);
      return;
    }

    if (player.classId === "archer") {
      this.setActionPose(player, now, 440, "skillQ");
      const next = project(player, player.angle, COMBAT.archerRollDistance);
      const resolved = this.resolveMapCollision(next, COMBAT.playerRadius);
      const constrained = this.constrainToDuel(player, resolved, now);
      player.x = constrained.x;
      player.y = constrained.y;
      this.addEffect("roll", player, 110, 540);
      return;
    }
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
        if (
          this.areEnemies(player, target) &&
          this.sharesCombatDimension(player, target, now) &&
          target.alive &&
          distance(center, target) <= COMBAT.archerRootRadius
        ) {
          if (this.applyRoot(target, COMBAT.archerRootDuration, now)) {
            this.addEffect("root", target, 70, 800);
          }
        }
      }
      return;
    }
  }

  private useSkillR(player: PlayerEntity, now: number) {
    if (!this.canUse(player, "skillR", now)) {
      return;
    }
    this.releaseSpawnGuardForAction(player, now);
    this.startCooldown(player, "skillR", now);

    if (player.classId !== "warrior" && player.classId !== "archer") {
      return;
    }
    this.setActionPose(player, now, 760, "skillR");
    const skill =
      player.classId === "warrior"
        ? { radius: COMBAT.warriorUltimateRadius, damage: COMBAT.warriorUltimateDamage }
        : { radius: COMBAT.archerUltimateRadius, damage: COMBAT.archerUltimateDamage };

    const center = player.classId === "archer" ? this.getAimPoint(player) : player;
    for (const target of this.players.values()) {
      if (
        this.areEnemies(player, target) &&
        this.sharesCombatDimension(player, target, now) &&
        target.alive &&
        distance(center, target) <= skill.radius
      ) {
        this.damagePlayer(target, skill.damage, player.id);
      }
    }
    const ultimateDuration = player.classId === "archer" ? 2100 : 1250;
    this.addEffectAt("ultimate", player, center, angleTo(player, center), skill.radius, ultimateDuration);
    this.pushEvent("ultimate", `${player.name} cast ${player.classId === "warrior" ? "Verdict" : "Seed Rain"}`, player, undefined, now);
  }

  private getOwnedTurrets(ownerId: string, kind?: EngineerTurretKind) {
    return this.turrets.filter(
      (turret) =>
        turret.ownerId === ownerId &&
        turret.health > 0 &&
        (!kind || turret.kind === kind)
    );
  }

  private getMagicTurretTargets(turret: TurretEntity) {
    const owner = this.players.get(turret.ownerId);
    const now = Date.now();
    return [...this.players.values()]
      .filter(
        (player) =>
          Boolean(owner && this.areEnemies(owner, player)) &&
          player.alive &&
          !this.getActiveDuelDimensionId(player, now) &&
          !player.spawnProtected &&
          distance(player, turret) <= COMBAT.magicTurretRange
      )
      .sort((a, b) => distanceSq(turret, a) - distanceSq(turret, b));
  }

  private getNearestMagicTurretTarget(turret: TurretEntity) {
    return this.getMagicTurretTargets(turret)[0] ?? null;
  }

  private getNearestMechanicalTurretTarget(turret: TurretEntity) {
    const owner = this.players.get(turret.ownerId);
    const now = Date.now();
    return [...this.players.values()]
      .filter(
        (player) =>
          Boolean(owner && this.areEnemies(owner, player)) &&
          player.alive &&
          !this.getActiveDuelDimensionId(player, now) &&
          !player.spawnProtected &&
          distance(player, turret) <= COMBAT.mechanicalTurretRange
      )
      .sort((left, right) => distanceSq(turret, left) - distanceSq(turret, right))[0] ?? null;
  }

  private fireMechanicalTurretShot(
    turret: TurretEntity,
    target: PlayerEntity,
    damage: number = COMBAT.mechanicalTurretBasicDamage,
    skillId?: ArenaCatalogSkillId,
    onHit?: ProjectileEntity["onHit"]
  ) {
    turret.angle = angleTo(turret, target);
    const origin = project({ x: turret.x, y: turret.y - 18 }, turret.angle, 28);
    this.spawnProjectile({
      ownerId: turret.ownerId,
      sourceTurretId: turret.id,
      skillId,
      type: "mechanical_turret",
      x: origin.x,
      y: origin.y,
      angle: turret.angle,
      damage,
      damageScaling: skillId ? "class" : "preset",
      speed: COMBAT.mechanicalTurretShotSpeed,
      maxDistance: COMBAT.mechanicalTurretRange,
      distanceTraveled: 0,
      onHit
    });
  }

  private fireMagicTurretMissile(
    turret: TurretEntity,
    target: PlayerEntity,
    type: Extract<
      ProjectileType,
      "magic_turret_basic" | "magic_turret_sync" | "magic_turret_split" | "magic_turret_split_fragment" | "magic_turret_matrix"
    >,
    damage: number,
    splitDamage?: number,
    skillIdOverride?: ArenaCatalogSkillId
  ) {
    // The accepted magic turret never rotates. Its projectile leaves the
    // visible core orb, 17px right and 29px above the ground contact.
    const origin = { x: turret.x + 17, y: turret.y - 29 };
    const launchAngle = angleTo(origin, this.getMagicTurretMissileTarget(target));
    this.spawnProjectile({
      ownerId: turret.ownerId,
      sourceTurretId: turret.id,
      skillId:
        skillIdOverride ??
        (type === "magic_turret_sync"
          ? "engineer_12"
          : type === "magic_turret_split" ||
              type === "magic_turret_split_fragment"
            ? "engineer_14"
            : type === "magic_turret_matrix"
              ? "engineer_15"
              : undefined),
      type,
      x: origin.x,
      y: origin.y,
      angle: launchAngle,
      damage,
      damageScaling:
        type === "magic_turret_basic" && !skillIdOverride
          ? "preset"
          : "class",
      speed: COMBAT.magicTurretShotSpeed,
      maxDistance: COMBAT.magicTurretHomingDistance,
      distanceTraveled: 0,
      targetId: target.id,
      ignoresTerrain: true,
      splitDamage
    });
  }

  private getMagicTurretMissileTarget(target: PlayerEntity) {
    return { x: target.x, y: target.y - 42 };
  }

  private isMagicTurretProjectileType(type: ProjectileType) {
    return (
      type === "magic_turret_basic" ||
      type === "magic_turret_sync" ||
      type === "magic_turret_split" ||
      type === "magic_turret_split_fragment" ||
      type === "magic_turret_matrix"
    );
  }

  private updateScheduledMagicMissiles(now: number) {
    if (this.scheduledMagicMissiles.length === 0) {
      return;
    }

    const pending: ScheduledMagicMissile[] = [];
    for (const missile of this.scheduledMagicMissiles) {
      if (missile.fireAt > now) {
        pending.push(missile);
        continue;
      }
      const turret = this.turrets.find((candidate) => candidate.id === missile.turretId && candidate.health > 0);
      const target = this.players.get(missile.targetId);
      if (!turret || !target?.alive) {
        continue;
      }
      this.fireMagicTurretMissile(turret, target, missile.type, missile.damage);
    }
    this.scheduledMagicMissiles = pending;
  }

  private spawnProjectile(input: ProjectileSpawnInput) {
    const { distanceTraveled = 0, ...projectile } = input;
    const owner = this.players.get(projectile.ownerId);
    const dimensionId =
      projectile.dimensionId ??
      (!projectile.sourceTurretId && owner
        ? this.getActiveDuelDimensionId(owner, Date.now()) ?? undefined
        : undefined);
    this.projectiles.push({
      id: `pr_${this.nextProjectileId++}`,
      distanceTraveled,
      spawnX: projectile.x,
      spawnY: projectile.y,
      ...projectile,
      dimensionId
    });
  }

  private getPlayerProjectileOrigin(player: PlayerEntity, type: ProjectileType) {
    if (type === "arrow") {
      return this.getMuzzlePoint({ x: player.x, y: player.y - 28 }, player.angle, 58, 0);
    }

    return this.getMuzzlePoint(player, player.angle, 40, 10);
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
    const splitFragments: ProjectileSpawnInput[] = [];

    for (const projectile of this.projectiles) {
      if (projectile.phase === "contact") {
        const contactTarget = projectile.targetId
          ? this.players.get(projectile.targetId)
          : null;
        if (
          !contactTarget?.alive ||
          !projectile.contactEndsAt ||
          now >= projectile.contactEndsAt
        ) {
          continue;
        }
        projectile.x = contactTarget.x;
        projectile.y = contactTarget.y - 38;
        surviving.push(projectile);
        continue;
      }
      if (projectile.returningToOwner) {
        const returnOwner = this.players.get(projectile.ownerId);
        if (!returnOwner?.alive) {
          continue;
        }
        if (projectile.returnStartsAt && now < projectile.returnStartsAt) {
          surviving.push(projectile);
          continue;
        }
        const returnTarget = getArcherBowAnchor(returnOwner);
        const distanceToOwner = distance(projectile, returnTarget);
        const travel = projectile.speed * deltaSeconds;
        if (distanceToOwner <= Math.max(COMBAT.projectileHitRadius, travel)) {
          continue;
        }
        projectile.angle = angleTo(projectile, returnTarget);
        const next = project(projectile, projectile.angle, travel);
        projectile.x = next.x;
        projectile.y = next.y;
        projectile.distanceTraveled += travel;
        surviving.push(projectile);
        continue;
      }
      const homingTarget = projectile.targetId ? this.players.get(projectile.targetId) : null;
      if (projectile.targetId) {
        if (
          !homingTarget?.alive ||
          (projectile.dimensionId ?? null) !==
            this.getActiveDuelDimensionId(homingTarget, now)
        ) {
          continue;
        }
        const desiredAngle = angleTo(
          projectile,
          this.isMagicTurretProjectileType(projectile.type)
            ? this.getMagicTurretMissileTarget(homingTarget)
            : { x: homingTarget.x, y: homingTarget.y - 42 }
        );
        projectile.angle = projectile.homingTurnRate
          ? rotateAngleToward(
              projectile.angle,
              desiredAngle,
              projectile.homingTurnRate * deltaSeconds
            )
          : desiredAngle;
      }

      const previous = { x: projectile.x, y: projectile.y };
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

      if (
        !projectile.ignoresTerrain &&
        this.isBlocked(projectile, COMBAT.projectileHitRadius * 0.65)
      ) {
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

      const projectileOwner = this.players.get(projectile.ownerId);
      let hitBarrier = false;
      for (const barrier of projectile.dimensionId ? [] : this.barriers) {
        const barrierOwner = this.players.get(barrier.ownerId);
        if (
          !projectileOwner ||
          !barrierOwner ||
          !this.areEnemies(projectileOwner, barrierOwner) ||
          !segmentsWithinDistance(
            previous,
            projectile,
            { x: barrier.x1, y: barrier.y1 },
            { x: barrier.x2, y: barrier.y2 },
            COMBAT.projectileHitRadius + barrier.thickness / 2
          )
        ) {
          continue;
        }
        this.damageBarrier(barrier, projectile.damage, now);
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
        hitBarrier = true;
        break;
      }
      if (hitBarrier) {
        continue;
      }

      let hit = false;
      let retainedAtContact = false;
      const playerTargets = homingTarget ? [homingTarget] : this.players.values();
      for (const target of playerTargets) {
        const owner = this.players.get(projectile.ownerId);
        if (
          owner &&
          this.areEnemies(owner, target) &&
          (projectile.dimensionId ?? null) ===
            this.getActiveDuelDimensionId(target, now) &&
          target.alive &&
          !projectile.hitTargetIds?.has(target.id) &&
          this.projectileHitsPlayer(projectile, previous, target)
        ) {
          this.damagePlayer(
            target,
            projectile.damage,
            projectile.ownerId,
            projectile.skillId,
            projectile.damageScaling
          );
          this.applyProjectileOnHit(projectile, target, owner, now);
          if (
            projectile.skillId === "archer_00" &&
            projectile.onHit?.returnDamage &&
            projectile.onHit.returnDelayMs
          ) {
            projectile.returningToOwner = true;
            projectile.returnStartsAt = now + 90;
            projectile.damage = 0;
            projectile.onHit = undefined;
            projectile.targetId = undefined;
            projectile.hitTargetIds = undefined;
            projectile.distanceTraveled = 0;
            projectile.maxDistance = Math.max(
              distance(projectile, getArcherBowAnchor(owner)) + 80,
              160
            );
            retainedAtContact = true;
            break;
          }
          if (
            projectile.skillId === "archer_04" ||
            projectile.skillId === "archer_07"
          ) {
            projectile.phase = "contact";
            projectile.targetId = target.id;
            projectile.contactEndsAt =
              now + (projectile.skillId === "archer_04" ? 260 : 315);
            projectile.x = target.x;
            projectile.y = target.y - 38;
            retainedAtContact = true;
            break;
          }
          if (projectile.splitDamage) {
            const splitTarget = [...this.players.values()]
              .filter(
                (candidate) =>
                  this.areEnemies(owner, candidate) &&
                  (projectile.dimensionId ?? null) ===
                    this.getActiveDuelDimensionId(candidate, now) &&
                  candidate.id !== target.id &&
                  candidate.alive &&
                  !candidate.spawnProtected &&
                  distance(candidate, projectile) <= COMBAT.magicTurretSplitRadius
              )
              .sort((a, b) => distanceSq(projectile, a) - distanceSq(projectile, b))[0];
            if (splitTarget) {
              splitFragments.push({
                ownerId: projectile.ownerId,
                sourceTurretId: projectile.sourceTurretId,
                skillId: projectile.skillId,
                type: "magic_turret_split_fragment",
                x: projectile.x,
                y: projectile.y,
                angle: angleTo(projectile, splitTarget),
                damage: projectile.splitDamage,
                speed: COMBAT.magicTurretShotSpeed,
                maxDistance: COMBAT.magicTurretHomingDistance,
                targetId: splitTarget.id,
                ignoresTerrain: true
              });
            }
          }
          const remainingHits = projectile.remainingHits ?? 1;
          if (remainingHits > 1 && !projectile.targetId) {
            projectile.remainingHits = remainingHits - 1;
            projectile.hitTargetIds ??= new Set<string>();
            projectile.hitTargetIds.add(target.id);
            continue;
          }
          hit = true;
          break;
        }
      }

      if (retainedAtContact) {
        surviving.push(projectile);
        continue;
      }

      if (!hit && !projectile.targetId) {
        if (projectile.dimensionId) {
          surviving.push(projectile);
          continue;
        }
        for (const turret of this.turrets) {
          const projectileOwner = this.players.get(projectile.ownerId);
          const turretOwner = this.players.get(turret.ownerId);
          if (
            projectileOwner &&
            turretOwner &&
            this.areEnemies(projectileOwner, turretOwner) &&
            this.projectileHitsCircle(projectile, previous, turret, COMBAT.projectileHitRadius)
          ) {
            this.damageTurret(
              turret,
              projectile.damage,
              projectile.ownerId,
              now,
              projectile.skillId,
              projectile.damageScaling
            );
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
    for (const fragment of splitFragments) {
      this.spawnProjectile(fragment);
    }
    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  private applyProjectileOnHit(
    projectile: ProjectileEntity,
    target: PlayerEntity,
    owner: PlayerEntity,
    now: number
  ) {
    const onHit = projectile.onHit;
    if (!onHit) {
      return;
    }
    const timedMageStatusTiming =
      projectile.skillId === "mage_01" || projectile.skillId === "mage_06"
        ? getMageTimedEffectState(
            projectile.skillId,
            now,
            projectile.skillId === "mage_01"
              ? COMBAT.poisonDuration
              : onHit.slowDurationMs
          )
        : null;
    if (timedMageStatusTiming && projectile.skillId && target.alive) {
      // Poison and slow keep the authored hit-to-active timing, but their
      // persistent state is communicated by the shared overhead text only.
      // Do not emit the package-local status overlay here.
      const targetId = target.id;
      this.scheduleCatalogAction(
        owner.id,
        timedMageStatusTiming.timing.activeStartedAt,
        (executeAt) => {
          const currentTarget = this.players.get(targetId);
          if (!currentTarget?.alive) {
            return;
          }
          if (
            projectile.skillId === "mage_01" &&
            onHit.appliesPoison
          ) {
            this.applyPoison(
              owner.id,
              currentTarget,
              projectile.skillId,
              executeAt
            );
          } else if (
            projectile.skillId === "mage_06" &&
            onHit.slowDurationMs &&
            onHit.slowMultiplier
          ) {
            this.applySlow(
              currentTarget,
              onHit.slowMultiplier,
              onHit.slowDurationMs,
              executeAt
            );
          }
        }
      );
    }
    if (!timedMageStatusTiming && onHit.slowDurationMs && onHit.slowMultiplier) {
      this.applySlow(target, onHit.slowMultiplier, onHit.slowDurationMs, now);
    }
    if (onHit.rootDurationMs) {
      this.applyRoot(target, onHit.rootDurationMs, now);
    }
    if (onHit.stunDurationMs) {
      this.applyStun(target, onHit.stunDurationMs, now);
    }
    if (
      !timedMageStatusTiming &&
      onHit.appliesPoison &&
      projectile.skillId
    ) {
      this.applyPoison(
        owner.id,
        target,
        projectile.skillId,
        now
      );
    }
    if (onHit.pull) {
      this.moveTargetToward(target, owner, onHit.pull);
      if (projectile.skillId === "archer_07") {
        this.scheduleArcherHookExecution(
          owner,
          { x: target.x, y: target.y },
          now
        );
      }
    }
    if (onHit.vulnerabilityDurationMs) {
      target.vulnerabilityEndsAt = Math.max(
        target.vulnerabilityEndsAt,
        now + onHit.vulnerabilityDurationMs
      );
    }
    if (onHit.dashLockDurationMs) {
      if (!this.hasEngineerSupportControlImmunity(target, now)) {
        target.dashLockEndsAt = Math.max(
          target.dashLockEndsAt,
          now + onHit.dashLockDurationMs
        );
      }
    }
    if (
      onHit.returnDamage &&
      onHit.returnDelayMs &&
      projectile.skillId
    ) {
      const targetId = target.id;
      const skillId = projectile.skillId;
      this.scheduleCatalogAction(
        owner.id,
        now + onHit.returnDelayMs,
        (executeAt) => {
          const currentOwner = this.players.get(owner.id);
          const currentTarget = this.players.get(targetId);
          if (
            !currentOwner?.alive ||
            !currentTarget?.alive ||
            !this.areEnemies(currentOwner, currentTarget) ||
            !this.sharesCombatDimension(
              currentOwner,
              currentTarget,
              executeAt
            )
          ) {
            return;
          }
          this.damagePlayer(
            currentTarget,
            onHit.returnDamage!,
            currentOwner.id,
            skillId
          );
          this.addCatalogEffect(
            skillId,
            currentOwner,
            currentTarget,
            84,
            420,
            executeAt,
            currentTarget
          );
        }
      );
    }
  }

  private scheduleArcherHookExecution(
    owner: PlayerEntity,
    executionPoint: { x: number; y: number },
    now: number
  ) {
    const skillId = "archer_14" as const;
    const slot = "skillR" as const;
    if (
      owner.classId !== "archer" ||
      owner.catalogLoadout[slot] !== skillId
    ) {
      return;
    }
    const executeAt = Math.max(now + 315, owner.actionPoseEndsAt + 1);
    this.scheduleCatalogAction(owner.id, executeAt, (triggeredAt) => {
      const currentOwner = this.players.get(owner.id);
      const spec = getArenaSkillSpec(skillId);
      if (
        !currentOwner?.alive ||
        currentOwner.catalogLoadout[slot] !== skillId ||
        !spec ||
        !this.canUse(currentOwner, slot, triggeredAt) ||
        currentOwner.stunEndsAt > triggeredAt ||
        (currentOwner.silenceStartsAt <= triggeredAt &&
          currentOwner.silenceEndsAt > triggeredAt) ||
        !this.useArcherHawkExecutionAt(
          currentOwner,
          executionPoint,
          triggeredAt
        )
      ) {
        return;
      }
      currentOwner.actionSkillId = skillId;
      this.releaseSpawnGuardForAction(currentOwner, triggeredAt);
      this.startCooldown(currentOwner, slot, triggeredAt, spec.cooldownMs);
      this.setActionPose(
        currentOwner,
        triggeredAt,
        920,
        slot,
        skillId
      );
      const catalogSkill = getArenaCatalogSkill(skillId);
      this.pushEvent(
        "ultimate",
        `${currentOwner.name} cast ${catalogSkill?.name ?? skillId}`,
        currentOwner,
        undefined,
        triggeredAt
      );
    });
  }

  private projectileHitsPlayer(projectile: ProjectileEntity, previous: { x: number; y: number }, target: PlayerEntity) {
    const hurtbox = this.getPlayerProjectileHurtbox(target);
    const hitRadius = PLAYER_PROJECTILE_HURTBOX.radius;
    return this.distanceSqBetweenSegments(previous, projectile, hurtbox.top, hurtbox.bottom) <= hitRadius * hitRadius;
  }

  private getPlayerProjectileHurtbox(player: PlayerEntity) {
    return {
      top: { x: player.x, y: player.y + PLAYER_PROJECTILE_HURTBOX.topOffset },
      bottom: { x: player.x, y: player.y + PLAYER_PROJECTILE_HURTBOX.bottomOffset }
    };
  }

  private projectileHitsCircle(projectile: ProjectileEntity, previous: { x: number; y: number }, target: { x: number; y: number }, radius: number) {
    return this.distanceSqPointToSegment(target, previous, projectile) <= radius * radius;
  }

  private distanceSqBetweenSegments(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
    if (this.segmentsIntersect(a, b, c, d)) {
      return 0;
    }
    return Math.min(
      this.distanceSqPointToSegment(a, c, d),
      this.distanceSqPointToSegment(b, c, d),
      this.distanceSqPointToSegment(c, a, b),
      this.distanceSqPointToSegment(d, a, b)
    );
  }

  private distanceSqPointToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.0001) {
      return distanceSq(point, start);
    }

    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
    const closest = {
      x: start.x + dx * t,
      y: start.y + dy * t
    };
    return distanceSq(point, closest);
  }

  private segmentsIntersect(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
    const abC = this.cross(a, b, c);
    const abD = this.cross(a, b, d);
    const cdA = this.cross(c, d, a);
    const cdB = this.cross(c, d, b);

    if (abC === 0 && this.pointOnSegment(c, a, b)) return true;
    if (abD === 0 && this.pointOnSegment(d, a, b)) return true;
    if (cdA === 0 && this.pointOnSegment(a, c, d)) return true;
    if (cdB === 0 && this.pointOnSegment(b, c, d)) return true;

    return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
  }

  private pointOnSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
    return (
      point.x >= Math.min(start.x, end.x) &&
      point.x <= Math.max(start.x, end.x) &&
      point.y >= Math.min(start.y, end.y) &&
      point.y <= Math.max(start.y, end.y)
    );
  }

  private cross(origin: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    const value = (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
    return Math.abs(value) < 0.0001 ? 0 : value;
  }

  private updateTurrets(now: number) {
    for (const turret of this.turrets) {
      if (turret.shield > 0 && turret.shieldEndsAt <= now) {
        turret.shield = 0;
        turret.shieldEndsAt = 0;
      }

      const attackInterval =
        turret.kind === "mechanical"
          ? COMBAT.mechanicalTurretAttackInterval
          : COMBAT.magicTurretAttackInterval;
      if (now - turret.lastAttackAt < attackInterval) {
        continue;
      }

      const owner = this.players.get(turret.ownerId);
      const markedMechanicalTarget =
        turret.kind === "mechanical" &&
        turret.markedTargetId &&
        turret.markedEndsAt > now
          ? this.players.get(turret.markedTargetId)
          : null;
      const markedMagicTarget =
        turret.kind === "magic_missile" &&
        owner?.magicMarkTargetId &&
        owner.magicMarkEndsAt > now
          ? this.players.get(owner.magicMarkTargetId)
          : null;
      const target =
        turret.kind === "mechanical"
          ? markedMechanicalTarget?.alive &&
            !this.getActiveDuelDimensionId(markedMechanicalTarget, now) &&
            distance(markedMechanicalTarget, turret) <= COMBAT.mechanicalTurretRange
            ? markedMechanicalTarget
            : this.getNearestMechanicalTurretTarget(turret)
          : markedMagicTarget?.alive &&
              !this.getActiveDuelDimensionId(markedMagicTarget, now) &&
              distance(markedMagicTarget, turret) <= COMBAT.magicTurretRange
            ? markedMagicTarget
            : this.getNearestMagicTurretTarget(turret);
      if (!target) {
        continue;
      }

      turret.lastAttackAt = now;
      if (turret.kind === "mechanical") {
        if (turret.armorCoreEndsAt > now) {
          this.fireMechanicalTurretShot(
            turret,
            target,
            30,
            "engineer_03",
            { vulnerabilityDurationMs: 3000 }
          );
          turret.armorCoreEndsAt = 0;
        } else if (turret.enhancedShots > 0) {
          this.fireMechanicalTurretShot(turret, target, 18, "engineer_01");
          turret.enhancedShots -= 1;
        } else {
          this.fireMechanicalTurretShot(turret, target);
        }
      } else {
        turret.angle = 0;
        const usesMagicLock =
          owner?.magicMarkTargetId === target.id && owner.magicMarkEndsAt > now;
        const markedDamage = usesMagicLock
          ? COMBAT.magicTurretMarkedBasicDamage
          : COMBAT.magicTurretBasicDamage;
        this.fireMagicTurretMissile(
          turret,
          target,
          "magic_turret_basic",
          markedDamage,
          undefined,
          usesMagicLock ? "engineer_13" : undefined
        );
      }
    }

    this.turrets = this.turrets.filter((turret) => turret.health > 0);
  }

  private damageTurret(
    turret: TurretEntity,
    rawDamage: number,
    attackerId: string,
    now: number,
    sourceSkillId?: ArenaCatalogSkillId,
    damageScaling: "class" | "preset" = "class"
  ) {
    if (turret.health <= 0) {
      return;
    }
    const attacker = this.players.get(attackerId);
    const owner = this.players.get(turret.ownerId);
    if (
      attacker &&
      (this.getActiveDuelDimensionId(attacker, now) ||
        (owner && !this.areEnemies(attacker, owner)))
    ) {
      return;
    }
    if (turret.shield > 0 && turret.shieldEndsAt <= now) {
      turret.shield = 0;
      turret.shieldEndsAt = 0;
    }
    const outgoingDamage = this.getBoostedOutgoingDamage(
      rawDamage,
      attackerId,
      now,
      damageScaling,
      sourceSkillId
    );
    const reducedDamage =
      turret.supportEndsAt > now
        ? outgoingDamage * ENGINEER_SUPPORT_TURRET_DAMAGE_MULTIPLIER
        : outgoingDamage;
    const absorbed = Math.min(turret.shield, reducedDamage);
    turret.shield -= absorbed;
    turret.health -= reducedDamage - absorbed;
    if (turret.health <= 0) {
      this.destroyTurret(turret, attackerId, now);
      this.scheduledMagicMissiles = this.scheduledMagicMissiles.filter((missile) => missile.turretId !== turret.id);
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

  private damagePlayer(
    target: PlayerEntity,
    rawDamage: number,
    attackerId: string,
    sourceSkillId?: ArenaCatalogSkillId,
    damageScaling: "class" | "preset" = "class"
  ) {
    const now = Date.now();
    if (!target.alive) {
      return 0;
    }
    if (
      (this.invulnerableHumans && !target.bot) ||
      (this.invulnerableBots && target.bot)
    ) {
      return 0;
    }
    const attacker = this.players.get(attackerId);
    if (
      attacker &&
      (!this.areEnemies(attacker, target) ||
        !this.sharesCombatDimension(attacker, target, now))
    ) {
      return 0;
    }
    if (target.dodgeEndsAt > now) {
      this.addEffect("blocked_hit", target, 42, 360);
      return 0;
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
      return 0;
    }

    let damage = this.getBoostedOutgoingDamage(
      rawDamage,
      attackerId,
      now,
      damageScaling,
      sourceSkillId
    );
    if (target.vulnerabilityEndsAt > now) {
      damage = roundDamage(damage * 1.15);
    }
    if (
      target.sunlightBrandStartsAt <= now &&
      target.sunlightBrandEndsAt > now
    ) {
      damage = roundDamage(
        damage * COMBAT.mageSunlightBrandDamageMultiplier
      );
    }
    if (
      attacker &&
      target.hunterMarkEndsAt > now &&
      target.hunterMarkOwnerId === attacker.id
    ) {
      damage += 12;
      target.hunterMarkEndsAt = 0;
      target.hunterMarkOwnerId = null;
    }
    if (target.counterStanceEndsAt > now) {
      damage = roundDamage(damage * 0.3);
      if (attacker?.alive && !target.counterTriggered) {
        target.counterTriggered = true;
        const reflectedDamage = 30;
        this.recordDamageCredit(attacker, target.id, now);
        attacker.health -= reflectedDamage;
        this.addReflectEffects(target, attacker, reflectedDamage, now);
        if (attacker.health <= 0) {
          this.killPlayer(attacker, target.id, now);
        }
      }
    } else if (target.shielded) {
      damage = roundDamage(damage * 0.5);
    }
    if (target.engineerSupportEndsAt > now) {
      damage = roundDamage(
        damage * ENGINEER_SUPPORT_PLAYER_DAMAGE_MULTIPLIER
      );
    }

    const actualDamage = Math.min(target.health, damage);
    this.recordDamageCredit(target, attackerId, now);
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "damage_number",
      ownerId: attackerId,
      classId: this.players.get(attackerId)?.classId,
      x: target.x,
      y: target.y - 54,
      angle: randomBetween(-12, 12),
      radius: target.shielded || target.counterStanceEndsAt > now ? 44 : 58,
      startedAt: now,
      duration: 760,
      value: actualDamage,
      targetId: target.id,
      skillId: sourceSkillId
    });

    target.health -= actualDamage;
    if (target.health <= 0) {
      this.killPlayer(target, attackerId, now);
    }
    return actualDamage;
  }

  private healPlayer(target: PlayerEntity, requestedHeal: number) {
    if (!target.alive || requestedHeal <= 0 || target.health >= target.maxHealth) {
      return 0;
    }
    const healed = Math.min(target.maxHealth - target.health, requestedHeal);
    target.health = Number((target.health + healed).toFixed(2));
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type: "heal_number",
      ownerId: target.id,
      classId: target.classId,
      x: target.x,
      y: target.y - 72,
      angle: randomBetween(-8, 8),
      radius: 50,
      startedAt: Date.now(),
      duration: 900,
      value: Number(healed.toFixed(2))
    });
    return healed;
  }

  private getBoostedOutgoingDamage(
    rawDamage: number,
    attackerId: string,
    now: number,
    damageScaling: "class" | "preset" = "class",
    sourceSkillId?: ArenaCatalogSkillId
  ) {
    const attacker = this.players.get(attackerId);
    if (!attacker || !attacker.alive) {
      return rawDamage;
    }
    const attackBoostMultiplier =
      attacker.attackBoostEndsAt > now ? attacker.damageBoostMultiplier : 1;
    const blazingRampageMultiplier =
      attacker.blazingRampageDamageBoostEndsAt > now
        ? BLAZING_RAMPAGE.damageMultiplier
        : 1;
    return roundDamage(
      rawDamage *
        (damageScaling === "preset"
          ? 1
          : sourceSkillId
            ? getArenaSkillDamageMultiplier(sourceSkillId)
            : CLASS_DAMAGE_MULTIPLIERS[attacker.classId]) *
        Math.max(attackBoostMultiplier, blazingRampageMultiplier)
    );
  }

  private areEnemies(left: PlayerEntity, right: PlayerEntity) {
    if (left.id === right.id) {
      return false;
    }
    if (this.mode === "free_for_all") {
      return true;
    }
    return Boolean(left.team && right.team && left.team !== right.team);
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
    this.endDuelForPlayer(target.id);
    target.alive = false;
    target.health = 0;
    target.killStreak = 0;
    target.respawnAt = now + WORLD.respawnMs;
    target.input = { ...EMPTY_INPUT };
    this.resetArcherCharge(target);
    target.actionPoseEndsAt = 0;
    target.action = null;
    target.actionSkillId = null;
    target.actionStartedAt = 0;
    target.actionEndsAt = 0;
    target.attacking = false;
    target.attackBoosted = false;
    target.attackBoostEndsAt = 0;
    target.focusLensStartsAt = 0;
    target.focusLensEndsAt = 0;
    target.concealmentEndsAt = 0;
    target.engineerSupportEndsAt = 0;
    target.damageBoostMultiplier = 1;
    target.enchantedMeleeHitsRemaining = 0;
    target.enchantedMeleeEndsAt = 0;
    target.moveSpeedBoostEndsAt = 0;
    target.blazingRampageDamageBoostEndsAt = 0;
    target.poisoned = false;
    target.slowed = false;
    target.slowMultiplier = 1;
    target.poisonEndsAt = 0;
    target.slowEndsAt = 0;
    this.removeCatalogEffects(target.id, "warrior_01");
    this.damageOverTime = this.damageOverTime.filter(
      (effect) => effect.targetId !== target.id
    );
    this.projectiles = this.projectiles.filter((projectile) => projectile.targetId !== target.id);
    this.scheduledMagicMissiles = this.scheduledMagicMissiles.filter((missile) => missile.targetId !== target.id);
    this.removeSoulChainsForPlayer(target.id);
    this.addEffect("death", target, 120, 900);

    const attacker = this.players.get(attackerId);
    if (attacker && attacker.id !== target.id) {
      attacker.score += 1;
      if (this.mode === "team_3v3" && attacker.team) {
        this.teamScores[attacker.team] += 1;
      }
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
      const spawn =
        this.mode === "team_3v3" && player.team
          ? this.teamSpawnPoint(player.team, this.botIndex(player.id))
          : this.randomArenaSpawnPoint(player.id);
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
      player.actionSkillId = null;
      player.actionStartedAt = 0;
      player.actionEndsAt = 0;
      player.attacking = false;
      player.shieldEndsAt = 0;
      player.attackBoosted = false;
      player.attackBoostEndsAt = 0;
      player.concealmentEndsAt = 0;
      player.damageBoostMultiplier = 1;
      player.engineerSupportEndsAt = 0;
      player.enchantedMeleeHitsRemaining = 0;
      player.enchantedMeleeEndsAt = 0;
      player.moveSpeedBoostEndsAt = 0;
      player.blazingRampageDamageBoostEndsAt = 0;
      player.spawnGuardEndsAt = now + SPAWN_GUARD_MS;
      player.rootEndsAt = 0;
      player.stunEndsAt = 0;
      player.poisonEndsAt = 0;
      player.slowEndsAt = 0;
      player.poisoned = false;
      player.slowed = false;
      player.slowMultiplier = 1;
      player.damageCredits.clear();
      this.addEffect("shield", player, 96, 900);
    }
  }

  private checkHealthPackPickup(now: number) {
    const picked = new Set<string>();
    for (const player of this.players.values()) {
      if (!player.alive || this.getActiveDuelDimensionId(player, now)) {
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

  private checkAttackBoostPackPickup(now: number) {
    const picked = new Set<string>();
    for (const player of this.players.values()) {
      if (!player.alive || this.getActiveDuelDimensionId(player, now)) {
        continue;
      }
      for (const pack of this.attackBoostPacks) {
        if (distance(player, pack) <= WORLD.attackBoostPackRadius) {
          player.attackBoostEndsAt = now + WORLD.attackBoostDurationMs;
          player.damageBoostMultiplier = WORLD.attackBoostMultiplier;
          player.attackBoosted = true;
          picked.add(pack.id);
          this.effects.push({
            id: `fx_${this.nextEffectId++}`,
            type: "attack_boost",
            ownerId: player.id,
            classId: player.classId,
            x: player.x,
            y: player.y - 70,
            angle: 0,
            radius: 72,
            startedAt: now,
            duration: 1300,
            value: Math.round((WORLD.attackBoostMultiplier - 1) * 100)
          });
          this.pushEvent("boost", `${player.name} increased attack power`, player, undefined, now);
        }
      }
    }

    if (!picked.size) {
      return;
    }

    this.attackBoostPacks = this.attackBoostPacks.filter((pack) => !picked.has(pack.id));
    while (this.attackBoostPacks.length < WORLD.attackBoostPackCount) {
      this.attackBoostPacks.push(this.createAttackBoostPack());
    }
  }

  private spawnInitialHealthPacks() {
    while (this.healthPacks.length < WORLD.healthPackCount) {
      this.healthPacks.push(this.createHealthPack());
    }
  }

  private spawnInitialAttackBoostPacks() {
    while (this.attackBoostPacks.length < WORLD.attackBoostPackCount) {
      this.attackBoostPacks.push(this.createAttackBoostPack());
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

  private createAttackBoostPack(): AttackBoostPackState {
    const position = this.randomSpawnPoint(220);
    return {
      id: `atk_${this.nextAttackBoostPackId++}`,
      x: position.x,
      y: position.y
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
    value?: number,
    metadata?: Pick<EffectState, "skillId" | "turretKind">
  ) {
    const startedAt = Date.now();
    this.effects.push({
      id: `fx_${this.nextEffectId++}`,
      type,
      ownerId: owner.id,
      classId: owner.classId,
      x: origin.x,
      y: origin.y,
      angle,
      radius,
      startedAt,
      duration,
      value,
      ...metadata,
      dimensionId:
        this.getActiveDuelDimensionId(owner, startedAt) ?? undefined
    });
  }

  private setActionPose(
    player: PlayerEntity,
    now: number,
    durationMs: number,
    action: PlayerActionState,
    actionSkillId: ArenaCatalogSkillId | null = null
  ) {
    const nextEndsAt = now + durationMs;
    if (!player.action || nextEndsAt >= player.actionPoseEndsAt) {
      player.action = action;
      player.actionSkillId = actionSkillId;
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

  private humanSpawnPoint(playerId?: string, team?: ArenaTeamId | null) {
    if (this.fixedSpawnEnabled) {
      return this.fixedReviewSpawnPoint();
    }
    if (this.mode === "team_3v3" && team) {
      return this.teamSpawnPoint(team, this.players.size);
    }
    return this.randomArenaSpawnPoint(playerId);
  }

  private teamSpawnPoint(team: ArenaTeamId, index: number) {
    const centerY = WORLD.height / 2;
    const baseX = team === "red" ? WORLD.width * 0.28 : WORLD.width * 0.72;
    const laneOffset = ((Math.max(0, index) % 3) - 1) * 240;
    const point = {
      x: baseX + (team === "red" ? -1 : 1) * ((Math.floor(Math.max(0, index) / 3) % 2) * 120),
      y: centerY + laneOffset
    };
    return this.resolveMapCollision(point, COMBAT.playerRadius + 20);
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
    if (this.fixedBotSpawnPoint) {
      const offsets = [
        { x: 0, y: 0 },
        { x: 96, y: 72 },
        { x: 96, y: -72 },
        { x: 0, y: 144 },
        { x: 0, y: -144 },
        { x: 192, y: 72 },
        { x: 192, y: -72 },
        { x: 192, y: 0 }
      ] as const;
      const offset = offsets[index % offsets.length];
      return this.resolveMapCollision(
        {
          x: this.fixedBotSpawnPoint.x + offset.x,
          y: this.fixedBotSpawnPoint.y + offset.y
        },
        COMBAT.playerRadius + 12
      );
    }
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

  private getPlayerStatuses(player: PlayerEntity, now: number): ArenaStatusState[] {
    const statuses: ArenaStatusState[] = [];
    const add = (
      id: ArenaStatusState["id"],
      endsAt: number | null,
      stacks?: number
    ) => {
      if (endsAt !== null && endsAt <= now) {
        return;
      }
      statuses.push({ id, endsAt, ...(stacks === undefined ? {} : { stacks }) });
    };

    add("stunned", player.stunEndsAt);
    if (player.silenceStartsAt <= now) {
      add("silenced", player.silenceEndsAt);
    }
    add("rooted", player.rootEndsAt);

    const soulChainEndsAt = this.soulChains.reduce(
      (latest, chain) =>
        chain.targetId === player.id && chain.startsAt <= now
          ? Math.max(latest, chain.endsAt)
          : latest,
      0
    );
    add("dash_locked", Math.max(player.dashLockEndsAt, soulChainEndsAt));

    const vulnerabilityEndsAt = Math.max(
      player.vulnerabilityEndsAt,
      player.sunlightBrandStartsAt <= now ? player.sunlightBrandEndsAt : 0
    );
    add("vulnerable", vulnerabilityEndsAt);

    let markedEndsAt = player.hunterMarkEndsAt;
    for (const owner of this.players.values()) {
      if (owner.magicMarkTargetId === player.id) {
        markedEndsAt = Math.max(markedEndsAt, owner.magicMarkEndsAt);
      }
    }
    for (const turret of this.turrets) {
      if (turret.markedTargetId === player.id) {
        markedEndsAt = Math.max(markedEndsAt, turret.markedEndsAt);
      }
    }
    add("marked", markedEndsAt);
    add("poisoned", player.poisonEndsAt);
    add("slowed", player.slowEndsAt);
    if (player.duelPartnerId) {
      add("duel", player.duelEndsAt);
    }

    add("counter", player.counterStanceEndsAt);
    add("engineer_support", player.engineerSupportEndsAt);
    add("dodging", player.dodgeEndsAt);
    add("concealed", player.concealmentEndsAt);
    if (player.enchantedMeleeHitsRemaining > 0) {
      add(
        "enchanted_attacks",
        player.enchantedMeleeEndsAt,
        player.enchantedMeleeHitsRemaining
      );
    }
    if (player.steadyAimReady) {
      add("steady_aim", null);
    }
    if (player.focusLensStartsAt <= now) {
      add("focus_lens", player.focusLensEndsAt);
    }
    add(
      "attack_boost",
      Math.max(
        player.attackBoostEndsAt,
        player.blazingRampageDamageBoostEndsAt
      )
    );
    add("speed_boost", player.moveSpeedBoostEndsAt);

    return statuses;
  }

  private toPublicPlayer(player: PlayerEntity, now = Date.now()): PublicPlayer {
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
      actionSkillId: player.attacking ? player.actionSkillId : null,
      actionStartedAt: player.attacking ? player.actionStartedAt : 0,
      actionEndsAt: player.attacking ? player.actionEndsAt : 0,
      shielded: player.shielded,
      attackBoosted: player.attackBoosted,
      attackBoostEndsAt: Math.max(
        player.attackBoostEndsAt,
        player.blazingRampageDamageBoostEndsAt
      ),
      enchantedMeleeHitsRemaining: player.enchantedMeleeHitsRemaining,
      enchantedMeleeEndsAt: player.enchantedMeleeEndsAt,
      focusLensEndsAt: player.focusLensEndsAt,
      concealmentEndsAt: player.concealmentEndsAt,
      spawnProtected: player.spawnProtected,
      rooted: player.rooted,
      stunned: player.stunned,
      poisoned: player.poisoned,
      slowed: player.slowed,
      slowMultiplier: player.slowMultiplier,
      sprinting: player.sprinting,
      bot: player.bot,
      team: player.team,
      engineerTurretKind: player.engineerTurretKind,
      loadout: player.loadout,
      catalogLoadout: player.catalogLoadout,
      cooldowns: player.cooldowns,
      statuses: this.getPlayerStatuses(player, now)
    };
  }

  private isConcealedFromViewer(
    player: PlayerEntity,
    viewerId: string | null,
    now: number
  ) {
    return player.id !== viewerId && player.concealmentEndsAt > now;
  }
}

function pointToSegmentDistance(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) {
    return distance(point, start);
  }
  const ratio = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq,
    0,
    1
  );
  return distance(point, {
    x: start.x + dx * ratio,
    y: start.y + dy * ratio
  });
}

function segmentsIntersect(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number }
) {
  const cross = (
    origin: { x: number; y: number },
    left: { x: number; y: number },
    right: { x: number; y: number }
  ) =>
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x);
  const firstA = cross(firstStart, firstEnd, secondStart);
  const firstB = cross(firstStart, firstEnd, secondEnd);
  const secondA = cross(secondStart, secondEnd, firstStart);
  const secondB = cross(secondStart, secondEnd, firstEnd);
  return (
    ((firstA <= 0 && firstB >= 0) || (firstA >= 0 && firstB <= 0)) &&
    ((secondA <= 0 && secondB >= 0) || (secondA >= 0 && secondB <= 0))
  );
}

function segmentsWithinDistance(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
  radius: number
) {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return true;
  }
  return (
    pointToSegmentDistance(firstStart, secondStart, secondEnd) <= radius ||
    pointToSegmentDistance(firstEnd, secondStart, secondEnd) <= radius ||
    pointToSegmentDistance(secondStart, firstStart, firstEnd) <= radius ||
    pointToSegmentDistance(secondEnd, firstStart, firstEnd) <= radius
  );
}

function rotateAngleToward(
  current: number,
  target: number,
  maximumStep: number
) {
  const delta = ((target - current + 540) % 360) - 180;
  if (Math.abs(delta) <= maximumStep) {
    return target;
  }
  return current + Math.sign(delta) * maximumStep;
}

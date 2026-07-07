import Phaser from "phaser";
import {
  CLASS_META,
  COMBAT,
  WORLD,
  project,
  type ClassId,
  type CombatEvent,
  type EffectState,
  type GameSnapshot,
  type HealthPackState,
  type JoinRequest,
  type PlayerInput,
  type ProjectileState,
  type ProjectileType,
  type PublicPlayer,
  type TurretState
} from "@renaiss-game/shared";
import { copyTexture, makeMatteTransparent } from "../assets/chromaKey";
import {
  ARENA_DECAL_TEXTURES,
  COMBAT_VFX_FRAME_COUNT,
  getArcherAttackFrameTexture,
  getAbilityVfxFrameTexture,
  getClassFrameTexture,
  getCombatVfxFrameTexture,
  getCombatObjectTexture,
  getEngineerActionFrameTexture,
  getMageAttackFrameTexture,
  getRpgSkillProjectileFrameTexture,
  getStatusAuraFrameTexture,
  getWarriorArcherVfxFrameTexture,
  getWarriorAttackFrameTexture,
  getWarriorVerticalSlashFrameTexture,
  RPG_SKILL_PROJECTILE_FRAME_COUNT,
  STATUS_AURA_FRAME_COUNT,
  type CombatVfxKey,
  type StatusAuraKey,
  type WarriorAttackDirection
} from "../assets/crops";
import {
  getEffectVfxSpec,
  getRenderedVfxBlendMode,
  getRenderedVfxDepth,
  getRenderedVfxDisplay,
  getRenderedVfxFrame,
  getRenderedVfxOrigin,
  getRenderedVfxTexture,
  shouldRotateVfx
} from "../assets/vfxManifest";
import { GameSocket } from "../network/GameSocket";
import { AmbientField } from "../render/ambientField";
import { TargetingOverlay, type TargetingIntent } from "../render/targetingOverlay";
import { getMageActionFxProfile, shouldShowMageActionFx } from "../render/mageActionFx";
import { getWarriorActionFxProfile, shouldShowWarriorActionFx } from "../render/warriorActionFx";
import { renderVillageMap } from "../render/villageMap";
import { useHudStore } from "../../state/hudStore";
import { buildRuntimeTextures } from "../assets/runtimeTextures";
import { getHealthPackVariant } from "../assets/healthPackVariants";
import { generatedAssetPath } from "../assets/generatedAssets";
import { shouldLoadStaticAssetsWithCors } from "../assets/staticAssets";

interface PlayerView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  koRune: Phaser.GameObjects.Image;
  statusAura: Phaser.GameObjects.Image;
  actionGhost: Phaser.GameObjects.Image;
  actionFxBack: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Image;
  actionFxFront: Phaser.GameObjects.Image;
  hitImpact: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  healthBack: Phaser.GameObjects.Rectangle;
  healthFill: Phaser.GameObjects.Rectangle;
  staminaBack: Phaser.GameObjects.Rectangle;
  staminaFill: Phaser.GameObjects.Rectangle;
  lastX: number;
  lastY: number;
  visualX: number;
  visualY: number;
  lastMoveAngle: number;
  lastMovingAt: number;
  lastTrailAt: number;
  lastHealth: number;
  lastAlive: boolean;
  downedAt: number;
  hitFlashUntil: number;
  hitImpactStartedAt: number;
  hitImpactUntil: number;
}

interface MovementTrailView {
  image: Phaser.GameObjects.Image;
  createdAt: number;
  duration: number;
  baseAlpha: number;
  baseWidth: number;
  baseHeight: number;
}

interface ProjectileView {
  trail: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Image;
  visualX: number;
  visualY: number;
  createdAt: number;
}

interface TurretView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  anchor: Phaser.GameObjects.Ellipse;
  base: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  muzzleFlash: Phaser.GameObjects.Image;
  health: Phaser.GameObjects.Rectangle;
  visualX: number;
  visualY: number;
  visualAngle: number;
}

interface PackView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Ellipse;
  logo: Phaser.GameObjects.Image;
  sparkle: Phaser.GameObjects.Image;
  visualX: number;
  visualY: number;
}

interface FloatingTextView {
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Rectangle;
  accent: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface VfxView {
  image: Phaser.GameObjects.Image;
  rangeCircle?: Phaser.GameObjects.Graphics;
}

interface CameraImpact {
  duration: number;
  intensity: number;
  flash: readonly [number, number, number];
  flashAlpha: number;
  cooldown: number;
}

interface PlayerRenderFrame {
  texture: string;
  flipX: boolean;
}

interface PlayerActionMotion {
  kick: number;
  lift: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  shadowScaleX: number;
  shadowScaleY: number;
}

const SEND_RATE_MS = 1000 / 30;
const MOVEMENT_TRAIL_DURATION_MS = 420;
const MOVEMENT_TRAIL_INTERVAL_MS = 86;
const MOVEMENT_TRAIL_SPRINT_INTERVAL_MS = 58;
const MAX_MOVEMENT_TRAILS = 72;
const MOVEMENT_VISUAL_GRACE_MS = 92;
const PLAYER_INTERPOLATION = 0.34;
const PLAYER_GROUND_Y = 15;
const PLAYER_SPRITE_ORIGIN_Y = 0.9;
const PLAYER_BODY_BASE_Y = 13;
const PLAYER_SPAWN_AURA_SIZE = { width: 62, height: 18, alpha: 0.055 };
const FAST_ENTITY_INTERPOLATION = 0.46;
const SLOW_ENTITY_INTERPOLATION = 0.3;
const PLAYER_SNAP_DISTANCE = 210;
const FAST_ENTITY_SNAP_DISTANCE = 320;
const SLOW_ENTITY_SNAP_DISTANCE = 180;
const TURRET_SHADOW_Y = 29;
const TURRET_ANCHOR_Y = 27;
const TURRET_BASE_Y = 31;
const TURRET_HEAD_Y = -2;
const TURRET_BASE_WIDTH = 96;
const TURRET_BASE_HEIGHT = 64;
const TURRET_HEAD_WIDTH = 92;
const TURRET_HEAD_HEIGHT = 61;
const TURRET_HEALTH_Y = -47;
const TURRET_HEALTH_WIDTH = 38;
const TURRET_MUZZLE_NORMAL_DISTANCE = 42;
const TURRET_MUZZLE_BOOSTED_DISTANCE = 46;

export class VillageArenaScene extends Phaser.Scene {
  private socket: GameSocket | null = null;
  private snapshot: GameSnapshot | null = null;
  private playerViews = new Map<string, PlayerView>();
  private projectileViews = new Map<string, ProjectileView>();
  private turretViews = new Map<string, TurretView>();
  private packViews = new Map<string, PackView>();
  private movementTrails: MovementTrailView[] = [];
  private floatingTextViews = new Map<string, FloatingTextView>();
  private vfxViews = new Map<string, VfxView>();
  private ambientField: AmbientField | null = null;
  private targetingOverlay: TargetingOverlay | null = null;
  private worldOverlay!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastSentAt = 0;
  private unsubscribeJoin?: () => void;
  private lastHudSync = 0;
  private lastArenaAimPoint: { x: number; y: number } | null = null;
  private pointerOverArenaCanvas = false;
  private combatFeedbackInitialized = false;
  private seenCombatEventIds = new Set<string>();
  private lastSelfHealth: number | null = null;
  private lastSelfAlive: boolean | null = null;
  private nextCameraImpactAt = 0;
  private screenFlash: Phaser.GameObjects.Rectangle | null = null;
  private screenFlashTween: Phaser.Tweens.Tween | null = null;
  private readonly updatePointerArenaTarget = (event: PointerEvent) => {
    this.pointerOverArenaCanvas = document.elementFromPoint(event.clientX, event.clientY) === this.game.canvas;
  };

  constructor() {
    super("VillageArenaScene");
  }

  preload() {
    if (shouldLoadStaticAssetsWithCors()) this.load.setCORS("anonymous");
    this.load.image("gameConcept", generatedAssetPath("game-concept"));
    this.load.image("classSprites", generatedAssetPath("class-sprites"));
    this.load.image("villageAssets", generatedAssetPath("village-assets"));
    this.load.image("skillEffects", generatedAssetPath("skill-effects"));
    this.load.image("combatObjects", generatedAssetPath("combat-objects"));
    this.load.image("healthLogo", generatedAssetPath("vinci-favicon"));
    this.load.image("statusEffects", generatedAssetPath("status-effects"));
    this.load.image("abilityEffects", generatedAssetPath("ability-effects"));
    this.load.image("warriorVerticalSlash", generatedAssetPath("warrior-vertical-slash"));
    this.load.image("warriorArcherEffects", generatedAssetPath("warrior-archer-effects"));
    this.load.image("warriorVerdictCombatFx", generatedAssetPath("combat-fx-warrior-verdict"));
    this.load.image("engineerEffects", generatedAssetPath("engineer-effects"));
    this.load.image("mageEffects", generatedAssetPath("mage-effects"));
    this.load.image("combatEffects", generatedAssetPath("combat-effects"));
    this.load.image("rpgSkillProjectiles", generatedAssetPath("rpg-skill-projectiles"));
    this.load.image("arenaDecals", generatedAssetPath("arena-decals"));
    this.load.image("warriorAttackSprites", generatedAssetPath("warrior-attack-sprites"));
    this.load.image("archerAttackSprites", generatedAssetPath("archer-attack-sprites"));
    this.load.image("engineerActionSprites", generatedAssetPath("engineer-action-sprites"));
    this.load.image("mageAttackSprites", generatedAssetPath("mage-attack-sprites"));
  }

  create() {
    copyTexture(this, "classSprites", "classSpritesClean");
    makeMatteTransparent(this, "villageAssets", "villageAssetsClean", "magenta");
    makeMatteTransparent(this, "skillEffects", "skillEffectsClean", "edgeBlack");
    makeMatteTransparent(this, "combatObjects", "combatObjectsClean", "edgeBlack");
    buildRuntimeTextures(this);

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setZoom(0.82);
    this.cameras.main.roundPixels = true;
    this.cameras.main.centerOn(WORLD.width / 2 + 150, WORLD.height / 2 - 80);

    renderVillageMap(this);
    this.addWorldFrame();
    this.ambientField = new AmbientField(this);
    this.targetingOverlay = new TargetingOverlay(this);

    this.worldOverlay = this.add.graphics().setDepth(6000);
    this.screenFlash = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(9500)
      .setVisible(false);

    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E,R,SPACE,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    window.addEventListener("pointermove", this.updatePointerArenaTarget, true);
    window.addEventListener("pointerdown", this.updatePointerArenaTarget, true);

    this.unsubscribeJoin = useHudStore.subscribe((state, previous) => {
      if (state.joinRequest && state.joinRequest !== previous.joinRequest) {
        void this.joinArena(state.joinRequest);
      }
      if (state.classSwitchRequest && state.classSwitchRequest !== previous.classSwitchRequest) {
        this.socket?.switchClass(state.classSwitchRequest.classId);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("pointermove", this.updatePointerArenaTarget, true);
      window.removeEventListener("pointerdown", this.updatePointerArenaTarget, true);
      this.unsubscribeJoin?.();
      this.socket?.disconnect();
      this.movementTrails.forEach((trail) => trail.image.destroy());
      this.movementTrails = [];
      this.ambientField?.destroy();
      this.ambientField = null;
      this.targetingOverlay?.destroy();
      this.targetingOverlay = null;
      this.screenFlashTween?.stop();
      this.screenFlashTween = null;
      this.screenFlash = null;
    });
  }

  override update(_time: number, delta: number) {
    this.updateCamera();
    this.renderSnapshot();
    this.renderEffects();
    this.targetingOverlay?.update(this.snapshot, this.time.now, this.getTargetingIntent());
    this.ambientField?.update(this.time.now, delta);
    this.sendInput(delta);
  }

  private async joinArena(request: JoinRequest) {
    if (this.socket) {
      return;
    }

    const hud = useHudStore.getState();
    hud.setConnection("connecting");
    this.socket = new GameSocket();

    try {
      const accepted = await this.socket.connect(request, (snapshot) => {
        this.snapshot = snapshot;
        this.publishArenaDebugSnapshot(snapshot);
        const now = performance.now();
        if (now - this.lastHudSync > 90) {
          useHudStore.getState().setSnapshot(snapshot);
          this.lastHudSync = now;
        }
      });
      useHudStore.getState().setJoined(accepted.playerId);
    } catch (error) {
      console.error(error);
      useHudStore.getState().setConnection("error");
      this.socket?.disconnect();
      this.socket = null;
    }
  }

  private sendInput(delta: number) {
    if (!this.socket || !this.snapshot) {
      return;
    }

    this.lastSentAt += delta;
    if (this.lastSentAt < SEND_RATE_MS) {
      return;
    }
    this.lastSentAt = 0;

    const self = this.getSelf();
    if (!self) {
      return;
    }

    const pointer = this.input.activePointer;
    const hudInput = useHudStore.getState().hudInput;
    const pointerAimPoint = this.getPointerAimPoint();
    const pointerAngle = Phaser.Math.RadToDeg(Math.atan2(pointerAimPoint.y - self.y, pointerAimPoint.x - self.x));
    const reviewAngle = this.getReviewAngleOverride();
    const angle = reviewAngle !== null ? reviewAngle : pointerAngle;
    const aimPoint = reviewAngle !== null ? project({ x: self.x, y: self.y }, reviewAngle, COMBAT.mageBeamLength) : pointerAimPoint;
    const input: PlayerInput = {
      moveX:
        (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
        (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0),
      moveY:
        (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
        (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0),
      angle,
      aimX: aimPoint.x,
      aimY: aimPoint.y,
      attack: pointer.isDown || hudInput.attack,
      sprint: this.keys.SPACE.isDown || this.keys.SHIFT.isDown,
      skillQ: this.keys.Q.isDown || hudInput.skillQ,
      skillE: this.keys.E.isDown || hudInput.skillE,
      skillR: this.keys.R.isDown || hudInput.skillR
    };

    this.publishArenaDebugInput(input);
    this.socket.sendInput(input);
  }

  private getTargetingIntent(): TargetingIntent {
    const hudInput = useHudStore.getState().hudInput;
    const self = this.getSelf();
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    const aimPoint = self ? this.getPointerAimPoint() : this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const skillReady = {
      skillQ: !self || self.cooldowns.skillQ <= serverTime,
      skillE: !self || self.cooldowns.skillE <= serverTime,
      skillR: !self || self.cooldowns.skillR <= serverTime
    };
    return {
      attack: this.input.activePointer.isDown || hudInput.attack,
      skillQ: skillReady.skillQ && (this.keys.Q.isDown || hudInput.skillQ),
      skillE: skillReady.skillE && (this.keys.E.isDown || hudInput.skillE),
      skillR: skillReady.skillR && (this.keys.R.isDown || hudInput.skillR),
      aimPoint
    };
  }

  private getPointerAimPoint() {
    const pointer = this.input.activePointer;
    const worldPointer = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (this.isArenaPointerTarget(pointer)) {
      this.lastArenaAimPoint = { x: worldPointer.x, y: worldPointer.y };
    }
    return this.lastArenaAimPoint ?? { x: worldPointer.x, y: worldPointer.y };
  }

  private isArenaPointerTarget(pointer: Phaser.Input.Pointer) {
    if (!this.pointerOverArenaCanvas) {
      return false;
    }

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const clientX = canvasRect.left + pointer.x;
    const clientY = canvasRect.top + pointer.y;
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      return document.elementFromPoint(clientX, clientY) === this.game.canvas;
    }

    const target = pointer.event?.target;
    return target === this.game.canvas;
  }

  private renderSnapshot() {
    const snapshot = this.snapshot;
    if (!snapshot) {
      return;
    }

    this.renderPlayers(snapshot.players);
    this.renderProjectiles(snapshot.projectiles);
    this.renderTurrets(snapshot.turrets);
    this.renderPacks(snapshot.healthPacks);
    this.updateCombatFeedback(snapshot);
    this.updateMovementTrails(this.time.now);
  }

  private updateCombatFeedback(snapshot: GameSnapshot) {
    const self = snapshot.players.find((player) => player.id === snapshot.selfId);
    if (!this.combatFeedbackInitialized) {
      snapshot.events.forEach((event) => this.seenCombatEventIds.add(event.id));
      this.lastSelfHealth = self?.health ?? null;
      this.lastSelfAlive = self?.alive ?? null;
      this.combatFeedbackInitialized = true;
      return;
    }

    this.applySelfHealthFeedback(self);
    for (const event of snapshot.events) {
      if (this.seenCombatEventIds.has(event.id)) {
        continue;
      }
      this.seenCombatEventIds.add(event.id);
      this.applyCombatEventFeedback(event, snapshot.selfId);
    }
    this.pruneSeenCombatEvents(snapshot.events);
  }

  private applySelfHealthFeedback(self?: PublicPlayer) {
    if (!self) {
      this.lastSelfHealth = null;
      this.lastSelfAlive = null;
      return;
    }

    if (this.lastSelfHealth !== null && this.lastSelfAlive !== null) {
      if (self.alive && this.lastSelfAlive && self.health < this.lastSelfHealth) {
        this.triggerCameraImpact("hit");
      }
      if (this.lastSelfAlive && !self.alive) {
        this.triggerCameraImpact("death");
      }
    }

    this.lastSelfHealth = self.health;
    this.lastSelfAlive = self.alive;
  }

  private applyCombatEventFeedback(event: CombatEvent, selfId: string | null) {
    if (!selfId) {
      return;
    }

    if (event.type === "kill") {
      if (event.targetId === selfId) {
        this.triggerCameraImpact("death");
      } else if (event.actorId === selfId) {
        this.triggerCameraImpact("kill");
      }
      return;
    }

    if (event.type === "streak" && event.actorId === selfId) {
      this.triggerCameraImpact("streak");
      return;
    }

    if (event.type === "ultimate" && event.actorId === selfId) {
      this.triggerCameraImpact("ultimate");
      return;
    }

    if (event.type === "assist" && event.participantIds?.includes(selfId)) {
      this.triggerCameraImpact("assist");
    }
  }

  private triggerCameraImpact(kind: "hit" | "death" | "kill" | "streak" | "ultimate" | "assist") {
    const now = this.time.now;
    if (now < this.nextCameraImpactAt && kind !== "death") {
      return;
    }

    const impact: CameraImpact = {
      hit: { duration: 70, intensity: 0.0022, flash: [248, 225, 154] as const, flashAlpha: 0.1, cooldown: 120 },
      assist: { duration: 80, intensity: 0.0018, flash: [149, 227, 255] as const, flashAlpha: 0.1, cooldown: 140 },
      kill: { duration: 125, intensity: 0.003, flash: [255, 221, 128] as const, flashAlpha: 0.14, cooldown: 170 },
      streak: { duration: 150, intensity: 0.0038, flash: [198, 143, 255] as const, flashAlpha: 0.16, cooldown: 190 },
      ultimate: { duration: 145, intensity: 0.0032, flash: [120, 224, 255] as const, flashAlpha: 0.13, cooldown: 170 },
      death: { duration: 190, intensity: 0.0056, flash: [164, 46, 42] as const, flashAlpha: 0.18, cooldown: 240 }
    }[kind];

    this.cameras.main.shake(impact.duration, impact.intensity, true);
    this.playScreenFlash(impact);
    this.nextCameraImpactAt = now + impact.cooldown;
  }

  private playScreenFlash(impact: CameraImpact) {
    if (!this.screenFlash) {
      return;
    }

    const [red, green, blue] = impact.flash;
    this.screenFlashTween?.stop();
    this.screenFlash
      .setPosition(0, 0)
      .setSize(this.scale.width, this.scale.height)
      .setDisplaySize(this.scale.width, this.scale.height)
      .setFillStyle(Phaser.Display.Color.GetColor(red, green, blue), impact.flashAlpha)
      .setAlpha(impact.flashAlpha)
      .setVisible(true);

    this.screenFlashTween = this.tweens.add({
      targets: this.screenFlash,
      alpha: 0,
      duration: Math.min(impact.duration, 150),
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.screenFlash?.setVisible(false);
      }
    });
  }

  private pruneSeenCombatEvents(events: CombatEvent[]) {
    if (this.seenCombatEventIds.size <= 80) {
      return;
    }

    const activeIds = new Set(events.map((event) => event.id));
    for (const eventId of this.seenCombatEventIds) {
      if (!activeIds.has(eventId)) {
        this.seenCombatEventIds.delete(eventId);
      }
    }
  }

  private renderPlayers(players: PublicPlayer[]) {
    const liveIds = new Set(players.map((player) => player.id));
    for (const [id, view] of this.playerViews) {
      if (!liveIds.has(id)) {
        view.container.destroy(true);
        this.playerViews.delete(id);
      }
    }

    for (const player of players) {
      let view = this.playerViews.get(player.id);
      if (!view) {
        view = this.createPlayerView(player);
        this.playerViews.set(player.id, view);
      }

      const now = this.time.now;
      const previousX = view.lastX;
      const previousY = view.lastY;
      const movedDistance = Phaser.Math.Distance.Between(previousX, previousY, player.x, player.y);
      const targetDistance = Phaser.Math.Distance.Between(view.visualX, view.visualY, player.x, player.y);
      let moving = player.alive && (movedDistance > 0.28 || player.sprinting);
      if (moving && movedDistance > 0.12) {
        view.lastMoveAngle = Phaser.Math.RadToDeg(Math.atan2(player.y - previousY, player.x - previousX));
        view.lastMovingAt = now;
      } else if (player.alive && now - view.lastMovingAt < MOVEMENT_VISUAL_GRACE_MS) {
        moving = true;
      }
      if (player.health < view.lastHealth && player.alive) {
        view.hitFlashUntil = now + 240;
        view.hitImpactStartedAt = now;
        view.hitImpactUntil = now + 320;
      }
      if (view.lastAlive && !player.alive) {
        view.downedAt = now;
      }
      if (!view.lastAlive && player.alive) {
        view.downedAt = 0;
        view.hitImpactUntil = 0;
        view.visualX = player.x;
        view.visualY = player.y;
      }
      const shouldSnap = !player.alive || !view.lastAlive || movedDistance > PLAYER_SNAP_DISTANCE;
      const visual = shouldSnap
        ? { x: player.x, y: player.y }
        : this.interpolatePoint(view.visualX, view.visualY, player.x, player.y, PLAYER_INTERPOLATION, PLAYER_SNAP_DISTANCE);
      view.visualX = visual.x;
      view.visualY = visual.y;
      view.lastHealth = player.health;
      view.lastX = player.x;
      view.lastY = player.y;
      view.lastAlive = player.alive;

      view.container.setPosition(view.visualX, view.visualY);
      view.container.setDepth(view.visualY + (player.alive ? 20 : 24));
      view.container.setAlpha(1);

      const renderAngle = player.action ? player.angle : moving ? view.lastMoveAngle : player.angle;
      const renderFrame = this.getPlayerRenderFrame(player, moving, renderAngle);
      view.sprite.setTexture(renderFrame.texture);
      view.actionGhost.setTexture(renderFrame.texture);
      view.sprite.setFlipX(renderFrame.flipX);
      view.actionGhost.setFlipX(renderFrame.flipX);
      this.addMovementTrail(view, player, renderFrame, previousX, previousY, movedDistance, moving, now);
      this.applyPlayerPose(view, player, moving, now);

      view.name.setText(player.name);
      const healthRatio = player.health / player.maxHealth;
      view.healthFill.width = Math.max(0, 48 * healthRatio);
      view.healthFill.fillColor = healthRatio > 0.35 ? 0x65d840 : 0xe45a42;
      view.healthBack.setStrokeStyle(2, view.hitFlashUntil > now ? 0xfff2b8 : healthRatio < 0.35 ? 0x8f3b24 : 0x3b2d1f);
      view.staminaFill.width = Math.max(0, 48 * (player.stamina / player.maxStamina));
      view.staminaFill.fillColor = player.sprinting ? 0xffd86a : 0x62d7ff;
      this.updateStatusAura(view, player, now);

      const isSelf = player.id === this.snapshot?.selfId;
      view.name.setColor(player.alive ? (isSelf ? "#9ef06a" : player.bot ? "#ff604f" : "#f0c3a0") : "#b99a82");
      view.shadow.setFillStyle(0x050403, isSelf && player.alive ? 0.36 : 0.28);
    }
  }

  private addMovementTrail(
    view: PlayerView,
    player: PublicPlayer,
    renderFrame: PlayerRenderFrame,
    previousX: number,
    previousY: number,
    movedDistance: number,
    moving: boolean,
    now: number
  ) {
    if (!moving || !player.alive || !view.lastAlive || movedDistance < 7 || movedDistance > 96) {
      return;
    }

    if (!player.sprinting && !player.action) {
      return;
    }

    const interval = player.sprinting ? MOVEMENT_TRAIL_SPRINT_INTERVAL_MS : MOVEMENT_TRAIL_INTERVAL_MS;
    if (now - view.lastTrailAt < interval) {
      return;
    }
    view.lastTrailAt = now;

    const isSelf = player.id === this.snapshot?.selfId;
    const accent = Phaser.Display.Color.HexStringToColor(CLASS_META[player.classId].accent).color;
    const baseAlpha = isSelf ? 0.2 : 0.13;
    const baseWidth = 86;
    const baseHeight = 102;
    const image = this.add
      .image(previousX, previousY + PLAYER_BODY_BASE_Y, renderFrame.texture)
      .setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y)
      .setDisplaySize(baseWidth, baseHeight)
      .setFlipX(renderFrame.flipX)
      .setTint(accent)
      .setAlpha(baseAlpha)
      .setDepth(previousY + 8)
      .setBlendMode(Phaser.BlendModes.NORMAL);

    this.movementTrails.push({
      image,
      createdAt: now,
      duration: MOVEMENT_TRAIL_DURATION_MS,
      baseAlpha,
      baseWidth,
      baseHeight
    });

    while (this.movementTrails.length > MAX_MOVEMENT_TRAILS) {
      this.movementTrails.shift()?.image.destroy();
    }
  }

  private updateMovementTrails(now: number) {
    for (let index = this.movementTrails.length - 1; index >= 0; index -= 1) {
      const trail = this.movementTrails[index];
      const progress = Phaser.Math.Clamp((now - trail.createdAt) / trail.duration, 0, 1);
      if (progress >= 1) {
        trail.image.destroy();
        this.movementTrails.splice(index, 1);
        continue;
      }

      const fade = 1 - Phaser.Math.Easing.Cubic.Out(progress);
      const scale = 1 - progress * 0.07;
      trail.image
        .setAlpha(trail.baseAlpha * fade)
        .setDisplaySize(trail.baseWidth * scale, trail.baseHeight * scale);
    }
  }

  private applyPlayerPose(view: PlayerView, player: PublicPlayer, moving: boolean, now: number) {
    view.sprite.clearTint();
    view.actionGhost.clearTint();

    if (!player.alive) {
      const downedProgress = Phaser.Math.Clamp((now - view.downedAt) / 280, 0, 1);
      const fallAngle = this.isFacingLeft(player.angle) ? 74 : -74;
      view.sprite
        .setTint(0x6d605a)
        .setAlpha(0.68)
        .setAngle(fallAngle * Phaser.Math.Easing.Cubic.Out(downedProgress))
        .setPosition(0, PLAYER_BODY_BASE_Y + 20 + downedProgress * 8)
        .setDisplaySize(104, 82);
      view.koRune
        .setVisible(true)
        .setAlpha(0.62 + Math.sin(now / 230) * 0.1)
        .setAngle(Math.sin(now / 700) * 2)
        .setDisplaySize(158, 112)
        .setBlendMode(Phaser.BlendModes.ADD);
      view.actionGhost.setVisible(false);
      view.actionFxBack.setVisible(false);
      view.actionFxFront.setVisible(false);
      view.hitImpact.setVisible(false);
      view.statusAura.setVisible(false);
      view.shadow.setScale(1.32, 0.5).setAlpha(0.22);
      view.name.setY(-52);
      view.healthBack.setVisible(false);
      view.healthFill.setVisible(false);
      view.staminaBack.setVisible(false);
      view.staminaFill.setVisible(false);
      return;
    }

    view.healthBack.setVisible(true);
    view.healthFill.setVisible(true);
    view.staminaBack.setVisible(true);
    view.staminaFill.setVisible(true);
    view.sprite.setAlpha(1);
    view.koRune.setVisible(false);
    view.name.setY(-92);

    const poseAngle = player.action ? player.angle : moving ? view.lastMoveAngle : player.angle;
    const facingDirection = this.getFacingDirection(poseAngle);
    const walkStep = moving && !player.action ? Math.sin(now / 72) : 0;
    const footPlant = moving && !player.action ? Math.abs(walkStep) : 0;
    const actionProgress = this.getActionProgress(player);
    const actionMotion = this.getActionMotion(player, actionProgress);
    const lunge = project({ x: 0, y: 0 }, player.angle, actionMotion.kick);
    const hitProgress = Phaser.Math.Clamp((view.hitFlashUntil - now) / 240, 0, 1);
    const hitShake = hitProgress > 0 ? Math.sin(now / 10) * 3.2 * hitProgress : 0;
    const recoil = project({ x: 0, y: 0 }, player.angle + 180, hitProgress * 7);
    const controlledSquash = player.rooted || player.stunned ? 0.96 : 1;
    const walkPress = footPlant * 1.8;
    const groundedY = PLAYER_BODY_BASE_Y + walkPress + actionMotion.lift + lunge.y * 0.28 + recoil.y * 0.36;
    const stepSquash = moving && !player.action ? 1 - footPlant * 0.018 : 1;
    const stepLean = moving && !player.action && facingDirection !== "up" ? walkStep * 0.8 : 0;
    const backStepSway = moving && !player.action && facingDirection === "up" ? walkStep * 1.15 : 0;

    view.sprite
      .setAngle(actionMotion.angle + stepLean)
      .setPosition(lunge.x + recoil.x + hitShake + backStepSway, groundedY)
      .setDisplaySize(88 * actionMotion.scaleX, 104 * controlledSquash * actionMotion.scaleY * stepSquash);

    this.updatePlayerGhost(view, player, moving, now, lunge, groundedY, hitProgress, actionProgress);
    this.updatePlayerActionFx(view, player, actionProgress, lunge, groundedY);
    this.updatePlayerHitImpact(view, now);

    view.shadow
      .setScale((moving ? 1.1 + footPlant * 0.08 : 1) * actionMotion.shadowScaleX, (moving ? 0.86 + footPlant * 0.08 : 1) * actionMotion.shadowScaleY)
      .setAlpha(player.spawnProtected ? 0.34 : moving ? 0.31 : 0.25);

    if (view.hitFlashUntil > now) {
      view.sprite.setTintFill(0xffffff);
    } else if (player.stunned) {
      view.sprite.setTint(0xd9b8ff);
    } else if (player.rooted) {
      view.sprite.setTint(0xcff1a6);
    } else if (player.sprinting) {
      view.sprite.setTint(0xffe0a0);
    } else if (player.shielded || player.spawnProtected) {
      view.sprite.setTint(0xfff1a8);
    }
  }

  private updatePlayerGhost(
    view: PlayerView,
    player: PublicPlayer,
    moving: boolean,
    now: number,
    lunge: { x: number; y: number },
    walkBob: number,
    hitProgress: number,
    actionProgress: number
  ) {
    const showGhost = Boolean(player.action) || player.sprinting || hitProgress > 0.18;
    if (!showGhost) {
      view.actionGhost.setVisible(false);
      return;
    }

    const accent = Phaser.Display.Color.HexStringToColor(CLASS_META[player.classId].accent).color;
    const sprintOffset = player.sprinting ? project({ x: 0, y: 0 }, player.angle + 180, 13 + Math.sin(now / 70) * 2) : { x: 0, y: 0 };
    const ghostProfile = this.getActionGhostProfile(player, actionProgress);
    const actionOffset = player.action
      ? { x: -lunge.x * ghostProfile.offset, y: -lunge.y * 0.34 - Math.sin(actionProgress * Math.PI) * ghostProfile.rise }
      : { x: 0, y: 0 };
    const hitOffset = hitProgress > 0 ? project({ x: 0, y: 0 }, player.angle, hitProgress * 5) : { x: 0, y: 0 };
    const alpha = player.action ? ghostProfile.alpha : player.sprinting ? 0.1 : 0.2;

    view.actionGhost
      .setVisible(true)
      .setTint(accent)
      .setAlpha(alpha)
      .setAngle(0)
      .setPosition(actionOffset.x + sprintOffset.x + hitOffset.x, walkBob + actionOffset.y + sprintOffset.y * 0.36 + hitOffset.y * 0.28)
      .setDisplaySize(88 * ghostProfile.scaleX, 104 * ghostProfile.scaleY)
      .setBlendMode(player.sprinting && !player.action ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
  }

  private updatePlayerActionFx(
    view: PlayerView,
    player: PublicPlayer,
    actionProgress: number,
    lunge: { x: number; y: number },
    spriteY: number
  ) {
    view.actionFxBack.setVisible(false);
    view.actionFxFront.setVisible(false);

    const direction = this.getFacingDirection(player.angle);
    if (player.classId === "warrior" && shouldShowWarriorActionFx(player.action)) {
      const profile = getWarriorActionFxProfile(player.action, direction, actionProgress);
      const image = profile.layer === "back" ? view.actionFxBack : view.actionFxFront;
      const texture =
        profile.source === "warriorCharge"
          ? getWarriorArcherVfxFrameTexture("warriorCharge", profile.frame)
          : profile.source === "verticalSlash" && profile.verticalDirection
            ? getWarriorVerticalSlashFrameTexture(profile.verticalDirection, profile.frame)
            : getAbilityVfxFrameTexture("warriorSlash", profile.frame);
      image
        .setVisible(true)
        .setTexture(texture)
        .setFlipX(profile.flipX)
        .setAngle(profile.angle)
        .setPosition(lunge.x + profile.x, spriteY + profile.y)
        .setDisplaySize(profile.width, profile.height)
        .setAlpha(profile.alpha)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      return;
    }

    if (player.classId === "mage" && shouldShowMageActionFx(player.action)) {
      const profile = getMageActionFxProfile(direction, actionProgress);
      const image = profile.layer === "back" ? view.actionFxBack : view.actionFxFront;
      image
        .setVisible(true)
        .setTexture(getCombatVfxFrameTexture("magicOrbProjectile", profile.frame))
        .setFlipX(false)
        .setAngle(profile.angle)
        .setPosition(lunge.x + profile.x, spriteY + profile.y)
        .setDisplaySize(profile.width, profile.height)
        .setAlpha(profile.alpha)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  private getActionGhostProfile(player: PublicPlayer, progress: number) {
    if (!player.action) {
      return { alpha: 1, offset: 0, rise: 0, scaleX: 1, scaleY: 1 };
    }

    const fade = 0.74 + Math.sin(progress * Math.PI) * 0.26;
    if (player.classId === "mage") {
      if (player.action === "skillQ") {
        return { alpha: 0.14 * fade, offset: 0.34, rise: 1.2, scaleX: 1.015, scaleY: 1.015 };
      }
      return { alpha: (player.action === "skillR" ? 0.24 : 0.19) * fade, offset: 0.42, rise: 2.2, scaleX: 1.035, scaleY: 1.035 };
    }

    if (player.classId === "engineer") {
      return { alpha: (player.action === "skillR" ? 0.24 : 0.18) * fade, offset: 0.36, rise: 1.6, scaleX: 1.02, scaleY: 1.02 };
    }

    if (player.classId === "archer" && player.action === "skillQ") {
      return { alpha: 0.24 * fade, offset: 0.72, rise: 3.8, scaleX: 1.04, scaleY: 1.02 };
    }

    return {
      alpha: (player.action === "skillR" ? 0.3 : 0.24) * fade,
      offset: player.action === "skillQ" ? 0.86 : 0.7,
      rise: 3,
      scaleX: 1.045,
      scaleY: 1.02
    };
  }

  private updatePlayerHitImpact(view: PlayerView, now: number) {
    if (view.hitImpactUntil <= now) {
      view.hitImpact.setVisible(false);
      return;
    }

    const progress = Phaser.Math.Clamp((now - view.hitImpactStartedAt) / Math.max(1, view.hitImpactUntil - view.hitImpactStartedAt), 0, 1);
    const frame = Math.min(COMBAT_VFX_FRAME_COUNT - 1, Math.floor(progress * COMBAT_VFX_FRAME_COUNT));
    view.hitImpact
      .setVisible(true)
      .setTexture(getCombatVfxFrameTexture("hitImpact", frame))
      .setPosition(0, PLAYER_BODY_BASE_Y - 18)
      .setDisplaySize(112 + progress * 18, 96 + progress * 14)
      .setAlpha(0.92 - progress * 0.48)
      .setAngle(Math.sin(now / 40) * 4);
  }

  private updateStatusAura(view: PlayerView, player: PublicPlayer, now: number) {
    const status = this.getStatusAura(player);
    if (!status || !player.alive) {
      view.statusAura.setVisible(false);
      return;
    }

    const frame = Math.floor(now / 90) % STATUS_AURA_FRAME_COUNT;
    const pulse = 1 + Math.sin(now / 180) * 0.025;
    const size = this.getStatusAuraSize(status, player.spawnProtected);
    view.statusAura
      .setVisible(true)
      .setTexture(getStatusAuraFrameTexture(status, frame))
      .setPosition(0, player.spawnProtected ? PLAYER_GROUND_Y + 7 : PLAYER_GROUND_Y + 2)
      .setDisplaySize(size.width * pulse, size.height * pulse)
      .setAlpha(size.alpha * (0.92 + Math.sin(now / 240) * 0.06))
      .setTint(player.spawnProtected ? 0xd8ffd0 : 0xffffff)
      .setBlendMode(player.spawnProtected ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
  }

  private getStatusAura(player: PublicPlayer): StatusAuraKey | null {
    if (player.spawnProtected) {
      return "shield";
    }
    if (player.shielded) {
      return "shield";
    }
    if (player.stunned) {
      return "stun";
    }
    if (player.rooted) {
      return "root";
    }
    return null;
  }

  private getStatusAuraSize(status: StatusAuraKey, spawnProtected = false) {
    if (spawnProtected) {
      return PLAYER_SPAWN_AURA_SIZE;
    }
    if (status === "root") {
      return { width: 104, height: 64, alpha: 0.56 };
    }
    if (status === "stun") {
      return { width: 98, height: 58, alpha: 0.54 };
    }
    return { width: 106, height: 62, alpha: 0.56 };
  }

  private renderProjectiles(projectiles: ProjectileState[]) {
    const ids = new Set(projectiles.map((projectile) => projectile.id));
    for (const [id, view] of this.projectileViews) {
      if (!ids.has(id)) {
        view.trail.destroy();
        view.sprite.destroy();
        this.projectileViews.delete(id);
      }
    }

    for (const projectile of projectiles) {
      let view = this.projectileViews.get(projectile.id);
      if (!view) {
        view = this.createProjectileView(projectile);
        this.projectileViews.set(projectile.id, view);
      }

      const visual = this.interpolatePoint(view.visualX, view.visualY, projectile.x, projectile.y, FAST_ENTITY_INTERPOLATION, FAST_ENTITY_SNAP_DISTANCE);
      view.visualX = visual.x;
      view.visualY = visual.y;
      const rotation = Phaser.Math.DegToRad(projectile.angle);
      const frame = this.getProjectileFrame(projectile);
      const [width, height] = this.getProjectileDisplaySize(projectile);
      const pulse = 1 + Math.sin((this.time.now + frame * 23) / 120) * 0.025;
      const launchScale = this.getProjectileLaunchScale(view);

      if (this.shouldRenderProjectileTrail(projectile)) {
        const [trailWidth, trailHeight] = this.getProjectileTrailDisplaySize(projectile);
        const trailOffset = project({ x: view.visualX, y: view.visualY }, projectile.angle + 180, this.getProjectileTrailOffset(projectile) * launchScale);

        view.trail
          .setVisible(true)
          .setPosition(trailOffset.x, trailOffset.y)
          .setTexture(this.getProjectileTrailTexture(projectile, frame))
          .setRotation(rotation)
          .setDepth(view.visualY + 38)
          .setDisplaySize(trailWidth * launchScale * pulse, trailHeight * launchScale)
          .setAlpha(this.getProjectileTrailAlpha(projectile, launchScale))
          .setTint(this.getProjectileTrailTint(projectile))
          .setBlendMode(Phaser.BlendModes.ADD);
      } else {
        view.trail.setVisible(false);
      }

      view.sprite
        .setPosition(view.visualX, view.visualY)
        .setTexture(this.getProjectileTexture(projectile, frame))
        .setRotation(rotation)
        .setDepth(view.visualY + 42)
        .setDisplaySize(width * launchScale * pulse, height * launchScale)
        .setAlpha(this.getProjectileAlpha(projectile, launchScale))
        .setTint(0xffffff)
        .setBlendMode(this.getProjectileBlendMode(projectile));
    }
  }

  private renderTurrets(turrets: TurretState[]) {
    const ids = new Set(turrets.map((turret) => turret.id));
    for (const [id, view] of this.turretViews) {
      if (!ids.has(id)) {
        view.container.destroy(true);
        this.turretViews.delete(id);
      }
    }

    for (const turret of turrets) {
      let view = this.turretViews.get(turret.id);
      if (!view) {
        view = this.createTurretView(turret);
        this.turretViews.set(turret.id, view);
      }

      const visual = this.interpolatePoint(view.visualX, view.visualY, turret.x, turret.y, SLOW_ENTITY_INTERPOLATION, SLOW_ENTITY_SNAP_DISTANCE);
      view.visualX = visual.x;
      view.visualY = visual.y;
      view.container.setPosition(view.visualX, view.visualY);
      view.container.setDepth(view.visualY + 26);
      const firingPulse = Math.floor(this.time.now / 220 + Number(turret.id.replace("t_", ""))) % 5 === 0;
      view.visualAngle = this.interpolateAngle(view.visualAngle, turret.angle, turret.boosted ? 0.94 : 0.84);
      view.base.setTexture(getCombatObjectTexture("turretBase"));
      view.head
        .setTexture(getCombatObjectTexture(turret.boosted ? "turretHeadBoosted" : firingPulse ? "turretHeadFiring" : "turretHead"))
        .setAngle(view.visualAngle);
      view.shadow.setAlpha(turret.boosted ? 0.48 : 0.42).setScale(turret.boosted ? 1.06 : 1, turret.boosted ? 1.02 : 1);
      view.anchor
        .setFillStyle(turret.boosted ? 0x122431 : 0x1b140d, turret.boosted ? 0.18 : 0.14)
        .setStrokeStyle(2, turret.boosted ? 0x72d7ff : 0x8d6a3e, turret.boosted ? 0.36 : 0.22);
      const muzzle = project({ x: 0, y: TURRET_HEAD_Y }, view.visualAngle, turret.boosted ? TURRET_MUZZLE_BOOSTED_DISTANCE : TURRET_MUZZLE_NORMAL_DISTANCE);
      view.muzzleFlash
        .setVisible(firingPulse)
        .setPosition(muzzle.x, muzzle.y)
        .setRotation(Phaser.Math.DegToRad(view.visualAngle))
        .setAlpha(turret.boosted ? 0.92 : 0.78)
        .setDisplaySize(turret.boosted ? 46 : 36, turret.boosted ? 46 : 36);
      view.health.width = Math.max(0, TURRET_HEALTH_WIDTH * (turret.health / turret.maxHealth));
    }
  }

  private renderPacks(packs: HealthPackState[]) {
    const ids = new Set(packs.map((pack) => pack.id));
    for (const [id, view] of this.packViews) {
      if (!ids.has(id)) {
        view.container.destroy(true);
        this.packViews.delete(id);
      }
    }

    for (const pack of packs) {
      let view = this.packViews.get(pack.id);
      if (!view) {
        view = this.createPackView(pack);
        this.packViews.set(pack.id, view);
      }
      const visual = this.interpolatePoint(view.visualX, view.visualY, pack.x, pack.y, SLOW_ENTITY_INTERPOLATION, SLOW_ENTITY_SNAP_DISTANCE);
      view.visualX = visual.x;
      view.visualY = visual.y;
      view.container.setPosition(view.visualX, view.visualY + Math.sin(this.time.now / 300 + pack.imageIndex) * 3);
      view.container.setDepth(view.visualY + 6);
      const variant = getHealthPackVariant(pack.imageIndex);
      const glow = Phaser.Display.Color.HexStringToColor(variant.glow).color;
      const phase = this.time.now / 360 + pack.imageIndex;
      const pulse = 1 + Math.sin(phase) * 0.035;
      const glowPulse = 0.72 + Math.sin(phase + 0.8) * 0.16;
      view.logo
        .clearTint()
        .setAlpha(0.92 + glowPulse * 0.08)
        .setScale(pulse);
      view.aura
        .setFillStyle(glow, 0.12 + glowPulse * 0.06)
        .setStrokeStyle(2, glow, 0.22 + glowPulse * 0.1)
        .setScale(1 + glowPulse * 0.06, 1 + glowPulse * 0.035);
      view.sparkle
        .setTint(glow)
        .setAlpha(0.28 + glowPulse * 0.22)
        .setAngle(this.time.now / 24 + pack.imageIndex * 29)
        .setDisplaySize(24 + glowPulse * 7, 24 + glowPulse * 7);
    }
  }

  private renderEffects() {
    const snapshot = this.snapshot;
    this.worldOverlay.clear();

    if (!snapshot) {
      this.renderVfxSprites([], Date.now());
      this.drawIdleLight();
      return;
    }

    this.renderVfxSprites(snapshot.effects, snapshot.serverTime);
    this.renderFloatingTexts(snapshot.effects, snapshot.serverTime, snapshot.selfId);
  }

  private renderVfxSprites(effects: EffectState[], serverTime: number) {
    const vfxEffects = effects.filter((effect) => getEffectVfxSpec(effect));
    const ids = new Set(vfxEffects.map((effect) => effect.id));

    for (const [id, view] of this.vfxViews) {
      if (!ids.has(id)) {
        view.image.destroy();
        view.rangeCircle?.destroy();
        this.vfxViews.delete(id);
      }
    }

    for (const effect of vfxEffects) {
      const spec = getEffectVfxSpec(effect);
      if (!spec) {
        continue;
      }

      const progress = Phaser.Math.Clamp((serverTime - effect.startedAt) / effect.duration, 0, 1);
      const frame = getRenderedVfxFrame(spec, progress);
      let view = this.vfxViews.get(effect.id);
      if (!view) {
        const image = this.add.image(effect.x, effect.y, getRenderedVfxTexture(spec, frame)).setDepth(getRenderedVfxDepth(effect, spec));
        const rangeCircle = this.isMageCircularAreaEffect(effect) ? this.add.graphics() : undefined;
        view = { image, rangeCircle };
        this.vfxViews.set(effect.id, view);
      }

      const size = getRenderedVfxDisplay(effect, spec, progress);
      const origin = getRenderedVfxOrigin(spec);
      this.renderMageCircularArea(effect, view, size.alpha, progress, getRenderedVfxDepth(effect, spec) - 0.35);
      view.image
        .setTexture(getRenderedVfxTexture(spec, frame))
        .setPosition(effect.x, effect.y)
        .setOrigin(origin.x, origin.y)
        .setRotation(shouldRotateVfx(spec) ? Phaser.Math.DegToRad(effect.angle) : 0)
        .setDisplaySize(size.width, size.height)
        .setAlpha(size.alpha)
        .setBlendMode(getPhaserVfxBlendMode(getRenderedVfxBlendMode(spec)))
        .setDepth(getRenderedVfxDepth(effect, spec));
    }
  }

  private isMageCircularAreaEffect(effect: EffectState) {
    return effect.type === "burst" || (effect.type === "ultimate" && effect.classId === "mage");
  }

  private renderMageCircularArea(effect: EffectState, view: VfxView, alpha: number, progress: number, depth: number) {
    if (!this.isMageCircularAreaEffect(effect)) {
      view.rangeCircle?.clear().setVisible(false);
      return;
    }

    const rangeCircle = view.rangeCircle ?? this.add.graphics();
    view.rangeCircle = rangeCircle;

    const isUltimate = effect.type === "ultimate";
    const accent = isUltimate ? 0xa66bff : 0xdfffea;
    const core = isUltimate ? 0x6127c9 : 0x70ffd4;
    const pulse = Math.sin(progress * Math.PI);
    const edgeAlpha = alpha * (0.34 + pulse * 0.12);
    const fillAlpha = alpha * (isUltimate ? 0.085 : 0.07);
    const innerAlpha = alpha * (0.12 + pulse * 0.08);

    rangeCircle
      .clear()
      .setVisible(true)
      .setPosition(effect.x, effect.y)
      .setDepth(depth)
      .setBlendMode(isUltimate ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);

    rangeCircle.fillStyle(core, fillAlpha);
    rangeCircle.fillCircle(0, 0, effect.radius);
    rangeCircle.lineStyle(9, 0x16091f, alpha * 0.24);
    rangeCircle.strokeCircle(0, 0, effect.radius + 2);
    rangeCircle.lineStyle(5, accent, edgeAlpha);
    rangeCircle.strokeCircle(0, 0, effect.radius);
    rangeCircle.lineStyle(2, 0xfff3cf, alpha * 0.32);
    rangeCircle.strokeCircle(0, 0, effect.radius * 0.965);
    rangeCircle.lineStyle(2, accent, innerAlpha);
    rangeCircle.strokeCircle(0, 0, effect.radius * (0.58 + pulse * 0.07));
  }

  private renderFloatingTexts(effects: EffectState[], serverTime: number, selfId: string | null) {
    const damageEffects = effects.filter(
      (effect) => (effect.type === "damage_number" || effect.type === "reflect_damage") && typeof effect.value === "number"
    );
    const ids = new Set(damageEffects.map((effect) => effect.id));

    for (const [id, view] of this.floatingTextViews) {
      if (!ids.has(id)) {
        view.container.destroy(true);
        this.floatingTextViews.delete(id);
      }
    }

    for (const effect of damageEffects) {
      const progress = Phaser.Math.Clamp((serverTime - effect.startedAt) / effect.duration, 0, 1);
      const reflect = effect.type === "reflect_damage";
      const selfOwned = Boolean(selfId && effect.ownerId === selfId);
      const tone = this.getFloatingTextTone(effect, selfOwned, reflect);
      let view = this.floatingTextViews.get(effect.id);
      if (!view) {
        const label = reflect ? `REFLECT -${effect.value}` : `-${effect.value}`;
        const badgeWidth = Math.max(reflect ? 104 : 58, label.length * (reflect ? 9 : 13));
        const badgeHeight = reflect ? 28 : 32;
        const container = this.add.container(effect.x, effect.y).setDepth(9000);
        const back = this.add
          .rectangle(0, 0, badgeWidth, badgeHeight, tone.back, tone.backAlpha)
          .setStrokeStyle(3, tone.stroke, tone.strokeAlpha);
        const accent = this.add.rectangle(-badgeWidth / 2 + 5, badgeHeight / 2 - 4, badgeWidth - 10, 4, tone.accent, 0.92);
        const text = this.add
          .text(0, -2, label, {
            fontFamily: "Arial Black, Arial, sans-serif",
            fontSize: reflect ? "15px" : selfOwned ? "25px" : "21px",
            color: tone.text,
            stroke: tone.strokeText,
            strokeThickness: 6
          })
          .setOrigin(0.5);
        container.add([back, accent, text]);
        view = { container, back, accent, text };
        this.floatingTextViews.set(effect.id, view);
      }

      const popProgress = Phaser.Math.Clamp(1 - Math.abs(progress - 0.18) / 0.18, 0, 1);
      const entryPop = 1 + Phaser.Math.Easing.Back.Out(popProgress) * (selfOwned ? 0.16 : 0.1);
      const alpha = progress < 0.78 ? 1 : Phaser.Math.Easing.Cubic.Out(1 - (progress - 0.78) / 0.22);
      const angle = Phaser.Math.DegToRad(effect.angle);
      const driftX = Math.sin(angle) * progress * (reflect ? 20 : 16);
      const wobbleX = Math.sin(serverTime / 44 + effect.id.length) * 2.5 * (1 - progress);
      const rise = effect.radius * Phaser.Math.Easing.Cubic.Out(progress) * (reflect ? 0.76 : 1);

      view.container
        .setPosition(effect.x + driftX + wobbleX, effect.y - rise)
        .setAlpha(alpha)
        .setScale(entryPop);
      view.back.setFillStyle(tone.back, tone.backAlpha * (0.84 + Math.sin(progress * Math.PI) * 0.16));
      view.accent.setFillStyle(tone.accent, alpha * 0.92);
      view.text.setColor(tone.text);
    }
  }

  private getFloatingTextTone(effect: EffectState, selfOwned: boolean, reflect: boolean) {
    if (reflect) {
      return {
        text: "#ffe28a",
        strokeText: "#3a2210",
        back: 0x332113,
        backAlpha: 0.78,
        stroke: 0xf0c76b,
        strokeAlpha: 0.8,
        accent: 0xffe28a
      };
    }

    const accent = effect.classId ? Phaser.Display.Color.HexStringToColor(CLASS_META[effect.classId].accent).color : 0xf4c96c;
    if (selfOwned) {
      return {
        text: "#fff8c9",
        strokeText: "#2b170d",
        back: 0x3a2314,
        backAlpha: 0.82,
        stroke: accent,
        strokeAlpha: 0.92,
        accent
      };
    }

    return {
      text: "#ffe3b0",
      strokeText: "#27130d",
      back: 0x261710,
      backAlpha: 0.66,
      stroke: accent,
      strokeAlpha: 0.58,
      accent
    };
  }

  private drawIdleLight() {
    this.worldOverlay.lineStyle(3, 0xffffff, 0.08);
    this.worldOverlay.strokeCircle(WORLD.width / 2, WORLD.height / 2, 360 + Math.sin(this.time.now / 600) * 18);
  }

  private updateCamera() {
    const self = this.getSelf();
    if (!self) {
      const camera = this.cameras.main;
      const targetX = WORLD.width / 2 - camera.width / (2 * camera.zoom) + 150;
      const targetY = WORLD.height / 2 - camera.height / (2 * camera.zoom) - 80;
      camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetX, 0.08);
      camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, 0.08);
      return;
    }
    const camera = this.cameras.main;
    const focus = this.getRenderedSelfPosition(self);
    const targetX = focus.x - camera.width / (2 * camera.zoom);
    const mobileFocusOffset = camera.width < 760 ? 180 / camera.zoom : 0;
    const targetY = focus.y - camera.height / (2 * camera.zoom) + mobileFocusOffset;
    camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetX, 0.12);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, 0.12);
  }

  private getRenderedSelfPosition(self: PublicPlayer) {
    const view = this.playerViews.get(self.id);
    return view ? { x: view.visualX, y: view.visualY } : { x: self.x, y: self.y };
  }

  private getReviewAngleOverride() {
    const value = new URLSearchParams(window.location.search).get("reviewAngle");
    if (value === null) {
      return null;
    }
    const angle = Number(value);
    return Number.isFinite(angle) ? angle : null;
  }

  private publishArenaDebugSnapshot(snapshot: GameSnapshot) {
    if (new URLSearchParams(window.location.search).get("debugArena") !== "1") {
      return;
    }

    (window as typeof window & { __renaissArenaSnapshot?: GameSnapshot }).__renaissArenaSnapshot = snapshot;
  }

  private publishArenaDebugInput(input: PlayerInput) {
    if (new URLSearchParams(window.location.search).get("debugArena") !== "1") {
      return;
    }

    (window as typeof window & { __renaissArenaLastInput?: PlayerInput }).__renaissArenaLastInput = input;
  }

  private createPlayerView(player: PublicPlayer): PlayerView {
    const container = this.add.container(player.x, player.y);
    const shadow = this.add.ellipse(0, PLAYER_GROUND_Y, 62, 20, 0x050505, 0.25);
    const koRune = this.add.image(0, PLAYER_GROUND_Y + 2, ARENA_DECAL_TEXTURES.diamondRune).setOrigin(0.5).setVisible(false);
    const statusAura = this.add
      .image(0, PLAYER_GROUND_Y + 2, getStatusAuraFrameTexture("shield", 0))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const actionGhost = this.add.image(0, 0, getClassFrameTexture(player.classId, 0)).setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y).setVisible(false);
    const actionFxBack = this.add
      .image(0, 0, getAbilityVfxFrameTexture("warriorSlash", 0))
      .setOrigin(0.5)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    const sprite = this.add.image(0, 0, getClassFrameTexture(player.classId, 0)).setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y).setDisplaySize(88, 104);
    const actionFxFront = this.add
      .image(0, 0, getAbilityVfxFrameTexture("warriorSlash", 0))
      .setOrigin(0.5)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    const hitImpact = this.add.image(0, -18, getCombatVfxFrameTexture("hitImpact", 0)).setOrigin(0.5).setVisible(false);
    const name = this.add
      .text(0, -92, player.name, {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "14px",
        color: "#f9e8bc",
        stroke: "#1d160d",
        strokeThickness: 5
      })
      .setOrigin(0.5);
    const healthBack = this.add.rectangle(0, -72, 54, 8, 0x211611, 0.9).setStrokeStyle(2, 0x3b2d1f);
    const healthFill = this.add.rectangle(-24, -72, 48, 4, 0x65d840, 1).setOrigin(0, 0.5);
    const staminaBack = this.add.rectangle(0, -63, 54, 5, 0x171f25, 0.9).setStrokeStyle(1, 0x2c4450);
    const staminaFill = this.add.rectangle(-24, -63, 48, 2, 0x62d7ff, 1).setOrigin(0, 0.5);

    container.add([statusAura, shadow, koRune, actionGhost, actionFxBack, sprite, actionFxFront, hitImpact, name, healthBack, healthFill, staminaBack, staminaFill]);
    return {
      container,
      shadow,
      koRune,
      statusAura,
      actionGhost,
      actionFxBack,
      sprite,
      actionFxFront,
      hitImpact,
      name,
      healthBack,
      healthFill,
      staminaBack,
      staminaFill,
      lastX: player.x,
      lastY: player.y,
      visualX: player.x,
      visualY: player.y,
      lastMoveAngle: player.angle,
      lastMovingAt: 0,
      lastTrailAt: 0,
      lastHealth: player.health,
      lastAlive: player.alive,
      downedAt: 0,
      hitFlashUntil: 0,
      hitImpactStartedAt: 0,
      hitImpactUntil: 0
    };
  }

  private createProjectileView(projectile: ProjectileState): ProjectileView {
    const frame = this.getProjectileFrame(projectile);
    const [trailWidth, trailHeight] = this.getProjectileTrailDisplaySize(projectile);
    const sprite = this.add
      .image(projectile.x, projectile.y, this.getProjectileTexture(projectile, frame))
      .setOrigin(0.5)
      .setDisplaySize(...this.getProjectileDisplaySize(projectile));
    const trail = this.add
      .image(projectile.x, projectile.y, this.getProjectileTrailTexture(projectile, frame))
      .setOrigin(0.5)
      .setDisplaySize(trailWidth, trailHeight)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(this.shouldRenderProjectileTrail(projectile));
    return { trail, sprite, visualX: projectile.x, visualY: projectile.y, createdAt: this.time.now };
  }

  private createTurretView(turret: TurretState): TurretView {
    const container = this.add.container(turret.x, turret.y);
    const shadow = this.add.image(0, TURRET_SHADOW_Y, getCombatObjectTexture("groundShadow")).setDisplaySize(88, 21).setAlpha(0.4);
    const anchor = this.add.ellipse(0, TURRET_ANCHOR_Y, 54, 14, 0x1b140d, 0.1).setStrokeStyle(2, 0x8d6a3e, 0.15);
    const base = this.add
      .image(0, TURRET_BASE_Y, getCombatObjectTexture("turretBase"))
      .setOrigin(0.5, 1)
      .setDisplaySize(TURRET_BASE_WIDTH, TURRET_BASE_HEIGHT);
    const head = this.add
      .image(0, TURRET_HEAD_Y, getCombatObjectTexture("turretHead"))
      .setOrigin(0.5, 0.62)
      .setDisplaySize(TURRET_HEAD_WIDTH, TURRET_HEAD_HEIGHT);
    const muzzleFlash = this.add
      .image(0, -12, getCombatObjectTexture("hitSpark"))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const healthBack = this.add.rectangle(0, TURRET_HEALTH_Y, 42, 5, 0x211611, 0.86);
    const health = this.add.rectangle(-TURRET_HEALTH_WIDTH / 2, TURRET_HEALTH_Y, TURRET_HEALTH_WIDTH, 3, 0x65d840, 1).setOrigin(0, 0.5);
    container.add([shadow, anchor, base, head, muzzleFlash, healthBack, health]);
    return { container, shadow, anchor, base, head, muzzleFlash, health, visualX: turret.x, visualY: turret.y, visualAngle: turret.angle };
  }

  private createPackView(pack: HealthPackState): PackView {
    const container = this.add.container(pack.x, pack.y);
    const shadow = this.add.image(0, 14, getCombatObjectTexture("groundShadow")).setDisplaySize(36, 13).setAlpha(0.26);
    const aura = this.add.ellipse(0, 2, 42, 18, 0xb7f48a, 0.16).setStrokeStyle(2, 0xb7f48a, 0.26);
    const logo = this.add.image(0, -7, "healthLogo").setOrigin(0.5).setDisplaySize(42, 42);
    const sparkle = this.add
      .image(0, -29, getCombatObjectTexture("leafSparkle"))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.add([shadow, aura, logo, sparkle]);
    return { container, shadow, aura, logo, sparkle, visualX: pack.x, visualY: pack.y };
  }

  private getProjectileTexture(projectile: ProjectileState, frame = this.getProjectileFrame(projectile)) {
    if (projectile.type === "arrow") {
      return getRpgSkillProjectileFrameTexture("grass", frame);
    }
    return getCombatVfxFrameTexture(this.getProjectileVfxKey(projectile.type), frame);
  }

  private getProjectileTrailTexture(projectile: ProjectileState, frame: number) {
    if (projectile.type === "arrow") {
      return getRpgSkillProjectileFrameTexture("grass", (frame + 1) % RPG_SKILL_PROJECTILE_FRAME_COUNT);
    }
    if (projectile.type === "magic_ball") {
      return getCombatVfxFrameTexture("magicOrbProjectile", (frame + 10) % COMBAT_VFX_FRAME_COUNT);
    }
    if (projectile.type === "turret_shot_boosted") {
      return getCombatVfxFrameTexture("turretShotBoosted", (frame + 1) % COMBAT_VFX_FRAME_COUNT);
    }
    return getCombatVfxFrameTexture("turretShot", (frame + 1) % COMBAT_VFX_FRAME_COUNT);
  }

  private shouldRenderProjectileTrail(projectile: ProjectileState) {
    return projectile.type !== "arrow" && projectile.type !== "magic_ball";
  }

  private getProjectileVfxKey(projectileType: ProjectileType): CombatVfxKey {
    if (projectileType === "arrow") {
      return "arrowProjectile";
    }
    if (projectileType === "magic_ball") {
      return "magicOrbProjectile";
    }
    if (projectileType === "turret_shot_boosted") {
      return "turretShotBoosted";
    }
    return "turretShot";
  }

  private getProjectileFrame(projectile: ProjectileState) {
    const seed = Number(projectile.id.replace(/\D/g, "").slice(-4)) || 0;
    if (projectile.type === "arrow") {
      return Math.floor((this.time.now + seed * 37) / 62) % RPG_SKILL_PROJECTILE_FRAME_COUNT;
    }
    if (projectile.type === "turret_shot" || projectile.type === "turret_shot_boosted") {
      const stableFrames = [2, 3, 4, 5, 6, 5, 4, 3];
      return stableFrames[Math.floor((this.time.now + seed * 37) / 70) % stableFrames.length];
    }
    return Math.floor((this.time.now + seed * 37) / 70) % COMBAT_VFX_FRAME_COUNT;
  }

  private getProjectileDisplaySize(projectile: ProjectileState): [number, number] {
    if (projectile.type === "arrow") {
      return [136, 58];
    }
    if (projectile.type === "magic_ball") {
      return [70, 70];
    }
    if (projectile.type === "turret_shot_boosted") {
      return [118, 32];
    }
    return [96, 28];
  }

  private getProjectileTrailDisplaySize(projectile: ProjectileState): [number, number] {
    if (projectile.type === "arrow") {
      return [126, 50];
    }
    if (projectile.type === "magic_ball") {
      return [78, 78];
    }
    if (projectile.type === "turret_shot_boosted") {
      return [150, 38];
    }
    return [122, 34];
  }

  private getProjectileTrailOffset(projectile: ProjectileState) {
    if (projectile.type === "magic_ball") {
      return 16;
    }
    if (projectile.type === "arrow") {
      return 26;
    }
    return 34;
  }

  private getProjectileLaunchScale(view: ProjectileView) {
    const age = Math.max(0, this.time.now - view.createdAt);
    const progress = Phaser.Math.Clamp(age / 110, 0, 1);
    return 0.58 + Phaser.Math.Easing.Cubic.Out(progress) * 0.42;
  }

  private getProjectileTrailAlpha(projectile: ProjectileState, launchScale: number) {
    if (projectile.type === "magic_ball") {
      return 0.3 + launchScale * 0.22;
    }
    if (projectile.type === "arrow") {
      return 0.1 + launchScale * 0.18;
    }
    return 0.26 + launchScale * 0.42;
  }

  private getProjectileAlpha(projectile: ProjectileState, launchScale: number) {
    if (projectile.type === "arrow") {
      return 0.94 + launchScale * 0.06;
    }
    return 0.9 + launchScale * 0.08;
  }

  private getProjectileTrailTint(projectile: ProjectileState) {
    if (projectile.type === "arrow") {
      return 0xd4ff9a;
    }
    if (projectile.type === "magic_ball") {
      return 0x87eaff;
    }
    if (projectile.type === "turret_shot_boosted") {
      return 0xffd25b;
    }
    return 0x67d6ff;
  }

  private getProjectileBlendMode(projectile: ProjectileState) {
    return projectile.type === "arrow" ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD;
  }

  private addWorldFrame() {
    const frame = this.add.graphics().setDepth(10000);
    frame.lineStyle(10, 0x20150e, 0.55);
    frame.strokeRect(0, 0, WORLD.width, WORLD.height);

  }

  private getPlayerRenderFrame(player: PublicPlayer, moving: boolean, renderAngle = player.angle): PlayerRenderFrame {
    if (player.action && player.alive) {
      return this.getActionRenderFrame(player, moving);
    }

    return {
      texture: getClassFrameTexture(player.classId, this.getFrameIndex(player, moving, renderAngle)),
      flipX: this.isFacingLeft(renderAngle)
    };
  }

  private getActionRenderFrame(player: PublicPlayer, moving: boolean): PlayerRenderFrame {
    const progress = this.getActionProgress(player);

    if (player.classId === "warrior") {
      if (player.action === "skillE") {
        return this.getDirectionalClassRenderFrame(player, progress, moving);
      }
      return this.getWarriorAttackRenderFrame(player.angle, progress);
    }

    if (player.classId === "archer") {
      if (player.action === "skillQ") {
        return this.getDirectionalClassRenderFrame(player, progress, true);
      }
      return this.getArcherAttackRenderFrame(player.angle, progress);
    }

    if (player.classId === "engineer") {
      return this.getEngineerActionRenderFrame(player.angle, progress);
    }

    return this.getMageAttackRenderFrame(player.angle, progress);
  }

  private getDirectionalClassRenderFrame(player: PublicPlayer, progress: number, moving: boolean): PlayerRenderFrame {
    const direction = this.getFacingDirection(player.angle);
    const actionFrame = this.getAttackFrameFromProgress(progress);

    if (direction === "up") {
      return { texture: getClassFrameTexture(player.classId, 3), flipX: false };
    }
    if (direction === "down") {
      return { texture: getClassFrameTexture(player.classId, moving ? actionFrame : Math.min(actionFrame, 2)), flipX: false };
    }

    return {
      texture: getClassFrameTexture(player.classId, 4 + actionFrame),
      flipX: direction === "left"
    };
  }

  private getWarriorAttackRenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getFacingDirection(angle);
    return {
      texture: getWarriorAttackFrameTexture(direction, this.getAttackFrameFromProgress(progress)),
      flipX: false
    };
  }

  private getArcherAttackRenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getFacingDirection(angle);
    return {
      texture: getArcherAttackFrameTexture(direction, this.getAttackFrameFromProgress(progress)),
      flipX: false
    };
  }

  private getEngineerActionRenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getFacingDirection(angle);
    return {
      texture: getEngineerActionFrameTexture(direction, this.getAttackFrameFromProgress(progress)),
      flipX: false
    };
  }

  private getMageAttackRenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getFacingDirection(angle);
    return {
      texture: getMageAttackFrameTexture(direction, this.getAttackFrameFromProgress(progress)),
      flipX: false
    };
  }

  private getFrameIndex(player: PublicPlayer, moving: boolean, renderAngle = player.angle) {
    if (!player.alive) {
      return 3;
    }

    if (player.action) {
      return this.getActionFrameIndex(player, moving);
    }

    const angle = ((renderAngle % 360) + 360) % 360;
    const walkFrame = Math.floor(this.time.now / 118) % 3;
    if (angle > 225 && angle < 315) {
      return 3;
    }
    if (angle > 45 && angle < 135) {
      return moving ? walkFrame : 0;
    }
    return moving ? 4 + walkFrame : 4;
  }

  private getActionFrameIndex(player: PublicPlayer, moving: boolean) {
    if (player.action === "skillE" && !moving) {
      return player.classId === "mage" || player.classId === "engineer" ? 7 : 2;
    }
    if (player.action === "skillR") {
      return 7;
    }
    if (player.action === "skillQ") {
      return player.classId === "warrior" || player.classId === "archer" ? 6 : 7;
    }
    return 7;
  }

  private getActionProgress(player: PublicPlayer) {
    if (!player.action || player.actionStartedAt <= 0 || player.actionEndsAt <= player.actionStartedAt) {
      return 0;
    }
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    return Phaser.Math.Clamp((serverTime - player.actionStartedAt) / (player.actionEndsAt - player.actionStartedAt), 0, 1);
  }

  private getActionMotion(player: PublicPlayer, progress: number): PlayerActionMotion {
    const neutral = {
      kick: 0,
      lift: 0,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      shadowScaleX: 1,
      shadowScaleY: 1
    };

    if (!player.action) {
      return neutral;
    }

    const pulse = Math.sin(progress * Math.PI);
    const facingSign = this.isFacingLeft(player.angle) ? -1 : 1;
    const castRise = Math.sin(Phaser.Math.Clamp(progress / 0.82, 0, 1) * Math.PI);

    if (player.classId === "mage") {
      if (player.action === "skillQ") {
        return {
          kick: 2.6 * castRise,
          lift: -3.2 * castRise,
          angle: facingSign * 0.7 * castRise,
          scaleX: 1.015 + castRise * 0.025,
          scaleY: 1.005 + castRise * 0.025,
          shadowScaleX: 1.06 + castRise * 0.06,
          shadowScaleY: 0.94
        };
      }

      if (player.action === "skillE") {
        return {
          kick: 1.2 * pulse,
          lift: -5.4 * pulse,
          angle: facingSign * 1.1 * pulse,
          scaleX: 1.03 + pulse * 0.045,
          scaleY: 1.01 + pulse * 0.06,
          shadowScaleX: 1.14 + pulse * 0.08,
          shadowScaleY: 0.86
        };
      }

      if (player.action === "skillR") {
        return {
          kick: 0.8 * pulse,
          lift: -7.2 * pulse,
          angle: Math.sin(progress * Math.PI * 2) * 0.8,
          scaleX: 1.06 + pulse * 0.055,
          scaleY: 1.03 + pulse * 0.065,
          shadowScaleX: 1.22 + pulse * 0.1,
          shadowScaleY: 0.78
        };
      }
    }

    if (player.classId === "engineer") {
      if (player.action === "skillQ") {
        return {
          kick: 0.6 * pulse,
          lift: -2.4 * pulse,
          angle: facingSign * 0.55 * pulse,
          scaleX: 1.01 + pulse * 0.02,
          scaleY: 1.01 + pulse * 0.025,
          shadowScaleX: 1.05 + pulse * 0.04,
          shadowScaleY: 0.96
        };
      }

      if (player.action === "skillE") {
        return {
          kick: 4.2 * pulse,
          lift: -2.4 * pulse,
          angle: facingSign * 1.2 * pulse,
          scaleX: 1.035 + pulse * 0.04,
          scaleY: 0.995 + pulse * 0.045,
          shadowScaleX: 1.12 + pulse * 0.08,
          shadowScaleY: 0.9
        };
      }

      if (player.action === "skillR") {
        return {
          kick: 0.4 * pulse,
          lift: -4.6 * pulse,
          angle: Math.sin(progress * Math.PI * 2) * 0.7,
          scaleX: 1.04 + pulse * 0.045,
          scaleY: 1.02 + pulse * 0.055,
          shadowScaleX: 1.2 + pulse * 0.08,
          shadowScaleY: 0.82
        };
      }
    }

    if (player.classId === "archer") {
      if (player.action === "skillQ") {
        const rollPulse = Math.sin(progress * Math.PI);
        return {
          kick: 5.2 * rollPulse,
          lift: -4 * rollPulse,
          angle: facingSign * 4.2 * rollPulse,
          scaleX: 1.035 + rollPulse * 0.04,
          scaleY: 0.985 + rollPulse * 0.045,
          shadowScaleX: 1.22 + rollPulse * 0.12,
          shadowScaleY: 0.78
        };
      }

      if (player.action === "skillE") {
        return {
          kick: 2.4 * pulse,
          lift: -2.6 * pulse,
          angle: facingSign * 1.1 * pulse,
          scaleX: 1.025 + pulse * 0.035,
          scaleY: 1 + pulse * 0.04,
          shadowScaleX: 1.1 + pulse * 0.06,
          shadowScaleY: 0.9
        };
      }

      if (player.action === "skillR") {
        return {
          kick: 1.2 * pulse,
          lift: -5.8 * pulse,
          angle: Math.sin(progress * Math.PI * 2) * 0.9,
          scaleX: 1.055 + pulse * 0.055,
          scaleY: 1.015 + pulse * 0.065,
          shadowScaleX: 1.24 + pulse * 0.1,
          shadowScaleY: 0.78
        };
      }
    }

    if (player.classId === "warrior") {
      if (player.action === "skillQ") {
        return {
          kick: 13.5 * pulse,
          lift: -1.2 * pulse,
          angle: facingSign * 2.6 * pulse,
          scaleX: 1.075 + pulse * 0.035,
          scaleY: 0.985 + pulse * 0.035,
          shadowScaleX: 1.2,
          shadowScaleY: 0.84
        };
      }

      if (player.action === "skillE") {
        return {
          kick: 0.5 * pulse,
          lift: -2.2 * pulse,
          angle: facingSign * 0.45 * pulse,
          scaleX: 1.035 + pulse * 0.03,
          scaleY: 1.015 + pulse * 0.035,
          shadowScaleX: 1.1 + pulse * 0.08,
          shadowScaleY: 0.88
        };
      }

      if (player.action === "skillR") {
        return {
          kick: 4.6 * pulse,
          lift: -6.2 * pulse,
          angle: Math.sin(progress * Math.PI * 2) * 1.1,
          scaleX: 1.08 + pulse * 0.06,
          scaleY: 1.02 + pulse * 0.06,
          shadowScaleX: 1.28 + pulse * 0.1,
          shadowScaleY: 0.78
        };
      }
    }

    if (player.action === "skillQ") {
      return {
        kick: 15 * pulse,
        lift: -2 * pulse,
        angle: facingSign * 3.5 * pulse,
        scaleX: 1.08 + pulse * 0.04,
        scaleY: 0.99 + pulse * 0.04,
        shadowScaleX: 1.22,
        shadowScaleY: 0.84
      };
    }

    if (player.action === "skillE") {
      return {
        kick: 3 * pulse,
        lift: -4 * pulse,
        angle: facingSign * 1.4 * pulse,
        scaleX: 1.04 + pulse * 0.04,
        scaleY: 0.98 + pulse * 0.06,
        shadowScaleX: 1.1 + pulse * 0.08,
        shadowScaleY: 0.92
      };
    }

    if (player.action === "skillR") {
      return {
        kick: 1.5 * pulse,
        lift: -7 * pulse,
        angle: Math.sin(progress * Math.PI * 2) * 1.8,
        scaleX: 1.1 + pulse * 0.07,
        scaleY: 1.02 + pulse * 0.07,
        shadowScaleX: 1.3 + pulse * 0.12,
        shadowScaleY: 0.78
      };
    }

    return {
      kick: 9 * pulse,
      lift: 0,
      angle: facingSign * 2.2 * pulse,
      scaleX: 1.04 + pulse * 0.05,
      scaleY: 0.98 + pulse * 0.03,
      shadowScaleX: 1.16,
      shadowScaleY: 1
    };
  }

  private interpolatePoint(currentX: number, currentY: number, targetX: number, targetY: number, alpha: number, snapDistance: number) {
    if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
      return { x: targetX, y: targetY };
    }

    const distanceToTarget = Phaser.Math.Distance.Between(currentX, currentY, targetX, targetY);
    if (distanceToTarget > snapDistance) {
      return { x: targetX, y: targetY };
    }

    return {
      x: Phaser.Math.Linear(currentX, targetX, alpha),
      y: Phaser.Math.Linear(currentY, targetY, alpha)
    };
  }

  private interpolateAngle(current: number, target: number, alpha: number) {
    if (!Number.isFinite(current)) {
      return target;
    }

    const delta = Phaser.Math.Angle.ShortestBetween(current, target);
    return Phaser.Math.Angle.WrapDegrees(current + delta * alpha);
  }

  private isFacingLeft(angle: number) {
    const normalized = ((angle % 360) + 360) % 360;
    return normalized > 90 && normalized < 270;
  }

  private getAttackFrameFromProgress(progress: number) {
    if (progress < 0.22) {
      return 0;
    }
    if (progress < 0.68) {
      return 1;
    }
    return 2;
  }

  private getFacingDirection(angle: number): WarriorAttackDirection {
    const normalized = ((angle % 360) + 360) % 360;
    if (normalized >= 45 && normalized < 135) {
      return "down";
    }
    if (normalized >= 135 && normalized < 225) {
      return "left";
    }
    if (normalized >= 225 && normalized < 315) {
      return "up";
    }
    return "right";
  }

  private getSelf() {
    const snapshot = this.snapshot;
    if (!snapshot?.selfId) {
      return null;
    }
    return snapshot.players.find((player) => player.id === snapshot.selfId) ?? null;
  }

}

function getPhaserVfxBlendMode(blendMode: "normal" | "add") {
  return blendMode === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
}

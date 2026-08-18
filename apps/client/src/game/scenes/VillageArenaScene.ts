import Phaser from "phaser";
import {
  CLASS_META,
  CLASS_STATS,
  COMBAT,
  ARENA_DUEL_REALM,
  MAGE_TARGET_TORSO_OFFSET_Y,
  WORLD,
  getArenaSkillActionProfile,
  getArcherThrowAnchor,
  getMageStaffAnchor,
  project,
  type ClassId,
  type CombatEvent,
  type DuelRealmState,
  type EffectState,
  type GameSnapshot,
  type AttackBoostPackState,
  type ArenaCatalogSkillId,
  type ArenaLoadoutSlot,
  type ArenaSkillActionBody,
  type ClassSwitchRequest,
  type HealthPackState,
  type JoinRequest,
  type PlayerInput,
  type ProjectileState,
  type ProjectileType,
  type PublicPlayer,
  type SkillKey,
  type TurretState
} from "@renaiss-game/shared";
import { makeMatteTransparent } from "../assets/chromaKey";
import {
  ARENA_DECAL_TEXTURES,
  COMBAT_VFX_FRAME_COUNT,
  ARCHER_FOREST_ROLL_FRAME_COUNT,
  ARCHER_MOVING_BOW_DIRECTIONS,
  ARCHER_MOVING_BOW_FRAME_COUNT,
  type ArcherMovingBowDirection,
  WARRIOR_M1_DIRECTIONS,
  WARRIOR_M1_FRAME_COUNT,
  type WarriorM1Direction,
  getArcherMovingBowFrameTexture,
  getArcherForestRollFrameTexture,
  getArcherStandingFullDrawFrameTexture,
  getAbilityVfxFrameTexture,
  getCombatVfxFrameTexture,
  getCombatObjectTexture,
  getEngineerActionFrameTexture,
  getMageStaffCastFrameTexture,
  getWarriorArcherVfxFrameTexture,
  getWarriorM1FrameTexture,
  getWarriorVerticalSlashFrameTexture,
  type CombatVfxKey,
  type WarriorAttackDirection
} from "../assets/crops";
import {
  getEffectVfxSpec,
  getRenderedVfxBlendMode,
  getRenderedVfxDepth,
  getRenderedVfxDisplay,
  getRenderedVfxFrame,
  getRenderedVfxOrigin,
  getRenderedVfxOffset,
  getRenderedVfxPathCore,
  getRenderedVfxTexture,
  shouldRotateVfx,
  usesArenaCatalogRuntimeVfx
} from "../assets/vfxManifest";
import { GameSocket } from "../network/GameSocket";
import { subscribeToArenaRequests } from "../network/arenaRequestLifecycle";
import { prepareWebArenaAssets } from "../network/arenaWebReadiness";
import { AmbientField } from "../render/ambientField";
import { TargetingOverlay, type TargetingIntent } from "../render/targetingOverlay";
import { PlayerStatusDisplay } from "../render/playerStatusDisplay";
import {
  createPlayerConcealmentOutline,
  updatePlayerConcealmentPresentation
} from "../render/playerConcealmentPresentation";
import { getMageActionFxProfile, shouldShowMageActionFx } from "../render/mageActionFx";
import { getWarriorActionFxProfile, shouldShowWarriorActionFx } from "../render/warriorActionFx";
import { renderVillageMap } from "../render/villageMap";
import { frameRateIndependentAlpha } from "../render/frameRate";
import {
  advanceArenaCameraFocus,
  alignArenaCameraScroll,
  getArenaCameraZoom,
  isCoarsePointerViewport,
  type ArenaCameraPoint
} from "../render/arenaCameraMotion";
import { resolveMobileAimProjection } from "../input/mobileAimProjection";
import {
  ARENA_WEB_ARCHER_FULL_DRAW,
  ARENA_WEB_MAGE_STAFF_CAST,
  ARENA_WEB_PLAYER,
  ARENA_WEB_PLAYER_STATES,
  getArenaWebFourDirection,
  getArenaWebThreeFrameAttackIndex
} from "../render/arenaPlayerPresentationContract";
import { useHudStore, type MobileAimInput, type MobileMoveInput } from "../../state/hudStore";
import {
  buildMagicTurretRuntimeTextures,
  buildNewCompatibleWalkTextures,
  buildRuntimeTextures,
  getMagicTurretFrameTexture,
  getNewCompatibleWalkFrameTexture,
  NEW_COMPATIBLE_WALK_CLASS_IDS,
  NEW_COMPATIBLE_WALK_FRAME_COUNT,
  releaseArenaRuntimeSourceTextures,
} from "../assets/runtimeTextures";
import {
  ARENA_RUNTIME_ACTOR_DISPLAY_HEIGHT,
  ARENA_SKILL_RUNTIME_ENTRY_COUNT,
  buildArenaSkillRuntimeTextures,
  ensureArenaSkillRuntimeTextures,
  getArenaSkillRuntimeActionBody,
  getArenaSkillRuntimeActionBodyFrameAtProgress,
  getArenaSkillRuntimeActionBodyFrameTexture,
  getArenaSkillRuntimeActionBodyOrigin,
  getArenaSkillRuntimeAlternateEffectAsset,
  getArenaSkillRuntimeEntry,
  getArenaSkillRuntimeFrameAtElapsed,
  getArenaSkillRuntimeFrameAtProgress,
  getArenaSkillRuntimeFrameTexture,
  getArenaSkillRuntimeImpactAsset,
  getArenaSkillRuntimeProjectileAsset,
  getArenaSkillRuntimeProjectileDisplay,
  getArenaSkillRuntimeReferenceOffset,
  getArenaSkillRuntimeScale,
  getArenaSkillRuntimeSecondaryFrameTexture,
  getArenaSkillRuntimeTetherTexture,
  getArenaSkillRuntimeVisualContract,
  getEngineerCoreFrameAtElapsed,
  getEngineerCoreFrameAtProgress,
  getEngineerCoreFrameTexture,
  getEngineerCoreRuntimeAsset,
  prepareAllArenaSkillRuntimeAssets,
  preloadArenaSkillRuntimeTextures,
  releaseArenaSkillRuntimeSourceTextures,
  type ArenaSkillRuntimePathCore
} from "../assets/arenaSkillRuntime";
import { getHealthPackVariant } from "../assets/healthPackVariants";
import { generatedAssetPath } from "../assets/generatedAssets";
import { shouldLoadStaticAssetsWithCors } from "../assets/staticAssets";
import { ARENA_TEXT, resolveArenaLanguage } from "../../i18n/arena";

interface PlayerView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  koRune: Phaser.GameObjects.Image;
  statusDisplay: PlayerStatusDisplay;
  actionGhost: Phaser.GameObjects.Image;
  actionFxBack: Phaser.GameObjects.Image;
  concealmentOutline: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Image;
  poisonOverlay: Phaser.GameObjects.Image;
  actionFxFront: Phaser.GameObjects.Image;
  hitImpact: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  healthBack: Phaser.GameObjects.Rectangle;
  healthFill: Phaser.GameObjects.Rectangle;
  staminaBack: Phaser.GameObjects.Rectangle;
  staminaFill: Phaser.GameObjects.Rectangle;
  archerChargeBack: Phaser.GameObjects.Rectangle;
  archerChargeFill: Phaser.GameObjects.Rectangle;
  archerChargeTicks: Phaser.GameObjects.Rectangle[];
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
  ownerId: string;
  image: Phaser.GameObjects.Image;
  createdAt: number;
  duration: number;
  baseAlpha: number;
  baseWidth: number;
  baseHeight: number;
}

interface ProjectileView {
  trail: Phaser.GameObjects.NineSlice | null;
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
  body: Phaser.GameObjects.Sprite;
  shield: Phaser.GameObjects.Sprite;
  healthBack: Phaser.GameObjects.Rectangle;
  health: Phaser.GameObjects.Rectangle;
  ownerMarker: Phaser.GameObjects.Rectangle;
  visualX: number;
  visualY: number;
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
  pathCore?: Phaser.GameObjects.Graphics;
  impactRing?: Phaser.GameObjects.Graphics;
  pathCoreState?: {
    visible: boolean;
    kind: "segment" | "effect-to-owner" | "repeated-links";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    moteX?: number;
    moteY?: number;
    pulseStep?: number;
  };
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
  /**
   * The four full-body Warrior skill strips are authored on their own action
   * canvases. They replace the class walk sprite for the cast, so their aspect
   * ratio and planted baseline travel with the selected skill instead of being
   * composited as a second Warrior.
   */
  displaySize?: { width: number; height: number };
  originX?: number;
  originY?: number;
  runtimeBody?: boolean;
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
const MOVEMENT_VISUAL_GRACE_MS = ARENA_WEB_PLAYER.movementVisualGraceMs;
const PLAYER_INTERPOLATION = 0.34;
const PLAYER_GROUND_Y = 15;
const PLAYER_SPRITE_ORIGIN_Y = ARENA_WEB_PLAYER.origin.y;
const PLAYER_BODY_BASE_Y = ARENA_WEB_PLAYER.bodyBaseY;
const PLAYER_SPRITE_DISPLAY_SIZE = ARENA_WEB_PLAYER.displaySize;
// Full draw keeps a square pixel aspect, but its authored body occupies less of
// the 256px cell than the normalized 165×194 walk texture. A 131px square puts
// the semantic head-to-foot height within 1% of ordinary walking without the
// old 137px jump. NW/NE visual-mass normalization lives in the accepted atlas.
const ARCHER_FULL_DRAW_DISPLAY_SIZE = ARENA_WEB_ARCHER_FULL_DRAW.displaySize;
const ARCHER_DRAW_ASSET_VERSION = "2026-08-11-moving-full-draw-v5-west-palette-corrected";
// The Mage staff-cast atlas is a fixed 256px source grid so the sideways
// release pose can keep both the full staff and the blue orb. Match the new
// compatible walk source-pixel density instead of shrinking the Mage body.
const MAGE_STAFF_CAST_DISPLAY_SIZE = ARENA_WEB_MAGE_STAFF_CAST.displaySize;
const MAGE_STAFF_CAST_ORIGIN_Y = ARENA_WEB_MAGE_STAFF_CAST.origin.y;
// Both textures use originY=0.9, but their authored foot lines sit at slightly
// different fractions of the source cell. This keeps the planted foot line
// continuous when switching between ordinary walk and either full-draw state.
const ARCHER_FULL_DRAW_BASELINE_OFFSET_Y = ARENA_WEB_ARCHER_FULL_DRAW.baselineOffsetY;
const ARCHER_FULL_DRAW_UPWARD_HUD_OFFSET_Y = ARENA_WEB_ARCHER_FULL_DRAW.upwardHudOffsetY;
const FAST_ENTITY_INTERPOLATION = 0.46;
const SLOW_ENTITY_INTERPOLATION = 0.3;
const PLAYER_SNAP_DISTANCE = 210;
const FAST_ENTITY_SNAP_DISTANCE = 320;
const SLOW_ENTITY_SNAP_DISTANCE = 180;
const TURRET_SHADOW_Y = 20;
const TURRET_ANCHOR_Y = 18;
const MECHANICAL_TURRET_BODY_Y = 0;
const MECHANICAL_TURRET_BODY_SIZE = 54;
const MAGIC_TURRET_DISPLAY_SIZE = { width: 88, height: 66 };
const MAGIC_TURRET_SHADOW_SIZE = { width: 70, height: 17 };
const MAGIC_TURRET_ANCHOR_SIZE = { width: 54, height: 14 };
const MAGIC_TURRET_SHIELD_SIZE = 90;
const MAGIC_TURRET_GROUND_ORIGIN_Y = 73 / 75;
const MECHANICAL_TURRET_SHIELD_Y = -13;
const MAGIC_TURRET_SHIELD_Y = -10;
const MECHANICAL_TURRET_HEALTH_Y = -29;
const MAGIC_TURRET_HEALTH_Y = -37;
const TURRET_HEALTH_WIDTH = 28;
const TURRET_FIRE_FRAME_MS = 70;
const TURRET_FIRE_FRAME_COUNT = 4;
const ARCHER_CHARGE_BAR_Y = -109;
const ARCHER_CHARGE_BAR_WIDTH = 66;
const ARCHER_CHARGE_FILL_WIDTH = 58;
const MOBILE_MOVE_DEADZONE = 0.08;

export class VillageArenaScene extends Phaser.Scene {
  private socket: GameSocket | null = null;
  private snapshot: GameSnapshot | null = null;
  private snapshotReceivedAtMs = 0;
  private playerViews = new Map<string, PlayerView>();
  private projectileViews = new Map<string, ProjectileView>();
  private turretViews = new Map<string, TurretView>();
  private turretFireTimes = new Map<string, number>();
  private packViews = new Map<string, PackView>();
  private attackPackViews = new Map<string, PackView>();
  private movementTrails: MovementTrailView[] = [];
  private floatingTextViews = new Map<string, FloatingTextView>();
  private vfxViews = new Map<string, VfxView>();
  private ambientField: AmbientField | null = null;
  private targetingOverlay: TargetingOverlay | null = null;
  private worldOverlay!: Phaser.GameObjects.Graphics;
  private duelRealmBackdrop!: Phaser.GameObjects.TileSprite;
  private duelRealmMaskGraphics!: Phaser.GameObjects.Graphics;
  private duelRealmBoundary!: Phaser.GameObjects.Graphics;
  private duelRealmMask!: Phaser.Display.Masks.GeometryMask;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastSentAt = 0;
  private allSkillsReadyPromise: Promise<void> | null = null;
  private unsubscribeJoin?: () => void;
  private lastHudSync = 0;
  private lastArenaAimPoint: { x: number; y: number } | null = null;
  private pointerOverArenaCanvas = false;
  private mouseAttackDragging = false;
  private queuedMouseAttack = false;
  private armedSkillSlot: SkillKey | null = null;
  private queuedSkillCast: { slot: SkillKey; aimPoint: { x: number; y: number } } | null = null;
  private suppressMouseAttackUntilPointerUp = false;
  private suppressNextContextMenu = false;
  private combatFeedbackInitialized = false;
  private seenCombatEventIds = new Set<string>();
  private lastSelfHealth: number | null = null;
  private lastSelfAlive: boolean | null = null;
  private nextCameraImpactAt = 0;
  private touchCamera = false;
  private cameraFocus: ArenaCameraPoint | null = null;
  private screenFlash: Phaser.GameObjects.Rectangle | null = null;
  private screenFlashTween: Phaser.Tweens.Tween | null = null;
  private readonly updatePointerArenaTarget = (event: PointerEvent) => {
    this.pointerOverArenaCanvas = document.elementFromPoint(event.clientX, event.clientY) === this.game.canvas;
  };
  private readonly handleArenaPointerDown = (event: PointerEvent) => {
    this.updatePointerArenaTarget(event);
    if (event.pointerType === "mouse" && this.pointerOverArenaCanvas) {
      useHudStore.getState().setMobileControlsActive(false);
    }
    if (event.button === 2 && this.armedSkillSlot) {
      event.preventDefault();
      this.suppressNextContextMenu = true;
      this.cancelArmedSkill();
      return;
    }
    if (event.button !== 0 || !this.pointerOverArenaCanvas) {
      return;
    }
    if (!this.armedSkillSlot) {
      this.queuedMouseAttack = true;
      return;
    }
    event.preventDefault();
    this.confirmArmedSkill(this.getArenaAimPointFromPointerEvent(event));
  };
  private readonly handleArenaContextMenu = (event: MouseEvent) => {
    if (!this.armedSkillSlot && !this.suppressNextContextMenu) {
      return;
    }
    event.preventDefault();
    this.suppressNextContextMenu = false;
    this.cancelArmedSkill();
  };

  constructor() {
    super("VillageArenaScene");
  }

  preload() {
    const hud = useHudStore.getState();
    hud.beginArenaAssetPreparation(ARENA_SKILL_RUNTIME_ENTRY_COUNT);
    // Scene construction uses the duel-realm texture immediately. The other
    // skill sources download with bounded concurrency after create(), while
    // per-frame GPU textures are built only for the current match manifest.
    if (shouldLoadStaticAssetsWithCors()) this.load.setCORS("anonymous");
    preloadArenaSkillRuntimeTextures(this, ["warrior_13"]);
    for (const classId of NEW_COMPATIBLE_WALK_CLASS_IDS) {
      this.load.image(
        `newCompatibleWalk_${classId}`,
        generatedAssetPath(`characters/new-compatible/${classId}/walk-8dir`)
      );
    }
    this.load.image("villageAssets", generatedAssetPath("village-assets"));
    this.load.image("skillEffects", generatedAssetPath("skill-effects"));
    this.load.image("combatObjects", generatedAssetPath("combat-objects"));
    this.load.image("healthLogo", generatedAssetPath("vinci-favicon"));
    this.load.image("attackMushroom", generatedAssetPath("attack-mushroom"));
    this.load.image("statusEffects", generatedAssetPath("status-effects"));
    this.load.image("abilityEffects", generatedAssetPath("ability-effects"));
    this.load.image("warriorVerticalSlash", generatedAssetPath("warrior-vertical-slash"));
    this.load.image("warriorArcherEffects", generatedAssetPath("warrior-archer-effects"));
    this.load.image("combatEffects", generatedAssetPath("combat-effects"));
    this.load.image("arenaDecals", generatedAssetPath("arena-decals"));
    this.load.image(
      "warriorM1Sprites",
      generatedAssetPath("characters/new-compatible/warrior/melee-m1-8dir")
    );
    this.load.image(
      "archerMovingBowSprites",
      generatedAssetPath(
        "characters/new-compatible/archer/moving-full-draw-8dir",
        ARCHER_DRAW_ASSET_VERSION
      )
    );
    this.load.image(
      "archerStandingFullDrawSprites",
      generatedAssetPath(
        "characters/new-compatible/archer/standing-full-draw-8dir",
        ARCHER_DRAW_ASSET_VERSION
      )
    );
    this.load.image(
      "archerForestRollSprites",
      generatedAssetPath("characters/new-compatible/archer/forest-roll-8dir")
    );
    this.load.image("engineerActionSprites", generatedAssetPath("engineer-action-sprites"));
    this.load.image(
      "mageStaffCastSprites",
      generatedAssetPath("characters/new-compatible/mage/staff-cast-8dir")
    );
  }

  create() {
    if (!this.game.isRunning) return;
    makeMatteTransparent(this, "villageAssets", "villageAssetsClean", "magenta");
    makeMatteTransparent(this, "skillEffects", "skillEffectsClean", "edgeBlack");
    makeMatteTransparent(this, "combatObjects", "combatObjectsClean", "edgeBlack");
    makeMatteTransparent(
      this,
      "engineerMechanicalTurretAtlas",
      "engineerMechanicalTurretAtlasClean",
      "edgeBlack"
    );
    buildRuntimeTextures(this);
    buildMagicTurretRuntimeTextures(this);
    buildArenaSkillRuntimeTextures(this, ["warrior_13"]);
    buildNewCompatibleWalkTextures(this);
    releaseArenaSkillRuntimeSourceTextures(this, ["warrior_13"]);
    releaseArenaRuntimeSourceTextures(this);

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.touchCamera = isCoarsePointerViewport();
    this.cameras.main.setZoom(getArenaCameraZoom(this.touchCamera));
    this.cameras.main.roundPixels = true;
    this.cameras.main.centerOn(WORLD.width / 2 + 150, WORLD.height / 2 - 80);

    renderVillageMap(this);
    this.addWorldFrame();
    this.ambientField = new AmbientField(this);
    this.targetingOverlay = new TargetingOverlay(this);

    this.duelRealmMaskGraphics = this.make.graphics({ x: 0, y: 0 });
    this.duelRealmMask = this.duelRealmMaskGraphics.createGeometryMask();
    this.duelRealmMask.setInvertAlpha(true);
    this.duelRealmBackdrop = this.add
      .tileSprite(
        0,
        0,
        1,
        1,
        getArenaSkillRuntimeFrameTexture("warrior_13", 0)
      )
      .setOrigin(0)
      .setTileScale(0.5)
      .setDepth(5800)
      .setMask(this.duelRealmMask)
      .setVisible(false);
    this.duelRealmBoundary = this.add
      .graphics()
      .setDepth(6100)
      .setVisible(false);

    this.worldOverlay = this.add.graphics().setDepth(6000);
    this.screenFlash = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(9500)
      .setVisible(false);

    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,F,Q,E,R,T,ESC,SPACE,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    window.addEventListener("pointermove", this.updatePointerArenaTarget, true);
    window.addEventListener("pointerdown", this.handleArenaPointerDown, true);
    window.addEventListener("contextmenu", this.handleArenaContextMenu, true);

    this.unsubscribeJoin = subscribeToArenaRequests({
      onJoinRequest: (request) => {
        void this.joinArena(request);
      },
      onClassSwitchRequest: (request) => {
        void this.switchArenaClass(request);
      }
    });

    this.allSkillsReadyPromise = this.prepareAllSkills();
    void this.allSkillsReadyPromise.catch(() => undefined);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("pointermove", this.updatePointerArenaTarget, true);
      window.removeEventListener("pointerdown", this.handleArenaPointerDown, true);
      window.removeEventListener("contextmenu", this.handleArenaContextMenu, true);
      this.cancelArmedSkill();
      this.unsubscribeJoin?.();
      this.socket?.disconnect();
      this.movementTrails.forEach((trail) => trail.image.destroy());
      this.movementTrails = [];
      this.ambientField?.destroy();
      this.ambientField = null;
      this.targetingOverlay?.destroy();
      this.targetingOverlay = null;
      this.duelRealmBackdrop.clearMask(true);
      this.duelRealmMaskGraphics.destroy();
      this.screenFlashTween?.stop();
      this.screenFlashTween = null;
      this.screenFlash = null;
      this.allSkillsReadyPromise = null;
      useHudStore.getState().resetArenaAssetPreparation();
    });
  }

  override update(_time: number, delta: number) {
    this.captureSkillArmRequests();
    this.reconcileArmedSkill();
    this.renderDuelRealm(this.snapshot?.duelRealm ?? null);
    this.renderSnapshot();
    this.updateCamera();
    this.renderEffects();
    this.targetingOverlay?.update(this.snapshot, this.time.now, this.getTargetingIntent());
    this.ambientField?.update(this.time.now, delta);
    this.sendInput(delta);
  }

  private async joinArena(request: JoinRequest) {
    if (!this.game.isRunning || !this.sys.isActive() || this.socket) {
      return;
    }

    const hud = useHudStore.getState();
    try {
      await this.allSkillsReadyPromise;
    } catch (error) {
      if (this.game.isRunning && this.sys.isActive()) {
        console.error("Arena all-skill preparation failed", error);
        hud.failArenaAssetPreparation();
      }
      return;
    }
    if (!this.game.isRunning || !this.sys.isActive()) {
      return;
    }
    hud.setConnection("connecting");
    this.socket = new GameSocket();

    try {
      await this.socket.connect(
        request,
        (snapshot) => {
          this.snapshot = snapshot;
          this.snapshotReceivedAtMs = performance.now();
          this.publishArenaDebugSnapshot(snapshot);
          const now = performance.now();
          if (now - this.lastHudSync > 90) {
            useHudStore.getState().setSnapshot(snapshot);
            this.lastHudSync = now;
          }
        },
        {
          prepareAssets: (manifest) => prepareWebArenaAssets(this, manifest),
          onStatus: (status) => useHudStore.getState().setConnection(status),
          onJoined: (accepted) => useHudStore.getState().setJoined(accepted.playerId),
          onError: (message) => console.error(`Arena connection: ${message}`)
        }
      );
    } catch (error) {
      console.error(error);
      useHudStore.getState().setConnection("error");
      this.socket?.disconnect();
      this.socket = null;
    }
  }

  private async prepareAllSkills() {
    const hud = useHudStore.getState();
    try {
      await prepareAllArenaSkillRuntimeAssets(this, (loaded, total) => {
        if (this.game.isRunning) {
          useHudStore.getState().setArenaAssetProgress(loaded, total);
        }
      });
      if (this.game.isRunning) {
        useHudStore.getState().finishArenaAssetPreparation();
      }
    } catch (error) {
      if (this.game.isRunning) {
        hud.failArenaAssetPreparation();
        console.error("Arena all-skill preparation failed", error);
      }
      throw error;
    }
  }

  private async switchArenaClass(request: ClassSwitchRequest) {
    const requiredSkillIds = [
      request.catalogLoadout.skillQ,
      request.catalogLoadout.skillE,
      request.catalogLoadout.skillR
    ].filter((skillId): skillId is ArenaCatalogSkillId => Boolean(skillId));
    try {
      await ensureArenaSkillRuntimeTextures(this, requiredSkillIds);
      this.socket?.switchClass(request);
    } catch (error) {
      console.error("Arena class switch assets failed", error);
      useHudStore.getState().setConnection("error");
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
    const hudState = useHudStore.getState();
    if (self.classId === "engineer" && Phaser.Input.Keyboard.JustDown(this.keys.T)) {
      hudState.setEngineerTurretKind(
        hudState.engineerTurretKind === "mechanical" ? "magic_missile" : "mechanical"
      );
    }
    const hudInput = hudState.hudInput;
    const mobileAttackRequested = hudState.consumeMobileAttacks() > 0;
    const mobileMove = hudState.mobileMove;
    const mobileMoveActive = this.isMobileMoveActive(mobileMove);
    const leftPointerDown = pointer.leftButtonDown();
    if (hudState.mobileControlsActive) {
      this.mouseAttackDragging = false;
      this.queuedMouseAttack = false;
    } else if (!leftPointerDown || this.armedSkillSlot) {
      this.mouseAttackDragging = false;
      if (!leftPointerDown && !this.queuedSkillCast) {
        this.suppressMouseAttackUntilPointerUp = false;
      }
    } else if (
      !this.suppressMouseAttackUntilPointerUp &&
      !this.mouseAttackDragging &&
      !this.isPointerOverInteractiveHud(pointer)
    ) {
      this.mouseAttackDragging = true;
    }

    const mouseAttack = !hudState.mobileControlsActive &&
      !this.suppressMouseAttackUntilPointerUp &&
      (this.queuedMouseAttack || this.mouseAttackDragging);
    const queuedSkillCast = this.consumeQueuedSkillCast(self, this.snapshot.serverTime);
    const pointerAimPoint = this.getPointerAimPoint(mouseAttack);
    const mobileAimPoint = this.getMobileAimPoint(hudState.mobileAim, self);
    const useMobileAim = mobileAimPoint !== null && (
      ((mobileAttackRequested || hudInput.attack) && hudState.mobileAim.action === "attack") ||
      (this.armedSkillSlot !== null && hudState.mobileAim.action === this.armedSkillSlot)
    );
    const useMobileFacingFallback = hudState.mobileControlsActive && !this.armedSkillSlot && !queuedSkillCast && !mouseAttack;
    const mobileMoveAimPoint = mobileMoveActive
      ? project(
          { x: self.x, y: self.y },
          Phaser.Math.RadToDeg(Math.atan2(mobileMove.y, mobileMove.x)),
          COMBAT.mageBeamLength
        )
      : this.getSelfForwardAimPoint(self);
    const baseAimPoint = queuedSkillCast?.aimPoint ?? (
      useMobileAim && mobileAimPoint
        ? mobileAimPoint
        : useMobileFacingFallback
          ? mobileMoveAimPoint
          : pointerAimPoint
    );
    const pointerAngle = Phaser.Math.RadToDeg(Math.atan2(baseAimPoint.y - self.y, baseAimPoint.x - self.x));
    const reviewAngle = this.getReviewAngleOverride();
    const angle = reviewAngle !== null ? reviewAngle : pointerAngle;
    const aimPoint = reviewAngle !== null ? project({ x: self.x, y: self.y }, reviewAngle, COMBAT.mageBeamLength) : baseAimPoint;
    const keyboardMoveX =
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    const keyboardMoveY =
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0);
    const input: PlayerInput = {
      moveX: Phaser.Math.Clamp(keyboardMoveX + (mobileMoveActive ? mobileMove.x : 0), -1, 1),
      moveY: Phaser.Math.Clamp(keyboardMoveY + (mobileMoveActive ? mobileMove.y : 0), -1, 1),
      angle,
      aimX: aimPoint.x,
      aimY: aimPoint.y,
      attack: mouseAttack || hudInput.attack || mobileAttackRequested,
      sprint: this.keys.SPACE.isDown || this.keys.SHIFT.isDown,
      skillF: queuedSkillCast?.slot === "skillF",
      skillQ: queuedSkillCast?.slot === "skillQ",
      skillE: queuedSkillCast?.slot === "skillE",
      skillR: queuedSkillCast?.slot === "skillR",
      engineerTurretKind: useHudStore.getState().engineerTurretKind
    };

    this.publishArenaDebugInput(input);
    this.socket.sendInput(input);
    this.queuedMouseAttack = false;
    if (queuedSkillCast || mobileAttackRequested) {
      useHudStore.getState().resetMobileAim();
    }
  }

  private getTargetingIntent(): TargetingIntent {
    const hudState = useHudStore.getState();
    const hudInput = hudState.hudInput;
    const self = this.getSelf();
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    const activeInputSlot = this.armedSkillSlot;
    const mobileAimPoint = self ? this.getMobileAimPoint(hudState.mobileAim, self) : null;
    const useMobileAim = mobileAimPoint !== null && (
      (activeInputSlot !== null && hudState.mobileAim.action === activeInputSlot) ||
      (hudState.mobileAim.active && hudState.mobileAim.action === "attack")
    );
    const mobileAttackAiming = hudState.mobileAim.active && hudState.mobileAim.action === "attack";
    const useMobileFacingFallback = hudState.mobileControlsActive && mobileAttackAiming && !activeInputSlot;
    const aimPoint = self
      ? useMobileAim && mobileAimPoint
        ? mobileAimPoint
        : useMobileFacingFallback
          ? this.getSelfForwardAimPoint(self)
          : this.getPointerAimPoint(this.input.activePointer.isDown)
      : this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const heldAbilities = emptySkillInputState();
    const activeSkillId = self && activeInputSlot
      ? activeInputSlot === "skillF"
        ? `${self.classId}_00` as ArenaCatalogSkillId
        : self.catalogLoadout[activeInputSlot]
      : null;
    if (self && activeInputSlot) {
      const skill = activeInputSlot === "skillF" ? "skillF" : self.loadout[activeInputSlot];
      heldAbilities[skill] = true;
    }
    const skillReady = {
      skillF: !self || self.cooldowns.skillF <= serverTime,
      skillQ: !self || self.cooldowns.skillQ <= serverTime,
      skillE: !self || self.cooldowns.skillE <= serverTime,
      skillR: !self || self.cooldowns.skillR <= serverTime
    };
    return {
      attack: this.queuedMouseAttack || this.mouseAttackDragging || hudInput.attack || mobileAttackAiming,
      skillF: skillReady.skillF && heldAbilities.skillF,
      skillQ: skillReady.skillQ && heldAbilities.skillQ,
      skillE: skillReady.skillE && heldAbilities.skillE,
      skillR: skillReady.skillR && heldAbilities.skillR,
      hotkeyLabel: activeInputSlot
        ? activeInputSlot.slice(-1) as "F" | "Q" | "E" | "R"
        : null,
      activeSkillId,
      aimPoint
    };
  }

  private captureSkillArmRequests() {
    const hudState = useHudStore.getState();
    const mobileGestures = hudState.consumeMobileSkillGestures();
    const hudSkillArms = hudState.consumeHudSkillArms();
    const self = this.getSelf();
    if (!self?.alive) {
      return;
    }

    if (mobileGestures.length > 0) {
      for (const gesture of mobileGestures) {
        if (gesture.phase === "begin") {
          this.armSkill(
            gesture.action,
            self,
            this.snapshot?.serverTime ?? Date.now(),
            false
          );
          continue;
        }
        if (gesture.action !== this.armedSkillSlot) {
          continue;
        }
        if (gesture.phase === "cancel") {
          this.cancelArmedSkill();
          continue;
        }
        const aimPoint = this.getMobileAimPoint(useHudStore.getState().mobileAim, self)
          ?? this.getSelfForwardAimPoint(self);
        this.confirmArmedSkill(aimPoint);
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.cancelArmedSkill();
      return;
    }
    const keyboardSlot = Phaser.Input.Keyboard.JustDown(this.keys.R)
      ? "skillR"
      : Phaser.Input.Keyboard.JustDown(this.keys.E)
        ? "skillE"
        : Phaser.Input.Keyboard.JustDown(this.keys.Q)
          ? "skillQ"
          : Phaser.Input.Keyboard.JustDown(this.keys.F)
            ? "skillF"
            : null;
    const hudSlot = (["skillR", "skillE", "skillQ", "skillF"] as SkillKey[])
      .find((slot) => hudSkillArms[slot] > 0) ?? null;
    const requestedSlot = keyboardSlot ?? hudSlot;
    if (requestedSlot) {
      this.armSkill(requestedSlot, self, this.snapshot?.serverTime ?? Date.now());
    }
  }

  private armSkill(
    slot: SkillKey,
    self: PublicPlayer,
    serverTime: number,
    toggleIfAlreadyArmed = true
  ) {
    if (!this.isSkillSlotReady(slot, self, serverTime)) {
      return;
    }
    if (this.armedSkillSlot === slot) {
      if (toggleIfAlreadyArmed) {
        this.cancelArmedSkill();
      }
      return;
    }
    this.armedSkillSlot = slot;
    this.queuedMouseAttack = false;
    this.mouseAttackDragging = false;
    useHudStore.getState().setArmedSkillAction(slot);
  }

  private confirmArmedSkill(aimPoint: { x: number; y: number }) {
    const slot = this.armedSkillSlot;
    const self = this.getSelf();
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    if (!slot || !self || !this.isSkillSlotReady(slot, self, serverTime)) {
      this.cancelArmedSkill();
      return;
    }
    this.queuedSkillCast = { slot, aimPoint };
    this.suppressMouseAttackUntilPointerUp = true;
    this.armedSkillSlot = null;
    useHudStore.getState().setArmedSkillAction(null);
  }

  private cancelArmedSkill() {
    if (!this.armedSkillSlot) {
      return;
    }
    this.armedSkillSlot = null;
    this.mouseAttackDragging = false;
    useHudStore.getState().setArmedSkillAction(null);
    useHudStore.getState().resetMobileAim();
  }

  private reconcileArmedSkill() {
    if (!this.armedSkillSlot) {
      return;
    }
    const self = this.getSelf();
    const serverTime = this.snapshot?.serverTime ?? Date.now();
    if (!self?.alive || this.snapshot?.round.phase === "finished" || !this.isSkillSlotReady(this.armedSkillSlot, self, serverTime)) {
      this.cancelArmedSkill();
    }
  }

  private consumeQueuedSkillCast(self: PublicPlayer, serverTime: number) {
    const queued = this.queuedSkillCast;
    this.queuedSkillCast = null;
    if (!queued || !this.isSkillSlotReady(queued.slot, self, serverTime)) {
      return null;
    }
    return queued;
  }

  private isSkillSlotReady(slot: SkillKey, self: PublicPlayer, serverTime: number) {
    const skill = slot === "skillF" ? "skillF" : self.loadout[slot];
    return self.cooldowns[skill] <= serverTime;
  }

  private getArenaAimPointFromPointerEvent(event: PointerEvent) {
    const rect = this.game.canvas.getBoundingClientRect();
    const localX = (event.clientX - rect.left) * (this.scale.width / rect.width);
    const localY = (event.clientY - rect.top) * (this.scale.height / rect.height);
    const worldPoint = this.cameras.main.getWorldPoint(localX, localY);
    this.lastArenaAimPoint = { x: worldPoint.x, y: worldPoint.y };
    return this.lastArenaAimPoint;
  }

  private getPointerAimPoint(forcePointerPosition = false) {
    const pointer = this.input.activePointer;
    const worldPointer = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (this.isArenaPointerTarget(pointer) || forcePointerPosition) {
      this.lastArenaAimPoint = { x: worldPointer.x, y: worldPointer.y };
    }
    return this.lastArenaAimPoint ?? { x: worldPointer.x, y: worldPointer.y };
  }

  private isMobileMoveActive(move: MobileMoveInput) {
    return Math.hypot(move.x, move.y) > MOBILE_MOVE_DEADZONE;
  }

  private getMobileAimPoint(aim: MobileAimInput, self: PublicPlayer) {
    if (!aim.active || !Number.isFinite(aim.dragX) || !Number.isFinite(aim.dragY)) {
      return null;
    }

    const skillId = aim.action === "skillF"
      ? `${self.classId}_00` as ArenaCatalogSkillId
      : aim.action && aim.action !== "attack"
        ? self.catalogLoadout[aim.action]
        : null;
    const projection = resolveMobileAimProjection({
      dragX: aim.dragX,
      dragY: aim.dragY,
      fallbackAngle: Number.isFinite(self.angle) ? self.angle : 0,
      skillId,
      attack: aim.action === "attack"
    });
    return project(
      { x: self.x, y: self.y },
      projection.angle,
      projection.distance
    );
  }

  private getSelfForwardAimPoint(self: PublicPlayer) {
    const angle = Number.isFinite(self.angle) ? self.angle : 0;
    return project({ x: self.x, y: self.y }, angle, COMBAT.mageBeamLength);
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

  private isPointerOverInteractiveHud(pointer: Phaser.Input.Pointer) {
    const target = this.getPointerViewportTarget(pointer);
    return Boolean(target?.closest("button, a, input, select, textarea, [role='button'], .hud-drawer"));
  }

  private getPointerViewportTarget(pointer: Phaser.Input.Pointer) {
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const clientX = canvasRect.left + pointer.x;
    const clientY = canvasRect.top + pointer.y;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return pointer.event?.target instanceof Element ? pointer.event.target : null;
    }
    return document.elementFromPoint(clientX, clientY);
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
    this.renderAttackBoostPacks(snapshot.attackBoostPacks);
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
        this.removeMovementTrailsForPlayer(id);
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
      if (
        player.health < view.lastHealth &&
        player.alive &&
        !this.hasMageCatalogDamageImpact(player.id)
      ) {
        view.hitFlashUntil = now + ARENA_WEB_PLAYER_STATES.hit.flashDurationMs;
        view.hitImpactStartedAt = now;
        view.hitImpactUntil = now + ARENA_WEB_PLAYER_STATES.hit.impactDurationMs;
      } else if (this.hasMageCatalogDamageImpact(player.id)) {
        // The Mage skill owns its approved hit layer. Clear a prior generic
        // player burst rather than letting it overlap the next source-bound
        // Mage impact frame.
        view.hitImpactUntil = 0;
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
      this.applyPlayerPose(view, player, moving, now, renderFrame);
      this.updatePoisonOverlay(view, player, now);

      view.name.setText(player.name);
      const healthRatio = player.health / player.maxHealth;
      view.healthFill.width = Math.max(0, 48 * healthRatio);
      view.healthFill.fillColor = healthRatio > 0.35 ? 0x65d840 : 0xe45a42;
      view.healthBack.setStrokeStyle(2, view.hitFlashUntil > now ? 0xfff2b8 : healthRatio < 0.35 ? 0x8f3b24 : 0x3b2d1f);
      view.staminaFill.width = Math.max(0, 48 * (player.stamina / player.maxStamina));
      view.staminaFill.fillColor = player.sprinting ? 0xffd86a : 0x62d7ff;
      this.updateArcherChargeMeter(view, player);
      view.statusDisplay.update(player, now, view.name.y);

      const isSelf = player.id === this.snapshot?.selfId;
      const teamColor =
        player.team === "red" ? "#ff8a75" : player.team === "blue" ? "#7bc6ff" : null;
      view.name.setColor(
        player.alive
          ? isSelf
            ? "#9ef06a"
            : teamColor ?? (player.bot ? "#ff604f" : "#f0c3a0")
          : "#b99a82"
      );
      view.shadow.setFillStyle(0x050403, isSelf && player.alive ? 0.36 : 0.28);
    }
  }

  private updatePoisonOverlay(
    view: PlayerView,
    player: PublicPlayer,
    now: number
  ) {
    if (!player.alive || !player.poisoned || !view.sprite.visible) {
      view.poisonOverlay.setVisible(false);
      return;
    }
    const pulse = 0.26 + (Math.sin(now / 145) + 1) * 0.055;
    view.poisonOverlay
      .setVisible(true)
      .setTexture(view.sprite.texture.key)
      .setFrame(view.sprite.frame.name)
      .setOrigin(view.sprite.originX, view.sprite.originY)
      .setPosition(view.sprite.x, view.sprite.y)
      .setDisplaySize(view.sprite.displayWidth, view.sprite.displayHeight)
      .setFlipX(view.sprite.flipX)
      .setFlipY(view.sprite.flipY)
      .setAngle(view.sprite.angle)
      .setAlpha(pulse * view.sprite.alpha)
      .setTintFill(0xa84cff)
      .setBlendMode(Phaser.BlendModes.ADD);
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
    if (this.isSelfConcealed(player)) {
      this.removeMovementTrailsForPlayer(player.id);
      return;
    }
    if (renderFrame.runtimeBody) {
      return;
    }
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
    const walkingDraw = this.isArcherMovingDraw(player, moving);
    const baseWidth = walkingDraw ? 86 * (256 / 165) : 86;
    const baseHeight = walkingDraw ? 102 * (256 / 194) : 102;
    const image = this.add
      .image(
        previousX,
        previousY + PLAYER_BODY_BASE_Y + (walkingDraw ? ARCHER_FULL_DRAW_BASELINE_OFFSET_Y : 0),
        renderFrame.texture
      )
      .setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y)
      .setDisplaySize(baseWidth, baseHeight)
      .setFlipX(renderFrame.flipX)
      .setTint(accent)
      .setAlpha(baseAlpha)
      .setDepth(previousY + 8)
      .setBlendMode(Phaser.BlendModes.NORMAL);

    this.movementTrails.push({
      ownerId: player.id,
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

  private removeMovementTrailsForPlayer(playerId: string) {
    for (let index = this.movementTrails.length - 1; index >= 0; index -= 1) {
      const trail = this.movementTrails[index];
      if (trail.ownerId !== playerId) continue;
      trail.image.destroy();
      this.movementTrails.splice(index, 1);
    }
  }

  private applyPlayerPose(
    view: PlayerView,
    player: PublicPlayer,
    moving: boolean,
    now: number,
    renderFrame: PlayerRenderFrame
  ) {
    view.sprite.clearTint();
    view.actionGhost.clearTint();

    if (!player.alive) {
      const downedProgress = Phaser.Math.Clamp(
        (now - view.downedAt) / ARENA_WEB_PLAYER_STATES.death.fallDurationMs,
        0,
        1
      );
      const fallAngle = this.isFacingLeft(player.angle)
        ? ARENA_WEB_PLAYER_STATES.death.fallAngleDegrees
        : -ARENA_WEB_PLAYER_STATES.death.fallAngleDegrees;
      view.sprite
        .setTint(Number.parseInt(ARENA_WEB_PLAYER_STATES.death.bodyTint.slice(1), 16))
        .setAlpha(ARENA_WEB_PLAYER_STATES.death.bodyAlpha)
        .setAngle(fallAngle * Phaser.Math.Easing.Cubic.Out(downedProgress))
        .setPosition(
          ARENA_WEB_PLAYER_STATES.death.bodyStartPosition.x,
          Phaser.Math.Linear(
            ARENA_WEB_PLAYER_STATES.death.bodyStartPosition.y,
            ARENA_WEB_PLAYER_STATES.death.bodyEndPosition.y,
            downedProgress
          )
        )
        .setDisplaySize(
          ARENA_WEB_PLAYER_STATES.death.bodyDisplaySize.width,
          ARENA_WEB_PLAYER_STATES.death.bodyDisplaySize.height
        );
      view.koRune
        .setVisible(true)
        .setAlpha(0.62 + Math.sin(now / 230) * 0.1)
        .setAngle(Math.sin(now / 700) * 2)
        .setDisplaySize(
          ARENA_WEB_PLAYER_STATES.death.runeDisplaySize.width,
          ARENA_WEB_PLAYER_STATES.death.runeDisplaySize.height
        )
        .setBlendMode(Phaser.BlendModes.ADD);
      view.actionGhost.setVisible(false);
      view.actionFxBack.setVisible(false);
      view.actionFxFront.setVisible(false);
      view.concealmentOutline.setVisible(false);
      view.hitImpact.setVisible(false);
      view.statusDisplay.hide();
      view.shadow.setScale(1.32, 0.5).setAlpha(0.22);
      view.name.setY(-52);
      view.healthBack.setVisible(false);
      view.healthFill.setVisible(false);
      view.staminaBack.setVisible(false);
      view.staminaFill.setVisible(false);
      view.archerChargeBack.setVisible(false);
      view.archerChargeFill.setVisible(false);
      for (const tick of view.archerChargeTicks) {
        tick.setVisible(false);
      }
      return;
    }

    view.healthBack.setVisible(true);
    view.healthFill.setVisible(true);
    view.staminaBack.setVisible(true);
    view.staminaFill.setVisible(true);
    view.sprite.setAlpha(1);
    view.koRune.setVisible(false);

    const poseAngle = player.action ? player.angle : moving ? view.lastMoveAngle : player.angle;
    const facingDirection = this.getFacingDirection(poseAngle);
    // A charging Archer may keep moving. Treat that as a true walking state so
    // feet, shadow and sway stay in sync with the moving-bow action strip.
    const walkingDraw = this.isArcherMovingDraw(player, moving);
    const fullDrawPose = this.isArcherFullDrawPose(player);
    const hudOffsetY = fullDrawPose && facingDirection === "up" ? ARCHER_FULL_DRAW_UPWARD_HUD_OFFSET_Y : 0;
    view.name.setY(-92 + hudOffsetY);
    view.healthBack.setY(-72 + hudOffsetY);
    view.healthFill.setY(-72 + hudOffsetY);
    view.staminaBack.setY(-60 + hudOffsetY);
    view.staminaFill.setY(-60 + hudOffsetY);
    view.archerChargeBack.setY(ARCHER_CHARGE_BAR_Y + hudOffsetY);
    view.archerChargeFill.setY(ARCHER_CHARGE_BAR_Y + hudOffsetY);
    for (const tick of view.archerChargeTicks) {
      tick.setY(ARCHER_CHARGE_BAR_Y + hudOffsetY);
    }
    const stepping = moving && (!player.action || walkingDraw);
    const walkStep = stepping ? Math.sin(now / 72) : 0;
    const footPlant = stepping ? Math.abs(walkStep) : 0;
    const actionProgress = this.getActionProgress(player);
    const actionMotion = this.getActionMotion(player, actionProgress);
    const lunge = project({ x: 0, y: 0 }, player.angle, actionMotion.kick);
    const hitProgress = Phaser.Math.Clamp(
      (view.hitFlashUntil - now) / ARENA_WEB_PLAYER_STATES.hit.flashDurationMs,
      0,
      1
    );
    const hitShake = hitProgress > 0
      ? Math.sin(now / ARENA_WEB_PLAYER_STATES.hit.horizontalShakePeriodMs) *
        ARENA_WEB_PLAYER_STATES.hit.horizontalShakeAmplitude *
        hitProgress
      : 0;
    const recoil = project(
      { x: 0, y: 0 },
      player.angle + 180,
      hitProgress * ARENA_WEB_PLAYER_STATES.hit.recoilDistance
    );
    const controlledSquash = player.stunned ? 0.96 : 1;
    const walkPress = footPlant * 1.8;
    const groundedY =
      PLAYER_BODY_BASE_Y +
      (fullDrawPose ? ARCHER_FULL_DRAW_BASELINE_OFFSET_Y : 0) +
      walkPress +
      actionMotion.lift +
      lunge.y * 0.28 +
      recoil.y * 0.36;
    const stepSquash = stepping ? 1 - footPlant * 0.018 : 1;
    const stepLean = stepping && facingDirection !== "up" ? walkStep * 0.8 : 0;
    const backStepSway = stepping && facingDirection === "up" ? walkStep * 1.15 : 0;

    view.sprite
      .setOrigin(
        renderFrame.originX ?? 0.5,
        renderFrame.originY ?? PLAYER_SPRITE_ORIGIN_Y
      )
      .setAngle(actionMotion.angle + stepLean)
      .setPosition(lunge.x + recoil.x + hitShake + backStepSway, groundedY)
      .setDisplaySize(
        (renderFrame.displaySize?.width ??
          (fullDrawPose ? ARCHER_FULL_DRAW_DISPLAY_SIZE.width : PLAYER_SPRITE_DISPLAY_SIZE.width)) *
          actionMotion.scaleX,
        (renderFrame.displaySize?.height ??
          (fullDrawPose ? ARCHER_FULL_DRAW_DISPLAY_SIZE.height : PLAYER_SPRITE_DISPLAY_SIZE.height)) *
          controlledSquash *
          actionMotion.scaleY *
          stepSquash
      );

    this.updatePlayerGhost(view, player, moving, now, lunge, groundedY, hitProgress, actionProgress);
    this.updatePlayerActionFx(view, player, actionProgress, lunge, groundedY);
    this.updatePlayerHitImpact(view, now);

    view.shadow
      .setScale((moving ? 1.1 + footPlant * 0.08 : 1) * actionMotion.shadowScaleX, (moving ? 0.86 + footPlant * 0.08 : 1) * actionMotion.shadowScaleY)
      .setAlpha(player.spawnProtected ? 0.34 : moving ? 0.31 : 0.25);

    if (view.hitFlashUntil > now) {
      view.sprite.setTintFill(0xffffff);
    } else if (player.sprinting) {
      view.sprite.setTint(0xffe0a0);
    } else if (player.shielded || player.spawnProtected) {
      view.sprite.setTint(0xfff1a8);
    }

    const concealed = this.isSelfConcealed(player);
    updatePlayerConcealmentPresentation(
      view.sprite,
      view.concealmentOutline,
      concealed,
      now
    );
    if (concealed) {
      view.actionGhost.setVisible(false);
      view.actionFxBack.setVisible(false);
      view.actionFxFront.setVisible(false);
      view.hitImpact.setVisible(false);
      view.shadow.setAlpha(0.1);
      this.removeMovementTrailsForPlayer(player.id);
    }
  }

  private isSelfConcealed(player: PublicPlayer) {
    if (player.id !== this.snapshot?.selfId || player.concealmentEndsAt <= 0) {
      return false;
    }
    const estimatedServerTime =
      this.snapshot.serverTime +
      Math.max(0, performance.now() - this.snapshotReceivedAtMs);
    return player.concealmentEndsAt > estimatedServerTime;
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
    const actionBody = this.getCatalogActionBody(player);
    // The Mage uses the complete 8-direction staff-cast body. Rendering the
    // generic action ghost behind it reuses an old 88×104 display box and
    // origin, which creates a visibly clipped-looking second silhouette at
    // the hands and feet. The authored cast sheet already contains its own
    // prepare, release, and recovery motion, so it must render on its own.
    if (this.getRuntimeBodyAction(player) || actionBody === "mage-cast") {
      view.actionGhost.setVisible(false);
      return;
    }
    const fullDrawPose = this.isArcherFullDrawPose(player);
    // A second, smaller body behind the complete full-draw silhouette reads as
    // a duplicate Archer. The accepted full-draw art already supplies motion.
    const showGhost = !fullDrawPose && (Boolean(player.action) || player.sprinting || hitProgress > 0.18);
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
    const actionBody = this.getCatalogActionBody(player);
    const warriorActionFx =
      player.action === "attack"
        ? "attack"
        : actionBody === "warrior-charge"
          ? "skillQ"
          : null;
    if (player.classId === "warrior" && shouldShowWarriorActionFx(warriorActionFx)) {
      const profile = getWarriorActionFxProfile(warriorActionFx, direction, actionProgress);
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

    // Catalog Mage skills own their declared runtime VFX. The hand orb remains
    // exclusive to the basic attack so it cannot masquerade as another spell.
    if (player.classId === "mage" && player.action === "attack" && shouldShowMageActionFx(player.action)) {
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

    const actionBody = this.getCatalogActionBody(player);
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

    if (player.classId === "archer" && actionBody === "archer-roll") {
      return { alpha: 0.24 * fade, offset: 0.72, rise: 3.8, scaleX: 1.04, scaleY: 1.02 };
    }

    if (actionBody === "warrior-charge") {
      return { alpha: 0.24 * fade, offset: 0.86, rise: 3, scaleX: 1.045, scaleY: 1.02 };
    }

    if (actionBody) {
      return { alpha: 0.16 * fade, offset: 0.34, rise: 1.6, scaleX: 1.02, scaleY: 1.01 };
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
      .setPosition(
        ARENA_WEB_PLAYER_STATES.hit.impactPosition.x,
        ARENA_WEB_PLAYER_STATES.hit.impactPosition.y
      )
      .setDisplaySize(
        Phaser.Math.Linear(
          ARENA_WEB_PLAYER_STATES.hit.impactStartSize.width,
          ARENA_WEB_PLAYER_STATES.hit.impactEndSize.width,
          progress
        ),
        Phaser.Math.Linear(
          ARENA_WEB_PLAYER_STATES.hit.impactStartSize.height,
          ARENA_WEB_PLAYER_STATES.hit.impactEndSize.height,
          progress
        )
      )
      .setAlpha(
        Phaser.Math.Linear(
          ARENA_WEB_PLAYER_STATES.hit.impactStartAlpha,
          ARENA_WEB_PLAYER_STATES.hit.impactEndAlpha,
          progress
        )
      )
      .setAngle(
        Math.sin(now / ARENA_WEB_PLAYER_STATES.hit.impactAnglePeriodMs) *
          ARENA_WEB_PLAYER_STATES.hit.impactAngleAmplitudeDegrees
      );
  }

  private hasMageCatalogDamageImpact(playerId: string) {
    return Boolean(
      this.snapshot?.effects.some(
        (effect) =>
          effect.type === "damage_number" &&
          effect.targetId === playerId &&
          effect.skillId?.startsWith("mage_")
      )
    );
  }

  private updateArcherChargeMeter(view: PlayerView, player: PublicPlayer) {
    const charge = this.getArcherChargeProgress(player);
    if (!charge) {
      view.archerChargeBack.setVisible(false);
      view.archerChargeFill.setVisible(false);
      for (const tick of view.archerChargeTicks) {
        tick.setVisible(false);
      }
      return;
    }

    view.archerChargeBack
      .setVisible(true)
      .setStrokeStyle(2, charge.ratio >= 1 ? 0xf7d36a : 0x5b4021);
    view.archerChargeFill
      .setVisible(true)
      .setFillStyle(charge.ratio >= 1 ? 0xf2c84b : charge.stage >= COMBAT.archerChargeStages - 1 ? 0xbfe25a : 0x78d85d, 1);
    view.archerChargeFill.width = Math.max(4, ARCHER_CHARGE_FILL_WIDTH * charge.ratio);

    view.archerChargeTicks.forEach((tick, index) => {
      tick
        .setVisible(true)
        .setFillStyle(index + 1 < charge.stage ? 0xf8e39b : 0x2b2114, index + 1 < charge.stage ? 0.95 : 0.82);
    });
  }

  private getArcherChargeProgress(player: PublicPlayer) {
    if (!this.isArcherChargePose(player)) {
      return null;
    }

    const serverTime = this.snapshot?.serverTime ?? Date.now();
    const elapsed = Math.max(0, serverTime - player.actionStartedAt);
    const maxElapsed = this.getArcherMaxChargeDuration();
    const ratio = Phaser.Math.Clamp(elapsed / maxElapsed, 0, 1);
    const stage = Math.max(1, Math.min(COMBAT.archerChargeStages, Math.floor(elapsed / COMBAT.archerChargeStageMs) + 1));
    return { ratio, stage };
  }

  private isArcherChargePose(player: PublicPlayer) {
    return (
      player.alive &&
      player.classId === "archer" &&
      player.action === "attack" &&
      player.actionStartedAt > 0 &&
      player.actionEndsAt - player.actionStartedAt >= this.getArcherMaxChargeDuration()
    );
  }

  private isArcherFullDrawPose(player: PublicPlayer) {
    const actionBody = this.getCatalogActionBody(player);
    return (
      player.alive &&
      player.classId === "archer" &&
      (actionBody === "archer-bow" ||
        (!actionBody &&
          (player.action === "attack" || player.action === "skillE" || player.action === "skillR")))
    );
  }

  private isArcherMovingDraw(player: PublicPlayer, moving: boolean) {
    return moving && this.isArcherChargePose(player);
  }

  private getArcherMaxChargeDuration() {
    return Math.max(1, (COMBAT.archerChargeStages - 1) * COMBAT.archerChargeStageMs);
  }

  private renderProjectiles(projectiles: ProjectileState[]) {
    const ids = new Set(projectiles.map((projectile) => projectile.id));
    for (const [id, view] of this.projectileViews) {
      if (!ids.has(id)) {
        view.trail?.destroy();
        view.sprite.destroy();
        this.projectileViews.delete(id);
      }
    }

    for (const projectile of projectiles) {
      let view = this.projectileViews.get(projectile.id);
      if (!view) {
        if (projectile.sourceTurretId && this.isMagicTurretProjectile(projectile.type)) {
          this.turretFireTimes.set(projectile.sourceTurretId, this.time.now);
        }
        view = this.createProjectileView(projectile);
        this.projectileViews.set(projectile.id, view);
      }

      // Contact tethers must remain attached to the actor after the server's
      // 200-unit pull. Interpolating this retained recovery pose creates a
      // visible one-frame gap between the authored tip and the target.
      const visual =
        this.shouldRenderConfigurationTether(projectile) &&
        projectile.phase === "contact"
          ? { x: projectile.x, y: projectile.y }
          : this.interpolatePoint(
              view.visualX,
              view.visualY,
              projectile.x,
              projectile.y,
              FAST_ENTITY_INTERPOLATION,
              FAST_ENTITY_SNAP_DISTANCE
            );
      view.visualX = visual.x;
      view.visualY = visual.y;
      const runtimeEntry = projectile.skillId
        ? getArenaSkillRuntimeEntry(projectile.skillId)
        : null;
      const sourceAngle =
        runtimeEntry?.visualContract.projectileSize
          ? runtimeEntry.visualContract.sourceAngleDegrees
          : 0;
      const rotation = Phaser.Math.DegToRad(
        projectile.angle - sourceAngle
      );
      const frame = this.getProjectileFrame(projectile, view.createdAt);
      const [width, height] = this.getProjectileDisplaySize(projectile);
      const preservesConfigurationProjectile =
        runtimeEntry?.visualContract.projectileLaunchScale === false;
      const pulse = preservesConfigurationProjectile || this.isMagicTurretProjectile(projectile.type)
        ? 1
        : 1 + Math.sin((this.time.now + frame * 23) / 120) * 0.025;
      const launchScale = preservesConfigurationProjectile
        ? 1
        : this.getProjectileLaunchScale(view);

      if (!view.trail && this.shouldRenderProjectileTrail(projectile)) {
        view.trail = this.createProjectileTrail(projectile, frame);
      }
      if (view.trail && this.shouldRenderConfigurationTether(projectile)) {
        const owner = this.snapshot?.players.find(
          (player) => player.id === projectile.ownerId
        );
        if (owner) {
          const start = getArcherThrowAnchor(owner);
          const end = { x: view.visualX, y: view.visualY };
          const tetherAngle = Math.atan2(end.y - start.y, end.x - start.x);
          const tetherLength = Math.hypot(end.x - start.x, end.y - start.y);
          const tether = projectile.skillId
            ? getArenaSkillRuntimeEntry(projectile.skillId)?.tetherAsset
            : null;
          if (!tether || tether.fallbackUsed) {
            throw new Error(
              `${projectile.skillId ?? "unknown"} is missing its package-local tether`
            );
          }
          // A NineSlice cannot render narrower than its two authored caps.
          // Keep that minimum width entirely in front of the Archer's hand;
          // centring it on a very short launch path made its rear edge float
          // behind the hand until the projectile travelled far enough.
          const displayLength = Math.max(
            tetherLength,
            view.trail.leftWidth + view.trail.rightWidth
          );
          const unitX = Math.cos(tetherAngle);
          const unitY = Math.sin(tetherAngle);
          view.trail
            .setVisible(true)
            .setPosition(
              start.x + unitX * displayLength * 0.5,
              start.y + unitY * displayLength * 0.5
            )
            .setRotation(tetherAngle)
            .setDepth(view.visualY + 38)
            .setSize(displayLength, tether.displayHeight)
            .setAlpha(0.96)
            .clearTint()
            .setBlendMode(Phaser.BlendModes.NORMAL);
        }
      }

      view.sprite
        .setPosition(view.visualX, view.visualY)
        .setTexture(this.getProjectileTexture(projectile, frame))
        .setFrame(this.getProjectileSourceFrame(projectile, frame))
        .setRotation(rotation)
        .setDepth(view.visualY + 42)
        .setDisplaySize(width * launchScale * pulse, height * launchScale)
        .setAlpha(this.getProjectileAlpha(projectile, launchScale))
        .setVisible(
          projectile.skillId !== "archer_04" &&
            projectile.skillId !== "archer_07"
        )
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
        this.turretFireTimes.delete(id);
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
      const serverTime = this.snapshot?.serverTime ?? Date.now();
      const deployProgress = Phaser.Math.Clamp(
        (serverTime - turret.deployedAt) / (14 * 90),
        0,
        1
      );
      const revealProgress = Phaser.Math.Clamp(
        (deployProgress - 0.18) / 0.44,
        0,
        1
      );
      // The mechanical deploy ring and the live turret share one grounded
      // semantic anchor. Only the magic turret keeps the authored rise-in.
      const bodyRise = turret.kind === "mechanical" ? 0 : (1 - revealProgress) * 8;
      view.container.setPosition(view.visualX, view.visualY + bodyRise);
      view.container.setDepth(view.visualY + 26);
      const shieldActive = turret.shield > 0 && turret.shieldEndsAt > serverTime;
      const isOwnTurret = turret.ownerId === this.snapshot?.selfId;
      const relationColor = isOwnTurret ? 0x75f06a : 0xff625d;
      const relationFill = isOwnTurret ? 0x123d17 : 0x461416;
      const fireFrame = this.getTurretFireFrame(turret.id);
      if (turret.kind === "mechanical") {
        view.base
          .setVisible(true)
          .setTexture(getCombatObjectTexture("turretBase"))
          .setDisplaySize(MECHANICAL_TURRET_BODY_SIZE, MECHANICAL_TURRET_BODY_SIZE);
        view.body
          .setTexture(
            getCombatObjectTexture(fireFrame > 0 ? "turretHeadFiring" : "turretHead")
          )
          .setFrame(0)
          .setPosition(0, MECHANICAL_TURRET_BODY_Y)
          .setOrigin(0.5)
          .setRotation(Phaser.Math.DegToRad(turret.angle))
          .setDisplaySize(MECHANICAL_TURRET_BODY_SIZE, MECHANICAL_TURRET_BODY_SIZE);
      } else {
        view.base.setVisible(false);
        view.body
          .setTexture(getMagicTurretFrameTexture(fireFrame))
          .setFrame(0)
          .setPosition(0, TURRET_ANCHOR_Y)
          .setOrigin(0.5, MAGIC_TURRET_GROUND_ORIGIN_Y)
          .setRotation(0)
          .setDisplaySize(MAGIC_TURRET_DISPLAY_SIZE.width, MAGIC_TURRET_DISPLAY_SIZE.height);
      }
      const isMechanical = turret.kind === "mechanical";
      const healthY = isMechanical ? MECHANICAL_TURRET_HEALTH_Y : MAGIC_TURRET_HEALTH_Y;
      view.shadow.setDisplaySize(
        isMechanical ? 56 : MAGIC_TURRET_SHADOW_SIZE.width,
        isMechanical ? 14 : MAGIC_TURRET_SHADOW_SIZE.height
      );
      view.anchor.setDisplaySize(
        isMechanical ? 42 : MAGIC_TURRET_ANCHOR_SIZE.width,
        isMechanical ? 11 : MAGIC_TURRET_ANCHOR_SIZE.height
      );
      view.shield
        .setPosition(0, isMechanical ? MECHANICAL_TURRET_SHIELD_Y : MAGIC_TURRET_SHIELD_Y)
        .setDisplaySize(
          isMechanical ? 72 : MAGIC_TURRET_SHIELD_SIZE,
          isMechanical ? 72 : MAGIC_TURRET_SHIELD_SIZE
        )
        .setVisible(shieldActive && revealProgress >= 1)
        .setFrame(Math.floor(this.time.now / 110) % 6)
        .setAlpha(0.72 + Math.sin(this.time.now / 145) * 0.08);
      const revealAlpha = Phaser.Math.Easing.Cubic.Out(revealProgress);
      view.base.setAlpha(revealAlpha);
      view.body.setAlpha(revealAlpha);
      view.shadow
        .setAlpha((shieldActive ? 0.5 : 0.42) * revealAlpha)
        .setScale(shieldActive ? 1.08 : 1, shieldActive ? 1.03 : 1);
      view.anchor
        .setFillStyle(relationFill, shieldActive ? 0.28 : 0.2)
        .setStrokeStyle(3, relationColor, shieldActive ? 0.78 : 0.62)
        .setAlpha(revealAlpha);
      view.healthBack.setPosition(0, healthY);
      view.health.setPosition(-TURRET_HEALTH_WIDTH / 2, healthY);
      view.health.width = Math.max(0, TURRET_HEALTH_WIDTH * (turret.health / turret.maxHealth));
      view.health.setFillStyle(relationColor, 1);
      view.ownerMarker
        .setPosition(0, healthY - 7)
        .setFillStyle(relationColor, 1)
        .setStrokeStyle(1, isOwnTurret ? 0x183c18 : 0x4a1111, 1)
        .setAngle(45)
        .setAlpha(revealAlpha);
      const healthVisible = deployProgress >= (isMechanical ? 0.82 : 0.65);
      view.healthBack.setVisible(healthVisible);
      view.health.setVisible(healthVisible);
      view.ownerMarker.setVisible(healthVisible);
    }
  }

  private getTurretFireFrame(turretId: string) {
    const firedAt = this.turretFireTimes.get(turretId);
    if (firedAt === undefined) {
      return 0;
    }
    const age = this.time.now - firedAt;
    if (age < 0 || age >= TURRET_FIRE_FRAME_MS * (TURRET_FIRE_FRAME_COUNT - 1)) {
      return 0;
    }
    return 1 + Math.floor(age / TURRET_FIRE_FRAME_MS);
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

  private renderAttackBoostPacks(packs: AttackBoostPackState[]) {
    const ids = new Set(packs.map((pack) => pack.id));
    for (const [id, view] of this.attackPackViews) {
      if (!ids.has(id)) {
        view.container.destroy(true);
        this.attackPackViews.delete(id);
      }
    }

    for (const pack of packs) {
      let view = this.attackPackViews.get(pack.id);
      if (!view) {
        view = this.createAttackBoostPackView(pack);
        this.attackPackViews.set(pack.id, view);
      }
      const visual = this.interpolatePoint(view.visualX, view.visualY, pack.x, pack.y, SLOW_ENTITY_INTERPOLATION, SLOW_ENTITY_SNAP_DISTANCE);
      view.visualX = visual.x;
      view.visualY = visual.y;
      const phase = this.time.now / 320 + pack.id.length;
      const pulse = 1 + Math.sin(phase) * 0.045;
      const glowPulse = 0.72 + Math.sin(phase + 0.8) * 0.18;
      view.container.setPosition(view.visualX, view.visualY + Math.sin(phase) * 3);
      view.container.setDepth(view.visualY + 6);
      view.logo
        .clearTint()
        .setAlpha(0.98)
        .setScale(pulse);
      view.aura
        .setFillStyle(0xff655e, 0.16 + glowPulse * 0.08)
        .setStrokeStyle(2, 0xffd36f, 0.28 + glowPulse * 0.14)
        .setScale(1 + glowPulse * 0.08, 1 + glowPulse * 0.04);
      view.sparkle
        .setTint(0xffd36f)
        .setAlpha(0.36 + glowPulse * 0.26)
        .setAngle(-this.time.now / 22 + pack.id.length * 17)
        .setDisplaySize(24 + glowPulse * 8, 24 + glowPulse * 8);
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

  private renderDuelRealm(realm: DuelRealmState | null) {
    this.duelRealmMaskGraphics.clear();
    this.duelRealmBoundary.clear();

    const serverTime = this.snapshot?.serverTime ?? Date.now();
    if (!realm || serverTime >= realm.endsAt) {
      this.duelRealmBackdrop.setVisible(false);
      this.duelRealmBoundary.setVisible(false);
      return;
    }

    const intro = Phaser.Math.Clamp(
      (serverTime - realm.startedAt) / ARENA_DUEL_REALM.transitionMs,
      0,
      1
    );
    const outro = Phaser.Math.Clamp(
      (realm.endsAt - serverTime) / ARENA_DUEL_REALM.transitionMs,
      0,
      1
    );
    const transition = Math.min(intro, outro);
    const eased = Phaser.Math.Easing.Cubic.InOut(transition);
    const camera = this.cameras.main;
    const viewportWidth = camera.width / Math.max(camera.zoom, 0.01) + 4;
    const viewportHeight = camera.height / Math.max(camera.zoom, 0.01) + 4;
    this.duelRealmBackdrop
      .setPosition(camera.worldView.x - 2, camera.worldView.y - 2)
      .setSize(viewportWidth, viewportHeight)
      .setTilePosition(camera.worldView.x, camera.worldView.y);
    const viewportDiagonal =
      Math.hypot(camera.width, camera.height) / Math.max(camera.zoom, 0.01);
    const openRadius = viewportDiagonal * 1.35;
    const radiusX = Phaser.Math.Linear(openRadius, realm.radiusX, eased);
    const radiusY = Phaser.Math.Linear(openRadius, realm.radiusY, eased);

    this.duelRealmMaskGraphics
      .fillStyle(0xffffff, 1)
      .fillEllipse(
        realm.centerX,
        realm.centerY,
        radiusX * 2,
        radiusY * 2
      );
    this.duelRealmBackdrop
      .setVisible(true)
      .setAlpha(1);

    const boundaryAlpha = Phaser.Math.Clamp(transition * 1.2, 0, 1);
    if (boundaryAlpha <= 0.02) {
      this.duelRealmBoundary.setVisible(false);
      return;
    }

    this.duelRealmBoundary
      .setVisible(true)
      .lineStyle(12, 0x170b27, 0.88 * boundaryAlpha)
      .strokeEllipse(
        realm.centerX,
        realm.centerY,
        radiusX * 2,
        radiusY * 2
      )
      .lineStyle(6, 0x7438aa, 0.94 * boundaryAlpha)
      .strokeEllipse(
        realm.centerX,
        realm.centerY,
        radiusX * 2,
        radiusY * 2
      )
      .lineStyle(2, 0xd7a6ff, 0.9 * boundaryAlpha)
      .strokeEllipse(
        realm.centerX,
        realm.centerY,
        radiusX * 2,
        radiusY * 2
      );
  }

  private renderVfxSprites(effects: EffectState[], serverTime: number) {
    const vfxEffects = effects.filter(
      (effect) =>
        effect.skillId !== "warrior_13" &&
        getEffectVfxSpec(effect)
    );
    const ids = new Set(vfxEffects.map((effect) => effect.id));

    for (const [id, view] of this.vfxViews) {
      if (!ids.has(id)) {
        view.image.destroy();
        view.pathCore?.destroy();
        view.impactRing?.destroy();
        this.vfxViews.delete(id);
      }
    }

    for (const snapshotEffect of vfxEffects) {
      const effect = this.resolveDynamicVfxGeometry(snapshotEffect);
      const spec = getEffectVfxSpec(effect);
      // engineer_06 has authored 72–136 ms impact holds. Advancing those
      // frames from snapshot.serverTime alone quantizes the animation to the
      // server's roughly 100 ms broadcast cadence and can skip real source
      // frames. Interpolate only this skill between snapshots so every
      // accepted frame is rendered at the intended normal-speed cadence.
      const effectRenderTime =
        effect.skillId === "engineer_06" && this.snapshotReceivedAtMs > 0
          ? serverTime + Math.max(0, performance.now() - this.snapshotReceivedAtMs)
          : serverTime;
      const elapsedMs = Math.max(0, effectRenderTime - effect.startedAt);
      const progress = Phaser.Math.Clamp(elapsedMs / effect.duration, 0, 1);
      if (!spec) {
        continue;
      }

      const secondaryRole =
        spec.source === "catalog"
          ? this.getCatalogSecondaryEffectRole(snapshotEffect, progress)
          : null;
      const runtimeMotion =
        spec.source === "catalog"
          ? this.getCatalogRuntimeMotionPresentation(
              snapshotEffect,
              elapsedMs
            )
          : null;
      let frame = getRenderedVfxFrame(
        spec,
        progress,
        elapsedMs,
        effect.duration
      );
      if (spec.source === "catalog" && runtimeMotion) {
        const runtime = getArenaSkillRuntimeEntry(spec.key);
        if (runtime) {
          frame = runtimeMotion.frame;
        }
      } else if (spec.source === "catalog" && secondaryRole === "impact") {
        const impact = getArenaSkillRuntimeImpactAsset(spec.key);
        if (impact) {
          const impactPhase = this.getConfigSiegeRuntimePhase("impact");
          frame = getArenaSkillRuntimeFrameAtProgress(
            impact,
            Phaser.Math.Clamp(
              (progress - impactPhase.startProgress) /
                Math.max(
                  0.001,
                  impactPhase.endProgress - impactPhase.startProgress
                ),
              0,
              1
            )
          );
        }
      } else if (
        spec.source === "catalog" &&
        secondaryRole === "alternate"
      ) {
        const alternate = getArenaSkillRuntimeAlternateEffectAsset(spec.key);
        if (alternate) {
          frame = getArenaSkillRuntimeFrameAtProgress(alternate, progress);
        }
      }
      const siegeProjectile =
        spec.source === "catalog"
          ? this.getConfigSiegeProjectilePresentation(
              snapshotEffect,
              progress
            )
          : null;
      if (siegeProjectile) {
        frame = siegeProjectile.frame;
      }
      const texture =
        spec.source === "catalog" && secondaryRole
          ? getArenaSkillRuntimeSecondaryFrameTexture(
              spec.key,
              secondaryRole,
              frame
            )
          : getRenderedVfxTexture(spec, frame);
      const specOffset = getRenderedVfxOffset(spec);
      const renderedEffect = runtimeMotion
        ? {
            ...effect,
            x: runtimeMotion.x,
            y: runtimeMotion.y,
            angle: Phaser.Math.RadToDeg(runtimeMotion.rotationRadians)
          }
        : siegeProjectile
        ? {
            ...effect,
            x: siegeProjectile.x,
            y: siegeProjectile.y,
            angle: siegeProjectile.angle
          }
        : {
            ...effect,
            x: effect.x + specOffset.x,
            y: effect.y + specOffset.y
          };
      let view = this.vfxViews.get(effect.id);
      if (!view) {
        if (siegeProjectile?.sourceTurretId) {
          this.turretFireTimes.set(
            effect.sourceTurretId ?? siegeProjectile.sourceTurretId,
            this.time.now
          );
        }
        const image = this.add
          .image(renderedEffect.x, renderedEffect.y, texture)
          .setDepth(getRenderedVfxDepth(renderedEffect, spec, progress));
        const pathCore = getRenderedVfxPathCore(spec)
          ? this.add.graphics()
          : undefined;
        const impactRing =
          snapshotEffect.skillId === "archer_14"
            ? this.add.graphics()
            : undefined;
        view = { image, pathCore, impactRing };
        this.vfxViews.set(effect.id, view);
      }

      let size = runtimeMotion
        ? {
            width: runtimeMotion.width,
            height: runtimeMotion.height,
            alpha: runtimeMotion.visible ? 0.96 : 0
          }
        : siegeProjectile
        ? {
            width: siegeProjectile.width,
            height: siegeProjectile.height,
            alpha: 0.98
          }
        : getRenderedVfxDisplay(renderedEffect, spec, progress);
      if (secondaryRole === "impact") {
        size = {
          ...size,
          alpha: this.getConfigSiegeImpactAlpha(progress)
        };
      }
      const origin = runtimeMotion
        ? { x: 0.5, y: 0.5 }
        : spec.source === "catalog" &&
            spec.key === "engineer_06" &&
            secondaryRole === "impact"
          ? this.getConfigSiegeImpactOrigin()
          : getRenderedVfxOrigin(spec);
      const pathCoreSpec = getRenderedVfxPathCore(spec);
      const hidesStretchedSegment =
        pathCoreSpec?.kind === "repeated-links";
      view.image
        .setTexture(texture)
        .setPosition(renderedEffect.x, renderedEffect.y)
        .setOrigin(origin.x, origin.y)
        .setRotation(
          runtimeMotion
            ? runtimeMotion.rotationRadians
            : siegeProjectile
            ? Phaser.Math.DegToRad(siegeProjectile.angle)
            : shouldRotateVfx(spec)
              ? Phaser.Math.DegToRad(renderedEffect.angle)
              : 0
        )
        .setDisplaySize(size.width, size.height)
        .setAlpha(hidesStretchedSegment ? 0 : size.alpha)
        .setBlendMode(getPhaserVfxBlendMode(getRenderedVfxBlendMode(spec)))
        .setDepth(getRenderedVfxDepth(renderedEffect, spec, progress));

      if (view.impactRing) {
        const timelineProgress = runtimeMotion?.timelineProgress ?? -1;
        const impactStarted = timelineProgress >= 0.78;
        const ringAlpha = impactStarted
          ? Phaser.Math.Clamp(
              (timelineProgress - 0.78) / 0.12,
              0,
              1
            )
          : 0;
        const radius = snapshotEffect.radius;
        view.impactRing
          .clear()
          .setVisible(ringAlpha > 0)
          .setAlpha(ringAlpha)
          .setDepth(snapshotEffect.y + 30);
        if (ringAlpha > 0) {
          view.impactRing
            .fillStyle(0x9b5b18, 0.18)
            .fillEllipse(
              snapshotEffect.x,
              snapshotEffect.y,
              radius * 2,
              radius * 0.82
            )
            .lineStyle(6, 0xf3b847, 0.58)
            .strokeEllipse(
              snapshotEffect.x,
              snapshotEffect.y,
              radius * 2,
              radius * 0.82
            )
            .lineStyle(2, 0xfff0a6, 0.96)
            .strokeEllipse(
              snapshotEffect.x,
              snapshotEffect.y,
              radius * 2,
              radius * 0.82
            );
        }
      }

      if (view.pathCore && pathCoreSpec) {
        let endX = renderedEffect.endX ?? renderedEffect.x;
        let endY = renderedEffect.endY ?? renderedEffect.y;
        let startX = renderedEffect.x * 2 - endX;
        let startY = renderedEffect.y * 2 - endY;
        const insideActiveWindow =
          snapshotEffect.activeStartedAt === undefined ||
          snapshotEffect.activeDuration === undefined ||
          (serverTime >= snapshotEffect.activeStartedAt &&
            serverTime <
              snapshotEffect.activeStartedAt + snapshotEffect.activeDuration);
        let pathVisible = size.alpha > 0 && insideActiveWindow;
        let moteX: number | undefined;
        let moteY: number | undefined;

        if (pathCoreSpec.kind === "effect-to-owner") {
          const owner = snapshotEffect.ownerId
            ? this.snapshot?.players.find(
                (player) => player.id === snapshotEffect.ownerId
              )
            : null;
          const activeProgress = pathCoreSpec.activeProgress ?? [0, 1];
          pathVisible = Boolean(
            owner &&
              insideActiveWindow &&
              progress >= activeProgress[0] &&
              progress < activeProgress[1]
          );
          startX = renderedEffect.x;
          startY = renderedEffect.y;
          if (owner) {
            const runtime =
              spec.source === "catalog"
                ? getArenaSkillRuntimeEntry(spec.key)
                : null;
            const scale = runtime
              ? getArenaSkillRuntimeScale(
                  runtime,
                  PLAYER_SPRITE_DISPLAY_SIZE.height
                )
              : 1;
            const ownerOffset = pathCoreSpec.ownerOffset ?? [0, 0];
            endX = owner.x + ownerOffset[0] * scale;
            endY = owner.y + ownerOffset[1] * scale;
            const travel = pathCoreSpec.moteTravelProgress;
            if (pathVisible && travel) {
              const amount = Phaser.Math.Clamp(
                (progress - travel[0]) / Math.max(0.001, travel[1] - travel[0]),
                0,
                1
              );
              moteX = Phaser.Math.Linear(startX, endX, amount);
              moteY = Phaser.Math.Linear(startY, endY, amount);
            }
          }
        }

        view.pathCore
          .clear()
          .setVisible(pathVisible)
          .setAlpha(size.alpha)
          .setDepth(getRenderedVfxDepth(renderedEffect, spec, progress) + 0.01);
        let pulseStep: number | undefined;
        if (pathVisible) {
          if (pathCoreSpec.kind === "repeated-links") {
            pulseStep = Math.floor(
              (serverTime -
                (snapshotEffect.activeStartedAt ?? snapshotEffect.startedAt)) /
                120
            ) % 3;
            this.drawRepeatedSoulChainLinks(
              view.pathCore,
              startX,
              startY,
              endX,
              endY,
              pathCoreSpec,
              pulseStep
            );
          } else if (
            pathCoreSpec.kind === "effect-to-owner" &&
            snapshotEffect.skillId === "mage_02"
          ) {
            this.drawSoulSiphonLine(
              view.pathCore,
              startX,
              startY,
              endX,
              endY,
              pathCoreSpec
            );
          } else {
            view.pathCore
              .lineStyle(
                pathCoreSpec.outerWidth,
                pathCoreSpec.outerColor,
                0.98
              )
              .lineBetween(startX, startY, endX, endY)
              .lineStyle(
                pathCoreSpec.innerWidth,
                pathCoreSpec.innerColor,
                1
              )
              .lineBetween(startX, startY, endX, endY);
          }
          if (
            moteX !== undefined &&
            moteY !== undefined &&
            pathCoreSpec.moteColor !== undefined
          ) {
            const runtime =
              spec.source === "catalog"
                ? getArenaSkillRuntimeEntry(spec.key)
                : null;
            const scale = runtime
              ? getArenaSkillRuntimeScale(
                  runtime,
                  PLAYER_SPRITE_DISPLAY_SIZE.height
                )
              : 1;
            const moteSize = Math.max(
              1,
              (pathCoreSpec.moteSize ?? 1) * scale
            );
            view.pathCore
              .fillStyle(pathCoreSpec.moteColor, 1)
              .fillRect(
                moteX - moteSize / 2,
                moteY - moteSize / 2,
                moteSize,
                moteSize
              );
          }
        }
        view.pathCoreState = {
          visible: pathVisible,
          kind: pathCoreSpec.kind,
          startX,
          startY,
          endX,
          endY,
          ...(moteX === undefined ? {} : { moteX }),
          ...(moteY === undefined ? {} : { moteY }),
          ...(pulseStep === undefined ? {} : { pulseStep })
        };
      }
    }
  }

  private getCatalogRuntimeMotionPresentation(
    effect: EffectState,
    elapsedMs: number
  ) {
    if (!effect.skillId) {
      return null;
    }
    const runtime = getArenaSkillRuntimeEntry(effect.skillId);
    const motion = runtime?.runtimeMotion;
    if (!runtime || !motion) {
      return null;
    }

    const timelineProgress = Phaser.Math.Clamp(
      elapsedMs / motion.durationMs,
      0,
      1
    );
    const scale = getArenaSkillRuntimeScale(
      runtime,
      PLAYER_SPRITE_DISPLAY_SIZE.height
    );
    const frameAtProgress = (frames: number[], progress: number) =>
      frames[
        Math.min(
          frames.length - 1,
          Math.floor(Phaser.Math.Clamp(progress, 0, 0.999999) * frames.length)
        )
      ];

    if (motion.kind === "effect-source-to-target-shot") {
      if (
        effect.startX === undefined ||
        effect.startY === undefined ||
        effect.endX === undefined ||
        effect.endY === undefined
      ) {
        throw new Error(
          `${effect.skillId} requires an explicit source-to-target motion path`
        );
      }
      const targetX = effect.endX + motion.targetOffset[0] * scale;
      const targetY = effect.endY + motion.targetOffset[1] * scale;
      if (timelineProgress < motion.warningEndProgress) {
        const warningProgress =
          timelineProgress / Math.max(0.001, motion.warningEndProgress);
        return {
          x: targetX,
          y: targetY,
          width: motion.impactDisplaySize[0] * scale,
          height: motion.impactDisplaySize[1] * scale,
          visible: true,
          timelineProgress,
          frame: frameAtProgress(motion.warningFrameIndices, warningProgress),
          rotationRadians: 0
        };
      }
      if (timelineProgress < motion.travelEndProgress) {
        const travelProgress = Phaser.Math.Clamp(
          (timelineProgress - motion.warningEndProgress) /
            Math.max(
              0.001,
              motion.travelEndProgress - motion.warningEndProgress
            ),
          0,
          1
        );
        const pathAngle = Math.atan2(
          targetY - effect.startY,
          targetX - effect.startX
        );
        return {
          x: Phaser.Math.Linear(effect.startX, targetX, travelProgress),
          y: Phaser.Math.Linear(effect.startY, targetY, travelProgress),
          width: motion.travelDisplaySize[0] * scale,
          height: motion.travelDisplaySize[1] * scale,
          visible: true,
          timelineProgress,
          frame: frameAtProgress(motion.travelFrameIndices, travelProgress),
          rotationRadians:
            pathAngle - Phaser.Math.DegToRad(motion.sourceAngleDegrees)
        };
      }
      const impactProgress = Phaser.Math.Clamp(
        (timelineProgress - motion.travelEndProgress) /
          Math.max(0.001, 1 - motion.travelEndProgress),
        0,
        1
      );
      return {
        x: targetX,
        y: targetY,
        width: motion.impactDisplaySize[0] * scale,
        height: motion.impactDisplaySize[1] * scale,
        visible: timelineProgress < motion.visibleEndProgress,
        timelineProgress,
        frame: frameAtProgress(motion.impactFrameIndices, impactProgress),
        rotationRadians: 0
      };
    }

    const travelling = timelineProgress < motion.travelEndProgress;
    const amount = travelling
      ? Phaser.Math.Clamp(
          timelineProgress / motion.travelEndProgress,
          0,
          1
        )
      : 1;
    const eased = motion.easing === "quadratic-in" ? amount * amount : amount;
    const offset = travelling
      ? {
          x: Phaser.Math.Linear(
            motion.startOffset[0],
            motion.impactOffset[0],
            eased
          ),
          y: Phaser.Math.Linear(
            motion.startOffset[1],
            motion.impactOffset[1],
            eased
          )
        }
      : {
          x: motion.impactOffset[0],
          y: motion.impactOffset[1]
        };
    const referenceSize = travelling
      ? motion.travelDisplaySize
      : motion.impactDisplaySize;
    const frame = travelling
      ? motion.travelFrameIndices[
          Math.min(
            motion.travelFrameIndices.length - 1,
            Math.floor(
              Phaser.Math.Clamp(amount, 0, 1) *
                (motion.travelFrameIndices.length - 1) +
                0.5
            )
          )
        ]
      : motion.impactFrameIndices[
          timelineProgress < motion.impactFrameSwitchProgress ? 0 : 1
        ];

    return {
      x: effect.x + offset.x * scale,
      y: effect.y + offset.y * scale,
      width: referenceSize[0] * scale,
      height: referenceSize[1] * scale,
      visible: timelineProgress < motion.visibleEndProgress,
      timelineProgress,
      frame,
      rotationRadians: 0
    };
  }

  private getCatalogSecondaryEffectRole(
    effect: EffectState,
    progress: number
  ): "impact" | "alternate" | null {
    if (
      effect.skillId === "engineer_06" &&
      getArenaSkillRuntimeImpactAsset("engineer_06") &&
      progress >= this.getConfigSiegeRuntimePhase("impact").startProgress
    ) {
      return "impact";
    }
    if (
      effect.skillId !== "engineer_09" ||
      !getArenaSkillRuntimeAlternateEffectAsset("engineer_09")
    ) {
      return null;
    }
    const turret = this.snapshot?.turrets.find(
      (candidate) =>
        Math.hypot(candidate.x - effect.x, candidate.y - effect.y) <= 6
    );
    return turret?.kind === "magic_missile" ? "alternate" : null;
  }

  private getConfigSiegeProjectilePresentation(
    effect: EffectState,
    progress: number
  ) {
    if (
      effect.skillId !== "engineer_06" ||
      !getArenaSkillRuntimeImpactAsset("engineer_06") ||
      !effect.sourceTurretId ||
      effect.startX === undefined ||
      effect.startY === undefined
    ) {
      return null;
    }
    const phase = this.getConfigSiegeRuntimePhase("projectile");
    if (progress >= phase.endProgress) {
      return null;
    }
    if (
      !phase ||
      phase.anchor !== "source-mechanical-turret-muzzle" ||
      phase.pathKind !== "linear" ||
      phase.controlLift !== 0 ||
      phase.lockToMuzzleHeight !== true ||
      !phase.displaySize ||
      phase.launchFrameIndex === undefined ||
      phase.flightFrameIndex === undefined ||
      phase.launchSourceAngleDegrees === undefined ||
      phase.flightSourceAngleDegrees === undefined
    ) {
      throw new Error(
        "engineer_06 requires an explicit linear turret-muzzle projectile contract"
      );
    }
    const start = { x: effect.startX, y: effect.startY };
    const end = { x: effect.x, y: start.y };
    const travelDuration = phase.endProgress - phase.startProgress;
    const travel = Phaser.Math.Clamp(
      (progress - phase.startProgress) / Math.max(0.001, travelDuration),
      0,
      1
    );
    const point = {
      x: Phaser.Math.Linear(start.x, end.x, travel),
      y: Phaser.Math.Linear(start.y, end.y, travel)
    };
    const frame =
      travel < 0.08
        ? phase.launchFrameIndex
        : phase.flightFrameIndex;
    const sourceAngle =
      frame === phase.launchFrameIndex
        ? phase.launchSourceAngleDegrees
        : phase.flightSourceAngleDegrees;
    return {
      ...point,
      angle: Phaser.Math.RadToDeg(
        Math.atan2(end.y - start.y, end.x - start.x)
      ) - sourceAngle,
      width: phase.displaySize[0],
      height: phase.displaySize[1],
      frame,
      sourceTurretId: effect.sourceTurretId
    };
  }

  private getConfigSiegeImpactOrigin() {
    const impact = getArenaSkillRuntimeImpactAsset("engineer_06");
    if (!impact?.semanticAnchor) {
      throw new Error(
        "engineer_06 impact requires an explicit package-local semantic anchor"
      );
    }
    const [anchorX, anchorY] = impact.semanticAnchor;
    if (
      anchorX < 0 ||
      anchorX > impact.frameWidth ||
      anchorY < 0 ||
      anchorY > impact.frameHeight
    ) {
      throw new Error("engineer_06 impact has an invalid full-canvas anchor");
    }
    return {
      x: anchorX / impact.frameWidth,
      y: anchorY / impact.frameHeight
    };
  }

  private getConfigSiegeRuntimePhase(role: "projectile" | "impact") {
    const runtime = getArenaSkillRuntimeEntry("engineer_06");
    const phase = runtime?.runtimePhases?.find(
      (candidate) => candidate.role === role
    );
    if (!phase) {
      throw new Error(
        `engineer_06 is missing its explicit package-local ${role} phase`
      );
    }
    return phase;
  }

  private getConfigSiegeImpactAlpha(progress: number) {
    const phase = this.getConfigSiegeRuntimePhase("impact");
    if (phase.fadeOutStartProgress === undefined) {
      throw new Error("engineer_06 impact is missing fadeOutStartProgress");
    }
    const localProgress = Phaser.Math.Clamp(
      (progress - phase.startProgress) /
        Math.max(0.001, phase.endProgress - phase.startProgress),
      0,
      1
    );
    if (localProgress <= phase.fadeOutStartProgress) {
      return 0.96;
    }
    const fadeProgress = Phaser.Math.Clamp(
      (localProgress - phase.fadeOutStartProgress) /
        (1 - phase.fadeOutStartProgress),
      0,
      1
    );
    return 0.96 * (1 - Phaser.Math.SmoothStep(fadeProgress, 0, 1));
  }

  private drawSoulSiphonLine(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    spec: ArenaSkillRuntimePathCore
  ) {
    const pathLength = Math.hypot(endX - startX, endY - startY);
    graphics
      .lineStyle(spec.outerWidth, spec.outerColor, 0.92)
      .lineBetween(startX, startY, endX, endY)
      .lineStyle(spec.innerWidth, spec.innerColor, 1)
      .lineBetween(startX, startY, endX, endY)
      .lineStyle(spec.outerWidth, spec.outerColor, 0.82)
      .strokeCircle(startX, startY, pathLength < 72 ? 13 : 10)
      .fillStyle(spec.moteColor ?? spec.innerColor, 0.92)
      .fillRect(startX - 2, startY - 14, 4, 4)
      .fillRect(startX + 9, startY + 3, 3, 3)
      .fillRect(startX - 11, startY + 5, 3, 3);
  }

  private drawRepeatedSoulChainLinks(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    spec: ArenaSkillRuntimePathCore,
    pulseStep: number
  ) {
    const pathLength = Math.hypot(endX - startX, endY - startY);
    if (!(pathLength > 0)) {
      return;
    }
    const tangentX = (endX - startX) / pathLength;
    const tangentY = (endY - startY) / pathLength;
    const perpendicularX = -tangentY;
    const perpendicularY = tangentX;
    const spacing = Math.max(8, spec.linkSpacing ?? 13);
    const halfLength = Math.max(3, (spec.linkLength ?? 9) / 2);
    const halfWidth = Math.max(2, (spec.linkWidth ?? 6) / 2);
    const linkCount = Math.max(2, Math.floor(pathLength / spacing));

    const drawLinks = (width: number, color: number, alpha: number) => {
      graphics.lineStyle(width, color, alpha);
      for (let index = 0; index < linkCount; index += 1) {
        const amount = (index + 0.5) / linkCount;
        const centerX = Phaser.Math.Linear(startX, endX, amount);
        const centerY = Phaser.Math.Linear(startY, endY, amount);
        graphics
          .beginPath()
          .moveTo(
            centerX - tangentX * halfLength,
            centerY - tangentY * halfLength
          )
          .lineTo(
            centerX + perpendicularX * halfWidth,
            centerY + perpendicularY * halfWidth
          )
          .lineTo(
            centerX + tangentX * halfLength,
            centerY + tangentY * halfLength
          )
          .lineTo(
            centerX - perpendicularX * halfWidth,
            centerY - perpendicularY * halfWidth
          )
          .closePath()
          .strokePath();
      }
    };
    drawLinks(spec.outerWidth, spec.outerColor, 0.96);
    drawLinks(spec.innerWidth, spec.innerColor, 1);
    graphics.fillStyle(spec.innerColor, 0.92);
    for (let index = pulseStep; index < linkCount; index += 3) {
      const amount = (index + 0.5) / linkCount;
      const centerX = Phaser.Math.Linear(startX, endX, amount);
      const centerY = Phaser.Math.Linear(startY, endY, amount);
      graphics.fillRect(centerX - 2, centerY - 2, 4, 4);
    }
  }

  private resolveDynamicVfxGeometry(effect: EffectState): EffectState {
    const owner = effect.ownerId
      ? this.snapshot?.players.find((player) => player.id === effect.ownerId)
      : null;
    const target = effect.targetId
      ? this.snapshot?.players.find((player) => player.id === effect.targetId)
      : null;
    const runtime =
      usesArenaCatalogRuntimeVfx(effect) && effect.skillId
        ? getArenaSkillRuntimeEntry(effect.skillId)
        : null;
    const contract = runtime
      ? getArenaSkillRuntimeVisualContract(runtime)
      : null;
    if (contract?.anchor === "path" && owner && target) {
      const origin =
        owner.classId === "mage"
          ? getMageStaffAnchor(owner)
          : { x: owner.x, y: owner.y };
      const end = {
        x: target.x,
        y:
          target.y +
          (owner.classId === "mage" ? MAGE_TARGET_TORSO_OFFSET_Y : 0)
      };
      const distance = Math.hypot(end.x - origin.x, end.y - origin.y);
      const angle = Phaser.Math.RadToDeg(
        Math.atan2(end.y - origin.y, end.x - origin.x)
      );
      return {
        ...effect,
        x: (origin.x + end.x) / 2,
        y: (origin.y + end.y) / 2,
        endX: end.x,
        endY: end.y,
        angle,
        radius: distance
      };
    }

    if (!usesArenaCatalogRuntimeVfx(effect) || !effect.skillId) {
      return effect;
    }

    const catalogRuntime = getArenaSkillRuntimeEntry(effect.skillId);
    if (!catalogRuntime) {
      return effect;
    }
    const offset = getArenaSkillRuntimeReferenceOffset(
      catalogRuntime,
      PLAYER_SPRITE_DISPLAY_SIZE.height
    );

    const targetOutwardOffset = contract?.pathCore?.targetOutwardOffset;
    if (contract?.anchor === "target" && targetOutwardOffset && owner && target) {
      const deltaX = target.x - owner.x;
      const deltaY = target.y - owner.y;
      const length = Math.hypot(deltaX, deltaY);
      const unitX =
        length > 1 ? deltaX / length : Math.cos(Phaser.Math.DegToRad(owner.angle));
      const unitY =
        length > 1 ? deltaY / length : Math.sin(Phaser.Math.DegToRad(owner.angle));
      return {
        ...effect,
        x: target.x + offset.x + unitX * targetOutwardOffset[0],
        y: target.y + offset.y + unitY * targetOutwardOffset[1]
      };
    }

    if (contract?.anchor === "target" && target) {
      return {
        ...effect,
        x: target.x + offset.x,
        y: target.y + offset.y
      };
    }
    if (contract?.anchor === "owner" && owner) {
      return {
        ...effect,
        x: owner.x + offset.x,
        y: owner.y + offset.y
      };
    }
    if (contract?.anchor === "owner_forward" && owner) {
      const forward = project(owner, owner.angle, offset.x);
      const placed = project(forward, owner.angle + 90, offset.y);
      return {
        ...effect,
        x: placed.x,
        y: placed.y,
        angle: owner.angle
      };
    }
    return {
      ...effect,
      x: effect.x + offset.x,
      y: effect.y + offset.y
    };
  }

  private renderFloatingTexts(effects: EffectState[], serverTime: number, selfId: string | null) {
    const floatingEffects = effects.filter(
      (effect) =>
        (
          effect.type === "damage_number" ||
          effect.type === "heal_number" ||
          effect.type === "reflect_damage"
        ) && typeof effect.value === "number"
    );
    const ids = new Set(floatingEffects.map((effect) => effect.id));

    for (const [id, view] of this.floatingTextViews) {
      if (!ids.has(id)) {
        view.container.destroy(true);
        this.floatingTextViews.delete(id);
      }
    }

    for (const effect of floatingEffects) {
      const progress = Phaser.Math.Clamp((serverTime - effect.startedAt) / effect.duration, 0, 1);
      const reflect = effect.type === "reflect_damage";
      const healing = effect.type === "heal_number";
      const selfOwned = Boolean(selfId && effect.ownerId === selfId);
      const tone = this.getFloatingTextTone(effect, selfOwned, reflect, healing);
      let view = this.floatingTextViews.get(effect.id);
      if (!view) {
        const value = Number.isInteger(effect.value)
          ? effect.value
          : Number(effect.value?.toFixed(1));
        const label = reflect
          ? `REFLECT -${value}`
          : healing
            ? `+${value}`
            : `-${value}`;
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

  private getFloatingTextTone(
    effect: EffectState,
    selfOwned: boolean,
    reflect: boolean,
    healing = false
  ) {
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

    if (healing) {
      return {
        text: "#d8ffd5",
        strokeText: "#102817",
        back: 0x17361f,
        backAlpha: 0.76,
        stroke: 0x79e68c,
        strokeAlpha: 0.86,
        accent: 0xa9ff9f
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
    const cameraAlpha = (alphaAt60Fps: number) =>
      frameRateIndependentAlpha(alphaAt60Fps, this.game.loop.delta);
    const self = this.getSelf();
    if (!self) {
      this.cameraFocus = null;
      const camera = this.cameras.main;
      const targetX = WORLD.width / 2 - camera.width / (2 * camera.zoom) + 150;
      const targetY = WORLD.height / 2 - camera.height / (2 * camera.zoom) - 80;
      camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetX, cameraAlpha(0.08));
      camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, cameraAlpha(0.08));
      return;
    }
    const camera = this.cameras.main;
    const renderedFocus = this.getRenderedSelfPosition(self);
    const hudState = useHudStore.getState();
    const mobileMove = hudState.mobileMove;
    const mobileMoveActive = this.isMobileMoveActive(mobileMove);
    const keyboardMoveX =
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    const keyboardMoveY =
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0);
    const move = {
      x: Phaser.Math.Clamp(keyboardMoveX + (mobileMoveActive ? mobileMove.x : 0), -1, 1),
      y: Phaser.Math.Clamp(keyboardMoveY + (mobileMoveActive ? mobileMove.y : 0), -1, 1)
    };
    const useTouchCamera = this.touchCamera || hudState.mobileControlsActive;
    const expectedZoom = getArenaCameraZoom(useTouchCamera);
    if (camera.zoom !== expectedZoom) {
      camera.setZoom(expectedZoom);
    }
    const focus = useTouchCamera
      ? advanceArenaCameraFocus({
          current: this.cameraFocus,
          renderedPlayer: renderedFocus,
          move,
          moveSpeed: CLASS_STATS[self.classId].moveSpeed * self.slowMultiplier,
          sprintMultiplier: COMBAT.sprintSpeedMultiplier,
          sprinting: self.sprinting || this.keys.SPACE.isDown || this.keys.SHIFT.isDown,
          movementLocked: !self.alive || self.rooted || self.stunned,
          deltaMs: this.game.loop.delta
        })
      : renderedFocus;
    this.cameraFocus = useTouchCamera ? focus : null;
    const targetX = focus.x - camera.width / (2 * camera.zoom);
    const mobileFocusOffset = camera.width < 760 ? 180 / camera.zoom : 0;
    const targetY = focus.y - camera.height / (2 * camera.zoom) + mobileFocusOffset;
    if (useTouchCamera) {
      camera.scrollX = alignArenaCameraScroll(targetX, camera.zoom);
      camera.scrollY = alignArenaCameraScroll(targetY, camera.zoom);
    } else {
      camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetX, cameraAlpha(0.12));
      camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, cameraAlpha(0.12));
    }
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

    const camera = this.cameras.main;
    const renderedPlayers = snapshot.players.map((player) => {
      const view = this.playerViews.get(player.id);
      return {
        id: player.id,
        visualX: view?.visualX ?? player.x,
        visualY: view?.visualY ?? player.y,
        containerX: view?.container.x ?? player.x,
        containerY: view?.container.y ?? player.y
      };
    });
    const debugSnapshot = {
      ...snapshot,
      camera: {
        x: camera.x,
        y: camera.y,
        width: camera.width,
        height: camera.height,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom
      },
      renderedPlayers
    };
    (window as typeof window & { __renaissArenaSnapshot?: typeof debugSnapshot }).__renaissArenaSnapshot = debugSnapshot;
  }

  private publishArenaDebugInput(input: PlayerInput) {
    if (new URLSearchParams(window.location.search).get("debugArena") !== "1") {
      return;
    }

    (window as typeof window & { __renaissArenaLastInput?: PlayerInput }).__renaissArenaLastInput = input;
  }

  private createPlayerView(player: PublicPlayer): PlayerView {
    const container = this.add.container(player.x, player.y);
    const statusDisplay = new PlayerStatusDisplay(this, container, PLAYER_GROUND_Y);
    const shadow = this.add.ellipse(0, PLAYER_GROUND_Y, 62, 20, 0x050505, 0.25);
    const koRune = this.add.image(0, PLAYER_GROUND_Y + 2, ARENA_DECAL_TEXTURES.diamondRune).setOrigin(0.5).setVisible(false);
    const initialTexture = getNewCompatibleWalkFrameTexture(player.classId, "south", 0);
    const actionGhost = this.add.image(0, 0, initialTexture).setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y).setVisible(false);
    const actionFxBack = this.add
      .image(0, 0, getAbilityVfxFrameTexture("warriorSlash", 0))
      .setOrigin(0.5)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    const sprite = this.add.image(0, 0, initialTexture).setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y).setDisplaySize(88, 104);
    const poisonOverlay = this.add
      .image(0, 0, initialTexture)
      .setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y)
      .setDisplaySize(88, 104)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);
    const concealmentOutline = createPlayerConcealmentOutline(
      this,
      initialTexture
    );
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
    const archerChargeBack = this.add
      .rectangle(0, ARCHER_CHARGE_BAR_Y, ARCHER_CHARGE_BAR_WIDTH, 8, 0x1a160f, 0.92)
      .setStrokeStyle(2, 0x5b4021)
      .setVisible(false);
    const archerChargeFill = this.add
      .rectangle(-ARCHER_CHARGE_FILL_WIDTH / 2, ARCHER_CHARGE_BAR_Y, 0, 4, 0x78d85d, 1)
      .setOrigin(0, 0.5)
      .setVisible(false);
    const archerChargeTicks = Array.from({ length: Math.max(0, COMBAT.archerChargeStages - 1) }, (_, index) =>
      this.add
        .rectangle(
          -ARCHER_CHARGE_FILL_WIDTH / 2 + ((index + 1) / COMBAT.archerChargeStages) * ARCHER_CHARGE_FILL_WIDTH,
          ARCHER_CHARGE_BAR_Y,
          2,
          8,
          0x2b2114,
          0.82
        )
        .setVisible(false)
    );

    container.add([
      shadow,
      koRune,
      actionGhost,
      actionFxBack,
      concealmentOutline,
      sprite,
      poisonOverlay,
      actionFxFront,
      hitImpact,
      name,
      archerChargeBack,
      archerChargeFill,
      ...archerChargeTicks,
      healthBack,
      healthFill,
      staminaBack,
      staminaFill
    ]);
    statusDisplay.bringForegroundToTop();
    return {
      container,
      shadow,
      koRune,
      statusDisplay,
      actionGhost,
      actionFxBack,
      concealmentOutline,
      sprite,
      poisonOverlay,
      actionFxFront,
      hitImpact,
      name,
      healthBack,
      healthFill,
      staminaBack,
      staminaFill,
      archerChargeBack,
      archerChargeFill,
      archerChargeTicks,
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
    const frame = this.getProjectileFrame(projectile, this.time.now);
    const sprite = this.add
      .image(projectile.x, projectile.y, this.getProjectileTexture(projectile, frame))
      .setFrame(this.getProjectileSourceFrame(projectile, frame))
      .setOrigin(0.5)
      .setDisplaySize(...this.getProjectileDisplaySize(projectile));
    let trail: Phaser.GameObjects.NineSlice | null = null;
    if (this.shouldRenderProjectileTrail(projectile)) {
      trail = this.createProjectileTrail(projectile, frame);
    }
    return { trail, sprite, visualX: projectile.x, visualY: projectile.y, createdAt: this.time.now };
  }

  private createProjectileTrail(projectile: ProjectileState, _frame: number) {
    if (!projectile.skillId) {
      throw new Error("A distance-driven tether requires an explicit skillId");
    }
    const tether = getArenaSkillRuntimeEntry(projectile.skillId)?.tetherAsset;
    if (!tether || tether.fallbackUsed || tether.stretch !== "three-slice-distance") {
      throw new Error(`${projectile.skillId} has no accepted three-slice tether`);
    }
    const displayScale = tether.displayHeight / tether.height;
    return this.add
      .nineslice(
        projectile.x,
        projectile.y,
        getArenaSkillRuntimeTetherTexture(projectile.skillId),
        undefined,
        Math.max(1, tether.width * displayScale),
        tether.displayHeight,
        Math.max(1, tether.leftCapSourcePx * displayScale),
        Math.max(1, tether.rightCapSourcePx * displayScale)
      )
      .setOrigin(0.5)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private createTurretView(turret: TurretState): TurretView {
    const container = this.add.container(turret.x, turret.y);
    const isMechanical = turret.kind === "mechanical";
    const healthY = isMechanical ? MECHANICAL_TURRET_HEALTH_Y : MAGIC_TURRET_HEALTH_Y;
    const shadow = this.add
      .image(0, TURRET_SHADOW_Y, getCombatObjectTexture("groundShadow"))
      .setDisplaySize(
        isMechanical ? 56 : MAGIC_TURRET_SHADOW_SIZE.width,
        isMechanical ? 14 : MAGIC_TURRET_SHADOW_SIZE.height
      )
      .setAlpha(0.4);
    const anchor = this.add
      .ellipse(
        0,
        TURRET_ANCHOR_Y,
        isMechanical ? 42 : MAGIC_TURRET_ANCHOR_SIZE.width,
        isMechanical ? 11 : MAGIC_TURRET_ANCHOR_SIZE.height,
        0x321a0d,
        0.14
      )
      .setStrokeStyle(2, 0xffa24f, 0.3);
    const base = this.add
      .image(0, MECHANICAL_TURRET_BODY_Y, getCombatObjectTexture("turretBase"))
      .setOrigin(0.5)
      .setDisplaySize(MECHANICAL_TURRET_BODY_SIZE, MECHANICAL_TURRET_BODY_SIZE)
      .setVisible(turret.kind === "mechanical");
    const body = this.add
      .sprite(
        0,
        isMechanical ? MECHANICAL_TURRET_BODY_Y : TURRET_ANCHOR_Y,
        isMechanical
          ? getCombatObjectTexture("turretHead")
          : getMagicTurretFrameTexture(0),
        0
      )
      .setOrigin(0.5, isMechanical ? 0.5 : MAGIC_TURRET_GROUND_ORIGIN_Y)
      .setDisplaySize(
        isMechanical ? MECHANICAL_TURRET_BODY_SIZE : MAGIC_TURRET_DISPLAY_SIZE.width,
        isMechanical ? MECHANICAL_TURRET_BODY_SIZE : MAGIC_TURRET_DISPLAY_SIZE.height
      );
    const shield = this.add
      .sprite(0, isMechanical ? MECHANICAL_TURRET_SHIELD_Y : MAGIC_TURRET_SHIELD_Y, "engineerMagicShield", 0)
      .setOrigin(0.5)
      .setDisplaySize(
        isMechanical ? 72 : MAGIC_TURRET_SHIELD_SIZE,
        isMechanical ? 72 : MAGIC_TURRET_SHIELD_SIZE
      )
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const healthBack = this.add.rectangle(0, healthY, 32, 5, 0x211611, 0.86);
    const health = this.add.rectangle(-TURRET_HEALTH_WIDTH / 2, healthY, TURRET_HEALTH_WIDTH, 3, 0x65d840, 1).setOrigin(0, 0.5);
    const ownerMarker = this.add.rectangle(0, healthY - 7, 7, 7, 0x65d840, 1).setAngle(45);
    container.add([shadow, anchor, base, body, shield, healthBack, health, ownerMarker]);
    return { container, shadow, anchor, base, body, shield, healthBack, health, ownerMarker, visualX: turret.x, visualY: turret.y };
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

  private createAttackBoostPackView(pack: AttackBoostPackState): PackView {
    const container = this.add.container(pack.x, pack.y);
    const shadow = this.add.image(0, 14, getCombatObjectTexture("groundShadow")).setDisplaySize(34, 12).setAlpha(0.28);
    const aura = this.add.ellipse(0, 2, 42, 18, 0xff655e, 0.18).setStrokeStyle(2, 0xffd36f, 0.32);
    const logo = this.add.image(0, -8, "attackMushroom").setOrigin(0.5).setDisplaySize(38, 38);
    const sparkle = this.add
      .image(0, -31, getCombatObjectTexture("leafSparkle"))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.add([shadow, aura, logo, sparkle]);
    return { container, shadow, aura, logo, sparkle, visualX: pack.x, visualY: pack.y };
  }

  private getProjectileTexture(projectile: ProjectileState, frame = this.getProjectileFrame(projectile)) {
    if (projectile.skillId) {
      const runtime = getArenaSkillRuntimeEntry(projectile.skillId);
      if (runtime?.visualContract.projectileSize) {
        return getArenaSkillRuntimeSecondaryFrameTexture(
          projectile.skillId,
          "projectile",
          frame
        );
      }
    }
    if (projectile.type === "arrow") {
      return getCombatObjectTexture("arrow");
    }
    if (projectile.type === "mechanical_turret") {
      return getEngineerCoreFrameTexture("mechanicalBasicShot", frame);
    }
    if (projectile.type === "magic_turret_basic") {
      return getEngineerCoreFrameTexture("magicBasicShot", frame);
    }
    if (this.isMagicTurretProjectile(projectile.type)) {
      throw new Error(
        `Engineer skill projectile ${projectile.type} is missing its packaged skillId`
      );
    }
    return getCombatVfxFrameTexture(this.getProjectileVfxKey(projectile.type), frame);
  }

  private getProjectileTrailTexture(projectile: ProjectileState, frame: number) {
    if (this.shouldRenderConfigurationTether(projectile) && projectile.skillId) {
      return getArenaSkillRuntimeFrameTexture(projectile.skillId, 2);
    }
    if (projectile.skillId) {
      const runtime = getArenaSkillRuntimeEntry(projectile.skillId);
      if (runtime?.visualContract.projectileSize) {
        return getArenaSkillRuntimeSecondaryFrameTexture(
          projectile.skillId,
          "projectile",
          frame
        );
      }
    }
    if (projectile.type === "arrow") {
      return getCombatObjectTexture("arrow");
    }
    if (projectile.type === "magic_ball") {
      return getCombatVfxFrameTexture("magicOrbProjectile", (frame + 10) % COMBAT_VFX_FRAME_COUNT);
    }
    throw new Error(
      `Projectile trail requested without an authored package: ${projectile.type}`
    );
  }

  private shouldRenderProjectileTrail(projectile: ProjectileState) {
    return this.shouldRenderConfigurationTether(projectile);
  }

  private shouldRenderConfigurationTether(projectile: ProjectileState) {
    return (
      (projectile.skillId === "archer_04" || projectile.skillId === "archer_07")
    );
  }

  private getProjectileVfxKey(projectileType: ProjectileType): CombatVfxKey {
    if (projectileType === "arrow") {
      return "arrowProjectile";
    }
    if (projectileType === "magic_ball") {
      return "magicOrbProjectile";
    }
    throw new Error(`Projectile VFX key is undefined for ${projectileType}`);
  }

  private getProjectileFrame(
    projectile: ProjectileState,
    createdAt = this.time.now
  ) {
    if (projectile.phase === "contact") {
      if (projectile.skillId === "archer_04") return 2;
      if (projectile.skillId === "archer_07") return 3;
    }
    if (projectile.skillId) {
      const runtime = getArenaSkillRuntimeEntry(projectile.skillId);
      if (runtime?.visualContract.projectileSize) {
        const asset = getArenaSkillRuntimeProjectileAsset(projectile.skillId);
        return asset
          ? getArenaSkillRuntimeFrameAtElapsed(
              asset,
              Math.max(0, this.time.now - createdAt)
            )
          : 0;
      }
    }
    const seed = Number(projectile.id.replace(/\D/g, "").slice(-4)) || 0;
    if (projectile.type === "arrow") {
      return 0;
    }
    if (!projectile.skillId && projectile.type === "mechanical_turret") {
      return getEngineerCoreFrameAtElapsed(
        "mechanicalBasicShot",
        Math.max(0, this.time.now - createdAt)
      );
    }
    if (!projectile.skillId && projectile.type === "magic_turret_basic") {
      return getEngineerCoreFrameAtElapsed(
        "magicBasicShot",
        Math.max(0, this.time.now - createdAt)
      );
    }
    return Math.floor((this.time.now + seed * 37) / 70) % COMBAT_VFX_FRAME_COUNT;
  }

  private getProjectileSourceFrame(projectile: ProjectileState, frame: number) {
    if (
      projectile.skillId &&
      getArenaSkillRuntimeEntry(projectile.skillId)?.visualContract
        .projectileSize
    ) {
      return 0;
    }
    if (
      this.isMagicTurretProjectile(projectile.type) &&
      !this.isEngineerCoreBasicProjectile(projectile)
    ) {
      return frame % 6;
    }
    return 0;
  }

  private isMagicTurretProjectile(type: ProjectileType) {
    return (
      type === "magic_turret_basic" ||
      type === "magic_turret_sync" ||
      type === "magic_turret_split" ||
      type === "magic_turret_split_fragment" ||
      type === "magic_turret_matrix"
    );
  }

  private isEngineerCoreBasicProjectile(projectile: ProjectileState) {
    return (
      !projectile.skillId &&
      (projectile.type === "mechanical_turret" ||
        projectile.type === "magic_turret_basic")
    );
  }

  private getProjectileDisplaySize(projectile: ProjectileState): [number, number] {
    if (projectile.skillId === "archer_07" && projectile.phase === "contact") {
      const scale = PLAYER_SPRITE_DISPLAY_SIZE.height / 66;
      return [38 * scale, 22 * scale];
    }
    if (
      projectile.type === "magic_turret_split_fragment" &&
      projectile.skillId
    ) {
      const runtime = getArenaSkillRuntimeEntry(projectile.skillId);
      if (runtime) {
        const scale =
          PLAYER_SPRITE_DISPLAY_SIZE.height /
          runtime.visualContract.referenceActorHeight;
        return [35 * scale, 25 * scale];
      }
    }
    if (projectile.skillId) {
      const display = getArenaSkillRuntimeProjectileDisplay(
        projectile.skillId,
        PLAYER_SPRITE_DISPLAY_SIZE.height
      );
      if (display) {
        return [display.width, display.height];
      }
    }
    if (projectile.type === "arrow") {
      return [118, 36];
    }
    if (projectile.type === "magic_ball") {
      return [70, 70];
    }
    if (projectile.type === "sword_wave") {
      throw new Error(
        "Warrior sword wave is missing its packaged projectile display contract"
      );
    }
    if (projectile.type === "mechanical_turret") {
      const display = getEngineerCoreRuntimeAsset(
        "mechanicalBasicShot"
      ).displaySize;
      if (!display) {
        throw new Error("Mechanical turret basic shot display contract is missing");
      }
      const scale = ARENA_RUNTIME_ACTOR_DISPLAY_HEIGHT / 66;
      return [display[0] * scale, display[1] * scale];
    }
    switch (projectile.type) {
      case "magic_turret_basic": {
        const display = getEngineerCoreRuntimeAsset("magicBasicShot").displaySize;
        if (!display) {
          throw new Error("Magic turret basic shot display contract is missing");
        }
        const scale = ARENA_RUNTIME_ACTOR_DISPLAY_HEIGHT / 66;
        return [display[0] * scale, display[1] * scale];
      }
      case "magic_turret_sync": return [76, 54];
      case "magic_turret_split": return [91, 66];
      case "magic_turret_split_fragment": return [55, 39];
      case "magic_turret_matrix": return [76, 54];
    }
    return [46, 46];
  }

  private getProjectileTrailDisplaySize(projectile: ProjectileState): [number, number] {
    if (projectile.type === "arrow") {
      return [108, 32];
    }
    if (projectile.type === "magic_ball") {
      return [78, 78];
    }
    if (this.isMagicTurretProjectile(projectile.type)) {
      const [width, height] = this.getProjectileDisplaySize(projectile);
      return [width * 1.28, height * 1.28];
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
    if (projectile.type === "mechanical_turret") {
      return 0xffc26b;
    }
    if (projectile.type === "magic_turret_matrix") {
      return 0x67d6ff;
    }
    if (projectile.type === "magic_turret_split" || projectile.type === "magic_turret_split_fragment") {
      return 0x74f7e8;
    }
    if (projectile.type === "magic_turret_sync") {
      return 0xe1c4ff;
    }
    if (projectile.type === "magic_turret_basic") {
      return 0xb992ff;
    }
    return 0x67d6ff;
  }

  private getProjectileBlendMode(projectile: ProjectileState) {
    if (projectile.skillId) {
      const runtime = getArenaSkillRuntimeEntry(projectile.skillId);
      if (runtime?.visualContract.projectileSize) {
        return runtime.visualContract.blendMode === "add"
          ? Phaser.BlendModes.ADD
          : Phaser.BlendModes.NORMAL;
      }
    }
    if (this.isEngineerCoreBasicProjectile(projectile)) {
      return Phaser.BlendModes.ADD;
    }
    return projectile.type === "arrow" || this.isMagicTurretProjectile(projectile.type)
      ? Phaser.BlendModes.NORMAL
      : Phaser.BlendModes.ADD;
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
      texture: getNewCompatibleWalkFrameTexture(
        player.classId,
        this.getEightDirection(renderAngle),
        moving
          ? Math.floor(this.time.now / ARENA_WEB_PLAYER.walkFrameDurationMs) %
            NEW_COMPATIBLE_WALK_FRAME_COUNT
          : 0
      ),
      flipX: false
    };
  }

  private getEightDirection(angle: number) {
    const normalized = ((angle % 360) + 360) % 360;
    // PixelLab's documented convention is south = facing the camera / moving
    // down-screen, then clockwise around the eight directions. If an output
    // violates that convention it is a rejected source asset, not a mapping
    // issue the runtime should conceal.
    const directions = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"] as const;
    return directions[Math.round(normalized / 45) % directions.length];
  }

  private getActionRenderFrame(player: PublicPlayer, moving: boolean): PlayerRenderFrame {
    const progress = this.getActionProgress(player);
    const actionBody = this.getCatalogActionBody(player);
    const runtimeBody = this.getRuntimeBodyAction(player);
    if (runtimeBody) {
      const [left, top, right, bottom] = runtimeBody.body.unionBounds;
      const cropWidth = right - left;
      const cropHeight = bottom - top;
      if (!(cropWidth > 0 && cropHeight > 0)) {
        throw new Error(`Invalid full-body runtime crop for ${runtimeBody.entry.skillId}`);
      }
      const directional = runtimeBody.body.directionalLayout;
      const frame = getArenaSkillRuntimeActionBodyFrameAtProgress(
        runtimeBody.entry.skillId,
        progress
      );
      const direction = directional
        ? this.getEightDirection(player.angle)
        : undefined;
      const semanticOrigin = getArenaSkillRuntimeActionBodyOrigin(
        runtimeBody.entry.skillId
      );
      const displayHeight =
        PLAYER_SPRITE_DISPLAY_SIZE.height *
        (runtimeBody.body.displayHeightMultiplier ?? 1);
      return {
        texture: getArenaSkillRuntimeActionBodyFrameTexture(
          runtimeBody.entry.skillId,
          frame,
          direction
        ),
        flipX: directional ? false : this.isFacingLeft(player.angle),
        displaySize: {
          width: displayHeight * (cropWidth / cropHeight),
          height: displayHeight
        },
        // Configuration action bodies carry their own feet anchor. Legacy
        // canonical bodies retain the existing near-foot fallback origin.
        originX: semanticOrigin?.x,
        originY: semanticOrigin?.y ?? 0.96,
        runtimeBody: true
      };
    }

    if (player.classId === "warrior") {
      if (player.action === "attack" || (!actionBody && player.action === "skillR")) {
        return this.getWarriorM1RenderFrame(player.angle, progress);
      }
      if (actionBody === "warrior-charge") {
        return this.getWarriorWalkActionRenderFrame(player.angle, progress, true);
      }
      if (actionBody === "warrior-melee") {
        return this.getWarriorM1RenderFrame(player.angle, progress);
      }
      if (actionBody === "warrior-neutral") {
        return this.getWarriorWalkActionRenderFrame(player.angle, 0, false);
      }
      if (player.action === "skillE") return this.getWarriorWalkActionRenderFrame(player.angle, progress, false);
      return this.getWarriorWalkActionRenderFrame(player.angle, progress, moving);
    }

    if (player.classId === "archer") {
      if (actionBody === "archer-roll") {
        return this.getArcherForestRollRenderFrame(player.angle, progress);
      }
      if (actionBody === "archer-bow") return this.getArcherAttackRenderFrame(player, progress, moving);
      if (actionBody === "archer-neutral") return this.getArcherNeutralRenderFrame(player.angle);
      return this.getArcherAttackRenderFrame(player, progress, moving);
    }

    if (player.classId === "engineer") {
      return this.getEngineerActionRenderFrame(player.angle, progress);
    }

    if (player.classId === "mage") {
      if (player.action === "attack" || actionBody === "mage-cast") {
        return this.getMageStaffCastRenderFrame(player.angle, progress);
      }
      throw new Error(
        `Mage action ${player.action} is missing its explicit mage-cast action profile`
      );
    }

    throw new Error(`Unsupported arena action class: ${player.classId}`);
  }

  private getCatalogActionBody(player: PublicPlayer): ArenaSkillActionBody | null {
    return getArenaSkillActionProfile(player.actionSkillId)?.body ?? null;
  }

  private getRuntimeBodyAction(player: PublicPlayer) {
    if (!player.actionSkillId) {
      return null;
    }
    const runtime = getArenaSkillRuntimeEntry(player.actionSkillId);
    const body = getArenaSkillRuntimeActionBody(player.actionSkillId);
    return runtime && body ? { entry: runtime, body } : null;
  }

  private getWarriorM1RenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getWarriorM1Direction(angle);
    const frame = Math.min(
      WARRIOR_M1_FRAME_COUNT - 1,
      Math.floor(progress * WARRIOR_M1_FRAME_COUNT)
    );
    return {
      texture: getWarriorM1FrameTexture(direction, frame),
      flipX: false
    };
  }

  private getWarriorWalkActionRenderFrame(angle: number, progress: number, animate: boolean): PlayerRenderFrame {
    const frame = animate
      ? Math.min(
          NEW_COMPATIBLE_WALK_FRAME_COUNT - 1,
          Math.floor(progress * NEW_COMPATIBLE_WALK_FRAME_COUNT)
        )
      : 0;
    return {
      texture: getNewCompatibleWalkFrameTexture("warrior", this.getEightDirection(angle), frame),
      flipX: false
    };
  }

  private getArcherAttackRenderFrame(player: PublicPlayer, _progress: number, moving: boolean): PlayerRenderFrame {
    if (this.isArcherMovingDraw(player, moving)) {
      return this.getArcherMovingBowRenderFrame(player);
    }
    return {
      texture: getArcherStandingFullDrawFrameTexture(this.getArcherMovingBowDirection(player.angle)),
      flipX: false
    };
  }

  private getArcherMovingBowRenderFrame(player: PublicPlayer): PlayerRenderFrame {
    const direction = this.getArcherMovingBowDirection(player.angle);
    const frame = Math.floor(this.time.now / 92) % ARCHER_MOVING_BOW_FRAME_COUNT;
    return {
      texture: getArcherMovingBowFrameTexture(direction, frame),
      flipX: false
    };
  }

  private getArcherNeutralRenderFrame(angle: number): PlayerRenderFrame {
    return {
      texture: getNewCompatibleWalkFrameTexture("archer", this.getEightDirection(angle), 0),
      flipX: false
    };
  }

  private getArcherForestRollRenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getArcherMovingBowDirection(angle);
    const frame = Math.min(
      ARCHER_FOREST_ROLL_FRAME_COUNT - 1,
      Math.floor(progress * ARCHER_FOREST_ROLL_FRAME_COUNT)
    );
    return {
      texture: getArcherForestRollFrameTexture(direction, frame),
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

  private getMageStaffCastRenderFrame(angle: number, progress: number): PlayerRenderFrame {
    const direction = this.getEightDirection(angle);
    return {
      texture: getMageStaffCastFrameTexture(direction, this.getAttackFrameFromProgress(progress)),
      flipX: false,
      displaySize: MAGE_STAFF_CAST_DISPLAY_SIZE,
      originY: MAGE_STAFF_CAST_ORIGIN_Y
    };
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
    const actionBody = this.getCatalogActionBody(player);

    // engineer_06 owns a package-local three-frame brace/recoil body. Applying
    // the class-wide skillR pulse here stretches that authored body from
    // 104 px up to ~112 px during the shot, which reads as the Engineer
    // suddenly growing. Keep its authored frames at their declared size.
    if (player.actionSkillId === "engineer_06") {
      return neutral;
    }

    if (actionBody === "warrior-charge") {
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

    if (actionBody === "warrior-melee") {
      return {
        kick: 4.8 * pulse,
        lift: -1.4 * pulse,
        angle: facingSign * 1.1 * pulse,
        scaleX: 1.035 + pulse * 0.025,
        scaleY: 1.01 + pulse * 0.02,
        shadowScaleX: 1.1 + pulse * 0.05,
        shadowScaleY: 0.92
      };
    }

    if (actionBody === "warrior-neutral" || actionBody === "archer-neutral") {
      return neutral;
    }

    if (actionBody === "archer-roll") {
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

    if (actionBody === "archer-bow") {
      return {
        kick: 0.8 * pulse,
        lift: -1.8 * pulse,
        angle: facingSign * 0.45 * pulse,
        scaleX: 1.01 + pulse * 0.015,
        scaleY: 1.01 + pulse * 0.02,
        shadowScaleX: 1.04 + pulse * 0.035,
        shadowScaleY: 0.96
      };
    }

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

    const adjustedAlpha = frameRateIndependentAlpha(alpha, this.game.loop.delta);
    return {
      x: Phaser.Math.Linear(currentX, targetX, adjustedAlpha),
      y: Phaser.Math.Linear(currentY, targetY, adjustedAlpha)
    };
  }

  private interpolateAngle(current: number, target: number, alpha: number) {
    if (!Number.isFinite(current)) {
      return target;
    }

    const delta = Phaser.Math.Angle.ShortestBetween(current, target);
    const adjustedAlpha = frameRateIndependentAlpha(alpha, this.game.loop.delta);
    return Phaser.Math.Angle.WrapDegrees(current + delta * adjustedAlpha);
  }

  private isFacingLeft(angle: number) {
    const normalized = ((angle % 360) + 360) % 360;
    return normalized > 90 && normalized < 270;
  }

  private getAttackFrameFromProgress(progress: number) {
    return getArenaWebThreeFrameAttackIndex(progress);
  }

  private getFacingDirection(angle: number): WarriorAttackDirection {
    return getArenaWebFourDirection(angle);
  }

  private getArcherMovingBowDirection(angle: number): ArcherMovingBowDirection {
    const normalized = ((angle % 360) + 360) % 360;
    const octant = Math.round(normalized / 45) % ARCHER_MOVING_BOW_DIRECTIONS.length;
    return ARCHER_MOVING_BOW_DIRECTIONS[octant];
  }

  private getWarriorM1Direction(angle: number): WarriorM1Direction {
    const normalized = ((angle % 360) + 360) % 360;
    const octant = Math.round(normalized / 45) % WARRIOR_M1_DIRECTIONS.length;
    return WARRIOR_M1_DIRECTIONS[octant];
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

function emptySkillInputState(): Record<SkillKey, boolean> {
  return {
    skillF: false,
    skillQ: false,
    skillE: false,
    skillR: false
  };
}

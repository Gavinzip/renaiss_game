import Phaser from "phaser";
import { WORLD, mapPropsToColliders, resolveCollision, type Collider } from "@renaiss-game/shared";
import { makeMatteTransparent } from "../assets/chromaKey";
import { ENV_CROPS, ENV_TEXTURES } from "../assets/crops";
import { buildNewCompatibleWalkTexture, buildVillageRuntimeTextures, getNewCompatibleWalkFrameTexture } from "../assets/runtimeTextures";
import { generatedAssetPath } from "../assets/generatedAssets";
import { shouldLoadStaticAssetsWithCors } from "../assets/staticAssets";
import { getRenderableMapProps } from "../mapDraft";
import { renderVillageMap } from "../render/villageMap";
import { isDomTextEditingActive } from "../input/domFocus";
import {
  getVillagePlayerAnimationFrame,
  getVillagePlayerStepPose,
  getVillagePlayerWalkDirection,
  VILLAGE_PLAYER_DISPLAY,
  VILLAGE_PLAYER_ORIGIN_Y,
  type VillagePlayerDirection,
  type VillagePlayerWalkDirection
} from "../render/villagePlayerAnimation";
import { useRpgStore, type RpgNavigationTarget, type RpgPlace } from "../../state/rpgStore";
import { useRpgInputStore } from "../../state/rpgInputStore";
import { rpgCopy } from "../../i18n/rpg";

const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
const PLAYER_SPEED = 184;
const PLAYER_COLLISION_RADIUS = 28;
const AUTO_NAV_STOP_DISTANCE = 138;
const HOUSE_CLEARANCE_Y = VILLAGE_PLAYER_DISPLAY.height * 0.76;
const HOUSE_CLEARANCE_X = VILLAGE_PLAYER_DISPLAY.width * 0.56;
const PLAYER_BOUNDS = {
  left: 80,
  right: WORLD_WIDTH - 80,
  top: 110,
  bottom: WORLD_HEIGHT - 80
} as const;
const LAMP_BOTTOM_TRANSPARENT_RATIO = 14 / 190;

export class RpgVillageScene extends Phaser.Scene {
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private player!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private colliders: Collider[] = [];
  private lastNearPlace: RpgPlace | null = null;
  private lastDirection: VillagePlayerDirection = "down";
  private lastPlayerWalkDirection: VillagePlayerWalkDirection = "south";
  private shopPoint = new Phaser.Math.Vector2(650, 460);
  private arenaPoint = new Phaser.Math.Vector2(980, 360);
  private unsubscribePlayerName?: () => void;

  constructor() {
    super("RpgVillageScene");
  }

  preload() {
    if (shouldLoadStaticAssetsWithCors()) this.load.setCORS("anonymous");
    this.load.image("newCompatibleWalk_engineer", generatedAssetPath("characters/new-compatible/engineer/walk-8dir"));
    this.load.image("villageAssets", generatedAssetPath("village-assets"));
    this.load.image("arenaDecals", generatedAssetPath("arena-decals"));
  }

  create() {
    makeMatteTransparent(this, "villageAssets", "villageAssetsClean", "magenta");
    buildVillageRuntimeTextures(this);
    buildNewCompatibleWalkTexture(this, "engineer");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(0.78);
    this.cameras.main.roundPixels = true;
    const villageMapProps = getRenderableMapProps().filter((prop) => prop.type !== "houseA" && prop.type !== "houseB");
    this.colliders = mapPropsToColliders(villageMapProps);

    renderVillageMap(this, villageMapProps);
    this.addRpgVillageProps();
    this.addPlaceLabels();
    this.createPlayer();
    this.input.keyboard?.disableGlobalCapture();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14, 0, 320);
    window.dispatchEvent(new CustomEvent("renaiss:rpg-ready", { detail: { scene: this.scene.key } }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribePlayerName?.();
      this.unsubscribePlayerName = undefined;
      useRpgStore.getState().setNearPlace(null);
    });
  }

  override update(_time: number, delta: number) {
    if (useRpgStore.getState().activeLocation === "house") {
      this.scene.start("RpgHouseScene");
      return;
    }

    const store = useRpgStore.getState();
    const seconds = delta / 1000;
    const inputBlocked = isDomTextEditingActive();
    const mobileMove = store.screen === "village" ? useRpgInputStore.getState().move : { x: 0, y: 0 };
    const manualMoveX = inputBlocked ? 0 : Phaser.Math.Clamp(
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0) + mobileMove.x,
      -1,
      1
    );
    const manualMoveY = inputBlocked ? 0 : Phaser.Math.Clamp(
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0) + mobileMove.y,
      -1,
      1
    );
    const manualMoving = manualMoveX !== 0 || manualMoveY !== 0;
    if (manualMoving && store.villageNavigationTarget) store.clearVillageNavigation();
    let moveX = manualMoveX;
    let moveY = manualMoveY;
    let speed = PLAYER_SPEED * (this.keys.SPACE.isDown ? 1.24 : 1);

    if (!inputBlocked && !manualMoving && store.villageNavigationTarget) {
      const targetPoint = this.pointForNavigationTarget(store.villageNavigationTarget);
      const deltaX = targetPoint.x - this.player.x;
      const deltaY = targetPoint.y - this.player.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance <= AUTO_NAV_STOP_DISTANCE) {
        store.clearVillageNavigation();
      } else {
        moveX = deltaX / distance;
        moveY = deltaY / distance;
        speed = PLAYER_SPEED * 1.08;
      }
    }

    const length = Math.hypot(moveX, moveY) || 1;
    const moving = moveX !== 0 || moveY !== 0;

    if (moving) {
      this.movePlayer((moveX / length) * speed * seconds, (moveY / length) * speed * seconds);
      this.lastPlayerWalkDirection = getVillagePlayerWalkDirection(moveX, moveY, this.lastPlayerWalkDirection);
      if (Math.abs(moveY) <= Math.abs(moveX)) {
        this.lastDirection = "side";
      } else {
        this.lastDirection = moveY < 0 ? "up" : "down";
      }
    }

    this.updatePlayerFrame(moving);
    this.playerLabel.setPosition(this.player.x, this.player.y - 74);
    this.player.setDepth(this.player.y);
    this.playerLabel.setDepth(this.player.y + 1);
    this.updateNearbyPlace(inputBlocked);
  }

  private pointForNavigationTarget(_target: RpgNavigationTarget) {
    return this.arenaPoint;
  }

  private movePlayer(deltaX: number, deltaY: number) {
    const xResolved = this.resolvePlayerPosition(this.player.x + deltaX, this.player.y);
    const yResolved = this.resolvePlayerPosition(xResolved.x, xResolved.y + deltaY);
    this.player.setPosition(yResolved.x, yResolved.y);
  }

  private resolvePlayerPosition(x: number, y: number) {
    return resolveCollision({ x, y }, PLAYER_COLLISION_RADIUS, PLAYER_BOUNDS, this.colliders);
  }

  private updateNearbyPlace(inputBlocked: boolean) {
    const playerPoint = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const shopDistance = playerPoint.distance(this.shopPoint);
    const arenaDistance = playerPoint.distance(this.arenaPoint);
    const nearPlace = shopDistance < 145 ? "shop" : arenaDistance < 160 ? "arena" : null;
    if (nearPlace !== this.lastNearPlace) {
      this.lastNearPlace = nearPlace;
      useRpgStore.getState().setNearPlace(nearPlace);
    }
    if (!inputBlocked && nearPlace && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      const store = useRpgStore.getState();
      if (nearPlace === "shop") store.openShop();
      if (nearPlace === "arena") store.openArena();
    }
  }

  private createPlayer() {
    const playerX = WORLD.width / 2 + 130;
    const playerY = WORLD.height / 2 + 360;
    this.playerShadow = this.add.ellipse(playerX, playerY + 13, 72, 18, 0x080604, 0.22).setDepth(playerY - 3);
    this.player = this.add
      .image(playerX, playerY, getNewCompatibleWalkFrameTexture("engineer", this.lastPlayerWalkDirection, 0))
      .setOrigin(0.5, VILLAGE_PLAYER_ORIGIN_Y)
      .setDisplaySize(VILLAGE_PLAYER_DISPLAY.width, VILLAGE_PLAYER_DISPLAY.height);
    this.playerLabel = this.add
      .text(this.player.x, this.player.y - 74, useRpgStore.getState().playerName, {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#fff3b0",
        stroke: "#27170e",
        strokeThickness: 4
      })
      .setOrigin(0.5);
    this.unsubscribePlayerName = useRpgStore.subscribe((state, previous) => {
      if (state.playerName !== previous.playerName) {
        this.playerLabel.setText(state.playerName);
      }
    });
  }

  private addPlaceLabels() {
    this.shopPoint = new Phaser.Math.Vector2(WORLD.width / 2 - 410, WORLD.height / 2 + 655);
    this.arenaPoint = new Phaser.Math.Vector2(WORLD.width / 2 + 720, WORLD.height / 2 + 345);
  }

  private addRpgVillageProps() {
    const c = WORLD.width / 2;
    const m = WORLD.height / 2;
    const profileCopy = rpgCopy().profile;
    this.addHouse(c + 720, m + 150, "houseB", profileCopy.arena, 0.92);
    this.addHouse(c - 410, m + 470, "houseA", profileCopy.skillForge, 0.9);
    this.addProp(ENV_TEXTURES.treeRound, c - 1110, m + 190, 108, 140, m + 258, { collider: { kind: "circle", x: c - 1110, y: m + 162, radius: 40 } });
    this.addProp(ENV_TEXTURES.treePine, c - 995, m + 184, 108, 146, m + 252, { collider: { kind: "circle", x: c - 995, y: m + 154, radius: 38 } });
    this.addProp(ENV_TEXTURES.treeRound, c + 1130, m + 210, 108, 140, m + 278, { collider: { kind: "circle", x: c + 1130, y: m + 182, radius: 40 } });
    this.addProp(ENV_TEXTURES.treePine, c + 1005, m - 230, 108, 146, m - 162, { collider: { kind: "circle", x: c + 1005, y: m - 260, radius: 38 } });
    this.addProp(ENV_TEXTURES.fence, c - 930, m + 70, 320, 112, m + 112, { collider: { kind: "rect", x: c - 930, y: m + 48, width: 276, height: 34 } });
    this.addProp(ENV_TEXTURES.fence, c + 910, m + 70, 320, 112, m + 112, { collider: { kind: "rect", x: c + 910, y: m + 48, width: 276, height: 34 } });
    this.addProp(ENV_TEXTURES.crystal, c + 90, m + 805, 120, 142, m + 870, { collider: { kind: "circle", x: c + 90, y: m + 772, radius: 36 } });
    this.addProp(ENV_TEXTURES.lamp, c - 180, m + 505, 58, 146, m + 582, { bottomInsetRatio: LAMP_BOTTOM_TRANSPARENT_RATIO, collider: { kind: "circle", x: c - 180, y: m + 546, radius: 24 } });
    this.addProp(ENV_TEXTURES.lamp, c + 210, m + 505, 58, 146, m + 582, { bottomInsetRatio: LAMP_BOTTOM_TRANSPARENT_RATIO, collider: { kind: "circle", x: c + 210, y: m + 546, radius: 24 } });
  }

  private addHouse(x: number, y: number, kind: "houseA" | "houseB", label: string, scale: number) {
    const width = kind === "houseA" ? 300 * scale : 330 * scale;
    const oldCroppedHeight = kind === "houseA" ? 218 * scale : 256 * scale;
    const sourceCrop = ENV_CROPS[kind];
    const height = width * (sourceCrop.height / sourceCrop.width);
    const groundedY = y + (height - oldCroppedHeight);
    this.addProp(ENV_TEXTURES[kind], x, groundedY, width, height, groundedY + 110);
    const colliderTop = groundedY - height * 0.52;
    const colliderBottom = groundedY + HOUSE_CLEARANCE_Y;
    this.colliders.push({
      kind: "rect",
      x,
      y: (colliderTop + colliderBottom) / 2,
      width: width + HOUSE_CLEARANCE_X,
      height: colliderBottom - colliderTop
    });
    const labelY = y - oldCroppedHeight * 0.52;
    this.add
      .rectangle(x, labelY, Math.max(108, width * 0.46), 28, 0x8b6543, 0.96)
      .setStrokeStyle(4, 0x3b2115)
      .setDepth(groundedY + 132);
    this.add
      .text(x, labelY, label, {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#f8df9b",
        stroke: "#3a2015",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(groundedY + 133);
  }

  private addProp(texture: string, x: number, y: number, width: number, height: number, depth: number, options: { bottomInsetRatio?: number; collider?: Collider } = {}) {
    const bottomInset = height * (options.bottomInsetRatio ?? 0);
    this.add.ellipse(x, y - Math.max(5, height * 0.045), width * 0.62, Math.max(8, height * 0.1), 0x080604, 0.16).setDepth(depth - 6);
    this.add.image(x, y + bottomInset, texture).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(depth);
    if (options.collider) this.colliders.push(options.collider);
  }

  private updatePlayerFrame(moving: boolean) {
    const frame = getVillagePlayerAnimationFrame(moving, this.lastPlayerWalkDirection, this.time.now);
    const pose = getVillagePlayerStepPose(moving, this.lastDirection, this.time.now);
    this.player
      .setTexture(getNewCompatibleWalkFrameTexture("engineer", frame.direction, frame.frameIndex))
      .setFlipX(false)
      .setOrigin(0.5, pose.originY)
      .setDisplaySize(pose.width, pose.height)
      .setAngle(0);
    this.playerShadow
      .setPosition(this.player.x + pose.shadowOffsetX, this.player.y + pose.shadowOffsetY)
      .setScale(pose.shadowScaleX, pose.shadowScaleY)
      .setFillStyle(0x080604, pose.shadowAlpha)
      .setDepth(this.player.y - 3);
  }

  private addPlaceMarker(x: number, y: number, label: string) {
    this.add
      .rectangle(x, y - 54, 92, 30, 0x765333, 0.92)
      .setStrokeStyle(4, 0x2b190f)
      .setDepth(y + 130);
    this.add
      .text(x, y - 55, label, {
        fontFamily: "Arial Black, Arial",
        fontSize: "16px",
        color: "#ffe5a0",
        stroke: "#2b190f",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(y + 131);
    this.add.circle(x, y, 34, 0xffdc78, 0.18).setDepth(y - 2);
  }

}

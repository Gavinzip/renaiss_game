import Phaser from "phaser";
import { MAP_COLLIDERS, RPG_ELEMENT_META, RPG_STARTER_PETS, WORLD, resolveCollision, type Collider, type RpgElement } from "@renaiss-game/shared";
import { copyTexture, makeMatteTransparent } from "../assets/chromaKey";
import { ENV_CROPS, ENV_TEXTURES } from "../assets/crops";
import { buildRuntimeTextures } from "../assets/runtimeTextures";
import { generatedAssetPath } from "../assets/generatedAssets";
import { shouldLoadStaticAssetsWithCors } from "../assets/staticAssets";
import { RPG_PET_SPRITE_FRAME, RPG_PET_SPRITE_ROW, rpgPetAnimationFrameIndexes } from "../assets/rpgPetSprites";
import { renderVillageMap } from "../render/villageMap";
import { isDomTextEditingActive } from "../input/domFocus";
import {
  getVillagePlayerAnimationFrame,
  getVillagePlayerStepPose,
  VILLAGE_PLAYER_DISPLAY,
  VILLAGE_PLAYER_ORIGIN_Y,
  type VillagePlayerDirection,
  type VillagePlayerFacing
} from "../render/villagePlayerAnimation";
import { useRpgStore, type RpgNavigationTarget, type RpgPlace } from "../../state/rpgStore";

interface FollowerView {
  element: RpgElement;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  direction: "side" | "down" | "up";
}

interface TrailPoint {
  x: number;
  y: number;
}

interface VillageFollowerDebugState {
  count: number;
  elements: RpgElement[];
  textureKeys: string[];
  animationKeys: string[];
  directions: Array<"side" | "down" | "up">;
  positions: TrailPoint[];
  player: TrailPoint;
  facing: "left" | "right";
  moving: boolean;
  playerMoving: boolean;
  followersMoving: boolean;
  minDistanceFromPlayer: number;
  maxDistanceFromPlayer: number;
}

const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
const PLAYER_SPEED = 184;
const PLAYER_COLLISION_RADIUS = 28;
const AUTO_NAV_STOP_DISTANCE = 138;
const FOLLOWER_COLLISION_RADIUS = 34;
const HOUSE_CLEARANCE_Y = VILLAGE_PLAYER_DISPLAY.height * 0.76;
const HOUSE_CLEARANCE_X = VILLAGE_PLAYER_DISPLAY.width * 0.56;
const PLAYER_BOUNDS = {
  left: 80,
  right: WORLD_WIDTH - 80,
  top: 110,
  bottom: WORLD_HEIGHT - 80
} as const;
const PET_DISPLAY = 104;
const FOLLOW_SPACING = 27;
const FOLLOW_LANE_OFFSETS = [-40, 40, -24, 24, 0] as const;
const RPG_PET_DIRECTION_FRAME = 128;
const RPG_PET_DIRECTION_COLUMNS = 3;
const RPG_PET_DIRECTION_WALK_COLUMNS = 12;
const RPG_PET_DIRECTION_WALK_FRAME_COUNT = 4;
const LAMP_BOTTOM_TRANSPARENT_RATIO = 14 / 190;

export class RpgVillageScene extends Phaser.Scene {
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private player!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private followers: FollowerView[] = [];
  private trail: TrailPoint[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private colliders: Collider[] = [];
  private lastNearPlace: RpgPlace | null = null;
  private lastFacing: VillagePlayerFacing = "right";
  private lastMoveAxis: "horizontal" | "vertical" = "horizontal";
  private lastDirection: VillagePlayerDirection = "down";
  private shopPoint = new Phaser.Math.Vector2(650, 460);
  private gymPoint = new Phaser.Math.Vector2(1260, 430);
  private arenaPoint = new Phaser.Math.Vector2(980, 360);
  private personalHousePoint = new Phaser.Math.Vector2(840, 340);
  private unsubscribePlayerName?: () => void;

  constructor() {
    super("RpgVillageScene");
  }

  preload() {
    if (shouldLoadStaticAssetsWithCors()) this.load.setCORS("anonymous");
    this.load.image("classSprites", generatedAssetPath("class-sprites"));
    this.load.image("villageAssets", generatedAssetPath("village-assets"));
    this.load.image("arenaDecals", generatedAssetPath("arena-decals"));
    this.load.image("skillEffects", generatedAssetPath("skill-effects"));
    this.load.image("combatObjects", generatedAssetPath("combat-objects"));
    this.load.image("statusEffects", generatedAssetPath("status-effects"));
    this.load.image("abilityEffects", generatedAssetPath("ability-effects"));
    this.load.image("warriorVerticalSlash", generatedAssetPath("warrior-vertical-slash"));
    this.load.image("warriorArcherEffects", generatedAssetPath("warrior-archer-effects"));
    this.load.image("warriorVerdictCombatFx", generatedAssetPath("combat-fx-warrior-verdict"));
    this.load.image("engineerEffects", generatedAssetPath("engineer-effects"));
    this.load.image("mageEffects", generatedAssetPath("mage-effects"));
    this.load.image("combatEffects", generatedAssetPath("combat-effects"));
    this.load.image("warriorAttackSprites", generatedAssetPath("warrior-attack-sprites"));
    this.load.image("archerAttackSprites", generatedAssetPath("archer-attack-sprites"));
    this.load.image("engineerActionSprites", generatedAssetPath("engineer-action-sprites"));
    this.load.image("mageAttackSprites", generatedAssetPath("mage-attack-sprites"));
    this.load.spritesheet("rpgPetSprites", generatedAssetPath("rpg-pet-sprites"), {
      frameWidth: RPG_PET_SPRITE_FRAME,
      frameHeight: RPG_PET_SPRITE_FRAME
    });
    this.load.spritesheet("rpgPetDirections", generatedAssetPath("rpg-pet-directions"), {
      frameWidth: RPG_PET_DIRECTION_FRAME,
      frameHeight: RPG_PET_DIRECTION_FRAME
    });
    this.load.spritesheet("rpgPetDirectionWalk", generatedAssetPath("rpg-pet-direction-walk"), {
      frameWidth: RPG_PET_DIRECTION_FRAME,
      frameHeight: RPG_PET_DIRECTION_FRAME
    });
  }

  create() {
    copyTexture(this, "classSprites", "classSpritesClean");
    makeMatteTransparent(this, "villageAssets", "villageAssetsClean", "magenta");
    makeMatteTransparent(this, "skillEffects", "skillEffectsClean", "edgeBlack");
    makeMatteTransparent(this, "combatObjects", "combatObjectsClean", "edgeBlack");
    buildRuntimeTextures(this);
    this.textures.get("rpgPetSprites").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("rpgPetDirections").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("rpgPetDirectionWalk").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.createPetAnimations();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(0.78);
    this.cameras.main.roundPixels = true;
    this.colliders = [...MAP_COLLIDERS];

    renderVillageMap(this);
    this.addRpgVillageProps();
    this.addPlaceLabels();
    this.createParty();
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
    const manualMoveX = inputBlocked ? 0 : (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    const manualMoveY = inputBlocked ? 0 : (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) - (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0);
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
      this.lastMoveAxis = Math.abs(moveY) > Math.abs(moveX) ? "vertical" : "horizontal";
      if (this.lastMoveAxis === "horizontal") {
        this.lastFacing = moveX < 0 ? "left" : moveX > 0 ? "right" : this.lastFacing;
        this.lastDirection = "side";
      } else {
        this.lastDirection = moveY < 0 ? "up" : "down";
      }
    }

    this.updatePlayerFrame(moving);
    this.playerLabel.setPosition(this.player.x, this.player.y - 74);
    this.updateFollowers(moving);
    this.updateNearbyPlace(inputBlocked);
  }

  private pointForNavigationTarget(target: RpgNavigationTarget) {
    return target === "gym" ? this.gymPoint : this.arenaPoint;
  }

  private movePlayer(deltaX: number, deltaY: number) {
    const xResolved = this.resolvePlayerPosition(this.player.x + deltaX, this.player.y);
    const yResolved = this.resolvePlayerPosition(xResolved.x, xResolved.y + deltaY);
    this.player.setPosition(yResolved.x, yResolved.y);
  }

  private resolvePlayerPosition(x: number, y: number) {
    return resolveCollision({ x, y }, PLAYER_COLLISION_RADIUS, PLAYER_BOUNDS, this.colliders);
  }

  private updateFollowers(moving: boolean) {
    if (moving || this.trail.length === 0) {
      this.trail.unshift({ x: this.player.x, y: this.player.y + 8 });
    }
    if (this.trail.length > 180) this.trail.length = 180;

    let anyFollowerMoving = false;
    this.followers.forEach((follower, index) => {
      const target = this.trail[(index + 1) * FOLLOW_SPACING] ?? this.trail[this.trail.length - 1] ?? { x: this.player.x, y: this.player.y };
      const laneOffset = FOLLOW_LANE_OFFSETS[index] ?? 0;
      const targetX = target.x + (this.lastMoveAxis === "vertical" ? laneOffset : 0);
      const targetY = target.y + (this.lastMoveAxis === "horizontal" ? laneOffset : 0);
      const beforeX = follower.sprite.x;
      const beforeY = follower.sprite.y;
      const targetDistance = Phaser.Math.Distance.Between(beforeX, beforeY, targetX, targetY);
      const followLerp = targetDistance > 42 ? 0.24 : targetDistance > 14 ? 0.19 : 0.14;
      const resolved = resolveCollision(
        {
          x: Phaser.Math.Linear(beforeX, targetX, followLerp),
          y: Phaser.Math.Linear(beforeY, targetY, followLerp)
        },
        FOLLOWER_COLLISION_RADIUS,
        PLAYER_BOUNDS,
        this.colliders
      );
      follower.sprite.x = resolved.x;
      follower.sprite.y = resolved.y;
      const movedDistance = Phaser.Math.Distance.Between(beforeX, beforeY, follower.sprite.x, follower.sprite.y);
      const followerMoving = moving || targetDistance > 3 || movedDistance > 0.4;
      anyFollowerMoving = anyFollowerMoving || followerMoving;
      this.updateFollowerSprite(follower, index, followerMoving);
      follower.sprite.setDepth(follower.sprite.y);
      follower.shadow.setPosition(follower.sprite.x, follower.sprite.y + 11).setDepth(follower.sprite.y - 3);
      follower.label.setPosition(follower.sprite.x, follower.sprite.y - 55).setDepth(follower.sprite.y + 1);
    });
    this.player.setDepth(this.player.y);
    this.playerLabel.setDepth(this.player.y + 1);
    this.publishFollowerDebugState(moving, anyFollowerMoving);
  }

  private updateNearbyPlace(inputBlocked: boolean) {
    const playerPoint = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const shopDistance = playerPoint.distance(this.shopPoint);
    const gymDistance = playerPoint.distance(this.gymPoint);
    const arenaDistance = playerPoint.distance(this.arenaPoint);
    const personalHouseDistance = playerPoint.distance(this.personalHousePoint);
    const nearPlace = personalHouseDistance < 170 ? "house" : shopDistance < 145 ? "shop" : gymDistance < 155 ? "gym" : arenaDistance < 160 ? "arena" : null;
    if (nearPlace !== this.lastNearPlace) {
      this.lastNearPlace = nearPlace;
      useRpgStore.getState().setNearPlace(nearPlace);
    }
    if (!inputBlocked && nearPlace && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      const store = useRpgStore.getState();
      if (nearPlace === "house") {
        store.enterHouse();
        this.scene.start("RpgHouseScene");
      }
      if (nearPlace === "shop") store.openShop();
      if (nearPlace === "gym") store.openGym();
      if (nearPlace === "arena") store.openArena();
    }
  }

  private createParty() {
    const playerX = WORLD.width / 2 + 130;
    const playerY = WORLD.height / 2 + 360;
    this.playerShadow = this.add.ellipse(playerX, playerY + 13, 72, 18, 0x080604, 0.22).setDepth(playerY - 3);
    this.player = this.add
      .image(playerX, playerY, "sprite_engineer_0")
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

    this.trail = Array.from({ length: 120 }, (_, index) => ({ x: this.player.x - index * 4, y: this.player.y + 8 + Math.sin(index / 4) * 5 }));
    this.followers = RPG_STARTER_PETS.map((pet, index) => {
      const laneOffset = FOLLOW_LANE_OFFSETS[index] ?? 0;
      const x = this.player.x - (index + 1) * 96;
      const y = this.player.y + 18 + laneOffset;
      const shadow = this.add.ellipse(x, y + 11, 58, 15, 0x080604, 0.2).setDepth(y - 3);
      const sprite = this.add.sprite(x, y, "rpgPetDirections", this.rpgPetDirectionFrame(pet.element, "down")).setOrigin(0.5, 0.84).setDisplaySize(PET_DISPLAY, PET_DISPLAY);
      const label = this.add
        .text(x, y - 48, pet.name, {
          fontFamily: "Arial Black, Arial",
          fontSize: "10px",
          color: RPG_ELEMENT_META[pet.element].accent,
          stroke: "#25140c",
          strokeThickness: 3
        })
        .setOrigin(0.5);
      return { element: pet.element, shadow, sprite, label, direction: "down" as const };
    });
    this.publishFollowerDebugState(false);
  }

  private updateFollowerSprite(follower: FollowerView, index: number, moving: boolean) {
    const direction = this.lastDirection;
    follower.direction = direction;
    if (direction === "side") {
      const animationKey = moving ? `rpg_pet_${follower.element}_walk` : `rpg_pet_${follower.element}_idle`;
      if (follower.sprite.texture.key !== "rpgPetSprites") {
        follower.sprite.setTexture("rpgPetSprites", rpgPetAnimationFrameIndexes(follower.element, moving ? "walk" : "idle")[0]);
      }
      if (follower.sprite.anims.currentAnim?.key !== animationKey) {
        follower.sprite.play(animationKey, true);
      }
      follower.sprite.setFlipX(this.lastFacing === "left");
      follower.sprite.setAngle(moving ? Math.sin(this.time.now / 88 + index) * 1.2 : 0);
      follower.sprite.setDisplaySize(PET_DISPLAY, PET_DISPLAY);
      return;
    }

    if (moving) {
      const animationKey = `rpg_pet_${follower.element}_${direction}_walk`;
      if (follower.sprite.texture.key !== "rpgPetDirectionWalk") {
        follower.sprite.setTexture("rpgPetDirectionWalk", this.rpgPetDirectionWalkFrame(follower.element, direction, 0));
      }
      if (follower.sprite.anims.currentAnim?.key !== animationKey) {
        follower.sprite.play(animationKey, true);
      }
      follower.sprite.setFlipX(false);
      follower.sprite.setAngle(0);
      follower.sprite.setDisplaySize(PET_DISPLAY, PET_DISPLAY);
      return;
    }

    if (follower.sprite.texture.key !== "rpgPetDirections") {
      follower.sprite.anims.stop();
      follower.sprite.setTexture("rpgPetDirections", this.rpgPetDirectionFrame(follower.element, direction));
    } else {
      follower.sprite.setFrame(this.rpgPetDirectionFrame(follower.element, direction));
      follower.sprite.anims.stop();
    }
    follower.sprite.setFlipX(false);
    follower.sprite.setAngle(0);
    follower.sprite.setDisplaySize(PET_DISPLAY, PET_DISPLAY);
  }

  private publishFollowerDebugState(playerMoving: boolean, followersMoving = false) {
    const positions = this.followers.map((follower) => ({
      x: Math.round(follower.sprite.x),
      y: Math.round(follower.sprite.y)
    }));
    const distances = positions.map((position) => Phaser.Math.Distance.Between(position.x, position.y, this.player.x, this.player.y));
    const state: VillageFollowerDebugState = {
      count: this.followers.length,
      elements: this.followers.map((follower) => follower.element),
      textureKeys: this.followers.map((follower) => follower.sprite.texture.key),
      animationKeys: this.followers.map((follower) => follower.sprite.anims.currentAnim?.key ?? ""),
      directions: this.followers.map((follower) => follower.direction),
      positions,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y)
      },
      facing: this.lastFacing,
      moving: playerMoving || followersMoving,
      playerMoving,
      followersMoving,
      minDistanceFromPlayer: Math.round(Math.min(...distances)),
      maxDistanceFromPlayer: Math.round(Math.max(...distances))
    };
    this.game.registry.set("rpgVillageFollowers", state);
  }

  private addPlaceLabels() {
    this.shopPoint = new Phaser.Math.Vector2(WORLD.width / 2 - 410, WORLD.height / 2 + 655);
    this.gymPoint = new Phaser.Math.Vector2(WORLD.width / 2 + 520, WORLD.height / 2 + 655);
    this.arenaPoint = new Phaser.Math.Vector2(WORLD.width / 2 + 720, WORLD.height / 2 + 345);
    this.personalHousePoint = new Phaser.Math.Vector2(WORLD.width / 2 - 760, WORLD.height / 2 + 320);
  }

  private addRpgVillageProps() {
    const c = WORLD.width / 2;
    const m = WORLD.height / 2;
    this.addHouse(c - 1030, m + 455, "houseB", "CardsMelt4048", 0.94);
    this.addHouse(c - 760, m + 120, "houseB", "個人房子", 0.94);
    this.addHouse(c + 720, m + 150, "houseB", "競技場", 0.92);
    this.addHouse(c - 410, m + 470, "houseA", "商城", 0.9);
    this.addHouse(c + 520, m + 470, "houseA", "道館", 0.9);
    this.addHouse(c + 900, m + 450, "houseB", "RocksSmash4680", 0.94);
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
    const frame = getVillagePlayerAnimationFrame("engineer", moving, this.lastDirection, this.lastFacing, this.time.now);
    const pose = getVillagePlayerStepPose(moving, this.lastDirection, this.time.now);
    this.player
      .setTexture(`sprite_engineer_${frame.frameIndex}`)
      .setFlipX(frame.flipX)
      .setOrigin(0.5, pose.originY)
      .setDisplaySize(pose.width, pose.height)
      .setAngle(0);
    this.playerShadow
      .setPosition(this.player.x + pose.shadowOffsetX, this.player.y + pose.shadowOffsetY)
      .setScale(pose.shadowScaleX, pose.shadowScaleY)
      .setFillStyle(0x080604, pose.shadowAlpha)
      .setDepth(this.player.y - 3);
  }

  private rpgPetDirectionFrame(element: RpgElement, direction: "side" | "down" | "up") {
    const row = RPG_PET_SPRITE_ROW[element];
    const column = direction === "down" ? 0 : direction === "side" ? 1 : 2;
    return row * RPG_PET_DIRECTION_COLUMNS + column;
  }

  private rpgPetDirectionWalkFrame(element: RpgElement, direction: "side" | "down" | "up", frame: number) {
    const row = RPG_PET_SPRITE_ROW[element];
    const directionColumn = direction === "down" ? 0 : direction === "side" ? 1 : 2;
    const safeFrame = Math.max(0, Math.min(RPG_PET_DIRECTION_WALK_FRAME_COUNT - 1, frame));
    return row * RPG_PET_DIRECTION_WALK_COLUMNS + directionColumn * RPG_PET_DIRECTION_WALK_FRAME_COUNT + safeFrame;
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

  private createPetAnimations() {
    for (const pet of RPG_STARTER_PETS) {
      const idleKey = `rpg_pet_${pet.element}_idle`;
      const walkKey = `rpg_pet_${pet.element}_walk`;
      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          frames: rpgPetAnimationFrameIndexes(pet.element, "idle").map((frame) => ({ key: "rpgPetSprites", frame })),
          frameRate: 5,
          repeat: -1
        });
      }
      if (!this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: rpgPetAnimationFrameIndexes(pet.element, "walk").map((frame) => ({ key: "rpgPetSprites", frame })),
          frameRate: 10,
          repeat: -1
        });
      }
      for (const direction of ["down", "up"] as const) {
        const directionWalkKey = `rpg_pet_${pet.element}_${direction}_walk`;
        if (!this.anims.exists(directionWalkKey)) {
          this.anims.create({
            key: directionWalkKey,
            frames: Array.from({ length: RPG_PET_DIRECTION_WALK_FRAME_COUNT }, (_, frame) => ({
              key: "rpgPetDirectionWalk",
              frame: this.rpgPetDirectionWalkFrame(pet.element, direction, frame)
            })),
            frameRate: 9,
            repeat: -1
          });
        }
      }
    }
  }
}

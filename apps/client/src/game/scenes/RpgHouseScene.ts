import Phaser from "phaser";
import { getClassFrameCrop } from "../assets/crops";
import { generatedAssetPath } from "../assets/generatedAssets";
import {
  getVillagePlayerAnimationFrame,
  getVillagePlayerStepPose,
  VILLAGE_PLAYER_DISPLAY,
  VILLAGE_PLAYER_ORIGIN_Y,
  type VillagePlayerDirection,
  type VillagePlayerFacing
} from "../render/villagePlayerAnimation";
import { renderVinciHouseRoom, VINCI_HOUSE_WORLD, VINCI_HOUSE_ZONES, type HouseInteractZone } from "../render/vinciHouseRoom";
import { useRpgStore, type RpgPlace } from "../../state/rpgStore";

const PLAYER_SPEED = 184;
const PLAYER_START = { x: 760, y: 480 };
const PLAYER_BOUNDS = {
  left: 76,
  right: 1230,
  top: 280,
  bottom: 785
} as const;

export class RpgHouseScene extends Phaser.Scene {
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private player!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastFacing: VillagePlayerFacing = "left";
  private lastMoveAxis: "horizontal" | "vertical" = "horizontal";
  private lastDirection: VillagePlayerDirection = "side";
  private lastNearPlace: RpgPlace | null = null;

  constructor() {
    super("RpgHouseScene");
  }

  preload() {
    this.load.image("classSprites", generatedAssetPath("class-sprites"));
    this.load.image("vinciShowroomEntity", "/assets/vinci-world/showroom/standard/standard_entity.webp");
    this.load.image("vinciShowroomProps", "/assets/vinci-world/showroom/standard/standard_props.webp");
  }

  create() {
    this.cameras.main.setBounds(0, 0, VINCI_HOUSE_WORLD.width, VINCI_HOUSE_WORLD.height);
    this.cameras.main.roundPixels = true;
    renderVinciHouseRoom(this);
    this.createPlayer();
    this.createCabinetHotspots();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 40);
    useRpgStore.getState().setNearPlace(null);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const store = useRpgStore.getState();
      if (store.activeLocation === "house") store.setNearPlace(null);
    });
  }

  override update(_time: number, delta: number) {
    const store = useRpgStore.getState();
    if (store.activeLocation !== "house") {
      this.scene.start("RpgVillageScene");
      return;
    }

    const seconds = delta / 1000;
    const moveX = (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    const moveY = (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) - (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0);
    const length = Math.hypot(moveX, moveY) || 1;
    const moving = moveX !== 0 || moveY !== 0;

    if (moving) {
      const speed = PLAYER_SPEED * (this.keys.SPACE.isDown ? 1.18 : 1);
      this.player.x = Phaser.Math.Clamp(this.player.x + (moveX / length) * speed * seconds, PLAYER_BOUNDS.left, PLAYER_BOUNDS.right);
      this.player.y = Phaser.Math.Clamp(this.player.y + (moveY / length) * speed * seconds, PLAYER_BOUNDS.top, PLAYER_BOUNDS.bottom);
      this.lastMoveAxis = Math.abs(moveY) > Math.abs(moveX) ? "vertical" : "horizontal";
      if (this.lastMoveAxis === "horizontal") {
        this.lastFacing = moveX < 0 ? "left" : moveX > 0 ? "right" : this.lastFacing;
        this.lastDirection = "side";
      } else {
        this.lastDirection = moveY < 0 ? "up" : "down";
      }
    }

    this.updatePlayerFrame(moving);
    this.updateNearPlace();
    this.playerLabel.setPosition(this.player.x, this.player.y - 74).setDepth(this.player.y + 1);
    this.playerShadow.setDepth(this.player.y - 3);
    this.player.setDepth(this.player.y);
  }

  private createPlayer() {
    this.playerShadow = this.add.ellipse(PLAYER_START.x, PLAYER_START.y + 13, 72, 18, 0x080604, 0.22).setDepth(PLAYER_START.y - 3);
    const initialFrame = this.ensurePlayerFrame(4);
    this.player = this.add
      .image(PLAYER_START.x, PLAYER_START.y, "classSprites", initialFrame)
      .setOrigin(0.5, VILLAGE_PLAYER_ORIGIN_Y)
      .setDisplaySize(VILLAGE_PLAYER_DISPLAY.width, VILLAGE_PLAYER_DISPLAY.height)
      .setFlipX(true)
      .setDepth(PLAYER_START.y);
    this.playerLabel = this.add
      .text(this.player.x, this.player.y - 74, "Ari", {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#fff3b0",
        stroke: "#27170e",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(this.player.y + 1);
  }

  private createCabinetHotspots() {
    const zone = VINCI_HOUSE_ZONES.cabinet;
    this.add
      .zone(zone.x, zone.y, zone.width, zone.height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        useRpgStore.getState().openProfile();
      });
  }

  private updatePlayerFrame(moving: boolean) {
    const frame = getVillagePlayerAnimationFrame("engineer", moving, this.lastDirection, this.lastFacing, this.time.now);
    const pose = getVillagePlayerStepPose(moving, this.lastDirection, this.time.now);
    this.player
      .setTexture("classSprites", this.ensurePlayerFrame(frame.frameIndex))
      .setFlipX(frame.flipX)
      .setOrigin(0.5, pose.originY)
      .setDisplaySize(pose.width, pose.height);
    this.playerShadow
      .setPosition(this.player.x + pose.shadowOffsetX, this.player.y + pose.shadowOffsetY)
      .setScale(pose.shadowScaleX, pose.shadowScaleY)
      .setFillStyle(0x080604, pose.shadowAlpha);
  }

  private ensurePlayerFrame(frameIndex: number) {
    const crop = getClassFrameCrop("engineer", frameIndex);
    const frame = `house-engineer-${frameIndex}`;
    const sourceTexture = this.textures.get("classSprites");
    if (!sourceTexture.has(frame)) {
      sourceTexture.add(frame, 0, crop.x, crop.y, crop.width, crop.height);
    }
    return frame;
  }

  private updateNearPlace() {
    const nearPlace = this.isNear(VINCI_HOUSE_ZONES.cabinet) ? "cabinet" : this.isNear(VINCI_HOUSE_ZONES.door) ? "houseExit" : null;
    if (nearPlace !== this.lastNearPlace) {
      this.lastNearPlace = nearPlace;
      useRpgStore.getState().setNearPlace(nearPlace);
    }

    if (nearPlace && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      if (nearPlace === "cabinet") useRpgStore.getState().openProfile();
      if (nearPlace === "houseExit") useRpgStore.getState().exitHouse();
    }
  }

  private isNear(zone: HouseInteractZone) {
    return Math.abs(this.player.x - zone.x) < zone.width / 2 + 32 && Math.abs(this.player.y - zone.y) < zone.height / 2 + 46;
  }
}

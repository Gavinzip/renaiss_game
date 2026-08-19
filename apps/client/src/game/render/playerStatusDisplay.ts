import Phaser from "phaser";
import {
  compareArenaStatuses,
  getArenaStatusTone,
  type PublicPlayer
} from "@renaiss-game/shared";
import { resolveArenaLanguage } from "../../i18n/arena";
import {
  getStatusAuraFrameTexture,
  STATUS_AURA_FRAME_COUNT
} from "../assets/crops";
import {
  ARENA_STATUS_PALETTE,
  formatArenaStatusLabel
} from "./arenaStatusPresentation";
import {
  ARENA_SHIELD_PRESENTATION,
  getArenaStatusPresentation
} from "./arenaStatusVisualPolicy";
import {
  setTextColorIfChanged,
  setTextFontSizeIfChanged,
  setTextStrokeIfChanged
} from "./textStyle";

const STATUS_LABEL_BASE_Y = -116;
const STUN_STATUS_LABEL_BASE_Y = -154;
const STATUS_LABEL_SPACING = 18;
const STUN_AURA_Y = -122;
const SPAWN_AURA_SIZE = { width: 62, height: 18, alpha: 0.055 };

export class PlayerStatusDisplay {
  private readonly shieldAura: Phaser.GameObjects.Image;
  private readonly stunAura: Phaser.GameObjects.Image;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
    private readonly groundY: number
  ) {
    this.shieldAura = scene.add
      .image(0, groundY + 2, getStatusAuraFrameTexture("shield", 0))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.stunAura = scene.add
      .image(0, STUN_AURA_Y, getStatusAuraFrameTexture("stun", 0))
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    container.add([this.shieldAura, this.stunAura]);
  }

  bringForegroundToTop() {
    this.container.bringToTop(this.stunAura);
    for (const label of this.labels) {
      this.container.bringToTop(label);
    }
  }

  hide() {
    this.shieldAura.setVisible(false);
    this.stunAura.setVisible(false);
    for (const label of this.labels) {
      label.setVisible(false);
    }
  }

  update(player: PublicPlayer, now: number, nameY: number) {
    if (!player.alive) {
      this.hide();
      return;
    }

    this.updateAuras(player, now, nameY);
    this.updateLabels(player, nameY);
  }

  private updateAuras(player: PublicPlayer, now: number, nameY: number) {
    const frame = Math.floor(now / 90) % STATUS_AURA_FRAME_COUNT;
    const pulse = 1 + Math.sin(now / 180) * 0.025;
    const shieldVisible = player.spawnProtected || (
      ARENA_SHIELD_PRESENTATION.material === "shield" && player.shielded
    );
    const stunned = player.statuses.some(
      (status) => getArenaStatusPresentation(status.id).material === "stun"
    );
    const shieldSize = player.spawnProtected
      ? SPAWN_AURA_SIZE
      : { width: 106, height: 62, alpha: 0.56 };
    this.shieldAura
      .setVisible(shieldVisible)
      .setTexture(getStatusAuraFrameTexture("shield", frame))
      .setPosition(0, player.spawnProtected ? this.groundY + 7 : this.groundY + 2)
      .setDisplaySize(shieldSize.width * pulse, shieldSize.height * pulse)
      .setAlpha(shieldSize.alpha * (0.92 + Math.sin(now / 240) * 0.06))
      .setTint(player.spawnProtected ? 0xd8ffd0 : 0xffffff)
      .setBlendMode(player.spawnProtected ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);

    this.stunAura
      .setVisible(stunned)
      .setTexture(getStatusAuraFrameTexture("stun", frame))
      .setPosition(0, Math.min(STUN_AURA_Y, nameY - 30))
      .setDisplaySize(92 * pulse, 54 * pulse)
      .setAlpha(0.82 * (0.94 + Math.sin(now / 180) * 0.06))
      .setTint(0xffffff)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private updateLabels(player: PublicPlayer, nameY: number) {
    const statuses = player.statuses
      .filter((status) => getArenaStatusPresentation(status.id).overheadLabel)
      .sort(compareArenaStatuses);
    this.ensureLabelCount(statuses.length);

    const language = resolveArenaLanguage();
    const ordinaryBaseY = Math.min(STATUS_LABEL_BASE_Y, nameY - 24);
    const baseY = player.statuses.some(
      (status) => getArenaStatusPresentation(status.id).material === "stun"
    )
      ? Math.min(STUN_STATUS_LABEL_BASE_Y, this.stunAura.y - 31)
      : ordinaryBaseY;
    this.labels.forEach((label, index) => {
      const status = statuses[index];
      if (!status) {
        label.setVisible(false);
        return;
      }

      const tone = getArenaStatusTone(status.id);
      const palette = ARENA_STATUS_PALETTE[tone];
      label
        .setVisible(true)
        .setText(formatArenaStatusLabel(status, language))
        .setPosition(0, baseY - index * STATUS_LABEL_SPACING);
      setTextFontSizeIfChanged(label, language === "en" ? 12 : 14);
      setTextColorIfChanged(label, palette.text);
      setTextStrokeIfChanged(label, palette.stroke, 5);
    });
  }

  private ensureLabelCount(count: number) {
    while (this.labels.length < count) {
      const label = this.scene.add
        .text(0, STATUS_LABEL_BASE_Y, "", {
          fontFamily: "Arial Black, Arial, sans-serif",
          fontSize: "14px",
          color: ARENA_STATUS_PALETTE.positive.text,
          stroke: ARENA_STATUS_PALETTE.positive.stroke,
          strokeThickness: 5,
          align: "center"
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.container.add(label);
      this.labels.push(label);
    }
  }

}

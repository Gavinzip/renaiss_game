import Phaser from "phaser";
import { WORLD, type MapProp } from "@renaiss-game/shared";
import { getRenderableMapProps } from "../mapDraft";

type AmbientKind = "mote" | "spark" | "ember";

interface AmbientParticle {
  sprite: Phaser.GameObjects.Image;
  bornAt: number;
  duration: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  startScale: number;
  endScale: number;
  alpha: number;
  spin: number;
}

const TEXTURES: Record<AmbientKind, string> = {
  mote: "ambient_pixel_mote",
  spark: "ambient_pixel_spark",
  ember: "ambient_pixel_ember"
};

const MAX_PARTICLES = 72;

export class AmbientField {
  private readonly particles: AmbientParticle[] = [];
  private readonly anchors: MapProp[] = getRenderableMapProps().filter((prop) => prop.type === "crystal" || prop.type === "fountain" || prop.type === "lamp");
  private nextMoteAt = 0;
  private nextAnchorSparkAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.ensureTextures();
  }

  update(time: number, delta: number) {
    this.spawnVisibleMotes(time, delta);
    this.spawnAnchorSparkles(time);
    this.updateParticles(time);
  }

  destroy() {
    this.particles.splice(0).forEach((particle) => particle.sprite.destroy());
  }

  private spawnVisibleMotes(time: number, delta: number) {
    if (time < this.nextMoteAt || this.particles.length >= MAX_PARTICLES) {
      return;
    }

    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    const spawnCount = delta > 24 ? 1 : 2;
    this.nextMoteAt = time + Phaser.Math.Between(72, 128);

    for (let index = 0; index < spawnCount && this.particles.length < MAX_PARTICLES; index += 1) {
      const x = Phaser.Math.Clamp(view.x + Phaser.Math.Between(90, Math.max(90, view.width - 90)), 0, WORLD.width);
      const y = Phaser.Math.Clamp(view.y + Phaser.Math.Between(80, Math.max(80, view.height - 80)), 0, WORLD.height);
      const roadWeight = this.isRoadLike(x, y) ? 0.25 : 1;
      if (Math.random() > roadWeight) {
        continue;
      }

      const tint = Phaser.Math.RND.pick([0xeaffac, 0xd8f6ff, 0xffe59a, 0xbfff86]);
      this.addParticle({
        kind: "mote",
        x,
        y,
        duration: Phaser.Math.Between(1300, 2100),
        driftX: Phaser.Math.Between(-18, 18),
        driftY: Phaser.Math.Between(-42, -18),
        alpha: Phaser.Math.FloatBetween(0.16, 0.34),
        startScale: Phaser.Math.FloatBetween(0.55, 0.9),
        endScale: Phaser.Math.FloatBetween(0.78, 1.18),
        tint,
        depth: y + Phaser.Math.Between(12, 34),
        spin: Phaser.Math.FloatBetween(-0.12, 0.12)
      });
    }
  }

  private spawnAnchorSparkles(time: number) {
    if (time < this.nextAnchorSparkAt || this.particles.length >= MAX_PARTICLES) {
      return;
    }
    this.nextAnchorSparkAt = time + Phaser.Math.Between(90, 170);

    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    const visibleAnchors = this.anchors.filter((anchor) => Phaser.Geom.Rectangle.Contains(view, anchor.x, anchor.y));
    if (visibleAnchors.length === 0) {
      return;
    }

    const anchor = Phaser.Math.RND.pick(visibleAnchors);
    if (anchor.type === "lamp") {
      this.addEmber(anchor, time);
      return;
    }

    this.addCrystalGlint(anchor, time);
  }

  private addCrystalGlint(anchor: MapProp, time: number) {
    const x = anchor.x + Phaser.Math.Between(-Math.round(anchor.width * 0.24), Math.round(anchor.width * 0.24));
    const y = anchor.y - anchor.height * Phaser.Math.FloatBetween(0.38, 0.78);
    this.addParticle({
      kind: "spark",
      x,
      y,
      duration: Phaser.Math.Between(620, 980),
      driftX: Phaser.Math.Between(-8, 8),
      driftY: Phaser.Math.Between(-20, -8),
      alpha: Phaser.Math.FloatBetween(0.42, 0.72),
      startScale: Phaser.Math.FloatBetween(0.65, 0.95),
      endScale: Phaser.Math.FloatBetween(1.0, 1.35),
      tint: Phaser.Math.RND.pick([0x8ff5ff, 0xffffff, 0xd8ff83, 0xcaa3ff]),
      depth: anchor.y + 68,
      spin: Phaser.Math.FloatBetween(-0.26, 0.26),
      bornAt: time
    });
  }

  private addEmber(anchor: MapProp, time: number) {
    this.addParticle({
      kind: "ember",
      x: anchor.x + Phaser.Math.Between(-4, 4),
      y: anchor.y - anchor.height * 0.64 + Phaser.Math.Between(-5, 5),
      duration: Phaser.Math.Between(720, 1120),
      driftX: Phaser.Math.Between(-10, 10),
      driftY: Phaser.Math.Between(-32, -16),
      alpha: Phaser.Math.FloatBetween(0.3, 0.55),
      startScale: Phaser.Math.FloatBetween(0.68, 1),
      endScale: Phaser.Math.FloatBetween(0.96, 1.22),
      tint: Phaser.Math.RND.pick([0xffd06a, 0xfff0a6, 0xff9d53]),
      depth: anchor.y + 24,
      spin: Phaser.Math.FloatBetween(-0.18, 0.18),
      bornAt: time
    });
  }

  private addParticle(config: {
    kind: AmbientKind;
    x: number;
    y: number;
    duration: number;
    driftX: number;
    driftY: number;
    alpha: number;
    startScale: number;
    endScale: number;
    tint: number;
    depth: number;
    spin: number;
    bornAt?: number;
  }) {
    const sprite = this.scene.add
      .image(config.x, config.y, TEXTURES[config.kind])
      .setOrigin(0.5)
      .setDepth(config.depth)
      .setTint(config.tint)
      .setAlpha(config.alpha)
      .setScale(config.startScale)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.particles.push({
      sprite,
      bornAt: config.bornAt ?? this.scene.time.now,
      duration: config.duration,
      x: config.x,
      y: config.y,
      driftX: config.driftX,
      driftY: config.driftY,
      startScale: config.startScale,
      endScale: config.endScale,
      alpha: config.alpha,
      spin: config.spin
    });
  }

  private updateParticles(time: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      const progress = Phaser.Math.Clamp((time - particle.bornAt) / particle.duration, 0, 1);
      if (progress >= 1) {
        particle.sprite.destroy();
        this.particles.splice(index, 1);
        continue;
      }

      const rise = Phaser.Math.Easing.Sine.Out(progress);
      const fade = Math.sin(progress * Math.PI);
      const driftNoise = Math.sin(time / 180 + index * 1.7) * 4;
      particle.sprite
        .setPosition(particle.x + particle.driftX * rise + driftNoise, particle.y + particle.driftY * rise)
        .setScale(Phaser.Math.Linear(particle.startScale, particle.endScale, progress))
        .setAlpha(particle.alpha * fade)
        .setAngle(particle.sprite.angle + particle.spin);
    }
  }

  private ensureTextures() {
    if (this.scene.textures.exists(TEXTURES.mote)) {
      return;
    }

    const graphics = this.scene.add.graphics();

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(3, 0, 2, 8);
    graphics.fillRect(0, 3, 8, 2);
    graphics.fillRect(2, 2, 4, 4);
    graphics.generateTexture(TEXTURES.mote, 8, 8);

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(5, 0, 2, 12);
    graphics.fillRect(0, 5, 12, 2);
    graphics.fillRect(3, 3, 6, 6);
    graphics.fillRect(2, 2, 2, 2);
    graphics.fillRect(8, 8, 2, 2);
    graphics.generateTexture(TEXTURES.spark, 12, 12);

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(3, 0, 3, 8);
    graphics.fillRect(2, 2, 5, 5);
    graphics.fillRect(1, 5, 7, 3);
    graphics.generateTexture(TEXTURES.ember, 9, 9);

    graphics.destroy();
  }

  private isRoadLike(x: number, y: number) {
    const center = WORLD.width / 2;
    return Math.abs(x - center) < 210 || Math.abs(y - center) < 210 || Math.hypot(x - center, y - center) < 820;
  }
}

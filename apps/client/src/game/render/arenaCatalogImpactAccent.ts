import Phaser from "phaser";
import type { EffectState } from "@renaiss-game/shared";

const STAR_SNIPE_WARNING_END = 0.18;
const STAR_SNIPE_IMPACT_START = 0.59;

export function needsArenaCatalogImpactAccent(effect: EffectState) {
  return effect.skillId === "archer_12" || effect.skillId === "archer_14";
}

export function drawArenaCatalogImpactAccent(
  graphics: Phaser.GameObjects.Graphics,
  effect: EffectState,
  timelineProgress: number
) {
  graphics.clear().setVisible(false);
  if (timelineProgress < 0) {
    return;
  }

  if (effect.skillId === "archer_12") {
    drawStarSnipeAccent(graphics, effect, timelineProgress);
    return;
  }
  if (effect.skillId === "archer_14") {
    drawHawkExecutionAccent(graphics, effect, timelineProgress);
  }
}

function drawStarSnipeAccent(
  graphics: Phaser.GameObjects.Graphics,
  effect: EffectState,
  timelineProgress: number
) {
  const radius = Math.max(84, effect.radius * 0.78);
  graphics
    .setVisible(true)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(effect.y + 64);

  if (timelineProgress < STAR_SNIPE_WARNING_END) {
    const warningProgress = Phaser.Math.Clamp(
      timelineProgress / STAR_SNIPE_WARNING_END,
      0,
      1
    );
    const alpha = 0.42 + warningProgress * 0.46;
    const contractingRadius = radius * (1.18 - warningProgress * 0.22);
    graphics
      .lineStyle(5, 0xffb33f, alpha)
      .strokeEllipse(
        effect.x,
        effect.y - 4,
        contractingRadius * 2,
        contractingRadius * 0.76
      )
      .lineStyle(2, 0xffffcf, Math.min(1, alpha + 0.12))
      .strokeEllipse(
        effect.x,
        effect.y - 4,
        contractingRadius * 1.36,
        contractingRadius * 0.5
      )
      .lineBetween(effect.x - 22, effect.y - 4, effect.x + 22, effect.y - 4)
      .lineBetween(effect.x, effect.y - 26, effect.x, effect.y + 18);
    return;
  }

  if (timelineProgress < STAR_SNIPE_IMPACT_START) {
    const charge = Phaser.Math.Clamp(
      (timelineProgress - STAR_SNIPE_WARNING_END) /
        (STAR_SNIPE_IMPACT_START - STAR_SNIPE_WARNING_END),
      0,
      1
    );
    graphics
      .lineStyle(3, 0xffd66b, 0.5 + charge * 0.25)
      .strokeEllipse(effect.x, effect.y - 4, radius * 1.5, radius * 0.54);
    return;
  }

  const impactProgress = Phaser.Math.Clamp(
    (timelineProgress - STAR_SNIPE_IMPACT_START) /
      (1 - STAR_SNIPE_IMPACT_START),
    0,
    1
  );
  const alpha = 1 - impactProgress;
  const burstRadius = radius * (0.42 + impactProgress * 0.9);
  graphics
    .fillStyle(0xffca4a, 0.2 * alpha)
    .fillEllipse(effect.x, effect.y - 6, burstRadius * 1.3, burstRadius * 0.48)
    .lineStyle(7, 0xff9f2f, 0.72 * alpha)
    .strokeEllipse(effect.x, effect.y - 6, burstRadius * 1.7, burstRadius * 0.62)
    .lineStyle(3, 0xffffde, 0.96 * alpha)
    .strokeEllipse(effect.x, effect.y - 6, burstRadius * 1.2, burstRadius * 0.44);

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const inner = burstRadius * 0.28;
    const outer = burstRadius * (0.72 + (index % 2) * 0.18);
    graphics.lineBetween(
      effect.x + Math.cos(angle) * inner,
      effect.y - 6 + Math.sin(angle) * inner * 0.42,
      effect.x + Math.cos(angle) * outer,
      effect.y - 6 + Math.sin(angle) * outer * 0.42
    );
  }
}

function drawHawkExecutionAccent(
  graphics: Phaser.GameObjects.Graphics,
  effect: EffectState,
  timelineProgress: number
) {
  const impactStarted = timelineProgress >= 0.78;
  const ringAlpha = impactStarted
    ? Phaser.Math.Clamp((timelineProgress - 0.78) / 0.12, 0, 1)
    : 0;
  graphics
    .setVisible(ringAlpha > 0)
    .setAlpha(ringAlpha)
    .setDepth(effect.y + 30)
    .setBlendMode(Phaser.BlendModes.NORMAL);
  if (ringAlpha <= 0) {
    return;
  }
  graphics
    .fillStyle(0x9b5b18, 0.18)
    .fillEllipse(effect.x, effect.y, effect.radius * 2, effect.radius * 0.82)
    .lineStyle(6, 0xf3b847, 0.58)
    .strokeEllipse(effect.x, effect.y, effect.radius * 2, effect.radius * 0.82)
    .lineStyle(2, 0xfff0a6, 0.96)
    .strokeEllipse(effect.x, effect.y, effect.radius * 2, effect.radius * 0.82);
}

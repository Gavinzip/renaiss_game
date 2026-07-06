import type { ClassId, EffectState } from "@renaiss-game/shared";
import {
  ABILITY_VFX_FRAME_COUNT,
  COMBAT_VFX_FRAME_COUNT,
  ENGINEER_VFX_FRAME_COUNT,
  EFFECT_VFX,
  getAbilityVfxFrameTexture,
  getCombatVfxFrameTexture,
  getEngineerVfxFrameTexture,
  getMageVfxFrameTexture,
  getVfxFrameTexture,
  getWarriorArcherVfxFrameTexture,
  getWarriorVerdictVfxFrameTexture,
  MAGE_VFX_FRAME_COUNT,
  VFX_FRAME_COUNT,
  WARRIOR_ARCHER_VFX_FRAME_COUNT,
  WARRIOR_VERDICT_VFX_FRAME_COUNT,
  type AbilityVfxKey,
  type CombatVfxKey,
  type EngineerVfxKey,
  type MageVfxKey,
  type WarriorVerdictVfxKey,
  type WarriorArcherVfxKey,
  type VfxKey
} from "./crops";

export interface VfxDisplaySpec {
  width: number;
  height: number;
  alpha: number;
}

type VfxLayer = "ground" | "unit" | "air";
type VfxBlendMode = "normal" | "add";

interface BaseVfxSpec {
  frameCount: number;
  frameOffset?: number;
  layer: VfxLayer;
  rotated?: boolean;
  origin?: { x: number; y: number };
  blendMode?: VfxBlendMode;
  fadeIn?: number;
  fadeOut?: number;
  scaleCurve?: (progress: number) => number;
  display: (effect: EffectState, progress: number) => VfxDisplaySpec;
}

export type RenderVfxSpec =
  | (BaseVfxSpec & {
      source: "standard";
      key: VfxKey;
    })
  | (BaseVfxSpec & {
      source: "ability";
      key: AbilityVfxKey;
    })
  | (BaseVfxSpec & {
      source: "combat";
      key: CombatVfxKey;
    })
  | (BaseVfxSpec & {
      source: "warriorArcher";
      key: WarriorArcherVfxKey;
    })
  | (BaseVfxSpec & {
      source: "warriorVerdict";
      key: WarriorVerdictVfxKey;
    })
  | (BaseVfxSpec & {
      source: "engineer";
      key: EngineerVfxKey;
    })
  | (BaseVfxSpec & {
      source: "mage";
      key: MageVfxKey;
    });

const STANDARD_VFX: Record<VfxKey, RenderVfxSpec> = {
  shield: {
    source: "standard",
    key: "shield",
    frameCount: VFX_FRAME_COUNT,
    layer: "unit",
    display: (effect) => ({ width: effect.radius * 2.05, height: effect.radius * 2.05, alpha: 0.9 })
  }
};

const COMBAT_VFX: Record<CombatVfxKey, RenderVfxSpec> = {
  mageSolarBeam: {
    source: "combat",
    key: "mageSolarBeam",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    origin: { x: 0.04, y: 0.5 },
    blendMode: "add",
    fadeIn: 0.1,
    fadeOut: 0.28,
    scaleCurve: beamSnap,
    display: (effect, progress) => {
      const extension = mageBeamExtension(progress);
      return {
        width: Math.max(72, Math.min(680, effect.radius * (0.08 + extension * 0.94))),
        height: 38 + Math.sin(progress * Math.PI) * 18,
        alpha: 0.46 + extension * 0.42
      };
    }
  },
  arrowProjectile: {
    source: "combat",
    key: "arrowProjectile",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    scaleCurve: projectilePulse,
    display: () => ({ width: 96, height: 40, alpha: 0.98 })
  },
  magicOrbProjectile: {
    source: "combat",
    key: "magicOrbProjectile",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    blendMode: "add",
    scaleCurve: projectilePulse,
    display: () => ({ width: 76, height: 76, alpha: 0.98 })
  },
  turretShot: {
    source: "combat",
    key: "turretShot",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    blendMode: "add",
    scaleCurve: projectilePulse,
    display: () => ({ width: 78, height: 38, alpha: 0.98 })
  },
  turretShotBoosted: {
    source: "combat",
    key: "turretShotBoosted",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    blendMode: "add",
    scaleCurve: projectilePulse,
    display: () => ({ width: 108, height: 48, alpha: 0.98 })
  },
  hitImpact: {
    source: "combat",
    key: "hitImpact",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    display: (effect) => ({ width: Math.max(78, effect.radius * 2.15), height: Math.max(78, effect.radius * 2.15), alpha: 0.97 })
  },
  blockImpact: {
    source: "combat",
    key: "blockImpact",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    display: (effect) => ({ width: Math.max(88, effect.radius * 2.2), height: Math.max(88, effect.radius * 2.2), alpha: 0.96 })
  },
  healPickup: {
    source: "combat",
    key: "healPickup",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    fadeOut: 0.12,
    display: () => ({ width: 126, height: 126, alpha: 0.96 })
  },
  deathBurst: {
    source: "combat",
    key: "deathBurst",
    frameCount: COMBAT_VFX_FRAME_COUNT,
    layer: "air",
    fadeOut: 0.1,
    display: (effect) => ({ width: Math.max(160, effect.radius * 1.75), height: Math.max(150, effect.radius * 1.55), alpha: 0.94 })
  }
};

const ABILITY_VFX: Record<AbilityVfxKey, RenderVfxSpec> = {
  meleeSlash: {
    source: "ability",
    key: "meleeSlash",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    origin: { x: 0.18, y: 0.58 },
    fadeOut: 0.16,
    scaleCurve: quickStrikePop,
    display: (effect) => ({ width: Math.max(158, effect.radius * 1.92), height: 86, alpha: 0.9 })
  },
  warriorSlash: {
    source: "ability",
    key: "warriorSlash",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    origin: { x: 0.18, y: 0.58 },
    fadeOut: 0.16,
    scaleCurve: quickStrikePop,
    display: (effect) => ({ width: Math.max(150, effect.radius * 1.78), height: 80, alpha: 0.9 })
  },
  engineerStrike: {
    source: "ability",
    key: "engineerStrike",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    origin: { x: 0.2, y: 0.56 },
    fadeOut: 0.16,
    scaleCurve: quickStrikePop,
    display: (effect) => ({ width: Math.max(146, effect.radius * 1.62), height: 78, alpha: 0.88 })
  },
  warriorVerdict: {
    source: "ability",
    key: "warriorVerdict",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "ground",
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.94 })
  },
  archerSeedRain: {
    source: "ability",
    key: "archerSeedRain",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "ground",
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.92 })
  },
  engineerOverclock: {
    source: "ability",
    key: "engineerOverclock",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "ground",
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.93 })
  },
  mageCleanStorm: {
    source: "ability",
    key: "mageCleanStorm",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "ground",
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.9 })
  },
  mageBurst: {
    source: "ability",
    key: "mageBurst",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "ground",
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.9 })
  },
  hitImpact: {
    source: "ability",
    key: "hitImpact",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "air",
    display: (effect) => ({ width: effect.radius * 1.7, height: effect.radius * 1.35, alpha: 0.95 })
  },
  deathBurst: {
    source: "ability",
    key: "deathBurst",
    frameCount: ABILITY_VFX_FRAME_COUNT,
    layer: "air",
    display: (effect) => ({ width: effect.radius * 1.42, height: effect.radius * 1.22, alpha: 0.92 })
  }
};

const WARRIOR_ARCHER_VFX: Record<WarriorArcherVfxKey, RenderVfxSpec> = {
  warriorCharge: {
    source: "warriorArcher",
    key: "warriorCharge",
    frameCount: WARRIOR_ARCHER_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    origin: { x: 0.18, y: 0.58 },
    fadeIn: 0.04,
    fadeOut: 0.18,
    scaleCurve: dashRibbonPop,
    display: (effect) => ({ width: Math.max(184, effect.radius * 1.8), height: 82, alpha: 0.82 })
  },
  warriorShield: {
    source: "warriorArcher",
    key: "warriorShield",
    frameCount: WARRIOR_ARCHER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeOut: 0.14,
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.92 })
  },
  warriorVerdict: {
    source: "warriorArcher",
    key: "warriorVerdict",
    frameCount: WARRIOR_ARCHER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeOut: 0.14,
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.94 })
  },
  archerRoll: {
    source: "warriorArcher",
    key: "archerRoll",
    frameCount: WARRIOR_ARCHER_VFX_FRAME_COUNT,
    layer: "air",
    rotated: true,
    origin: { x: 0.18, y: 0.58 },
    fadeIn: 0.04,
    fadeOut: 0.18,
    scaleCurve: dashRibbonPop,
    display: (effect) => ({ width: Math.max(178, effect.radius * 1.72), height: 82, alpha: 0.8 })
  },
  archerRoot: {
    source: "warriorArcher",
    key: "archerRoot",
    frameCount: WARRIOR_ARCHER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeOut: 0.1,
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.95 })
  },
  archerSeedRain: {
    source: "warriorArcher",
    key: "archerSeedRain",
    frameCount: WARRIOR_ARCHER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeOut: 0.14,
    scaleCurve: archerSeedRainImpact,
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.94 })
  }
};

const ENGINEER_VFX: Record<EngineerVfxKey, RenderVfxSpec> = {
  turretDeploy: {
    source: "engineer",
    key: "turretDeploy",
    frameCount: ENGINEER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeIn: 0.06,
    fadeOut: 0.18,
    display: (effect) => ({ width: Math.max(132, effect.radius * 1.62), height: Math.max(94, effect.radius * 1.08), alpha: 0.68 })
  },
  repulsorPulse: {
    source: "engineer",
    key: "repulsorPulse",
    frameCount: ENGINEER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeIn: 0.04,
    fadeOut: 0.26,
    scaleCurve: repulsorPulseScale,
    display: (effect) => ({
      width: effect.radius * 2,
      height: effect.radius * 2,
      alpha: 0.72
    })
  },
  overclock: {
    source: "engineer",
    key: "overclock",
    frameCount: ENGINEER_VFX_FRAME_COUNT,
    layer: "ground",
    fadeOut: 0.1,
    display: (effect) => ({ width: effect.radius * 2, height: effect.radius * 2, alpha: 0.93 })
  }
};

const MAGE_VFX: Record<MageVfxKey, RenderVfxSpec> = {
  renewalBurst: {
    source: "mage",
    key: "renewalBurst",
    frameCount: MAGE_VFX_FRAME_COUNT,
    layer: "ground",
    blendMode: "add",
    fadeIn: 0.04,
    fadeOut: 0.18,
    scaleCurve: mageGroundBloom,
    display: (effect) => ({
      width: effect.radius * 2,
      height: effect.radius * 2,
      alpha: 0.96
    })
  },
  cleanStorm: {
    source: "mage",
    key: "cleanStorm",
    frameCount: MAGE_VFX_FRAME_COUNT,
    layer: "ground",
    fadeIn: 0.05,
    fadeOut: 0.18,
    scaleCurve: mageStormBloom,
    display: (effect) => ({
      width: effect.radius * 2,
      height: effect.radius * 2,
      alpha: 0.96
    })
  }
};

const WARRIOR_VERDICT_VFX: Record<WarriorVerdictVfxKey, RenderVfxSpec> = {
  combatFx: {
    source: "warriorVerdict",
    key: "combatFx",
    frameCount: WARRIOR_VERDICT_VFX_FRAME_COUNT,
    layer: "ground",
    fadeOut: 0.12,
    scaleCurve: warriorVerdictImpact,
    display: (effect) => ({
      width: effect.radius * 2,
      height: effect.radius * 2,
      alpha: 0.94
    })
  }
};

export function getEffectVfxSpec(effect: EffectState): RenderVfxSpec | null {
  if (effect.type === "attack_arc") {
    if (effect.classId === "engineer") {
      return ABILITY_VFX.engineerStrike;
    }
    if (effect.classId === "warrior") {
      return null;
    }
    return ABILITY_VFX.meleeSlash;
  }

  if (effect.type === "ultimate") {
    if (effect.classId === "mage" || !effect.classId) {
      return MAGE_VFX.cleanStorm;
    }
    return getUltimateVfx(effect.classId);
  }

  if (effect.type === "burst") {
    return MAGE_VFX.renewalBurst;
  }

  if (effect.type === "beam") {
    return COMBAT_VFX.mageSolarBeam;
  }

  if (effect.type === "death") {
    return COMBAT_VFX.deathBurst;
  }

  if (effect.type === "turret_death") {
    return {
      ...COMBAT_VFX.deathBurst,
      display: (deathEffect) => ({
        width: Math.max(122, deathEffect.radius * 1.42),
        height: Math.max(112, deathEffect.radius * 1.22),
        alpha: 0.92
      })
    };
  }

  if (effect.type === "blocked_hit" || effect.type === "stun" || effect.type === "reflect") {
    return COMBAT_VFX.blockImpact;
  }

  if (effect.type === "damage_number") {
    return COMBAT_VFX.hitImpact;
  }

  if (effect.type === "heal_pickup") {
    return COMBAT_VFX.healPickup;
  }

  if (effect.type === "roll") {
    return WARRIOR_ARCHER_VFX.archerRoll;
  }

  if (effect.type === "shield" && effect.classId === "warrior" && effect.radius >= 110) {
    return WARRIOR_ARCHER_VFX.warriorShield;
  }

  if (effect.type === "root") {
    return WARRIOR_ARCHER_VFX.archerRoot;
  }

  if (effect.type === "root_cast") {
    return null;
  }

  if (effect.type === "turret_deploy") {
    return ENGINEER_VFX.turretDeploy;
  }

  if (effect.type === "repulsor_pulse") {
    return ENGINEER_VFX.repulsorPulse;
  }

  const standardKey = EFFECT_VFX[effect.type];
  return standardKey ? STANDARD_VFX[standardKey] : null;
}

export function getRenderedVfxTexture(spec: RenderVfxSpec, frame: number) {
  if (spec.source === "standard") {
    return getVfxFrameTexture(spec.key, frame);
  }
  if (spec.source === "combat") {
    return getCombatVfxFrameTexture(spec.key, frame);
  }
  if (spec.source === "mage") {
    return getMageVfxFrameTexture(spec.key, frame);
  }
  if (spec.source === "warriorArcher") {
    return getWarriorArcherVfxFrameTexture(spec.key, frame);
  }
  if (spec.source === "warriorVerdict") {
    return getWarriorVerdictVfxFrameTexture(frame);
  }
  if (spec.source === "engineer") {
    return getEngineerVfxFrameTexture(spec.key, frame);
  }
  return getAbilityVfxFrameTexture(spec.key, frame);
}

export function getRenderedVfxFrame(spec: RenderVfxSpec, progress: number) {
  const localFrame = Math.min(spec.frameCount - 1, Math.floor(progress * spec.frameCount));
  return localFrame + (spec.frameOffset ?? 0);
}

export function getRenderedVfxDisplay(effect: EffectState, spec: RenderVfxSpec, progress: number) {
  const display = spec.display(effect, progress);
  const fadeIn = spec.fadeIn ? easeOutCubic(clamp01(progress / spec.fadeIn)) : 1;
  const fadeOut = spec.fadeOut ? easeInCubic(clamp01((1 - progress) / spec.fadeOut)) : 1;
  const scale = spec.scaleCurve ? spec.scaleCurve(progress) : 1;
  return {
    ...display,
    width: display.width * scale,
    height: display.height * scale,
    alpha: Math.max(0, display.alpha * fadeIn * fadeOut)
  };
}

export function getRenderedVfxOrigin(spec: RenderVfxSpec) {
  return spec.origin ?? { x: 0.5, y: 0.5 };
}

export function getRenderedVfxDepth(effect: EffectState, spec: RenderVfxSpec) {
  if (spec.layer === "ground") {
    return effect.y + 2;
  }
  if (spec.layer === "unit") {
    return effect.y + 26;
  }
  return effect.y + 58;
}

export function shouldRotateVfx(spec: RenderVfxSpec) {
  return Boolean(spec.rotated);
}

export function getRenderedVfxBlendMode(spec: RenderVfxSpec) {
  return spec.blendMode ?? "normal";
}

function projectilePulse(progress: number) {
  return 0.96 + Math.sin(progress * Math.PI * 2) * 0.035;
}

function beamSnap(progress: number) {
  return 0.9 + easeOutCubic(clamp01(progress / 0.24)) * 0.12 - easeInCubic(clamp01((progress - 0.78) / 0.22)) * 0.18;
}

function repulsorPulseScale(progress: number) {
  return 0.64 + easeOutCubic(clamp01(progress / 0.62)) * 0.46 - easeInCubic(clamp01((progress - 0.82) / 0.18)) * 0.08;
}

function beamExtension(progress: number) {
  if (progress < 0.52) {
    return smoothStep(progress / 0.52) * 0.94;
  }
  if (progress > 0.62) {
    return Math.max(0.08, 0.94 - easeInCubic((progress - 0.62) / 0.38) * 0.86);
  }
  return 0.94 + Math.sin((progress - 0.52) * Math.PI * 2.2) * 0.018;
}

function mageBeamExtension(progress: number) {
  if (progress < 0.54) {
    return smoothStep(progress / 0.54) * 0.95;
  }
  if (progress > 0.64) {
    return Math.max(0.08, 0.95 - easeInCubic((progress - 0.64) / 0.36) * 0.87);
  }
  return 0.95 + Math.sin((progress - 0.54) * Math.PI * 2) * 0.016;
}

function quickStrikePop(progress: number) {
  if (progress < 0.14) {
    return 0.82 + easeOutCubic(progress / 0.14) * 0.18;
  }
  return 1 - easeInCubic(clamp01((progress - 0.72) / 0.28)) * 0.12;
}

function dashRibbonPop(progress: number) {
  if (progress < 0.18) {
    return 0.7 + easeOutCubic(progress / 0.18) * 0.32;
  }
  if (progress > 0.7) {
    return 1.02 - easeInCubic((progress - 0.7) / 0.3) * 0.2;
  }
  return 1.02;
}

function mageGroundBloom(progress: number) {
  if (progress < 0.2) {
    return 0.68 + easeOutCubic(progress / 0.2) * 0.34;
  }
  if (progress > 0.72) {
    return 1.02 - easeInCubic((progress - 0.72) / 0.28) * 0.12;
  }
  return 1.02 + Math.sin((progress - 0.2) * Math.PI * 2.4) * 0.025;
}

function mageStormBloom(progress: number) {
  if (progress < 0.16) {
    return 0.62 + easeOutCubic(progress / 0.16) * 0.42;
  }
  if (progress > 0.76) {
    return 1.04 - easeInCubic((progress - 0.76) / 0.24) * 0.16;
  }
  return 1.04 + Math.sin((progress - 0.16) * Math.PI * 1.8) * 0.035;
}

function archerSeedRainImpact(progress: number) {
  if (progress < 0.2) {
    return 0.74 + easeOutCubic(progress / 0.2) * 0.3;
  }
  if (progress > 0.76) {
    return 1.04 - easeInCubic((progress - 0.76) / 0.24) * 0.18;
  }
  return 1.04;
}

function warriorVerdictImpact(progress: number) {
  if (progress < 0.18) {
    return 0.7 + easeOutCubic(progress / 0.18) * 0.34;
  }
  if (progress > 0.72) {
    return 1.04 - easeInCubic((progress - 0.72) / 0.28) * 0.16;
  }
  return 1.04 + Math.sin((progress - 0.18) * Math.PI * 2.2) * 0.025;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInCubic(value: number) {
  return Math.pow(clamp01(value), 3);
}

function smoothStep(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function getUltimateVfx(classId: ClassId): RenderVfxSpec {
  if (classId === "warrior") {
    return WARRIOR_VERDICT_VFX.combatFx;
  }
  if (classId === "archer") {
    return WARRIOR_ARCHER_VFX.archerSeedRain;
  }
  if (classId === "engineer") {
    return ENGINEER_VFX.overclock;
  }
  return MAGE_VFX.cleanStorm;
}

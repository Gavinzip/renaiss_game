import type { ClassId, EffectType, RpgElement, SkillKey } from "@renaiss-game/shared";

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TexturePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ENV_CROPS = {
  grass: { x: 45, y: 45, width: 122, height: 122 },
  stone: { x: 390, y: 45, width: 122, height: 122 },
  stoneAlt: { x: 558, y: 45, width: 104, height: 122 },
  corner: { x: 32, y: 198, width: 150, height: 150 },
  houseA: { x: 738, y: 166, width: 314, height: 284 },
  houseB: { x: 1077, y: 142, width: 348, height: 308 },
  treeRound: { x: 28, y: 498, width: 118, height: 152 },
  treePine: { x: 158, y: 492, width: 120, height: 162 },
  crystal: { x: 495, y: 488, width: 138, height: 162 },
  fountain: { x: 560, y: 650, width: 270, height: 342 },
  fence: { x: 768, y: 22, width: 330, height: 116 },
  lamp: { x: 852, y: 804, width: 76, height: 190 },
  banner: { x: 1057, y: 840, width: 96, height: 146 },
  crate: { x: 1005, y: 762, width: 78, height: 78 },
  barrel: { x: 895, y: 732, width: 104, height: 110 }
} satisfies Record<string, Crop>;

export type EnvCropKey = keyof typeof ENV_CROPS;

export const ENV_TEXTURES = Object.fromEntries(
  Object.keys(ENV_CROPS).map((key) => [key, `env_${key}`])
) as Record<EnvCropKey, string>;

export type ArenaDecalKey =
  | "mossStone"
  | "crackedStone"
  | "grassMound"
  | "whiteFlowers"
  | "shrub"
  | "rockCluster"
  | "runeRound"
  | "runeGem"
  | "fenceShort"
  | "stoneCorner"
  | "leaves"
  | "battleScuff"
  | "yellowFlowers"
  | "blueFlowers"
  | "diamondRune"
  | "pinkFlowers"
  | "berryShrub"
  | "brokenFence"
  | "flatRock"
  | "bannerPost";

const ARENA_DECAL_GRID: Record<ArenaDecalKey, { column: number; row: number }> = {
  mossStone: { column: 0, row: 0 },
  crackedStone: { column: 1, row: 0 },
  grassMound: { column: 2, row: 0 },
  whiteFlowers: { column: 3, row: 0 },
  shrub: { column: 4, row: 0 },
  rockCluster: { column: 0, row: 1 },
  runeRound: { column: 1, row: 1 },
  runeGem: { column: 2, row: 1 },
  fenceShort: { column: 3, row: 1 },
  stoneCorner: { column: 4, row: 1 },
  leaves: { column: 0, row: 2 },
  battleScuff: { column: 1, row: 2 },
  yellowFlowers: { column: 2, row: 2 },
  blueFlowers: { column: 3, row: 2 },
  diamondRune: { column: 4, row: 2 },
  pinkFlowers: { column: 0, row: 3 },
  berryShrub: { column: 1, row: 3 },
  brokenFence: { column: 2, row: 3 },
  flatRock: { column: 3, row: 3 },
  bannerPost: { column: 4, row: 3 }
};

const ARENA_DECAL_TEXTURE_PADDING: Partial<Record<ArenaDecalKey, TexturePadding>> = {
  bannerPost: { top: 14, right: 0, bottom: 0, left: 0 }
};

const ARENA_DECAL_TEXTURE_TRIM_KEYS = new Set<ArenaDecalKey>([
  "mossStone",
  "grassMound",
  "shrub",
  "rockCluster",
  "runeRound",
  "runeGem",
  "fenceShort",
  "stoneCorner",
  "berryShrub",
  "brokenFence",
  "flatRock",
  "bannerPost"
]);

const ARENA_DECAL_TEXTURE_TRIM_PADDING: Partial<Record<ArenaDecalKey, TexturePadding>> = {
  bannerPost: { top: 12, right: 8, bottom: 8, left: 8 }
};

export const ARENA_DECAL_TEXTURES = Object.fromEntries(
  Object.keys(ARENA_DECAL_GRID).map((key) => [key, `arena_${key}`])
) as Record<ArenaDecalKey, string>;

export const ARENA_DECAL_KEYS = Object.keys(ARENA_DECAL_GRID) as ArenaDecalKey[];

export function getArenaDecalGridPosition(key: ArenaDecalKey) {
  return ARENA_DECAL_GRID[key];
}

export function getArenaDecalTexturePadding(key: ArenaDecalKey): TexturePadding {
  return ARENA_DECAL_TEXTURE_PADDING[key] ?? { top: 0, right: 0, bottom: 0, left: 0 };
}

export function shouldTrimArenaDecalTexture(key: ArenaDecalKey) {
  return ARENA_DECAL_TEXTURE_TRIM_KEYS.has(key);
}

export function getArenaDecalTextureTrimPadding(key: ArenaDecalKey): TexturePadding {
  return ARENA_DECAL_TEXTURE_TRIM_PADDING[key] ?? { top: 8, right: 8, bottom: 8, left: 8 };
}

const CLASS_ROWS: Record<ClassId, number> = {
  warrior: 36,
  archer: 276,
  engineer: 516,
  mage: 748
};

const FRAME_X = [55, 222, 392, 562, 724, 892, 1058, 1228];

export function getClassFrameCrop(classId: ClassId, frame: number): Crop {
  return {
    x: FRAME_X[Math.max(0, Math.min(FRAME_X.length - 1, frame))],
    y: CLASS_ROWS[classId],
    width: 165,
    height: 194
  };
}

export function getClassFrameTexture(classId: ClassId, frame: number) {
  return `sprite_${classId}_${frame}`;
}

export const WARRIOR_ATTACK_FRAME_COUNT = 3;

export const WARRIOR_ATTACK_DIRECTIONS = ["right", "down", "left", "up"] as const;

export type WarriorAttackDirection = (typeof WARRIOR_ATTACK_DIRECTIONS)[number];

const WARRIOR_ATTACK_ROWS: Record<WarriorAttackDirection, number> = {
  right: 0,
  down: 1,
  left: 2,
  up: 3
};

export function getWarriorAttackFrameTexture(direction: WarriorAttackDirection, frame: number) {
  return `warrior_attack_${direction}_${Math.max(0, Math.min(WARRIOR_ATTACK_FRAME_COUNT - 1, frame))}`;
}

export function getWarriorAttackDirectionRow(direction: WarriorAttackDirection) {
  return WARRIOR_ATTACK_ROWS[direction];
}

export const ARCHER_ATTACK_FRAME_COUNT = 3;

export const ARCHER_ATTACK_DIRECTIONS = ["right", "down", "left", "up"] as const;

export type ArcherAttackDirection = (typeof ARCHER_ATTACK_DIRECTIONS)[number];

const ARCHER_ATTACK_ROWS: Record<ArcherAttackDirection, number> = {
  right: 0,
  down: 1,
  left: 2,
  up: 3
};

export function getArcherAttackFrameTexture(direction: ArcherAttackDirection, frame: number) {
  return `archer_attack_${direction}_${Math.max(0, Math.min(ARCHER_ATTACK_FRAME_COUNT - 1, frame))}`;
}

export function getArcherAttackDirectionRow(direction: ArcherAttackDirection) {
  return ARCHER_ATTACK_ROWS[direction];
}

export const RPG_SKILL_PROJECTILE_FRAME_COUNT = 10;
export const RPG_SKILL_PROJECTILE_ROW_COUNT = 5;

const RPG_SKILL_PROJECTILE_ROWS: Record<RpgElement, number> = {
  water: 0,
  fire: 1,
  grass: 2,
  dark: 3,
  light: 4
};

export function getRpgSkillProjectileFrameTexture(element: RpgElement, frame: number) {
  return `rpg_projectile_${element}_${Math.max(0, Math.min(RPG_SKILL_PROJECTILE_FRAME_COUNT - 1, frame))}`;
}

export function getRpgSkillProjectileRow(element: RpgElement) {
  return RPG_SKILL_PROJECTILE_ROWS[element];
}

export const ENGINEER_ACTION_FRAME_COUNT = 3;

export const ENGINEER_ACTION_DIRECTIONS = ["right", "down", "left", "up"] as const;

export type EngineerActionDirection = (typeof ENGINEER_ACTION_DIRECTIONS)[number];

const ENGINEER_ACTION_ROWS: Record<EngineerActionDirection, number> = {
  right: 0,
  down: 1,
  left: 2,
  up: 3
};

export function getEngineerActionFrameTexture(direction: EngineerActionDirection, frame: number) {
  return `engineer_action_${direction}_${Math.max(0, Math.min(ENGINEER_ACTION_FRAME_COUNT - 1, frame))}`;
}

export function getEngineerActionDirectionRow(direction: EngineerActionDirection) {
  return ENGINEER_ACTION_ROWS[direction];
}

export const MAGE_ATTACK_FRAME_COUNT = 3;

export const MAGE_ATTACK_DIRECTIONS = ["right", "down", "left", "up"] as const;

export type MageAttackDirection = (typeof MAGE_ATTACK_DIRECTIONS)[number];

const MAGE_ATTACK_ROWS: Record<MageAttackDirection, number> = {
  right: 0,
  down: 1,
  left: 2,
  up: 3
};

export function getMageAttackFrameTexture(direction: MageAttackDirection, frame: number) {
  return `mage_attack_${direction}_${Math.max(0, Math.min(MAGE_ATTACK_FRAME_COUNT - 1, frame))}`;
}

export function getMageAttackDirectionRow(direction: MageAttackDirection) {
  return MAGE_ATTACK_ROWS[direction];
}

export type SkillIconSlot = SkillKey | "attack";

const SKILL_ICON_ROWS: Record<ClassId, number> = {
  warrior: 0,
  archer: 1,
  engineer: 2,
  mage: 3
};

const SKILL_ICON_COLUMNS: Record<SkillIconSlot, number> = {
  skillQ: 0,
  skillE: 1,
  skillR: 2,
  attack: 3
};

export function getSkillIconPosition(classId: ClassId, slot: SkillIconSlot) {
  return {
    column: SKILL_ICON_COLUMNS[slot],
    row: SKILL_ICON_ROWS[classId]
  };
}

export type VfxKey = "shield";

export const EFFECT_VFX: Partial<Record<EffectType, VfxKey>> = {
  shield: "shield"
};

export const VFX_FRAME_COUNT = 12;

const VFX_ROWS: Record<VfxKey, number> = {
  shield: 1
};

export function getVfxFrameTexture(vfx: VfxKey, frame: number) {
  return `vfx_${vfx}_${Math.max(0, Math.min(VFX_FRAME_COUNT - 1, frame))}`;
}

export function getVfxRow(vfx: VfxKey) {
  return VFX_ROWS[vfx];
}

export type StatusAuraKey = "shield" | "root" | "stun";

export const STATUS_AURA_FRAME_COUNT = 12;
export const STATUS_AURA_SOURCE_ROWS = 4;

const STATUS_AURA_ROWS: Record<StatusAuraKey, number> = {
  shield: 1,
  root: 2,
  stun: 3
};

export const STATUS_AURA_KEYS = Object.keys(STATUS_AURA_ROWS) as StatusAuraKey[];

export function getStatusAuraFrameTexture(status: StatusAuraKey, frame: number) {
  return `status_${status}_${Math.max(0, Math.min(STATUS_AURA_FRAME_COUNT - 1, frame))}`;
}

export function getStatusAuraRow(status: StatusAuraKey) {
  return STATUS_AURA_ROWS[status];
}

export type AbilityVfxKey =
  | "meleeSlash"
  | "warriorSlash"
  | "engineerStrike"
  | "warriorVerdict"
  | "archerSeedRain"
  | "engineerOverclock"
  | "mageCleanStorm"
  | "mageBurst"
  | "hitImpact"
  | "deathBurst";

export const ABILITY_VFX_FRAME_COUNT = 12;

const ABILITY_VFX_ROWS: Record<AbilityVfxKey, number> = {
  meleeSlash: 0,
  warriorSlash: 1,
  engineerStrike: 2,
  warriorVerdict: 3,
  archerSeedRain: 4,
  engineerOverclock: 5,
  mageCleanStorm: 6,
  mageBurst: 7,
  hitImpact: 8,
  deathBurst: 9
};

export const ABILITY_VFX_KEYS = Object.keys(ABILITY_VFX_ROWS) as AbilityVfxKey[];

export function getAbilityVfxFrameTexture(vfx: AbilityVfxKey, frame: number) {
  return `ability_${vfx}_${Math.max(0, Math.min(ABILITY_VFX_FRAME_COUNT - 1, frame))}`;
}

export function getAbilityVfxRow(vfx: AbilityVfxKey) {
  return ABILITY_VFX_ROWS[vfx];
}

export type WarriorVerticalSlashDirection = "down" | "up";
export const WARRIOR_VERTICAL_SLASH_FRAME_COUNT = 6;
export const WARRIOR_VERTICAL_SLASH_ROWS: Record<WarriorVerticalSlashDirection, number> = {
  down: 1,
  up: 0
};

export function getWarriorVerticalSlashFrameTexture(direction: WarriorVerticalSlashDirection, frame: number) {
  return `warrior_vertical_slash_${direction}_${Math.max(0, Math.min(WARRIOR_VERTICAL_SLASH_FRAME_COUNT - 1, frame))}`;
}

export function getWarriorVerticalSlashRow(direction: WarriorVerticalSlashDirection) {
  return WARRIOR_VERTICAL_SLASH_ROWS[direction];
}

export type WarriorArcherVfxKey =
  | "warriorCharge"
  | "warriorShield"
  | "warriorVerdict"
  | "archerRoll"
  | "archerRoot"
  | "archerSeedRain";

export const WARRIOR_ARCHER_VFX_FRAME_COUNT = 12;

const WARRIOR_ARCHER_VFX_ROWS: Record<WarriorArcherVfxKey, number> = {
  warriorCharge: 0,
  warriorShield: 1,
  warriorVerdict: 2,
  archerRoll: 3,
  archerRoot: 4,
  archerSeedRain: 5
};

export const WARRIOR_ARCHER_VFX_KEYS = Object.keys(WARRIOR_ARCHER_VFX_ROWS) as WarriorArcherVfxKey[];

export function getWarriorArcherVfxFrameTexture(vfx: WarriorArcherVfxKey, frame: number) {
  return `warrior_archer_vfx_${vfx}_${Math.max(0, Math.min(WARRIOR_ARCHER_VFX_FRAME_COUNT - 1, frame))}`;
}

export function getWarriorArcherVfxRow(vfx: WarriorArcherVfxKey) {
  return WARRIOR_ARCHER_VFX_ROWS[vfx];
}

export type WarriorVerdictVfxKey = "combatFx";

export const WARRIOR_VERDICT_VFX_FRAME_COUNT = 7;

export function getWarriorVerdictVfxFrameTexture(frame: number) {
  return `warrior_verdict_vfx_${Math.max(0, Math.min(WARRIOR_VERDICT_VFX_FRAME_COUNT - 1, frame))}`;
}

export type EngineerVfxKey = "turretDeploy" | "repulsorPulse" | "overclock";

export const ENGINEER_VFX_FRAME_COUNT = 12;

const ENGINEER_VFX_ROWS: Record<EngineerVfxKey, number> = {
  turretDeploy: 0,
  repulsorPulse: 1,
  overclock: 2
};

export const ENGINEER_VFX_KEYS = Object.keys(ENGINEER_VFX_ROWS) as EngineerVfxKey[];

export function getEngineerVfxFrameTexture(vfx: EngineerVfxKey, frame: number) {
  return `engineer_vfx_${vfx}_${Math.max(0, Math.min(ENGINEER_VFX_FRAME_COUNT - 1, frame))}`;
}

export function getEngineerVfxRow(vfx: EngineerVfxKey) {
  return ENGINEER_VFX_ROWS[vfx];
}

export type MageVfxKey = "renewalBurst" | "cleanStorm";

export const MAGE_VFX_FRAME_COUNT = 20;

const MAGE_VFX_ROWS: Record<MageVfxKey, number> = {
  renewalBurst: 0,
  cleanStorm: 1
};

export const MAGE_VFX_KEYS = Object.keys(MAGE_VFX_ROWS) as MageVfxKey[];

export function getMageVfxFrameTexture(vfx: MageVfxKey, frame: number) {
  return `mage_vfx_${vfx}_${Math.max(0, Math.min(MAGE_VFX_FRAME_COUNT - 1, frame))}`;
}

export function getMageVfxRow(vfx: MageVfxKey) {
  return MAGE_VFX_ROWS[vfx];
}

export type CombatVfxKey =
  | "mageSolarBeam"
  | "arrowProjectile"
  | "magicOrbProjectile"
  | "turretShot"
  | "turretShotBoosted"
  | "hitImpact"
  | "blockImpact"
  | "healPickup"
  | "deathBurst";

export const COMBAT_VFX_FRAME_COUNT = 12;

const COMBAT_VFX_ROWS: Record<CombatVfxKey, number> = {
  mageSolarBeam: 0,
  arrowProjectile: 1,
  magicOrbProjectile: 2,
  turretShot: 3,
  turretShotBoosted: 4,
  hitImpact: 5,
  blockImpact: 6,
  healPickup: 7,
  deathBurst: 8
};

export const COMBAT_VFX_KEYS = Object.keys(COMBAT_VFX_ROWS) as CombatVfxKey[];

export function getCombatVfxFrameTexture(vfx: CombatVfxKey, frame: number) {
  return `combat_vfx_${vfx}_${Math.max(0, Math.min(COMBAT_VFX_FRAME_COUNT - 1, frame))}`;
}

export function getCombatVfxRow(vfx: CombatVfxKey) {
  return COMBAT_VFX_ROWS[vfx];
}

export type CombatObjectKey =
  | "arrow"
  | "magicOrb"
  | "turretShot"
  | "turretShotBoosted"
  | "turretBase"
  | "turretHead"
  | "turretHeadFiring"
  | "turretHeadBoosted"
  | "healthCrystal"
  | "healthCrystalGlow"
  | "coin"
  | "respawnRune"
  | "hitSpark"
  | "blockedSpark"
  | "leafSparkle"
  | "groundShadow";

const COMBAT_OBJECT_GRID: Record<CombatObjectKey, { column: number; row: number }> = {
  arrow: { column: 0, row: 0 },
  magicOrb: { column: 1, row: 0 },
  turretShot: { column: 2, row: 0 },
  turretShotBoosted: { column: 3, row: 0 },
  turretBase: { column: 0, row: 1 },
  turretHead: { column: 1, row: 1 },
  turretHeadFiring: { column: 2, row: 1 },
  turretHeadBoosted: { column: 3, row: 1 },
  healthCrystal: { column: 0, row: 2 },
  healthCrystalGlow: { column: 1, row: 2 },
  coin: { column: 2, row: 2 },
  respawnRune: { column: 3, row: 2 },
  hitSpark: { column: 0, row: 3 },
  blockedSpark: { column: 1, row: 3 },
  leafSparkle: { column: 2, row: 3 },
  groundShadow: { column: 3, row: 3 }
};

export const COMBAT_OBJECT_KEYS = Object.keys(COMBAT_OBJECT_GRID) as CombatObjectKey[];

export function getCombatObjectTexture(key: CombatObjectKey) {
  return `combat_${key}`;
}

export function getCombatObjectGridPosition(key: CombatObjectKey) {
  return COMBAT_OBJECT_GRID[key];
}

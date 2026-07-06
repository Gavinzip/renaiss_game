import type { RpgAnimationStyle, RpgMove, RpgStatusId } from "./rpgTypes";

export type RpgVfxAssetSource =
  | "external-16x16-bullet"
  | "external-spellsfx-2"
  | "external-super-pixel-gigapack"
  | "generated-status-sheet";
export type RpgVfxPhase = "windup" | "travel" | "expand" | "impact" | "status" | "finish";
export type RpgVfxProductionCategory =
  | "small-projectile"
  | "impact-strike"
  | "wide-sweep"
  | "status-layered"
  | "support-field"
  | "ultimate-multiphase";

export interface RpgVfxProductionSpec {
  category: RpgVfxProductionCategory;
  primarySource: RpgVfxAssetSource;
  statusSource: "generated-status-sheet" | null;
  sources: readonly RpgVfxAssetSource[];
  phases: readonly RpgVfxPhase[];
  usesBulletProjectile: boolean;
  usesExternalImpact: boolean;
  usesStatusLayer: boolean;
  requiresWideTargetRead: boolean;
  requiresActorToTargetPath: boolean;
  rationale: string;
}

const BULLET_MOVE_IDS = new Set(["fire_basic_02", "grass_basic_02", "dark_basic_02", "light_basic_02"]);
const GIGAPACK_SEQUENCE_ROWS = new Set([5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24]);
const SPELL_SEQUENCE_ROW_KEYS = new Set([
  "water:6", "water:20", "water:21", "water:22", "water:23", "water:24",
  "fire:20", "fire:21", "fire:23",
  "grass:17", "grass:20", "grass:21", "grass:22", "grass:24",
  "dark:8", "dark:11", "dark:13", "dark:17", "dark:20", "dark:23",
  "light:20", "light:21", "light:22", "light:23", "light:24"
]);
const MELEE_STYLE_NAMES = ["爪", "鞭", "拍擊", "斬", "切", "槌", "拳", "刃", "擊"];
const WIDE_SWEEP_NAMES = ["掃場", "掃列", "火線", "葉刃", "星屑", "海嘯", "荊潮", "終曲", "吞列", "歸墜"];
const STATUS_IDS: readonly RpgStatusId[] = ["burn", "poison", "stun", "guard", "regen"];

function hasStatusEffect(move: RpgMove) {
  return move.effects.some((effect) => Boolean(effect.status) || Boolean(effect.heal) || Boolean(effect.cleanse) || Boolean(effect.shield));
}

function needsStatusLayer(move: RpgMove) {
  return move.effects.some((effect) => Boolean((effect.status && STATUS_IDS.includes(effect.status)) || effect.heal || effect.cleanse || effect.shield));
}

function moveNameIncludes(move: RpgMove, patterns: readonly string[]) {
  return patterns.some((pattern) => move.name.includes(pattern) || move.animation.name.includes(pattern));
}

function hasActorToTargetPath(style: RpgAnimationStyle) {
  return style === "projectile" || style === "beam" || style === "rain" || style === "wave" || style === "summon" || style === "burst" || style === "strike";
}

function isSupportTarget(move: RpgMove) {
  return move.target === "self" || move.target === "singleAlly" || move.target === "allAllies";
}

function buildSources(primarySource: RpgVfxAssetSource, statusLayer: boolean): RpgVfxAssetSource[] {
  return statusLayer ? [primarySource, "generated-status-sheet"] : [primarySource];
}

function buildSpec(
  config: Omit<RpgVfxProductionSpec, "primarySource" | "statusSource" | "sources"> & {
    primarySource: RpgVfxAssetSource;
  }
): RpgVfxProductionSpec {
  return {
    ...config,
    statusSource: config.usesStatusLayer ? "generated-status-sheet" : null,
    sources: buildSources(config.primarySource, config.usesStatusLayer)
  };
}

function moveVfxRow(move: RpgMove) {
  if (move.tier === "ultimate") return 20 + move.slot - 1;
  if (move.tier === "intermediate") return 10 + move.slot - 1;
  return move.slot - 1;
}

function primarySkillSource(move: RpgMove): RpgVfxAssetSource {
  const row = moveVfxRow(move);
  if (SPELL_SEQUENCE_ROW_KEYS.has(`${move.element}:${row}`)) return "external-spellsfx-2";
  return GIGAPACK_SEQUENCE_ROWS.has(row) ? "external-super-pixel-gigapack" : "external-spellsfx-2";
}

export function getRpgVfxProductionSpec(move: RpgMove): RpgVfxProductionSpec {
  const statusLayer = needsStatusLayer(move);
  const primarySource = primarySkillSource(move);

  if (move.tier === "ultimate") {
    return buildSpec({
      category: "ultimate-multiphase",
      primarySource,
      phases: move.target.includes("all") ? ["windup", "expand", "impact", "status", "finish"] : ["windup", "travel", "impact", "status", "finish"],
      usesBulletProjectile: false,
      usesExternalImpact: true,
      usesStatusLayer: statusLayer,
      requiresWideTargetRead: move.target.includes("all"),
      requiresActorToTargetPath: hasActorToTargetPath(move.animation.style),
      rationale: "高階招式使用一組完整外部逐幀序列作為主動畫，不混搭多包素材，也不靠小彈放大交差。"
    });
  }

  if (BULLET_MOVE_IDS.has(move.id)) {
    return buildSpec({
      category: "small-projectile",
      primarySource: "external-16x16-bullet",
      phases: statusLayer ? ["travel", "impact", "status"] : ["travel", "impact"],
      usesBulletProjectile: true,
      usesExternalImpact: true,
      usesStatusLayer: statusLayer,
      requiresWideTargetRead: false,
      requiresActorToTargetPath: true,
      rationale: "小型高速彈道使用已付款外部 16x16 bullet 的完整序列，不再疊其他打擊特效包。"
    });
  }

  if (isSupportTarget(move)) {
    return buildSpec({
      category: "support-field",
      primarySource,
      phases: statusLayer ? ["expand", "impact", "status"] : ["expand", "impact"],
      usesBulletProjectile: false,
      usesExternalImpact: true,
      usesStatusLayer: statusLayer,
      requiresWideTargetRead: move.target === "allAllies",
      requiresActorToTargetPath: move.target === "singleAlly",
      rationale: "我方補血、護盾、淨化與蓄勢招式使用單一完整支援序列；不可把多包素材疊成混搭場域。"
    });
  }

  if (move.target.includes("all") || moveNameIncludes(move, WIDE_SWEEP_NAMES)) {
    return buildSpec({
      category: hasStatusEffect(move) ? "status-layered" : "wide-sweep",
      primarySource,
      phases: statusLayer ? ["expand", "impact", "status"] : ["expand", "impact"],
      usesBulletProjectile: false,
      usesExternalImpact: true,
      usesStatusLayer: statusLayer,
      requiresWideTargetRead: true,
      requiresActorToTargetPath: hasActorToTargetPath(move.animation.style),
      rationale: "群體掃場和範圍技使用一組完整寬幅序列，同一招不混用 750/Spells/Gigapack 多包素材。"
    });
  }

  if (hasStatusEffect(move)) {
    return buildSpec({
      category: "status-layered",
      primarySource,
      phases: statusLayer ? ["impact", "status"] : ["impact"],
      usesBulletProjectile: false,
      usesExternalImpact: true,
      usesStatusLayer: statusLayer,
      requiresWideTargetRead: false,
      requiresActorToTargetPath: hasActorToTargetPath(move.animation.style),
      rationale: "狀態技的主動畫和持續狀態各自使用完整序列，不再把多包打擊特效混疊。"
    });
  }

  return buildSpec({
    category: moveNameIncludes(move, MELEE_STYLE_NAMES) ? "impact-strike" : "status-layered",
    primarySource,
    phases: ["travel", "impact"],
    usesBulletProjectile: false,
    usesExternalImpact: true,
    usesStatusLayer: false,
    requiresWideTargetRead: false,
    requiresActorToTargetPath: hasActorToTargetPath(move.animation.style),
    rationale: "近身爪擊、斬擊、鞭擊與重擊使用單一完整打擊序列，不使用小彈或多包混搭。"
  });
}

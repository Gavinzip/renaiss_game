import type {
  ArenaCatalogLoadout,
  ArenaCatalogSkillId,
  ArenaLoadoutSlot,
  ArenaSkillTier,
  ClassId
} from "./types";

export interface ArenaCatalogSkill {
  id: ArenaCatalogSkillId;
  classId: ClassId;
  name: string;
  tier: ArenaSkillTier | "core";
  iconColumn: number;
  iconRow: number;
  core: boolean;
}

const TIER_BY_INDEX = (index: number): ArenaSkillTier => {
  if (index < 7) return "basic";
  if (index < 12) return "intermediate";
  return "ultimate";
};

const buildClassSkills = (
  classId: ClassId,
  iconRow: number,
  names: readonly string[],
  options: { hasCore?: boolean } = {}
): readonly ArenaCatalogSkill[] =>
  names.map((name, iconColumn) => {
    const core = options.hasCore === true && iconColumn === 0;
    const tierIndex = options.hasCore ? iconColumn - 1 : iconColumn;
    return {
      id: `${classId}_${iconColumn.toString().padStart(2, "0")}` as ArenaCatalogSkillId,
      classId,
      name,
      tier: core ? "core" : TIER_BY_INDEX(tierIndex),
      iconColumn,
      iconRow,
      core
    };
  });

const buildExplicitClassSkills = (
  classId: ClassId,
  iconRow: number,
  skills: readonly { name: string; tier: ArenaSkillTier | "core" }[]
): readonly ArenaCatalogSkill[] =>
  skills.map(({ name, tier }, iconColumn) => ({
    id: `${classId}_${iconColumn.toString().padStart(2, "0")}` as ArenaCatalogSkillId,
    classId,
    name,
    tier,
    iconColumn,
    iconRow,
    core: tier === "core"
  }));

export const ARENA_SKILL_CATALOG_BY_CLASS: Record<ClassId, readonly ArenaCatalogSkill[]> = {
  warrior: buildClassSkills("warrior", 0, [
    "守線橫斬",
    "烈焰狂行",
    "戰環斬",
    "斬鋒附魔",
    "正義衝鋒",
    "盾首震擊",
    "裂甲斬",
    "反擊姿態",
    "和平護盾",
    "戰陣號令",
    "獵首突刺",
    "裂地震",
    "斷城震落",
    "死鬥宣言",
    "裁決"
  ]),
  archer: buildClassSkills("archer", 1, [
    "月牙刃",
    "森林翻滾",
    "穿葉箭",
    "荊刺陷阱",
    "隱形",
    "追獵標記",
    "風切步",
    "暗鉤牽引",
    "根縛",
    "穩心瞄準",
    "藤網收束",
    "貫穿箭",
    "星痕狙殺",
    "種子雨",
    "隼影處刑"
  ]),
  engineer: buildExplicitClassSkills("engineer", 2, [
    { name: "部署砲台", tier: "core" },
    { name: "標定彈匣", tier: "basic" },
    { name: "散射", tier: "basic" },
    { name: "穿甲鐵芯", tier: "basic" },
    { name: "壓制掃射", tier: "intermediate" },
    { name: "鎖定齊射", tier: "intermediate" },
    { name: "攻城模式", tier: "ultimate" },
    { name: "震爆彈筒", tier: "basic" },
    { name: "屏障節點", tier: "basic" },
    { name: "支撐砲架", tier: "intermediate" },
    { name: "破陣鉤彈", tier: "intermediate" },
    { name: "砲台迅爆", tier: "ultimate" },
    { name: "同步追跡彈", tier: "basic" },
    { name: "魔導鎖標", tier: "basic" },
    { name: "裂星魔彈", tier: "intermediate" },
    { name: "魔導飛彈矩陣", tier: "ultimate" }
  ]),
  mage: buildClassSkills("mage", 3, [
    "日耀光束",
    "毒針咒",
    "汲魂之手",
    "灼光烙印",
    "禁言符",
    "稜鏡碎裂",
    "虛空球",
    "復甦爆發",
    "瘴霧坩堝",
    "聚焦透鏡",
    "重力井",
    "鎖魂鏈",
    "淨化風暴",
    "禁時星盤",
    "血月祭壇"
  ])
};

export const ARENA_SKILL_CATALOG = Object.values(ARENA_SKILL_CATALOG_BY_CLASS).flat();

const CATALOG_BY_ID = new Map(ARENA_SKILL_CATALOG.map((skill) => [skill.id, skill]));

const DEFAULT_CATALOG_LOADOUTS: Record<ClassId, ArenaCatalogLoadout> = {
  warrior: { skillQ: "warrior_04", skillE: "warrior_08", skillR: "warrior_14" },
  archer: { skillQ: "archer_01", skillE: "archer_08", skillR: "archer_13" },
  engineer: { skillQ: "engineer_12", skillE: "engineer_14", skillR: "engineer_15" },
  mage: { skillQ: "mage_00", skillE: "mage_07", skillR: "mage_12" }
};

export function getArenaCatalogSkill(skillId: ArenaCatalogSkillId | null) {
  return skillId ? CATALOG_BY_ID.get(skillId) ?? null : null;
}

export function getArenaCatalogSkillsForClass(classId: ClassId) {
  return ARENA_SKILL_CATALOG_BY_CLASS[classId].filter((skill) => !skill.core);
}

export function getArenaCatalogCoreSkill(classId: ClassId) {
  return ARENA_SKILL_CATALOG_BY_CLASS[classId].find((skill) => skill.core) ?? null;
}

export function getArenaCatalogSkillsForSlot(classId: ClassId, slot: ArenaLoadoutSlot) {
  const tier: ArenaSkillTier =
    slot === "skillQ" ? "basic" : slot === "skillE" ? "intermediate" : "ultimate";
  return getArenaCatalogSkillsForClass(classId).filter((skill) => skill.tier === tier);
}

export function getDefaultArenaCatalogLoadout(classId: ClassId): ArenaCatalogLoadout {
  return { ...DEFAULT_CATALOG_LOADOUTS[classId] };
}

export function isArenaCatalogSkillAllowedInSlot(
  classId: ClassId,
  slot: ArenaLoadoutSlot,
  skillId: unknown
): skillId is ArenaCatalogSkillId {
  if (typeof skillId !== "string") return false;
  const skill = CATALOG_BY_ID.get(skillId as ArenaCatalogSkillId);
  if (!skill || skill.classId !== classId || skill.core) return false;
  const expectedTier =
    slot === "skillQ" ? "basic" : slot === "skillE" ? "intermediate" : "ultimate";
  return skill.tier === expectedTier;
}

export function isArenaCatalogLoadout(classId: ClassId, value: unknown): value is ArenaCatalogLoadout {
  if (!value || typeof value !== "object") return false;
  const loadout = value as Partial<Record<ArenaLoadoutSlot, unknown>>;
  return (["skillQ", "skillE", "skillR"] as const).every((slot) => {
    const skillId = loadout[slot];
    return skillId === null || isArenaCatalogSkillAllowedInSlot(classId, slot, skillId);
  });
}

export function isArenaCatalogLoadoutComplete(loadout: ArenaCatalogLoadout) {
  return Boolean(loadout.skillQ && loadout.skillE && loadout.skillR);
}

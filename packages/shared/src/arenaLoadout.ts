import type {
  ArenaLoadout,
  ArenaLoadoutSlot,
  ArenaSkillTier,
  ClassId,
  SkillKey
} from "./types";

export const ARENA_SKILL_KEYS: readonly SkillKey[] = ["skillF", "skillQ", "skillE", "skillR"];
export const ARENA_LOADOUT_SLOTS: readonly ArenaLoadoutSlot[] = ["skillQ", "skillE", "skillR"];

export const ARENA_LOADOUT_TIER_BY_SLOT: Record<ArenaLoadoutSlot, ArenaSkillTier> = {
  skillQ: "basic",
  skillE: "intermediate",
  skillR: "ultimate"
};

export const ARENA_SKILLS_BY_TIER: Record<ArenaSkillTier, readonly SkillKey[]> = {
  basic: ["skillF", "skillQ"],
  intermediate: ["skillE"],
  ultimate: ["skillR"]
};

const DEFAULT_LOADOUTS: Record<ClassId, ArenaLoadout> = {
  warrior: { skillQ: "skillQ", skillE: "skillE", skillR: "skillR" },
  archer: { skillQ: "skillQ", skillE: "skillE", skillR: "skillR" },
  engineer: { skillQ: "skillQ", skillE: "skillE", skillR: "skillR" },
  mage: { skillQ: "skillQ", skillE: "skillE", skillR: "skillR" }
};

export function getDefaultArenaLoadout(classId: ClassId): ArenaLoadout {
  return { ...DEFAULT_LOADOUTS[classId] };
}

export function isArenaLoadout(value: unknown): value is ArenaLoadout {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Record<ArenaLoadoutSlot, unknown>>;
  return ARENA_LOADOUT_SLOTS.every((slot) => {
    const skill = candidate[slot];
    return typeof skill === "string" && isArenaSkillAllowedInSlot(slot, skill);
  });
}

export function getArenaSkillsForSlot(slot: ArenaLoadoutSlot): readonly SkillKey[] {
  return ARENA_SKILLS_BY_TIER[ARENA_LOADOUT_TIER_BY_SLOT[slot]];
}

export function getArenaSkillTier(skill: SkillKey): ArenaSkillTier {
  if (ARENA_SKILLS_BY_TIER.basic.includes(skill)) {
    return "basic";
  }
  if (ARENA_SKILLS_BY_TIER.intermediate.includes(skill)) {
    return "intermediate";
  }
  return "ultimate";
}

export function isArenaSkillAllowedInSlot(slot: ArenaLoadoutSlot, skill: unknown): skill is SkillKey {
  return (
    typeof skill === "string" &&
    ARENA_SKILL_KEYS.includes(skill as SkillKey) &&
    getArenaSkillsForSlot(slot).includes(skill as SkillKey)
  );
}

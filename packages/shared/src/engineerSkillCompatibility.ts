import { getArenaCatalogSkillsForClass } from "./arenaSkillCatalog";
import type {
  ArenaCatalogLoadout,
  ArenaCatalogSkillId,
  ArenaLoadoutSlot,
  ArenaSkillTier,
  ClassId,
  EngineerTurretKind
} from "./types";

export type EngineerSkillTurretCompatibility = EngineerTurretKind | "both";

const ENGINEER_SKILL_TURRET_COMPATIBILITY: Readonly<
  Record<string, EngineerSkillTurretCompatibility>
> = {
  engineer_01: "mechanical",
  engineer_02: "mechanical",
  engineer_03: "mechanical",
  engineer_04: "mechanical",
  engineer_05: "mechanical",
  engineer_06: "mechanical",
  engineer_07: "both",
  engineer_08: "both",
  engineer_09: "both",
  engineer_10: "both",
  engineer_11: "both",
  engineer_12: "magic_missile",
  engineer_13: "magic_missile",
  engineer_14: "magic_missile",
  engineer_15: "magic_missile"
};

const TIER_BY_SLOT: Record<ArenaLoadoutSlot, ArenaSkillTier> = {
  skillQ: "basic",
  skillE: "intermediate",
  skillR: "ultimate"
};

const DEFAULT_ENGINEER_LOADOUT_BY_TURRET_KIND: Readonly<
  Record<EngineerTurretKind, ArenaCatalogLoadout>
> = {
  mechanical: {
    skillQ: "engineer_01",
    skillE: "engineer_04",
    skillR: "engineer_06"
  },
  magic_missile: {
    skillQ: "engineer_12",
    skillE: "engineer_14",
    skillR: "engineer_15"
  }
};

export function getDefaultEngineerCatalogLoadoutForTurretKind(
  turretKind: EngineerTurretKind
): ArenaCatalogLoadout {
  return { ...DEFAULT_ENGINEER_LOADOUT_BY_TURRET_KIND[turretKind] };
}

export function getEngineerSkillTurretCompatibility(
  skillId: ArenaCatalogSkillId | null | undefined
): EngineerSkillTurretCompatibility | null {
  if (!skillId?.startsWith("engineer_")) return null;
  return ENGINEER_SKILL_TURRET_COMPATIBILITY[skillId] ?? null;
}

export function isEngineerSkillCompatibleWithTurretKind(
  skillId: ArenaCatalogSkillId | null | undefined,
  turretKind: EngineerTurretKind
) {
  const compatibility = getEngineerSkillTurretCompatibility(skillId);
  return compatibility === "both" || compatibility === turretKind;
}

export function isArenaCatalogLoadoutCompatibleWithTurretKind(
  classId: ClassId,
  loadout: ArenaCatalogLoadout,
  turretKind: EngineerTurretKind
) {
  if (classId !== "engineer") return true;
  return (Object.keys(TIER_BY_SLOT) as ArenaLoadoutSlot[]).every((slot) =>
    isEngineerSkillCompatibleWithTurretKind(loadout[slot], turretKind)
  );
}

export function normalizeEngineerCatalogLoadout(
  loadout: ArenaCatalogLoadout,
  turretKind: EngineerTurretKind,
  availableSkillIds: ReadonlySet<ArenaCatalogSkillId>
): ArenaCatalogLoadout {
  const next = { ...loadout };
  const skills = getArenaCatalogSkillsForClass("engineer");

  for (const slot of Object.keys(TIER_BY_SLOT) as ArenaLoadoutSlot[]) {
    const current = next[slot];
    if (
      current &&
      availableSkillIds.has(current) &&
      isEngineerSkillCompatibleWithTurretKind(current, turretKind)
    ) {
      continue;
    }

    const tier = TIER_BY_SLOT[slot];
    const candidates = skills.filter(
      (skill) =>
        skill.tier === tier &&
        availableSkillIds.has(skill.id) &&
        isEngineerSkillCompatibleWithTurretKind(skill.id, turretKind)
    );
    const turretSpecific = candidates.find(
      (skill) => getEngineerSkillTurretCompatibility(skill.id) === turretKind
    );
    next[slot] = turretSpecific?.id ?? candidates[0]?.id ?? null;
  }

  return next;
}

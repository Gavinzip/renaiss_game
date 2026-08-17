import { ARENA_SKILL_CATALOG } from "./arenaSkillCatalog";
import type { ArenaCatalogSkillId } from "./types";

/**
 * The caster layer is deliberately separate from a skill's world VFX.
 * Every catalog skill declares its body behavior so the client never infers
 * an animation from Q/E/R and accidentally plays a different skill.
 */
export type ArenaSkillActionBody =
  | "warrior-neutral"
  | "warrior-melee"
  | "warrior-charge"
  | "archer-neutral"
  | "archer-bow"
  | "archer-roll"
  | "engineer-cast"
  | "mage-cast";

export interface ArenaSkillActionProfile {
  readonly body: ArenaSkillActionBody;
}

const profile = (body: ArenaSkillActionBody): ArenaSkillActionProfile => ({ body });

const WARRIOR_NEUTRAL = profile("warrior-neutral");
const WARRIOR_MELEE = profile("warrior-melee");
const WARRIOR_CHARGE = profile("warrior-charge");
const ARCHER_NEUTRAL = profile("archer-neutral");
const ARCHER_BOW = profile("archer-bow");
const ARCHER_ROLL = profile("archer-roll");
const ENGINEER_CAST = profile("engineer-cast");
const MAGE_CAST = profile("mage-cast");

export const ARENA_SKILL_ACTION_PROFILES = {
  warrior_00: WARRIOR_MELEE,
  warrior_01: WARRIOR_NEUTRAL,
  warrior_02: WARRIOR_NEUTRAL,
  warrior_03: WARRIOR_NEUTRAL,
  warrior_04: WARRIOR_CHARGE,
  warrior_05: WARRIOR_NEUTRAL,
  warrior_06: WARRIOR_MELEE,
  warrior_07: WARRIOR_NEUTRAL,
  warrior_08: WARRIOR_NEUTRAL,
  warrior_09: WARRIOR_NEUTRAL,
  warrior_10: WARRIOR_MELEE,
  warrior_11: WARRIOR_NEUTRAL,
  warrior_12: WARRIOR_NEUTRAL,
  warrior_13: WARRIOR_NEUTRAL,
  warrior_14: WARRIOR_NEUTRAL,

  archer_00: ARCHER_NEUTRAL,
  archer_01: ARCHER_ROLL,
  archer_02: ARCHER_BOW,
  archer_03: ARCHER_NEUTRAL,
  archer_04: ARCHER_NEUTRAL,
  archer_05: ARCHER_NEUTRAL,
  archer_06: ARCHER_NEUTRAL,
  archer_07: ARCHER_NEUTRAL,
  archer_08: ARCHER_NEUTRAL,
  archer_09: ARCHER_BOW,
  archer_10: ARCHER_NEUTRAL,
  archer_11: ARCHER_BOW,
  archer_12: ARCHER_BOW,
  archer_13: ARCHER_NEUTRAL,
  archer_14: ARCHER_NEUTRAL,

  engineer_00: ENGINEER_CAST,
  engineer_01: ENGINEER_CAST,
  engineer_02: ENGINEER_CAST,
  engineer_03: ENGINEER_CAST,
  engineer_04: ENGINEER_CAST,
  engineer_05: ENGINEER_CAST,
  engineer_06: ENGINEER_CAST,
  engineer_07: ENGINEER_CAST,
  engineer_08: ENGINEER_CAST,
  engineer_09: ENGINEER_CAST,
  engineer_10: ENGINEER_CAST,
  engineer_11: ENGINEER_CAST,
  engineer_12: ENGINEER_CAST,
  engineer_13: ENGINEER_CAST,
  engineer_14: ENGINEER_CAST,
  engineer_15: ENGINEER_CAST,

  mage_00: MAGE_CAST,
  mage_01: MAGE_CAST,
  mage_02: MAGE_CAST,
  mage_03: MAGE_CAST,
  mage_04: MAGE_CAST,
  mage_05: MAGE_CAST,
  mage_06: MAGE_CAST,
  mage_07: MAGE_CAST,
  mage_08: MAGE_CAST,
  mage_09: MAGE_CAST,
  mage_10: MAGE_CAST,
  mage_11: MAGE_CAST,
  mage_12: MAGE_CAST,
  mage_13: MAGE_CAST,
  mage_14: MAGE_CAST
} as const satisfies Partial<Record<ArenaCatalogSkillId, ArenaSkillActionProfile>>;

const undeclaredSkillIds = ARENA_SKILL_CATALOG
  .map((skill) => skill.id)
  .filter((skillId) => !(skillId in ARENA_SKILL_ACTION_PROFILES));

if (undeclaredSkillIds.length > 0) {
  throw new Error(
    `Missing explicit action profiles for catalog skills: ${undeclaredSkillIds.join(", ")}`
  );
}

export function getArenaSkillActionProfile(skillId: ArenaCatalogSkillId | null) {
  if (!skillId) return null;
  const actionProfile = (
    ARENA_SKILL_ACTION_PROFILES as Partial<
      Record<ArenaCatalogSkillId, ArenaSkillActionProfile>
    >
  )[skillId];
  if (!actionProfile) {
    throw new Error(`Missing explicit action profile for catalog skill: ${skillId}`);
  }
  return actionProfile;
}

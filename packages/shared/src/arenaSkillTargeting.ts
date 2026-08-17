import { ARENA_DUEL_REALM } from "./balance";
import type { ArenaCatalogSkillId } from "./types";

/**
 * Skills whose release resolves one enemy nearest to the player's cursor.
 *
 * Keeping this list shared lets the authoritative server and the web preview
 * speak the same targeting language without inferring it from VFX anchors.
 */
export const ARENA_CURSOR_TARGET_RANGES: Readonly<
  Partial<Record<ArenaCatalogSkillId, number>>
> = {
  warrior_05: 125,
  warrior_06: 125,
  warrior_10: 170,
  warrior_13: ARENA_DUEL_REALM.targetRange,
  archer_05: 520,
  archer_12: 950,
  engineer_05: 460,
  engineer_13: 520,
  mage_02: 480,
  mage_03: 520,
  mage_04: 520,
  mage_05: 520,
  mage_11: 640
};

export function getArenaCursorTargetRange(
  skillId: ArenaCatalogSkillId | null | undefined
) {
  return skillId ? ARENA_CURSOR_TARGET_RANGES[skillId] ?? null : null;
}

export function isArenaCursorTargetSkill(
  skillId: ArenaCatalogSkillId | null | undefined
) {
  return getArenaCursorTargetRange(skillId) !== null;
}

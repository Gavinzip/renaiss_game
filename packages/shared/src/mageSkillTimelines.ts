import type { ArenaCatalogSkillId } from "./types";

export interface MageTimedVisualContract {
  introDurationMs: number;
  activeDurationMs: number;
  recoveryDurationMs: number;
}

export type MageTimedSkillId =
  | "mage_01"
  | "mage_03"
  | "mage_04"
  | "mage_06"
  | "mage_07"
  | "mage_08"
  | "mage_09"
  | "mage_10"
  | "mage_11"
  | "mage_13"
  | "mage_14";

/**
 * The advertised duration is always the active phase. Cast-in and recovery
 * live outside that duration so a four-second field is visibly active for a
 * full four seconds without stretching any authored source frame.
 */
export const MAGE_TIMED_VISUALS = {
  mage_01: { introDurationMs: 100, activeDurationMs: 4000, recoveryDurationMs: 100 },
  mage_03: { introDurationMs: 156, activeDurationMs: 4000, recoveryDurationMs: 78 },
  mage_04: { introDurationMs: 156, activeDurationMs: 2000, recoveryDurationMs: 78 },
  mage_06: { introDurationMs: 100, activeDurationMs: 2000, recoveryDurationMs: 100 },
  mage_07: { introDurationMs: 300, activeDurationMs: 1100, recoveryDurationMs: 890 },
  mage_08: { introDurationMs: 220, activeDurationMs: 4000, recoveryDurationMs: 210 },
  mage_09: { introDurationMs: 156, activeDurationMs: 5000, recoveryDurationMs: 78 },
  mage_10: { introDurationMs: 156, activeDurationMs: 2000, recoveryDurationMs: 78 },
  mage_11: { introDurationMs: 78, activeDurationMs: 2000, recoveryDurationMs: 78 },
  mage_13: { introDurationMs: 120, activeDurationMs: 3000, recoveryDurationMs: 120 },
  mage_14: { introDurationMs: 120, activeDurationMs: 5000, recoveryDurationMs: 120 }
} as const satisfies Record<MageTimedSkillId, MageTimedVisualContract>;

export function getMageTimedVisual(skillId: ArenaCatalogSkillId | null) {
  return skillId && skillId in MAGE_TIMED_VISUALS
    ? MAGE_TIMED_VISUALS[skillId as MageTimedSkillId]
    : null;
}

export function getMageTimedVisualDuration(
  skillId: MageTimedSkillId,
  activeDurationMs: number = MAGE_TIMED_VISUALS[skillId].activeDurationMs
) {
  const timeline = MAGE_TIMED_VISUALS[skillId];
  return timeline.introDurationMs + activeDurationMs + timeline.recoveryDurationMs;
}

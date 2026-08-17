import type { ArenaStatusId } from "./arenaStatuses";
import type { ArenaCatalogSkillId } from "./types";

export type ArenaStatusReviewRecipient = "self" | "enemy" | "both";
export type ArenaStatusReviewSetup = "none" | "turret";

export interface ArenaStatusReviewExample {
  skillId: ArenaCatalogSkillId;
  recipient: ArenaStatusReviewRecipient;
  setup: ArenaStatusReviewSetup;
  stacks?: number;
}

/**
 * One real Arena skill for every public overhead status.
 *
 * The review UI and contract audit both read this record so a status cannot be
 * demonstrated with a made-up effect or a skill that differs from gameplay.
 */
export const ARENA_STATUS_REVIEW_EXAMPLES = {
  stunned: { skillId: "warrior_05", recipient: "enemy", setup: "none" },
  silenced: { skillId: "mage_04", recipient: "enemy", setup: "none" },
  rooted: { skillId: "archer_08", recipient: "enemy", setup: "none" },
  dash_locked: { skillId: "engineer_10", recipient: "enemy", setup: "turret" },
  vulnerable: { skillId: "warrior_06", recipient: "enemy", setup: "none" },
  marked: { skillId: "archer_05", recipient: "enemy", setup: "none" },
  poisoned: { skillId: "mage_01", recipient: "enemy", setup: "none" },
  slowed: { skillId: "mage_06", recipient: "enemy", setup: "none" },
  duel: { skillId: "warrior_13", recipient: "both", setup: "none" },
  counter: { skillId: "warrior_07", recipient: "self", setup: "none" },
  engineer_support: { skillId: "engineer_09", recipient: "self", setup: "turret" },
  dodging: { skillId: "archer_06", recipient: "self", setup: "none" },
  concealed: { skillId: "archer_04", recipient: "self", setup: "none" },
  enchanted_attacks: {
    skillId: "warrior_03",
    recipient: "self",
    setup: "none",
    stacks: 3
  },
  steady_aim: { skillId: "archer_09", recipient: "self", setup: "none" },
  focus_lens: { skillId: "mage_09", recipient: "self", setup: "none" },
  attack_boost: { skillId: "warrior_09", recipient: "self", setup: "none" },
  speed_boost: { skillId: "warrior_01", recipient: "self", setup: "none" }
} as const satisfies Record<ArenaStatusId, ArenaStatusReviewExample>;

/** Shield deliberately remains material-only and is not an overhead status. */
export const ARENA_SHIELD_REVIEW_EXAMPLE = {
  skillId: "warrior_08",
  recipient: "self",
  setup: "none"
} as const satisfies ArenaStatusReviewExample;

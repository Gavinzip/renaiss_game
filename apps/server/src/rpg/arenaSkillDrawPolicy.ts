import { randomInt } from "node:crypto";
import type { ArenaCatalogSkill, ArenaSkillTier } from "@renaiss-game/shared";

const TIER_ORDER: readonly ArenaSkillTier[] = ["basic", "intermediate", "ultimate"];

export const ARENA_SKILL_TIER_WEIGHTS: Readonly<Record<ArenaSkillTier, number>> = {
  basic: 70,
  intermediate: 20,
  ultimate: 10
};

export function drawWeightedArenaSkill(
  candidates: readonly ArenaCatalogSkill[]
): ArenaCatalogSkill | null {
  const eligibleTiers = TIER_ORDER.map((tier) => ({
    tier,
    weight: ARENA_SKILL_TIER_WEIGHTS[tier],
    skills: candidates.filter((skill) => skill.tier === tier)
  })).filter((entry) => entry.skills.length > 0);

  const totalWeight = eligibleTiers.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight === 0) return null;

  let tierRoll = randomInt(totalWeight);
  for (const entry of eligibleTiers) {
    if (tierRoll < entry.weight) {
      const skill = entry.skills[randomInt(entry.skills.length)];
      if (!skill) throw new Error(`Arena skill tier ${entry.tier} had no selectable skill.`);
      return skill;
    }
    tierRoll -= entry.weight;
  }

  throw new Error("Arena skill tier roll exceeded the eligible weight range.");
}

import { RPG_ELEMENTS, RPG_SKILL_TIERS, type RpgElement, type RpgMove, type RpgSkillTier } from "./rpgTypes";
import { RPG_MOVES, RPG_STARTER_PETS } from "./rpgContent";

export interface RpgBalanceBucket {
  element: RpgElement;
  tier: RpgSkillTier;
  count: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
}

export interface RpgBalanceAudit {
  totalMoves: number;
  buckets: RpgBalanceBucket[];
  warnings: string[];
}

const EXPECTED_COUNTS: Record<RpgSkillTier, number> = {
  basic: 10,
  intermediate: 10,
  ultimate: 5
};

const TARGET_SCORE: Record<RpgSkillTier, { min: number; max: number }> = {
  basic: { min: 17.2, max: 18.2 },
  intermediate: { min: 23, max: 24.8 },
  ultimate: { min: 40, max: 43.2 }
};

const MOVE_SCORE_LIMIT: Record<RpgSkillTier, { min: number; max: number }> = {
  basic: { min: 15.8, max: 19.4 },
  intermediate: { min: 21, max: 25.9 },
  ultimate: { min: 38, max: 46 }
};

const TIER_SPREAD_LIMIT: Record<RpgSkillTier, number> = {
  basic: 3.8,
  intermediate: 4.8,
  ultimate: 7
};

const REQUIRED_PET_ANIMATIONS = ["spriteKey", "idle", "walk", "attack", "hit", "faint", "follow"] as const;
const REMOVED_ACCURACY_COPY = /命中|閃避|帷幕|致盲|低機率|高機率|accuracy|evasion|veil|blind/i;

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }
    seen.add(value);
  });
  return [...duplicates];
}

function effectScore(move: RpgMove) {
  const rawScore = move.effects.reduce((sum, effect) => {
    let value = 0;
    if (effect.heal) {
      const singleHealWeight = move.tier === "basic" ? 0.78 : 0.68;
      value += effect.heal * (effect.target === "team" ? 0.92 : singleHealWeight);
    }
    if (effect.shield) value += effect.shield * (effect.target === "team" ? 1.45 : 0.78);
    if (effect.cleanse) value += effect.target === "team" ? 12 : 7;
    if (effect.energy) value += effect.energy * 5;
    if (effect.selfDamage) value -= effect.selfDamage * 0.9;
    if (effect.status) {
      const duration = Math.max(1, effect.duration ?? 1);
      const power = effect.power ?? 1;
      const targetScale = effect.target === "team" ? 1.6 : move.target === "allEnemies" && effect.target === "target" ? 1.45 : 1;
      const statusBaseByTier: Record<RpgSkillTier, Record<string, number>> = {
        basic: { burn: 2.6, poison: 2.5, stun: 11, guard: 7.7, regen: 4.9 },
        intermediate: { burn: 3.1, poison: 3, stun: 13, guard: 7.4, regen: 5 },
        ultimate: { burn: 3.8, poison: 3.7, stun: 15, guard: 7, regen: 5.2 }
      };
      const statusBase = statusBaseByTier[move.tier];
      value += (statusBase[effect.status] ?? 4) * duration * targetScale;
      value += Math.min(24, power) * 0.36 * targetScale;
      if (effect.target === "team" && (effect.status === "guard" || effect.status === "regen")) value += 6;
    }
    return sum + value;
  }, 0);
  const teamSupportEffects = move.effects.filter(
    (effect) => effect.target === "team" && (effect.heal || effect.cleanse || effect.status === "guard" || effect.status === "regen")
  );
  const hasTeamHeal = teamSupportEffects.some((effect) => effect.heal || effect.cleanse);
  if (hasTeamHeal && teamSupportEffects.length >= 3) return rawScore * 0.68;
  if (hasTeamHeal && teamSupportEffects.length === 2) return rawScore * 0.82;
  return rawScore;
}

export function scoreRpgMove(move: RpgMove) {
  const targetScale = move.target === "allEnemies" ? 1.85 : move.target === "allAllies" ? 1 : 1;
  const speedBonus = (move.speed - 10) * 0.45;
  const costPenalty = move.energyCost * 3.3;
  return Math.round((move.power * targetScale + effectScore(move) + speedBonus - costPenalty) * 10) / 10;
}

function findFastDamageDominance(tierMoves: readonly RpgMove[]) {
  const warnings: string[] = [];
  const scoredMoves = tierMoves.map((move) => ({ move, score: scoreRpgMove(move) }));
  const hasGameplayEffect = (move: RpgMove) => move.effects.length > 0 || move.target === "allEnemies" || move.target === "allAllies" || move.target === "singleAlly" || move.target === "self";
  for (const candidate of scoredMoves) {
    if (candidate.move.power <= 0) continue;
    for (const compared of scoredMoves) {
      if (candidate.move.id === compared.move.id || compared.move.power <= 0) continue;
      if (candidate.move.target !== compared.move.target) continue;
      if (hasGameplayEffect(candidate.move) !== hasGameplayEffect(compared.move)) {
        const clearlyHigherValue = candidate.score >= compared.score + 3;
        if (!clearlyHigherValue) continue;
      }
      const isFaster = candidate.move.speed > compared.move.speed;
      const isNoWeaker = candidate.move.power >= compared.move.power;
      const isNoMoreExpensive = candidate.move.energyCost <= compared.move.energyCost;
      const isNoLowerValue = candidate.score >= compared.score - 0.1;
      const candidateTax = candidate.move.energyCost;
      const comparedTax = compared.move.energyCost;
      if (isFaster && isNoWeaker && isNoMoreExpensive && isNoLowerValue) {
        warnings.push(
          `${candidate.move.id} dominates ${compared.move.id}: faster (${candidate.move.speed}>${compared.move.speed}), ` +
            `power ${candidate.move.power}>=${compared.move.power}, energy ${candidate.move.energyCost}<=${compared.move.energyCost}.`
        );
      }
      if (isFaster && candidate.move.power > compared.move.power && candidateTax <= comparedTax && candidate.score >= compared.score - 0.1) {
        warnings.push(
          `${candidate.move.id} is faster and stronger than ${compared.move.id} without a real cost tax: ` +
            `speed ${candidate.move.speed}>${compared.move.speed}, power ${candidate.move.power}>${compared.move.power}, tax ${candidateTax}<=${comparedTax}.`
        );
      }
    }
  }
  return warnings;
}

export function auditRpgBalance(moves: readonly RpgMove[] = RPG_MOVES): RpgBalanceAudit {
  const warnings: string[] = [];
  const buckets: RpgBalanceBucket[] = [];

  if (moves.length !== 125) {
    warnings.push(`Expected 125 total moves, found ${moves.length}.`);
  }

  const duplicateMoveIds = duplicateValues(moves.map((move) => move.id));
  if (duplicateMoveIds.length > 0) {
    warnings.push(`Duplicate move ids: ${duplicateMoveIds.join(", ")}.`);
  }

  const duplicateAnimationKeys = duplicateValues(moves.map((move) => move.animation.key));
  if (duplicateAnimationKeys.length > 0) {
    warnings.push(`Duplicate animation keys: ${duplicateAnimationKeys.join(", ")}.`);
  }

  const duplicateAnimationNames = duplicateValues(moves.map((move) => move.animation.name));
  if (duplicateAnimationNames.length > 0) {
    warnings.push(`Duplicate animation names: ${duplicateAnimationNames.join(", ")}.`);
  }

  for (const pet of RPG_STARTER_PETS) {
    for (const key of REQUIRED_PET_ANIMATIONS) {
      if (!pet.animationSet[key]) {
        warnings.push(`${pet.id} missing ${key} animation key.`);
      }
    }
  }

  for (const move of moves) {
    const searchableCopy = [move.name, move.description, move.animation.name, ...move.tags].join(" ");
    if (REMOVED_ACCURACY_COPY.test(searchableCopy)) {
      warnings.push(`${move.id} still contains removed accuracy/evasion copy.`);
    }
  }

  for (const element of RPG_ELEMENTS) {
    const elementMoves = moves.filter((move) => move.element === element);
    if (elementMoves.length !== 25) {
      warnings.push(`${element} expected 25 moves, found ${elementMoves.length}.`);
    }

    for (const tier of RPG_SKILL_TIERS) {
      const tierMoves = elementMoves.filter((move) => move.tier === tier);
      const scores = tierMoves.map(scoreRpgMove);
      const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
      const minScore = scores.length > 0 ? Math.min(...scores) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
      const target = TARGET_SCORE[tier];
      if (tierMoves.length !== EXPECTED_COUNTS[tier]) {
        warnings.push(`${element}/${tier} expected ${EXPECTED_COUNTS[tier]} moves, found ${tierMoves.length}.`);
      }
      if (averageScore < target.min || averageScore > target.max) {
        warnings.push(`${element}/${tier} average score ${averageScore.toFixed(1)} outside ${target.min}-${target.max}.`);
      }
      const moveLimit = MOVE_SCORE_LIMIT[tier];
      tierMoves.forEach((move, index) => {
        const score = scores[index] ?? scoreRpgMove(move);
        if (score < moveLimit.min || score > moveLimit.max) {
          warnings.push(`${move.id} score ${score.toFixed(1)} outside ${moveLimit.min}-${moveLimit.max}.`);
        }
      });
      if (maxScore - minScore > TIER_SPREAD_LIMIT[tier]) {
        warnings.push(`${element}/${tier} move score spread too wide: ${minScore.toFixed(1)}-${maxScore.toFixed(1)}.`);
      }
      warnings.push(...findFastDamageDominance(tierMoves));
      buckets.push({
        element,
        tier,
        count: tierMoves.length,
        averageScore: Math.round(averageScore * 10) / 10,
        minScore,
        maxScore
      });
    }
  }

  for (const tier of RPG_SKILL_TIERS) {
    const tierBuckets = buckets.filter((bucket) => bucket.tier === tier);
    const averages = tierBuckets.map((bucket) => bucket.averageScore);
    const min = Math.min(...averages);
    const max = Math.max(...averages);
    const midpoint = (min + max) / 2;
    if (midpoint > 0 && (max - min) / midpoint > 0.08) {
      warnings.push(`${tier} element spread too wide: ${min.toFixed(1)}-${max.toFixed(1)}.`);
    }
  }

  return { totalMoves: moves.length, buckets, warnings };
}

export function assertRpgBalance() {
  const audit = auditRpgBalance();
  if (audit.warnings.length > 0) {
    throw new Error(audit.warnings.join("\n"));
  }
  return audit;
}

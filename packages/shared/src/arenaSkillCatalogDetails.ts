import type { ArenaCatalogSkillId } from "./types";
import {
  ARENA_SKILL_SPECS,
  formatArenaSkillCooldown
} from "./arenaSkillSpecs";
import {
  COMBAT,
  getArenaSkillDamageMultiplier,
  getEffectiveArenaSkillDamage
} from "./balance";

const POISON_TICK_COUNT =
  COMBAT.poisonDuration / COMBAT.poisonTickInterval;

const EFFECTIVE_DAMAGE_LABELS: Partial<Record<ArenaCatalogSkillId, string>> = {
  engineer_01: `強化普攻每發 ${getEffectiveArenaSkillDamage("engineer_01", 18)}；3 發最高 ${getEffectiveArenaSkillDamage("engineer_01", 18) * 3}`,
  engineer_02: `3 × ${getEffectiveArenaSkillDamage("engineer_02", 9)}；最高 ${getEffectiveArenaSkillDamage("engineer_02", 9) * 3}`,
  engineer_03: `${getEffectiveArenaSkillDamage("engineer_03", 30)}`,
  engineer_04: `4 × ${getEffectiveArenaSkillDamage("engineer_04", 11)}；最高 ${getEffectiveArenaSkillDamage("engineer_04", 11) * 4}`,
  engineer_05: `每座 ${getEffectiveArenaSkillDamage("engineer_05", 16)}；最多 ${getEffectiveArenaSkillDamage("engineer_05", 16) * 3}；標定連動每座 ${getEffectiveArenaSkillDamage("engineer_05", 24)}、最多 ${getEffectiveArenaSkillDamage("engineer_05", 24) * 3}`,
  engineer_06: `${getEffectiveArenaSkillDamage("engineer_06", 65)}`,
  engineer_07: `${getEffectiveArenaSkillDamage("engineer_07", 18)}`,
  engineer_10: `${getEffectiveArenaSkillDamage("engineer_10", 20)}`,
  engineer_11: `每座 ${getEffectiveArenaSkillDamage("engineer_11", 60)}；最高 ${getEffectiveArenaSkillDamage("engineer_11", 60) * 3}`,
  engineer_12: `每座 ${getEffectiveArenaSkillDamage("engineer_12", COMBAT.magicTurretSyncDamage)}；最高 ${getEffectiveArenaSkillDamage("engineer_12", COMBAT.magicTurretSyncDamage) * 3}`,
  engineer_13: `每座立即 ${getEffectiveArenaSkillDamage("engineer_13", 7)}；普通飛彈 ${COMBAT.magicTurretBasicDamage}→${getEffectiveArenaSkillDamage("engineer_13", COMBAT.magicTurretMarkedBasicDamage)}`,
  engineer_14: `每座 ${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitDamage)}＋${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitFragmentDamage)}；最高 ${(getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitDamage) + getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitFragmentDamage)) * 3}`,
  engineer_15: `每座每人 2 × ${getEffectiveArenaSkillDamage("engineer_15", COMBAT.magicTurretMatrixDamage)}；最高 ${getEffectiveArenaSkillDamage("engineer_15", COMBAT.magicTurretMatrixDamage) * 2 * 3}／人`,
  mage_00: `${getEffectiveArenaSkillDamage("mage_00", 24)}`,
  mage_01: `${getEffectiveArenaSkillDamage("mage_01", 12)}＋${COMBAT.poisonTickDamage} × ${POISON_TICK_COUNT}；總計 ${getEffectiveArenaSkillDamage("mage_01", 12) + COMBAT.poisonTickDamage * POISON_TICK_COUNT}`,
  mage_02: `${getEffectiveArenaSkillDamage("mage_02", 16)}；治療 8／16`,
  mage_05: `${getEffectiveArenaSkillDamage("mage_05", 13)}`,
  mage_06: `${getEffectiveArenaSkillDamage("mage_06", 18)}`,
  mage_07: `${getEffectiveArenaSkillDamage("mage_07", 28)}`,
  mage_08: `${getEffectiveArenaSkillDamage("mage_08", 8)} × 4；另中毒 ${COMBAT.poisonTickDamage}／秒`,
  mage_09: "0；傷害型 Q 的 +12 基礎加成依該 Q 倍率結算",
  mage_11: `${getEffectiveArenaSkillDamage("mage_11", 12)}`,
  mage_12: `${getEffectiveArenaSkillDamage("mage_12", 42)}`,
  mage_14: `${getEffectiveArenaSkillDamage("mage_14", 12)} × 5；最高 ${getEffectiveArenaSkillDamage("mage_14", 12) * 5}`
};

export interface ArenaCatalogSkillDetail {
  effect: string;
  damage: string | null;
  cooldown: string | null;
  duration?: string;
}

export const ARENA_SKILL_CATALOG_DETAILS = Object.fromEntries(
  Object.entries(ARENA_SKILL_SPECS).map(([skillId, spec]) => {
    const multiplier = getArenaSkillDamageMultiplier(
      skillId as ArenaCatalogSkillId
    );
    const damage =
      spec.numbers.damage?.length && multiplier !== 1
        ? EFFECTIVE_DAMAGE_LABELS[skillId as ArenaCatalogSkillId] ?? spec.damage
        : spec.damage;
    return [
      skillId,
      {
        effect: spec.effect,
        damage,
        cooldown: formatArenaSkillCooldown(spec.cooldownMs),
        duration: spec.duration
      }
    ];
  })
) as Record<ArenaCatalogSkillId, ArenaCatalogSkillDetail>;

export function getArenaCatalogSkillDetail(skillId: ArenaCatalogSkillId | null) {
  return skillId ? ARENA_SKILL_CATALOG_DETAILS[skillId] ?? null : null;
}

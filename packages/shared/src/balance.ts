import type {
  ArenaCatalogSkillId,
  ClassId,
  EngineerTurretKind,
  PlayerActionState,
  SkillKey
} from "./types";

export const WORLD = {
  width: 6400,
  height: 6400,
  villageName: "Eco Arena 6C6K",
  tickRate: 30,
  broadcastRate: 20,
  respawnMs: 3000,
  roundDurationMs: 300000,
  roundRestartMs: 8000,
  scoreLimit: 15,
  spawnRadius: 980,
  healthPackCount: 24,
  healthPackVariantCount: 4,
  healthPackRadius: 34,
  healthPackHeal: 40,
  attackBoostPackCount: 8,
  attackBoostPackRadius: 34,
  attackBoostDurationMs: 12000,
  attackBoostMultiplier: 1.35
} as const;

export const CLASS_ORDER: ClassId[] = ["warrior", "archer", "engineer", "mage"];

export const CLASS_META: Record<ClassId, { label: string; role: string; accent: string }> = {
  warrior: {
    label: "Warrior",
    role: "Shield frontline",
    accent: "#f2a944"
  },
  archer: {
    label: "Archer",
    role: "Root and range",
    accent: "#72c84a"
  },
  engineer: {
    label: "Engineer",
    role: "Turret control",
    accent: "#46a7c7"
  },
  mage: {
    label: "Mage",
    role: "Burst caster",
    accent: "#ad6cff"
  }
};

export interface ClassStats {
  maxHealth: number;
  attackPower: number;
  moveSpeed: number;
  attackCooldownMs: number;
}

export const CLASS_STATS: Record<ClassId, ClassStats> = {
  warrior: {
    maxHealth: 185,
    attackPower: 50,
    moveSpeed: 168,
    attackCooldownMs: 560
  },
  archer: {
    maxHealth: 150,
    attackPower: 24,
    moveSpeed: 205,
    attackCooldownMs: 430
  },
  engineer: {
    maxHealth: 155,
    attackPower: 4,
    moveSpeed: 152,
    attackCooldownMs: 500
  },
  mage: {
    maxHealth: 145,
    attackPower: 5,
    moveSpeed: 162,
    attackCooldownMs: 650
  }
};

/** Basic-attack tuning only. Active skills resolve through their own profile. */
export const CLASS_DAMAGE_MULTIPLIERS: Record<ClassId, number> = {
  warrior: 0.6,
  archer: 0.65,
  engineer: 3,
  mage: 2
};

export function getClassDamageMultiplier(classId: ClassId) {
  return CLASS_DAMAGE_MULTIPLIERS[classId];
}

/** Damage is always resolved to a whole number with standard half-up rounding. */
export function roundDamage(value: number) {
  return Math.round(value);
}

export function getEffectiveClassDamage(classId: ClassId, rawDamage: number) {
  return roundDamage(rawDamage * getClassDamageMultiplier(classId));
}

export function getEffectiveBasicAttackDamage(classId: ClassId) {
  return getEffectiveClassDamage(classId, CLASS_STATS[classId].attackPower);
}

export const ENGINEER_TURRET_DAMAGE_RETUNE = {
  basicAttack: 0.8,
  activeSkill: 0.9
} as const;

/** Applies the approved 20% increase to every Mage skill damage profile. */
export const MAGE_SKILL_DAMAGE_RETUNE = 1.2;

/**
 * Control-heavy Engineer and Mage skills intentionally keep their authored
 * damage. Engineer turret attacks receive the currently approved tuning on
 * top of their authored damage. Mage skill damage receives the approved 20%
 * retune on top of its existing offensive/control profile; basic attacks,
 * healing, and the shared fixed poison ticks are not changed here.
 */
export const ARENA_SKILL_DAMAGE_MULTIPLIER_OVERRIDES: Partial<
  Record<ArenaCatalogSkillId, number>
> = {
  engineer_01: 1.5 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_02: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_03: 1.5 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_04: 1.5 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_05: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_06: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_07: 1.5 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_10: 1.5 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_11: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_12: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_13: 1.5 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_14: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  engineer_15: 1.875 * ENGINEER_TURRET_DAMAGE_RETUNE.activeSkill,
  mage_00: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_01: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_02: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_05: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_06: MAGE_SKILL_DAMAGE_RETUNE,
  mage_07: MAGE_SKILL_DAMAGE_RETUNE,
  mage_08: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_09: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_11: MAGE_SKILL_DAMAGE_RETUNE,
  mage_12: 1.5 * MAGE_SKILL_DAMAGE_RETUNE,
  mage_14: 1.5 * MAGE_SKILL_DAMAGE_RETUNE
};

export function getArenaSkillDamageMultiplier(
  skillId: ArenaCatalogSkillId
) {
  // Skill damage is neutral unless this table explicitly opts the skill into
  // a tuning profile. Class multipliers are reserved for basic attacks.
  return ARENA_SKILL_DAMAGE_MULTIPLIER_OVERRIDES[skillId] ?? 1;
}

export function getEffectiveArenaSkillDamage(
  skillId: ArenaCatalogSkillId,
  rawDamage: number
) {
  return roundDamage(rawDamage * getArenaSkillDamageMultiplier(skillId));
}

export const SKILL_COOLDOWNS: Record<SkillKey, number> = {
  skillF: 8000,
  skillQ: 5000,
  skillE: 8000,
  skillR: 15000
};

export const CLASS_SKILL_COOLDOWNS: Partial<Record<ClassId, Partial<Record<SkillKey, number>>>> = {
  warrior: {
    skillF: 14000
  },
  engineer: {
    skillF: 8000,
    skillQ: 7000,
    skillE: 14000,
    skillR: 30000
  },
  mage: {
    skillF: 12000,
    skillE: 9000,
    skillR: 16000
  }
};

export function getSkillCooldownMs(classId: ClassId, skill: SkillKey) {
  return CLASS_SKILL_COOLDOWNS[classId]?.[skill] ?? SKILL_COOLDOWNS[skill];
}

export const SKILL_LABELS: Record<ClassId, Record<SkillKey, string>> = {
  warrior: {
    skillF: "Battle Cry",
    skillQ: "Justice Charge",
    skillE: "Peace Shield",
    skillR: "Verdict"
  },
  archer: {
    skillF: "Piercing Shot",
    skillQ: "Forest Roll",
    skillE: "Root Bind",
    skillR: "Seed Rain"
  },
  engineer: {
    skillF: "Magic Turret",
    skillQ: "Synchronized Seeker",
    skillE: "Splitting Star",
    skillR: "Magic Missile Matrix"
  },
  mage: {
    skillF: "Astral Ward",
    skillQ: "Solar Beam",
    skillE: "Renewal Burst",
    skillR: "Clean Storm"
  }
};

export const COMBAT = {
  playerRadius: 28,
  turretRadius: 30,
  meleeRange: 96,
  projectileHitRadius: 28,
  poisonDuration: 4000,
  poisonTickInterval: 1000,
  poisonTickDamage: 5,
  maxStamina: 100,
  sprintMinStamina: 8,
  sprintDrainPerSecond: 38,
  sprintRegenPerSecond: 26,
  sprintSpeedMultiplier: 1.38,
  assistWindowMs: 7000,
  assistScore: 0.5,
  arrowSpeed: 740,
  arrowDistance: 660,
  archerChargeStages: 5,
  archerChargeStageMs: 260,
  // With Archer's 0.65 basic-attack multiplier this resolves to the approved
  // 13 damage at stage 1 and 30 damage at full charge.
  archerChargedArrowMaxDamageMultiplier: 2.08,
  archerChargedArrowDamagePenalty: 5,
  archerChargedArrowMaxSpeedMultiplier: 1.45,
  archerPiercingShotDamage: 36,
  archerPiercingShotSpeed: 960,
  archerPiercingShotDistance: 900,
  magicBallSpeed: 560,
  magicBallDistance: 540,
  warriorBladeEnchantDamage: [35, 35, 30],
  warriorDashDistance: 280,
  archerRollDistance: 330,
  warriorShieldDuration: 3000,
  warriorBattleCryDuration: 6000,
  warriorUltimateRadius: 260,
  warriorUltimateDamage: 38,
  archerRootRadius: 420,
  archerRootDuration: 2000,
  archerUltimateRadius: 430,
  archerUltimateDamage: 19,
  engineerMaxTurrets: 3,
  mechanicalTurretHealth: 125,
  mechanicalTurretRange: 440,
  mechanicalTurretShotSpeed: 560,
  mechanicalTurretBasicDamage: roundDamage(
    20 * ENGINEER_TURRET_DAMAGE_RETUNE.basicAttack
  ),
  mechanicalTurretAttackInterval: 1000,
  magicTurretHealth: 100,
  magicTurretRange: 460,
  magicTurretShotSpeed: 300,
  magicTurretHomingDistance: 6000,
  magicTurretBasicDamage: roundDamage(
    14 * ENGINEER_TURRET_DAMAGE_RETUNE.basicAttack
  ),
  magicTurretMarkedBasicDamage: roundDamage(
    18 * ENGINEER_TURRET_DAMAGE_RETUNE.basicAttack
  ),
  magicTurretAttackInterval: 1400,
  magicTurretSyncDamage: 11,
  magicTurretSplitDamage: 13,
  magicTurretSplitFragmentDamage: 6,
  magicTurretSplitRadius: 180,
  magicTurretMatrixDamage: 12,
  magicTurretMatrixMissilesPerTarget: 2,
  magicTurretMatrixShotInterval: 350,
  magicTurretMatrixShield: 25,
  magicTurretMatrixShieldDuration: 4000,
  mageBeamLength: 650,
  mageBeamHalfAngle: 14,
  mageBeamDamage: 24,
  mageSunlightBrandDamageMultiplier: 1.25,
  mageFocusLensDuration: 5000,
  mageFocusLensRangeBonus: 100,
  mageFocusLensDamageBonus: 12,
  mageFocusLensStatusDurationBonus: 500,
  mageSoulChainDamage: 12,
  mageSoulChainRange: 520,
  mageSoulChainDuration: 2000,
  mageSoulChainBreakDistance: 300,
  mageSoulChainPullDistance: 100,
  mageAstralWardDuration: 3000,
  mageBurstRadius: 200,
  mageBurstDamage: 28,
  mageBurstStunDuration: 1100,
  mageMiasmaRadius: 200,
  mageMiasmaDuration: 4000,
  mageMiasmaTickInterval: 1000,
  mageMiasmaTickDamage: 8,
  mageTimeAstrolabeRadius: 320,
  mageTimeAstrolabeDuration: 3000,
  mageTimeAstrolabeSlowMultiplier: 0.45,
  mageTimeAstrolabeCenterRadius: 100,
  mageTimeAstrolabeRootDuration: 800,
  mageBloodAltarRadius: 280,
  mageBloodAltarDuration: 5000,
  mageBloodAltarTickInterval: 1000,
  mageBloodAltarTickDamage: 12,
  mageBloodAltarLifesteal: 0.35,
  mageUltimateRadius: 200,
  mageUltimateDamage: 42
} as const;

/**
 * Ordinary turret shots keep their authored preset damage. Engineer's class
 * damage multiplier applies to active skills, not the turrets' autonomous
 * basic attacks.
 */
export function getEngineerTurretBasicAttackDamage(kind: EngineerTurretKind) {
  return kind === "mechanical"
    ? COMBAT.mechanicalTurretBasicDamage
    : COMBAT.magicTurretBasicDamage;
}

/**
 * Server-authoritative geometry and timing for Warrior's Death Duel realm.
 *
 * The accepted configuration preview presents the boundary as a top-down
 * ellipse. Movement uses the same radii so the visible border is also the
 * actual gameplay limit.
 */
export const ARENA_DUEL_REALM = {
  targetRange: 480,
  radiusX: 220,
  radiusY: 103,
  durationMs: 5000,
  transitionMs: 400
} as const;

export function getArcherChargeRatioForStage(stage: number) {
  if (COMBAT.archerChargeStages <= 1) {
    return 1;
  }
  return (Math.max(1, Math.min(COMBAT.archerChargeStages, stage)) - 1) / (COMBAT.archerChargeStages - 1);
}

export function getArcherChargedArrowBaseDamageForStage(stage: number) {
  const multiplier = 1 + (COMBAT.archerChargedArrowMaxDamageMultiplier - 1) * getArcherChargeRatioForStage(stage);
  return Math.max(1, Math.round(CLASS_STATS.archer.attackPower * multiplier) - COMBAT.archerChargedArrowDamagePenalty);
}

export function getArcherChargedArrowDamageForStage(stage: number) {
  return getEffectiveClassDamage(
    "archer",
    getArcherChargedArrowBaseDamageForStage(stage)
  );
}

export function getArcherChargedArrowDamageRange() {
  return {
    min: getArcherChargedArrowDamageForStage(1),
    max: getArcherChargedArrowDamageForStage(COMBAT.archerChargeStages)
  };
}

export interface ActionTooltip {
  description: string;
  facts: string[];
}

const cdLabel = (classId: ClassId, key: SkillKey) => `${getSkillCooldownMs(classId, key) / 1000}s CD`;
const archerChargeDamageRange = getArcherChargedArrowDamageRange();

export const ACTION_TOOLTIPS: Record<ClassId, Record<PlayerActionState, ActionTooltip>> = {
  warrior: {
    attack: {
      description: "Close sword strike in the facing direction.",
      facts: [`${getEffectiveBasicAttackDamage("warrior")} damage`, `${CLASS_STATS.warrior.attackCooldownMs / 1000}s recovery`]
    },
    skillF: {
      description: "Unleash a battle cry that empowers your attacks for a short window.",
      facts: [
        `+${Math.round((WORLD.attackBoostMultiplier - 1) * 100)}% damage`,
        `${COMBAT.warriorBattleCryDuration / 1000}s duration`,
        cdLabel("warrior", "skillF")
      ]
    },
    skillQ: {
      description: "Dash forward and cut through rivals in your path.",
      facts: [`${COMBAT.warriorDashDistance} range`, cdLabel("warrior", "skillQ")]
    },
    skillE: {
      description: "Raise a short defensive guard that blocks incoming damage.",
      facts: [`${COMBAT.warriorShieldDuration / 1000}s shield`, cdLabel("warrior", "skillE")]
    },
    skillR: {
      description: "Verdict strike around you, built for finishing close fights.",
      facts: [`${COMBAT.warriorUltimateDamage} damage`, `${COMBAT.warriorUltimateRadius} radius`, cdLabel("warrior", "skillR")]
    }
  },
  archer: {
    attack: {
      description: "Hold to draw, release to fire a charged arrow.",
      facts: [
        `${COMBAT.archerChargeStages} charge stages`,
        `${archerChargeDamageRange.min}-${archerChargeDamageRange.max} damage`,
        `${COMBAT.arrowDistance} range`
      ]
    },
    skillF: {
      description: "Loose a fast, heavy arrow that reaches beyond your normal attack range.",
      facts: [
        `${COMBAT.archerPiercingShotDamage} damage`,
        `${COMBAT.archerPiercingShotDistance} range`,
        cdLabel("archer", "skillF")
      ]
    },
    skillQ: {
      description: "Roll forward to reposition and create space.",
      facts: [`${COMBAT.archerRollDistance} distance`, cdLabel("archer", "skillQ")]
    },
    skillE: {
      description: "Root Bind blooms at the cursor, locking rivals inside the marked area.",
      facts: [`${COMBAT.archerRootDuration / 1000}s root`, `${COMBAT.archerRootRadius} radius`, cdLabel("archer", "skillE")]
    },
    skillR: {
      description: "Seed Rain bursts at the cursor across a wide ground area.",
      facts: [`${COMBAT.archerUltimateDamage} damage`, `${COMBAT.archerUltimateRadius} radius`, cdLabel("archer", "skillR")]
    }
  },
  engineer: {
    attack: {
      description: "Short mechanical strike in the facing direction.",
      facts: [`${getEffectiveBasicAttackDamage("engineer")} damage`, `${CLASS_STATS.engineer.attackCooldownMs / 1000}s recovery`]
    },
    skillF: {
      description: "Deploy a full-health static magic turret. At the limit, the oldest disappears and a new turret is created.",
      facts: [
        `${COMBAT.engineerMaxTurrets} max`,
        `${COMBAT.magicTurretHealth} HP`,
        `${getEngineerTurretBasicAttackDamage("magic_missile")} damage / ${COMBAT.magicTurretAttackInterval / 1000}s`,
        cdLabel("engineer", "skillF")
      ]
    },
    skillQ: {
      description: "Every magic turret immediately fires one guaranteed seeker at its nearest target.",
      facts: [`${getEffectiveArenaSkillDamage("engineer_12", COMBAT.magicTurretSyncDamage)} damage each`, `${COMBAT.magicTurretRange} range`, cdLabel("engineer", "skillQ")]
    },
    skillE: {
      description: "Every turret fires a splitting missile; its impact seeks a second nearby rival.",
      facts: [`${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitDamage)} + ${getEffectiveArenaSkillDamage("engineer_14", COMBAT.magicTurretSplitFragmentDamage)} damage`, `${COMBAT.magicTurretSplitRadius} split radius`, cdLabel("engineer", "skillE")]
    },
    skillR: {
      description: "Every turret fires two guaranteed missiles at every rival in its own range.",
      facts: [`2 × ${getEffectiveArenaSkillDamage("engineer_15", COMBAT.magicTurretMatrixDamage)} per target`, `+${COMBAT.magicTurretMatrixShield} turret shield`, cdLabel("engineer", "skillR")]
    }
  },
  mage: {
    attack: {
      description: "Launch a magic orb projectile in the facing direction.",
      facts: [`${getEffectiveBasicAttackDamage("mage")} damage`, `${COMBAT.magicBallDistance} range`]
    },
    skillF: {
      description: "Wrap yourself in an astral barrier that blocks incoming damage.",
      facts: [`${COMBAT.mageAstralWardDuration / 1000}s shield`, cdLabel("mage", "skillF")]
    },
    skillQ: {
      description: "Cast a narrow solar beam through enemies in front of you.",
      facts: [`${getEffectiveArenaSkillDamage("mage_00", COMBAT.mageBeamDamage)} damage`, `${COMBAT.mageBeamLength} range`, cdLabel("mage", "skillQ")]
    },
    skillE: {
      description: "Renewal Burst detonates around the caster and stuns surviving rivals.",
      facts: [`${getEffectiveArenaSkillDamage("mage_07", COMBAT.mageBurstDamage)} damage`, `${COMBAT.mageBurstRadius} radius`, `${COMBAT.mageBurstStunDuration / 1000}s stun`, cdLabel("mage", "skillE")]
    },
    skillR: {
      description: "Clean Storm erupts at the cursor for wide-area cleanup.",
      facts: [`${getEffectiveArenaSkillDamage("mage_12", COMBAT.mageUltimateDamage)} damage`, `${COMBAT.mageUltimateRadius} radius`, cdLabel("mage", "skillR")]
    }
  }
};

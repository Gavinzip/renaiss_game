import type { ClassId, PlayerActionState, SkillKey } from "./types";

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
    attackPower: 35,
    moveSpeed: 168,
    attackCooldownMs: 560
  },
  archer: {
    maxHealth: 150,
    attackPower: 16,
    moveSpeed: 205,
    attackCooldownMs: 430
  },
  engineer: {
    maxHealth: 155,
    attackPower: 12,
    moveSpeed: 152,
    attackCooldownMs: 500
  },
  mage: {
    maxHealth: 145,
    attackPower: 11,
    moveSpeed: 162,
    attackCooldownMs: 650
  }
};

export const SKILL_COOLDOWNS: Record<SkillKey, number> = {
  skillQ: 5000,
  skillE: 8000,
  skillR: 15000
};

export const CLASS_SKILL_COOLDOWNS: Partial<Record<ClassId, Partial<Record<SkillKey, number>>>> = {
  mage: {
    skillE: 9000,
    skillR: 16000
  }
};

export function getSkillCooldownMs(classId: ClassId, skill: SkillKey) {
  return CLASS_SKILL_COOLDOWNS[classId]?.[skill] ?? SKILL_COOLDOWNS[skill];
}

export const SKILL_LABELS: Record<ClassId, Record<SkillKey, string>> = {
  warrior: {
    skillQ: "Justice Charge",
    skillE: "Peace Shield",
    skillR: "Verdict"
  },
  archer: {
    skillQ: "Forest Roll",
    skillE: "Root Bind",
    skillR: "Seed Rain"
  },
  engineer: {
    skillQ: "Auto Turret",
    skillE: "Repulsor Pulse",
    skillR: "Overclock"
  },
  mage: {
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
  archerChargedArrowMaxDamageMultiplier: 3,
  archerChargedArrowDamagePenalty: 5,
  archerChargedArrowMaxSpeedMultiplier: 1.45,
  magicBallSpeed: 560,
  magicBallDistance: 540,
  warriorDashDistance: 280,
  archerRollDistance: 330,
  warriorShieldDuration: 3000,
  warriorUltimateRadius: 260,
  warriorUltimateDamage: 38,
  archerRootRadius: 420,
  archerRootDuration: 2000,
  archerUltimateRadius: 430,
  archerUltimateDamage: 19,
  engineerRepulsorPulseRadius: 310,
  engineerRepulsorPulseDamage: 18,
  engineerKnockback: 120,
  engineerMaxTurrets: 3,
  turretHealth: 125,
  turretRange: 420,
  turretBoostedRange: 520,
  turretShotSpeed: 520,
  turretBoostedShotSpeed: 760,
  turretShotDamage: 25,
  turretBoostedDamage: 25,
  turretAttackInterval: 1000,
  turretBoostedAttackInterval: 520,
  turretBoostDuration: 3000,
  mageBeamLength: 650,
  mageBeamHalfAngle: 14,
  mageBeamDamage: 24,
  mageBurstRadius: 200,
  mageBurstDamage: 28,
  mageBurstStunDuration: 1100,
  mageUltimateRadius: 200,
  mageUltimateDamage: 42
} as const;

export function getArcherChargeRatioForStage(stage: number) {
  if (COMBAT.archerChargeStages <= 1) {
    return 1;
  }
  return (Math.max(1, Math.min(COMBAT.archerChargeStages, stage)) - 1) / (COMBAT.archerChargeStages - 1);
}

export function getArcherChargedArrowDamageForStage(stage: number) {
  const multiplier = 1 + (COMBAT.archerChargedArrowMaxDamageMultiplier - 1) * getArcherChargeRatioForStage(stage);
  return Math.max(1, Math.round(CLASS_STATS.archer.attackPower * multiplier) - COMBAT.archerChargedArrowDamagePenalty);
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
      facts: [`${CLASS_STATS.warrior.attackPower} damage`, `${CLASS_STATS.warrior.attackCooldownMs / 1000}s recovery`]
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
      facts: [`${CLASS_STATS.engineer.attackPower} damage`, `${CLASS_STATS.engineer.attackCooldownMs / 1000}s recovery`]
    },
    skillQ: {
      description: "Deploy an auto turret that tracks and fires at nearby rivals.",
      facts: [`${COMBAT.engineerMaxTurrets} max turrets`, `${COMBAT.turretRange} range`, cdLabel("engineer", "skillQ")]
    },
    skillE: {
      description: "Release a close repulsor pulse that damages and knocks rivals away.",
      facts: [`${COMBAT.engineerRepulsorPulseDamage} damage`, `${COMBAT.engineerKnockback} knockback`, cdLabel("engineer", "skillE")]
    },
    skillR: {
      description: "Overclock your turret grid for faster, longer-range shots.",
      facts: [`${COMBAT.turretBoostDuration / 1000}s boost`, `${COMBAT.turretBoostedDamage} turret damage`, cdLabel("engineer", "skillR")]
    }
  },
  mage: {
    attack: {
      description: "Launch a magic orb projectile in the facing direction.",
      facts: [`${CLASS_STATS.mage.attackPower} damage`, `${COMBAT.magicBallDistance} range`]
    },
    skillQ: {
      description: "Cast a narrow solar beam through enemies in front of you.",
      facts: [`${COMBAT.mageBeamDamage} damage`, `${COMBAT.mageBeamLength} range`, cdLabel("mage", "skillQ")]
    },
    skillE: {
      description: "Renewal Burst detonates at the cursor and stuns surviving rivals.",
      facts: [`${COMBAT.mageBurstDamage} damage`, `${COMBAT.mageBurstRadius} radius`, `${COMBAT.mageBurstStunDuration / 1000}s stun`, cdLabel("mage", "skillE")]
    },
    skillR: {
      description: "Clean Storm erupts at the cursor for wide-area cleanup.",
      facts: [`${COMBAT.mageUltimateDamage} damage`, `${COMBAT.mageUltimateRadius} radius`, cdLabel("mage", "skillR")]
    }
  }
};

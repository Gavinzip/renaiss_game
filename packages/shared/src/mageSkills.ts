import type {
  ArenaCatalogSkillId,
  ArenaLoadoutSlot,
  EffectType
} from "./types";

export type RuntimeMageSkillId =
  | "mage_00"
  | "mage_07"
  | "mage_08"
  | "mage_12"
  | "mage_13"
  | "mage_14";

export interface RuntimeMageSkillSpec {
  id: RuntimeMageSkillId;
  slot: ArenaLoadoutSlot;
  cooldownMs: number;
  effectType: EffectType;
}

export const RUNTIME_MAGE_SKILLS: Record<RuntimeMageSkillId, RuntimeMageSkillSpec> = {
  mage_00: {
    id: "mage_00",
    slot: "skillQ",
    cooldownMs: 5000,
    effectType: "beam"
  },
  mage_07: {
    id: "mage_07",
    slot: "skillE",
    cooldownMs: 9000,
    effectType: "burst"
  },
  mage_08: {
    id: "mage_08",
    slot: "skillE",
    cooldownMs: 14000,
    effectType: "mage_miasma_field"
  },
  mage_12: {
    id: "mage_12",
    slot: "skillR",
    cooldownMs: 16000,
    effectType: "ultimate"
  },
  mage_13: {
    id: "mage_13",
    slot: "skillR",
    cooldownMs: 28000,
    effectType: "mage_time_astrolabe"
  },
  mage_14: {
    id: "mage_14",
    slot: "skillR",
    cooldownMs: 28000,
    effectType: "mage_blood_altar"
  }
};

export function isRuntimeMageSkillId(skillId: ArenaCatalogSkillId | null): skillId is RuntimeMageSkillId {
  return Boolean(skillId && skillId in RUNTIME_MAGE_SKILLS);
}

export function getRuntimeMageSkill(skillId: ArenaCatalogSkillId | null) {
  return isRuntimeMageSkillId(skillId) ? RUNTIME_MAGE_SKILLS[skillId] : null;
}

export type MageCardinalDirection = "right" | "down" | "left" | "up";

export function getMageCardinalDirection(angle: number): MageCardinalDirection {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return "down";
  if (normalized >= 135 && normalized < 225) return "left";
  if (normalized >= 225 && normalized < 315) return "up";
  return "right";
}

/**
 * Exact world-space center of the Mage action orb at the neutral cast pose.
 * The offsets share the runtime character's +13 px body baseline.
 */
export function getMageStaffAnchor(
  player: { x: number; y: number; angle: number }
): { x: number; y: number } {
  const direction = getMageCardinalDirection(player.angle);
  if (direction === "left") return { x: player.x - 36, y: player.y - 35 };
  if (direction === "down") return { x: player.x + 30, y: player.y - 37 };
  if (direction === "up") return { x: player.x, y: player.y - 41 };
  return { x: player.x + 36, y: player.y - 35 };
}

export const MAGE_TARGET_TORSO_OFFSET_Y = -42;

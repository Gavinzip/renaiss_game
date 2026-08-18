import {
  COMBAT,
  getArenaSkillTelegraph,
  type ArenaCatalogSkillId,
  type ArenaSkillTelegraph
} from "@renaiss-game/shared";

export const MOBILE_AIM_DIRECTION_DEADZONE_PX = 6;
export const MOBILE_AIM_FULL_DRAG_PX = 96;

type MobileAimProjectionOptions = {
  dragX: number;
  dragY: number;
  fallbackAngle: number;
  skillId: ArenaCatalogSkillId | null;
  attack: boolean;
};

export type MobileAimProjection = {
  angle: number;
  distance: number;
};

export function resolveMobileAimProjection({
  dragX,
  dragY,
  fallbackAngle,
  skillId,
  attack
}: MobileAimProjectionOptions): MobileAimProjection {
  const dragDistance = Math.hypot(dragX, dragY);
  const dragAngle = dragDistance >= MOBILE_AIM_DIRECTION_DEADZONE_PX
    ? Math.atan2(dragY, dragX) * (180 / Math.PI)
    : fallbackAngle;

  if (attack) {
    return { angle: dragAngle, distance: COMBAT.mageBeamLength };
  }

  const telegraph = getArenaSkillTelegraph(skillId);
  if (!telegraph) {
    return { angle: dragAngle, distance: COMBAT.mageBeamLength };
  }

  const positionalRange = getPositionalAimRange(telegraph);
  if (positionalRange !== null) {
    return {
      angle: dragAngle,
      distance: positionalRange * Math.min(1, dragDistance / MOBILE_AIM_FULL_DRAG_PX)
    };
  }

  if (isSelfCenteredTelegraph(telegraph)) {
    return { angle: fallbackAngle, distance: 0 };
  }

  return {
    angle: dragAngle,
    distance: getDirectionalAimDistance(telegraph)
  };
}

function getPositionalAimRange(telegraph: ArenaSkillTelegraph) {
  switch (telegraph.kind) {
    case "target-lock":
      return telegraph.range;
    case "ground-area":
      return COMBAT.mageBeamLength;
    case "turret-ground-area":
      return telegraph.sourceRange;
    case "turret-auto-target":
    case "turret-status":
    case "turret-burst":
      return COMBAT.mageBeamLength;
    default:
      return null;
  }
}

function isSelfCenteredTelegraph(telegraph: ArenaSkillTelegraph) {
  return telegraph.kind === "self-area" ||
    telegraph.kind === "self-status" ||
    telegraph.kind === "turret-link" ||
    telegraph.kind === "turret-network";
}

function getDirectionalAimDistance(telegraph: ArenaSkillTelegraph) {
  switch (telegraph.kind) {
    case "line":
      return telegraph.length;
    case "dash":
      return telegraph.distance;
    case "deployment":
      return telegraph.distance;
    case "turret-cone":
      return telegraph.range;
    case "turret-line":
      return telegraph.length;
    default:
      return COMBAT.mageBeamLength;
  }
}

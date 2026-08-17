export type VillagePlayerDirection = "side" | "down" | "up";
export type VillagePlayerFacing = "left" | "right";
export type VillagePlayerWalkDirection = "south" | "south-east" | "east" | "north-east" | "north" | "north-west" | "west" | "south-west";

export interface VillagePlayerAnimationFrame {
  frameIndex: number;
  direction: VillagePlayerWalkDirection;
}

export interface VillagePlayerStepPose {
  width: number;
  height: number;
  originY: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowScaleX: number;
  shadowScaleY: number;
  shadowAlpha: number;
}

export const VILLAGE_PLAYER_DISPLAY = {
  width: 118,
  height: 138
} as const;

export const VILLAGE_PLAYER_ORIGIN_Y = 0.96;

const WALK_FRAME_MS = 118;
const WALK_FRAME_COUNT = 7;

export function getVillagePlayerWalkDirection(
  moveX: number,
  moveY: number,
  fallback: VillagePlayerWalkDirection
): VillagePlayerWalkDirection {
  if (moveX === 0 && moveY === 0) return fallback;

  const horizontalMagnitude = Math.abs(moveX);
  const verticalMagnitude = Math.abs(moveY);
  const horizontal = moveX < 0 ? "west" : "east";
  const vertical = moveY < 0 ? "north" : "south";
  const cardinalThreshold = Math.SQRT2 - 1;
  if (horizontalMagnitude <= verticalMagnitude * cardinalThreshold) return vertical;
  if (verticalMagnitude <= horizontalMagnitude * cardinalThreshold) return horizontal;
  return `${vertical}-${horizontal}` as VillagePlayerWalkDirection;
}

export function getVillagePlayerAnimationFrame(
  moving: boolean,
  direction: VillagePlayerWalkDirection,
  now: number
): VillagePlayerAnimationFrame {
  return {
    frameIndex: moving ? Math.floor(now / WALK_FRAME_MS) % WALK_FRAME_COUNT : 0,
    direction
  };
}

export function getVillagePlayerStepPose(moving: boolean, direction: VillagePlayerDirection, now: number): VillagePlayerStepPose {
  if (!moving) {
    return {
      width: VILLAGE_PLAYER_DISPLAY.width,
      height: VILLAGE_PLAYER_DISPLAY.height,
      originY: VILLAGE_PLAYER_ORIGIN_Y,
      shadowOffsetX: 0,
      shadowOffsetY: 3,
      shadowScaleX: 1,
      shadowScaleY: 1,
      shadowAlpha: 0.22
    };
  }

  const phase = Math.sin(now / 72);
  const footPlant = Math.abs(phase);
  const verticalMotion = direction === "up" ? 0.006 : 0.01;
  return {
    width: VILLAGE_PLAYER_DISPLAY.width * (1 + footPlant * 0.014),
    height: VILLAGE_PLAYER_DISPLAY.height * (1 - footPlant * 0.018),
    originY: VILLAGE_PLAYER_ORIGIN_Y + footPlant * verticalMotion,
    shadowOffsetX: direction === "side" ? phase * 1.4 : 0,
    shadowOffsetY: 3,
    shadowScaleX: 1 + footPlant * 0.06,
    shadowScaleY: 1 - footPlant * 0.03,
    shadowAlpha: 0.19 + footPlant * 0.05
  };
}

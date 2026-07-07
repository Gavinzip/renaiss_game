export type VillagePlayerDirection = "side" | "down" | "up";
export type VillagePlayerFacing = "left" | "right";

export interface VillagePlayerAnimationFrame {
  frameIndex: number;
  flipX: boolean;
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
const DOWN_WALK_FRAMES = [0, 1, 2] as const;
const SIDE_WALK_FRAMES = [4, 5, 6] as const;

export function getVillagePlayerAnimationFrame(
  _classId: "engineer",
  moving: boolean,
  direction: VillagePlayerDirection,
  facing: VillagePlayerFacing,
  now: number
): VillagePlayerAnimationFrame {
  if (!moving) {
    return {
      frameIndex: direction === "up" ? 3 : direction === "side" ? 4 : 0,
      flipX: direction === "side" && facing === "left"
    };
  }

  const step = Math.floor(now / WALK_FRAME_MS);
  if (direction === "side") {
    return {
      frameIndex: SIDE_WALK_FRAMES[step % SIDE_WALK_FRAMES.length],
      flipX: facing === "left"
    };
  }

  if (direction === "up") {
    return {
      frameIndex: 3,
      flipX: false
    };
  }

  return {
    frameIndex: DOWN_WALK_FRAMES[step % DOWN_WALK_FRAMES.length],
    flipX: false
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

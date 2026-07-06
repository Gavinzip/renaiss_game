import type { PlayerActionState } from "@renaiss-game/shared";
import { COMBAT_VFX_FRAME_COUNT, type WarriorAttackDirection } from "../assets/crops";

type MageActionFxLayer = "back" | "front";

export interface MageActionFxProfile {
  frame: number;
  layer: MageActionFxLayer;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  alpha: number;
}

export function shouldShowMageActionFx(action: PlayerActionState | null) {
  return action === "attack" || action === "skillQ" || action === "skillE" || action === "skillR";
}

export function getMageActionFxProfile(direction: WarriorAttackDirection, progress: number): MageActionFxProfile {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const pulse = Math.sin(clampedProgress * Math.PI);
  const frameProgress = Math.pow(clampedProgress, 0.68);
  const frame = Math.min(COMBAT_VFX_FRAME_COUNT - 1, Math.floor(frameProgress * COMBAT_VFX_FRAME_COUNT));
  const size = 42 + pulse * 16;
  const alpha = 0.74 + pulse * 0.24;

  if (direction === "left") {
    return { frame, layer: "front", x: -36, y: -48, width: size, height: size, angle: -10, alpha };
  }

  if (direction === "down") {
    return { frame, layer: "front", x: 30, y: -50, width: size * 0.96, height: size * 0.96, angle: 8, alpha };
  }

  if (direction === "up") {
    return { frame, layer: "back", x: 0, y: -54, width: size * 0.78, height: size * 0.78, angle: 0, alpha: alpha * 0.72 };
  }

  return { frame, layer: "front", x: 36, y: -48, width: size, height: size, angle: 10, alpha };
}

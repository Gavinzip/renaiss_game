import type { PlayerActionState } from "@renaiss-game/shared";
import {
  ABILITY_VFX_FRAME_COUNT,
  WARRIOR_VERTICAL_SLASH_FRAME_COUNT,
  type WarriorAttackDirection,
  type WarriorVerticalSlashDirection
} from "../assets/crops";

export type WarriorActionFxLayer = "back" | "front";
export type WarriorActionFxSource = "warriorSlash" | "verticalSlash" | "warriorCharge";

export interface WarriorActionFxProfile {
  source: WarriorActionFxSource;
  verticalDirection?: WarriorVerticalSlashDirection;
  frame: number;
  layer: WarriorActionFxLayer;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  flipX: boolean;
  alpha: number;
}

export function shouldShowWarriorActionFx(action: PlayerActionState | null) {
  return action === "attack" || action === "skillQ";
}

export function getWarriorActionFxProfile(action: PlayerActionState | null, direction: WarriorAttackDirection, progress: number): WarriorActionFxProfile {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (action === "skillQ") {
    return getWarriorChargeFxProfile(direction, clampedProgress);
  }

  return getWarriorMeleeFxProfile(direction, clampedProgress);
}

function getWarriorMeleeFxProfile(direction: WarriorAttackDirection, progress: number): WarriorActionFxProfile {
  if (direction === "down" || direction === "up") {
    return getWarriorVerticalMeleeFxProfile(direction, progress);
  }

  const strikeWindow = Math.max(0, Math.min(1, progress / 0.58));
  const pulse = Math.sin(strikeWindow * Math.PI);
  const alpha = Math.max(0, 0.62 + pulse * 0.34 - Math.max(0, progress - 0.66) * 2.6);
  const frame = selectSlashFrame(strikeWindow, 3, 8);

  if (direction === "left") {
    return {
      frame,
      source: "warriorSlash",
      layer: "front",
      x: -44,
      y: -27,
      width: 158 + pulse * 24,
      height: 88 + pulse * 12,
      angle: 0,
      flipX: true,
      alpha
    };
  }

  return {
    frame,
    source: "warriorSlash",
    layer: "front",
    x: 44,
    y: -27,
    width: 158 + pulse * 24,
    height: 88 + pulse * 12,
    angle: 0,
    flipX: false,
    alpha
  };
}

function getWarriorVerticalMeleeFxProfile(direction: "down" | "up", progress: number): WarriorActionFxProfile {
  const strikeWindow = Math.max(0, Math.min(1, progress / 0.44));
  const pulse = Math.sin(strikeWindow * Math.PI);
  const alpha = Math.max(0, 0.68 + pulse * 0.22 - Math.max(0, progress - 0.46) * 5.2);

  if (direction === "down") {
    const frame = selectVerticalSlashFrame(strikeWindow);
    return {
      frame,
      source: "verticalSlash",
      verticalDirection: "down",
      layer: "front",
      x: 0,
      y: 18,
      width: 138 + pulse * 12,
      height: 92 + pulse * 8,
      angle: 0,
      flipX: false,
      alpha: alpha * 0.98
    };
  }

  const frame = selectVerticalSlashFrame(strikeWindow);
  return {
    frame,
    source: "verticalSlash",
    verticalDirection: "up",
    layer: "front",
    x: 0,
    y: -92,
    width: 130 + pulse * 10,
    height: 80 + pulse * 7,
    angle: 0,
    flipX: false,
    alpha: alpha * 0.86
  };
}

function getWarriorChargeFxProfile(direction: WarriorAttackDirection, progress: number): WarriorActionFxProfile {
  const pulse = Math.sin(progress * Math.PI);
  const alpha = Math.max(0, 0.78 + pulse * 0.2 - Math.max(0, progress - 0.82) * 2.4);
  const frame = selectChargeFrame(progress);

  if (direction === "left") {
    return { frame, source: "warriorCharge", layer: "front", x: -74, y: -28, width: 224 + pulse * 36, height: 96 + pulse * 12, angle: 0, flipX: true, alpha };
  }

  if (direction === "down") {
    return { frame, source: "warriorCharge", layer: "front", x: 2, y: 19, width: 214 + pulse * 30, height: 90 + pulse * 12, angle: 90, flipX: false, alpha: alpha * 0.96 };
  }

  if (direction === "up") {
    return { frame, source: "warriorCharge", layer: "front", x: 0, y: -55, width: 210 + pulse * 30, height: 88 + pulse * 12, angle: -90, flipX: false, alpha: alpha * 0.92 };
  }

  return { frame, source: "warriorCharge", layer: "front", x: 74, y: -28, width: 224 + pulse * 36, height: 96 + pulse * 12, angle: 0, flipX: false, alpha };
}

function selectSlashFrame(progress: number, first: number, last: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  const visibleSpan = Math.max(1, last - first + 1);
  return Math.min(ABILITY_VFX_FRAME_COUNT - 1, first + Math.min(visibleSpan - 1, Math.floor(Math.pow(clamped, 0.58) * visibleSpan)));
}

function selectVerticalSlashFrame(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return Math.min(WARRIOR_VERTICAL_SLASH_FRAME_COUNT - 1, Math.floor(Math.pow(clamped, 0.62) * WARRIOR_VERTICAL_SLASH_FRAME_COUNT));
}

function selectChargeFrame(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  const frameMap = [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9];
  return frameMap[Math.min(frameMap.length - 1, Math.floor(clamped * frameMap.length))] ?? 1;
}

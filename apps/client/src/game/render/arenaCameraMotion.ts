import { frameRateIndependentAlpha } from "./frameRate";

export interface ArenaCameraPoint {
  x: number;
  y: number;
}

export interface ArenaCameraMove {
  x: number;
  y: number;
}

interface AdvanceArenaCameraFocusOptions {
  current: ArenaCameraPoint | null;
  renderedPlayer: ArenaCameraPoint;
  move: ArenaCameraMove;
  moveSpeed: number;
  sprintMultiplier: number;
  sprinting: boolean;
  movementLocked: boolean;
  deltaMs: number;
}

export const DESKTOP_ARENA_CAMERA_ZOOM = 0.82;
// Landscape phones need more surrounding combat context than desktop-sized
// controls leave visible. Keep this independent from desktop presentation.
export const TOUCH_ARENA_CAMERA_ZOOM = 0.76;

const MOVE_DEADZONE = 0.08;
const MAX_CAMERA_LEAD_PX = 16;
const CAMERA_FOCUS_SNAP_DISTANCE_PX = 160;

export function isCoarsePointerViewport() {
  return typeof window !== "undefined" && window.matchMedia("(any-pointer: coarse)").matches;
}

export function getArenaCameraZoom(coarsePointer: boolean) {
  return coarsePointer ? TOUCH_ARENA_CAMERA_ZOOM : DESKTOP_ARENA_CAMERA_ZOOM;
}

/**
 * Pixel art must land on whole screen pixels. Touch cameras move directly at
 * render cadence, so their world scroll needs to be quantized after zoom is
 * applied or the tile sampling phase changes on every frame.
 */
export function snapArenaCameraScrollToScreenPixel(point: ArenaCameraPoint, zoom: number): ArenaCameraPoint {
  const safeZoom = Math.max(0.01, zoom);
  return {
    x: Math.round(point.x * safeZoom) / safeZoom,
    y: Math.round(point.y * safeZoom) / safeZoom
  };
}

/**
 * Keeps the local camera moving at render cadence while the authoritative
 * player snapshots continue to arrive at the server broadcast rate. The lead
 * is deliberately small and is continuously reconciled to the rendered player;
 * it never changes gameplay position or collision state.
 */
export function advanceArenaCameraFocus({
  current,
  renderedPlayer,
  move,
  moveSpeed,
  sprintMultiplier,
  sprinting,
  movementLocked,
  deltaMs
}: AdvanceArenaCameraFocusOptions): ArenaCameraPoint {
  if (
    !current ||
    !Number.isFinite(current.x) ||
    !Number.isFinite(current.y) ||
    Math.hypot(current.x - renderedPlayer.x, current.y - renderedPlayer.y) > CAMERA_FOCUS_SNAP_DISTANCE_PX
  ) {
    return { ...renderedPlayer };
  }

  const moveMagnitude = Math.hypot(move.x, move.y);
  const movementActive = !movementLocked && moveMagnitude > MOVE_DEADZONE;
  const boundedDeltaSeconds = Math.max(0, Math.min(50, deltaMs)) / 1000;
  const speed = Math.max(0, moveSpeed) * (sprinting ? Math.max(1, sprintMultiplier) : 1);
  const unitX = movementActive ? move.x / moveMagnitude : 0;
  const unitY = movementActive ? move.y / moveMagnitude : 0;

  const predictedX = current.x + unitX * speed * boundedDeltaSeconds;
  const predictedY = current.y + unitY * speed * boundedDeltaSeconds;
  const reconciliationAlpha = frameRateIndependentAlpha(movementActive ? 0.18 : 0.24, deltaMs);
  let nextX = predictedX + (renderedPlayer.x - predictedX) * reconciliationAlpha;
  let nextY = predictedY + (renderedPlayer.y - predictedY) * reconciliationAlpha;

  const leadX = nextX - renderedPlayer.x;
  const leadY = nextY - renderedPlayer.y;
  const leadDistance = Math.hypot(leadX, leadY);
  if (leadDistance > MAX_CAMERA_LEAD_PX) {
    const leadScale = MAX_CAMERA_LEAD_PX / leadDistance;
    nextX = renderedPlayer.x + leadX * leadScale;
    nextY = renderedPlayer.y + leadY * leadScale;
  }

  return { x: nextX, y: nextY };
}

export const MOBILE_ARENA_CONTROL_IDS = [
  "joystick",
  "skillF",
  "skillQ",
  "skillE",
  "skillR",
  "attack"
] as const;

export type MobileArenaControlId = (typeof MOBILE_ARENA_CONTROL_IDS)[number];

export interface MobileArenaControlPosition {
  x: number;
  y: number;
}

export type MobileArenaControlLayout = Partial<
  Record<MobileArenaControlId, MobileArenaControlPosition>
>;

interface MobileArenaControlViewport {
  width: number;
  height: number;
}

interface MobileArenaControlBounds {
  width: number;
  height: number;
}

const STORAGE_KEY = "renaiss.arena.mobile-controls.v1";
const EDGE_GUTTER_PX = 8;

export function loadMobileArenaControlLayout(): MobileArenaControlLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return MOBILE_ARENA_CONTROL_IDS.reduce<MobileArenaControlLayout>((layout, id) => {
      const position = parsed[id];
      if (isMobileArenaControlPosition(position)) {
        layout[id] = position;
      }
      return layout;
    }, {});
  } catch {
    return {};
  }
}

export function saveMobileArenaControlLayout(layout: MobileArenaControlLayout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

export function clampMobileArenaControlPosition(
  clientX: number,
  clientY: number,
  viewport: MobileArenaControlViewport,
  controlBounds: MobileArenaControlBounds
): MobileArenaControlPosition {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const halfWidth = Math.max(0, controlBounds.width / 2);
  const halfHeight = Math.max(0, controlBounds.height / 2);
  const minX = Math.min(width / 2, halfWidth + EDGE_GUTTER_PX);
  const maxX = Math.max(width / 2, width - halfWidth - EDGE_GUTTER_PX);
  const minY = Math.min(height / 2, halfHeight + EDGE_GUTTER_PX);
  const maxY = Math.max(height / 2, height - halfHeight - EDGE_GUTTER_PX);

  return {
    x: clamp(clientX, minX, maxX) / width,
    y: clamp(clientY, minY, maxY) / height
  };
}

function isMobileArenaControlPosition(value: unknown): value is MobileArenaControlPosition {
  if (!value || typeof value !== "object") return false;
  const position = value as Partial<MobileArenaControlPosition>;
  return isNormalizedCoordinate(position.x) && isNormalizedCoordinate(position.y);
}

function isNormalizedCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

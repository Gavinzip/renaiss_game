import {
  CLASS_ORDER,
  getDefaultArenaLoadout,
  isArenaLoadout,
  type ArenaLoadout,
  type ClassId
} from "@renaiss-game/shared";

const STORAGE_KEY = "renaiss:arena-loadouts:v2";

export type ArenaLoadouts = Record<ClassId, ArenaLoadout>;

export function createDefaultArenaLoadouts(): ArenaLoadouts {
  return Object.fromEntries(
    CLASS_ORDER.map((classId) => [classId, getDefaultArenaLoadout(classId)])
  ) as ArenaLoadouts;
}

export function loadArenaLoadouts(): ArenaLoadouts {
  const defaults = createDefaultArenaLoadouts();
  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<Record<ClassId, unknown>>
      | null;
    if (!stored) {
      return defaults;
    }
    for (const classId of CLASS_ORDER) {
      if (isArenaLoadout(stored[classId])) {
        defaults[classId] = { ...stored[classId] };
      }
    }
  } catch {
    return defaults;
  }
  return defaults;
}

export function saveArenaLoadouts(loadouts: ArenaLoadouts) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
  } catch {
    // The current session still keeps its configured loadouts in Zustand.
  }
}

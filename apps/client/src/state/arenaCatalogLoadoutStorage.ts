import {
  CLASS_ORDER,
  createEmptyArenaCatalogLoadouts,
  isArenaCatalogLoadout,
  type ArenaCatalogLoadouts,
  type ClassId
} from "@renaiss-game/shared";

const STORAGE_KEY = "renaiss:arena-catalog-loadouts:v3";

export function createDefaultArenaCatalogLoadouts(): ArenaCatalogLoadouts {
  return createEmptyArenaCatalogLoadouts();
}

export function loadArenaCatalogLoadouts(): ArenaCatalogLoadouts {
  const defaults = createDefaultArenaCatalogLoadouts();
  if (typeof window === "undefined") return defaults;

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<Record<ClassId, unknown>>
      | null;
    if (!stored) return defaults;
    for (const classId of CLASS_ORDER) {
      if (isArenaCatalogLoadout(classId, stored[classId])) {
        defaults[classId] = {
          skillQ: stored[classId].skillQ ?? defaults[classId].skillQ,
          skillE: stored[classId].skillE ?? defaults[classId].skillE,
          skillR: stored[classId].skillR ?? defaults[classId].skillR
        };
      }
    }
  } catch {
    return defaults;
  }
  return defaults;
}

export function saveArenaCatalogLoadouts(loadouts: ArenaCatalogLoadouts) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
}

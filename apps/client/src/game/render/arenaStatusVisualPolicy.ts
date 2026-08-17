import type { ArenaStatusId } from "@renaiss-game/shared";

export type ArenaStatusMaterial = "stun";

export const ARENA_STATUS_MATERIALS: Partial<
  Record<ArenaStatusId, ArenaStatusMaterial>
> = {
  stunned: "stun"
};

export const ARENA_SHIELD_PRESENTATION = {
  material: "shield",
  overheadLabel: false
} as const;

export function getArenaStatusPresentation(statusId: ArenaStatusId) {
  return {
    material: ARENA_STATUS_MATERIALS[statusId] ?? null,
    overheadLabel: true
  } as const;
}

export function getArenaStatusMaterial(statusId: ArenaStatusId) {
  return getArenaStatusPresentation(statusId).material;
}

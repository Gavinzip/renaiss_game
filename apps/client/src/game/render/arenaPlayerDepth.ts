import { WORLD, type DuelRealmState } from "@renaiss-game/shared";

export const ARENA_DUEL_REALM_BACKDROP_DEPTH = 5800;
export const ARENA_DUEL_REALM_BOUNDARY_DEPTH = 6100;
export const ARENA_DUEL_REALM_ACTOR_DEPTH = 6200;

export function getArenaPlayerRenderDepth(
  playerId: string,
  visualY: number,
  alive: boolean,
  duelRealm: DuelRealmState | null
) {
  if (duelRealm?.participantIds.includes(playerId)) {
    // Keep both duelists above the backdrop and its boundary while retaining
    // their relative foot-line ordering when they overlap each other.
    const ySort = Math.min(Math.max(visualY / WORLD.height, 0), 0.999);
    return ARENA_DUEL_REALM_ACTOR_DEPTH + ySort;
  }

  return visualY + (alive ? 20 : 24);
}

import type { ArenaGameMode } from "@renaiss-game/shared";
import { GameRoom } from "./GameRoom";

const MATCH_CAPACITY: Record<ArenaGameMode, number> = {
  free_for_all: 8,
  team_3v3: 6
};

export interface ArenaMatchSummary {
  id: string;
  mode: ArenaGameMode;
  capacity: number;
  players: number;
  bots: number;
}

interface ManagedArenaMatch extends ArenaMatchSummary {
  room: GameRoom;
}

/**
 * Owns ordinary public Arena rooms. Review/map-preview rooms remain isolated
 * from matchmaking and are managed by the server entrypoint.
 */
export class ArenaMatchRegistry {
  private readonly matches = new Map<GameRoom, ManagedArenaMatch>();
  private nextMatchNumber = 1;

  acquire(mode: ArenaGameMode, unavailableRooms: ReadonlySet<GameRoom> = new Set()) {
    const capacity = MATCH_CAPACITY[mode];
    const match = [...this.matches.values()]
      .filter((candidate) =>
        candidate.mode === mode &&
        !unavailableRooms.has(candidate.room) &&
        candidate.room.playerCount() < capacity
      )
      .sort((left, right) =>
        right.room.playerCount() - left.room.playerCount() ||
        left.id.localeCompare(right.id)
      )[0];
    return match?.room ?? this.create(mode, capacity).room;
  }

  rooms() {
    return [...this.matches.keys()];
  }

  releaseIfEmpty(room: GameRoom) {
    if (room.playerCount() === 0) {
      this.matches.delete(room);
    }
  }

  summaries(): ArenaMatchSummary[] {
    return [...this.matches.values()]
      .map((match) => ({
        id: match.id,
        mode: match.mode,
        capacity: match.capacity,
        players: match.room.playerCount(),
        bots: match.room.botCount()
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  totals(mode: ArenaGameMode) {
    return this.summaries()
      .filter((match) => match.mode === mode)
      .reduce(
        (totals, match) => ({
          rooms: totals.rooms + 1,
          players: totals.players + match.players,
          bots: totals.bots + match.bots
        }),
        { rooms: 0, players: 0, bots: 0 }
      );
  }

  private create(mode: ArenaGameMode, capacity: number) {
    const sequence = this.nextMatchNumber++;
    const match: ManagedArenaMatch = {
      id: `${mode === "team_3v3" ? "team" : "ffa"}-${sequence.toString().padStart(4, "0")}`,
      mode,
      capacity,
      players: 0,
      bots: 0,
      room: new GameRoom({ mode, humanCapacity: capacity })
    };
    this.matches.set(match.room, match);
    return match;
  }
}

export function arenaMatchCapacity(mode: ArenaGameMode) {
  return MATCH_CAPACITY[mode];
}

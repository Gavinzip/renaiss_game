import type {
  ArenaGameMode,
  ArenaTeamId,
  EngineerTurretKind
} from "./types";

export const ARENA_GAME_MODES: readonly ArenaGameMode[] = [
  "free_for_all",
  "team_3v3"
];

export const ARENA_TEAMS: readonly ArenaTeamId[] = ["red", "blue"];

export const ENGINEER_TURRET_KINDS: readonly EngineerTurretKind[] = [
  "mechanical",
  "magic_missile"
];

export function isArenaGameMode(value: unknown): value is ArenaGameMode {
  return ARENA_GAME_MODES.includes(value as ArenaGameMode);
}

export function isEngineerTurretKind(value: unknown): value is EngineerTurretKind {
  return ENGINEER_TURRET_KINDS.includes(value as EngineerTurretKind);
}

import type {
  ArenaStatusId,
  ArenaStatusState
} from "./generated/arenaProtocolV1";

export type {
  ArenaStatusId,
  ArenaStatusState
} from "./generated/arenaProtocolV1";

export const ARENA_STATUS_DEFINITIONS = {
  stunned: { tone: "negative", priority: 0 },
  silenced: { tone: "negative", priority: 1 },
  rooted: { tone: "negative", priority: 2 },
  dash_locked: { tone: "negative", priority: 3 },
  vulnerable: { tone: "negative", priority: 4 },
  marked: { tone: "negative", priority: 5 },
  poisoned: { tone: "negative", priority: 6 },
  slowed: { tone: "negative", priority: 7 },
  duel: { tone: "negative", priority: 8 },
  counter: { tone: "positive", priority: 10 },
  engineer_support: { tone: "positive", priority: 11 },
  dodging: { tone: "positive", priority: 12 },
  concealed: { tone: "positive", priority: 13 },
  enchanted_attacks: { tone: "positive", priority: 14 },
  steady_aim: { tone: "positive", priority: 15 },
  focus_lens: { tone: "positive", priority: 16 },
  attack_boost: { tone: "positive", priority: 17 },
  speed_boost: { tone: "positive", priority: 18 }
} as const;

export type ArenaStatusTone = (typeof ARENA_STATUS_DEFINITIONS)[ArenaStatusId]["tone"];

export function getArenaStatusTone(statusId: ArenaStatusId): ArenaStatusTone {
  return ARENA_STATUS_DEFINITIONS[statusId].tone;
}

export function compareArenaStatuses(left: ArenaStatusState, right: ArenaStatusState) {
  return ARENA_STATUS_DEFINITIONS[left.id].priority - ARENA_STATUS_DEFINITIONS[right.id].priority;
}

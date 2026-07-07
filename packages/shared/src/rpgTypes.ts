export const RPG_ELEMENTS = ["water", "fire", "grass", "dark", "light"] as const;
export type RpgElement = (typeof RPG_ELEMENTS)[number];

export const RPG_SKILL_TIERS = ["basic", "intermediate", "ultimate"] as const;
export type RpgSkillTier = (typeof RPG_SKILL_TIERS)[number];

export const RPG_AI_DIFFICULTIES = ["normal", "hard", "leader"] as const;
export type RpgAiDifficulty = (typeof RPG_AI_DIFFICULTIES)[number];

export type RpgTarget =
  | "singleEnemy"
  | "allEnemies"
  | "self"
  | "singleAlly"
  | "allAllies";

export type RpgEffectTarget = "target" | "self" | "team";

export type RpgStatusId =
  | "burn"
  | "poison"
  | "stun"
  | "guard"
  | "regen";

export type RpgAnimationStyle =
  | "strike"
  | "projectile"
  | "beam"
  | "burst"
  | "rain"
  | "aura"
  | "wave"
  | "field"
  | "summon"
  | "card";

export interface RpgElementMeta {
  id: RpgElement;
  label: string;
  shortLabel: string;
  role: string;
  color: string;
  accent: string;
  particle: string;
}

export interface RpgMoveEffect {
  target: RpgEffectTarget;
  status?: RpgStatusId;
  duration?: number;
  power?: number;
  heal?: number;
  shield?: number;
  cleanse?: boolean;
  selfDamage?: number;
  energy?: number;
}

export interface RpgMoveAnimation {
  key: string;
  name: string;
  style: RpgAnimationStyle;
  palette: readonly string[];
  frameCount: number;
  targetPattern: RpgTarget;
  notes: string;
}

export interface RpgMove {
  id: string;
  element: RpgElement;
  tier: RpgSkillTier;
  tierIndex: 1 | 2 | 3;
  slot: number;
  name: string;
  description: string;
  target: RpgTarget;
  power: number;
  speed: number;
  energyCost: number;
  tags: readonly string[];
  effects: readonly RpgMoveEffect[];
  animation: RpgMoveAnimation;
}

export interface RpgPetAnimationSet {
  spriteKey: string;
  idle: string;
  walk: string;
  attack: string;
  hit: string;
  faint: string;
  follow: string;
}

export interface RpgPetDefinition {
  id: string;
  element: RpgElement;
  name: string;
  title: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  startingMoveIds: readonly string[];
  animationSet: RpgPetAnimationSet;
  cardBackKey: string;
}

export interface RpgBattleStatus {
  id: RpgStatusId;
  remainingTurns: number;
  power: number;
  sourceMoveId: string;
}

export interface RpgBattlePetState {
  id: string;
  definitionId: string;
  ownerId: string;
  side: "left" | "right";
  slot: 0 | 1 | 2;
  element: RpgElement;
  name: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  maxEnergy: number;
  moveIds: readonly string[];
  statuses: RpgBattleStatus[];
  defeated: boolean;
}

export interface RpgBattleState {
  id: string;
  turn: number;
  activeSide?: "left" | "right";
  phase: "selecting" | "resolving" | "finished";
  left: RpgBattlePetState[];
  right: RpgBattlePetState[];
  winner: "left" | "right" | "draw" | null;
  log: RpgBattleLogEntry[];
}

export interface RpgBattleAction {
  actorId: string;
  moveId: string;
  targetId?: string;
}

export interface RpgBattleLogEntry {
  turn: number;
  phaseSide?: "left" | "right";
  type:
    | "turnStart"
    | "status"
    | "action"
    | "damage"
    | "heal"
    | "shield"
    | "defeat"
    | "invalid"
    | "victory";
  actorId?: string;
  targetId?: string;
  moveId?: string;
  amount?: number;
  message: string;
}

export interface RpgSkillTicket {
  id: string;
  label: string;
  description: string;
  cardPriceBand: "low" | "middle" | "high";
  drawCount: number;
  allowedTiers: readonly RpgSkillTier[];
  highTierGuarantee: boolean;
}

export interface RpgRosterSelection {
  definitionId: string;
  nickname?: string;
  moveIds?: readonly string[];
}

export interface RpgVersusJoinRequest {
  sessionId: string;
  playerName?: string;
  roomCode?: string;
  roster?: readonly RpgRosterSelection[];
}

export interface RpgVersusJoinAccepted {
  roomCode: string;
  playerId: string;
  playerSide: "left" | "right";
}

export interface RpgVersusSubmitActions {
  roomCode: string;
  actions: RpgBattleAction[];
}

export interface RpgVersusRematchRequest {
  roomCode: string;
}

export interface RpgVersusSnapshot {
  roomCode: string;
  playerId: string;
  playerSide: "left" | "right";
  playerName: string;
  opponentName: string | null;
  opponentConnected: boolean;
  status: "waiting" | "selecting" | "opponentDisconnected" | "finished";
  battle: RpgBattleState | null;
  submittedPlayerIds: string[];
  rematchRequestedPlayerIds: string[];
  message: string | null;
}

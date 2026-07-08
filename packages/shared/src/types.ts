export type ClassId = "warrior" | "archer" | "engineer" | "mage";

export type SkillKey = "skillQ" | "skillE" | "skillR";

export type PlayerActionState = "attack" | "skillQ" | "skillE" | "skillR";

export type ProjectileType =
  | "arrow"
  | "magic_ball"
  | "turret_shot"
  | "turret_shot_boosted";

export type EffectType =
  | "attack_arc"
  | "attack_boost"
  | "dash"
  | "roll"
  | "shield"
  | "root"
  | "root_cast"
  | "turret_deploy"
  | "repulsor_pulse"
  | "beam"
  | "burst"
  | "ultimate"
  | "heal_pickup"
  | "stun"
  | "death"
  | "turret_death"
  | "reflect"
  | "damage_number"
  | "reflect_damage"
  | "blocked_hit";

export interface PlayerInput {
  moveX: number;
  moveY: number;
  angle: number;
  aimX: number;
  aimY: number;
  attack: boolean;
  sprint: boolean;
  skillQ: boolean;
  skillE: boolean;
  skillR: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  classId: ClassId;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  score: number;
  killStreak: number;
  alive: boolean;
  respawnAt: number;
  attacking: boolean;
  action: PlayerActionState | null;
  actionStartedAt: number;
  actionEndsAt: number;
  shielded: boolean;
  attackBoosted: boolean;
  attackBoostEndsAt: number;
  spawnProtected: boolean;
  rooted: boolean;
  stunned: boolean;
  sprinting: boolean;
  bot: boolean;
  cooldowns: Record<SkillKey, number>;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  type: ProjectileType;
  x: number;
  y: number;
  angle: number;
}

export interface TurretState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  boosted: boolean;
}

export interface HealthPackState {
  id: string;
  x: number;
  y: number;
  imageIndex: number;
}

export interface AttackBoostPackState {
  id: string;
  x: number;
  y: number;
}

export interface EffectState {
  id: string;
  type: EffectType;
  ownerId?: string;
  classId?: ClassId;
  x: number;
  y: number;
  angle: number;
  radius: number;
  startedAt: number;
  duration: number;
  value?: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  killStreak: number;
  classId: ClassId;
  bot: boolean;
}

export type CombatEventType = "join" | "kill" | "assist" | "streak" | "ultimate" | "turret" | "heal" | "boost" | "control" | "round";

export interface CombatEvent {
  id: string;
  type: CombatEventType;
  at: number;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  participantIds?: string[];
  classId?: ClassId;
  scoreDelta?: number;
  streak?: number;
  message: string;
}

export type RoundPhase = "playing" | "finished";

export interface RoundState {
  phase: RoundPhase;
  roundNumber: number;
  startedAt: number;
  endsAt: number;
  nextRoundAt: number | null;
  durationMs: number;
  restartMs: number;
  scoreLimit: number;
  winner: LeaderboardEntry | null;
}

export interface GameSnapshot {
  serverTime: number;
  selfId: string | null;
  round: RoundState;
  players: PublicPlayer[];
  projectiles: ProjectileState[];
  turrets: TurretState[];
  healthPacks: HealthPackState[];
  attackBoostPacks: AttackBoostPackState[];
  effects: EffectState[];
  events: CombatEvent[];
  leaderboard: LeaderboardEntry[];
}

export interface JoinRequest {
  name: string;
  classId: ClassId;
  mapDraft?: {
    props: import("./map").MapProp[];
  };
  review?: {
    noBots?: boolean;
    fixedSpawn?: boolean;
    spawnPoint?: {
      x: number;
      y: number;
    };
  };
}

export interface ClassSwitchRequest {
  classId: ClassId;
}

export interface JoinAccepted {
  playerId: string;
  world: {
    width: number;
    height: number;
    villageName: string;
  };
}

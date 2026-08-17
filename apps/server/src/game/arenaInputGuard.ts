import {
  WORLD,
  isEngineerTurretKind,
  type PlayerInput
} from "@renaiss-game/shared";

const INPUTS_PER_SECOND = 60;
const INPUT_BURST = 90;

interface InputBucket {
  tokens: number;
  updatedAt: number;
}

export interface ArenaInputSecurityMetrics {
  accepted: number;
  rejectedMalformed: number;
  rejectedOutOfOrder: number;
  rejectedRateLimited: number;
  rejectedUnjoined: number;
}

/** Runtime boundary for untrusted Socket.IO input payloads. */
export class ArenaInputGuard {
  private readonly buckets = new Map<string, InputBucket>();
  private readonly lastSequences = new Map<string, number>();
  private readonly counters: ArenaInputSecurityMetrics = {
    accepted: 0,
    rejectedMalformed: 0,
    rejectedOutOfOrder: 0,
    rejectedRateLimited: 0,
    rejectedUnjoined: 0
  };

  accept(socketId: string, value: unknown, joined: boolean, now = Date.now()) {
    if (!joined) {
      this.counters.rejectedUnjoined += 1;
      return null;
    }
    const input = sanitizeArenaPlayerInput(value);
    if (!input) {
      this.counters.rejectedMalformed += 1;
      return null;
    }
    if (!this.consume(socketId, now)) {
      this.counters.rejectedRateLimited += 1;
      return null;
    }
    if (input.sequence !== undefined) {
      const previousSequence = this.lastSequences.get(socketId);
      if (previousSequence !== undefined && input.sequence <= previousSequence) {
        this.counters.rejectedOutOfOrder += 1;
        return null;
      }
      this.lastSequences.set(socketId, input.sequence);
    }
    this.counters.accepted += 1;
    return input;
  }

  disconnect(socketId: string) {
    this.buckets.delete(socketId);
    this.lastSequences.delete(socketId);
  }

  metrics(): ArenaInputSecurityMetrics {
    return { ...this.counters };
  }

  private consume(socketId: string, now: number) {
    const bucket = this.buckets.get(socketId) ?? {
      tokens: INPUT_BURST,
      updatedAt: now
    };
    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(INPUT_BURST, bucket.tokens + elapsedSeconds * INPUTS_PER_SECOND);
    bucket.updatedAt = now;
    if (bucket.tokens < 1) {
      this.buckets.set(socketId, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(socketId, bucket);
    return true;
  }
}

export function sanitizeArenaPlayerInput(value: unknown): PlayerInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<Record<keyof PlayerInput, unknown>>;
  const numericKeys = ["moveX", "moveY", "angle", "aimX", "aimY"] as const;
  const booleanKeys = [
    "attack",
    "sprint",
    "skillF",
    "skillQ",
    "skillE",
    "skillR"
  ] as const;
  if (numericKeys.some((key) => !isFiniteNumber(candidate[key]))) return null;
  if (booleanKeys.some((key) => typeof candidate[key] !== "boolean")) return null;
  if (
    candidate.sequence !== undefined &&
    (!Number.isSafeInteger(candidate.sequence) || (candidate.sequence as number) < 0)
  ) {
    return null;
  }
  if (
    candidate.engineerTurretKind !== undefined &&
    !isEngineerTurretKind(candidate.engineerTurretKind)
  ) {
    return null;
  }

  const angle = candidate.angle as number;
  return {
    ...(candidate.sequence === undefined ? {} : { sequence: candidate.sequence as number }),
    moveX: clamp(candidate.moveX as number, -1, 1),
    moveY: clamp(candidate.moveY as number, -1, 1),
    angle: ((angle % 360) + 360) % 360,
    aimX: clamp(candidate.aimX as number, 0, WORLD.width),
    aimY: clamp(candidate.aimY as number, 0, WORLD.height),
    attack: candidate.attack as boolean,
    sprint: candidate.sprint as boolean,
    skillF: candidate.skillF as boolean,
    skillQ: candidate.skillQ as boolean,
    skillE: candidate.skillE as boolean,
    skillR: candidate.skillR as boolean,
    ...(candidate.engineerTurretKind === undefined
      ? {}
      : { engineerTurretKind: candidate.engineerTurretKind })
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

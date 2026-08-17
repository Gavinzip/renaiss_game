import type { ClassId } from "@renaiss-game/shared";
import {
  ARENA_CHARACTER_RUNTIME_TEXTURE_SCALE,
  ARENA_CHARACTER_RUNTIME_WALK_CELL
} from "../assets/arenaCharacterTextureProfile";

export const ARENA_WEB_PLAYER_PRESENTATION_SCHEMA_VERSION = 2;
export const ARENA_WEB_PLAYER_FALLBACK_USED = false;

export const ARENA_WEB_EIGHT_DIRECTIONS = [
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east"
] as const;

export const ARENA_WEB_FOUR_DIRECTIONS = ["right", "down", "left", "up"] as const;

export const ARENA_WEB_PLAYER = {
  bodyBaseY: 13,
  displaySize: { width: 88, height: 104 },
  origin: { x: 0.5, y: 0.9 },
  movementVisualGraceMs: 92,
  walkFrameDurationMs: 118,
  walkFrameCount: 7,
  runtimeTextureScale: ARENA_CHARACTER_RUNTIME_TEXTURE_SCALE,
  normalizedWalkCell: ARENA_CHARACTER_RUNTIME_WALK_CELL
} as const;

export const ARENA_WEB_ARCHER_FULL_DRAW = {
  displaySize: { width: 131, height: 131 },
  baselineOffsetY: 5,
  upwardHudOffsetY: -22,
  movingFrameDurationMs: 92
} as const;

export const ARENA_WEB_MAGE_STAFF_CAST = {
  displaySize: {
    width: ARENA_WEB_PLAYER.displaySize.width * (256 / 165),
    height: ARENA_WEB_PLAYER.displaySize.height * (256 / 194)
  },
  origin: { x: 0.5, y: 224 / 256 }
} as const;

type ArenaWebBasicAttackContract = {
  classId: ClassId;
  sourceAsset: string;
  movingSourceAsset?: string;
  directionOrder: readonly string[];
  frameCount: number;
  movingFrameCount?: number;
  selection: Readonly<Record<string, unknown>>;
  sourceCell: { readonly width: number; readonly height: number };
  displaySize: { readonly width: number; readonly height: number };
  origin: { readonly x: number; readonly y: number };
  baselineOffsetY?: number;
};

export const ARENA_WEB_BASIC_ATTACKS = [
  {
    classId: "warrior",
    sourceAsset: "/assets/generated/characters/new-compatible/warrior/melee-m1-8dir.png",
    directionOrder: ARENA_WEB_EIGHT_DIRECTIONS,
    frameCount: 5,
    selection: { kind: "authoritative-progress", breakpoints: [0.2, 0.4, 0.6, 0.8] },
    sourceCell: { width: 165, height: 194 },
    displaySize: ARENA_WEB_PLAYER.displaySize,
    origin: ARENA_WEB_PLAYER.origin
  },
  {
    classId: "archer",
    sourceAsset: "/assets/generated/characters/new-compatible/archer/standing-full-draw-8dir.png",
    movingSourceAsset: "/assets/generated/characters/new-compatible/archer/moving-full-draw-8dir.png",
    directionOrder: ARENA_WEB_EIGHT_DIRECTIONS,
    frameCount: 1,
    movingFrameCount: 5,
    selection: { kind: "standing-hold-or-moving-clock", movingFrameDurationMs: 92 },
    sourceCell: { width: 256, height: 256 },
    displaySize: ARENA_WEB_ARCHER_FULL_DRAW.displaySize,
    origin: ARENA_WEB_PLAYER.origin,
    baselineOffsetY: ARENA_WEB_ARCHER_FULL_DRAW.baselineOffsetY
  },
  {
    classId: "engineer",
    sourceAsset: "/assets/generated/engineer-action-sprites.png",
    directionOrder: ARENA_WEB_FOUR_DIRECTIONS,
    frameCount: 3,
    selection: { kind: "authoritative-progress", breakpoints: [0.22, 0.68] },
    sourceCell: { width: 165, height: 194 },
    displaySize: ARENA_WEB_PLAYER.displaySize,
    origin: ARENA_WEB_PLAYER.origin
  },
  {
    classId: "mage",
    sourceAsset: "/assets/generated/characters/new-compatible/mage/staff-cast-8dir.png",
    directionOrder: [
      "south",
      "south-east",
      "east",
      "north-east",
      "north",
      "north-west",
      "west",
      "south-west"
    ],
    frameCount: 3,
    selection: { kind: "authoritative-progress", breakpoints: [0.22, 0.68] },
    sourceCell: { width: 256, height: 256 },
    displaySize: ARENA_WEB_MAGE_STAFF_CAST.displaySize,
    origin: ARENA_WEB_MAGE_STAFF_CAST.origin
  }
] as const satisfies ReadonlyArray<ArenaWebBasicAttackContract>;

export const ARENA_WEB_PLAYER_STATES = {
  hit: {
    flashDurationMs: 240,
    recoilDistance: 7,
    horizontalShakeAmplitude: 3.2,
    horizontalShakePeriodMs: 10,
    impactDurationMs: 320,
    impactFrameCount: 12,
    impactPosition: { x: 0, y: ARENA_WEB_PLAYER.bodyBaseY - 18 },
    impactStartSize: { width: 112, height: 96 },
    impactEndSize: { width: 130, height: 110 },
    impactStartAlpha: 0.92,
    impactEndAlpha: 0.44,
    impactAngleAmplitudeDegrees: 4,
    impactAnglePeriodMs: 40
  },
  death: {
    bodyFrameSource: "current-direction-locomotion-frame-0",
    fallDurationMs: 280,
    fallAngleDegrees: 74,
    bodyTint: "#6d605a",
    bodyAlpha: 0.68,
    bodyStartPosition: { x: 0, y: ARENA_WEB_PLAYER.bodyBaseY + 20 },
    bodyEndPosition: { x: 0, y: ARENA_WEB_PLAYER.bodyBaseY + 28 },
    bodyDisplaySize: { width: 104, height: 82 },
    runeDisplaySize: { width: 158, height: 112 }
  },
  respawn: {
    resetVisualPositionToAuthoritativePosition: true,
    resetDownedTimestamp: true,
    clearHitImpact: true,
    selectCurrentExactLocomotionFrame: true
  }
} as const;

export function getArenaWebEightDirection(angleDegrees: number) {
  const normalized = ((angleDegrees % 360) + 360) % 360;
  return ARENA_WEB_EIGHT_DIRECTIONS[
    Math.round(normalized / 45) % ARENA_WEB_EIGHT_DIRECTIONS.length
  ];
}

export function getArenaWebFourDirection(angleDegrees: number) {
  const normalized = ((angleDegrees % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return "down" as const;
  if (normalized >= 135 && normalized < 225) return "left" as const;
  if (normalized >= 225 && normalized < 315) return "up" as const;
  return "right" as const;
}

export function getArenaWebThreeFrameAttackIndex(progress: number) {
  if (progress < 0.22) return 0;
  if (progress < 0.68) return 1;
  return 2;
}

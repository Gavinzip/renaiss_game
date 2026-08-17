import Phaser from "phaser";
import type { ArenaCatalogSkillId } from "@renaiss-game/shared";
import manifestJson from "./arenaSkillRuntimeManifest.json";

export type ArenaSkillRuntimeRenderKind =
  | "overlay"
  | "projectile"
  | "field"
  | "segment"
  | "body";

export type ArenaSkillRuntimeAnchor =
  | "effect"
  | "owner"
  | "owner_forward"
  | "target"
  | "path";

export interface ArenaSkillRuntimePathCore {
  kind: "segment" | "effect-to-owner" | "repeated-links";
  outerColor: number;
  outerWidth: number;
  innerColor: number;
  innerWidth: number;
  ownerOffset?: [number, number];
  activeProgress?: [number, number];
  moteColor?: number;
  moteSize?: number;
  moteTravelProgress?: [number, number];
  targetOutwardOffset?: [number, number];
  linkSpacing?: number;
  linkLength?: number;
  linkWidth?: number;
}

export interface ArenaSkillRuntimeVisualContract {
  enabled?: boolean;
  renderKind: ArenaSkillRuntimeRenderKind;
  anchor: ArenaSkillRuntimeAnchor;
  referenceSize: [number, number];
  referenceOffset: [number, number];
  referenceActorHeight: number;
  layer: "ground" | "unit" | "air";
  rotate: boolean;
  blendMode: "normal" | "add";
  radiusAspect: number | null;
  radiusWidthMultiplier: number | null;
  sourceAngleDegrees: number;
  projectileSize: [number, number] | null;
  pathCore: ArenaSkillRuntimePathCore | null;
  projectileLaunchScale: boolean;
  fixedDisplay: boolean;
}

export const ARENA_RUNTIME_ACTOR_DISPLAY_HEIGHT = 104;

export type ArenaSkillRuntimeDirection =
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west"
  | "north"
  | "north-east";

export interface ArenaSkillRuntimeDirectionalLayout {
  directionOrder: ArenaSkillRuntimeDirection[];
  framesPerDirection: number;
  frameDurationsMs: number[];
}

export interface ArenaSkillRuntimeFrameAsset {
  file: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDurationsMs?: number[];
  unionBounds: [number, number, number, number];
  sourcePath: string;
  sourceSha256: string;
  sourceFile?: string;
  outputSha256: string;
  semanticAnchor?: [number, number];
  grid?: {
    columns: number;
    rows: number;
  };
  directionalLayout?: ArenaSkillRuntimeDirectionalLayout;
  displayHeightMultiplier?: number;
}

export interface ArenaSkillRuntimePlayback {
  introFrameIndices: number[];
  loopFrameIndices: number[];
  recoveryFrameIndices: number[];
}

export interface ArenaSkillRuntimeTimedFrameAsset
  extends ArenaSkillRuntimeFrameAsset {
  frameDurationMs: number;
  playback?: ArenaSkillRuntimePlayback;
}

interface ArenaSkillRuntimeEntryMetadata {
  skillId: ArenaCatalogSkillId;
  classId: "warrior" | "archer" | "engineer" | "mage";
  name: string;
  persistent: boolean;
  previewSha256: string;
  visualContract: ArenaSkillRuntimeVisualContract;
  runtimeMode?: "server-state";
  actionBody?: ArenaSkillRuntimeFrameAsset;
  projectileAsset?: ArenaSkillRuntimeFrameAsset;
  impactAsset?: ArenaSkillRuntimeFrameAsset;
  alternateEffectAsset?: ArenaSkillRuntimeFrameAsset;
  tetherPresentation?: {
    sourceFrameIndex: number;
    leftCapSourcePx: number;
    rightCapSourcePx: number;
    displayHeight: number;
    stretch: "three-slice-distance";
  };
  tetherAsset?: {
    file: string;
    width: number;
    height: number;
    sourcePath: string;
    sourceSha256: string;
    sourceFrameIndex: number;
    sourceFrameBounds: [number, number, number, number];
    safeCropBounds: [number, number, number, number];
    outputSha256: string;
    leftCapSourcePx: number;
    rightCapSourcePx: number;
    displayHeight: number;
    stretch: "three-slice-distance";
    acceptedAnimationId: string;
    pixelSafetyMargin: number;
    fallbackUsed: false;
  };
  candidateOrigin?: string;
  acceptedAnimationId?: string;
  statePresentation?:
    | {
        kind: "remaining-charges";
        playerField: "enchantedMeleeHitsRemaining";
        position: "above-head";
      }
    | {
        kind: "concealment";
        playerField: "concealmentEndsAt";
        position: "self-body";
        bodyAlpha: number;
        outlineTint: string;
        outlineAlpha: [number, number];
        outlineExpansionPx: number;
      };
  contractSource?: string;
  configPreviewSourcePath?: string;
  configPreviewSourceSha256?: string;
  configPreviewOutputSha256?: string;
  runtimePhases?: Array<{
    role: "projectile" | "impact";
    assetRole: "vfx" | "impactAsset";
    startProgress: number;
    endProgress: number;
    renderKind: "projectile" | "field";
    anchor:
      | "nearest-mechanical-turret-to-effect"
      | "source-mechanical-turret-muzzle"
      | "effect";
    turretYOffset?: number;
    effectYOffset?: number;
    controlLift?: number;
    pathKind?: "linear" | "quadratic";
    lockToMuzzleHeight?: boolean;
    travelStart?: number;
    launchFrameIndex?: number;
    flightFrameIndex?: number;
    launchSourceAngleDegrees?: number;
    flightSourceAngleDegrees?: number;
    displaySize?: [number, number];
    fadeOutStartProgress?: number;
    radiusAspect?: number | null;
    radiusWidthMultiplier?: number | null;
  }>;
  runtimeMotion?:
    | {
        kind: "effect-target-dive";
        durationMs: number;
        travelEndProgress: number;
        visibleEndProgress: number;
        impactFrameSwitchProgress: number;
        startOffset: [number, number];
        impactOffset: [number, number];
        travelDisplaySize: [number, number];
        impactDisplaySize: [number, number];
        travelFrameIndices: [number, number, number, number];
        impactFrameIndices: [number, number];
        easing: "quadratic-in";
      }
    | {
        kind: "effect-source-to-target-shot";
        durationMs: number;
        warningEndProgress: number;
        travelEndProgress: number;
        visibleEndProgress: number;
        targetOffset: [number, number];
        travelDisplaySize: [number, number];
        impactDisplaySize: [number, number];
        warningFrameIndices: number[];
        travelFrameIndices: number[];
        impactFrameIndices: number[];
        sourceAngleDegrees: number;
        easing: "linear";
      };
}

export interface ArenaSkillRuntimeVisualEntry
  extends ArenaSkillRuntimeEntryMetadata,
    ArenaSkillRuntimeTimedFrameAsset {
  visualContract: ArenaSkillRuntimeVisualContract & { enabled?: true };
}

export interface ArenaSkillRuntimeStateEntry
  extends ArenaSkillRuntimeEntryMetadata {
  runtimeMode: "server-state";
  visualContract: ArenaSkillRuntimeVisualContract & { enabled: false };
}

export type ArenaSkillRuntimeEntry =
  | ArenaSkillRuntimeVisualEntry
  | ArenaSkillRuntimeStateEntry;

export function hasArenaSkillRuntimeFrames(
  entry: ArenaSkillRuntimeEntry
): entry is ArenaSkillRuntimeVisualEntry {
  return entry.visualContract.enabled !== false;
}

export type EngineerCoreRuntimeAssetRole =
  | "deployMechanical"
  | "deployMagic"
  | "mechanicalBasicShot"
  | "magicBasicShot"
  | "mechanicalTurretAtlas"
  | "magicTurret"
  | "magicTurretFire"
  | "magicMuzzle"
  | "magicShield";

export interface EngineerCoreRuntimeAsset {
  file: string;
  sha256: string;
  kind: string;
  sourcePath: string;
  sourceSha256: string;
  frameWidth?: number;
  frameHeight?: number;
  sourceFrameCount?: number;
  semanticFrameIndices?: number[];
  unionBounds?: [number, number, number, number];
  logicalFrameCount?: number;
  frameCount?: number;
  frameDurationMs?: number;
  sourceFrameSequence?: number[];
  displaySize?: [number, number];
  origin?: [number, number];
  referenceOffset?: [number, number];
  acceptedAnimationId?: string;
  placementVersion?: string;
  fitMode?: string;
}

export interface ArenaSkillCoreRuntimeEntry {
  skillId: "engineer_00";
  classId: "engineer";
  name: string;
  packagePath: string;
  packageUrl: string;
  sourceSelection: "5173-configuration-preview";
  iconFile: string;
  iconFileSha256: string;
  runtimeAssets: Record<EngineerCoreRuntimeAssetRole, EngineerCoreRuntimeAsset>;
}

interface ArenaSkillRuntimeManifest {
  schemaVersion: number;
  sourcePolicy: string;
  fallbackUsed: boolean;
  entryCount: number;
  coreEntryCount: number;
  entries: ArenaSkillRuntimeEntry[];
  coreEntries: ArenaSkillCoreRuntimeEntry[];
}

function validateManifest(
  manifest: ArenaSkillRuntimeManifest,
  label: string,
  expectedSchemaVersion: number
) {
  const unique = new Set(manifest.entries.map((entry) => entry.skillId));
  if (
    manifest.schemaVersion !== expectedSchemaVersion ||
    manifest.fallbackUsed ||
    manifest.entryCount !== 60 ||
    unique.size !== 60 ||
    manifest.coreEntryCount !== 1 ||
    manifest.coreEntries.length !== 1 ||
    manifest.coreEntries[0]?.skillId !== "engineer_00"
  ) {
    throw new Error(
      `Invalid ${label} Arena runtime VFX manifest: count=${manifest.entryCount}, ` +
        `unique=${unique.size}, fallback=${manifest.fallbackUsed}, ` +
        `schema=${manifest.schemaVersion}`
    );
  }
}

const canonicalManifest = manifestJson as unknown as ArenaSkillRuntimeManifest;
validateManifest(canonicalManifest, "canonical per-skill package", 5);

// Preview, review recording and real combat intentionally expose one runtime
// identity. Historical A/B/configuration manifests remain archive evidence,
// but the game can no longer select them through a query-string variant.
export const ARENA_SKILL_RUNTIME_VARIANT = "canonical" as const;
const manifest = canonicalManifest;

if (typeof window !== "undefined") {
  (
    window as Window & {
      __renaissArenaSkillRuntimeVariant?: typeof ARENA_SKILL_RUNTIME_VARIANT;
    }
  ).__renaissArenaSkillRuntimeVariant = ARENA_SKILL_RUNTIME_VARIANT;
}
const bySkillId = new Map(
  manifest.entries.map((entry) => [entry.skillId, entry])
);

type RuntimeFrameAssetRole =
  | "effect"
  | "body"
  | "projectile"
  | "impact"
  | "alternate";

function runtimeFrameAssetFingerprint(asset: ArenaSkillRuntimeFrameAsset) {
  const columns = asset.grid?.columns ?? asset.frameCount;
  const rows = asset.grid?.rows ?? 1;
  return [
    asset.outputSha256,
    asset.frameWidth,
    asset.frameHeight,
    asset.frameCount,
    columns,
    rows,
    asset.unionBounds.join(",")
  ].join(":");
}

const runtimeFrameAssetNamespaces = new Map<string, string>();
for (const entry of manifest.entries) {
  if (!hasArenaSkillRuntimeFrames(entry)) continue;
  const register = (
    role: RuntimeFrameAssetRole,
    asset: ArenaSkillRuntimeFrameAsset | undefined
  ) => {
    if (!asset) return;
    const fingerprint = runtimeFrameAssetFingerprint(asset);
    if (!runtimeFrameAssetNamespaces.has(fingerprint)) {
      runtimeFrameAssetNamespaces.set(fingerprint, `${role}_${entry.skillId}`);
    }
  };
  register("effect", entry);
  register("body", entry.actionBody);
  register("projectile", entry.projectileAsset);
  register("impact", entry.impactAsset);
  register("alternate", entry.alternateEffectAsset);
}

function getRuntimeFrameAssetNamespace(
  skillId: ArenaCatalogSkillId,
  role: RuntimeFrameAssetRole,
  asset: ArenaSkillRuntimeFrameAsset
) {
  return runtimeFrameAssetNamespaces.get(runtimeFrameAssetFingerprint(asset)) ??
    `${role}_${skillId}`;
}

export const ARENA_SKILL_RUNTIME_MANIFEST = manifest;
export const ARENA_SKILL_RUNTIME_ENTRY_COUNT = manifest.entryCount;

const coreBySkillId = new Map(
  manifest.coreEntries.map((entry) => [entry.skillId, entry])
);

export function getArenaSkillCoreRuntimeEntry(skillId: "engineer_00") {
  return coreBySkillId.get(skillId) ?? null;
}

export function getEngineerCoreRuntimeAsset(
  role: EngineerCoreRuntimeAssetRole
) {
  const core = getArenaSkillCoreRuntimeEntry("engineer_00");
  if (!core) {
    throw new Error("Engineer F core runtime package is missing");
  }
  const asset = core.runtimeAssets[role];
  if (!asset) {
    throw new Error(`Engineer F core runtime asset is missing: ${role}`);
  }
  return asset;
}

const ENGINEER_CORE_ANIMATED_ROLES = [
  "deployMechanical",
  "deployMagic",
  "mechanicalBasicShot",
  "magicBasicShot"
] as const satisfies readonly EngineerCoreRuntimeAssetRole[];

function getEngineerCoreSourceTexture(role: EngineerCoreRuntimeAssetRole) {
  return `engineer_core_source_${role}`;
}

export function getEngineerCoreFrameTexture(
  role: (typeof ENGINEER_CORE_ANIMATED_ROLES)[number],
  frame: number
) {
  const asset = getEngineerCoreRuntimeAsset(role);
  const frameCount = asset.frameCount ?? asset.logicalFrameCount ?? 1;
  const clamped = Math.max(0, Math.min(frameCount - 1, frame));
  return `engineer_core_${role}_${clamped}`;
}

export function getEngineerCoreFrameAtProgress(
  role: (typeof ENGINEER_CORE_ANIMATED_ROLES)[number],
  progress: number
) {
  const asset = getEngineerCoreRuntimeAsset(role);
  const frameCount = asset.frameCount ?? asset.logicalFrameCount;
  if (!frameCount) {
    throw new Error(`Engineer core ${role} has no logical frame count`);
  }
  return Math.min(
    frameCount - 1,
    Math.floor(Math.max(0, Math.min(1, progress)) * frameCount)
  );
}

export function getEngineerCoreFrameAtElapsed(
  role: (typeof ENGINEER_CORE_ANIMATED_ROLES)[number],
  elapsedMs: number
) {
  const asset = getEngineerCoreRuntimeAsset(role);
  const frameCount = asset.frameCount ?? asset.logicalFrameCount;
  const frameDurationMs = asset.frameDurationMs;
  if (!frameCount || !frameDurationMs) {
    throw new Error(`Engineer core ${role} has no logical timing contract`);
  }
  return (
    Math.floor(Math.max(0, elapsedMs) / Math.max(1, frameDurationMs)) %
    frameCount
  );
}

export function getEngineerCoreStaticTextureKey(
  role:
    | "mechanicalTurretAtlas"
    | "magicTurret"
    | "magicTurretFire"
    | "magicMuzzle"
    | "magicShield"
) {
  switch (role) {
    case "mechanicalTurretAtlas":
      return "engineerMechanicalTurretAtlas";
    case "magicTurret":
      return "engineerMagicTurret";
    case "magicTurretFire":
      return "engineerMagicTurretFire";
    case "magicMuzzle":
      return "engineerMagicMuzzle";
    case "magicShield":
      return "engineerMagicShield";
  }
}

export function getArenaSkillRuntimeEntry(
  skillId: ArenaCatalogSkillId
) {
  return bySkillId.get(skillId) ?? null;
}

export function getArenaSkillRuntimeSourceTexture(
  skillId: ArenaCatalogSkillId
) {
  return `arena_skill_runtime_source_${skillId}`;
}

export function getArenaSkillRuntimeFrameTexture(
  skillId: ArenaCatalogSkillId,
  frame: number
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  const clamped = entry && hasArenaSkillRuntimeFrames(entry)
    ? Math.max(0, Math.min(entry.frameCount - 1, frame))
    : 0;
  if (!entry || !hasArenaSkillRuntimeFrames(entry)) {
    return `arena_skill_runtime_effect_${skillId}_${clamped}`;
  }
  const namespace = getRuntimeFrameAssetNamespace(skillId, "effect", entry);
  return `arena_skill_runtime_${namespace}_${clamped}`;
}

export type ArenaSkillRuntimeSecondaryRole =
  | "projectile"
  | "impact"
  | "alternate";

function getArenaSkillRuntimeSecondaryAsset(
  entry: ArenaSkillRuntimeVisualEntry,
  role: ArenaSkillRuntimeSecondaryRole
) {
  if (role === "projectile") {
    return entry.projectileAsset ?? entry;
  }
  if (role === "impact") {
    return entry.impactAsset ?? entry;
  }
  return entry.alternateEffectAsset ?? entry;
}

function getArenaSkillRuntimeSecondarySourceTexture(
  skillId: ArenaCatalogSkillId,
  role: ArenaSkillRuntimeSecondaryRole
) {
  return `arena_skill_runtime_${role}_source_${skillId}`;
}

export function getArenaSkillRuntimeTetherTexture(skillId: ArenaCatalogSkillId) {
  return `arena_skill_runtime_tether_${skillId}`;
}

export function getArenaSkillRuntimeSecondaryFrameTexture(
  skillId: ArenaCatalogSkillId,
  role: ArenaSkillRuntimeSecondaryRole,
  frame: number
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  if (!entry || !hasArenaSkillRuntimeFrames(entry)) {
    return getArenaSkillRuntimeFrameTexture(skillId, 0);
  }
  const asset = getArenaSkillRuntimeSecondaryAsset(entry, role);
  if (asset === entry) {
    return getArenaSkillRuntimeFrameTexture(skillId, frame);
  }
  const clamped = Math.max(0, Math.min(asset.frameCount - 1, frame));
  const namespace = getRuntimeFrameAssetNamespace(skillId, role, asset);
  return `arena_skill_runtime_${namespace}_${clamped}`;
}

export function getArenaSkillRuntimeProjectileAsset(
  skillId: ArenaCatalogSkillId
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  return entry && hasArenaSkillRuntimeFrames(entry)
    ? getArenaSkillRuntimeSecondaryAsset(entry, "projectile")
    : null;
}

export function getArenaSkillRuntimeImpactAsset(
  skillId: ArenaCatalogSkillId
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  return entry?.impactAsset ?? null;
}

export function getArenaSkillRuntimeAlternateEffectAsset(
  skillId: ArenaCatalogSkillId
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  return entry?.alternateEffectAsset ?? null;
}

export function getArenaSkillRuntimeActionBody(
  skillId: ArenaCatalogSkillId
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  if (!entry || !hasArenaSkillRuntimeFrames(entry)) {
    return null;
  }
  if (entry.actionBody) {
    return entry.actionBody;
  }
  return entry.visualContract.renderKind === "body" ? entry : null;
}

export function getArenaSkillRuntimeActionBodyFrameTexture(
  skillId: ArenaCatalogSkillId,
  frame: number,
  direction?: ArenaSkillRuntimeDirection
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  const body = getArenaSkillRuntimeActionBody(skillId);
  if (!entry || !body) {
    return getArenaSkillRuntimeFrameTexture(skillId, 0);
  }
  if (!entry.actionBody) {
    return getArenaSkillRuntimeFrameTexture(skillId, frame);
  }
  const directional = body.directionalLayout;
  let logicalFrame = frame;
  if (directional && direction) {
    const directionIndex = directional.directionOrder.indexOf(direction);
    if (directionIndex < 0) {
      throw new Error(
        `Direction ${direction} is not authored for ${skillId}`
      );
    }
    const localFrame = Math.max(
      0,
      Math.min(directional.framesPerDirection - 1, frame)
    );
    logicalFrame =
      directionIndex * directional.framesPerDirection + localFrame;
  }
  const clamped = Math.max(0, Math.min(body.frameCount - 1, logicalFrame));
  const namespace = getRuntimeFrameAssetNamespace(skillId, "body", body);
  return `arena_skill_runtime_${namespace}_${clamped}`;
}

export function getArenaSkillRuntimeActionBodyFrameAtProgress(
  skillId: ArenaCatalogSkillId,
  progress: number
) {
  const body = getArenaSkillRuntimeActionBody(skillId);
  if (!body) {
    return 0;
  }
  const directional = body.directionalLayout;
  if (!directional) {
    return getArenaSkillRuntimeFrameAtProgress(body, progress);
  }
  const localAsset: ArenaSkillRuntimeFrameAsset = {
    ...body,
    frameCount: directional.framesPerDirection,
    frameDurationsMs: directional.frameDurationsMs
  };
  return getArenaSkillRuntimeFrameAtProgress(localAsset, progress);
}

export function getArenaSkillRuntimeActionBodyOrigin(
  skillId: ArenaCatalogSkillId
) {
  const body = getArenaSkillRuntimeActionBody(skillId);
  if (!body?.semanticAnchor) {
    return null;
  }
  const [left, top, right, bottom] = body.unionBounds;
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0 && height > 0)) {
    throw new Error(`Invalid action body union bounds for ${skillId}`);
  }
  return {
    x: (body.semanticAnchor[0] - left) / width,
    y: (body.semanticAnchor[1] - top) / height
  };
}

function getArenaSkillRuntimeActionBodySourceTexture(skillId: ArenaCatalogSkillId) {
  return `arena_skill_runtime_body_source_${skillId}`;
}

function selectedRuntimeEntries(skillIds?: Iterable<ArenaCatalogSkillId>) {
  if (!skillIds) {
    return manifest.entries.filter(hasArenaSkillRuntimeFrames);
  }
  const selected = new Set(skillIds);
  return manifest.entries.filter(
    (entry): entry is ArenaSkillRuntimeVisualEntry =>
      selected.has(entry.skillId) && hasArenaSkillRuntimeFrames(entry)
  );
}

function queueRuntimeEntrySources(
  scene: Phaser.Scene,
  entry: ArenaSkillRuntimeVisualEntry,
  onlyMissing: boolean
) {
  let queued = 0;
  const queueImage = (key: string, file: string, targetKeys: readonly string[]) => {
    if (onlyMissing && targetKeys.every((targetKey) => scene.textures.exists(targetKey))) {
      return;
    }
    if (onlyMissing && scene.textures.exists(key)) return;
    scene.load.image(key, file);
    queued += 1;
  };

  queueImage(
    getArenaSkillRuntimeSourceTexture(entry.skillId),
    `${entry.file}?v=${entry.outputSha256.slice(0, 12)}`,
    Array.from({ length: entry.frameCount }, (_, frame) =>
      getArenaSkillRuntimeFrameTexture(entry.skillId, frame)
    )
  );
  if (entry.actionBody) {
    queueImage(
      getArenaSkillRuntimeActionBodySourceTexture(entry.skillId),
      `${entry.actionBody.file}?v=${entry.actionBody.outputSha256.slice(0, 12)}`,
      Array.from({ length: entry.actionBody.frameCount }, (_, frame) =>
        getArenaSkillRuntimeActionBodyFrameTexture(entry.skillId, frame)
      )
    );
  }
  if (entry.tetherAsset) {
    queueImage(
      getArenaSkillRuntimeTetherTexture(entry.skillId),
      `${entry.tetherAsset.file}?v=${entry.tetherAsset.outputSha256.slice(0, 12)}`,
      [getArenaSkillRuntimeTetherTexture(entry.skillId)]
    );
  }
  for (const [role, asset] of [
    ["projectile", entry.projectileAsset],
    ["impact", entry.impactAsset],
    ["alternate", entry.alternateEffectAsset]
  ] as const) {
    if (!asset) continue;
    queueImage(
      getArenaSkillRuntimeSecondarySourceTexture(entry.skillId, role),
      `${asset.file}?v=${asset.outputSha256.slice(0, 12)}`,
      Array.from({ length: asset.frameCount }, (_, frame) =>
        getArenaSkillRuntimeSecondaryFrameTexture(entry.skillId, role, frame)
      )
    );
  }
  return queued;
}

export function preloadArenaSkillRuntimeTextures(
  scene: Phaser.Scene,
  skillIds?: Iterable<ArenaCatalogSkillId>
) {
  for (const entry of selectedRuntimeEntries(skillIds)) {
    queueRuntimeEntrySources(scene, entry, false);
  }
  for (const role of ENGINEER_CORE_ANIMATED_ROLES) {
    const asset = getEngineerCoreRuntimeAsset(role);
    scene.load.image(
      getEngineerCoreSourceTexture(role),
      `${asset.file}?v=${asset.sha256.slice(0, 12)}`
    );
  }
  for (const role of [
    "mechanicalTurretAtlas",
    "magicTurret",
    "magicTurretFire"
  ] as const) {
    const asset = getEngineerCoreRuntimeAsset(role);
    scene.load.image(
      getEngineerCoreStaticTextureKey(role),
      `${asset.file}?v=${asset.sha256.slice(0, 12)}`
    );
  }
  for (const role of ["magicMuzzle", "magicShield"] as const) {
    const asset = getEngineerCoreRuntimeAsset(role);
    if (!asset.frameWidth || !asset.frameHeight) {
      throw new Error(`Engineer core ${role} has no spritesheet dimensions`);
    }
    scene.load.spritesheet(
      getEngineerCoreStaticTextureKey(role),
      `${asset.file}?v=${asset.sha256.slice(0, 12)}`,
      { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight }
    );
  }
}

function buildFrameTextures(
  scene: Phaser.Scene,
  sourceKey: string,
  asset: ArenaSkillRuntimeFrameAsset,
  textureKeyForFrame: (frame: number) => string
) {
  const source = scene.textures.get(sourceKey);
  const [left, top, right, bottom] = asset.unionBounds;
  const width = right - left;
  const height = bottom - top;
  const columns = asset.grid?.columns ?? asset.frameCount;
  const rows = asset.grid?.rows ?? 1;
  if (
    !(columns > 0) ||
    !(rows > 0) ||
    columns * rows !== asset.frameCount
  ) {
    throw new Error(
      `Invalid runtime VFX grid ${columns}x${rows} for ${asset.sourcePath}`
    );
  }
  for (let frame = 0; frame < asset.frameCount; frame += 1) {
    const textureKey = textureKeyForFrame(frame);
    if (scene.textures.exists(textureKey)) {
      continue;
    }
    const target = scene.textures.createCanvas(textureKey, width, height);
    if (!target) {
      throw new Error(`Unable to create runtime VFX texture ${textureKey}`);
    }
    const sourceImage = source.getSourceImage() as CanvasImageSource;
    const context = target.getContext();
    context.imageSmoothingEnabled = false;
    context.drawImage(
      sourceImage,
      (frame % columns) * asset.frameWidth + left,
      Math.floor(frame / columns) * asset.frameHeight + top,
      width,
      height,
      0,
      0,
      width,
      height
    );
    target.refresh();
  }
}

export function buildArenaSkillRuntimeTextures(
  scene: Phaser.Scene,
  skillIds?: Iterable<ArenaCatalogSkillId>
) {
  for (const entry of selectedRuntimeEntries(skillIds)) {
    const sourceKey = getArenaSkillRuntimeSourceTexture(entry.skillId);
    buildFrameTextures(
      scene,
      sourceKey,
      entry,
      (frame) => getArenaSkillRuntimeFrameTexture(entry.skillId, frame)
    );
    if (entry.actionBody) {
      buildFrameTextures(
        scene,
        getArenaSkillRuntimeActionBodySourceTexture(entry.skillId),
        entry.actionBody,
        (frame) => getArenaSkillRuntimeActionBodyFrameTexture(entry.skillId, frame)
      );
    }
    for (const [role, asset] of [
      ["projectile", entry.projectileAsset],
      ["impact", entry.impactAsset],
      ["alternate", entry.alternateEffectAsset]
    ] as const) {
      if (!asset) {
        continue;
      }
      buildFrameTextures(
        scene,
        getArenaSkillRuntimeSecondarySourceTexture(entry.skillId, role),
        asset,
        (frame) =>
          getArenaSkillRuntimeSecondaryFrameTexture(
            entry.skillId,
            role,
            frame
          )
      );
    }
  }
  for (const role of ENGINEER_CORE_ANIMATED_ROLES) {
    const asset = getEngineerCoreRuntimeAsset(role);
    const frameCount = asset.frameCount ?? asset.logicalFrameCount;
    if (!asset.frameWidth || !asset.frameHeight || !frameCount) {
      throw new Error(`Engineer core ${role} has an incomplete frame contract`);
    }
    const source = scene.textures.get(getEngineerCoreSourceTexture(role));
    const sourceImage = source.getSourceImage() as CanvasImageSource;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const textureKey = getEngineerCoreFrameTexture(role, frame);
      if (scene.textures.exists(textureKey)) {
        continue;
      }
      const target = scene.textures.createCanvas(
        textureKey,
        asset.frameWidth,
        asset.frameHeight
      );
      if (!target) {
        throw new Error(`Unable to create Engineer core texture ${textureKey}`);
      }
      const context = target.getContext();
      context.imageSmoothingEnabled = false;
      context.drawImage(
        sourceImage,
        frame * asset.frameWidth,
        0,
        asset.frameWidth,
        asset.frameHeight,
        0,
        0,
        asset.frameWidth,
        asset.frameHeight
      );
      target.refresh();
    }
  }
}

function runtimeEntryTextureKeys(entry: ArenaSkillRuntimeVisualEntry) {
  const keys: string[] = [];
  for (let frame = 0; frame < entry.frameCount; frame += 1) {
    keys.push(getArenaSkillRuntimeFrameTexture(entry.skillId, frame));
  }
  if (entry.actionBody) {
    for (let frame = 0; frame < entry.actionBody.frameCount; frame += 1) {
      keys.push(getArenaSkillRuntimeActionBodyFrameTexture(entry.skillId, frame));
    }
  }
  if (entry.tetherAsset) {
    keys.push(getArenaSkillRuntimeTetherTexture(entry.skillId));
  }
  for (const [role, asset] of [
    ["projectile", entry.projectileAsset],
    ["impact", entry.impactAsset],
    ["alternate", entry.alternateEffectAsset]
  ] as const) {
    if (!asset) continue;
    for (let frame = 0; frame < asset.frameCount; frame += 1) {
      keys.push(getArenaSkillRuntimeSecondaryFrameTexture(entry.skillId, role, frame));
    }
  }
  return keys;
}

export function assertArenaSkillRuntimeTexturesReady(
  scene: Phaser.Scene,
  skillIds?: Iterable<ArenaCatalogSkillId>
) {
  const missing: string[] = [];
  const requireTexture = (key: string) => {
    if (!scene.textures.exists(key)) missing.push(key);
  };

  for (const entry of selectedRuntimeEntries(skillIds)) {
    runtimeEntryTextureKeys(entry).forEach(requireTexture);
  }

  for (const role of ENGINEER_CORE_ANIMATED_ROLES) {
    const asset = getEngineerCoreRuntimeAsset(role);
    const frameCount = asset.frameCount ?? asset.logicalFrameCount ?? 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      requireTexture(getEngineerCoreFrameTexture(role, frame));
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Arena skill runtime textures are incomplete (${missing.length} missing): ${missing.slice(0, 8).join(", ")}`
    );
  }
}

const runtimeTextureLoadQueues = new WeakMap<Phaser.Scene, Promise<void>>();

export function ensureArenaSkillRuntimeTextures(
  scene: Phaser.Scene,
  skillIds: Iterable<ArenaCatalogSkillId>
) {
  const requiredSkillIds = [...new Set(skillIds)];
  const previous = runtimeTextureLoadQueues.get(scene) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(() => ensureArenaSkillRuntimeTexturesNow(scene, requiredSkillIds));
  runtimeTextureLoadQueues.set(scene, queued);
  const clearQueue = () => {
    if (runtimeTextureLoadQueues.get(scene) === queued) {
      runtimeTextureLoadQueues.delete(scene);
    }
  };
  void queued.then(clearQueue, clearQueue);
  return queued;
}

export async function prepareAllArenaSkillRuntimeTextures(
  scene: Phaser.Scene,
  onProgress?: (loaded: number, total: number) => void
) {
  const entries = manifest.entries;
  onProgress?.(0, entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    if (!scene.game.isRunning) {
      throw new Error("Arena scene stopped before all skill textures were ready.");
    }
    const entry = entries[index];
    if (hasArenaSkillRuntimeFrames(entry)) {
      await ensureArenaSkillRuntimeTextures(scene, [entry.skillId]);
    }
    onProgress?.(index + 1, entries.length);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  assertArenaSkillRuntimeTexturesReady(scene);
}

async function ensureArenaSkillRuntimeTexturesNow(
  scene: Phaser.Scene,
  requiredSkillIds: ArenaCatalogSkillId[]
) {
  const missingEntries = selectedRuntimeEntries(requiredSkillIds).filter((entry) =>
    runtimeEntryTextureKeys(entry).some((key) => !scene.textures.exists(key))
  );
  if (missingEntries.length === 0) {
    assertArenaSkillRuntimeTexturesReady(scene, requiredSkillIds);
    return;
  }
  if (scene.load.isLoading()) {
    throw new Error("Arena runtime texture loader is already active.");
  }

  let queued = 0;
  for (const entry of missingEntries) {
    queued += queueRuntimeEntrySources(scene, entry, true);
  }
  if (queued > 0) {
    await new Promise<void>((resolve, reject) => {
      const failedKeys: string[] = [];
      const onLoadError = (file: Phaser.Loader.File) => failedKeys.push(file.key);
      const onComplete = () => {
        scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
        if (failedKeys.length > 0) {
          reject(
            new Error(
              `Arena runtime texture download failed: ${failedKeys.slice(0, 8).join(", ")}`
            )
          );
          return;
        }
        resolve();
      };
      scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      scene.load.once(Phaser.Loader.Events.COMPLETE, onComplete);
      scene.load.start();
    });
  }

  buildArenaSkillRuntimeTextures(scene, requiredSkillIds);
  releaseArenaSkillRuntimeSourceTextures(scene, requiredSkillIds);
  assertArenaSkillRuntimeTexturesReady(scene, requiredSkillIds);
}

/**
 * Runtime skill frames are copied into independent canvas textures. The packed
 * sheets are not rendered after that build step, so retaining them duplicates
 * decoded image memory. Tethers and Engineer static assets stay loaded because
 * those textures are rendered directly.
 */
export function releaseArenaSkillRuntimeSourceTextures(
  scene: Phaser.Scene,
  skillIds?: Iterable<ArenaCatalogSkillId>
) {
  const sourceKeys = new Set<string>();

  for (const entry of selectedRuntimeEntries(skillIds)) {
    sourceKeys.add(getArenaSkillRuntimeSourceTexture(entry.skillId));
    if (entry.actionBody) {
      sourceKeys.add(getArenaSkillRuntimeActionBodySourceTexture(entry.skillId));
    }
    for (const [role, asset] of [
      ["projectile", entry.projectileAsset],
      ["impact", entry.impactAsset],
      ["alternate", entry.alternateEffectAsset]
    ] as const) {
      if (asset) {
        sourceKeys.add(
          getArenaSkillRuntimeSecondarySourceTexture(entry.skillId, role)
        );
      }
    }
  }

  for (const role of ENGINEER_CORE_ANIMATED_ROLES) {
    sourceKeys.add(getEngineerCoreSourceTexture(role));
  }

  for (const sourceKey of sourceKeys) {
    if (scene.textures.exists(sourceKey)) {
      scene.textures.remove(sourceKey);
    }
  }
}

export function getArenaSkillRuntimeFrameAtProgress(
  asset: ArenaSkillRuntimeFrameAsset,
  progress: number
) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const durations = asset.frameDurationsMs;
  if (!durations || durations.length !== asset.frameCount) {
    return Math.min(
      asset.frameCount - 1,
      Math.floor(clampedProgress * asset.frameCount)
    );
  }
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (!(total > 0) || clampedProgress >= 1) {
    return asset.frameCount - 1;
  }
  const target = clampedProgress * total;
  let elapsed = 0;
  for (let frame = 0; frame < durations.length; frame += 1) {
    elapsed += durations[frame];
    if (target < elapsed) {
      return frame;
    }
  }
  return asset.frameCount - 1;
}

export function getArenaSkillRuntimeFrameAtElapsed(
  asset: ArenaSkillRuntimeFrameAsset,
  elapsedMs: number
) {
  const durations = asset.frameDurationsMs;
  if (!durations || durations.length !== asset.frameCount) {
    const frameDurationMs =
      "frameDurationMs" in asset && typeof asset.frameDurationMs === "number"
        ? asset.frameDurationMs
        : 90;
    return (
      Math.floor(Math.max(0, elapsedMs) / Math.max(1, frameDurationMs)) %
      asset.frameCount
    );
  }
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (!(total > 0)) {
    return 0;
  }
  const target = Math.max(0, elapsedMs) % total;
  let elapsed = 0;
  for (let frame = 0; frame < durations.length; frame += 1) {
    elapsed += durations[frame];
    if (target < elapsed) {
      return frame;
    }
  }
  return asset.frameCount - 1;
}

function playbackSegmentDuration(
  frameDurationsMs: number[],
  frameIndices: number[]
) {
  return frameIndices.reduce(
    (total, frameIndex) => total + frameDurationsMs[frameIndex],
    0
  );
}

function playbackSegmentFrameAtElapsed(
  frameDurationsMs: number[],
  frameIndices: number[],
  elapsedMs: number
) {
  const total = playbackSegmentDuration(frameDurationsMs, frameIndices);
  const target = Math.max(0, elapsedMs) % total;
  let elapsed = 0;
  for (const frameIndex of frameIndices) {
    elapsed += frameDurationsMs[frameIndex];
    if (target < elapsed) {
      return frameIndex;
    }
  }
  return frameIndices.at(-1) ?? 0;
}

/**
 * Plays an explicit effect-duration timeline without changing the authored
 * cadence of any source frame.  Only entries declaring `playback` use this;
 * every other skill retains its existing per-progress or continuous loop
 * behavior.
 */
export function getArenaSkillRuntimeFrameAtEffectElapsed(
  entry: ArenaSkillRuntimeTimedFrameAsset & {
    skillId?: ArenaCatalogSkillId;
  },
  elapsedMs: number,
  effectDurationMs: number
) {
  const playback = entry.playback;
  if (!playback) {
    return getArenaSkillRuntimeFrameAtProgress(
      entry,
      Math.max(0, Math.min(1, elapsedMs / Math.max(1, effectDurationMs)))
    );
  }
  const frameDurationsMs = entry.frameDurationsMs;
  const sequences = [
    playback.introFrameIndices,
    playback.loopFrameIndices,
    playback.recoveryFrameIndices
  ];
  if (
    !frameDurationsMs ||
    frameDurationsMs.length !== entry.frameCount ||
    sequences.some(
      (frames) =>
        frames.length === 0 ||
        frames.some(
          (frameIndex) =>
            !Number.isInteger(frameIndex) ||
            frameIndex < 0 ||
            frameIndex >= entry.frameCount
        )
    )
  ) {
    throw new Error(
      `Invalid explicit playback contract for ${entry.skillId ?? "secondary asset"}; source-frame timing is required`
    );
  }
  const introDuration = playbackSegmentDuration(
    frameDurationsMs,
    playback.introFrameIndices
  );
  const recoveryDuration = playbackSegmentDuration(
    frameDurationsMs,
    playback.recoveryFrameIndices
  );
  if (effectDurationMs < introDuration + recoveryDuration) {
    throw new Error(
      `Effect duration ${effectDurationMs}ms is shorter than explicit playback for ${entry.skillId ?? "secondary asset"}`
    );
  }
  const clampedElapsed = Math.max(0, Math.min(effectDurationMs - 1, elapsedMs));
  const recoveryStartsAt = effectDurationMs - recoveryDuration;
  if (clampedElapsed < introDuration) {
    return playbackSegmentFrameAtElapsed(
      frameDurationsMs,
      playback.introFrameIndices,
      clampedElapsed
    );
  }
  if (clampedElapsed < recoveryStartsAt) {
    return playbackSegmentFrameAtElapsed(
      frameDurationsMs,
      playback.loopFrameIndices,
      clampedElapsed - introDuration
    );
  }
  return playbackSegmentFrameAtElapsed(
    frameDurationsMs,
    playback.recoveryFrameIndices,
    clampedElapsed - recoveryStartsAt
  );
}

export function getArenaSkillRuntimeOrigin(
  entry: ArenaSkillRuntimeFrameAsset
) {
  const [left, top, right, bottom] = entry.unionBounds;
  return {
    x: (entry.frameWidth / 2 - left) / (right - left),
    y: (entry.frameHeight / 2 - top) / (bottom - top)
  };
}

export function getArenaSkillRuntimeScale(
  entry: ArenaSkillRuntimeEntry,
  actorDisplayHeight: number
) {
  const contract = getArenaSkillRuntimeVisualContract(entry);
  const referenceHeight = contract.referenceActorHeight;
  if (!(referenceHeight > 0)) {
    throw new Error(
      `Invalid Arena VFX actor reference for ${entry.skillId}: ${referenceHeight}`
    );
  }
  return actorDisplayHeight / referenceHeight;
}

export function getArenaSkillRuntimeReferenceDisplay(
  entry: ArenaSkillRuntimeEntry,
  actorDisplayHeight: number
) {
  const contract = getArenaSkillRuntimeVisualContract(entry);
  const scale = getArenaSkillRuntimeScale(
    entry,
    actorDisplayHeight
  );
  return {
    width: contract.referenceSize[0] * scale,
    height: contract.referenceSize[1] * scale
  };
}

export function getArenaSkillRuntimeReferenceOffset(
  entry: ArenaSkillRuntimeEntry,
  actorDisplayHeight: number
) {
  const contract = getArenaSkillRuntimeVisualContract(entry);
  const scale = getArenaSkillRuntimeScale(
    entry,
    actorDisplayHeight
  );
  return {
    x: contract.referenceOffset[0] * scale,
    y: contract.referenceOffset[1] * scale
  };
}

export function getArenaSkillRuntimeVisualContract(
  entry: ArenaSkillRuntimeEntry
) {
  return entry.visualContract;
}

export function getArenaSkillRuntimeProjectileDisplay(
  skillId: ArenaCatalogSkillId,
  actorDisplayHeight: number
) {
  const entry = getArenaSkillRuntimeEntry(skillId);
  const projectileSize = entry?.visualContract.projectileSize;
  if (!entry || !projectileSize) {
    return null;
  }
  const scale = getArenaSkillRuntimeScale(entry, actorDisplayHeight);
  return {
    width: projectileSize[0] * scale,
    height: projectileSize[1] * scale
  };
}

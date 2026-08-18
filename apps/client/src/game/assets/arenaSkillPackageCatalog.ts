import type {
  ArenaCatalogSkillId,
  EngineerTurretKind
} from "@renaiss-game/shared";
import runtimeManifestJson from "./arenaSkillRuntimeManifest.json";

interface PackagedGameplayPreview {
  file?: string;
  sha256?: string;
  mediaType?: "video/webm" | "image/webp";
  frameRate?: number;
  sourceSize?: readonly number[];
  crop?: readonly number[];
  sourceScenario?: string;
  fallbackUsed?: boolean;
}

interface PackagedArenaSkillEntry {
  skillId: ArenaCatalogSkillId;
  classId: "warrior" | "archer" | "engineer" | "mage";
  packageUrl?: string;
  previewFile?: string;
  previewFileSha256?: string;
  previewMediaType?: "video/webm" | "image/webp";
  previewFrameRate?: number;
  previewSourceSize?: readonly number[];
  previewCrop?: readonly number[];
  configurationPreviews?: Partial<
    Record<EngineerTurretKind, PackagedGameplayPreview>
  >;
  iconFile?: string;
  iconFileSha256?: string;
  acceptedAnimationId?: string;
  sourcePath?: string;
  sourceSha256?: string;
  sourceSelection?: string;
  visualContract?: {
    enabled?: boolean;
  };
}

const packagedBySkillId = new Map(
  ([
    ...(runtimeManifestJson.entries as PackagedArenaSkillEntry[]),
    ...((runtimeManifestJson as unknown as {
      coreEntries?: PackagedArenaSkillEntry[];
    }).coreEntries ?? [])
  ])
    .filter((entry) => entry.packageUrl)
    .map((entry) => [entry.skillId, entry])
);

export function getArenaSkillPackageEntry(skillId: ArenaCatalogSkillId) {
  return packagedBySkillId.get(skillId) ?? null;
}

export function getArenaSkillPackagePreview(skillId: ArenaCatalogSkillId) {
  const entry = getArenaSkillPackageEntry(skillId);
  if (!entry?.previewFile || !entry.previewFileSha256) {
    return null;
  }
  return {
    file: entry.previewFile,
    sha256: entry.previewFileSha256,
    mediaType: entry.previewMediaType,
    frameRate: entry.previewFrameRate,
    sourceSize: entry.previewSourceSize,
    crop: entry.previewCrop
  };
}

export function getEngineerTurretPackagePreview(kind: EngineerTurretKind) {
  const entry = getArenaSkillPackageEntry("engineer_00");
  const preview = entry?.configurationPreviews?.[kind];
  if (
    !preview?.file ||
    !preview.sha256 ||
    preview.mediaType !== "video/webm" ||
    preview.fallbackUsed !== false
  ) {
    return null;
  }
  return {
    file: preview.file,
    sha256: preview.sha256,
    mediaType: preview.mediaType,
    frameRate: preview.frameRate,
    sourceSize: preview.sourceSize,
    crop: preview.crop,
    sourceScenario: preview.sourceScenario
  };
}

export function getArenaSkillPackageIcon(skillId: ArenaCatalogSkillId) {
  const entry = getArenaSkillPackageEntry(skillId);
  if (!entry?.iconFile || !entry.iconFileSha256) {
    return null;
  }
  return {
    file: entry.iconFile,
    sha256: entry.iconFileSha256
  };
}

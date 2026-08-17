import type { ArenaCatalogSkillId } from "@renaiss-game/shared";
import runtimeManifestJson from "./arenaSkillRuntimeManifest.json";

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

import { createHash } from "node:crypto";
import {
  ARENA_CONTENT_MANIFEST_V1,
  type ArenaCatalogSkillId,
  type ArenaContentPack,
  type ClassId,
  type MatchAssetManifest
} from "@renaiss-game/shared";

export interface ArenaContentRequirements {
  classIds: ClassId[];
  skillIds: ArenaCatalogSkillId[];
}

export function buildMatchAssetManifest(
  readinessId: string,
  expiresAt: number,
  requirements: ArenaContentRequirements
): MatchAssetManifest {
  const classIds = uniqueSorted(requirements.classIds);
  const skillIds = uniqueSorted(requirements.skillIds);
  if (classIds.length === 0 || skillIds.length === 0) {
    throw new Error("Arena ready gate requires at least one character and one match skill.");
  }

  const characterSources = classIds.map((classId) =>
    requirePack(ARENA_CONTENT_MANIFEST_V1.characters, classId)
  );
  const skillSources = skillIds.map((skillId) =>
    requirePack(ARENA_CONTENT_MANIFEST_V1.skills, skillId)
  );
  const optionalSources = Object.keys(ARENA_CONTENT_MANIFEST_V1.optionals)
    .sort()
    .map((classId) => requirePack(ARENA_CONTENT_MANIFEST_V1.optionals, classId));

  return {
    readinessId,
    expiresAt,
    packs: [
      toWirePack(ARENA_CONTENT_MANIFEST_V1.core, true),
      aggregatePack("character", characterSources, true),
      aggregatePack("match_skill", skillSources, true),
      // M7 permits a knocked-out player to change to any class. The complete
      // four-class Optional Pack must therefore pass the same ready gate before
      // server spawn; no class/skill asset is loaded on first use in combat.
      aggregatePack("optional", optionalSources, true)
    ]
  };
}

export function requiredPackHashes(manifest: MatchAssetManifest) {
  return manifest.packs
    .filter((pack) => pack.required)
    .map((pack) => pack.contentHash)
    .sort();
}

function aggregatePack(
  kind: "character" | "match_skill" | "optional",
  sources: readonly SourcePack[],
  required: boolean
): ArenaContentPack {
  if (sources.length === 0) {
    throw new Error(`Arena ${kind} pack cannot be empty.`);
  }
  const contentHash = hashStrings(sources.map((pack) => pack.contentHash));
  return {
    packId: `arena.${kind}.${contentHash.slice(0, 16)}.v1`,
    kind,
    contentHash,
    labels: uniqueSorted(sources.flatMap((pack) => [...pack.labels])),
    required,
    // M5 uses local Addressables in StreamingAssets, so the actual network download is zero.
    // M6 changes this generated manifest to remote-addressables and records bundle bytes.
    downloadBytes: 0
  };
}

function toWirePack(source: SourcePack, required: boolean): ArenaContentPack {
  return {
    packId: source.packId,
    kind: source.kind,
    contentHash: source.contentHash,
    labels: [...source.labels],
    required,
    downloadBytes: 0
  };
}

type SourcePack = {
  readonly packId: string;
  readonly kind: "core" | "character" | "match_skill" | "optional";
  readonly contentHash: string;
  readonly labels: readonly string[];
};

function requirePack<T extends string>(
  source: Readonly<Record<string, SourcePack>>,
  key: T
) {
  const pack = source[key];
  if (!pack) {
    throw new Error(`Arena content manifest has no pack for ${key}.`);
  }
  return pack;
}

function hashStrings(values: readonly string[]) {
  return createHash("sha256").update([...values].sort().join("\n")).digest("hex");
}

function uniqueSorted<T extends string>(values: readonly T[]) {
  return [...new Set(values)].sort() as T[];
}

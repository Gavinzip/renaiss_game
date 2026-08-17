import Phaser from "phaser";
import {
  ARENA_CONTENT_MANIFEST_V1_SOURCE_SHA256,
  ARENA_PROTOCOL_V1_SCHEMA_SHA256,
  type ArenaContentPack,
  type AssetsReadyRequest,
  type MatchAssetManifest
} from "@renaiss-game/shared";
import { assertArenaRuntimeTexturesReady } from "../assets/runtimeTextures";
import { assertArenaSkillRuntimeTexturesReady } from "../assets/arenaSkillRuntime";

const REQUIRED_PACK_KINDS = ["character", "core", "match_skill", "optional"] as const;

export const WEB_ARENA_BUILD_ID =
  `web-${ARENA_CONTENT_MANIFEST_V1_SOURCE_SHA256}`;

/**
 * Proves that the logical pack contract matches the server and that Phaser has
 * decoded and uploaded the runtime textures before the server may spawn us.
 */
export async function prepareWebArenaAssets(
  scene: Phaser.Scene,
  manifest: MatchAssetManifest
): Promise<AssetsReadyRequest> {
  if (manifest.expiresAt <= Date.now()) {
    throw new Error("Arena asset readiness ticket already expired.");
  }
  validateLogicalPacks(manifest.packs);
  assertArenaRuntimeTexturesReady(scene);
  assertArenaSkillRuntimeTexturesReady(scene);

  await nextAnimationFrame();
  assertPhaserTextureSurfaces(scene);
  if (scene.game.loop.frame <= 0) {
    throw new Error("Arena render pipeline has not completed a warmup frame.");
  }

  const requiredPacks = manifest.packs.filter((pack) => pack.required);
  const downloadedBytes = webArenaTransferredBytes();
  if (!Number.isSafeInteger(downloadedBytes) || downloadedBytes < 0) {
    throw new Error("Arena pack byte telemetry is invalid.");
  }

  return {
    readinessId: manifest.readinessId,
    protocolSchemaHash: ARENA_PROTOCOL_V1_SCHEMA_SHA256,
    readyPackHashes: requiredPacks.map((pack) => pack.contentHash).sort(),
    downloadedBytes,
    stages: {
      downloaded: true,
      decoded: true,
      gpuUploaded: true,
      shadersWarmed: true
    }
  };
}

function validateLogicalPacks(packs: readonly ArenaContentPack[]) {
  const required = packs.filter((pack) => pack.required);
  const kinds = required.map((pack) => pack.kind).sort();
  if (
    required.length !== REQUIRED_PACK_KINDS.length ||
    kinds.join(",") !== [...REQUIRED_PACK_KINDS].sort().join(",")
  ) {
    throw new Error("Arena server did not provide the complete required pack set.");
  }
  if (new Set(required.map((pack) => pack.packId)).size !== required.length) {
    throw new Error("Arena server provided duplicate required packs.");
  }

  for (const pack of required) {
    if (!/^[0-9a-f]{64}$/.test(pack.contentHash)) {
      throw new Error(`Arena ${pack.kind} pack content hash is invalid.`);
    }
    if (!pack.packId || !Array.isArray(pack.labels) || pack.labels.length === 0) {
      throw new Error(`Arena ${pack.kind} pack identity is incomplete.`);
    }
  }
}

function assertPhaserTextureSurfaces(scene: Phaser.Scene) {
  const webgl = scene.game.renderer.type === Phaser.WEBGL;
  const invalid: string[] = [];
  for (const key of scene.textures.getTextureKeys()) {
    const texture = scene.textures.get(key);
    for (const source of texture.source) {
      if (!(source.width > 0) || !(source.height > 0) || (webgl && !source.glTexture)) {
        invalid.push(key);
        break;
      }
    }
  }
  if (invalid.length > 0) {
    throw new Error(
      `Arena texture decode/GPU upload is incomplete (${invalid.length}): ${invalid.slice(0, 8).join(", ")}`
    );
  }
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function webArenaTransferredBytes() {
  const assetExtension = /\.(?:avif|gif|jpe?g|png|webp|woff2?)(?:$|\?)/i;
  const bytes = performance
    .getEntriesByType("resource")
    .filter((entry): entry is PerformanceResourceTiming =>
      entry instanceof PerformanceResourceTiming && assetExtension.test(entry.name)
    )
    .reduce(
      (sum, entry) => sum + Math.max(entry.transferSize, entry.encodedBodySize),
      0
    );
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(bytes)));
}

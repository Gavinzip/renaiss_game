#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_ROOT = resolve(ROOT, "apps/client/public");
const MANIFEST_PATH = resolve(
  ROOT,
  "apps/client/src/game/assets/arenaSkillRuntimeManifest.json"
);
const REPORT_ROOT = resolve(
  ROOT,
  "docs/design/arena-dynamic-gameplay-review/",
  "configuration-gameplay-previews-cdn-20260817"
);
const BUCKET = process.env.R2_BUCKET || "renaiss-game-media";
const PREFIX = trimSlashes(process.env.R2_PREFIX || "renaiss-game");
const BASE_URL = trimTrailingSlash(
  process.env.R2_PUBLIC_BASE_URL ||
    "https://pub-043b57dfe27c4f7e9a469bbc5d7f33dc.r2.dev/renaiss-game"
);
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const EXPECTED_VIDEO_COUNT = 59;
const EXPECTED_IMAGE_COUNT = 1;
const DEFAULT_WORKERS = 4;

const MEDIA_TYPES = new Map([
  ["video/webm", "video/webm"],
  ["image/webp", "image/webp"],
  ["image/png", "image/png"],
  ["video/mp4", "video/mp4"]
]);

function parseArgs() {
  const raw = process.argv.slice(2);
  const options = {
    publish: false,
    verify: false,
    includeWebRuntime: false,
    skillIds: new Set(),
    roles: new Set(),
    reportPath: null
  };
  for (let index = 0; index < raw.length; index += 1) {
    const value = raw[index];
    if (value === "--publish") options.publish = true;
    else if (value === "--verify") options.verify = true;
    else if (value === "--include-web-runtime") options.includeWebRuntime = true;
    else if (value === "--skill-id" || value === "--role" || value === "--report") {
      const selected = raw[index + 1];
      if (!selected || selected.startsWith("--")) {
        throw new Error(`${value} requires a value`);
      }
      index += 1;
      if (value === "--skill-id") options.skillIds.add(selected);
      else if (value === "--role") options.roles.add(selected);
      else options.reportPath = selected;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  if (options.publish && options.verify) {
    throw new Error("Use either --publish or --verify, not both");
  }
  options.verify = options.publish || options.verify;
  return options;
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function publicFile(urlPath) {
  if (!urlPath.startsWith("/assets/")) {
    throw new Error(`Asset path is outside public assets: ${urlPath}`);
  }
  return resolve(PUBLIC_ROOT, urlPath.slice(1));
}

function objectKey(urlPath) {
  return `${PREFIX}/${urlPath.replace(/^\/+/, "")}`;
}

function publicUrl(asset) {
  return `${BASE_URL}${asset.urlPath}?v=${asset.sha256.slice(0, 12)}`;
}

async function addAsset(assetsByPath, candidate) {
  const { urlPath, expectedSha256 } = candidate;
  if (/\/(?:source|evidence|concept|candidate[^/]*)\//i.test(urlPath)) {
    throw new Error(`${candidate.id}: non-runtime media cannot be published`);
  }
  const file = publicFile(urlPath);
  const measuredSha256 = await sha256File(file);
  if (expectedSha256 && measuredSha256 !== expectedSha256) {
    throw new Error(`${candidate.id}: local asset SHA-256 drift`);
  }
  const existing = assetsByPath.get(urlPath);
  if (existing) {
    if (existing.sha256 !== measuredSha256) {
      throw new Error(`${candidate.id}: duplicate path has conflicting hashes`);
    }
    return;
  }
  const fileStat = await stat(file);
  assetsByPath.set(urlPath, {
    id: candidate.id,
    skillId: candidate.skillId || null,
    classId: candidate.classId || null,
    name: candidate.name,
    role: candidate.role,
    urlPath,
    file,
    sha256: measuredSha256,
    bytes: fileStat.size,
    mediaType: candidate.mediaType
  });
}

function collectManifestFiles(value, result, trail = "manifest") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectManifestFiles(entry, result, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (
    typeof value.file === "string" &&
    value.file.startsWith("/assets/arena-skills/") &&
    !/\/(?:source|evidence|concept|candidate[^/]*)\//i.test(value.file)
  ) {
    result.push({
      id: trail,
      name: trail,
      role: "skill-runtime",
      urlPath: value.file,
      expectedSha256: value.outputSha256 || value.sha256,
      mediaType: "image/png"
    });
  }
  for (const [key, child] of Object.entries(value)) {
    collectManifestFiles(child, result, `${trail}.${key}`);
  }
}

async function loadAssets(includeWebRuntime) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const assetsByPath = new Map();
  for (const entry of manifest.entries || []) {
    const urlPath = entry.previewFile;
    const sha256 = entry.previewFileSha256;
    const mediaType = entry.previewMediaType;
    if (!urlPath || !sha256 || !MEDIA_TYPES.has(mediaType)) {
      throw new Error(`${entry.skillId}: preview contract is incomplete`);
    }
    if (urlPath.endsWith("gameplay-hq.webm")) {
      throw new Error(`${entry.skillId}: legacy HQ preview is still referenced`);
    }
    await addAsset(assetsByPath, {
      id: entry.skillId,
      skillId: entry.skillId,
      classId: entry.classId,
      name: entry.name,
      role: "preview",
      urlPath,
      expectedSha256: sha256,
      mediaType: MEDIA_TYPES.get(mediaType)
    });
  }

  let assets = [...assetsByPath.values()];
  const videoCount = assets.filter((asset) => asset.mediaType === "video/webm").length;
  const imageCount = assets.filter((asset) => asset.mediaType === "image/webp").length;
  if (
    assets.length !== EXPECTED_VIDEO_COUNT + EXPECTED_IMAGE_COUNT ||
    videoCount !== EXPECTED_VIDEO_COUNT ||
    imageCount !== EXPECTED_IMAGE_COUNT
  ) {
    throw new Error(
      `Expected 59 WebM plus one WebP, found ${videoCount} WebM plus ${imageCount} WebP`
    );
  }

  if (includeWebRuntime) {
    for (const entry of [...(manifest.entries || []), ...(manifest.coreEntries || [])]) {
      await addAsset(assetsByPath, {
        id: `${entry.skillId}:icon`,
        skillId: entry.skillId,
        classId: entry.classId,
        name: `${entry.name} icon`,
        role: "skill-icon",
        urlPath: entry.iconFile,
        expectedSha256: entry.iconFileSha256,
        mediaType: "image/png"
      });
    }

    const manifestFiles = [];
    collectManifestFiles(manifest.entries || [], manifestFiles, "entries");
    collectManifestFiles(manifest.coreEntries || [], manifestFiles, "coreEntries");
    for (const contract of manifestFiles) {
      await addAsset(assetsByPath, contract);
    }

    const requiredPublicAssets = [
      ["arena-draw:warrior", "/assets/arena-draw/warrior-reveal.mp4", "video/mp4", "draw-video"],
      ["arena-draw:archer", "/assets/arena-draw/archer-reveal.mp4", "video/mp4", "draw-video"],
      ["arena-draw:engineer", "/assets/arena-draw/engineer-reveal.mp4", "video/mp4", "draw-video"],
      ["arena-draw:mage", "/assets/arena-draw/mage-reveal.mp4", "video/mp4", "draw-video"],
      ["generated:warrior-walk", "/assets/generated/characters/new-compatible/warrior/walk-8dir.png", "image/png", "character-runtime"],
      ["generated:warrior-melee", "/assets/generated/characters/new-compatible/warrior/melee-m1-8dir.png", "image/png", "character-runtime"],
      ["generated:archer-walk", "/assets/generated/characters/new-compatible/archer/walk-8dir.png", "image/png", "character-runtime"],
      ["generated:archer-moving-draw", "/assets/generated/characters/new-compatible/archer/moving-full-draw-8dir.png", "image/png", "character-runtime"],
      ["generated:archer-standing-draw", "/assets/generated/characters/new-compatible/archer/standing-full-draw-8dir.png", "image/png", "character-runtime"],
      ["generated:archer-roll", "/assets/generated/characters/new-compatible/archer/forest-roll-8dir.png", "image/png", "character-runtime"],
      ["generated:engineer-walk", "/assets/generated/characters/new-compatible/engineer/walk-8dir.png", "image/png", "character-runtime"],
      ["generated:mage-walk", "/assets/generated/characters/new-compatible/mage/walk-8dir.png", "image/png", "character-runtime"],
      ["generated:mage-cast", "/assets/generated/characters/new-compatible/mage/staff-cast-8dir.png", "image/png", "character-runtime"],
      ["generated:mage-fields", "/assets/generated/mage-field-effects.png", "image/png", "generated-runtime"],
      ["generated:arena-skill-icons-v2", "/assets/generated/arena-skill-icons-v2.png", "image/png", "generated-runtime"]
    ];
    for (const [id, urlPath, mediaType, role] of requiredPublicAssets) {
      await addAsset(assetsByPath, { id, name: id, role, urlPath, mediaType });
    }

    assets = [...assetsByPath.values()];
    const iconCount = assets.filter((asset) => asset.role === "skill-icon").length;
    const drawVideoCount = assets.filter((asset) => asset.role === "draw-video").length;
    const characterCount = assets.filter((asset) => asset.role === "character-runtime").length;
    if (iconCount !== 61 || drawVideoCount !== 4 || characterCount !== 9) {
      throw new Error(
        `Web runtime inventory drift: icons=${iconCount}, drawVideos=${drawVideoCount}, characters=${characterCount}`
      );
    }
  }
  return assets;
}

function uploadAsset(asset) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "npx",
      [
        "--yes",
        "wrangler@latest",
        "r2",
        "object",
        "put",
        `${BUCKET}/${objectKey(asset.urlPath)}`,
        "--remote",
        "--file",
        asset.file,
        "--content-type",
        asset.mediaType,
        "--cache-control",
        CACHE_CONTROL,
        "--force"
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          `${asset.id}: R2 upload failed (${code})\n${stdout}\n${stderr}`.trim()
        )
      );
    });
  });
}

async function runPool(items, workerCount, operation, progressLabel) {
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await operation(items[index]);
      completed += 1;
      if (completed % 10 === 0 || completed === items.length) {
        console.log(`${progressLabel} ${completed}/${items.length}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(workerCount, items.length) }, () => worker())
  );
}

async function verifyAsset(asset) {
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(publicUrl(asset), {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000)
      });
      if (response.ok || response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 500));
  }
  if (!response) throw lastError || new Error(`${asset.id}: verification failed`);

  const headers = {
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
    cacheControl: response.headers.get("cache-control"),
    etag: response.headers.get("etag"),
    cfCacheStatus: response.headers.get("cf-cache-status")
  };
  const failures = [];
  if (response.status !== 200) failures.push(`status-${response.status}`);
  if (headers.contentType !== asset.mediaType) failures.push("content-type");
  if (headers.cacheControl !== CACHE_CONTROL) failures.push("cache-control");
  if (Number(headers.contentLength) !== asset.bytes) failures.push("content-length");
  if (!headers.etag) failures.push("etag-missing");
  if (failures.length > 0) {
    throw new Error(`${asset.id}: remote verification failed: ${failures.join(", ")}`);
  }
  return {
    id: asset.id,
    skillId: asset.skillId,
    url: publicUrl(asset),
    status: response.status,
    bytes: asset.bytes,
    sha256: asset.sha256,
    ...headers
  };
}

async function main() {
  const args = parseArgs();
  const allAssets = await loadAssets(args.includeWebRuntime);
  const scoped = args.skillIds.size > 0 || args.roles.size > 0;
  const assets = allAssets.filter(
    (asset) =>
      (args.skillIds.size === 0 || args.skillIds.has(asset.skillId)) &&
      (args.roles.size === 0 || args.roles.has(asset.role))
  );
  if (assets.length === 0) {
    throw new Error("Scoped asset selection is empty");
  }
  const uploadAssets = args.includeWebRuntime && !scoped
    ? assets.filter((asset) => asset.role !== "preview")
    : assets;
  const releaseId = sha256Text(
    assets.map((asset) => `${asset.urlPath}:${asset.sha256}`).sort().join("\n")
  );
  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  console.log(
    `local GREEN: ${assets.length} ${args.includeWebRuntime ? "web runtime assets" : "previews"}; ` +
      `${(totalBytes / 1048576).toFixed(2)} MiB; ` +
      `release=${releaseId.slice(0, 16)}; fallbackUsed=false`
  );

  if (args.publish) {
    await runPool(uploadAssets, DEFAULT_WORKERS, uploadAsset, "uploaded");
  }

  let remote = [];
  if (args.verify) {
    const results = [];
    await runPool(
      assets,
      DEFAULT_WORKERS,
      async (asset) => {
        results.push(await verifyAsset(asset));
      },
      "verified"
    );
    remote = results.sort((left, right) => left.id.localeCompare(right.id));
  }

  const report = {
    schemaVersion: 1,
    status: args.verify ? "GREEN" : "LOCAL_GREEN",
    generatedAt: new Date().toISOString(),
    releaseId,
    bucket: BUCKET,
    prefix: PREFIX,
    publicBaseUrl: BASE_URL,
    publicEndpointKind: BASE_URL.includes(".r2.dev") ? "r2-dev-public-url" : "custom-domain",
    cacheControl: CACHE_CONTROL,
    scope: scoped
      ? "arena-scoped-publish"
      : args.includeWebRuntime
      ? "arena-web-runtime"
      : "arena-configuration-previews",
    assetCount: assets.length,
    uploadedAssetCount: args.publish ? uploadAssets.length : 0,
    videoCount: assets.filter((asset) => asset.mediaType === "video/webm").length,
    imageCount: assets.filter((asset) => asset.mediaType === "image/webp").length,
    totalBytes,
    assets: assets.map(({ file: _file, ...asset }) => ({
      ...asset,
      objectKey: objectKey(asset.urlPath),
      publicUrl: publicUrl(asset)
    })),
    remote,
    fallbackUsed: false
  };
  const reportPath = args.reportPath
    ? resolve(ROOT, args.reportPath)
    : resolve(
        REPORT_ROOT,
        scoped
          ? "cdn-scoped-publish-report.json"
          : args.includeWebRuntime
          ? "cdn-web-runtime-publish-report.json"
          : "cdn-publish-report.json"
      );
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`${report.status}: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

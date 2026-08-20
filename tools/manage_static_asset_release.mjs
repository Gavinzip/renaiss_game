#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_ROOT = resolve(ROOT, "apps/client/public");
const PUBLIC_ASSET_ROOT = resolve(PUBLIC_ROOT, "assets");
const ARENA_MANIFEST_PATH = resolve(
  ROOT,
  "apps/client/src/game/assets/arenaSkillRuntimeManifest.json"
);
const RELEASE_MANIFEST_PATH = resolve(
  ROOT,
  "apps/client/src/game/assets/staticAssetReleaseManifest.json"
);
const DIST_ROOT = resolve(ROOT, "apps/client/dist");
const BUCKET = process.env.R2_BUCKET || "renaiss-game-media";
const ROOT_PREFIX = trimSlashes(process.env.R2_PREFIX || "renaiss-game");
const PUBLIC_ORIGIN = trimTrailingSlash(
  process.env.R2_PUBLIC_ORIGIN ||
    "https://pub-043b57dfe27c4f7e9a469bbc5d7f33dc.r2.dev"
);
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const WORKERS = Math.max(1, Number(process.env.R2_WORKERS || 6));

const CONTENT_TYPES = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const EXCLUDED_NON_ARENA_PREFIXES = [
  "/assets/generated/arena-skill-previews/"
];
const EXCLUDED_NON_ARENA_FILES = new Set([
  "/assets/generated/arena-skill-catalog-icons.png",
  "/assets/generated/arena-skill-catalog-icons.manifest.json"
]);
const OFFLOADED_MEDIA_EXTENSIONS = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".png",
  ".svg",
  ".ttf",
  ".webm",
  ".webp",
  ".woff",
  ".woff2"
]);

function parseArgs() {
  const options = {
    audit: false,
    publish: false,
    verify: false,
    assertBuild: false,
    restore: false,
    reportPath: null
  };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--audit") options.audit = true;
    else if (value === "--publish") options.publish = true;
    else if (value === "--verify") options.verify = true;
    else if (value === "--assert-build") options.assertBuild = true;
    else if (value === "--restore") options.restore = true;
    else if (value === "--report") {
      const reportPath = args[index + 1];
      if (!reportPath || reportPath.startsWith("--")) {
        throw new Error("--report requires a path");
      }
      options.reportPath = resolve(ROOT, reportPath);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  const selected = [
    options.audit,
    options.publish,
    options.verify,
    options.assertBuild,
    options.restore
  ].filter(Boolean).length;
  if (selected !== 1) {
    throw new Error(
      "Select exactly one of --audit, --publish, --verify, --assert-build, or --restore"
    );
  }
  return options;
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeUrlPath(path) {
  if (!path.startsWith("/assets/")) {
    throw new Error(`Static asset is outside /assets: ${path}`);
  }
  return path.split("\\").join("/");
}

function isForbiddenRuntimePath(urlPath) {
  return /\/(?:source|evidence|concept|candidate[^/]*)\//i.test(urlPath);
}

function isExcludedNonArenaPath(urlPath) {
  return (
    EXCLUDED_NON_ARENA_FILES.has(urlPath) ||
    EXCLUDED_NON_ARENA_PREFIXES.some((prefix) => urlPath.startsWith(prefix))
  );
}

function contentTypeFor(urlPath) {
  const mediaType = CONTENT_TYPES.get(extname(urlPath).toLowerCase());
  if (!mediaType) {
    throw new Error(`No production content type is defined for ${urlPath}`);
  }
  return mediaType;
}

function localFileFor(urlPath) {
  return resolve(PUBLIC_ROOT, urlPath.slice(1));
}

function objectKey(releaseId, urlPath) {
  return `${ROOT_PREFIX}/releases/${releaseId}/${urlPath.replace(/^\/+/, "")}`;
}

function releaseBaseUrl(releaseId) {
  return `${PUBLIC_ORIGIN}/${ROOT_PREFIX}/releases/${releaseId}`;
}

async function listFiles(root) {
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);
  return files.sort();
}

function collectArenaManifestPaths(value, result) {
  if (Array.isArray(value)) {
    for (const child of value) collectArenaManifestPaths(child, result);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const key of ["previewFile", "iconFile", "file"]) {
    const path = value[key];
    if (
      typeof path === "string" &&
      path.startsWith("/assets/arena-skills/") &&
      !isForbiddenRuntimePath(path)
    ) {
      result.add(normalizeUrlPath(path));
    }
  }
  for (const child of Object.values(value)) {
    collectArenaManifestPaths(child, result);
  }
}

async function collectCanonicalUrlPaths() {
  const paths = new Set();
  const arenaManifest = JSON.parse(await readFile(ARENA_MANIFEST_PATH, "utf8"));
  collectArenaManifestPaths(arenaManifest.entries || [], paths);
  collectArenaManifestPaths(arenaManifest.coreEntries || [], paths);

  for (const file of await listFiles(PUBLIC_ASSET_ROOT)) {
    const urlPath = `/${relative(PUBLIC_ROOT, file).split(sep).join("/")}`;
    if (extname(urlPath).toLowerCase() === ".md") continue;
    if (urlPath.startsWith("/assets/arena-skills/")) continue;
    if (isForbiddenRuntimePath(urlPath) || isExcludedNonArenaPath(urlPath)) continue;
    paths.add(normalizeUrlPath(urlPath));
  }
  return [...paths].sort();
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function buildLocalRelease() {
  const assets = [];
  for (const urlPath of await collectCanonicalUrlPaths()) {
    const file = localFileFor(urlPath);
    let fileStat;
    try {
      fileStat = await stat(file);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`Canonical local asset is missing: ${urlPath}`);
      }
      throw error;
    }
    assets.push({
      urlPath,
      bytes: fileStat.size,
      sha256: await sha256File(file),
      contentType: contentTypeFor(urlPath),
      file
    });
  }
  const releaseId = createHash("sha256")
    .update(assets.map((asset) => `${asset.urlPath}:${asset.sha256}`).join("\n"))
    .digest("hex")
    .slice(0, 20);
  return {
    schemaVersion: 1,
    releaseId,
    publicBaseUrl: releaseBaseUrl(releaseId),
    bucket: BUCKET,
    rootPrefix: ROOT_PREFIX,
    cacheControl: CACHE_CONTROL,
    assetCount: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    fallbackUsed: false,
    assets
  };
}

function serializableRelease(release) {
  return {
    ...release,
    assets: release.assets.map(({ file: _file, ...asset }) => asset)
  };
}

async function writeReleaseManifest(release) {
  await writeFile(
    RELEASE_MANIFEST_PATH,
    `${JSON.stringify(serializableRelease(release), null, 2)}\n`,
    "utf8"
  );
}

function uploadAsset(release, asset) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "npx",
      [
        "--yes",
        "wrangler@latest",
        "r2",
        "object",
        "put",
        `${BUCKET}/${objectKey(release.releaseId, asset.urlPath)}`,
        "--remote",
        "--file",
        asset.file,
        "--content-type",
        asset.contentType,
        "--cache-control",
        CACHE_CONTROL,
        "--force"
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else {
        rejectPromise(
          new Error(
            `${asset.urlPath}: R2 upload failed (${code})\n${stdout}\n${stderr}`.trim()
          )
        );
      }
    });
  });
}

async function verifyAsset(release, asset) {
  const url = `${release.publicBaseUrl}${asset.urlPath}`;
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, {
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
  if (!response) throw lastError || new Error(`${url}: no response`);

  const contentType = response.headers.get("content-type")?.split(";")[0] || "";
  const cacheControl = response.headers.get("cache-control") || "";
  const contentLength = Number(response.headers.get("content-length"));
  const failures = [];
  if (response.status !== 200) failures.push(`status=${response.status}`);
  if (contentType !== asset.contentType) failures.push(`content-type=${contentType}`);
  if (cacheControl !== CACHE_CONTROL) failures.push(`cache-control=${cacheControl}`);
  if (contentLength !== asset.bytes) failures.push(`bytes=${contentLength}`);
  if (!response.headers.get("etag")) failures.push("etag=missing");
  if (failures.length > 0) {
    throw new Error(`${asset.urlPath}: remote verification failed (${failures.join(", ")})`);
  }
}

async function runPool(items, operation, label) {
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      await operation(items[index]);
      completed += 1;
      if (completed % 25 === 0 || completed === items.length) {
        console.log(`${label} ${completed}/${items.length}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(WORKERS, items.length) }, () => worker())
  );
}

async function readCheckedInRelease() {
  const release = JSON.parse(await readFile(RELEASE_MANIFEST_PATH, "utf8"));
  if (
    release.schemaVersion !== 1 ||
    !release.releaseId ||
    !release.publicBaseUrl ||
    release.fallbackUsed !== false ||
    release.assetCount !== release.assets?.length
  ) {
    throw new Error("Checked-in static asset release manifest is invalid");
  }
  return release;
}

async function restoreRelease(release) {
  await runPool(
    release.assets,
    async (asset) => {
      const target = localFileFor(asset.urlPath);
      const response = await fetch(`${release.publicBaseUrl}${asset.urlPath}`, {
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) {
        throw new Error(`${asset.urlPath}: restore failed (${response.status})`);
      }
      const data = Buffer.from(await response.arrayBuffer());
      const sha256 = createHash("sha256").update(data).digest("hex");
      if (data.byteLength !== asset.bytes || sha256 !== asset.sha256) {
        throw new Error(`${asset.urlPath}: restored bytes do not match manifest`);
      }
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    },
    "restored"
  );
}

async function assertProductionBuild() {
  const files = await listFiles(DIST_ROOT);
  const offloaded = files.filter((file) =>
    OFFLOADED_MEDIA_EXTENSIONS.has(extname(file).toLowerCase())
  );
  if (offloaded.length > 0) {
    throw new Error(
      `Production build contains ${offloaded.length} offloaded media files:\n` +
        offloaded
          .slice(0, 20)
          .map((file) => `  - ${relative(ROOT, file)}`)
          .join("\n")
    );
  }
  const release = await readCheckedInRelease();
  const cssFiles = files.filter((file) => extname(file).toLowerCase() === ".css");
  for (const cssFile of cssFiles) {
    const css = await readFile(cssFile, "utf8");
    if (/url\(\s*["']?\/assets\//.test(css)) {
      throw new Error(
        `Production CSS still contains a local /assets URL: ${relative(ROOT, cssFile)}`
      );
    }
  }

  const indexHtml = await readFile(join(DIST_ROOT, "index.html"), "utf8");
  const localMediaReference = indexHtml.match(
    /(?:src|href)=["']\/assets\/[^"']+\.(?:avif|gif|jpe?g|mp4|png|svg|ttf|webm|webp|woff2?)["']/i
  );
  if (localMediaReference) {
    throw new Error(
      `Production HTML still contains a local media URL: ${localMediaReference[0]}`
    );
  }

  const javascript = await Promise.all(
    files
      .filter((file) => extname(file).toLowerCase() === ".js")
      .map((file) => readFile(file, "utf8"))
  );
  if (
    !indexHtml.includes(release.publicBaseUrl) ||
    !javascript.some((body) => body.includes(release.publicBaseUrl))
  ) {
    throw new Error(
      `Production build is not pinned to static asset release ${release.releaseId}`
    );
  }
  console.log(
    `build GREEN: zero offloaded media or local media URLs; release=${release.releaseId}; ` +
      `cdnAssets=${release.assetCount}; fallbackUsed=false`
  );
}

async function writeReport(options, release, status) {
  if (!options.reportPath) return;
  await mkdir(dirname(options.reportPath), { recursive: true });
  await writeFile(
    options.reportPath,
    `${JSON.stringify(
      {
        status,
        generatedAt: new Date().toISOString(),
        ...serializableRelease(release)
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function main() {
  const options = parseArgs();
  if (options.assertBuild) {
    await assertProductionBuild();
    return;
  }
  if (options.verify || options.restore) {
    const release = await readCheckedInRelease();
    if (options.restore) {
      await restoreRelease(release);
      console.log(`restore GREEN: ${release.assetCount} assets; fallbackUsed=false`);
      return;
    }
    await runPool(release.assets, (asset) => verifyAsset(release, asset), "verified");
    await writeReport(options, release, "GREEN");
    console.log(
      `remote GREEN: ${release.assetCount} assets; release=${release.releaseId}; ` +
        `fallbackUsed=false`
    );
    return;
  }

  const release = await buildLocalRelease();
  console.log(
    `local GREEN: ${release.assetCount} assets; ` +
      `${(release.totalBytes / 1048576).toFixed(2)} MiB; ` +
      `release=${release.releaseId}; fallbackUsed=false`
  );
  if (options.audit) {
    await writeReport(options, release, "LOCAL_GREEN");
    return;
  }

  await runPool(release.assets, (asset) => uploadAsset(release, asset), "uploaded");
  await runPool(release.assets, (asset) => verifyAsset(release, asset), "verified");
  await writeReleaseManifest(release);
  await writeReport(options, release, "GREEN");
  console.log(
    `publish GREEN: ${release.assetCount} assets; release=${release.releaseId}; ` +
      `manifest=${relative(ROOT, RELEASE_MANIFEST_PATH)}; fallbackUsed=false`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

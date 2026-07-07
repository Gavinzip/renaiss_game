import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ASSET_DIR = resolve(ROOT, "apps/client/public/assets");
const BUCKET = process.env.R2_BUCKET || "renaiss-game-media";
const PREFIX = trimSlashes(process.env.R2_PREFIX || "renaiss-game");
const CACHE_CONTROL = process.env.R2_CACHE_CONTROL || "public, max-age=31536000, immutable";

const CONTENT_TYPES = new Map([
  [".json", "application/json"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".webp", "image/webp"]
]);

function listFiles(dir) {
  const files = [];

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      files.push(path);
    }
  }

  walk(dir);
  return files.sort();
}

function contentTypeFor(path) {
  const match = path.match(/\.[^.]+$/);
  return match ? CONTENT_TYPES.get(match[0].toLowerCase()) || "application/octet-stream" : "application/octet-stream";
}

function objectKeyFor(path) {
  const rel = relative(resolve(ROOT, "apps/client/public"), path).split(sep).join("/");
  return `${PREFIX}/${rel}`;
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

const files = listFiles(ASSET_DIR);
let bytes = 0;

for (const [index, file] of files.entries()) {
  const objectPath = `${BUCKET}/${objectKeyFor(file)}`;
  const size = statSync(file).size;
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "wrangler@latest",
      "r2",
      "object",
      "put",
      objectPath,
      "--remote",
      "--file",
      file,
      "--content-type",
      contentTypeFor(file),
      "--cache-control",
      CACHE_CONTROL
    ],
    { cwd: ROOT, stdio: index % 10 === 9 ? "inherit" : "pipe" }
  );

  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }

  bytes += size;
  if ((index + 1) % 10 === 0) {
    console.log(`uploaded ${index + 1}/${files.length} assets`);
  }
}

console.log(`uploaded ${files.length} assets to ${BUCKET}/${PREFIX} (${bytes} bytes)`);

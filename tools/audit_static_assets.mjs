import { readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_GENERATED_DIR = resolve(ROOT, "apps/client/public/assets/generated");
const DIST_ASSETS_DIR = resolve(ROOT, "apps/client/dist/assets");
const MAX_LISTED_ASSETS = 16;

function listFiles(dir) {
  const files = [];

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      files.push(path);
    }
  }

  walk(dir);
  return files;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function isForbiddenPublicSource(path) {
  const normalized = path.split(sep).join("/");
  const fileName = normalized.split("/").at(-1) ?? "";
  return (
    normalized.includes("/source/") ||
    fileName.includes("-source") ||
    fileName.includes("-ai-source") ||
    fileName.includes("source-v")
  );
}

function auditForbiddenSourceFiles(label, dir) {
  const forbidden = listFiles(dir).filter(isForbiddenPublicSource);
  if (forbidden.length === 0) return [];

  return forbidden.map((path) => `${label}: ${relative(ROOT, path)}`);
}

function printLargestAssets(dir) {
  const entries = listFiles(dir)
    .map((path) => ({ path, size: statSync(path).size }))
    .sort((a, b) => b.size - a.size);

  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  console.log(`Static asset audit: ${relative(ROOT, dir)} total ${formatBytes(total)}`);
  for (const entry of entries.slice(0, MAX_LISTED_ASSETS)) {
    console.log(`  ${formatBytes(entry.size).padStart(8)}  ${relative(ROOT, entry.path)}`);
  }
}

const failures = [
  ...auditForbiddenSourceFiles("public generated source asset", PUBLIC_GENERATED_DIR)
];

try {
  failures.push(...auditForbiddenSourceFiles("dist source asset", DIST_ASSETS_DIR));
  printLargestAssets(DIST_ASSETS_DIR);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.log("Static asset audit: dist is not built yet; checked public generated assets only.");
}

if (failures.length > 0) {
  console.error("Static asset audit failed. Move non-runtime source art out of public/dist:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

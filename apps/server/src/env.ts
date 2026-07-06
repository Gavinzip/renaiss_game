import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadServerEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "../../..");
  const candidates = [
    path.resolve(root, ".env"),
    path.resolve(root, ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local")
  ];

  for (const filePath of [...new Set(candidates)]) {
    loadEnvFile(filePath);
  }
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    process.env[key] = normalizeEnvValue(line.slice(separator + 1).trim());
  }
}

function normalizeEnvValue(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const env = {
  ...readEnvFile(path.join(root, ".env")),
  ...readEnvFile(path.join(root, ".env.local")),
  ...process.env
};

const requiredSecrets = ["X_CONSUMER_KEY", "X_CONSUMER_SECRET", "AUTH_SESSION_SECRET"];
const requiredUrls = ["X_CALLBACK_URL", "CLIENT_ORIGIN", "VITE_GAME_SERVER_URL"];
let failed = false;
let missingSecret = false;
const devBypass = env.DEV_AUTH_BYPASS === "1";

console.log("Renaiss local config check");
console.log("");

for (const key of requiredSecrets) {
  const present = Boolean(env[key]?.trim());
  console.log(`${present ? "ok" : "missing"} ${key}`);
  missingSecret = missingSecret || !present;
}

for (const key of requiredUrls) {
  const value = env[key]?.trim();
  const present = Boolean(value);
  console.log(`${present ? "ok" : "missing"} ${key}${present ? `=${value}` : ""}`);
  failed = failed || !present;
}

const callbackUrl = env.X_CALLBACK_URL?.trim();
if (callbackUrl && !callbackUrl.endsWith("/api/auth/x/callback")) {
  console.log("warning X_CALLBACK_URL should end with /api/auth/x/callback");
}

const clientOrigin = env.CLIENT_ORIGIN?.trim();
if (clientOrigin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/.test(clientOrigin)) {
  console.log("warning CLIENT_ORIGIN is not a localhost origin");
}

console.log("");
failed = failed || (missingSecret && !devBypass);
if (failed) {
  console.log("Not ready: copy .env.example to .env.local and fill the missing local values.");
  process.exitCode = 1;
} else if (missingSecret && devBypass) {
  console.log("Playable: DEV_AUTH_BYPASS=1 is enabled for localhost. This is not real X OAuth.");
} else {
  console.log("Ready: local X login config is present. Values were not printed.");
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    values[key] = normalizeValue(line.slice(separator + 1).trim());
  }
  return values;
}

function normalizeValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

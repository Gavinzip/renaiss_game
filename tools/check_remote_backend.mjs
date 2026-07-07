const remoteBaseUrl = trimTrailingSlash(process.env.RENAISS_REMOTE_BACKEND_URL || "https://renaiss-game.zeabur.app");
const localOrigin = process.env.RENAISS_LOCAL_DEV_ORIGIN || "http://127.0.0.1:5173";

console.log("Renaiss remote backend check");
console.log(`backend=${remoteBaseUrl}`);
console.log(`origin=${localOrigin}`);

const health = await getJson(`${remoteBaseUrl}/health`, { headers: { Origin: localOrigin } });
if (!health.ok) fail("Remote backend health payload did not return ok=true.");

const storage = health.storage ?? {};
if (typeof storage.rpgProfileDb !== "string" || !storage.rpgProfileDb.startsWith("/data/renaiss-game/")) {
  fail(`Remote backend is not using the expected /data/renaiss-game SQLite path: ${JSON.stringify(storage)}`);
}

if (storage.persistentVolumeExpected && storage.dataRootMountDetected !== true) {
  fail("Remote backend is configured for /data, but /health does not detect /data as a mounted volume.");
}

const sessionResponse = await fetch(`${remoteBaseUrl}/api/auth/session`, {
  headers: { Origin: localOrigin }
});
if (!sessionResponse.ok) fail(`Auth session check failed with HTTP ${sessionResponse.status}.`);

const allowOrigin = sessionResponse.headers.get("access-control-allow-origin");
const allowCredentials = sessionResponse.headers.get("access-control-allow-credentials");
if (allowOrigin !== localOrigin) fail(`CORS allow-origin mismatch: expected ${localOrigin}, got ${allowOrigin}`);
if (allowCredentials !== "true") fail(`CORS credentials mismatch: expected true, got ${allowCredentials}`);

console.log("ok remote backend health, /data storage path, and local-dev CORS are configured.");

async function getJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) fail(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function fail(message) {
  console.error(`failed ${message}`);
  process.exit(1);
}

const DEFAULT_PUBLIC_ORIGIN = "https://renaiss-game.zeabur.app";

export function resolveCorsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: string | boolean) => void) {
  if (!origin) {
    callback(null, false);
    return;
  }

  if (isAllowedOrigin(origin)) {
    callback(null, origin);
    return;
  }

  callback(new Error(`Origin is not allowed by Renaiss CORS policy: ${origin}`));
}

export function allowedOriginList() {
  return [...configuredOrigins()];
}

function isAllowedOrigin(origin: string) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (configuredOrigins().has(normalized)) return true;
  return isLocalhostOrigin(normalized);
}

function configuredOrigins() {
  const origins = new Set<string>();
  for (const value of [
    DEFAULT_PUBLIC_ORIGIN,
    process.env.SERVER_PUBLIC_ORIGIN,
    process.env.CLIENT_ORIGIN,
    process.env.LOCAL_DEV_ORIGINS
  ]) {
    for (const origin of splitOriginList(value)) {
      const normalized = normalizeOrigin(origin);
      if (normalized) origins.add(normalized);
    }
  }
  return origins;
}

function splitOriginList(value: string | undefined) {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

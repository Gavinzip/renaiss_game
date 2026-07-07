export function gameServerUrl() {
  const configured = (import.meta.env.VITE_GAME_SERVER_URL as string | undefined)?.trim();
  if (configured) return trimTrailingSlash(configured);

  if (typeof window === "undefined") return "";

  if (import.meta.env.DEV) {
    return ["http://localhost", "8787"].join(":");
  }

  return window.location.origin;
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function gameServerUrl() {
  return (import.meta.env.VITE_GAME_SERVER_URL as string | undefined) ?? "http://localhost:8787";
}

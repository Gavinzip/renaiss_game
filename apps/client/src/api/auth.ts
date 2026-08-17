import { gameServerUrl } from "./gameServer";

export interface XAuthUser {
  provider: "x" | "dev";
  id: string;
  username: string;
  displayName: string;
}

export interface XAuthSession {
  authenticated: boolean;
  configured: boolean;
  user: XAuthUser | null;
}

interface ArenaSocketTicketResponse {
  success?: boolean;
  reason?: string;
  ticket?: unknown;
  expiresAt?: unknown;
}

export async function fetchXAuthSession() {
  const response = await fetch(`${gameServerUrl()}/api/auth/session`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error("Unable to read X session.");
  return (await response.json()) as XAuthSession;
}

export async function fetchArenaSocketTicket() {
  const response = await fetch(`${gameServerUrl()}/api/auth/arena-socket-ticket`, {
    credentials: "include",
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as ArenaSocketTicketResponse | null;
  if (
    !response.ok ||
    !payload?.success ||
    typeof payload.ticket !== "string" ||
    !payload.ticket ||
    !Number.isSafeInteger(payload.expiresAt) ||
    Number(payload.expiresAt) <= Date.now()
  ) {
    throw new Error(payload?.reason || `Arena socket authorization failed (${response.status}).`);
  }
  return payload.ticket;
}

export async function logoutXSession() {
  const response = await fetch(`${gameServerUrl()}/api/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) throw new Error("Unable to sign out.");
}

export function xLoginStartUrl(returnTo = window.location.href) {
  const url = new URL(`${gameServerUrl()}/api/auth/x/start`);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

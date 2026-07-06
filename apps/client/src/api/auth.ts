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

export async function fetchXAuthSession() {
  const response = await fetch(`${gameServerUrl()}/api/auth/session`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error("Unable to read X session.");
  return (await response.json()) as XAuthSession;
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

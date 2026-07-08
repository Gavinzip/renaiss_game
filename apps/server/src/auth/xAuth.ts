import crypto from "node:crypto";
import type { Express, Request, Response } from "express";

interface XOAuthStateRecord {
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

interface XSessionPayload {
  provider: "x";
  userId: string;
  username: string;
  issuedAt: number;
}

interface AuthUser {
  provider: "x" | "dev";
  id: string;
  username: string;
  displayName: string;
}

const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_USERINFO_URL = "https://api.x.com/2/users/me";
const SESSION_COOKIE_NAME = "renaiss_x_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_X_OAUTH_SCOPE = "users.read tweet.read";
const oauthStates = new Map<string, XOAuthStateRecord>();

export function installXAuthRoutes(app: Express) {
  app.get("/api/auth/session", (req, res) => {
    const user = readXSession(req) ?? readDevAuthUser(req);
    res.json({
      authenticated: Boolean(user),
      configured: isXAuthConfigured() || isDevAuthEnabled(req),
      user
    });
  });

  app.get("/api/auth/x/start", async (req, res) => {
    const config = readXAuthConfig();
    const returnTo = sanitizeReturnTo(req.query.returnTo, req);
    if (!config) {
      if (isDevAuthEnabled(req)) {
        redirectWithAuthSuccess(res, returnTo);
        return;
      }
      redirectWithAuthError(res, returnTo, "x_auth_not_configured");
      return;
    }

    try {
      pruneOAuthStates();
      const callbackUrl = config.callbackUrl ?? callbackUrlFromRequest(req);
      const state = randomBase64Url(32);
      const codeVerifier = randomBase64Url(64);
      oauthStates.set(state, {
        codeVerifier,
        returnTo,
        createdAt: Date.now()
      });
      const authorizeUrl = new URL(X_AUTHORIZE_URL);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("client_id", config.clientId);
      authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
      authorizeUrl.searchParams.set("scope", config.scope);
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
      authorizeUrl.searchParams.set("code_challenge_method", "S256");
      res.redirect(authorizeUrl.toString());
    } catch (error) {
      console.error("X login start failed", error);
      redirectWithAuthError(res, returnTo, "x_login_start_failed");
    }
  });

  app.get("/api/auth/x/callback", async (req, res) => {
    const config = readXAuthConfig();
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error : "";
    const record = oauthStates.get(state);
    const returnTo = record?.returnTo ?? defaultClientOrigin();

    if (!config) {
      redirectWithAuthError(res, returnTo, "x_auth_not_configured");
      return;
    }
    if (oauthError) {
      oauthStates.delete(state);
      redirectWithAuthError(res, returnTo, "x_login_denied");
      return;
    }
    if (!code || !state || !record || Date.now() - record.createdAt > OAUTH_STATE_MAX_AGE_MS) {
      oauthStates.delete(state);
      redirectWithAuthError(res, returnTo, "x_oauth_state_invalid");
      return;
    }

    try {
      const callbackUrl = config.callbackUrl ?? callbackUrlFromRequest(req);
      const accessToken = await exchangeXOAuthToken(config, code, callbackUrl, record.codeVerifier);
      const profile = await fetchXProfile(accessToken.accessToken);
      oauthStates.delete(state);
      setXSessionCookie(res, req, {
        provider: "x",
        userId: profile.id,
        username: profile.username,
        issuedAt: Date.now()
      });
      redirectWithAuthSuccess(res, returnTo);
    } catch (error) {
      console.error("X login callback failed", error);
      oauthStates.delete(state);
      redirectWithAuthError(res, returnTo, "x_login_callback_failed");
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    clearXSessionCookie(res, req);
    res.json({ success: true });
  });
}

function readXAuthConfig() {
  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !sessionSecret) return null;
  return {
    clientId,
    clientSecret,
    sessionSecret,
    scope: normalizeXOAuthScope(process.env.X_OAUTH_SCOPE),
    callbackUrl: process.env.X_CALLBACK_URL?.trim() || null
  };
}

function isXAuthConfigured() {
  return Boolean(readXAuthConfig());
}

async function exchangeXOAuthToken(
  config: NonNullable<ReturnType<typeof readXAuthConfig>>,
  code: string,
  callbackUrl: string,
  codeVerifier: string
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
    code_verifier: codeVerifier,
    client_id: config.clientId
  });
  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`token_exchange_failed:${response.status}:${text.slice(0, 160)}`);
  const payload = parseJson<{ access_token?: string; token_type?: string }>(text);
  if (!payload.access_token) {
    throw new Error("token_exchange_missing_access_token");
  }
  return { accessToken: payload.access_token };
}

async function fetchXProfile(accessToken: string) {
  const url = new URL(X_USERINFO_URL);
  url.searchParams.set("user.fields", "name,username");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`userinfo_failed:${response.status}:${text.slice(0, 160)}`);
  const payload = parseJson<{ data?: { id?: string; username?: string; name?: string } }>(text);
  const id = payload.data?.id;
  const username = payload.data?.username;
  if (!id || !username) throw new Error("userinfo_missing_user_identity");
  return { id, username };
}

function normalizeXOAuthScope(value: string | undefined) {
  const scope = value?.trim().replace(/\s+/g, " ");
  return scope || DEFAULT_X_OAUTH_SCOPE;
}

function randomBase64Url(bytes: number) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function pkceChallenge(codeVerifier: string) {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("x_oauth_invalid_json_response");
  }
}

function readXSession(req: Request): AuthUser | null {
  const cookie = readCookies(req)[SESSION_COOKIE_NAME];
  const config = readXAuthConfig();
  if (!cookie || !config) return null;
  const [encodedPayload, signature] = cookie.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = signSession(encodedPayload, config.sessionSecret);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as XSessionPayload;
    if (payload.provider !== "x" || !payload.userId || !payload.username) return null;
    if (Date.now() - payload.issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;
    return {
      provider: payload.provider,
      id: payload.userId,
      username: payload.username,
      displayName: `@${payload.username}`
    };
  } catch {
    return null;
  }
}

function readDevAuthUser(req: Request): AuthUser | null {
  if (!isDevAuthEnabled(req)) return null;
  const username = process.env.DEV_AUTH_USERNAME?.trim() || "RegionsPlay7941";
  return {
    provider: "dev",
    id: process.env.DEV_AUTH_USER_ID?.trim() || "local-dev",
    username,
    displayName: `@${username}`
  };
}

function isDevAuthEnabled(req: Request) {
  return process.env.DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production" && isLocalhostHost(req.hostname);
}

function setXSessionCookie(res: Response, req: Request, payload: XSessionPayload) {
  const config = readXAuthConfig();
  if (!config) return;
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signSession(encodedPayload, config.sessionSecret);
  const cookie = `${SESSION_COOKIE_NAME}=${encodedPayload}.${signature}; Path=/; HttpOnly; Max-Age=${SESSION_MAX_AGE_SECONDS}${sessionCookieAttributes(req)}`;
  res.setHeader("Set-Cookie", cookie);
}

function clearXSessionCookie(res: Response, req: Request) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0${sessionCookieAttributes(req)}`);
}

function signSession(encodedPayload: string, sessionSecret: string) {
  return crypto.createHmac("sha256", sessionSecret).update(encodedPayload).digest("base64url");
}

function readCookies(req: Request) {
  const header = req.headers.cookie ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        if (separator === -1) return [cookie, ""];
        return [cookie.slice(0, separator), decodeURIComponent(cookie.slice(separator + 1))];
      })
  );
}

function sessionCookieAttributes(req: Request) {
  const sameSite = authCookieSameSite();
  const secure = sameSite === "None" || process.env.AUTH_COOKIE_SECURE === "1" || req.secure || req.headers["x-forwarded-proto"] === "https";
  return `; SameSite=${sameSite}${secure ? "; Secure" : ""}`;
}

function authCookieSameSite(): "Lax" | "Strict" | "None" {
  const configured = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (configured === "none") return "None";
  if (configured === "strict") return "Strict";
  return "Lax";
}

function sanitizeReturnTo(value: unknown, req: Request) {
  const fallback = defaultClientOrigin();
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value);
    const allowedOrigins = new Set([fallback, req.get("origin"), process.env.CLIENT_ORIGIN].filter(Boolean));
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    if (!allowedOrigins.has(url.origin) && !isLocalhostOrigin(url)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function isLocalhostOrigin(url: URL) {
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function isLocalhostHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function redirectWithAuthSuccess(res: Response, returnTo: string) {
  const url = new URL(returnTo);
  url.searchParams.delete("auth_error");
  url.searchParams.set("auth", "success");
  res.redirect(url.toString());
}

function redirectWithAuthError(res: Response, returnTo: string, reason: string) {
  const url = new URL(returnTo);
  url.searchParams.delete("auth");
  url.searchParams.set("auth_error", reason);
  res.redirect(url.toString());
}

function callbackUrlFromRequest(req: Request) {
  const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : req.protocol;
  return `${protocol}://${req.get("host")}/api/auth/x/callback`;
}

function defaultClientOrigin() {
  return process.env.CLIENT_ORIGIN?.trim() || "http://127.0.0.1:5173";
}

function pruneOAuthStates() {
  const now = Date.now();
  for (const [state, record] of oauthStates) {
    if (now - record.createdAt > OAUTH_STATE_MAX_AGE_MS) oauthStates.delete(state);
  }
}

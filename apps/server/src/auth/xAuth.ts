import crypto from "node:crypto";
import type { Express, Request, Response } from "express";

interface XRequestTokenRecord {
  secret: string;
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

const X_REQUEST_TOKEN_URL = "https://api.x.com/oauth/request_token";
const X_AUTHENTICATE_URL = "https://api.x.com/oauth/authenticate";
const X_ACCESS_TOKEN_URL = "https://api.x.com/oauth/access_token";
const SESSION_COOKIE_NAME = "renaiss_x_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const REQUEST_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;
const requestTokens = new Map<string, XRequestTokenRecord>();

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
      pruneRequestTokens();
      const callbackUrl = config.callbackUrl ?? callbackUrlFromRequest(req);
      const payload = await requestXToken(config, callbackUrl);
      requestTokens.set(payload.oauthToken, {
        secret: payload.oauthTokenSecret,
        returnTo,
        createdAt: Date.now()
      });
      const authorizeUrl = new URL(X_AUTHENTICATE_URL);
      authorizeUrl.searchParams.set("oauth_token", payload.oauthToken);
      res.redirect(authorizeUrl.toString());
    } catch (error) {
      console.error("X login start failed", error);
      redirectWithAuthError(res, returnTo, "x_login_start_failed");
    }
  });

  app.get("/api/auth/x/callback", async (req, res) => {
    const config = readXAuthConfig();
    const oauthToken = typeof req.query.oauth_token === "string" ? req.query.oauth_token : "";
    const oauthVerifier = typeof req.query.oauth_verifier === "string" ? req.query.oauth_verifier : "";
    const record = requestTokens.get(oauthToken);
    const returnTo = record?.returnTo ?? defaultClientOrigin();

    if (!config) {
      redirectWithAuthError(res, returnTo, "x_auth_not_configured");
      return;
    }
    if (!oauthToken || !oauthVerifier || !record || Date.now() - record.createdAt > REQUEST_TOKEN_MAX_AGE_MS) {
      requestTokens.delete(oauthToken);
      redirectWithAuthError(res, returnTo, "x_oauth_state_invalid");
      return;
    }

    try {
      const accessToken = await exchangeXAccessToken(config, oauthToken, oauthVerifier, record.secret);
      requestTokens.delete(oauthToken);
      setXSessionCookie(res, req, {
        provider: "x",
        userId: accessToken.userId,
        username: accessToken.screenName,
        issuedAt: Date.now()
      });
      redirectWithAuthSuccess(res, returnTo);
    } catch (error) {
      console.error("X login callback failed", error);
      requestTokens.delete(oauthToken);
      redirectWithAuthError(res, returnTo, "x_login_callback_failed");
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    clearXSessionCookie(res, req);
    res.json({ success: true });
  });
}

function readXAuthConfig() {
  const consumerKey = process.env.X_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.X_CONSUMER_SECRET?.trim();
  const sessionSecret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!consumerKey || !consumerSecret || !sessionSecret) return null;
  return {
    consumerKey,
    consumerSecret,
    sessionSecret,
    callbackUrl: process.env.X_CALLBACK_URL?.trim() || null
  };
}

function isXAuthConfigured() {
  return Boolean(readXAuthConfig());
}

async function requestXToken(config: NonNullable<ReturnType<typeof readXAuthConfig>>, callbackUrl: string) {
  const oauthParams = baseOAuthParams(config.consumerKey, { oauth_callback: callbackUrl });
  const response = await fetch(X_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: oauthAuthorizationHeader("POST", X_REQUEST_TOKEN_URL, oauthParams, config.consumerSecret)
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`request_token_failed:${response.status}:${text.slice(0, 160)}`);
  const params = new URLSearchParams(text);
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");
  if (!oauthToken || !oauthTokenSecret || params.get("oauth_callback_confirmed") !== "true") {
    throw new Error("request_token_missing_fields");
  }
  return { oauthToken, oauthTokenSecret };
}

async function exchangeXAccessToken(config: NonNullable<ReturnType<typeof readXAuthConfig>>, oauthToken: string, oauthVerifier: string, tokenSecret: string) {
  const oauthParams = baseOAuthParams(config.consumerKey, {
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier
  });
  const response = await fetch(X_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: oauthAuthorizationHeader("POST", X_ACCESS_TOKEN_URL, oauthParams, config.consumerSecret, tokenSecret)
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`access_token_failed:${response.status}:${text.slice(0, 160)}`);
  const params = new URLSearchParams(text);
  const userId = params.get("user_id");
  const screenName = params.get("screen_name");
  if (!userId || !screenName) throw new Error("access_token_missing_user_identity");
  return { userId, screenName };
}

function baseOAuthParams(consumerKey: string, extra: Record<string, string> = {}) {
  return {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extra
  };
}

function oauthAuthorizationHeader(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret = "") {
  const signingParams = {
    ...params,
    oauth_signature: oauthSignature(method, url, params, consumerSecret, tokenSecret)
  };
  const header = Object.entries(signingParams)
    .filter(([key]) => key.startsWith("oauth_"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ");
  return `OAuth ${header}`;
}

function oauthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string) {
  const parameterString = Object.entries(params)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyCompare = percentEncode(leftKey).localeCompare(percentEncode(rightKey));
      return keyCompare === 0 ? percentEncode(leftValue).localeCompare(percentEncode(rightValue)) : keyCompare;
    })
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
  const signatureBase = [method.toUpperCase(), percentEncode(url), percentEncode(parameterString)].join("&");
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");
}

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
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
  const cookie = `${SESSION_COOKIE_NAME}=${encodedPayload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureCookieSuffix(req)}`;
  res.setHeader("Set-Cookie", cookie);
}

function clearXSessionCookie(res: Response, req: Request) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix(req)}`);
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

function secureCookieSuffix(req: Request) {
  return process.env.AUTH_COOKIE_SECURE === "1" || req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
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

function pruneRequestTokens() {
  const now = Date.now();
  for (const [token, record] of requestTokens) {
    if (now - record.createdAt > REQUEST_TOKEN_MAX_AGE_MS) requestTokens.delete(token);
  }
}

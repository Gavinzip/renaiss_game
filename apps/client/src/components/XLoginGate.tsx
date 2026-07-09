import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchXAuthSession, logoutXSession, xLoginStartUrl, type XAuthSession } from "../api/auth";
import { staticAssetUrl } from "../game/assets/staticAssets";
import { useArenaI18n, type ArenaText } from "../i18n/arena";

const ENTERED_SESSION_KEY = "renaiss:x-login-entered:v1";
type XAuthErrorReason = "x_auth_not_configured" | "x_login_start_failed" | "x_oauth_state_invalid" | "x_login_callback_failed";

interface XLoginGateProps {
  children: ReactNode | ((session: XAuthSession & { authenticated: true; user: NonNullable<XAuthSession["user"]> }) => ReactNode);
}

export function XLoginGate({ children }: XLoginGateProps) {
  const [session, setSession] = useState<XAuthSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [entered, setEntered] = useState(false);
  const { t } = useArenaI18n();
  const authError = useMemo(() => authErrorFromUrl(), []);
  const authErrorMessage = authError ? authErrorMessageFromReason(authError, t) : null;

  useEffect(() => {
    let alive = true;
    fetchXAuthSession()
      .then((nextSession) => {
        if (!alive) return;
        setSession(nextSession);
        setEntered(isEnteredSession(nextSession));
        setStatus("ready");
        cleanAuthQuery();
      })
      .catch((nextError) => {
        if (!alive) return;
        console.warn("Unable to read X session.", nextError);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const retry = () => {
    setStatus("loading");
    fetchXAuthSession()
      .then((nextSession) => {
        setSession(nextSession);
        setEntered(isEnteredSession(nextSession));
        setStatus("ready");
        cleanAuthQuery();
      })
      .catch((nextError) => {
        console.warn("Unable to read X session.", nextError);
        setStatus("error");
      });
  };

  if (status === "loading") {
    return <XLoginScreen mode="loading" />;
  }

  if (status === "error") {
    return <XLoginScreen mode="error" message={t.ui.xSessionReadError} onRetry={retry} />;
  }

  if (session?.authenticated && session.user) {
    const user = session.user;
    if (!entered) {
      return (
        <XLoginScreen
          mode="continue"
          user={user}
          onContinue={() => {
            rememberEnteredSession(user);
            setEntered(true);
          }}
          onSignOut={async () => {
            await logoutXSession();
            clearEnteredSession();
            setEntered(false);
            setSession({ authenticated: false, configured: true, user: null });
          }}
        />
      );
    }
    return typeof children === "function" ? children({ ...session, authenticated: true, user: session.user }) : children;
  }

  return <XLoginScreen mode="login" configured={session?.configured ?? false} message={authErrorMessage} />;
}

function XLoginScreen({
  mode,
  configured = true,
  message,
  onRetry,
  onContinue,
  onSignOut,
  user
}: {
  mode: "loading" | "login" | "continue" | "error";
  configured?: boolean;
  message?: string | null;
  onRetry?: () => void;
  onContinue?: () => void;
  onSignOut?: () => void | Promise<void>;
  user?: NonNullable<XAuthSession["user"]>;
}) {
  const { t } = useArenaI18n();
  const signIn = () => {
    window.location.assign(xLoginStartUrl());
  };

  return (
    <main className="x-login-page" aria-label={t.ui.xLoginAria}>
      <div className="x-login-brand">
        <img src={staticAssetUrl("/assets/generated/vinci-favicon.png")} alt="" />
        <div>
          <span>renaiss</span>
          <h1>Renaiss World</h1>
        </div>
      </div>

      <section className="x-login-controls" aria-label={t.ui.xSignInAria}>
        {mode === "loading" ? (
          <button type="button" className="x-login-button is-loading" disabled>
            <span>X</span>
            {t.ui.checkingSession}
          </button>
        ) : null}

        {mode === "error" ? (
          <>
            <div className="x-login-message" role="alert">
              {message}
            </div>
            <button type="button" className="x-login-button" onClick={onRetry}>
              <span>R</span>
              {t.ui.retry}
            </button>
          </>
        ) : null}

        {mode === "login" ? (
          <>
            <button type="button" className="x-login-button" onClick={signIn} disabled={!configured}>
              <span>X</span>
              {t.ui.continueWithX}
            </button>
            {!configured ? <div className="x-login-message">{t.ui.xLoginNotConfigured}</div> : null}
            {message ? <div className="x-login-message" role="alert">{message}</div> : null}
          </>
        ) : null}

        {mode === "continue" && user ? (
          <>
            <button type="button" className="x-login-button" onClick={onContinue}>
              <span>{user.provider === "dev" ? "DEV" : "X"}</span>
              {t.ui.continueAs(user.username)}
            </button>
            <button type="button" className="x-login-button x-login-button-secondary" onClick={onSignOut}>
              <span>-</span>
              {t.ui.signOut}
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

function enteredSessionValue(user: NonNullable<XAuthSession["user"]>) {
  return `${user.provider}:${user.id}`;
}

function isEnteredSession(session: XAuthSession | null) {
  if (!session?.authenticated || !session.user) return false;
  try {
    return window.sessionStorage.getItem(ENTERED_SESSION_KEY) === enteredSessionValue(session.user);
  } catch {
    return false;
  }
}

function rememberEnteredSession(user: NonNullable<XAuthSession["user"]>) {
  try {
    window.sessionStorage.setItem(ENTERED_SESSION_KEY, enteredSessionValue(user));
  } catch {
    // Some embedded/private browsers reject sessionStorage. In that case the X cookie still authenticates.
  }
}

function clearEnteredSession() {
  try {
    window.sessionStorage.removeItem(ENTERED_SESSION_KEY);
  } catch {
    // Ignore storage failures during sign-out cleanup.
  }
}

function authErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("auth_error");
  if (!reason) return null;
  if (
    reason === "x_auth_not_configured" ||
    reason === "x_login_start_failed" ||
    reason === "x_oauth_state_invalid" ||
    reason === "x_login_callback_failed"
  ) {
    return reason;
  }
  return "unknown";
}

function authErrorMessageFromReason(reason: XAuthErrorReason | "unknown", t: ArenaText) {
  if (reason === "x_auth_not_configured") return t.ui.xAuthNotConfigured;
  if (reason === "x_login_start_failed") return t.ui.xLoginStartFailed;
  if (reason === "x_oauth_state_invalid") return t.ui.xOauthStateInvalid;
  if (reason === "x_login_callback_failed") return t.ui.xLoginCallbackFailed;
  return t.ui.xLoginFailed;
}

function cleanAuthQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("auth") && !url.searchParams.has("auth_error")) return;
  url.searchParams.delete("auth");
  url.searchParams.delete("auth_error");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchXAuthSession, logoutXSession, xLoginStartUrl, type XAuthSession } from "../api/auth";
import { staticAssetUrl } from "../game/assets/staticAssets";

interface XLoginGateProps {
  children: ReactNode | ((session: XAuthSession & { authenticated: true; user: NonNullable<XAuthSession["user"]> }) => ReactNode);
}

export function XLoginGate({ children }: XLoginGateProps) {
  const [session, setSession] = useState<XAuthSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authError = useMemo(() => authErrorFromUrl(), []);

  useEffect(() => {
    let alive = true;
    fetchXAuthSession()
      .then((nextSession) => {
        if (!alive) return;
        setSession(nextSession);
        setStatus("ready");
        cleanAuthQuery();
      })
      .catch((nextError) => {
        if (!alive) return;
        setError(nextError instanceof Error ? nextError.message : "Unable to read X session.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const retry = () => {
    setStatus("loading");
    setError(null);
    fetchXAuthSession()
      .then((nextSession) => {
        setSession(nextSession);
        setStatus("ready");
        cleanAuthQuery();
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Unable to read X session.");
        setStatus("error");
      });
  };

  if (status === "loading") {
    return <XLoginScreen mode="loading" />;
  }

  if (status === "error") {
    return <XLoginScreen mode="error" message={error ?? "Unable to read X session."} onRetry={retry} />;
  }

  if (session?.authenticated && session.user) {
    if (!entered) {
      return (
        <XLoginScreen
          mode="continue"
          user={session.user}
          onContinue={() => setEntered(true)}
          onSignOut={async () => {
            await logoutXSession();
            setEntered(false);
            setSession({ authenticated: false, configured: true, user: null });
          }}
        />
      );
    }
    return typeof children === "function" ? children({ ...session, authenticated: true, user: session.user }) : children;
  }

  return <XLoginScreen mode="login" configured={session?.configured ?? false} message={authError} />;
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
  const signIn = () => {
    window.location.assign(xLoginStartUrl());
  };

  return (
    <main className="x-login-page" aria-label="Vinci World X login">
      <div className="x-login-brand">
        <img src={staticAssetUrl("/assets/generated/vinci-favicon.png")} alt="" />
        <div>
          <span>incubated by renaiss</span>
          <h1>VINCI WORLD</h1>
        </div>
      </div>

      <section className="x-login-controls" aria-label="Sign in">
        {mode === "loading" ? (
          <button type="button" className="x-login-button is-loading" disabled>
            <span>X</span>
            CHECKING SESSION
          </button>
        ) : null}

        {mode === "error" ? (
          <>
            <div className="x-login-message" role="alert">
              {message}
            </div>
            <button type="button" className="x-login-button" onClick={onRetry}>
              <span>R</span>
              RETRY
            </button>
          </>
        ) : null}

        {mode === "login" ? (
          <>
            <button type="button" className="x-login-button" onClick={signIn} disabled={!configured}>
              <span>X</span>
              CONTINUE WITH X
            </button>
            {!configured ? <div className="x-login-message">X LOGIN NOT CONFIGURED</div> : null}
            {message ? <div className="x-login-message" role="alert">{message}</div> : null}
          </>
        ) : null}

        {mode === "continue" && user ? (
          <>
            <button type="button" className="x-login-button" onClick={onContinue}>
              <span>{user.provider === "dev" ? "DEV" : "X"}</span>
              CONTINUE AS @{user.username.toUpperCase()}
            </button>
            <button type="button" className="x-login-button x-login-button-secondary" onClick={onSignOut}>
              <span>-</span>
              SIGN OUT
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

function authErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("auth_error");
  if (!reason) return null;
  const messages: Record<string, string> = {
    x_auth_not_configured: "X login is not configured on this server.",
    x_login_start_failed: "X login could not start.",
    x_oauth_state_invalid: "X login expired. Try again.",
    x_login_callback_failed: "X login could not be completed."
  };
  return messages[reason] ?? "X login failed.";
}

function cleanAuthQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("auth") && !url.searchParams.has("auth_error")) return;
  url.searchParams.delete("auth");
  url.searchParams.delete("auth_error");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

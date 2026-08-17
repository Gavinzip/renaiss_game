declare const __RENAISS_WEB_BUILD_ID__: string;

const VERSION_CHECK_MARKER = "renaiss:web-version-check";
const VERSION_ENDPOINT = "/version.json";
const MIN_CHECK_INTERVAL_MS = 5_000;

interface RemoteWebBuildVersion {
  buildId: string;
  builtAt?: string;
}

let activeCheck: Promise<void> | null = null;
let lastCheckAt = 0;
let legacyWorkerCleanup: Promise<boolean> | null = null;
let reloadInProgress = false;

export const CURRENT_WEB_BUILD_ID = __RENAISS_WEB_BUILD_ID__;

export function installWebAppVersionWatcher() {
  if (!import.meta.env.PROD) return;

  const checkNow = () => {
    void prepareVersionCheck();
  };
  const checkWhenVisible = () => {
    if (document.visibilityState === "visible") checkNow();
  };

  window.addEventListener("pageshow", checkNow);
  window.addEventListener("online", checkNow);
  document.addEventListener("visibilitychange", checkWhenVisible);
  checkNow();
}

async function prepareVersionCheck() {
  if (reloadInProgress) return;
  legacyWorkerCleanup ??= removeLegacyServiceWorkers();
  const controlledByLegacyWorker = await legacyWorkerCleanup;
  if (controlledByLegacyWorker) {
    reloadInProgress = true;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("legacyWorkerRetired", CURRENT_WEB_BUILD_ID);
    window.location.replace(nextUrl.toString());
    return;
  }
  await checkForWebAppUpdate();
}

export function checkForWebAppUpdate() {
  const now = Date.now();
  if (activeCheck) return activeCheck;
  if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return Promise.resolve();
  lastCheckAt = now;

  activeCheck = fetchLatestWebBuildVersion()
    .then((latest) => {
      if (latest.buildId === CURRENT_WEB_BUILD_ID) return;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("appVersion", latest.buildId);
      window.location.replace(nextUrl.toString());
    })
    .catch((error) => {
      console.warn(`[${VERSION_CHECK_MARKER}]`, error);
    })
    .finally(() => {
      activeCheck = null;
    });
  return activeCheck;
}

async function fetchLatestWebBuildVersion(): Promise<RemoteWebBuildVersion> {
  const url = new URL(VERSION_ENDPOINT, window.location.origin);
  url.searchParams.set("current", CURRENT_WEB_BUILD_ID);
  url.searchParams.set("checkedAt", Date.now().toString(36));
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "cache-control": "no-cache" }
  });
  if (!response.ok) {
    throw new Error(`Version endpoint returned ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Version endpoint returned ${contentType || "an unknown content type"}.`);
  }
  const payload = await response.json() as Partial<RemoteWebBuildVersion>;
  if (typeof payload.buildId !== "string" || payload.buildId.length < 6) {
    throw new Error("Version endpoint has no valid build ID.");
  }
  return { buildId: payload.buildId, builtAt: payload.builtAt };
}

async function removeLegacyServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const controlledByLegacyWorker = navigator.serviceWorker.controller !== null;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ((registrations.length > 0 || controlledByLegacyWorker) && "caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }
    return controlledByLegacyWorker;
  } catch (error) {
    console.warn(`[${VERSION_CHECK_MARKER}] legacy worker cleanup failed`, error);
    return false;
  }
}

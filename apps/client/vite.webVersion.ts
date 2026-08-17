import type { Plugin } from "vite";

export interface WebBuildVersion {
  buildId: string;
  builtAt: string;
}

export function createWebBuildVersion(): WebBuildVersion {
  const revision = [
    process.env.RENAISS_WEB_BUILD_ID,
    process.env.ZEABUR_GIT_COMMIT_SHA,
    process.env.GIT_COMMIT_SHA,
    process.env.COMMIT_SHA
  ].find((value) => value?.trim())?.trim();
  const safeRevision = revision?.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 40) ?? "build";
  return {
    buildId: `${safeRevision}-${Date.now().toString(36)}`,
    builtAt: new Date().toISOString()
  };
}

export function webBuildVersionPlugin(version: WebBuildVersion): Plugin {
  return {
    name: "renaiss-web-build-version",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify(version)}\n`
      });
    }
  };
}

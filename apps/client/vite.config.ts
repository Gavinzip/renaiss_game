import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { createWebBuildVersion, webBuildVersionPlugin } from "./vite.webVersion";

const devPort = Number(process.env.VITE_DEV_PORT ?? 5173);
const webBuildVersion = createWebBuildVersion();
const staticAssetRelease = JSON.parse(
  readFileSync(
    new URL("./src/game/assets/staticAssetReleaseManifest.json", import.meta.url),
    "utf8"
  )
) as { publicBaseUrl: string; releaseId: string; fallbackUsed: boolean };

export default defineConfig(({ command }) => {
  const configuredAssetBase = process.env.VITE_STATIC_ASSET_BASE_URL?.replace(/\/$/, "");
  if (command === "build") {
    if (!configuredAssetBase) {
      throw new Error("VITE_STATIC_ASSET_BASE_URL is required for production builds.");
    }
    if (
      configuredAssetBase !== staticAssetRelease.publicBaseUrl ||
      staticAssetRelease.fallbackUsed !== false
    ) {
      throw new Error(
        `Static asset release mismatch: expected ${staticAssetRelease.publicBaseUrl}, ` +
          `received ${configuredAssetBase || "<missing>"}`
      );
    }
  }
  return {
    publicDir: command === "build" ? false : "public",
    plugins: [react(), webBuildVersionPlugin(webBuildVersion)],
    define: {
      __RENAISS_WEB_BUILD_ID__: JSON.stringify(webBuildVersion.buildId)
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            if (id.includes("/phaser/")) {
              return "engine-phaser";
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
            if (id.includes("/socket.io-client/") || id.includes("/engine.io-client/")) {
              return "vendor-network";
            }
            if (id.includes("/@phosphor-icons/") || id.includes("/zustand/")) {
              return "vendor-ui";
            }

            return "vendor";
          }
        }
      }
    },
    server: {
      port: devPort,
      hmr: {
        clientPort: devPort
      }
    }
  };
});

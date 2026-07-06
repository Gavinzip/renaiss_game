import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const devPort = Number(process.env.VITE_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
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
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
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
});

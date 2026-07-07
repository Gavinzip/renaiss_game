import { spawn } from "node:child_process";

const serverPort = process.env.GAME_SERVER_PORT || "8787";
const children = new Set();
let stopping = false;

function start(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: "/app",
    stdio: "inherit",
    ...options
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;

    stopping = true;
    console.error(`${name} exited unexpectedly`, { code, signal });
    stopChildren();
    process.exit(code ?? 1);
  });

  return child;
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGTERM", () => {
  stopping = true;
  stopChildren();
});

process.on("SIGINT", () => {
  stopping = true;
  stopChildren();
});

start("game-server", "node_modules/.bin/tsx", ["apps/server/src/index.ts"], {
  env: {
    ...process.env,
    PORT: serverPort
  }
});

start("nginx", "nginx", ["-g", "daemon off;"]);

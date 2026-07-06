import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

type Step = {
  label: string;
  script: string;
  env?: Record<string, string>;
};

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function envPort(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be an integer TCP port between 1024 and 65535, got ${raw}.`);
  }
  return value;
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function findFreePort(preferred: number, usedPorts: Set<number>) {
  for (let port = preferred; port < preferred + 200 && port <= 65535; port += 1) {
    if (usedPorts.has(port)) continue;
    if (await canListen(port)) {
      usedPorts.add(port);
      if (port !== preferred) {
        console.log(`[release-check] preferred port ${preferred} is occupied; using ${port}.`);
      }
      return port;
    }
  }
  throw new Error(`Could not find a free TCP port near ${preferred}.`);
}

async function runStep(step: Step) {
  const started = Date.now();
  console.log(`\n[release-check] ${step.label}`);
  console.log(`[release-check] pnpm ${step.script}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pnpmCommand, [step.script], {
      env: { ...process.env, ...step.env },
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        console.log(`[release-check] ${step.label} passed in ${seconds}s.`);
        resolve();
        return;
      }
      reject(new Error(`${step.label} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

async function collectFiles(path: string, limit = 12): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const childPath = resolve(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(childPath, Math.max(0, limit - files.length)));
    } else {
      files.push(childPath);
    }
    if (files.length >= limit) break;
  }
  return files;
}

async function assertNoRepoLocalTempArtifacts() {
  const tempDirs = ["tmp", "preview"];
  const errors: string[] = [];
  for (const dir of tempDirs) {
    const tempPath = resolve(dir);
    if (!existsSync(tempPath)) continue;
    const stats = await stat(tempPath);
    if (!stats.isDirectory()) {
      errors.push(`Repo root contains ${dir} as a file.`);
      continue;
    }
    const files = await collectFiles(tempPath);
    const listed = files.length > 0 ? files.map((file) => `  - ${file}`).join("\n") : `  - ${dir}/ is empty`;
    errors.push(`Repo root contains ${dir}/.\n${listed}`);
  }
  if (errors.length > 0) {
    throw new Error(`Release checks must not leave local temporary visual artifacts in the project tree. Write them under /tmp/renaiss-rpg-previews or remove them before finishing.\n${errors.join("\n")}`);
  }
}

async function main() {
  const usedPorts = new Set<number>();
  const playtestClientPort = await findFreePort(envPort("RPG_RELEASE_CHECK_PLAYTEST_PORT", 5276), usedPorts);
  const playtestServerPort = await findFreePort(envPort("RPG_RELEASE_CHECK_PLAYTEST_SERVER_PORT", 8896), usedPorts);
  const visualClientPort = await findFreePort(envPort("RPG_RELEASE_CHECK_VISUAL_PORT", 5275), usedPorts);
  const visualServerPort = await findFreePort(envPort("RPG_RELEASE_CHECK_VISUAL_SERVER_PORT", 8895), usedPorts);

  const steps: Step[] = [
    { label: "Sprite and generated asset validation", script: "assets:validate" },
    { label: "RPG data, balance, AI, and versus authority audit", script: "rpg:audit" },
    { label: "RPG animation production report", script: "rpg:animation-report" },
    {
      label: "Browser RPG flow playtest",
      script: "rpg:playtest",
      env: {
        RPG_PLAYTEST_PORT: String(playtestClientPort),
        RPG_PLAYTEST_SERVER_PORT: String(playtestServerPort)
      }
    },
    {
      label: "Fresh visual review screenshots and GIFs",
      script: "rpg:visual-review",
      env: {
        RPG_VISUAL_REVIEW_PORT: String(visualClientPort),
        RPG_VISUAL_REVIEW_SERVER_PORT: String(visualServerPort)
      }
    },
    { label: "Release readiness audit", script: "rpg:release-audit" },
    { label: "TypeScript project references", script: "typecheck" },
    { label: "Production build", script: "build" }
  ];

  for (const step of steps) {
    await runStep(step);
  }
  await assertNoRepoLocalTempArtifacts();

  console.log("\n[release-check] All RPG release gates passed.");
}

main().catch((error) => {
  console.error(`\n[release-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

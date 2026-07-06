import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLIENT_PORT = Number(process.env.MAP_EDITOR_PLAYTEST_PORT ?? 5182);
const PROVIDED_CLIENT_URL = process.env.MAP_EDITOR_PLAYTEST_URL;
const CLIENT_URL = PROVIDED_CLIENT_URL ?? `http://127.0.0.1:${CLIENT_PORT}`;
const STORAGE_KEY = "renaiss.mapEditor.props.v1";
const expectedShutdown = new WeakSet<ChildProcessWithoutNullStreams>();

async function main() {
  let clientServer: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  try {
    if (!PROVIDED_CLIENT_URL) {
      clientServer = startClientServer(CLIENT_PORT);
      await waitForClient(CLIENT_URL);
    }

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${CLIENT_URL}/?editor=1&dev=1`, { waitUntil: "networkidle" });
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".map-editor-canvas");
    await page.getByText("Scene Editor").waitFor({ timeout: 10_000 });
    await page.getByText("Palette").waitFor({ timeout: 10_000 });

    const importDraft = [
      {
        id: "playtest_fence",
        type: "fenceShort",
        x: 1200,
        y: 1500,
        width: 140,
        height: 64,
        depthOffset: 31,
        collider: { kind: "rect", x: 1200, y: 1523, width: 104, height: 14 }
      }
    ];
    await page.locator("textarea.map-editor-import").fill(`export const MAP_PROPS: MapProp[] = ${JSON.stringify(importDraft, null, 2)};`);
    await page.getByRole("button", { name: /Import Draft/i }).click();
    await page.getByText("Imported 1 props").waitFor({ timeout: 5_000 });

    const storedAfterImport = await readStoredProps(page);
    assert(storedAfterImport.length === 1, `Expected one imported prop, got ${storedAfterImport.length}`);
    assert(storedAfterImport[0].id === "playtest_fence", `Unexpected imported prop id ${storedAfterImport[0]?.id}`);

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.keyboard.press("ArrowRight");
    const storedAfterNudge = await readStoredProps(page);
    assert(storedAfterNudge[0].x === 1216, `ArrowRight should nudge selected prop by 16px, got x=${storedAfterNudge[0].x}`);
    assert(storedAfterNudge[0].collider?.x === 1216, `Nudge should move collider with prop, got collider.x=${storedAfterNudge[0].collider?.x}`);

    await page.getByRole("button", { name: /Copy JSON/i }).click();
    const exportText = await page.locator("textarea[readonly]").inputValue();
    assert(exportText.includes('"playtest_fence"'), "Copy JSON export should include imported prop id.");
    assert(errors.length === 0, `Map editor emitted browser errors: ${errors.join(" | ")}`);

    await page.close();
  } finally {
    await browser?.close();
    await stopChild(clientServer);
  }

  console.log("Map editor browser playtest passed.");
}

function startClientServer(port: number) {
  const child = spawn("pnpm", ["--dir", "apps/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, VITE_DEV_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    if (!expectedShutdown.has(child)) process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    if (!expectedShutdown.has(child)) process.stderr.write(chunk);
  });
  return child;
}

async function waitForClient(clientUrl: string) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < 20_000) {
    try {
      const response = await fetch(clientUrl);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for map editor client at ${clientUrl}: ${lastError}`);
}

function delay(ms: number) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function stopChild(child: ChildProcessWithoutNullStreams | null) {
  if (!child) return;
  expectedShutdown.add(child);
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise<void>((resolveStop) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
      resolveStop();
    }, 3_000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolveStop();
    });

    if (!child.kill("SIGINT")) {
      clearTimeout(timer);
      resolveStop();
    }
  });
}

async function readStoredProps(page: import("playwright").Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Array<{ id: string; x: number; collider?: { x?: number } }> : [];
  }, STORAGE_KEY);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

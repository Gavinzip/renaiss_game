import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

type ClassId = "warrior" | "archer" | "engineer" | "mage";
type Direction = "right" | "down" | "left" | "up";

const DEFAULT_BASE_URL = "http://localhost:5173/?arena=1";
const baseUrl = process.env.MOVEMENT_REVIEW_URL ?? DEFAULT_BASE_URL;
const outputDir = resolve(process.env.MOVEMENT_REVIEW_OUT ?? "/tmp/arena-movement-review");
const classId = parseClassId(process.env.CLASS_ID ?? "warrior");
const directions = parseCsv(process.env.MOVEMENT_REVIEW_DIRECTIONS, ["right", "down"]) as Direction[];
const frameTimingsMs = parseCsv(process.env.MOVEMENT_REVIEW_TIMINGS_MS, ["120", "260", "420", "620"]).map((value) => Number(value));
const debugReview = process.env.MOVEMENT_REVIEW_DEBUG === "1";

const MOVEMENT_KEYS: Record<Direction, string> = {
  right: "KeyD",
  down: "KeyS",
  left: "KeyA",
  up: "KeyW"
};

const POINTERS: Record<Direction, { x: number; y: number }> = {
  right: { x: 1100, y: 430 },
  down: { x: 720, y: 760 },
  left: { x: 340, y: 430 },
  up: { x: 720, y: 170 }
};

function withReviewParams(value: string) {
  const url = new URL(value);
  if (process.env.MOVEMENT_REVIEW_BOTS !== "1") {
    url.searchParams.set("reviewBots", "0");
  }
  if (process.env.MOVEMENT_REVIEW_FIXED_SPAWN !== "0") {
    url.searchParams.set("reviewSpawn", "fixed");
  }
  if (debugReview) {
    url.searchParams.set("debugArena", "1");
  }
  return url.toString();
}

function parseCsv(value: string | undefined, fallback: string[]) {
  return (value ?? fallback.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseClassId(value: string): ClassId {
  if (value === "warrior" || value === "archer" || value === "engineer" || value === "mage") {
    return value;
  }
  throw new Error(`Unsupported CLASS_ID: ${value}`);
}

function validateDirection(direction: string): Direction {
  if (direction === "right" || direction === "down" || direction === "left" || direction === "up") {
    return direction;
  }
  throw new Error(`Unsupported MOVEMENT_REVIEW_DIRECTIONS entry: ${direction}`);
}

async function enterArena(page: Page) {
  await page.goto(withReviewParams(baseUrl), { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.body.innerText.includes("Enter Arena"), null, { timeout: 10_000 });
  await page.getByRole("button", { name: new RegExp(`^${classLabel(classId)}\\b`, "i") }).click({ timeout: 8_000 });
  await page.getByRole("button", { name: /^Enter Arena$/i }).click({ timeout: 8_000 });
  await page.waitForFunction(() => document.body.innerText.includes("LIVE ARENA"), null, { timeout: 15_000 });
  await page.waitForTimeout(5_200);
}

function classLabel(id: ClassId) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

async function captureMovementDirection(direction: Direction) {
  const browser = await chromium.launch({ headless: true });
  try {
    const outputs: string[] = [];
    for (const timing of frameTimingsMs) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const outPath = join(outputDir, `${classId}-walk-${direction}-${timing}ms.png`);
      try {
        await enterArena(page);
        const pointer = POINTERS[direction];
        await page.mouse.move(pointer.x, pointer.y);
        await page.keyboard.down(MOVEMENT_KEYS[direction]);
        await page.waitForTimeout(timing);
        await page.screenshot({ path: outPath, fullPage: false });
        if (debugReview) {
          const debugSelf = await readDebugSelf(page);
          console.log(`${classId}/walk/${direction}/${timing}ms`, JSON.stringify(debugSelf));
        }
      } finally {
        await page.keyboard.up(MOVEMENT_KEYS[direction]);
        await page.close();
      }
      outputs.push(outPath);
    }
    return outputs;
  } finally {
    await browser.close();
  }
}

async function readDebugSelf(page: Page) {
  return page.evaluate(() => {
    const snapshot = (window as typeof window & {
      __renaissArenaSnapshot?: {
        selfId: string | null;
        players: Array<{ id: string; x: number; y: number; angle: number; action: string | null; sprinting: boolean }>;
      };
    }).__renaissArenaSnapshot;
    const self = snapshot?.players.find((player) => player.id === snapshot.selfId);
    return self
      ? {
          x: Number(self.x.toFixed(1)),
          y: Number(self.y.toFixed(1)),
          angle: Number(self.angle.toFixed(1)),
          action: self.action,
          sprinting: self.sprinting
        }
      : null;
  });
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const validatedDirections = directions.map(validateDirection);
  const outputs: string[] = [];
  for (const direction of validatedDirections) {
    outputs.push(...(await captureMovementDirection(direction)));
  }
  console.log(outputs.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

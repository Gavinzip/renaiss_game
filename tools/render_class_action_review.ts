import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

type ClassId = "warrior" | "archer" | "engineer" | "mage";
type Direction = "right" | "down" | "left" | "up";
type ReviewAction = "attack" | "skillQ" | "skillE" | "skillR";

const DEFAULT_BASE_URL = "http://localhost:5173/?arena=1";
const baseUrl = process.env.CLASS_REVIEW_URL ?? DEFAULT_BASE_URL;
const outputDir = resolve(process.env.CLASS_REVIEW_OUT ?? "/tmp/class-action-review");
const classId = parseClassId(process.env.CLASS_ID ?? "mage");
const actions = parseCsv(process.env.CLASS_REVIEW_ACTIONS, ["attack"]) as ReviewAction[];
const directions = parseCsv(process.env.CLASS_REVIEW_DIRECTIONS, ["right", "down", "left", "up"]) as Direction[];
const frameTimingsMs = parseCsv(process.env.CLASS_REVIEW_TIMINGS_MS, ["55", "120", "185", "250"]).map((value) => Number(value));
const debugReview = process.env.CLASS_REVIEW_DEBUG === "1";

const POINTERS: Record<Direction, { x: number; y: number }> = {
  right: { x: 1090, y: 430 },
  down: { x: 720, y: 780 },
  left: { x: 340, y: 430 },
  up: { x: 720, y: 165 }
};

const REVIEW_ANGLES: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: -90
};

const ACTION_KEYS: Partial<Record<ReviewAction, string>> = {
  skillQ: "KeyQ",
  skillE: "KeyE",
  skillR: "KeyR"
};

function withReviewParams(value: string, direction: Direction) {
  const url = new URL(value);
  if (process.env.CLASS_REVIEW_FIXED_AIM !== "0") {
    url.searchParams.set("reviewAim", "fixed");
    url.searchParams.set("reviewAngle", String(REVIEW_ANGLES[direction]));
  }
  if (process.env.CLASS_REVIEW_BOTS !== "1") {
    url.searchParams.set("reviewBots", "0");
  }
  if (process.env.CLASS_REVIEW_FIXED_SPAWN !== "0") {
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

function validateAction(action: string): ReviewAction {
  if (action === "attack" || action === "skillQ" || action === "skillE" || action === "skillR") {
    return action;
  }
  throw new Error(`Unsupported CLASS_REVIEW_ACTIONS entry: ${action}`);
}

function validateDirection(direction: string): Direction {
  if (direction === "right" || direction === "down" || direction === "left" || direction === "up") {
    return direction;
  }
  throw new Error(`Unsupported CLASS_REVIEW_DIRECTIONS entry: ${direction}`);
}

async function enterArena(page: Page, direction: Direction) {
  await page.goto(withReviewParams(baseUrl, direction), { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.body.innerText.includes("Enter Arena"), null, { timeout: 10_000 });
  await page.getByRole("button", { name: new RegExp(`^${classLabel(classId)}\\b`, "i") }).click({ timeout: 8_000 });
  await page.getByRole("button", { name: /^Enter Arena$/i }).click({ timeout: 8_000 });
  await page.waitForFunction(() => document.body.innerText.includes("LIVE ARENA"), null, { timeout: 15_000 });
  await page.waitForTimeout(5_200);
}

function classLabel(id: ClassId) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

async function startAction(page: Page, action: ReviewAction, direction: Direction) {
  const pointer = POINTERS[direction];
  await page.mouse.move(pointer.x, pointer.y);
  if (action === "attack") {
    await page.mouse.down();
    return;
  }
  await page.keyboard.down(ACTION_KEYS[action]!);
}

async function stopAction(page: Page, action: ReviewAction) {
  if (action === "attack") {
    await page.mouse.up();
    return;
  }
  await page.keyboard.up(ACTION_KEYS[action]!);
}

async function captureActionDirection(action: ReviewAction, direction: Direction) {
  const browser = await chromium.launch({ headless: true });
  try {
    const outputs: string[] = [];
    for (const timing of frameTimingsMs) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const outPath = join(outputDir, `${classId}-${action}-${direction}-${timing}ms.png`);
      try {
        await enterArena(page, direction);
        await startAction(page, action, direction);
        await page.waitForTimeout(timing);
        await page.screenshot({ path: outPath, fullPage: false });
        if (debugReview) {
          const debugEffects = await readDebugEffects(page);
          console.log(`${classId}/${action}/${direction}/${timing}ms`, JSON.stringify(debugEffects));
        }
      } finally {
        await stopAction(page, action);
        await page.close();
      }
      outputs.push(outPath);
    }
    return outputs;
  } finally {
    await browser.close();
  }
}

async function readDebugEffects(page: Page) {
  return page.evaluate(() => {
    const snapshot = (window as typeof window & {
      __renaissArenaSnapshot?: {
        serverTime: number;
        effects: Array<{ id: string; type: string; startedAt: number; duration: number; angle: number; x: number; y: number }>;
      };
    }).__renaissArenaSnapshot;

    return (
      snapshot?.effects.map((effect) => ({
        type: effect.type,
        progress: Number(((snapshot.serverTime - effect.startedAt) / effect.duration).toFixed(3)),
        angle: Number(effect.angle.toFixed(1)),
        x: Number(effect.x.toFixed(1)),
        y: Number(effect.y.toFixed(1))
      })) ?? []
    );
  });
}

async function main() {
  const validatedActions = actions.map(validateAction);
  const validatedDirections = directions.map(validateDirection);
  mkdirSync(outputDir, { recursive: true });
  const outputs: string[] = [];
  for (const action of validatedActions) {
    for (const direction of validatedDirections) {
      outputs.push(...(await captureActionDirection(action, direction)));
    }
  }
  console.log(outputs.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

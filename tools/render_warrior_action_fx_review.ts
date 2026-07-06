import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

type Direction = "right" | "down" | "left" | "up";

const DEFAULT_BASE_URL = "http://localhost:5173/?arena=1";
const outputDir = resolve(process.env.WARRIOR_FX_REVIEW_OUT ?? "/tmp/warrior-action-fx-review");
const baseUrl = process.env.WARRIOR_FX_REVIEW_URL ?? DEFAULT_BASE_URL;

const POINTERS: Record<Direction, { x: number; y: number }> = {
  right: { x: 1090, y: 430 },
  down: { x: 720, y: 780 },
  left: { x: 340, y: 430 },
  up: { x: 720, y: 165 }
};
const FRAME_TIMINGS_MS = [55, 120, 185, 250] as const;

async function enterArena(page: Page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.body.innerText.includes("Enter Arena"), null, { timeout: 10_000 });
  await page.getByRole("button", { name: /^Enter Arena$/i }).click({ timeout: 8_000 });
  await page.waitForFunction(() => document.body.innerText.includes("LIVE ARENA"), null, { timeout: 15_000 });
  await page.waitForTimeout(5_200);
}

async function captureDirection(direction: Direction) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    await enterArena(page);
    const pointer = POINTERS[direction];
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.down();
    const outputs: string[] = [];
    let elapsed = 0;
    for (const timing of FRAME_TIMINGS_MS) {
      await page.waitForTimeout(timing - elapsed);
      elapsed = timing;
      const outPath = join(outputDir, `warrior-action-fx-${direction}-${timing}ms.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      outputs.push(outPath);
    }
    await page.mouse.up();
    return outputs;
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const outputs: string[] = [];
  for (const direction of Object.keys(POINTERS) as Direction[]) {
    outputs.push(...(await captureDirection(direction)));
  }
  console.log(outputs.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

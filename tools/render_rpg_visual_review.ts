import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { GENERATED_ASSET_VERSION } from "../apps/client/src/game/assets/generatedAssets";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT_DIR = process.env.RPG_VISUAL_REVIEW_OUT ?? "/tmp/renaiss-rpg-previews";
const REQUESTED_CLIENT_PORT = Number(process.env.RPG_VISUAL_REVIEW_PORT ?? 5175);
const REQUESTED_SERVER_PORT = Number(process.env.RPG_VISUAL_REVIEW_SERVER_PORT ?? 8789);
const PROVIDED_CLIENT_URL = process.env.RPG_VISUAL_REVIEW_CLIENT_URL;
const PROVIDED_SERVER_URL = process.env.RPG_VISUAL_REVIEW_SERVER_URL;

const STARTER_MOVE_NAMES = ["潮刃拍擊", "火爪快擊", "藤鞭拍擊"] as const;
const GROUP_MOVE_NAMES = ["細雨掃線", "火線掃場", "葉刃掃場"] as const;
const STATUS_MOVE_NAMES = ["水鏡護膜", "餘燼咬痕", "樹皮硬化"] as const;
const EXPECTED_VISUAL_OUTPUT_LABELS = [
  "rpg-release-review",
  "rpg-village",
  "rpg-village-followers",
  "rpg-shop-draw",
  "rpg-shop-ten-draw",
  "rpg-gym",
  "rpg-ai-battle",
  "rpg-ai-ally-target",
  "rpg-ai-support-vfx",
  "rpg-ai-battle-vfx",
  "rpg-ai-status-vfx",
  "rpg-versus-waiting",
  "rpg-versus-battle",
  "rpg-versus-vfx-left-seat",
  "rpg-versus-vfx-right-seat",
  "skill-single",
  "arena-single",
  "skill-fire-bullet",
  "skill-group",
  "arena-group",
  "skill-flight-gif",
  "skill-support-heal",
  "skill-support-team",
  "skill-light-ultimate",
  "skill-fire-ultimate",
  "skill-fire-ultimate-gif",
  "skill-catalog-125",
  "pet-animation-review",
  "pet-animation-review-gif",
  "status-animation-review",
  "status-animation-review-gif",
  "mobile-release-review",
  "mobile-skill-review"
] as const;
const expectedShutdown = new WeakSet<ChildProcessWithoutNullStreams>();

interface CaptureResult {
  label: string;
  path: string;
}

async function main() {
  let clientServer: ChildProcessWithoutNullStreams | null = null;
  let gameServer: ChildProcessWithoutNullStreams | null = null;
  const clientPort = PROVIDED_CLIENT_URL ? REQUESTED_CLIENT_PORT : await findAvailablePort(REQUESTED_CLIENT_PORT);
  const serverPort = PROVIDED_SERVER_URL ? REQUESTED_SERVER_PORT : await findAvailablePort(REQUESTED_SERVER_PORT, new Set([clientPort]));
  const clientUrl = PROVIDED_CLIENT_URL ?? `http://127.0.0.1:${clientPort}`;
  const serverUrl = PROVIDED_SERVER_URL ?? `http://127.0.0.1:${serverPort}`;

  try {
    if (!PROVIDED_SERVER_URL) {
      gameServer = startGameServer(serverPort);
      await waitForServer(serverUrl);
    }

    if (!PROVIDED_CLIENT_URL) {
      clientServer = startClientServer(clientPort, serverUrl);
      await waitForClient(clientUrl);
    }

    const outputs = await renderVisualReview(clientUrl, OUTPUT_DIR);
    validateVisualOutputs(outputs);
    const galleryPath = await writeVisualReviewIndex(outputs, OUTPUT_DIR);
    console.log("RPG visual review written:");
    for (const output of outputs) {
      console.log(`- ${output.label}: ${output.path}`);
    }
    console.log(`- visual-review-gallery: ${galleryPath}`);
  } finally {
    await Promise.all([stopChild(clientServer), stopChild(gameServer)]);
  }
}

async function findAvailablePort(startPort: number, reserved = new Set<number>()): Promise<number> {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (reserved.has(port)) continue;
    if (await canListenOnPort(port)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 49}`);
}

function canListenOnPort(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function startClientServer(port: number, serverUrl: string) {
  const child = spawn("pnpm", ["--dir", "apps/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, VITE_DEV_PORT: String(port), VITE_GAME_SERVER_URL: serverUrl },
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

function startGameServer(port: number) {
  const child = spawn("pnpm", ["--filter", "@renaiss-game/server", "exec", "tsx", "src/index.ts"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
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
  throw new Error(`Timed out waiting for RPG visual review client at ${clientUrl}: ${lastError}`);
}

async function waitForServer(serverUrl: string) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < 20_000) {
    try {
      const response = await fetch(`${serverUrl}/health`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for RPG visual review server at ${serverUrl}: ${lastError}`);
}

async function renderVisualReview(clientUrl: string, outputDir: string): Promise<CaptureResult[]> {
  await mkdir(outputDir, { recursive: true });
  const framesDir = resolve(outputDir, "rpg-visual-review-frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const outputs: CaptureResult[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await captureReleaseReview(browser, clientUrl, outputDir, outputs);
    await captureRpgFlowReview(browser, clientUrl, outputDir, outputs);
    await captureSkillReview(page, clientUrl, outputDir, framesDir, outputs);
    await capturePetReview(browser, clientUrl, outputDir, framesDir, outputs);
    await captureStatusReview(browser, clientUrl, outputDir, framesDir, outputs);
    await captureMobileReview(browser, clientUrl, outputDir, outputs);
  } finally {
    await browser.close();
    await rm(framesDir, { recursive: true, force: true });
  }
  return outputs;
}

async function captureReleaseReview(browser: Browser, clientUrl: string, outputDir: string, outputs: CaptureResult[]) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${clientUrl}/?preview=release`, { waitUntil: "networkidle" });
    await page.waitForSelector(".rpg-release-review");
    const info = await page.evaluate(() => ({
      metrics: Array.from(document.querySelectorAll(".rpg-release-metrics b")).map((node) => node.textContent?.trim() ?? ""),
      elementRows: document.querySelectorAll(".rpg-release-element-bars div").length,
      sourceRows: document.querySelectorAll(".rpg-release-source-list li").length,
      gateRows: document.querySelectorAll(".rpg-release-gates li").length,
      navLinks: document.querySelectorAll(".rpg-release-review > header nav a").length
    }));
    if (!info.metrics.some((metric) => metric.includes("125")) || !info.metrics.some((metric) => metric.includes("5"))) {
      throw new Error(`Release review metrics missing RPG totals: ${JSON.stringify(info)}`);
    }
    if (info.elementRows !== 5 || info.sourceRows < 3 || info.gateRows < 7 || info.navLinks < 4) {
      throw new Error(`Release review checklist is incomplete: ${JSON.stringify(info)}`);
    }
    await screenshot(page.locator(".rpg-release-review"), "rpg-release-review", resolve(outputDir, "rpg-visual-review-release.png"), outputs);
  } finally {
    await page.close();
  }
}

async function captureRpgFlowReview(browser: Browser, clientUrl: string, outputDir: string, outputs: CaptureResult[]) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${clientUrl}/`, { waitUntil: "networkidle" });
    await page.waitForSelector(".rpg-layer");
    await page.waitForTimeout(350);
    await screenshotPage(page, "rpg-village", resolve(outputDir, "rpg-visual-review-village.png"), outputs);
    await captureVillageFollowerMotion(page, outputDir, outputs);

    await page.getByRole("button", { name: "商城" }).click();
    await page.waitForSelector(".rpg-shop-panel");
    await page.locator(".rpg-element-filter button").filter({ hasText: "火" }).click();
    await page.locator(".rpg-ticket-card").filter({ hasText: "中階技能卡券" }).click();
    await page.waitForSelector(".rpg-draw-reveal-card.tier-intermediate", { timeout: 15_000 });
    await screenshot(page.locator(".rpg-shop-panel"), "rpg-shop-draw", resolve(outputDir, "rpg-visual-review-shop-draw.png"), outputs);
    await page.locator(".rpg-ticket-card").filter({ hasText: "十連技能卡券" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".rpg-draw-ceremony .rpg-draw-reveal-card").length === 10, null, { timeout: 15_000 });
    await page.waitForTimeout(1250);
    await screenshot(page.locator(".rpg-draw-ceremony"), "rpg-shop-ten-draw", resolve(outputDir, "rpg-visual-review-shop-ten-draw.png"), outputs);

    await page.getByRole("button", { name: "道館" }).click();
    await page.waitForSelector(".rpg-gym-panel");
    await page.locator(".rpg-ai-difficulty-selector button[data-ai-difficulty='leader']").click();
    await page.waitForFunction(() => document.querySelector(".rpg-ai-difficulty-selector button.is-selected")?.getAttribute("data-ai-difficulty") === "leader");
    await screenshot(page.locator(".rpg-gym-panel"), "rpg-gym", resolve(outputDir, "rpg-visual-review-gym.png"), outputs);

    await page.locator(".rpg-gym-modes button").filter({ hasText: "AI 對戰" }).click();
    await waitBattleField(page);
    await screenshot(page.locator(".rpg-battle-screen"), "rpg-ai-battle", resolve(outputDir, "rpg-visual-review-ai-battle.png"), outputs);
    await openCurrentLeftActorCommands(page);
    await screenshot(page.locator(".rpg-battle-screen"), "rpg-ai-ally-target", resolve(outputDir, "rpg-visual-review-ai-ally-target.png"), outputs);
    await submitCurrentActorMove(page, ["晨露療息", "水鏡護膜", "餘燼咬痕"]);
    await waitForBattleVfx(page, "AI single-actor support VFX");
    await screenshot(page.locator(".rpg-battle-screen"), "rpg-ai-support-vfx", resolve(outputDir, "rpg-visual-review-ai-support-vfx.png"), outputs);
    await submitCurrentActorMove(page, GROUP_MOVE_NAMES);
    await page.waitForSelector(".rpg-battle-vfx .rpg-skill-vfx-frame", { timeout: 15_000 });
    await page.waitForTimeout(260);
    await screenshot(page.locator(".rpg-battle-screen"), "rpg-ai-battle-vfx", resolve(outputDir, "rpg-visual-review-ai-battle-vfx.png"), outputs);

    await submitCurrentActorMove(page, STATUS_MOVE_NAMES);
    await page.waitForSelector(".rpg-battle-vfx .rpg-skill-vfx-frame", { timeout: 15_000 });
    await page.waitForTimeout(260);
    await screenshot(page.locator(".rpg-battle-screen"), "rpg-ai-status-vfx", resolve(outputDir, "rpg-visual-review-ai-status-vfx.png"), outputs);
  } finally {
    await page.close();
  }

  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    await openRpgGym(pageA, clientUrl);
    await moveFormationPetToFront(pageA, "pet_fire_emberfox");
    await pageA.locator("button").filter({ hasText: "真人對戰" }).click();
    const roomCode = await waitRoomCode(pageA);
    await screenshot(pageA.locator(".rpg-battle-panel"), "rpg-versus-waiting", resolve(outputDir, "rpg-visual-review-versus-waiting.png"), outputs);

    await openRpgGym(pageB, clientUrl);
    await moveFormationPetToFront(pageB, "pet_grass_mossling");
    await pageB.locator(".rpg-room-join input").fill(roomCode);
    await pageB.locator("button").filter({ hasText: "加入真人房" }).click();
    await waitBattleField(pageA);
    await waitBattleField(pageB);
    await screenshot(pageA.locator(".rpg-battle-screen"), "rpg-versus-battle", resolve(outputDir, "rpg-visual-review-versus-battle.png"), outputs);

    await submitVersusCurrentActorMove(pageA, pageB, STARTER_MOVE_NAMES);
    await waitForBattleVfx(pageA, "left-seat versus VFX");
    await waitForBattleVfx(pageB, "right-seat versus VFX");
    await pageA.waitForTimeout(260);
    await screenshot(pageA.locator(".rpg-battle-screen"), "rpg-versus-vfx-left-seat", resolve(outputDir, "rpg-visual-review-versus-vfx-left-seat.png"), outputs);
    await screenshot(pageB.locator(".rpg-battle-screen"), "rpg-versus-vfx-right-seat", resolve(outputDir, "rpg-visual-review-versus-vfx-right-seat.png"), outputs);
  } finally {
    await contextA.close();
    await contextB.close();
  }
}

async function captureVillageFollowerMotion(page: Page, outputDir: string, outputs: CaptureResult[]) {
  await page.locator("canvas").first().click({ position: { x: 800, y: 520 } });
  await page.keyboard.down("ArrowRight");
  try {
    await page.waitForFunction(() => {
      const game = (window as unknown as { __renaissRpgGame?: { registry?: { get(key: string): unknown } } }).__renaissRpgGame;
      const state = game?.registry?.get("rpgVillageFollowers") as { count?: number; moving?: boolean; animationKeys?: string[] } | undefined;
      return state?.count === 5 && state.moving === true && state.animationKeys?.every((key) => key.endsWith("_walk"));
    });
    await page.waitForTimeout(600);
    await screenshotPage(page, "rpg-village-followers", resolve(outputDir, "rpg-visual-review-village-followers.png"), outputs);
  } finally {
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(120);
  }
}

async function captureSkillReview(page: Page, clientUrl: string, outputDir: string, framesDir: string, outputs: CaptureResult[]) {
  await page.goto(`${clientUrl}/?preview=skills`, { waitUntil: "networkidle" });
  await page.waitForSelector(".rpg-skill-preview-arena .rpg-skill-preview-pet");
  await validateSkillPreviewArena(page, "initial skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-single", resolve(outputDir, "rpg-visual-review-skill-single.png"), outputs);
  await screenshot(page.locator(".rpg-skill-preview-arena"), "arena-single", resolve(outputDir, "rpg-visual-review-arena-single.png"), outputs);

  await page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_02']").click();
  await page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_basic_02");
  await page.waitForTimeout(300);
  await validateSkillPreviewArena(page, "fire bullet skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-fire-bullet", resolve(outputDir, "rpg-visual-review-skill-fire-bullet.png"), outputs);

  await page.locator(".rpg-skill-catalog-button[data-move-id='water_basic_07']").click();
  await page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-target") === "allEnemies");
  await page.waitForTimeout(220);
  await validateSkillPreviewArena(page, "group skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-group", resolve(outputDir, "rpg-visual-review-skill-group.png"), outputs);
  await screenshot(page.locator(".rpg-skill-preview-arena"), "arena-group", resolve(outputDir, "rpg-visual-review-arena-group.png"), outputs);

  for (let index = 0; index < 14; index += 1) {
    await page.locator(".rpg-skill-preview-arena").screenshot({ path: resolve(framesDir, `flight-${String(index).padStart(2, "0")}.png`) });
    await page.waitForTimeout(80);
  }
  const gifPath = resolve(outputDir, "rpg-visual-review-skill-flight.gif");
  writeGif(framesDir, gifPath, "flight");
  outputs.push({ label: "skill-flight-gif", path: gifPath });

  await page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_05']").click();
  await page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") === "support-field");
  await page.waitForTimeout(220);
  await validateSkillPreviewArena(page, "support heal skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-support-heal", resolve(outputDir, "rpg-visual-review-skill-support-heal.png"), outputs);

  await page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_09']").click();
  await page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_basic_09");
  await page.waitForTimeout(220);
  await validateSkillPreviewArena(page, "support team skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-support-team", resolve(outputDir, "rpg-visual-review-skill-support-team.png"), outputs);

  await page.locator(".rpg-skill-catalog-button[data-move-id='light_ultimate_05']").click();
  await page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "light_ultimate_05");
  await page.waitForTimeout(220);
  await validateSkillPreviewArena(page, "light ultimate skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-light-ultimate", resolve(outputDir, "rpg-visual-review-skill-light-ultimate.png"), outputs);

  await page.locator(".rpg-skill-catalog-button[data-move-id='fire_ultimate_05']").click();
  await page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_ultimate_05");
  await page.waitForTimeout(220);
  await validateSkillPreviewArena(page, "fire ultimate skill preview");
  await screenshot(page.locator(".rpg-skill-preview-stage"), "skill-fire-ultimate", resolve(outputDir, "rpg-visual-review-skill-fire-ultimate.png"), outputs);
  for (let index = 0; index < 16; index += 1) {
    await page.locator(".rpg-skill-preview-arena").screenshot({ path: resolve(framesDir, `fire-ultimate-${String(index).padStart(2, "0")}.png`) });
    await page.waitForTimeout(80);
  }
  const fireUltimateGifPath = resolve(outputDir, "rpg-visual-review-skill-fire-ultimate.gif");
  writeGif(framesDir, fireUltimateGifPath, "fire-ultimate");
  outputs.push({ label: "skill-fire-ultimate-gif", path: fireUltimateGifPath });

  await screenshot(page.locator(".rpg-skill-catalog"), "skill-catalog-125", resolve(outputDir, "rpg-visual-review-skill-catalog-125.png"), outputs);
}

async function capturePetReview(browser: Browser, clientUrl: string, outputDir: string, framesDir: string, outputs: CaptureResult[]) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${clientUrl}/?preview=pets`, { waitUntil: "networkidle" });
    await page.waitForSelector(".rpg-animation-preview");
    await screenshot(page.locator(".rpg-animation-preview"), "pet-animation-review", resolve(outputDir, "rpg-visual-review-pets.png"), outputs);
    for (let index = 0; index < 14; index += 1) {
      await page.locator(".rpg-preview-grid").screenshot({ path: resolve(framesDir, `pet-animation-${String(index).padStart(2, "0")}.png`) });
      await page.waitForTimeout(100);
    }
    const petGifPath = resolve(outputDir, "rpg-visual-review-pets.gif");
    writeGif(framesDir, petGifPath, "pet-animation");
    outputs.push({ label: "pet-animation-review-gif", path: petGifPath });
  } finally {
    await page.close();
  }
}

async function captureStatusReview(browser: Browser, clientUrl: string, outputDir: string, framesDir: string, outputs: CaptureResult[]) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${clientUrl}/?preview=status`, { waitUntil: "networkidle" });
    await page.waitForSelector(".rpg-status-animation-preview");
    await page.waitForTimeout(300);
    await screenshot(page.locator(".rpg-status-animation-preview"), "status-animation-review", resolve(outputDir, "rpg-visual-review-statuses.png"), outputs);
    for (let index = 0; index < 14; index += 1) {
      await page.locator(".rpg-status-review-grid").screenshot({ path: resolve(framesDir, `status-animation-${String(index).padStart(2, "0")}.png`) });
      await page.waitForTimeout(100);
    }
    const statusGifPath = resolve(outputDir, "rpg-visual-review-statuses.gif");
    writeGif(framesDir, statusGifPath, "status-animation");
    outputs.push({ label: "status-animation-review-gif", path: statusGifPath });
  } finally {
    await page.close();
  }
}

async function captureMobileReview(browser: Browser, clientUrl: string, outputDir: string, outputs: CaptureResult[]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await page.goto(`${clientUrl}/?preview=release`, { waitUntil: "networkidle" });
    await page.waitForSelector(".rpg-release-review");
    await assertNoHorizontalOverflow(page, "Mobile release review");
    await screenshot(page.locator(".rpg-release-review"), "mobile-release-review", resolve(outputDir, "rpg-visual-review-mobile-release.png"), outputs);

    await page.goto(`${clientUrl}/?preview=skills`, { waitUntil: "networkidle" });
    await page.waitForSelector(".rpg-skill-animation-preview");
    await assertNoHorizontalOverflow(page, "Mobile skill review");
    await screenshot(page.locator(".rpg-skill-animation-preview"), "mobile-skill-review", resolve(outputDir, "rpg-visual-review-mobile-skill.png"), outputs);
  } finally {
    await page.close();
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const widthInfo = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewport: window.innerWidth
  }));
  if (widthInfo.scrollWidth > widthInfo.viewport + 2 || widthInfo.bodyScrollWidth > widthInfo.viewport + 2) {
    throw new Error(`${label} overflow: ${JSON.stringify(widthInfo)}`);
  }
}

async function validateSkillPreviewArena(page: Page, label: string) {
  await page.waitForSelector(".rpg-skill-preview-arena .rpg-skill-preview-pet", { timeout: 15_000 });
  const info = await page.evaluate(() => ({
    arenaBackground: window.getComputedStyle(document.querySelector<HTMLElement>(".rpg-skill-preview-arena") ?? document.body).backgroundImage,
    fieldPetCount: document.querySelectorAll(".rpg-skill-preview-pet").length,
    leftPetCount: document.querySelectorAll(".rpg-skill-preview-pet.is-left").length,
    rightPetCount: document.querySelectorAll(".rpg-skill-preview-pet.is-right").length,
    mirroredRightPets: Array.from(document.querySelectorAll<HTMLElement>(".rpg-skill-preview-pet.is-right .rpg-pet-sprite-frame")).filter((sprite) => {
      const transform = window.getComputedStyle(sprite).transform;
      return transform !== "none" && new DOMMatrixReadOnly(transform).a < 0;
    }).length,
    cardStackCount: document.querySelectorAll(".rpg-field-card-stack").length,
    legacyBattlePetCount: document.querySelectorAll(".rpg-battle-pet, .rpg-pet-stand").length,
    previewPetFilters: Array.from(document.querySelectorAll<HTMLElement>(".rpg-skill-preview-pet .rpg-pet-sprite-frame")).map((sprite) => window.getComputedStyle(sprite).filter),
    previewPetPseudoContent: Array.from(document.querySelectorAll<HTMLElement>(".rpg-skill-preview-pet")).flatMap((pet) => [
      window.getComputedStyle(pet, "::before").content,
      window.getComputedStyle(pet, "::after").content
    ])
  }));

  if (!info.arenaBackground.includes("rpg-battle-arena") || !info.arenaBackground.includes(GENERATED_ASSET_VERSION)) {
    throw new Error(`${label} loaded stale or missing arena art: ${JSON.stringify(info)}`);
  }
  if (info.fieldPetCount !== 6 || info.leftPetCount !== 3 || info.rightPetCount !== 3) {
    throw new Error(`${label} must render mirrored 3v3 skill-preview pets: ${JSON.stringify(info)}`);
  }
  if (info.mirroredRightPets !== 3) {
    throw new Error(`${label} right-side pets must face left: ${JSON.stringify(info)}`);
  }
  if (info.cardStackCount !== 0 || info.legacyBattlePetCount !== 0) {
    throw new Error(`${label} must not render card stacks or legacy card-style pet nodes: ${JSON.stringify(info)}`);
  }
  if (info.previewPetFilters.length !== 6 || info.previewPetFilters.some((filter) => filter !== "none")) {
    throw new Error(`${label} pets must not use CSS filters/drop-shadows: ${JSON.stringify(info)}`);
  }
  if (info.previewPetPseudoContent.some((content) => content !== "none")) {
    throw new Error(`${label} pets must not render pseudo-element rings/platforms: ${JSON.stringify(info)}`);
  }
}

async function screenshot(locator: Locator, label: string, path: string, outputs: CaptureResult[]) {
  await locator.screenshot({ path });
  outputs.push({ label, path });
}

async function screenshotPage(page: Page, label: string, path: string, outputs: CaptureResult[]) {
  await page.screenshot({ path, fullPage: false });
  outputs.push({ label, path });
}

async function openRpgGym(page: Page, clientUrl: string) {
  await page.goto(`${clientUrl}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".rpg-layer");
  await page.getByRole("button", { name: "道館" }).click();
  await page.waitForSelector(".rpg-gym-panel");
}

async function moveFormationPetToFront(page: Page, definitionId: string) {
  await page.waitForSelector(".rpg-party-formation-board", { timeout: 15_000 });
  const current = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".rpg-party-formation-slot")).map((node) => node.getAttribute("data-pet-id") ?? "").filter(Boolean)
  );
  if (!current.includes(definitionId)) throw new Error(`Visual review cannot find formation pet ${definitionId}.`);
  const next = [definitionId, ...current.filter((id) => id !== definitionId)].slice(0, 3);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selectedId = await page.evaluate(() => {
      const slot = Array.from(document.querySelectorAll<HTMLElement>(".rpg-party-formation-slot")).find((node) => Boolean(node.getAttribute("data-pet-id")));
      return slot?.getAttribute("data-pet-id") ?? "";
    });
    if (!selectedId) break;
    await page.locator(`.rpg-party-formation-slot[data-pet-id='${selectedId}'] .rpg-party-slot-remove`).click();
    await page.waitForFunction(
      (id) => !Array.from(document.querySelectorAll(".rpg-party-formation-slot")).some((node) => node.getAttribute("data-pet-id") === id),
      selectedId,
      { timeout: 15_000 }
    );
  }
  for (const petId of next) {
    await page.locator(`.rpg-party-select-grid button[data-pet-id='${petId}']`).click();
    await page.waitForFunction(
      (id) => Array.from(document.querySelectorAll(".rpg-party-formation-slot")).some((node) => node.getAttribute("data-pet-id") === id),
      petId,
      { timeout: 15_000 }
    );
  }
  const front = await page.locator(".rpg-party-formation-slot[data-party-slot='0']").getAttribute("data-pet-id");
  if (front !== definitionId) throw new Error(`Visual review failed to move ${definitionId} to front.`);
}

async function waitRoomCode(page: Page) {
  await page.waitForFunction(() => /^[A-Z0-9]{5,8}$/.test(document.querySelector(".rpg-versus-waiting strong")?.textContent?.trim() ?? ""), null, { timeout: 15_000 });
  const code = (await page.locator(".rpg-versus-waiting strong").innerText()).trim();
  if (!/^[A-Z0-9]{5,8}$/.test(code)) {
    throw new Error(`Invalid RPG room code during visual review: ${code}`);
  }
  return code;
}

async function waitBattleField(page: Page) {
  await page.waitForSelector(".rpg-battle-field", { timeout: 15_000 });
  const info = await page.evaluate(() => ({
    arenaBackground: window.getComputedStyle(document.querySelector<HTMLElement>(".rpg-battle-field") ?? document.body).backgroundImage,
    fieldPetCount: document.querySelectorAll(".rpg-field-pet").length,
    leftPetCount: document.querySelectorAll(".rpg-field-pet.is-left").length,
    rightPetCount: document.querySelectorAll(".rpg-field-pet.is-right").length,
    mirroredRightPets: Array.from(document.querySelectorAll<HTMLElement>(".rpg-field-pet.is-right .rpg-field-pet-sprite")).filter((sprite) => {
      const transform = window.getComputedStyle(sprite).transform;
      return transform !== "none" && new DOMMatrixReadOnly(transform).a < 0;
    }).length,
    cardStackCount: document.querySelectorAll(".rpg-field-card-stack").length,
    legacyBattlePetCount: document.querySelectorAll(".rpg-battle-pet, .rpg-pet-stand").length,
    fieldSpriteFilters: Array.from(document.querySelectorAll<HTMLElement>(".rpg-field-pet .rpg-field-pet-sprite")).map((sprite) => window.getComputedStyle(sprite).filter),
    fieldPetPseudoContent: Array.from(document.querySelectorAll<HTMLElement>(".rpg-field-pet")).flatMap((pet) => [
      window.getComputedStyle(pet, "::before").content,
      window.getComputedStyle(pet, "::after").content
    ])
  }));

  if (!info.arenaBackground.includes("rpg-battle-arena") || !info.arenaBackground.includes(GENERATED_ASSET_VERSION)) {
    throw new Error(`RPG visual review battle field loaded stale or missing arena art: ${JSON.stringify(info)}`);
  }
  if (info.fieldPetCount !== 6 || info.leftPetCount !== 3 || info.rightPetCount !== 3) {
    throw new Error(`Expected mirrored 3v3 RPG field pets during visual review: ${JSON.stringify(info)}`);
  }
  if (info.mirroredRightPets !== 3) {
    throw new Error(`RPG visual review right-side pets must face left: ${JSON.stringify(info)}`);
  }
  if (info.cardStackCount !== 0 || info.legacyBattlePetCount !== 0) {
    throw new Error(`RPG visual review must not render card stacks or legacy pet cards: ${JSON.stringify(info)}`);
  }
  if (info.fieldSpriteFilters.length !== 6 || info.fieldSpriteFilters.some((filter) => filter !== "none")) {
    throw new Error(`RPG visual review field pets must not use CSS filters/drop-shadows: ${JSON.stringify(info)}`);
  }
  if (info.fieldPetPseudoContent.some((content) => content !== "none")) {
    throw new Error(`RPG visual review field pets must not render pseudo-element rings/platforms: ${JSON.stringify(info)}`);
  }
}

async function waitForBattleVfx(page: Page, label: string) {
  await page.waitForFunction(
    () => {
      const vfx = document.querySelector<HTMLElement>(".rpg-battle-vfx");
      if (!vfx) return false;
      const moveId = vfx.getAttribute("data-move-id");
      const actorSide = vfx.getAttribute("data-actor-side");
      const casterX = Number.parseFloat(vfx.getAttribute("data-caster-x") ?? "-999");
      const layer = vfx.querySelector(".rpg-fx-primary-vfx");
      return Boolean(moveId && actorSide && layer && (actorSide === "left" ? casterX < 50 : casterX > 50));
    },
    null,
    { timeout: 15_000 }
  );
  const info = await page.locator(".rpg-battle-vfx").first().evaluate((node) => ({
    moveId: node.getAttribute("data-move-id") ?? "",
    actorSide: node.getAttribute("data-actor-side") ?? "",
    casterX: Number.parseFloat(node.getAttribute("data-caster-x") ?? "-999"),
    targetSides: node.getAttribute("data-target-sides") ?? ""
  }));
  if (info.actorSide !== "left" && info.actorSide !== "right") throw new Error(`${label} missing actor side: ${JSON.stringify(info)}`);
  if (info.actorSide === "left" ? info.casterX >= 50 : info.casterX <= 50) throw new Error(`${label} caster x is on the wrong local side: ${JSON.stringify(info)}`);
}

async function openCurrentLeftActorCommands(page: Page) {
  await page.waitForFunction(
    () => document.querySelector(".rpg-field-pet.is-current-turn")?.classList.contains("is-left"),
    null,
    { timeout: 20_000 }
  );
  await page.locator(".rpg-field-pet.is-left.is-current-turn").first().click();
  await page.waitForSelector(".rpg-command-board.is-single .rpg-command-row .rpg-move-list button", { timeout: 15_000 });
}

async function submitCurrentActorMove(page: Page, preferredMoveNames: readonly string[]) {
  await openCurrentLeftActorCommands(page);
  const commandRow = page.locator(".rpg-command-board.is-single .rpg-command-row").first();
  let selectedButton: Locator | null = null;
  for (const moveName of preferredMoveNames) {
    const candidate = commandRow.locator(".rpg-move-list button:not([disabled])").filter({ hasText: moveName }).first();
    if (await candidate.count()) {
      selectedButton = candidate;
      break;
    }
  }
  selectedButton ??= commandRow.locator(".rpg-move-list button:not([disabled])").first();
  await selectedButton.click();
  const submit = page.locator(".rpg-battle-actions button").filter({ hasText: /執行|送出選招/ }).first();
  await submit.waitFor({ state: "visible" });
  if (await submit.isDisabled()) {
    throw new Error("Single-actor execute button is disabled during RPG visual review.");
  }
  await submit.click();
}

async function submitVersusCurrentActorMove(pageA: Page, pageB: Page, preferredMoveNames: readonly string[]) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await hasCurrentLeftActor(pageA)) {
      await submitCurrentActorMove(pageA, preferredMoveNames);
      return;
    }
    if (await hasCurrentLeftActor(pageB)) {
      await submitCurrentActorMove(pageB, preferredMoveNames);
      return;
    }
    await delay(250);
  }
  throw new Error("Versus visual review could not find the current local actor on either seat.");
}

async function hasCurrentLeftActor(page: Page) {
  return (await page.locator(".rpg-field-pet.is-left.is-current-turn").count()) > 0;
}

function writeGif(framesDir: string, outputPath: string, prefix: string) {
  const script = `
from pathlib import Path
from PIL import Image
import sys

frames_dir = Path(sys.argv[1])
output = Path(sys.argv[2])
prefix = sys.argv[3]
paths = sorted(frames_dir.glob(f"{prefix}-*.png"))
if not paths:
    raise SystemExit("No frames found for GIF")
frames = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE) for path in paths]
frames[0].save(output, save_all=True, append_images=frames[1:], duration=80, loop=0, optimize=False)
`;
  execFileSync("python3", ["-c", script, framesDir, outputPath, prefix], { stdio: "inherit" });
}

function validateVisualOutputs(outputs: CaptureResult[]) {
  const labels = new Set(outputs.map((output) => output.label));
  const missing = EXPECTED_VISUAL_OUTPUT_LABELS.filter((label) => !labels.has(label));
  const unexpected = outputs.filter((output) => !EXPECTED_VISUAL_OUTPUT_LABELS.includes(output.label as (typeof EXPECTED_VISUAL_OUTPUT_LABELS)[number]));
  const duplicates = outputs
    .map((output) => output.label)
    .filter((label, index, all) => all.indexOf(label) !== index);
  if (missing.length > 0 || unexpected.length > 0 || duplicates.length > 0) {
    throw new Error(
      `Visual review output set mismatch: ${JSON.stringify({
        missing,
        unexpected: unexpected.map((output) => output.label),
        duplicates
      })}`
    );
  }

  const script = `
import json
from pathlib import Path
from PIL import Image, ImageSequence
import sys

outputs = json.loads(sys.argv[1])
errors = []

for item in outputs:
    label = item["label"]
    path = Path(item["path"])
    if not path.exists():
        errors.append(f"{label}: missing {path}")
        continue
    size = path.stat().st_size
    if size < 10000:
        errors.append(f"{label}: file too small ({size} bytes)")
        continue
    try:
        image = Image.open(path)
        image.verify()
        image = Image.open(path)
    except Exception as exc:
        errors.append(f"{label}: unreadable image ({exc})")
        continue

    width, height = image.size
    if width < 240 or height < 160:
        errors.append(f"{label}: dimensions too small ({width}x{height})")
    frames = list(ImageSequence.Iterator(image))
    if path.suffix.lower() == ".gif" and len(frames) < 8:
        errors.append(f"{label}: GIF should contain at least 8 frames, got {len(frames)}")

    sample = frames[0].convert("RGB").resize((min(width, 320), min(height, 220)))
    colors = sample.getcolors(maxcolors=1000000) or []
    if len(colors) < 48:
        errors.append(f"{label}: too few sampled colors ({len(colors)})")

if errors:
    print("Visual output validation failed:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print(f"Visual output validation passed for {len(outputs)} files.")
`;
  execFileSync("python3", ["-c", script, JSON.stringify(outputs)], { stdio: "inherit" });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function galleryGroup(label: string) {
  if (label.startsWith("skill-") || label.startsWith("arena-")) return "Skill Animation";
  if (label.startsWith("pet-")) return "Pet Animation";
  if (label.startsWith("status-")) return "Status Animation";
  if (label.startsWith("rpg-ai")) return "AI Battle";
  if (label.startsWith("rpg-versus")) return "Versus Battle";
  if (label.startsWith("mobile-")) return "Mobile";
  if (label.startsWith("rpg-shop")) return "Shop";
  if (label.startsWith("rpg-gym")) return "Gym";
  if (label.startsWith("rpg-village")) return "Village";
  return "Release";
}

async function writeVisualReviewIndex(outputs: CaptureResult[], outputDir: string) {
  const grouped = outputs.reduce<Map<string, CaptureResult[]>>((groups, output) => {
    const group = galleryGroup(output.label);
    const items = groups.get(group) ?? [];
    items.push(output);
    groups.set(group, items);
    return groups;
  }, new Map<string, CaptureResult[]>());
  const orderedGroups = ["Release", "Village", "Shop", "Gym", "AI Battle", "Versus Battle", "Skill Animation", "Pet Animation", "Status Animation", "Mobile"];
  const generatedAt = new Date().toISOString();
  const sections = orderedGroups
    .filter((group) => grouped.has(group))
    .map((group) => {
      const cards = (grouped.get(group) ?? [])
        .map((output) => {
          const fileName = basename(output.path);
          const isGif = fileName.toLowerCase().endsWith(".gif");
          return `
            <article>
              <a href="./${escapeHtml(fileName)}" target="_blank" rel="noreferrer">
                <img src="./${escapeHtml(fileName)}" alt="${escapeHtml(output.label)}" loading="lazy">
              </a>
              <div>
                <strong>${escapeHtml(output.label)}</strong>
                <span>${isGif ? "GIF" : "PNG"} · ${escapeHtml(fileName)}</span>
              </div>
            </article>`;
        })
        .join("\n");
      return `
        <section>
          <h2>${escapeHtml(group)}</h2>
          <div class="grid">${cards}</div>
        </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RPG Visual Review Gallery</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #f8e7b6;
      background: #160e0a;
      font-family: Arial, "Noto Sans TC", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(22, 14, 10, 0.94);
      border-bottom: 4px solid #3c2417;
    }
    h1, h2, p { margin: 0; }
    h1 { font-size: 20px; letter-spacing: 0; }
    header p { margin-top: 5px; color: #d3b073; font-size: 12px; }
    header strong { align-self: center; color: #20120b; background: #d8aa61; border: 3px solid #20120b; padding: 8px 10px; }
    main { padding: 18px; display: grid; gap: 22px; }
    section { display: grid; gap: 10px; }
    h2 { font-size: 14px; color: #f5cf81; text-transform: uppercase; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      align-items: start;
    }
    article {
      min-width: 0;
      background: #281910;
      border: 4px solid #20120b;
      box-shadow: 0 8px 0 rgba(0, 0, 0, 0.22);
    }
    article a {
      display: block;
      min-height: 180px;
      max-height: 460px;
      overflow: auto;
      background: #0f0a07;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
      image-rendering: pixelated;
    }
    article div {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 10px;
      border-top: 3px solid #20120b;
    }
    article strong { font-size: 12px; }
    article span { color: #d1b078; font-size: 11px; overflow-wrap: anywhere; text-align: right; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>RPG Visual Review Gallery</h1>
      <p>${escapeHtml(outputs.length.toString())} outputs · generated ${escapeHtml(generatedAt)}</p>
    </div>
    <strong>release gate</strong>
  </header>
  <main>${sections}</main>
</body>
</html>
`;
  const galleryPath = resolve(outputDir, "rpg-visual-review-gallery.html");
  await writeFile(galleryPath, html);
  return galleryPath;
}

function delay(ms: number) {
  return new Promise<void>((resolveDelay) => setTimeout(resolveDelay, ms));
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

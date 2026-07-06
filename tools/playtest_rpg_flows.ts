import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { GENERATED_ASSET_VERSION } from "../apps/client/src/game/assets/generatedAssets";
import type { RpgWalletCollectible } from "../apps/server/src/rpg/walletCards";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLIENT_PORT = Number(process.env.RPG_PLAYTEST_PORT ?? 5176);
const SERVER_PORT = Number(process.env.RPG_PLAYTEST_SERVER_PORT ?? 8790);
const PROVIDED_CLIENT_URL = process.env.RPG_PLAYTEST_CLIENT_URL;
const PROVIDED_SERVER_URL = process.env.RPG_PLAYTEST_SERVER_URL;
const CLIENT_URL = PROVIDED_CLIENT_URL ?? `http://127.0.0.1:${CLIENT_PORT}`;
const SERVER_URL = PROVIDED_SERVER_URL ?? `http://127.0.0.1:${SERVER_PORT}`;
const STARTER_MOVE_NAMES = ["潮刃拍擊", "火爪快擊", "藤鞭拍擊"] as const;
const STARTER_ELEMENTS = ["water", "fire", "grass", "dark", "light"] as const;
const VILLAGE_INITIAL_FOLLOWER_DISTANCE_MAX = 500;
const VILLAGE_MOVING_FOLLOWER_DISTANCE_MAX = 520;
const STATUS_IDS = ["burn", "poison", "stun", "guard", "regen"] as const;
const RAW_STATUS_LOG_PATTERN = /\b(burn|poison|stun|guard|regen)\b/;
const LOCALIZED_STATUS_LOG_PATTERN = /燃燒|中毒|暈眩|防護|再生/;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const PLAYTEST_WALLET_ADDRESS = "0xef6c52085d12397c37652c4918036c1492fcf7a6";
const expectedShutdown = new WeakSet<ChildProcessWithoutNullStreams>();

interface TestPage {
  page: Page;
  errors: string[];
}

interface VillageFollowerDebugState {
  count: number;
  elements: string[];
  textureKeys: string[];
  animationKeys: string[];
  directions: string[];
  positions: { x: number; y: number }[];
  player: { x: number; y: number };
  facing: string;
  moving: boolean;
  minDistanceFromPlayer: number;
  maxDistanceFromPlayer: number;
}

async function main() {
  let clientServer: ChildProcessWithoutNullStreams | null = null;
  let gameServer: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  let tempProfileDir: string | null = null;
  try {
    let profileDbPath = process.env.RENAISS_RPG_DB_PATH || process.env.RENAISS_GAME_DB_PATH || "";
    let preferSqliteWalletCards = false;
    if (!PROVIDED_SERVER_URL) {
      if (!profileDbPath) {
        tempProfileDir = mkdtempSync(join(tmpdir(), "renaiss-rpg-playtest-"));
        profileDbPath = join(tempProfileDir, "rpg-profile.sqlite");
        await seedPlaytestWalletCards(profileDbPath);
        preferSqliteWalletCards = true;
      }
      gameServer = startGameServer(SERVER_PORT, profileDbPath, preferSqliteWalletCards);
      await waitForServer(SERVER_URL);
    }

    if (!PROVIDED_CLIENT_URL) {
      clientServer = startClientServer(CLIENT_PORT, SERVER_URL);
      await waitForClient(CLIENT_URL);
    }

    await assertServerHealth();
    browser = await chromium.launch({ headless: true });
    await verifyReleaseReview(browser);
    await verifyPetPreview(browser);
    await verifyVillageFollowers(browser);
    await verifyStatusPreview(browser);
    await verifySkillPreview(browser);
    await verifyWalletCardDrawAndEquip(browser);
    await verifyAiBattle(browser);
    await verifyMobileRpgLayout(browser);
    await verifyVersusBattleAndReconnect(browser);
  } finally {
    await browser?.close();
    await Promise.all([stopChild(clientServer), stopChild(gameServer)]);
    if (tempProfileDir) rmSync(tempProfileDir, { recursive: true, force: true });
  }
  console.log("RPG browser playtest passed.");
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

function startGameServer(port: number, profileDbPath = "", preferSqliteWalletCards = false) {
  const child = spawn("pnpm", ["--filter", "@renaiss-game/server", "exec", "tsx", "src/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      ...(profileDbPath ? { RENAISS_RPG_DB_PATH: profileDbPath } : {}),
      ...(preferSqliteWalletCards ? { RENAISS_RPG_WALLET_SQLITE_FIRST: "1" } : {})
    },
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

async function seedPlaytestWalletCards(profileDbPath: string) {
  process.env.RENAISS_RPG_DB_PATH = profileDbPath;
  const { persistRpgWalletCards } = await import("../apps/server/src/rpg/rpgProfileDb");
  persistRpgWalletCards(PLAYTEST_WALLET_ADDRESS, [
    playtestCard("playtest-charizard-high", "Charizard-Holo", "Playtest Fire Vault", 881, "Fire"),
    playtestCard("playtest-pikachu-light", "Pikachu-Holo", "Playtest Light Vault", 760, "Light"),
    playtestCard("playtest-gengar-dark", "Gengar Ex", "Playtest Dark Vault", 640, "Dark"),
    playtestCard("playtest-vaporeon-water", "Vaporeon", "Playtest Water Vault", 220, "Water"),
    playtestCard("playtest-leafeon-grass", "Leafeon", "Playtest Grass Vault", 180, "Grass")
  ]);
}

function playtestCard(tokenId: string, pokemonName: string, setName: string, fmvUSD: number, category: string): RpgWalletCollectible {
  return {
    id: tokenId,
    tokenId,
    name: pokemonName,
    pokemonName,
    setName,
    cardNumber: tokenId.replace(/^playtest-/, ""),
    year: "2026",
    language: "Playtest",
    ownerAddress: PLAYTEST_WALLET_ADDRESS,
    fmvUSD,
    imageUrl: "/assets/generated/skill-icons.png",
    attributes: [
      { trait: "Category", value: category },
      { trait: "Grade", value: "10 Gem Mint" }
    ],
    attributeCandidates: {
      category,
      genre: category,
      gradingCompany: "Playtest",
      grade: "10 Gem Mint",
      rarity: "Playtest"
    }
  };
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
  throw new Error(`Timed out waiting for RPG playtest client at ${clientUrl}: ${lastError}`);
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
  throw new Error(`Timed out waiting for RPG playtest server at ${serverUrl}: ${lastError}`);
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

async function assertServerHealth() {
  const response = await fetch(`${SERVER_URL}/health`);
  assert(response.ok, `Server health check failed: ${response.status}`);
}

async function newTestPage(browserOrContext: Browser | BrowserContext, label: string, viewport = { width: 1440, height: 900 }): Promise<TestPage> {
  const context = isBrowser(browserOrContext)
    ? await browserOrContext.newContext({ viewport })
    : browserOrContext;
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  return { page, errors };
}

function isBrowser(target: Browser | BrowserContext): target is Browser {
  return typeof (target as Browser).newContext === "function";
}

async function verifyReleaseReview(browser: Browser) {
  const test = await newTestPage(browser, "release-review");
  await test.page.goto(`${CLIENT_URL}/?preview=release`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-release-review");
  const info = await test.page.evaluate(() => ({
    metricText: Array.from(document.querySelectorAll(".rpg-release-metrics b")).map((node) => node.textContent?.trim() ?? ""),
    elementRows: document.querySelectorAll(".rpg-release-element-bars div").length,
    sourceRows: document.querySelectorAll(".rpg-release-source-list li").length,
    animationMetrics: Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>("[data-animation-metric]")).map((node) => [
        node.getAttribute("data-animation-metric") ?? "",
        Number.parseInt(node.textContent ?? "0", 10)
      ])
    ),
    animationDetails: Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>("[data-animation-detail]")).map((node) => [
        node.getAttribute("data-animation-detail") ?? "",
        Number.parseInt(node.textContent ?? "0", 10)
      ])
    ),
    animationCategories: Array.from(document.querySelectorAll<HTMLElement>(".rpg-release-category-list li")).map((node) => node.getAttribute("data-vfx-category") ?? ""),
    gateRows: document.querySelectorAll(".rpg-release-gates li").length,
    reviewLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>(".rpg-release-links a")).map((anchor) => anchor.getAttribute("href") ?? ""),
    headerLinks: document.querySelectorAll(".rpg-release-review > header nav a").length,
    assetImage: window.getComputedStyle(document.querySelector<HTMLElement>(".rpg-release-review") ?? document.body).backgroundImage
  }));
  assert(info.metricText.some((item) => item.includes("125")), `Release review missing 125-move metric: ${JSON.stringify(info)}`);
  assert(info.metricText.some((item) => item.includes("5")), `Release review missing five-pet metric: ${JSON.stringify(info)}`);
  assert(info.elementRows === 5, `Release review should show five element rows, got ${info.elementRows}`);
  assert(info.sourceRows >= 3, `Release review should show at least three VFX source rows, got ${info.sourceRows}`);
  assert(info.animationMetrics["skill-rows"] === 125, `Release review animation coverage missing 125 skill rows: ${JSON.stringify(info)}`);
  assert(info.animationMetrics["skill-frames"] >= 1900, `Release review animation coverage should count skill frames, got ${JSON.stringify(info.animationMetrics)}`);
  assert(info.animationMetrics["pet-frames"] === 90, `Release review animation coverage missing 90 pet frames: ${JSON.stringify(info.animationMetrics)}`);
  assert(info.animationMetrics["status-frames"] === 60, `Release review animation coverage missing 60 status frames: ${JSON.stringify(info.animationMetrics)}`);
  assert(info.animationDetails["pet-pose-sets"] === 25, `Release review animation coverage missing 25 pet pose sets: ${JSON.stringify(info.animationDetails)}`);
  assert(info.animationDetails["status-rows"] === 5, `Release review animation coverage missing 5 status rows: ${JSON.stringify(info.animationDetails)}`);
  assert(info.animationDetails["actor-path-moves"] > 0 && info.animationDetails["group-target-moves"] > 0 && info.animationDetails["status-layer-moves"] > 0, `Release review animation coverage missing path/group/status counts: ${JSON.stringify(info.animationDetails)}`);
  assert(info.animationDetails["bullet-moves"] === 4, `Release review animation coverage should identify 4 bullet moves: ${JSON.stringify(info.animationDetails)}`);
  for (const category of ["small-projectile", "impact-strike", "wide-sweep", "status-layered", "support-field", "ultimate-multiphase"]) {
    assert(info.animationCategories.includes(category), `Release review animation categories missing ${category}: ${JSON.stringify(info.animationCategories)}`);
  }
  assert(info.gateRows >= 7, `Release review should show all release gate commands, got ${info.gateRows}`);
  assert(info.headerLinks >= 4 && info.reviewLinks.includes("/?preview=skills") && info.reviewLinks.includes("/?preview=pets"), `Release review links incomplete: ${JSON.stringify(info)}`);
  assert(info.assetImage.includes("rpg-battle-arena"), `Release review did not load RPG arena background: ${info.assetImage}`);
  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyPetPreview(browser: Browser) {
  const test = await newTestPage(browser, "pet-preview");
  await test.page.goto(`${CLIENT_URL}/?preview=pets`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-animation-preview");
  const info = await test.page.evaluate(() => {
    const poseSprites = Array.from(document.querySelectorAll<HTMLElement>(".rpg-preview-poses .rpg-pet-sprite-frame"));
    const frameSprites = Array.from(document.querySelectorAll<HTMLElement>(".rpg-preview-frame-rack .rpg-pet-sprite-frame"));
    const sprites = [...poseSprites, ...frameSprites];
    const backgrounds = new Set(sprites.map((sprite) => window.getComputedStyle(sprite).backgroundImage));
    const poseRects = poseSprites.map((sprite) => sprite.getBoundingClientRect());
    const frameRects = frameSprites.map((sprite) => sprite.getBoundingClientRect());
    return {
      petCards: document.querySelectorAll(".rpg-preview-grid article").length,
      poseSpriteCount: poseSprites.length,
      frameSpriteCount: frameSprites.length,
      frameRackSections: document.querySelectorAll(".rpg-preview-frame-rack section").length,
      frameRackCells: document.querySelectorAll(".rpg-preview-frame-cell").length,
      backgrounds: [...backgrounds],
      minPoseSpriteWidth: Math.min(...poseRects.map((rect) => rect.width)),
      minPoseSpriteHeight: Math.min(...poseRects.map((rect) => rect.height)),
      minFrameSpriteWidth: Math.min(...frameRects.map((rect) => rect.width)),
      minFrameSpriteHeight: Math.min(...frameRects.map((rect) => rect.height)),
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    };
  });
  assert(info.petCards === 5, `Pet preview expected 5 starter cards, got ${info.petCards}`);
  assert(info.poseSpriteCount === 25, `Pet preview expected 25 pose sprites, got ${info.poseSpriteCount}`);
  assert(info.frameRackSections === 25, `Pet preview expected 25 frame-rack pose sections, got ${info.frameRackSections}`);
  assert(info.frameSpriteCount === 90, `Pet preview expected 90 individual frame sprites, got ${info.frameSpriteCount}`);
  assert(info.frameRackCells === 90, `Pet preview expected 90 individual frame cells, got ${info.frameRackCells}`);
  assert(info.backgrounds.length === 1 && info.backgrounds[0].includes("rpg-pet-sprites"), `Pet preview did not use RPG pet sheet: ${info.backgrounds.join(", ")}`);
  assert(info.backgrounds[0].includes(GENERATED_ASSET_VERSION), `Pet preview did not use current generated asset version: ${info.backgrounds[0]}`);
  assert(info.minPoseSpriteWidth >= 70 && info.minPoseSpriteHeight >= 70, `Pet preview pose sprites are too small: ${info.minPoseSpriteWidth}x${info.minPoseSpriteHeight}`);
  assert(info.minFrameSpriteWidth >= 48 && info.minFrameSpriteHeight >= 48, `Pet preview frame-rack sprites are too small: ${info.minFrameSpriteWidth}x${info.minFrameSpriteHeight}`);
  assert(info.width <= info.viewport + 2, `Pet preview has horizontal overflow: ${info.width} > ${info.viewport}`);
  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyVillageFollowers(browser: Browser) {
  const test = await newTestPage(browser, "village-followers");
  await test.page.goto(`${CLIENT_URL}/`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-layer");
  await test.page.waitForFunction(() => {
    const game = (window as unknown as { __renaissRpgGame?: { registry?: { get(key: string): unknown } } }).__renaissRpgGame;
    const state = game?.registry?.get("rpgVillageFollowers") as { count?: number; textureKeys?: string[]; directions?: string[] } | undefined;
    return state?.count === 5 && state.textureKeys?.every((key) => key === "rpgPetDirections") && state.directions?.every((direction) => direction === "down");
  });

  const initial = await readVillageFollowerState(test.page);
  assert(initial?.count === 5, `Village should expose 5 starter followers, got ${JSON.stringify(initial)}`);
  assert(JSON.stringify(initial.elements) === JSON.stringify(STARTER_ELEMENTS), `Village followers should keep five-element order, got ${initial.elements.join(", ")}`);
  assert(initial.textureKeys.every((key) => key === "rpgPetDirections"), `Village followers should start with front-facing direction sheet: ${initial.textureKeys.join(", ")}`);
  assert(initial.directions.every((direction) => direction === "down"), `Village followers should start front-facing, got ${initial.directions.join(", ")}`);
  assert(
    initial.minDistanceFromPlayer >= 48 && initial.maxDistanceFromPlayer <= VILLAGE_INITIAL_FOLLOWER_DISTANCE_MAX,
    `Initial follower spacing is wrong: ${JSON.stringify(initial)}`
  );

  await test.page.locator("canvas").first().click({ position: { x: 800, y: 520 } });
  const movementDirections = [
    { key: "ArrowDown", direction: "down", facing: "right" },
    { key: "ArrowUp", direction: "up", facing: "right" },
    { key: "ArrowRight", direction: "side", facing: "right" },
    { key: "ArrowLeft", direction: "side", facing: "left" }
  ] as const;
  let moving: VillageFollowerDebugState | null = null;
  for (const direction of movementDirections) {
    await test.page.keyboard.down(direction.key);
    try {
      await test.page.waitForFunction(
        ({ direction, facing }) => {
          const game = (window as unknown as { __renaissRpgGame?: { registry?: { get(key: string): unknown } } }).__renaissRpgGame;
          const state = game?.registry?.get("rpgVillageFollowers") as { count?: number; moving?: boolean; facing?: string; textureKeys?: string[]; animationKeys?: string[]; directions?: string[] } | undefined;
          if (state?.count !== 5 || state.moving !== true || state.facing !== facing || !state.directions?.every((value) => value === direction)) return false;
          return direction === "side"
            ? state.animationKeys?.every((key) => key.endsWith("_walk"))
            : state.textureKeys?.every((key) => key === "rpgPetDirectionWalk") && state.animationKeys?.every((key) => key.endsWith(`_${direction}_walk`));
        },
        { direction: direction.direction, facing: direction.facing },
        { timeout: 1500 }
      );
      await test.page.waitForFunction(
        ({ start }) => {
          const game = (window as unknown as { __renaissRpgGame?: { registry?: { get(key: string): unknown } } }).__renaissRpgGame;
          const state = game?.registry?.get("rpgVillageFollowers") as { player?: { x: number; y: number } } | undefined;
          if (!state?.player) return false;
          const dx = state.player.x - start.x;
          const dy = state.player.y - start.y;
          return Math.hypot(dx, dy) > 70;
        },
        { start: initial.player },
        { timeout: 2600 }
      );
      moving = await readVillageFollowerState(test.page);
      break;
    } catch {
      await test.page.keyboard.up(direction.key);
    }
  }
  assert(moving?.count === 5, `Moving village follower state missing: ${JSON.stringify(moving)}`);
  assert(moving.moving, `Followers should report movement: ${JSON.stringify(moving)}`);
  if (moving.directions.every((direction) => direction === "side")) {
    assert(moving.animationKeys.every((key) => key.endsWith("_walk")), `Side followers should play walk animations while moving: ${moving.animationKeys.join(", ")}`);
  } else {
    const direction = moving.directions[0];
    assert(moving.textureKeys.every((key) => key === "rpgPetDirectionWalk"), `Vertical followers should use direction walk sheet while moving: ${moving.textureKeys.join(", ")}`);
    assert(moving.animationKeys.every((key) => key.endsWith(`_${direction}_walk`)), `Vertical followers should play ${direction} walk animations while moving: ${moving.animationKeys.join(", ")}`);
  }
  assert(pointDistance(initial.player, moving.player) > 70, `Player did not move far enough for follower validation: ${JSON.stringify({ initial: initial.player, moving: moving.player })}`);
  const movedFollowerCount = moving.positions.filter((position, index) => pointDistance(position, initial.positions[index]) > 4).length;
  assert(movedFollowerCount >= 3, `Expected at least 3 followers to advance along the trail, got ${movedFollowerCount}: ${JSON.stringify({ initial, moving })}`);
  assert(
    moving.minDistanceFromPlayer >= 48 && moving.maxDistanceFromPlayer <= VILLAGE_MOVING_FOLLOWER_DISTANCE_MAX,
    `Moving follower spacing is wrong: ${JSON.stringify(moving)}`
  );

  for (const direction of movementDirections) {
    await test.page.keyboard.up(direction.key);
  }
  await test.page.waitForFunction(() => {
    const game = (window as unknown as { __renaissRpgGame?: { registry?: { get(key: string): unknown } } }).__renaissRpgGame;
    const state = game?.registry?.get("rpgVillageFollowers") as { count?: number; moving?: boolean; textureKeys?: string[]; animationKeys?: string[]; directions?: string[] } | undefined;
    if (state?.count !== 5 || state.moving !== false) return false;
    return state.directions?.every((direction) => direction === "side")
      ? state.animationKeys?.every((key) => key.endsWith("_idle"))
      : state.textureKeys?.every((key) => key === "rpgPetDirections");
  });
  const stopped = await readVillageFollowerState(test.page);
  assert(stopped?.directions.length === 5, `Followers should expose stopped directions: ${JSON.stringify(stopped)}`);
  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyWalletCardDrawAndEquip(browser: Browser) {
  const test = await newTestPage(browser, "wallet-card-equip");
  await openRpgProfile(test.page);
  await test.page.locator(".rpg-element-filter button").filter({ hasText: "火" }).click();
  await test.page.waitForSelector(".rpg-wallet-card-grid .rpg-wallet-card", { timeout: 15_000 });
  const fireWalletInfo = await test.page.evaluate(() => ({
    cardCount: document.querySelectorAll(".rpg-wallet-card-grid .rpg-wallet-card").length,
    cards: Array.from(document.querySelectorAll<HTMLElement>(".rpg-wallet-card")).map((card) => ({
      tokenId: card.dataset.tokenId ?? "",
      text: card.textContent ?? "",
      bound: card.classList.contains("is-bound")
    }))
  }));
  assert(fireWalletInfo.cardCount >= 1, `Fire wallet filter should show playtest cards: ${JSON.stringify(fireWalletInfo)}`);

  const fireCard = test.page.locator(".rpg-wallet-card").filter({ hasText: "Charizard-Holo" }).first();
  await fireCard.locator(".rpg-wallet-card-summary").click();
  await test.page.waitForSelector(".rpg-wallet-card.is-expanded.is-draw-ready", { timeout: 15_000 });
  await test.page.locator(".rpg-wallet-card.is-expanded .rpg-wallet-draw-ready button").filter({ hasText: "抽取技能" }).click();
  await finishWalletOpeningIfNeeded(test.page);
  await test.page.waitForSelector(".rpg-wallet-card.is-expanded .rpg-bound-skill-reveal", { timeout: 15_000 });
  const drawnMoveInfo = await readExpandedWalletMove(test.page);
  assert(drawnMoveInfo.name && drawnMoveInfo.elementText.includes("火"), `Drawn wallet card should bind a fire skill: ${JSON.stringify(drawnMoveInfo)}`);
  const equippedMoveName = drawnMoveInfo.name;

  await openRpgProfile(test.page);
  await test.page.locator(".rpg-element-filter button").filter({ hasText: "火" }).click();
  await test.page.locator(".rpg-wallet-card").filter({ hasText: "Charizard-Holo" }).first().locator(".rpg-wallet-card-summary").click();
  await test.page.waitForSelector(".rpg-wallet-card.is-expanded.is-bound-detail .rpg-bound-skill-reveal", { timeout: 15_000 });
  const persistedMoveInfo = await readExpandedWalletMove(test.page);
  assert(persistedMoveInfo.name === equippedMoveName, `SQLite should preserve the card skill binding after reload: ${JSON.stringify({ equippedMoveName, persistedMoveInfo })}`);

  await test.page.locator(".rpg-library-pets button").filter({ hasText: "火" }).click();
  await test.page.waitForFunction(
    (moveName) => Array.from(document.querySelectorAll(".rpg-card-equip-list button strong")).some((node) => node.textContent?.trim() === moveName),
    equippedMoveName,
    { timeout: 15_000 }
  );
  await test.page.locator(".rpg-card-equip-list button").filter({ hasText: equippedMoveName }).first().click();
  await test.page.waitForFunction(
    (moveName) => Array.from(document.querySelectorAll(".rpg-equipped-card-slot.is-filled strong")).some((node) => node.textContent?.trim() === moveName),
    equippedMoveName,
    { timeout: 15_000 }
  );

  await test.page.getByRole("button", { name: "道館" }).click();
  await test.page.waitForSelector(".rpg-gym-panel");
  await test.page.waitForSelector(".rpg-party-formation-board");
  await setGymFormation(test.page, ["pet_fire_emberfox", "pet_water_tidefin", "pet_grass_mossling"]);
  await test.page.locator(".rpg-gym-modes button").filter({ hasText: "AI 對戰" }).click();
  await waitBattleField(test.page);
  await test.page.waitForFunction(
    () => Boolean(document.querySelector(".rpg-field-pet.is-left.is-current-turn[data-definition-id='pet_fire_emberfox']")),
    undefined,
    { timeout: 15_000 }
  );
  const currentFirePetId = await test.page.locator(".rpg-field-pet.is-left.is-current-turn[data-definition-id='pet_fire_emberfox']").getAttribute("data-pet-id");
  assert(currentFirePetId, "Fire pet did not become the selectable current actor.");
  await test.page.locator(`.rpg-field-pet.is-left.is-current-turn[data-pet-id="${currentFirePetId}"]`).click();
  await test.page.waitForFunction(
    ({ moveName, actorId }) => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".rpg-command-row"));
      return rows.length === 1 && rows.some((row) => row.getAttribute("data-actor-id") === actorId) &&
        rows.some((row) => Array.from(row.querySelectorAll(".rpg-move-list button strong")).some((node) => node.textContent?.trim() === moveName));
    },
    { moveName: equippedMoveName, actorId: currentFirePetId },
    { timeout: 15_000 }
  );
  const battleMoveInfo = await test.page.evaluate(({ moveName, actorId }) => {
    const rows = Array.from(document.querySelectorAll(".rpg-command-row"));
    return {
      rowCount: rows.length,
      actorIds: rows.map((row) => row.getAttribute("data-actor-id") ?? ""),
      expectedActorId: actorId,
      matchingRows: rows.filter((row) => Array.from(row.querySelectorAll(".rpg-move-list button strong")).some((node) => node.textContent?.trim() === moveName)).length,
      moveText: Array.from(document.querySelectorAll(".rpg-command-row .rpg-move-list button strong")).map((node) => node.textContent?.trim())
    };
  }, { moveName: equippedMoveName, actorId: currentFirePetId });
  assert(battleMoveInfo.rowCount === 1 && battleMoveInfo.actorIds.includes(currentFirePetId), `Expected one current-actor command row for fire pet, got ${JSON.stringify(battleMoveInfo)}`);
  assert(battleMoveInfo.matchingRows === 1, `Equipped move ${equippedMoveName} should appear on exactly one battle pet, got ${battleMoveInfo.matchingRows}; moves: ${battleMoveInfo.moveText.join(", ")}`);
  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyStatusPreview(browser: Browser) {
  const test = await newTestPage(browser, "status-preview");
  await test.page.goto(`${CLIENT_URL}/?preview=status`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-status-animation-preview");
  await test.page.waitForTimeout(260);
  const info = await test.page.evaluate(() => {
    const statusEffects = Array.from(document.querySelectorAll<HTMLElement>(".rpg-status-review-stage .rpg-status-effect"));
    const frameCells = Array.from(document.querySelectorAll<HTMLElement>(".rpg-status-frame-cell"));
    const effectRows = statusEffects.map((node) => node.getAttribute("data-status-row") ?? "");
    const effectIds = statusEffects.map((node) => node.getAttribute("data-status-id") ?? "");
    const effectBackgrounds = statusEffects.map((node) => window.getComputedStyle(node).backgroundImage);
    const effectBackgroundSizes = statusEffects.map((node) => window.getComputedStyle(node).backgroundSize);
    const frameIds = frameCells.map((node) => node.getAttribute("data-status-id") ?? "");
    const frameRows = frameCells.map((node) => node.getAttribute("data-status-row") ?? "");
    const frameColumns = frameCells.map((node) => node.getAttribute("data-status-column") ?? "");
    const frameBackground = frameCells[0] ? window.getComputedStyle(frameCells[0]).backgroundImage : "";
    return {
      cardCount: document.querySelectorAll(".rpg-status-review-grid article").length,
      effectCount: statusEffects.length,
      effectIds,
      effectRows,
      effectBackgrounds,
      effectBackgroundSizes,
      frameCellCount: frameCells.length,
      frameIds,
      frameRows,
      frameColumns,
      frameBackground,
      petSpriteCount: document.querySelectorAll(".rpg-status-review-stage .rpg-pet-sprite-frame").length,
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    };
  });
  assert(info.cardCount === 5, `Status preview expected 5 status cards, got ${info.cardCount}`);
  assert(info.effectCount === 5, `Status preview expected 5 live status overlays, got ${info.effectCount}`);
  assert(info.petSpriteCount === 5, `Status preview expected 5 pet silhouettes, got ${info.petSpriteCount}`);
  assert(JSON.stringify(info.effectIds) === JSON.stringify(STATUS_IDS), `Status preview ids are wrong: ${info.effectIds.join(", ")}`);
  assert(new Set(info.effectRows).size === 5 && info.effectRows.join(",") === "0,1,2,3,4", `Status preview should use 5 distinct sheet rows: ${info.effectRows.join(", ")}`);
  assert(info.effectBackgrounds.every((background) => background.includes("rpg-status-vfx")), `Status overlays did not all use rpg-status-vfx: ${info.effectBackgrounds.join(" | ")}`);
  assert(info.effectBackgrounds.every((background) => background.includes(GENERATED_ASSET_VERSION)), `Status overlays did not use current asset version: ${info.effectBackgrounds.join(" | ")}`);
  assert(info.effectBackgroundSizes.every((size) => size.includes("1200%") && size.includes("500%")), `Status overlay background size should match 12x5 sheet: ${info.effectBackgroundSizes.join(" | ")}`);
  assert(info.frameCellCount === 60, `Status preview expected 60 frame cells, got ${info.frameCellCount}`);
  for (const statusId of STATUS_IDS) {
    const count = info.frameIds.filter((id) => id === statusId).length;
    assert(count === 12, `Status preview expected 12 frame cells for ${statusId}, got ${count}`);
  }
  assert(new Set(info.frameRows).size === 5, `Status frame rack should expose 5 unique rows: ${info.frameRows.join(", ")}`);
  assert(new Set(info.frameColumns).size === 12, `Status frame rack should expose 12 unique columns: ${info.frameColumns.join(", ")}`);
  assert(info.frameBackground.includes("rpg-status-vfx") && info.frameBackground.includes(GENERATED_ASSET_VERSION), `Status frame rack did not use current status sheet: ${info.frameBackground}`);
  assert(info.width <= info.viewport + 2, `Status preview has horizontal overflow: ${info.width} > ${info.viewport}`);
  assertNoErrors(test);
  await test.page.context().close();
}

async function verifySkillPreview(browser: Browser) {
  const test = await newTestPage(browser, "skill-preview");
  await test.page.goto(`${CLIENT_URL}/?preview=skills`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-skill-animation-preview");
  await test.page.waitForTimeout(420);
  const info = await test.page.evaluate(() => {
    const primary = document.querySelector(".rpg-skill-preview-arena .rpg-skill-primary-vfx");
    const primaryStyle = primary ? window.getComputedStyle(primary) : null;
    const arena = document.querySelector<HTMLElement>(".rpg-skill-preview-arena");
    const arenaStyle = arena ? window.getComputedStyle(arena) : null;
    const travel = document.querySelector<HTMLElement>(".rpg-skill-travel-vfx");
    const travelStyle = travel ? window.getComputedStyle(travel) : null;
    const travelRect = travel?.getBoundingClientRect();
    const arenaRect = arena?.getBoundingClientRect();
    const petCenters = Object.fromEntries(
      Object.entries({
        leftFront: ".rpg-skill-preview-pet.is-left.slot-0",
        leftBackTop: ".rpg-skill-preview-pet.is-left.slot-1",
        leftBackBottom: ".rpg-skill-preview-pet.is-left.slot-2",
        rightFront: ".rpg-skill-preview-pet.is-right.slot-0",
        rightBackTop: ".rpg-skill-preview-pet.is-right.slot-1",
        rightBackBottom: ".rpg-skill-preview-pet.is-right.slot-2"
      }).map(([key, selector]) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node || !arenaRect) return [key, { x: -999, y: -999 }];
        const rect = node.getBoundingClientRect();
        return [
          key,
          {
            x: rect.left + rect.width / 2 - arenaRect.left,
            y: rect.top + rect.height / 2 - arenaRect.top
          }
        ];
      })
    ) as Record<string, { x: number; y: number }>;
    const line = document.querySelector<SVGLineElement>(".rpg-skill-cast-lanes line");
    const travelVars = travel
      ? {
          fromX: Number.parseFloat(travel.style.getPropertyValue("--from-x")),
          fromY: Number.parseFloat(travel.style.getPropertyValue("--from-y")),
          toX: Number.parseFloat(travel.style.getPropertyValue("--to-x")),
          toY: Number.parseFloat(travel.style.getPropertyValue("--to-y"))
        }
      : { fromX: -999, fromY: -999, toX: -999, toY: -999 };
    return {
      selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
      selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
      selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
      selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
      selectedPhases: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-phases") ?? "",
      usesBulletProjectile: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-uses-bullet-projectile") ?? "",
      listCount: document.querySelectorAll(".rpg-skill-preview-list button").length,
      catalogCount: document.querySelectorAll(".rpg-skill-catalog-button").length,
      catalogThumbCount: document.querySelectorAll(".rpg-skill-catalog-button .rpg-skill-catalog-thumb").length,
      frameStripCount: document.querySelectorAll(".rpg-skill-frame-strip > div > button").length,
      fieldPetCount: document.querySelectorAll(".rpg-skill-preview-pet").length,
      actingPetCount: document.querySelectorAll(".rpg-skill-preview-pet.is-left.is-acting.slot-0").length,
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
      ]),
      targetedSlots: document.querySelectorAll(".rpg-skill-preview-pet.is-targeted").length,
      castLaneCount: document.querySelectorAll(".rpg-skill-cast-lanes line").length,
      primaryVfxCount: document.querySelectorAll(".rpg-skill-primary-vfx").length,
      casterVfxCount: document.querySelectorAll(".rpg-skill-caster-vfx").length,
      targetVfxCount: document.querySelectorAll(".rpg-skill-preview-pet.is-targeted .rpg-skill-target-vfx").length,
      travelVfxCount: document.querySelectorAll(".rpg-skill-travel-vfx").length,
      primaryBackground: primaryStyle?.backgroundImage ?? "",
      travelBackground: travelStyle?.backgroundImage ?? "",
      travelBackgroundSize: travelStyle?.backgroundSize ?? "",
      travelWidth: travelRect?.width ?? 0,
      travelHeight: travelRect?.height ?? 0,
      arenaBackground: arenaStyle?.backgroundImage ?? "",
      formation: {
        leftFront: petCenters.leftFront,
        leftBackTop: petCenters.leftBackTop,
        leftBackBottom: petCenters.leftBackBottom,
        rightFront: petCenters.rightFront,
        rightBackTop: petCenters.rightBackTop,
        rightBackBottom: petCenters.rightBackBottom
      },
      singleLane: {
        x1: Number.parseFloat(line?.getAttribute("x1") ?? "-999"),
        y1: Number.parseFloat(line?.getAttribute("y1") ?? "-999"),
        x2: Number.parseFloat(line?.getAttribute("x2") ?? "-999"),
        y2: Number.parseFloat(line?.getAttribute("y2") ?? "-999"),
        ...travelVars
      },
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    };
  });
  assert(info.listCount === 10, `Skill preview expected 10 filtered moves, got ${info.listCount}`);
  assert(info.catalogCount === 125, `Skill preview expected 125 catalog moves, got ${info.catalogCount}`);
  assert(info.catalogThumbCount === 125, `Skill preview expected 125 catalog VFX thumbnails, got ${info.catalogThumbCount}`);
  assert(info.frameStripCount === 16, `Skill preview expected 16 frame buttons, got ${info.frameStripCount}`);
  assert(info.fieldPetCount === 6, `Skill preview expected 6 visible battle pets, got ${info.fieldPetCount}`);
  assert(info.actingPetCount === 1, `Skill preview expected left front actor, got ${info.actingPetCount}`);
  assert(info.mirroredRightPets === 3, `Skill preview should mirror 3 right-side pet sprites, got ${info.mirroredRightPets}`);
  assert(info.cardStackCount === 0, `Skill preview must not render field card stacks, got ${info.cardStackCount}`);
  assert(info.legacyBattlePetCount === 0, `Skill preview must not render legacy card-style pet nodes, got ${info.legacyBattlePetCount}`);
  assert(
    info.previewPetFilters.length === 6 && info.previewPetFilters.every((filter) => filter === "none"),
    `Skill preview pets should not use CSS filters/drop-shadows: ${JSON.stringify(info.previewPetFilters)}`
  );
  assert(
    info.previewPetPseudoContent.every((content) => content === "none"),
    `Skill preview pets should not render pseudo-element rings/platforms: ${JSON.stringify(info.previewPetPseudoContent)}`
  );
  assert(info.targetedSlots === 1, `Single-target preview should target 1 slot, got ${info.targetedSlots}`);
  assert(info.castLaneCount === 1, `Single-target preview should render 1 cast lane, got ${info.castLaneCount}`);
  assert(info.primaryVfxCount === 1, `Single-target preview should render exactly one primary VFX sequence, got ${info.primaryVfxCount}`);
  assert(info.casterVfxCount === 0, `Single-target preview must not render a separate caster VFX layer, got ${info.casterVfxCount}`);
  assert(info.targetVfxCount === 0, `Single-target travel preview must not render a second target VFX layer, got ${info.targetVfxCount}`);
  assert(info.travelVfxCount === 1, `Single-target preview should render 1 traveling skill sprite, got ${info.travelVfxCount}`);
  assert(info.selectedCategory === "impact-strike", `Default skill preview should be impact-strike, got ${info.selectedCategory}`);
  assert(info.selectedPrimarySource === "external-spellsfx-2", `Default skill preview should use one complete SpellsFX sequence: ${JSON.stringify(info)}`);
  assert(info.selectedSources === info.selectedPrimarySource, `Skill preview data-vfx-sources should expose only the primary sequence: ${JSON.stringify(info)}`);
  assert(info.selectedStatusSource === "", `Default strike should not declare a status spritesheet: ${JSON.stringify(info)}`);
  assert(info.usesBulletProjectile === "false", `Default strike should not use bullet projectile: ${info.usesBulletProjectile}`);
  assert(info.primaryBackground.includes("rpg-skill-vfx-water"), `Skill preview did not load water VFX sheet: ${info.primaryBackground}`);
  assert(info.travelBackground.includes("rpg-skill-vfx-water"), `Default strike travel should use water VFX sheet: ${info.travelBackground}`);
  assert(info.travelBackground.includes(GENERATED_ASSET_VERSION), `Default strike travel did not use current generated asset version: ${info.travelBackground}`);
  assert(info.travelBackgroundSize.includes("1600%") && info.travelBackgroundSize.includes("2500%"), `Default strike travel background size is wrong: ${info.travelBackgroundSize}`);
  assert(info.travelWidth >= 90 && info.travelHeight >= 55, `Default strike travel VFX is too small: ${info.travelWidth}x${info.travelHeight}`);
  assert(info.arenaBackground.includes("rpg-battle-arena"), `Skill preview did not load battle arena background: ${info.arenaBackground}`);
  assert(info.arenaBackground.includes(GENERATED_ASSET_VERSION), `Skill preview did not use current arena background version: ${info.arenaBackground}`);
  assert(info.formation.leftBackTop.x < info.formation.leftFront.x - 90, `Skill preview left back pair should sit behind the left front slot: ${JSON.stringify(info.formation)}`);
  assert(info.formation.leftBackBottom.x < info.formation.leftFront.x - 90, `Skill preview left back pair should sit behind the left front slot: ${JSON.stringify(info.formation)}`);
  assert(Math.abs(info.formation.leftBackTop.x - info.formation.leftBackBottom.x) <= 24, `Skill preview left back pair should be vertically stacked: ${JSON.stringify(info.formation)}`);
  assert(info.formation.leftBackTop.y < info.formation.leftFront.y - 40 && info.formation.leftBackBottom.y > info.formation.leftFront.y + 40, `Skill preview left side must be one front plus two vertical back slots: ${JSON.stringify(info.formation)}`);
  assert(info.formation.rightBackTop.x > info.formation.rightFront.x + 90, `Skill preview right back pair should sit behind the right front slot: ${JSON.stringify(info.formation)}`);
  assert(info.formation.rightBackBottom.x > info.formation.rightFront.x + 90, `Skill preview right back pair should sit behind the right front slot: ${JSON.stringify(info.formation)}`);
  assert(Math.abs(info.formation.rightBackTop.x - info.formation.rightBackBottom.x) <= 24, `Skill preview right back pair should be vertically stacked: ${JSON.stringify(info.formation)}`);
  assert(info.formation.rightBackTop.y < info.formation.rightFront.y - 40 && info.formation.rightBackBottom.y > info.formation.rightFront.y + 40, `Skill preview right side must be one front plus two vertical back slots: ${JSON.stringify(info.formation)}`);
  assert(info.singleLane.x1 < info.singleLane.x2 - 20, `Single-target lane must travel left-to-right from caster to enemy: ${JSON.stringify(info.singleLane)}`);
  assert(Math.abs(info.singleLane.fromX - info.singleLane.x1) <= 1 && Math.abs(info.singleLane.toX - info.singleLane.x2) <= 1, `Single-target travel VFX must use the same caster-to-target endpoints as the lane: ${JSON.stringify(info.singleLane)}`);
  assert(info.width <= info.viewport + 2, `Skill preview has horizontal overflow: ${info.width} > ${info.viewport}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='water_basic_07']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-target") === "allEnemies");
  const groupInfo = await test.page.evaluate(() => {
    const lanes = Array.from(document.querySelectorAll<SVGLineElement>(".rpg-skill-cast-lanes line")).map((line) => ({
      x1: Number.parseFloat(line.getAttribute("x1") ?? "-999"),
      y1: Number.parseFloat(line.getAttribute("y1") ?? "-999"),
      x2: Number.parseFloat(line.getAttribute("x2") ?? "-999"),
      y2: Number.parseFloat(line.getAttribute("y2") ?? "-999")
    }));
    const travels = Array.from(document.querySelectorAll<HTMLElement>(".rpg-skill-travel-vfx")).map((travel) => ({
      fromX: Number.parseFloat(travel.style.getPropertyValue("--from-x")),
      fromY: Number.parseFloat(travel.style.getPropertyValue("--from-y")),
      toX: Number.parseFloat(travel.style.getPropertyValue("--to-x")),
      toY: Number.parseFloat(travel.style.getPropertyValue("--to-y"))
    }));
    return {
      selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
      selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
      selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
      selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
      usesBulletProjectile: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-uses-bullet-projectile") ?? "",
      targetedSlots: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted").length,
      primaryVfxCount: document.querySelectorAll(".rpg-skill-primary-vfx").length,
      targetVfxCount: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted .rpg-skill-target-vfx").length,
      castLaneCount: document.querySelectorAll(".rpg-skill-cast-lanes line").length,
      travelVfxCount: document.querySelectorAll(".rpg-skill-travel-vfx").length,
      mirroredRightTargets: Array.from(document.querySelectorAll<HTMLElement>(".rpg-skill-preview-pet.is-right.is-targeted .rpg-pet-sprite-frame")).filter((sprite) => {
        const transform = window.getComputedStyle(sprite).transform;
        return transform !== "none" && new DOMMatrixReadOnly(transform).a < 0;
      }).length,
      lanes,
      travels
    };
  });
  assert(groupInfo.targetedSlots === 3, `Group skill preview should target 3 slots, got ${groupInfo.targetedSlots}`);
  assert(groupInfo.primaryVfxCount === 3, `Group skill preview should render exactly 3 primary VFX sequences, got ${groupInfo.primaryVfxCount}`);
  assert(groupInfo.targetVfxCount === 0, `Group travel preview must not render second target VFX sprites, got ${groupInfo.targetVfxCount}`);
  assert(groupInfo.castLaneCount === 3, `Group skill preview should render 3 cast lanes, got ${groupInfo.castLaneCount}`);
  assert(groupInfo.travelVfxCount === 3, `Group skill preview should render 3 traveling skill sprites, got ${groupInfo.travelVfxCount}`);
  assert(groupInfo.selectedCategory === "wide-sweep", `Group sweep should use wide-sweep category, got ${groupInfo.selectedCategory}`);
  assert(groupInfo.selectedPrimarySource === "external-spellsfx-2", `Water group sweep should use one complete SpellsFX wave sequence: ${JSON.stringify(groupInfo)}`);
  assert(groupInfo.selectedSources === groupInfo.selectedPrimarySource, `Group sweep should expose only one primary VFX source: ${JSON.stringify(groupInfo)}`);
  assert(groupInfo.selectedStatusSource === "", `Group sweep should not declare a status spritesheet: ${JSON.stringify(groupInfo)}`);
  assert(groupInfo.usesBulletProjectile === "false", `Group sweep must not use bullet projectile: ${groupInfo.usesBulletProjectile}`);
  assert(groupInfo.mirroredRightTargets === 3, `Group skill preview should mirror 3 right-side target sprites, got ${groupInfo.mirroredRightTargets}`);
  assert(groupInfo.lanes.every((lane) => lane.x1 < lane.x2 - 20), `Group skill lanes must all travel from left caster to right targets: ${JSON.stringify(groupInfo.lanes)}`);
  assert(new Set(groupInfo.lanes.map((lane) => `${lane.x1},${lane.y1}`)).size === 1, `Group skill lanes must share one caster origin: ${JSON.stringify(groupInfo.lanes)}`);
  assert(groupInfo.travels.length === groupInfo.lanes.length, `Group skill travel sprites must match lane count: ${JSON.stringify(groupInfo)}`);
  assert(groupInfo.travels.every((travel, index) => Math.abs(travel.fromX - groupInfo.lanes[index].x1) <= 1 && Math.abs(travel.toX - groupInfo.lanes[index].x2) <= 1), `Group travel sprites must use matching caster-to-target endpoints: ${JSON.stringify(groupInfo)}`);

  await test.page.locator(".rpg-skill-frame-strip > div > button").nth(5).click();
  const frameInfo = await test.page.evaluate(() => ({
    activeFrames: document.querySelectorAll(".rpg-skill-frame-strip > div > button.is-active").length,
    activeLabel: document.querySelector(".rpg-skill-frame-strip > div > button.is-active span:not(.rpg-skill-vfx-frame)")?.textContent?.trim() ?? ""
  }));
  assert(frameInfo.activeFrames === 1 && frameInfo.activeLabel === "06", `Frame strip did not lock frame 06: ${JSON.stringify(frameInfo)}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_02']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_basic_02");
  const fireInfo = await test.page.evaluate(() => {
    const caster = document.querySelector<HTMLElement>(".rpg-skill-preview-arena .rpg-skill-caster-vfx");
    const travel = document.querySelector<HTMLElement>(".rpg-skill-travel-vfx");
    const travelStyle = travel ? window.getComputedStyle(travel) : null;
    return {
      selectedMoveId: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id"),
      selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
      selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
      selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
      selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
      usesBulletProjectile: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-uses-bullet-projectile") ?? "",
      casterCount: caster ? 1 : 0,
      targetVfxCount: document.querySelectorAll(".rpg-skill-preview-pet.is-targeted .rpg-skill-target-vfx").length,
      frameStripCount: document.querySelectorAll(".rpg-skill-frame-strip > div > button").length,
      travelBackground: travelStyle?.backgroundImage ?? "",
      travelPosition: travelStyle?.backgroundPosition ?? ""
    };
  });
  assert(fireInfo.selectedMoveId === "fire_basic_02", `Fire catalog click selected ${fireInfo.selectedMoveId}`);
  assert(fireInfo.selectedCategory === "small-projectile", `Fire bullet move should be small-projectile, got ${fireInfo.selectedCategory}`);
  assert(fireInfo.selectedPrimarySource === "external-16x16-bullet", `Fire bullet move missing external bullet primary source: ${JSON.stringify(fireInfo)}`);
  assert(fireInfo.selectedSources === fireInfo.selectedPrimarySource, `Fire bullet move should not mix bullet with another VFX pack: ${JSON.stringify(fireInfo)}`);
  assert(fireInfo.usesBulletProjectile === "true", `Fire bullet move should use bullet projectile: ${fireInfo.usesBulletProjectile}`);
  assert(fireInfo.casterCount === 0, `Fire bullet preview must not render a second caster skill-sheet layer: ${fireInfo.casterCount}`);
  assert(fireInfo.targetVfxCount === 0, `Fire bullet preview must not render a second target skill-sheet layer: ${fireInfo.targetVfxCount}`);
  assert(fireInfo.frameStripCount === 10, `Fire bullet preview should show the 10 projectile frames, got ${fireInfo.frameStripCount}`);
  assert(fireInfo.travelBackground.includes("rpg-skill-projectiles"), `Fire preview did not load projectile sheet: ${fireInfo.travelBackground}`);
  assert(fireInfo.travelBackground.includes(GENERATED_ASSET_VERSION), `Fire preview projectile did not use current asset version: ${fireInfo.travelBackground}`);
  assert(fireInfo.travelPosition.includes("25%"), `Fire preview projectile should use the fire row, got background-position ${fireInfo.travelPosition}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_03']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_basic_03");
  const burnInfo = await test.page.evaluate(() => {
    const burnStatus = document.querySelector<HTMLElement>(".rpg-skill-preview-pet.is-right.is-targeted .rpg-status-effect.status-burn");
    const burnStyle = burnStatus ? window.getComputedStyle(burnStatus) : null;
    return {
      selectedMoveId: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id"),
      selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
      targetBurnCount: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted .rpg-status-effect.status-burn").length,
      allyBurnCount: document.querySelectorAll(".rpg-skill-preview-pet.is-left .rpg-status-effect.status-burn").length,
      statusBackground: burnStyle?.backgroundImage ?? ""
    };
  });
  assert(burnInfo.selectedMoveId === "fire_basic_03", `Burn status catalog click selected ${burnInfo.selectedMoveId}`);
  assert(burnInfo.selectedCategory === "status-layered", `Burn status move should be status-layered, got ${burnInfo.selectedCategory}`);
  assert(burnInfo.targetBurnCount === 1, `Single-target burn preview should render 1 target status layer, got ${burnInfo.targetBurnCount}`);
  assert(burnInfo.allyBurnCount === 0, `Single-target burn preview should not mark allies, got ${burnInfo.allyBurnCount}`);
  assert(burnInfo.statusBackground.includes("rpg-status-vfx"), `Burn preview did not use RPG status spritesheet: ${burnInfo.statusBackground}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='fire_intermediate_02']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_intermediate_02");
  const groupBurnInfo = await test.page.evaluate(() => ({
    selectedMoveId: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id"),
    selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
    selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
    selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
    selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
    targetedSlots: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted").length,
    targetBurnCount: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted .rpg-status-effect.status-burn").length
  }));
  assert(groupBurnInfo.selectedMoveId === "fire_intermediate_02", `Group burn catalog click selected ${groupBurnInfo.selectedMoveId}`);
  assert(groupBurnInfo.selectedCategory === "status-layered", `Group burn move should be status-layered, got ${groupBurnInfo.selectedCategory}`);
  assert(groupBurnInfo.selectedPrimarySource === "external-super-pixel-gigapack", `Group burn should use one complete Gigapack sequence: ${JSON.stringify(groupBurnInfo)}`);
  assert(groupBurnInfo.selectedSources === groupBurnInfo.selectedPrimarySource, `Group burn primary source should not include status or another impact pack: ${JSON.stringify(groupBurnInfo)}`);
  assert(groupBurnInfo.selectedStatusSource === "generated-status-sheet", `Group burn should keep the persistent status sheet as a separate layer: ${JSON.stringify(groupBurnInfo)}`);
  assert(groupBurnInfo.targetedSlots === 3, `Group burn should target 3 enemy slots, got ${groupBurnInfo.targetedSlots}`);
  assert(groupBurnInfo.targetBurnCount === 3, `Group burn preview should render 3 target status layers, got ${groupBurnInfo.targetBurnCount}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_05']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_basic_05");
  const supportHealInfo = await test.page.evaluate(() => {
    const travel = document.querySelector<HTMLElement>(".rpg-skill-travel-vfx");
    return {
      selectedMoveId: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id"),
      selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
      selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
      selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
      selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
      selectedPhases: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-phases") ?? "",
      usesBulletProjectile: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-uses-bullet-projectile") ?? "",
      targetedAllySlots: document.querySelectorAll(".rpg-skill-preview-pet.is-left.is-targeted").length,
      targetedEnemySlots: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted").length,
      allyRegenCount: document.querySelectorAll(".rpg-skill-preview-pet.is-left.is-targeted .rpg-status-effect.status-regen").length,
      travelVfxCount: document.querySelectorAll(".rpg-skill-travel-vfx").length,
      travelFromX: Number.parseFloat(travel?.style.getPropertyValue("--from-x") ?? "-999"),
      travelToX: Number.parseFloat(travel?.style.getPropertyValue("--to-x") ?? "-999")
    };
  });
  assert(supportHealInfo.selectedMoveId === "fire_basic_05", `Support heal catalog click selected ${supportHealInfo.selectedMoveId}`);
  assert(supportHealInfo.selectedCategory === "support-field", `Single ally heal should be support-field, got ${supportHealInfo.selectedCategory}`);
  assert(supportHealInfo.selectedPrimarySource === "external-spellsfx-2", `Support heal should use one SpellsFX sequence: ${JSON.stringify(supportHealInfo)}`);
  assert(supportHealInfo.selectedSources === supportHealInfo.selectedPrimarySource, `Support heal primary source should not include status or another impact pack: ${JSON.stringify(supportHealInfo)}`);
  assert(supportHealInfo.selectedStatusSource === "generated-status-sheet", `Support heal should keep the persistent status sheet as a separate layer: ${JSON.stringify(supportHealInfo)}`);
  assert(supportHealInfo.selectedPhases.includes("status"), `Support heal should include status phase: ${supportHealInfo.selectedPhases}`);
  assert(supportHealInfo.usesBulletProjectile === "false", `Support heal must not use bullet projectile: ${supportHealInfo.usesBulletProjectile}`);
  assert(supportHealInfo.targetedAllySlots === 1, `Support heal should target 1 ally slot, got ${supportHealInfo.targetedAllySlots}`);
  assert(supportHealInfo.targetedEnemySlots === 0, `Support heal should not target enemies, got ${supportHealInfo.targetedEnemySlots}`);
  assert(supportHealInfo.allyRegenCount === 1, `Support heal should render 1 regen status-sheet layer, got ${supportHealInfo.allyRegenCount}`);
  assert(supportHealInfo.travelVfxCount === 1 && supportHealInfo.travelToX < supportHealInfo.travelFromX, `Support heal should travel from actor to left-side ally: ${JSON.stringify(supportHealInfo)}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='fire_basic_09']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "fire_basic_09");
  const supportTeamInfo = await test.page.evaluate(() => ({
    selectedMoveId: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id"),
    selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
    selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
    selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
    selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
    selectedPhases: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-phases") ?? "",
    usesBulletProjectile: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-uses-bullet-projectile") ?? "",
    targetedAllySlots: document.querySelectorAll(".rpg-skill-preview-pet.is-left.is-targeted").length,
    targetedEnemySlots: document.querySelectorAll(".rpg-skill-preview-pet.is-right.is-targeted").length,
    allyGuardCount: document.querySelectorAll(".rpg-skill-preview-pet.is-left.is-targeted .rpg-status-effect.status-guard").length,
    travelVfxCount: document.querySelectorAll(".rpg-skill-travel-vfx").length
  }));
  assert(supportTeamInfo.selectedMoveId === "fire_basic_09", `Team support catalog click selected ${supportTeamInfo.selectedMoveId}`);
  assert(supportTeamInfo.selectedCategory === "support-field", `Team guard should be support-field, got ${supportTeamInfo.selectedCategory}`);
  assert(supportTeamInfo.selectedPrimarySource === "external-super-pixel-gigapack", `Team guard should use one complete Gigapack sequence: ${JSON.stringify(supportTeamInfo)}`);
  assert(supportTeamInfo.selectedSources === supportTeamInfo.selectedPrimarySource, `Team guard primary source should not include status or another impact pack: ${JSON.stringify(supportTeamInfo)}`);
  assert(supportTeamInfo.selectedStatusSource === "generated-status-sheet", `Team guard should keep the persistent status sheet as a separate layer: ${JSON.stringify(supportTeamInfo)}`);
  assert(supportTeamInfo.selectedPhases.includes("expand") && supportTeamInfo.selectedPhases.includes("status"), `Team guard phases are incomplete: ${supportTeamInfo.selectedPhases}`);
  assert(supportTeamInfo.usesBulletProjectile === "false", `Team guard must not use bullet projectile: ${supportTeamInfo.usesBulletProjectile}`);
  assert(supportTeamInfo.targetedAllySlots === 3, `Team guard should target 3 ally slots, got ${supportTeamInfo.targetedAllySlots}`);
  assert(supportTeamInfo.targetedEnemySlots === 0, `Team guard should not target enemies, got ${supportTeamInfo.targetedEnemySlots}`);
  assert(supportTeamInfo.allyGuardCount === 3, `Team guard should render 3 guard status-sheet layers, got ${supportTeamInfo.allyGuardCount}`);
  assert(supportTeamInfo.travelVfxCount === 0, `All-allies support should not render projectile/travel VFX, got ${supportTeamInfo.travelVfxCount}`);

  await test.page.locator(".rpg-skill-catalog-button[data-move-id='light_ultimate_05']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id") === "light_ultimate_05");
  const ultimateInfo = await test.page.evaluate(() => {
    const primary = document.querySelector(".rpg-skill-preview-arena .rpg-skill-primary-vfx");
    const style = primary ? window.getComputedStyle(primary) : null;
    return {
      selectedMoveId: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-selected-move-id"),
      selectedCategory: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-category") ?? "",
      selectedSources: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-sources") ?? "",
      selectedPrimarySource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-source") ?? "",
      selectedStatusSource: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-status-source") ?? "",
      selectedPhases: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-vfx-phases") ?? "",
      usesBulletProjectile: document.querySelector(".rpg-skill-animation-preview")?.getAttribute("data-uses-bullet-projectile") ?? "",
      primaryVfxCount: document.querySelectorAll(".rpg-skill-primary-vfx").length,
      travelVfxCount: document.querySelectorAll(".rpg-skill-travel-vfx").length,
      targetVfxCount: document.querySelectorAll(".rpg-skill-target-vfx").length,
      ultimateWindupCount: document.querySelectorAll(".rpg-skill-ultimate-windup").length,
      ultimateFinishCount: document.querySelectorAll(".rpg-skill-ultimate-finish").length,
      primaryBackground: style?.backgroundImage ?? ""
    };
  });
  assert(ultimateInfo.selectedMoveId === "light_ultimate_05", `Ultimate catalog click selected ${ultimateInfo.selectedMoveId}`);
  assert(ultimateInfo.selectedCategory === "ultimate-multiphase", `Ultimate should use ultimate-multiphase, got ${ultimateInfo.selectedCategory}`);
  assert(ultimateInfo.selectedPrimarySource === "external-spellsfx-2", `Ultimate should use one complete SpellsFX sequence: ${JSON.stringify(ultimateInfo)}`);
  assert(ultimateInfo.selectedSources === ultimateInfo.selectedPrimarySource, `Ultimate should expose only one primary VFX source: ${JSON.stringify(ultimateInfo)}`);
  assert(ultimateInfo.selectedStatusSource === "generated-status-sheet", `Ultimate status layer should stay separate from the primary SpellsFX sequence: ${JSON.stringify(ultimateInfo)}`);
  assert(ultimateInfo.selectedPhases.includes("windup") && ultimateInfo.selectedPhases.includes("impact") && ultimateInfo.selectedPhases.includes("finish"), `Ultimate phases incomplete: ${ultimateInfo.selectedPhases}`);
  assert(ultimateInfo.usesBulletProjectile === "false", `Ultimate must not use bullet projectile: ${ultimateInfo.usesBulletProjectile}`);
  assert(ultimateInfo.primaryVfxCount === 3 && ultimateInfo.travelVfxCount === 3, `Ultimate preview should copy one complete sequence to each affected target, not layer phases: ${JSON.stringify(ultimateInfo)}`);
  assert(ultimateInfo.targetVfxCount === 0, `Ultimate travel preview must not render a second target VFX layer, got ${ultimateInfo.targetVfxCount}`);
  assert(ultimateInfo.ultimateWindupCount === 0, `Ultimate preview must not render a separate windup layer, got ${ultimateInfo.ultimateWindupCount}`);
  assert(ultimateInfo.ultimateFinishCount === 0, `Ultimate preview must not render a separate finish layer, got ${ultimateInfo.ultimateFinishCount}`);
  assert(ultimateInfo.primaryBackground.includes("rpg-skill-vfx-light"), `Ultimate preview did not load light VFX sheet: ${ultimateInfo.primaryBackground}`);

  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyAiBattle(browser: Browser) {
  const test = await newTestPage(browser, "ai-battle");
  await openRpgGym(test.page);
  await test.page.waitForSelector(".rpg-party-formation-board");
  const initialPartySlots = await test.page.evaluate(() => ({
    front: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='0']")?.getAttribute("data-pet-id") ?? "",
    backLeft: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='1']")?.getAttribute("data-pet-id") ?? "",
    backRight: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='2']")?.getAttribute("data-pet-id") ?? "",
    labels: Array.from(document.querySelectorAll(".rpg-party-formation-slot header strong")).map((node) => node.textContent?.trim() ?? "")
  }));
  assert(initialPartySlots.front === "pet_water_tidefin" && initialPartySlots.backLeft === "pet_fire_emberfox" && initialPartySlots.backRight === "pet_grass_mossling", `Initial gym formation slots are wrong: ${JSON.stringify(initialPartySlots)}`);
  assert(initialPartySlots.labels.join(",") === "前排,後左,後右", `Gym formation labels should expose front/back-left/back-right slots: ${JSON.stringify(initialPartySlots)}`);
  await setGymFormation(test.page, ["pet_fire_emberfox", "pet_water_tidefin", "pet_grass_mossling"]);
  const arrangedPartySlots = await test.page.evaluate(() => ({
    front: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='0']")?.getAttribute("data-pet-id") ?? "",
    backLeft: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='1']")?.getAttribute("data-pet-id") ?? "",
    backRight: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='2']")?.getAttribute("data-pet-id") ?? "",
    selectedCards: Array.from(document.querySelectorAll(".rpg-party-select-grid button.is-selected em")).map((node) => node.textContent?.trim() ?? "")
  }));
  assert(arrangedPartySlots.front === "pet_fire_emberfox" && arrangedPartySlots.backLeft === "pet_water_tidefin" && arrangedPartySlots.backRight === "pet_grass_mossling", `Gym formation reorder did not update slot order: ${JSON.stringify(arrangedPartySlots)}`);
  assert(arrangedPartySlots.selectedCards.includes("前排") && arrangedPartySlots.selectedCards.includes("後左") && arrangedPartySlots.selectedCards.includes("後右"), `Selected pet cards should show explicit formation labels: ${JSON.stringify(arrangedPartySlots)}`);
  await test.page.reload({ waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-layer");
  await test.page.getByRole("button", { name: "道館" }).click();
  await test.page.waitForSelector(".rpg-party-formation-board");
  const persistedPartySlots = await test.page.evaluate(() => ({
    front: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='0']")?.getAttribute("data-pet-id") ?? "",
    backLeft: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='1']")?.getAttribute("data-pet-id") ?? "",
    backRight: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='2']")?.getAttribute("data-pet-id") ?? ""
  }));
  assert(
    persistedPartySlots.front === arrangedPartySlots.front &&
      persistedPartySlots.backLeft === arrangedPartySlots.backLeft &&
      persistedPartySlots.backRight === arrangedPartySlots.backRight,
    `Reload should preserve gym formation order: ${JSON.stringify({ arrangedPartySlots, persistedPartySlots })}`
  );
  const difficultyInfo = await test.page.evaluate(() => ({
    buttons: Array.from(document.querySelectorAll<HTMLElement>(".rpg-ai-difficulty-selector button")).map((button) => button.getAttribute("data-ai-difficulty") ?? ""),
    selected: document.querySelector<HTMLElement>(".rpg-ai-difficulty-selector button.is-selected")?.getAttribute("data-ai-difficulty") ?? ""
  }));
  assert(difficultyInfo.buttons.join(",") === "normal,hard,leader", `Gym should expose normal/hard/leader AI difficulty buttons: ${JSON.stringify(difficultyInfo)}`);
  assert(difficultyInfo.selected === "normal", `Default AI difficulty should be normal: ${JSON.stringify(difficultyInfo)}`);
  await installSupportMoveLoadout(test.page);
  await test.page.reload({ waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-layer");
  await test.page.getByRole("button", { name: "道館" }).click();
  await test.page.waitForSelector(".rpg-party-formation-board");
  await test.page.locator(".rpg-ai-difficulty-selector button[data-ai-difficulty='leader']").click();
  await test.page.waitForFunction(() => document.querySelector(".rpg-ai-difficulty-selector button.is-selected")?.getAttribute("data-ai-difficulty") === "leader");
  await test.page.locator(".rpg-gym-modes button").filter({ hasText: "AI 對戰" }).click();
  await waitBattleField(test.page);
  const formationInfo = await test.page.evaluate(() => {
    const field = document.querySelector<HTMLElement>(".rpg-battle-field");
    const fieldRect = field?.getBoundingClientRect();
    const petCenters = Object.fromEntries(
      Object.entries({
        leftFront: ".rpg-field-pet.is-left.slot-0",
        leftBackTop: ".rpg-field-pet.is-left.slot-1",
        leftBackBottom: ".rpg-field-pet.is-left.slot-2",
        rightFront: ".rpg-field-pet.is-right.slot-0",
        rightBackTop: ".rpg-field-pet.is-right.slot-1",
        rightBackBottom: ".rpg-field-pet.is-right.slot-2"
      }).map(([key, selector]) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node || !fieldRect) return [key, { x: -999, y: -999 }];
        const rect = node.getBoundingClientRect();
        return [
          key,
          {
            x: rect.left + rect.width / 2 - fieldRect.left,
            y: rect.top + rect.height / 2 - fieldRect.top
          }
        ];
      })
    ) as Record<string, { x: number; y: number }>;
    return {
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
      ]),
      geometry: {
        leftFront: petCenters.leftFront,
        leftBackTop: petCenters.leftBackTop,
        leftBackBottom: petCenters.leftBackBottom,
        rightFront: petCenters.rightFront,
        rightBackTop: petCenters.rightBackTop,
        rightBackBottom: petCenters.rightBackBottom
      },
      leftDefinitionIds: {
        front: document.querySelector<HTMLElement>(".rpg-field-pet.is-left.slot-0")?.getAttribute("data-definition-id") ?? "",
        backLeft: document.querySelector<HTMLElement>(".rpg-field-pet.is-left.slot-1")?.getAttribute("data-definition-id") ?? "",
        backRight: document.querySelector<HTMLElement>(".rpg-field-pet.is-left.slot-2")?.getAttribute("data-definition-id") ?? ""
      },
      rightDefinitionIds: {
        front: document.querySelector<HTMLElement>(".rpg-field-pet.is-right.slot-0")?.getAttribute("data-definition-id") ?? "",
        backLeft: document.querySelector<HTMLElement>(".rpg-field-pet.is-right.slot-1")?.getAttribute("data-definition-id") ?? "",
        backRight: document.querySelector<HTMLElement>(".rpg-field-pet.is-right.slot-2")?.getAttribute("data-definition-id") ?? ""
      }
    };
  });
  const aiDifficultyInfo = await test.page.evaluate(() => ({
    aiDifficulty: document.querySelector<HTMLElement>(".rpg-battle-screen")?.getAttribute("data-ai-difficulty") ?? "",
    headerText: document.querySelector(".rpg-battle-scene-header")?.textContent ?? ""
  }));
  assert(aiDifficultyInfo.aiDifficulty === "leader" && aiDifficultyInfo.headerText.includes("館主"), `AI battle should start with selected leader difficulty: ${JSON.stringify(aiDifficultyInfo)}`);
  assert(
    formationInfo.rightDefinitionIds.front === "pet_dark_nyxcat" &&
      formationInfo.rightDefinitionIds.backLeft === "pet_light_lumibun" &&
      formationInfo.rightDefinitionIds.backRight === "pet_water_tidefin",
    `Leader AI roster should field dark/light/water in configured order: ${JSON.stringify(formationInfo.rightDefinitionIds)}`
  );
  assert(formationInfo.rightPetCount === 3, `AI battle expected 3 right-side pets, got ${formationInfo.rightPetCount}`);
  assert(formationInfo.mirroredRightPets === 3, `AI battle should mirror 3 right-side sprites, got ${formationInfo.mirroredRightPets}`);
  assert(formationInfo.cardStackCount === 0, `AI battle should not render field card stacks behind pets, got ${formationInfo.cardStackCount}`);
  assert(formationInfo.legacyBattlePetCount === 0, `AI battle must not render legacy card-style battle pet nodes, got ${formationInfo.legacyBattlePetCount}`);
  assert(
    formationInfo.fieldSpriteFilters.length === 6 && formationInfo.fieldSpriteFilters.every((filter) => filter === "none"),
    `AI battle field pets should not use CSS drop-shadows or glow filters: ${JSON.stringify(formationInfo.fieldSpriteFilters)}`
  );
  assert(
    formationInfo.fieldPetPseudoContent.every((content) => content === "none"),
    `AI battle field pets should not render pseudo-element rings/platforms: ${JSON.stringify(formationInfo.fieldPetPseudoContent)}`
  );
  assert(formationInfo.geometry.leftBackTop.x < formationInfo.geometry.leftFront.x - 120, `AI battle left back pair should sit behind the front slot: ${JSON.stringify(formationInfo.geometry)}`);
  assert(formationInfo.geometry.leftBackBottom.x < formationInfo.geometry.leftFront.x - 120, `AI battle left back pair should sit behind the front slot: ${JSON.stringify(formationInfo.geometry)}`);
  assert(Math.abs(formationInfo.geometry.leftBackTop.x - formationInfo.geometry.leftBackBottom.x) <= 32, `AI battle left back pair should be vertically stacked: ${JSON.stringify(formationInfo.geometry)}`);
  assert(formationInfo.geometry.leftBackTop.y < formationInfo.geometry.leftFront.y - 70 && formationInfo.geometry.leftBackBottom.y > formationInfo.geometry.leftFront.y + 70, `AI battle left side must be one front plus two vertical back slots: ${JSON.stringify(formationInfo.geometry)}`);
  assert(formationInfo.geometry.rightBackTop.x > formationInfo.geometry.rightFront.x + 120, `AI battle right back pair should sit behind the front slot: ${JSON.stringify(formationInfo.geometry)}`);
  assert(formationInfo.geometry.rightBackBottom.x > formationInfo.geometry.rightFront.x + 120, `AI battle right back pair should sit behind the front slot: ${JSON.stringify(formationInfo.geometry)}`);
  assert(Math.abs(formationInfo.geometry.rightBackTop.x - formationInfo.geometry.rightBackBottom.x) <= 32, `AI battle right back pair should be vertically stacked: ${JSON.stringify(formationInfo.geometry)}`);
  assert(formationInfo.geometry.rightBackTop.y < formationInfo.geometry.rightFront.y - 70 && formationInfo.geometry.rightBackBottom.y > formationInfo.geometry.rightFront.y + 70, `AI battle right side must be one front plus two vertical back slots: ${JSON.stringify(formationInfo.geometry)}`);
  assert(
    formationInfo.leftDefinitionIds.front === arrangedPartySlots.front &&
      formationInfo.leftDefinitionIds.backLeft === arrangedPartySlots.backLeft &&
      formationInfo.leftDefinitionIds.backRight === arrangedPartySlots.backRight,
    `AI battle field slots should preserve gym formation order: ${JSON.stringify({ arrangedPartySlots, field: formationInfo.leftDefinitionIds })}`
  );

  const supportCommandRow = await advanceUntilCurrentLeftPet(test.page, "pet_fire_emberfox", "暖焰補息");
  const supportActorId = await supportCommandRow.getAttribute("data-actor-id");
  assert(Boolean(supportActorId), "Water support actor did not expose a command actor id.");
  const allyTargetId = await test.page.evaluate((actorId) => {
    const ally = Array.from(document.querySelectorAll<HTMLElement>(".rpg-field-pet.is-left:not(.is-defeated)"))
      .find((pet) => pet.getAttribute("data-pet-id") !== actorId);
    return ally?.getAttribute("data-pet-id") ?? "";
  }, supportActorId);
  assert(Boolean(allyTargetId), "AI battle left ally field pet did not expose a target id.");
  await test.page.locator(`.rpg-field-pet.is-left[data-pet-id="${allyTargetId}"]`).click();
  await supportCommandRow.locator(".rpg-move-list button").filter({ hasText: "暖焰補息" }).click();
  const allySupportTargetInfo = await supportCommandRow.evaluate((row) => ({
    actorId: row.getAttribute("data-actor-id") ?? "",
    targetId: row.getAttribute("data-pending-target-id") ?? "",
    selectedAllyCount: document.querySelectorAll(".rpg-field-pet.is-left.is-selected").length,
    selectedAllyId: document.querySelector(".rpg-field-pet.is-left.is-selected")?.getAttribute("data-pet-id") ?? ""
  }));
  assert(allySupportTargetInfo.selectedAllyId === allyTargetId, `AI battle should visually select the clicked ally pet: ${JSON.stringify(allySupportTargetInfo)}`);
  assert(allySupportTargetInfo.targetId === allyTargetId, `Single-ally support move should target the clicked ally, not the actor/default target: ${JSON.stringify(allySupportTargetInfo)}`);
  assert(allySupportTargetInfo.targetId !== allySupportTargetInfo.actorId, `Single-ally support move should support a separate allied pet target: ${JSON.stringify(allySupportTargetInfo)}`);
  await supportCommandRow.locator("button").filter({ hasText: "重選" }).click();

  await test.page.locator(`.rpg-field-pet.is-left.is-current-turn[data-pet-id="${supportActorId}"]`).click();
  await test.page.locator(`.rpg-field-pet.is-left[data-pet-id="${allyTargetId}"]`).click();
  await supportCommandRow.locator(".rpg-move-list button").filter({ hasText: "暖焰補息" }).click();
  const supportSubmit = submitButton(test.page, "執行回合");
  await supportSubmit.waitFor({ state: "visible" });
  assert(!(await supportSubmit.isDisabled()), "Support target action submit is disabled after choosing the current actor move.");
  await supportSubmit.click();
  await test.page.waitForSelector(".rpg-battle-vfx[data-move-id='fire_basic_05']", { timeout: 15_000 });
  const supportVfxInfo = await test.page.locator(".rpg-battle-vfx[data-move-id='fire_basic_05']").first().evaluate((node) => {
    const travel = node.querySelector<HTMLElement>(".rpg-fx-travel-sheet, .rpg-fx-travel-projectile");
    const travelStyle = travel ? window.getComputedStyle(travel) : null;
    const impactStacks = Array.from(node.querySelectorAll<HTMLElement>(".rpg-fx-impact-stack"));
    return {
      category: node.getAttribute("data-vfx-category") ?? "",
      targetCount: node.getAttribute("data-target-count") ?? "",
      targetIds: node.getAttribute("data-target-ids") ?? "",
      targetSides: node.getAttribute("data-target-sides") ?? "",
      actorSide: node.getAttribute("data-actor-side") ?? "",
      travelCount: node.querySelectorAll(".rpg-fx-travel-sheet, .rpg-fx-travel-projectile").length,
      travelFromX: travelStyle?.getPropertyValue("--from-x").trim() ?? "",
      travelFromY: travelStyle?.getPropertyValue("--from-y").trim() ?? "",
      travelToX: travelStyle?.getPropertyValue("--to-x").trim() ?? "",
      travelToY: travelStyle?.getPropertyValue("--to-y").trim() ?? "",
      impactStackCount: impactStacks.length,
      impactTargetIds: impactStacks.map((impact) => impact.getAttribute("data-target-id") ?? "").join(",")
    };
  });
  assert(supportVfxInfo.category === "support-field", `Single-ally support battle VFX should use support-field category: ${JSON.stringify(supportVfxInfo)}`);
  assert(supportVfxInfo.actorSide === "left" && supportVfxInfo.targetSides === "left", `Single-ally support battle VFX should stay on the ally side: ${JSON.stringify(supportVfxInfo)}`);
  assert(supportVfxInfo.targetCount === "1" && supportVfxInfo.targetIds === allyTargetId, `Single-ally support battle VFX should target the selected ally id: ${JSON.stringify(supportVfxInfo)}`);
  assert(supportVfxInfo.travelCount === 1, `Single-ally support battle VFX should render one actor-to-target travel sheet: ${JSON.stringify(supportVfxInfo)}`);
  assert(
    supportVfxInfo.travelFromX !== supportVfxInfo.travelToX || supportVfxInfo.travelFromY !== supportVfxInfo.travelToY,
    `Single-ally support battle VFX should travel from actor coordinates to target coordinates: ${JSON.stringify(supportVfxInfo)}`
  );
  assert(supportVfxInfo.impactStackCount === 0 && supportVfxInfo.impactTargetIds === "", `Single-ally support travel must not render a second impact stack: ${JSON.stringify(supportVfxInfo)}`);

  await startAiBattle(test.page, "normal");
  const statusCommandRow = await advanceUntilCurrentLeftPet(test.page, "pet_fire_emberfox", "熱盾回路");
  await statusCommandRow.locator(".rpg-move-list button").filter({ hasText: "熱盾回路" }).click();
  const statusSubmit = submitButton(test.page, "執行回合");
  await statusSubmit.waitFor({ state: "visible" });
  assert(!(await statusSubmit.isDisabled()), "Team guard submit is disabled after choosing 熱盾回路.");
  await statusSubmit.click();
  await test.page.waitForSelector(".rpg-battle-vfx[data-move-id='fire_intermediate_04']", { timeout: 15_000 });
  await test.page.waitForFunction(
    () => document.querySelectorAll(".rpg-field-pet.has-statuses .rpg-status-effect.status-guard").length >= 2,
    null,
    { timeout: 15_000 }
  );
  const statusInfo = await fieldStatusInfo(test.page);
  assert(statusInfo.statusEffectCount >= 2, `Expected at least 2 persistent field status effects, got ${statusInfo.statusEffectCount}`);
  assert(statusInfo.guardPetCount >= 2, `Expected at least 2 guarded field pets, got ${statusInfo.guardPetCount}`);
  assert(statusInfo.statusVfxBackground.includes("rpg-status-vfx"), `Status effects did not use RPG status spritesheet: ${statusInfo.statusVfxBackground}`);
  const battleLogText = await test.page.locator(".rpg-battle-log").innerText();
  assert(LOCALIZED_STATUS_LOG_PATTERN.test(battleLogText), `Battle log should show localized status names after status moves: ${battleLogText}`);
  assert(!RAW_STATUS_LOG_PATTERN.test(battleLogText), `Battle log should not leak raw status ids: ${battleLogText}`);

  await startAiBattle(test.page, "normal");
  const groupCommandRow = await advanceUntilCurrentLeftPet(test.page, "pet_fire_emberfox", "火線掃場");
  await groupCommandRow.locator(".rpg-move-list button").filter({ hasText: "火線掃場" }).click();
  const groupSubmit = submitButton(test.page, "執行回合");
  await groupSubmit.waitFor({ state: "visible" });
  assert(!(await groupSubmit.isDisabled()), "Group attack submit is disabled after choosing 火線掃場.");
  await groupSubmit.click();
  const groupVfxSelector = ".rpg-battle-vfx[data-move-id='fire_basic_07']";
  await test.page.waitForSelector(groupVfxSelector, { timeout: 15_000 });
  await test.page.waitForFunction(
    (selector) => {
      const vfx = document.querySelector<HTMLElement>(selector);
      if (!vfx) return false;
      const category = vfx.getAttribute("data-vfx-category") ?? "";
      const targetCount = Number(vfx.getAttribute("data-target-count") ?? "0");
      const travelCount = vfx.querySelectorAll(".rpg-fx-travel-projectile, .rpg-fx-travel-sheet").length;
      return ["wide-sweep", "status-layered", "ultimate-multiphase"].includes(category) && targetCount >= 3 && travelCount >= 3;
    },
    groupVfxSelector,
    { timeout: 15_000 }
  );
  await waitForBattleVfxLayer(test.page, `${groupVfxSelector} .rpg-fx-travel-projectile, ${groupVfxSelector} .rpg-fx-travel-sheet`, "AI group travel VFX");
  const info = await battleVfxInfo(test.page, "fire_basic_07");
  assert(info.fieldPetCount === 6, `AI battle expected 6 field pets, got ${info.fieldPetCount}`);
  assert(info.vfxSource === "external-super-pixel-gigapack" || info.vfxSource === "external-spellsfx-2", `AI battle VFX should use one complete external sequence: ${JSON.stringify(info)}`);
  assert(info.vfxSources === info.vfxSource, `AI battle data-vfx-sources should expose only the primary sequence: ${JSON.stringify(info)}`);
  assert(!info.vfxSources.includes("external-750-fx"), `AI battle VFX should not mix in 750 FX: ${JSON.stringify(info)}`);
  assert(!(info.vfxSources.includes("external-super-pixel-gigapack") && info.vfxSources.includes("external-spellsfx-2")), `AI battle VFX should not mix Super Pixel and SpellsFX: ${JSON.stringify(info)}`);
  assert(info.vfxCategory === "wide-sweep" || info.vfxCategory === "status-layered" || info.vfxCategory === "ultimate-multiphase", `AI group battle VFX category is wrong: ${info.vfxCategory}`);
  assert(info.spriteBackground.includes("rpg-skill-vfx-"), `AI battle VFX did not use RPG skill sheet: ${info.spriteBackground}`);
  assert(info.travelBackground.includes("rpg-skill-projectiles") || info.travelBackground.includes("rpg-skill-vfx-"), `AI battle travel VFX did not use a RPG sheet: ${info.travelBackground}`);
  assert(info.travelBackground.includes(GENERATED_ASSET_VERSION), `AI battle travel VFX did not use current asset version: ${info.travelBackground}`);
  assert(info.travelSpriteCount >= 3, `Group move expected at least 3 travel VFX sprites, got ${info.travelSpriteCount}`);
  assert(info.actorSide === "left" ? info.casterX < 50 : info.casterX > 50, `AI battle caster point does not match presentation side: ${JSON.stringify(info)}`);
  assert(info.travelWidth >= 70 && info.travelHeight >= 40, `AI battle travel VFX is too small: ${info.travelWidth}x${info.travelHeight}`);
  assert(info.impactSpriteCount === 0, `Group travel move must not render a second impact spritesheet layer: ${JSON.stringify(info)}`);
  assert(info.targetImpactCount === 0, `Group move must not render per-pet target impact VFX, got ${info.targetImpactCount}`);
  assert(info.uniqueReplayTargets >= 3, `Group move expected replay targets on 3 unique pets, got ${info.uniqueReplayTargets}`);
  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyMobileRpgLayout(browser: Browser) {
  const test = await newTestPage(browser, "mobile-rpg", MOBILE_VIEWPORT);

  await test.page.goto(`${CLIENT_URL}/?preview=release`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-release-review");
  await assertNoHorizontalOverflow(test.page, "mobile release review");

  await test.page.goto(`${CLIENT_URL}/?preview=pets`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-animation-preview");
  await assertNoHorizontalOverflow(test.page, "mobile pet preview");

  await test.page.goto(`${CLIENT_URL}/?preview=skills`, { waitUntil: "networkidle" });
  await test.page.waitForSelector(".rpg-skill-animation-preview");
  await assertNoHorizontalOverflow(test.page, "mobile skill preview");

  await openRpgProfile(test.page);
  await assertNoHorizontalOverflow(test.page, "mobile profile wallet");
  await assertRectInsideViewport(test.page, ".rpg-profile-card-panel", "mobile profile wallet panel");

  await openRpgGym(test.page);
  await assertNoHorizontalOverflow(test.page, "mobile gym");
  await assertRectInsideViewport(test.page, ".rpg-gym-panel", "mobile gym panel");

  await test.page.locator(".rpg-gym-modes button").filter({ hasText: "AI 對戰" }).click();
  await waitBattleField(test.page);
  await assertNoHorizontalOverflow(test.page, "mobile AI battle");
  await assertRectInsideViewport(test.page, ".rpg-command-dock", "mobile battle command dock");
  const screenshot = await test.page.screenshot({ fullPage: false });
  assert(screenshot.byteLength > 20_000, `Mobile battle screenshot was unexpectedly small: ${screenshot.byteLength} bytes`);

  assertNoErrors(test);
  await test.page.context().close();
}

async function verifyVersusBattleAndReconnect(browser: Browser) {
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const playerA = await newTestPage(contextA, "versus-a");
  const playerB = await newTestPage(contextB, "versus-b");

  await openRpgGym(playerA.page);
  const formationA = await moveFormationPetToFront(playerA.page, "pet_fire_emberfox");
  await playerA.page.locator("button").filter({ hasText: "真人對戰" }).click();
  const roomCode = await waitRoomCode(playerA.page);
  const waitingInfo = await versusStatusInfo(playerA.page);
  assert(waitingInfo.roomStatus === "waiting", `Created room should show waiting status, got ${JSON.stringify(waitingInfo)}`);
  assert(waitingInfo.connection === "waiting", `Created room should have waiting connection, got ${JSON.stringify(waitingInfo)}`);
  assert(waitingInfo.opponentConnected === "false", `Created room should show opponent disconnected before join, got ${JSON.stringify(waitingInfo)}`);
  assert(waitingInfo.text.includes("等待對手") || waitingInfo.text.includes("等待加入"), `Waiting rail text missing waiting copy: ${waitingInfo.text}`);

  await openRpgGym(playerB.page);
  const formationB = await moveFormationPetToFront(playerB.page, "pet_grass_mossling");
  await playerB.page.locator(".rpg-room-join input").fill(roomCode);
  await playerB.page.locator("button").filter({ hasText: "加入真人房" }).click();
  await waitBattleField(playerA.page);
  await waitBattleField(playerB.page);
  const joinedA = await versusStatusInfo(playerA.page);
  const joinedB = await versusStatusInfo(playerB.page);
  assert(joinedA.roomStatus === "selecting" && joinedB.roomStatus === "selecting", `Joined room should show selecting status: ${JSON.stringify({ joinedA, joinedB })}`);
  assert(joinedA.opponentConnected === "true" && joinedB.opponentConnected === "true", `Both players should show opponent online: ${JSON.stringify({ joinedA, joinedB })}`);
  assert(joinedA.text.includes("左席") && joinedB.text.includes("右席"), `Versus rail should expose player seats: ${JSON.stringify({ a: joinedA.text, b: joinedB.text })}`);
  const versusFormationA = await readFieldDefinitionFormation(playerA.page);
  const versusFormationB = await readFieldDefinitionFormation(playerB.page);
  assert(
    sameFormation(versusFormationA.left, formationA) && sameFormation(versusFormationA.right, formationB),
    `Player A should see own arranged team on left and opponent arranged team on right: ${JSON.stringify({ expectedLeft: formationA, expectedRight: formationB, actual: versusFormationA })}`
  );
  assert(
    sameFormation(versusFormationB.left, formationB) && sameFormation(versusFormationB.right, formationA),
    `Player B should see own arranged team on left and opponent arranged team on right: ${JSON.stringify({ expectedLeft: formationB, expectedRight: formationA, actual: versusFormationB })}`
  );

  const firstTurn = await readBattleTurn(playerA.page);
  await submitMoves(playerA.page, STARTER_MOVE_NAMES, "送出選招");
  await waitForBattleVfx(playerA.page, "versus player A first action");
  await waitForBattleVfx(playerB.page, "versus player B observes first action");
  await assertBattleVfxPresentationCoordinates(playerA.page, "versus player A first action");
  await assertBattleVfxPresentationCoordinates(playerB.page, "versus player B observes first action");
  const afterFirstActionA = await versusStatusInfo(playerA.page);
  const turnAfterFirstAction = await readBattleTurn(playerA.page);
  assert(afterFirstActionA.selfSubmitted === "false" && afterFirstActionA.submittedCount === "0", `Single-actor versus flow should not leave submitted state: ${JSON.stringify(afterFirstActionA)}`);
  assert(turnAfterFirstAction === (firstTurn ?? 0) + 1, `Single-actor versus action should advance one turn: before ${firstTurn}, after ${turnAfterFirstAction}`);

  const turnBeforeDisconnect = await readBattleTurn(playerB.page);
  await playerA.page.close();
  await playerB.page.waitForFunction(() => document.body.innerText.includes("連線中斷") || document.body.innerText.includes("保留"), null, { timeout: 15_000 });
  await playerB.page.waitForFunction(() => document.querySelector(".rpg-versus-status-rail")?.getAttribute("data-room-status") === "opponentDisconnected", null, { timeout: 15_000 });
  const staleClearedB = await versusStatusInfo(playerB.page);
  assert(staleClearedB.submittedCount === "0" && staleClearedB.selfSubmitted === "false", `Disconnect should clear stale submitted actions: ${JSON.stringify(staleClearedB)}`);
  await playerB.page.waitForTimeout(600);
  const offlineSubmitB = await versusStatusInfo(playerB.page);
  const turnAfterOfflineSubmit = await readBattleTurn(playerB.page);
  assert(offlineSubmitB.submittedCount === "0" && offlineSubmitB.selfSubmitted === "false", `Server should reject submissions while opponent is disconnected: ${JSON.stringify(offlineSubmitB)}`);
  assert(turnAfterOfflineSubmit === turnBeforeDisconnect, `Offline-opponent submit should not advance turn: before ${turnBeforeDisconnect}, after ${turnAfterOfflineSubmit}`);

  const rejoinedA = await newTestPage(contextA, "versus-a-rejoin-pre-turn");
  await openRpgGym(rejoinedA.page);
  await rejoinedA.page.locator(".rpg-room-join input").fill(roomCode);
  await rejoinedA.page.locator("button").filter({ hasText: "加入真人房" }).click();
  await waitBattleField(rejoinedA.page);
  await playerB.page.waitForFunction(() => document.querySelector(".rpg-versus-status-rail")?.getAttribute("data-opponent-connected") === "true", null, { timeout: 15_000 });
  const reconnectedBeforeTurnB = await versusStatusInfo(playerB.page);
  assert(reconnectedBeforeTurnB.roomStatus === "selecting" && reconnectedBeforeTurnB.submittedCount === "0", `Reconnect after a resolved single action should return to selecting: ${JSON.stringify(reconnectedBeforeTurnB)}`);

  await submitFirstAvailableMoves(playerB.page, "送出選招");
  await waitForBattleVfx(rejoinedA.page, "versus player A battle");
  await waitForBattleVfx(playerB.page, "versus player B battle");
  await assertBattleVfxPresentationCoordinates(rejoinedA.page, "versus player A battle");
  await assertBattleVfxPresentationCoordinates(playerB.page, "versus player B battle");

  await rejoinedA.page.close();
  await playerB.page.waitForFunction(() => document.body.innerText.includes("連線中斷") || document.body.innerText.includes("保留"), null, { timeout: 15_000 });
  await playerB.page.waitForFunction(() => document.querySelector(".rpg-versus-status-rail")?.getAttribute("data-room-status") === "opponentDisconnected", null, { timeout: 15_000 });
  const disconnectedB = await versusStatusInfo(playerB.page);
  assert(disconnectedB.opponentConnected === "false", `Player B should show opponent offline after disconnect: ${JSON.stringify(disconnectedB)}`);
  assert(disconnectedB.text.includes("對手離線") || disconnectedB.text.includes("離線保留"), `Disconnect rail missing offline copy: ${disconnectedB.text}`);

  const rejoinedAfterTurnA = await newTestPage(contextA, "versus-a-rejoin");
  await openRpgGym(rejoinedAfterTurnA.page);
  await rejoinedAfterTurnA.page.locator(".rpg-room-join input").fill(roomCode);
  await rejoinedAfterTurnA.page.locator("button").filter({ hasText: "加入真人房" }).click();
  await waitBattleField(rejoinedAfterTurnA.page);
  await playerB.page.waitForFunction(() => document.body.innerText.includes("重新連回房間") || !document.body.innerText.includes("連線中斷"), null, { timeout: 15_000 });
  await playerB.page.waitForFunction(() => document.querySelector(".rpg-versus-status-rail")?.getAttribute("data-opponent-connected") === "true", null, { timeout: 15_000 });
  const reconnectedB = await versusStatusInfo(playerB.page);
  const reconnectedA = await versusStatusInfo(rejoinedAfterTurnA.page);
  assert(reconnectedB.roomStatus === "selecting" && reconnectedA.roomStatus === "selecting", `Reconnected room should return to selecting: ${JSON.stringify({ reconnectedA, reconnectedB })}`);
  assert(reconnectedB.opponentConnected === "true" && reconnectedA.opponentConnected === "true", `Both rails should show online after reconnect: ${JSON.stringify({ reconnectedA, reconnectedB })}`);

  await finishVersusBattle(rejoinedAfterTurnA.page, playerB.page);
  await verifyVersusRematch(rejoinedAfterTurnA.page, playerB.page);

  assertNoErrors(playerA);
  assertNoErrors(playerB);
  assertNoErrors(rejoinedA);
  assertNoErrors(rejoinedAfterTurnA);
  await contextA.close();
  await contextB.close();
}

async function openRpgGym(page: Page) {
  await page.goto(`${CLIENT_URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".rpg-layer");
  await page.getByRole("button", { name: "道館" }).click();
  await page.waitForSelector(".rpg-gym-panel");
}

async function startAiBattle(page: Page, difficulty: "normal" | "hard" | "leader" = "normal") {
  await openRpgGym(page);
  await page.waitForSelector(".rpg-party-formation-board");
  await page.locator(`.rpg-ai-difficulty-selector button[data-ai-difficulty='${difficulty}']`).click();
  await page.waitForFunction(
    (selectedDifficulty) => document.querySelector(".rpg-ai-difficulty-selector button.is-selected")?.getAttribute("data-ai-difficulty") === selectedDifficulty,
    difficulty,
    { timeout: 15_000 }
  );
  await page.locator(".rpg-gym-modes button").filter({ hasText: "AI 對戰" }).click();
  await waitBattleField(page);
}

async function openRpgProfile(page: Page) {
  await page.goto(`${CLIENT_URL}/?rpg=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".rpg-layer");
  await page.getByRole("button", { name: "卡片" }).click();
  await page.waitForSelector(".rpg-profile-card-panel");
  await page.waitForSelector(".rpg-wallet-card-section");
}

async function finishWalletOpeningIfNeeded(page: Page) {
  const openingVideo = page.locator(".rpg-wallet-card.is-expanded .rpg-skill-opening-stage video");
  if ((await openingVideo.count()) > 0) {
    await openingVideo.first().dispatchEvent("ended");
  }
}

async function readExpandedWalletMove(page: Page) {
  return page.evaluate(() => {
    const reveal = document.querySelector<HTMLElement>(".rpg-wallet-card.is-expanded .rpg-bound-skill-reveal");
    return {
      name: reveal?.querySelector(".rpg-bound-skill-copy strong")?.textContent?.trim() ?? "",
      elementText: reveal?.querySelector(".rpg-bound-skill-copy span")?.textContent?.trim() ?? "",
      statText: reveal?.textContent?.trim() ?? ""
    };
  });
}

async function waitRoomCode(page: Page) {
  await page.waitForFunction(() => /^[A-Z0-9]{5,8}$/.test(document.querySelector(".rpg-versus-waiting strong")?.textContent?.trim() ?? ""), null, { timeout: 15_000 });
  const code = (await page.locator(".rpg-versus-waiting strong").innerText()).trim();
  assert(/^[A-Z0-9]{5,8}$/.test(code), `Invalid room code: ${code}`);
  return code;
}

async function versusStatusInfo(page: Page) {
  await page.waitForSelector(".rpg-versus-status-rail", { timeout: 15_000 });
  return page.locator(".rpg-versus-status-rail").first().evaluate((node) => ({
    roomStatus: node.getAttribute("data-room-status") ?? "",
    connection: node.getAttribute("data-connection") ?? "",
    selfSubmitted: node.getAttribute("data-self-submitted") ?? "",
    submittedCount: node.getAttribute("data-submitted-count") ?? "",
    opponentConnected: node.getAttribute("data-opponent-connected") ?? "",
    rematchReadyCount: node.getAttribute("data-rematch-ready-count") ?? "",
    text: node.textContent?.replace(/\s+/g, " ").trim() ?? ""
  }));
}

async function waitBattleField(page: Page) {
  await page.waitForSelector(".rpg-battle-field", { timeout: 15_000 });
  const fieldPetCount = await page.locator(".rpg-field-pet").count();
  assert(fieldPetCount === 6, `Expected 6 field pets, got ${fieldPetCount}`);
  const arenaBackground = await page.locator(".rpg-battle-field").evaluate((node) => window.getComputedStyle(node).backgroundImage);
  assert(arenaBackground.includes("rpg-battle-arena"), `Battle field did not load arena background: ${arenaBackground}`);
  assert(arenaBackground.includes(GENERATED_ASSET_VERSION), `Battle field did not use current arena background version: ${arenaBackground}`);
}

type FormationDefinitionIds = {
  front: string;
  backLeft: string;
  backRight: string;
};

function sameFormation(actual: FormationDefinitionIds, expected: FormationDefinitionIds) {
  return actual.front === expected.front && actual.backLeft === expected.backLeft && actual.backRight === expected.backRight;
}

async function readGymFormation(page: Page): Promise<FormationDefinitionIds> {
  await page.waitForSelector(".rpg-party-formation-board", { timeout: 15_000 });
  return page.evaluate(() => ({
    front: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='0']")?.getAttribute("data-pet-id") ?? "",
    backLeft: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='1']")?.getAttribute("data-pet-id") ?? "",
    backRight: document.querySelector<HTMLElement>(".rpg-party-formation-slot[data-party-slot='2']")?.getAttribute("data-pet-id") ?? ""
  }));
}

async function setGymFormation(page: Page, definitionIds: readonly string[]): Promise<FormationDefinitionIds> {
  await page.waitForSelector(".rpg-party-formation-board", { timeout: 15_000 });
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
  for (const definitionId of definitionIds.slice(0, 3)) {
    await page.locator(`.rpg-party-select-grid button[data-pet-id='${definitionId}']`).click();
    await page.waitForFunction(
      (id) => Array.from(document.querySelectorAll(".rpg-party-formation-slot")).some((node) => node.getAttribute("data-pet-id") === id),
      definitionId,
      { timeout: 15_000 }
    );
  }
  return readGymFormation(page);
}

async function moveFormationPetToFront(page: Page, definitionId: string): Promise<FormationDefinitionIds> {
  const formation = await readGymFormation(page);
  const current = [formation.front, formation.backLeft, formation.backRight].filter(Boolean);
  assert(current.includes(definitionId), `Cannot move missing formation pet ${definitionId} to front.`);
  const next = [definitionId, ...current.filter((id) => id !== definitionId)];
  const arranged = await setGymFormation(page, next);
  assert(arranged.front === definitionId, `Failed to move ${definitionId} to front: ${JSON.stringify(arranged)}`);
  return arranged;
}

async function readFieldDefinitionFormation(page: Page): Promise<{ left: FormationDefinitionIds; right: FormationDefinitionIds }> {
  await waitBattleField(page);
  return page.evaluate(() => ({
    left: {
      front: document.querySelector<HTMLElement>(".rpg-field-pet.is-left.slot-0")?.getAttribute("data-definition-id") ?? "",
      backLeft: document.querySelector<HTMLElement>(".rpg-field-pet.is-left.slot-1")?.getAttribute("data-definition-id") ?? "",
      backRight: document.querySelector<HTMLElement>(".rpg-field-pet.is-left.slot-2")?.getAttribute("data-definition-id") ?? ""
    },
    right: {
      front: document.querySelector<HTMLElement>(".rpg-field-pet.is-right.slot-0")?.getAttribute("data-definition-id") ?? "",
      backLeft: document.querySelector<HTMLElement>(".rpg-field-pet.is-right.slot-1")?.getAttribute("data-definition-id") ?? "",
      backRight: document.querySelector<HTMLElement>(".rpg-field-pet.is-right.slot-2")?.getAttribute("data-definition-id") ?? ""
    }
  }));
}

async function waitForBattleVfx(page: Page, label: string) {
  await page.waitForFunction(
    () => {
      const vfx = document.querySelector<HTMLElement>(".rpg-battle-vfx");
      if (!vfx) return false;
      const moveId = vfx.getAttribute("data-move-id");
      const layer = vfx.querySelector(".rpg-fx-primary-vfx");
      return Boolean(moveId && layer);
    },
    null,
    { timeout: 15_000 }
  );
  const info = await page.locator(".rpg-battle-vfx").first().evaluate((node) => ({
    moveId: node.getAttribute("data-move-id") ?? "",
    category: node.getAttribute("data-vfx-category") ?? "",
    targetCount: node.getAttribute("data-target-count") ?? "",
    actorSide: node.getAttribute("data-actor-side") ?? "",
    casterX: Number.parseFloat(node.getAttribute("data-caster-x") ?? "-999"),
    visualLayers: node.querySelectorAll(".rpg-fx-primary-vfx").length
  }));
  assert(info.moveId.length > 0 && info.visualLayers > 0, `${label} did not expose a concrete battle VFX layer: ${JSON.stringify(info)}`);
  assert(info.actorSide === "left" || info.actorSide === "right", `${label} did not expose actor side: ${JSON.stringify(info)}`);
  assert(info.actorSide === "left" ? info.casterX < 50 : info.casterX > 50, `${label} caster point does not match presentation side: ${JSON.stringify(info)}`);
}

async function assertBattleVfxPresentationCoordinates(page: Page, label: string) {
  const info = await page.locator(".rpg-battle-vfx").first().evaluate((node) => ({
    actorSide: node.getAttribute("data-actor-side") ?? "",
    casterX: Number.parseFloat(node.getAttribute("data-caster-x") ?? "-999"),
    className: node.className,
    targetSides: node.getAttribute("data-target-sides") ?? "",
    moveId: node.getAttribute("data-move-id") ?? ""
  }));
  assert(info.className.includes(`from-${info.actorSide}`), `${label} VFX class and actor side disagree: ${JSON.stringify(info)}`);
  assert(info.actorSide === "left" ? info.casterX < 50 : info.casterX > 50, `${label} VFX caster point is on the wrong side for the local presentation: ${JSON.stringify(info)}`);
  assert(!info.targetSides.includes("null"), `${label} VFX target side serialization is invalid: ${JSON.stringify(info)}`);
}

async function waitForBattleVfxLayer(page: Page, selector: string, label: string) {
  await page.waitForFunction(
    (layerSelector) => document.querySelectorAll(layerSelector).length > 0,
    selector,
    { timeout: 15_000 }
  );
  const count = await page.locator(selector).count();
  assert(count > 0, `${label} did not render.`);
}

type BattleSubmitLabel = "執行回合" | "送出選招";

function submitButton(page: Page, submitLabel: BattleSubmitLabel) {
  return page.locator("button").filter({ hasText: submitLabel === "執行回合" ? /^執行$/ : submitLabel }).first();
}

async function currentLeftPetInfo(page: Page) {
  return page.evaluate(() => {
    const pet = document.querySelector<HTMLElement>(".rpg-field-pet.is-left.is-current-turn:not(.is-defeated)");
    return pet
      ? {
          petId: pet.getAttribute("data-pet-id") ?? "",
          definitionId: pet.getAttribute("data-definition-id") ?? "",
          name: pet.querySelector(".rpg-field-nameplate strong")?.textContent?.trim() ?? ""
        }
      : null;
  });
}

async function installSupportMoveLoadout(page: Page) {
  await page.evaluate(() => {
    const storageKey = "renaiss-rpg-progress-v1";
    const raw = localStorage.getItem(storageKey);
    const persisted = raw ? JSON.parse(raw) as { state?: Record<string, unknown>; version?: number } : {};
    const state = { ...(persisted.state ?? {}) };
    const skillInventory = {
      ...((state.skillInventory as Record<string, number> | undefined) ?? {}),
      fire_basic_05: 1,
      fire_basic_09: 1,
      fire_intermediate_04: 1,
      water_basic_05: 1,
      water_basic_09: 1
    };
    const petMoveLoadouts = {
      ...((state.petMoveLoadouts as Record<string, string[]> | undefined) ?? {}),
      pet_fire_emberfox: ["fire_basic_01", "fire_basic_05", "fire_intermediate_04", "fire_basic_07"],
      pet_water_tidefin: ["water_basic_01", "water_basic_05", "water_basic_09", "water_basic_07"]
    };
    localStorage.setItem(storageKey, JSON.stringify({
      ...persisted,
      version: persisted.version ?? 1,
      state: {
        ...state,
        skillInventory,
        petMoveLoadouts
      }
    }));
  });
}

async function openCurrentLeftCommandRow(page: Page, definitionId?: string) {
  await page.waitForFunction(
    (expectedDefinitionId) => {
      const pet = document.querySelector<HTMLElement>(".rpg-field-pet.is-left.is-current-turn:not(.is-defeated)");
      return Boolean(pet && (!expectedDefinitionId || pet.getAttribute("data-definition-id") === expectedDefinitionId));
    },
    definitionId ?? "",
    { timeout: 15_000 }
  );
  const petInfo = await currentLeftPetInfo(page);
  assert(petInfo?.petId, `Expected a selectable current-left pet${definitionId ? ` for ${definitionId}` : ""}.`);
  await page.locator(`.rpg-field-pet.is-left.is-current-turn[data-pet-id="${petInfo.petId}"]`).click();
  const row = page.locator(`.rpg-command-row[data-actor-id="${petInfo.petId}"]`);
  await row.waitFor({ state: "visible", timeout: 15_000 });
  return row;
}

async function submitFirstEnabledMoveForRow(page: Page, row: ReturnType<Page["locator"]>, submitLabel: BattleSubmitLabel) {
  const buttons = row.locator(".rpg-move-list button");
  const buttonCount = await buttons.count();
  for (let buttonIndex = 0; buttonIndex < buttonCount; buttonIndex += 1) {
    const button = buttons.nth(buttonIndex);
    if (await button.isEnabled()) {
      await button.click();
      const submit = submitButton(page, submitLabel);
      await submit.waitFor({ state: "visible" });
      assert(!(await submit.isDisabled()), `${submitLabel} is disabled after selecting the current actor move.`);
      await submit.click();
      return;
    }
  }
  throw new Error("No available move for current command row.");
}

async function advanceUntilCurrentLeftPet(page: Page, definitionId: string, requiredMoveName?: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isResultVisible(page)) throw new Error(`Battle finished before ${definitionId} became current.`);
    const current = await currentLeftPetInfo(page);
    if (current) {
      const row = await openCurrentLeftCommandRow(page);
      if (current.definitionId === definitionId) {
        if (!requiredMoveName) return row;
        const requiredMove = row.locator(".rpg-move-list button").filter({ hasText: requiredMoveName }).first();
        if ((await requiredMove.count()) > 0 && await requiredMove.isEnabled()) return row;
      }
      await submitFirstEnabledMoveForRow(page, row, "執行回合");
      await page.waitForTimeout(420);
    } else {
      await page.waitForTimeout(1_150);
    }
  }
  throw new Error(`Timed out waiting for current-left pet ${definitionId}.`);
}

async function submitMoves(page: Page, moveNames: readonly string[], submitLabel: BattleSubmitLabel) {
  const moveNameSet = new Set(moveNames);
  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (await isResultVisible(page)) return;
    const current = await currentLeftPetInfo(page);
    if (!current) {
      await page.waitForTimeout(submitLabel === "執行回合" ? 1_150 : 250);
      continue;
    }
    const row = await openCurrentLeftCommandRow(page);
    const buttons = row.locator(".rpg-move-list button");
    const buttonCount = await buttons.count();
    for (let buttonIndex = 0; buttonIndex < buttonCount; buttonIndex += 1) {
      const button = buttons.nth(buttonIndex);
      const label = (await button.locator("strong").innerText()).trim();
      if (moveNameSet.has(label) && await button.isEnabled()) {
        await button.click();
        const submit = submitButton(page, submitLabel);
        await submit.waitFor({ state: "visible" });
        const disabled = await submit.isDisabled();
        assert(!disabled, `${submitLabel} is disabled after selecting ${label}.`);
        await submit.click();
        return;
      }
    }
    await submitFirstEnabledMoveForRow(page, row, submitLabel);
  }
  throw new Error(`Could not submit any expected move: ${moveNames.join(", ")}`);
}

async function finishVersusBattle(pageA: Page, pageB: Page) {
  for (let turn = 0; turn < 36; turn += 1) {
    if ((await isResultVisible(pageA)) && (await isResultVisible(pageB))) return;
    const beforeA = await readBattleTurn(pageA);
    const beforeB = await readBattleTurn(pageB);
    const submittedA = await submitFirstAvailableMoves(pageA, "送出選招");
    const submittedB = submittedA ? false : await submitFirstAvailableMoves(pageB, "送出選招");
    if (submittedA || submittedB) {
      await waitForTurnAdvanceOrResult(pageA, beforeA);
      await waitForTurnAdvanceOrResult(pageB, beforeB);
    } else {
      await pageA.waitForTimeout(400);
    }
  }
  throw new Error("Versus battle did not finish within 36 single-actor turns.");
}

async function verifyVersusRematch(pageA: Page, pageB: Page) {
  await pageA.waitForSelector(".rpg-battle-result-panel", { timeout: 15_000 });
  await pageB.waitForSelector(".rpg-battle-result-panel", { timeout: 15_000 });
  await assertVersusResultLogPerspective(pageA, "player A result");
  await assertVersusResultLogPerspective(pageB, "player B result");
  const resultRailA = await versusStatusInfo(pageA);
  const resultRailB = await versusStatusInfo(pageB);
  assert(resultRailA.roomStatus === "finished" && resultRailB.roomStatus === "finished", `Result rails should show finished: ${JSON.stringify({ resultRailA, resultRailB })}`);
  const initialStatus = await pageA.locator(".rpg-rematch-status").innerText();
  assert(initialStatus.includes("0/2"), `Rematch status should start at 0/2, got ${initialStatus}`);

  await pageA.locator("button").filter({ hasText: "準備再戰" }).click();
  await pageA.waitForFunction(() => document.body.innerText.includes("1/2") && document.body.innerText.includes("你已準備"), null, { timeout: 15_000 });
  await pageB.waitForFunction(() => document.body.innerText.includes("1/2"), null, { timeout: 15_000 });
  const rematchRailA = await versusStatusInfo(pageA);
  assert(rematchRailA.rematchReadyCount === "1", `Rematch rail should expose one ready player: ${JSON.stringify(rematchRailA)}`);

  await pageB.locator("button").filter({ hasText: "準備再戰" }).click();
  await waitForFreshRematchBattle(pageA);
  await waitForFreshRematchBattle(pageB);
}

async function assertVersusResultLogPerspective(page: Page, label: string) {
  const info = await page.evaluate(() => ({
    result: document.querySelector(".rpg-result-copy strong")?.textContent?.trim() ?? "",
    logText: Array.from(document.querySelectorAll(".rpg-battle-log li")).map((node) => node.textContent?.trim() ?? "").join(" / ")
  }));
  if (info.result === "勝利") {
    assert(info.logText.includes("左方獲勝。"), `${label} should show local-left victory log on win: ${JSON.stringify(info)}`);
    assert(!info.logText.includes("右方獲勝。"), `${label} should not show opponent-side victory log on win: ${JSON.stringify(info)}`);
  } else if (info.result === "敗北") {
    assert(info.logText.includes("右方獲勝。"), `${label} should show local-right victory log on loss: ${JSON.stringify(info)}`);
    assert(!info.logText.includes("左方獲勝。"), `${label} should not show self-side victory log on loss: ${JSON.stringify(info)}`);
  } else {
    assert(info.result === "平手" && info.logText.includes("雙方同時失去戰力。"), `${label} draw result/log mismatch: ${JSON.stringify(info)}`);
  }
}

async function submitFirstAvailableMoves(page: Page, submitLabel: BattleSubmitLabel) {
  if (await isResultVisible(page)) return false;
  const current = await currentLeftPetInfo(page);
  if (!current) return false;
  const row = await openCurrentLeftCommandRow(page);
  await submitFirstEnabledMoveForRow(page, row, submitLabel);
  return true;
}

async function isResultVisible(page: Page) {
  return (await page.locator(".rpg-battle-result-panel").count()) > 0;
}

async function readBattleTurn(page: Page) {
  return page.evaluate(() => {
    const text = document.querySelector(".rpg-battle-scene-header span")?.textContent ?? "";
    const match = text.match(/TURN\s+(\d+)/);
    return match ? Number(match[1]) : null;
  });
}

async function waitForTurnAdvanceOrResult(page: Page, previousTurn: number | null) {
  await page.waitForFunction(
    (turn) => {
      if (document.querySelector(".rpg-battle-result-panel")) return true;
      const text = document.querySelector(".rpg-battle-scene-header span")?.textContent ?? "";
      const match = text.match(/TURN\s+(\d+)/);
      return match ? Number(match[1]) !== turn : false;
    },
    previousTurn,
    { timeout: 15_000 }
  );
}

async function waitForFreshRematchBattle(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector(".rpg-battle-result-panel") && /TURN\s+1/.test(document.querySelector(".rpg-battle-scene-header span")?.textContent ?? ""),
    null,
    { timeout: 15_000 }
  );
}

async function battleVfxInfo(page: Page, moveId?: string) {
  return page.evaluate((expectedMoveId) => {
    const selector = expectedMoveId ? `.rpg-battle-vfx[data-move-id="${expectedMoveId}"]` : ".rpg-battle-vfx";
    const battleVfx = document.querySelector<HTMLElement>(selector);
    const sprite = document.querySelector(`${selector} .rpg-skill-vfx-frame`);
    const style = sprite ? window.getComputedStyle(sprite) : null;
    const travel = document.querySelector<HTMLElement>(`${selector} .rpg-fx-travel-projectile, ${selector} .rpg-fx-travel-sheet`);
    const travelStyle = travel ? window.getComputedStyle(travel) : null;
    const travelRect = travel?.getBoundingClientRect();
    const impacts = Array.from(document.querySelectorAll(`${selector} .rpg-target-impact-vfx`));
    const targetIds = battleVfx?.getAttribute("data-target-ids") ?? "";
    return {
      fieldPetCount: document.querySelectorAll(".rpg-field-pet").length,
      vfxCategory: battleVfx?.getAttribute("data-vfx-category") ?? "",
      vfxSource: battleVfx?.getAttribute("data-vfx-source") ?? "",
      vfxStatusSource: battleVfx?.getAttribute("data-vfx-status-source") ?? "",
      vfxSources: battleVfx?.getAttribute("data-vfx-sources") ?? "",
      vfxPhases: battleVfx?.getAttribute("data-vfx-phases") ?? "",
      usesBulletProjectile: battleVfx?.getAttribute("data-uses-bullet-projectile") ?? "",
      actorSide: battleVfx?.getAttribute("data-actor-side") ?? "",
      casterX: Number.parseFloat(battleVfx?.getAttribute("data-caster-x") ?? "-999"),
      targetIds,
      targetSides: battleVfx?.getAttribute("data-target-sides") ?? "",
      spriteBackground: style?.backgroundImage ?? "",
      travelSpriteCount: document.querySelectorAll(`${selector} .rpg-fx-travel-projectile, ${selector} .rpg-fx-travel-sheet`).length,
      travelBackground: travelStyle?.backgroundImage ?? "",
      travelWidth: travelRect?.width ?? 0,
      travelHeight: travelRect?.height ?? 0,
      impactSpriteCount: document.querySelectorAll(`${selector} .rpg-fx-impact-sprite`).length,
      targetImpactCount: impacts.length,
      uniqueReplayTargets: new Set(targetIds.split(",").filter(Boolean)).size
    };
  }, moveId ?? null);
}

async function fieldStatusInfo(page: Page) {
  return page.evaluate(() => ({
    statusEffectCount: document.querySelectorAll(".rpg-field-pet.has-statuses .rpg-status-effect").length,
    guardPetCount: Array.from(document.querySelectorAll(".rpg-field-pet.has-statuses")).filter((pet) => pet.getAttribute("data-statuses")?.includes("guard")).length,
    statusVfxBackground: window.getComputedStyle(document.querySelector<HTMLElement>(".rpg-field-pet.has-statuses .rpg-status-effect") ?? document.body).backgroundImage
  }));
}

async function readVillageFollowerState(page: Page) {
  return page.evaluate(() => {
    const game = (window as unknown as { __renaissRpgGame?: { registry?: { get(key: string): unknown } } }).__renaissRpgGame;
    return game?.registry?.get("rpgVillageFollowers") ?? null;
  }) as Promise<VillageFollowerDebugState | null>;
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewport: window.innerWidth
  }));
  const overflow = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth) - metrics.viewport;
  assert(overflow <= 2, `${label} has horizontal overflow: ${JSON.stringify(metrics)}`);
}

async function assertRectInsideViewport(page: Page, selector: string, label: string) {
  const rect = await page.locator(selector).first().evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });
  assert(rect.left >= -1 && rect.right <= rect.viewportWidth + 1, `${label} is horizontally outside viewport: ${JSON.stringify(rect)}`);
  assert(rect.top >= -1 && rect.bottom <= rect.viewportHeight + 1, `${label} is vertically outside viewport: ${JSON.stringify(rect)}`);
}

function assertNoErrors(test: TestPage) {
  assert(test.errors.length === 0, test.errors.join("\n"));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

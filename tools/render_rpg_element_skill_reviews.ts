import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import {
  RPG_ELEMENTS,
  RPG_ELEMENT_META,
  RPG_MOVES,
  RPG_STATUS_META,
  getRpgSkillVfxSpec,
  getRpgVfxProductionSpec,
  scoreRpgMove,
  type RpgElement,
  type RpgMove,
  type RpgSkillTier,
  type RpgStatusId,
  type RpgTarget
} from "../packages/shared/src/index";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = process.env.RPG_ELEMENT_REVIEW_OUT ?? "/tmp/renaiss-rpg-previews/element-skill-reviews-current";
const GENERATED_DIR = resolve(ROOT, "apps/client/public/assets/generated");
const PNG_FRAME = 7;
const GIF_FRAMES = 16;

const TIER_LABEL: Record<RpgSkillTier, string> = {
  basic: "初階",
  intermediate: "中階",
  ultimate: "高階"
};

const TARGET_LABEL: Record<RpgTarget, string> = {
  singleEnemy: "單體敵方",
  allEnemies: "敵方全體",
  self: "自身",
  singleAlly: "單體我方",
  allAllies: "我方全體"
};

const PROJECTILE_ROW: Record<RpgElement, number> = {
  water: 0,
  fire: 1,
  grass: 2,
  dark: 3,
  light: 4
};

function assetUrl(fileName: string) {
  return `file://${resolve(GENERATED_DIR, fileName)}`;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusLabel(status: RpgStatusId) {
  return RPG_STATUS_META[status]?.label ?? status;
}

function effectLabel(move: RpgMove) {
  if (move.power > 0 && move.effects.length === 0) return `傷害 ${move.power}`;
  const parts: string[] = [];
  if (move.power > 0) parts.push(`傷害 ${move.power}`);
  for (const effect of move.effects) {
    if (effect.status) {
      const duration = effect.duration ?? 1;
      const power = effect.power ?? 1;
      if (effect.status === "guard") parts.push(`防護：防禦 +${power}，${duration}回`);
      else if (effect.status === "regen") parts.push(`再生：每輪回復 ${power} HP，${duration}回`);
      else if (effect.status === "burn" || effect.status === "poison") parts.push(`${statusLabel(effect.status)}：每輪 ${power} 傷害，${duration}回`);
      else if (effect.status === "stun") parts.push("暈眩：跳過一次行動");
      else parts.push(`${statusLabel(effect.status)}：強度 ${power}，${duration}回`);
    }
    if (effect.heal) parts.push(`立即回復 ${effect.heal} HP`);
    if (effect.cleanse) parts.push("淨化負面");
    if (effect.shield) parts.push(`護盾 ${effect.shield}`);
    if (effect.energy) parts.push(`能量 ${effect.energy}`);
    if (effect.selfDamage) parts.push(`自損 ${effect.selfDamage}`);
  }
  return parts.join("；") || "效果";
}

function sourceDisplayName(source: string) {
  if (source === "external-spellsfx-2") return "SpellsFX 2.0 完整序列";
  if (source === "external-super-pixel-gigapack") return "Super Pixel Gigapack 完整序列";
  if (source === "external-16x16-bullet") return "16x16 Bullet 完整序列";
  if (source === "generated-status-sheet") return "狀態持續 spritesheet";
  return source;
}

function moveRows(element: RpgElement) {
  return RPG_MOVES.filter((move) => move.element === element);
}

function spriteMarkup(move: RpgMove) {
  const production = getRpgVfxProductionSpec(move);
  if (production.usesBulletProjectile) {
    return `<span class="sprite projectile" data-cols="10" data-rows="5" data-row="${PROJECTILE_ROW[move.element]}" style="background-image:url('${assetUrl("rpg-skill-projectiles.png")}'); background-size:1000% 500%;"></span>`;
  }
  const spec = getRpgSkillVfxSpec(move);
  return `<span class="sprite skill" data-cols="${spec.columns}" data-rows="${spec.rows}" data-row="${spec.row}" style="background-image:url('${assetUrl(`${spec.sheet}.png`)}'); background-size:${spec.columns * 100}% ${spec.rows * 100}%;"></span>`;
}

function renderElementHtml(element: RpgElement) {
  const meta = RPG_ELEMENT_META[element];
  const moves = moveRows(element);
  const cards = moves
    .map((move) => {
      const production = getRpgVfxProductionSpec(move);
      const score = scoreRpgMove(move).toFixed(1);
      const statusSource = production.statusSource ? ` / 狀態層：${sourceDisplayName(production.statusSource)}` : "";
      return `
        <article class="move-card tier-${move.tier}">
          <div class="move-index">
            <b>${move.slot}</b>
            <span>${TIER_LABEL[move.tier]}</span>
          </div>
          <div class="move-copy">
            <h2>${escapeHtml(move.name)}</h2>
            <p>${escapeHtml(move.animation.name)}</p>
            <dl>
              <div><dt>目標</dt><dd>${TARGET_LABEL[move.target]}</dd></div>
              <div><dt>威力</dt><dd>${move.power}</dd></div>
              <div><dt>速度</dt><dd>${move.speed}</dd></div>
              <div><dt>能量</dt><dd>${move.energyCost}</dd></div>
              <div><dt>分數</dt><dd>${score}</dd></div>
            </dl>
          </div>
          <div class="move-effect">
            <strong>${escapeHtml(effectLabel(move))}</strong>
            <span>${escapeHtml(move.description)}</span>
            <em>${escapeHtml(sourceDisplayName(production.primarySource))}${escapeHtml(statusSource)}</em>
          </div>
          <div class="move-vfx">${spriteMarkup(move)}</div>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>${meta.label}屬性技能動畫對照</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #120907;
      color: #f7dfad;
      font-family: Arial, "Noto Sans TC", sans-serif;
    }
    .sheet {
      width: 1120px;
      padding: 18px 18px 22px;
      background:
        linear-gradient(180deg, rgba(255, 221, 137, 0.06), transparent 180px),
        #170c08;
    }
    header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      padding: 0 0 14px;
      border-bottom: 2px solid ${meta.color};
    }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    header p {
      margin: 6px 0 0;
      color: #d8bc83;
      font-size: 15px;
    }
    header strong {
      color: ${meta.accent};
      font-size: 18px;
    }
    .move-card {
      display: grid;
      grid-template-columns: 64px 330px 1fr 232px;
      gap: 12px;
      align-items: stretch;
      min-height: 102px;
      margin-top: 10px;
      border: 2px solid color-mix(in srgb, ${meta.color} 42%, #4b2417);
      background:
        linear-gradient(90deg, color-mix(in srgb, ${meta.color} 9%, #24110c), #1c0d09 48%, #120806),
        #1a0c08;
      box-shadow: inset 0 0 0 1px rgba(255, 230, 169, 0.07);
    }
    .move-index {
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      background: color-mix(in srgb, ${meta.color} 22%, #21100b);
      border-right: 2px solid rgba(255, 221, 145, 0.12);
    }
    .move-index b {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      color: #140905;
      background: ${meta.accent};
      border: 2px solid #3f2216;
      font-size: 18px;
    }
    .move-index span,
    .move-copy p,
    .move-effect span,
    .move-effect em,
    dt,
    dd {
      letter-spacing: 0;
    }
    .move-index span {
      font-size: 13px;
      color: #f4d894;
    }
    .move-copy,
    .move-effect {
      padding: 12px 4px;
      min-width: 0;
    }
    .move-copy h2 {
      margin: 0 0 5px;
      color: #ffe9af;
      font-size: 21px;
      line-height: 1.1;
    }
    .move-copy p {
      margin: 0 0 9px;
      color: ${meta.accent};
      font-size: 14px;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px 10px;
      margin: 0;
    }
    dl div { min-width: 0; }
    dt {
      color: #9d8056;
      font-size: 11px;
    }
    dd {
      margin: 1px 0 0;
      color: #e8ca8b;
      font-size: 13px;
    }
    .move-effect strong {
      display: block;
      color: #ffe4a0;
      font-size: 15px;
      line-height: 1.35;
    }
    .move-effect span {
      display: block;
      margin-top: 5px;
      color: #c7aa77;
      font-size: 13px;
      line-height: 1.35;
    }
    .move-effect em {
      display: block;
      margin-top: 7px;
      color: #9f8a64;
      font-size: 12px;
      font-style: normal;
    }
    .move-vfx {
      display: grid;
      place-items: center;
      margin: 8px;
      min-height: 84px;
      background: #020202;
      border: 1px solid #3b2115;
      overflow: hidden;
    }
    .sprite {
      display: block;
      image-rendering: pixelated;
      background-repeat: no-repeat;
      filter: drop-shadow(0 0 8px color-mix(in srgb, ${meta.accent} 46%, transparent));
    }
    .sprite.skill {
      width: 160px;
      height: 112px;
      transform: scale(1.18);
    }
    .sprite.projectile {
      width: 96px;
      height: 56px;
      transform: scale(2.2);
    }
  </style>
</head>
<body>
  <main class="sheet" data-element="${element}">
    <header>
      <div>
        <h1>${meta.label}屬性 25 招 - 技能效果 / 動畫對照</h1>
        <p>命中率與冷卻已移除：主招 100% 命中；第 N 回合 EN=N，上限 10；單體敵技需先打前排。初階 10 / 中階 10 / 高階 5。</p>
      </div>
      <strong>${moves.length}/25</strong>
    </header>
    ${cards}
  </main>
  <script>
    function setFrame(frame) {
      document.querySelectorAll(".sprite").forEach((el) => {
        const cols = Number(el.dataset.cols);
        const rows = Number(el.dataset.rows);
        const row = Number(el.dataset.row);
        const column = Math.max(0, Math.min(cols - 1, frame % cols));
        const x = cols <= 1 ? 0 : (column / (cols - 1)) * 100;
        const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
        el.style.backgroundPosition = x + "% " + y + "%";
      });
    }
    window.__setRpgSheetFrame = setFrame;
    setFrame(${PNG_FRAME});
  </script>
</body>
</html>`;
}

async function screenshotElement(browser: Browser, element: RpgElement, indexEntries: string[]) {
  const elementDir = resolve(OUT_DIR, element);
  const framesDir = resolve(elementDir, "frames");
  await mkdir(framesDir, { recursive: true });

  const htmlPath = resolve(elementDir, `rpg-skills-${element}-25-current.html`);
  const pngPath = resolve(elementDir, `rpg-skills-${element}-25-current.png`);
  const gifPath = resolve(elementDir, `rpg-skills-${element}-25-current.gif`);
  await writeFile(htmlPath, renderElementHtml(element));

  const page = await browser.newPage({ viewport: { width: 1180, height: 3600 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`file://${htmlPath}`);
    await page.waitForSelector(".move-card:nth-of-type(25)");
    const sheet = page.locator(".sheet");
    await page.evaluate((frame) => {
      (window as unknown as { __setRpgSheetFrame: (frame: number) => void }).__setRpgSheetFrame(frame);
    }, PNG_FRAME);
    await sheet.screenshot({ path: pngPath });

    for (let frame = 0; frame < GIF_FRAMES; frame += 1) {
      await page.evaluate((value) => {
        (window as unknown as { __setRpgSheetFrame: (frame: number) => void }).__setRpgSheetFrame(value);
      }, frame);
      await sheet.screenshot({ path: resolve(framesDir, `frame-${String(frame).padStart(2, "0")}.png`) });
    }
  } finally {
    await page.close();
  }

  writeGif(framesDir, gifPath);
  indexEntries.push(`<li><a href="${element}/rpg-skills-${element}-25-current.png">${RPG_ELEMENT_META[element].label} PNG</a> / <a href="${element}/rpg-skills-${element}-25-current.gif">GIF</a></li>`);
}

function writeGif(framesDir: string, outputPath: string) {
  const script = `
from pathlib import Path
from PIL import Image
import sys

frames_dir = Path(sys.argv[1])
output = Path(sys.argv[2])
paths = sorted(frames_dir.glob("frame-*.png"))
if not paths:
    raise SystemExit("No frames found for GIF")
frames = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE) for path in paths]
frames[0].save(output, save_all=True, append_images=frames[1:], duration=82, loop=0, optimize=False)
`;
  execFileSync("python3", ["-c", script, framesDir, outputPath], { stdio: "inherit" });
}

async function writeIndex(entries: readonly string[]) {
  const html = `<!doctype html>
<html lang="zh-Hant">
<meta charset="utf-8" />
<title>RPG 五屬性技能動畫對照</title>
<body style="font-family:Arial,sans-serif;background:#160c08;color:#f4d692;padding:24px;">
  <h1>RPG 五屬性技能動畫對照</h1>
  <p>目前版本：主招 100% 命中，未顯示命中率或觸發率。每個 GIF 會同步播放 25 招 spritesheet frame。</p>
  <ul>${entries.join("")}</ul>
</body>
</html>`;
  await writeFile(resolve(OUT_DIR, "index.html"), html);
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const indexEntries: string[] = [];
  try {
    for (const element of RPG_ELEMENTS) {
      await screenshotElement(browser, element, indexEntries);
    }
  } finally {
    await browser.close();
  }
  await writeIndex(indexEntries);
  console.log("RPG element skill reviews written:");
  console.log(`- ${resolve(OUT_DIR, "index.html")}`);
  for (const element of RPG_ELEMENTS) {
    console.log(`- ${RPG_ELEMENT_META[element].label}: ${resolve(OUT_DIR, element, `rpg-skills-${element}-25-current.png`)}`);
    console.log(`- ${RPG_ELEMENT_META[element].label} GIF: ${resolve(OUT_DIR, element, `rpg-skills-${element}-25-current.gif`)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

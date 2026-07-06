import {
  RPG_ELEMENTS,
  RPG_MOVES,
  RPG_STARTER_PETS,
  getRpgSkillVfxSpec,
  getRpgVfxProductionSpec,
  type RpgVfxProductionCategory,
  type RpgSkillTier
} from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { GENERATED_ASSET_VERSION, generatedAssetPath } from "../game/assets/generatedAssets";

const PET_POSE_COUNT = 5;
const PET_FRAME_COUNT = 18;
const STATUS_ROW_COUNT = 5;
const STATUS_FRAME_COUNT = 12;

const REVIEW_LINKS = [
  { label: "村莊", href: "/", detail: "主流程入口" },
  { label: "技能驗收", href: "/?preview=skills", detail: "125 招逐幀與 3v3 目標效果" },
  { label: "寵物驗收", href: "/?preview=pets", detail: "五寵物 idle / walk / attack / hit / faint" },
  { label: "狀態驗收", href: "/?preview=status", detail: "5 種持續狀態 spritesheet" }
] as const;

const RELEASE_GATES = [
  "pnpm assets:validate",
  "pnpm rpg:audit",
  "pnpm rpg:animation-report",
  "pnpm rpg:playtest",
  "pnpm rpg:visual-review",
  "pnpm rpg:release-audit",
  "pnpm rpg:release-check",
  "pnpm typecheck",
  "pnpm build"
] as const;

const TIER_LABEL: Record<RpgSkillTier, string> = {
  basic: "初階",
  intermediate: "中階",
  ultimate: "高階"
};

function tierCount(tier: RpgSkillTier) {
  return RPG_MOVES.filter((move) => move.tier === tier).length;
}

function sourceStats() {
  const counts = new Map<string, number>();
  for (const move of RPG_MOVES) {
    const primarySource = getRpgVfxProductionSpec(move).primarySource;
    counts.set(primarySource, (counts.get(primarySource) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function animationCoverageStats() {
  const categoryCounts = new Map<RpgVfxProductionCategory, number>();
  let statusLayerMoves = 0;
  let actorPathMoves = 0;
  let groupTargetMoves = 0;
  let bulletMoves = 0;
  let skillFrameCells = 0;

  for (const move of RPG_MOVES) {
    const productionSpec = getRpgVfxProductionSpec(move);
    const skillSpec = getRpgSkillVfxSpec(move);
    categoryCounts.set(productionSpec.category, (categoryCounts.get(productionSpec.category) ?? 0) + 1);
    skillFrameCells += productionSpec.usesBulletProjectile ? 10 : skillSpec.frameCount;
    if (productionSpec.usesStatusLayer) statusLayerMoves += 1;
    if (productionSpec.requiresActorToTargetPath) actorPathMoves += 1;
    if (move.target === "allEnemies" || move.target === "allAllies") groupTargetMoves += 1;
    if (productionSpec.usesBulletProjectile) bulletMoves += 1;
  }

  return {
    moveRows: RPG_MOVES.length,
    skillFrameCells,
    petPoseSets: RPG_STARTER_PETS.length * PET_POSE_COUNT,
    petFrameCells: RPG_STARTER_PETS.length * PET_FRAME_COUNT,
    statusRows: STATUS_ROW_COUNT,
    statusFrameCells: STATUS_ROW_COUNT * STATUS_FRAME_COUNT,
    statusLayerMoves,
    actorPathMoves,
    groupTargetMoves,
    bulletMoves,
    categoryCounts: [...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  };
}

export function RpgReleaseReview() {
  const elementCounts = RPG_ELEMENTS.map((element) => ({
    element,
    count: RPG_MOVES.filter((move) => move.element === element).length
  }));
  const statusMoveCount = RPG_MOVES.filter((move) => move.effects.some((effect) => effect.status || effect.heal || effect.cleanse || effect.shield)).length;
  const animationCoverage = animationCoverageStats();

  return (
    <main className="rpg-release-review" style={{ "--rpg-arena-url": `url("${generatedAssetPath("rpg-battle-arena")}")` } as CSSProperties}>
      <header>
        <div>
          <strong>RPG 上架驗收總覽</strong>
          <span>資料、素材、流程與驗收入口集中檢查</span>
        </div>
        <nav>
          {REVIEW_LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>
      </header>

      <section className="rpg-release-hero">
        <div className="rpg-release-arena-card">
          <img src={generatedAssetPath("rpg-battle-arena")} alt="" />
        </div>
        <div className="rpg-release-summary">
          <span>Current Build</span>
          <strong>{GENERATED_ASSET_VERSION}</strong>
          <p>單一主序列 VFX 規則已啟用：每招主動畫只選一組完整素材序列，狀態持續層獨立於主技能動畫。</p>
          <div className="rpg-release-metrics">
            <b>{RPG_MOVES.length}<em>招式</em></b>
            <b>{RPG_STARTER_PETS.length}<em>寵物</em></b>
            <b>{statusMoveCount}<em>狀態/支援招</em></b>
          </div>
        </div>
      </section>

      <section className="rpg-release-grid">
        <article>
          <header>
            <span>Moves</span>
            <strong>技能資料</strong>
          </header>
          <div className="rpg-release-element-bars">
            {elementCounts.map((item) => (
              <div key={item.element} data-element={item.element}>
                <span>{item.element}</span>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
          <dl>
            {(["basic", "intermediate", "ultimate"] as const).map((tier) => (
              <div key={tier}>
                <dt>{TIER_LABEL[tier]}</dt>
                <dd>{tierCount(tier)}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article>
          <header>
            <span>VFX</span>
            <strong>主序列來源</strong>
          </header>
          <ul className="rpg-release-source-list">
            {sourceStats().map(([source, count]) => (
              <li key={source}>
                <span>{source}</span>
                <b>{count}</b>
              </li>
            ))}
          </ul>
        </article>

        <article className="rpg-release-animation-card">
          <header>
            <span>Animation</span>
            <strong>動畫覆蓋</strong>
          </header>
          <div className="rpg-release-animation-metrics">
            <b data-animation-metric="skill-rows">{animationCoverage.moveRows}<em>技能列</em></b>
            <b data-animation-metric="skill-frames">{animationCoverage.skillFrameCells}<em>技能幀</em></b>
            <b data-animation-metric="pet-frames">{animationCoverage.petFrameCells}<em>寵物幀</em></b>
            <b data-animation-metric="status-frames">{animationCoverage.statusFrameCells}<em>狀態幀</em></b>
          </div>
          <dl className="rpg-release-animation-list">
            <div>
              <dt>寵物動作</dt>
              <dd data-animation-detail="pet-pose-sets">{animationCoverage.petPoseSets}</dd>
            </div>
            <div>
              <dt>狀態列</dt>
              <dd data-animation-detail="status-rows">{animationCoverage.statusRows}</dd>
            </div>
            <div>
              <dt>路徑招式</dt>
              <dd data-animation-detail="actor-path-moves">{animationCoverage.actorPathMoves}</dd>
            </div>
            <div>
              <dt>群體目標</dt>
              <dd data-animation-detail="group-target-moves">{animationCoverage.groupTargetMoves}</dd>
            </div>
            <div>
              <dt>狀態層</dt>
              <dd data-animation-detail="status-layer-moves">{animationCoverage.statusLayerMoves}</dd>
            </div>
            <div>
              <dt>小彈道</dt>
              <dd data-animation-detail="bullet-moves">{animationCoverage.bulletMoves}</dd>
            </div>
          </dl>
          <ul className="rpg-release-category-list">
            {animationCoverage.categoryCounts.map(([category, count]) => (
              <li key={category} data-vfx-category={category}>
                <span>{category}</span>
                <b>{count}</b>
              </li>
            ))}
          </ul>
        </article>

        <article>
          <header>
            <span>Review</span>
            <strong>驗收入口</strong>
          </header>
          <div className="rpg-release-links">
            {REVIEW_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                <strong>{link.label}</strong>
                <span>{link.detail}</span>
              </a>
            ))}
          </div>
        </article>

        <article>
          <header>
            <span>Gates</span>
            <strong>發佈前指令</strong>
          </header>
          <ol className="rpg-release-gates">
            {RELEASE_GATES.map((gate) => (
              <li key={gate}>
                <code>{gate}</code>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </main>
  );
}

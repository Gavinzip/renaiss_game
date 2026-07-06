import {
  RPG_ELEMENTS,
  RPG_MOVES,
  RPG_STARTER_PETS,
  getRpgSkillVfxSpec,
  getRpgVfxProductionSpec,
  type RpgElement,
  type RpgMove,
  type RpgSkillTier
} from "../packages/shared/src/index";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ExternalSource = {
  pack?: string;
  source?: string;
};

type ExternalVfxManifest = {
  assetVersion?: string;
  compositionMode?: string;
  moveRows?: Array<{
    row?: number;
    tier?: string;
    slot?: number;
    selectedSources?: Partial<Record<RpgElement, ExternalSource>>;
  }>;
  statusRows?: Array<{
    row?: number;
    status?: string;
    pack?: string;
    source?: string;
  }>;
};

const OUTPUT_DIR = process.env.RPG_ANIMATION_REPORT_OUT ?? "/tmp/renaiss-rpg-previews";
const MANIFEST_PATH = resolve("apps/client/public/assets/generated/rpg-external-vfx-manifest.json");
const PET_POSE_COUNT = 5;
const PET_FRAME_COUNT = 18;
const STATUS_ROW_COUNT = 5;
const STATUS_FRAME_COUNT = 12;
const PROJECTILE_FRAME_COUNT = 10;
const ELEMENT_ORDER = new Map<RpgElement, number>(RPG_ELEMENTS.map((element, index) => [element, index]));
const TIER_ORDER: Record<RpgSkillTier, number> = {
  basic: 0,
  intermediate: 1,
  ultimate: 2
};

function readManifest(): ExternalVfxManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ExternalVfxManifest;
}

function effectSummary(move: RpgMove) {
  if (move.effects.length === 0) return ["damage"];
  return move.effects.map((effect) => {
    if (effect.status) return `status:${effect.status}`;
    if (effect.heal) return `heal:${effect.heal}`;
    if (effect.shield) return `shield:${effect.shield}`;
    if (effect.cleanse) return "cleanse";
    if (effect.energy) return `energy:${effect.energy}`;
    if (effect.selfDamage) return `self-damage:${effect.selfDamage}`;
    return "effect";
  });
}

function countBy<T extends string>(values: readonly T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function sortedMoves() {
  return [...RPG_MOVES].sort((a, b) => {
    const elementDiff = (ELEMENT_ORDER.get(a.element) ?? 0) - (ELEMENT_ORDER.get(b.element) ?? 0);
    if (elementDiff !== 0) return elementDiff;
    const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return a.slot - b.slot;
  });
}

function buildMoveRows(manifest: ExternalVfxManifest) {
  const rows = sortedMoves().map((move) => {
    const skillSpec = getRpgSkillVfxSpec(move);
    const productionSpec = getRpgVfxProductionSpec(move);
    const selectedSource = manifest.moveRows?.[skillSpec.row]?.selectedSources?.[move.element] ?? null;
    const runtimeFrameCount = productionSpec.usesBulletProjectile ? PROJECTILE_FRAME_COUNT : skillSpec.frameCount;

    return {
      id: move.id,
      name: move.name,
      element: move.element,
      tier: move.tier,
      slot: move.slot,
      target: move.target,
      power: move.power,
      energyCost: move.energyCost,
      effects: effectSummary(move),
      animation: {
        name: move.animation.name,
        style: move.animation.style,
        moveFrameCount: move.animation.frameCount,
        notes: move.animation.notes
      },
      runtime: {
        sheet: productionSpec.usesBulletProjectile ? "rpg-skill-projectiles" : skillSpec.sheet,
        row: productionSpec.usesBulletProjectile ? ELEMENT_ORDER.get(move.element) ?? 0 : skillSpec.row,
        frameCount: runtimeFrameCount,
        durationMs: skillSpec.durationMs,
        frameWidth: productionSpec.usesBulletProjectile ? 96 : skillSpec.frameWidth,
        frameHeight: productionSpec.usesBulletProjectile ? 56 : skillSpec.frameHeight
      },
      production: {
        category: productionSpec.category,
        primarySource: productionSpec.primarySource,
        statusSource: productionSpec.statusSource,
        selectedPack: selectedSource?.pack ?? productionSpec.primarySource,
        selectedSource: selectedSource?.source ?? null,
        phases: productionSpec.phases,
        usesBulletProjectile: productionSpec.usesBulletProjectile,
        usesStatusLayer: productionSpec.usesStatusLayer,
        requiresWideTargetRead: productionSpec.requiresWideTargetRead,
        requiresActorToTargetPath: productionSpec.requiresActorToTargetPath,
        rationale: productionSpec.rationale
      }
    };
  });

  const missingSources = rows.filter((row) => !row.production.usesBulletProjectile && !row.production.selectedSource);
  if (missingSources.length > 0) {
    throw new Error(`Missing selected source for ${missingSources.length} non-bullet move row(s): ${missingSources.map((row) => row.id).slice(0, 8).join(", ")}`);
  }

  return rows;
}

function buildReport(manifest: ExternalVfxManifest) {
  const moveRows = buildMoveRows(manifest);
  const skillFrameCells = moveRows.reduce((sum, row) => sum + row.runtime.frameCount, 0);
  const statusLayerMoves = moveRows.filter((row) => row.production.usesStatusLayer).length;
  const actorPathMoves = moveRows.filter((row) => row.production.requiresActorToTargetPath).length;
  const groupTargetMoves = moveRows.filter((row) => row.target === "allEnemies" || row.target === "allAllies").length;
  const bulletMoves = moveRows.filter((row) => row.production.usesBulletProjectile).length;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assetVersion: manifest.assetVersion ?? null,
    compositionMode: manifest.compositionMode ?? null,
    totals: {
      moves: moveRows.length,
      skillFrameCells,
      starterPets: RPG_STARTER_PETS.length,
      petPoseSets: RPG_STARTER_PETS.length * PET_POSE_COUNT,
      petFrameCells: RPG_STARTER_PETS.length * PET_FRAME_COUNT,
      statusRows: STATUS_ROW_COUNT,
      statusFrameCells: STATUS_ROW_COUNT * STATUS_FRAME_COUNT,
      statusLayerMoves,
      actorPathMoves,
      groupTargetMoves,
      bulletMoves
    },
    counts: {
      byElement: countBy(moveRows.map((row) => row.element)),
      byTier: countBy(moveRows.map((row) => row.tier)),
      byTarget: countBy(moveRows.map((row) => row.target)),
      byCategory: countBy(moveRows.map((row) => row.production.category)),
      byPrimarySource: countBy(moveRows.map((row) => row.production.primarySource))
    },
    statusRows: manifest.statusRows ?? [],
    moves: moveRows
  };
}

function assertReport(report: ReturnType<typeof buildReport>) {
  const errors: string[] = [];
  if (report.totals.moves !== 125) errors.push(`expected 125 moves, got ${report.totals.moves}`);
  if (report.counts.byElement.water !== 25 || report.counts.byElement.fire !== 25 || report.counts.byElement.grass !== 25 || report.counts.byElement.dark !== 25 || report.counts.byElement.light !== 25) {
    errors.push(`expected 25 moves per element, got ${JSON.stringify(report.counts.byElement)}`);
  }
  if (report.counts.byTier.basic !== 50 || report.counts.byTier.intermediate !== 50 || report.counts.byTier.ultimate !== 25) {
    errors.push(`expected 50/50/25 tier split, got ${JSON.stringify(report.counts.byTier)}`);
  }
  if (report.totals.skillFrameCells < 1900) errors.push(`skill frame cells too low: ${report.totals.skillFrameCells}`);
  if (report.totals.petFrameCells !== 90) errors.push(`expected 90 pet frame cells, got ${report.totals.petFrameCells}`);
  if (report.totals.statusFrameCells !== 60) errors.push(`expected 60 status frame cells, got ${report.totals.statusFrameCells}`);
  if (report.totals.bulletMoves !== 4) errors.push(`expected 4 bullet moves, got ${report.totals.bulletMoves}`);
  if (!report.assetVersion) errors.push("missing assetVersion");
  if (report.compositionMode !== "single-sequence-per-row") errors.push(`unexpected compositionMode: ${report.compositionMode}`);

  const categories = new Set(report.moves.map((row) => row.production.category));
  for (const required of ["small-projectile", "impact-strike", "wide-sweep", "status-layered", "support-field", "ultimate-multiphase"]) {
    if (!categories.has(required)) errors.push(`missing production category ${required}`);
  }

  if (errors.length > 0) {
    throw new Error(`Animation production report validation failed:\n- ${errors.join("\n- ")}`);
  }
}

function markdownReport(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [
    "# RPG Animation Production Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Asset version: ${report.assetVersion}`,
    `Composition: ${report.compositionMode}`,
    "",
    "## Totals",
    "",
    `- Moves: ${report.totals.moves}`,
    `- Skill frame cells: ${report.totals.skillFrameCells}`,
    `- Pet frame cells: ${report.totals.petFrameCells}`,
    `- Status frame cells: ${report.totals.statusFrameCells}`,
    `- Actor-path moves: ${report.totals.actorPathMoves}`,
    `- Group-target moves: ${report.totals.groupTargetMoves}`,
    `- Status-layer moves: ${report.totals.statusLayerMoves}`,
    `- Bullet moves: ${report.totals.bulletMoves}`,
    "",
    "## Counts",
    "",
    `- By element: ${JSON.stringify(report.counts.byElement)}`,
    `- By tier: ${JSON.stringify(report.counts.byTier)}`,
    `- By category: ${JSON.stringify(report.counts.byCategory)}`,
    `- By primary source: ${JSON.stringify(report.counts.byPrimarySource)}`,
    "",
    "## Move Rows",
    "",
    "| Move | Element | Tier | Target | Runtime | Category | Source | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const row of report.moves) {
    const runtime = `${row.runtime.sheet} r${row.runtime.row} ${row.runtime.frameCount}f`;
    const source = row.production.usesBulletProjectile ? row.production.primarySource : `${row.production.selectedPack}: ${row.production.selectedSource}`;
    lines.push(`| ${row.id} ${row.name} | ${row.element} | ${row.tier} | ${row.target} | ${runtime} | ${row.production.category} | ${source} | ${row.production.statusSource ?? ""} |`);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const manifest = readManifest();
  const report = buildReport(manifest);
  assertReport(report);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = resolve(OUTPUT_DIR, "rpg-animation-production-report.json");
  const markdownPath = resolve(OUTPUT_DIR, "rpg-animation-production-report.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, markdownReport(report));
  console.log("RPG animation production report written:");
  console.log(`- ${jsonPath}`);
  console.log(`- ${markdownPath}`);
}

main();

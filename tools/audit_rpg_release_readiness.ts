import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type ReleaseStatus = "pass" | "fail";

interface ReleaseCheck {
  name: string;
  status: ReleaseStatus;
  details: string[];
}

interface ExternalVfxPackLicense {
  displayName?: string;
  localDefault?: string;
  usedAs?: string;
  licenseStatus?: string;
  licenseReference?: {
    source?: string;
    reference?: string;
    purchaseReference?: string;
    checkedAt?: string;
    notes?: string;
  };
  proof?: {
    source?: string;
    reference?: string;
    checkedAt?: string;
  };
}

interface ExternalVfxManifest {
  schemaVersion?: number;
  assetVersion?: string;
  compositionMode?: string;
  selectionContract?: {
    runtimeComposition?: string;
    allowsPackLayering?: boolean;
    moveRowsExposeOnlySelectedSources?: boolean;
    statusRowsArePersistentOverlays?: boolean;
  };
  impactSources?: string[];
  spellSources?: string[];
  gigapackSources?: string[];
  baseImpactSources?: unknown;
  styleSources?: unknown;
  spellStyleSources?: unknown;
  gigapackStyleSources?: unknown;
  moveRows?: Array<{
    row?: number;
    spellSources?: unknown;
    gigapackSources?: unknown;
    selectedSources?: Record<string, { pack?: string; source?: string }>;
  }>;
  statusRows?: Array<{
    row?: number;
    status?: string;
    pack?: string;
    source?: string;
  }>;
  license?: {
    status?: string;
    notes?: string;
    impactPack?: ExternalVfxPackLicense;
    projectilePack?: ExternalVfxPackLicense;
    spellPack?: ExternalVfxPackLicense;
    gigapackPack?: ExternalVfxPackLicense;
    proof?: {
      source?: string;
      reference?: string;
      checkedAt?: string;
    };
  };
}

const ROOT = resolve(".");
const REQUIRED_RELEASE_SCRIPTS = [
  "assets:validate",
  "rpg:audit",
  "rpg:animation-report",
  "rpg:playtest",
  "rpg:release-audit",
  "rpg:release-check",
  "rpg:visual-review",
  "typecheck",
  "build"
] as const;
const EXTERNAL_MANIFEST_PATH = resolve(ROOT, "apps/client/public/assets/generated/rpg-external-vfx-manifest.json");
const ASSET_CREDITS_PATH = resolve(ROOT, "docs/asset-credits.md");
const PRODUCTION_PLAN_PATH = resolve(ROOT, "docs/rpg-production-plan.md");
const CLIENT_STYLES_PATH = resolve(ROOT, "apps/client/src/styles.css");
const RPG_STATUS_EFFECTS_PATH = resolve(ROOT, "apps/client/src/components/RpgStatusEffects.tsx");
const RPG_BATTLE_VFX_PATH = resolve(ROOT, "apps/client/src/components/RpgBattleVfx.tsx");
const RPG_SKILL_PREVIEW_PATH = resolve(ROOT, "apps/client/src/components/RpgSkillAnimationPreview.tsx");
const RPG_OVERLAY_PATH = resolve(ROOT, "apps/client/src/components/RpgOverlay.tsx");
const RELEASE_READY_LICENSE_STATUS = "commercial-proof-confirmed";
const RPG_ELEMENTS = ["water", "fire", "grass", "dark", "light"] as const;
const RPG_STATUSES = ["burn", "poison", "stun", "guard", "regen"] as const;
const SINGLE_SEQUENCE_SKILL_PACKS = new Set(["external-spellsfx-2", "external-super-pixel-gigapack"]);
const RPG_STATUS_SPELL_SOURCES = new Map<string, string>([
  ["burn", "Spritesheet/Flameburst.png"],
  ["stun", "Spritesheet/Thunder Charge.png"],
  ["regen", "Spritesheet/Poison Spores.png"]
]);

function pass(name: string, details: string[] = []): ReleaseCheck {
  return { name, status: "pass", details };
}

function fail(name: string, details: string[]): ReleaseCheck {
  return { name, status: "fail", details };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readText(path: string) {
  return readFileSync(path, "utf8");
}

function cssRuleBody(styles: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function cssBlockUntilNextAtRule(styles: string, marker: string) {
  const start = styles.indexOf(marker);
  if (start < 0) return "";
  const nextKeyframes = styles.indexOf("\n@keyframes", start + marker.length);
  const nextMedia = styles.indexOf("\n@media", start + marker.length);
  const endCandidates = [nextKeyframes, nextMedia].filter((index) => index > start);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : styles.length;
  return styles.slice(start, end);
}

function checkReleaseGateScripts(): ReleaseCheck {
  const packageJson = readJson<{ scripts?: Record<string, string> }>(resolve(ROOT, "package.json"));
  const scripts = packageJson.scripts ?? {};
  const missing = REQUIRED_RELEASE_SCRIPTS.filter((script) => !scripts[script]);
  return missing.length > 0
    ? fail("release gate scripts", [`Missing scripts: ${missing.join(", ")}.`])
    : pass("release gate scripts", REQUIRED_RELEASE_SCRIPTS.map((script) => `${script}: ${scripts[script]}`));
}

function checkProductionPlanReferences(): ReleaseCheck {
  const plan = readText(PRODUCTION_PLAN_PATH);
  const missing = REQUIRED_RELEASE_SCRIPTS.filter((script) => {
    if (script === "typecheck" || script === "build") {
      return !plan.includes(`pnpm ${script}`) && !plan.includes(`pnpm -r ${script}`);
    }
    return !plan.includes(`pnpm ${script}`);
  });
  if (!plan.includes("release readiness") && !plan.includes("commercial-use proof")) {
    missing.push("commercial-use proof note");
  }
  return missing.length > 0
    ? fail("production plan release coverage", [`Missing production plan references: ${missing.join(", ")}.`])
    : pass("production plan release coverage", ["Production plan names all release gates and commercial-use proof boundary."]);
}

function checkAssetCreditCoverage(manifest: ExternalVfxManifest): ReleaseCheck {
  const credits = readText(ASSET_CREDITS_PATH);
  const expectedNames = [
    manifest.license?.impactPack?.displayName,
    manifest.license?.projectilePack?.displayName,
    manifest.license?.spellPack?.displayName,
    manifest.license?.gigapackPack?.displayName
  ].filter(Boolean) as string[];
  const errors = expectedNames.filter((name) => !credits.includes(name));
  if (!credits.includes("commercial-proof-confirmed") || !credits.includes("Commercial-use reference")) {
    errors.push("commercial-use proof wording");
  }
  return errors.length > 0
    ? fail("external VFX credit coverage", [`Asset credits missing: ${errors.join(", ")}.`])
    : pass("external VFX credit coverage", expectedNames.map((name) => `${name} is documented in asset credits.`));
}

function checkPackProof(packKey: "impactPack" | "projectilePack" | "spellPack" | "gigapackPack", pack: ExternalVfxPackLicense | undefined): string[] {
  const errors: string[] = [];
  const label = pack?.displayName ?? packKey;
  if (!pack) {
    return [`Missing license.${packKey}.`];
  }
  if (!pack.licenseReference?.source || !pack.licenseReference?.reference || !pack.licenseReference?.checkedAt) {
    errors.push(`${label}: missing license reference source, URL, or checked date.`);
  }
  if (pack.licenseStatus !== RELEASE_READY_LICENSE_STATUS) {
    const purchaseHint = pack.licenseReference?.purchaseReference ? ` Purchase/reference: ${pack.licenseReference.purchaseReference}.` : "";
    errors.push(`${label}: licenseStatus is ${pack.licenseStatus ?? "missing"}, expected ${RELEASE_READY_LICENSE_STATUS}.${purchaseHint}`);
    return errors;
  }
  if (!pack.proof?.source) errors.push(`${label}: missing proof.source.`);
  if (!pack.proof?.reference) errors.push(`${label}: missing proof.reference.`);
  if (!pack.proof?.checkedAt) errors.push(`${label}: missing proof.checkedAt.`);
  return errors;
}

function checkExternalVfxReleaseLicense(manifest: ExternalVfxManifest): ReleaseCheck {
  const errors: string[] = [];
  const license = manifest.license;
  if (!license) {
    errors.push("Missing external VFX license block.");
  } else if (license.status !== RELEASE_READY_LICENSE_STATUS) {
    errors.push(
      `External VFX license status is ${license.status ?? "missing"}, expected ${RELEASE_READY_LICENSE_STATUS} before release.`
    );
  }

  if (license) {
    errors.push(...checkPackProof("impactPack", license.impactPack));
    errors.push(...checkPackProof("projectilePack", license.projectilePack));
    errors.push(...checkPackProof("spellPack", license.spellPack));
    errors.push(...checkPackProof("gigapackPack", license.gigapackPack));
  }

  if (license?.status === RELEASE_READY_LICENSE_STATUS) {
    if (!license.proof?.source) errors.push("Missing license.proof.source.");
    if (!license.proof?.reference) errors.push("Missing license.proof.reference.");
    if (!license.proof?.checkedAt) errors.push("Missing license.proof.checkedAt.");
  }

  return errors.length > 0
    ? fail("external VFX commercial-use proof", errors)
    : pass("external VFX commercial-use proof", [
        `Release proof recorded at ${license?.proof?.checkedAt}.`,
        `${license?.impactPack?.displayName} proof recorded at ${license?.impactPack?.proof?.checkedAt}.`,
        `${license?.projectilePack?.displayName} proof recorded at ${license?.projectilePack?.proof?.checkedAt}.`,
        `${license?.spellPack?.displayName} proof recorded at ${license?.spellPack?.proof?.checkedAt}.`,
        `${license?.gigapackPack?.displayName} proof recorded at ${license?.gigapackPack?.proof?.checkedAt}.`
      ]);
}

function checkSingleSequenceVfxManifest(manifest: ExternalVfxManifest): ReleaseCheck {
  const errors: string[] = [];

  if (manifest.compositionMode !== "single-sequence-per-row") {
    errors.push(`compositionMode is ${manifest.compositionMode ?? "missing"}, expected single-sequence-per-row.`);
  }
  if (manifest.selectionContract?.runtimeComposition !== "one-primary-sequence-per-skill-row") {
    errors.push("selectionContract.runtimeComposition must be one-primary-sequence-per-skill-row.");
  }
  if (manifest.selectionContract?.allowsPackLayering !== false) {
    errors.push("selectionContract.allowsPackLayering must be false.");
  }
  if (manifest.selectionContract?.moveRowsExposeOnlySelectedSources !== true) {
    errors.push("selectionContract.moveRowsExposeOnlySelectedSources must be true.");
  }
  if (manifest.selectionContract?.statusRowsArePersistentOverlays !== true) {
    errors.push("selectionContract.statusRowsArePersistentOverlays must be true.");
  }
  if ("baseImpactSources" in manifest) {
    errors.push("baseImpactSources is a legacy mixed-impact field and must not return to the RPG VFX manifest.");
  }
  if ("styleSources" in manifest) {
    errors.push("styleSources is a legacy 750/base-impact field and must not return to the RPG VFX manifest.");
  }
  if ("spellStyleSources" in manifest || "gigapackStyleSources" in manifest) {
    errors.push("Per-style candidate source maps must not be emitted in the runtime manifest; moveRows may expose only selectedSources.");
  }

  const impactSources = manifest.impactSources ?? [];
  if (!Array.isArray(impactSources) || impactSources.length === 0) {
    errors.push("impactSources must list the allowed complete SpellsFX/Gigapack source sequences.");
  } else {
    const legacySources = impactSources.filter((source) => source.includes("Free/Part") || source.includes("external-750"));
    if (legacySources.length > 0) {
      errors.push(`impactSources includes legacy 750/base impact entries: ${legacySources.slice(0, 5).join(", ")}.`);
    }
  }

  const moveRows = manifest.moveRows ?? [];
  if (!Array.isArray(moveRows) || moveRows.length !== 25) {
    errors.push(`moveRows must contain 25 skill rows, got ${Array.isArray(moveRows) ? moveRows.length : typeof moveRows}.`);
  } else {
    for (let row = 0; row < moveRows.length; row += 1) {
      if ("spellSources" in moveRows[row] || "gigapackSources" in moveRows[row]) {
        errors.push(`moveRows[${row}] must not expose candidate source arrays; it may only expose selectedSources.`);
      }
      const selectedSources = moveRows[row]?.selectedSources;
      if (!selectedSources || typeof selectedSources !== "object") {
        errors.push(`moveRows[${row}].selectedSources is missing.`);
        continue;
      }

      for (const element of RPG_ELEMENTS) {
        const selected = selectedSources[element];
        if (!selected) {
          errors.push(`moveRows[${row}].selectedSources.${element} is missing.`);
          continue;
        }
        if (!SINGLE_SEQUENCE_SKILL_PACKS.has(selected.pack ?? "")) {
          errors.push(
            `moveRows[${row}].selectedSources.${element}.pack is ${selected.pack ?? "missing"}, expected one complete SpellsFX or Gigapack sequence.`
          );
        }
        if (!selected.source) {
          errors.push(`moveRows[${row}].selectedSources.${element}.source is missing.`);
        }
      }
    }
  }

  const statusRows = manifest.statusRows ?? [];
  if (!Array.isArray(statusRows) || statusRows.length !== RPG_STATUSES.length) {
    errors.push(`statusRows must contain ${RPG_STATUSES.length} persistent status rows.`);
  } else {
    for (let row = 0; row < RPG_STATUSES.length; row += 1) {
      const statusRow = statusRows[row];
      if (statusRow?.status !== RPG_STATUSES[row]) {
        errors.push(`statusRows[${row}].status is ${statusRow?.status ?? "missing"}, expected ${RPG_STATUSES[row]}.`);
      }
      const expectedSpellSource = RPG_STATUS_SPELL_SOURCES.get(RPG_STATUSES[row]);
      const expectedPack = expectedSpellSource ? "external-spellsfx-2" : "external-super-pixel-gigapack";
      if (statusRow?.pack !== expectedPack) {
        errors.push(`statusRows[${row}].pack is ${statusRow?.pack ?? "missing"}, expected ${expectedPack}.`);
      }
      if (!statusRow?.source) {
        errors.push(`statusRows[${row}].source is missing.`);
      } else if (expectedSpellSource && statusRow.source !== expectedSpellSource) {
        errors.push(`statusRows[${row}].source is ${statusRow.source}, expected ${expectedSpellSource}.`);
      }
    }
  }

  return errors.length > 0
    ? fail("single-sequence RPG VFX manifest", errors)
    : pass("single-sequence RPG VFX manifest", [
        "25 skill rows select exactly one complete SpellsFX or Gigapack sequence per element.",
        "5 persistent status rows select one complete SpellsFX or Gigapack sequence each.",
        "Legacy 750/base impact mapping fields are absent from the runtime RPG VFX manifest."
      ]);
}

function checkRuntimeVfxUsesSpritesheets(): ReleaseCheck {
  const styles = readText(CLIENT_STYLES_PATH);
  const statusEffects = readText(RPG_STATUS_EFFECTS_PATH);
  const battleVfx = readText(RPG_BATTLE_VFX_PATH);
  const skillPreview = readText(RPG_SKILL_PREVIEW_PATH);
  const overlay = readText(RPG_OVERLAY_PATH);
  const errors: string[] = [];
  const forbiddenStyleTokens = [
    ".rpg-fx-core",
    ".rpg-fx-sweep",
    ".rpg-fx-pixel",
    "@keyframes rpg-fx-slash",
    "@keyframes rpg-fx-projectile-left",
    "@keyframes rpg-fx-projectile-right",
    "@keyframes rpg-fx-beam",
    "@keyframes rpg-fx-burst",
    "@keyframes rpg-fx-rain-fall",
    "@keyframes rpg-fx-aura",
    "@keyframes rpg-fx-wave",
    "@keyframes rpg-fx-summon",
    "@keyframes rpg-ground-impact",
    "@keyframes rpg-status-",
    ".rpg-fx-ground-impact",
    ".rpg-skill-ground-impact",
    ".rpg-status-effect::before",
    ".rpg-status-effect::after",
    ".rpg-status-effect i",
    ".rpg-battle-pet",
    ".rpg-pet-stand",
    "@keyframes rpg-actor-hop",
    "@keyframes rpg-card-hit",
    "@keyframes rpg-impact-flash"
  ];

  for (const token of forbiddenStyleTokens) {
    if (styles.includes(token)) {
      errors.push(`styles.css still contains legacy CSS-generated VFX token: ${token}`);
    }
  }
  if (!statusEffects.includes('generatedAssetPath("rpg-status-vfx")')) {
    errors.push("RpgStatusEffects must render the generated rpg-status-vfx spritesheet.");
  }
  if (statusEffects.includes("<i") || statusEffects.includes("::before") || statusEffects.includes("::after")) {
    errors.push("RpgStatusEffects must not reintroduce hand-authored particle children or pseudo-layer status VFX.");
  }
  for (const className of ["rpg-fx-primary-vfx", "rpg-fx-travel-projectile", "rpg-fx-travel-sheet", "rpg-fx-impact-sprite"]) {
    if (!battleVfx.includes(className)) {
      errors.push(`RpgBattleVfx missing spritesheet-backed runtime layer ${className}.`);
    }
  }
  for (const className of ["rpg-fx-ultimate-windup", "rpg-fx-ultimate-finish", "rpg-skill-ultimate-windup", "rpg-skill-ultimate-finish", "rpg-skill-caster-vfx", "rpg-target-impact-vfx"]) {
    if (battleVfx.includes(className) || skillPreview.includes(className) || overlay.includes(className) || styles.includes(className)) {
      errors.push(`Runtime VFX must not render extra mixed-phase layer: ${className}`);
    }
  }
  if (!battleVfx.includes("const rendersTravelSprite = travelTargets.length > 0")) {
    errors.push("RpgBattleVfx must explicitly choose travel as the only primary layer when actor-to-target travel is rendered.");
  }
  if (!battleVfx.includes("rendersSkillImpactSprite = !productionSpec.usesBulletProjectile && !rendersTravelSprite")) {
    errors.push("RpgBattleVfx must not render a second impact spritesheet when a travel spritesheet/projectile is already the primary layer.");
  }
  if (!skillPreview.includes("const showTravelVfx = productionSpec.requiresActorToTargetPath") || !skillPreview.includes("const showTargetVfx = !showTravelVfx && !usesProjectileOnly")) {
    errors.push("RpgSkillAnimationPreview must choose either travel or target VFX as the single primary sequence.");
  }
  if (!skillPreview.includes("rpg-skill-primary-vfx")) {
    errors.push("RpgSkillAnimationPreview must mark visible primary VFX layers for single-sequence auditing.");
  }
  if (battleVfx.includes("rpg-fx-core") || battleVfx.includes("rpg-fx-sweep") || battleVfx.includes("rpg-fx-pixel")) {
    errors.push("RpgBattleVfx must not render legacy CSS-generated skill VFX layers.");
  }
  if (!battleVfx.includes("data-vfx-source={productionSpec.primarySource}") || !skillPreview.includes("data-vfx-source={productionSpec.primarySource}")) {
    errors.push("Battle VFX and skill preview must expose exactly one primary VFX source.");
  }
  if (!battleVfx.includes("data-vfx-status-source={productionSpec.statusSource ??") || !skillPreview.includes("data-vfx-status-source={productionSpec.statusSource ??")) {
    errors.push("Battle VFX and skill preview must expose persistent status spritesheets separately from the primary skill source.");
  }
  if (battleVfx.includes("data-vfx-sources={productionSpec.sources.join") || skillPreview.includes("data-vfx-sources={productionSpec.sources.join")) {
    errors.push("Runtime VFX metadata must not expose comma-joined skill/status sources as one mixed source list.");
  }
  if (battleVfx.includes("rpg-fx-ground-impact") || skillPreview.includes("rpg-skill-ground-impact")) {
    errors.push("RPG runtime and skill preview must not render separate CSS-drawn ground-impact layers.");
  }
  for (const selector of [".rpg-field-pet-sprite.rpg-pet-sprite-frame", ".rpg-field-pet.has-statuses .rpg-field-pet-sprite.rpg-pet-sprite-frame"]) {
    const body = cssRuleBody(styles, selector);
    if (!body) {
      errors.push(`styles.css missing ${selector} rule for battle-field pet visual discipline.`);
      continue;
    }
    if (body.includes("drop-shadow") || !body.match(/filter:\s*none\s*;/)) {
      errors.push(`${selector} must keep field pets directly on the arena without CSS drop-shadow/glow filters.`);
    }
  }
  for (const marker of ["@keyframes rpg-field-impact-shake", "@keyframes rpg-field-impact-shake-right"]) {
    const body = cssBlockUntilNextAtRule(styles, marker);
    if (!body) {
      errors.push(`styles.css missing ${marker} for battle-field hit feedback discipline.`);
      continue;
    }
    if (body.includes("drop-shadow")) {
      errors.push(`${marker} must not add temporary CSS drop-shadows during pet hit feedback.`);
    }
  }
  for (const selector of [".rpg-field-pet::before", ".rpg-field-pet::after", ".rpg-field-pet.is-selected::after"]) {
    const body = cssRuleBody(styles, selector);
    if (!body || !body.match(/content:\s*none\s*;/)) {
      errors.push(`${selector} must keep pseudo-element rings/platforms disabled with content: none.`);
    }
  }
  if (!skillPreview.includes("usesProjectileOnly") || !skillPreview.includes("PROJECTILE_PREVIEW_FRAME_COUNT")) {
    errors.push("RpgSkillAnimationPreview must preview bullet moves with the projectile sheet instead of a second skill VFX sheet.");
  }
  if (overlay.includes("function BattlePetCard") || overlay.includes("rpg-battle-pet") || overlay.includes("rpg-pet-stand")) {
    errors.push("RpgOverlay must not keep the legacy card-style BattlePetCard path; dojo battles use BattleFieldPet only.");
  }

  return errors.length > 0
    ? fail("runtime VFX spritesheet discipline", errors)
    : pass("runtime VFX spritesheet discipline", [
        "Battle skill VFX runtime uses generated spritesheet/projectile components for visible skill layers.",
        "Persistent statuses render the generated rpg-status-vfx spritesheet without CSS particle or pseudo-effect overlays.",
        "Legacy hand-authored CSS skill VFX selectors and keyframes are absent from styles.css."
      ]);
}

function runChecks(): ReleaseCheck[] {
  const missingFiles = [
    EXTERNAL_MANIFEST_PATH,
    ASSET_CREDITS_PATH,
    PRODUCTION_PLAN_PATH,
    CLIENT_STYLES_PATH,
    RPG_STATUS_EFFECTS_PATH,
    RPG_BATTLE_VFX_PATH,
    RPG_SKILL_PREVIEW_PATH,
    RPG_OVERLAY_PATH
  ].filter((path) => !existsSync(path));
  if (missingFiles.length > 0) {
    return [fail("release readiness inputs", missingFiles.map((path) => `Missing ${path}`))];
  }

  const manifest = readJson<ExternalVfxManifest>(EXTERNAL_MANIFEST_PATH);
  return [
    checkReleaseGateScripts(),
    checkProductionPlanReferences(),
    checkAssetCreditCoverage(manifest),
    checkSingleSequenceVfxManifest(manifest),
    checkRuntimeVfxUsesSpritesheets(),
    checkExternalVfxReleaseLicense(manifest)
  ];
}

const checks = runChecks();
for (const check of checks) {
  const label = check.status === "pass" ? "PASS" : "FAIL";
  console.log(`${label} ${check.name}`);
  for (const detail of check.details) {
    console.log(`  - ${detail}`);
  }
}

const failed = checks.filter((check) => check.status === "fail");
if (failed.length > 0) {
  console.error(`\nRPG release readiness audit failed: ${failed.length} release blocker(s).`);
  process.exit(1);
}

console.log("\nRPG release readiness audit passed.");

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CLASS_ORDER, CLASS_STATS, COMBAT, type ClassId } from "../packages/shared/src/index";

type CheckStatus = "pass" | "fail";

interface ArenaAuditCheck {
  name: string;
  status: CheckStatus;
  details: string[];
}

interface DamageSource {
  classId: ClassId | "turret";
  label: string;
  damage: number;
  sourceType: "attack" | "skill" | "turret";
}

const ROOT = resolve(".");
const SINGLE_HIT_DAMAGE_LIMIT_RATIO = 0.55;
const MAGE_DAMAGE_LIMIT_RATIO = 0.35;
const MIN_CLASS_HEALTH = 140;
const MIN_BASIC_ATTACK_TTK = 6;
const MIN_BASIC_ATTACK_TTK_BY_CLASS: Partial<Record<ClassId, number>> = {
  warrior: 5
};
const CLASS_BURST_LIMIT_RATIO = 0.75;
const MAGE_FULL_ROTATION_LIMIT_RATIO = 0.75;

function pass(name: string, details: string[] = []): ArenaAuditCheck {
  return { name, status: "pass", details };
}

function fail(name: string, details: string[]): ArenaAuditCheck {
  return { name, status: "fail", details };
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function minimumClassHealth() {
  return Math.min(...CLASS_ORDER.map((classId) => CLASS_STATS[classId].maxHealth));
}

function damageSources(): DamageSource[] {
  return [
    ...CLASS_ORDER.map((classId) => ({
      classId,
      label: `${classId} basic attack`,
      damage: CLASS_STATS[classId].attackPower,
      sourceType: "attack" as const
    })),
    { classId: "warrior", label: "Warrior R Verdict", damage: COMBAT.warriorUltimateDamage, sourceType: "skill" },
    { classId: "archer", label: "Archer R Seed Rain", damage: COMBAT.archerUltimateDamage, sourceType: "skill" },
    { classId: "engineer", label: "Engineer E Repulsor Pulse", damage: COMBAT.engineerRepulsorPulseDamage, sourceType: "skill" },
    { classId: "turret", label: "Engineer turret shot", damage: COMBAT.turretShotDamage, sourceType: "turret" },
    { classId: "turret", label: "Engineer boosted turret shot", damage: COMBAT.turretBoostedDamage, sourceType: "turret" },
    { classId: "mage", label: "Mage Q Solar Beam", damage: COMBAT.mageBeamDamage, sourceType: "skill" },
    { classId: "mage", label: "Mage E Renewal Burst", damage: COMBAT.mageBurstDamage, sourceType: "skill" },
    { classId: "mage", label: "Mage R Clean Storm", damage: COMBAT.mageUltimateDamage, sourceType: "skill" }
  ];
}

function checkClassHealthAndBasicTtk(): ArenaAuditCheck {
  const errors: string[] = [];
  const minHealth = minimumClassHealth();

  if (minHealth < MIN_CLASS_HEALTH) {
    errors.push(`Minimum class HP is ${minHealth}; arena balance expects at least ${MIN_CLASS_HEALTH} HP to avoid one-shot-feeling combat.`);
  }

  for (const classId of CLASS_ORDER) {
    const stats = CLASS_STATS[classId];
    const requiredTtk = MIN_BASIC_ATTACK_TTK_BY_CLASS[classId] ?? MIN_BASIC_ATTACK_TTK;
    const ttkAgainstLowestHp = Math.ceil(minHealth / stats.attackPower);
    if (ttkAgainstLowestHp < requiredTtk) {
      errors.push(`${classId} basic attack kills the lowest-HP class in ${ttkAgainstLowestHp} hits; expected at least ${requiredTtk}.`);
    }
  }

  return errors.length > 0
    ? fail("class HP and basic attack pacing", errors)
    : pass("class HP and basic attack pacing", [
        `Minimum HP ${minHealth}.`,
        `Basic attacks require at least ${MIN_BASIC_ATTACK_TTK} hits against the lowest-HP class, except Warrior melee at ${MIN_BASIC_ATTACK_TTK_BY_CLASS.warrior}.`
      ]);
}

function checkBasicAttackSpeedOrder(): ArenaAuditCheck {
  const errors: string[] = [];
  const expectedOrder: ClassId[] = ["archer", "engineer", "warrior", "mage"];

  for (let index = 0; index < expectedOrder.length - 1; index += 1) {
    const fasterClass = expectedOrder[index];
    const slowerClass = expectedOrder[index + 1];
    const fasterCooldown = CLASS_STATS[fasterClass].attackCooldownMs;
    const slowerCooldown = CLASS_STATS[slowerClass].attackCooldownMs;
    if (fasterCooldown >= slowerCooldown) {
      errors.push(
        `${fasterClass} basic attack cooldown is ${fasterCooldown}ms and should be lower than ${slowerClass}'s ${slowerCooldown}ms cooldown.`
      );
    }
  }

  return errors.length > 0
    ? fail("basic attack speed ordering", errors)
    : pass("basic attack speed ordering", [
        `Fastest to slowest: Archer ${CLASS_STATS.archer.attackCooldownMs}ms, Engineer ${CLASS_STATS.engineer.attackCooldownMs}ms, Warrior ${CLASS_STATS.warrior.attackCooldownMs}ms, Mage ${CLASS_STATS.mage.attackCooldownMs}ms.`
      ]);
}

function checkSingleHitDamage(): ArenaAuditCheck {
  const minHealth = minimumClassHealth();
  const maxAllowedDamage = Math.floor(minHealth * SINGLE_HIT_DAMAGE_LIMIT_RATIO);
  const errors: string[] = [];

  for (const source of damageSources()) {
    const ratio = source.damage / minHealth;
    if (source.damage > maxAllowedDamage) {
      errors.push(`${source.label} deals ${source.damage}, ${percent(ratio)} of minimum HP ${minHealth}; limit is ${maxAllowedDamage}.`);
    }
  }

  return errors.length > 0
    ? fail("single-hit damage ceiling", errors)
    : pass("single-hit damage ceiling", [`All direct damage sources are <= ${maxAllowedDamage} (${percent(SINGLE_HIT_DAMAGE_LIMIT_RATIO)} of ${minHealth} HP).`]);
}

function checkMageBurstCeiling(): ArenaAuditCheck {
  const mageHealth = CLASS_STATS.mage.maxHealth;
  const minHealth = minimumClassHealth();
  const mageSources = damageSources().filter((source) => source.classId === "mage");
  const errors: string[] = [];
  const maxAllowed = Math.floor(mageHealth * MAGE_DAMAGE_LIMIT_RATIO);

  for (const source of mageSources) {
    if (source.damage > maxAllowed) {
      errors.push(`${source.label} deals ${source.damage}, above mage-specific ceiling ${maxAllowed} (${percent(MAGE_DAMAGE_LIMIT_RATIO)} of Mage HP).`);
    }
  }

  const mageNoUltimateBurst = COMBAT.mageBeamDamage + COMBAT.mageBurstDamage + CLASS_STATS.mage.attackPower;
  const mageBurstLimit = Math.floor(mageHealth * 0.45);
  if (mageNoUltimateBurst > mageBurstLimit) {
    errors.push(`Mage Q + E + basic totals ${mageNoUltimateBurst}; this should stay at or below ${mageBurstLimit} (45% of Mage HP ${mageHealth}).`);
  }

  const mageFullRotation = COMBAT.mageBeamDamage + COMBAT.mageBurstDamage + COMBAT.mageUltimateDamage + CLASS_STATS.mage.attackPower;
  const fullRotationLimit = Math.floor(minHealth * MAGE_FULL_ROTATION_LIMIT_RATIO);
  if (mageFullRotation > fullRotationLimit) {
    errors.push(
      `Mage Q + E + R + basic totals ${mageFullRotation}; this should stay at or below ${fullRotationLimit} (${percent(
        MAGE_FULL_ROTATION_LIMIT_RATIO
      )} of minimum HP ${minHealth}).`
    );
  }

  return errors.length > 0
    ? fail("mage burst ceiling", errors)
    : pass("mage burst ceiling", [
        `Mage max single hit ${Math.max(...mageSources.map((source) => source.damage))}/${mageHealth}.`,
        `Mage Q + E + basic totals ${mageNoUltimateBurst}/${mageHealth}.`,
        `Mage full rotation plus basic totals ${mageFullRotation}/${minHealth} minimum HP.`
      ]);
}

function checkClassBurstComboCeilings(): ArenaAuditCheck {
  const minHealth = minimumClassHealth();
  const maxAllowed = Math.floor(minHealth * CLASS_BURST_LIMIT_RATIO);
  const combos = [
    {
      label: "Warrior R + basic",
      total: COMBAT.warriorUltimateDamage + CLASS_STATS.warrior.attackPower
    },
    {
      label: "Archer R + basic",
      total: COMBAT.archerUltimateDamage + CLASS_STATS.archer.attackPower
    },
    {
      label: "Engineer E + basic + two boosted turret shots",
      total: COMBAT.engineerRepulsorPulseDamage + CLASS_STATS.engineer.attackPower + COMBAT.turretBoostedDamage * 2
    },
    {
      label: "Mage Q + E + R + basic",
      total: COMBAT.mageBeamDamage + COMBAT.mageBurstDamage + COMBAT.mageUltimateDamage + CLASS_STATS.mage.attackPower
    }
  ];
  const errors = combos
    .filter((combo) => combo.total > maxAllowed)
    .map((combo) => `${combo.label} totals ${combo.total}, above burst ceiling ${maxAllowed} (${percent(CLASS_BURST_LIMIT_RATIO)} of minimum HP ${minHealth}).`);

  return errors.length > 0
    ? fail("class burst combo ceilings", errors)
    : pass("class burst combo ceilings", [`Representative burst combos stay <= ${maxAllowed}/${minHealth} minimum HP.`]);
}

function checkActionStackingContract(): ArenaAuditCheck {
  const serverSource = readFileSync(resolve(ROOT, "apps/server/src/game/GameRoom.ts"), "utf8");
  const errors: string[] = [];

  if (!serverSource.includes("const skillUsed = !player.stunned ? this.handleSkills(player, now) : false")) {
    errors.push("Player update must track whether a skill was used this tick.");
  }
  if (!serverSource.includes("if (!skillUsed && !player.stunned && player.input.attack)")) {
    errors.push("Basic attacks must not fire on the same tick as a skill.");
  }
  if (!serverSource.includes('const requestedSkills: SkillKey[] = ["skillR", "skillE", "skillQ"]')) {
    errors.push("Skill handling must choose one requested skill per tick instead of independently firing Q, E and R.");
  }
  if (!serverSource.includes("if (attacker.actionPoseEndsAt > now)")) {
    errors.push("Basic attack handling must respect the current action pose lockout.");
  }

  return errors.length > 0
    ? fail("action stacking contract", errors)
    : pass("action stacking contract", ["A player can resolve only one skill or attack per action window, preventing same-tick mage burst stacking."]);
}

function checkTurretRotationContract(): ArenaAuditCheck {
  const serverSource = readFileSync(resolve(ROOT, "apps/server/src/game/GameRoom.ts"), "utf8");
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const errors: string[] = [];

  if (!serverSource.includes("turret.angle = angleTo(turret, target)")) {
    errors.push("Server turret update must set turret.angle from the selected target before firing.");
  }
  if (!serverSource.includes("angle: turret.angle")) {
    errors.push("Turret projectile spawn must use turret.angle so the projectile matches the rotated barrel.");
  }
  if (!clientSource.includes("view.visualAngle = this.interpolateAngle(view.visualAngle, turret.angle")) {
    errors.push("Client turret view must interpolate toward turret.angle instead of snapping or staying static.");
  }
  if (!clientSource.includes("turret.boosted ? 0.94 : 0.84")) {
    errors.push("Client turret head interpolation must stay fast enough to read as responsive target tracking.");
  }
  if (!clientSource.includes(".setAngle(view.visualAngle)")) {
    errors.push("Client turret head must render with view.visualAngle.");
  }

  return errors.length > 0
    ? fail("turret rotation contract", errors)
    : pass("turret rotation contract", ["Server targets update turret.angle; client head rapidly interpolates and renders that angle."]);
}

function checkClientAimPersistenceContract(): ArenaAuditCheck {
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const errors: string[] = [];

  if (!clientSource.includes("private lastArenaAimPoint: { x: number; y: number } | null = null")) {
    errors.push("Client scene must keep the last valid arena aim point so HUD button presses do not steal the target direction.");
  }
  if (!clientSource.includes("private pointerOverArenaCanvas = false") || !clientSource.includes("private readonly updatePointerArenaTarget = (event: PointerEvent)")) {
    errors.push("Client scene must track the real document-level pointer target instead of trusting Phaser's potentially stale pointer event.");
  }
  if (!clientSource.includes('window.addEventListener("pointermove", this.updatePointerArenaTarget, true)') || !clientSource.includes('window.addEventListener("pointerdown", this.updatePointerArenaTarget, true)')) {
    errors.push("Client scene must listen in capture phase so HUD stopPropagation cannot block pointer target tracking.");
  }
  if (!clientSource.includes('window.removeEventListener("pointermove", this.updatePointerArenaTarget, true)') || !clientSource.includes('window.removeEventListener("pointerdown", this.updatePointerArenaTarget, true)')) {
    errors.push("Client scene must remove document pointer listeners on shutdown.");
  }
  if (!clientSource.includes("private getPointerAimPoint()") || !clientSource.includes("this.isArenaPointerTarget(pointer)")) {
    errors.push("Client input must derive aim through getPointerAimPoint and only refresh it from real arena pointer events.");
  }
  if (!clientSource.includes("if (!this.pointerOverArenaCanvas)")) {
    errors.push("Client input must refuse aim refreshes while the document pointer is over HUD or any non-canvas element.");
  }
  if (!clientSource.includes("const canvasRect = this.game.canvas.getBoundingClientRect()") || !clientSource.includes("const clientX = canvasRect.left + pointer.x") || !clientSource.includes("const clientY = canvasRect.top + pointer.y")) {
    errors.push("Arena pointer detection must derive current viewport coordinates from the canvas rect and Phaser pointer position.");
  }
  if (!clientSource.includes("document.elementFromPoint(clientX, clientY) === this.game.canvas")) {
    errors.push("Arena pointer detection must use elementFromPoint at the current pointer coordinates so DOM HUD buttons cannot be mistaken for canvas aim updates.");
  }
  if (!clientSource.includes("return target === this.game.canvas")) {
    errors.push("Arena pointer detection should still fall back to direct canvas target checks when client coordinates are unavailable.");
  }
  if (!clientSource.includes("this.publishArenaDebugInput(input)")) {
    errors.push("Debug arena mode should expose the last submitted input so browser playtests can verify actual aim payloads.");
  }

  return errors.length > 0
    ? fail("client aim persistence contract", errors)
    : pass("client aim persistence contract", ["Client aim uses the last valid canvas aim point, so HUD interactions cannot redirect attacks or skills."]);
}

function checkTurretGroundingContract(): ArenaAuditCheck {
  const sceneSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const runtimeTextureSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/runtimeTextures.ts"), "utf8");
  const objectPipelineSource = readFileSync(resolve(ROOT, "tools/repair_combat_objects.py"), "utf8");
  const vfxSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/vfxManifest.ts"), "utf8");
  const errors: string[] = [];

  if (!objectPipelineSource.includes('SOURCE_DIR = ROOT / "tools" / "assets" / "generated-sources" / "source"')) {
    errors.push("Turret source art must stay outside public/dist under tools/assets/generated-sources/source.");
  }
  if (!objectPipelineSource.includes('TURRET_BASE_SOURCE = SOURCE_DIR / "turret-base-alpha-v2.png"')) {
    errors.push("Turret base must come from a complete standalone base source, not a hard crop from the combined turret.");
  }
  if (!objectPipelineSource.includes('TURRET_HEAD_SOURCE = SOURCE_DIR / "turret-head-alpha-v2.png"')) {
    errors.push("Turret head must come from a complete standalone head source, not a hard crop from the combined turret.");
  }
  if (!runtimeTextureSource.includes("function shouldTrimCombatObjectTexture(key: string)") || !runtimeTextureSource.includes("return true;")) {
    errors.push("Combat object runtime textures should be alpha-trimmed, including turrets, so transparent cells do not distort scale and pivots.");
  }
  if (!runtimeTextureSource.includes('if (key === "turretBase")') || !runtimeTextureSource.includes('if (key === "turretHead" || key === "turretHeadFiring" || key === "turretHeadBoosted")')) {
    errors.push("Turret base/head runtime trimming needs separate padding rules.");
  }
  if (!sceneSource.includes("const TURRET_BASE_Y = 31") || !sceneSource.includes("const TURRET_SHADOW_Y = 29")) {
    errors.push("Turret base and shadow must stay close together so the turret reads as grounded.");
  }
  if (!sceneSource.includes("const TURRET_BASE_WIDTH = 96") || !sceneSource.includes("const TURRET_BASE_HEIGHT = 64")) {
    errors.push("Turret base should use its own grounded oval dimensions instead of square scaling.");
  }
  if (!sceneSource.includes("const TURRET_HEAD_WIDTH = 92") || !sceneSource.includes("const TURRET_HEAD_HEIGHT = 61")) {
    errors.push("Turret head should use its own barrel dimensions instead of square scaling.");
  }
  if (!sceneSource.includes(".setOrigin(0.5, 0.62)") || !sceneSource.includes(".setDisplaySize(TURRET_HEAD_WIDTH, TURRET_HEAD_HEIGHT)")) {
    errors.push("Turret head pivot and display size should keep the barrel seated in the base while rotating.");
  }
  if (!sceneSource.includes("const TURRET_HEALTH_WIDTH = 38")) {
    errors.push("Turret health width should use the shared compact constant instead of a larger hard-coded bar.");
  }
  if (!vfxSource.includes("Math.max(132, effect.radius * 1.62)") || !vfxSource.includes("Math.max(94, effect.radius * 1.08)") || !vfxSource.includes("alpha: 0.68")) {
    errors.push("Turret deploy VFX should stay compact and translucent; the previous large bright disk made turrets look like they floated.");
  }

  return errors.length > 0
    ? fail("turret grounding contract", errors)
    : pass("turret grounding contract", ["Turret uses standalone base/head sources, alpha-trimmed runtime textures, separated display dimensions, and compact deploy VFX."]);
}

function checkBasicAttackVfxContract(): ArenaAuditCheck {
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/vfxManifest.ts"), "utf8");
  const errors: string[] = [];

  if (!clientSource.includes('if (effect.classId === "engineer")') || !clientSource.includes("return ABILITY_VFX.engineerStrike")) {
    errors.push("Engineer basic attack must render the engineerStrike spritesheet instead of only playing the character pose.");
  }
  if (!clientSource.includes('if (effect.classId === "warrior")') || !clientSource.includes("return null")) {
    errors.push("Warrior basic attack should keep using the character-bound slash pass without adding a duplicate world attack_arc layer.");
  }

  return errors.length > 0
    ? fail("basic attack VFX contract", errors)
    : pass("basic attack VFX contract", ["Engineer attack_arc renders engineerStrike; Warrior avoids a duplicate world slash layer."]);
}

function checkWarriorDirectionalMeleeAndTurretDeathContract(): ArenaAuditCheck {
  const serverSource = readFileSync(resolve(ROOT, "apps/server/src/game/GameRoom.ts"), "utf8");
  const sharedTypes = readFileSync(resolve(ROOT, "packages/shared/src/types.ts"), "utf8");
  const vfxSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/vfxManifest.ts"), "utf8");
  const warriorFxSource = readFileSync(resolve(ROOT, "apps/client/src/game/render/warriorActionFx.ts"), "utf8");
  const sceneSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const cropsSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/crops.ts"), "utf8");
  const runtimeTextureSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/runtimeTextures.ts"), "utf8");
  const errors: string[] = [];

  if (!serverSource.includes("private isInMeleeArc(attacker: PlayerEntity") || !serverSource.includes("angleDiff(attacker.angle, angleTo(attacker, target)) <= 68")) {
    errors.push("Melee attacks should use a forward-facing arc from the current aim angle, not a full circular hit radius.");
  }
  if (!serverSource.includes("this.isInMeleeArc(attacker, target)") || !serverSource.includes("this.isInMeleeArc(attacker, turret)")) {
    errors.push("Player and turret melee hits should both respect the aimed melee arc.");
  }
  if (!sharedTypes.includes('| "turret_death"') || !serverSource.includes('type: "turret_death"') || !vfxSource.includes('effect.type === "turret_death"')) {
    errors.push("Destroyed turrets should emit and render a turret_death effect instead of disappearing silently.");
  }
  if (!serverSource.includes("this.damageTurret(turret, stats.attackPower, attacker.id, now)") || !serverSource.includes("this.damageTurret(turret, projectile.damage, projectile.ownerId, now)")) {
    errors.push("Turret damage from melee and projectiles should go through damageTurret so death VFX is centralized.");
  }
  if (!warriorFxSource.includes("x: 44") || !warriorFxSource.includes("width: 158 + pulse * 24")) {
    errors.push("Warrior character-bound slash should stay close to the sprite instead of extending as a detached world slash.");
  }
  if (
    !warriorFxSource.includes('function getWarriorVerticalMeleeFxProfile(direction: "down" | "up", progress: number)') ||
    !warriorFxSource.includes('source: "verticalSlash"') ||
    !warriorFxSource.includes("y: -92") ||
    !warriorFxSource.includes("selectVerticalSlashFrame(strikeWindow)") ||
    !sceneSource.includes('this.load.image("warriorVerticalSlash"') ||
    !sceneSource.includes("getWarriorVerticalSlashFrameTexture(profile.verticalDirection, profile.frame)") ||
    !cropsSource.includes("WARRIOR_VERTICAL_SLASH_FRAME_COUNT = 6") ||
    !runtimeTextureSource.includes('"warriorVerticalSlash"')
  ) {
    errors.push("Warrior up/down melee slash VFX should use the centered warrior-vertical-slash sheet instead of rotating the raw side-slash cells at runtime.");
  }
  if (
    !cropsSource.includes("WARRIOR_VERDICT_VFX_FRAME_COUNT = 7") ||
    !runtimeTextureSource.includes('"warriorVerdictCombatFx"') ||
    !vfxSource.includes('source: "warriorVerdict"') ||
    !vfxSource.includes("return WARRIOR_VERDICT_VFX.combatFx")
  ) {
    errors.push("Warrior R should use the standalone Combat FX verdict impact sequence instead of the old vertical pillar VFX.");
  }

  return errors.length > 0
    ? fail("warrior aimed slash and turret death contract", errors)
    : pass("warrior aimed slash and turret death contract", [
        "Warrior melee follows the aim arc, Verdict uses a dedicated combat impact sequence, and destroyed turrets emit a visible death effect."
      ]);
}

function checkProjectileReadabilityContract(): ArenaAuditCheck {
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const errors: string[] = [];

  if (!clientSource.includes('this.load.image("rpgSkillProjectiles", generatedAssetPath("rpg-skill-projectiles"))')) {
    errors.push("Arena scene must preload the RPG projectile sheet used by the Archer projectile.");
  }
  if (!clientSource.includes('return getRpgSkillProjectileFrameTexture("grass", frame)')) {
    errors.push("Archer projectile body must use the grass row from rpg-skill-projectiles instead of the thin Combat FX arrow row.");
  }
  if (!clientSource.includes("% RPG_SKILL_PROJECTILE_FRAME_COUNT")) {
    errors.push("Archer projectile animation must stay tied to the 10-frame RPG projectile row.");
  }
  if (!clientSource.includes("return [136, 58]")) {
    errors.push("Archer projectile body must keep a thick enough display size to read as a projectile in normal gameplay.");
  }
  if (!clientSource.includes("private shouldRenderProjectileTrail(projectile: ProjectileState)") || !clientSource.includes('return projectile.type !== "arrow" && projectile.type !== "magic_ball";')) {
    errors.push("Archer and Mage basic projectiles must not render the extra trail layer that caused the stray vertical-line artifact.");
  }
  if (!clientSource.includes("return 0.94 + launchScale * 0.06")) {
    errors.push("Archer projectile body alpha must stay nearly opaque for runtime readability.");
  }

  return errors.length > 0
    ? fail("projectile readability contract", errors)
    : pass("projectile readability contract", ["Archer and Mage basic projectiles render readable bodies without the separate trail layer that created stray lines."]);
}

function checkMageSkillVfxPresenceContract(): ArenaAuditCheck {
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/vfxManifest.ts"), "utf8");
  const serverSource = readFileSync(resolve(ROOT, "apps/server/src/game/GameRoom.ts"), "utf8");
  const renewalMatch = clientSource.match(/renewalBurst:\s*\{[\s\S]*?\n\s*\},\n\s*cleanStorm:/);
  const cleanStormMatch = clientSource.match(/cleanStorm:\s*\{[\s\S]*?\n\s*\}/);
  const errors: string[] = [];

  if (!renewalMatch) {
    errors.push("Mage Renewal Burst VFX spec must exist before Clean Storm in the mage VFX manifest.");
  } else {
    const spec = renewalMatch[0];
    if (!spec.includes('source: "mage"') || !spec.includes('key: "renewalBurst"')) {
      errors.push("Mage Renewal Burst must render the dedicated mage-effects renewalBurst row.");
    }
    if (!spec.includes("width: effect.radius * 2") || !spec.includes("height: effect.radius * 2") || !spec.includes("alpha: 0.96")) {
      errors.push("Mage Renewal Burst display must match the gameplay radius diameter and stay opaque enough to read.");
    }
  }
  if (!cleanStormMatch) {
    errors.push("Mage Clean Storm VFX spec must exist in the mage VFX manifest.");
  } else {
    const spec = cleanStormMatch[0];
    if (!spec.includes('source: "mage"') || !spec.includes('key: "cleanStorm"')) {
      errors.push("Mage Clean Storm must render the dedicated mage-effects cleanStorm row.");
    }
    if (spec.includes('blendMode: "add"')) {
      errors.push("Mage Clean Storm must not use additive blending; it turns the vortex sequence into a white splatter in-game.");
    }
    if (!spec.includes("width: effect.radius * 2") || !spec.includes("height: effect.radius * 2") || !spec.includes("alpha: 0.96")) {
      errors.push("Mage Clean Storm display must match the gameplay radius diameter and stay opaque enough to read as a real ultimate.");
    }
  }
  if (!serverSource.includes("const center = this.getAimPoint(player)") || !serverSource.includes('this.addEffectAt("burst", player, center, angleTo(player, center), COMBAT.mageBurstRadius, 1150)')) {
    errors.push("Mage Renewal Burst must spawn at the cursor aim point with the full 1150ms readable duration.");
  }
  if (
    !serverSource.includes('const ultimateDuration = player.classId === "mage" ? 1650 : player.classId === "archer" ? 2100 : 1250') ||
    !serverSource.includes('const center = player.classId === "mage" || player.classId === "archer" ? this.getAimPoint(player) : player') ||
    !serverSource.includes('this.addEffectAt("ultimate", player, center, angleTo(player, center), skill.radius, ultimateDuration)')
  ) {
    errors.push("Mage Clean Storm should use the cursor aim point with a longer 1650ms effect duration, while Archer Seed Rain stays cursor-centered for a readable 2100ms.");
  }

  return errors.length > 0
    ? fail("mage skill VFX presence contract", errors)
    : pass("mage skill VFX presence contract", ["Mage E/R use dedicated rows, cursor-centered server effects, and radius-matched readable displays; Archer R shares the cursor-centered area rule."]);
}

function checkSkillTooltipContract(): ArenaAuditCheck {
  const sharedSource = readFileSync(resolve(ROOT, "packages/shared/src/balance.ts"), "utf8");
  const appSource = readFileSync(resolve(ROOT, "apps/client/src/App.tsx"), "utf8");
  const i18nSource = readFileSync(resolve(ROOT, "apps/client/src/i18n/arena.tsx"), "utf8");
  const cssSource = readFileSync(resolve(ROOT, "apps/client/src/styles.css"), "utf8");
  const errors: string[] = [];
  const skillButtonStart = appSource.indexOf("function SkillButton");
  const skillButtonEnd = appSource.indexOf("function getSkillIconStyle");
  const skillButtonSource = skillButtonStart >= 0 && skillButtonEnd > skillButtonStart ? appSource.slice(skillButtonStart, skillButtonEnd) : "";

  if (!sharedSource.includes("export const ACTION_TOOLTIPS") || !sharedSource.includes("Renewal Burst detonates at the cursor") || !sharedSource.includes("Release a close repulsor pulse")) {
    errors.push("Skill tooltip descriptions must live in shared balance data with real gameplay wording.");
  }
  if (!appSource.includes("t.tooltips") || !appSource.includes('className="skill-tooltip"') || !skillButtonSource || skillButtonSource.includes("title={title}")) {
    errors.push("Skill buttons must render localized custom tooltip content and avoid the native browser title tooltip.");
  }
  if (
    !i18nSource.includes("Release a close repulsor pulse that damages and knocks rivals away.") ||
    !i18nSource.includes("Detonate Renewal Burst at the cursor") ||
    !i18nSource.includes("釋放近身斥力脈衝") ||
    !i18nSource.includes("在滑鼠位置引爆復甦能量") ||
    !i18nSource.includes("근거리 반발 파동")
  ) {
    errors.push("Skill tooltips must be available in English, Traditional Chinese, and Korean.");
  }
  if (!cssSource.includes(".skill-button:hover .skill-tooltip") || !cssSource.includes("transition-delay: 1s")) {
    errors.push("Skill tooltip should appear after a deliberate 1 second hover/focus delay.");
  }

  return errors.length > 0
    ? fail("skill tooltip contract", errors)
    : pass("skill tooltip contract", ["Skill buttons show shared gameplay descriptions after a 1 second hover/focus delay."]);
}

function checkDeathClassSwitchContract(): ArenaAuditCheck {
  const sharedSource = readFileSync(resolve(ROOT, "packages/shared/src/types.ts"), "utf8");
  const serverIndexSource = readFileSync(resolve(ROOT, "apps/server/src/index.ts"), "utf8");
  const roomSource = readFileSync(resolve(ROOT, "apps/server/src/game/GameRoom.ts"), "utf8");
  const socketSource = readFileSync(resolve(ROOT, "apps/client/src/game/network/GameSocket.ts"), "utf8");
  const storeSource = readFileSync(resolve(ROOT, "apps/client/src/state/hudStore.ts"), "utf8");
  const sceneSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const overlaySource = readFileSync(resolve(ROOT, "apps/client/src/components/DeathOverlay.tsx"), "utf8");
  const cssSource = readFileSync(resolve(ROOT, "apps/client/src/styles.css"), "utf8");
  const errors: string[] = [];

  if (!sharedSource.includes("export interface ClassSwitchRequest")) {
    errors.push("Shared types should expose ClassSwitchRequest for the socket class-change payload.");
  }
  if (!serverIndexSource.includes('socket.on("switch_class"') || !serverIndexSource.includes("switchHumanClass(socket.id, request.classId)")) {
    errors.push("Server socket layer must accept switch_class and route it through GameRoom.switchHumanClass.");
  }
  if (!roomSource.includes("switchHumanClass(socketId: string, classId: ClassId)") || !roomSource.includes('if (player.alive && this.roundPhase === "playing")') || !roomSource.includes("player.maxHealth = stats.maxHealth")) {
    errors.push("GameRoom must reject alive in-round class switching and apply new class stats for dead respawn.");
  }
  if (!socketSource.includes("switchClass(classId: ClassId)") || !socketSource.includes('this.socket?.emit("switch_class", { classId })')) {
    errors.push("Client socket wrapper must expose switchClass and emit switch_class.");
  }
  if (!storeSource.includes("classSwitchRequest") || !storeSource.includes("requestClassSwitch")) {
    errors.push("HUD store must carry class-switch requests from DOM UI to the Phaser scene.");
  }
  if (!sceneSource.includes("state.classSwitchRequest") || !sceneSource.includes("this.socket?.switchClass(state.classSwitchRequest.classId)")) {
    errors.push("Phaser scene must forward HUD class-switch requests through the live game socket.");
  }
  if (!overlaySource.includes("death-class-grid") || !overlaySource.includes("requestClassSwitch(classId)") || !overlaySource.includes("CLASS_ORDER.map")) {
    errors.push("Death overlay must show the class selector and dispatch selected classes.");
  }
  if (!cssSource.includes(".death-class-card") || !cssSource.includes("pointer-events: auto")) {
    errors.push("Death class selector needs clickable pixel-card styling.");
  }

  return errors.length > 0
    ? fail("death class switch contract", errors)
    : pass("death class switch contract", ["Knocked-out players can choose a new class through server-authoritative class switching before respawn."]);
}

function checkPixelHudSkinContract(): ArenaAuditCheck {
  const cssSource = readFileSync(resolve(ROOT, "apps/client/src/styles.css"), "utf8");
  const appSource = readFileSync(resolve(ROOT, "apps/client/src/App.tsx"), "utf8");
  const indexSource = readFileSync(resolve(ROOT, "apps/client/index.html"), "utf8");
  const errors: string[] = [];

  if (!cssSource.includes("/* Pixel HUD pass: hard edges, warm wood surfaces, and pressable RPG panel depth. */")) {
    errors.push("Arena HUD should keep an explicit warm wood pixel skin section instead of isolated one-off panel styles.");
  }
  for (const selector of [".round-rewards", ".event-feed", ".leaderboard", ".skill-bar", ".round-hud", ".death-overlay", ".start-panel"]) {
    if (!cssSource.includes(selector)) {
      errors.push(`Pixel HUD skin should include ${selector}.`);
    }
  }
  if (appSource.includes('className="player-panel"')) {
    errors.push("Main gameplay HUD should not render the old self player panel; the top-left slot belongs to Round Rewards only.");
  }
  if (!appSource.includes("<RoundRewards round={snapshot.round} />")) {
    errors.push("Main gameplay HUD should render RoundRewards with round state only, not a time-driven rotating reward panel.");
  }
  const pixelPassStart = cssSource.indexOf("/* Pixel HUD pass");
  const startPanelEnd = cssSource.indexOf("@media (max-width: 760px)");
  const pixelPass = pixelPassStart >= 0 && startPanelEnd > pixelPassStart ? cssSource.slice(pixelPassStart, startPanelEnd) : "";
  const panelSurfacePass = pixelPass.replace(/\.health-frame span,[\s\S]*?\.round-meter i \{[\s\S]*?\n\}/, "");
  if (panelSurfacePass.includes("repeating-linear-gradient(0deg") || panelSurfacePass.includes("repeating-linear-gradient(90deg")) {
    errors.push("Pixel HUD and start-panel skin should not use visible grid or stripe repeating gradients.");
  }
  if (!cssSource.includes("image-rendering: pixelated")) {
    errors.push("Pixel HUD skin should keep pixelated rendering hints.");
  }
  if (!cssSource.includes(".start-copy") || !cssSource.includes(".class-stage") || !cssSource.includes(".class-command")) {
    errors.push("Start/class selection UI should share the pixel panel treatment with in-game HUD.");
  }
  const appUsesVinciFavicon =
    appSource.includes('src="/assets/generated/vinci-favicon.png"') ||
    appSource.includes('staticAssetUrl("/assets/generated/vinci-favicon.png")');
  const loginUsesVinciFavicon =
    indexSource.includes('/assets/generated/vinci-favicon.png') ||
    indexSource.includes('staticAssetUrl("/assets/generated/vinci-favicon.png")');
  if (!appUsesVinciFavicon || !loginUsesVinciFavicon) {
    errors.push("Start panel brand mark and login favicon should use the Vinci World favicon asset through the static asset helper.");
  }
  if (!cssSource.includes("@media (min-width: 761px) and (max-width: 1120px)") || !cssSource.includes("grid-template-columns: minmax(230px, 0.82fr)")) {
    errors.push("Desktop/tablet-width start panel should stay as a multi-column game menu instead of collapsing into a tall scrollable panel.");
  }

  return errors.length > 0
    ? fail("pixel HUD skin contract", errors)
    : pass("pixel HUD skin contract", ["Core HUD, round rewards, death screen, hotbar, and start/class panels use warm wood pixel RPG surfaces without visible grid stripes."]);
}

function checkEngineerRepulsorPulseVfxContract(): ArenaAuditCheck {
  const superPixelImporterSource = readFileSync(resolve(ROOT, "tools/import_super_pixel_arena_vfx_pack.py"), "utf8");
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/vfxManifest.ts"), "utf8");
  const runtimeTextureSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/runtimeTextures.ts"), "utf8");
  const iconSource = readFileSync(resolve(ROOT, "tools/generate_skill_icons.py"), "utf8");
  const sharedSource = readFileSync(resolve(ROOT, "packages/shared/src/balance.ts"), "utf8");
  const serverSource = readFileSync(resolve(ROOT, "apps/server/src/game/GameRoom.ts"), "utf8");
  const errors: string[] = [];
  const acceptedSource = "Impacts/symmetrical_impact_002/symmetrical_impact_002_large_blue";
  const repulsorMatch = clientSource.match(/repulsorPulse:\s*\{[\s\S]*?\n\s*\},\n\s*overclock:/);

  if (!superPixelImporterSource.includes(acceptedSource) || !superPixelImporterSource.includes('"engineer-effects.png"') || !superPixelImporterSource.includes("        1,")) {
    errors.push("Engineer E VFX must import the accepted Super Pixel blue impact pulse sequence into engineer-effects row 1.");
  }
  if (!sharedSource.includes('skillE: "Repulsor Pulse"')) {
    errors.push("Engineer E player-facing label must be Repulsor Pulse, not Solar Gun.");
  }
  if (!serverSource.includes('this.addEffect("repulsor_pulse"')) {
    errors.push("Engineer E server effect type should be repulsor_pulse so the runtime name matches the knockback behavior.");
  }
  if (!iconSource.includes(acceptedSource) || iconSource.includes("scifi_muzzle_flash_001_large_yellow")) {
    errors.push("Engineer E icon must use the accepted blue impact pulse source, not the old yellow muzzle flash.");
  }
  if (!repulsorMatch) {
    errors.push("Engineer E repulsorPulse VFX spec must exist before the overclock spec.");
  } else {
    const spec = repulsorMatch[0];
    if (!spec.includes('layer: "ground"')) {
      errors.push("Engineer E VFX must render as a centered ground pulse, not as an airborne beam.");
    }
    if (spec.includes("rotated: true") || spec.includes("beamSnap") || spec.includes("beamExtension")) {
      errors.push("Engineer E VFX must not use rotated beam playback or beam extension scaling.");
    }
    if (spec.includes('blendMode: "add"')) {
      errors.push("Engineer E VFX should not use additive blending; the impact pulse becomes a large white flash.");
    }
    if (!spec.includes("scaleCurve: repulsorPulseScale")) {
      errors.push("Engineer E VFX should use the repulsorPulse scale curve so it reads as an outward shove.");
    }
    if (!spec.includes("width: effect.radius * 2") || !spec.includes("height: effect.radius * 2") || !spec.includes("alpha: 0.72")) {
      errors.push("Engineer E VFX display should match the actual knockback radius while staying translucent enough not to hide the character or map.");
    }
  }
  if (!runtimeTextureSource.includes('if (key === "repulsorPulse")') || !runtimeTextureSource.includes("return { top: 10, right: 10, bottom: 10, left: 10 };")) {
    errors.push("Engineer E VFX runtime trim padding should stay symmetric so the centered pulse is not offset or clipped.");
  }

  return errors.length > 0
    ? fail("engineer repulsor pulse VFX contract", errors)
    : pass("engineer repulsor pulse VFX contract", ["Engineer E keeps its knockback gameplay and presents as Repulsor Pulse with a matching blue impact-pulse icon and VFX."]);
}

function checkArcherSeedRainVfxContract(): ArenaAuditCheck {
  const superPixelImporterSource = readFileSync(resolve(ROOT, "tools/import_super_pixel_arena_vfx_pack.py"), "utf8");
  const effectImporterSource = readFileSync(resolve(ROOT, "tools/import_effect_fx_arena_vfx_pack.py"), "utf8");
  const packageSource = readFileSync(resolve(ROOT, "package.json"), "utf8");
  const iconSource = readFileSync(resolve(ROOT, "tools/generate_skill_icons.py"), "utf8");
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/vfxManifest.ts"), "utf8");
  const errors: string[] = [];
  const acceptedSource = "Splatters/burst_splatter_003/burst_splatter_003_large_green";
  const rejectedEffectFxSource = "Free/Part 15/700.png";
  const rejectedPoisonDome = "Fantasy Spells/spell_poison_001/spell_poison_001_large_green";

  if (!superPixelImporterSource.includes(acceptedSource) || !superPixelImporterSource.includes('"warrior-archer-effects.png"')) {
    errors.push("Archer Seed Rain arena row must import the accepted Super Pixel green burst sequence into warrior-archer-effects.");
  }
  if (!packageSource.includes("import_effect_fx_arena_vfx_pack.py")) {
    errors.push("The full arena VFX pipeline must still run the Effect/FX arena importer as a no-op so pack order stays explicit.");
  }
  if (!iconSource.includes(acceptedSource)) {
    errors.push("Archer Seed Rain icon must match the accepted Super Pixel green burst sequence.");
  }
  if (
    effectImporterSource.includes(rejectedEffectFxSource) ||
    iconSource.includes(rejectedEffectFxSource) ||
    effectImporterSource.includes("round_sparkle_burst_002") ||
    iconSource.includes("round_sparkle_burst_002") ||
    effectImporterSource.includes(rejectedPoisonDome)
  ) {
    errors.push("Archer Seed Rain must not use the rejected Effect/FX seed-diamond, bubble/sparkle, or poison-dome sequences.");
  }
  if (!clientSource.includes("width: effect.radius * 2") || !clientSource.includes("height: effect.radius * 2") || !clientSource.includes("alpha: 0.94")) {
    errors.push("Archer Seed Rain display should match the actual area radius and keep readable ground-impact opacity.");
  }

  return errors.length > 0
    ? fail("archer seed rain VFX contract", errors)
    : pass("archer seed rain VFX contract", ["Seed Rain uses one complete Super Pixel green burst sequence with a readable ground-impact display."]);
}

function checkGroundedMovementContract(): ArenaAuditCheck {
  const clientSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const errors: string[] = [];

  if (!clientSource.includes("const PLAYER_SPRITE_ORIGIN_Y = 0.9")) {
    errors.push("Player sprite origin should stay near the feet so scaling and leaning do not make characters float.");
  }
  if (!clientSource.includes(".setOrigin(0.5, PLAYER_SPRITE_ORIGIN_Y)")) {
    errors.push("Player sprite, action ghost, and movement trails should use the shared foot-origin constant.");
  }
  if (!clientSource.includes("const MOVEMENT_VISUAL_GRACE_MS = 92")) {
    errors.push("Movement visuals should use a short grace window instead of letting interpolation tailing read as sliding walk animation.");
  }
  if (!clientSource.includes("let moving = player.alive && (movedDistance > 0.28 || player.sprinting)")) {
    errors.push("Walk animation should be driven by real server movement or sprint input, not visual interpolation catch-up.");
  }
  if (!clientSource.includes("const walkPress = footPlant * 1.8")) {
    errors.push("Walking pose should press slightly into the ground instead of bobbing upward.");
  }
  if (!clientSource.includes("const backStepSway = moving && !player.action && facingDirection === \"up\"")) {
    errors.push("Up-facing movement needs a subtle back-step sway so the single back sprite does not look like it is drifting.");
  }
  if (!clientSource.includes("moving ? 0.31 : 0.25")) {
    errors.push("Moving characters need a stronger ground shadow to avoid the floating look.");
  }
  if (!clientSource.includes(".setBlendMode(Phaser.BlendModes.NORMAL);")) {
    errors.push("Movement trails should avoid additive blending, which creates a white platform under the feet.");
  }
  if (!clientSource.includes("const walkFrame = Math.floor(this.time.now / 118) % 3")) {
    errors.push("Walk frame cadence should stay fast enough to read as stepping, not sliding.");
  }
  if (!clientSource.includes("player.spawnProtected ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD")) {
    errors.push("Spawn-protection aura should render as a subdued grounded marker, not an additive bright platform under the player.");
  }
  if (!clientSource.includes("const PLAYER_SPAWN_AURA_SIZE = { width: 62, height: 18, alpha: 0.055 }")) {
    errors.push("Spawn-protection aura should stay compact and low-alpha so it does not make the player look like they are floating.");
  }

  return errors.length > 0
    ? fail("grounded movement contract", errors)
    : pass("grounded movement contract", [
        "Player sprites anchor near the feet; walking is driven by real movement, interpolation tailing is not drawn as sliding, and foot glows stay subdued."
      ]);
}

function checkClassSpriteAndLocalizationContract(): ArenaAuditCheck {
  const normalizeSource = readFileSync(resolve(ROOT, "tools/normalize_class_sprites.py"), "utf8");
  const sceneSource = readFileSync(resolve(ROOT, "apps/client/src/game/scenes/VillageArenaScene.ts"), "utf8");
  const appSource = readFileSync(resolve(ROOT, "apps/client/src/App.tsx"), "utf8");
  const i18nSource = readFileSync(resolve(ROOT, "apps/client/src/i18n/arena.tsx"), "utf8");
  const eventFeedSource = readFileSync(resolve(ROOT, "apps/client/src/components/EventFeed.tsx"), "utf8");
  const drawerSource = readFileSync(resolve(ROOT, "apps/client/src/components/HudActionDrawer.tsx"), "utf8");
  const combatEventTextSource = readFileSync(resolve(ROOT, "apps/client/src/components/combatEventText.ts"), "utf8");
  const generatedAssetsSource = readFileSync(resolve(ROOT, "apps/client/src/game/assets/generatedAssets.ts"), "utf8");
  const cssSource = readFileSync(resolve(ROOT, "apps/client/src/styles.css"), "utf8");
  const spriteValidatorSource = readFileSync(resolve(ROOT, "tools/validate_sprite_assets.py"), "utf8");
  const errors: string[] = [];

  if (!normalizeSource.includes("ENGINEER_SOURCE_TOP_EXPAND") || !normalizeSource.includes('if class_id == "engineer"')) {
    errors.push("Engineer class sprite crops must expand above the source row so goggles/hair are not cut off.");
  }
  if (
    !normalizeSource.includes("MAGE_SIDE_WALK_GENERATED_SOURCE") ||
    !normalizeSource.includes("load_mage_side_walk_generated_source()") ||
    !normalizeSource.includes("for source_index, frame in enumerate(MAGE_SIDE_WALK_FRAMES)") ||
    !normalizeSource.includes("stabilize_mage_side_feet(generated)")
  ) {
    errors.push("Mage side walk frames must come from the generated three-frame side-walk source and keep a shared foot baseline.");
  }
  if (!spriteValidatorSource.includes("detached side-walk component too large") || !spriteValidatorSource.includes("MAGE_SIDE_MAX_DETACHED_COMPONENT")) {
    errors.push("Sprite validation must reject detached Mage side-walk components so robe/staff chunks cannot separate from the body again.");
  }
  if (normalizeSource.includes("draw_mage_side_body_underlay(repaired, frame)")) {
    errors.push("Mage side frames should not redraw the whole cloak/body underlay; it caused mismatched side silhouettes.");
  }
  if (sceneSource.includes("renderClassPreview") || sceneSource.includes("previewView")) {
    errors.push("Phaser class preview pedestal should stay removed; class selection is handled by the DOM panel.");
  }
  if (!appSource.includes("ArenaI18nProvider") || !appSource.includes("ARENA_LANGUAGES") || appSource.includes("ACTION_TOOLTIPS") || appSource.includes("SKILL_LABELS")) {
    errors.push("Arena App should use the shared i18n provider for class, skill, tooltip, and HUD text instead of raw shared English labels.");
  }
  if (!i18nSource.includes('export type ArenaLanguage = "en" | "zh" | "ko"') || !i18nSource.includes("한국어") || !i18nSource.includes("中文")) {
    errors.push("Arena i18n should expose English, Traditional Chinese, and Korean language options.");
  }
  if (
    !combatEventTextSource.includes("formatCombatEventMessage") ||
    !i18nSource.includes("enteredArena:") ||
    eventFeedSource.includes("event.message}</span>") ||
    drawerSource.includes("event.message}</span>")
  ) {
    errors.push("Battle feed and message drawer should localize structured combat events instead of displaying raw server English messages.");
  }
  if (!cssSource.includes(".language-switcher") || !cssSource.includes(".drawer-language-row")) {
    errors.push("Start panel and settings drawer should both expose styled language controls.");
  }
  if (appSource.includes("class-stage-ring")) {
    errors.push("Class stage should not render the old pedestal/ring under the character.");
  }
  if (appSource.includes('className="skill-list"') || cssSource.includes(".skill-list")) {
    errors.push("Right-side loadout should not duplicate the Q/E/R skill list; keep skill icons under the selected character only.");
  }
  if (!cssSource.includes("padding: 16px;") || !cssSource.includes("overflow: hidden;") || !cssSource.includes("min-height: 48px")) {
    errors.push("Start panel copy should have internal padding and bounded rule buttons so the outer frame line is never broken.");
  }
  if (
    !generatedAssetsSource.includes("class-sprite-ui-cleanup-v2") &&
    !generatedAssetsSource.includes("warrior-verdict-combat-fx-v2") &&
    !generatedAssetsSource.includes("warrior-vertical-slash-v1") &&
    !generatedAssetsSource.includes("mage-circular-vfx-v1")
  ) {
    errors.push("Generated asset version should stay bumped so browsers do not reuse cached class sprite or combat VFX assets.");
  }

  return errors.length > 0
    ? fail("class sprite and localization contract", errors)
    : pass("class sprite and localization contract", [
        "Engineer crops expand above the source row, Mage side frames are stabilized, the class pedestal and duplicate Q/E/R list are removed, and arena UI supports zh/en/ko."
      ]);
}

function main() {
  const checks = [
    checkClassHealthAndBasicTtk(),
    checkBasicAttackSpeedOrder(),
    checkSingleHitDamage(),
    checkMageBurstCeiling(),
    checkClassBurstComboCeilings(),
    checkActionStackingContract(),
    checkTurretRotationContract(),
    checkClientAimPersistenceContract(),
    checkTurretGroundingContract(),
    checkBasicAttackVfxContract(),
    checkWarriorDirectionalMeleeAndTurretDeathContract(),
    checkProjectileReadabilityContract(),
    checkMageSkillVfxPresenceContract(),
    checkSkillTooltipContract(),
    checkDeathClassSwitchContract(),
    checkPixelHudSkinContract(),
    checkEngineerRepulsorPulseVfxContract(),
    checkArcherSeedRainVfxContract(),
    checkGroundedMovementContract(),
    checkClassSpriteAndLocalizationContract()
  ];
  const failures = checks.filter((check) => check.status === "fail");

  for (const check of checks) {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    console.log(`${marker} ${check.name}`);
    for (const detail of check.details) {
      console.log(`  - ${detail}`);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main();

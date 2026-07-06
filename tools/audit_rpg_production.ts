import {
  RPG_ELEMENTS,
  RPG_MOVES,
  RPG_AI_DIFFICULTIES,
  RPG_AI_DIFFICULTY_CONFIGS,
  RPG_INITIAL_SKILL_TICKET_INVENTORY,
  RPG_SKILL_TIERS,
  RPG_STARTER_PETS,
  RPG_SKILL_TICKETS,
  RPG_SKILL_VFX_COLUMNS,
  RPG_SKILL_VFX_ROWS_PER_ELEMENT,
  RPG_STATUS_META,
  auditRpgBalance,
  scoreRpgMove,
  createAiRpgActionForActor,
  createRpgAiRoster,
  createRpgBattleState,
  createSeededRng,
  createStarterRoster,
  drawRpgSkillTicket,
  getRpgBattleTurnOrder,
  getRpgSkillVfxSpec,
  getRpgCurrentTurnActor,
  getRpgVfxProductionSpec,
  getRpgDrawPool,
  getRpgElementMultiplier,
  getRpgMoveById,
  rpgSkillVfxExpectedFiles,
  resolveRpgBattleTurn,
  type RpgAiDifficulty,
  type RpgBattleAction,
  type RpgBattleState,
  type RpgElement,
  type RpgMove,
  type RpgSkillTier,
  type RpgStatusId,
  type RpgTarget
} from "../packages/shared/src/index";
import { presentRpgBattleForSide, RpgBattleRoom } from "../apps/server/src/rpg/RpgBattleRoom";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

type CheckStatus = "pass" | "fail";

interface ProductionCheck {
  name: string;
  status: CheckStatus;
  details: string[];
}

const EXPECTED_TIER_COUNTS: Record<RpgSkillTier, number> = {
  basic: 10,
  intermediate: 10,
  ultimate: 5
};

const REQUIRED_TARGETS: readonly RpgTarget[] = ["singleEnemy", "allEnemies", "self", "singleAlly", "allAllies"];
const BULLET_MOVE_IDS = ["fire_basic_02", "grass_basic_02", "dark_basic_02", "light_basic_02"] as const;
const IMPACT_STRIKE_MOVE_IDS = ["fire_basic_01", "grass_basic_01", "dark_basic_01", "light_basic_01"] as const;
const WIDE_SWEEP_MOVE_IDS = ["fire_basic_07", "grass_basic_07", "light_basic_07"] as const;
const GIGAPACK_SEQUENCE_ROWS = new Set([5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24]);
const SPELL_SEQUENCE_ROW_KEYS = new Set([
  "water:6", "water:20", "water:21", "water:22", "water:23", "water:24",
  "fire:20", "fire:21", "fire:23",
  "grass:17", "grass:20", "grass:21", "grass:22", "grass:24",
  "dark:8", "dark:11", "dark:13", "dark:17", "dark:20", "dark:23",
  "light:20", "light:21", "light:22", "light:23", "light:24"
]);
const RPG_STATUS_IDS = Object.keys(RPG_STATUS_META) as RpgStatusId[];
const RAW_STATUS_ID_PATTERN = new RegExp(`\\b(${RPG_STATUS_IDS.join("|")})\\b`);

const REQUIRED_ELEMENT_SIGNATURES: Record<RpgElement, readonly string[]> = {
  water: ["heal", "cleanse", "guard", "regen", "stun"],
  fire: ["burn", "heal", "cleanse", "guard", "regen", "stun"],
  grass: ["poison", "heal", "cleanse", "guard", "regen", "stun"],
  dark: ["poison", "heal", "cleanse", "guard", "regen", "stun"],
  light: ["heal", "cleanse", "guard", "regen", "stun"]
};

function pass(name: string, details: string[] = []): ProductionCheck {
  return { name, status: "pass", details };
}

function fail(name: string, details: string[]): ProductionCheck {
  return { name, status: "fail", details };
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function hashAuditSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function moveSignatureFlags(move: RpgMove) {
  const flags = new Set<string>();
  if (move.power > 0) flags.add("damage");
  for (const effect of move.effects) {
    if (effect.status) flags.add(effect.status);
    if (effect.heal) flags.add("heal");
    if (effect.cleanse) flags.add("cleanse");
    if (effect.shield) flags.add("shield");
    if (effect.energy) flags.add("energy");
    if (effect.selfDamage) flags.add("selfDamage");
  }
  return flags;
}

function expectedPrimaryVfxSource(move: RpgMove, row: number) {
  if (SPELL_SEQUENCE_ROW_KEYS.has(`${move.element}:${row}`)) return "external-spellsfx-2";
  return GIGAPACK_SEQUENCE_ROWS.has(row) ? "external-super-pixel-gigapack" : "external-spellsfx-2";
}

function checkMoveCatalog(): ProductionCheck {
  const errors: string[] = [];
  const balanceAudit = auditRpgBalance();
  errors.push(...balanceAudit.warnings);

  if (RPG_MOVES.length !== 125) errors.push(`Expected 125 moves, found ${RPG_MOVES.length}.`);

  const duplicateNames = duplicateValues(RPG_MOVES.map((move) => move.name));
  if (duplicateNames.length > 0) errors.push(`Duplicate move names: ${duplicateNames.join(", ")}.`);

  for (const move of RPG_MOVES) {
    if (!move.name.trim()) errors.push(`${move.id} has empty name.`);
    if (move.description.trim().length < 8) errors.push(`${move.id} description is too short.`);
    if (move.energyCost < 1 || move.energyCost > 8) errors.push(`${move.id} energy cost out of range: ${move.energyCost}.`);
    if (move.animation.frameCount < 6 || move.animation.frameCount > 16) errors.push(`${move.id} animation frame count out of range: ${move.animation.frameCount}.`);
    if (move.animation.palette.length < 3) errors.push(`${move.id} animation palette needs at least 3 colors.`);
    if (!move.animation.notes.includes("像素特效")) errors.push(`${move.id} animation notes must describe pixel VFX direction.`);
  }

  for (const element of RPG_ELEMENTS) {
    const elementMoves = RPG_MOVES.filter((move) => move.element === element);
    if (elementMoves.length !== 25) errors.push(`${element} expected 25 moves, found ${elementMoves.length}.`);

    const availableTargets = new Set(elementMoves.map((move) => move.target));
    for (const target of REQUIRED_TARGETS) {
      if (!availableTargets.has(target)) errors.push(`${element} missing target coverage: ${target}.`);
    }

    const flags = new Set<string>();
    for (const move of elementMoves) {
      for (const flag of moveSignatureFlags(move)) flags.add(flag);
    }
    for (const signature of REQUIRED_ELEMENT_SIGNATURES[element]) {
      if (!flags.has(signature)) errors.push(`${element} missing gameplay signature: ${signature}.`);
    }

    for (const tier of RPG_SKILL_TIERS) {
      const tierMoves = elementMoves.filter((move) => move.tier === tier);
      const expectedSlots = Array.from({ length: EXPECTED_TIER_COUNTS[tier] }, (_item, index) => index + 1);
      const actualSlots = tierMoves.map((move) => move.slot).sort((a, b) => a - b);
      if (actualSlots.join(",") !== expectedSlots.join(",")) {
        errors.push(`${element}/${tier} expected slots ${expectedSlots.join(",")}, found ${actualSlots.join(",")}.`);
      }
    }
  }

  return errors.length > 0 ? fail("move catalog and balance", errors) : pass("move catalog and balance", [`${RPG_MOVES.length} moves audited.`]);
}

function checkStarterPets(): ProductionCheck {
  const errors: string[] = [];
  if (RPG_STARTER_PETS.length !== 5) errors.push(`Expected 5 starter pets, found ${RPG_STARTER_PETS.length}.`);

  const petElements = new Set(RPG_STARTER_PETS.map((pet) => pet.element));
  for (const element of RPG_ELEMENTS) {
    if (!petElements.has(element)) errors.push(`Missing starter pet for ${element}.`);
  }

  for (const pet of RPG_STARTER_PETS) {
    if (pet.startingMoveIds.length !== 4) errors.push(`${pet.id} should start with exactly 4 moves.`);
    if (new Set(pet.startingMoveIds).size !== pet.startingMoveIds.length) errors.push(`${pet.id} has duplicate starting moves.`);
    if (pet.maxHp < 100 || pet.maxHp > 150) errors.push(`${pet.id} HP out of starter range: ${pet.maxHp}.`);
    if (pet.attack < 22 || pet.attack > 32) errors.push(`${pet.id} attack out of starter range: ${pet.attack}.`);
    if (pet.defense < 8 || pet.defense > 17) errors.push(`${pet.id} defense out of starter range: ${pet.defense}.`);
    if (pet.speed < 9 || pet.speed > 19) errors.push(`${pet.id} speed out of starter range: ${pet.speed}.`);

    let hasFormationMove = false;
    for (const moveId of pet.startingMoveIds) {
      const move = getRpgMoveById(moveId);
      if (!move) {
        errors.push(`${pet.id} references unknown starting move ${moveId}.`);
        continue;
      }
      if (move.element !== pet.element) errors.push(`${pet.id} starting move ${moveId} does not match ${pet.element}.`);
      if (move.tier !== "basic") errors.push(`${pet.id} starting move ${moveId} must be basic.`);
      if (move.target === "allEnemies" || move.target === "allAllies") hasFormationMove = true;
    }
    if (!hasFormationMove) errors.push(`${pet.id} needs one starter move that demonstrates 3v3 formation targeting.`);
  }

  return errors.length > 0 ? fail("starter pets", errors) : pass("starter pets", [`${RPG_STARTER_PETS.length} starters cover all elements.`]);
}

function checkAiDifficultyConfigs(): ProductionCheck {
  const errors: string[] = [];
  if (RPG_AI_DIFFICULTIES.length !== 3) errors.push(`Expected 3 AI difficulties, found ${RPG_AI_DIFFICULTIES.length}.`);

  for (const difficulty of RPG_AI_DIFFICULTIES) {
    const config = RPG_AI_DIFFICULTY_CONFIGS[difficulty];
    if (!config) {
      errors.push(`Missing AI difficulty config for ${difficulty}.`);
      continue;
    }
    if (config.id !== difficulty) errors.push(`${difficulty} config id mismatch: ${config.id}.`);
    if (!config.label.trim() || !config.title.trim() || config.description.trim().length < 12) {
      errors.push(`${difficulty} config needs player-facing label, title, and description.`);
    }
    if (config.rosterOrder.length !== 3) errors.push(`${difficulty} should field exactly 3 pets, got ${config.rosterOrder.length}.`);
    if (new Set(config.rosterOrder).size !== config.rosterOrder.length) errors.push(`${difficulty} has duplicate roster pets.`);

    const roster = createRpgAiRoster(`audit-${difficulty}`, difficulty);
    if (roster.length !== 3) errors.push(`${difficulty} generated roster should contain 3 pets, got ${roster.length}.`);

    let intermediateCount = 0;
    let ultimateCount = 0;
    for (const pet of roster) {
      const definition = RPG_STARTER_PETS.find((starter) => starter.id === pet.definitionId);
      if (!definition) {
        errors.push(`${difficulty} references unknown pet definition ${pet.definitionId}.`);
        continue;
      }
      if (pet.moveIds.length !== 4) errors.push(`${difficulty}/${pet.definitionId} should equip exactly 4 moves, got ${pet.moveIds.length}.`);
      if (new Set(pet.moveIds).size !== pet.moveIds.length) errors.push(`${difficulty}/${pet.definitionId} has duplicate equipped moves.`);
      for (const moveId of pet.moveIds) {
        const move = getRpgMoveById(moveId);
        if (!move) {
          errors.push(`${difficulty}/${pet.definitionId} references unknown move ${moveId}.`);
          continue;
        }
        if (move.element !== definition.element) errors.push(`${difficulty}/${pet.definitionId} move ${moveId} does not match ${definition.element}.`);
        if (move.tier === "intermediate") intermediateCount += 1;
        if (move.tier === "ultimate") ultimateCount += 1;
      }
    }

    if (difficulty === "normal" && (intermediateCount > 0 || ultimateCount > 0)) {
      errors.push("normal AI should use only basic moves.");
    }
    if (difficulty === "hard" && (intermediateCount < 3 || ultimateCount > 0)) {
      errors.push(`hard AI should introduce intermediate moves without ultimate moves, got intermediate=${intermediateCount}, ultimate=${ultimateCount}.`);
    }
    if (difficulty === "leader" && ultimateCount < 6) {
      errors.push(`leader AI should use a high-tier loadout with at least 6 ultimate moves, got ${ultimateCount}.`);
    }
  }

  return errors.length > 0
    ? fail("AI difficulty configs", errors)
    : pass("AI difficulty configs", ["normal, hard, and leader rosters have validated pets, loadouts, and tier escalation."]);
}

function checkTicketPools(): ProductionCheck {
  const errors: string[] = [];
  if (RPG_SKILL_TICKETS.length < 4) errors.push(`Expected at least 4 skill tickets, found ${RPG_SKILL_TICKETS.length}.`);
  const ticketIds = new Set(RPG_SKILL_TICKETS.map((ticket) => ticket.id));
  for (const ticketId of Object.keys(RPG_INITIAL_SKILL_TICKET_INVENTORY)) {
    if (!ticketIds.has(ticketId)) errors.push(`Initial ticket inventory references unknown ticket ${ticketId}.`);
  }

  for (const ticket of RPG_SKILL_TICKETS) {
    const initialCount = RPG_INITIAL_SKILL_TICKET_INVENTORY[ticket.id] ?? 0;
    if (!Number.isInteger(initialCount) || initialCount <= 0) errors.push(`${ticket.id} initial inventory must be a positive integer.`);
    if (ticket.drawCount < 1) errors.push(`${ticket.id} drawCount must be positive.`);
    if (ticket.highTierGuarantee && !ticket.allowedTiers.includes("ultimate")) {
      errors.push(`${ticket.id} has highTierGuarantee but cannot draw ultimate moves.`);
    }

    const globalPool = getRpgDrawPool(ticket.id);
    if (globalPool.length <= 0) errors.push(`${ticket.id} global pool is empty.`);

    for (const element of RPG_ELEMENTS) {
      const pool = getRpgDrawPool(ticket.id, element);
      const expected = ticket.allowedTiers.reduce((sum, tier) => sum + EXPECTED_TIER_COUNTS[tier], 0);
      if (pool.length !== expected) errors.push(`${ticket.id}/${element} expected ${expected} pool moves, found ${pool.length}.`);
      for (const tier of ticket.allowedTiers) {
        if (!pool.some((move) => move.tier === tier)) errors.push(`${ticket.id}/${element} missing tier ${tier}.`);
      }

      for (let seed = 1; seed <= 12; seed += 1) {
        const result = drawRpgSkillTicket(ticket.id, { preferredElement: element, rng: createSeededRng(hashAuditSeed(`${ticket.id}:${element}:${seed}`)) });
        if (result.moves.length !== ticket.drawCount) errors.push(`${ticket.id}/${element}/seed-${seed} expected ${ticket.drawCount} draws, got ${result.moves.length}.`);
        if (result.moves.some((move) => move.element !== element)) errors.push(`${ticket.id}/${element}/seed-${seed} drew a move outside preferred element.`);
        if (result.moves.some((move) => !ticket.allowedTiers.includes(move.tier))) errors.push(`${ticket.id}/${element}/seed-${seed} drew a tier outside ticket pool.`);
        if (ticket.highTierGuarantee && ticket.allowedTiers.includes("ultimate") && !result.moves.some((move) => move.tier === "ultimate")) {
          errors.push(`${ticket.id}/${element}/seed-${seed} did not satisfy high-tier guarantee.`);
        }
      }
    }

    for (let seed = 1; seed <= 12; seed += 1) {
      const result = drawRpgSkillTicket(ticket.id, { rng: createSeededRng(hashAuditSeed(`${ticket.id}:global:${seed}`)) });
      if (result.moves.length !== ticket.drawCount) errors.push(`${ticket.id}/global/seed-${seed} expected ${ticket.drawCount} draws, got ${result.moves.length}.`);
      if (result.moves.some((move) => !ticket.allowedTiers.includes(move.tier))) errors.push(`${ticket.id}/global/seed-${seed} drew a tier outside ticket pool.`);
      if (ticket.highTierGuarantee && ticket.allowedTiers.includes("ultimate") && !result.moves.some((move) => move.tier === "ultimate")) {
        errors.push(`${ticket.id}/global/seed-${seed} did not satisfy high-tier guarantee.`);
      }
    }
  }

  return errors.length > 0
    ? fail("skill ticket pools", errors)
    : pass("skill ticket pools", [`${RPG_SKILL_TICKETS.length} tickets audited across five elements with finite starter inventory and deterministic draw simulations.`]);
}

function checkSkillVfxCoverage(): ProductionCheck {
  const errors: string[] = [];
  const occupiedRows = new Set<string>();

  for (const fileName of rpgSkillVfxExpectedFiles()) {
    const path = resolve("apps/client/public/assets/generated", `${fileName}.png`);
    if (!existsSync(path)) errors.push(`Missing generated VFX sheet: ${fileName}.png.`);
  }

  for (const move of RPG_MOVES) {
    const spec = getRpgSkillVfxSpec(move);
    if (spec.columns !== RPG_SKILL_VFX_COLUMNS) errors.push(`${move.id} VFX columns mismatch: ${spec.columns}.`);
    if (spec.rows !== RPG_SKILL_VFX_ROWS_PER_ELEMENT) errors.push(`${move.id} VFX rows mismatch: ${spec.rows}.`);
    if (spec.frameCount !== RPG_SKILL_VFX_COLUMNS) errors.push(`${move.id} VFX frameCount should play all sheet columns.`);
    if (spec.row < 0 || spec.row >= RPG_SKILL_VFX_ROWS_PER_ELEMENT) errors.push(`${move.id} VFX row out of range: ${spec.row}.`);
    if (spec.durationMs < 600 || spec.durationMs > 1300) errors.push(`${move.id} VFX duration out of range: ${spec.durationMs}.`);

    const rowKey = `${move.element}:${spec.row}`;
    if (occupiedRows.has(rowKey)) errors.push(`${move.id} reuses occupied VFX row ${rowKey}.`);
    occupiedRows.add(rowKey);
  }

  const expectedRows = RPG_ELEMENTS.length * RPG_SKILL_VFX_ROWS_PER_ELEMENT;
  if (occupiedRows.size !== expectedRows) errors.push(`Expected ${expectedRows} occupied VFX rows, found ${occupiedRows.size}.`);

  return errors.length > 0 ? fail("skill VFX coverage", errors) : pass("skill VFX coverage", [`${RPG_MOVES.length} moves mapped to generated spritesheet rows.`]);
}

function checkSkillVfxProductionMapping(): ProductionCheck {
  const errors: string[] = [];

  for (const moveId of BULLET_MOVE_IDS) {
    const move = getRpgMoveById(moveId);
    if (!move) {
      errors.push(`Missing required bullet-mapped move ${moveId}.`);
      continue;
    }
    const spec = getRpgVfxProductionSpec(move);
    if (spec.category !== "small-projectile") errors.push(`${move.id} should be a small-projectile VFX, got ${spec.category}.`);
    if (!spec.usesBulletProjectile) errors.push(`${move.id} must use the paid external 16x16 bullet travel layer.`);
    if (spec.primarySource !== "external-16x16-bullet") errors.push(`${move.id} missing external-16x16-bullet primary source.`);
    if (spec.sources.some((source) => source.startsWith("external-") && source !== spec.primarySource)) {
      errors.push(`${move.id} should not mix bullet travel with a second impact pack source.`);
    }
  }

  for (const moveId of IMPACT_STRIKE_MOVE_IDS) {
    const move = getRpgMoveById(moveId);
    if (!move) {
      errors.push(`Missing required impact-strike move ${moveId}.`);
      continue;
    }
    const spec = getRpgVfxProductionSpec(move);
    if (spec.category !== "impact-strike") errors.push(`${move.id} should be impact-strike VFX, got ${spec.category}.`);
    if (spec.usesBulletProjectile) errors.push(`${move.id} is a claw/whip/feather hit and must not use bullet travel.`);
    if (spec.primarySource !== "external-spellsfx-2" && spec.primarySource !== "external-super-pixel-gigapack") {
      errors.push(`${move.id} should use exactly one complete external impact sequence, got ${spec.primarySource}.`);
    }
  }

  for (const moveId of WIDE_SWEEP_MOVE_IDS) {
    const move = getRpgMoveById(moveId);
    if (!move) {
      errors.push(`Missing required wide-sweep move ${moveId}.`);
      continue;
    }
    const spec = getRpgVfxProductionSpec(move);
    if (!spec.requiresWideTargetRead) errors.push(`${move.id} must require wide target readability.`);
    if (spec.usesBulletProjectile) errors.push(`${move.id} is a sweep and must not use bullet travel.`);
    if (spec.primarySource !== "external-spellsfx-2" && spec.primarySource !== "external-super-pixel-gigapack") {
      errors.push(`${move.id} should use exactly one complete wide-sweep sequence, got ${spec.primarySource}.`);
    }
  }

  for (const move of RPG_MOVES) {
    const spec = getRpgVfxProductionSpec(move);
    const row = getRpgSkillVfxSpec(move).row;
    const needsStatusLayer = move.effects.some((effect) => effect.status || effect.heal || effect.cleanse || effect.shield);
    const isSupportMove = move.target === "self" || move.target === "singleAlly" || move.target === "allAllies";
    if (needsStatusLayer && !spec.usesStatusLayer) errors.push(`${move.id} has status/heal/shield effects but is missing a status-layer VFX plan.`);
    if (!spec.primarySource.startsWith("external-")) errors.push(`${move.id} should declare exactly one external primary VFX source, got ${spec.primarySource}.`);
    if (spec.sources.filter((source) => source.startsWith("external-")).length !== 1) errors.push(`${move.id} should expose exactly one external source in sources.`);
    if (needsStatusLayer && spec.statusSource !== "generated-status-sheet") errors.push(`${move.id} missing generated-status-sheet status source.`);
    if (!needsStatusLayer && spec.statusSource) errors.push(`${move.id} declares a status source without a status/heal/shield effect.`);
    const expectedPrimarySource = expectedPrimaryVfxSource(move, row);
    if (!spec.usesBulletProjectile && spec.primarySource !== expectedPrimarySource) {
      errors.push(`${move.id} row ${row} should use ${expectedPrimarySource} as its single complete sequence, got ${spec.primarySource}.`);
    }
    if (isSupportMove && move.tier !== "ultimate") {
      if (spec.category !== "support-field") errors.push(`${move.id} support move should be support-field VFX, got ${spec.category}.`);
      if (spec.usesBulletProjectile) errors.push(`${move.id} support move must not use bullet travel.`);
      if (spec.requiresActorToTargetPath !== (move.target === "singleAlly")) {
        errors.push(`${move.id} support move has wrong actor-to-target path requirement: ${spec.requiresActorToTargetPath}.`);
      }
      if (move.target === "allAllies" && !spec.requiresWideTargetRead) errors.push(`${move.id} all-allies support move must require wide target readability.`);
    }
    if (move.tier === "ultimate") {
      if (spec.category !== "ultimate-multiphase") errors.push(`${move.id} ultimate should be ultimate-multiphase, got ${spec.category}.`);
      if (spec.usesBulletProjectile) errors.push(`${move.id} ultimate must not rely on the 16x16 bullet layer.`);
      if (spec.primarySource !== expectedPrimarySource) errors.push(`${move.id} ultimate should use ${expectedPrimarySource} primary source, got ${spec.primarySource}.`);
      for (const phase of ["windup", "impact", "finish"] as const) {
        if (!spec.phases.includes(phase)) errors.push(`${move.id} ultimate missing ${phase} phase.`);
      }
      if (spec.phases.length < 4) errors.push(`${move.id} ultimate needs at least 4 VFX phases, got ${spec.phases.length}.`);
    }
    if (move.target.includes("all") && !spec.requiresWideTargetRead) errors.push(`${move.id} targets multiple pets but does not require wide target readability.`);
  }

  return errors.length > 0
    ? fail("skill VFX production mapping", errors)
    : pass("skill VFX production mapping", ["single-sequence bullet, SpellsFX, Super Pixel, status, support-field, and ultimate rules audited without multi-pack mixing."]);
}

function checkElementCycle(): ProductionCheck {
  const errors: string[] = [];
  const expectedStrongAgainst: Record<RpgElement, readonly RpgElement[]> = {
    water: ["fire"],
    fire: ["grass"],
    grass: ["fire", "water"],
    dark: ["light"],
    light: ["dark"]
  };
  for (const attacker of RPG_ELEMENTS) {
    const strongAgainst = RPG_ELEMENTS.filter((defender) => getRpgElementMultiplier(attacker, defender) > 1);
    const expected = [...expectedStrongAgainst[attacker]].sort();
    const actual = [...strongAgainst].sort();
    if (actual.join(",") !== expected.join(",")) errors.push(`${attacker} strong targets should be ${expected.join(",") || "none"}, found ${actual.join(",") || "none"}.`);
    for (const defender of RPG_ELEMENTS) {
      const multiplier = getRpgElementMultiplier(attacker, defender);
      const expectedMultiplier = expectedStrongAgainst[attacker].includes(defender)
        ? 1.25
        : expectedStrongAgainst[defender].includes(attacker)
          ? 0.86
          : 1;
      if (multiplier !== expectedMultiplier) errors.push(`${attacker}->${defender} multiplier should be ${expectedMultiplier}, got ${multiplier}.`);
    }
  }
  return errors.length > 0 ? fail("element chart", errors) : pass("element chart", ["Custom five-element advantage table matches water/fire/grass plus light/dark rules."]);
}

function averageStarterStat(stat: "attack" | "defense") {
  return RPG_STARTER_PETS.reduce((sum, pet) => sum + pet[stat], 0) / RPG_STARTER_PETS.length;
}

function estimatedNeutralDamage(move: RpgMove) {
  if (move.power <= 0) return 0;
  return Math.max(1, move.power + Math.floor(averageStarterStat("attack") * 0.72) - Math.floor(averageStarterStat("defense") * 0.72));
}

function checkHealingSustainBalance(): ProductionCheck {
  const errors: string[] = [];
  const details: string[] = [];
  const averageSingleDamageByTier: Record<RpgSkillTier, number> = Object.fromEntries(
    RPG_SKILL_TIERS.map((tier) => {
      const damageMoves = RPG_MOVES.filter((move) => move.tier === tier && move.target === "singleEnemy" && move.power > 0);
      const averageDamage = damageMoves.reduce((sum, move) => sum + estimatedNeutralDamage(move), 0) / damageMoves.length;
      return [tier, averageDamage];
    })
  ) as Record<RpgSkillTier, number>;

  const singleHealMoves = RPG_MOVES.filter((move) => move.target === "singleAlly" && move.effects.some((effect) => effect.heal));
  for (const move of singleHealMoves) {
    const heal = move.effects.reduce((sum, effect) => sum + (effect.heal ?? 0), 0);
    const ratio = heal / averageSingleDamageByTier[move.tier];
    const score = scoreRpgMove(move);
    if (move.tier === "basic" && (ratio < 0.84 || ratio > 0.98)) errors.push(`${move.id} basic heal ratio should stay useful but not stall battles: ${ratio.toFixed(2)}.`);
    if (move.tier === "intermediate" && (ratio < 0.95 || ratio > 1.12)) errors.push(`${move.id} intermediate heal ratio should be near one strong hit: ${ratio.toFixed(2)}.`);
    if (score < 15.8 || score > 25.9) errors.push(`${move.id} heal score is outside support bounds after sustain tuning: ${score}.`);
  }

  const teamRegenMoves = RPG_MOVES.filter((move) => move.target === "allAllies" && move.effects.some((effect) => effect.status === "regen"));
  for (const move of teamRegenMoves) {
    const teamPotential = move.effects.reduce((sum, effect) => {
      if (effect.status !== "regen") return sum;
      return sum + (effect.power ?? 0) * (effect.duration ?? 1) * 3;
    }, 0);
    if (move.tier === "intermediate" && (teamPotential < 60 || teamPotential > 84)) errors.push(`${move.id} intermediate team regen potential should stay 60-84 total HP, got ${teamPotential}.`);
    if (move.tier === "ultimate" && (teamPotential < 36 || teamPotential > 60)) errors.push(`${move.id} ultimate team regen potential should stay 36-60 total HP, got ${teamPotential}.`);
  }

  for (const difficulty of RPG_AI_DIFFICULTIES) {
    let finished = 0;
    const turnCounts: number[] = [];
    for (let seed = 1; seed <= 24; seed += 1) {
      let battle = createRpgBattleState(`sustain-audit-${difficulty}-${seed}`, createStarterRoster("left").slice(0, 3), createRpgAiRoster("right", difficulty));
      for (let turn = 0; turn < 60 && !battle.winner; turn += 1) {
        const actor = getRpgCurrentTurnActor(battle);
        const action = actor ? createAiRpgActionForActor(battle, actor.id) : null;
        battle = resolveRpgBattleTurn(battle, action ? [action] : []);
      }
      if (battle.winner) finished += 1;
      turnCounts.push(battle.turn);
    }
    const averageTurns = turnCounts.reduce((sum, turn) => sum + turn, 0) / turnCounts.length;
    if (finished !== 24) errors.push(`${difficulty} sustain simulation should finish 24/24 battles within 60 single-action turns, got ${finished}/24.`);
    if (averageTurns > 32) errors.push(`${difficulty} sustain simulation average should not stall past 32 turns, got ${averageTurns.toFixed(1)}.`);
    details.push(`${difficulty}: ${finished}/24 finished, average ${averageTurns.toFixed(1)} single-action turns.`);
  }

  details.unshift(
    `basic single heal is ${singleHealMoves.find((move) => move.tier === "basic")?.effects.find((effect) => effect.heal)?.heal ?? "n/a"} HP against ${averageSingleDamageByTier.basic.toFixed(1)} average basic single damage.`,
    `intermediate single heal is ${singleHealMoves.find((move) => move.tier === "intermediate")?.effects.find((effect) => effect.heal)?.heal ?? "n/a"} HP against ${averageSingleDamageByTier.intermediate.toFixed(1)} average intermediate single damage.`
  );
  return errors.length > 0 ? fail("healing sustain balance", errors) : pass("healing sustain balance", details);
}

function battleInvariantErrors(battle: RpgBattleState, label: string) {
  const errors: string[] = [];
  const pets = [...battle.left, ...battle.right];
  const petIds = new Set<string>();

  if (!Number.isInteger(battle.turn) || battle.turn < 1) errors.push(`${label} has invalid turn ${battle.turn}.`);
  if (battle.phase === "finished" && !battle.winner) errors.push(`${label} is finished without a winner.`);
  if (battle.phase !== "finished" && battle.winner) errors.push(`${label} has winner ${battle.winner} while phase is ${battle.phase}.`);

  const leftAlive = battle.left.some((pet) => !pet.defeated && pet.hp > 0);
  const rightAlive = battle.right.some((pet) => !pet.defeated && pet.hp > 0);
  if (!battle.winner && (!leftAlive || !rightAlive)) errors.push(`${label} has no winner even though one side has no living pets.`);
  if (battle.winner === "left" && (!leftAlive || rightAlive)) errors.push(`${label} winner left does not match living pet state.`);
  if (battle.winner === "right" && (!rightAlive || leftAlive)) errors.push(`${label} winner right does not match living pet state.`);
  if (battle.winner === "draw" && (leftAlive || rightAlive)) errors.push(`${label} winner draw does not match living pet state.`);

  for (const pet of pets) {
    if (petIds.has(pet.id)) errors.push(`${label} duplicate pet id ${pet.id}.`);
    petIds.add(pet.id);

    if (!Number.isInteger(pet.maxHp) || pet.maxHp <= 0) errors.push(`${label}/${pet.id} invalid maxHp ${pet.maxHp}.`);
    if (!Number.isInteger(pet.hp) || pet.hp < 0 || pet.hp > pet.maxHp) errors.push(`${label}/${pet.id} hp out of bounds: ${pet.hp}/${pet.maxHp}.`);
    if (!Number.isInteger(pet.maxEnergy) || pet.maxEnergy <= 0) errors.push(`${label}/${pet.id} invalid maxEnergy ${pet.maxEnergy}.`);
    if (!Number.isInteger(pet.energy) || pet.energy < 0 || pet.energy > pet.maxEnergy) errors.push(`${label}/${pet.id} energy out of bounds: ${pet.energy}/${pet.maxEnergy}.`);
    if (pet.defeated && pet.hp > 0) errors.push(`${label}/${pet.id} is defeated but still has ${pet.hp} HP.`);
    if (!pet.defeated && pet.hp <= 0) errors.push(`${label}/${pet.id} has 0 HP but is not defeated.`);

    for (const status of pet.statuses) {
      if (!RPG_STATUS_META[status.id]) errors.push(`${label}/${pet.id} has unknown status ${status.id}.`);
      if (!Number.isInteger(status.remainingTurns) || status.remainingTurns <= 0) errors.push(`${label}/${pet.id} status ${status.id} has invalid remaining turns ${status.remainingTurns}.`);
      if (!Number.isInteger(status.power) || status.power <= 0) errors.push(`${label}/${pet.id} status ${status.id} has invalid power ${status.power}.`);
      if (!getRpgMoveById(status.sourceMoveId)) errors.push(`${label}/${pet.id} status ${status.id} references unknown source move ${status.sourceMoveId}.`);
    }
  }

  for (const entry of battle.log) {
    if (!Number.isInteger(entry.turn) || entry.turn < 1 || entry.turn > battle.turn) errors.push(`${label} log entry has invalid turn ${entry.turn}: ${entry.message}`);
    if (entry.actorId && !petIds.has(entry.actorId)) errors.push(`${label} log actor id not found: ${entry.actorId}.`);
    if (entry.targetId && !petIds.has(entry.targetId)) errors.push(`${label} log target id not found: ${entry.targetId}.`);
    if (entry.moveId && !getRpgMoveById(entry.moveId)) errors.push(`${label} log move id not found: ${entry.moveId}.`);
    if (entry.amount !== undefined && (!Number.isInteger(entry.amount) || entry.amount < 0)) errors.push(`${label} log amount invalid: ${entry.amount}.`);
  }

  return errors;
}

function createAiMirrorBattle(seed: number, difficulty: RpgAiDifficulty, invariantErrors: string[] = []): RpgBattleState {
  let battle = createRpgBattleState(`production-audit-${difficulty}-${seed}`, createStarterRoster("left").slice(0, 3), createRpgAiRoster("right", difficulty));
  invariantErrors.push(...battleInvariantErrors(battle, `${difficulty}/seed-${seed}/initial`));
  for (let turn = 0; turn < 36 && !battle.winner; turn += 1) {
    const actor = getRpgCurrentTurnActor(battle);
    const action = actor ? createAiRpgActionForActor(battle, actor.id) : null;
    if (!action) break;
    battle = resolveRpgBattleTurn(battle, [action]);
    invariantErrors.push(...battleInvariantErrors(battle, `${difficulty}/seed-${seed}/turn-${turn + 1}`));
  }
  return battle;
}

function checkBattleSimulation(): ProductionCheck {
  const errors: string[] = [];
  let finished = 0;
  const turnCounts: number[] = [];
  let simulations = 0;
  for (const difficulty of RPG_AI_DIFFICULTIES) {
    for (let seed = 1; seed <= 12; seed += 1) {
      simulations += 1;
      const battle = createAiMirrorBattle(seed, difficulty, errors);
      if (battle.winner) finished += 1;
      turnCounts.push(battle.turn);
      if (battle.log.some((entry) => entry.type === "invalid")) {
        errors.push(`${difficulty} seed ${seed} produced invalid battle log entry.`);
      }
    }
  }
  if (finished < 30) errors.push(`Expected at least 30/${simulations} AI battles to finish, finished ${finished}.`);
  const averageTurns = turnCounts.reduce((sum, turns) => sum + turns, 0) / turnCounts.length;
  if (averageTurns < 10 || averageTurns > 30) errors.push(`Average battle length out of range: ${averageTurns.toFixed(1)} turns.`);
  return errors.length > 0 ? fail("AI battle simulation", errors) : pass("AI battle simulation", [`${finished}/${simulations} simulations finished across 3 AI difficulties, average ${averageTurns.toFixed(1)} turns, state invariants held after every resolved turn.`]);
}

function checkSupportTargetResolution(): ProductionCheck {
  const battle = createRpgBattleState("support-target-audit", createStarterRoster("left").slice(0, 3), createStarterRoster("right").slice(1, 4));
  const actor = battle.left.find((pet) => pet.definitionId === "pet_grass_mossling");
  const target = battle.left.find((pet) => pet.definitionId === "pet_fire_emberfox");
  const errors: string[] = [];
  if (!actor || !target) {
    errors.push("Support target audit could not find grass actor and fire ally target.");
  } else {
    const actorTurnIndex = getRpgBattleTurnOrder(battle).findIndex((pet) => pet.id === actor.id);
    battle.turn = actorTurnIndex >= 0 ? actorTurnIndex + 1 : battle.turn;
    battle.left.forEach((pet) => {
      pet.energy = pet.maxEnergy;
    });
    const resolved = resolveRpgBattleTurn(battle, [{ actorId: actor.id, moveId: "grass_basic_05", targetId: target.id }]);
    const actionLog = resolved.log.find((entry) => entry.type === "action" && entry.moveId === "grass_basic_05");
    const healLog = resolved.log.find((entry) => entry.type === "heal" && entry.moveId === "grass_basic_05");
    if (actionLog?.targetId !== target.id) errors.push(`Support action log target should be ${target.id}, got ${actionLog?.targetId ?? "none"}.`);
    if (healLog?.targetId !== target.id) errors.push(`Support heal log target should be ${target.id}, got ${healLog?.targetId ?? "none"}.`);
    if (actionLog?.targetId === actor.id || healLog?.targetId === actor.id) errors.push("Support move incorrectly fell back to self targeting.");
  }
  return errors.length > 0 ? fail("support target resolution", errors) : pass("support target resolution", ["Single-ally support actions preserve the chosen ally target through battle logs."]);
}

function checkBattleLogLocalization(): ProductionCheck {
  const errors: string[] = [];
  const seenStatuses = new Set<RpgStatusId>();

  for (const statusId of RPG_STATUS_IDS) {
    const meta = RPG_STATUS_META[statusId];
    if (!meta.label || !meta.shortLabel) errors.push(`${statusId} is missing shared localized label metadata.`);
  }

  for (const move of RPG_MOVES) {
    const moveStatuses = move.effects.flatMap((effect) => (effect.status ? [effect.status] : []));
    if (moveStatuses.length === 0) continue;

    const battle = createRpgBattleState(
      `log-localization-${move.id}`,
      [{ definitionId: "pet_fire_emberfox", ownerId: "audit", moveIds: [move.id] }],
      [{ definitionId: "pet_water_tidefin", ownerId: "audit-ai", moveIds: ["water_basic_01"] }]
    );
    for (const pet of [...battle.left, ...battle.right]) {
      pet.maxHp = 999;
      pet.hp = 999;
      pet.energy = pet.maxEnergy;
    }

    const actor = battle.left[0]!;
    const targetId = move.target === "singleAlly" ? battle.left[0]?.id : move.target === "singleEnemy" ? battle.right[0]?.id : undefined;
    const actions: RpgBattleAction[] = [{ actorId: actor.id, moveId: move.id, targetId }];
    const resolved = resolveRpgBattleTurn(battle, actions);
    const statusMessages = resolved.log.filter((entry) => entry.type === "status" && entry.moveId === move.id).map((entry) => entry.message);

    for (const statusId of moveStatuses) {
      const label = RPG_STATUS_META[statusId].label;
      const matchingMessage = statusMessages.find((message) => message.includes(label));
      if (!matchingMessage) errors.push(`${move.id} applies ${statusId} but no battle log message contains localized label ${label}.`);
      if (matchingMessage) seenStatuses.add(statusId);
    }

    for (const message of statusMessages) {
      if (RAW_STATUS_ID_PATTERN.test(message)) errors.push(`${move.id} battle log leaks raw status id: ${message}`);
    }
  }

  for (const statusId of RPG_STATUS_IDS) {
    if (!seenStatuses.has(statusId)) errors.push(`No real move produced localized battle log coverage for status ${statusId}.`);
  }

  return errors.length > 0
    ? fail("battle log localization", errors)
    : pass("battle log localization", [`${seenStatuses.size} statuses resolved through real moves without raw status ids in player-facing logs.`]);
}

function legalCurrentActionFromSnapshot(snapshot: NonNullable<ReturnType<RpgBattleRoom["snapshotFor"]>>) {
  const battle = snapshot.battle;
  const actor = battle ? getRpgCurrentTurnActor(battle) : null;
  if (!battle || !actor) return null;
  const move = getRpgMoveById(actor.moveIds[0]);
  const livingPets = [...battle.left, ...battle.right].filter((pet) => !pet.defeated && pet.hp > 0);
  const enemies = livingPets.filter((pet) => pet.side !== actor.side);
  const allies = livingPets.filter((pet) => pet.side === actor.side);
  const targetId = move?.target === "singleEnemy"
    ? enemies[0]?.id
    : move?.target === "singleAlly"
      ? allies[0]?.id
      : move?.target === "self"
        ? actor.id
        : undefined;
  return { actor, action: { actorId: actor.id, moveId: actor.moveIds[0], targetId } };
}

function checkVersusServerActionAuthority(): ProductionCheck {
  const room = new RpgBattleRoom("AUDIT");
  const roster = RPG_STARTER_PETS.slice(0, 3).map((pet) => ({ definitionId: pet.id, moveIds: pet.startingMoveIds }));
  const left = room.addPlayer("socket-left", "leftsession000001", "Left", roster);
  const right = room.addPlayer("socket-right", "rightsession00001", "Right", roster);
  const errors: string[] = [];
  if (!left || !right) return fail("versus server action authority", ["Could not create a two-player audit room."]);

  const initialLeft = room.snapshotFor("socket-left");
  const initialRight = room.snapshotFor("socket-right");
  if (!initialLeft?.battle || !initialRight?.battle) return fail("versus server action authority", ["Audit room did not start a battle."]);

  const initialTurnAction = legalCurrentActionFromSnapshot(initialLeft);
  if (!initialTurnAction) return fail("versus server action authority", ["Could not resolve an initial current actor."]);
  const currentSocketId = initialTurnAction.actor.side === "left" ? "socket-left" : "socket-right";

  const duplicateActorActions = [initialTurnAction.action, { ...initialTurnAction.action }];
  room.submit("socket-left", duplicateActorActions);
  const afterDuplicate = room.snapshotFor("socket-left");
  if (afterDuplicate?.submittedPlayerIds.length) {
    errors.push("Duplicate actor payload was accepted as a submitted turn.");
  }
  if (afterDuplicate?.battle?.turn !== initialLeft.battle.turn) {
    errors.push("Duplicate actor payload advanced the battle turn.");
  }

  const illegalMoveActions = [{ ...initialTurnAction.action, moveId: "dark_ultimate_05" }];
  room.submit(currentSocketId, illegalMoveActions);
  const afterIllegalMove = room.snapshotFor("socket-left");
  if (afterIllegalMove?.submittedPlayerIds.length) {
    errors.push("Illegal move payload was accepted as a submitted turn.");
  }

  const invalidTargetActions = [{ ...initialTurnAction.action, targetId: initialTurnAction.action.actorId }];
  room.submit(currentSocketId, invalidTargetActions);
  const afterInvalidTarget = room.snapshotFor("socket-left");
  if (afterInvalidTarget?.submittedPlayerIds.length) {
    errors.push("Invalid target-side payload was accepted as a submitted turn.");
  }

  room.submit(currentSocketId, [initialTurnAction.action]);
  const afterLegalAction = room.snapshotFor("socket-left");
  if (afterLegalAction?.submittedPlayerIds.length) {
    errors.push("Single-actor versus flow should not leave pending submitted player ids.");
  }
  if (afterLegalAction?.battle?.turn !== initialLeft.battle.turn + 1) {
    errors.push(`Legal current-actor payload should advance to turn ${initialLeft.battle.turn + 1}, got ${afterLegalAction?.battle?.turn ?? "none"}.`);
  }
  if (afterLegalAction?.battle?.log.some((entry) => entry.type === "invalid")) {
    errors.push("Legal versus payloads produced invalid battle log entries.");
  }

  const disconnectRoom = new RpgBattleRoom("AUDITD");
  const disconnectLeft = disconnectRoom.addPlayer("disconnect-left", "disconnectleft0001", "Left", roster);
  const disconnectRight = disconnectRoom.addPlayer("disconnect-right", "disconnectright000", "Right", roster);
  const disconnectInitialLeft = disconnectRoom.snapshotFor("disconnect-left");
  const disconnectInitialRight = disconnectRoom.snapshotFor("disconnect-right");
  if (!disconnectLeft || !disconnectRight || !disconnectInitialLeft?.battle || !disconnectInitialRight?.battle) {
    errors.push("Could not create disconnect audit room.");
  } else {
    const disconnectTurnAction = legalCurrentActionFromSnapshot(disconnectInitialLeft);
    if (!disconnectTurnAction) {
      errors.push("Could not resolve disconnect audit current actor.");
    } else {
      const disconnectCurrentSocketId = disconnectTurnAction.actor.side === "left" ? "disconnect-left" : "disconnect-right";
      disconnectRoom.submit(disconnectCurrentSocketId, [disconnectTurnAction.action]);
    }
    disconnectRoom.removeSocket("disconnect-left", "disconnect");
    const afterDisconnect = disconnectRoom.snapshotFor("disconnect-right");
    if (afterDisconnect?.submittedPlayerIds.length) {
      errors.push("Disconnect did not clear the disconnected player's stale submission.");
    }
    const offlineTurnAction = afterDisconnect ? legalCurrentActionFromSnapshot(afterDisconnect) : null;
    if (offlineTurnAction) disconnectRoom.submit("disconnect-right", [offlineTurnAction.action]);
    const afterOfflineOpponentSubmit = disconnectRoom.snapshotFor("disconnect-right");
    if (afterOfflineOpponentSubmit?.submittedPlayerIds.length) {
      errors.push("Room accepted a new submission while the opponent was disconnected.");
    }
    if (afterOfflineOpponentSubmit?.battle?.turn !== afterDisconnect?.battle?.turn) {
      errors.push("Room resolved a turn while one player was disconnected.");
    }
  }

  return errors.length > 0
    ? fail("versus server action authority", errors)
    : pass("versus server action authority", ["Server rejects invalid payloads, blocks disconnected rooms, and resolves each validated current-actor action immediately."]);
}

function checkVersusPresentationPerspective(): ProductionCheck {
  const leftOrder = ["pet_fire_emberfox", "pet_water_tidefin", "pet_grass_mossling"] as const;
  const rightOrder = ["pet_grass_mossling", "pet_water_tidefin", "pet_fire_emberfox"] as const;
  const leftRoster = orderedStarterRoster("left", leftOrder);
  const rightRoster = orderedStarterRoster("right", rightOrder);
  const battle = createRpgBattleState("presentation-audit", leftRoster, rightRoster);
  const turnAuditBattle = createRpgBattleState("presentation-turn-audit", leftRoster, rightRoster);
  const errors: string[] = [];
  for (let turn = 1; turn <= 6; turn += 1) {
    turnAuditBattle.turn = turn;
    const leftSeatTurnActor = getRpgCurrentTurnActor(presentRpgBattleForSide(turnAuditBattle, "left"));
    const rightSeatTurnActor = getRpgCurrentTurnActor(presentRpgBattleForSide(turnAuditBattle, "right"));
    if (leftSeatTurnActor?.id !== rightSeatTurnActor?.id) {
      errors.push(`Current actor should be perspective-invariant on turn ${turn}, got left-seat ${leftSeatTurnActor?.id ?? "none"} and right-seat ${rightSeatTurnActor?.id ?? "none"}.`);
    }
  }
  battle.phase = "finished";
  battle.winner = "right";
  battle.log = [
    { turn: 4, type: "victory", message: "右方獲勝。" }
  ];
  const rightSeat = presentRpgBattleForSide(battle, "right");
  const leftSeat = presentRpgBattleForSide(battle, "left");
  if (leftSeat.winner !== "right" || leftSeat.log.at(-1)?.message !== "右方獲勝。") {
    errors.push("Left-seat presentation should preserve server-side winner and victory log.");
  }
  if (rightSeat.winner !== "left") {
    errors.push(`Right-seat presentation should flip winner to local left, got ${rightSeat.winner ?? "none"}.`);
  }
  if (rightSeat.log.at(-1)?.message !== "左方獲勝。") {
    errors.push(`Right-seat victory log should be local-perspective 左方獲勝, got ${rightSeat.log.at(-1)?.message ?? "none"}.`);
  }
  if (rightSeat.left[0]?.side !== "left" || rightSeat.right[0]?.side !== "right") {
    errors.push("Right-seat presentation should localize pet sides after swapping display arrays.");
  }
  if (leftSeat.left.map((pet) => pet.definitionId).join(",") !== leftOrder.join(",") || leftSeat.right.map((pet) => pet.definitionId).join(",") !== rightOrder.join(",")) {
    errors.push("Left-seat presentation should preserve both players' selected formation order.");
  }
  if (rightSeat.left.map((pet) => pet.definitionId).join(",") !== rightOrder.join(",") || rightSeat.right.map((pet) => pet.definitionId).join(",") !== leftOrder.join(",")) {
    errors.push("Right-seat presentation should show the right player formation on local left and the opponent formation on local right.");
  }
  return errors.length > 0
    ? fail("versus presentation perspective", errors)
    : pass("versus presentation perspective", ["Right-seat winner, victory log, and both players' formation order are localized to the player's displayed side."]);
}

function orderedStarterRoster(ownerId: string, definitionIds: readonly string[]) {
  const roster = createStarterRoster(ownerId);
  return definitionIds.flatMap((definitionId) => {
    const pet = roster.find((candidate) => candidate.definitionId === definitionId);
    return pet ? [pet] : [];
  });
}

const checks = [
  checkMoveCatalog(),
  checkStarterPets(),
  checkAiDifficultyConfigs(),
  checkTicketPools(),
  checkSkillVfxCoverage(),
  checkSkillVfxProductionMapping(),
  checkElementCycle(),
  checkHealingSustainBalance(),
  checkBattleSimulation(),
  checkSupportTargetResolution(),
  checkBattleLogLocalization(),
  checkVersusServerActionAuthority(),
  checkVersusPresentationPerspective()
];

const failed = checks.filter((check) => check.status === "fail");
for (const check of checks) {
  const icon = check.status === "pass" ? "PASS" : "FAIL";
  console.log(`${icon} ${check.name}`);
  for (const detail of check.details) console.log(`  - ${detail}`);
}

if (failed.length > 0) {
  console.error(`\nRPG production audit failed: ${failed.length} check(s).`);
  process.exit(1);
}

console.log("\nRPG production audit passed.");

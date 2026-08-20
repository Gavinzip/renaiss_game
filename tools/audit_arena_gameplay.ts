import { GameRoom } from "../apps/server/src/game/GameRoom";
import {
  CLASS_STATS,
  COMBAT,
  ARENA_SKILL_CATALOG,
  ARENA_SKILL_SPECS,
  ARENA_SKILL_TELEGRAPHS,
  WORLD,
  getArcherChargedArrowDamageForStage,
  getDefaultArenaCatalogLoadout,
  getDefaultArenaLoadout,
  getClassDamageMultiplier,
  getEngineerTurretBasicAttackDamage,
  getEffectiveArenaSkillDamage,
  getEffectiveBasicAttackDamage,
  getEffectiveClassDamage,
  getSkillCooldownMs,
  type ClassId,
  type GameSnapshot,
  type PlayerInput,
  type PublicPlayer,
  type SkillKey
} from "../packages/shared/src/index";

const TEST_SPAWN = { x: WORLD.width / 2, y: WORLD.height / 2 };
const OPEN_FIELD_TEST_POINT = { x: 2200, y: 4200 };
const SPAWN_GUARD_CLEAR_MS = 9000;
const FRAME_MS = 33;

const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  angle: 0,
  aimX: TEST_SPAWN.x,
  aimY: TEST_SPAWN.y,
  attack: false,
  sprint: false,
  skillF: false,
  skillQ: false,
  skillE: false,
  skillR: false
};

let fakeNow = 1_000_000;
const realDateNow = Date.now;

interface DuelSetup {
  room: GameRoom;
  attackerSocket: string;
  targetSocket: string;
  attackerId: string;
  targetId: string;
}

interface GameplayCheck {
  name: string;
  details: string[];
}

function main() {
  const checks: GameplayCheck[] = [];
  const scopeIndex = process.argv.indexOf("--scope");
  const scope = scopeIndex >= 0 ? process.argv[scopeIndex + 1] : "all";

  Date.now = () => fakeNow;
  try {
    if (scope === "warrior-redesign") {
      checks.push(checkWarriorRedesignRuntime());
    } else if (scope === "engineer-support") {
      checks.push(checkEngineerSupportBracesRuntime());
    } else if (scope === "cursor-targeting") {
      checks.push(checkArcherCrescentReturnRuntime());
      checks.push(checkEngineerCursorVolleyRuntime());
    } else if (scope === "skill-readability") {
      checks.push(checkMageBeamMovementLockRuntime());
      checks.push(checkArcherStarSnipeMovementLockRuntime());
    } else if (scope === "control-locks") {
      checks.push(checkControlLocksMobilityRuntime());
    } else if (scope !== "all") {
      throw new Error(`Unknown Arena gameplay audit scope: ${scope}`);
    } else {
    checks.push(checkMageActionWindow());
    checks.push(checkMageCursorTargetedAreaRuntime());
    checks.push(checkMageFullRotationSurvivability());
    checks.push(checkMouseAimOverridesStaleAngleRuntime());
    checks.push(checkArcherProjectileBodyHurtboxRuntime());
    checks.push(checkArcherCrescentReturnRuntime());
    checks.push(checkMageBeamMovementLockRuntime());
    checks.push(checkArcherStarSnipeMovementLockRuntime());
    checks.push(checkArcherCursorTargetedAreaRuntime());
    checks.push(checkBotArcherChargedReleaseRuntime());
    checks.push(checkSharedArenaBotReplacementRuntime());
    checks.push(checkDeathClassSwitchRuntime());
    checks.push(checkWarriorDirectionalMeleeRuntime());
    checks.push(checkWarriorRedesignRuntime());
    checks.push(checkAttackBoostPickupRuntime());
    checks.push(checkTurretDeathVfxRuntime());
    checks.push(checkEngineerSupportBracesRuntime());
    checks.push(checkEngineerRapidDetonationRuntime());
    checks.push(checkEngineerMagicTurretRuntime());
    checks.push(checkEngineerLockedTurretRuntime());
    checks.push(checkEngineerCursorVolleyRuntime());
    checks.push(checkTeamThreeVersusThreeRuntime());
    checks.push(checkCatalogSkillRuntimeCoverage());
    checks.push(checkFixedReviewSpawnRuntime());
    checks.push(checkControlLocksMobilityRuntime());
    }
  } finally {
    Date.now = realDateNow;
  }

  for (const check of checks) {
    console.log(`PASS ${check.name}`);
    for (const detail of check.details) {
      console.log(`  - ${detail}`);
    }
  }
}

function checkMageActionWindow(): GameplayCheck {
  const duel = createDuel("mage", "archer", "mage_stack", "target_archer");
  const initialSnapshot = duel.room.snapshotFor(duel.attackerSocket);
  const initialMage = getPlayer(initialSnapshot, duel.attackerId);
  const initialTarget = getPlayer(initialSnapshot, duel.targetId);
  setInput(duel.room, duel.attackerSocket, {
    angle: angleBetween(initialMage, initialTarget),
    aimX: initialTarget.x,
    aimY: initialTarget.y,
    attack: true,
    skillQ: true,
    skillE: true,
    skillR: true
  });

  tick(duel.room);
  const firstSnapshot = duel.room.snapshotFor(duel.attackerSocket);
  const mage = getPlayer(firstSnapshot, duel.attackerId);
  const target = getPlayer(firstSnapshot, duel.targetId);
  const mageUltimateDamage = getEffectiveArenaSkillDamage(
    "mage_12",
    COMBAT.mageUltimateDamage
  );
  const expectedHealth = CLASS_STATS.archer.maxHealth - mageUltimateDamage;

  assert(mage.action === "skillR", `Mage all-button input should resolve as one prioritized R action, got ${mage.action ?? "none"}.`);
  assert(target.health === expectedHealth, `Mage same-tick Q/E/R/basic should deal only R damage. Expected ${expectedHealth}, got ${target.health}.`);
  assert(target.alive, "Mage same-tick action stack killed the target.");
  assert(mage.cooldowns.skillR > firstSnapshot.serverTime, "Mage R cooldown should start after the prioritized action.");
  assert(mage.cooldowns.skillR - firstSnapshot.serverTime === getSkillCooldownMs("mage", "skillR"), `Mage R cooldown should be ${getSkillCooldownMs("mage", "skillR")}ms, got ${mage.cooldowns.skillR - firstSnapshot.serverTime}ms.`);
  assert(mage.cooldowns.skillQ === 0 && mage.cooldowns.skillE === 0, `Mage Q/E cooldowns should stay unused in the same action window: ${JSON.stringify(mage.cooldowns)}.`);
  assert(firstSnapshot.projectiles.length === 0, `Mage all-button input spawned ${firstSnapshot.projectiles.length} projectile(s); basic attack must not fire with a skill.`);

  const firstDamageNumbers = firstSnapshot.effects.filter((effect) => effect.type === "damage_number" && effect.ownerId === duel.attackerId);
  assert(
    firstDamageNumbers.length === 1 && firstDamageNumbers[0].value === mageUltimateDamage,
    `Mage same-tick action should emit one R damage number, got ${JSON.stringify(firstDamageNumbers)}.`
  );

  advance(duel.room, 120);
  const lockedSnapshot = duel.room.snapshotFor(duel.attackerSocket);
  const lockedTarget = getPlayer(lockedSnapshot, duel.targetId);
  assert(lockedTarget.health === expectedHealth, `Mage action lockout allowed extra damage before pose ended. Expected ${expectedHealth}, got ${lockedTarget.health}.`);

  return {
    name: "mage same-action-window damage pacing",
    details: [
      `All-button Mage input resolves to ${mage.action} only.`,
      `Target Archer stays alive at ${target.health}/${target.maxHealth}.`,
      "Q/E/basic do not stack into the same action window."
    ]
  };
}

function checkMageCursorTargetedAreaRuntime(): GameplayCheck {
  const eHitDuel = createDuel("mage", "archer", "mage_e_hit", "target_e_hit");
  placeDuel(eHitDuel, TEST_SPAWN, { x: TEST_SPAWN.x + 120, y: TEST_SPAWN.y });
  castSkillAt(eHitDuel, "skillE", { x: TEST_SPAWN.x + COMBAT.mageBurstRadius + 260, y: TEST_SPAWN.y }, 300);
  const eHitSnapshot = eHitDuel.room.snapshotFor(eHitDuel.attackerSocket);
  const eHitMage = getPlayer(eHitSnapshot, eHitDuel.attackerId);
  const eHitTarget = getPlayer(eHitSnapshot, eHitDuel.targetId);
  const burstEffect = eHitSnapshot.effects.find((effect) => effect.type === "burst" && effect.ownerId === eHitDuel.attackerId);
  assert(eHitTarget.health === CLASS_STATS.archer.maxHealth - getEffectiveArenaSkillDamage("mage_07", COMBAT.mageBurstDamage), `Mage E should hit a nearby target even when the cursor is elsewhere. Got ${eHitTarget.health}.`);
  assert(eHitTarget.stunned, "Mage E caster-centered burst should stun a surviving nearby target.");
  assert(Math.round(burstEffect?.x ?? 0) === Math.round(eHitMage.x) && Math.round(burstEffect?.y ?? 0) === Math.round(eHitMage.y), `Mage E effect should stay centered on the caster, got ${JSON.stringify(burstEffect)}.`);
  const mageBurstCooldownMs = ARENA_SKILL_SPECS.mage_07.cooldownMs;
  assert(eHitMage.cooldowns.skillE - eHitSnapshot.serverTime === mageBurstCooldownMs - 300, `Mage E cooldown should have ${mageBurstCooldownMs - 300}ms remaining after its 300ms intro, got ${eHitMage.cooldowns.skillE - eHitSnapshot.serverTime}ms.`);

  const eMissDuel = createDuel("mage", "archer", "mage_e_miss", "target_e_miss");
  const remoteBurstPoint = { x: TEST_SPAWN.x + COMBAT.mageBurstRadius + 130, y: TEST_SPAWN.y };
  placeDuel(eMissDuel, TEST_SPAWN, remoteBurstPoint);
  castSkillAt(eMissDuel, "skillE", remoteBurstPoint, 300);
  const eMissSnapshot = eMissDuel.room.snapshotFor(eMissDuel.attackerSocket);
  const eMissTarget = getPlayer(eMissSnapshot, eMissDuel.targetId);
  assert(eMissTarget.health === CLASS_STATS.archer.maxHealth, `Mage E should not become cursor-centered and hit a remote target. Got ${eMissTarget.health}.`);

  const rHitDuel = createDuel("mage", "archer", "mage_r_hit", "target_r_hit");
  const remoteStormPoint = { x: TEST_SPAWN.x + COMBAT.mageUltimateRadius + 130, y: TEST_SPAWN.y };
  placeDuel(rHitDuel, TEST_SPAWN, remoteStormPoint);
  castSkillAt(rHitDuel, "skillR", remoteStormPoint, 0);
  const rHitSnapshot = rHitDuel.room.snapshotFor(rHitDuel.attackerSocket);
  const rHitMage = getPlayer(rHitSnapshot, rHitDuel.attackerId);
  const rHitTarget = getPlayer(rHitSnapshot, rHitDuel.targetId);
  const stormEffect = rHitSnapshot.effects.find((effect) => effect.type === "ultimate" && effect.ownerId === rHitDuel.attackerId && effect.classId === "mage");
  assert(rHitTarget.health === CLASS_STATS.archer.maxHealth - getEffectiveArenaSkillDamage("mage_12", COMBAT.mageUltimateDamage), `Mage R cursor storm should hit a remote target inside the aimed radius. Got ${rHitTarget.health}.`);
  assert(rHitMage.cooldowns.skillR - rHitSnapshot.serverTime === getSkillCooldownMs("mage", "skillR"), `Mage R cooldown should be ${getSkillCooldownMs("mage", "skillR")}ms, got ${rHitMage.cooldowns.skillR - rHitSnapshot.serverTime}ms.`);
  assert(Math.round(stormEffect?.x ?? 0) === Math.round(remoteStormPoint.x) && Math.round(stormEffect?.y ?? 0) === Math.round(remoteStormPoint.y), `Mage R effect should spawn at cursor point, got ${JSON.stringify(stormEffect)}.`);

  return {
    name: "mage caster- and cursor-centered area runtime behavior",
    details: [
      "Renewal Burst stays on the caster, damages nearby rivals, and does not follow the cursor.",
      `Clean Storm remains cursor-centered; Mage E/R keep ${getSkillCooldownMs("mage", "skillE") / 1000}s/${getSkillCooldownMs("mage", "skillR") / 1000}s cooldowns.`
    ]
  };
}

function checkMageFullRotationSurvivability(): GameplayCheck {
  const duel = createDuel("mage", "archer", "mage_rotation", "target_archer_rotation");
  placeDuel(duel, TEST_SPAWN, { x: TEST_SPAWN.x + 120, y: TEST_SPAWN.y });
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer & { health: number }>;
  };
  const internalTarget = internals.players.get(duel.targetId);
  assert(Boolean(internalTarget), "Could not find target for Mage rotation audit.");
  internalTarget.health = 1000;

  castSkill(duel, "skillR", 980);
  castSkill(duel, "skillE", 820);
  castSkill(duel, "skillQ", 840);

  const snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const target = getPlayer(snapshot, duel.targetId);
  const expectedDamage =
    getEffectiveArenaSkillDamage("mage_12", COMBAT.mageUltimateDamage) +
    getEffectiveArenaSkillDamage("mage_07", COMBAT.mageBurstDamage) +
    getEffectiveArenaSkillDamage("mage_00", COMBAT.mageBeamDamage);
  const expectedHealth = 1000 - expectedDamage;

  assert(target.health === expectedHealth, `Mage R/E/Q rotation should deal ${expectedDamage} total damage. Expected ${expectedHealth} HP, got ${target.health}.`);
  assert(target.alive, `Mage R/E/Q audit target died unexpectedly at ${target.health}.`);
  assert(!snapshot.events.some((event) => event.type === "kill" && event.actorId === duel.attackerId), "Mage rotation produced a kill event during the survivability audit.");

  return {
    name: "mage full-rotation balanced damage",
    details: [
      `Mage R/E/Q deals ${expectedDamage} through the current offensive/control skill profiles.`,
      "The audit target records the full uncapped three-skill damage total."
    ]
  };
}

function checkMouseAimOverridesStaleAngleRuntime(): GameplayCheck {
  const aimOrigin = { x: 800, y: 800 };
  const warriorDuel = createDuel("warrior", "mage", "aim_warrior", "aim_target_warrior");
  placeDuel(warriorDuel, aimOrigin, { x: aimOrigin.x + COMBAT.meleeRange - 16, y: aimOrigin.y });
  setInput(warriorDuel.room, warriorDuel.attackerSocket, {
    angle: 180,
    aimX: aimOrigin.x + COMBAT.meleeRange - 16,
    aimY: aimOrigin.y,
    attack: true
  });
  tick(warriorDuel.room);
  const warriorTarget = getPlayer(warriorDuel.room.snapshotFor(warriorDuel.attackerSocket), warriorDuel.targetId);
  assert(warriorTarget.health === CLASS_STATS.mage.maxHealth - getEffectiveBasicAttackDamage("warrior"), `Warrior basic should follow cursor aim, not stale input angle. Got target HP ${warriorTarget.health}.`);

  const engineerDuel = createDuel("engineer", "mage", "aim_engineer", "aim_target_engineer");
  placeDuel(engineerDuel, aimOrigin, { x: aimOrigin.x + COMBAT.meleeRange - 16, y: aimOrigin.y });
  setInput(engineerDuel.room, engineerDuel.attackerSocket, {
    angle: 180,
    aimX: aimOrigin.x + COMBAT.meleeRange - 16,
    aimY: aimOrigin.y,
    attack: true
  });
  tick(engineerDuel.room);
  const engineerTarget = getPlayer(engineerDuel.room.snapshotFor(engineerDuel.attackerSocket), engineerDuel.targetId);
  assert(engineerTarget.health === CLASS_STATS.mage.maxHealth - getEffectiveBasicAttackDamage("engineer"), `Engineer basic should follow cursor aim, not stale input angle. Got target HP ${engineerTarget.health}.`);

  const archerDuel = createDuel("archer", "mage", "aim_archer", "aim_target_archer");
  placeDuel(archerDuel, aimOrigin, { x: aimOrigin.x + 420, y: aimOrigin.y });
  setInput(archerDuel.room, archerDuel.attackerSocket, {
    angle: 180,
    aimX: aimOrigin.x + 420,
    aimY: aimOrigin.y,
    attack: true
  });
  tick(archerDuel.room);
  setInput(archerDuel.room, archerDuel.attackerSocket, {
    angle: 180,
    aimX: aimOrigin.x + 420,
    aimY: aimOrigin.y,
    attack: false
  });
  tick(archerDuel.room);
  const archerProjectile = archerDuel.room.snapshotFor(archerDuel.attackerSocket).projectiles.find((projectile) => projectile.ownerId === archerDuel.attackerId);
  assert(Boolean(archerProjectile), "Archer mouse-aim audit should spawn an arrow projectile after draw release.");
  assert(Math.abs((archerProjectile?.angle ?? 999) - 0) < 1, `Archer arrow should fly toward cursor aim angle 0, got ${archerProjectile?.angle}.`);

  const mageDuel = createDuel("mage", "archer", "aim_mage", "aim_target_mage");
  placeDuel(mageDuel, aimOrigin, { x: aimOrigin.x + 360, y: aimOrigin.y });
  setInput(mageDuel.room, mageDuel.attackerSocket, {
    angle: 180,
    aimX: aimOrigin.x + 360,
    aimY: aimOrigin.y,
    skillQ: true
  });
  tick(mageDuel.room);
  const mageBeamTarget = getPlayer(mageDuel.room.snapshotFor(mageDuel.attackerSocket), mageDuel.targetId);
  assert(mageBeamTarget.health === CLASS_STATS.archer.maxHealth - getEffectiveArenaSkillDamage("mage_00", COMBAT.mageBeamDamage), `Mage Q should fire toward cursor aim, not stale input angle. Got target HP ${mageBeamTarget.health}.`);

  return {
    name: "mouse aim overrides stale attack angle",
    details: [
      "Warrior and Engineer melee basics hit toward cursor aim even if the submitted stale angle points backward.",
      `Archer arrow spawned at ${Math.round(archerProjectile?.angle ?? 999)} degrees toward cursor aim.`,
      "Mage Q beam hits the cursor-side target."
    ]
  };
}

function checkArcherProjectileBodyHurtboxRuntime(): GameplayCheck {
  const headDuel = createDuel("archer", "mage", "archer_body_hit", "target_body_hit");
  const targetPoint = { x: OPEN_FIELD_TEST_POINT.x + 420, y: OPEN_FIELD_TEST_POINT.y };
  placeDuel(headDuel, OPEN_FIELD_TEST_POINT, targetPoint);
  fireArcherArrowAt(headDuel, { x: targetPoint.x, y: targetPoint.y - 78 });
  advanceFrames(headDuel.room, 740);
  const headTarget = getPlayer(headDuel.room.snapshotFor(headDuel.attackerSocket), headDuel.targetId);
  assert(
    headTarget.health === CLASS_STATS.mage.maxHealth - getArcherChargedArrowDamageForStage(1),
    `Archer arrow aimed through the upper body should hit the player hurtbox. Got target HP ${headTarget.health}.`
  );

  const highDuel = createDuel("archer", "mage", "archer_body_miss", "target_body_miss");
  placeDuel(highDuel, OPEN_FIELD_TEST_POINT, targetPoint);
  fireArcherArrowAt(highDuel, { x: targetPoint.x, y: targetPoint.y - 142 });
  advanceFrames(highDuel.room, 740);
  const highTarget = getPlayer(highDuel.room.snapshotFor(highDuel.attackerSocket), highDuel.targetId);
  assert(
    highTarget.health === CLASS_STATS.mage.maxHealth,
    `Archer arrow aimed clearly above the sprite should miss instead of using an oversized circle. Got target HP ${highTarget.health}.`
  );

  return {
    name: "archer projectile body hurtbox",
    details: [
      "Arrow sweep uses the player's upper-body hurtbox, so shots through the head/chest register.",
      "Shots clearly above the sprite still miss, keeping the hurtbox from becoming an oversized circle."
    ]
  };
}

function checkMageBeamMovementLockRuntime(): GameplayCheck {
  const duel = createDuel("mage", "archer", "mage_q_lock", "mage_q_target");
  placeDuel(duel, TEST_SPAWN, { x: TEST_SPAWN.x + 360, y: TEST_SPAWN.y });
  setInput(duel.room, duel.attackerSocket, {
    moveX: 1,
    aimX: TEST_SPAWN.x + 360,
    aimY: TEST_SPAWN.y,
    skillQ: true
  });
  tick(duel.room);
  const castSnapshot = duel.room.snapshotFor(duel.attackerSocket);
  const afterCast = getPlayer(castSnapshot, duel.attackerId);
  const beam = castSnapshot.effects.find(
    (effect) => effect.type === "beam" && effect.ownerId === duel.attackerId
  );
  assert(Math.abs(afterCast.x - TEST_SPAWN.x) < 0.01, `Mage should not move on the Q cast tick. Expected x ${TEST_SPAWN.x}, got ${afterCast.x}.`);
  assert(
    beam?.endX !== undefined && beam.endY !== undefined,
    "Mage Q should expose its fixed beam endpoint."
  );
  assert(
    Math.abs(
      distanceBetween(
        beam,
        { x: beam.endX, y: beam.endY }
      ) - COMBAT.mageBeamLength
    ) < 0.01,
    `Mage Q should remain ${COMBAT.mageBeamLength} units long after hitting a nearer target.`
  );

  setInput(duel.room, duel.attackerSocket, {
    moveX: 1,
    aimX: TEST_SPAWN.x + 360,
    aimY: TEST_SPAWN.y
  });
  tick(duel.room, 420);
  const duringLock = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(Math.abs(duringLock.x - TEST_SPAWN.x) < 0.01, `Mage should stay locked during the Q beam pose. Expected x ${TEST_SPAWN.x}, got ${duringLock.x}.`);

  tick(duel.room, 620);
  const afterLock = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(afterLock.x > TEST_SPAWN.x + 10, `Mage should move again after Q lock ends. Got x ${afterLock.x}.`);

  return {
    name: "mage Q movement lock",
    details: [
      "Mage cannot drift during Solar Beam startup or active pose.",
      `Mage resumes movement after the Q lock and reaches x=${Math.round(afterLock.x)}.`
    ]
  };
}

function checkArcherStarSnipeMovementLockRuntime(): GameplayCheck {
  const duel = createDuel("archer", "mage", "archer_star_lock", "star_lock_target");
  placeDuel(duel, TEST_SPAWN, { x: TEST_SPAWN.x + 360, y: TEST_SPAWN.y });
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer & { catalogLoadout: ReturnType<typeof getDefaultArenaCatalogLoadout> }>;
  };
  const attacker = internals.players.get(duel.attackerId);
  assert(Boolean(attacker), "Star Snipe movement-lock audit could not find its Archer.");
  attacker.catalogLoadout = { ...attacker.catalogLoadout, skillR: "archer_12" };

  setInput(duel.room, duel.attackerSocket, {
    moveX: 1,
    aimX: TEST_SPAWN.x + 360,
    aimY: TEST_SPAWN.y,
    skillR: true
  });
  tick(duel.room);
  const castSnapshot = duel.room.snapshotFor(duel.attackerSocket);
  const afterCast = getPlayer(castSnapshot, duel.attackerId);
  const effect = castSnapshot.effects.find(
    (candidate) =>
      candidate.type === "catalog_skill" &&
      candidate.skillId === "archer_12" &&
      candidate.ownerId === duel.attackerId
  );
  assert(
    Math.abs(afterCast.x - TEST_SPAWN.x) < 0.01,
    `Archer should not move on the Star Snipe cast tick. Got x ${afterCast.x}.`
  );
  assert(afterCast.actionSkillId === "archer_12", `Star Snipe should own the cast pose, got ${afterCast.actionSkillId ?? "none"}.`);
  assert(effect?.duration === 1100, `Star Snipe should keep its complete 1100ms visual, got ${effect?.duration ?? "missing"}.`);

  setInput(duel.room, duel.attackerSocket, {
    moveX: 1,
    aimX: TEST_SPAWN.x + 360,
    aimY: TEST_SPAWN.y
  });
  tick(duel.room, 500);
  const duringLock = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(
    Math.abs(duringLock.x - TEST_SPAWN.x) < 0.01,
    `Archer should stay fixed while Star Snipe is active. Got x ${duringLock.x}.`
  );

  tick(duel.room, 650);
  const afterLock = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(
    afterLock.x > TEST_SPAWN.x + 10,
    `Archer should move again after Star Snipe ends. Got x ${afterLock.x}.`
  );

  return {
    name: "Archer Star Snipe cast movement lock",
    details: [
      "Archer stays fixed for the complete 1.1-second warning, sky strike, and impact sequence.",
      "Movement resumes immediately after the authored cast window."
    ]
  };
}

function checkArcherCursorTargetedAreaRuntime(): GameplayCheck {
  const eMissDuel = createDuel("archer", "mage", "archer_e_miss", "target_e_miss");
  placeDuel(eMissDuel, TEST_SPAWN, { x: TEST_SPAWN.x + 120, y: TEST_SPAWN.y });
  castSkillAt(eMissDuel, "skillE", { x: TEST_SPAWN.x + COMBAT.archerRootRadius + 260, y: TEST_SPAWN.y }, 0);
  const eMissTarget = getPlayer(eMissDuel.room.snapshotFor(eMissDuel.attackerSocket), eMissDuel.targetId);
  assert(!eMissTarget.rooted, "Archer E should not root a nearby target when the cursor root field is elsewhere.");

  const eHitDuel = createDuel("archer", "mage", "archer_e_hit", "target_e_hit");
  const rootPoint = { x: TEST_SPAWN.x + COMBAT.archerRootRadius + 120, y: TEST_SPAWN.y };
  placeDuel(eHitDuel, TEST_SPAWN, rootPoint);
  castSkillAt(eHitDuel, "skillE", rootPoint, 0);
  const eHitSnapshot = eHitDuel.room.snapshotFor(eHitDuel.attackerSocket);
  const eHitTarget = getPlayer(eHitSnapshot, eHitDuel.targetId);
  const rootCast = eHitSnapshot.effects.find((effect) => effect.type === "root_cast" && effect.ownerId === eHitDuel.attackerId);
  const targetRoot = eHitSnapshot.effects.find(
    (effect) =>
      effect.type === "catalog_skill" &&
      effect.skillId === "archer_08" &&
      effect.ownerId === eHitDuel.attackerId
  );
  assert(eHitTarget.rooted, "Archer E cursor field should root a target inside the aimed area.");
  assert(!rootCast, `Archer E should not emit the old oversized root_cast world VFX, got ${JSON.stringify(rootCast)}.`);
  assert(Boolean(targetRoot), "Archer E should show a compact root VFX under each rooted target.");

  const rHitDuel = createDuel("archer", "mage", "archer_seed", "target_mage");
  const seedPoint = { x: TEST_SPAWN.x + COMBAT.archerUltimateRadius + 120, y: TEST_SPAWN.y };
  placeDuel(rHitDuel, TEST_SPAWN, seedPoint);
  castSkillAt(rHitDuel, "skillR", seedPoint, 0);

  const castSnapshot = rHitDuel.room.snapshotFor(rHitDuel.attackerSocket);
  const archer = getPlayer(castSnapshot, rHitDuel.attackerId);
  const castTarget = getPlayer(castSnapshot, rHitDuel.targetId);
  const ultimate = castSnapshot.effects.find(
    (effect) =>
      effect.type === "catalog_skill" &&
      effect.skillId === "archer_13" &&
      effect.ownerId === rHitDuel.attackerId
  );
  const event = castSnapshot.events.find((combatEvent) => combatEvent.type === "ultimate" && combatEvent.actorId === rHitDuel.attackerId);

  assert(archer.action === "skillR", `Archer Seed Rain should put Archer into skillR action, got ${archer.action ?? "none"}.`);
  assert(castTarget.health === CLASS_STATS.mage.maxHealth, `Archer Seed Rain should wait 0.5 seconds before its first hit. Expected full HP ${CLASS_STATS.mage.maxHealth}, got ${castTarget.health}.`);
  assert(Boolean(ultimate), "Archer Seed Rain did not emit its accepted catalog animation effect.");
  assert(ultimate?.radius === COMBAT.archerUltimateRadius, `Archer Seed Rain radius mismatch: ${ultimate?.radius ?? "missing"}.`);
  assert(ultimate?.duration === 3000, `Archer Seed Rain should loop for exactly 3000ms, got ${ultimate?.duration ?? "missing"}.`);
  assert(Math.round(ultimate?.x ?? 0) === Math.round(seedPoint.x) && Math.round(ultimate?.y ?? 0) === Math.round(seedPoint.y), `Archer Seed Rain effect should spawn at cursor point, got ${JSON.stringify(ultimate)}.`);
  assert(event?.message.includes("種子雨"), `Archer ultimate event should identify 種子雨, got ${event?.message ?? "missing"}.`);
  assert(archer.cooldowns.skillR > castSnapshot.serverTime, "Archer R cooldown should start after Seed Rain.");

  advance(rHitDuel.room, 499);
  const beforeFirstTick = getPlayer(rHitDuel.room.snapshotFor(rHitDuel.attackerSocket), rHitDuel.targetId);
  assert(beforeFirstTick.health === CLASS_STATS.mage.maxHealth, `Seed Rain damaged before 0.5 seconds: ${beforeFirstTick.health}.`);

  const seedRainTickDamage = getEffectiveArenaSkillDamage(
    "archer_13",
    COMBAT.archerUltimateDamage
  );
  const expectedHealthByTick = [1, 2, 3].map(
    (tickCount) => CLASS_STATS.mage.maxHealth - seedRainTickDamage * tickCount
  );
  advance(rHitDuel.room, 1);
  const firstTickTarget = getPlayer(rHitDuel.room.snapshotFor(rHitDuel.attackerSocket), rHitDuel.targetId);
  assert(firstTickTarget.health === expectedHealthByTick[0], `Seed Rain first ${seedRainTickDamage}-damage tick should land at 0.5 seconds. Expected ${expectedHealthByTick[0]}, got ${firstTickTarget.health}.`);

  advance(rHitDuel.room, 999);
  const beforeSecondTick = getPlayer(rHitDuel.room.snapshotFor(rHitDuel.attackerSocket), rHitDuel.targetId);
  assert(beforeSecondTick.health === expectedHealthByTick[0], `Seed Rain applied a second hit before 1.5 seconds: ${beforeSecondTick.health}.`);
  advance(rHitDuel.room, 1);
  const secondTickTarget = getPlayer(rHitDuel.room.snapshotFor(rHitDuel.attackerSocket), rHitDuel.targetId);
  assert(secondTickTarget.health === expectedHealthByTick[1], `Seed Rain second ${seedRainTickDamage}-damage tick should land at 1.5 seconds. Expected ${expectedHealthByTick[1]}, got ${secondTickTarget.health}.`);

  advance(rHitDuel.room, 999);
  const beforeThirdTick = getPlayer(rHitDuel.room.snapshotFor(rHitDuel.attackerSocket), rHitDuel.targetId);
  assert(beforeThirdTick.health === expectedHealthByTick[1], `Seed Rain applied a third hit before 2.5 seconds: ${beforeThirdTick.health}.`);
  advance(rHitDuel.room, 1);
  const thirdTickTarget = getPlayer(rHitDuel.room.snapshotFor(rHitDuel.attackerSocket), rHitDuel.targetId);
  assert(thirdTickTarget.health === expectedHealthByTick[2], `Seed Rain third ${seedRainTickDamage}-damage tick should land at 2.5 seconds. Expected ${expectedHealthByTick[2]}, got ${thirdTickTarget.health}.`);
  assert(thirdTickTarget.alive, "Three Seed Rain ticks should not one-shot Mage.");

  return {
    name: "archer cursor-targeted area runtime behavior",
    details: [
      "Root Bind misses near-caster targets when aimed elsewhere and only shows compact root VFX under rooted targets.",
      `Seed Rain emits Archer ultimate radius ${ultimate?.radius} at the cursor for ${ultimate?.duration}ms.`,
      `Seed Rain lands three ${seedRainTickDamage}-damage ticks at 0.5s, 1.5s and 2.5s; target Mage stays alive at ${thirdTickTarget.health}/${thirdTickTarget.maxHealth}.`
    ]
  };
}

function checkDeathClassSwitchRuntime(): GameplayCheck {
  const duel = createDuel("warrior", "mage", "switch_warrior", "switch_attacker");
  const earlySwitch = duel.room.switchHumanClass(
    duel.attackerSocket,
    "mage",
    getDefaultArenaLoadout("mage"),
    getDefaultArenaCatalogLoadout("mage")
  );
  assert(!earlySwitch, "Class switch should be rejected while the player is alive during an active round.");

  const internals = duel.room as unknown as {
    players: Map<string, unknown>;
    killPlayer: (target: unknown, attackerId: string, now?: number) => void;
  };
  const playerEntity = internals.players.get(duel.attackerId);
  assert(Boolean(playerEntity), "Could not find switch audit player entity.");
  internals.killPlayer(playerEntity, duel.targetId, fakeNow);

  const deadBeforeSwitch = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(!deadBeforeSwitch.alive && deadBeforeSwitch.classId === "warrior", "Switch audit player should be dead as Warrior before class change.");

  const switched = duel.room.switchHumanClass(
    duel.attackerSocket,
    "mage",
    getDefaultArenaLoadout("mage"),
    getDefaultArenaCatalogLoadout("mage")
  );
  assert(switched, "Class switch should be accepted while the player is knocked out.");
  const deadAfterSwitch = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(deadAfterSwitch.classId === "mage", `Dead player snapshot should update to Mage, got ${deadAfterSwitch.classId}.`);
  assert(deadAfterSwitch.maxHealth === CLASS_STATS.mage.maxHealth, `Dead switched player should expose Mage max HP ${CLASS_STATS.mage.maxHealth}, got ${deadAfterSwitch.maxHealth}.`);
  assert(deadAfterSwitch.health === 0, `Dead switched player should remain at 0 HP until respawn, got ${deadAfterSwitch.health}.`);

  advance(duel.room, WORLD.respawnMs + 50);
  const respawned = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(respawned.alive, "Switched player should respawn after the respawn timer.");
  assert(respawned.classId === "mage", `Respawned player should stay Mage, got ${respawned.classId}.`);
  assert(respawned.health === CLASS_STATS.mage.maxHealth && respawned.maxHealth === CLASS_STATS.mage.maxHealth, `Respawned Mage HP mismatch: ${respawned.health}/${respawned.maxHealth}.`);

  return {
    name: "death class-switch runtime behavior",
    details: [
      "Alive class switching is rejected during play.",
      `Knocked-out Warrior can switch to Mage and respawns at ${respawned.health}/${respawned.maxHealth} HP.`
    ]
  };
}

function checkBotArcherChargedReleaseRuntime(): GameplayCheck {
  fakeNow += 25_000;
  const room = new GameRoom();
  const joined = room.addHuman("bot_archer_target", {
    name: "BOT_ARCHER_TARGET",
    classId: "mage",
    loadout: getDefaultArenaLoadout("mage"),
    catalogLoadout: getDefaultArenaCatalogLoadout("mage")
  });
  const internals = room as unknown as {
    players: Map<string, PublicPlayer & {
      alive: boolean;
      respawnAt: number;
      spawnGuardEndsAt: number;
      spawnProtected: boolean;
      cooldowns: Record<string, number>;
      aiNextDecisionAt: number;
      archerChargeStartedAt: number;
    }>;
  };
  const target = internals.players.get(joined.playerId);
  const archer = internals.players.get("bot_2");
  assert(Boolean(target) && Boolean(archer), "Bot archer release audit could not find the human target and bot_2.");
  assert(archer.classId === "archer", `Bot release audit expected bot_2 to be Archer, got ${archer.classId}.`);

  for (const bot of internals.players.values()) {
    if (bot.bot && bot.id !== archer.id) {
      bot.alive = false;
      bot.respawnAt = Number.MAX_SAFE_INTEGER;
    }
  }

  archer.x = TEST_SPAWN.x;
  archer.y = TEST_SPAWN.y;
  archer.aiNextDecisionAt = 0;
  archer.cooldowns = {
    skillF: Number.MAX_SAFE_INTEGER,
    skillQ: Number.MAX_SAFE_INTEGER,
    skillE: Number.MAX_SAFE_INTEGER,
    skillR: Number.MAX_SAFE_INTEGER
  };
  target.x = TEST_SPAWN.x + 420;
  target.y = TEST_SPAWN.y;
  target.spawnGuardEndsAt = 0;
  target.spawnProtected = false;

  tick(room);
  assert(archer.archerChargeStartedAt > 0, "Archer bot should start drawing the bow when a live target is in range.");

  const fullChargeMs = (COMBAT.archerChargeStages - 1) * COMBAT.archerChargeStageMs;
  advance(room, fullChargeMs + 220);
  const snapshot = room.snapshotFor("bot_archer_target");
  const arrows = snapshot.projectiles.filter((projectile) => projectile.ownerId === archer.id && projectile.type === "arrow");

  assert(arrows.length > 0, "Archer bot should release a fully charged arrow instead of holding attack forever.");
  assert(archer.archerChargeStartedAt === 0, "Archer bot charge state should reset after firing.");

  return {
    name: "bot Archer full-charge release runtime behavior",
    details: [
      `Bot Archer releases after ${COMBAT.archerChargeStages} charge stages.`,
      `Snapshot contains ${arrows.length} Archer arrow projectile(s).`
    ]
  };
}

function checkSharedArenaBotReplacementRuntime(): GameplayCheck {
  fakeNow += 25_000;
  const room = new GameRoom();

  assert(room.playerCount() === 0, `Fresh shared arena should start with 0 humans, got ${room.playerCount()}.`);
  assert(room.botCount() === 8, `Fresh shared arena should keep 8 idle bots, got ${room.botCount()}.`);

  const firstSocket = "shared_human_one";
  const secondSocket = "shared_human_two";
  const first = room.addHuman(firstSocket, {
    name: "HUMAN_ONE",
    classId: "warrior",
    loadout: getDefaultArenaLoadout("warrior"),
    catalogLoadout: getDefaultArenaCatalogLoadout("warrior")
  });
  assert(room.playerCount() === 1, `Shared arena should have 1 human after first join, got ${room.playerCount()}.`);
  assert(room.botCount() === 7, `First human should replace one bot, got ${room.botCount()} bots.`);
  assert(room.snapshotFor(firstSocket).players.length === 8, "First shared arena snapshot should still expose 8 total combatants.");

  const second = room.addHuman(secondSocket, {
    name: "HUMAN_TWO",
    classId: "mage",
    loadout: getDefaultArenaLoadout("mage"),
    catalogLoadout: getDefaultArenaCatalogLoadout("mage")
  });
  assert(room.playerCount() === 2, `Shared arena should have 2 humans after second join, got ${room.playerCount()}.`);
  assert(room.botCount() === 6, `Second human should replace a second bot, got ${room.botCount()} bots.`);
  assert(room.snapshotFor(secondSocket).players.length === 8, "Second shared arena snapshot should keep the room population at 8.");

  room.removeHuman(firstSocket);
  assert(room.playerCount() === 1, `Shared arena should have 1 human after first leave, got ${room.playerCount()}.`);
  assert(room.botCount() === 7, `One bot should refill after a human leaves, got ${room.botCount()} bots.`);
  assert(room.snapshotFor(secondSocket).players.some((player) => player.id === second.playerId), "Remaining human should stay in the same shared arena after another human leaves.");

  room.removeHuman(secondSocket);
  assert(room.playerCount() === 0, `Shared arena should have 0 humans after all leave, got ${room.playerCount()}.`);
  assert(room.botCount() === 8, `Shared arena should refill to 8 idle bots after all humans leave, got ${room.botCount()} bots.`);

  return {
    name: "shared arena bot replacement runtime behavior",
    details: [
      `Human joins replace bots: first ${first.playerId} -> 7 bots, second ${second.playerId} -> 6 bots.`,
      "Bot population refills when humans leave the shared room."
    ]
  };
}

function checkWarriorDirectionalMeleeRuntime(): GameplayCheck {
  const duel = createDuel("warrior", "mage", "slash_warrior", "slash_target");
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer & { action: unknown; actionStartedAt: number; actionEndsAt: number; actionPoseEndsAt: number; attacking: boolean; lastAttackAt: number }>;
  };
  const attacker = internals.players.get(duel.attackerId);
  const target = internals.players.get(duel.targetId);
  assert(Boolean(attacker) && Boolean(target), "Could not find players for Warrior directional melee audit.");

  const safeOrigin = { x: 800, y: 1000 };
  attacker.x = safeOrigin.x;
  attacker.y = safeOrigin.y;
  target.x = safeOrigin.x + COMBAT.meleeRange - 16;
  target.y = safeOrigin.y;
  target.health = CLASS_STATS.mage.maxHealth;
  setInput(duel.room, duel.attackerSocket, { angle: 0, aimX: target.x, aimY: target.y, attack: true });
  tick(duel.room);

  const frontHit = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  const expectedFrontHealth =
    CLASS_STATS.mage.maxHealth - getEffectiveBasicAttackDamage("warrior");
  assert(frontHit.health === expectedFrontHealth, `Warrior aimed slash should hit the target in front. Expected ${expectedFrontHealth}, got ${frontHit.health}.`);

  clearActionLock(attacker);
  attacker.x = safeOrigin.x;
  attacker.y = safeOrigin.y;
  target.x = safeOrigin.x - COMBAT.meleeRange + 16;
  target.y = safeOrigin.y;
  target.health = CLASS_STATS.mage.maxHealth;
  setInput(duel.room, duel.attackerSocket, { angle: 0, aimX: safeOrigin.x + COMBAT.meleeRange, aimY: safeOrigin.y, attack: true });
  tick(duel.room);

  const backMiss = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  assert(backMiss.health === CLASS_STATS.mage.maxHealth, `Warrior aimed slash should miss the target behind the mouse direction. Got ${backMiss.health}.`);

  return {
    name: "warrior directional melee runtime behavior",
    details: [
      `Forward slash deals ${getEffectiveBasicAttackDamage("warrior")} damage.`,
      "A target behind the same-radius melee range is not hit."
    ]
  };
}

function checkWarriorRedesignRuntime(): GameplayCheck {
  const swordWaveDuel = createDuel(
    "warrior",
    "warrior",
    "warrior_sword_wave",
    "warrior_sword_wave_target"
  );
  const swordWaveInternals = swordWaveDuel.room as unknown as {
    players: Map<
      string,
      PublicPlayer & {
        health: number;
        spawnGuardEndsAt: number;
        spawnProtected: boolean;
        action: unknown;
        actionStartedAt: number;
        actionEndsAt: number;
        actionPoseEndsAt: number;
        attacking: boolean;
        lastAttackAt: number;
      }
    >;
    projectiles: Array<{
      skillId?: string;
      type: string;
      damage: number;
      speed: number;
      maxDistance: number;
      remainingHits?: number;
    }>;
  };
  const swordWaveAttacker = swordWaveInternals.players.get(
    swordWaveDuel.attackerId
  );
  const swordWaveTarget = swordWaveInternals.players.get(
    swordWaveDuel.targetId
  );
  assert(
    Boolean(swordWaveAttacker) && Boolean(swordWaveTarget),
    "Could not find players for Warrior sword-wave audit."
  );
  swordWaveAttacker.catalogLoadout = {
    ...swordWaveAttacker.catalogLoadout,
    skillQ: "warrior_00"
  };
  placeDuel(
    swordWaveDuel,
    OPEN_FIELD_TEST_POINT,
    { x: OPEN_FIELD_TEST_POINT.x + 270, y: OPEN_FIELD_TEST_POINT.y }
  );
  const swordWaveTargetHealth = swordWaveTarget.health;
  castSkill(swordWaveDuel, "skillQ", 0);
  const swordWave = swordWaveInternals.projectiles.find(
    (projectile) => projectile.skillId === "warrior_00"
  );
  assert(Boolean(swordWave), "Guarding Slash did not spawn its sword-wave projectile.");
  assert(
    swordWave.type === "sword_wave" &&
      swordWave.damage === 20 &&
      swordWave.speed === 650 &&
      swordWave.maxDistance === 400 &&
      swordWave.remainingHits === 99,
    `Sword-wave contract mismatch: ${JSON.stringify(swordWave)}.`
  );
  advanceFrames(swordWaveDuel.room, 520);
  assert(
    swordWaveTarget.health ===
      swordWaveTargetHealth - getEffectiveArenaSkillDamage("warrior_00", 20),
    `Sword wave should apply the Warrior-balanced damage after travelling to the target; target HP is ${swordWaveTarget.health}.`
  );

  const speedDuel = createDuel(
    "warrior",
    "warrior",
    "warrior_hammer_speed",
    "warrior_hammer_speed_target"
  );
  const speedInternals = speedDuel.room as unknown as {
    players: Map<
      string,
      PublicPlayer & {
        moveSpeedBoostEndsAt: number;
        blazingRampageDamageBoostEndsAt: number;
      }
    >;
    getBoostedOutgoingDamage: (
      rawDamage: number,
      attackerId: string,
      now: number
    ) => number;
  };
  const speedAttacker = speedInternals.players.get(speedDuel.attackerId);
  assert(Boolean(speedAttacker), "Could not find Warrior for hammer-speed audit.");
  speedAttacker.catalogLoadout = {
    ...speedAttacker.catalogLoadout,
    skillQ: "warrior_01"
  };
  speedAttacker.x = OPEN_FIELD_TEST_POINT.x;
  speedAttacker.y = OPEN_FIELD_TEST_POINT.y;
  castSkill(speedDuel, "skillQ", 0);
  const speedCastAt = fakeNow;
  assert(
    speedAttacker.moveSpeedBoostEndsAt - speedCastAt === 5000,
    `Blazing Rampage speed state should last 5000ms, got ${speedAttacker.moveSpeedBoostEndsAt - speedCastAt}ms.`
  );
  assert(
    speedAttacker.blazingRampageDamageBoostEndsAt - speedCastAt === 5000,
    `Blazing Rampage damage state should last 5000ms, got ${speedAttacker.blazingRampageDamageBoostEndsAt - speedCastAt}ms.`
  );
  assert(
    speedInternals.getBoostedOutgoingDamage(20, speedDuel.attackerId, speedCastAt) ===
      Math.ceil(
        20 *
          getClassDamageMultiplier("warrior") *
          (ARENA_SKILL_SPECS.warrior_01.numbers.damageMultiplier ?? 1)
      ),
    "Blazing Rampage should apply the current Warrior basic-damage multiplier and its declared damage boost."
  );
  assert(
    speedInternals.getBoostedOutgoingDamage(
      20,
      speedDuel.attackerId,
      speedAttacker.blazingRampageDamageBoostEndsAt
    ) === getEffectiveClassDamage("warrior", 20),
    "Blazing Rampage damage bonus should stop at the declared five-second endpoint and return to the current Warrior baseline."
  );
  const ragingPublicPlayer = getPlayer(
    speedDuel.room.snapshotFor(speedDuel.attackerSocket),
    speedDuel.attackerId
  );
  assert(
    ragingPublicPlayer.attackBoosted &&
      ragingPublicPlayer.statuses.some((status) => status.id === "attack_boost"),
    "Blazing Rampage should expose its positive damage state through the shared attack-boost status."
  );
  const speedEffect = speedDuel.room
    .snapshotFor(speedDuel.attackerSocket)
    .effects.find(
      (effect) =>
        effect.type === "catalog_skill" &&
        effect.skillId === "warrior_01" &&
        effect.ownerId === speedDuel.attackerId
    );
  assert(
    speedEffect?.duration === 5000,
    `Blazing Rampage fire aura should follow the player for 5000ms, got ${speedEffect?.duration}.`
  );
  setInput(speedDuel.room, speedDuel.attackerSocket, {
    moveX: 1,
    moveY: 0,
    aimX: speedAttacker.x + 500,
    aimY: speedAttacker.y
  });
  const speedStartX = speedAttacker.x;
  advanceFrames(speedDuel.room, 1000);
  const boostedTravel = speedAttacker.x - speedStartX;
  const expectedBoostedTravel = CLASS_STATS.warrior.moveSpeed * 1.25;
  assert(
    Math.abs(boostedTravel - expectedBoostedTravel) <= 8,
    `Blazing Rampage should move about ${expectedBoostedTravel}px in one second, got ${boostedTravel.toFixed(1)}.`
  );

  const enchantDuel = createDuel(
    "warrior",
    "warrior",
    "warrior_triple_enchant",
    "warrior_triple_enchant_target"
  );
  const enchantInternals = enchantDuel.room as unknown as {
    players: Map<
      string,
      PublicPlayer & {
        enchantedMeleeHitsRemaining: number;
        enchantedMeleeEndsAt: number;
        stunEndsAt: number;
        health: number;
        action: unknown;
        actionStartedAt: number;
        actionEndsAt: number;
        actionPoseEndsAt: number;
        attacking: boolean;
        lastAttackAt: number;
      }
    >;
  };
  const enchantAttacker = enchantInternals.players.get(enchantDuel.attackerId);
  const enchantTarget = enchantInternals.players.get(enchantDuel.targetId);
  assert(
    Boolean(enchantAttacker) && Boolean(enchantTarget),
    "Could not find players for triple-enchant audit."
  );
  enchantAttacker.catalogLoadout = {
    ...enchantAttacker.catalogLoadout,
    skillQ: "warrior_03"
  };
  placeDuel(
    enchantDuel,
    OPEN_FIELD_TEST_POINT,
    {
      x: OPEN_FIELD_TEST_POINT.x + COMBAT.meleeRange - 16,
      y: OPEN_FIELD_TEST_POINT.y
    }
  );
  enchantTarget.health = 1000;
  const enchantTargetHealth = enchantTarget.health;
  castSkill(enchantDuel, "skillQ", 0);
  assert(
    enchantAttacker.enchantedMeleeHitsRemaining === 3 &&
      enchantAttacker.enchantedMeleeEndsAt - fakeNow === 6000,
    "Blade Enchant should arm exactly three enhanced attacks for six seconds."
  );
  const enchantCastSnapshot = enchantDuel.room.snapshotFor(
    enchantDuel.attackerSocket
  );
  const enchantPublicAttacker = enchantCastSnapshot.players.find(
    (player) => player.id === enchantDuel.attackerId
  );
  assert(
    enchantPublicAttacker?.enchantedMeleeHitsRemaining === 3,
    "Blade Enchant should expose three remaining attacks for the overhead counter."
  );
  assert(
    !enchantCastSnapshot.effects.some(
      (effect) =>
        effect.type === "catalog_skill" &&
        effect.skillId === "warrior_03" &&
        effect.ownerId === enchantDuel.attackerId
    ),
    "Blade Enchant should not spawn the old blue-sword catalog VFX."
  );
  const enchantedHitDamage: number[] = [];
  for (let hit = 1; hit <= 3; hit += 1) {
    const healthBeforeHit = enchantTarget.health;
    clearActionLock(enchantAttacker);
    setInput(enchantDuel.room, enchantDuel.attackerSocket, {
      attack: true,
      aimX: enchantTarget.x,
      aimY: enchantTarget.y
    });
    tick(enchantDuel.room);
    setInput(enchantDuel.room, enchantDuel.attackerSocket, {});
    assert(
      enchantAttacker.enchantedMeleeHitsRemaining === 3 - hit,
      `Enhanced attack ${hit} should leave ${3 - hit} charge(s), got ${enchantAttacker.enchantedMeleeHitsRemaining}.`
    );
    assert(
      enchantAttacker.actionSkillId === null,
      `Enhanced attack ${hit} should retain the normal Warrior basic-attack body.`
    );
    enchantedHitDamage.push(healthBeforeHit - enchantTarget.health);
    if (hit < 3) {
      assert(
        enchantTarget.stunEndsAt <= fakeNow,
        `Enhanced attack ${hit} must not stun before the third hit.`
      );
    }
  }
  assert(
    enchantedHitDamage.every(
      (damage, index) => damage === COMBAT.warriorBladeEnchantDamage[index]
    ),
    `Blade Enchant should deal ${COMBAT.warriorBladeEnchantDamage.join("/")}; got ${enchantedHitDamage.join("/")}.`
  );
  assert(
    enchantTarget.health ===
      enchantTargetHealth -
        COMBAT.warriorBladeEnchantDamage.reduce(
          (total, damage) => total + damage,
          0
        ),
    `Blade Enchant total damage should match its three-hit preset; target HP is ${enchantTarget.health}.`
  );
  assert(
    enchantTarget.stunEndsAt - fakeNow === 1000,
    `Third enchanted basic should stun for 1000ms, got ${enchantTarget.stunEndsAt - fakeNow}ms.`
  );

  return {
    name: "Warrior three-skill redesign runtime behavior",
    details: [
      "Guarding Slash spawns a 20-damage, 400-range, 650-speed piercing sword wave.",
      "Blazing Rampage grants 5s of +25% move speed and +25% outgoing damage, exposes the shared positive attack-boost status, and emits one player-following hollow fire aura without replacing the Warrior body.",
      `Blade Enchant shows three remaining attacks overhead, deals ${COMBAT.warriorBladeEnchantDamage.join("/")} damage, keeps the normal sword body, and stuns only on the third hit for 1s.`
    ]
  };
}

function checkTurretDeathVfxRuntime(): GameplayCheck {
  const duel = createDuel("warrior", "engineer", "turret_breaker", "turret_owner");
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer & { action: unknown; actionStartedAt: number; actionEndsAt: number; actionPoseEndsAt: number; attacking: boolean; lastAttackAt: number }>;
    turrets: Array<{
      id: string;
      ownerId: string;
      x: number;
      y: number;
      angle: number;
      health: number;
      maxHealth: number;
      shield: number;
      shieldEndsAt: number;
      kind: "magic_missile";
      lastAttackAt: number;
      deployedAt: number;
    }>;
  };
  const attacker = internals.players.get(duel.attackerId);
  const owner = internals.players.get(duel.targetId);
  assert(Boolean(attacker) && Boolean(owner), "Could not find players for turret death VFX audit.");

  const safeOrigin = { x: 800, y: 1200 };
  attacker.x = safeOrigin.x;
  attacker.y = safeOrigin.y;
  owner.x = safeOrigin.x + 400;
  owner.y = safeOrigin.y;
  internals.turrets.push({
    id: "audit_turret_break",
    ownerId: duel.targetId,
    x: safeOrigin.x + COMBAT.meleeRange - 18,
    y: safeOrigin.y,
    angle: 180,
    health: 5,
    maxHealth: COMBAT.magicTurretHealth,
    shield: 0,
    shieldEndsAt: 0,
    kind: "magic_missile",
    lastAttackAt: fakeNow,
    deployedAt: fakeNow
  });

  setInput(duel.room, duel.attackerSocket, { angle: 0, aimX: safeOrigin.x + COMBAT.meleeRange, aimY: safeOrigin.y, attack: true });
  tick(duel.room);

  const snapshot = duel.room.snapshotFor(duel.attackerSocket);
  assert(!snapshot.turrets.some((turret) => turret.id === "audit_turret_break"), "Destroyed audit turret should be removed from the snapshot.");
  const deathEffect = snapshot.effects.find((effect) => effect.type === "turret_death" && effect.ownerId === duel.attackerId);
  assert(Boolean(deathEffect), `Destroyed audit turret should emit turret_death, got ${JSON.stringify(snapshot.effects.map((effect) => effect.type))}.`);

  return {
    name: "turret death VFX runtime behavior",
    details: [`Destroyed turret emits ${deathEffect?.type} at radius ${deathEffect?.radius}.`]
  };
}

function checkEngineerMagicTurretRuntime(): GameplayCheck {
  const duel = createDuel(
    "engineer",
    "mage",
    "magic_turret_engineer",
    "magic_turret_target",
    {
      attackerCatalogLoadout: {
        skillQ: "engineer_12",
        skillE: "engineer_14",
        skillR: "engineer_15"
      },
      attackerEngineerTurretKind: "magic_missile"
    }
  );
  const origin = { x: 1800, y: 4100 };
  const targetPoint = { x: origin.x + 330, y: origin.y };
  placeDuel(duel, origin, targetPoint);

  setInput(duel.room, duel.attackerSocket, {
    aimX: targetPoint.x,
    aimY: targetPoint.y,
    skillF: true
  });
  tick(duel.room);
  setInput(duel.room, duel.attackerSocket, {});

  const deployed = duel.room.snapshotFor(duel.attackerSocket);
  const turretState = deployed.turrets.find((turret) => turret.ownerId === duel.attackerId);
  assert(Boolean(turretState), "Engineer F should deploy a magic missile turret.");
  assert(turretState.kind === "magic_missile", `Engineer turret kind should be magic_missile, got ${turretState.kind}.`);
  assert(turretState.health === COMBAT.magicTurretHealth, `Magic turret should start at ${COMBAT.magicTurretHealth} HP.`);
  assert(turretState.angle === 0, `Magic turret is a static image and should not rotate, got angle ${turretState.angle}.`);

  const internals = duel.room as unknown as {
    turrets: Array<{ id: string; lastAttackAt: number; shield: number; shieldEndsAt: number }>;
    players: Map<string, PublicPlayer & { actionPoseEndsAt: number; cooldowns: Record<SkillKey, number> }>;
  };
  const turret = internals.turrets.find((candidate) => candidate.id === turretState.id);
  const internalTarget = internals.players.get(duel.targetId);
  assert(Boolean(turret), "Could not inspect the deployed magic turret.");
  assert(Boolean(internalTarget), "Could not inspect the magic turret target.");
  const auditTargetHealth = 1000;
  internalTarget.health = auditTargetHealth;
  turret.lastAttackAt = Number.MAX_SAFE_INTEGER;

  advance(duel.room, 620);
  castSkill(duel, "skillQ", 0);
  let snapshot = duel.room.snapshotFor(duel.attackerSocket);
  assert(
    snapshot.projectiles.filter((projectile) => projectile.type === "magic_turret_sync").length === 1,
    "Engineer Q should make each deployed turret launch one synchronized seeker."
  );
  advanceFrames(duel.room, 1500);
  let target = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  const synchronizedDamage = getEffectiveArenaSkillDamage(
    "engineer_12",
    COMBAT.magicTurretSyncDamage
  );
  assert(
    target.health === auditTargetHealth - synchronizedDamage,
    `Synchronized seeker should deal ${synchronizedDamage}; target HP is ${target.health}.`
  );

  advance(duel.room, 720);
  castSkill(duel, "skillE", 0);
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  assert(
    snapshot.projectiles.filter((projectile) => projectile.type === "magic_turret_split").length === 1,
    "Engineer E should make each deployed turret launch one splitting star."
  );
  advanceFrames(duel.room, 1500);
  target = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  const splittingDamage = getEffectiveArenaSkillDamage(
    "engineer_14",
    COMBAT.magicTurretSplitDamage
  );
  assert(
    target.health ===
      auditTargetHealth - synchronizedDamage - splittingDamage,
    `Splitting Star primary hit should deal ${splittingDamage}; target HP is ${target.health}.`
  );

  advance(duel.room, 820);
  castSkill(duel, "skillR", 0);
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const matrixTurret = snapshot.turrets.find((candidate) => candidate.id === turretState.id);
  assert(matrixTurret?.shield === COMBAT.magicTurretMatrixShield, `Matrix should grant ${COMBAT.magicTurretMatrixShield} turret shield.`);
  assert(
    snapshot.projectiles.filter((projectile) => projectile.type === "magic_turret_matrix").length === 1,
    "Matrix should launch its first missile immediately."
  );
  advanceFrames(duel.room, COMBAT.magicTurretMatrixShotInterval + FRAME_MS);
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  assert(
    snapshot.projectiles.filter((projectile) => projectile.type === "magic_turret_matrix").length === 2,
    "Matrix should launch a second missile after the configured pair interval."
  );
  advanceFrames(duel.room, 1500);
  target = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  const matrixMissileDamage = getEffectiveArenaSkillDamage(
    "engineer_15",
    COMBAT.magicTurretMatrixDamage
  );
  const expectedAfterMatrix =
    auditTargetHealth -
    synchronizedDamage -
    splittingDamage -
    matrixMissileDamage * COMBAT.magicTurretMatrixMissilesPerTarget;
  assert(target.health === expectedAfterMatrix, `Matrix pair should deal ${matrixMissileDamage * COMBAT.magicTurretMatrixMissilesPerTarget} total damage; target HP is ${target.health}.`);

  turret.lastAttackAt = fakeNow - COMBAT.magicTurretAttackInterval;
  tick(duel.room);
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  assert(
    snapshot.projectiles.filter((projectile) => projectile.type === "magic_turret_basic").length === 1,
    "Magic turret should fire its own basic homing missile."
  );
  advanceFrames(duel.room, 1500);
  target = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  const turretBasicDamage = getEngineerTurretBasicAttackDamage("magic_missile");
  assert(
    target.health === expectedAfterMatrix - turretBasicDamage,
    `Magic turret basic missile should deal ${turretBasicDamage}; target HP is ${target.health}.`
  );

  const engineer = internals.players.get(duel.attackerId);
  assert(Boolean(engineer), "Could not inspect Engineer for turret replacement.");
  for (let index = 0; index < COMBAT.engineerMaxTurrets - 1; index += 1) {
    engineer.actionPoseEndsAt = 0;
    engineer.cooldowns.skillF = 0;
    setInput(duel.room, duel.attackerSocket, {
      aimX: origin.x + 150 + index * 40,
      aimY: origin.y + 80,
      skillF: true
    });
    tick(duel.room);
    setInput(duel.room, duel.attackerSocket, {});
  }
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const cappedTurrets = snapshot.turrets.filter((candidate) => candidate.ownerId === duel.attackerId);
  assert(cappedTurrets.length === COMBAT.engineerMaxTurrets, `Engineer should own ${COMBAT.engineerMaxTurrets} turrets before replacement.`);
  const oldestTurretId = turretState.id;

  engineer.actionPoseEndsAt = 0;
  engineer.cooldowns.skillF = 0;
  setInput(duel.room, duel.attackerSocket, {
    aimX: origin.x + 290,
    aimY: origin.y + 80,
    skillF: true
  });
  tick(duel.room);
  setInput(duel.room, duel.attackerSocket, {});
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const replacedTurrets = snapshot.turrets.filter((candidate) => candidate.ownerId === duel.attackerId);
  assert(replacedTurrets.length === COMBAT.engineerMaxTurrets, "Fourth F cast must keep the three-turret cap.");
  assert(!replacedTurrets.some((candidate) => candidate.id === oldestTurretId), "Fourth F cast must remove the oldest turret entity instead of relocating it.");
  const replacementTurret = replacedTurrets.find((candidate) => !cappedTurrets.some((previous) => previous.id === candidate.id));
  assert(Boolean(replacementTurret), "Fourth F cast must create a new turret entity.");
  assert(
    replacementTurret.health === replacementTurret.maxHealth,
    `Replacement turret must be full health, got ${replacementTurret.health}/${replacementTurret.maxHealth}.`
  );

  return {
    name: "Engineer magic turret runtime behavior",
    details: [
      `F deployed one static ${COMBAT.magicTurretHealth} HP turret.`,
      `Fourth F removed the oldest entity and created a new full-health turret while keeping the ${COMBAT.engineerMaxTurrets}-turret cap.`,
      `Q/E dealt ${synchronizedDamage}/${splittingDamage} and the turret basic dealt ${turretBasicDamage}.`,
      `R granted ${COMBAT.magicTurretMatrixShield} shield and fired two ${matrixMissileDamage}-damage missiles at the in-range target.`
    ]
  };
}

function checkEngineerSupportBracesRuntime(): GameplayCheck {
  const duel = createDuel(
    "engineer",
    "warrior",
    "support_engineer",
    "support_attacker"
  );
  placeDuel(
    duel,
    OPEN_FIELD_TEST_POINT,
    { x: OPEN_FIELD_TEST_POINT.x + 180, y: OPEN_FIELD_TEST_POINT.y }
  );

  type SupportPlayer = PublicPlayer & {
    catalogLoadout: ReturnType<typeof getDefaultArenaCatalogLoadout>;
    engineerSupportEndsAt: number;
    rootEndsAt: number;
    stunEndsAt: number;
    slowEndsAt: number;
    slowMultiplier: number;
  };
  type SupportTurret = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    angle: number;
    health: number;
    maxHealth: number;
    shield: number;
    shieldEndsAt: number;
    kind: "mechanical";
    lastAttackAt: number;
    deployedAt: number;
    supportEndsAt: number;
    markedTargetId: string | null;
    markedEndsAt: number;
    enhancedShots: number;
    armorCoreEndsAt: number;
  };
  const internals = duel.room as unknown as {
    players: Map<string, SupportPlayer>;
    turrets: SupportTurret[];
    damagePlayer: (
      target: SupportPlayer,
      damage: number,
      attackerId: string
    ) => number;
    damageTurret: (
      turret: SupportTurret,
      damage: number,
      attackerId: string,
      now: number
    ) => void;
    applyRoot: (target: SupportPlayer, durationMs: number, now: number) => boolean;
    applyStun: (target: SupportPlayer, durationMs: number, now: number) => boolean;
    applySlow: (
      target: SupportPlayer,
      multiplier: number,
      durationMs: number,
      now: number
    ) => boolean;
    pushTargetAway: (
      target: SupportPlayer,
      point: { x: number; y: number },
      amount: number,
      now: number
    ) => void;
    moveTargetToward: (
      target: SupportPlayer,
      point: { x: number; y: number },
      amount: number,
      now: number
    ) => void;
  };
  const engineer = internals.players.get(duel.attackerId);
  const attacker = internals.players.get(duel.targetId);
  assert(Boolean(engineer) && Boolean(attacker), "Support Braces audit players are missing.");
  engineer.catalogLoadout = {
    ...engineer.catalogLoadout,
    skillE: "engineer_09"
  };
  const turret: SupportTurret = {
    id: "support_turret",
    ownerId: engineer.id,
    x: engineer.x + 72,
    y: engineer.y,
    angle: 0,
    health: COMBAT.mechanicalTurretHealth,
    maxHealth: COMBAT.mechanicalTurretHealth,
    shield: 0,
    shieldEndsAt: 0,
    kind: "mechanical",
    lastAttackAt: Number.MAX_SAFE_INTEGER,
    deployedAt: fakeNow,
    supportEndsAt: 0,
    markedTargetId: null,
    markedEndsAt: 0,
    enhancedShots: 0,
    armorCoreEndsAt: 0
  };
  internals.turrets = [turret];

  castSkillAt(duel, "skillE", turret, 0);
  assert(
    engineer.engineerSupportEndsAt - fakeNow === 4000,
    `Engineer Support Braces should last 4000ms, got ${engineer.engineerSupportEndsAt - fakeNow}.`
  );
  assert(
    turret.supportEndsAt === engineer.engineerSupportEndsAt,
    "Engineer and turret Support Braces windows must end together."
  );

  const playerHealthBefore = engineer.health;
  const actualPlayerDamage = internals.damagePlayer(
    engineer,
    100,
    attacker.id
  );
  internals.damageTurret(turret, 100, attacker.id, fakeNow);
  const classBalancedIncomingDamage = getEffectiveClassDamage(
    attacker.classId,
    100
  );
  const expectedSupportedPlayerDamage = Math.ceil(
    classBalancedIncomingDamage * 0.8
  );
  const expectedSupportedTurretDamage =
    classBalancedIncomingDamage * 0.2;
  assert(
    actualPlayerDamage === expectedSupportedPlayerDamage &&
      engineer.health === playerHealthBefore - expectedSupportedPlayerDamage,
    `Supported Engineer must take ${expectedSupportedPlayerDamage} damage from the class-balanced hit, got ${actualPlayerDamage}.`
  );
  assert(
    turret.health === turret.maxHealth - expectedSupportedTurretDamage,
    `Supported turret must take ${expectedSupportedTurretDamage} damage from the class-balanced hit, got ${turret.maxHealth - turret.health}.`
  );
  assert(engineer.alive, "Support Braces must reduce damage, not make or mark the Engineer invulnerable.");

  const protectedPosition = { x: engineer.x, y: engineer.y };
  assert(!internals.applyRoot(engineer, 1000, fakeNow), "Supported Engineer accepted root.");
  assert(!internals.applyStun(engineer, 1000, fakeNow), "Supported Engineer accepted stun.");
  assert(!internals.applySlow(engineer, 0.4, 1000, fakeNow), "Supported Engineer accepted slow.");
  internals.pushTargetAway(
    engineer,
    { x: engineer.x - 100, y: engineer.y },
    115,
    fakeNow
  );
  internals.moveTargetToward(engineer, attacker, 100, fakeNow);
  assert(
    engineer.x === protectedPosition.x && engineer.y === protectedPosition.y,
    "Supported Engineer was displaced."
  );

  advance(duel.room, 4000);
  engineer.health = engineer.maxHealth;
  const expiredDamage = internals.damagePlayer(engineer, 100, attacker.id);
  assert(expiredDamage === classBalancedIncomingDamage, `Expired Support Braces should restore class-balanced damage ${classBalancedIncomingDamage}, got ${expiredDamage}.`);
  assert(internals.applyStun(engineer, 1000, fakeNow), "Expired Support Braces still blocked stun.");

  return {
    name: "Engineer Support Braces runtime behavior",
    details: [
      "The four-second state reduces Engineer/turret damage by 20%/80% while both remain damageable.",
      "Root, stun, slow, pull and knockback are rejected during the state and resume after expiry."
    ]
  };
}

function checkEngineerRapidDetonationRuntime(): GameplayCheck {
  const duel = createDuel("engineer", "mage", "rapid_engineer", "rapid_target");
  const center = { x: 2400, y: 3600 };
  placeDuel(duel, { x: center.x - 360, y: center.y }, center);

  const internals = duel.room as unknown as {
    players: Map<
      string,
      PublicPlayer & {
        catalogLoadout: ReturnType<typeof getDefaultArenaCatalogLoadout>;
      }
    >;
    turrets: Array<{
      id: string;
      ownerId: string;
      x: number;
      y: number;
      angle: number;
      health: number;
      maxHealth: number;
      shield: number;
      shieldEndsAt: number;
      kind: "mechanical" | "magic_missile";
      lastAttackAt: number;
      deployedAt: number;
      supportEndsAt: number;
      markedTargetId: string | null;
      markedEndsAt: number;
      enhancedShots: number;
      armorCoreEndsAt: number;
    }>;
  };
  const engineer = internals.players.get(duel.attackerId);
  const rapidTarget = internals.players.get(duel.targetId);
  assert(Boolean(engineer), "Could not inspect Engineer for Rapid Detonation audit.");
  assert(Boolean(rapidTarget), "Could not inspect Rapid Detonation target.");
  const rapidTargetHealth = 1000;
  rapidTarget.health = rapidTargetHealth;
  engineer.catalogLoadout = {
    ...engineer.catalogLoadout,
    skillR: "engineer_11"
  };
  const turretPoints = [
    { x: center.x - 40, y: center.y },
    { x: center.x + 40, y: center.y }
  ];
  internals.turrets = turretPoints.map((point, index) => ({
    id: `rapid_turret_${index}`,
    ownerId: duel.attackerId,
    x: point.x,
    y: point.y,
    angle: 0,
    health: COMBAT.mechanicalTurretHealth,
    maxHealth: COMBAT.mechanicalTurretHealth,
    shield: 0,
    shieldEndsAt: 0,
    kind: "mechanical",
    lastAttackAt: Number.MAX_SAFE_INTEGER,
    deployedAt: fakeNow + index,
    supportEndsAt: 0,
    markedTargetId: null,
    markedEndsAt: 0,
    enhancedShots: 0,
    armorCoreEndsAt: 0
  }));

  castSkillAt(duel, "skillR", center, 0);
  let snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const rapidEffects = snapshot.effects.filter(
    (effect) =>
      effect.type === "catalog_skill" &&
      effect.skillId === "engineer_11" &&
      effect.ownerId === duel.attackerId
  );
  assert(rapidEffects.length === 2, `Rapid Detonation should emit one accepted explosion per turret, got ${rapidEffects.length}.`);
  for (const [index, effect] of rapidEffects.entries()) {
    assert(
      effect.x === turretPoints[index].x && effect.y === turretPoints[index].y,
      `Rapid Detonation effect ${index + 1} moved away from its turret anchor: ${JSON.stringify(effect)}.`
    );
  }
  assert(snapshot.turrets.length === 2, "Rapid Detonation should preserve turrets during its 0.5-second warning.");
  assert(
    getPlayer(snapshot, duel.targetId).health === rapidTargetHealth,
    "Rapid Detonation should not damage during its warning."
  );

  advance(duel.room, 499);
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  assert(snapshot.turrets.length === 2, "Rapid Detonation removed turrets before the 0.5-second warning ended.");
  advance(duel.room, 1);
  snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const target = getPlayer(snapshot, duel.targetId);
  const rapidDamage = getEffectiveArenaSkillDamage("engineer_11", 60) * 2;
  assert(snapshot.turrets.length === 0, "Rapid Detonation should remove every detonated turret at 0.5 seconds.");
  assert(
    target.health === rapidTargetHealth - rapidDamage,
    `Two overlapping Rapid Detonations should deal ${rapidDamage} total after class scaling. Expected ${rapidTargetHealth - rapidDamage}, got ${target.health}.`
  );
  assert(
    !snapshot.effects.some(
      (effect) =>
        effect.type === "turret_death" &&
        effect.ownerId === duel.attackerId
    ),
    "Rapid Detonation must not overlay the generic turret-death burst on its accepted explosion."
  );

  return {
    name: "Engineer Rapid Detonation timing and anchor behavior",
    details: [
      "Each warning/explosion stays on the exact turret x/y.",
      `Two overlapping turrets deal ${rapidDamage / 2} + ${rapidDamage / 2} at 0.5 seconds without falloff.`,
      "Rapid Detonation removes its turrets without a second generic death burst."
    ]
  };
}

function checkEngineerLockedTurretRuntime(): GameplayCheck {
  fakeNow += 25_000;
  const room = new GameRoom({
    noBots: true,
    fixedSpawn: true,
    fixedSpawnPoint: OPEN_FIELD_TEST_POINT
  });
  const engineer = room.addHuman("selectable_turret_engineer", {
    name: "SELECTABLE_TURRET_ENGINEER",
    classId: "engineer",
    loadout: getDefaultArenaLoadout("engineer"),
    catalogLoadout: getDefaultArenaCatalogLoadout("engineer"),
    engineerTurretKind: "mechanical"
  });
  const targetJoin = room.addHuman("selectable_turret_target", {
    name: "SELECTABLE_TURRET_TARGET",
    classId: "mage",
    loadout: getDefaultArenaLoadout("mage"),
    catalogLoadout: getDefaultArenaCatalogLoadout("mage")
  });
  const internals = room as unknown as {
    players: Map<
      string,
      PublicPlayer & {
        spawnGuardEndsAt: number;
        spawnProtected: boolean;
        actionPoseEndsAt: number;
        cooldowns: Record<SkillKey, number>;
      }
    >;
    turrets: Array<{
      ownerId: string;
      kind: "mechanical" | "magic_missile";
      lastAttackAt: number;
    }>;
  };
  for (const player of internals.players.values()) {
    player.spawnGuardEndsAt = 0;
    player.spawnProtected = false;
  }

  setInput(room, "selectable_turret_engineer", {
    aimX: OPEN_FIELD_TEST_POINT.x + 180,
    aimY: OPEN_FIELD_TEST_POINT.y,
    skillF: true,
    engineerTurretKind: "mechanical"
  });
  tick(room);
  const owner = internals.players.get(engineer.playerId);
  assert(Boolean(owner), "Selectable turret audit could not find Engineer.");
  owner.actionPoseEndsAt = 0;
  owner.cooldowns.skillF = 0;
  setInput(room, "selectable_turret_engineer", {
    aimX: OPEN_FIELD_TEST_POINT.x + 220,
    aimY: OPEN_FIELD_TEST_POINT.y,
    skillF: true,
    engineerTurretKind: "magic_missile"
  });
  tick(room);

  const snapshot = room.snapshotFor("selectable_turret_engineer");
  const owned = snapshot.turrets.filter(
    (turret) => turret.ownerId === engineer.playerId
  );
  assert(
    owned.length === 2 && owned.every((turret) => turret.kind === "mechanical"),
    "An Engineer who entered with the mechanical turret must not create a magic turret mid-match."
  );
  assert(
    getPlayer(snapshot, engineer.playerId).engineerTurretKind ===
      "mechanical",
    "Mid-match input must not change the Engineer's entry turret kind."
  );

  const targetBeforeMechanicalShot = getPlayer(
    snapshot,
    targetJoin.playerId
  ).health;
  let primedMechanicalTurret = false;
  for (const turret of internals.turrets) {
    if (turret.kind === "mechanical" && !primedMechanicalTurret) {
      turret.lastAttackAt = fakeNow - COMBAT.mechanicalTurretAttackInterval;
      primedMechanicalTurret = true;
    } else {
      turret.lastAttackAt = fakeNow;
    }
  }
  tick(room);
  advanceFrames(room, 600);
  const targetAfterMechanicalShot = getPlayer(
    room.snapshotFor("selectable_turret_engineer"),
    targetJoin.playerId
  ).health;
  const mechanicalBasicDamage = getEngineerTurretBasicAttackDamage("mechanical");
  assert(
    targetAfterMechanicalShot ===
      targetBeforeMechanicalShot - mechanicalBasicDamage,
    `Mechanical turret basic should deal ${mechanicalBasicDamage}; target HP is ${targetAfterMechanicalShot}.`
  );

  return {
    name: "Engineer entry-locked F turret selection",
    details: [
      "A mechanical Engineer stayed mechanical after an attempted mid-match turret switch.",
      "Turret selection is fixed by the compatible pre-match configuration and synchronized in player state.",
      `Mechanical turret ordinary basic dealt its preset ${mechanicalBasicDamage} damage.`
    ]
  };
}

function checkTeamThreeVersusThreeRuntime(): GameplayCheck {
  fakeNow += 25_000;
  const room = new GameRoom({ mode: "team_3v3" });
  assert(
    room.snapshotFor("missing").players.length === 6,
    "Fresh 3V3 room must be filled to six combatants."
  );
  assert(room.botCount() === 6, "Fresh 3V3 room must start with six bots.");

  const redOne = room.addHuman("team_red_one", {
    name: "RED_ONE",
    classId: "warrior",
    loadout: getDefaultArenaLoadout("warrior"),
    catalogLoadout: getDefaultArenaCatalogLoadout("warrior"),
    mode: "team_3v3"
  });
  const blueOne = room.addHuman("team_blue_one", {
    name: "BLUE_ONE",
    classId: "mage",
    loadout: getDefaultArenaLoadout("mage"),
    catalogLoadout: getDefaultArenaCatalogLoadout("mage"),
    mode: "team_3v3"
  });
  const redTwo = room.addHuman("team_red_two", {
    name: "RED_TWO",
    classId: "archer",
    loadout: getDefaultArenaLoadout("archer"),
    catalogLoadout: getDefaultArenaCatalogLoadout("archer"),
    mode: "team_3v3"
  });
  const internals = room as unknown as {
    players: Map<
      string,
      PublicPlayer & {
        spawnGuardEndsAt: number;
        spawnProtected: boolean;
        health: number;
        alive: boolean;
      }
    >;
    teamScores: { red: number; blue: number };
    damagePlayer: (
      target: unknown,
      damage: number,
      attackerId: string
    ) => number;
    killPlayer: (
      target: unknown,
      attackerId: string,
      now?: number
    ) => void;
  };
  const redAttacker = internals.players.get(redOne.playerId);
  const redAlly = internals.players.get(redTwo.playerId);
  const blueTarget = internals.players.get(blueOne.playerId);
  assert(
    redAttacker?.team === "red" &&
      redAlly?.team === "red" &&
      blueTarget?.team === "blue",
    "Human team assignment must alternate into balanced red/blue teams."
  );
  for (const player of internals.players.values()) {
    player.spawnGuardEndsAt = 0;
    player.spawnProtected = false;
  }

  const allyHealth = redAlly.health;
  const friendlyDamage = internals.damagePlayer(
    redAlly,
    30,
    redAttacker.id
  );
  assert(
    friendlyDamage === 0 && redAlly.health === allyHealth,
    "3V3 friendly fire must be disabled."
  );
  const enemyHealth = blueTarget.health;
  const teamTestRawDamage = 37;
  const teamTestDamage = getEffectiveClassDamage(
    redAttacker.classId,
    teamTestRawDamage
  );
  const enemyDamage = internals.damagePlayer(
    blueTarget,
    teamTestRawDamage,
    redAttacker.id
  );
  assert(
    enemyDamage === teamTestDamage &&
      blueTarget.health === enemyHealth - teamTestDamage,
    "3V3 enemy damage must remain active."
  );

  blueTarget.alive = true;
  blueTarget.health = blueTarget.maxHealth;
  internals.teamScores.red = WORLD.scoreLimit - 1;
  internals.killPlayer(blueTarget, redAttacker.id, fakeNow);
  tick(room);
  const snapshot = room.snapshotFor("team_red_one");
  const redCount = snapshot.players.filter(
    (player) => player.team === "red"
  ).length;
  const blueCount = snapshot.players.filter(
    (player) => player.team === "blue"
  ).length;
  assert(
    redCount === 3 && blueCount === 3,
    `3V3 room must stay full at 3 red / 3 blue, got ${redCount}/${blueCount}.`
  );
  assert(
    snapshot.round.durationMs === 300_000 &&
      snapshot.round.scoreLimit === 15,
    "3V3 must use the confirmed 5-minute / first-to-15 rules."
  );
  assert(
    snapshot.round.phase === "finished" &&
      snapshot.round.winningTeam === "red" &&
      snapshot.round.teamScores.red === 15,
    "Shared red score reaching 15 must finish the round for the red team."
  );

  return {
    name: "3V3 team rules and bot fill",
    details: [
      `Room remained ${redCount} red versus ${blueCount} blue after three human joins.`,
      "Friendly fire dealt 0 while enemy damage remained active.",
      "Shared team score reached 15 and ended the five-minute ruleset for Red."
    ]
  };
}

function checkCatalogSkillRuntimeCoverage(): GameplayCheck {
  assert(
    Object.keys(ARENA_SKILL_SPECS).length === 61,
    `Canonical skill table must contain F plus 60 selectable skills, got ${Object.keys(ARENA_SKILL_SPECS).length}.`
  );
  const failures: string[] = [];
  let verifiedEngineerMageDamageSkills = 0;
  const effective = (skillId: ArenaCatalogSkillId, rawDamage: number) =>
    getEffectiveArenaSkillDamage(skillId, rawDamage);
  const exactDamageBySkill: Partial<Record<ArenaCatalogSkillId, number>> = {
    engineer_01: effective("engineer_01", 18) * 3,
    engineer_02: effective("engineer_02", 9) * 3,
    engineer_03: effective("engineer_03", 30),
    engineer_04: effective("engineer_04", 11) * 4,
    engineer_05: effective("engineer_05", 24) * 3,
    engineer_06: effective("engineer_06", 65),
    engineer_07: effective("engineer_07", 18),
    engineer_10: effective("engineer_10", 20),
    engineer_11: effective("engineer_11", 60) * 3,
    engineer_12: effective("engineer_12", 11) * 2,
    engineer_13: effective("engineer_13", 7) * 2,
    engineer_14: effective("engineer_14", 13) * 2,
    engineer_15: effective("engineer_15", 12) * 4,
    mage_00: effective("mage_00", 24),
    mage_01:
      effective("mage_01", 12) +
      COMBAT.poisonTickDamage *
        (COMBAT.poisonDuration / COMBAT.poisonTickInterval),
    mage_02: effective("mage_02", 16),
    mage_05: effective("mage_05", 13),
    mage_06: effective("mage_06", 18),
    mage_07: effective("mage_07", 28),
    // The six-second observation sees four field ticks plus five poison ticks:
    // poison is refreshed while the target remains inside the four-second field.
    mage_08:
      effective("mage_08", 8) * 4 + COMBAT.poisonTickDamage * 5,
    mage_11: effective("mage_11", 12),
    mage_12: effective("mage_12", 42),
    mage_14: effective("mage_14", 12) * 5
  };
  for (const catalogSkill of ARENA_SKILL_CATALOG.filter(
    (skill) => !skill.core
  )) {
    fakeNow += 25_000;
    const room = new GameRoom({
      noBots: true,
      fixedSpawn: true,
      fixedSpawnPoint: OPEN_FIELD_TEST_POINT
    });
    const attackerSocket = `coverage_${catalogSkill.id}`;
    const targetSocket = `coverage_target_${catalogSkill.id}`;
    const attackerJoin = room.addHuman(attackerSocket, {
      name: catalogSkill.id,
      classId: catalogSkill.classId,
      loadout: getDefaultArenaLoadout(catalogSkill.classId),
      catalogLoadout: getDefaultArenaCatalogLoadout(catalogSkill.classId)
    });
    const targetJoin = room.addHuman(targetSocket, {
      name: `TARGET_${catalogSkill.id}`,
      classId: "warrior",
      loadout: getDefaultArenaLoadout("warrior"),
      catalogLoadout: getDefaultArenaCatalogLoadout("warrior")
    });
    const internals = room as unknown as {
      players: Map<
        string,
        PublicPlayer & {
          spawnGuardEndsAt: number;
          spawnProtected: boolean;
          health: number;
          actionPoseEndsAt: number;
          markedTargetId?: string | null;
        }
      >;
      turrets: Array<{
        id: string;
        ownerId: string;
        x: number;
        y: number;
        angle: number;
        health: number;
        maxHealth: number;
        shield: number;
        shieldEndsAt: number;
        kind: "mechanical" | "magic_missile";
        lastAttackAt: number;
        deployedAt: number;
        supportEndsAt: number;
        markedTargetId: string | null;
        markedEndsAt: number;
        enhancedShots: number;
        armorCoreEndsAt: number;
      }>;
      healthPacks: unknown[];
      attackBoostPacks: unknown[];
    };
    const attacker = internals.players.get(attackerJoin.playerId);
    const target = internals.players.get(targetJoin.playerId);
    if (!attacker || !target) {
      failures.push(`${catalogSkill.id}: missing players`);
      continue;
    }
    attacker.x = OPEN_FIELD_TEST_POINT.x;
    attacker.y = OPEN_FIELD_TEST_POINT.y;
    attacker.spawnGuardEndsAt = 0;
    attacker.spawnProtected = false;
    target.x = OPEN_FIELD_TEST_POINT.x + 100;
    target.y = OPEN_FIELD_TEST_POINT.y;
    target.maxHealth = 10_000;
    target.health = 10_000;
    target.spawnGuardEndsAt = 0;
    target.spawnProtected = false;
    internals.healthPacks = [];
    internals.attackBoostPacks = [];

    if (catalogSkill.classId === "engineer") {
      const turretPositions = catalogSkill.id === "engineer_05"
        ? [
            { x: attacker.x + 55, y: attacker.y - 80, kind: "mechanical" as const },
            { x: attacker.x + 80, y: attacker.y + 80, kind: "mechanical" as const },
            { x: attacker.x + 210, y: attacker.y, kind: "mechanical" as const }
          ]
        : [
            { x: attacker.x + 55, y: attacker.y - 80, kind: "mechanical" as const },
            { x: attacker.x + 80, y: attacker.y + 80, kind: "magic_missile" as const },
            { x: attacker.x + 210, y: attacker.y, kind: "magic_missile" as const }
          ];
      internals.turrets = turretPositions.map((position, index) => ({
        id: `coverage_turret_${index}`,
        ownerId: attacker.id,
        x: position.x,
        y: position.y,
        angle: 0,
        health:
          position.kind === "mechanical"
            ? COMBAT.mechanicalTurretHealth
            : COMBAT.magicTurretHealth,
        maxHealth:
          position.kind === "mechanical"
            ? COMBAT.mechanicalTurretHealth
            : COMBAT.magicTurretHealth,
        shield: 0,
        shieldEndsAt: 0,
        kind: position.kind,
        lastAttackAt: Number.MAX_SAFE_INTEGER,
        deployedAt: fakeNow + index,
        supportEndsAt: 0,
        markedTargetId:
          catalogSkill.id === "engineer_05" && index === 0
            ? target.id
            : null,
        markedEndsAt:
          catalogSkill.id === "engineer_05" && index === 0
            ? fakeNow + 5000
            : 0,
        enhancedShots:
          catalogSkill.id === "engineer_05" && index === 0 ? 3 : 0,
        armorCoreEndsAt: 0
      }));
      if (catalogSkill.id === "engineer_02") {
        const mechanicalTurret = internals.turrets.find(
          (turret) => turret.kind === "mechanical"
        );
        if (mechanicalTurret) {
          // Put the target immediately in front of the muzzle so all three
          // authored scatter pellets overlap the same player hurtbox.
          target.x = mechanicalTurret.x + 55;
          target.y = mechanicalTurret.y - 18;
        }
      }
    }

    const slot =
      catalogSkill.tier === "basic"
        ? "skillQ"
        : catalogSkill.tier === "intermediate"
          ? "skillE"
          : "skillR";
    attacker.catalogLoadout = {
      ...attacker.catalogLoadout,
      [slot]: catalogSkill.id
    };
    setInput(room, attackerSocket, {
      angle: 0,
      aimX: target.x,
      aimY: target.y,
      [slot]: true
    });
    tick(room);
    setInput(room, attackerSocket, {});
    const snapshot = room.snapshotFor(attackerSocket);
    const publicAttacker = getPlayer(snapshot, attacker.id);
    const specialEffectType: Partial<
      Record<ArenaCatalogSkillId, string>
    > = {
      engineer_12: "magic_turret_sync",
      engineer_14: "magic_turret_split",
      engineer_15: "magic_turret_matrix",
      mage_00: "beam",
      mage_07: "burst",
      mage_08: "mage_miasma_field",
      mage_12: "ultimate",
      mage_13: "mage_time_astrolabe",
      mage_14: "mage_blood_altar"
    };
    const expectedVfxType =
      specialEffectType[catalogSkill.id] ?? "catalog_skill";
    const skillEffect = snapshot.effects.find(
      (effect) =>
        effect.type === expectedVfxType &&
        (expectedVfxType !== "catalog_skill" ||
          effect.skillId === catalogSkill.id) &&
        effect.ownerId === attacker.id
    );
    const projectileEvidence = snapshot.projectiles.some(
      (projectile) =>
        projectile.ownerId === attacker.id &&
        projectile.skillId === catalogSkill.id
    );
    const stateEvidence =
      (catalogSkill.id === "warrior_03" &&
        publicAttacker.enchantedMeleeHitsRemaining === 3) ||
      (catalogSkill.id === "archer_04" &&
        publicAttacker.concealmentEndsAt > snapshot.serverTime);
    if (!skillEffect && !projectileEvidence && !stateEvidence) {
      failures.push(
        `${catalogSkill.id}: successful cast produced no matching VFX, projectile or public state`
      );
    }
    if (
      publicAttacker.cooldowns[slot] - snapshot.serverTime !==
      ARENA_SKILL_SPECS[catalogSkill.id].cooldownMs
    ) {
      failures.push(
        `${catalogSkill.id}: cooldown did not start at canonical value`
      );
    }

    const damageValues = ARENA_SKILL_SPECS[catalogSkill.id].numbers.damage;
    const verifiesDamage =
      (catalogSkill.classId === "engineer" ||
        catalogSkill.classId === "mage") &&
      Boolean(damageValues?.length) &&
      catalogSkill.id !== "mage_09";
    if (verifiesDamage && damageValues) {
      if (
        catalogSkill.id === "engineer_01" ||
        catalogSkill.id === "engineer_03"
      ) {
        const mechanicalTurret = internals.turrets.find(
          (turret) => turret.kind === "mechanical"
        );
        if (mechanicalTurret) {
          mechanicalTurret.lastAttackAt =
            fakeNow - COMBAT.mechanicalTurretAttackInterval;
        }
      }
      const observationMs =
        catalogSkill.id === "engineer_01"
          ? 2200
          : catalogSkill.id === "engineer_03"
            ? 100
            : 6000;
      advanceFrames(room, observationMs);
      const damageTarget = internals.players.get(target.id);
      const actualDamage = 10_000 - (damageTarget?.health ?? 10_000);
      const expectedDamage = exactDamageBySkill[catalogSkill.id];
      if (expectedDamage == null) {
        failures.push(
          `${catalogSkill.id}: missing exact runtime damage contract`
        );
      } else if (actualDamage !== expectedDamage) {
        failures.push(
          `${catalogSkill.id}: dealt ${actualDamage}, expected exactly ${expectedDamage}`
        );
      } else {
        verifiedEngineerMageDamageSkills += 1;
      }
    }
  }

  assert(
    failures.length === 0,
    `Selectable skill runtime coverage failed:\n${failures.join("\n")}`
  );
  return {
    name: "60 selectable skill runtime coverage",
    details: [
      "Every selectable Warrior, Archer, Engineer, and Mage skill entered its runtime handler.",
      "Every successful cast emitted the matching catalog or dedicated VFX identity.",
      "Every successful cast started the cooldown from the 61-entry canonical value table.",
      `${verifiedEngineerMageDamageSkills} Engineer/Mage damage-bearing skills matched their exact expected damage in the real GameRoom pipeline.`
    ]
  };
}

function checkAttackBoostPickupRuntime(): GameplayCheck {
  const duel = createDuel("warrior", "mage", "boost_warrior", "boost_target");
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer & { action: unknown; actionStartedAt: number; actionEndsAt: number; actionPoseEndsAt: number; attacking: boolean; lastAttackAt: number; attackBoostEndsAt: number }>;
    attackBoostPacks: Array<{ id: string; x: number; y: number }>;
  };
  const attacker = internals.players.get(duel.attackerId);
  const target = internals.players.get(duel.targetId);
  assert(Boolean(attacker) && Boolean(target), "Could not find players for attack boost pickup audit.");

  const safeOrigin = { x: 900, y: 1280 };
  attacker.x = safeOrigin.x;
  attacker.y = safeOrigin.y;
  target.x = safeOrigin.x + COMBAT.meleeRange - 12;
  target.y = safeOrigin.y;
  target.health = CLASS_STATS.mage.maxHealth;
  internals.attackBoostPacks = [{ id: "audit_attack_mushroom", x: attacker.x, y: attacker.y }];

  tick(duel.room);
  const boostedSnapshot = duel.room.snapshotFor(duel.attackerSocket);
  const boostedAttacker = getPlayer(boostedSnapshot, duel.attackerId);
  assert(boostedAttacker.attackBoosted, "Attack boost mushroom should set attackBoosted on the player snapshot.");
  assert(boostedAttacker.attackBoostEndsAt > boostedSnapshot.serverTime, "Attack boost should expose a future attackBoostEndsAt timestamp.");
  assert(
    boostedSnapshot.effects.some((effect) => effect.type === "attack_boost" && effect.ownerId === duel.attackerId),
    `Attack boost pickup should emit attack_boost effect, got ${JSON.stringify(boostedSnapshot.effects.map((effect) => effect.type))}.`
  );
  assert(
    boostedSnapshot.events.some((event) => event.type === "boost" && event.actorId === duel.attackerId),
    `Attack boost pickup should emit a boost event, got ${JSON.stringify(boostedSnapshot.events.map((event) => event.type))}.`
  );

  setInput(duel.room, duel.attackerSocket, { angle: 0, aimX: target.x, aimY: target.y, attack: true });
  tick(duel.room);
  const afterAttackTarget = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.targetId);
  const expectedDamage = getEffectiveClassDamage(
    "warrior",
    CLASS_STATS.warrior.attackPower * WORLD.attackBoostMultiplier
  );
  const expectedHealth = CLASS_STATS.mage.maxHealth - expectedDamage;
  assert(afterAttackTarget.health === expectedHealth, `Attack boost should raise Warrior damage to ${expectedDamage}. Got target HP ${afterAttackTarget.health}.`);

  return {
    name: "attack boost mushroom runtime behavior",
    details: [
      `Mushroom pickup gives ${WORLD.attackBoostDurationMs / 1000}s attack boost.`,
      `Warrior basic damage increased from ${getEffectiveBasicAttackDamage("warrior")} to ${expectedDamage}.`
    ]
  };
}

function checkFixedReviewSpawnRuntime(): GameplayCheck {
  fakeNow += 25_000;
  const room = new GameRoom({
    noBots: true,
    fixedSpawn: true
  });
  const first = room.addHuman("spawn_alpha", {
    name: "SPAWN_ALPHA",
    classId: "warrior",
    loadout: getDefaultArenaLoadout("warrior"),
    catalogLoadout: getDefaultArenaCatalogLoadout("warrior")
  });
  const second = room.addHuman("spawn_beta", {
    name: "SPAWN_BETA",
    classId: "mage",
    loadout: getDefaultArenaLoadout("mage"),
    catalogLoadout: getDefaultArenaCatalogLoadout("mage")
  });
  advance(room, SPAWN_GUARD_CLEAR_MS);

  const snapshot = room.snapshotFor("spawn_alpha");
  const firstPlayer = getPlayer(snapshot, first.playerId);
  const secondPlayer = getPlayer(snapshot, second.playerId);
  const centerDistanceA = distanceBetween(firstPlayer, TEST_SPAWN);
  const centerDistanceB = distanceBetween(secondPlayer, TEST_SPAWN);
  const playerDistance = distanceBetween(firstPlayer, secondPlayer);

  assert(centerDistanceA <= 600, `First fixed review spawn should stay near the centre. Distance: ${Math.round(centerDistanceA)}.`);
  assert(centerDistanceB <= 600, `Second fixed review spawn should stay near the centre. Distance: ${Math.round(centerDistanceB)}.`);
  assert(playerDistance < 1, `Fixed review spawns should resolve to the same deterministic point. Distance: ${Math.round(playerDistance)}.`);

  return {
    name: "fixed review spawn runtime behavior",
    details: [
      `Fixed review mode without explicit coordinates spawned players ${Math.round(centerDistanceA)}px and ${Math.round(centerDistanceB)}px from centre.`,
      `Both players resolved to the same deterministic review point.`
    ]
  };
}

function checkArcherCrescentReturnRuntime(): GameplayCheck {
  const duel = createDuel("archer", "engineer", "crescent_archer", "crescent_target");
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer>;
    projectiles: Array<{
      id: string;
      skillId?: string;
      x: number;
      y: number;
      returningToOwner?: boolean;
    }>;
  };
  const attacker = internals.players.get(duel.attackerId);
  const target = internals.players.get(duel.targetId);
  assert(Boolean(attacker) && Boolean(target), "Crescent return audit could not find its players.");
  attacker.x = OPEN_FIELD_TEST_POINT.x;
  attacker.y = OPEN_FIELD_TEST_POINT.y;
  target.x = attacker.x + 280;
  target.y = attacker.y;
  target.health = target.maxHealth;
  attacker.catalogLoadout = { ...attacker.catalogLoadout, skillQ: "archer_00" };

  castSkillAt(duel, "skillQ", target, 0);
  let returning: (typeof internals.projectiles)[number] | undefined;
  for (let frame = 0; frame < 40 && !returning; frame += 1) {
    tick(duel.room);
    returning = internals.projectiles.find(
      (projectile) => projectile.skillId === "archer_00" && projectile.returningToOwner
    );
  }
  assert(Boolean(returning), "Moon Crescent should keep the same projectile alive for a visible return leg after impact.");
  const returnProjectileId = returning.id;
  const distanceAtTurnaround = distanceBetween(returning, attacker);
  advanceFrames(duel.room, 165);
  const laterReturn = internals.projectiles.find((projectile) => projectile.id === returnProjectileId);
  assert(Boolean(laterReturn), "Moon Crescent return projectile disappeared before travelling back to the Archer.");
  assert(
    distanceBetween(laterReturn, attacker) < distanceAtTurnaround,
    "Moon Crescent return projectile did not move closer to its owner."
  );
  advanceFrames(duel.room, 500);
  assert(
    target.maxHealth - target.health === 22,
    `Moon Crescent should deal 11 outbound + 11 return damage, dealt ${target.maxHealth - target.health}.`
  );

  return {
    name: "Archer Moon Crescent visible return runtime",
    details: [
      "The outbound projectile survives impact, pauses briefly, reverses toward the Archer, and keeps the authored 11 + 11 damage contract."
    ]
  };
}

function checkEngineerCursorVolleyRuntime(): GameplayCheck {
  const duel = createDuel("engineer", "mage", "cursor_engineer", "cursor_target");
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer>;
    turrets: Array<{
      id: string;
      ownerId: string;
      x: number;
      y: number;
      angle: number;
      health: number;
      maxHealth: number;
      shield: number;
      shieldEndsAt: number;
      kind: "mechanical" | "magic_missile";
      lastAttackAt: number;
      deployedAt: number;
      supportEndsAt: number;
      markedTargetId: string | null;
      markedEndsAt: number;
      enhancedShots: number;
      armorCoreEndsAt: number;
    }>;
    projectiles: Array<{
      id: string;
      skillId?: string;
      angle: number;
      targetId?: string;
      homingTurnRate?: number;
    }>;
  };
  const attacker = internals.players.get(duel.attackerId);
  const target = internals.players.get(duel.targetId);
  assert(Boolean(attacker) && Boolean(target), "Engineer cursor volley audit could not find its players.");
  attacker.x = OPEN_FIELD_TEST_POINT.x;
  attacker.y = OPEN_FIELD_TEST_POINT.y;
  target.x = attacker.x + 300;
  target.y = attacker.y;
  attacker.catalogLoadout = { ...attacker.catalogLoadout, skillE: "engineer_05" };
  internals.turrets = [-80, 0, 80].map((offset, index) => ({
    id: `cursor_volley_turret_${index}`,
    ownerId: attacker.id,
    x: attacker.x + 70,
    y: attacker.y + offset,
    angle: 0,
    health: COMBAT.mechanicalTurretHealth,
    maxHealth: COMBAT.mechanicalTurretHealth,
    shield: 0,
    shieldEndsAt: 0,
    kind: "mechanical" as const,
    lastAttackAt: Number.MAX_SAFE_INTEGER,
    deployedAt: fakeNow + index,
    supportEndsAt: 0,
    markedTargetId: index === 0 ? target.id : null,
    markedEndsAt: index === 0 ? fakeNow + 5000 : 0,
    enhancedShots: index === 0 ? 3 : 0,
    armorCoreEndsAt: 0
  }));

  castSkillAt(duel, "skillE", target, 0);
  const volley = internals.projectiles.filter((projectile) => projectile.skillId === "engineer_05");
  assert(volley.length === 3, `Locking Volley should launch one shell from each eligible turret, launched ${volley.length}.`);
  assert(
    volley.every((projectile) => !projectile.targetId && !projectile.homingTurnRate),
    "Locking Volley shells must be straight physical shots, not guaranteed homing hits."
  );
  const releaseAngles = new Map(volley.map((projectile) => [projectile.id, projectile.angle]));
  target.y += 220;
  advanceFrames(duel.room, 99);
  const survivingVolley = internals.projectiles.filter((projectile) => releaseAngles.has(projectile.id));
  assert(survivingVolley.length > 0, "Locking Volley audit lost every shell before checking its travel heading.");
  assert(
    survivingVolley.every(
      (projectile) => Math.abs(projectile.angle - (releaseAngles.get(projectile.id) ?? projectile.angle)) < 0.001
    ),
    "Locking Volley followed the target after release instead of preserving its release-time line."
  );

  return {
    name: "Engineer cursor-selected non-homing volley runtime",
    details: [
      "Every eligible ordinary turret fires once at the cursor-selected enemy, and each shell keeps its release-time heading so movement can dodge it."
    ]
  };
}

const CONTROL_LOCK_MOBILITY_CASES = [
  {
    classId: "warrior",
    skillId: "warrior_04",
    slot: "skillQ"
  },
  {
    classId: "archer",
    skillId: "archer_01",
    slot: "skillQ"
  },
  {
    classId: "archer",
    skillId: "archer_06",
    slot: "skillQ"
  },
  {
    classId: "archer",
    skillId: "archer_14",
    slot: "skillR"
  }
] as const;

const CONTROL_LOCK_STATUS_CASES = [
  {
    name: "root",
    casterClass: "archer",
    casterSlot: "skillE",
    statusFlag: "rooted",
    activationDelayMs: 0
  },
  {
    name: "stun",
    casterClass: "mage",
    casterSlot: "skillE",
    statusFlag: "stunned",
    activationDelayMs: 300
  }
] as const;

function checkControlLocksMobilityRuntime(): GameplayCheck {
  const failures: string[] = [];
  const declaredMobilitySkills = Object.entries(ARENA_SKILL_TELEGRAPHS)
    .filter(([, telegraph]) => telegraph.kind === "dash")
    .map(([skillId]) => skillId)
    .sort();
  const auditedMobilitySkills = CONTROL_LOCK_MOBILITY_CASES
    .map(({ skillId }) => skillId)
    .sort();
  assert(
    JSON.stringify(declaredMobilitySkills) ===
      JSON.stringify(auditedMobilitySkills),
    `Mobility audit must cover every declared self-movement skill. Declared ${declaredMobilitySkills.join(", ")}; audited ${auditedMobilitySkills.join(", ")}.`
  );

  for (const statusCase of CONTROL_LOCK_STATUS_CASES) {
    for (const mobilityCase of CONTROL_LOCK_MOBILITY_CASES) {
      const duel = createDuel(
        statusCase.casterClass,
        mobilityCase.classId,
        `${statusCase.name}_${mobilityCase.skillId}_caster`,
        `${statusCase.name}_${mobilityCase.skillId}_target`
      );
      placeDuel(
        duel,
        OPEN_FIELD_TEST_POINT,
        { x: OPEN_FIELD_TEST_POINT.x + 100, y: OPEN_FIELD_TEST_POINT.y }
      );
      const internals = duel.room as unknown as {
        players: Map<string, PublicPlayer>;
        catalogPlayerMotions: Map<string, unknown>;
      };
      const target = internals.players.get(duel.targetId);
      assert(Boolean(target), `Missing ${mobilityCase.skillId} target.`);
      target.catalogLoadout[mobilityCase.slot] = mobilityCase.skillId;

      castSkillAt(
        duel,
        statusCase.casterSlot,
        { x: target.x, y: target.y },
        statusCase.activationDelayMs
      );
      const controlled = getPlayer(
        duel.room.snapshotFor(duel.targetSocket),
        duel.targetId
      );
      if (!controlled[statusCase.statusFlag]) {
        failures.push(
          `${statusCase.name}/${mobilityCase.skillId}: control status was not applied`
        );
        continue;
      }

      const before = { x: controlled.x, y: controlled.y };
      setInput(duel.room, duel.targetSocket, {
        angle: 0,
        aimX: before.x + 400,
        aimY: before.y,
        [mobilityCase.slot]: true
      });
      tick(duel.room);
      setInput(duel.room, duel.targetSocket, {});
      const after = getPlayer(
        duel.room.snapshotFor(duel.targetSocket),
        duel.targetId
      );
      if (
        distanceBetween(before, after) > 0.01 ||
        after.cooldowns[mobilityCase.slot] > 0 ||
        after.actionSkillId === mobilityCase.skillId ||
        internals.catalogPlayerMotions.has(duel.targetId)
      ) {
        failures.push(
          `${statusCase.name}/${mobilityCase.skillId}: mobility cast started or moved while controlled`
        );
      }
    }
  }

  for (const statusCase of CONTROL_LOCK_STATUS_CASES) {
    for (const mobilityCase of CONTROL_LOCK_MOBILITY_CASES.filter(
      (candidate) => candidate.classId === "archer"
    )) {
      const duel = createDuel(
        statusCase.casterClass,
        "archer",
        `${statusCase.name}_${mobilityCase.skillId}_interrupt_caster`,
        `${statusCase.name}_${mobilityCase.skillId}_interrupt_target`
      );
      placeDuel(
        duel,
        OPEN_FIELD_TEST_POINT,
        { x: OPEN_FIELD_TEST_POINT.x + 100, y: OPEN_FIELD_TEST_POINT.y }
      );
      const internals = duel.room as unknown as {
        players: Map<string, PublicPlayer>;
        catalogPlayerMotions: Map<string, unknown>;
        applyRoot: (
          target: PublicPlayer,
          durationMs: number,
          now: number
        ) => boolean;
        applyStun: (
          target: PublicPlayer,
          durationMs: number,
          now: number
        ) => boolean;
      };
      const target = internals.players.get(duel.targetId);
      assert(Boolean(target), `Missing interrupt target for ${mobilityCase.skillId}.`);
      target.catalogLoadout[mobilityCase.slot] = mobilityCase.skillId;

      setInput(duel.room, duel.targetSocket, {
        angle: 0,
        aimX: target.x + 400,
        aimY: target.y,
        [mobilityCase.slot]: true
      });
      tick(duel.room);
      setInput(duel.room, duel.targetSocket, {});
      if (!internals.catalogPlayerMotions.has(duel.targetId)) {
        failures.push(
          `${statusCase.name}/${mobilityCase.skillId}: movement did not start before interrupt audit`
        );
        continue;
      }
      const beforeControl = getPlayer(
        duel.room.snapshotFor(duel.targetSocket),
        duel.targetId
      );
      const applied =
        statusCase.name === "root"
          ? internals.applyRoot(target, 1000, fakeNow)
          : internals.applyStun(target, 1000, fakeNow);
      if (!applied) {
        failures.push(
          `${statusCase.name}/${mobilityCase.skillId}: interrupt status was rejected`
        );
        continue;
      }
      const atControl = getPlayer(
        duel.room.snapshotFor(duel.targetSocket),
        duel.targetId
      );
      advance(duel.room, 120);
      const afterControl = getPlayer(
        duel.room.snapshotFor(duel.targetSocket),
        duel.targetId
      );
      if (
        !atControl[statusCase.statusFlag] ||
        !afterControl[statusCase.statusFlag] ||
        distanceBetween(beforeControl, afterControl) > 0.01 ||
        internals.catalogPlayerMotions.has(duel.targetId)
      ) {
        failures.push(
          `${statusCase.name}/${mobilityCase.skillId}: active movement continued after control landed (status=${afterControl[statusCase.statusFlag]}, moved=${distanceBetween(beforeControl, afterControl).toFixed(2)}, motion=${internals.catalogPlayerMotions.has(duel.targetId)})`
        );
      }
    }
  }

  const rootedNonMobility = createDuel(
    "archer",
    "warrior",
    "root_non_mobility_caster",
    "root_non_mobility_target"
  );
  placeDuel(
    rootedNonMobility,
    OPEN_FIELD_TEST_POINT,
    { x: OPEN_FIELD_TEST_POINT.x + 100, y: OPEN_FIELD_TEST_POINT.y }
  );
  const nonMobilityInternals = rootedNonMobility.room as unknown as {
    players: Map<string, PublicPlayer>;
  };
  const rootedWarrior = nonMobilityInternals.players.get(
    rootedNonMobility.targetId
  );
  assert(Boolean(rootedWarrior), "Missing rooted non-mobility target.");
  rootedWarrior.catalogLoadout.skillQ = "warrior_01";
  castSkillAt(
    rootedNonMobility,
    "skillE",
    { x: rootedWarrior.x, y: rootedWarrior.y },
    0
  );
  const rootedBeforeBuff = getPlayer(
    rootedNonMobility.room.snapshotFor(rootedNonMobility.targetSocket),
    rootedNonMobility.targetId
  );
  setInput(rootedNonMobility.room, rootedNonMobility.targetSocket, {
    skillQ: true
  });
  tick(rootedNonMobility.room);
  const rootedAfterBuff = getPlayer(
    rootedNonMobility.room.snapshotFor(rootedNonMobility.targetSocket),
    rootedNonMobility.targetId
  );
  if (
    rootedAfterBuff.actionSkillId !== "warrior_01" ||
    rootedAfterBuff.cooldowns.skillQ <= 0 ||
    distanceBetween(rootedBeforeBuff, rootedAfterBuff) > 0.01
  ) {
    failures.push(
      "root/warrior_01: root should allow a non-mobility buff without moving the player"
    );
  }

  assert(
    failures.length === 0,
    `Control-lock mobility regressions:\n${failures.map((failure) => `- ${failure}`).join("\n")}`
  );

  return {
    name: "root and stun mobility lock",
    details: [
      "Root and stun block all four self-movement skills before cast.",
      "Root and stun interrupt all three in-progress Archer movement skills.",
      "Root still allows non-mobility skills; stun keeps its existing full skill lock."
    ]
  };
}

function createDuel(
  attackerClass: ClassId,
  targetClass: ClassId,
  attackerSocket: string,
  targetSocket: string,
  options: {
    attackerCatalogLoadout?: ReturnType<typeof getDefaultArenaCatalogLoadout>;
    attackerEngineerTurretKind?: "mechanical" | "magic_missile";
  } = {}
): DuelSetup {
  fakeNow += 25_000;
  const room = new GameRoom({
    noBots: true,
    fixedSpawn: true,
    fixedSpawnPoint: TEST_SPAWN
  });
  const attacker = room.addHuman(attackerSocket, {
    name: attackerSocket.toUpperCase(),
    classId: attackerClass,
    loadout: getDefaultArenaLoadout(attackerClass),
    catalogLoadout: options.attackerCatalogLoadout ?? getDefaultArenaCatalogLoadout(attackerClass),
    engineerTurretKind: options.attackerEngineerTurretKind
  });
  const target = room.addHuman(targetSocket, {
    name: targetSocket.toUpperCase(),
    classId: targetClass,
    loadout: getDefaultArenaLoadout(targetClass),
    catalogLoadout: getDefaultArenaCatalogLoadout(targetClass)
  });

  advance(room, SPAWN_GUARD_CLEAR_MS);
  const snapshot = room.snapshotFor(attackerSocket);
  assert(!getPlayer(snapshot, attacker.playerId).spawnProtected, "Attacker spawn protection should be cleared before gameplay audit.");
  assert(!getPlayer(snapshot, target.playerId).spawnProtected, "Target spawn protection should be cleared before gameplay audit.");

  return {
    room,
    attackerSocket,
    targetSocket,
    attackerId: attacker.playerId,
    targetId: target.playerId
  };
}

function castSkill(duel: DuelSetup, skill: "skillQ" | "skillE" | "skillR", settleMs: number) {
  const snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const attacker = getPlayer(snapshot, duel.attackerId);
  const target = getPlayer(snapshot, duel.targetId);
  setInput(duel.room, duel.attackerSocket, {
    angle: angleBetween(attacker, target),
    aimX: target.x,
    aimY: target.y,
    [skill]: true
  });
  tick(duel.room);
  setInput(duel.room, duel.attackerSocket, {});
  if (settleMs > 0) {
    advance(duel.room, settleMs);
  }
}

function castSkillAt(duel: DuelSetup, skill: "skillQ" | "skillE" | "skillR", point: { x: number; y: number }, settleMs: number) {
  const snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const attacker = getPlayer(snapshot, duel.attackerId);
  setInput(duel.room, duel.attackerSocket, {
    angle: angleBetween(attacker, point),
    aimX: point.x,
    aimY: point.y,
    [skill]: true
  });
  tick(duel.room);
  setInput(duel.room, duel.attackerSocket, {});
  if (settleMs > 0) {
    advance(duel.room, settleMs);
  }
}

function fireArcherArrowAt(duel: DuelSetup, point: { x: number; y: number }) {
  setInput(duel.room, duel.attackerSocket, {
    angle: 180,
    aimX: point.x,
    aimY: point.y,
    attack: true
  });
  tick(duel.room);
  setInput(duel.room, duel.attackerSocket, {
    angle: 180,
    aimX: point.x,
    aimY: point.y,
    attack: false
  });
  tick(duel.room);
}

function placeDuel(duel: DuelSetup, attackerPoint: { x: number; y: number }, targetPoint: { x: number; y: number }) {
  const internals = duel.room as unknown as {
    players: Map<string, PublicPlayer>;
  };
  const attacker = internals.players.get(duel.attackerId);
  const target = internals.players.get(duel.targetId);
  assert(Boolean(attacker) && Boolean(target), "Could not find players for placement.");
  attacker.x = attackerPoint.x;
  attacker.y = attackerPoint.y;
  target.x = targetPoint.x;
  target.y = targetPoint.y;
}

function clearActionLock(player: { action: unknown; actionStartedAt: number; actionEndsAt: number; actionPoseEndsAt: number; attacking: boolean; lastAttackAt: number }) {
  fakeNow += CLASS_STATS.warrior.attackCooldownMs + 360;
  player.action = null;
  player.actionStartedAt = 0;
  player.actionEndsAt = 0;
  player.actionPoseEndsAt = 0;
  player.attacking = false;
  player.lastAttackAt = 0;
}

function setInput(room: GameRoom, socketId: string, overrides: Partial<PlayerInput>) {
  room.setHumanInput(socketId, {
    ...EMPTY_INPUT,
    angle: 0,
    ...overrides
  });
}

function tick(room: GameRoom, deltaMs = FRAME_MS) {
  fakeNow += deltaMs;
  room.update(deltaMs);
}

function advance(room: GameRoom, ms: number) {
  fakeNow += ms;
  room.update(FRAME_MS);
}

function advanceFrames(room: GameRoom, ms: number) {
  let remaining = ms;
  while (remaining > 0) {
    const frameMs = Math.min(FRAME_MS, remaining);
    tick(room, frameMs);
    remaining -= frameMs;
  }
}

function getPlayer(snapshot: GameSnapshot, playerId: string): PublicPlayer {
  const player = snapshot.players.find((candidate) => candidate.id === playerId);
  assert(Boolean(player), `Missing player ${playerId} in snapshot.`);
  return player;
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main();

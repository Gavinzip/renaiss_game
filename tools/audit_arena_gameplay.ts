import { GameRoom } from "../apps/server/src/game/GameRoom";
import { CLASS_STATS, COMBAT, WORLD, getSkillCooldownMs, type ClassId, type GameSnapshot, type PlayerInput, type PublicPlayer } from "../packages/shared/src/index";

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

  Date.now = () => fakeNow;
  try {
    checks.push(checkMageActionWindow());
    checks.push(checkMageCursorTargetedAreaRuntime());
    checks.push(checkMageFullRotationSurvivability());
    checks.push(checkMouseAimOverridesStaleAngleRuntime());
    checks.push(checkArcherProjectileBodyHurtboxRuntime());
    checks.push(checkMageBeamMovementLockRuntime());
    checks.push(checkArcherCursorTargetedAreaRuntime());
    checks.push(checkBotArcherChargedReleaseRuntime());
    checks.push(checkSharedArenaBotReplacementRuntime());
    checks.push(checkDeathClassSwitchRuntime());
    checks.push(checkWarriorDirectionalMeleeRuntime());
    checks.push(checkAttackBoostPickupRuntime());
    checks.push(checkTurretDeathVfxRuntime());
    checks.push(checkRandomReviewSpawnRuntime());
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
  const expectedHealth = CLASS_STATS.archer.maxHealth - COMBAT.mageUltimateDamage;

  assert(mage.action === "skillR", `Mage all-button input should resolve as one prioritized R action, got ${mage.action ?? "none"}.`);
  assert(target.health === expectedHealth, `Mage same-tick Q/E/R/basic should deal only R damage. Expected ${expectedHealth}, got ${target.health}.`);
  assert(target.alive, "Mage same-tick action stack killed the target.");
  assert(mage.cooldowns.skillR > firstSnapshot.serverTime, "Mage R cooldown should start after the prioritized action.");
  assert(mage.cooldowns.skillR - firstSnapshot.serverTime === getSkillCooldownMs("mage", "skillR"), `Mage R cooldown should be ${getSkillCooldownMs("mage", "skillR")}ms, got ${mage.cooldowns.skillR - firstSnapshot.serverTime}ms.`);
  assert(mage.cooldowns.skillQ === 0 && mage.cooldowns.skillE === 0, `Mage Q/E cooldowns should stay unused in the same action window: ${JSON.stringify(mage.cooldowns)}.`);
  assert(firstSnapshot.projectiles.length === 0, `Mage all-button input spawned ${firstSnapshot.projectiles.length} projectile(s); basic attack must not fire with a skill.`);

  const firstDamageNumbers = firstSnapshot.effects.filter((effect) => effect.type === "damage_number" && effect.ownerId === duel.attackerId);
  assert(
    firstDamageNumbers.length === 1 && firstDamageNumbers[0].value === COMBAT.mageUltimateDamage,
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
  const eMissDuel = createDuel("mage", "archer", "mage_e_miss", "target_e_miss");
  placeDuel(eMissDuel, TEST_SPAWN, { x: TEST_SPAWN.x + 120, y: TEST_SPAWN.y });
  castSkillAt(eMissDuel, "skillE", { x: TEST_SPAWN.x + COMBAT.mageBurstRadius + 260, y: TEST_SPAWN.y }, 0);
  const eMissSnapshot = eMissDuel.room.snapshotFor(eMissDuel.attackerSocket);
  const eMissMage = getPlayer(eMissSnapshot, eMissDuel.attackerId);
  const eMissTarget = getPlayer(eMissSnapshot, eMissDuel.targetId);
  assert(eMissTarget.health === CLASS_STATS.archer.maxHealth, `Mage E should not hit a nearby target when the cursor burst is elsewhere. Got ${eMissTarget.health}.`);
  assert(eMissMage.cooldowns.skillE - eMissSnapshot.serverTime === getSkillCooldownMs("mage", "skillE"), `Mage E cooldown should be ${getSkillCooldownMs("mage", "skillE")}ms, got ${eMissMage.cooldowns.skillE - eMissSnapshot.serverTime}ms.`);

  const eHitDuel = createDuel("mage", "archer", "mage_e_hit", "target_e_hit");
  const remoteBurstPoint = { x: TEST_SPAWN.x + COMBAT.mageBurstRadius + 130, y: TEST_SPAWN.y };
  placeDuel(eHitDuel, TEST_SPAWN, remoteBurstPoint);
  castSkillAt(eHitDuel, "skillE", remoteBurstPoint, 0);
  const eHitSnapshot = eHitDuel.room.snapshotFor(eHitDuel.attackerSocket);
  const eHitTarget = getPlayer(eHitSnapshot, eHitDuel.targetId);
  const burstEffect = eHitSnapshot.effects.find((effect) => effect.type === "burst" && effect.ownerId === eHitDuel.attackerId);
  assert(eHitTarget.health === CLASS_STATS.archer.maxHealth - COMBAT.mageBurstDamage, `Mage E cursor burst should hit a remote target inside the aimed radius. Got ${eHitTarget.health}.`);
  assert(eHitTarget.stunned, "Mage E cursor burst should stun a surviving target.");
  assert(Math.round(burstEffect?.x ?? 0) === Math.round(remoteBurstPoint.x) && Math.round(burstEffect?.y ?? 0) === Math.round(remoteBurstPoint.y), `Mage E effect should spawn at cursor point, got ${JSON.stringify(burstEffect)}.`);

  const rHitDuel = createDuel("mage", "archer", "mage_r_hit", "target_r_hit");
  const remoteStormPoint = { x: TEST_SPAWN.x + COMBAT.mageUltimateRadius + 130, y: TEST_SPAWN.y };
  placeDuel(rHitDuel, TEST_SPAWN, remoteStormPoint);
  castSkillAt(rHitDuel, "skillR", remoteStormPoint, 0);
  const rHitSnapshot = rHitDuel.room.snapshotFor(rHitDuel.attackerSocket);
  const rHitMage = getPlayer(rHitSnapshot, rHitDuel.attackerId);
  const rHitTarget = getPlayer(rHitSnapshot, rHitDuel.targetId);
  const stormEffect = rHitSnapshot.effects.find((effect) => effect.type === "ultimate" && effect.ownerId === rHitDuel.attackerId && effect.classId === "mage");
  assert(rHitTarget.health === CLASS_STATS.archer.maxHealth - COMBAT.mageUltimateDamage, `Mage R cursor storm should hit a remote target inside the aimed radius. Got ${rHitTarget.health}.`);
  assert(rHitMage.cooldowns.skillR - rHitSnapshot.serverTime === getSkillCooldownMs("mage", "skillR"), `Mage R cooldown should be ${getSkillCooldownMs("mage", "skillR")}ms, got ${rHitMage.cooldowns.skillR - rHitSnapshot.serverTime}ms.`);
  assert(Math.round(stormEffect?.x ?? 0) === Math.round(remoteStormPoint.x) && Math.round(stormEffect?.y ?? 0) === Math.round(remoteStormPoint.y), `Mage R effect should spawn at cursor point, got ${JSON.stringify(stormEffect)}.`);

  return {
    name: "mage cursor-targeted area runtime behavior",
    details: [
      "Mage E misses targets near the caster when the cursor burst is elsewhere.",
      `Mage E/R hit remote cursor-centered areas with ${getSkillCooldownMs("mage", "skillE") / 1000}s/${getSkillCooldownMs("mage", "skillR") / 1000}s cooldowns.`
    ]
  };
}

function checkMageFullRotationSurvivability(): GameplayCheck {
  const duel = createDuel("mage", "archer", "mage_rotation", "target_archer_rotation");
  placeDuel(duel, TEST_SPAWN, { x: TEST_SPAWN.x + 360, y: TEST_SPAWN.y });

  castSkill(duel, "skillR", 980);
  castSkill(duel, "skillE", 820);
  castSkill(duel, "skillQ", 840);

  const snapshot = duel.room.snapshotFor(duel.attackerSocket);
  const target = getPlayer(snapshot, duel.targetId);
  const expectedDamage = COMBAT.mageUltimateDamage + COMBAT.mageBurstDamage + COMBAT.mageBeamDamage;
  const expectedHealth = CLASS_STATS.archer.maxHealth - expectedDamage;

  assert(target.health === expectedHealth, `Mage R/E/Q rotation should deal ${expectedDamage} total damage. Expected ${expectedHealth} HP, got ${target.health}.`);
  assert(target.alive, `Mage R/E/Q rotation killed a minimum-HP target at ${target.health}/${target.maxHealth}.`);
  assert(target.health >= Math.ceil(target.maxHealth * 0.3), `Mage R/E/Q rotation leaves too little counterplay: ${target.health}/${target.maxHealth}.`);
  assert(!snapshot.events.some((event) => event.type === "kill" && event.actorId === duel.attackerId), "Mage rotation produced a kill event during the survivability audit.");

  return {
    name: "mage full-rotation survivability",
    details: [
      `Mage R/E/Q deals ${expectedDamage}, leaving Archer at ${target.health}/${target.maxHealth}.`,
      "The lowest-HP target survives a full non-basic Mage rotation."
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
  assert(warriorTarget.health === CLASS_STATS.mage.maxHealth - CLASS_STATS.warrior.attackPower, `Warrior basic should follow cursor aim, not stale input angle. Got target HP ${warriorTarget.health}.`);

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
  assert(engineerTarget.health === CLASS_STATS.mage.maxHealth - CLASS_STATS.engineer.attackPower, `Engineer basic should follow cursor aim, not stale input angle. Got target HP ${engineerTarget.health}.`);

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
  assert(mageBeamTarget.health === CLASS_STATS.archer.maxHealth - COMBAT.mageBeamDamage, `Mage Q should fire toward cursor aim, not stale input angle. Got target HP ${mageBeamTarget.health}.`);

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
    headTarget.health === CLASS_STATS.mage.maxHealth - CLASS_STATS.archer.attackPower,
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
  const afterCast = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(Math.abs(afterCast.x - TEST_SPAWN.x) < 0.01, `Mage should not move on the Q cast tick. Expected x ${TEST_SPAWN.x}, got ${afterCast.x}.`);

  setInput(duel.room, duel.attackerSocket, {
    moveX: 1,
    aimX: TEST_SPAWN.x + 360,
    aimY: TEST_SPAWN.y
  });
  tick(duel.room, 420);
  const duringLock = getPlayer(duel.room.snapshotFor(duel.attackerSocket), duel.attackerId);
  assert(Math.abs(duringLock.x - TEST_SPAWN.x) < 0.01, `Mage should stay locked during the Q beam pose. Expected x ${TEST_SPAWN.x}, got ${duringLock.x}.`);

  tick(duel.room, 520);
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
  const targetRoot = eHitSnapshot.effects.find((effect) => effect.type === "root" && effect.ownerId === eHitDuel.targetId);
  assert(eHitTarget.rooted, "Archer E cursor field should root a target inside the aimed area.");
  assert(!rootCast, `Archer E should not emit the old oversized root_cast world VFX, got ${JSON.stringify(rootCast)}.`);
  assert(Boolean(targetRoot), "Archer E should show a compact root VFX under each rooted target.");

  const rHitDuel = createDuel("archer", "mage", "archer_seed", "target_mage");
  const seedPoint = { x: TEST_SPAWN.x + COMBAT.archerUltimateRadius + 120, y: TEST_SPAWN.y };
  placeDuel(rHitDuel, TEST_SPAWN, seedPoint);
  castSkillAt(rHitDuel, "skillR", seedPoint, 0);

  const snapshot = rHitDuel.room.snapshotFor(rHitDuel.attackerSocket);
  const archer = getPlayer(snapshot, rHitDuel.attackerId);
  const target = getPlayer(snapshot, rHitDuel.targetId);
  const expectedHealth = CLASS_STATS.mage.maxHealth - COMBAT.archerUltimateDamage;
  const ultimate = snapshot.effects.find((effect) => effect.type === "ultimate" && effect.ownerId === rHitDuel.attackerId && effect.classId === "archer");
  const event = snapshot.events.find((combatEvent) => combatEvent.type === "ultimate" && combatEvent.actorId === rHitDuel.attackerId);

  assert(archer.action === "skillR", `Archer Seed Rain should put Archer into skillR action, got ${archer.action ?? "none"}.`);
  assert(target.health === expectedHealth, `Archer Seed Rain should deal ${COMBAT.archerUltimateDamage} at cursor. Expected target HP ${expectedHealth}, got ${target.health}.`);
  assert(target.alive, "Archer Seed Rain should not one-shot Mage.");
  assert(Boolean(ultimate), "Archer Seed Rain did not emit an Archer ultimate effect.");
  assert(ultimate?.radius === COMBAT.archerUltimateRadius, `Archer Seed Rain radius mismatch: ${ultimate?.radius ?? "missing"}.`);
  assert(ultimate?.duration === 2100, `Archer Seed Rain should stay readable for 2100ms, got ${ultimate?.duration ?? "missing"}.`);
  assert(Math.round(ultimate?.x ?? 0) === Math.round(seedPoint.x) && Math.round(ultimate?.y ?? 0) === Math.round(seedPoint.y), `Archer Seed Rain effect should spawn at cursor point, got ${JSON.stringify(ultimate)}.`);
  assert(event?.message.includes("Seed Rain"), `Archer ultimate event should identify Seed Rain, got ${event?.message ?? "missing"}.`);
  assert(archer.cooldowns.skillR > snapshot.serverTime, "Archer R cooldown should start after Seed Rain.");

  return {
    name: "archer cursor-targeted area runtime behavior",
    details: [
      "Root Bind misses near-caster targets when aimed elsewhere and only shows compact root VFX under rooted targets.",
      `Seed Rain emits Archer ultimate radius ${ultimate?.radius} at the cursor for ${ultimate?.duration}ms.`,
      `Target Mage stays alive at ${target.health}/${target.maxHealth}.`
    ]
  };
}

function checkDeathClassSwitchRuntime(): GameplayCheck {
  const duel = createDuel("warrior", "mage", "switch_warrior", "switch_attacker");
  const earlySwitch = duel.room.switchHumanClass(duel.attackerSocket, "mage");
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

  const switched = duel.room.switchHumanClass(duel.attackerSocket, "mage");
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
    classId: "mage"
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
  const first = room.addHuman(firstSocket, { name: "HUMAN_ONE", classId: "warrior" });
  assert(room.playerCount() === 1, `Shared arena should have 1 human after first join, got ${room.playerCount()}.`);
  assert(room.botCount() === 7, `First human should replace one bot, got ${room.botCount()} bots.`);
  assert(room.snapshotFor(firstSocket).players.length === 8, "First shared arena snapshot should still expose 8 total combatants.");

  const second = room.addHuman(secondSocket, { name: "HUMAN_TWO", classId: "mage" });
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
  const expectedFrontHealth = CLASS_STATS.mage.maxHealth - CLASS_STATS.warrior.attackPower;
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
      `Forward slash deals ${CLASS_STATS.warrior.attackPower} damage.`,
      "A target behind the same-radius melee range is not hit."
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
      boosted: boolean;
      lastAttackAt: number;
      boostEndsAt: number;
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
    maxHealth: COMBAT.turretHealth,
    boosted: false,
    lastAttackAt: fakeNow,
    boostEndsAt: 0
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
  const expectedDamage = Math.ceil(CLASS_STATS.warrior.attackPower * WORLD.attackBoostMultiplier);
  const expectedHealth = CLASS_STATS.mage.maxHealth - expectedDamage;
  assert(afterAttackTarget.health === expectedHealth, `Attack boost should raise Warrior damage to ${expectedDamage}. Got target HP ${afterAttackTarget.health}.`);

  return {
    name: "attack boost mushroom runtime behavior",
    details: [
      `Mushroom pickup gives ${WORLD.attackBoostDurationMs / 1000}s attack boost.`,
      `Warrior basic damage increased from ${CLASS_STATS.warrior.attackPower} to ${expectedDamage}.`
    ]
  };
}

function checkRandomReviewSpawnRuntime(): GameplayCheck {
  fakeNow += 25_000;
  const room = new GameRoom({
    noBots: true,
    fixedSpawn: true
  });
  const first = room.addHuman("spawn_alpha", {
    name: "SPAWN_ALPHA",
    classId: "warrior"
  });
  const second = room.addHuman("spawn_beta", {
    name: "SPAWN_BETA",
    classId: "mage"
  });
  advance(room, SPAWN_GUARD_CLEAR_MS);

  const snapshot = room.snapshotFor("spawn_alpha");
  const firstPlayer = getPlayer(snapshot, first.playerId);
  const secondPlayer = getPlayer(snapshot, second.playerId);
  const centerDistanceA = distanceBetween(firstPlayer, TEST_SPAWN);
  const centerDistanceB = distanceBetween(secondPlayer, TEST_SPAWN);
  const playerDistance = distanceBetween(firstPlayer, secondPlayer);

  assert(centerDistanceA >= 700, `First random review spawn should not stay at the center. Distance: ${Math.round(centerDistanceA)}.`);
  assert(centerDistanceB >= 700, `Second random review spawn should not stay at the center. Distance: ${Math.round(centerDistanceB)}.`);
  assert(playerDistance >= 500, `Random review spawns should keep players separated. Distance: ${Math.round(playerDistance)}.`);

  return {
    name: "random review spawn runtime behavior",
    details: [
      `Fixed review mode without explicit coordinates spawned players ${Math.round(centerDistanceA)}px and ${Math.round(centerDistanceB)}px from center.`,
      `Players spawned ${Math.round(playerDistance)}px apart.`
    ]
  };
}

function createDuel(attackerClass: ClassId, targetClass: ClassId, attackerSocket: string, targetSocket: string): DuelSetup {
  fakeNow += 25_000;
  const room = new GameRoom({
    noBots: true,
    fixedSpawn: true,
    fixedSpawnPoint: TEST_SPAWN
  });
  const attacker = room.addHuman(attackerSocket, {
    name: attackerSocket.toUpperCase(),
    classId: attackerClass
  });
  const target = room.addHuman(targetSocket, {
    name: targetSocket.toUpperCase(),
    classId: targetClass
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

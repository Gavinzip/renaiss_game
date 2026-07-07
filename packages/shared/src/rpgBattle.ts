import { getRpgElementMultiplier, getRpgMoveById, RPG_ELEMENT_ADVANTAGE_MULTIPLIER, RPG_ELEMENT_RESIST_MULTIPLIER, RPG_STARTER_PETS, RPG_STATUS_META } from "./rpgContent";
import type { RpgBattleAction, RpgBattleLogEntry, RpgBattlePetState, RpgBattleState, RpgBattleStatus, RpgMove, RpgMoveEffect, RpgPetDefinition, RpgStatusId } from "./rpgTypes";

export interface RpgRosterPet {
  definitionId: string;
  ownerId: string;
  nickname?: string;
  moveIds?: readonly string[];
}

const MAX_ENERGY = 10;
type BattleSide = "left" | "right";

export function getRpgBattleEnergyForTurn(turn: number) {
  return Math.min(MAX_ENERGY, Math.max(1, Math.floor(turn)));
}

export function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function cloneStatuses(statuses: readonly RpgBattleStatus[]) {
  return statuses.map((status) => ({ ...status }));
}

function log(turn: number, entry: Omit<RpgBattleLogEntry, "turn">): RpgBattleLogEntry {
  return { turn, ...entry };
}

function findPetDefinition(definitionId: string) {
  const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
  if (!definition) throw new Error(`Unknown RPG pet definition: ${definitionId}`);
  return definition;
}

function createBattlePet(definition: RpgPetDefinition, rosterPet: RpgRosterPet, side: BattleSide, slot: 0 | 1 | 2): RpgBattlePetState {
  const moveIds = rosterPet.moveIds && rosterPet.moveIds.length > 0 ? rosterPet.moveIds : definition.startingMoveIds;
  return {
    id: `${side}_${slot}_${definition.id}`,
    definitionId: definition.id,
    ownerId: rosterPet.ownerId,
    side,
    slot,
    element: definition.element,
    name: rosterPet.nickname || definition.name,
    maxHp: definition.maxHp,
    hp: definition.maxHp,
    attack: definition.attack,
    defense: definition.defense,
    speed: definition.speed,
    energy: getRpgBattleEnergyForTurn(1),
    maxEnergy: MAX_ENERGY,
    moveIds,
    statuses: [],
    defeated: false
  };
}

export function createStarterRoster(ownerId: string): RpgRosterPet[] {
  return RPG_STARTER_PETS.map((pet) => ({ definitionId: pet.id, ownerId, moveIds: pet.startingMoveIds }));
}

export function createRpgBattleState(id: string, leftRoster: readonly RpgRosterPet[], rightRoster: readonly RpgRosterPet[]): RpgBattleState {
  return {
    id,
    turn: 1,
    activeSide: "left",
    phase: "selecting",
    left: leftRoster.slice(0, 3).map((pet, index) => createBattlePet(findPetDefinition(pet.definitionId), pet, "left", index as 0 | 1 | 2)),
    right: rightRoster.slice(0, 3).map((pet, index) => createBattlePet(findPetDefinition(pet.definitionId), pet, "right", index as 0 | 1 | 2)),
    winner: null,
    log: []
  };
}

function living(pets: readonly RpgBattlePetState[]) {
  return pets.filter((pet) => !pet.defeated && pet.hp > 0);
}

function allPets(state: RpgBattleState) {
  return [...state.left, ...state.right];
}

export function getRpgBattleActiveSide(state: RpgBattleState): BattleSide {
  return state.activeSide ?? "left";
}

export function getRpgBattleTurnOrder(state: RpgBattleState, side?: BattleSide) {
  return allPets(state)
    .filter((pet) => !pet.defeated && pet.hp > 0 && (!side || pet.side === side))
    .sort((a, b) => {
      if (b.speed !== a.speed) return b.speed - a.speed;
      // The right-seat versus view swaps display sides, so tie breaks must not depend on presentation side.
      return a.id.localeCompare(b.id);
    });
}

export function getRpgCurrentTurnActor(state: RpgBattleState) {
  const order = getRpgBattleTurnOrder(state, getRpgBattleActiveSide(state));
  if (order.length === 0) return null;
  return order[0] ?? null;
}

function teamFor(state: RpgBattleState, side: BattleSide) {
  return side === "left" ? state.left : state.right;
}

function opponentsFor(state: RpgBattleState, side: BattleSide) {
  return side === "left" ? state.right : state.left;
}

export function getRpgReachableEnemyTargets(state: RpgBattleState, actor: RpgBattlePetState) {
  const enemies = living(opponentsFor(state, actor.side));
  const frontEnemy = enemies.find((pet) => pet.slot === 0);
  return frontEnemy ? [frontEnemy] : enemies;
}

export function getRpgDefaultTargetIdForMove(state: RpgBattleState, actor: RpgBattlePetState, move: RpgMove) {
  if (move.target === "self") return actor.id;
  if (move.target === "singleAlly") return living(teamFor(state, actor.side))[0]?.id;
  if (move.target === "singleEnemy") return getRpgReachableEnemyTargets(state, actor)[0]?.id;
  return undefined;
}

export function isLegalRpgActionTarget(state: RpgBattleState, actorId: string, moveId: string, targetId?: string) {
  const actor = allPets(state).find((pet) => pet.id === actorId);
  const move = getRpgMoveById(moveId);
  if (!actor || actor.defeated || actor.hp <= 0 || !move || !actor.moveIds.includes(move.id)) return false;
  const allies = living(teamFor(state, actor.side));
  const reachableEnemies = getRpgReachableEnemyTargets(state, actor);
  if (move.target === "self") return targetId === undefined || targetId === actor.id;
  if (move.target === "allAllies" || move.target === "allEnemies") return targetId === undefined;
  if (move.target === "singleAlly") return Boolean(targetId && allies.some((pet) => pet.id === targetId));
  return Boolean(targetId && reachableEnemies.some((pet) => pet.id === targetId));
}

function getStatus(pet: RpgBattlePetState, id: string) {
  return pet.statuses.find((status) => status.id === id) ?? null;
}

function isNegativeStatus(id: string) {
  return id === "burn" || id === "poison" || id === "stun";
}

function statusLabel(id: RpgStatusId) {
  return RPG_STATUS_META[id].label;
}

function tickStartStatuses(pet: RpgBattlePetState, turn: number): RpgBattleLogEntry[] {
  const entries: RpgBattleLogEntry[] = [];
  for (const status of pet.statuses) {
    if (pet.defeated) continue;
    if (status.id === "burn" || status.id === "poison") {
      const amount = Math.max(1, status.power);
      pet.hp = Math.max(0, pet.hp - amount);
      entries.push(log(turn, { type: "status", targetId: pet.id, amount, message: `${pet.name} 受到${status.id === "burn" ? "燃燒" : "中毒"} ${amount} 點。` }));
    }
    if (status.id === "regen") {
      const amount = Math.max(1, status.power);
      pet.hp = Math.min(pet.maxHp, pet.hp + amount);
      entries.push(log(turn, { type: "heal", targetId: pet.id, amount, message: `${pet.name} 回復 ${amount} HP。` }));
    }
  }
  if (pet.hp <= 0 && !pet.defeated) {
    pet.defeated = true;
    entries.push(log(turn, { type: "defeat", targetId: pet.id, message: `${pet.name} 倒下。` }));
  }
  return entries;
}

function endTurnPetUpdate(pet: RpgBattlePetState) {
  pet.statuses = pet.statuses.map((status) => ({ ...status, remainingTurns: status.remainingTurns - 1 })).filter((status) => status.remainingTurns > 0);
}

function refreshEnergyForTurn(state: RpgBattleState) {
  const energy = getRpgBattleEnergyForTurn(state.turn);
  for (const pet of allPets(state)) pet.energy = pet.defeated ? 0 : energy;
}

function setTeamEnergy(state: RpgBattleState, side: BattleSide, energy: number) {
  for (const pet of teamFor(state, side)) pet.energy = pet.defeated || pet.hp <= 0 ? 0 : energy;
}

function appendPhaseLogs(state: RpgBattleState, side: BattleSide, entries: readonly RpgBattleLogEntry[]) {
  state.log.push(...entries.map((entry) => ({ ...entry, phaseSide: entry.phaseSide ?? side })));
}

function applyStatus(target: RpgBattlePetState, effect: RpgMoveEffect, sourceMove: RpgMove, turn: number): RpgBattleLogEntry[] {
  if (!effect.status) return [];
  const nextStatus: RpgBattleStatus = { id: effect.status, remainingTurns: Math.max(1, effect.duration ?? 1), power: Math.max(1, effect.power ?? 1), sourceMoveId: sourceMove.id };
  const existing = target.statuses.find((status) => status.id === nextStatus.id);
  if (existing) {
    existing.remainingTurns = Math.max(existing.remainingTurns, nextStatus.remainingTurns);
    existing.power = Math.max(existing.power, nextStatus.power);
    existing.sourceMoveId = sourceMove.id;
  } else {
    target.statuses.push(nextStatus);
  }
  return [log(turn, { type: "status", targetId: target.id, moveId: sourceMove.id, message: `${target.name} 受到 ${statusLabel(nextStatus.id)}（${nextStatus.remainingTurns} 回合）。` })];
}

function applyHeal(target: RpgBattlePetState, amount: number, move: RpgMove, turn: number): RpgBattleLogEntry {
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return log(turn, { type: "heal", targetId: target.id, moveId: move.id, amount: target.hp - before, message: `${target.name} 因 ${move.name} 回復 ${target.hp - before} HP。` });
}

function applyCleanse(target: RpgBattlePetState, move: RpgMove, turn: number): RpgBattleLogEntry | null {
  const before = target.statuses.length;
  target.statuses = target.statuses.filter((status) => !isNegativeStatus(status.id));
  const removed = before - target.statuses.length;
  if (removed <= 0) return null;
  return log(turn, { type: "status", targetId: target.id, moveId: move.id, message: `${target.name} 因 ${move.name} 淨化 ${removed} 個負面狀態。` });
}

function actionTargets(state: RpgBattleState, actor: RpgBattlePetState, move: RpgMove, targetId?: string) {
  const allies = living(teamFor(state, actor.side));
  const enemies = living(opponentsFor(state, actor.side));
  if (move.target === "self") return [actor];
  if (move.target === "allAllies") return allies;
  if (move.target === "allEnemies") return enemies;
  if (move.target === "singleAlly") return [allies.find((pet) => pet.id === targetId) ?? allies[0]].filter(Boolean) as RpgBattlePetState[];
  const reachableEnemies = getRpgReachableEnemyTargets(state, actor);
  const explicitTarget = targetId ? reachableEnemies.find((pet) => pet.id === targetId) : null;
  return [explicitTarget ?? (targetId ? null : reachableEnemies[0])].filter(Boolean) as RpgBattlePetState[];
}

function effectTargets(state: RpgBattleState, actor: RpgBattlePetState, primaryTargets: RpgBattlePetState[], effect: RpgMoveEffect) {
  if (effect.target === "self") return [actor];
  if (effect.target === "team") return living(teamFor(state, actor.side));
  return primaryTargets;
}

function primaryActionTargetId(actor: RpgBattlePetState, move: RpgMove, targets: readonly RpgBattlePetState[]) {
  if (move.target === "self") return actor.id;
  if (move.target === "singleAlly" || move.target === "singleEnemy") return targets[0]?.id;
  return undefined;
}

function computeDamage(actor: RpgBattlePetState, target: RpgBattlePetState, move: RpgMove) {
  if (move.power <= 0) return 0;
  const guard = getStatus(target, "guard");
  const elementMultiplier = getRpgElementMultiplier(actor.element, target.element);
  const defense = Math.max(0, target.defense + (guard?.power ?? 0));
  let amount = Math.max(1, move.power + Math.floor(actor.attack * 0.72) - Math.floor(defense * 0.72));
  amount = Math.max(1, Math.floor(amount * elementMultiplier));
  return amount;
}

function executeAction(state: RpgBattleState, action: RpgBattleAction): RpgBattleLogEntry[] {
  const entries: RpgBattleLogEntry[] = [];
  const actor = allPets(state).find((pet) => pet.id === action.actorId);
  const move = getRpgMoveById(action.moveId);
  if (!actor || actor.defeated || actor.hp <= 0) return entries;
  if (!move || !actor.moveIds.includes(move.id)) return [log(state.turn, { type: "invalid", actorId: actor.id, moveId: action.moveId, message: `${actor.name} 沒有這個招式。` })];
  if (actor.energy < move.energyCost) return [log(state.turn, { type: "invalid", actorId: actor.id, moveId: move.id, message: `${actor.name} 能量不足，無法使用 ${move.name}。` })];
  const stun = getStatus(actor, "stun");
  if (stun) {
    actor.statuses = actor.statuses.filter((status) => status.id !== "stun");
    return [log(state.turn, { type: "status", actorId: actor.id, message: `${actor.name} 被控制，這回合無法行動。` })];
  }

  const targets = actionTargets(state, actor, move, action.targetId);
  if (targets.length <= 0) return [log(state.turn, { type: "invalid", actorId: actor.id, moveId: move.id, message: `${actor.name} 的 ${move.name} 沒有合法目標。` })];

  actor.energy -= move.energyCost;
  entries.push(log(state.turn, { type: "action", actorId: actor.id, targetId: primaryActionTargetId(actor, move, targets), moveId: move.id, message: `${actor.name} 使用 ${move.name}。` }));

  for (const target of targets) {
    if (target.defeated) continue;
    const damage = computeDamage(actor, target, move);
    if (damage > 0) {
      target.hp = Math.max(0, target.hp - damage);
      const multiplier = getRpgElementMultiplier(actor.element, target.element);
      const elementText = multiplier === RPG_ELEMENT_ADVANTAGE_MULTIPLIER ? "（屬性克制）" : multiplier === RPG_ELEMENT_RESIST_MULTIPLIER ? "（屬性被抵抗）" : "";
      entries.push(log(state.turn, { type: "damage", actorId: actor.id, targetId: target.id, moveId: move.id, amount: damage, message: `${target.name} 受到 ${damage} 傷害${elementText}。` }));
    }
  }

  for (const effect of move.effects) {
    const affected = effectTargets(state, actor, targets, effect);
    for (const target of affected) {
      if (target.defeated) continue;
      if (effect.heal) entries.push(applyHeal(target, effect.heal, move, state.turn));
      if (effect.cleanse) {
        const cleanse = applyCleanse(target, move, state.turn);
        if (cleanse) entries.push(cleanse);
      }
      entries.push(...applyStatus(target, effect, move, state.turn));
    }
    if (effect.selfDamage && actor.hp > 0) {
      actor.hp = Math.max(0, actor.hp - effect.selfDamage);
      entries.push(log(state.turn, { type: "damage", actorId: actor.id, targetId: actor.id, moveId: move.id, amount: effect.selfDamage, message: `${actor.name} 承受 ${effect.selfDamage} 反噬。` }));
    }
  }

  for (const pet of allPets(state)) {
    if (pet.hp <= 0 && !pet.defeated) {
      pet.defeated = true;
      entries.push(log(state.turn, { type: "defeat", targetId: pet.id, message: `${pet.name} 倒下。` }));
    }
  }

  return entries;
}

function actionSortValue(state: RpgBattleState, action: RpgBattleAction) {
  const actor = allPets(state).find((pet) => pet.id === action.actorId);
  const move = getRpgMoveById(action.moveId);
  return (actor?.speed ?? 0) + (move?.speed ?? 0);
}

function resolveWinner(state: RpgBattleState) {
  const leftAlive = living(state.left).length > 0;
  const rightAlive = living(state.right).length > 0;
  if (leftAlive && rightAlive) return null;
  if (leftAlive) return "left";
  if (rightAlive) return "right";
  return "draw";
}

export function resolveRpgBattleTurn(state: RpgBattleState, actions: readonly RpgBattleAction[]): RpgBattleState {
  const activeSide = getRpgBattleActiveSide(state);
  const roundEnergy = getRpgBattleEnergyForTurn(state.turn);
  const next: RpgBattleState = {
    ...state,
    activeSide,
    phase: "resolving",
    left: state.left.map((pet) => ({ ...pet, statuses: cloneStatuses(pet.statuses) })),
    right: state.right.map((pet) => ({ ...pet, statuses: cloneStatuses(pet.statuses) })),
    log: [...state.log]
  };

  if (activeSide === "left") {
    appendPhaseLogs(next, activeSide, [log(state.turn, { type: "turnStart", message: `第 ${state.turn} 回合開始。` })]);
    for (const pet of allPets(next)) appendPhaseLogs(next, activeSide, tickStartStatuses(pet, next.turn));
  }

  let remainingEnergy = roundEnergy;
  setTeamEnergy(next, activeSide, remainingEnergy);
  const usedActors = new Set<string>();
  const sortedActions = actions
    .filter((action) => {
      const actor = allPets(next).find((pet) => pet.id === action.actorId);
      if (!actor || actor.side !== activeSide || actor.defeated || actor.hp <= 0 || usedActors.has(actor.id)) return false;
      usedActors.add(actor.id);
      return true;
    })
    .sort((a, b) => actionSortValue(next, b) - actionSortValue(next, a));

  for (const action of sortedActions) {
    if (resolveWinner(next)) break;
    const actor = allPets(next).find((pet) => pet.id === action.actorId);
    const move = getRpgMoveById(action.moveId);
    if (!actor || !move) {
      appendPhaseLogs(next, activeSide, [log(next.turn, { type: "invalid", actorId: action.actorId, moveId: action.moveId, message: "選招資料不完整。" })]);
      continue;
    }
    if (move.energyCost > remainingEnergy) {
      appendPhaseLogs(next, activeSide, [log(next.turn, { type: "invalid", actorId: actor.id, moveId: move.id, message: `${actor.name} 的 ${move.name} 超出本回合剩餘能量。` })]);
      continue;
    }
    setTeamEnergy(next, activeSide, remainingEnergy);
    const energyBeforeAction = actor.energy;
    appendPhaseLogs(next, activeSide, executeAction(next, action));
    remainingEnergy = Math.max(0, remainingEnergy - Math.max(0, energyBeforeAction - actor.energy));
    setTeamEnergy(next, activeSide, remainingEnergy);
  }

  const winner = resolveWinner(next);
  if (winner) {
    next.winner = winner;
    next.phase = "finished";
    appendPhaseLogs(next, activeSide, [log(next.turn, { type: "victory", message: winner === "draw" ? "雙方同時失去戰力。" : `${winner === "left" ? "左方" : "右方"}獲勝。` })]);
  } else {
    next.phase = "selecting";
    if (activeSide === "left") {
      next.activeSide = "right";
      setTeamEnergy(next, "right", roundEnergy);
    } else {
      for (const pet of allPets(next)) endTurnPetUpdate(pet);
      next.turn += 1;
      next.activeSide = "left";
      refreshEnergyForTurn(next);
    }
  }
  return next;
}

function scoreMoveForTarget(actor: RpgBattlePetState, target: RpgBattlePetState, move: RpgMove) {
  const damage = computeDamage(actor, target, move);
  const statusValue = move.effects.reduce((sum, effect) => {
    if (effect.target !== "target") return sum;
    if (effect.status === "stun") return sum + 18;
    if (effect.status === "burn" || effect.status === "poison") return sum + 7;
    return sum;
  }, 0);
  return damage + statusValue + (target.hp <= damage ? 24 : 0);
}

export function createAiRpgActionForActor(state: RpgBattleState, actorId: string, maxEnergy?: number): RpgBattleAction | null {
  const actor = allPets(state).find((pet) => pet.id === actorId);
  if (!actor || actor.defeated || actor.hp <= 0) return null;
  const enemies = living(opponentsFor(state, actor.side));
  const allies = living(teamFor(state, actor.side));
  let best: { move: RpgMove; targetId?: string; score: number } | null = null;
  for (const moveId of actor.moveIds) {
    const move = getRpgMoveById(moveId);
    if (!move || actor.energy < move.energyCost || (maxEnergy !== undefined && move.energyCost > maxEnergy)) continue;
    if (move.target === "singleAlly") {
      const target = allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const healScore = target ? (1 - target.hp / target.maxHp) * 42 : 0;
      if (!best || healScore > best.score) best = { move, targetId: target?.id, score: healScore };
    } else if (move.target === "self" || move.target === "allAllies") {
      const score = move.effects.length * 9 + (actor.hp / actor.maxHp < 0.45 ? 12 : 0);
      if (!best || score > best.score) best = { move, score };
    } else {
      const validTargets = move.target === "allEnemies" ? enemies : getRpgReachableEnemyTargets(state, actor);
      const target = validTargets.slice().sort((a, b) => scoreMoveForTarget(actor, b, move) - scoreMoveForTarget(actor, a, move))[0];
      const score = target ? scoreMoveForTarget(actor, target, move) : 0;
      if (!best || score > best.score) best = { move, targetId: target?.id, score };
    }
  }
  return best ? { actorId: actor.id, moveId: best.move.id, targetId: best.targetId } : null;
}

export function createAiRpgActions(state: RpgBattleState, side: BattleSide, energyBudget = getRpgBattleEnergyForTurn(state.turn)): RpgBattleAction[] {
  const actors = living(teamFor(state, side)).sort((a, b) => b.speed - a.speed);
  const actions: RpgBattleAction[] = [];
  let remainingEnergy = energyBudget;
  for (const actor of actors) {
    const action = createAiRpgActionForActor(state, actor.id, remainingEnergy);
    if (action) actions.push(action);
    const move = action ? getRpgMoveById(action.moveId) : null;
    if (move) remainingEnergy = Math.max(0, remainingEnergy - move.energyCost);
    if (remainingEnergy <= 0) break;
  }
  return actions;
}

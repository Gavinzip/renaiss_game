import {
  RPG_ELEMENT_META,
  getRpgVfxProductionSpec,
  getRpgMoveById,
  type RpgBattleLogEntry,
  type RpgBattleState,
  type RpgMove
} from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { RPG_STATUS_VISUALS, statusDisplayLabel } from "./RpgStatusEffects";
import { RpgSkillProjectileSprite } from "./RpgSkillProjectileSprite";
import { RpgSkillVfxSprite } from "./RpgSkillVfxSprite";

const FLOATING_TYPES = new Set<RpgBattleLogEntry["type"]>(["damage", "heal", "status", "shield", "defeat"]);
const TRAVEL_RELEASE_DELAY_MS = 180;
const IMPACT_RELEASE_DELAY_MS = 280;
const FIELD_SLOT_POINTS: Record<"left" | "right", Array<{ x: number; y: number }>> = {
  left: [
    { x: 31, y: 58 },
    { x: 14, y: 37 },
    { x: 14, y: 80 }
  ],
  right: [
    { x: 69, y: 58 },
    { x: 86, y: 37 },
    { x: 86, y: 80 }
  ]
};

export interface RpgBattleFloatingEntry {
  id: string;
  type: RpgBattleLogEntry["type"];
  text: string;
}

export interface RpgBattleVfxPoint {
  id: string;
  side: "left" | "right";
  slot: number;
  x: number;
  y: number;
}

export interface RpgBattleReplay {
  key: string;
  actorId: string;
  actorSide: "left" | "right";
  actorPoint: RpgBattleVfxPoint;
  move: RpgMove;
  impactTargetIds: string[];
  targetPoints: RpgBattleVfxPoint[];
  floatingByTarget: Record<string, RpgBattleFloatingEntry[]>;
}

function allPets(state: RpgBattleState) {
  return [...state.left, ...state.right];
}

function presentationSideForPet(state: RpgBattleState, petId: string): "left" | "right" | null {
  if (state.left.some((pet) => pet.id === petId)) return "left";
  if (state.right.some((pet) => pet.id === petId)) return "right";
  return null;
}

function petsForPresentationSide(state: RpgBattleState, side: "left" | "right") {
  return side === "left" ? state.left : state.right;
}

function fieldPointForPet(state: RpgBattleState, pet: { id: string; side: "left" | "right"; slot: number }): RpgBattleVfxPoint {
  const presentationSide = presentationSideForPet(state, pet.id) ?? pet.side;
  const point = FIELD_SLOT_POINTS[presentationSide][pet.slot] ?? FIELD_SLOT_POINTS[presentationSide][0];
  return {
    id: pet.id,
    side: presentationSide,
    slot: pet.slot,
    x: point.x,
    y: point.y
  };
}

function inferTargetIds(state: RpgBattleState, actorId: string, move: RpgMove, targetIds: string[]) {
  if (targetIds.length > 0) return targetIds;
  const actorSide = presentationSideForPet(state, actorId);
  if (!actorSide) return [];
  if (move.target === "self" || move.target === "singleAlly") return [actorId];
  if (move.target === "allAllies") return petsForPresentationSide(state, actorSide).filter((pet) => !pet.defeated).map((pet) => pet.id);
  if (move.target === "allEnemies") return petsForPresentationSide(state, actorSide === "left" ? "right" : "left").filter((pet) => !pet.defeated).map((pet) => pet.id);
  return [];
}

function statusText(message: string) {
  const statusId = (Object.keys(RPG_STATUS_VISUALS) as Array<keyof typeof RPG_STATUS_VISUALS>).find((id) => message.includes(id) || message.includes(statusDisplayLabel(id)));
  return statusId ? statusDisplayLabel(statusId) : "狀態";
}

function floatingText(entry: RpgBattleLogEntry) {
  if (entry.type === "damage") return `-${entry.amount ?? ""}`;
  if (entry.type === "heal") return `+${entry.amount ?? 0}`;
  if (entry.type === "defeat") return "DOWN";
  if (entry.type === "shield") return "SHIELD";
  if (entry.type === "status" && entry.amount) return `-${entry.amount}`;
  return statusText(entry.message);
}

function buildReplayAtActionIndex(state: RpgBattleState, actionIndex: number, nextActionIndex: number | null): RpgBattleReplay | null {
  const actionEntry = state.log[actionIndex];
  const move = actionEntry.moveId ? getRpgMoveById(actionEntry.moveId) : null;
  const actorId = actionEntry.actorId;
  if (!move || !actorId) return null;

  const actorSide = presentationSideForPet(state, actorId);
  if (!actorSide) return null;
  const petMap = new Map(allPets(state).map((pet) => [pet.id, pet]));
  const actor = petMap.get(actorId);
  if (!actor) return null;

  const followupEntries = state.log.slice(actionIndex + 1, nextActionIndex ?? undefined).filter((entry) => entry.turn === actionEntry.turn && FLOATING_TYPES.has(entry.type));
  const rawTargetIds = [
    ...(actionEntry.targetId ? [actionEntry.targetId] : []),
    ...followupEntries.filter((entry) => entry.moveId === move.id).flatMap((entry) => (entry.targetId ? [entry.targetId] : []))
  ];
  const impactTargetIds = [...new Set(inferTargetIds(state, actorId, move, rawTargetIds))];
  const targetPoints = impactTargetIds
    .map((targetId) => petMap.get(targetId))
    .filter((target): target is NonNullable<typeof target> => Boolean(target))
    .map((target) => fieldPointForPet(state, target));
  const floatingByTarget: Record<string, RpgBattleFloatingEntry[]> = {};

  followupEntries.forEach((entry, index) => {
    const targetId = entry.targetId;
    if (!targetId) return;
    floatingByTarget[targetId] ??= [];
    floatingByTarget[targetId].push({
      id: `${actionEntry.turn}-${actionIndex}-${index}-${entry.type}-${targetId}`,
      type: entry.type,
      text: floatingText(entry)
    });
  });

  return {
    key: `${state.id}-${actionEntry.turn}-${actionIndex}-${move.id}-${nextActionIndex ?? state.log.length}`,
    actorId,
    actorSide,
    actorPoint: fieldPointForPet(state, actor),
    move,
    impactTargetIds,
    targetPoints,
    floatingByTarget
  };
}

export function buildBattleReplay(state: RpgBattleState): RpgBattleReplay | null {
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const entry = state.log[index];
    if (entry.type === "action" && entry.actorId && entry.moveId) {
      return buildReplayAtActionIndex(state, index, null);
    }
  }
  return null;
}

export function buildBattleReplaySequence(state: RpgBattleState): RpgBattleReplay[] {
  let latestActionTurn: number | null = null;
  let latestPhaseSide: RpgBattleLogEntry["phaseSide"] = undefined;
  for (let index = state.log.length - 1; index >= 0; index -= 1) {
    const entry = state.log[index];
    if (entry.type === "action" && entry.actorId && entry.moveId) {
      latestActionTurn = entry.turn;
      latestPhaseSide = entry.phaseSide;
      break;
    }
  }
  if (latestActionTurn === null) return [];

  const actionIndexes = state.log
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (
      entry.turn === latestActionTurn &&
      (!latestPhaseSide || entry.phaseSide === latestPhaseSide) &&
      entry.type === "action" &&
      entry.actorId &&
      entry.moveId
    ))
    .map(({ index }) => index);

  return actionIndexes
    .map((actionIndex, sequenceIndex) => buildReplayAtActionIndex(state, actionIndex, actionIndexes[sequenceIndex + 1] ?? null))
    .filter((replay): replay is RpgBattleReplay => Boolean(replay));
}

export function floatingEntriesForPet(replay: RpgBattleReplay | null, petId: string) {
  return replay?.floatingByTarget[petId] ?? [];
}

export function RpgBattleVfx({ replay }: { replay: RpgBattleReplay | null }) {
  if (!replay) return null;
  const { move } = replay;
  const meta = RPG_ELEMENT_META[move.element];
  const productionSpec = getRpgVfxProductionSpec(move);
  const palette = move.animation.palette.length > 0 ? move.animation.palette : [meta.color, meta.accent, "#fff4bf"];
  const projectileTargets = replay.targetPoints.filter((target) => !(move.target === "self" && target.id === replay.actorId));
  const travelTargets = productionSpec.requiresActorToTargetPath ? projectileTargets : [];
  const rendersTravelSprite = travelTargets.length > 0;
  const rendersSkillImpactSprite = !productionSpec.usesBulletProjectile && !rendersTravelSprite;
  const style = {
    "--fx-a": palette[0] ?? meta.color,
    "--fx-b": palette[1] ?? meta.accent,
    "--fx-c": palette[2] ?? "#fff4bf",
    "--caster-x": `${replay.actorPoint.x}%`,
    "--caster-y": `${replay.actorPoint.y - 12}%`,
    "--travel-flip": replay.actorSide === "right" ? -1 : 1
  } as CSSProperties;

  return (
    <div
      key={replay.key}
      data-move-id={move.id}
      data-animation-key={move.animation.key}
      data-vfx-category={productionSpec.category}
      data-vfx-source={productionSpec.primarySource}
      data-vfx-status-source={productionSpec.statusSource ?? ""}
      data-vfx-sources={productionSpec.primarySource}
      data-vfx-phases={productionSpec.phases.join(",")}
      data-uses-bullet-projectile={productionSpec.usesBulletProjectile ? "true" : "false"}
      data-target-count={replay.targetPoints.length}
      data-target-ids={replay.targetPoints.map((target) => target.id).join(",")}
      data-actor-side={replay.actorSide}
      data-caster-x={String(replay.actorPoint.x)}
      data-caster-y={String(replay.actorPoint.y)}
      data-caster-windup="true"
      data-target-sides={replay.targetPoints.map((target) => target.side).join(",")}
      className={[
        "rpg-battle-vfx",
        `category-${productionSpec.category}`,
        `style-${move.animation.style}`,
        `from-${replay.actorSide}`,
        move.target.includes("all") ? "is-group" : "is-single",
        replay.targetPoints.length > 0 ? "has-target-points" : ""
      ].join(" ")}
      style={style}
      aria-hidden="true"
    >
      <div className="rpg-fx-skill-card">
        <span>{meta.shortLabel}</span>
        <strong>{move.name}</strong>
        <em>{move.animation.name}</em>
      </div>
      <div className="rpg-fx-caster-stack" data-actor-id={replay.actorId}>
        <RpgSkillVfxSprite move={move} className="rpg-fx-primary-vfx rpg-fx-caster-windup" />
        <div className="rpg-fx-cast-label">
          <span>{meta.shortLabel}</span>
          <strong>{move.name}</strong>
        </div>
      </div>
      {travelTargets.map((target, index) =>
        productionSpec.usesBulletProjectile ? (
          <RpgSkillProjectileSprite
            key={`projectile-${target.id}`}
            element={move.element}
            className="rpg-fx-primary-vfx rpg-fx-travel-projectile"
            style={{
              "--from-x": `${replay.actorPoint.x}%`,
              "--from-y": `${replay.actorPoint.y - 12}%`,
              "--to-x": `${target.x}%`,
              "--to-y": `${target.y - 12}%`,
              "--travel-delay": `${TRAVEL_RELEASE_DELAY_MS + index * 110}ms`
            } as CSSProperties}
          />
        ) : (
          <RpgSkillVfxSprite
            key={`travel-sheet-${target.id}`}
            move={move}
            className="rpg-fx-primary-vfx rpg-fx-travel-sheet"
            style={{
              "--from-x": `${replay.actorPoint.x}%`,
              "--from-y": `${replay.actorPoint.y - 12}%`,
              "--to-x": `${target.x}%`,
              "--to-y": `${target.y - 12}%`,
              "--travel-delay": `${TRAVEL_RELEASE_DELAY_MS + index * 110}ms`
            } as CSSProperties}
          />
        )
      )}
      {rendersSkillImpactSprite
        ? replay.targetPoints.map((target, index) => (
            <div
              key={`impact-wrap-${target.id}`}
              className="rpg-fx-impact-stack has-skill-impact"
              data-target-id={target.id}
              style={{
                "--impact-x": `${target.x}%`,
                "--impact-y": `${target.y}%`,
                "--impact-delay": `${IMPACT_RELEASE_DELAY_MS + index * 90}ms`
              } as CSSProperties}
            >
              <RpgSkillVfxSprite move={move} className="rpg-fx-primary-vfx rpg-fx-impact-sprite" />
            </div>
          ))
        : null}
      {replay.targetPoints.length === 0 ? <RpgSkillVfxSprite move={move} className="rpg-fx-primary-vfx rpg-fx-sprite" /> : null}
    </div>
  );
}

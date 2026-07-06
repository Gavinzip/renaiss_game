import type { CombatEvent, CombatEventType } from "@renaiss-game/shared";
import type { ArenaText } from "../i18n/arena";

export const EVENT_LABELS: Record<CombatEventType, string> = {
  join: "IN",
  kill: "KO",
  assist: "AST",
  streak: "RUN",
  ultimate: "ULT",
  turret: "ENG",
  heal: "HP",
  control: "CC",
  round: "RD"
};

export function formatCombatEventMessage(event: CombatEvent, t: ArenaText) {
  const actor = event.actorName ?? t.feed.arenaActor;

  switch (event.type) {
    case "join":
      return t.feed.enteredArena(actor, t.ui.arenaEyebrow);
    case "kill":
      return t.feed.defeated(actor, event.targetName ?? t.combat.rivalDown);
    case "assist":
      return t.feed.assisted(actor, event.targetName);
    case "streak":
      return t.feed.killRun(actor, event.streak ?? 0);
    case "ultimate":
      return t.feed.castSkill(actor, getUltimateSkillName(event, t));
    case "turret":
      return t.feed.deployedTurret(actor);
    case "heal":
      return t.feed.recovered(actor);
    case "control":
      return t.feed.stunnedRivals(actor, getControlCount(event));
    case "round":
      return t.feed.roundEvent;
  }
}

export function formatScoreDelta(scoreDelta?: number) {
  if (!scoreDelta) {
    return "";
  }
  return `+${scoreDelta.toFixed(1).replace(/\.0$/, "")}`;
}

function getUltimateSkillName(event: CombatEvent, t: ArenaText) {
  if (event.classId) {
    return t.skills[event.classId].skillR;
  }
  return t.combat.skill;
}

function getControlCount(event: CombatEvent) {
  const count = Number(event.message.match(/stunned (\d+)/)?.[1]);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

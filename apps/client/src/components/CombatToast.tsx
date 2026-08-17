import {
  ARENA_LOADOUT_SLOTS,
  getArenaCatalogSkill,
  type ArenaCatalogLoadout,
  type ArenaLoadout,
  type ClassId,
  type CombatEvent,
  type GameSnapshot,
  type SkillKey
} from "@renaiss-game/shared";
import { useEffect, useRef, useState } from "react";
import { useArenaI18n } from "../i18n/arena";

interface CombatToastProps {
  snapshot: GameSnapshot;
  selfId: string | null;
}

interface ToastState {
  id: string;
  title: string;
  detail: string;
  tone: "skill" | "heal" | "danger" | "victory" | "assist" | "streak" | "round";
  scoreDelta?: number;
}

const SKILL_KEYS: SkillKey[] = ["skillF", "skillQ", "skillE", "skillR"];
export function CombatToast({ snapshot, selfId }: CombatToastProps) {
  const { t } = useArenaI18n();
  const [toast, setToast] = useState<ToastState | null>(null);
  const previousCooldowns = useRef<Record<SkillKey, number> | null>(null);
  const seenEvents = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    const self = snapshot.players.find((player) => player.id === selfId);
    if (!self) {
      previousCooldowns.current = null;
      return;
    }

    if (!initialized.current) {
      snapshot.events.forEach((event) => seenEvents.current.add(event.id));
      previousCooldowns.current = { ...self.cooldowns };
      initialized.current = true;
      return;
    }

    const skillToast = getSkillToast(
      self.classId,
      self.loadout,
      self.catalogLoadout,
      self.cooldowns,
      previousCooldowns.current,
      snapshot.serverTime,
      t
    );
    previousCooldowns.current = { ...self.cooldowns };
    if (skillToast) {
      setToast(skillToast);
      return;
    }

    const eventToast = getEventToast(snapshot.events, self.id, seenEvents.current, snapshot.serverTime, t);
    if (eventToast) {
      setToast(eventToast);
    }
  }, [snapshot, selfId, t]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 1900);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!toast) {
    return null;
  }

  return (
    <section key={toast.id} className={`combat-toast tone-${toast.tone}`} aria-live="polite">
      <span>{toast.detail}</span>
      <strong>{toast.title}</strong>
      {toast.scoreDelta ? <em>{formatScoreDelta(toast.scoreDelta)}</em> : null}
    </section>
  );
}

function getSkillToast(
  classId: ClassId,
  loadout: ArenaLoadout,
  catalogLoadout: ArenaCatalogLoadout,
  cooldowns: Record<SkillKey, number>,
  previousCooldowns: Record<SkillKey, number> | null,
  serverTime: number,
  t: ReturnType<typeof useArenaI18n>["t"]
): ToastState | null {
  if (!previousCooldowns) {
    return null;
  }

  const triggered = SKILL_KEYS.find((skill) => cooldowns[skill] > previousCooldowns[skill] + 250);
  if (!triggered) {
    return null;
  }

  const loadoutSlot = ARENA_LOADOUT_SLOTS.find((slot) => loadout[slot] === triggered);
  const selectedSkill = loadoutSlot ? getArenaCatalogSkill(catalogLoadout[loadoutSlot]) : null;
  if (loadoutSlot && !selectedSkill) {
    return null;
  }
  const title = loadoutSlot && selectedSkill ? selectedSkill.name : t.skills[classId][triggered];

  return {
    id: `skill-${triggered}-${serverTime}`,
    title,
    detail: `${loadoutSlot?.slice(-1) ?? ""} ${t.combat.skill}`.trim(),
    tone: triggered === "skillR" ? "streak" : "skill"
  };
}

function getEventToast(
  events: CombatEvent[],
  selfId: string,
  seenEvents: Set<string>,
  serverTime: number,
  t: ReturnType<typeof useArenaI18n>["t"]
): ToastState | null {
  let toast: ToastState | null = null;
  for (const event of events) {
    if (seenEvents.has(event.id)) {
      continue;
    }
    seenEvents.add(event.id);
    if (event.actorId !== selfId && event.targetId !== selfId && !event.participantIds?.includes(selfId)) {
      continue;
    }
    toast = mapEventToToast(event, selfId, serverTime, t) ?? toast;
  }
  return toast;
}

function mapEventToToast(event: CombatEvent, selfId: string, serverTime: number, t: ReturnType<typeof useArenaI18n>["t"]): ToastState | null {
  if (event.type === "heal") {
    return {
      id: `heal-${event.id}-${serverTime}`,
      title: t.combat.recovered,
      detail: t.combat.fieldRecovery,
      tone: "heal"
    };
  }
  if (event.type === "kill" && event.targetId === selfId) {
    return { id: `down-${event.id}-${serverTime}`, title: t.combat.respawning, detail: t.combat.defeated, tone: "danger" };
  }
  if (event.type === "kill" && event.actorId === selfId) {
    return {
      id: `kill-${event.id}-${serverTime}`,
      title: t.combat.elimination,
      detail: event.targetName ?? t.combat.rivalDown,
      tone: "victory",
      scoreDelta: event.scoreDelta
    };
  }
  if (event.type === "assist" && event.participantIds?.includes(selfId)) {
    return {
      id: `assist-${event.id}-${serverTime}`,
      title: t.combat.assist,
      detail: event.targetName ?? t.combat.sharedElimination,
      tone: "assist",
      scoreDelta: event.scoreDelta
    };
  }
  return null;
}

function formatScoreDelta(scoreDelta: number) {
  return `+${scoreDelta.toFixed(1).replace(/\.0$/, "")}`;
}

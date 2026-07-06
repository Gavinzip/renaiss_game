import type { CombatEvent, GameSnapshot } from "@renaiss-game/shared";
import { useEffect, useRef, useState } from "react";
import { useArenaI18n } from "../i18n/arena";

interface CombatAnnouncerProps {
  snapshot: GameSnapshot;
  selfId: string | null;
}

interface AnnouncementState {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  tone: "victory" | "assist" | "danger" | "streak" | "round";
  scoreDelta?: number;
  priority: number;
}

export function CombatAnnouncer({ snapshot, selfId }: CombatAnnouncerProps) {
  const { t } = useArenaI18n();
  const [announcement, setAnnouncement] = useState<AnnouncementState | null>(null);
  const seenEvents = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    initialized.current = false;
    seenEvents.current.clear();
    setAnnouncement(null);
  }, [selfId]);

  useEffect(() => {
    if (!selfId) {
      return;
    }

    if (!initialized.current) {
      snapshot.events.forEach((event) => seenEvents.current.add(event.id));
      initialized.current = true;
      return;
    }

    let nextAnnouncement: AnnouncementState | null = null;
    for (const event of snapshot.events) {
      if (seenEvents.current.has(event.id)) {
        continue;
      }
      seenEvents.current.add(event.id);
      const candidate = mapEventToAnnouncement(event, selfId, snapshot.serverTime, t);
      if (!candidate) {
        continue;
      }
      if (!nextAnnouncement || candidate.priority >= nextAnnouncement.priority) {
        nextAnnouncement = candidate;
      }
    }

    if (nextAnnouncement) {
      setAnnouncement(nextAnnouncement);
    }
  }, [snapshot, selfId, t]);

  useEffect(() => {
    if (!announcement) {
      return;
    }
    const timeout = window.setTimeout(() => setAnnouncement(null), 2300);
    return () => window.clearTimeout(timeout);
  }, [announcement]);

  if (!announcement) {
    return null;
  }

  return (
    <section key={announcement.id} className={`combat-announcer tone-${announcement.tone}`} aria-live="assertive">
      <span>{announcement.kicker}</span>
      <strong>{announcement.title}</strong>
      <em>{announcement.subtitle}</em>
      {announcement.scoreDelta ? <b>{formatScoreDelta(announcement.scoreDelta)}</b> : null}
    </section>
  );
}

function mapEventToAnnouncement(event: CombatEvent, selfId: string, serverTime: number, t: ReturnType<typeof useArenaI18n>["t"]): AnnouncementState | null {
  if (event.type === "streak" && event.actorId === selfId) {
    return {
      id: `announce-streak-${event.id}-${serverTime}`,
      kicker: t.combat.streakBonus,
      title: t.combat.killRun(event.streak),
      subtitle: t.combat.arenaPressureSecured,
      tone: "streak",
      scoreDelta: event.scoreDelta,
      priority: 5
    };
  }

  if (event.type === "kill" && event.actorId === selfId) {
    return {
      id: `announce-kill-${event.id}-${serverTime}`,
      kicker: t.combat.elimination,
      title: t.combat.rivalDown,
      subtitle: t.combat.defeatedTarget(event.targetName),
      tone: "victory",
      scoreDelta: event.scoreDelta,
      priority: 4
    };
  }

  if (event.type === "assist" && event.participantIds?.includes(selfId)) {
    return {
      id: `announce-assist-${event.id}-${serverTime}`,
      kicker: t.combat.assist,
      title: t.combat.teamCredit,
      subtitle: t.combat.pressureOn(event.targetName),
      tone: "assist",
      scoreDelta: event.scoreDelta,
      priority: 3
    };
  }

  if (event.type === "round") {
    return {
      id: `announce-round-${event.id}-${serverTime}`,
      kicker: t.combat.arena,
      title: t.combat.newRound,
      subtitle: t.combat.scoreRaceRestarted,
      tone: "round",
      priority: 2
    };
  }

  return null;
}

function formatScoreDelta(scoreDelta: number) {
  return `+${scoreDelta.toFixed(1).replace(/\.0$/, "")}`;
}

import type { CombatEvent, GameSnapshot, SkillKey } from "@renaiss-game/shared";
import { useEffect, useRef } from "react";
import { PixelAudioEngine, type CombatAudioCue } from "../audio/PixelAudioEngine";

interface GameAudioProps {
  snapshot: GameSnapshot | null;
  selfId: string | null;
  enabled: boolean;
}

const SKILL_KEYS: SkillKey[] = ["skillQ", "skillE", "skillR"];

export function GameAudio({ snapshot, selfId, enabled }: GameAudioProps) {
  const engine = useRef(new PixelAudioEngine());
  const seenEvents = useRef<Set<string>>(new Set());
  const previousCooldowns = useRef<Record<SkillKey, number> | null>(null);
  const previousSelfId = useRef<string | null>(null);
  const previousRoundPhase = useRef(snapshot?.round.phase ?? null);

  useEffect(() => {
    engine.current.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unlock = () => {
      void engine.current.unlock();
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!snapshot || !selfId) {
      previousCooldowns.current = null;
      previousSelfId.current = null;
      previousRoundPhase.current = snapshot?.round.phase ?? null;
      return;
    }

    const self = snapshot.players.find((player) => player.id === selfId);
    if (!self) {
      previousCooldowns.current = null;
      previousSelfId.current = null;
      return;
    }

    if (previousSelfId.current !== self.id) {
      snapshot.events.forEach((event) => seenEvents.current.add(event.id));
      previousCooldowns.current = { ...self.cooldowns };
      previousSelfId.current = self.id;
      previousRoundPhase.current = snapshot.round.phase;
      if (enabled) {
        engine.current.playCombat("ready");
      }
      return;
    }

    const triggeredSkill = getTriggeredSkill(self.cooldowns, previousCooldowns.current);
    previousCooldowns.current = { ...self.cooldowns };
    if (triggeredSkill && enabled) {
      engine.current.playSkill(self.classId, triggeredSkill);
    }

    const roundPhaseChanged = previousRoundPhase.current && previousRoundPhase.current !== snapshot.round.phase;
    previousRoundPhase.current = snapshot.round.phase;
    if (roundPhaseChanged && enabled) {
      engine.current.playCombat("round");
    }

    for (const event of snapshot.events) {
      if (seenEvents.current.has(event.id)) {
        continue;
      }
      seenEvents.current.add(event.id);
      const cue = mapEventToCue(event, self.id);
      if (cue && enabled) {
        engine.current.playCombat(cue);
      }
    }
  }, [snapshot, selfId, enabled]);

  return null;
}

function getTriggeredSkill(cooldowns: Record<SkillKey, number>, previousCooldowns: Record<SkillKey, number> | null) {
  if (!previousCooldowns) {
    return null;
  }
  return SKILL_KEYS.find((skill) => cooldowns[skill] > previousCooldowns[skill] + 250) ?? null;
}

function mapEventToCue(event: CombatEvent, selfId: string): CombatAudioCue | null {
  if (event.type === "heal" && event.actorId === selfId) {
    return "heal";
  }
  if (event.type === "kill" && event.actorId === selfId) {
    return "kill";
  }
  if (event.type === "kill" && event.targetId === selfId) {
    return "defeated";
  }
  if (event.type === "assist" && event.participantIds?.includes(selfId)) {
    return "assist";
  }
  if (event.type === "streak" && event.actorId === selfId) {
    return "streak";
  }
  if (event.type === "round") {
    return "round";
  }
  return null;
}

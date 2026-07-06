import { CLASS_META, type ClassId, type RoundState } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useArenaI18n } from "../i18n/arena";

interface RoundStartOverlayProps {
  round: RoundState;
  serverTime: number;
  selfId: string | null;
  classId: ClassId;
}

const ROUND_INTRO_MS = 1900;
const JOIN_INTRO_MS = 1500;

export function RoundStartOverlay({ round, serverTime, selfId, classId }: RoundStartOverlayProps) {
  const { t } = useArenaI18n();
  const [joinIntroUntil, setJoinIntroUntil] = useState(0);
  const introKey = useRef<string | null>(null);

  useEffect(() => {
    if (!selfId || round.phase !== "playing") {
      introKey.current = null;
      setJoinIntroUntil(0);
      return;
    }

    const nextIntroKey = `${selfId}:${round.startedAt}`;
    if (introKey.current !== nextIntroKey) {
      introKey.current = nextIntroKey;
      setJoinIntroUntil(serverTime + JOIN_INTRO_MS);
    }
  }, [selfId, round.phase, round.startedAt, serverTime]);

  if (round.phase !== "playing") {
    return null;
  }

  const roundAge = serverTime - round.startedAt;
  const showRoundIntro = roundAge >= 0 && roundAge <= ROUND_INTRO_MS;
  const showJoinIntro = serverTime <= joinIntroUntil;

  if (!showRoundIntro && !showJoinIntro) {
    return null;
  }

  const classMeta = CLASS_META[classId];
  const remainingIntroMs = showRoundIntro ? ROUND_INTRO_MS - roundAge : joinIntroUntil - serverTime;
  const introDurationMs = showRoundIntro ? ROUND_INTRO_MS : JOIN_INTRO_MS;
  const progress = Math.max(0, Math.min(1, remainingIntroMs / introDurationMs));
  const heading = showRoundIntro ? t.round.roundStart : t.round.enteringArena;

  return (
    <section
      className="round-start-overlay"
      aria-live="polite"
      style={{
        "--accent": classMeta.accent,
        "--progress": `${progress * 100}%`
      } as CSSProperties}
    >
      <span>{heading}</span>
      <strong>Eco Arena 6C6K</strong>
      <dl>
        <div>
          <dt>{t.round.class}</dt>
          <dd>{t.classes[classId].label}</dd>
        </div>
        <div>
          <dt>{t.round.goal}</dt>
          <dd>{t.round.firstTo(round.scoreLimit)}</dd>
        </div>
        <div>
          <dt>{t.round.time}</dt>
          <dd>{formatClock(round.durationMs)}</dd>
        </div>
      </dl>
      <i aria-hidden="true" />
    </section>
  );
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

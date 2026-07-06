import type { RoundState } from "@renaiss-game/shared";
import { useArenaI18n } from "../i18n/arena";

interface RoundHudProps {
  round: RoundState;
  serverTime: number;
}

export function RoundHud({ round, serverTime }: RoundHudProps) {
  const { t } = useArenaI18n();
  const remaining = Math.max(0, (round.phase === "finished" ? round.nextRoundAt ?? serverTime : round.endsAt) - serverTime);
  const progress = round.phase === "playing"
    ? Math.max(0, Math.min(1, remaining / round.durationMs))
    : Math.max(0, Math.min(1, remaining / round.restartMs));

  return (
    <section className={`round-hud ${round.phase === "finished" ? "is-finished" : ""}`} aria-label={t.round.round}>
      <header>
        <span>{round.phase === "finished" ? t.round.nextRound : t.round.round}</span>
        <strong>{formatClock(remaining)}</strong>
      </header>
      <div className="round-meter">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <footer>
        <span>{round.winner?.name ?? t.round.scoreLimit}</span>
        <b>{round.scoreLimit}</b>
      </footer>
    </section>
  );
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

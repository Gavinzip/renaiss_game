import type { RoundState } from "@renaiss-game/shared";
import { memo } from "react";
import { useArenaI18n } from "../i18n/arena";

interface RoundHudProps {
  round: RoundState;
  serverTime: number;
}

export const RoundHud = memo(function RoundHud({ round, serverTime }: RoundHudProps) {
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
        {round.mode === "team_3v3" ? (
          <>
            <span className="team-score-red">{t.ui.redTeam} {round.teamScores.red}</span>
            <b>{round.scoreLimit}</b>
            <span className="team-score-blue">{t.ui.blueTeam} {round.teamScores.blue}</span>
          </>
        ) : (
          <>
            <span>{round.winner?.name ?? t.round.scoreLimit}</span>
            <b>{round.scoreLimit}</b>
          </>
        )}
      </footer>
    </section>
  );
}, areRoundHudPropsEqual);

function areRoundHudPropsEqual(previous: RoundHudProps, next: RoundHudProps) {
  const previousRemaining = getRemainingSeconds(previous.round, previous.serverTime);
  const nextRemaining = getRemainingSeconds(next.round, next.serverTime);
  return (
    previousRemaining === nextRemaining &&
    previous.round.phase === next.round.phase &&
    previous.round.mode === next.round.mode &&
    previous.round.scoreLimit === next.round.scoreLimit &&
    previous.round.durationMs === next.round.durationMs &&
    previous.round.restartMs === next.round.restartMs &&
    previous.round.teamScores.red === next.round.teamScores.red &&
    previous.round.teamScores.blue === next.round.teamScores.blue &&
    previous.round.winner?.id === next.round.winner?.id &&
    previous.round.winner?.score === next.round.winner?.score
  );
}

function getRemainingSeconds(round: RoundState, serverTime: number) {
  const endAt = round.phase === "finished" ? round.nextRoundAt ?? serverTime : round.endsAt;
  return Math.max(0, Math.ceil((endAt - serverTime) / 1000));
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

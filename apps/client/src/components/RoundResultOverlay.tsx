import { CLASS_META, type LeaderboardEntry, type RoundState } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { ClassPortrait } from "./ClassPortrait";
import { formatScore } from "../utils/formatScore";
import { useArenaI18n } from "../i18n/arena";

interface RoundResultOverlayProps {
  round: RoundState;
  serverTime: number;
  leaderboard: LeaderboardEntry[];
  selfId: string | null;
}

export function RoundResultOverlay({ round, serverTime, leaderboard, selfId }: RoundResultOverlayProps) {
  const { t } = useArenaI18n();
  if (round.phase !== "finished") {
    return null;
  }

  const remaining = Math.max(0, (round.nextRoundAt ?? serverTime) - serverTime);
  const winner = round.winner;
  const podium = leaderboard.slice(0, 3);

  return (
    <section className="round-result" aria-label={t.round.roundComplete}>
      <header>
        <span>{winner ? t.round.arenaWinner : t.round.roundComplete}</span>
        <strong>{winner?.name ?? t.round.noWinner}</strong>
        <em>{t.round.nextRoundIn(Math.ceil(remaining / 1000))}</em>
      </header>

      {winner ? (
        <div className="round-winner-card" style={{ "--accent": CLASS_META[winner.classId].accent } as CSSProperties}>
          <ClassPortrait classId={winner.classId} frame={winner.classId === "archer" || winner.classId === "engineer" ? 1 : 0} />
          <div>
            <b>{formatScore(winner.score)}</b>
            <small>{t.classes[winner.classId].label}</small>
          </div>
        </div>
      ) : null}

      <ol className="round-podium">
        {podium.map((entry, index) => (
          <li
            key={entry.id}
            className={entry.id === selfId ? "is-self" : ""}
            style={{ "--accent": CLASS_META[entry.classId].accent } as CSSProperties}
          >
            <b>{index + 1}</b>
            <span>{entry.name}</span>
            <small>{t.classes[entry.classId].label}</small>
            <em>{entry.killStreak > 1 ? `${entry.killStreak}x` : ""}</em>
            <strong>{formatScore(entry.score)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

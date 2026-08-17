import { CLASS_META, type ArenaTeamId, type GameSnapshot, type PublicPlayer } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { useArenaI18n } from "../i18n/arena";

interface TeamStatusPanelProps {
  snapshot: GameSnapshot;
  selfId: string | null;
}

const TEAMS: ArenaTeamId[] = ["red", "blue"];

export function TeamStatusPanel({ snapshot, selfId }: TeamStatusPanelProps) {
  const { t } = useArenaI18n();

  return (
    <section className="team-status-panel" aria-label={t.ui.teamStatus}>
      {TEAMS.map((team) => {
        const players = snapshot.players
          .filter((player) => player.team === team)
          .sort((left, right) => Number(right.id === selfId) - Number(left.id === selfId))
          .slice(0, 3);

        return (
          <div key={team} className={`team-status-column team-${team}`}>
            <header>
              <span>{team === "red" ? t.ui.redTeam : t.ui.blueTeam}</span>
              <b>{snapshot.round.teamScores[team]}</b>
            </header>
            <ol>
              {Array.from({ length: 3 }, (_, index) => (
                <TeamMemberRow
                  key={players[index]?.id ?? `${team}-empty-${index}`}
                  player={players[index] ?? null}
                  selfId={selfId}
                  serverTime={snapshot.serverTime}
                />
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

function TeamMemberRow({
  player,
  selfId,
  serverTime
}: {
  player: PublicPlayer | null;
  selfId: string | null;
  serverTime: number;
}) {
  const { t } = useArenaI18n();
  if (!player) {
    return (
      <li className="is-empty" aria-hidden="true">
        <i />
        <span>—</span>
        <small>—</small>
      </li>
    );
  }

  const healthRatio = Math.max(0, Math.min(1, player.health / player.maxHealth));
  const respawnSeconds = Math.max(0, Math.ceil((player.respawnAt - serverTime) / 1000));
  const status = player.alive ? `${Math.ceil(player.health)}` : `${respawnSeconds}s`;

  return (
    <li
      className={[
        player.id === selfId ? "is-self" : "",
        player.alive ? "is-alive" : "is-dead"
      ].filter(Boolean).join(" ")}
      style={{ "--class-accent": CLASS_META[player.classId].accent } as CSSProperties}
      title={player.alive ? `${player.name} · ${t.ui.hp} ${Math.ceil(player.health)}` : `${player.name} · ${t.combat.respawning}`}
    >
      <i />
      <span>{player.name}</span>
      <small>{status}</small>
      <em aria-hidden="true"><b style={{ width: `${healthRatio * 100}%` }} /></em>
    </li>
  );
}

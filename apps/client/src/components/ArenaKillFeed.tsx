import type { GameSnapshot } from "@renaiss-game/shared";
import { memo } from "react";
import { useArenaI18n } from "../i18n/arena";

interface ArenaKillFeedProps {
  snapshot: GameSnapshot;
  selfId: string | null;
}

const FEED_LIFETIME_MS = 5_200;
const MAX_VISIBLE_KILLS = 3;

export const ArenaKillFeed = memo(function ArenaKillFeed({ snapshot, selfId }: ArenaKillFeedProps) {
  const { t } = useArenaI18n();
  const visibleKills = snapshot.events
    .filter((event) => event.type === "kill" && snapshot.serverTime - event.at <= FEED_LIFETIME_MS)
    .slice(-MAX_VISIBLE_KILLS)
    .reverse();

  if (!visibleKills.length) {
    return null;
  }

  return (
    <ol className="arena-kill-feed" aria-label={t.drawer.battleFeed} aria-live="polite">
      {visibleKills.map((event, index) => {
        const actor = event.actorId ? snapshot.players.find((player) => player.id === event.actorId) : null;
        const target = event.targetId ? snapshot.players.find((player) => player.id === event.targetId) : null;
        const actorName = event.actorName ?? t.feed.arenaActor;
        const targetName = event.targetName ?? t.combat.rivalDown;
        return (
          <li
            key={event.id}
            className={[
              index === 0 ? "is-latest" : "",
              actor?.team ? `actor-${actor.team}` : "",
              target?.team ? `target-${target.team}` : "",
              event.actorId === selfId || event.targetId === selfId ? "involves-self" : ""
            ].filter(Boolean).join(" ")}
            aria-label={`${actorName} ${t.combat.elimination} ${targetName}`}
          >
            <span className="arena-kill-feed__killer">{actorName}</span>
            <b className="arena-kill-feed__mark" aria-hidden="true">KO</b>
            <em className="arena-kill-feed__victim">{targetName}</em>
          </li>
        );
      })}
    </ol>
  );
}, areArenaKillFeedPropsEqual);

function areArenaKillFeedPropsEqual(previous: ArenaKillFeedProps, next: ArenaKillFeedProps) {
  if (
    previous.selfId !== next.selfId ||
    Math.floor(previous.snapshot.serverTime / 1000) !== Math.floor(next.snapshot.serverTime / 1000)
  ) {
    return false;
  }
  const previousKills = previous.snapshot.events.filter((event) => event.type === "kill");
  const nextKills = next.snapshot.events.filter((event) => event.type === "kill");
  if (previousKills.length !== nextKills.length) return false;
  return previousKills.every((event, index) => event.id === nextKills[index]?.id);
}

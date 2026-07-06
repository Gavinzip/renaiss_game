import type { CombatEvent } from "@renaiss-game/shared";
import { useArenaI18n } from "../i18n/arena";
import { EVENT_LABELS, formatCombatEventMessage, formatScoreDelta } from "./combatEventText";

interface EventFeedProps {
  events: CombatEvent[];
  serverTime: number;
}

export function EventFeed({ events, serverTime }: EventFeedProps) {
  const { t } = useArenaI18n();
  const visibleEvents = events.slice(-5).reverse();

  return (
    <section className="event-feed" aria-label={t.feed.battleFeed}>
      <header>{t.feed.battleFeed}</header>
      <ol>
        {visibleEvents.length ? (
          visibleEvents.map((event) => (
            <li key={event.id} className={`event-${event.type}`}>
              <i>{EVENT_LABELS[event.type]}</i>
              <span>{formatCombatEventMessage(event, t)}</span>
              <em>{formatScoreDelta(event.scoreDelta)}</em>
              <time>{t.feed.secondsAgo(Math.max(0, Math.ceil((serverTime - event.at) / 1000)))}</time>
            </li>
          ))
        ) : (
          <li className="event-empty">
            <i>SYS</i>
            <span>{t.feed.arenaSignalStable}</span>
            <em />
            <time>{t.feed.secondsAgo(0)}</time>
          </li>
        )}
      </ol>
    </section>
  );
}

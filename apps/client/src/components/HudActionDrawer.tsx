import { CLASS_META, WORLD, type CombatEvent, type GameSnapshot } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { getHealthPackVariant } from "../game/assets/healthPackVariants";
import { formatScore } from "../utils/formatScore";
import { ARENA_LANGUAGES, useArenaI18n } from "../i18n/arena";
import { EVENT_LABELS, formatCombatEventMessage, formatScoreDelta } from "./combatEventText";

export type HudActionMode = "map" | "messages" | "settings";

export interface HudDisplayPrefs {
  minimap: boolean;
  combatPopups: boolean;
  audio: boolean;
}

interface HudActionDrawerProps {
  mode: HudActionMode;
  snapshot: GameSnapshot | null;
  selfId: string | null;
  serverTime: number;
  displayPrefs: HudDisplayPrefs;
  onToggleDisplayPref: (key: keyof HudDisplayPrefs) => void;
}

export function HudActionDrawer({
  mode,
  snapshot,
  selfId,
  serverTime,
  displayPrefs,
  onToggleDisplayPref
}: HudActionDrawerProps) {
  if (mode === "map") {
    return <MapDrawer snapshot={snapshot} selfId={selfId} />;
  }

  if (mode === "messages") {
    return <MessagesDrawer events={snapshot?.events ?? []} serverTime={serverTime} />;
  }

  return <SettingsDrawer displayPrefs={displayPrefs} onToggleDisplayPref={onToggleDisplayPref} />;
}

function MapDrawer({ snapshot, selfId }: { snapshot: GameSnapshot | null; selfId: string | null }) {
  const { t } = useArenaI18n();
  const self = snapshot?.players.find((player) => player.id === selfId);
  const aliveCount = snapshot?.players.filter((player) => player.alive).length ?? 0;

  return (
    <section className="hud-drawer" aria-label={t.drawer.tacticalMap}>
      <header>
        <span>{t.drawer.tacticalMap}</span>
        <strong>{snapshot ? t.drawer.live(aliveCount) : t.drawer.idle}</strong>
      </header>
      <div className="drawer-map-board">
        {snapshot ? (
          <>
            <span className="minimap-center" style={pointStyle(WORLD.width / 2, WORLD.height / 2)} />
            {snapshot.healthPacks.map((pack) => {
              const variant = getHealthPackVariant(pack.imageIndex);
              return (
                <span
                  key={pack.id}
                  className="minimap-pack"
                  title={t.combat.fieldRecovery}
                  style={{ ...pointStyle(pack.x, pack.y), "--pack-color": variant.minimap } as CSSProperties}
                />
              );
            })}
            {snapshot.turrets.map((turret) => {
              const owned = turret.ownerId === selfId;
              const classes = ["minimap-turret", owned ? "self" : "rival", turret.boosted ? "is-boosted" : ""]
                .filter(Boolean)
                .join(" ");

              return <span key={turret.id} className={classes} style={pointStyle(turret.x, turret.y)} />;
            })}
            {snapshot.players.map((player) => {
              const isSelf = player.id === selfId;
              const classes = ["minimap-dot", isSelf ? "self" : player.bot ? "bot" : "rival", player.alive ? "" : "is-dead"]
                .filter(Boolean)
                .join(" ");

              return (
                <span
                  key={player.id}
                  className={classes}
                  style={{
                    ...pointStyle(player.x, player.y),
                    "--class-color": CLASS_META[player.classId].accent
                  } as CSSProperties}
                />
              );
            })}
          </>
        ) : (
          <span className="drawer-empty">{t.drawer.enterArenaToSync}</span>
        )}
      </div>
      <footer className="drawer-map-stats">
        <span>{self?.name ?? "GUEST_2AC1"}</span>
        <b>{formatScore(self?.score ?? 0)}</b>
        <em>{t.drawer.fieldPickups(snapshot?.healthPacks.length ?? 0)}</em>
      </footer>
    </section>
  );
}

function MessagesDrawer({ events, serverTime }: { events: CombatEvent[]; serverTime: number }) {
  const { t } = useArenaI18n();
  const visibleEvents = events.slice(-8).reverse();

  return (
    <section className="hud-drawer" aria-label={t.drawer.messages}>
      <header>
        <span>{t.drawer.messages}</span>
        <strong>{visibleEvents.length}</strong>
      </header>
      <ol className="drawer-events">
        {visibleEvents.length ? (
          visibleEvents.map((event) => (
            <li key={event.id} className={`event-${event.type}`}>
              <i>{EVENT_LABELS[event.type]}</i>
              <span>{formatCombatEventMessage(event, t)}</span>
              <b>{formatScoreDelta(event.scoreDelta)}</b>
              <time>{t.feed.secondsAgo(Math.max(0, Math.ceil((serverTime - event.at) / 1000)))}</time>
            </li>
          ))
        ) : (
          <li className="drawer-empty-row">
            <i>SYS</i>
            <span>{t.drawer.arenaSignalStable}</span>
            <b />
            <time>{t.feed.secondsAgo(0)}</time>
          </li>
        )}
      </ol>
    </section>
  );
}

function SettingsDrawer({
  displayPrefs,
  onToggleDisplayPref
}: {
  displayPrefs: HudDisplayPrefs;
  onToggleDisplayPref: (key: keyof HudDisplayPrefs) => void;
}) {
  const { language, setLanguage, t } = useArenaI18n();

  return (
    <section className="hud-drawer" aria-label={t.drawer.settings}>
      <header>
        <span>{t.drawer.settings}</span>
        <strong>SYS</strong>
      </header>
      <div className="drawer-toggle-list">
        <DrawerToggle label={t.drawer.minimap} active={displayPrefs.minimap} onClick={() => onToggleDisplayPref("minimap")} />
        <DrawerToggle label={t.drawer.combatPopups} active={displayPrefs.combatPopups} onClick={() => onToggleDisplayPref("combatPopups")} />
        <DrawerToggle label={t.drawer.audio} active={displayPrefs.audio} onClick={() => onToggleDisplayPref("audio")} />
        <div className="drawer-language-row">
          <span>{t.ui.language}</span>
          <div>
            {ARENA_LANGUAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={language === option.id ? "is-active" : ""}
                aria-pressed={language === option.id}
                onClick={() => setLanguage(option.id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DrawerToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { t } = useArenaI18n();
  return (
    <button type="button" className={active ? "drawer-toggle is-on" : "drawer-toggle"} onClick={onClick} aria-pressed={active}>
      <span>{label}</span>
      <i>{active ? t.drawer.on : t.drawer.off}</i>
    </button>
  );
}

function pointStyle(x: number, y: number): CSSProperties {
  return {
    "--x": `${(x / WORLD.width) * 100}%`,
    "--y": `${(y / WORLD.height) * 100}%`
  } as CSSProperties;
}

import { CLASS_META, WORLD, type CombatEvent, type GameSnapshot } from "@renaiss-game/shared";
import { SignOut } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import {
  GAME_UI_SOUND_PACKS,
  playGameUiSound,
  type GameUiSoundPack
} from "../audio/gameUiSounds";
import { getHealthPackVariant } from "../game/assets/healthPackVariants";
import { formatScore } from "../utils/formatScore";
import { ARENA_LANGUAGES, useArenaI18n } from "../i18n/arena";
import type { HudDisplayPrefs, HudScale, HudTogglePreference } from "../state/hudPreferences";
import { EVENT_LABELS, formatCombatEventMessage, formatScoreDelta } from "./combatEventText";

export type HudActionMode = "map" | "messages" | "settings";

interface HudActionDrawerProps {
  mode: HudActionMode;
  snapshot: GameSnapshot | null;
  selfId: string | null;
  serverTime: number;
  displayPrefs: HudDisplayPrefs;
  onToggleDisplayPref: (key: HudTogglePreference) => void;
  onSetHudScale: (scale: HudScale) => void;
  onSetAudioVolume: (volume: number) => void;
  onSetAudioPack: (pack: GameUiSoundPack) => void;
  onExitArena: () => void;
}

export function HudActionDrawer({
  mode,
  snapshot,
  selfId,
  serverTime,
  displayPrefs,
  onToggleDisplayPref,
  onSetHudScale,
  onSetAudioVolume,
  onSetAudioPack,
  onExitArena
}: HudActionDrawerProps) {
  if (mode === "map") {
    return <MapDrawer snapshot={snapshot} selfId={selfId} />;
  }

  if (mode === "messages") {
    return <MessagesDrawer events={snapshot?.events ?? []} serverTime={serverTime} />;
  }

  return (
    <SettingsDrawer
      displayPrefs={displayPrefs}
      onToggleDisplayPref={onToggleDisplayPref}
      onSetHudScale={onSetHudScale}
      onSetAudioVolume={onSetAudioVolume}
      onSetAudioPack={onSetAudioPack}
      onExitArena={onExitArena}
    />
  );
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
            {snapshot.attackBoostPacks.map((pack) => (
              <span
                key={pack.id}
                className="minimap-attack-pack"
                title={t.combat.attackBoostPickup}
                style={pointStyle(pack.x, pack.y)}
              />
            ))}
            {snapshot.turrets.map((turret) => {
              const owned = turret.ownerId === selfId;
              const classes = ["minimap-turret", owned ? "self" : "rival", turret.shield > 0 ? "is-boosted" : ""]
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
        <em>{t.drawer.fieldPickups((snapshot?.healthPacks.length ?? 0) + (snapshot?.attackBoostPacks.length ?? 0))}</em>
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
  onToggleDisplayPref,
  onSetHudScale,
  onSetAudioVolume,
  onSetAudioPack,
  onExitArena
}: {
  displayPrefs: HudDisplayPrefs;
  onToggleDisplayPref: (key: HudTogglePreference) => void;
  onSetHudScale: (scale: HudScale) => void;
  onSetAudioVolume: (volume: number) => void;
  onSetAudioPack: (pack: GameUiSoundPack) => void;
  onExitArena: () => void;
}) {
  const { language, setLanguage, t } = useArenaI18n();
  const audioCopy = language === "zh"
    ? { volume: "音效音量", style: "音效風格", arcade: "像素", mechanical: "機械", cinematic: "電影" }
    : language === "ko"
      ? { volume: "효과음 음량", style: "효과음 스타일", arcade: "픽셀", mechanical: "기계", cinematic: "시네마" }
      : { volume: "SFX volume", style: "SFX style", arcade: "Pixel", mechanical: "Mechanical", cinematic: "Cinematic" };

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
        <div className="drawer-audio-settings" aria-label={audioCopy.style}>
          <label>
            <span>{audioCopy.volume}<output>{Math.round(displayPrefs.audioVolume * 100)}%</output></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={displayPrefs.audioVolume}
              disabled={!displayPrefs.audio}
              onChange={(event) => onSetAudioVolume(Number(event.target.value))}
              onPointerUp={() => playGameUiSound("select", { cooldownMs: 140 })}
              onKeyDown={(event) => {
                const direction = event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? -1
                  : event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? 1
                    : 0;
                if (direction !== 0) {
                  event.preventDefault();
                  event.stopPropagation();
                  onSetAudioVolume(Math.round(Math.max(0, Math.min(1, displayPrefs.audioVolume + direction * 0.01)) * 100) / 100);
                }
              }}
              onKeyUp={(event) => {
                if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                  playGameUiSound("select", { cooldownMs: 140 });
                }
              }}
            />
          </label>
          <div>
            <span>{audioCopy.style}</span>
            <div>
              {GAME_UI_SOUND_PACKS.map((pack) => (
                <button
                  key={pack}
                  type="button"
                  className={displayPrefs.audioPack === pack ? "is-active" : ""}
                  aria-pressed={displayPrefs.audioPack === pack}
                  disabled={!displayPrefs.audio}
                  onClick={() => onSetAudioPack(pack)}
                >
                  {audioCopy[pack]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DrawerToggle label={t.ui.highContrast} active={displayPrefs.highContrast} onClick={() => onToggleDisplayPref("highContrast")} />
        <DrawerToggle label={t.ui.reducedMotion} active={displayPrefs.reducedMotion} onClick={() => onToggleDisplayPref("reducedMotion")} />
        <div className="drawer-scale-row">
          <span>{t.ui.hudScale}</span>
          <div>
            {(["compact", "standard", "large"] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                className={displayPrefs.uiScale === scale ? "is-active" : ""}
                aria-pressed={displayPrefs.uiScale === scale}
                onClick={() => onSetHudScale(scale)}
              >
                {scale === "compact"
                  ? t.ui.hudScaleCompact
                  : scale === "large"
                    ? t.ui.hudScaleLarge
                    : t.ui.hudScaleStandard}
              </button>
            ))}
          </div>
        </div>
        <div className="drawer-language-row">
          <span>{t.ui.language}</span>
          <div>
            {ARENA_LANGUAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={language === option.id ? "is-active" : ""}
                aria-pressed={language === option.id}
                onClick={() => {
                  if (language === option.id) return;
                  setLanguage(option.id);
                  playGameUiSound("select");
                }}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="drawer-exit-button" onClick={onExitArena}>
          <SignOut size={19} weight="bold" />
          <span>{t.drawer.exitArena}</span>
          <i>{t.drawer.exitToVillage}</i>
        </button>
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

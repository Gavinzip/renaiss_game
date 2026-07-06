import { GearSix, MapTrifold, PencilSimple, Question, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import { CLASS_META, CLASS_ORDER, CLASS_STATS, type ActionTooltip, type ClassId, type JoinRequest, type SkillKey } from "@renaiss-game/shared";
import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useState } from "react";
import { ClassPortrait } from "./components/ClassPortrait";
import { CombatAnnouncer } from "./components/CombatAnnouncer";
import { CombatToast } from "./components/CombatToast";
import { DeathOverlay } from "./components/DeathOverlay";
import { GameAudio } from "./components/GameAudio";
import { HudActionDrawer, type HudActionMode, type HudDisplayPrefs } from "./components/HudActionDrawer";
import { MapEditor } from "./components/MapEditor";
import { Minimap } from "./components/Minimap";
import { RoundHud } from "./components/RoundHud";
import { RoundRewards } from "./components/RoundRewards";
import { RoundResultOverlay } from "./components/RoundResultOverlay";
import { RoundStartOverlay } from "./components/RoundStartOverlay";
import { SelfStatusOverlay } from "./components/SelfStatusOverlay";
import { RpgAnimationPreview } from "./components/RpgAnimationPreview";
import { RpgReleaseReview } from "./components/RpgReleaseReview";
import { RpgSkillAnimationPreview } from "./components/RpgSkillAnimationPreview";
import { RpgStatusAnimationPreview } from "./components/RpgStatusAnimationPreview";
import { XLoginGate } from "./components/XLoginGate";
import type { XAuthUser } from "./api/auth";
import { getSkillIconPosition, type SkillIconSlot } from "./game/assets/crops";
import { generatedAssetPath } from "./game/assets/generatedAssets";
import { createGame } from "./game/createGame";
import { createRpgGame } from "./game/createRpgGame";
import { isMapPreviewMode, loadStoredMapDraftProps } from "./game/mapDraft";
import { useHudStore, type HudAction } from "./state/hudStore";
import { useRpgStore } from "./state/rpgStore";
import { RpgOverlay } from "./components/RpgOverlay";
import { ArenaTutorialModal, useFirstRunTutorial } from "./components/RpgTutorial";
import { formatScore } from "./utils/formatScore";
import { ArenaI18nProvider, ARENA_LANGUAGES, useArenaI18n } from "./i18n/arena";

const SKILL_ICON_SHEET = `url("${generatedAssetPath("skill-icons")}")`;

export function App() {
  return (
    <ArenaI18nProvider>
      <XLoginGate>{(session) => <GameApp authUser={session.user} />}</XLoginGate>
    </ArenaI18nProvider>
  );
}

function GameApp({ authUser }: { authUser: XAuthUser }) {
  const params = new URLSearchParams(window.location.search);
  const editorMode = params.get("editor") === "1";
  const arenaMode = params.get("arena") === "1";
  const mapPreviewMode = isMapPreviewMode();
  const mapPreviewDraftCount = mapPreviewMode ? loadStoredMapDraftProps()?.length ?? 0 : 0;

  useEffect(() => {
    if (editorMode || !arenaMode) {
      return undefined;
    }
    const game = createGame("game-root");
    return () => {
      game.destroy(true);
    };
  }, [arenaMode, editorMode]);

  if (editorMode) {
    return <MapEditor />;
  }

  if (!arenaMode) {
    return <RpgApp authUser={authUser} />;
  }

  return (
    <main className="app-shell">
      <div id="game-root" className="game-root" />
      {mapPreviewMode ? (
        <div className="map-preview-banner">
          Map draft gameplay preview
          <span>{mapPreviewDraftCount ? `${mapPreviewDraftCount} props` : "no saved draft"}</span>
        </div>
      ) : null}
      <HudOverlay />
      <StartPanel authUser={authUser} />
    </main>
  );
}

function RpgApp({ authUser }: { authUser: XAuthUser }) {
  const previewMode = new URLSearchParams(window.location.search).get("preview");
  const rpgArenaStyle = { "--rpg-arena-url": `url("${generatedAssetPath("rpg-battle-arena")}")` } as CSSProperties;

  useEffect(() => {
    useRpgStore.getState().setPlayerName(xPlayerName(authUser));
  }, [authUser.id, authUser.username]);

  useEffect(() => {
    if (previewMode === "pets" || previewMode === "skills" || previewMode === "status" || previewMode === "release") {
      return undefined;
    }
    const game = createRpgGame("game-root");
    return () => {
      game.destroy(true);
      if (window.__renaissRpgGame === game) {
        delete window.__renaissRpgGame;
      }
    };
  }, [previewMode]);

  if (previewMode === "pets") {
    return <RpgAnimationPreview />;
  }

  if (previewMode === "skills") {
    return <RpgSkillAnimationPreview />;
  }

  if (previewMode === "status") {
    return <RpgStatusAnimationPreview />;
  }

  if (previewMode === "release") {
    return <RpgReleaseReview />;
  }

  return (
    <main className="app-shell rpg-app-shell" style={rpgArenaStyle}>
      <div id="game-root" className="game-root" />
      <RpgOverlay />
    </main>
  );
}

function StartPanel({ authUser }: { authUser: XAuthUser }) {
  const { language, setLanguage, t } = useArenaI18n();
  const joined = useHudStore((state) => state.joined);
  const connection = useHudStore((state) => state.connection);
  const selectedClass = useHudStore((state) => state.selectedClass);
  const setSelectedClass = useHudStore((state) => state.setSelectedClass);
  const requestJoin = useHudStore((state) => state.requestJoin);
  const [name, setName] = useState(xPlayerName(authUser));
  const arenaTutorial = useFirstRunTutorial("arena");
  const classId = selectedClass;
  const meta = CLASS_META[classId];
  const classCopy = t.classes[classId];
  const stats = CLASS_STATS[classId];
  const skills = t.skills[classId];
  const skillKeys: SkillKey[] = ["skillQ", "skillE", "skillR"];
  const enterArena = () => {
    if (!arenaTutorial.seen) {
      arenaTutorial.openTutorial();
      return;
    }
    const latestClassId = useHudStore.getState().selectedClass;
    const request: JoinRequest = { name, classId: latestClassId };
    const draftProps = isMapPreviewMode() ? loadStoredMapDraftProps() : null;
    if (draftProps) {
      request.mapDraft = { props: draftProps };
    }
    if (isNoBotsReviewMode()) {
      request.review = { noBots: true, fixedSpawn: isFixedSpawnReviewMode() };
      const reviewSpawnPoint = getReviewSpawnPoint();
      if (reviewSpawnPoint) {
        request.review.spawnPoint = reviewSpawnPoint;
      }
    }
    requestJoin(request);
  };

  if (joined) {
    return null;
  }

  return (
    <section className="start-panel" aria-label={t.ui.enterArena}>
      <div className="start-copy">
        <div className="start-brand-row">
          <img className="start-brand-logo" src="/assets/generated/vinci-favicon.png" alt="" />
          <div>
            <span>{t.ui.arenaEyebrow}</span>
            <h1>{t.ui.title}</h1>
          </div>
        </div>
        <div className="language-switcher" aria-label={t.ui.language}>
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
        <div className="arena-tags" aria-label={t.ui.arenaRules}>
          <span>{t.ui.ruleTime}</span>
          <span>{t.ui.ruleScore}</span>
          <span>{t.ui.ruleRivals}</span>
        </div>
        <label>
          <span>{t.ui.playerName}</span>
          <input value={name} maxLength={14} onChange={(event) => setName(event.target.value)} />
        </label>
        <button className="enter-button" type="button" onClick={enterArena}>
          {connection === "connecting" ? t.ui.connecting : t.ui.enterArena}
        </button>
        <button className="arena-tutorial-button" type="button" onClick={arenaTutorial.openTutorial}>
          <Question size={17} weight="bold" />
          <span>教學</span>
        </button>
        {connection === "error" ? <p className="connection-error">{t.ui.connectionError}</p> : null}
      </div>

      <div className="class-stage" style={{ "--accent": meta.accent } as CSSProperties}>
        <ClassPortrait classId={classId} frame={classId === "archer" || classId === "engineer" ? 1 : 0} />
        <div className="class-stage-name">
          <strong>{classCopy.label}</strong>
          <span>{classCopy.role}</span>
        </div>
        <div className="class-skill-icons" aria-label={`${classCopy.label} ${t.ui.skills}`}>
          {skillKeys.map((skill) => (
            <SkillGlyph key={skill} classId={classId} slot={skill} label={skill.slice(-1)} title={skills[skill]} />
          ))}
        </div>
      </div>

      <div className="class-command" style={{ "--accent": meta.accent } as CSSProperties}>
        <header>
          <span>{t.ui.loadout}</span>
          <strong>{classCopy.label}</strong>
          <em>{classCopy.role}</em>
        </header>
        <div className="stat-stack">
          <StatBar label={t.ui.hp} value={stats.maxHealth} max={150} />
          <StatBar label={t.ui.atk} value={stats.attackPower} max={30} />
          <StatBar label={t.ui.spd} value={stats.moveSpeed} max={210} />
        </div>
        <div className="class-grid" role="list" aria-label={t.ui.classSelection}>
          {CLASS_ORDER.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === classId ? "class-card is-selected" : "class-card"}
              onClick={() => setSelectedClass(candidate)}
              style={{ "--accent": CLASS_META[candidate].accent } as CSSProperties}
            >
              <ClassPortrait classId={candidate} />
              <span>
                <strong>{t.classes[candidate].label}</strong>
                <em>{t.classes[candidate].role}</em>
              </span>
            </button>
          ))}
        </div>
      </div>
      <ArenaTutorialModal open={arenaTutorial.open} onClose={arenaTutorial.closeTutorial} />
    </section>
  );
}

function xPlayerName(user: XAuthUser) {
  return (user.username || "GUEST_2AC1").slice(0, 18).toUpperCase();
}

function isNoBotsReviewMode() {
  return new URLSearchParams(window.location.search).get("reviewBots") === "0";
}

function isFixedSpawnReviewMode() {
  return new URLSearchParams(window.location.search).get("reviewSpawn") === "fixed";
}

function getReviewSpawnPoint() {
  const params = new URLSearchParams(window.location.search);
  const x = Number(params.get("reviewSpawnX"));
  const y = Number(params.get("reviewSpawnY"));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function SkillGlyph({
  classId,
  slot,
  label,
  title
}: {
  classId: ClassId;
  slot: SkillIconSlot;
  label: string;
  title: string;
}) {
  return (
    <span
      className="skill-glyph"
      title={title}
      style={getSkillIconStyle(classId, slot)}
    >
      <i />
      <b>{label}</b>
    </span>
  );
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <i><b style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></i>
      <em>{value}</em>
    </div>
  );
}

function HudOverlay() {
  const { t } = useArenaI18n();
  const snapshot = useHudStore((state) => state.snapshot);
  const selfId = useHudStore((state) => state.selfId);
  const connection = useHudStore((state) => state.connection);
  const joined = useHudStore((state) => state.joined);
  const selectedClass = useHudStore((state) => state.selectedClass);
  const self = snapshot?.players.find((player) => player.id === selfId) ?? null;
  const displayClass = self?.classId ?? selectedClass;
  const skillLabels = self ? t.skills[self.classId] : null;
  const actionTooltips = t.tooltips[displayClass];
  const actionsDisabled = !self?.alive || snapshot?.round.phase === "finished";
  const leaderboard = snapshot?.leaderboard ?? [];
  const compactLeaderboard = leaderboard.slice(0, 5);
  const [activeDrawer, setActiveDrawer] = useState<HudActionMode | null>(null);
  const [displayPrefs, setDisplayPrefs] = useState<HudDisplayPrefs>({
    minimap: true,
    combatPopups: true,
    audio: true
  });
  const [arenaTutorialOpen, setArenaTutorialOpen] = useState(false);
  const toggleDrawer = (drawer: HudActionMode) => {
    setActiveDrawer((current) => (current === drawer ? null : drawer));
  };
  const toggleDisplayPref = (key: keyof HudDisplayPrefs) => {
    setDisplayPrefs((current) => ({ ...current, [key]: !current[key] }));
  };
  const devToolsMode = new URLSearchParams(window.location.search).get("dev") === "1";

  if (!joined) {
    return (
      <div className="hud-layer hud-layer-start" aria-label={t.ui.gameHud}>
        <GameAudio snapshot={snapshot} selfId={selfId} enabled={displayPrefs.audio} />
      </div>
    );
  }

  return (
    <div className="hud-layer" aria-label={t.ui.gameHud}>
      <GameAudio snapshot={snapshot} selfId={selfId} enabled={displayPrefs.audio} />
      <nav className="top-actions" aria-label={t.ui.gameActions}>
        {devToolsMode ? (
          <a href="/?editor=1&dev=1" title={t.ui.sceneEditor} aria-label={t.ui.sceneEditor}>
            <PencilSimple size={25} weight="fill" />
          </a>
        ) : null}
        <button type="button" className={activeDrawer === "map" ? "is-active" : ""} title={t.ui.map} aria-pressed={activeDrawer === "map"} onClick={() => toggleDrawer("map")}>
          <MapTrifold size={26} weight="fill" />
        </button>
        <button type="button" title="競技場教學" aria-label="競技場教學" onClick={() => setArenaTutorialOpen(true)}>
          <Question size={26} weight="fill" />
        </button>
        <button type="button" className={activeDrawer === "messages" ? "is-active" : ""} title={t.ui.messages} aria-pressed={activeDrawer === "messages"} onClick={() => toggleDrawer("messages")}>
          <EnvelopeSimple size={26} weight="fill" />
        </button>
        <button type="button" className={activeDrawer === "settings" ? "is-active" : ""} title={t.ui.settings} aria-pressed={activeDrawer === "settings"} onClick={() => toggleDrawer("settings")}>
          <GearSix size={28} weight="fill" />
        </button>
      </nav>
      {activeDrawer ? (
        <HudActionDrawer
          mode={activeDrawer}
          snapshot={snapshot}
          selfId={selfId}
          serverTime={snapshot?.serverTime ?? Date.now()}
          displayPrefs={displayPrefs}
          onToggleDisplayPref={toggleDisplayPref}
        />
      ) : null}

      {!activeDrawer ? (
        <section className="status-chip">
          <span className={connection === "connected" ? "status-dot connected" : "status-dot"} />
          {connection === "connected" ? t.ui.liveArena : connection}
        </section>
      ) : null}

      {joined && snapshot ? <RoundHud round={snapshot.round} serverTime={snapshot.serverTime} /> : null}
      {joined && snapshot && self?.alive ? (
        <RoundStartOverlay round={snapshot.round} serverTime={snapshot.serverTime} selfId={selfId} classId={displayClass} />
      ) : null}
      {joined && snapshot && displayPrefs.combatPopups ? <CombatAnnouncer snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot && displayPrefs.combatPopups ? <CombatToast snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot ? <RoundRewards round={snapshot.round} /> : null}
      {joined && snapshot && displayPrefs.minimap && activeDrawer !== "map" ? <Minimap snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot ? <SelfStatusOverlay player={self} /> : null}
      {joined && snapshot ? <RoundResultOverlay round={snapshot.round} serverTime={snapshot.serverTime} leaderboard={snapshot.leaderboard} selfId={selfId} /> : null}
      {joined && snapshot?.round.phase !== "finished" ? <DeathOverlay player={self} serverTime={snapshot?.serverTime ?? Date.now()} /> : null}

      {joined ? <section className="leaderboard">
        <header>
          <UsersThree size={18} weight="fill" />
          <span>{t.ui.leaderboard}</span>
          <b>{t.ui.topFive}</b>
        </header>
        <ol>
          {compactLeaderboard.map((entry, index) => (
            <li key={entry.id}>
              <b>{index + 1}</b>
              <span>{entry.name}</span>
              <small>{entry.killStreak > 1 ? `${entry.killStreak}x` : ""}</small>
              <em>{formatScore(entry.score)}</em>
            </li>
          ))}
        </ol>
      </section> : null}

      {joined ? <section className="skill-bar" aria-label={t.ui.skills}>
        <SkillButton classId={displayClass} slot="skillQ" action="skillQ" keyLabel="Q" title={skillLabels?.skillQ ?? "Q"} tooltip={actionTooltips.skillQ} endAt={self?.cooldowns.skillQ ?? 0} disabled={actionsDisabled} />
        <SkillButton classId={displayClass} slot="skillE" action="skillE" keyLabel="E" title={skillLabels?.skillE ?? "E"} tooltip={actionTooltips.skillE} endAt={self?.cooldowns.skillE ?? 0} disabled={actionsDisabled} />
        <SkillButton classId={displayClass} slot="skillR" action="skillR" keyLabel="R" title={skillLabels?.skillR ?? "R"} tooltip={actionTooltips.skillR} endAt={self?.cooldowns.skillR ?? 0} disabled={actionsDisabled} />
        <SkillButton classId={displayClass} slot="attack" action="attack" keyLabel="M1" title={t.ui.attack} tooltip={actionTooltips.attack} endAt={0} disabled={actionsDisabled} />
      </section> : null}
      <ArenaTutorialModal open={arenaTutorialOpen} onClose={() => setArenaTutorialOpen(false)} />
    </div>
  );
}

function tryPointerCapture(target: HTMLElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Synthetic pointer events in automated tests may not register as active pointers.
  }
}

function SkillButton({
  classId,
  slot,
  action,
  keyLabel,
  title,
  tooltip,
  endAt,
  disabled = false
}: {
  classId: ClassId;
  slot: SkillIconSlot;
  action: HudAction;
  keyLabel: string;
  title: string;
  tooltip: ActionTooltip;
  endAt: number;
  disabled?: boolean;
}) {
  const now = useHudStore((state) => state.snapshot?.serverTime ?? Date.now());
  const setHudAction = useHudStore((state) => state.setHudAction);
  const remaining = Math.max(0, endAt - now);
  const active = remaining <= 0 && !disabled;
  const cooling = remaining > 0;
  const clearAction = () => setHudAction(action, false);
  const releaseAction = () => {
    if (action === "attack") {
      clearAction();
    }
  };
  const pressAction = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!active) {
      return;
    }
    tryPointerCapture(event.currentTarget, event.pointerId);
    setHudAction(action, true);
    if (action !== "attack") {
      window.setTimeout(() => setHudAction(action, false), 90);
    }
  };

  return (
    <button
      type="button"
      className={["skill-button", cooling ? "cooling" : "", disabled ? "disabled" : ""].filter(Boolean).join(" ")}
      aria-label={`${title} (${keyLabel})`}
      disabled={!active}
      onPointerDown={pressAction}
      onPointerUp={(event) => {
        event.stopPropagation();
        releaseAction();
      }}
      onPointerCancel={releaseAction}
      onPointerLeave={releaseAction}
      onBlur={releaseAction}
      onContextMenu={(event) => event.preventDefault()}
    >
      <i
        className="skill-icon"
        style={getSkillIconStyle(classId, slot)}
      />
      <span>{title}</span>
      <strong>{keyLabel}</strong>
      {cooling ? <em>{Math.ceil(remaining / 1000)}</em> : null}
      <div className="skill-tooltip" aria-hidden="true">
        <b>{title}</b>
        <p>{tooltip.description}</p>
        <small>{tooltip.facts.join(" / ")}</small>
      </div>
    </button>
  );
}

function getSkillIconStyle(classId: ClassId, slot: SkillIconSlot): CSSProperties {
  const icon = getSkillIconPosition(classId, slot);
  return {
    "--skill-icon-sheet": SKILL_ICON_SHEET,
    "--icon-x": `${(icon.column / 3) * 100}%`,
    "--icon-y": `${(icon.row / 3) * 100}%`
  } as CSSProperties;
}

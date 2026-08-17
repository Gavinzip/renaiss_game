import { GearSix, MapTrifold, PencilSimple, Question, Sparkle, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import {
  ARENA_LOADOUT_SLOTS,
  CLASS_META,
  CLASS_ORDER,
  CLASS_STATS,
  getEffectiveBasicAttackDamage,
  getArenaCatalogCoreSkill,
  getArenaCatalogSkill,
  getArenaCatalogSkillDetail,
  isArenaCatalogLoadoutComplete,
  type ActionTooltip,
  type ArenaCatalogLoadout,
  type ArenaCatalogSkillId,
  type ArenaLoadout,
  type ArenaLoadoutSlot,
  type ClassId,
  type JoinRequest,
  type SkillKey
} from "@renaiss-game/shared";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  configureGameUiSounds,
  playGameUiSound,
  unlockGameUiSounds,
  type GameUiSoundHandle
} from "./audio/gameUiSounds";
import { ClassPortrait } from "./components/ClassPortrait";
import { ArenaControlHint } from "./components/ArenaControlHint";
import { ArenaKillFeed } from "./components/ArenaKillFeed";
import { CombatAnnouncer } from "./components/CombatAnnouncer";
import { CombatToast } from "./components/CombatToast";
import { DeathOverlay } from "./components/DeathOverlay";
import { ArenaLoadoutSummary } from "./components/ArenaLoadoutSummary";
import { ArenaSkillLoadoutScreen } from "./components/ArenaSkillLoadoutScreen";
import {
  ArenaStatusEffectReview,
  ArenaStatusLiveReviewBanner,
  isArenaStatusReviewKey
} from "./components/ArenaStatusEffectReview";
import { ArenaCatalogSkillIcon, getArenaSkillIconStyle } from "./components/ArenaSkillIcon";
import { GameAudio } from "./components/GameAudio";
import { HudActionDrawer, type HudActionMode } from "./components/HudActionDrawer";
import { MapEditor } from "./components/MapEditor";
import { Minimap } from "./components/Minimap";
import { RoundHud } from "./components/RoundHud";
import { RoundRewards } from "./components/RoundRewards";
import { RoundResultOverlay } from "./components/RoundResultOverlay";
import { SelfStatusOverlay } from "./components/SelfStatusOverlay";
import { TeamStatusPanel } from "./components/TeamStatusPanel";
import { RpgAnimationPreview } from "./components/RpgAnimationPreview";
import { RpgReleaseReview } from "./components/RpgReleaseReview";
import { RpgSkillAnimationPreview } from "./components/RpgSkillAnimationPreview";
import { RpgStatusAnimationPreview } from "./components/RpgStatusAnimationPreview";
import { XLoginGate } from "./components/XLoginGate";
import { UnityArenaLauncher } from "./components/UnityArenaLauncher";
import type { XAuthUser } from "./api/auth";
import { type SkillIconSlot } from "./game/assets/crops";
import { generatedAssetPath } from "./game/assets/generatedAssets";
import { installStaticAssetCssVariables, staticAssetUrl } from "./game/assets/staticAssets";
import { createGame } from "./game/createGame";
import { createRpgGame } from "./game/createRpgGame";
import { isMapPreviewMode, loadStoredMapDraftProps } from "./game/mapDraft";
import { useHudStore, type HudAction, type HudSkillAction } from "./state/hudStore";
import {
  loadHudDisplayPrefs,
  saveHudDisplayPrefs,
  type HudDisplayPrefs,
  type HudScale,
  type HudTogglePreference
} from "./state/hudPreferences";
import { useRpgStore } from "./state/rpgStore";
import { RpgOverlay } from "./components/RpgOverlay";
import { useArenaSkillCollectionStore } from "./state/arenaSkillCollectionStore";
import { ArenaTutorialModal, useFirstRunTutorial } from "./components/RpgTutorial";
import { formatScore } from "./utils/formatScore";
import { ArenaI18nProvider, ARENA_LANGUAGES, useArenaI18n } from "./i18n/arena";

const LANGUAGE_SELECTION_STORAGE_KEY = "renaiss:first-language-selected:v2";
const ENTRY_LANGUAGE_OPTIONS = ARENA_LANGUAGES;

export function App() {
  const appParams = new URLSearchParams(window.location.search);
  const arenaStatusReviewMode = appParams.get("statusReview") === "1";

  useEffect(() => {
    installStaticAssetCssVariables();
  }, []);

  return (
    <ArenaI18nProvider>
      <LanguageFirstRunGate>
        {arenaStatusReviewMode ? (
          <ArenaStatusEffectReview />
        ) : (
          <XLoginGate>{(session) => <GameApp authUser={session.user} />}</XLoginGate>
        )}
      </LanguageFirstRunGate>
      <MobileLandscapeGate />
    </ArenaI18nProvider>
  );
}

function LanguageFirstRunGate({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useArenaI18n();
  const [confirmed, setConfirmed] = useState(() => hasConfirmedEntryLanguage());
  const copy = t.ui;

  const confirmLanguage = () => {
    try {
      window.localStorage.setItem(LANGUAGE_SELECTION_STORAGE_KEY, "1");
    } catch {
      // Private browsers can reject storage; the in-memory state still lets this page continue.
    }
    setConfirmed(true);
    playGameUiSound("complete");
  };

  if (confirmed) {
    return <>{children}</>;
  }

  return (
    <main className="language-entry-page" aria-label={copy.languageSetupTitle}>
      <section className="language-entry-panel">
        <img src={staticAssetUrl("/assets/generated/vinci-favicon.png")} alt="" />
        <span>{copy.languageSetupEyebrow}</span>
        <h1>{copy.languageSetupTitle}</h1>
        <p>{copy.languageSetupBody}</p>
        <div className="language-entry-options" aria-label={copy.languageSetupTitle}>
          {ENTRY_LANGUAGE_OPTIONS.map((option) => (
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
              <strong>{option.label}</strong>
              <em>{language === option.id ? copy.languageSetupCurrent : option.shortLabel}</em>
            </button>
          ))}
        </div>
        <button type="button" className="language-entry-confirm" onClick={confirmLanguage}>
          {copy.languageSetupContinue}
        </button>
      </section>
    </main>
  );
}

function hasConfirmedEntryLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_SELECTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function GameApp({ authUser }: { authUser: XAuthUser }) {
  const params = new URLSearchParams(window.location.search);
  const editorMode = params.get("editor") === "1";
  const arenaMode = params.get("arena") === "1";
  const arenaRuntime = params.get("runtime") === "unity" ? "unity" : "phaser";
  const arenaStatusReviewMode = params.get("statusReview") === "1";
  const liveStatusReviewKey = params.get("reviewStatus");
  const mapPreviewMode = isMapPreviewMode();
  const mapPreviewDraftCount = mapPreviewMode ? loadStoredMapDraftProps()?.length ?? 0 : 0;
  const collectionStatus = useArenaSkillCollectionStore((state) => state.status);
  const unlockedSkillIds = useArenaSkillCollectionStore((state) => state.unlockedSkillIds);
  const loadSkillCollection = useArenaSkillCollectionStore((state) => state.loadForOwner);
  const reconcileCatalogLoadouts = useHudStore((state) => state.reconcileCatalogLoadouts);

  useEffect(() => {
    void loadSkillCollection(`${authUser.provider}:${authUser.id}`);
  }, [authUser.id, authUser.provider, loadSkillCollection]);

  useEffect(() => {
    if (collectionStatus === "ready") reconcileCatalogLoadouts(unlockedSkillIds);
  }, [collectionStatus, reconcileCatalogLoadouts, unlockedSkillIds]);

  useEffect(() => {
    if (editorMode || !arenaMode || arenaStatusReviewMode || arenaRuntime === "unity") {
      return undefined;
    }
    const game = createGame("game-root");
    return () => {
      game.destroy(true);
    };
  }, [arenaMode, arenaRuntime, arenaStatusReviewMode, editorMode]);

  if (editorMode) {
    return <MapEditor />;
  }

  if (!arenaMode) {
    return <RpgApp authUser={authUser} />;
  }

  if (arenaRuntime === "unity") {
    return <UnityArenaLauncher playerName={xPlayerName(authUser)} />;
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
      {isArenaStatusReviewKey(liveStatusReviewKey) ? (
        <ArenaStatusLiveReviewBanner reviewKey={liveStatusReviewKey} />
      ) : null}
    </main>
  );
}

function RpgApp({ authUser }: { authUser: XAuthUser }) {
  const previewMode = new URLSearchParams(window.location.search).get("preview");
  const rpgArenaStyle = { "--rpg-arena-url": `url("${generatedAssetPath("rpg-battle-arena")}")` } as CSSProperties;
  const [rpgReady, setRpgReady] = useState(false);

  useEffect(() => {
    const currentName = useRpgStore.getState().playerName;
    if (!currentName || currentName === "GUEST_2AC1") {
      useRpgStore.getState().setPlayerName(xPlayerName(authUser));
    }
  }, [authUser.id, authUser.username]);

  useEffect(() => {
    if (previewMode === "pets" || previewMode === "skills" || previewMode === "status" || previewMode === "release") {
      return undefined;
    }
    setRpgReady(false);
    const handleRpgReady = () => setRpgReady(true);
    window.addEventListener("renaiss:rpg-ready", handleRpgReady);
    const game = createRpgGame("game-root");
    return () => {
      window.removeEventListener("renaiss:rpg-ready", handleRpgReady);
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
      {rpgReady ? <RpgOverlay /> : <RpgLoadingGate />}
    </main>
  );
}

function RpgLoadingGate() {
  const { t } = useArenaI18n();
  return (
    <section className="rpg-loading-gate" role="status" aria-live="polite" aria-label={t.ui.rpgLoadingAria}>
      <div className="rpg-loading-window">
        <span>RENAISS ARENA</span>
        <strong>{t.ui.rpgLoadingTitle}</strong>
        <div className="rpg-loading-bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </section>
  );
}

function StartPanel({ authUser }: { authUser: XAuthUser }) {
  const { language, setLanguage, t } = useArenaI18n();
  const joined = useHudStore((state) => state.joined);
  const connection = useHudStore((state) => state.connection);
  const selectedClass = useHudStore((state) => state.selectedClass);
  const selectedMode = useHudStore((state) => state.selectedMode);
  const arenaCatalogLoadouts = useHudStore((state) => state.arenaCatalogLoadouts);
  const collectionStatus = useArenaSkillCollectionStore((state) => state.status);
  const unlockedSkillIds = useArenaSkillCollectionStore((state) => state.unlockedSkillIds);
  const setSelectedClass = useHudStore((state) => state.setSelectedClass);
  const setSelectedMode = useHudStore((state) => state.setSelectedMode);
  const requestJoin = useHudStore((state) => state.requestJoin);
  const [name, setName] = useState(xPlayerName(authUser));
  const [setupView, setSetupView] = useState<"arena" | "skills">("arena");
  const connectionLoop = useRef<GameUiSoundHandle | null>(null);
  const previousConnection = useRef(connection);
  const arenaTutorial = useFirstRunTutorial("arena");
  const classId = selectedClass;
  const meta = CLASS_META[classId];
  const classCopy = t.classes[classId];
  const stats = CLASS_STATS[classId];
  const catalogLoadout = arenaCatalogLoadouts[classId];
  const unlockedSkillSet = useMemo(() => new Set(unlockedSkillIds), [unlockedSkillIds]);
  const catalogLoadoutComplete = collectionStatus === "ready" &&
    isArenaCatalogLoadoutComplete(catalogLoadout) &&
    ARENA_LOADOUT_SLOTS.every((slot) => {
      const skillId = catalogLoadout[slot];
      return Boolean(skillId && unlockedSkillSet.has(skillId));
    });
  const openSkillForge = () => {
    playGameUiSound("forward");
    const url = new URL(window.location.href);
    url.searchParams.delete("arena");
    url.searchParams.set("skillShop", "1");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };
  const enterArena = () => {
    if (!arenaTutorial.seen) {
      playGameUiSound("open");
      arenaTutorial.openTutorial();
      return;
    }
    const latestClassId = useHudStore.getState().selectedClass;
    const request: JoinRequest = {
      name,
      classId: latestClassId,
      loadout: { ...useHudStore.getState().arenaLoadouts[latestClassId] },
      catalogLoadout: { ...useHudStore.getState().arenaCatalogLoadouts[latestClassId] },
      mode: useHudStore.getState().selectedMode,
      engineerTurretKind: useHudStore.getState().engineerTurretKind
    };
    const draftProps = isMapPreviewMode() ? loadStoredMapDraftProps() : null;
    if (draftProps) {
      request.mapDraft = { props: draftProps };
    }
    if (isArenaReviewMode()) {
      request.review = {
        noBots: isNoBotsReviewMode(),
        fixedSpawn: isFixedSpawnReviewMode(),
        invulnerable: isInvulnerableReviewMode(),
        freezeBots: isFrozenBotsReviewMode(),
        invulnerableBots: isInvulnerableBotsReviewMode(),
        botCount: getReviewBotCount() ?? undefined,
        botHealth: getReviewBotHealth() ?? undefined
      };
      const reviewSpawnPoint = getReviewSpawnPoint();
      if (reviewSpawnPoint) {
        request.review.spawnPoint = reviewSpawnPoint;
      }
      const reviewTargetPoint = getReviewTargetPoint();
      if (reviewTargetPoint) {
        request.review.targetPoint = reviewTargetPoint;
      }
    }
    requestJoin(request);
  };

  useEffect(() => {
    const busy = connection === "connecting" || connection === "preparing" || connection === "reconnecting";
    if (busy && !connectionLoop.current) {
      connectionLoop.current = playGameUiSound("connecting");
    } else if (!busy && connectionLoop.current) {
      connectionLoop.current.stop();
      connectionLoop.current = null;
    }

    if (connection === "error" && previousConnection.current !== "error") {
      playGameUiSound("error");
    }
    previousConnection.current = connection;
  }, [connection]);

  useEffect(() => () => {
    connectionLoop.current?.stop();
    connectionLoop.current = null;
  }, []);

  if (joined) {
    return null;
  }

  if (setupView === "skills") {
    return (
      <ArenaSkillLoadoutScreen
        classId={classId}
        onClassChange={setSelectedClass}
        onClose={() => setSetupView("arena")}
      />
    );
  }

  return (
    <section className="start-panel" aria-label={t.ui.enterArena}>
      <header className="arena-loadout-banner">
        <div className="start-brand-row">
          <img className="start-brand-logo" src={staticAssetUrl("/assets/generated/vinci-favicon.png")} alt="" />
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
        <div className="arena-tags" aria-label={t.ui.arenaRules}>
          <span>{t.ui.ruleTime}</span>
          <span>{t.ui.ruleScore}</span>
          <span>{selectedMode === "team_3v3" ? t.ui.team3v3Rule : t.ui.ruleRivals}</span>
        </div>
      </header>

      <section className="arena-mode-selector" aria-label={t.ui.arenaMode}>
        <header>
          <span>{t.ui.arenaMode}</span>
          <strong>{selectedMode === "team_3v3" ? t.ui.team3v3 : t.ui.freeForAll}</strong>
        </header>
        <div>
          <button
            type="button"
            className={selectedMode === "free_for_all" ? "is-selected" : ""}
            aria-pressed={selectedMode === "free_for_all"}
            onClick={() => {
              if (selectedMode === "free_for_all") return;
              setSelectedMode("free_for_all");
              playGameUiSound("select");
            }}
          >
            <strong>{t.ui.freeForAll}</strong>
            <small>{t.ui.freeForAllDescription}</small>
          </button>
          <button
            type="button"
            className={selectedMode === "team_3v3" ? "is-selected" : ""}
            aria-pressed={selectedMode === "team_3v3"}
            onClick={() => {
              if (selectedMode === "team_3v3") return;
              setSelectedMode("team_3v3");
              playGameUiSound("select");
            }}
          >
            <strong>{t.ui.team3v3}</strong>
            <small>{t.ui.team3v3Description}</small>
          </button>
        </div>
      </section>

      <div className="class-command" style={{ "--accent": meta.accent } as CSSProperties}>
        <header>
          <span>{t.ui.classSelection}</span>
          <strong>{classCopy.label}</strong>
          <em>{classCopy.role}</em>
        </header>
        <div className="class-grid" role="list" aria-label={t.ui.classSelection}>
          {CLASS_ORDER.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === classId ? "class-card is-selected" : "class-card"}
              onClick={() => {
                if (candidate === classId) return;
                setSelectedClass(candidate);
                playGameUiSound("select");
              }}
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

      <div className="class-stage" style={{ "--accent": meta.accent } as CSSProperties}>
        <ClassPortrait classId={classId} frame={classId === "archer" || classId === "engineer" ? 1 : 0} />
        <div className="class-stage-name">
          <strong>{classCopy.label}</strong>
          <span>{classCopy.role}</span>
        </div>
        <div className="class-skill-icons" aria-label={`${classCopy.label} ${t.ui.skills}`}>
          {ARENA_LOADOUT_SLOTS.map((slot) => {
            const skillId = catalogLoadout[slot];
            return (
              <CatalogSkillGlyph
                key={slot}
                skillId={skillId}
                label={slot.slice(-1)}
                title={getArenaCatalogSkill(skillId)?.name ?? t.ui.slotEmpty}
              />
            );
          })}
        </div>
        <div className="stat-stack">
          <StatBar label={t.ui.hp} value={stats.maxHealth} max={200} />
          <StatBar label={t.ui.atk} value={getEffectiveBasicAttackDamage(classId)} max={40} />
          <StatBar label={t.ui.spd} value={stats.moveSpeed} max={220} />
        </div>
      </div>

      <ArenaLoadoutSummary
        classId={classId}
        loadout={catalogLoadout}
        onConfigure={() => {
          setSetupView("skills");
          playGameUiSound("open");
        }}
      />

      <footer className="start-copy">
        <label>
          <span>{t.ui.playerName}</span>
          <input value={name} maxLength={14} onChange={(event) => setName(event.target.value)} />
        </label>
        <button
          className="enter-button"
          type="button"
          onClick={catalogLoadoutComplete ? enterArena : () => {
            setSetupView("skills");
            playGameUiSound("open");
          }}
        >
          {connection === "connecting" || connection === "preparing" || connection === "reconnecting"
            ? connection === "preparing"
              ? t.ui.preparingAssets
              : connection === "reconnecting"
                ? t.ui.reconnecting
                : t.ui.connecting
            : catalogLoadoutComplete
              ? t.ui.enterArena
              : t.ui.equipBeforeEntry}
        </button>
        <div className="arena-start-secondary-actions">
          <button className="arena-skill-forge-link" type="button" onClick={openSkillForge}>
            <Sparkle size={17} weight="fill" />
            <span>{language === "zh" ? "大廳抽技能" : language === "ko" ? "로비 스킬 뽑기" : "Lobby skill draw"}</span>
          </button>
          <button className="arena-tutorial-button" type="button" onClick={() => {
            arenaTutorial.openTutorial();
            playGameUiSound("open");
          }}>
            <Question size={17} weight="bold" />
            <span>{t.ui.tutorial}</span>
          </button>
        </div>
        {connection === "error" ? <p className="connection-error">{t.ui.connectionError}</p> : null}
      </footer>
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

function isArenaReviewMode() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.has("reviewBots") ||
    params.has("reviewSpawn") ||
    params.has("reviewInvulnerable") ||
    params.has("reviewFreezeBots") ||
    params.has("reviewInvulnerableBots") ||
    params.has("reviewBotCount") ||
    params.has("reviewBotHealth") ||
    params.has("reviewTargetX") ||
    params.has("reviewTargetY")
  );
}

function isFixedSpawnReviewMode() {
  return new URLSearchParams(window.location.search).get("reviewSpawn") === "fixed";
}

function isInvulnerableReviewMode() {
  return (
    new URLSearchParams(window.location.search).get("reviewInvulnerable") === "1"
  );
}

function isFrozenBotsReviewMode() {
  return new URLSearchParams(window.location.search).get("reviewFreezeBots") === "1";
}

function isInvulnerableBotsReviewMode() {
  return (
    new URLSearchParams(window.location.search).get("reviewInvulnerableBots") === "1"
  );
}

function getReviewBotCount() {
  const raw = new URLSearchParams(window.location.search).get("reviewBotCount");
  if (raw === null) {
    return null;
  }
  const count = Number(raw);
  return Number.isInteger(count) ? Math.max(0, Math.min(8, count)) : null;
}

function getReviewBotHealth() {
  const raw = new URLSearchParams(window.location.search).get("reviewBotHealth");
  if (raw === null) {
    return null;
  }
  const health = Number(raw);
  return Number.isFinite(health) ? Math.max(1, Math.min(10000, health)) : null;
}

function getReviewSpawnPoint() {
  const params = new URLSearchParams(window.location.search);
  const rawX = params.get("reviewSpawnX");
  const rawY = params.get("reviewSpawnY");
  // Number(null) is 0.  Treat omitted coordinates as omitted so fixed review
  // mode uses the server's centred review spawn rather than the map corner.
  if (rawX === null || rawY === null) {
    return null;
  }
  const x = Number(rawX);
  const y = Number(rawY);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function getReviewTargetPoint() {
  const params = new URLSearchParams(window.location.search);
  const rawX = params.get("reviewTargetX");
  const rawY = params.get("reviewTargetY");
  if (rawX === null || rawY === null) {
    return null;
  }
  const x = Number(rawX);
  const y = Number(rawY);
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
      style={getArenaSkillIconStyle(classId, slot)}
    >
      <i />
      <b>{label}</b>
    </span>
  );
}

function CatalogSkillGlyph({
  skillId,
  label,
  title
}: {
  skillId: ArenaCatalogSkillId | null;
  label: string;
  title: string;
}) {
  return (
    <span className="skill-glyph" title={title}>
      <ArenaCatalogSkillIcon skillId={skillId} />
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
  const arenaLoadouts = useHudStore((state) => state.arenaLoadouts);
  const arenaCatalogLoadouts = useHudStore((state) => state.arenaCatalogLoadouts);
  const engineerTurretKind = useHudStore((state) => state.engineerTurretKind);
  const setEngineerTurretKind = useHudStore((state) => state.setEngineerTurretKind);
  const leaveArena = useHudStore((state) => state.leaveArena);
  const self = snapshot?.players.find((player) => player.id === selfId) ?? null;
  const displayClass = self?.classId ?? selectedClass;
  const displayLoadout = self?.loadout ?? arenaLoadouts[displayClass];
  const displayCatalogLoadout =
    self?.catalogLoadout ?? arenaCatalogLoadouts[displayClass];
  const skillLabels = self ? t.skills[self.classId] : null;
  const actionTooltips = t.tooltips[displayClass];
  const coreSkill = getArenaCatalogCoreSkill(displayClass);
  const coreSkillDetail = getArenaCatalogSkillDetail(coreSkill?.id ?? null);
  const coreSkillTooltip: ActionTooltip = coreSkillDetail
    ? {
        description: coreSkillDetail.effect,
        facts: [
          coreSkillDetail.damage ? `${t.ui.damage} ${coreSkillDetail.damage}` : null,
          coreSkillDetail.cooldown ? `${t.ui.cooldown} ${coreSkillDetail.cooldown}` : null,
          coreSkillDetail.duration ?? null
        ].filter((fact): fact is string => Boolean(fact))
      }
    : actionTooltips.skillF;
  const actionsDisabled = !self?.alive || snapshot?.round.phase === "finished";
  const leaderboard = snapshot?.leaderboard ?? [];
  const compactLeaderboard = leaderboard.slice(0, 5);
  const [activeDrawer, setActiveDrawer] = useState<HudActionMode | null>(null);
  const [displayPrefs, setDisplayPrefs] = useState(loadHudDisplayPrefs);
  const [arenaTutorialOpen, setArenaTutorialOpen] = useState(false);
  const effectiveAudioVolume = displayPrefs.audioVolume * (displayPrefs.reducedMotion ? 0.72 : 1);
  useEffect(() => {
    saveHudDisplayPrefs(displayPrefs);
  }, [displayPrefs]);
  useEffect(() => {
    configureGameUiSounds({
      pack: displayPrefs.audioPack,
      volume: effectiveAudioVolume
    });
    if (displayPrefs.audio) {
      configureGameUiSounds({ enabled: true });
      return undefined;
    }
    const timeout = window.setTimeout(() => configureGameUiSounds({ enabled: false }), 320);
    return () => window.clearTimeout(timeout);
  }, [displayPrefs.audio, displayPrefs.audioPack, effectiveAudioVolume]);
  const toggleDrawer = (drawer: HudActionMode) => {
    const closing = activeDrawer === drawer;
    setActiveDrawer(closing ? null : drawer);
    playGameUiSound(closing ? "close" : "open");
  };
  const toggleDisplayPref = (key: HudTogglePreference) => {
    const next = !displayPrefs[key];
    if (key === "audio") {
      if (next) {
        configureGameUiSounds({ enabled: true });
        void unlockGameUiSounds();
        playGameUiSound("toggle-on");
      } else {
        playGameUiSound("toggle-off");
      }
    } else {
      playGameUiSound(next ? "toggle-on" : "toggle-off");
    }
    setDisplayPrefs((current) => ({ ...current, [key]: next }));
  };
  const setHudScale = (uiScale: HudScale) => {
    if (displayPrefs.uiScale === uiScale) return;
    setDisplayPrefs((current) => ({ ...current, uiScale }));
    playGameUiSound("select");
  };
  const setAudioVolume = (audioVolume: number) => {
    setDisplayPrefs((current) => ({
      ...current,
      audioVolume: Math.max(0, Math.min(1, audioVolume))
    }));
  };
  const setAudioPack = (audioPack: HudDisplayPrefs["audioPack"]) => {
    if (displayPrefs.audioPack === audioPack) return;
    configureGameUiSounds({ pack: audioPack, enabled: displayPrefs.audio });
    setDisplayPrefs((current) => ({ ...current, audioPack }));
    playGameUiSound("select");
  };
  const exitArena = () => {
    leaveArena();
    window.location.assign("/");
  };
  const devToolsMode = new URLSearchParams(window.location.search).get("dev") === "1";

  if (!joined) {
    return (
      <div className="hud-layer hud-layer-start" aria-label={t.ui.gameHud}>
        <GameAudio snapshot={snapshot} selfId={selfId} enabled={displayPrefs.audio} volume={effectiveAudioVolume} />
      </div>
    );
  }

  return (
    <div
      className={[
        "hud-layer",
        "arena-combat-hud",
        `hud-scale-${displayPrefs.uiScale}`,
        displayPrefs.highContrast ? "hud-high-contrast" : "",
        displayPrefs.reducedMotion ? "hud-reduced-motion" : ""
      ].filter(Boolean).join(" ")}
      aria-label={t.ui.gameHud}
    >
      <GameAudio snapshot={snapshot} selfId={selfId} enabled={displayPrefs.audio} volume={effectiveAudioVolume} />
      <nav className="top-actions" aria-label={t.ui.gameActions}>
        {devToolsMode ? (
          <a href="/?editor=1&dev=1" title={t.ui.sceneEditor} aria-label={t.ui.sceneEditor}>
            <PencilSimple size={25} weight="fill" />
          </a>
        ) : null}
        <button type="button" className={activeDrawer === "map" ? "is-active" : ""} title={t.ui.map} aria-pressed={activeDrawer === "map"} onClick={() => toggleDrawer("map")}>
          <MapTrifold size={26} weight="fill" />
        </button>
        <button type="button" title={t.ui.arenaTutorial} aria-label={t.ui.arenaTutorial} onClick={() => {
          setArenaTutorialOpen(true);
          playGameUiSound("open");
        }}>
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
          onSetHudScale={setHudScale}
          onSetAudioVolume={setAudioVolume}
          onSetAudioPack={setAudioPack}
          onExitArena={exitArena}
        />
      ) : null}

      {!activeDrawer ? (
        <section className="status-chip">
          <span className={connection === "connected" ? "status-dot connected" : "status-dot"} />
          {connection === "connected"
            ? t.ui.liveArena
            : connection === "preparing"
              ? t.ui.preparingAssets
              : connection === "reconnecting"
                ? t.ui.reconnecting
                : connection === "connecting"
                  ? t.ui.connecting
                  : connection}
        </section>
      ) : null}

      {joined && snapshot ? <RoundHud round={snapshot.round} serverTime={snapshot.serverTime} /> : null}
      {joined && snapshot && displayPrefs.combatPopups ? <CombatAnnouncer snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot && displayPrefs.combatPopups ? <CombatToast snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot && displayPrefs.combatPopups ? <ArenaKillFeed snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot ? <RoundRewards round={snapshot.round} /> : null}
      {joined && snapshot && displayPrefs.minimap && activeDrawer !== "map" ? <Minimap snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot ? <SelfStatusOverlay player={self} /> : null}
      {joined && snapshot ? <RoundResultOverlay round={snapshot.round} serverTime={snapshot.serverTime} leaderboard={snapshot.leaderboard} selfId={selfId} /> : null}
      {joined && snapshot?.round.phase !== "finished" ? <DeathOverlay player={self} serverTime={snapshot?.serverTime ?? Date.now()} /> : null}

      {joined && snapshot?.round.mode === "team_3v3" ? (
        <TeamStatusPanel snapshot={snapshot} selfId={selfId} />
      ) : joined ? (
        <section className="leaderboard">
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
        </section>
      ) : null}

      {joined ? (
        <div className={`combat-skill-dock ${displayClass === "engineer" ? "has-engineer-core" : ""}`}>
          {displayClass === "engineer" ? (
            <section className="engineer-turret-selector" aria-label={t.ui.turretType}>
              <span>{t.ui.turretType}</span>
              <button
                type="button"
                className={engineerTurretKind === "mechanical" ? "is-active" : ""}
                aria-pressed={engineerTurretKind === "mechanical"}
                onClick={() => {
                  if (engineerTurretKind === "mechanical") return;
                  setEngineerTurretKind("mechanical");
                  playGameUiSound("select");
                }}
              >
                {t.ui.mechanicalTurret}
              </button>
              <button
                type="button"
                className={engineerTurretKind === "magic_missile" ? "is-active" : ""}
                aria-pressed={engineerTurretKind === "magic_missile"}
                onClick={() => {
                  if (engineerTurretKind === "magic_missile") return;
                  setEngineerTurretKind("magic_missile");
                  playGameUiSound("select");
                }}
              >
                {t.ui.magicTurret}
              </button>
            </section>
          ) : null}
          <section className="skill-bar" aria-label={t.ui.skills}>
            {displayClass === "engineer" ? (
              <SkillButton
                classId={displayClass}
                slot="skillF"
                action="skillF"
                keyLabel="F"
                title={coreSkill?.name ?? skillLabels?.skillF ?? t.skills[displayClass].skillF}
                tooltip={coreSkillTooltip}
                catalogSkillId={coreSkill?.id ?? null}
                endAt={self?.cooldowns.skillF ?? 0}
                disabled={actionsDisabled}
              />
            ) : null}
            {ARENA_LOADOUT_SLOTS.map((loadoutSlot) => {
              const ability = displayLoadout[loadoutSlot];
              const catalogSkillId = displayCatalogLoadout[loadoutSlot];
              const catalogSkill = getArenaCatalogSkill(catalogSkillId);
              const catalogDetail = getArenaCatalogSkillDetail(catalogSkillId);
              const tooltip: ActionTooltip = catalogDetail
                ? {
                    description: catalogDetail.effect,
                    facts: [
                      catalogDetail.damage ? `${t.ui.damage} ${catalogDetail.damage}` : null,
                      catalogDetail.cooldown ? `${t.ui.cooldown} ${catalogDetail.cooldown}` : null,
                      catalogDetail.duration ? catalogDetail.duration : null
                    ].filter((fact): fact is string => Boolean(fact))
                  }
                : actionTooltips[ability];
              return (
                <SkillButton
                  key={loadoutSlot}
                  classId={displayClass}
                  slot={ability}
                  action={loadoutSlot}
                  keyLabel={loadoutSlot.slice(-1)}
                  title={catalogSkill?.name ?? skillLabels?.[ability] ?? loadoutSlot.slice(-1)}
                  tooltip={tooltip}
                  catalogSkillId={catalogSkillId}
                  endAt={self?.cooldowns[ability] ?? 0}
                  disabled={actionsDisabled}
                />
              );
            })}
          </section>
        </div>
      ) : null}
      {joined ? (
        <MobileArenaControls
          classId={displayClass}
          loadout={displayLoadout}
          catalogLoadout={displayCatalogLoadout}
          skillLabels={skillLabels ?? t.skills[displayClass]}
          actionTooltips={actionTooltips}
          skillCooldowns={self?.cooldowns ?? null}
          disabled={actionsDisabled}
        />
      ) : null}
      {joined ? <ArenaControlHint classId={displayClass} /> : null}
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

function MobileLandscapeGate() {
  const { t } = useArenaI18n();
  return (
    <section className="mobile-landscape-gate" aria-label={t.ui.mobileRotateAria}>
      <div className="mobile-rotate-card">
        <span className="mobile-rotate-phone" aria-hidden="true">
          <i />
        </span>
        <strong>{t.ui.mobileRotateTitle}</strong>
        <p>{t.ui.mobileRotateBody}</p>
      </div>
    </section>
  );
}

function MobileArenaControls({
  classId,
  loadout,
  catalogLoadout,
  skillLabels,
  actionTooltips,
  skillCooldowns,
  disabled
}: {
  classId: ClassId;
  loadout: ArenaLoadout;
  catalogLoadout: ArenaCatalogLoadout;
  skillLabels: Record<SkillKey, string>;
  actionTooltips: Record<HudAction, ActionTooltip>;
  skillCooldowns: Record<HudSkillAction, number> | null;
  disabled: boolean;
}) {
  const setMobileMove = useHudStore((state) => state.setMobileMove);
  const resetMobileMove = useHudStore((state) => state.resetMobileMove);
  const resetMobileAim = useHudStore((state) => state.resetMobileAim);
  const setMobileControlsActive = useHudStore((state) => state.setMobileControlsActive);
  const [stick, setStick] = useState<{ x: number; y: number; pointerId: number | null }>({ x: 0, y: 0, pointerId: null });
  const joystickRadius = 46;
  const coreSkill = getArenaCatalogCoreSkill(classId);
  const coreSkillDetail = getArenaCatalogSkillDetail(coreSkill?.id ?? null);
  const coreSkillTooltip: ActionTooltip = coreSkillDetail
    ? {
        description: coreSkillDetail.effect,
        facts: [
          coreSkillDetail.damage ? `Damage ${coreSkillDetail.damage}` : null,
          coreSkillDetail.cooldown ? `CD ${coreSkillDetail.cooldown}` : null,
          coreSkillDetail.duration ?? null
        ].filter((fact): fact is string => Boolean(fact))
      }
    : actionTooltips.skillF;

  useEffect(() => {
    if (!disabled) {
      return;
    }
    setStick({ x: 0, y: 0, pointerId: null });
    resetMobileMove();
    resetMobileAim();
  }, [disabled, resetMobileAim, resetMobileMove]);

  const updateStick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > joystickRadius ? joystickRadius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const deadzone = 7;
    setStick({ x, y, pointerId: event.pointerId });
    setMobileMove(distance > deadzone ? { x: x / joystickRadius, y: y / joystickRadius } : { x: 0, y: 0 });
  };

  const pressStick = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    tryPointerCapture(event.currentTarget, event.pointerId);
    setMobileControlsActive(true);
    updateStick(event);
  };

  const moveStick = (event: PointerEvent<HTMLDivElement>) => {
    if (stick.pointerId !== event.pointerId || disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    updateStick(event);
  };

  const releaseStick = (event: PointerEvent<HTMLDivElement>) => {
    if (stick.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setStick({ x: 0, y: 0, pointerId: null });
    resetMobileMove();
  };

  return (
    <section className="mobile-arena-controls" aria-label="Mobile arena controls">
      <div
        className="mobile-joystick-zone"
        onPointerDown={pressStick}
        onPointerMove={moveStick}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className={stick.pointerId !== null ? "mobile-joystick is-active" : "mobile-joystick"}
          style={{ "--stick-x": `${stick.x}px`, "--stick-y": `${stick.y}px` } as CSSProperties}
          aria-hidden="true"
        >
          <i />
        </div>
      </div>

      <div
        className={`mobile-skill-pad ${classId === "engineer" ? "has-engineer-core" : ""}`}
        onPointerDownCapture={() => setMobileControlsActive(true)}
      >
        {classId === "engineer" ? (
          <MobileSkillButton
            classId={classId}
            slot="skillF"
            action="skillF"
            actionClass="skill-f"
            keyLabel="F"
            title={coreSkill?.name ?? skillLabels.skillF}
            tooltip={coreSkillTooltip}
            catalogSkillId={coreSkill?.id ?? null}
            endAt={skillCooldowns?.skillF ?? 0}
            disabled={disabled}
          />
        ) : null}
        {ARENA_LOADOUT_SLOTS.map((loadoutSlot) => {
          const ability = loadout[loadoutSlot];
          const catalogSkillId = catalogLoadout[loadoutSlot];
          const catalogSkill = getArenaCatalogSkill(catalogSkillId);
          const catalogDetail = getArenaCatalogSkillDetail(catalogSkillId);
          const tooltip: ActionTooltip = catalogDetail
            ? {
                description: catalogDetail.effect,
                facts: [
                  catalogDetail.damage ? `Damage ${catalogDetail.damage}` : null,
                  catalogDetail.cooldown ? `CD ${catalogDetail.cooldown}` : null,
                  catalogDetail.duration ?? null
                ].filter((fact): fact is string => Boolean(fact))
              }
            : actionTooltips[ability];
          return (
            <MobileSkillButton
              key={loadoutSlot}
              classId={classId}
              slot={ability}
              action={loadoutSlot}
              actionClass={`skill-${loadoutSlot.slice(-1).toLowerCase()}`}
              keyLabel={loadoutSlot.slice(-1)}
              title={catalogSkill?.name ?? skillLabels[ability]}
              tooltip={tooltip}
              catalogSkillId={catalogSkillId}
              endAt={skillCooldowns?.[ability] ?? 0}
              disabled={disabled}
            />
          );
        })}
      </div>
    </section>
  );
}

function MobileSkillButton({
  classId,
  slot,
  action,
  actionClass,
  keyLabel,
  title,
  tooltip,
  catalogSkillId,
  endAt,
  disabled = false
}: {
  classId: ClassId;
  slot: SkillIconSlot;
  action: HudAction;
  actionClass: string;
  keyLabel: string;
  title: string;
  tooltip: ActionTooltip;
  catalogSkillId?: ArenaCatalogSkillId | null;
  endAt: number;
  disabled?: boolean;
}) {
  const now = useHudStore((state) => state.snapshot?.serverTime ?? 0);
  const setHudAction = useHudStore((state) => state.setHudAction);
  const armedSkillAction = useHudStore((state) => state.armedSkillAction);
  const queueHudSkillArm = useHudStore((state) => state.queueHudSkillArm);
  const setMobileAim = useHudStore((state) => state.setMobileAim);
  const resetMobileAim = useHudStore((state) => state.resetMobileAim);
  const setMobileControlsActive = useHudStore((state) => state.setMobileControlsActive);
  const pointerIdRef = useRef<number | null>(null);
  const remaining = Math.max(0, endAt - now);
  const active = remaining <= 0 && !disabled;
  const cooling = remaining > 0;
  const cooldownFill = useCooldownFill(endAt, now);
  const cooldownStyle = { "--cooldown-fill": `${cooldownFill * 100}%` } as CSSProperties;
  const readyPulse = useSkillReadyPulse(cooling, disabled);
  const isSkill = action !== "attack";
  const isArmed = isSkill && armedSkillAction === action;

  const updateAim = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isSkill) {
      return;
    }
    setMobileAim(action as HudSkillAction, event.clientX, event.clientY);
  };

  const cancelAction = () => {
    setHudAction(action, false);
    pointerIdRef.current = null;
    if (isSkill) {
      resetMobileAim();
    }
  };

  const pressAction = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 || !active) {
      return;
    }
    tryPointerCapture(event.currentTarget, event.pointerId);
    pointerIdRef.current = event.pointerId;
    setMobileControlsActive(true);
    setHudAction(action, true);
    updateAim(event);
  };

  const moveAction = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isSkill || pointerIdRef.current !== event.pointerId || disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    updateAim(event);
  };

  const releaseAction = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setHudAction(action, false);
    pointerIdRef.current = null;
    if (isSkill) {
      updateAim(event);
      queueHudSkillArm(action as HudSkillAction);
    }
  };

  return (
    <button
      type="button"
      className={["mobile-action-button", actionClass, cooling ? "cooling" : "", readyPulse ? "is-ready" : "", isArmed ? "is-armed" : "", disabled ? "disabled" : ""].filter(Boolean).join(" ")}
      data-action={action}
      data-skill-id={catalogSkillId ?? undefined}
      aria-label={`${title} (${keyLabel}) - ${tooltip.description}`}
      aria-pressed={isSkill ? isArmed : undefined}
      disabled={!active}
      onPointerDown={pressAction}
      onPointerMove={moveAction}
      onPointerUp={releaseAction}
      onPointerCancel={cancelAction}
      onContextMenu={(event) => event.preventDefault()}
    >
      {catalogSkillId ? (
        <ArenaCatalogSkillIcon
          skillId={catalogSkillId}
          className="mobile-action-icon"
        />
      ) : (
        <i
          className="mobile-action-icon"
          style={getArenaSkillIconStyle(classId, slot)}
        />
      )}
      <span>{title}</span>
      <strong>{keyLabel}</strong>
      {cooling ? (
        <em style={cooldownStyle}>
          <b>{Math.ceil(remaining / 1000)}</b>
        </em>
      ) : null}
    </button>
  );
}

function SkillButton({
  classId,
  slot,
  action,
  keyLabel,
  title,
  tooltip,
  catalogSkillId,
  endAt,
  disabled = false
}: {
  classId: ClassId;
  slot: SkillIconSlot;
  action: HudAction;
  keyLabel: string;
  title: string;
  tooltip: ActionTooltip;
  catalogSkillId?: ArenaCatalogSkillId | null;
  endAt: number;
  disabled?: boolean;
}) {
  const now = useHudStore((state) => state.snapshot?.serverTime ?? 0);
  const setHudAction = useHudStore((state) => state.setHudAction);
  const armedSkillAction = useHudStore((state) => state.armedSkillAction);
  const queueHudSkillArm = useHudStore((state) => state.queueHudSkillArm);
  const remaining = Math.max(0, endAt - now);
  const active = remaining <= 0 && !disabled;
  const cooling = remaining > 0;
  const cooldownFill = useCooldownFill(endAt, now);
  const cooldownStyle = { "--cooldown-fill": `${cooldownFill * 100}%` } as CSSProperties;
  const readyPulse = useSkillReadyPulse(cooling, disabled);
  const isArmed = action !== "attack" && armedSkillAction === action;
  const clearAction = () => setHudAction(action, false);
  const cancelAction = () => clearAction();
  const releaseAction = () => {
    if (action === "attack") {
      clearAction();
      return;
    }
    clearAction();
    queueHudSkillArm(action as HudSkillAction);
  };
  const pressAction = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 || !active) {
      return;
    }
    tryPointerCapture(event.currentTarget, event.pointerId);
    setHudAction(action, true);
  };

  return (
    <button
      type="button"
      className={["skill-button", `action-${action}`, cooling ? "cooling" : "", readyPulse ? "is-ready" : "", isArmed ? "is-armed" : "", disabled ? "disabled" : ""].filter(Boolean).join(" ")}
      data-action={action}
      data-skill-id={catalogSkillId ?? undefined}
      aria-label={`${title} (${keyLabel})`}
      aria-pressed={action === "attack" ? undefined : isArmed}
      disabled={!active}
      onPointerDown={pressAction}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (event.button !== 0) {
          cancelAction();
          return;
        }
        releaseAction();
      }}
      onPointerCancel={cancelAction}
      onPointerLeave={action === "attack" ? cancelAction : undefined}
      onBlur={cancelAction}
      onContextMenu={(event) => event.preventDefault()}
    >
      {catalogSkillId ? (
        <ArenaCatalogSkillIcon skillId={catalogSkillId} className="skill-icon" />
      ) : (
        <i
          className="skill-icon"
          style={getArenaSkillIconStyle(classId, slot)}
        />
      )}
      <span>{title}</span>
      <strong>{keyLabel}</strong>
      {cooling ? (
        <em style={cooldownStyle}>
          <b>{Math.ceil(remaining / 1000)}</b>
        </em>
      ) : null}
      <div className="skill-tooltip" aria-hidden="true">
        <b>{title}</b>
        <p>{tooltip.description}</p>
        <small>{tooltip.facts.join(" / ")}</small>
      </div>
    </button>
  );
}

function useCooldownFill(endAt: number, now: number) {
  const cycleRef = useRef({ endAt: 0, durationMs: 1 });
  if (endAt > now && endAt !== cycleRef.current.endAt) {
    cycleRef.current = {
      endAt,
      durationMs: Math.max(1, endAt - now)
    };
  }
  const remaining = Math.max(0, endAt - now);
  return remaining > 0
    ? 1 - Math.max(0, Math.min(1, remaining / cycleRef.current.durationMs))
    : 1;
}

function useSkillReadyPulse(cooling: boolean, disabled: boolean) {
  const wasCooling = useRef(cooling);
  const [readyPulse, setReadyPulse] = useState(false);

  useEffect(() => {
    const becameReady = wasCooling.current && !cooling && !disabled;
    wasCooling.current = cooling;
    if (!becameReady) {
      return undefined;
    }
    setReadyPulse(true);
    const timeout = window.setTimeout(() => setReadyPulse(false), 620);
    return () => window.clearTimeout(timeout);
  }, [cooling, disabled]);

  return readyPulse;
}

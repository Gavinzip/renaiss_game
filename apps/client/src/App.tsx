import { ArrowClockwise, GearSix, MapTrifold, PencilSimple, Question, Sparkle, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import {
  ARENA_LOADOUT_SLOTS,
  CLASS_META,
  CLASS_ORDER,
  CLASS_STATS,
  getEffectiveBasicAttackDamage,
  getArenaCatalogCoreSkill,
  getArenaCatalogSkill,
  getArenaCatalogSkillDetail,
  isArenaCatalogLoadoutCompatibleWithTurretKind,
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
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
import { MobileControlLayoutEditor } from "./components/MobileControlLayoutEditor";
import { MobileJoystick } from "./components/MobileJoystick";
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
import { warmArenaStartupAssetCache } from "./game/assets/arenaStartupAssets";
import { staticAssetUrl } from "./game/assets/staticAssets";
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
import {
  clampMobileArenaControlPosition,
  loadMobileArenaControlLayout,
  saveMobileArenaControlLayout,
  type MobileArenaControlId,
  type MobileArenaControlLayout,
  type MobileArenaControlPosition
} from "./state/mobileArenaControlLayout";
import { useRpgStore } from "./state/rpgStore";
import { RpgOverlay } from "./components/RpgOverlay";
import { RpgMobileControls } from "./components/RpgMobileControls";
import { useArenaSkillCollectionStore } from "./state/arenaSkillCollectionStore";
import { ArenaTutorialModal, useFirstRunTutorial } from "./components/RpgTutorial";
import { formatScore } from "./utils/formatScore";
import { ArenaI18nProvider, ARENA_LANGUAGES, useArenaI18n } from "./i18n/arena";
import { useOwnedPointerRelease } from "./hooks/useOwnedPointerRelease";
import { restartWebAppForAssetRecovery } from "./runtime/webAppVersion";

const LANGUAGE_SELECTION_STORAGE_KEY = "renaiss:first-language-selected:v2";
const ENTRY_LANGUAGE_OPTIONS = ARENA_LANGUAGES;
type ArenaSetupView = "arena" | "skills";

export function App() {
  const appParams = new URLSearchParams(window.location.search);
  const arenaStatusReviewMode = appParams.get("statusReview") === "1";

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
  const serverCatalogLoadouts = useArenaSkillCollectionStore((state) => state.catalogLoadouts);
  const loadSkillCollection = useArenaSkillCollectionStore((state) => state.loadForOwner);
  const hydrateCatalogLoadouts = useHudStore((state) => state.hydrateCatalogLoadouts);
  const [arenaSetupView, setArenaSetupView] = useState<ArenaSetupView>("arena");

  useEffect(() => {
    void loadSkillCollection(`${authUser.provider}:${authUser.id}`);
  }, [authUser.id, authUser.provider, loadSkillCollection]);

  useEffect(() => {
    if (collectionStatus === "ready") {
      hydrateCatalogLoadouts(serverCatalogLoadouts, unlockedSkillIds);
    }
  }, [collectionStatus, hydrateCatalogLoadouts, serverCatalogLoadouts, unlockedSkillIds]);

  useEffect(() => {
    if (editorMode || arenaMode || arenaStatusReviewMode) return;
    // Start the complete Arena download as soon as the authenticated lobby is
    // available. The Arena scene still performs the authoritative readiness
    // check before joining, but normally reads these responses from cache.
    void warmArenaStartupAssetCache().catch((error) => {
      console.error("Arena lobby asset warmup failed", error);
    });
  }, [arenaMode, arenaStatusReviewMode, editorMode]);

  useEffect(() => {
    if (
      editorMode ||
      !arenaMode ||
      arenaStatusReviewMode ||
      arenaRuntime === "unity" ||
      arenaSetupView === "skills"
    ) {
      return undefined;
    }
    const game = createGame("game-root");
    return () => {
      game.destroy(true);
    };
  }, [arenaMode, arenaRuntime, arenaSetupView, arenaStatusReviewMode, editorMode]);

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
      {arenaSetupView === "arena" ? <div id="game-root" className="game-root" /> : null}
      {mapPreviewMode ? (
        <div className="map-preview-banner">
          Map draft gameplay preview
          <span>{mapPreviewDraftCount ? `${mapPreviewDraftCount} props` : "no saved draft"}</span>
        </div>
      ) : null}
      {arenaSetupView === "arena" ? <HudOverlay /> : null}
      <StartPanel
        authUser={authUser}
        setupView={arenaSetupView}
        onSetupViewChange={setArenaSetupView}
      />
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
      {rpgReady ? (
        <>
          <RpgOverlay />
          <RpgMobileControls />
        </>
      ) : <RpgLoadingGate />}
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

function StartPanel({
  authUser,
  setupView,
  onSetupViewChange
}: {
  authUser: XAuthUser;
  setupView: ArenaSetupView;
  onSetupViewChange: (view: ArenaSetupView) => void;
}) {
  const { language, setLanguage, t } = useArenaI18n();
  const joined = useHudStore((state) => state.joined);
  const connection = useHudStore((state) => state.connection);
  const arenaAssets = useHudStore((state) => state.arenaAssets);
  const selectedClass = useHudStore((state) => state.selectedClass);
  const selectedMode = useHudStore((state) => state.selectedMode);
  const engineerTurretKind = useHudStore((state) => state.engineerTurretKind);
  const arenaCatalogLoadouts = useHudStore((state) => state.arenaCatalogLoadouts);
  const catalogLoadoutSyncPending = useHudStore((state) => state.catalogLoadoutSyncPending);
  const catalogLoadoutSyncError = useHudStore((state) => state.catalogLoadoutSyncError);
  const collectionStatus = useArenaSkillCollectionStore((state) => state.status);
  const unlockedSkillIds = useArenaSkillCollectionStore((state) => state.unlockedSkillIds);
  const setSelectedClass = useHudStore((state) => state.setSelectedClass);
  const setSelectedMode = useHudStore((state) => state.setSelectedMode);
  const requestJoin = useHudStore((state) => state.requestJoin);
  const requestArenaAssetRetry = useHudStore((state) => state.requestArenaAssetRetry);
  const [name, setName] = useState(xPlayerName(authUser));
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
    isArenaCatalogLoadoutCompatibleWithTurretKind(
      classId,
      catalogLoadout,
      engineerTurretKind
    ) &&
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
    const latestHudState = useHudStore.getState();
    if (
      arenaAssets.status !== "ready" ||
      latestHudState.catalogLoadoutSyncPending > 0 ||
      latestHudState.catalogLoadoutSyncError
    ) {
      return;
    }
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
        onClose={() => onSetupViewChange("arena")}
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
          onSetupViewChange("skills");
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
          data-arena-assets-progress={`${arenaAssets.loaded}/${arenaAssets.total}`}
          disabled={arenaAssets.status !== "error" && catalogLoadoutComplete && (
            arenaAssets.status !== "ready" ||
            catalogLoadoutSyncPending > 0 ||
            Boolean(catalogLoadoutSyncError) ||
            connection === "connecting" ||
            connection === "preparing" ||
            connection === "reconnecting"
          )}
          onClick={arenaAssets.status === "error" ? () => {
            requestArenaAssetRetry();
            playGameUiSound("forward");
          } : catalogLoadoutComplete ? enterArena : () => {
              onSetupViewChange("skills");
              playGameUiSound("open");
            }}
        >
          {arenaAssets.status === "error"
            ? t.ui.assetPreparationRetry
            : !catalogLoadoutComplete
            ? t.ui.equipBeforeEntry
            : catalogLoadoutSyncPending > 0
              ? language === "zh" ? "保存技能配置中" : language === "ko" ? "스킬 설정 저장 중" : "Saving skill loadout"
              : catalogLoadoutSyncError
                ? language === "zh" ? "技能配置保存失敗" : language === "ko" ? "스킬 설정 저장 실패" : "Loadout save failed"
            : arenaAssets.status === "loading"
              ? t.ui.preparingAllSkills(arenaAssets.loaded, arenaAssets.total)
              : arenaAssets.status === "idle"
                ? t.ui.preparingAssets
                : connection === "preparing"
                  ? t.ui.preparingAssets
                  : connection === "reconnecting"
                    ? t.ui.reconnecting
                    : connection === "connecting"
                      ? t.ui.connecting
                      : t.ui.enterArena}
        </button>
        <div className="arena-start-secondary-actions">
          {arenaAssets.status === "error" ? (
            <button className="arena-skill-forge-link" type="button" onClick={() => {
              playGameUiSound("forward");
              void restartWebAppForAssetRecovery();
            }}>
              <ArrowClockwise size={17} weight="bold" />
              <span>{t.ui.assetPreparationRestart}</span>
            </button>
          ) : (
            <button className="arena-skill-forge-link" type="button" onClick={openSkillForge}>
              <Sparkle size={17} weight="fill" />
              <span>{language === "zh" ? "大廳抽技能" : language === "ko" ? "로비 스킬 뽑기" : "Lobby skill draw"}</span>
            </button>
          )}
          <button className="arena-tutorial-button" type="button" onClick={() => {
            arenaTutorial.openTutorial();
            playGameUiSound("open");
          }}>
            <Question size={17} weight="bold" />
            <span>{t.ui.tutorial}</span>
          </button>
        </div>
        {connection === "error" ? <p className="connection-error">{t.ui.connectionError}</p> : null}
        {catalogLoadoutSyncError ? (
          <p className="connection-error">{catalogLoadoutSyncError}</p>
        ) : null}
        {arenaAssets.status === "error" ? (
          <p className="connection-error">{t.ui.assetPreparationError}</p>
        ) : null}
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
  const touchLayout = window.matchMedia(
    "(orientation: landscape) and (any-pointer: coarse) and (max-height: 620px)"
  ).matches;
  const snapshot = useHudStore((state) => state.snapshot);
  const selfId = useHudStore((state) => state.selfId);
  const connection = useHudStore((state) => state.connection);
  const joined = useHudStore((state) => state.joined);
  const selectedClass = useHudStore((state) => state.selectedClass);
  const arenaLoadouts = useHudStore((state) => state.arenaLoadouts);
  const arenaCatalogLoadouts = useHudStore((state) => state.arenaCatalogLoadouts);
  const engineerTurretKind = useHudStore((state) => state.engineerTurretKind);
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
  const [mobileControlLayout, setMobileControlLayout] = useState(loadMobileArenaControlLayout);
  const [mobileControlLayoutDraft, setMobileControlLayoutDraft] = useState<MobileArenaControlLayout>({});
  const [mobileControlLayoutEditing, setMobileControlLayoutEditing] = useState(false);
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
  const beginMobileControlLayoutEdit = () => {
    setMobileControlLayoutDraft({ ...mobileControlLayout });
    setMobileControlLayoutEditing(true);
    setActiveDrawer(null);
    playGameUiSound("open");
  };
  const cancelMobileControlLayoutEdit = () => {
    setMobileControlLayoutDraft({});
    setMobileControlLayoutEditing(false);
  };
  const resetMobileControlLayoutDraft = () => {
    setMobileControlLayoutDraft({});
  };
  const saveMobileControlLayoutDraft = () => {
    const nextLayout = { ...mobileControlLayoutDraft };
    setMobileControlLayout(nextLayout);
    saveMobileArenaControlLayout(nextLayout);
    setMobileControlLayoutEditing(false);
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
          showMobileControlLayout={touchLayout}
          onEditMobileControlLayout={beginMobileControlLayoutEdit}
          onExitArena={exitArena}
        />
      ) : null}

      {mobileControlLayoutEditing ? (
        <MobileControlLayoutEditor
          onCancel={cancelMobileControlLayoutEdit}
          onReset={resetMobileControlLayoutDraft}
          onSave={saveMobileControlLayoutDraft}
        />
      ) : null}

      {!touchLayout && !activeDrawer ? (
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
      {joined && snapshot && displayPrefs.combatPopups && !touchLayout ? <CombatToast snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot && displayPrefs.combatPopups ? <ArenaKillFeed snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot && !touchLayout ? <RoundRewards round={snapshot.round} /> : null}
      {joined && snapshot && !touchLayout && displayPrefs.minimap && activeDrawer !== "map" ? <Minimap snapshot={snapshot} selfId={selfId} /> : null}
      {joined && snapshot ? <SelfStatusOverlay player={self} /> : null}
      {joined && snapshot?.round.phase === "finished" ? <RoundResultOverlay round={snapshot.round} serverTime={snapshot.serverTime} leaderboard={snapshot.leaderboard} selfId={selfId} /> : null}
      {joined && snapshot && snapshot.round.phase !== "finished" && self && !self.alive ? <DeathOverlay player={self} serverTime={snapshot.serverTime} /> : null}

      {!touchLayout && joined && snapshot?.round.mode === "team_3v3" ? (
        <TeamStatusPanel snapshot={snapshot} selfId={selfId} />
      ) : !touchLayout && joined ? (
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

      {joined && !touchLayout ? (
        <div className={`combat-skill-dock ${displayClass === "engineer" ? "has-engineer-core" : ""}`}>
          {displayClass === "engineer" ? (
            <section className="engineer-turret-selector is-locked" aria-label={t.ui.turretType}>
              <span>{t.ui.turretType}</span>
              <strong>
                {engineerTurretKind === "mechanical"
                  ? t.ui.mechanicalTurret
                  : t.ui.magicTurret}
              </strong>
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
          editingLayout={mobileControlLayoutEditing}
          controlLayout={mobileControlLayoutEditing ? mobileControlLayoutDraft : mobileControlLayout}
          onControlLayoutChange={setMobileControlLayoutDraft}
        />
      ) : null}
      {joined && !touchLayout ? <ArenaControlHint classId={displayClass} /> : null}
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

interface MobileArenaControlsProps {
  classId: ClassId;
  loadout: ArenaLoadout;
  catalogLoadout: ArenaCatalogLoadout;
  skillLabels: Record<SkillKey, string>;
  actionTooltips: Record<HudAction, ActionTooltip>;
  skillCooldowns: Record<HudSkillAction, number> | null;
  disabled: boolean;
  editingLayout: boolean;
  controlLayout: MobileArenaControlLayout;
  onControlLayoutChange: (layout: MobileArenaControlLayout) => void;
}

const MobileArenaControls = memo(function MobileArenaControls({
  classId,
  loadout,
  catalogLoadout,
  skillLabels,
  actionTooltips,
  skillCooldowns,
  disabled,
  editingLayout,
  controlLayout,
  onControlLayoutChange
}: MobileArenaControlsProps) {
  const { t } = useArenaI18n();
  const setMobileMove = useHudStore((state) => state.setMobileMove);
  const resetMobileMove = useHudStore((state) => state.resetMobileMove);
  const resetMobileAim = useHudStore((state) => state.resetMobileAim);
  const setHudAction = useHudStore((state) => state.setHudAction);
  const setMobileControlsActive = useHudStore((state) => state.setMobileControlsActive);
  const cancelZoneRef = useRef<HTMLDivElement | null>(null);
  const controlLayoutDragRef = useRef<{
    pointerId: number;
    controlId: MobileArenaControlId;
    grabOffsetX: number;
    grabOffsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const [aimGesture, setAimGesture] = useState<{
    action: HudSkillAction;
    cancelling: boolean;
  } | null>(null);
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
    if (!disabled && !editingLayout) {
      return;
    }
    resetMobileMove();
    resetMobileAim();
    setHudAction("attack", false);
    setAimGesture(null);
  }, [disabled, editingLayout, resetMobileAim, resetMobileMove, setHudAction]);

  const updateControlLayoutDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = controlLayoutDragRef.current;
    if (!editingLayout || !drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const position = clampMobileArenaControlPosition(
      event.clientX - drag.grabOffsetX,
      event.clientY - drag.grabOffsetY,
      { width: window.innerWidth, height: window.innerHeight },
      { width: drag.width, height: drag.height }
    );
    onControlLayoutChange({ ...controlLayout, [drag.controlId]: position });
  };

  const beginControlLayoutDrag = (
    controlId: MobileArenaControlId,
    event: PointerEvent<HTMLElement>
  ) => {
    if (!editingLayout) return;
    event.preventDefault();
    event.stopPropagation();
    tryPointerCapture(event.currentTarget, event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    controlLayoutDragRef.current = {
      pointerId: event.pointerId,
      controlId,
      grabOffsetX: event.clientX - (bounds.left + bounds.width / 2),
      grabOffsetY: event.clientY - (bounds.top + bounds.height / 2),
      width: bounds.width,
      height: bounds.height
    };
    updateControlLayoutDrag(event);
  };

  const endControlLayoutDrag = (event: PointerEvent<HTMLElement>) => {
    if (controlLayoutDragRef.current?.pointerId !== event.pointerId) return;
    updateControlLayoutDrag(event);
    controlLayoutDragRef.current = null;
  };

  const controlPositionProps = (controlId: MobileArenaControlId) => {
    const position = controlLayout[controlId];
    return {
      controlId,
      customPosition: position,
      editMode: editingLayout,
      onEditPointerDown: (event: PointerEvent<HTMLElement>) => beginControlLayoutDrag(controlId, event),
      onEditPointerMove: updateControlLayoutDrag,
      onEditPointerUp: endControlLayoutDrag
    };
  };

  const isPointInCancelZone = (clientX: number, clientY: number) => {
    const bounds = cancelZoneRef.current?.getBoundingClientRect();
    return Boolean(
      bounds &&
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    );
  };

  return (
    <section
      className={editingLayout ? "mobile-arena-controls is-layout-editing" : "mobile-arena-controls"}
      aria-label="Mobile arena controls"
    >
      <MobileJoystick
        ariaLabel="Movement joystick"
        disabled={disabled}
        onEngage={() => setMobileControlsActive(true)}
        onMove={setMobileMove}
        {...controlPositionProps("joystick")}
      />

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
            isPointInCancelZone={isPointInCancelZone}
            onAimGestureChange={setAimGesture}
            {...controlPositionProps("skillF")}
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
              isPointInCancelZone={isPointInCancelZone}
              onAimGestureChange={setAimGesture}
              {...controlPositionProps(loadoutSlot)}
            />
          );
        })}
        <MobileSkillButton
          classId={classId}
          slot="attack"
          action="attack"
          actionClass="attack"
          keyLabel="ATK"
          title={t.ui.attack}
          tooltip={actionTooltips.attack}
          endAt={0}
          disabled={disabled}
          isPointInCancelZone={isPointInCancelZone}
          onAimGestureChange={setAimGesture}
          {...controlPositionProps("attack")}
        />
      </div>
      <div
        ref={cancelZoneRef}
        className={[
          "mobile-cast-cancel-zone",
          aimGesture ? "is-visible" : "",
          aimGesture?.cancelling ? "is-hovered" : ""
        ].filter(Boolean).join(" ")}
        data-mobile-cancel-zone
        aria-hidden={!aimGesture}
      >
        <span aria-hidden="true">×</span>
        <strong>{t.ui.cancelCast}</strong>
      </div>
    </section>
  );
}, areMobileArenaControlPropsEqual);

function areMobileArenaControlPropsEqual(
  previous: MobileArenaControlsProps,
  next: MobileArenaControlsProps
) {
  if (
    previous.classId !== next.classId ||
    previous.disabled !== next.disabled ||
    previous.editingLayout !== next.editingLayout ||
    previous.controlLayout !== next.controlLayout ||
    previous.skillLabels !== next.skillLabels ||
    previous.actionTooltips !== next.actionTooltips
  ) {
    return false;
  }

  for (const slot of ARENA_LOADOUT_SLOTS) {
    if (
      previous.loadout[slot] !== next.loadout[slot] ||
      previous.catalogLoadout[slot] !== next.catalogLoadout[slot]
    ) {
      return false;
    }
  }

  for (const action of ["skillF", "skillQ", "skillE", "skillR"] as const) {
    if ((previous.skillCooldowns?.[action] ?? 0) !== (next.skillCooldowns?.[action] ?? 0)) {
      return false;
    }
  }

  return true;
}

function getMobileArenaControlPositionStyle(position?: MobileArenaControlPosition) {
  if (!position) return undefined;
  return {
    "--mobile-control-x": `${position.x * 100}vw`,
    "--mobile-control-y": `${position.y * 100}dvh`
  } as CSSProperties;
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
  disabled = false,
  isPointInCancelZone,
  onAimGestureChange,
  controlId,
  customPosition,
  editMode,
  onEditPointerDown,
  onEditPointerMove,
  onEditPointerUp
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
  isPointInCancelZone: (clientX: number, clientY: number) => boolean;
  onAimGestureChange: (
    state: { action: HudSkillAction; cancelling: boolean } | null
  ) => void;
  controlId: MobileArenaControlId;
  customPosition?: MobileArenaControlPosition;
  editMode: boolean;
  onEditPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onEditPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onEditPointerUp: (event: PointerEvent<HTMLElement>) => void;
}) {
  const now = useHudStore((state) => state.snapshot?.serverTime ?? 0);
  const setHudAction = useHudStore((state) => state.setHudAction);
  const armedSkillAction = useHudStore((state) => state.armedSkillAction);
  const queueMobileSkillGesture = useHudStore((state) => state.queueMobileSkillGesture);
  const queueMobileAttack = useHudStore((state) => state.queueMobileAttack);
  const setMobileAim = useHudStore((state) => state.setMobileAim);
  const resetMobileAim = useHudStore((state) => state.resetMobileAim);
  const setMobileControlsActive = useHudStore((state) => state.setMobileControlsActive);
  const pointerIdRef = useRef<number | null>(null);
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const remaining = Math.max(0, endAt - now);
  const active = remaining <= 0 && !disabled;
  const cooling = remaining > 0;
  const cooldownFill = useCooldownFill(endAt, now);
  const cooldownStyle = { "--cooldown-fill": `${cooldownFill * 100}%` } as CSSProperties;
  const readyPulse = useSkillReadyPulse(cooling, disabled);
  const isSkill = action !== "attack";
  const isArmed = isSkill && armedSkillAction === action;

  const updateAim = (event: PointerEvent<HTMLButtonElement>) => {
    const dragX = event.clientX - dragOriginRef.current.x;
    const dragY = event.clientY - dragOriginRef.current.y;
    setMobileAim(action, dragX, dragY);
    const cancelling = isSkill && isPointInCancelZone(event.clientX, event.clientY);
    if (isSkill) {
      onAimGestureChange({ action: action as HudSkillAction, cancelling });
    }
    return cancelling;
  };

  const cancelAction = (event?: PointerEvent<HTMLButtonElement>) => {
    if (editMode) {
      if (event) onEditPointerUp(event);
      return;
    }
    if (event && pointerIdRef.current !== event.pointerId) {
      return;
    }
    setHudAction(action, false);
    pointerIdRef.current = null;
    if (isSkill) {
      queueMobileSkillGesture({ action: action as HudSkillAction, phase: "cancel" });
      resetMobileAim();
      onAimGestureChange(null);
    } else {
      resetMobileAim();
    }
  };

  const pressAction = (event: PointerEvent<HTMLButtonElement>) => {
    if (editMode) {
      onEditPointerDown(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 || !active) {
      return;
    }
    tryPointerCapture(event.currentTarget, event.pointerId);
    pointerIdRef.current = event.pointerId;
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
    setMobileControlsActive(true);
    if (isSkill) {
      queueMobileSkillGesture({ action: action as HudSkillAction, phase: "begin" });
      onAimGestureChange({ action: action as HudSkillAction, cancelling: false });
    } else if (classId === "archer") {
      setHudAction("attack", true);
    }
    updateAim(event);
  };

  const moveAction = (event: PointerEvent<HTMLButtonElement>) => {
    if (editMode) {
      onEditPointerMove(event);
      return;
    }
    if (pointerIdRef.current !== event.pointerId || disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    updateAim(event);
  };

  const releaseAction = (event: PointerEvent<HTMLButtonElement>) => {
    if (editMode) {
      onEditPointerUp(event);
      return;
    }
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setHudAction(action, false);
    pointerIdRef.current = null;
    if (isSkill) {
      const cancelling = updateAim(event);
      queueMobileSkillGesture({
        action: action as HudSkillAction,
        phase: cancelling ? "cancel" : "commit"
      });
      if (cancelling) {
        resetMobileAim();
      }
      onAimGestureChange(null);
    } else {
      updateAim(event);
      if (classId !== "archer") {
        queueMobileAttack();
      }
    }
  };

  useOwnedPointerRelease(pointerIdRef, {
    onPointerUp: (event) => {
      setHudAction("attack", false);
      pointerIdRef.current = null;
      setMobileAim(
        "attack",
        event.clientX - dragOriginRef.current.x,
        event.clientY - dragOriginRef.current.y
      );
      // A fast Archer tap can begin and end between two 30 Hz input packets.
      // Queue one final attack packet so the server always observes a press,
      // then releases the charge on the following packet.
      queueMobileAttack();
    },
    onPointerCancel: () => {
      setHudAction("attack", false);
      pointerIdRef.current = null;
      resetMobileAim();
    }
  }, classId === "archer" && action === "attack");

  return (
    <button
      type="button"
      className={["mobile-action-button", actionClass, cooling ? "cooling" : "", readyPulse ? "is-ready" : "", isArmed ? "is-armed" : "", disabled ? "disabled" : "", editMode ? "is-layout-editing" : ""].filter(Boolean).join(" ")}
      data-action={action}
      data-mobile-control-id={controlId}
      data-mobile-control-position={customPosition ? "custom" : "default"}
      data-skill-id={catalogSkillId ?? undefined}
      aria-label={`${title} (${keyLabel}) - ${tooltip.description}`}
      aria-pressed={isSkill ? isArmed : undefined}
      disabled={!editMode && !active}
      style={getMobileArenaControlPositionStyle(customPosition)}
      onPointerDown={pressAction}
      onPointerMove={moveAction}
      onPointerUp={releaseAction}
      onPointerCancel={cancelAction}
      onLostPointerCapture={classId === "archer" && action === "attack" ? cancelAction : undefined}
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

import { ArrowClockwise, Cards, FlagBanner, Gear, HouseLine, Question, Robot, Sparkle, Storefront, Sword, UsersThree, X } from "@phosphor-icons/react";
import {
  RPG_ELEMENTS,
  RPG_ELEMENT_META,
  RPG_AI_DIFFICULTIES,
  RPG_AI_DIFFICULTY_CONFIGS,
  RPG_SKILL_TICKETS,
  RPG_STARTER_PETS,
  getRpgBattleEnergyForTurn,
  getRpgCurrentTurnActor,
  getRpgMoveById,
  getRpgReachableEnemyTargets,
  assignRpgWalletCardElements,
  getRpgWalletCardElement,
  getStarterPetById,
  type RpgAiDifficulty,
  type RpgBattlePetState,
  type RpgBattleState,
  type RpgElement,
  type RpgMove,
  type RpgSkillTicket
} from "@renaiss-game/shared";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import { ClassPortrait } from "./ClassPortrait";
import { RpgBattleVfx, buildBattleReplaySequence, floatingEntriesForPet, type RpgBattleFloatingEntry, type RpgBattleReplay } from "./RpgBattleVfx";
import { RpgPetSprite } from "./RpgPetSprite";
import { RpgPixelCardImage } from "./RpgPixelCardImage";
import { RpgSkillVfxSprite } from "./RpgSkillVfxSprite";
import { BattleStatusEffects } from "./RpgStatusEffects";
import { GymTutorialModal, useFirstRunTutorial } from "./RpgTutorial";
import { RpgOnboardingGuide } from "./RpgOnboardingGuide";
import { RPG_DEFAULT_WALLET_ADDRESS, type RpgWalletCard } from "../api/rpgWalletCards";
import { staticAssetUrl } from "../game/assets/staticAssets";
import { RPG_MAX_EQUIPPED_MOVES, useRpgStore, type RpgDrawHistoryEntry, type RpgVersusConnection, type RpgVersusRoomStatus } from "../state/rpgStore";
import { ARENA_LANGUAGES, useArenaI18n } from "../i18n/arena";
import {
  RPG_TEXT,
  rpgAiDifficultyCopy,
  rpgBattleTargetLabel,
  rpgCopy,
  rpgElementLabel,
  rpgMoveAnimationName,
  rpgMoveDescription,
  rpgMoveEffectLabels,
  rpgMoveName,
  rpgPetName,
  rpgStatusShortLabel,
  rpgTargetLabel,
  rpgTicketCopy,
  rpgTierLabel,
  rpgTierRangeLabel,
  rpgTierShortLabel
} from "../i18n/rpg";

const ELEMENT_ORDER = RPG_ELEMENTS;
const RPG_LANGUAGE_OPTIONS = ARENA_LANGUAGES;
const WALLET_TIER_ORDER = ["high", "middle", "low"] as const;
const SKILL_OPENING_VIDEO_BY_ELEMENT: Partial<Record<RpgElement, string>> = {
  water: staticAssetUrl("/assets/skill-openings/water.mp4"),
  fire: staticAssetUrl("/assets/skill-openings/fire.mp4"),
  grass: staticAssetUrl("/assets/skill-openings/grass.mp4"),
  dark: staticAssetUrl("/assets/skill-openings/dark.mp4"),
  light: staticAssetUrl("/assets/skill-openings/light.mp4")
};

type CardRevealState = {
  cardId: string;
  phase: "intro" | "reveal";
  entry: RpgDrawHistoryEntry;
};
type WalletTier = "all" | (typeof WALLET_TIER_ORDER)[number];

function replayStepDuration(replay: RpgBattleReplay) {
  return Math.max(1660, Math.min(2260, replay.move.animation.frameCount * 118 + 420));
}

type BattleActionMotion = "idle" | "melee" | "ranged" | "cast" | "support";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function actionMotionForMove(move: RpgMove): BattleActionMotion {
  if (move.target === "self" || move.target === "singleAlly" || move.target === "allAllies" || move.power <= 0) return "support";
  if (move.animation.style === "strike") return "melee";
  if (move.animation.style === "projectile" || move.animation.style === "beam" || move.animation.style === "rain" || move.animation.style === "wave") return "ranged";
  return "cast";
}

function attackMotionStyle(replay: RpgBattleReplay | null, petId: string): CSSProperties {
  if (!replay || replay.actorId !== petId || actionMotionForMove(replay.move) !== "melee") return {};
  const targetPoint = replay.targetPoints.find((point) => point.id !== petId) ?? replay.targetPoints[0];
  if (!targetPoint) return {};
  const lungeX = clampNumber((targetPoint.x - replay.actorPoint.x) * 7.6, -350, 350);
  const lungeY = clampNumber((targetPoint.y - replay.actorPoint.y) * 3.2, -120, 120);
  return {
    "--attack-lunge-x": `${lungeX}px`,
    "--attack-lunge-y": `${lungeY}px`
  } as CSSProperties;
}

export function RpgOverlay() {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].profile;
  const screen = useRpgStore((state) => state.screen);
  const activeLocation = useRpgStore((state) => state.activeLocation);
  const nearPlace = useRpgStore((state) => state.nearPlace);
  const playerName = useRpgStore((state) => state.playerName);
  const openProfile = useRpgStore((state) => state.openProfile);
  const openBag = useRpgStore((state) => state.openBag);
  const openGym = useRpgStore((state) => state.openGym);
  const openArena = useRpgStore((state) => state.openArena);
  const closePanel = useRpgStore((state) => state.closePanel);
  const exitHouse = useRpgStore((state) => state.exitHouse);
  const inBattle = screen === "battle";
  const returnHome = activeLocation === "house" ? exitHouse : closePanel;
  const openNearPlace = () => {
    if (nearPlace === "shop" || nearPlace === "cabinet") openBag();
    if (nearPlace === "gym") openGym();
    if (nearPlace === "arena") openArena();
    if (nearPlace === "house") useRpgStore.getState().enterHouse();
    if (nearPlace === "houseExit") exitHouse();
  };

  return (
    <div className="rpg-layer" aria-label={copy.interfaceLabel}>
      {!inBattle ? (
        <>
          <button type="button" className={["rpg-profile-button", screen === "profile" ? "is-active" : ""].filter(Boolean).join(" ")} title={copy.profileButton} aria-label={copy.profileButton} onClick={screen === "profile" ? closePanel : openProfile}>
            <ClassPortrait classId="engineer" frame={0} />
            <span className="rpg-profile-button-copy">
              <strong>{playerName}</strong>
              <em>{copy.profileBadge}</em>
            </span>
          </button>

          <nav className="rpg-top-nav" aria-label={copy.navLabel}>
            <button type="button" title={copy.village} aria-label={copy.village} onClick={returnHome}>
              <HouseLine size={24} weight="fill" />
            </button>
            <button type="button" className={screen === "bag" ? "is-active" : ""} title={copy.cards} aria-label={copy.cards} onClick={openBag}>
              <Cards size={24} weight="fill" />
            </button>
            <button type="button" className={screen === "gym" ? "is-active" : ""} title={copy.gym} aria-label={copy.gym} data-rpg-guide-target="gym-nav" onClick={openGym}>
              <FlagBanner size={24} weight="fill" />
            </button>
            <button type="button" title={copy.arena} aria-label={copy.arena} data-rpg-guide-target="arena-nav" onClick={openArena}>
              <Sword size={24} weight="fill" />
            </button>
          </nav>
        </>
      ) : null}

      {nearPlace && screen === "village" ? (
        <button className="rpg-interact-prompt" type="button" onClick={openNearPlace}>
          {nearPlace === "shop" ? <Storefront size={18} weight="fill" /> : nearPlace === "gym" ? <FlagBanner size={18} weight="fill" /> : nearPlace === "house" ? <HouseLine size={18} weight="fill" /> : <Sword size={18} weight="fill" />}
          <span>{nearPlace === "shop" ? copy.cardBag : nearPlace === "gym" ? copy.gym : nearPlace === "house" ? copy.house : copy.arena}</span>
          <kbd>E</kbd>
        </button>
      ) : null}

      {nearPlace && screen === "house" ? (
        <button className="rpg-interact-prompt" type="button" onClick={openNearPlace}>
          {nearPlace === "cabinet" ? <Cards size={18} weight="fill" /> : <HouseLine size={18} weight="fill" />}
          <span>{nearPlace === "cabinet" ? copy.cardCabinet : copy.exitVillage}</span>
          <kbd>E</kbd>
        </button>
      ) : null}

      {screen === "profile" ? <ProfileHomePanel /> : null}
      {screen === "bag" || screen === "shop" ? <ProfilePanel /> : null}
      {screen === "gym" ? <GymPanel /> : null}
      {screen === "battle" ? <BattlePanel /> : null}
      <RpgOnboardingGuide />
    </div>
  );
}

function PanelCloseButton() {
  const closePanel = useRpgStore((state) => state.closePanel);
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].common;
  return (
    <button className="rpg-panel-close" type="button" title={copy.close} aria-label={copy.close} onClick={closePanel}>
      <X size={18} weight="bold" />
    </button>
  );
}

function ProfileHomePanel() {
  const playerName = useRpgStore((state) => state.playerName);
  const setPlayerName = useRpgStore((state) => state.setPlayerName);
  const walletAddress = useRpgStore((state) => state.walletAddress);
  const openBag = useRpgStore((state) => state.openBag);
  const openGym = useRpgStore((state) => state.openGym);
  const openArena = useRpgStore((state) => state.openArena);
  const { language, setLanguage } = useArenaI18n();
  const copy = RPG_TEXT[language].profile;

  return (
    <aside className="rpg-panel rpg-profile-home-panel" aria-label={copy.panelLabel}>
      <header>
        <Gear size={24} weight="fill" />
        <div>
          <strong>{copy.title}</strong>
          <span>{copy.subtitle}</span>
        </div>
        <PanelCloseButton />
      </header>

      <section className="rpg-profile-settings-card">
        <ClassPortrait classId="engineer" frame={0} />
        <div className="rpg-profile-settings-fields">
          <label>
            <span>{copy.playerName}</span>
            <input value={playerName} maxLength={18} onChange={(event) => setPlayerName(event.target.value)} />
          </label>
          <div className="rpg-profile-wallet-row">
            <span>{copy.wallet}</span>
            <strong>{shortWallet(walletAddress)}</strong>
            <em>{copy.demoData}</em>
          </div>
        </div>
      </section>

      <section className="rpg-profile-settings-section" aria-label={copy.settings}>
        <header>
          <strong>{copy.settings}</strong>
          <span>{copy.languageHint}</span>
        </header>
        <div className="rpg-profile-language-row">
          <span>{copy.language}</span>
          <div>
            {RPG_LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={language === option.id ? "is-active" : ""}
                aria-pressed={language === option.id}
                onClick={() => setLanguage(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rpg-profile-settings-section" aria-label={copy.entry}>
        <header>
          <strong>{copy.entry}</strong>
          <span>{copy.entryHint}</span>
        </header>
        <div className="rpg-profile-entry-grid">
          <button type="button" onClick={openBag}>
            <Cards size={24} weight="fill" />
            <strong>{copy.cabinet}</strong>
            <span>{copy.cabinetHint}</span>
          </button>
          <button type="button" onClick={openGym}>
            <FlagBanner size={24} weight="fill" />
            <strong>{copy.gym}</strong>
            <span>{copy.gymHint}</span>
          </button>
          <button type="button" onClick={openArena}>
            <Sword size={24} weight="fill" />
            <strong>{copy.arena}</strong>
            <span>{copy.arenaHint}</span>
          </button>
        </div>
      </section>
    </aside>
  );
}

function ElementFilter({ value, onChange }: { value: RpgElement | "any"; onChange: (value: RpgElement | "any") => void }) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].common;
  return (
    <div className="rpg-element-filter" role="list" aria-label={copy.all}>
      <button type="button" className={value === "any" ? "is-active" : ""} onClick={() => onChange("any")}>
        {copy.all}
      </button>
      {ELEMENT_ORDER.map((element) => (
        <button
          key={element}
          type="button"
          className={value === element ? "is-active" : ""}
          onClick={() => onChange(element)}
          style={{ "--element": RPG_ELEMENT_META[element].color } as CSSProperties}
        >
          {rpgElementLabel(element, language)}
        </button>
      ))}
    </div>
  );
}

function ShopPanel() {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].draw;
  const [element, setElement] = useState<RpgElement | "any">("any");
  const [activeDraw, setActiveDraw] = useState<RpgDrawHistoryEntry | null>(null);
  const drawSkill = useRpgStore((state) => state.drawSkill);
  const ticketInventory = useRpgStore((state) => state.ticketInventory);
  const drawHistory = useRpgStore((state) => state.drawHistory);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const preferredElement = element === "any" ? undefined : element;
  const currentDraw = activeDraw ?? drawHistory[0] ?? null;
  const handleDraw = (ticketId: string) => {
    const entry = drawSkill(ticketId, preferredElement);
    if (entry) setActiveDraw(entry);
  };

  return (
    <aside className="rpg-panel rpg-shop-panel" aria-label={RPG_TEXT[language].profile.cardBag}>
      <header>
        <Storefront size={24} weight="fill" />
        <div>
          <strong>{RPG_TEXT[language].profile.cardBag}</strong>
          <span>{copy.pool(preferredElement ? rpgElementLabel(preferredElement, language) : undefined)}</span>
        </div>
        <PanelCloseButton />
      </header>

      <ElementFilter value={element} onChange={setElement} />

      <DrawCeremony entry={currentDraw} preferredElement={preferredElement} />

      <div className="rpg-ticket-grid">
        {RPG_SKILL_TICKETS.map((ticket) => {
          const count = ticketInventory[ticket.id] ?? 0;
          const depleted = count <= 0;
          return (
            <button
              key={ticket.id}
              type="button"
              className={["rpg-ticket-card", `is-${ticket.cardPriceBand}`, depleted ? "is-depleted" : ""].filter(Boolean).join(" ")}
              data-ticket-id={ticket.id}
              data-ticket-count={count}
              disabled={depleted}
              onClick={() => handleDraw(ticket.id)}
            >
              <Cards size={22} weight="fill" />
              <span>{ticketBandLabel(ticket)}</span>
              <strong>{rpgTicketCopy(ticket, language).label}</strong>
              <em>{ticket.drawCount} DRAW / x{count}</em>
            </button>
          );
        })}
      </div>

      {battleNotice ? <p className="rpg-room-message rpg-shop-message">{battleNotice}</p> : null}

      <div className="rpg-draw-results" aria-live="polite">
        {drawHistory.length === 0 ? (
          <div className="rpg-empty-draw">
            <Sparkle size={20} weight="fill" />
            <span>{RPG_TEXT[language].cabinet.waitingForSkillCard}</span>
          </div>
        ) : (
          drawHistory.map((entry) => (
            <article key={entry.id} className="rpg-draw-entry">
              <header>
                <strong>{entry.ticketLabel}</strong>
                <span>{RPG_TEXT[language].cabinet.cardsCount(entry.moves.length)}</span>
              </header>
              <div>
                {entry.moves.map((move, index) => (
                  <SkillChip key={`${entry.id}-${move.id}-${index}`} move={move} />
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function ProfilePanel() {
  const { language } = useArenaI18n();
  const commonCopy = RPG_TEXT[language].common;
  const cabinetCopy = RPG_TEXT[language].cabinet;
  const [element, setElement] = useState<RpgElement | "any">("any");
  const walletAddress = useRpgStore((state) => state.walletAddress);
  const walletCards = useRpgStore((state) => state.walletCards);
  const walletCardsStatus = useRpgStore((state) => state.walletCardsStatus);
  const walletCardsError = useRpgStore((state) => state.walletCardsError);
  const walletCardsFetchedAt = useRpgStore((state) => state.walletCardsFetchedAt);
  const walletCardsStale = useRpgStore((state) => state.walletCardsStale);
  const walletCardsStaleReason = useRpgStore((state) => state.walletCardsStaleReason);
  const fetchWalletCards = useRpgStore((state) => state.fetchWalletCards);
  const cardSkillBindings = useRpgStore((state) => state.cardSkillBindings);
  const drawWalletCardSkill = useRpgStore((state) => state.drawWalletCardSkill);
  const openCardEquipForElement = useRpgStore((state) => state.openCardEquipForElement);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardReveal, setCardReveal] = useState<CardRevealState | null>(null);
  const [activeWalletTier, setActiveWalletTier] = useState<WalletTier>("all");
  const [bulkDrawProgress, setBulkDrawProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    void fetchWalletCards();
  }, [fetchWalletCards]);
  const ownedCards = useMemo(
    () =>
      walletCards
        .flatMap((card) => {
          const cardId = walletCardKey(card);
          const move = getRpgMoveById(cardSkillBindings[cardId]);
          return move ? [{ card, cardId, move }] : [];
        })
        .sort((a, b) => ELEMENT_ORDER.indexOf(a.move.element) - ELEMENT_ORDER.indexOf(b.move.element) || a.move.tierIndex - b.move.tierIndex || a.move.slot - b.move.slot || a.card.name.localeCompare(b.card.name)),
    [cardSkillBindings, walletCards]
  );
  const walletCardElements = useMemo(() => assignRpgWalletCardElements(walletCards), [walletCards]);
  const visibleCards = element === "any" ? ownedCards : ownedCards.filter(({ move }) => move.element === element);
  const visibleWalletCards = element === "any" ? walletCards : walletCards.filter((card) => walletCardElement(card, walletCardElements) === element);
  const unboundWalletCardCount = walletCards.reduce((count, card) => count + (cardSkillBindings[walletCardKey(card)] ? 0 : 1), 0);
  const unboundWalletCardCountByElement = Object.fromEntries(
    ELEMENT_ORDER.map((targetElement) => [
      targetElement,
      walletCards.reduce((count, card) => count + (!cardSkillBindings[walletCardKey(card)] && walletCardElement(card, walletCardElements) === targetElement ? 1 : 0), 0)
    ])
  ) as Record<RpgElement, number>;
  const sortWalletCards = (cards: RpgWalletCard[]) =>
    cards.slice().sort((a, b) => b.fmvUSD - a.fmvUSD || (a.pokemonName || a.name).localeCompare(b.pokemonName || b.name));
  const allWalletTierGroup = {
    tier: "all" as const,
    cards: sortWalletCards(visibleWalletCards),
    totalFMV: visibleWalletCards.reduce((sum, card) => sum + card.fmvUSD, 0)
  };
  const walletTierGroups = WALLET_TIER_ORDER.map((tier) => {
    const cards = visibleWalletCards
      .filter((card) => walletCardTier(card) === tier)
      .sort((a, b) => b.fmvUSD - a.fmvUSD || (a.pokemonName || a.name).localeCompare(b.pokemonName || b.name));
    return {
      tier,
      cards,
      totalFMV: cards.reduce((sum, card) => sum + card.fmvUSD, 0)
    };
  });
  const walletTierOptions = [allWalletTierGroup, ...walletTierGroups];
  const visibleWalletTierGroups = walletTierOptions.filter((group) => group.tier === "all" || group.cards.length > 0);
  const selectedWalletTier = visibleWalletTierGroups.some((group) => group.tier === activeWalletTier) ? activeWalletTier : "all";
  const selectedWalletTierGroup = walletTierOptions.find((group) => group.tier === selectedWalletTier) ?? allWalletTierGroup;
  const selectedWalletCard = selectedCardId ? walletCards.find((card) => walletCardKey(card) === selectedCardId) ?? null : null;
  const isExperienceWallet = walletAddress.toLowerCase() === RPG_DEFAULT_WALLET_ADDRESS;
  const walletSyncedLabel = walletCardsFetchedAt ? cabinetCopy.updatedAt(new Date(walletCardsFetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) : cabinetCopy.notSynced;
  const selectedElementDrawMeta = element === "any" ? null : RPG_ELEMENT_META[element];
  const selectedElementDrawLabel = element === "any" ? "" : rpgElementLabel(element, language);
  const selectedElementDrawCount = element === "any" ? 0 : unboundWalletCardCountByElement[element] ?? 0;
  const handleDrawSelectedCard = async () => {
    if (!selectedWalletCard) return;
    const cardId = walletCardKey(selectedWalletCard);
    const entry = await drawWalletCardSkill(cardId);
    if (!entry) return;
    const move = entry.moves[0];
    const hasOpeningVideo = Boolean(move && SKILL_OPENING_VIDEO_BY_ELEMENT[move.element]);
    setCardReveal({ cardId, entry, phase: hasOpeningVideo ? "intro" : "reveal" });
  };
  const handleDrawAllWalletCards = async () => {
    if (bulkDrawProgress || walletCardsStatus === "loading") return;
    const cardsToDraw = walletCards.filter((card) => !cardSkillBindings[walletCardKey(card)]);
    if (cardsToDraw.length === 0) return;
    setCardReveal(null);
    setSelectedCardId(walletCardKey(cardsToDraw[0]!));
    setBulkDrawProgress({ done: 0, total: cardsToDraw.length });
    let firstReveal: CardRevealState | null = null;
    for (let index = 0; index < cardsToDraw.length; index += 1) {
      const cardId = walletCardKey(cardsToDraw[index]!);
      const entry = await drawWalletCardSkill(cardId);
      const move = entry?.moves[0];
      if (!firstReveal && entry && move) {
        const hasOpeningVideo = Boolean(SKILL_OPENING_VIDEO_BY_ELEMENT[move.element]);
        firstReveal = { cardId, entry, phase: hasOpeningVideo ? "intro" : "reveal" };
      }
      setBulkDrawProgress({ done: index + 1, total: cardsToDraw.length });
    }
    if (firstReveal) {
      setSelectedCardId(firstReveal.cardId);
      setCardReveal(firstReveal);
    }
    window.setTimeout(() => setBulkDrawProgress(null), 650);
  };
  const handleDrawWalletCardsByElement = async (targetElement: RpgElement) => {
    if (bulkDrawProgress || walletCardsStatus === "loading") return;
    const cardsToDraw = walletCards.filter((card) => !cardSkillBindings[walletCardKey(card)] && walletCardElement(card, walletCardElements) === targetElement);
    if (cardsToDraw.length === 0) return;
    setCardReveal(null);
    setElement(targetElement);
    setSelectedCardId(walletCardKey(cardsToDraw[0]!));
    setBulkDrawProgress({ done: 0, total: cardsToDraw.length });
    let firstReveal: CardRevealState | null = null;
    for (let index = 0; index < cardsToDraw.length; index += 1) {
      const cardId = walletCardKey(cardsToDraw[index]!);
      const entry = await drawWalletCardSkill(cardId);
      const move = entry?.moves[0];
      if (!firstReveal && entry && move) {
        const hasOpeningVideo = Boolean(SKILL_OPENING_VIDEO_BY_ELEMENT[move.element]);
        firstReveal = { cardId, entry, phase: hasOpeningVideo ? "intro" : "reveal" };
      }
      setBulkDrawProgress({ done: index + 1, total: cardsToDraw.length });
    }
    if (firstReveal) {
      setSelectedCardId(firstReveal.cardId);
      setCardReveal(firstReveal);
      const move = firstReveal.entry.moves[0];
      if (move && SKILL_OPENING_VIDEO_BY_ELEMENT[move.element]) {
        await wait(1320);
        setCardReveal((current) => (current?.cardId === firstReveal?.cardId ? { ...current, phase: "reveal" } : current));
      }
    }
    window.setTimeout(() => setBulkDrawProgress(null), 650);
  };
  const selectedWalletElementGroups = selectedWalletTierGroup
    ? ELEMENT_ORDER.map((targetElement) => {
      const cards = selectedWalletTierGroup.cards.filter((card) => walletCardElement(card, walletCardElements) === targetElement);
      return { element: targetElement, cards };
    }).filter((group) => group.cards.length > 0)
    : [];
  const renderWalletCard = (card: RpgWalletCard) => {
    const tier = walletCardTier(card);
    const cardElement = walletCardElement(card, walletCardElements);
    const cardId = walletCardKey(card);
    const boundMove = getRpgMoveById(cardSkillBindings[cardId]);
    const expanded = selectedCardId === cardId;
    const reveal = cardReveal?.cardId === cardId ? cardReveal : null;
    const expandedMode = !expanded ? "" : reveal?.phase === "intro" ? "is-reveal-intro" : reveal?.phase === "reveal" ? "is-reveal-complete" : boundMove ? "is-bound-detail" : "is-draw-ready";
    return (
      <article
        key={cardId}
        className={["rpg-wallet-card", `is-${tier}`, boundMove ? "is-bound" : "", expanded ? "is-expanded" : "", expandedMode].filter(Boolean).join(" ")}
        data-token-id={card.tokenId}
        data-rpg-guide-target={boundMove ? undefined : "single-card-draw"}
      >
        <button
          type="button"
          className="rpg-wallet-card-summary"
          onClick={() => {
            if (expanded) {
              setSelectedCardId(null);
              setCardReveal(null);
              return;
            }
            setSelectedCardId(cardId);
            setCardReveal((current) => (current?.cardId === cardId ? current : null));
          }}
        >
          {card.imageUrl ? <RpgPixelCardImage src={card.imageUrl} alt={card.name} /> : <span className="rpg-wallet-card-art">{commonCopy.noImage}</span>}
          <div>
            <small style={{ "--element": RPG_ELEMENT_META[cardElement].color } as CSSProperties}>
              {rpgElementLabel(cardElement, language)} · {walletTierShortLabel(tier)} · {boundMove ? cabinetCopy.boundCards : commonCopy.view}
            </small>
            <strong>{card.pokemonName || card.name}</strong>
            <span>{card.setName || card.name}</span>
            <em>{boundMove ? `${rpgMoveName(boundMove, language)} · ${tierLabel(boundMove)} · ${boundMove.energyCost} EN` : `${formatUsd(card.fmvUSD)} / ${card.attributeCandidates.grade ?? commonCopy.none}`}</em>
          </div>
        </button>
        {expanded ? (
          <WalletCardSkillDetail
            card={card}
            cardElement={cardElement}
            boundMove={boundMove}
            reveal={reveal}
            onDraw={handleDrawSelectedCard}
            onIntroDone={() => setCardReveal((current) => (current && current.cardId === cardId ? { ...current, phase: "reveal" } : current))}
          />
        ) : null}
      </article>
    );
  };
  return (
    <aside className="rpg-panel rpg-profile-card-panel rpg-backpack-panel" aria-label={cabinetCopy.aria}>
      <header>
        <Cards size={24} weight="fill" />
        <div>
          <strong>{cabinetCopy.title}</strong>
          <span>{cabinetCopy.subtitle}</span>
        </div>
        {isExperienceWallet ? (
          <section className="rpg-wallet-experience-notice is-inline is-cabinet-header" data-rpg-guide-target="wallet-notice">
            <strong>{cabinetCopy.demoWalletTitle}</strong>
            <span>{cabinetCopy.demoWalletBody}</span>
          </section>
        ) : null}
        <PanelCloseButton />
      </header>

      <div className="rpg-cabinet-layout">
        <div className="rpg-cabinet-main-column">
          <section className="rpg-wallet-card-section" aria-label={cabinetCopy.walletCardsAria}>
            <header>
              <div className="rpg-wallet-title">
                <strong>{cabinetCopy.showcase}</strong>
                <span>
                  {walletCardsStatus === "loading"
                    ? cabinetCopy.syncing
                    : walletCardsStatus === "error"
                      ? walletCardsError
                      : `${visibleWalletCards.length}/${walletCards.length} · ${walletCardsStale ? commonCopy.cached : walletSyncedLabel}`}
                </span>
              </div>
              <div className="rpg-wallet-header-actions">
                <button type="button" data-rpg-guide-target="draw-all" onClick={() => void handleDrawAllWalletCards()} disabled={walletCardsStatus !== "ready" || unboundWalletCardCount === 0 || Boolean(bulkDrawProgress)}>
                  <Sparkle size={15} weight="fill" />
                  <span>{bulkDrawProgress ? cabinetCopy.drawing(bulkDrawProgress.done, bulkDrawProgress.total) : unboundWalletCardCount > 0 ? cabinetCopy.drawAll(unboundWalletCardCount) : cabinetCopy.allDrawn}</span>
                </button>
                <button type="button" onClick={() => void fetchWalletCards(true)} disabled={walletCardsStatus === "loading" || Boolean(bulkDrawProgress)}>
                  <ArrowClockwise size={15} weight="bold" />
                  <span>{commonCopy.reload}</span>
                </button>
              </div>
            </header>
            {walletCardsStatus === "loading" ? (
              <div className="rpg-wallet-state">
                <Sparkle size={22} weight="fill" />
                <strong>{cabinetCopy.syncing}</strong>
                <span>{shortWallet(walletAddress)}</span>
              </div>
            ) : walletCardsStatus === "error" ? (
              <div className="rpg-wallet-state is-error">
                <Cards size={22} weight="fill" />
                <strong>{cabinetCopy.readFailed}</strong>
                <span>{walletCardsError}</span>
              </div>
            ) : visibleWalletCards.length === 0 ? (
              <div className="rpg-wallet-state">
                <Cards size={22} weight="fill" />
                <strong>{cabinetCopy.noMatchingCards}</strong>
                <span>{cabinetCopy.noMatchingCardsHint}</span>
              </div>
            ) : (
              <div className="rpg-wallet-cabinet-shell">
                <div className="rpg-wallet-shelf-toolbar">
                  <div className="rpg-wallet-showcase-filter">
                    <ElementFilter value={element} onChange={setElement} />
                  </div>
                  <div className="rpg-wallet-context-draw" data-rpg-guide-target="element-bulk-draw">
                    {selectedElementDrawMeta ? (
                      <button
                        type="button"
                        style={{ "--element": selectedElementDrawMeta.color, "--element-soft": selectedElementDrawMeta.accent } as CSSProperties}
                        disabled={walletCardsStatus !== "ready" || selectedElementDrawCount === 0 || Boolean(bulkDrawProgress)}
                        onClick={() => void handleDrawWalletCardsByElement(element as RpgElement)}
                      >
                        <Sparkle size={14} weight="fill" />
                        <span>{selectedElementDrawCount > 0 ? cabinetCopy.elementDraw(selectedElementDrawLabel, selectedElementDrawCount) : cabinetCopy.elementAllDrawn(selectedElementDrawLabel)}</span>
                      </button>
                    ) : (
                      <span>{cabinetCopy.chooseElementForDraw}</span>
                    )}
                  </div>
                  <nav className="rpg-wallet-tier-tabs" aria-label={cabinetCopy.tierTabsAria}>
                  {walletTierOptions.map((group) => (
                    <button
                      key={group.tier}
                      type="button"
                      className={[`is-${group.tier}`, selectedWalletTier === group.tier ? "is-active" : ""].filter(Boolean).join(" ")}
                      disabled={group.cards.length === 0}
                      aria-pressed={selectedWalletTier === group.tier}
                      onClick={() => setActiveWalletTier(group.tier)}
                    >
                      <strong>{walletTierLabel(group.tier)}</strong>
                      <span>{cabinetCopy.cardsCount(group.cards.length)}</span>
                      <em>{walletTierRangeLabel(group.tier)}</em>
                    </button>
                  ))}
                  </nav>
                  {selectedWalletTierGroup ? (
                    <div className={`rpg-wallet-shelf-summary is-${selectedWalletTierGroup.tier}`}>
                      <strong>{walletTierLabel(selectedWalletTierGroup.tier)}</strong>
                      <span>{cabinetCopy.cardsCount(selectedWalletTierGroup.cards.length)} / {formatUsd(selectedWalletTierGroup.totalFMV)}</span>
                      <em>{walletTierRangeLabel(selectedWalletTierGroup.tier)}</em>
                    </div>
                  ) : null}
                </div>
                {selectedWalletTierGroup ? (
                  <div className={`rpg-wallet-element-sections is-${selectedWalletTierGroup.tier}`}>
                    {selectedWalletElementGroups.map((group) => (
                      <section key={group.element} className="rpg-wallet-element-section" style={{ "--element": RPG_ELEMENT_META[group.element].color, "--element-soft": RPG_ELEMENT_META[group.element].accent } as CSSProperties}>
                        <header>
                          <strong>{rpgElementLabel(group.element, language)}</strong>
                          <span>{cabinetCopy.cardsCount(group.cards.length)}</span>
                        </header>
                        <div className={`rpg-wallet-card-grid rpg-wallet-shelf-grid is-${selectedWalletTierGroup.tier}`}>
                          {group.cards.map(renderWalletCard)}
                        </div>
                      </section>
                    ))}
                    </div>
                ) : null}
              </div>
            )}
          </section>

          {battleNotice ? <p className="rpg-room-message rpg-shop-message">{battleNotice}</p> : null}
          {walletCardsStale ? <p className="rpg-room-message rpg-shop-message">{cabinetCopy.cacheNotice(walletCardsStaleReason)}</p> : null}

          <section className="rpg-card-vault" aria-label={cabinetCopy.boundCards}>
            <header>
              <strong>{cabinetCopy.boundCards}</strong>
              <span>{element === "any" ? cabinetCopy.boundCardsHintAll : cabinetCopy.boundCardsHintElement(rpgElementLabel(element, language))}</span>
            </header>
            {visibleCards.length === 0 ? (
              <div className="rpg-backpack-empty">
                <Cards size={24} weight="fill" />
                <strong>{cabinetCopy.noBoundCards}</strong>
                <span>{cabinetCopy.noBoundCardsHint}</span>
              </div>
            ) : (
              <div className="rpg-card-vault-grid">
                {visibleCards.map(({ card, cardId, move }) => (
                  <article
                    key={`${cardId}-${move.id}`}
                    className={`rpg-owned-skill-card tier-${move.tier}`}
                    data-element={move.element}
                    data-tier={move.tier}
                    style={{ "--element": RPG_ELEMENT_META[move.element].color, "--element-soft": RPG_ELEMENT_META[move.element].accent } as CSSProperties}
                  >
                    <header>
                      <span>{rpgElementLabel(move.element, language)}</span>
                      <em>{walletTierLabel(walletCardTier(card))}</em>
                    </header>
                    <strong>{rpgMoveName(move, language)}</strong>
                    <p>{card.pokemonName || card.name} / {rpgMoveDescription(move, language)}</p>
                    <div className="rpg-owned-skill-stats">
                      <span>{tierLabel(move)}</span>
                      <span>{RPG_TEXT[language].draw.energy} {move.energyCost}</span>
                      <span>{targetLabel(move.target)}</span>
                    </div>
                    <div className="rpg-owned-skill-effects">
                      {moveEffectLabels(move).slice(0, 4).map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                    <button type="button" className="rpg-owned-skill-equip" onClick={() => openCardEquipForElement(move.element)}>
                      {cabinetCopy.equipToSlot(rpgElementLabel(move.element, language))}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}

function shortWallet(walletAddress: string) {
  return walletAddress.length > 12 ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : walletAddress;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(value));
}

function walletCardTier(card: RpgWalletCard): WalletTier {
  if (card.fmvUSD >= 500) return "high";
  if (card.fmvUSD >= 100) return "middle";
  return "low";
}

function walletCardKey(card: RpgWalletCard) {
  return card.tokenId || card.id;
}

function walletTierLabel(tier: WalletTier) {
  if (tier === "all") return rpgTierLabel("all");
  if (tier === "high") return rpgTierLabel("ultimate");
  if (tier === "middle") return rpgTierLabel("intermediate");
  return rpgTierLabel("basic");
}

function walletTierShortLabel(tier: WalletTier) {
  if (tier === "all") return rpgTierShortLabel("all");
  if (tier === "high") return rpgTierShortLabel("ultimate");
  if (tier === "middle") return rpgTierShortLabel("intermediate");
  return rpgTierShortLabel("basic");
}

function walletTierRangeLabel(tier: WalletTier) {
  if (tier === "all") return rpgTierRangeLabel("all");
  if (tier === "high") return rpgTierRangeLabel("ultimate");
  if (tier === "middle") return rpgTierRangeLabel("intermediate");
  return rpgTierRangeLabel("basic");
}

function walletCardElement(card: RpgWalletCard, assignments?: Record<string, RpgElement>): RpgElement {
  return assignments?.[walletCardKey(card)] ?? getRpgWalletCardElement(card);
}

function WalletCardSkillDetail({
  card,
  cardElement,
  boundMove,
  reveal,
  onDraw,
  onIntroDone
}: {
  card: RpgWalletCard;
  cardElement: RpgElement;
  boundMove: RpgMove | null;
  reveal: CardRevealState | null;
  onDraw: () => Promise<void>;
  onIntroDone: () => void;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].draw;
  const cardId = walletCardKey(card);
  const cardMeta = RPG_ELEMENT_META[cardElement];
  const cardElementLabel = rpgElementLabel(cardElement, language);
  const move = reveal?.entry.moves[0] ?? boundMove;
  const moveMeta = move ? RPG_ELEMENT_META[move.element] : cardMeta;
  const moveElementLabel = move ? rpgElementLabel(move.element, language) : cardElementLabel;
  const openingVideo = move ? SKILL_OPENING_VIDEO_BY_ELEMENT[move.element] : SKILL_OPENING_VIDEO_BY_ELEMENT[cardElement];
  const isIntro = Boolean(reveal && reveal.phase === "intro" && openingVideo);
  const isRevealed = Boolean(move && (!reveal || reveal.phase === "reveal"));

  return (
    <div
      key={cardId}
      className={["rpg-wallet-card-detail", boundMove ? "is-bound" : "is-unbound", isIntro ? "is-intro" : "", isRevealed ? "is-revealed" : ""].filter(Boolean).join(" ")}
      style={{ "--element": moveMeta.color, "--element-soft": moveMeta.accent } as CSSProperties}
      data-token-id={card.tokenId}
      data-element={move?.element ?? cardElement}
    >
      <div className="rpg-wallet-card-detail-main">
        <header>
          <span>{boundMove ? copy.bound : copy.unbound}</span>
          <strong>{boundMove ? rpgMoveName(boundMove, language) : copy.drawTitle(cardElementLabel)}</strong>
          <em>{boundMove ? `${tierLabel(boundMove)} / ${boundMove.energyCost} EN` : `${card.pokemonName || card.name} / ${walletTierLabel(walletCardTier(card))}`}</em>
        </header>

        {!move ? (
          <div className="rpg-wallet-draw-ready">
            <div>
              <strong>{copy.drawReady(cardElementLabel)}</strong>
              <span>{openingVideo ? copy.drawVideo : copy.drawNoVideo(cardElementLabel)}</span>
            </div>
            <button type="button" data-rpg-guide-target="single-card-draw" onClick={() => void onDraw()}>
              <Sparkle size={18} weight="fill" />
              <span>{copy.drawSkill}</span>
            </button>
          </div>
        ) : null}

        {isIntro && openingVideo ? (
          <div className="rpg-skill-opening-stage">
            <video key={`${cardId}-${move?.id}-opening`} src={openingVideo} autoPlay muted playsInline onEnded={onIntroDone} onError={onIntroDone} />
            <div>
              <span>{copy.opening(moveElementLabel)}</span>
              <strong>{copy.revealing}</strong>
            </div>
          </div>
        ) : null}

        {move && !isIntro ? <WalletBoundSkillReveal move={move} revealActive={Boolean(reveal)} /> : null}
      </div>
    </div>
  );
}

function WalletBoundSkillReveal({ move, revealActive }: { move: RpgMove; revealActive: boolean }) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].draw;
  const commonCopy = RPG_TEXT[language].common;
  const meta = RPG_ELEMENT_META[move.element];
  return (
    <section className={["rpg-bound-skill-reveal", revealActive ? "is-new" : ""].filter(Boolean).join(" ")} style={{ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties}>
      <div className="rpg-bound-skill-preview" aria-label={copy.animationAria(rpgMoveName(move, language))}>
        <RpgSkillVfxSprite key={`${move.id}-${revealActive ? "reveal" : "preview"}`} move={move} animate loop className="rpg-bound-skill-vfx" />
      </div>
      <div className="rpg-bound-skill-copy">
        <span>{rpgElementLabel(move.element, language)} / {tierLabel(move)} / {targetLabel(move.target)}</span>
        <strong>{rpgMoveName(move, language)}</strong>
        <p>{rpgMoveDescription(move, language)}</p>
        <dl>
          <div>
            <dt>{copy.damage}</dt>
            <dd>{move.power > 0 ? move.power : commonCopy.none}</dd>
          </div>
          <div>
            <dt>{copy.energy}</dt>
            <dd>{move.energyCost} EN</dd>
          </div>
          <div>
            <dt>{copy.speed}</dt>
            <dd>{move.speed}</dd>
          </div>
          <div>
            <dt>{copy.animation}</dt>
            <dd>{rpgMoveAnimationName(move, language)}</dd>
          </div>
        </dl>
        <div className="rpg-bound-skill-effects">
          {moveEffectLabels(move).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        {move.animation.notes ? <em>{move.animation.notes}</em> : null}
      </div>
    </section>
  );
}

type BoundWalletSkillCard = {
  card: RpgWalletCard;
  cardId: string;
  move: RpgMove;
};

type BattleFieldCard = {
  card: RpgWalletCard;
  cardId: string;
  moveId: string;
  moveName: string;
};

type CardEquipSkillSlot =
  | { kind: "card"; key: string; slotNumber: number; equipped: BoundWalletSkillCard; move: RpgMove }
  | { kind: "default"; key: string; slotNumber: number; move: RpgMove }
  | { kind: "empty"; key: string; slotNumber: number };

function CardEquipPanel({
  panelRef,
  equipPetId,
  setEquipPetId,
  boundCards,
  petMoveLoadouts,
  petCardLoadouts,
  equipCardToPet,
  unequipCardFromPet,
  unequipMoveFromPet
}: {
  panelRef?: RefObject<HTMLElement | null>;
  equipPetId: string;
  setEquipPetId: (petId: string) => void;
  boundCards: BoundWalletSkillCard[];
  petMoveLoadouts: Record<string, string[]>;
  petCardLoadouts: Record<string, string[]>;
  equipCardToPet: (definitionId: string, cardId: string) => Promise<void>;
  unequipCardFromPet: (definitionId: string, cardId: string) => Promise<void>;
  unequipMoveFromPet: (definitionId: string, moveId: string) => void;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].equip;
  const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === equipPetId) ?? RPG_STARTER_PETS[0];
  const [selectedEquipCardId, setSelectedEquipCardId] = useState<string | null>(null);
  const [selectedSkillSlotKey, setSelectedSkillSlotKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedEquipCardId(null);
    setSelectedSkillSlotKey(null);
  }, [pet?.id]);

  if (!pet) return null;

  const petMeta = RPG_ELEMENT_META[pet.element];
  const defaultMoveIds = (petMoveLoadouts[pet.id] && petMoveLoadouts[pet.id].length > 0 ? petMoveLoadouts[pet.id] : pet.startingMoveIds).filter((moveId) => getRpgMoveById(moveId)?.element === pet.element).slice(0, RPG_MAX_EQUIPPED_MOVES);
  const defaultMoves = defaultMoveIds.flatMap((moveId) => {
    const move = getRpgMoveById(moveId);
    return move ? [move] : [];
  });
  const equippedCardIds = (petCardLoadouts[pet.id] ?? []).slice(0, RPG_MAX_EQUIPPED_MOVES);
  const equippedCards = equippedCardIds.flatMap((cardId) => {
    const boundCard = boundCards.find((candidate) => candidate.cardId === cardId);
    return boundCard && boundCard.move.element === pet.element ? [boundCard] : [];
  });
  const equippedMoveIds = new Set(equippedCards.map(({ move }) => move.id));
  const filledSkillSlots: CardEquipSkillSlot[] = [
    ...equippedCards.map((equipped, index) => ({
      kind: "card" as const,
      key: `card-${equipped.cardId}`,
      slotNumber: index + 1,
      equipped,
      move: equipped.move
    })),
    ...defaultMoves.filter((move) => !equippedMoveIds.has(move.id)).map((move, index) => ({
      kind: "default" as const,
      key: `default-${move.id}`,
      slotNumber: equippedCards.length + index + 1,
      move
    }))
  ].slice(0, RPG_MAX_EQUIPPED_MOVES);
  const skillSlots: CardEquipSkillSlot[] = Array.from({ length: RPG_MAX_EQUIPPED_MOVES }, (_, index) => {
    return filledSkillSlots[index] ?? { kind: "empty" as const, key: `empty-${pet.id}-${index}`, slotNumber: index + 1 };
  });
  const availableCards = boundCards
    .filter(({ move }) => move.element === pet.element)
    .sort((a, b) => a.move.tierIndex - b.move.tierIndex || a.move.energyCost - b.move.energyCost || a.card.name.localeCompare(b.card.name));
  const selectedEquipCard = selectedEquipCardId
    ? availableCards.find((candidate) => candidate.cardId === selectedEquipCardId) ?? equippedCards.find((candidate) => candidate.cardId === selectedEquipCardId) ?? null
    : null;
  const selectedSkillSlot = selectedSkillSlotKey ? skillSlots.find((slot) => slot.key === selectedSkillSlotKey) ?? null : null;
  const selectedSlotMove = selectedSkillSlot && selectedSkillSlot.kind !== "empty" ? selectedSkillSlot.move : null;
  const toggleSelectedEquipCard = (cardId: string) => {
    setSelectedSkillSlotKey(null);
    setSelectedEquipCardId((current) => (current === cardId ? null : cardId));
  };
  const toggleSelectedSkillSlot = (slotKey: string) => {
    setSelectedEquipCardId(null);
    setSelectedSkillSlotKey((current) => (current === slotKey ? null : slotKey));
  };
  const petName = rpgPetName(pet.id, pet.name, language);
  const petElementLabel = rpgElementLabel(pet.element, language);

  return (
    <section ref={panelRef} className="rpg-card-equip-panel rpg-skill-library" aria-label={copy.panelAria} data-rpg-guide-target="card-equip">
      <header>
        <div>
          <strong>{copy.title(petName)}</strong>
          <span>{copy.subtitle(petElementLabel)}</span>
        </div>
        <div className="rpg-library-pets" role="list" aria-label={copy.petSelectorAria}>
          {RPG_STARTER_PETS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={candidate.id === pet.id ? "is-selected" : ""}
              onClick={() => setEquipPetId(candidate.id)}
              style={{ "--element": RPG_ELEMENT_META[candidate.element].color, "--element-soft": RPG_ELEMENT_META[candidate.element].accent } as CSSProperties}
            >
              {rpgElementLabel(candidate.element, language)}
            </button>
          ))}
        </div>
      </header>

      <div className="rpg-equipped-card-slots rpg-skill-slot-grid" style={{ "--element": petMeta.color, "--element-soft": petMeta.accent } as CSSProperties}>
        {skillSlots.map((slot) => {
          if (slot.kind === "empty") {
            return (
              <div key={slot.key} className="rpg-equipped-card-slot rpg-skill-slot is-empty">
                <b>{slot.slotNumber}</b>
                <span>{copy.emptySlot}</span>
              </div>
            );
          }
          const summary = moveEffectLabels(slot.move).slice(0, 2).join(" / ") || targetLabel(slot.move.target);
          const isSelected = selectedSkillSlotKey === slot.key;
          return (
            <article key={slot.key} className={["rpg-equipped-card-slot", "rpg-skill-slot", "is-filled", `is-${slot.kind}`, isSelected ? "is-selected" : ""].filter(Boolean).join(" ")}>
              <button type="button" className="rpg-card-slot-preview rpg-skill-slot-preview" aria-label={copy.inspectMove(rpgMoveName(slot.move, language))} onClick={() => toggleSelectedSkillSlot(slot.key)}>
                {slot.kind === "card" && slot.equipped.card.imageUrl ? (
                  <RpgPixelCardImage src={slot.equipped.card.imageUrl} alt={slot.equipped.card.name} />
                ) : (
                  <span className="rpg-skill-slot-badge" aria-hidden="true">
                    <b>{petElementLabel}</b>
                    <em>{tierLabel(slot.move).slice(0, 1)}</em>
                  </span>
                )}
                <span>
                  <b>{slot.kind === "card" ? copy.slot(slot.slotNumber) : copy.defaultSlot(slot.slotNumber)}</b>
                  <strong className="rpg-card-equip-skill-name">{rpgMoveName(slot.move, language)}</strong>
                  <em>{slot.kind === "card" ? slot.equipped.card.pokemonName || slot.equipped.card.name : summary}</em>
                </span>
              </button>
              <button
                type="button"
                className="rpg-card-slot-action"
                onClick={() => {
                  if (slot.kind === "card") {
                    void unequipCardFromPet(pet.id, slot.equipped.cardId);
                    return;
                  }
                  unequipMoveFromPet(pet.id, slot.move.id);
                }}
              >
                {copy.remove}
              </button>
              {isSelected ? (
                <div className="rpg-card-cell-skill-detail rpg-slot-cell-skill-detail">
                  <WalletBoundSkillReveal move={slot.move} revealActive={false} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="rpg-card-equip-list">
        {availableCards.length === 0 ? (
          <div className="rpg-library-empty">
            <Cards size={18} weight="fill" />
            <span>{copy.noCards(petElementLabel)}</span>
          </div>
        ) : (
          availableCards.map(({ card, cardId, move }) => {
            const equipped = equippedCardIds.includes(cardId);
            const expanded = selectedEquipCard?.cardId === cardId;
            const summary = moveEffectLabels(move).slice(0, 2).join(" / ") || targetLabel(move.target);
            return (
              <article key={cardId} className={["rpg-card-equip-row", equipped ? "is-equipped" : "", expanded ? "is-selected is-expanded" : ""].filter(Boolean).join(" ")}>
                <button type="button" className="rpg-card-equip-preview" onClick={() => toggleSelectedEquipCard(cardId)}>
                  {card.imageUrl ? <RpgPixelCardImage src={card.imageUrl} alt={card.name} /> : null}
                  <span>
                    <b>{equipped ? copy.equipped : copy.candidateCard} · {tierLabel(move)} · {move.energyCost} EN</b>
                    <strong className="rpg-card-equip-skill-name">{copy.skillName(rpgMoveName(move, language))}</strong>
                    <em>{copy.cardName(card.pokemonName || card.name)}</em>
                    <small>{summary}</small>
                  </span>
                </button>
                <button type="button" className="rpg-card-equip-action" onClick={() => void (equipped ? unequipCardFromPet(pet.id, cardId) : equipCardToPet(pet.id, cardId))}>
                  {equipped ? copy.removeSkill : copy.equipSkill}
                </button>
                {expanded ? (
                  <div className="rpg-card-cell-skill-detail rpg-card-row-skill-detail">
                    <WalletBoundSkillReveal move={move} revealActive={false} />
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      {!selectedEquipCard && !selectedSlotMove && availableCards.length === 0 ? (
        <div className="rpg-card-equip-detail-empty">
          <Cards size={20} weight="fill" />
          <span>{copy.emptyDetail}</span>
        </div>
      ) : null}
    </section>
  );
}

function SkillLibraryPanel({
  title,
  description,
  equipPetId,
  setEquipPetId,
  skillInventory,
  petMoveLoadouts,
  equipMoveToPet,
  unequipMoveFromPet
}: {
  title?: string;
  description?: string;
  equipPetId: string;
  setEquipPetId: (petId: string) => void;
  skillInventory: Record<string, number>;
  petMoveLoadouts: Record<string, string[]>;
  equipMoveToPet: (definitionId: string, moveId: string) => void;
  unequipMoveFromPet: (definitionId: string, moveId: string) => void;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].equip;
  const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === equipPetId) ?? RPG_STARTER_PETS[0];
  if (!pet) return null;

  const petName = rpgPetName(pet.id, pet.name, language);
  const petElementLabel = rpgElementLabel(pet.element, language);
  const equippedMoveIds = (petMoveLoadouts[pet.id] && petMoveLoadouts[pet.id].length > 0 ? petMoveLoadouts[pet.id] : pet.startingMoveIds).slice(0, RPG_MAX_EQUIPPED_MOVES);
  const freeMoves = pet.startingMoveIds
    .map((moveId) => getRpgMoveById(moveId))
    .filter((move): move is RpgMove => Boolean(move));
  const cardMoves = Object.entries(skillInventory)
    .flatMap(([moveId, count]) => {
      const move = getRpgMoveById(moveId);
      return move ? [{ move, count }] : [];
    })
    .filter(({ move }) => move.element === pet.element && !pet.startingMoveIds.includes(move.id))
    .sort((a, b) => a.move.tierIndex - b.move.tierIndex || a.move.slot - b.move.slot);
  const availableMoves = [
    ...freeMoves.map((move) => ({ move, count: 0, source: "free" as const })),
    ...cardMoves.map(({ move, count }) => ({ move, count, source: "card" as const }))
  ];

  return (
    <section className="rpg-skill-library" aria-label={copy.skillLibrary}>
      <header>
        <div>
          <strong>{title ?? copy.skillLibrary}</strong>
          <span>{description ?? copy.libraryDescription(petElementLabel)}</span>
        </div>
        <div className="rpg-library-pets" role="list" aria-label={copy.petSelectorAria}>
          {RPG_STARTER_PETS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={candidate.id === pet.id ? "is-selected" : ""}
              onClick={() => setEquipPetId(candidate.id)}
              style={{ "--element": RPG_ELEMENT_META[candidate.element].color, "--element-soft": RPG_ELEMENT_META[candidate.element].accent } as CSSProperties}
            >
              {rpgElementLabel(candidate.element, language)}
            </button>
          ))}
        </div>
      </header>

      <div className="rpg-equipped-moves">
        <strong>{copy.currentLoadout(petName)}</strong>
        <div>
          {equippedMoveIds.map((moveId) => {
            const move = getRpgMoveById(moveId);
            if (!move) return null;
            const source = pet.startingMoveIds.includes(move.id) ? copy.defaultSource : copy.cardSource;
            const isDefaultSource = pet.startingMoveIds.includes(move.id);
            return (
              <button key={`${pet.id}-${move.id}`} type="button" className={isDefaultSource ? "is-free-skill" : "is-card-skill"} data-remove-label={copy.removeSkillShort} onClick={() => unequipMoveFromPet(pet.id, move.id)} title={copy.removeSkill}>
                <SkillChip move={move} />
                <span className="rpg-move-source-tag">{source}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rpg-library-moves">
        {availableMoves.length === 0 ? (
          <div className="rpg-library-empty">
            <Sparkle size={18} weight="fill" />
            <span>{copy.noSkillCards(petElementLabel)}</span>
          </div>
        ) : (
          availableMoves.map(({ move, count, source }) => {
            const equipped = equippedMoveIds.includes(move.id);
            return (
              <button key={move.id} type="button" className={[equipped ? "is-equipped" : "", source === "free" ? "is-free-skill" : "is-card-skill"].filter(Boolean).join(" ")} data-equipped-label={copy.equippedShort} onClick={() => equipMoveToPet(pet.id, move.id)} disabled={equipped}>
                <SkillChip move={move} />
                <em>{source === "free" ? copy.defaultSource : `x${count}`}</em>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function ticketBandLabel(ticket: RpgSkillTicket) {
  return rpgTicketCopy(ticket).band;
}

function tierLabel(move: RpgMove) {
  return rpgTierLabel(move.tier);
}

function tierName(tier: RpgMove["tier"]) {
  return rpgTierLabel(tier);
}

function targetLabel(target: RpgMove["target"]) {
  return rpgTargetLabel(target);
}

function moveEffectLabels(move: RpgMove) {
  return rpgMoveEffectLabels(move);
}

function DrawCeremony({ entry, preferredElement }: { entry: RpgDrawHistoryEntry | null; preferredElement?: RpgElement }) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].draw;
  const ticket = entry ? RPG_SKILL_TICKETS.find((item) => item.id === entry.ticketId) : null;
  const leadMove = entry?.moves[0] ?? null;
  const leadMeta = leadMove ? RPG_ELEMENT_META[leadMove.element] : preferredElement ? RPG_ELEMENT_META[preferredElement] : RPG_ELEMENT_META.water;
  const style = {
    "--element": leadMeta.color,
    "--element-soft": leadMeta.accent
  } as CSSProperties;

  return (
    <section key={entry?.id ?? "empty"} className={["rpg-draw-ceremony", entry ? "is-revealing" : "is-idle", entry && entry.moves.length >= 10 ? "is-ten-draw" : "", ticket ? `is-${ticket.cardPriceBand}` : ""].filter(Boolean).join(" ")} style={style} aria-live="polite">
      <div className="rpg-draw-lane" aria-hidden="true">
        <div className="rpg-draw-source-card">
          <span>{ticket ? ticketBandLabel(ticket) : RPG_TEXT[language].cabinet.card}</span>
          <strong>{ticket?.cardPriceBand === "high" ? "RARE" : ticket?.cardPriceBand === "middle" ? "MID" : "BASIC"}</strong>
          <i />
        </div>
        <div className="rpg-draw-converter">
          <b />
          <b />
          <b />
        </div>
        <div className="rpg-draw-ticket">
          <span>TICKET</span>
          <strong>{entry ? entry.moves.length : 0}</strong>
        </div>
      </div>

      <div className="rpg-draw-reveal">
        {entry && leadMove ? (
          <>
            <header>
              <span>{ticket ? rpgTicketCopy(ticket, language).label : entry.ticketLabel}</span>
              <strong>{rpgMoveName(leadMove, language)}</strong>
              <em>{rpgElementLabel(leadMove.element, language)} / {tierLabel(leadMove)}</em>
            </header>
            <div className="rpg-draw-reveal-grid">
              {entry.moves.map((move, index) => (
                <span
                  key={`${entry.id}-${move.id}-${index}`}
                  className={`rpg-draw-reveal-card tier-${move.tier}`}
                  data-element={move.element}
                  data-tier={move.tier}
                  style={{ "--element": RPG_ELEMENT_META[move.element].color, "--element-soft": RPG_ELEMENT_META[move.element].accent, "--reveal-delay": `${index * 55}ms` } as CSSProperties}
                  title={rpgMoveDescription(move, language)}
                >
                  <b>{rpgElementLabel(move.element, language)}</b>
                  <strong>{rpgMoveName(move, language)}</strong>
                  <em>{tierLabel(move)}</em>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="rpg-draw-idle-copy">
            <Sparkle size={19} weight="fill" />
            <strong>{copy.idleTitle}</strong>
            <span>{copy.pool(preferredElement ? rpgElementLabel(preferredElement, language) : undefined)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function GymPanel() {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].gym;
  const startAiBattle = useRpgStore((state) => state.startAiBattle);
  const selectedAiDifficulty = useRpgStore((state) => state.selectedAiDifficulty);
  const setAiDifficulty = useRpgStore((state) => state.setAiDifficulty);
  const createVersusRoom = useRpgStore((state) => state.createVersusRoom);
  const joinVersusRoom = useRpgStore((state) => state.joinVersusRoom);
  const versusConnection = useRpgStore((state) => state.versusConnection);
  const selectedPartyPetIds = useRpgStore((state) => state.selectedPartyPetIds);
  const walletCards = useRpgStore((state) => state.walletCards);
  const cardSkillBindings = useRpgStore((state) => state.cardSkillBindings);
  const petCardLoadouts = useRpgStore((state) => state.petCardLoadouts);
  const petMoveLoadouts = useRpgStore((state) => state.petMoveLoadouts);
  const fetchWalletCards = useRpgStore((state) => state.fetchWalletCards);
  const equipCardToPet = useRpgStore((state) => state.equipCardToPet);
  const unequipCardFromPet = useRpgStore((state) => state.unequipCardFromPet);
  const unequipMoveFromPet = useRpgStore((state) => state.unequipMoveFromPet);
  const pendingCardEquipPetId = useRpgStore((state) => state.pendingCardEquipPetId);
  const consumePendingCardEquipPet = useRpgStore((state) => state.consumePendingCardEquipPet);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const [roomCode, setRoomCode] = useState("");
  const [equipPetId, setEquipPetId] = useState(selectedPartyPetIds.find(Boolean) ?? RPG_STARTER_PETS[0]?.id ?? "");
  const gymTutorial = useFirstRunTutorial("gym");
  const connecting = versusConnection === "connecting";
  const selectedPartyCount = selectedPartyPetIds.filter(Boolean).length;
  const partyReady = selectedPartyCount === 3;
  const selectedAiCopy = rpgAiDifficultyCopy(selectedAiDifficulty, language);
  const boundCards = useMemo(
    () =>
      walletCards
        .flatMap((card) => {
          const cardId = walletCardKey(card);
          const move = getRpgMoveById(cardSkillBindings[cardId]);
          return move ? [{ card, cardId, move }] : [];
        })
        .sort((a, b) => ELEMENT_ORDER.indexOf(a.move.element) - ELEMENT_ORDER.indexOf(b.move.element) || a.move.tierIndex - b.move.tierIndex || a.move.slot - b.move.slot || a.card.name.localeCompare(b.card.name)),
    [cardSkillBindings, walletCards]
  );
  const openPartySkillEditor = (petId: string) => {
    setEquipPetId(petId);
  };
  useEffect(() => {
    const firstPartyPetId = selectedPartyPetIds.find(Boolean);
    if (firstPartyPetId && !selectedPartyPetIds.includes(equipPetId)) {
      setEquipPetId(firstPartyPetId);
    }
  }, [equipPetId, selectedPartyPetIds]);
  useEffect(() => {
    if (!pendingCardEquipPetId) return;
    const pendingPetId = consumePendingCardEquipPet();
    if (!pendingPetId) return;
    setEquipPetId(pendingPetId);
  }, [consumePendingCardEquipPet, pendingCardEquipPetId]);
  useEffect(() => {
    void fetchWalletCards();
  }, [fetchWalletCards]);
  return (
    <>
      <aside className="rpg-panel rpg-gym-panel" aria-label={copy.aria}>
        <header>
          <FlagBanner size={24} weight="fill" />
          <div>
            <strong>{copy.title}</strong>
            <span>{copy.subtitle}</span>
          </div>
          <PanelCloseButton />
        </header>
        <div className="rpg-panel-help-row">
          <button type="button" className="rpg-tutorial-button" onClick={gymTutorial.openTutorial}>
            <Question size={16} weight="bold" />
            <span>{copy.tutorial}</span>
          </button>
          <span>{copy.help}</span>
        </div>
        <section className="rpg-gym-battle-entry" aria-label={copy.aiDifficultyAria}>
          <section className="rpg-ai-difficulty-selector" aria-label={copy.aiDifficultyAria}>
            <header>
              <div>
                <strong>{copy.aiBattle}</strong>
                <span>{selectedAiCopy.title}</span>
              </div>
              <button type="button" className="rpg-ai-start-button" data-rpg-guide-target="gym-ai" disabled={!partyReady} onClick={() => startAiBattle(selectedAiDifficulty)}>
                <Robot size={20} weight="fill" />
                <span>{copy.aiMatch(selectedAiCopy.label)}</span>
              </button>
            </header>
            <div>
              {RPG_AI_DIFFICULTIES.map((difficulty) => {
                const configCopy = rpgAiDifficultyCopy(difficulty, language);
                return (
                  <button
                    key={difficulty}
                    type="button"
                    className={difficulty === selectedAiDifficulty ? "is-selected" : ""}
                    data-ai-difficulty={difficulty}
                    onClick={() => setAiDifficulty(difficulty)}
                  >
                    <span>{configCopy.label}</span>
                    <strong>{configCopy.title}</strong>
                    <em>{configCopy.description}</em>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="rpg-gym-modes">
            <button type="button" disabled={connecting || !partyReady} onClick={() => void createVersusRoom()}>
              <UsersThree size={25} weight="fill" />
              <span>{copy.versusBattle}</span>
              <strong>{connecting ? copy.connecting : copy.createRoom}</strong>
            </button>
          </div>
          <div className="rpg-room-join">
            <label>
              <span>{copy.roomCode}</span>
              <input value={roomCode} maxLength={8} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABCDE" />
            </label>
            <button type="button" disabled={connecting || !partyReady || roomCode.trim().length < 3} onClick={() => void joinVersusRoom(roomCode)}>
              {copy.joinRoom}
            </button>
          </div>
          {battleNotice ? <p className="rpg-room-message">{battleNotice}</p> : null}
        </section>
        <PartySelection editingPetId={equipPetId} onEditPet={openPartySkillEditor} />
        <section className="rpg-gym-skill-workbench is-inline" aria-label={copy.workbenchAria}>
          <CardEquipPanel
            equipPetId={equipPetId}
            setEquipPetId={setEquipPetId}
            boundCards={boundCards}
            petMoveLoadouts={petMoveLoadouts}
            petCardLoadouts={petCardLoadouts}
            equipCardToPet={equipCardToPet}
            unequipCardFromPet={unequipCardFromPet}
            unequipMoveFromPet={unequipMoveFromPet}
          />
        </section>
      </aside>
      <GymTutorialModal open={gymTutorial.open} onClose={gymTutorial.closeTutorial} />
    </>
  );
}

function PartySelection({
  editingPetId,
  onEditPet
}: {
  editingPetId?: string | null;
  onEditPet?: (petId: string) => void;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].gym;
  const ownedPetIds = useRpgStore((state) => state.ownedPetIds);
  const selectedPartyPetIds = useRpgStore((state) => state.selectedPartyPetIds);
  const togglePartyPet = useRpgStore((state) => state.togglePartyPet);
  const selectedPartyCount = selectedPartyPetIds.filter(Boolean).length;

  return (
    <section className="rpg-gym-party" aria-label={copy.partyAria} data-rpg-guide-target="gym-party">
      <header>
        <strong>{copy.partyTitle}</strong>
        <span>{selectedPartyCount}/3</span>
      </header>
      <div className="rpg-party-formation-board" aria-label={copy.formationAria}>
        {copy.formationSlots.map((slot, index) => {
          const petId = selectedPartyPetIds[index];
          const pet = petId ? getStarterPetById(petId) : null;
          const meta = pet ? RPG_ELEMENT_META[pet.element] : null;
          const petName = pet ? rpgPetName(pet.id, pet.name, language) : "";
          return (
            <article
              key={slot.label}
              className={["rpg-party-formation-slot", `slot-${index}`, pet ? "is-filled" : "is-empty"].filter(Boolean).join(" ")}
              data-party-slot={index}
              data-pet-id={petId ?? ""}
              style={meta ? ({ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties) : undefined}
            >
              <header>
                <span>{slot.shortLabel}</span>
                <strong>{slot.label}</strong>
              </header>
              {pet ? (
                <>
                  <RpgPetSprite element={pet.element} pose="idle" animate />
                  <b>{petName}</b>
                  <em>{editingPetId === pet.id ? copy.editingSlot : rpgElementLabel(pet.element, language)}</em>
                  {onEditPet ? (
                    <button
                      type="button"
                      className="rpg-party-slot-edit"
                      data-rpg-guide-target="card-equip"
                      title={copy.editCardSlotTitle}
                      aria-label={copy.editCardSlotAria(petName)}
                      onClick={() => onEditPet(pet.id)}
                    >
                      {copy.cardSlot}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rpg-party-slot-remove"
                    title={copy.removeFromPartyTitle}
                    aria-label={copy.removeFromPartyAria(petName)}
                    onClick={() => togglePartyPet(pet.id)}
                  >
                    <X size={13} weight="bold" />
                  </button>
                </>
              ) : (
                <b>{copy.emptyPartySlot}</b>
              )}
            </article>
          );
        })}
      </div>
      <div className="rpg-party-select-grid">
        {RPG_STARTER_PETS.filter((pet) => ownedPetIds.includes(pet.id)).map((pet) => {
          const meta = RPG_ELEMENT_META[pet.element];
          const selectedIndex = selectedPartyPetIds.indexOf(pet.id);
          const selected = selectedIndex >= 0;
          const petName = rpgPetName(pet.id, pet.name, language);
          return (
            <button
              key={pet.id}
              type="button"
              className={selected ? "is-selected" : ""}
              data-pet-id={pet.id}
              onClick={() => {
                if (selected && onEditPet) {
                  onEditPet(pet.id);
                  return;
                }
                if (!selected) togglePartyPet(pet.id);
              }}
              style={{ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties}
            >
              <RpgPetSprite element={pet.element} pose="idle" animate />
              <span>{rpgElementLabel(pet.element, language)}</span>
              <strong>{petName}</strong>
              <em>{editingPetId === pet.id ? copy.editSlots : selected ? copy.formationSlots[selectedIndex]?.label ?? copy.fieldSlot(selectedIndex) : copy.standby}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommandPlaceholder({
  pet,
  title,
  detail,
  eyebrow
}: {
  pet: RpgBattlePetState | null;
  title: string;
  detail: string;
  eyebrow: string;
}) {
  const meta = pet ? RPG_ELEMENT_META[pet.element] : null;
  return (
    <article
      className={["rpg-command-placeholder", pet ? "has-pet" : ""].filter(Boolean).join(" ")}
      style={meta ? ({ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties) : undefined}
    >
      {pet ? (
        <div className="rpg-command-placeholder-pet" aria-hidden="true">
          <RpgPetSprite element={pet.element} pose="idle" animate />
          <span className="rpg-command-placeholder-element">{meta?.label}</span>
        </div>
      ) : null}
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

function battlePetNameById(battle: RpgBattleState, id?: string) {
  if (!id) return rpgCopy().battle.unspecified;
  return battle.left.concat(battle.right).find((pet) => pet.id === id)?.name ?? rpgCopy().battle.unspecified;
}

function moveTargetLabel(move: RpgMove) {
  return rpgBattleTargetLabel(move.target);
}

function battleActionTargetLabel(battle: RpgBattleState, actor: RpgBattlePetState, action: { moveId: string; targetId?: string }) {
  const move = getRpgMoveById(action.moveId);
  const copy = rpgCopy().battle;
  if (!move) return copy.unspecified;
  if (move.target === "singleEnemy" || move.target === "singleAlly") return battlePetNameById(battle, action.targetId);
  if (move.target === "allEnemies") return copy.allEnemies;
  if (move.target === "allAllies") return copy.allAllies;
  return actor.name;
}

function BattlePanel() {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].battle;
  const battle = useRpgStore((state) => state.activeBattle);
  const battleMode = useRpgStore((state) => state.battleMode);
  const activeAiDifficulty = useRpgStore((state) => state.activeAiDifficulty);
  const versusConnection = useRpgStore((state) => state.versusConnection);
  const versusRoomCode = useRpgStore((state) => state.versusRoomCode);
  const versusPlayerId = useRpgStore((state) => state.versusPlayerId);
  const versusPlayerName = useRpgStore((state) => state.versusPlayerName);
  const versusPlayerSide = useRpgStore((state) => state.versusPlayerSide);
  const versusRoomStatus = useRpgStore((state) => state.versusRoomStatus);
  const versusOpponentName = useRpgStore((state) => state.versusOpponentName);
  const versusOpponentConnected = useRpgStore((state) => state.versusOpponentConnected);
  const versusSubmittedPlayerIds = useRpgStore((state) => state.versusSubmittedPlayerIds);
  const versusRematchRequestedPlayerIds = useRpgStore((state) => state.versusRematchRequestedPlayerIds);
  const pendingActions = useRpgStore((state) => state.pendingActions);
  const selectedEnemyId = useRpgStore((state) => state.selectedEnemyId);
  const selectedAllyId = useRpgStore((state) => state.selectedAllyId);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const walletCards = useRpgStore((state) => state.walletCards);
  const cardSkillBindings = useRpgStore((state) => state.cardSkillBindings);
  const petCardLoadouts = useRpgStore((state) => state.petCardLoadouts);
  const selectEnemyTarget = useRpgStore((state) => state.selectEnemyTarget);
  const selectAllyTarget = useRpgStore((state) => state.selectAllyTarget);
  const selectBattleMove = useRpgStore((state) => state.selectBattleMove);
  const clearBattleAction = useRpgStore((state) => state.clearBattleAction);
  const resolveBattleTurn = useRpgStore((state) => state.resolveBattleTurn);
  const requestVersusRematch = useRpgStore((state) => state.requestVersusRematch);
  const resetBattle = useRpgStore((state) => state.resetBattle);

  const leftLiving = useMemo(() => battle?.left.filter((pet) => !pet.defeated && pet.hp > 0) ?? [], [battle]);
  const activeSide = battle?.activeSide ?? "left";
  const canCommand = Boolean(battle && !battle.winner && activeSide === "left");
  const roundEnergy = battle ? getRpgBattleEnergyForTurn(battle.turn) : 1;
  const currentActor = useMemo(() => (battle ? getRpgCurrentTurnActor(battle) : null), [battle]);
  const reachableEnemyIds = useMemo(() => {
    const ids = new Set<string>();
    if (!battle || !canCommand) return ids;
    leftLiving.forEach((actor) => getRpgReachableEnemyTargets(battle, actor).forEach((pet) => ids.add(pet.id)));
    return ids;
  }, [battle, canCommand, leftLiving]);
  const replaySequence = useMemo(() => (battle ? buildBattleReplaySequence(battle) : []), [battle]);
  const replaySequenceKey = useMemo(() => replaySequence.map((entry) => entry.key).join("|"), [replaySequence]);
  const [replayStepIndex, setReplayStepIndex] = useState(0);
  const [battleMenuOpen, setBattleMenuOpen] = useState(false);
  const replayStep = replaySequence.length > 0 ? Math.min(replayStepIndex, replaySequence.length - 1) : 0;
  const replay = replaySequence[replayStep] ?? null;
  const impactTargetIds = useMemo(() => new Set(replay?.impactTargetIds ?? []), [replay]);
  const commandPets = canCommand ? leftLiving : [];
  const pendingEnergySpent = leftLiving.reduce((sum, pet) => {
    const move = getRpgMoveById(pendingActions[pet.id]?.moveId ?? "");
    return sum + (move?.energyCost ?? 0);
  }, 0);
  const pendingActionCount = leftLiving.filter((pet) => Boolean(pendingActions[pet.id])).length;
  const allReady = canCommand && pendingActionCount > 0 && pendingEnergySpent <= roundEnergy;
  const selfSubmitted = battleMode === "versus" && Boolean(versusPlayerId && versusSubmittedPlayerIds.includes(versusPlayerId));
  const selfRematchReady = battleMode === "versus" && Boolean(versusPlayerId && versusRematchRequestedPlayerIds.includes(versusPlayerId));
  const versusLocked = battleMode === "versus" && (versusConnection === "connecting" || versusConnection === "reconnecting" || versusConnection === "error");
  const aiConfig = activeAiDifficulty ? RPG_AI_DIFFICULTY_CONFIGS[activeAiDifficulty] : null;
  const actionStatus = battleNotice ?? (versusLocked ? copy.actionStatusResync : selfSubmitted ? copy.actionStatusSubmitted : allReady ? copy.actionStatusAllocated(pendingEnergySpent, roundEnergy) : canCommand ? copy.actionStatusChoose : copy.actionStatusWaiting);
  const actionDetail = canCommand
    ? copy.actionDetailCommand(pendingActionCount, leftLiving.length)
    : currentActor
      ? copy.actionDetailActing(currentActor.name)
      : copy.actionDetailWaiting;
  const walletCardById = useMemo(() => new Map(walletCards.map((card) => [walletCardKey(card), card])), [walletCards]);
  const localCardSide = battleMode === "versus" ? versusPlayerSide : "left";
  const equippedCardsForPet = (pet: RpgBattlePetState, side: "left" | "right") => {
    if (side !== localCardSide) return [];
    return (petCardLoadouts[pet.definitionId] ?? []).flatMap((cardId) => {
      const card = walletCardById.get(cardId);
      const move = getRpgMoveById(cardSkillBindings[cardId]);
      return card && move && move.element === pet.element ? [{ card, cardId, moveId: move.id, moveName: move.name }] : [];
    }).slice(0, RPG_MAX_EQUIPPED_MOVES);
  };

  useEffect(() => {
    setReplayStepIndex(0);
    setBattleMenuOpen(false);
  }, [replaySequenceKey]);

  useEffect(() => {
    const currentReplay = replaySequence[replayStep];
    if (!currentReplay || replayStep >= replaySequence.length - 1) return undefined;
    const timeout = window.setTimeout(() => {
      setReplayStepIndex((index) => Math.min(index + 1, replaySequence.length - 1));
    }, replayStepDuration(currentReplay));
    return () => window.clearTimeout(timeout);
  }, [replaySequence, replayStep]);

  useEffect(() => {
    if (battleMode !== "ai" || !battle || battle.winner || activeSide !== "right") return undefined;
    const timeout = window.setTimeout(() => resolveBattleTurn(), 1120);
    return () => window.clearTimeout(timeout);
  }, [activeSide, battle, battleMode, resolveBattleTurn]);

  if (!battle && battleMode === "versus") {
    return (
      <aside className="rpg-panel rpg-battle-panel" aria-label={copy.versusWaitingAria}>
        <header>
          <UsersThree size={24} weight="fill" />
          <div>
            <strong>{copy.versusGym}</strong>
            <span>{versusRoomCode ? `ROOM ${versusRoomCode}` : versusConnection === "reconnecting" ? copy.reconnecting.toUpperCase() : copy.connecting.toUpperCase()}</span>
          </div>
          <button className="rpg-panel-close" type="button" title={RPG_TEXT[language].common.back} aria-label={RPG_TEXT[language].common.back} onClick={resetBattle}>
            <X size={18} weight="bold" />
          </button>
        </header>
        <VersusStatusRail
          placement="panel"
          roomCode={versusRoomCode}
          connection={versusConnection}
          roomStatus={versusRoomStatus}
          playerName={versusPlayerName}
          playerSide={versusPlayerSide}
          opponentName={versusOpponentName}
          opponentConnected={versusOpponentConnected}
          submittedCount={versusSubmittedPlayerIds.length}
          selfSubmitted={false}
          rematchReadyCount={versusRematchRequestedPlayerIds.length}
          selfRematchReady={false}
        />
        <div className="rpg-versus-waiting">
          <UsersThree size={34} weight="fill" />
          <strong>{versusRoomCode ?? copy.creatingRoom}</strong>
          <span>{battleNotice ?? (versusConnection === "reconnecting" ? copy.reconnecting : copy.waitingPlayer)}</span>
        </div>
      </aside>
    );
  }

  if (!battle) return null;

  return (
    <section className="rpg-battle-screen" aria-label={copy.arenaAria} data-ai-difficulty={activeAiDifficulty ?? ""} data-active-side={activeSide} data-round-energy={roundEnergy}>
      <header className="rpg-battle-scene-header">
        {battleMode === "versus" ? <UsersThree size={22} weight="fill" /> : <Sword size={22} weight="fill" />}
        <div>
          <strong>{battleMode === "versus" ? copy.versusGym : activeAiDifficulty ? `${rpgAiDifficultyCopy(activeAiDifficulty, language).label} ${copy.aiGym}` : copy.aiGym}</strong>
          <span>{battleMode === "versus" && versusRoomCode ? `ROOM ${versusRoomCode} / ${copy.turn(battle.turn)}` : `${activeAiDifficulty ? rpgAiDifficultyCopy(activeAiDifficulty, language).title : copy.localGym} / ${copy.turn(battle.turn)}`}</span>
        </div>
        <div className="rpg-battle-options">
          <button
            className="rpg-battle-options-button"
            type="button"
            title={copy.battleSettings}
            aria-label={copy.battleSettings}
            aria-expanded={battleMenuOpen}
            onClick={() => setBattleMenuOpen((open) => !open)}
          >
            <Gear size={20} weight="fill" />
          </button>
          {battleMenuOpen ? (
            <div className="rpg-battle-options-menu" role="menu">
              <button type="button" role="menuitem" onClick={resetBattle}>
                {battleMode === "versus" ? copy.exitVersus : copy.exitAi}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {battleMode === "versus" ? (
        <VersusStatusRail
          placement="field"
          roomCode={versusRoomCode}
          connection={versusConnection}
          roomStatus={versusRoomStatus}
          playerName={versusPlayerName}
          playerSide={versusPlayerSide}
          opponentName={versusOpponentName}
          opponentConnected={versusOpponentConnected}
          submittedCount={versusSubmittedPlayerIds.length}
          selfSubmitted={selfSubmitted}
          rematchReadyCount={versusRematchRequestedPlayerIds.length}
          selfRematchReady={selfRematchReady}
        />
      ) : null}

      <BattleEnergyRail battle={battle} currentActor={currentActor} />

      <div className="rpg-battle-field">
        {battle.left.map((pet, index) => (
          <BattleFieldPet
            key={pet.id}
            pet={pet}
            side="left"
            slot={index}
            sideLabel={copy.ally}
            selected={selectedAllyId === pet.id}
            current={currentActor?.id === pet.id}
            onSelect={pet.defeated ? undefined : () => {
              selectAllyTarget(pet.id);
            }}
            acting={replay?.actorId === pet.id}
            actionMotion={replay?.actorId === pet.id ? actionMotionForMove(replay.move) : "idle"}
            attackStyle={attackMotionStyle(replay, pet.id)}
            impacted={impactTargetIds.has(pet.id)}
            floatingEntries={floatingEntriesForPet(replay, pet.id)}
            equippedCards={equippedCardsForPet(pet, "left")}
            activeCardMoveId={replay?.actorId === pet.id ? replay.move.id : pendingActions[pet.id]?.moveId ?? null}
          />
        ))}
        {battle.right.map((pet, index) => {
          const canSelectEnemy = Boolean(canCommand && !pet.defeated && reachableEnemyIds.has(pet.id));
          return (
            <BattleFieldPet
              key={pet.id}
              pet={pet}
              side="right"
              slot={index}
              sideLabel={copy.enemy}
              selected={selectedEnemyId === pet.id && canSelectEnemy}
              current={currentActor?.id === pet.id}
              onSelect={canSelectEnemy ? () => selectEnemyTarget(pet.id) : undefined}
              acting={replay?.actorId === pet.id}
              actionMotion={replay?.actorId === pet.id ? actionMotionForMove(replay.move) : "idle"}
              attackStyle={attackMotionStyle(replay, pet.id)}
              impacted={impactTargetIds.has(pet.id)}
              floatingEntries={floatingEntriesForPet(replay, pet.id)}
              equippedCards={equippedCardsForPet(pet, "right")}
              activeCardMoveId={replay?.actorId === pet.id ? replay.move.id : pendingActions[pet.id]?.moveId ?? null}
            />
          );
        })}
        <RpgBattleVfx replay={replay} />
      </div>

      <div className="rpg-command-dock">
        {battle.winner ? (
          <BattleResultPanel
            winner={battle.winner}
            battleMode={battleMode}
            opponentName={versusOpponentName}
            opponentConnected={versusOpponentConnected}
            battleNotice={battleNotice}
            rematchReadyCount={versusRematchRequestedPlayerIds.length}
            selfRematchReady={selfRematchReady}
            rematchLocked={versusLocked || versusConnection !== "connected"}
            onRematch={requestVersusRematch}
            onLeave={resetBattle}
          />
        ) : (
          <>
            <div className="rpg-command-board">
              {!canCommand ? (
                <CommandPlaceholder
                  pet={currentActor}
                  eyebrow={battleMode === "versus" ? copy.opponentTurn : copy.enemyTurn}
                  title={currentActor ? copy.acting(currentActor.name) : copy.waitingActor}
                  detail={battleMode === "versus" ? copy.waitingOpponentMove : copy.aiChoosingMove}
                />
              ) : null}
              {commandPets.map((pet) => {
                const selectedAction = pendingActions[pet.id];
                const selectedMove = getRpgMoveById(selectedAction?.moveId ?? "");
                const selectedTarget = selectedAction && selectedMove ? battleActionTargetLabel(battle, pet, selectedAction) : copy.noTarget;
                const energyAvailableForPet = Math.max(0, roundEnergy - pendingEnergySpent + (selectedMove?.energyCost ?? 0));
                return (
                  <article
                    key={pet.id}
                    className="rpg-command-row"
                    data-actor-id={pet.id}
                    data-pending-target-id={selectedAction?.targetId ?? ""}
                    data-rpg-guide-target="battle-current-pet"
                  >
                    <header>
                      <div className="rpg-command-row-title">
                        <strong>{pet.name}</strong>
                        {selectedAction && selectedMove ? <em>{copy.selectedMove(rpgMoveName(selectedMove, language), selectedTarget)}</em> : <em>{copy.chooseSkillThenTarget}</em>}
                      </div>
                      <span>{copy.availableEnergy(energyAvailableForPet, roundEnergy)}</span>
                      {selectedAction && !selfSubmitted ? (
                        <button type="button" onClick={() => clearBattleAction(pet.id)}>
                          {copy.reselect}
                        </button>
                      ) : null}
                    </header>
                    <div className="rpg-move-list" data-rpg-guide-target="battle-moves">
                      {pet.moveIds.map((moveId) => {
                      const move = getRpgMoveById(moveId);
                      if (!move) return null;
                      const active = selectedAction?.moveId === move.id;
                      const disabled = selfSubmitted || versusLocked || !canCommand || move.energyCost > energyAvailableForPet;
                      return (
                        <button
                          key={move.id}
                          type="button"
                          className={active ? "is-selected" : ""}
                          disabled={disabled}
                          onClick={() => selectBattleMove(pet.id, move.id)}
                          style={{ "--element": RPG_ELEMENT_META[move.element].color } as CSSProperties}
                        >
                          <span>{rpgElementLabel(move.element, language)}</span>
                          <strong>{rpgMoveName(move, language)}</strong>
                          <em>{move.energyCost} EN / {moveTargetLabel(move)}</em>
                          {active ? <b>{copy.selected}</b> : null}
                          {active ? <small>{copy.target(selectedTarget)}</small> : null}
                        </button>
                      );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="rpg-battle-actions" data-rpg-guide-target="battle-action">
              <div>
                <span>{copy.commandStatus}</span>
                <strong>{actionStatus}</strong>
                <em>{actionDetail}</em>
              </div>
              <button type="button" disabled={!allReady || selfSubmitted || versusLocked} onClick={resolveBattleTurn}>
                {battleMode === "versus" ? copy.submitMoves : copy.execute}
              </button>
            </footer>
          </>
        )}

        <ol className="rpg-battle-log">
          {battle.log.slice(-6).map((entry, index) => (
            <li key={`${entry.turn}-${index}`}>{entry.message}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function versusSideLabel(side: "left" | "right" | null) {
  const copy = rpgCopy().versus;
  if (side === "left") return copy.leftSeat;
  if (side === "right") return copy.rightSeat;
  return copy.syncingSeat;
}

function versusStatusLabel(connection: RpgVersusConnection, roomStatus: RpgVersusRoomStatus | null) {
  const copy = rpgCopy().versus;
  if (connection === "connecting") return copy.connecting;
  if (connection === "reconnecting") return copy.reconnecting;
  if (connection === "error") return copy.error;
  if (roomStatus === "waiting") return copy.waitingOpponent;
  if (roomStatus === "opponentDisconnected") return copy.opponentDisconnected;
  if (roomStatus === "finished") return copy.finished;
  return copy.selecting;
}

function VersusStatusRail({
  placement,
  roomCode,
  connection,
  roomStatus,
  playerName,
  playerSide,
  opponentName,
  opponentConnected,
  submittedCount,
  selfSubmitted,
  rematchReadyCount,
  selfRematchReady
}: {
  placement: "field" | "panel";
  roomCode: string | null;
  connection: RpgVersusConnection;
  roomStatus: RpgVersusRoomStatus | null;
  playerName: string | null;
  playerSide: "left" | "right" | null;
  opponentName: string | null;
  opponentConnected: boolean;
  submittedCount: number;
  selfSubmitted: boolean;
  rematchReadyCount: number;
  selfRematchReady: boolean;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].versus;
  const statusLabel = versusStatusLabel(connection, roomStatus);
  const battleOpen = roomStatus === "selecting" || roomStatus === "opponentDisconnected";
  const progressLabel = roomStatus === "finished" ? copy.rematch : battleOpen ? copy.moveSelect : copy.opening;
  const progressValue = roomStatus === "finished" ? `${Math.min(rematchReadyCount, 2)}/2` : battleOpen ? `${Math.min(submittedCount, 2)}/2` : opponentConnected ? "2/2" : "1/2";
  const progressDetail = roomStatus === "finished"
    ? selfRematchReady ? copy.youReady : opponentConnected ? copy.waitingRematch : copy.waitingReconnect
    : battleOpen
      ? selfSubmitted ? copy.youSubmitted : copy.waitingYou
      : opponentConnected ? copy.bothReady : copy.waitingJoin;

  return (
    <section
      className={["rpg-versus-status-rail", `is-${placement}`, roomStatus ? `status-${roomStatus}` : "", `conn-${connection}`].filter(Boolean).join(" ")}
      data-room-status={roomStatus ?? connection}
      data-connection={connection}
      data-self-submitted={selfSubmitted ? "true" : "false"}
      data-submitted-count={String(submittedCount)}
      data-opponent-connected={opponentConnected ? "true" : "false"}
      data-rematch-ready-count={String(rematchReadyCount)}
      aria-label={copy.statusAria}
    >
      <div>
        <span>{copy.room}</span>
        <strong>{roomCode ?? RPG_TEXT[language].battle.creatingRoom}</strong>
        <em>{connection === "reconnecting" ? copy.reconnecting : "ROOM"}</em>
      </div>
      <div>
        <span>{copy.seat}</span>
        <strong>{versusSideLabel(playerSide)}</strong>
        <em>{playerName ?? RPG_TEXT[language].battle.ally}</em>
      </div>
      <div>
        <span>{copy.opponent}</span>
        <strong>{opponentName ?? copy.waitingJoin}</strong>
        <em>{opponentConnected ? copy.online : roomStatus === "waiting" ? copy.notJoined : copy.offlineHeld}</em>
      </div>
      <div>
        <span>{copy.status}</span>
        <strong>{statusLabel}</strong>
        <em>{roomStatus ?? connection}</em>
      </div>
      <div>
        <span>{progressLabel}</span>
        <strong>{progressValue}</strong>
        <em>{progressDetail}</em>
      </div>
    </section>
  );
}

function BattleEnergyRail({ battle, currentActor }: { battle: RpgBattleState; currentActor: RpgBattlePetState | null }) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].battle;
  const turnEnergy = getRpgBattleEnergyForTurn(battle.turn);
  const activeSide = battle.activeSide ?? "left";
  const activeTeam = activeSide === "left" ? battle.left : battle.right;
  const activeEnergy = activeTeam.find((pet) => !pet.defeated && pet.hp > 0)?.energy ?? turnEnergy;
  const activeSideLabel = activeSide === "left" ? copy.ally : copy.enemy;

  return (
    <section className="rpg-battle-energy-rail" data-rpg-guide-target="battle-energy" aria-label={copy.energyTitle}>
      <header>
        <div>
          <span>{copy.energyTitle}</span>
          <strong>{turnEnergy} EN</strong>
        </div>
        <em>{copy.energyHint}</em>
      </header>
      <div className="rpg-energy-pips" aria-label={copy.energyAria(activeEnergy)}>
        {Array.from({ length: 10 }).map((_, index) => (
          <span key={index} className={index < activeEnergy ? "is-filled" : ""}>
            {index + 1}
          </span>
        ))}
      </div>
      <small>{currentActor ? copy.energyPhase(activeSideLabel, currentActor.name, activeEnergy, turnEnergy) : copy.energyWaiting(activeSideLabel)}</small>
    </section>
  );
}

function BattleResultPanel({
  winner,
  battleMode,
  opponentName,
  opponentConnected,
  battleNotice,
  rematchReadyCount,
  selfRematchReady,
  rematchLocked,
  onRematch,
  onLeave
}: {
  winner: "left" | "right" | "draw";
  battleMode: "ai" | "versus" | null;
  opponentName: string | null;
  opponentConnected: boolean;
  battleNotice: string | null;
  rematchReadyCount: number;
  selfRematchReady: boolean;
  rematchLocked: boolean;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].battle;
  const resultLabel = winner === "draw" ? copy.draw : winner === "left" ? copy.win : copy.loss;
  const resultTone = winner === "draw" ? "draw" : winner === "left" ? "win" : "loss";
  const opponentLabel = opponentName ?? copy.enemy;
  const versus = battleMode === "versus";
  return (
    <section className={`rpg-battle-result-panel is-${resultTone}`} aria-label={copy.resultAria}>
      <div className="rpg-result-emblem">
        {versus ? <UsersThree size={24} weight="fill" /> : <Sword size={24} weight="fill" />}
      </div>
      <div className="rpg-result-copy">
        <span>{versus ? copy.resultVersus : copy.resultAi}</span>
        <strong>{resultLabel}</strong>
        <em>{battleNotice ?? (versus ? (opponentConnected ? copy.opponentOnline(opponentLabel) : copy.opponentOffline(opponentLabel)) : copy.battleEnded)}</em>
      </div>
      {versus ? (
        <div className="rpg-rematch-status" aria-live="polite">
          <span>{copy.rematchStatus}</span>
          <strong>{Math.min(rematchReadyCount, 2)}/2</strong>
          <em>{selfRematchReady ? copy.ready : opponentConnected ? copy.waitConfirm : copy.waitReconnect}</em>
        </div>
      ) : null}
      <div className="rpg-result-actions">
        {versus ? (
          <button type="button" className="rpg-rematch-button" disabled={selfRematchReady || rematchLocked} onClick={onRematch}>
            <ArrowClockwise size={18} weight="bold" />
            <span>{selfRematchReady ? copy.waitOpponent : copy.readyRematch}</span>
          </button>
        ) : null}
        <button type="button" onClick={onLeave}>
          <FlagBanner size={18} weight="fill" />
          <span>{copy.backToGym}</span>
        </button>
      </div>
    </section>
  );
}

function BattleFieldPet({
  pet,
  side,
  slot,
  sideLabel,
  selected,
  current = false,
  onSelect,
  acting = false,
  actionMotion = "idle",
  attackStyle = {},
  impacted = false,
  floatingEntries = [],
  equippedCards = [],
  activeCardMoveId = null
}: {
  pet: RpgBattlePetState;
  side: "left" | "right";
  slot: number;
  sideLabel: string;
  selected: boolean;
  current?: boolean;
  onSelect?: () => void;
  acting?: boolean;
  actionMotion?: BattleActionMotion;
  attackStyle?: CSSProperties;
  impacted?: boolean;
  floatingEntries?: RpgBattleFloatingEntry[];
  equippedCards?: BattleFieldCard[];
  activeCardMoveId?: string | null;
}) {
  const { language } = useArenaI18n();
  const copy = RPG_TEXT[language].battle;
  const element = RPG_ELEMENT_META[pet.element];
  const hpPercent = Math.max(0, Math.min(100, (pet.hp / pet.maxHp) * 100));
  const petPose = pet.defeated ? "faint" : impacted ? "hit" : acting ? "attack" : "idle";
  const className = [
    "rpg-field-pet",
    `is-${side}`,
    `slot-${slot}`,
    selected ? "is-selected" : "",
    current ? "is-current-turn" : "",
    pet.defeated ? "is-defeated" : "",
    acting ? "is-acting" : "",
    acting ? `motion-${actionMotion}` : "",
    impacted ? "is-impacted" : "",
    pet.statuses.length > 0 ? "has-statuses" : ""
  ].filter(Boolean).join(" ");
  const content = (
      <>
        {equippedCards.length > 0 ? (
          <div className="rpg-field-card-stack" aria-hidden="true">
            {equippedCards.map((entry, index) => (
              <span
                key={entry.cardId}
                className={["rpg-field-card-token", entry.moveId === activeCardMoveId ? "is-active" : ""].filter(Boolean).join(" ")}
                style={{ "--card-index": index, zIndex: entry.moveId === activeCardMoveId ? 20 : index + 1 } as CSSProperties}
              >
                {entry.card.imageUrl ? <RpgPixelCardImage src={entry.card.imageUrl} alt={entry.card.name} /> : null}
                <b>{entry.moveName}</b>
              </span>
            ))}
          </div>
        ) : null}
        <RpgPetSprite element={pet.element} pose={petPose} frame={0} className="rpg-field-pet-sprite" />
        <BattleStatusEffects statuses={pet.statuses} />
        {selected ? <span className="rpg-field-target-tag">{side === "left" ? copy.allyTarget : copy.enemyTarget}</span> : null}
        <div className="rpg-field-nameplate">
          <strong>{pet.name}</strong>
        </div>
      <div
        className="rpg-field-hp"
        style={{ "--hp-percent": hpPercent, "--hp-fill": `${hpPercent}%` } as CSSProperties}
        aria-label={`${sideLabel} ${pet.name} HP ${Math.round(hpPercent)}%`}
      >
        <b />
      </div>
      <div className="rpg-status-pips rpg-field-status-pips">
        {pet.statuses.map((status) => (
          <span key={status.id} className={`is-${status.id}`}>
            {rpgStatusShortLabel(status.id, language)}
            <b>{status.remainingTurns}</b>
          </span>
        ))}
      </div>
      {floatingEntries.length > 0 ? (
        <div className="rpg-floating-stack" aria-hidden="true">
          {floatingEntries.slice(-4).map((entry, index) => (
            <span key={entry.id} className={`rpg-float is-${entry.type}`} style={{ "--float-index": index } as CSSProperties}>
              {entry.text}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
  const style = {
    "--element": element.color,
    "--element-soft": element.accent,
    ...attackStyle
  } as CSSProperties;

  if (!onSelect) {
    return (
      <div
        className={className}
        style={style}
        data-pet-id={pet.id}
        data-definition-id={pet.definitionId}
        data-slot-index={slot}
        data-field-side={side}
        data-side-label={sideLabel}
        data-statuses={pet.statuses.map((status) => status.id).join(" ")}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      data-pet-id={pet.id}
      data-definition-id={pet.definitionId}
      data-slot-index={slot}
      data-field-side={side}
      data-side-label={sideLabel}
      data-statuses={pet.statuses.map((status) => status.id).join(" ")}
      onClick={onSelect}
    >
      {content}
    </button>
  );
}

function SkillChip({ move }: { move: RpgMove }) {
  const { language } = useArenaI18n();
  return (
    <span className="rpg-skill-chip" data-element={move.element} data-tier={move.tier} style={{ "--element": RPG_ELEMENT_META[move.element].color } as CSSProperties}>
      <b>{rpgElementLabel(move.element, language)}</b>
      <strong>{rpgMoveName(move, language)}</strong>
      <em>{rpgTierShortLabel(move.tier, language)}</em>
    </span>
  );
}

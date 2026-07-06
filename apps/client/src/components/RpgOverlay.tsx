import { ArrowClockwise, Cards, FlagBanner, HouseLine, Question, Robot, Sparkle, Storefront, Sword, UsersThree, X } from "@phosphor-icons/react";
import {
  RPG_ELEMENTS,
  RPG_ELEMENT_META,
  RPG_AI_DIFFICULTIES,
  RPG_AI_DIFFICULTY_CONFIGS,
  RPG_SKILL_TICKETS,
  RPG_STARTER_PETS,
  getRpgCurrentTurnActor,
  getRpgMoveById,
  getRpgReachableEnemyTargets,
  assignRpgWalletCardElements,
  getRpgWalletCardElement,
  getStarterPetById,
  type RpgAiDifficulty,
  type RpgBattlePetState,
  type RpgElement,
  type RpgMove,
  type RpgSkillTicket
} from "@renaiss-game/shared";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClassPortrait } from "./ClassPortrait";
import { RpgBattleVfx, buildBattleReplaySequence, floatingEntriesForPet, type RpgBattleFloatingEntry, type RpgBattleReplay } from "./RpgBattleVfx";
import { RpgPetSprite } from "./RpgPetSprite";
import { RpgPixelCardImage } from "./RpgPixelCardImage";
import { RpgSkillVfxSprite } from "./RpgSkillVfxSprite";
import { BattleStatusEffects, statusShortLabel } from "./RpgStatusEffects";
import { GymTutorialModal, useFirstRunTutorial } from "./RpgTutorial";
import type { RpgWalletCard } from "../api/rpgWalletCards";
import { RPG_MAX_EQUIPPED_MOVES, useRpgStore, type RpgDrawHistoryEntry, type RpgVersusConnection, type RpgVersusRoomStatus } from "../state/rpgStore";

const ELEMENT_ORDER = RPG_ELEMENTS;
const WALLET_TIER_ORDER = ["high", "middle", "low"] as const;
const PARTY_FORMATION_SLOTS = [
  { label: "前排", shortLabel: "前" },
  { label: "後左", shortLabel: "左" },
  { label: "後右", shortLabel: "右" }
] as const;
const SKILL_OPENING_VIDEO_BY_ELEMENT: Partial<Record<RpgElement, string>> = {
  water: "/assets/skill-openings/water.mp4",
  fire: "/assets/skill-openings/fire.mp4",
  grass: "/assets/skill-openings/grass.mp4",
  dark: "/assets/skill-openings/dark.mp4",
  light: "/assets/skill-openings/light.mp4"
};

type CardRevealState = {
  cardId: string;
  phase: "intro" | "reveal";
  entry: RpgDrawHistoryEntry;
};
type WalletTier = (typeof WALLET_TIER_ORDER)[number];

function replayStepDuration(replay: RpgBattleReplay) {
  return Math.max(880, Math.min(1320, replay.move.animation.frameCount * 78));
}

export function RpgOverlay() {
  const screen = useRpgStore((state) => state.screen);
  const activeLocation = useRpgStore((state) => state.activeLocation);
  const nearPlace = useRpgStore((state) => state.nearPlace);
  const playerName = useRpgStore((state) => state.playerName);
  const openProfile = useRpgStore((state) => state.openProfile);
  const openGym = useRpgStore((state) => state.openGym);
  const openArena = useRpgStore((state) => state.openArena);
  const closePanel = useRpgStore((state) => state.closePanel);
  const exitHouse = useRpgStore((state) => state.exitHouse);
  const inBattle = screen === "battle";
  const returnHome = activeLocation === "house" ? exitHouse : closePanel;
  const openNearPlace = () => {
    if (nearPlace === "shop" || nearPlace === "cabinet") openProfile();
    if (nearPlace === "gym") openGym();
    if (nearPlace === "arena") openArena();
    if (nearPlace === "house") useRpgStore.getState().enterHouse();
    if (nearPlace === "houseExit") exitHouse();
  };

  return (
    <div className="rpg-layer" aria-label="RPG interface">
      {!inBattle ? (
        <>
          <button type="button" className={["rpg-profile-button", screen === "profile" ? "is-active" : ""].filter(Boolean).join(" ")} title="個人資料" aria-label="個人資料" onClick={openProfile}>
            <ClassPortrait classId="engineer" frame={0} />
            <span className="rpg-profile-button-copy">
              <strong>{playerName}</strong>
              <em>個人</em>
            </span>
          </button>

          <nav className="rpg-top-nav" aria-label="RPG places">
            <button type="button" title="Village" aria-label="Village" onClick={returnHome}>
              <HouseLine size={24} weight="fill" />
            </button>
            <button type="button" className={screen === "profile" || screen === "bag" ? "is-active" : ""} title="卡片" aria-label="卡片" onClick={openProfile}>
              <Cards size={24} weight="fill" />
            </button>
            <button type="button" className={screen === "gym" ? "is-active" : ""} title="道館" aria-label="道館" onClick={openGym}>
              <FlagBanner size={24} weight="fill" />
            </button>
            <button type="button" title="競技場" aria-label="競技場" onClick={openArena}>
              <Sword size={24} weight="fill" />
            </button>
          </nav>
        </>
      ) : null}

      {nearPlace && screen === "village" ? (
        <button className="rpg-interact-prompt" type="button" onClick={openNearPlace}>
          {nearPlace === "shop" ? <Storefront size={18} weight="fill" /> : nearPlace === "gym" ? <FlagBanner size={18} weight="fill" /> : nearPlace === "house" ? <HouseLine size={18} weight="fill" /> : <Sword size={18} weight="fill" />}
          <span>{nearPlace === "shop" ? "卡片背包" : nearPlace === "gym" ? "道館" : nearPlace === "house" ? "個人房子" : "競技場"}</span>
          <kbd>E</kbd>
        </button>
      ) : null}

      {nearPlace && screen === "house" ? (
        <button className="rpg-interact-prompt" type="button" onClick={openNearPlace}>
          {nearPlace === "cabinet" ? <Cards size={18} weight="fill" /> : <HouseLine size={18} weight="fill" />}
          <span>{nearPlace === "cabinet" ? "卡牌展示櫃" : "回到村莊"}</span>
          <kbd>E</kbd>
        </button>
      ) : null}

      {screen === "profile" || screen === "bag" || screen === "shop" ? <ProfilePanel /> : null}
      {screen === "gym" ? <GymPanel /> : null}
      {screen === "battle" ? <BattlePanel /> : null}
    </div>
  );
}

function PanelCloseButton() {
  const closePanel = useRpgStore((state) => state.closePanel);
  return (
    <button className="rpg-panel-close" type="button" title="Close" aria-label="Close" onClick={closePanel}>
      <X size={18} weight="bold" />
    </button>
  );
}

function ElementFilter({ value, onChange }: { value: RpgElement | "any"; onChange: (value: RpgElement | "any") => void }) {
  return (
    <div className="rpg-element-filter" role="list" aria-label="Element filter">
      <button type="button" className={value === "any" ? "is-active" : ""} onClick={() => onChange("any")}>
        全
      </button>
      {ELEMENT_ORDER.map((element) => (
        <button
          key={element}
          type="button"
          className={value === element ? "is-active" : ""}
          onClick={() => onChange(element)}
          style={{ "--element": RPG_ELEMENT_META[element].color } as CSSProperties}
        >
          {RPG_ELEMENT_META[element].label}
        </button>
      ))}
    </div>
  );
}

function ShopPanel() {
  const [element, setElement] = useState<RpgElement | "any">("any");
  const [activeDraw, setActiveDraw] = useState<RpgDrawHistoryEntry | null>(null);
  const [equipPetId, setEquipPetId] = useState(RPG_STARTER_PETS[0]?.id ?? "");
  const drawSkill = useRpgStore((state) => state.drawSkill);
  const ticketInventory = useRpgStore((state) => state.ticketInventory);
  const drawHistory = useRpgStore((state) => state.drawHistory);
  const skillInventory = useRpgStore((state) => state.skillInventory);
  const petMoveLoadouts = useRpgStore((state) => state.petMoveLoadouts);
  const equipMoveToPet = useRpgStore((state) => state.equipMoveToPet);
  const unequipMoveFromPet = useRpgStore((state) => state.unequipMoveFromPet);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const preferredElement = element === "any" ? undefined : element;
  const currentDraw = activeDraw ?? drawHistory[0] ?? null;
  const handleDraw = (ticketId: string) => {
    const entry = drawSkill(ticketId, preferredElement);
    if (entry) setActiveDraw(entry);
  };

  return (
    <aside className="rpg-panel rpg-shop-panel" aria-label="商城">
      <header>
        <Storefront size={24} weight="fill" />
        <div>
          <strong>卡片機</strong>
          <span>卡片轉成抽獎券，抽出的技能卡會進背包</span>
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
              <strong>{ticket.label}</strong>
              <em>{ticket.drawCount} DRAW / x{count}</em>
            </button>
          );
        })}
      </div>

      <SkillLibraryPanel
        equipPetId={equipPetId}
        setEquipPetId={setEquipPetId}
        skillInventory={skillInventory}
        petMoveLoadouts={petMoveLoadouts}
        equipMoveToPet={equipMoveToPet}
        unequipMoveFromPet={unequipMoveFromPet}
      />

      {battleNotice ? <p className="rpg-room-message rpg-shop-message">{battleNotice}</p> : null}

      <div className="rpg-draw-results" aria-live="polite">
        {drawHistory.length === 0 ? (
          <div className="rpg-empty-draw">
            <Sparkle size={20} weight="fill" />
            <span>等待技能卡</span>
          </div>
        ) : (
          drawHistory.map((entry) => (
            <article key={entry.id} className="rpg-draw-entry">
              <header>
                <strong>{entry.ticketLabel}</strong>
                <span>{entry.moves.length} 張</span>
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
  const [element, setElement] = useState<RpgElement | "any">("any");
  const playerName = useRpgStore((state) => state.playerName);
  const setPlayerName = useRpgStore((state) => state.setPlayerName);
  const walletAddress = useRpgStore((state) => state.walletAddress);
  const walletCards = useRpgStore((state) => state.walletCards);
  const walletCardsStatus = useRpgStore((state) => state.walletCardsStatus);
  const walletCardsError = useRpgStore((state) => state.walletCardsError);
  const walletCardsFetchedAt = useRpgStore((state) => state.walletCardsFetchedAt);
  const walletCardsTotalFMV = useRpgStore((state) => state.walletCardsTotalFMV);
  const walletCardsStale = useRpgStore((state) => state.walletCardsStale);
  const walletCardsStaleReason = useRpgStore((state) => state.walletCardsStaleReason);
  const fetchWalletCards = useRpgStore((state) => state.fetchWalletCards);
  const cardSkillBindings = useRpgStore((state) => state.cardSkillBindings);
  const petCardLoadouts = useRpgStore((state) => state.petCardLoadouts);
  const drawWalletCardSkill = useRpgStore((state) => state.drawWalletCardSkill);
  const equipCardToPet = useRpgStore((state) => state.equipCardToPet);
  const unequipCardFromPet = useRpgStore((state) => state.unequipCardFromPet);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const [equipPetId, setEquipPetId] = useState(RPG_STARTER_PETS[0]?.id ?? "");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardReveal, setCardReveal] = useState<CardRevealState | null>(null);
  const [draftName, setDraftName] = useState(playerName);
  const [activeWalletTier, setActiveWalletTier] = useState<WalletTier>("high");
  const [bulkDrawProgress, setBulkDrawProgress] = useState<{ done: number; total: number } | null>(null);
  const skillEditorRef = useRef<HTMLElement | null>(null);
  useEffect(() => setDraftName(playerName), [playerName]);
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
  const ownedCardTotal = ownedCards.length;
  const visibleWalletCards = element === "any" ? walletCards : walletCards.filter((card) => walletCardElement(card, walletCardElements) === element);
  const unboundWalletCardCount = walletCards.reduce((count, card) => count + (cardSkillBindings[walletCardKey(card)] ? 0 : 1), 0);
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
  const visibleWalletTierGroups = walletTierGroups.filter((group) => group.cards.length > 0);
  const selectedWalletTier = visibleWalletTierGroups.some((group) => group.tier === activeWalletTier) ? activeWalletTier : visibleWalletTierGroups[0]?.tier ?? activeWalletTier;
  const selectedWalletTierGroup = walletTierGroups.find((group) => group.tier === selectedWalletTier) ?? walletTierGroups[0];
  const selectedWalletCard = selectedCardId ? walletCards.find((card) => walletCardKey(card) === selectedCardId) ?? null : null;
  const freeSkillTotal = RPG_STARTER_PETS.reduce((sum, pet) => sum + pet.startingMoveIds.length, 0);
  const saveProfile = () => setPlayerName(draftName);
  const walletSyncedLabel = walletCardsFetchedAt ? `更新 ${new Date(walletCardsFetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "尚未同步";
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
    setSelectedCardId(null);
    setCardReveal(null);
    setBulkDrawProgress({ done: 0, total: cardsToDraw.length });
    for (let index = 0; index < cardsToDraw.length; index += 1) {
      await drawWalletCardSkill(walletCardKey(cardsToDraw[index]!));
      setBulkDrawProgress({ done: index + 1, total: cardsToDraw.length });
    }
    window.setTimeout(() => setBulkDrawProgress(null), 650);
  };
  const openPetSkillEditor = (petId: string) => {
    setEquipPetId(petId);
    window.setTimeout(() => {
      skillEditorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 0);
  };

  return (
    <aside className="rpg-panel rpg-profile-card-panel rpg-backpack-panel" aria-label="個人資料與錢包卡片">
      <header>
        <Cards size={24} weight="fill" />
        <div>
          <strong>收藏櫃</strong>
          <span>卡牌、技能、寵物插卡</span>
        </div>
        <PanelCloseButton />
      </header>

      <section className="rpg-profile-editor" aria-label="個人資料">
        <ClassPortrait classId="engineer" frame={0} />
        <div className="rpg-profile-fields">
          <label>
            <span>玩家</span>
            <input name="rpg-player-name" autoComplete="off" spellCheck={false} value={draftName} maxLength={18} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <div className="rpg-profile-wallet-row">
            <span>錢包</span>
            <strong title={walletAddress}>{shortWallet(walletAddress)}</strong>
            <em>{walletCardsStatus === "loading" ? "同步中" : `${walletCards.length} 張`}</em>
          </div>
        </div>
        <button type="button" onClick={saveProfile}>儲存</button>
      </section>

      <ElementFilter value={element} onChange={setElement} />

      <section className="rpg-bag-summary" aria-label="背包摘要">
        <article>
          <span>藏品</span>
          <strong>{walletCardsStatus === "loading" ? "…" : walletCards.length}</strong>
          <em>{formatUsd(walletCardsTotalFMV)}</em>
        </article>
        <article>
          <span>技能</span>
          <strong>{ownedCardTotal}</strong>
          <em>已綁定</em>
        </article>
        <article>
          <span>天賦</span>
          <strong>{freeSkillTotal}</strong>
          <em>寵物自帶</em>
        </article>
        <article>
          <span>插槽</span>
          <strong>{RPG_MAX_EQUIPPED_MOVES}</strong>
          <em>每隻寵物</em>
        </article>
      </section>

      <section className="rpg-wallet-card-section" aria-label="錢包卡片">
        <header>
          <strong>展示櫃</strong>
          <span>
            {walletCardsStatus === "loading"
              ? "同步藏品中…"
              : walletCardsStatus === "error"
                ? walletCardsError
                : `${visibleWalletCards.length}/${walletCards.length} 張 · ${walletCardsStale ? "快取" : walletSyncedLabel}`}
          </span>
          <div className="rpg-wallet-header-actions">
            <button type="button" onClick={() => void handleDrawAllWalletCards()} disabled={walletCardsStatus !== "ready" || unboundWalletCardCount === 0 || Boolean(bulkDrawProgress)}>
              <Sparkle size={15} weight="fill" />
              <span>{bulkDrawProgress ? `抽獎中 ${bulkDrawProgress.done}/${bulkDrawProgress.total}` : unboundWalletCardCount > 0 ? `一鍵抽獎 ${unboundWalletCardCount}` : "已全抽"}</span>
            </button>
            <button type="button" onClick={() => void fetchWalletCards(true)} disabled={walletCardsStatus === "loading" || Boolean(bulkDrawProgress)}>
              <ArrowClockwise size={15} weight="bold" />
              <span>重載</span>
            </button>
          </div>
        </header>
        {walletCardsStatus === "loading" ? (
          <div className="rpg-wallet-state">
            <Sparkle size={22} weight="fill" />
            <strong>同步藏品中…</strong>
            <span>{shortWallet(walletAddress)}</span>
          </div>
        ) : walletCardsStatus === "error" ? (
          <div className="rpg-wallet-state is-error">
            <Cards size={22} weight="fill" />
            <strong>讀取失敗</strong>
            <span>{walletCardsError}</span>
          </div>
        ) : visibleWalletCards.length === 0 ? (
          <div className="rpg-wallet-state">
            <Cards size={22} weight="fill" />
            <strong>沒有符合的卡片</strong>
            <span>切回全部或刷新卡冊。</span>
          </div>
        ) : (
          <div className="rpg-wallet-cabinet-shell">
            <nav className="rpg-wallet-tier-tabs" aria-label="卡牌階級">
              {walletTierGroups.map((group) => (
                <button
                  key={group.tier}
                  type="button"
                  className={[`is-${group.tier}`, selectedWalletTier === group.tier ? "is-active" : ""].filter(Boolean).join(" ")}
                  disabled={group.cards.length === 0}
                  aria-pressed={selectedWalletTier === group.tier}
                  onClick={() => setActiveWalletTier(group.tier)}
                >
                  <strong>{walletTierLabel(group.tier)}</strong>
                  <span>{group.cards.length} 張</span>
                  <em>{walletTierRangeLabel(group.tier)}</em>
                </button>
              ))}
            </nav>
            {selectedWalletTierGroup ? (
              <section className={`rpg-wallet-tier-section rpg-wallet-shelf is-${selectedWalletTierGroup.tier}`}>
                <header>
                  <div>
                    <strong>{walletTierLabel(selectedWalletTierGroup.tier)}</strong>
                    <span>{selectedWalletTierGroup.cards.length} 張 / {formatUsd(selectedWalletTierGroup.totalFMV)}</span>
                  </div>
                  <em>{walletTierRangeLabel(selectedWalletTierGroup.tier)}</em>
                </header>
                <div className="rpg-wallet-card-grid">
                  {selectedWalletTierGroup.cards.map((card) => {
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
                          {card.imageUrl ? <RpgPixelCardImage src={card.imageUrl} alt={card.name} /> : <span className="rpg-wallet-card-art">NO IMAGE</span>}
                          <div>
                            <small style={{ "--element": RPG_ELEMENT_META[cardElement].color } as CSSProperties}>
                              {RPG_ELEMENT_META[cardElement].label} · {walletTierShortLabel(tier)} · {boundMove ? "已綁定" : "查看"}
                            </small>
                            <strong>{card.pokemonName || card.name}</strong>
                            <span>{card.setName || card.name}</span>
                            <em>{boundMove ? `${boundMove.name} · ${tierLabel(boundMove)} · ${boundMove.energyCost} EN` : `${formatUsd(card.fmvUSD)} / ${card.attributeCandidates.grade ?? "未分級"}`}</em>
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
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>

      {battleNotice ? <p className="rpg-room-message rpg-shop-message">{battleNotice}</p> : null}
      {walletCardsStale ? <p className="rpg-room-message rpg-shop-message">使用快取卡冊：{walletCardsStaleReason ?? "外部錢包 API 暫時失敗"}</p> : null}

      <section className="rpg-card-vault" aria-label="已綁定技能卡">
        <header>
          <strong>已綁定技能卡</strong>
          <span>{element === "any" ? "全部屬性" : `${RPG_ELEMENT_META[element].label}屬性`}</span>
        </header>
        {visibleCards.length === 0 ? (
          <div className="rpg-backpack-empty">
            <Cards size={24} weight="fill" />
            <strong>還沒有這個屬性的綁定技能卡</strong>
            <span>從錢包卡冊抽取技能後，卡片會永久記錄那個招式。</span>
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
                  <span>{RPG_ELEMENT_META[move.element].label}</span>
                  <em>{walletTierLabel(walletCardTier(card))}</em>
                </header>
                <strong>{move.name}</strong>
                <p>{card.pokemonName || card.name} / {move.description}</p>
                <div className="rpg-owned-skill-stats">
                  <span>{tierLabel(move)}</span>
                  <span>能量 {move.energyCost}</span>
                  <span>{targetLabel(move.target)}</span>
                </div>
                <div className="rpg-owned-skill-effects">
                  {moveEffectLabels(move).slice(0, 4).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rpg-free-skill-section" aria-label="寵物天賦技能">
        <header>
          <strong>寵物天賦技能</strong>
          <span>免費自帶，不是背包卡片</span>
        </header>
        <div className="rpg-free-skill-grid">
          {RPG_STARTER_PETS.map((pet) => {
            const meta = RPG_ELEMENT_META[pet.element];
            return (
              <button
                key={pet.id}
                type="button"
                className={["rpg-pet-free-card", equipPetId === pet.id ? "is-selected" : ""].filter(Boolean).join(" ")}
                style={{ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties}
                onClick={() => openPetSkillEditor(pet.id)}
                aria-label={`編輯 ${pet.name} 技能`}
              >
                <RpgPetSprite element={pet.element} pose="idle" animate />
                <div className="rpg-pet-free-title">
                  <span>{meta.label} / 免費</span>
                  <strong>{pet.name}</strong>
                  <em>{equipPetId === pet.id ? "正在編輯" : "點擊編輯技能"}</em>
                </div>
                <div className="rpg-pet-free-moves">
                  {pet.startingMoveIds.map((moveId) => {
                    const move = getRpgMoveById(moveId);
                    return move ? <SkillChip key={`${pet.id}-${move.id}`} move={move} /> : null;
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <CardEquipPanel
        panelRef={skillEditorRef}
        equipPetId={equipPetId}
        setEquipPetId={setEquipPetId}
        boundCards={ownedCards}
        petCardLoadouts={petCardLoadouts}
        equipCardToPet={equipCardToPet}
        unequipCardFromPet={unequipCardFromPet}
      />
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
  if (tier === "high") return "珍藏櫃";
  if (tier === "middle") return "精選櫃";
  return "日常櫃";
}

function walletTierShortLabel(tier: WalletTier) {
  if (tier === "high") return "珍藏";
  if (tier === "middle") return "精選";
  return "日常";
}

function walletTierRangeLabel(tier: WalletTier) {
  if (tier === "high") return "$500+";
  if (tier === "middle") return "$100-499";
  return "$0-99";
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
  const cardId = walletCardKey(card);
  const cardMeta = RPG_ELEMENT_META[cardElement];
  const move = reveal?.entry.moves[0] ?? boundMove;
  const moveMeta = move ? RPG_ELEMENT_META[move.element] : cardMeta;
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
          <span>{boundMove ? "已綁定技能" : "尚未抽獎"}</span>
          <strong>{boundMove ? boundMove.name : `${cardMeta.label}屬性技能抽獎`}</strong>
          <em>{boundMove ? `${tierLabel(boundMove)} / ${boundMove.energyCost} EN` : `${card.pokemonName || card.name} / ${walletTierLabel(walletCardTier(card))}`}</em>
        </header>

        {!move ? (
          <div className="rpg-wallet-draw-ready">
            <div>
              <strong>點擊抽獎後，這張卡會永久綁定一個{cardMeta.label}屬性技能。</strong>
              <span>{openingVideo ? "抽獎會先播放屬性開場影片，再揭露技能。" : `${cardMeta.label}屬性開場影片待補，會直接揭露技能。`}</span>
            </div>
            <button type="button" onClick={() => void onDraw()}>
              <Sparkle size={18} weight="fill" />
              <span>抽取技能</span>
            </button>
          </div>
        ) : null}

        {isIntro && openingVideo ? (
          <div className="rpg-skill-opening-stage">
            <video key={`${cardId}-${move?.id}-opening`} src={openingVideo} autoPlay muted playsInline onEnded={onIntroDone} onError={onIntroDone} />
            <div>
              <span>{moveMeta.label}屬性開場</span>
              <strong>技能揭露中</strong>
            </div>
          </div>
        ) : null}

        {move && !isIntro ? <WalletBoundSkillReveal move={move} revealActive={Boolean(reveal)} /> : null}
      </div>
    </div>
  );
}

function WalletBoundSkillReveal({ move, revealActive }: { move: RpgMove; revealActive: boolean }) {
  const meta = RPG_ELEMENT_META[move.element];
  return (
    <section className={["rpg-bound-skill-reveal", revealActive ? "is-new" : ""].filter(Boolean).join(" ")} style={{ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties}>
      <div className="rpg-bound-skill-preview" aria-label={`${move.name} 技能動畫`}>
        <RpgSkillVfxSprite move={move} className="rpg-bound-skill-vfx" />
      </div>
      <div className="rpg-bound-skill-copy">
        <span>{meta.label} / {tierLabel(move)} / {targetLabel(move.target)}</span>
        <strong>{move.name}</strong>
        <p>{move.description}</p>
        <dl>
          <div>
            <dt>傷害</dt>
            <dd>{move.power > 0 ? move.power : "無"}</dd>
          </div>
          <div>
            <dt>能量</dt>
            <dd>{move.energyCost} EN</dd>
          </div>
          <div>
            <dt>速度</dt>
            <dd>{move.speed}</dd>
          </div>
          <div>
            <dt>動畫</dt>
            <dd>{move.animation.name}</dd>
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

function CardEquipPanel({
  panelRef,
  equipPetId,
  setEquipPetId,
  boundCards,
  petCardLoadouts,
  equipCardToPet,
  unequipCardFromPet
}: {
  panelRef?: RefObject<HTMLElement | null>;
  equipPetId: string;
  setEquipPetId: (petId: string) => void;
  boundCards: BoundWalletSkillCard[];
  petCardLoadouts: Record<string, string[]>;
  equipCardToPet: (definitionId: string, cardId: string) => Promise<void>;
  unequipCardFromPet: (definitionId: string, cardId: string) => Promise<void>;
}) {
  const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === equipPetId) ?? RPG_STARTER_PETS[0];
  if (!pet) return null;

  const petMeta = RPG_ELEMENT_META[pet.element];
  const equippedCardIds = (petCardLoadouts[pet.id] ?? []).slice(0, RPG_MAX_EQUIPPED_MOVES);
  const equippedCards = equippedCardIds.flatMap((cardId) => {
    const boundCard = boundCards.find((candidate) => candidate.cardId === cardId);
    return boundCard && boundCard.move.element === pet.element ? [boundCard] : [];
  });
  const availableCards = boundCards
    .filter(({ move }) => move.element === pet.element)
    .sort((a, b) => a.move.tierIndex - b.move.tierIndex || a.move.energyCost - b.move.energyCost || a.card.name.localeCompare(b.card.name));

  return (
    <section ref={panelRef} className="rpg-card-equip-panel rpg-skill-library" aria-label="寵物技能編輯">
      <header>
        <div>
          <strong>技能編輯：{pet.name}</strong>
          <span>{petMeta.label}屬性，會自動列出可用卡片技能，額外最多插 {RPG_MAX_EQUIPPED_MOVES} 張卡</span>
        </div>
        <div className="rpg-library-pets" role="list" aria-label="選擇寵物">
          {RPG_STARTER_PETS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={candidate.id === pet.id ? "is-selected" : ""}
              onClick={() => setEquipPetId(candidate.id)}
              style={{ "--element": RPG_ELEMENT_META[candidate.element].color, "--element-soft": RPG_ELEMENT_META[candidate.element].accent } as CSSProperties}
            >
              {RPG_ELEMENT_META[candidate.element].label}
            </button>
          ))}
        </div>
      </header>

      <div className="rpg-equipped-card-slots" style={{ "--element": petMeta.color, "--element-soft": petMeta.accent } as CSSProperties}>
        {Array.from({ length: RPG_MAX_EQUIPPED_MOVES }).map((_, index) => {
          const equipped = equippedCards[index];
          return equipped ? (
            <button key={equipped.cardId} type="button" className="rpg-equipped-card-slot is-filled" onClick={() => void unequipCardFromPet(pet.id, equipped.cardId)} title="卸下卡片">
              {equipped.card.imageUrl ? <RpgPixelCardImage src={equipped.card.imageUrl} alt={equipped.card.name} /> : null}
              <span>
                <strong>{equipped.move.name}</strong>
                <em>{equipped.card.pokemonName || equipped.card.name}</em>
              </span>
            </button>
          ) : (
            <div key={`empty-${pet.id}-${index}`} className="rpg-equipped-card-slot is-empty">
              <b>{index + 1}</b>
              <span>空插槽</span>
            </div>
          );
        })}
      </div>

      <div className="rpg-card-equip-list">
        {availableCards.length === 0 ? (
          <div className="rpg-library-empty">
            <Cards size={18} weight="fill" />
            <span>尚未有{petMeta.label}屬性已綁定卡片</span>
          </div>
        ) : (
          availableCards.map(({ card, cardId, move }) => {
            const equipped = equippedCardIds.includes(cardId);
            return (
              <button key={cardId} type="button" className={equipped ? "is-equipped" : ""} onClick={() => void (equipped ? unequipCardFromPet(pet.id, cardId) : equipCardToPet(pet.id, cardId))}>
                {card.imageUrl ? <RpgPixelCardImage src={card.imageUrl} alt={card.name} /> : null}
                <span>
                  <strong>{move.name}</strong>
                  <em>{card.pokemonName || card.name}</em>
                </span>
                <b>{equipped ? "已插" : "插入"}</b>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function SkillLibraryPanel({
  equipPetId,
  setEquipPetId,
  skillInventory,
  petMoveLoadouts,
  equipMoveToPet,
  unequipMoveFromPet
}: {
  equipPetId: string;
  setEquipPetId: (petId: string) => void;
  skillInventory: Record<string, number>;
  petMoveLoadouts: Record<string, string[]>;
  equipMoveToPet: (definitionId: string, moveId: string) => void;
  unequipMoveFromPet: (definitionId: string, moveId: string) => void;
}) {
  const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === equipPetId) ?? RPG_STARTER_PETS[0];
  if (!pet) return null;

  const petMeta = RPG_ELEMENT_META[pet.element];
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
    <section className="rpg-skill-library" aria-label="招式庫">
      <header>
        <div>
          <strong>技能裝備</strong>
          <span>{petMeta.label}屬性，天賦免費 / 卡片來自背包</span>
        </div>
        <div className="rpg-library-pets" role="list" aria-label="選擇寵物">
          {RPG_STARTER_PETS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={candidate.id === pet.id ? "is-selected" : ""}
              onClick={() => setEquipPetId(candidate.id)}
              style={{ "--element": RPG_ELEMENT_META[candidate.element].color, "--element-soft": RPG_ELEMENT_META[candidate.element].accent } as CSSProperties}
            >
              {RPG_ELEMENT_META[candidate.element].label}
            </button>
          ))}
        </div>
      </header>

      <div className="rpg-equipped-moves">
        <strong>{pet.name} 目前裝備</strong>
        <div>
          {equippedMoveIds.map((moveId) => {
            const move = getRpgMoveById(moveId);
            if (!move) return null;
            const source = pet.startingMoveIds.includes(move.id) ? "天賦" : "卡片";
            return (
              <button key={`${pet.id}-${move.id}`} type="button" className={source === "天賦" ? "is-free-skill" : "is-card-skill"} onClick={() => unequipMoveFromPet(pet.id, move.id)} title="卸下招式">
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
            <span>尚未取得{petMeta.label}屬性技能卡</span>
          </div>
        ) : (
          availableMoves.map(({ move, count, source }) => {
            const equipped = equippedMoveIds.includes(move.id);
            return (
              <button key={move.id} type="button" className={[equipped ? "is-equipped" : "", source === "free" ? "is-free-skill" : "is-card-skill"].filter(Boolean).join(" ")} onClick={() => equipMoveToPet(pet.id, move.id)} disabled={equipped}>
                <SkillChip move={move} />
                <em>{source === "free" ? "免費" : `x${count}`}</em>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function ticketBandLabel(ticket: RpgSkillTicket) {
  if (ticket.id === "ticket_ten_card") return "高價十連卡";
  if (ticket.cardPriceBand === "low") return "便宜卡片";
  if (ticket.cardPriceBand === "middle") return "中價卡片";
  return "高價卡片";
}

function tierLabel(move: RpgMove) {
  if (move.tier === "basic") return "初階";
  if (move.tier === "intermediate") return "中階";
  return "高階";
}

function tierName(tier: RpgMove["tier"]) {
  if (tier === "basic") return "初階";
  if (tier === "intermediate") return "中階";
  return "高階";
}

function targetLabel(target: RpgMove["target"]) {
  if (target === "singleEnemy") return "單體";
  if (target === "allEnemies") return "敵全體";
  if (target === "singleAlly") return "隊友";
  if (target === "allAllies") return "我方全體";
  return "自身";
}

function moveEffectLabels(move: RpgMove) {
  const labels: string[] = [];
  if (move.power > 0) labels.push(`傷害 ${move.power}`);
  move.effects.forEach((effect) => {
    if (effect.heal) labels.push(`${effect.target === "team" ? "全隊回血" : "回血"} ${effect.heal}`);
    if (effect.cleanse) labels.push("淨化");
    if (effect.status === "guard") labels.push(`${effect.target === "team" ? "全隊防護" : "防護"} ${effect.power ?? 0} / ${effect.duration ?? 1}T`);
    if (effect.status === "regen") labels.push(`${effect.target === "team" ? "全隊再生" : "再生"} ${effect.power ?? 0} x${effect.duration ?? 1}T`);
    if (effect.status === "burn" || effect.status === "poison") labels.push(`${statusShortLabel(effect.status)} ${effect.power ?? 0} x${effect.duration ?? 1}T`);
    if (effect.status === "stun") labels.push(`暈眩 ${effect.duration ?? 1}T`);
    if (effect.selfDamage) labels.push(`自損 ${effect.selfDamage}`);
  });
  return labels.length > 0 ? labels : ["純效果"];
}

function DrawCeremony({ entry, preferredElement }: { entry: RpgDrawHistoryEntry | null; preferredElement?: RpgElement }) {
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
          <span>{ticket ? ticketBandLabel(ticket) : "卡片"}</span>
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
              <span>{entry.ticketLabel}</span>
              <strong>{leadMove.name}</strong>
              <em>{RPG_ELEMENT_META[leadMove.element].label} / {tierLabel(leadMove)}</em>
            </header>
            <div className="rpg-draw-reveal-grid">
              {entry.moves.map((move, index) => (
                <span
                  key={`${entry.id}-${move.id}-${index}`}
                  className={`rpg-draw-reveal-card tier-${move.tier}`}
                  data-element={move.element}
                  data-tier={move.tier}
                  style={{ "--element": RPG_ELEMENT_META[move.element].color, "--element-soft": RPG_ELEMENT_META[move.element].accent, "--reveal-delay": `${index * 55}ms` } as CSSProperties}
                  title={move.description}
                >
                  <b>{RPG_ELEMENT_META[move.element].label}</b>
                  <strong>{move.name}</strong>
                  <em>{tierLabel(move)}</em>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="rpg-draw-idle-copy">
            <Sparkle size={19} weight="fill" />
            <strong>等待卡片轉券</strong>
            <span>{preferredElement ? `${RPG_ELEMENT_META[preferredElement].label}屬性池` : "五屬性技能池"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function GymPanel() {
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
  const fetchWalletCards = useRpgStore((state) => state.fetchWalletCards);
  const equipCardToPet = useRpgStore((state) => state.equipCardToPet);
  const unequipCardFromPet = useRpgStore((state) => state.unequipCardFromPet);
  const battleNotice = useRpgStore((state) => state.battleNotice);
  const [roomCode, setRoomCode] = useState("");
  const [equipPetId, setEquipPetId] = useState(selectedPartyPetIds[0] ?? RPG_STARTER_PETS[0]?.id ?? "");
  const [showSkillEditor, setShowSkillEditor] = useState(false);
  const gymTutorial = useFirstRunTutorial("gym");
  const connecting = versusConnection === "connecting";
  const partyReady = selectedPartyPetIds.length === 3;
  const selectedAiConfig = RPG_AI_DIFFICULTY_CONFIGS[selectedAiDifficulty];
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
    setShowSkillEditor(true);
  };
  useEffect(() => {
    const firstPartyPetId = selectedPartyPetIds[0];
    if (firstPartyPetId && !selectedPartyPetIds.includes(equipPetId)) {
      setEquipPetId(firstPartyPetId);
    }
  }, [equipPetId, selectedPartyPetIds]);
  useEffect(() => {
    void fetchWalletCards();
  }, [fetchWalletCards]);
  return (
    <>
      <aside className="rpg-panel rpg-gym-panel" aria-label="道館">
        <header>
          <FlagBanner size={24} weight="fill" />
          <div>
            <strong>道館</strong>
            <span>AI 配對 / 房間碼真人對戰</span>
          </div>
          <PanelCloseButton />
        </header>
        <div className="rpg-panel-help-row">
          <button type="button" className="rpg-tutorial-button" onClick={gymTutorial.openTutorial}>
            <Question size={16} weight="bold" />
            <span>教學</span>
          </button>
          <span>先組 3v3 隊伍；點已上場寵物可編輯牠能使用的卡片技能。</span>
        </div>
        <PartySelection editingPetId={showSkillEditor ? equipPetId : null} onEditPet={openPartySkillEditor} />
        {showSkillEditor ? (
          <CardEquipPanel
            equipPetId={equipPetId}
            setEquipPetId={setEquipPetId}
            boundCards={boundCards}
            petCardLoadouts={petCardLoadouts}
            equipCardToPet={equipCardToPet}
            unequipCardFromPet={unequipCardFromPet}
          />
        ) : null}
        <section className="rpg-ai-difficulty-selector" aria-label="AI 難度">
          <header>
            <strong>AI 對戰</strong>
            <span>{selectedAiConfig.title}</span>
          </header>
          <div>
            {RPG_AI_DIFFICULTIES.map((difficulty) => {
              const config = RPG_AI_DIFFICULTY_CONFIGS[difficulty];
              return (
                <button
                  key={difficulty}
                  type="button"
                  className={difficulty === selectedAiDifficulty ? "is-selected" : ""}
                  data-ai-difficulty={difficulty}
                  onClick={() => setAiDifficulty(difficulty)}
                >
                  <span>{config.label}</span>
                  <strong>{config.title}</strong>
                  <em>{config.description}</em>
                </button>
              );
            })}
          </div>
        </section>
        <div className="rpg-gym-modes">
          <button type="button" disabled={!partyReady} onClick={() => startAiBattle(selectedAiDifficulty)}>
            <Robot size={25} weight="fill" />
            <span>AI 對戰</span>
            <strong>AI 配對 / {selectedAiConfig.label}</strong>
          </button>
          <button type="button" disabled={connecting || !partyReady} onClick={() => void createVersusRoom()}>
            <UsersThree size={25} weight="fill" />
            <span>真人對戰</span>
            <strong>{connecting ? "連線中" : "建立房間"}</strong>
          </button>
        </div>
        <div className="rpg-room-join">
          <label>
            <span>房間代碼</span>
            <input value={roomCode} maxLength={8} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABCDE" />
          </label>
          <button type="button" disabled={connecting || !partyReady || roomCode.trim().length < 3} onClick={() => void joinVersusRoom(roomCode)}>
            加入真人房
          </button>
        </div>
        {battleNotice ? <p className="rpg-room-message">{battleNotice}</p> : null}
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
  const ownedPetIds = useRpgStore((state) => state.ownedPetIds);
  const selectedPartyPetIds = useRpgStore((state) => state.selectedPartyPetIds);
  const togglePartyPet = useRpgStore((state) => state.togglePartyPet);

  return (
    <section className="rpg-gym-party" aria-label="上場隊伍">
      <header>
        <strong>上場隊伍</strong>
        <span>{selectedPartyPetIds.length}/3</span>
      </header>
      <div className="rpg-party-formation-board" aria-label="道館站位">
        {PARTY_FORMATION_SLOTS.map((slot, index) => {
          const petId = selectedPartyPetIds[index];
          const pet = petId ? getStarterPetById(petId) : null;
          const meta = pet ? RPG_ELEMENT_META[pet.element] : null;
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
                  <b>{pet.name}</b>
                  <em>{editingPetId === pet.id ? "技能編輯中" : meta?.label}</em>
                  {onEditPet ? (
                    <button
                      type="button"
                      className="rpg-party-slot-edit"
                      title="編輯技能"
                      aria-label={`編輯 ${pet.name} 技能`}
                      onClick={() => onEditPet(pet.id)}
                    >
                      技能
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rpg-party-slot-remove"
                    title="移出隊伍"
                    aria-label={`將 ${pet.name} 移出隊伍`}
                    onClick={() => togglePartyPet(pet.id)}
                  >
                    <X size={13} weight="bold" />
                  </button>
                </>
              ) : (
                <b>空位</b>
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
              <span>{meta.label}</span>
              <strong>{pet.name}</strong>
              <em>{editingPetId === pet.id ? "編輯技能" : selected ? PARTY_FORMATION_SLOTS[selectedIndex]?.label ?? `出場 ${selectedIndex + 1}` : "待命"}</em>
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

function BattlePanel() {
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
  const currentActor = useMemo(() => (battle ? getRpgCurrentTurnActor(battle) : null), [battle]);
  const usesSingleActorFlow = true;
  const currentLeftActor = currentActor?.side === "left" ? currentActor : null;
  const reachableEnemyIds = useMemo(
    () => new Set(battle && currentLeftActor ? getRpgReachableEnemyTargets(battle, currentLeftActor).map((pet) => pet.id) : []),
    [battle, currentLeftActor]
  );
  const replaySequence = useMemo(() => (battle ? buildBattleReplaySequence(battle) : []), [battle]);
  const replaySequenceKey = useMemo(() => replaySequence.map((entry) => entry.key).join("|"), [replaySequence]);
  const [replayStepIndex, setReplayStepIndex] = useState(0);
  const replayStep = replaySequence.length > 0 ? Math.min(replayStepIndex, replaySequence.length - 1) : 0;
  const replay = replaySequence[replayStep] ?? null;
  const impactTargetIds = useMemo(() => new Set(replay?.impactTargetIds ?? []), [replay]);
  const [selectedCommandActorId, setSelectedCommandActorId] = useState<string | null>(null);
  const commandPets = usesSingleActorFlow
    ? currentLeftActor && selectedCommandActorId === currentLeftActor.id
      ? [currentLeftActor]
      : []
    : leftLiving;
  const allReady = battle
    ? usesSingleActorFlow
      ? Boolean(currentLeftActor && pendingActions[currentLeftActor.id])
      : leftLiving.every((pet) => pendingActions[pet.id])
    : false;
  const selfSubmitted = battleMode === "versus" && Boolean(versusPlayerId && versusSubmittedPlayerIds.includes(versusPlayerId));
  const selfRematchReady = battleMode === "versus" && Boolean(versusPlayerId && versusRematchRequestedPlayerIds.includes(versusPlayerId));
  const versusLocked = battleMode === "versus" && (versusConnection === "connecting" || versusConnection === "reconnecting" || versusConnection === "error");
  const aiConfig = activeAiDifficulty ? RPG_AI_DIFFICULTY_CONFIGS[activeAiDifficulty] : null;
  const actionStatus = battleNotice ?? (versusLocked ? "真人道館重新同步中" : selfSubmitted ? "已送出，等待同步" : allReady ? "選招完成" : currentLeftActor ? `輪到 ${currentLeftActor.name}` : "等待對手行動");
  const actionDetail = currentLeftActor
    ? `EN ${currentLeftActor.energy}/${currentLeftActor.maxEnergy}${pendingActions[currentLeftActor.id] ? " / 已選招" : " / 點寵物展開招式"}`
    : currentActor
      ? `${currentActor.name} 正在行動`
      : "等待下一位行動者";
  const walletCardById = useMemo(() => new Map(walletCards.map((card) => [walletCardKey(card), card])), [walletCards]);
  const localCardSide = battleMode === "versus" ? versusPlayerSide : "left";
  const equippedCardsForPet = (pet: RpgBattlePetState, side: "left" | "right") => {
    if (side !== localCardSide) return [];
    return (petCardLoadouts[pet.definitionId] ?? []).flatMap((cardId) => {
      const card = walletCardById.get(cardId);
      const move = getRpgMoveById(cardSkillBindings[cardId]);
      return card && move && move.element === pet.element ? [card] : [];
    }).slice(0, RPG_MAX_EQUIPPED_MOVES);
  };

  useEffect(() => {
    setReplayStepIndex(0);
  }, [replaySequenceKey]);

  useEffect(() => {
    setSelectedCommandActorId(null);
  }, [battle?.id, battle?.turn, currentActor?.id]);

  useEffect(() => {
    const currentReplay = replaySequence[replayStep];
    if (!currentReplay || replayStep >= replaySequence.length - 1) return undefined;
    const timeout = window.setTimeout(() => {
      setReplayStepIndex((index) => Math.min(index + 1, replaySequence.length - 1));
    }, replayStepDuration(currentReplay));
    return () => window.clearTimeout(timeout);
  }, [replaySequence, replayStep]);

  useEffect(() => {
    if (!usesSingleActorFlow || battleMode !== "ai" || !battle || battle.winner || currentActor?.side !== "right") return undefined;
    const timeout = window.setTimeout(() => resolveBattleTurn(), 920);
    return () => window.clearTimeout(timeout);
  }, [battle, battleMode, currentActor?.id, currentActor?.side, resolveBattleTurn, usesSingleActorFlow]);

  if (!battle && battleMode === "versus") {
    return (
      <aside className="rpg-panel rpg-battle-panel" aria-label="真人道館等待">
        <header>
          <UsersThree size={24} weight="fill" />
          <div>
            <strong>真人道館</strong>
            <span>{versusRoomCode ? `ROOM ${versusRoomCode}` : versusConnection === "reconnecting" ? "RECONNECTING" : "CONNECTING"}</span>
          </div>
          <button className="rpg-panel-close" type="button" title="Back" aria-label="Back" onClick={resetBattle}>
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
          <strong>{versusRoomCode ?? "建立房間中"}</strong>
          <span>{battleNotice ?? (versusConnection === "reconnecting" ? "重新連線中。" : "等待另一位玩家加入。")}</span>
        </div>
      </aside>
    );
  }

  if (!battle) return null;

  return (
    <section className="rpg-battle-screen" aria-label="道館對戰" data-ai-difficulty={activeAiDifficulty ?? ""}>
      <header className="rpg-battle-scene-header">
        {battleMode === "versus" ? <UsersThree size={22} weight="fill" /> : <Sword size={22} weight="fill" />}
        <div>
          <strong>{battleMode === "versus" ? "真人道館" : aiConfig ? `${aiConfig.label} AI 道館` : "AI 道館"}</strong>
          <span>{battleMode === "versus" && versusRoomCode ? `ROOM ${versusRoomCode} / TURN ${battle.turn}` : `${aiConfig?.title ?? "本地道館"} / TURN ${battle.turn}`}</span>
        </div>
        <button className="rpg-panel-close" type="button" title="Back" aria-label="Back" onClick={resetBattle}>
          <X size={18} weight="bold" />
        </button>
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

      <div className="rpg-battle-field">
        {battle.left.map((pet, index) => (
          <BattleFieldPet
            key={pet.id}
            pet={pet}
            side="left"
            slot={index}
            sideLabel="我方"
            selected={selectedAllyId === pet.id}
            current={currentActor?.id === pet.id}
            onSelect={pet.defeated ? undefined : () => {
              selectAllyTarget(pet.id);
              if (usesSingleActorFlow && currentActor?.id === pet.id) setSelectedCommandActorId(pet.id);
            }}
            acting={replay?.actorId === pet.id}
            impacted={impactTargetIds.has(pet.id)}
            floatingEntries={floatingEntriesForPet(replay, pet.id)}
            equippedCards={equippedCardsForPet(pet, "left")}
          />
        ))}
        {battle.right.map((pet, index) => {
          const canSelectEnemy = Boolean(currentLeftActor && !pet.defeated && reachableEnemyIds.has(pet.id));
          return (
            <BattleFieldPet
              key={pet.id}
              pet={pet}
              side="right"
              slot={index}
              sideLabel="敵方"
              selected={selectedEnemyId === pet.id && canSelectEnemy}
              current={currentActor?.id === pet.id}
              onSelect={canSelectEnemy ? () => selectEnemyTarget(pet.id) : undefined}
              acting={replay?.actorId === pet.id}
              impacted={impactTargetIds.has(pet.id)}
              floatingEntries={floatingEntriesForPet(replay, pet.id)}
              equippedCards={equippedCardsForPet(pet, "right")}
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
            <div className={["rpg-command-board", usesSingleActorFlow ? "is-single" : ""].filter(Boolean).join(" ")}>
              {usesSingleActorFlow && !currentLeftActor ? (
                <CommandPlaceholder
                  pet={currentActor}
                  eyebrow={battleMode === "versus" ? "對手回合" : "敵方回合"}
                  title={currentActor ? `${currentActor.name} 行動中` : "等待行動者"}
                  detail={battleMode === "versus" ? "等待對手選擇招式。" : "AI 正在選擇招式。"}
                />
              ) : null}
              {usesSingleActorFlow && currentLeftActor && commandPets.length === 0 ? (
                <CommandPlaceholder
                  pet={currentLeftActor}
                  eyebrow="我方回合"
                  title={currentLeftActor.name}
                  detail="點選場上的這隻寵物後顯示招式。"
                />
              ) : null}
              {commandPets.map((pet) => (
                <article
                  key={pet.id}
                  className="rpg-command-row"
                  data-actor-id={pet.id}
                  data-pending-target-id={pendingActions[pet.id]?.targetId ?? ""}
                >
                  <header>
                    <strong>{pet.name}</strong>
                    <span>EN {pet.energy}/{pet.maxEnergy}</span>
                    {pendingActions[pet.id] && !selfSubmitted ? (
                      <button type="button" onClick={() => clearBattleAction(pet.id)}>
                        重選
                      </button>
                    ) : null}
                  </header>
                  <div className="rpg-move-list">
                    {pet.moveIds.map((moveId) => {
                      const move = getRpgMoveById(moveId);
                      if (!move) return null;
                      const disabled = selfSubmitted || versusLocked || pet.energy < move.energyCost;
                      const active = pendingActions[pet.id]?.moveId === move.id;
                      return (
                        <button
                          key={move.id}
                          type="button"
                          className={active ? "is-selected" : ""}
                          disabled={disabled}
                          onClick={() => selectBattleMove(pet.id, move.id)}
                          style={{ "--element": RPG_ELEMENT_META[move.element].color } as CSSProperties}
                        >
                          <span>{RPG_ELEMENT_META[move.element].label}</span>
                          <strong>{move.name}</strong>
                          <em>{move.energyCost} EN</em>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>

            <footer className="rpg-battle-actions">
              <div>
                <span>指令狀態</span>
                <strong>{actionStatus}</strong>
                <em>{actionDetail}</em>
              </div>
              <button type="button" disabled={!allReady || selfSubmitted || versusLocked} onClick={resolveBattleTurn}>
                {battleMode === "versus" ? "送出選招" : "執行"}
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
  if (side === "left") return "左席";
  if (side === "right") return "右席";
  return "席位同步中";
}

function versusStatusLabel(connection: RpgVersusConnection, roomStatus: RpgVersusRoomStatus | null) {
  if (connection === "connecting") return "連線中";
  if (connection === "reconnecting") return "重連中";
  if (connection === "error") return "連線錯誤";
  if (roomStatus === "waiting") return "等待對手";
  if (roomStatus === "opponentDisconnected") return "對手離線";
  if (roomStatus === "finished") return "結算";
  return "選招中";
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
  const statusLabel = versusStatusLabel(connection, roomStatus);
  const battleOpen = roomStatus === "selecting" || roomStatus === "opponentDisconnected";
  const progressLabel = roomStatus === "finished" ? "再戰" : battleOpen ? "選招" : "開局";
  const progressValue = roomStatus === "finished" ? `${Math.min(rematchReadyCount, 2)}/2` : battleOpen ? `${Math.min(submittedCount, 2)}/2` : opponentConnected ? "2/2" : "1/2";
  const progressDetail = roomStatus === "finished"
    ? selfRematchReady ? "你已準備" : opponentConnected ? "等待再戰" : "等待重連"
    : battleOpen
      ? selfSubmitted ? "你已送出" : "待你選招"
      : opponentConnected ? "雙方就位" : "等待加入";

  return (
    <section
      className={["rpg-versus-status-rail", `is-${placement}`, roomStatus ? `status-${roomStatus}` : "", `conn-${connection}`].filter(Boolean).join(" ")}
      data-room-status={roomStatus ?? connection}
      data-connection={connection}
      data-self-submitted={selfSubmitted ? "true" : "false"}
      data-submitted-count={String(submittedCount)}
      data-opponent-connected={opponentConnected ? "true" : "false"}
      data-rematch-ready-count={String(rematchReadyCount)}
      aria-label="真人對戰狀態"
    >
      <div>
        <span>房間</span>
        <strong>{roomCode ?? "建立中"}</strong>
        <em>{connection === "reconnecting" ? "同步中" : "ROOM"}</em>
      </div>
      <div>
        <span>席位</span>
        <strong>{versusSideLabel(playerSide)}</strong>
        <em>{playerName ?? "我方"}</em>
      </div>
      <div>
        <span>對手</span>
        <strong>{opponentName ?? "等待加入"}</strong>
        <em>{opponentConnected ? "在線" : roomStatus === "waiting" ? "未加入" : "離線保留"}</em>
      </div>
      <div>
        <span>狀態</span>
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
  const resultLabel = winner === "draw" ? "平手" : winner === "left" ? "勝利" : "敗北";
  const resultTone = winner === "draw" ? "draw" : winner === "left" ? "win" : "loss";
  const opponentLabel = opponentName ?? "對手";
  const versus = battleMode === "versus";
  return (
    <section className={`rpg-battle-result-panel is-${resultTone}`} aria-label="戰鬥結果">
      <div className="rpg-result-emblem">
        {versus ? <UsersThree size={24} weight="fill" /> : <Sword size={24} weight="fill" />}
      </div>
      <div className="rpg-result-copy">
        <span>{versus ? "真人道館結果" : "AI 道館結果"}</span>
        <strong>{resultLabel}</strong>
        <em>{battleNotice ?? (versus ? `${opponentLabel}${opponentConnected ? "在線" : "離線，房間保留中"}` : "戰鬥已結束")}</em>
      </div>
      {versus ? (
        <div className="rpg-rematch-status" aria-live="polite">
          <span>再戰準備</span>
          <strong>{Math.min(rematchReadyCount, 2)}/2</strong>
          <em>{selfRematchReady ? "你已準備" : opponentConnected ? "等待確認" : "等待對手重連"}</em>
        </div>
      ) : null}
      <div className="rpg-result-actions">
        {versus ? (
          <button type="button" className="rpg-rematch-button" disabled={selfRematchReady || rematchLocked} onClick={onRematch}>
            <ArrowClockwise size={18} weight="bold" />
            <span>{selfRematchReady ? "等待對手" : "準備再戰"}</span>
          </button>
        ) : null}
        <button type="button" onClick={onLeave}>
          <FlagBanner size={18} weight="fill" />
          <span>回道館</span>
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
  impacted = false,
  floatingEntries = [],
  equippedCards = []
}: {
  pet: RpgBattlePetState;
  side: "left" | "right";
  slot: number;
  sideLabel: string;
  selected: boolean;
  current?: boolean;
  onSelect?: () => void;
  acting?: boolean;
  impacted?: boolean;
  floatingEntries?: RpgBattleFloatingEntry[];
  equippedCards?: RpgWalletCard[];
}) {
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
    impacted ? "is-impacted" : "",
    pet.statuses.length > 0 ? "has-statuses" : ""
  ].filter(Boolean).join(" ");
  const content = (
      <>
        {equippedCards.length > 0 ? (
          <div className="rpg-field-card-stack" aria-hidden="true">
            {equippedCards.map((card) => (
              card.imageUrl ? <RpgPixelCardImage key={walletCardKey(card)} src={card.imageUrl} alt={card.name} /> : <span key={walletCardKey(card)} />
            ))}
          </div>
        ) : null}
        <RpgPetSprite element={pet.element} pose={petPose} frame={acting ? 2 : 0} className="rpg-field-pet-sprite" />
        <BattleStatusEffects statuses={pet.statuses} />
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
            {statusShortLabel(status.id)}
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
    "--element-soft": element.accent
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
  return (
    <span className="rpg-skill-chip" data-element={move.element} data-tier={move.tier} style={{ "--element": RPG_ELEMENT_META[move.element].color } as CSSProperties}>
      <b>{RPG_ELEMENT_META[move.element].label}</b>
      <strong>{move.name}</strong>
      <em>{move.tier === "basic" ? "初" : move.tier === "intermediate" ? "中" : "高"}</em>
    </span>
  );
}

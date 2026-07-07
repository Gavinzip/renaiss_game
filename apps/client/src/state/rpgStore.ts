import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  RPG_ELEMENT_META,
  RPG_INITIAL_SKILL_TICKET_INVENTORY,
  RPG_STARTER_PETS,
  createAiRpgActions,
  createRpgAiRoster,
  createRpgBattleState,
  createStarterRoster,
  drawRpgSkillTicket,
  getRpgBattleEnergyForTurn,
  getRpgAiDifficultyConfig,
  getRpgDefaultTargetIdForMove,
  getRpgMoveById,
  getRpgReachableEnemyTargets,
  getRpgSkillTicket,
  isRpgAiDifficulty,
  resolveRpgBattleTurn,
  type RpgAiDifficulty,
  type RpgBattleAction,
  type RpgBattlePetState,
  type RpgBattleState,
  type RpgElement,
  type RpgMove,
  type RpgRosterSelection,
  type RpgVersusSnapshot
} from "@renaiss-game/shared";
import { RPG_DEFAULT_WALLET_ADDRESS, drawRpgWalletCardSkill, equipRpgWalletCard, fetchRpgWalletCards, unequipRpgWalletCard, type RpgWalletCard } from "../api/rpgWalletCards";
import { RpgBattleSocket } from "../game/network/RpgBattleSocket";

export type RpgLocation = "village" | "house";
export type RpgPlace = "shop" | "gym" | "arena" | "house" | "cabinet" | "houseExit";
export type RpgScreen = RpgLocation | "profile" | "shop" | "bag" | "gym" | "battle";
export type RpgBattleMode = "ai" | "versus";
export type RpgVersusConnection = "idle" | "connecting" | "waiting" | "connected" | "reconnecting" | "error";
export type RpgVersusRoomStatus = RpgVersusSnapshot["status"];
export type RpgWalletCardsStatus = "idle" | "loading" | "ready" | "error";

export interface RpgDrawHistoryEntry {
  id: string;
  ticketId: string;
  ticketLabel: string;
  createdAt: number;
  moves: RpgMove[];
}

interface PendingBattleAction {
  moveId: string;
  targetId?: string;
}

interface RpgStore {
  playerName: string;
  activeLocation: RpgLocation;
  screen: RpgScreen;
  nearPlace: RpgPlace | null;
  ownedPetIds: string[];
  selectedPartyPetIds: string[];
  walletAddress: string;
  walletCards: RpgWalletCard[];
  walletCardsStatus: RpgWalletCardsStatus;
  walletCardsError: string | null;
  walletCardsFetchedAt: number | null;
  walletCardsTotalFMV: number;
  walletCardsScannedRows: number;
  walletCardsSource: string | null;
  walletCardsStale: boolean;
  walletCardsStaleReason: string | null;
  ticketInventory: Record<string, number>;
  skillInventory: Record<string, number>;
  petMoveLoadouts: Record<string, string[]>;
  cardSkillBindings: Record<string, string>;
  petCardLoadouts: Record<string, string[]>;
  selectedAiDifficulty: RpgAiDifficulty;
  activeAiDifficulty: RpgAiDifficulty | null;
  drawHistory: RpgDrawHistoryEntry[];
  activeBattle: RpgBattleState | null;
  battleMode: RpgBattleMode | null;
  versusConnection: RpgVersusConnection;
  versusRoomCode: string | null;
  versusPlayerId: string | null;
  versusPlayerName: string | null;
  versusPlayerSide: "left" | "right" | null;
  versusRoomStatus: RpgVersusRoomStatus | null;
  versusOpponentName: string | null;
  versusOpponentConnected: boolean;
  versusSubmittedPlayerIds: string[];
  versusRematchRequestedPlayerIds: string[];
  pendingActions: Record<string, PendingBattleAction>;
  selectedEnemyId: string | null;
  selectedAllyId: string | null;
  battleNotice: string | null;
  setPlayerName: (name: string) => void;
  setNearPlace: (place: RpgPlace | null) => void;
  openProfile: () => void;
  openShop: () => void;
  openBag: () => void;
  openGym: () => void;
  openArena: () => void;
  enterHouse: () => void;
  exitHouse: () => void;
  closePanel: () => void;
  fetchWalletCards: (force?: boolean) => Promise<void>;
  togglePartyPet: (definitionId: string) => void;
  movePartyPetSlot: (fromIndex: number, toIndex: number) => void;
  equipMoveToPet: (definitionId: string, moveId: string) => void;
  unequipMoveFromPet: (definitionId: string, moveId: string) => void;
  drawSkill: (ticketId: string, preferredElement?: RpgElement) => RpgDrawHistoryEntry | null;
  drawWalletCardSkill: (cardId: string) => Promise<RpgDrawHistoryEntry | null>;
  equipCardToPet: (definitionId: string, cardId: string) => Promise<void>;
  unequipCardFromPet: (definitionId: string, cardId: string) => Promise<void>;
  setAiDifficulty: (difficulty: RpgAiDifficulty) => void;
  startAiBattle: (difficulty?: RpgAiDifficulty) => void;
  createVersusRoom: () => Promise<void>;
  joinVersusRoom: (roomCode: string) => Promise<void>;
  requestVersusRematch: () => void;
  selectEnemyTarget: (targetId: string) => void;
  selectAllyTarget: (targetId: string) => void;
  selectBattleMove: (actorId: string, moveId: string) => void;
  clearBattleAction: (actorId: string) => void;
  resolveBattleTurn: () => void;
  resetBattle: () => void;
}

let versusSocket: RpgBattleSocket | null = null;
const STARTER_PET_IDS = RPG_STARTER_PETS.map((pet) => pet.id);
export const RPG_MAX_EQUIPPED_MOVES = 5;
const RPG_PROGRESS_STORAGE_KEY = "renaiss-rpg-progress-v1";
type RpgPersistedProgress = Pick<
  RpgStore,
  "playerName" | "ownedPetIds" | "selectedPartyPetIds" | "ticketInventory" | "skillInventory" | "petMoveLoadouts" | "selectedAiDifficulty" | "drawHistory"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

function sanitizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function sanitizePetIds(value: unknown, fallback: readonly string[], maxCount = STARTER_PET_IDS.length) {
  const ids = uniqueStrings(value).filter((id) => STARTER_PET_IDS.includes(id)).slice(0, maxCount);
  return ids.length > 0 ? ids : [...fallback];
}

function sanitizeTicketInventory(value: unknown) {
  const next = { ...RPG_INITIAL_SKILL_TICKET_INVENTORY };
  if (!isRecord(value)) return next;
  for (const ticketId of Object.keys(next)) {
    const count = sanitizeCount(value[ticketId]);
    if (count !== null) next[ticketId] = count;
  }
  return next;
}

function sanitizeSkillInventory(value: unknown) {
  const next: Record<string, number> = {};
  if (!isRecord(value)) return next;
  for (const [moveId, rawCount] of Object.entries(value)) {
    const count = sanitizeCount(rawCount);
    if (count && getRpgMoveById(moveId)) next[moveId] = count;
  }
  return next;
}

function sanitizePetMoveLoadouts(value: unknown, skillInventory: Record<string, number>) {
  const next = starterLoadouts();
  if (!isRecord(value)) return next;
  for (const pet of RPG_STARTER_PETS) {
    const moveIds = uniqueStrings(value[pet.id]).filter((moveId) => {
      const move = getRpgMoveById(moveId);
      return Boolean(move && move.element === pet.element && (isStarterMove(pet.id, moveId) || skillInventory[moveId]));
    }).slice(0, RPG_MAX_EQUIPPED_MOVES);
    next[pet.id] = moveIds.length > 0 ? moveIds : [...pet.startingMoveIds];
  }
  return next;
}

function sanitizeCardSkillBindings(value: unknown) {
  const next: Record<string, string> = {};
  if (!isRecord(value)) return next;
  for (const [cardId, moveId] of Object.entries(value)) {
    if (typeof cardId === "string" && typeof moveId === "string" && getRpgMoveById(moveId)) {
      next[cardId] = moveId;
    }
  }
  return next;
}

function sanitizePetCardLoadouts(value: unknown, cardSkillBindings: Record<string, string>) {
  const next: Record<string, string[]> = {};
  if (!isRecord(value)) return next;
  for (const pet of RPG_STARTER_PETS) {
    const cardIds = uniqueStrings(value[pet.id]).filter((cardId) => {
      const move = getRpgMoveById(cardSkillBindings[cardId]);
      return Boolean(move && move.element === pet.element);
    }).slice(0, RPG_MAX_EQUIPPED_MOVES);
    next[pet.id] = cardIds;
  }
  return next;
}

function sanitizeDrawHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): RpgDrawHistoryEntry[] => {
    if (!isRecord(entry) || typeof entry.ticketId !== "string") return [];
    const ticket = getRpgSkillTicket(entry.ticketId);
    if (!ticket || !Array.isArray(entry.moves)) return [];
    const moves = entry.moves.flatMap((move) => {
      if (!isRecord(move) || typeof move.id !== "string") return [];
      const definition = getRpgMoveById(move.id);
      return definition ? [definition] : [];
    });
    if (moves.length === 0) return [];
    const createdAt = sanitizeCount(entry.createdAt) ?? 0;
    return [{
      id: typeof entry.id === "string" && entry.id.length > 0 ? entry.id : `${entry.ticketId}-${createdAt}-${index}`,
      ticketId: ticket.id,
      ticketLabel: ticket.label,
      createdAt,
      moves
    }];
  }).slice(0, 8);
}

function sanitizeAiDifficulty(value: unknown): RpgAiDifficulty {
  return typeof value === "string" && isRpgAiDifficulty(value) ? value : "normal";
}

function sanitizeRpgProgress(value: unknown, current: RpgStore): RpgPersistedProgress {
  if (!isRecord(value)) {
    return {
      playerName: current.playerName,
      ownedPetIds: current.ownedPetIds,
      selectedPartyPetIds: current.selectedPartyPetIds,
      ticketInventory: current.ticketInventory,
      skillInventory: current.skillInventory,
      petMoveLoadouts: current.petMoveLoadouts,
      selectedAiDifficulty: current.selectedAiDifficulty,
      drawHistory: current.drawHistory
    };
  }
  const ownedPetIds = sanitizePetIds(value.ownedPetIds, current.ownedPetIds);
  const selectedPartyPetIds = sanitizePetIds(value.selectedPartyPetIds, current.selectedPartyPetIds, 3).filter((id) => ownedPetIds.includes(id));
  const ticketInventory = sanitizeTicketInventory(value.ticketInventory);
  const skillInventory = sanitizeSkillInventory(value.skillInventory);
  const playerName = typeof value.playerName === "string" && value.playerName.trim().length > 0 ? value.playerName.trim().slice(0, 18) : current.playerName;
  return {
    playerName,
    ownedPetIds,
    selectedPartyPetIds: selectedPartyPetIds.length > 0 ? selectedPartyPetIds : current.selectedPartyPetIds,
    ticketInventory,
    skillInventory,
    petMoveLoadouts: sanitizePetMoveLoadouts(value.petMoveLoadouts, skillInventory),
    selectedAiDifficulty: sanitizeAiDifficulty(value.selectedAiDifficulty),
    drawHistory: sanitizeDrawHistory(value.drawHistory)
  };
}

function starterLoadouts() {
  return Object.fromEntries(RPG_STARTER_PETS.map((pet) => [pet.id, [...pet.startingMoveIds]]));
}

function walletCardKey(card: RpgWalletCard) {
  return card.tokenId || card.id;
}

function living(pets: readonly RpgBattlePetState[]) {
  return pets.filter((pet) => !pet.defeated && pet.hp > 0);
}

function firstLivingEnemyId(state: RpgBattleState | null) {
  return living(state?.right ?? [])[0]?.id ?? null;
}

function firstLivingAllyId(state: RpgBattleState | null) {
  return living(state?.left ?? [])[0]?.id ?? null;
}

function cardMoveIdsForPet(definitionId: string, cardSkillBindings: Record<string, string>, petCardLoadouts: Record<string, string[]>) {
  const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
  if (!definition) return [];
  return uniqueStrings(petCardLoadouts[definitionId]).slice(0, RPG_MAX_EQUIPPED_MOVES).flatMap((cardId) => {
    const move = getRpgMoveById(cardSkillBindings[cardId]);
    return move && move.element === definition.element ? [move.id] : [];
  });
}

function moveIdsForPet(definitionId: string, loadouts: Record<string, string[]>, cardSkillBindings?: Record<string, string>, petCardLoadouts?: Record<string, string[]>) {
  const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
  if (!definition) return [];
  const baseMoveIds = loadouts[definitionId] && loadouts[definitionId].length > 0 ? loadouts[definitionId] : [...definition.startingMoveIds];
  const baseMoves = baseMoveIds.filter((moveId) => getRpgMoveById(moveId)?.element === definition.element).slice(0, RPG_MAX_EQUIPPED_MOVES);
  if (cardSkillBindings && petCardLoadouts) {
    return [...new Set([...baseMoves, ...cardMoveIdsForPet(definitionId, cardSkillBindings, petCardLoadouts)])];
  }
  return baseMoves;
}

function isStarterMove(definitionId: string, moveId: string) {
  return Boolean(RPG_STARTER_PETS.find((pet) => pet.id === definitionId)?.startingMoveIds.includes(moveId));
}

function selectedRosterForOwner(ownerId: string, selectedPetIds: readonly string[], loadouts: Record<string, string[]>, cardSkillBindings: Record<string, string>, petCardLoadouts: Record<string, string[]>) {
  if (selectedPetIds.length !== 3) return null;
  const roster = createStarterRoster(ownerId);
  const selected = selectedPetIds.flatMap((definitionId) => {
    const pet = roster.find((candidate) => candidate.definitionId === definitionId);
    return pet ? [{ ...pet, moveIds: moveIdsForPet(definitionId, loadouts, cardSkillBindings, petCardLoadouts) }] : [];
  });
  return selected.length === 3 && selected.every((pet) => pet.moveIds.length > 0) ? selected : null;
}

function selectedRosterSelection(selectedPetIds: readonly string[], loadouts: Record<string, string[]>, cardSkillBindings: Record<string, string>, petCardLoadouts: Record<string, string[]>): RpgRosterSelection[] | null {
  if (selectedPetIds.length !== 3) return null;
  const selected = selectedPetIds.flatMap((definitionId) => {
    const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === definitionId);
    return pet ? [{ definitionId: pet.id, moveIds: moveIdsForPet(pet.id, loadouts, cardSkillBindings, petCardLoadouts) }] : [];
  });
  return selected.length === 3 && selected.every((pet) => (pet.moveIds?.length ?? 0) > 0) ? selected : null;
}

function actionTargetForMove(state: RpgBattleState, actor: RpgBattlePetState, move: RpgMove, selectedEnemyId: string | null, selectedAllyId: string | null) {
  if (move.target === "singleEnemy") {
    const enemies = getRpgReachableEnemyTargets(state, actor);
    return enemies.some((enemy) => enemy.id === selectedEnemyId) ? selectedEnemyId ?? undefined : enemies[0]?.id;
  }
  if (move.target === "singleAlly") {
    const allies = living(actor.side === "left" ? state.left : state.right);
    return allies.some((ally) => ally.id === selectedAllyId) ? selectedAllyId ?? undefined : actor.id;
  }
  return getRpgDefaultTargetIdForMove(state, actor, move);
}

function disconnectVersusSocket() {
  versusSocket?.leave();
  versusSocket?.disconnect();
  versusSocket = null;
}

function applyVersusSnapshot(snapshot: RpgVersusSnapshot, set: (partial: Partial<RpgStore> | ((state: RpgStore) => Partial<RpgStore>)) => void) {
  set((state) => {
    const nextBattle = snapshot.battle;
    const battleChanged = Boolean(nextBattle && state.activeBattle && nextBattle.id !== state.activeBattle.id);
    const turnChanged = Boolean(nextBattle && state.activeBattle && nextBattle.turn !== state.activeBattle.turn);
    const phaseChanged = Boolean(nextBattle && state.activeBattle && (nextBattle.activeSide ?? "left") !== (state.activeBattle.activeSide ?? "left"));
    const pendingActions = battleChanged || turnChanged || phaseChanged || nextBattle?.winner ? {} : state.pendingActions;
    const battleNotice = snapshot.message ??
      (snapshot.status === "waiting"
        ? "等待對手加入。"
        : snapshot.status === "finished"
          ? "戰鬥結束，等待再戰或離開。"
        : snapshot.status === "opponentDisconnected"
          ? "對手連線中斷，保留戰鬥並等待重連。"
          : null);
    return {
      screen: "battle",
      activeBattle: nextBattle,
      battleMode: "versus",
      activeAiDifficulty: null,
      versusConnection: snapshot.status === "waiting" ? "waiting" : "connected",
      versusRoomCode: snapshot.roomCode,
      versusPlayerId: snapshot.playerId,
      versusPlayerName: snapshot.playerName,
      versusPlayerSide: snapshot.playerSide,
      versusRoomStatus: snapshot.status,
      versusOpponentName: snapshot.opponentName,
      versusOpponentConnected: snapshot.opponentConnected,
      versusSubmittedPlayerIds: snapshot.submittedPlayerIds,
      versusRematchRequestedPlayerIds: snapshot.rematchRequestedPlayerIds,
      pendingActions,
      selectedEnemyId: nextBattle ? firstLivingEnemyId(nextBattle) : state.selectedEnemyId,
      selectedAllyId: nextBattle ? firstLivingAllyId(nextBattle) : state.selectedAllyId,
      battleNotice
    };
  });
}

function applyVersusConnectionStatus(
  status: "connecting" | "reconnecting" | "connected",
  message: string,
  set: (partial: Partial<RpgStore> | ((state: RpgStore) => Partial<RpgStore>)) => void
) {
  set((state) => ({
    versusConnection: status,
    battleNotice: state.battleMode === "versus" ? message : state.battleNotice
  }));
}

export const useRpgStore = create<RpgStore>()(persist((set, get) => ({
  playerName: "GUEST_2AC1",
  activeLocation: "village",
  screen: "village",
  nearPlace: null,
  ownedPetIds: STARTER_PET_IDS,
  selectedPartyPetIds: STARTER_PET_IDS.slice(0, 3),
  walletAddress: RPG_DEFAULT_WALLET_ADDRESS,
  walletCards: [],
  walletCardsStatus: "idle",
  walletCardsError: null,
  walletCardsFetchedAt: null,
  walletCardsTotalFMV: 0,
  walletCardsScannedRows: 0,
  walletCardsSource: null,
  walletCardsStale: false,
  walletCardsStaleReason: null,
  ticketInventory: { ...RPG_INITIAL_SKILL_TICKET_INVENTORY },
  skillInventory: {},
  petMoveLoadouts: starterLoadouts(),
  cardSkillBindings: {},
  petCardLoadouts: {},
  selectedAiDifficulty: "normal",
  activeAiDifficulty: null,
  drawHistory: [],
  activeBattle: null,
  battleMode: null,
  versusConnection: "idle",
  versusRoomCode: null,
  versusPlayerId: null,
  versusPlayerName: null,
  versusPlayerSide: null,
  versusRoomStatus: null,
  versusOpponentName: null,
  versusOpponentConnected: false,
  versusSubmittedPlayerIds: [],
  versusRematchRequestedPlayerIds: [],
  pendingActions: {},
  selectedEnemyId: null,
  selectedAllyId: null,
  battleNotice: null,
  setPlayerName: (name) => {
    const next = name.trim().slice(0, 18);
    set({ playerName: next.length > 0 ? next : "GUEST_2AC1", battleNotice: null });
  },
  setNearPlace: (place) => set({ nearPlace: place }),
  openProfile: () => set({ screen: "profile", battleNotice: null }),
  openShop: () => set({ screen: "profile", battleNotice: null }),
  openBag: () => set({ screen: "bag", battleNotice: null }),
  openGym: () => set({ screen: "gym", battleNotice: null }),
  openArena: () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("rpg");
    url.searchParams.delete("editor");
    url.searchParams.delete("preview");
    url.searchParams.set("arena", "1");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  },
  enterHouse: () => set({ activeLocation: "house", screen: "house", nearPlace: null, battleNotice: null }),
  exitHouse: () => set({ activeLocation: "village", screen: "village", nearPlace: null, battleNotice: null }),
  closePanel: () => set((state) => ({ screen: state.activeLocation, battleNotice: null })),
  fetchWalletCards: async (force = false) => {
    const state = get();
    if (!force && (state.walletCardsStatus === "loading" || state.walletCardsStatus === "ready")) return;
    set({ walletCardsStatus: "loading", walletCardsError: null });
    try {
      const result = await fetchRpgWalletCards(state.walletAddress, force);
      const fetchedAt = result.stale && result.cachedAt ? result.cachedAt : Date.now();
      const cardSkillBindings = sanitizeCardSkillBindings(result.cardSkillBindings);
      set({
        walletCards: result.collectibles,
        walletCardsStatus: "ready",
        walletCardsError: null,
        walletCardsFetchedAt: fetchedAt,
        walletCardsTotalFMV: result.totalFMV,
        walletCardsScannedRows: result.scannedRows,
        walletCardsSource: result.source,
        walletCardsStale: Boolean(result.stale),
        walletCardsStaleReason: result.staleReason ?? null,
        cardSkillBindings,
        petCardLoadouts: sanitizePetCardLoadouts(result.petCardLoadouts, cardSkillBindings),
        battleNotice: result.stale ? "外部錢包 API 暫時失敗，現在顯示已同步過的本地卡片。" : result.fallbackUsed ? "錢包卡片來源使用 fallback。" : null
      });
    } catch (error) {
      set({
        walletCardsStatus: "error",
        walletCardsError: error instanceof Error ? error.message : "讀取錢包卡片失敗。",
        walletCards: [],
        walletCardsTotalFMV: 0,
        walletCardsScannedRows: 0,
        walletCardsSource: null,
        walletCardsStale: false,
        walletCardsStaleReason: null,
        cardSkillBindings: {},
        petCardLoadouts: {}
      });
    }
  },
  togglePartyPet: (definitionId) =>
    set((state) => {
      if (!state.ownedPetIds.includes(definitionId)) return {};
      const selected = state.selectedPartyPetIds;
      const next = selected.includes(definitionId)
        ? selected.filter((id) => id !== definitionId)
        : selected.length >= 3
          ? [...selected.slice(1), definitionId]
          : [...selected, definitionId];
      return { selectedPartyPetIds: next, battleNotice: null };
    }),
  movePartyPetSlot: (fromIndex, toIndex) =>
    set((state) => {
      const selected = state.selectedPartyPetIds;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= selected.length || toIndex >= selected.length || toIndex >= 3) return {};
      const next = [...selected];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return { selectedPartyPetIds: next, battleNotice: null };
    }),
  equipMoveToPet: (definitionId, moveId) =>
    set((state) => {
      const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
      const move = getRpgMoveById(moveId);
      if (!definition || !move) return {};
      if (move.element !== definition.element) return { battleNotice: `${move.name} 只能裝備到${RPG_ELEMENT_META[move.element].label}屬性寵物。` };
      if (!isStarterMove(definitionId, moveId) && !state.skillInventory[moveId]) return { battleNotice: "尚未取得這個技能。" };
      const current = moveIdsForPet(definitionId, state.petMoveLoadouts);
      if (current.includes(moveId)) return { battleNotice: `${definition.name} 已裝備 ${move.name}。` };
      const nextMoves = current.length >= RPG_MAX_EQUIPPED_MOVES ? [...current.slice(1), moveId] : [...current, moveId];
      return {
        petMoveLoadouts: { ...state.petMoveLoadouts, [definitionId]: nextMoves },
        battleNotice: `${definition.name} 裝備 ${move.name}。`
      };
    }),
  unequipMoveFromPet: (definitionId, moveId) =>
    set((state) => {
      const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
      const move = getRpgMoveById(moveId);
      if (!definition || !move) return {};
      const current = moveIdsForPet(definitionId, state.petMoveLoadouts);
      if (!current.includes(moveId)) return {};
      if (current.length <= 1) return { battleNotice: "至少要保留 1 個招式。" };
      const nextMoves = current.filter((id) => id !== moveId);
      return {
        petMoveLoadouts: { ...state.petMoveLoadouts, [definitionId]: nextMoves },
        battleNotice: `${definition.name} 卸下 ${move.name}。`
      };
    }),
  drawSkill: (ticketId, preferredElement) => {
    const state = get();
    const remainingTickets = state.ticketInventory[ticketId] ?? 0;
    if (remainingTickets <= 0) {
      set({ battleNotice: "沒有可用的技能卡券。" });
      return null;
    }
    const result = drawRpgSkillTicket(ticketId, { preferredElement });
    const createdAt = Date.now();
    const entry: RpgDrawHistoryEntry = {
      id: `${ticketId}-${createdAt}-${state.drawHistory.length}`,
      ticketId,
      ticketLabel: result.ticket.label,
      createdAt,
      moves: result.moves
    };
    const skillInventory = { ...state.skillInventory };
    result.moves.forEach((move) => {
      skillInventory[move.id] = (skillInventory[move.id] ?? 0) + 1;
    });
    set({
      drawHistory: [entry, ...state.drawHistory].slice(0, 8),
      skillInventory,
      ticketInventory: { ...state.ticketInventory, [ticketId]: remainingTickets - 1 },
      battleNotice: `${result.moves.length} 張技能卡已加入背包。`
    });
    return entry;
  },
  drawWalletCardSkill: async (cardId) => {
    const state = get();
    const card = state.walletCards.find((candidate) => walletCardKey(candidate) === cardId);
    if (!card) {
      set({ battleNotice: "找不到這張錢包卡片，請先同步錢包。" });
      return null;
    }
    const existingMove = getRpgMoveById(state.cardSkillBindings[cardId]);
    if (existingMove) {
      set({ battleNotice: `${card.pokemonName || card.name} 已綁定 ${existingMove.name}。` });
      return null;
    }
    try {
      const result = await drawRpgWalletCardSkill(state.walletAddress, cardId);
      const moves = result.entry.moves.flatMap((move) => {
        const definition = getRpgMoveById(move.id);
        return definition ? [definition] : [];
      });
      const move = moves[0];
      if (!move) {
        set({ battleNotice: "後端回傳了不存在的技能，請重新同步。" });
        return null;
      }
      const cardSkillBindings = sanitizeCardSkillBindings(result.cardSkillBindings);
      const entry: RpgDrawHistoryEntry = {
        ...result.entry,
        moves
      };
      set((current) => ({
        cardSkillBindings,
        petCardLoadouts: sanitizePetCardLoadouts(result.petCardLoadouts, cardSkillBindings),
        skillInventory: result.alreadyBound ? current.skillInventory : { ...current.skillInventory, [move.id]: (current.skillInventory[move.id] ?? 0) + 1 },
        drawHistory: [entry, ...current.drawHistory].slice(0, 8),
        battleNotice: `${card.pokemonName || card.name} 綁定 ${RPG_ELEMENT_META[move.element].label}屬性技能：${move.name}。`
      }));
      return entry;
    } catch (error) {
      set({ battleNotice: error instanceof Error ? error.message : "卡片技能綁定失敗。" });
      return null;
    }
  },
  equipCardToPet: async (definitionId, cardId) => {
    const state = get();
    const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
    const move = getRpgMoveById(state.cardSkillBindings[cardId]);
    const card = state.walletCards.find((candidate) => walletCardKey(candidate) === cardId);
    if (!definition) return;
    if (!card || !move) {
      set({ battleNotice: "這張卡還沒有綁定技能，先在錢包卡片點一下抽技能。" });
      return;
    }
    if (move.element !== definition.element) {
      set({ battleNotice: `${move.name} 是${RPG_ELEMENT_META[move.element].label}屬性，只能裝到${RPG_ELEMENT_META[move.element].label}寵物。` });
      return;
    }
    try {
      const result = await equipRpgWalletCard(state.walletAddress, definition.id, cardId);
      set({
        petCardLoadouts: sanitizePetCardLoadouts(result.petCardLoadouts, state.cardSkillBindings),
        battleNotice: `${definition.name} 插入 ${card.pokemonName || card.name}，獲得 ${move.name}。`
      });
    } catch (error) {
      set({ battleNotice: error instanceof Error ? error.message : "插卡失敗。" });
    }
  },
  unequipCardFromPet: async (definitionId, cardId) => {
    const state = get();
    const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
    if (!definition) return;
    const current = uniqueStrings(state.petCardLoadouts[definitionId]);
    if (!current.includes(cardId)) return;
    const card = state.walletCards.find((candidate) => walletCardKey(candidate) === cardId);
    const move = getRpgMoveById(state.cardSkillBindings[cardId]);
    try {
      const result = await unequipRpgWalletCard(state.walletAddress, definition.id, cardId);
      set({
        petCardLoadouts: sanitizePetCardLoadouts(result.petCardLoadouts, state.cardSkillBindings),
        battleNotice: `${definition.name} 卸下 ${card?.pokemonName || card?.name || "卡片"}${move ? ` / ${move.name}` : ""}。`
      });
    } catch (error) {
      set({ battleNotice: error instanceof Error ? error.message : "卸卡失敗。" });
    }
  },
  setAiDifficulty: (difficulty) => set({ selectedAiDifficulty: difficulty, battleNotice: null }),
  startAiBattle: (difficulty) => {
    const aiDifficulty = difficulty ?? get().selectedAiDifficulty;
    const aiConfig = getRpgAiDifficultyConfig(aiDifficulty);
    const playerRoster = selectedRosterForOwner("player", get().selectedPartyPetIds, get().petMoveLoadouts, get().cardSkillBindings, get().petCardLoadouts);
    if (!playerRoster) {
      set({ battleNotice: "請選滿 3 隻寵物上場。" });
      return;
    }
    disconnectVersusSocket();
    const battle = createRpgBattleState(`local-ai-gym-${aiDifficulty}`, playerRoster, createRpgAiRoster("ai", aiDifficulty));
    set({
      screen: "battle",
      activeBattle: battle,
      battleMode: "ai",
      selectedAiDifficulty: aiDifficulty,
      activeAiDifficulty: aiDifficulty,
      versusConnection: "idle",
      versusRoomCode: null,
      versusRoomStatus: null,
      versusPlayerId: null,
      versusPlayerName: null,
      versusPlayerSide: null,
      versusOpponentName: null,
      versusOpponentConnected: false,
      versusSubmittedPlayerIds: [],
      versusRematchRequestedPlayerIds: [],
      pendingActions: {},
      selectedEnemyId: firstLivingEnemyId(battle),
      selectedAllyId: firstLivingAllyId(battle),
      battleNotice: `${aiConfig.title}開始。`
    });
  },
  createVersusRoom: async () => {
    const roster = selectedRosterSelection(get().selectedPartyPetIds, get().petMoveLoadouts, get().cardSkillBindings, get().petCardLoadouts);
    if (!roster) {
      set({ battleNotice: "請選滿 3 隻寵物上場。" });
      return;
    }
    disconnectVersusSocket();
    set({ versusConnection: "connecting", battleMode: "versus", battleNotice: "連接真人道館中。" });
    const socket = new RpgBattleSocket();
    versusSocket = socket;
    try {
      await socket.connect(
        (snapshot) => applyVersusSnapshot(snapshot, set),
        (message) => set({ versusConnection: "error", battleNotice: message }),
        (status, message) => applyVersusConnectionStatus(status, message, set)
      );
      const accepted = await socket.createRoom({ playerName: get().playerName, roster });
      set({
        screen: "battle",
        battleMode: "versus",
        activeAiDifficulty: null,
        versusConnection: "waiting",
        versusRoomCode: accepted.roomCode,
        versusPlayerId: accepted.playerId,
        versusPlayerName: get().playerName,
        versusPlayerSide: accepted.playerSide,
        versusRoomStatus: "waiting",
        versusOpponentConnected: false,
        versusSubmittedPlayerIds: [],
        versusRematchRequestedPlayerIds: [],
        selectedEnemyId: null,
        selectedAllyId: null,
        battleNotice: "房間已建立，等待對手加入。"
      });
    } catch (error) {
      socket.disconnect();
      if (versusSocket === socket) versusSocket = null;
      set({ versusConnection: "error", battleNotice: error instanceof Error ? error.message : "真人道館連線失敗。" });
    }
  },
  joinVersusRoom: async (roomCode) => {
    const roster = selectedRosterSelection(get().selectedPartyPetIds, get().petMoveLoadouts, get().cardSkillBindings, get().petCardLoadouts);
    if (!roster) {
      set({ battleNotice: "請選滿 3 隻寵物上場。" });
      return;
    }
    disconnectVersusSocket();
    set({ versusConnection: "connecting", battleMode: "versus", battleNotice: "加入真人道館中。" });
    const socket = new RpgBattleSocket();
    versusSocket = socket;
    try {
      await socket.connect(
        (snapshot) => applyVersusSnapshot(snapshot, set),
        (message) => set({ versusConnection: "error", battleNotice: message }),
        (status, message) => applyVersusConnectionStatus(status, message, set)
      );
      const accepted = await socket.joinRoom({ playerName: get().playerName, roomCode, roster });
      set({
        screen: "battle",
        battleMode: "versus",
        activeAiDifficulty: null,
        versusConnection: "connected",
        versusRoomCode: accepted.roomCode,
        versusPlayerId: accepted.playerId,
        versusPlayerName: get().playerName,
        versusPlayerSide: accepted.playerSide,
        versusRoomStatus: "waiting",
        versusOpponentConnected: false,
        versusSubmittedPlayerIds: [],
        versusRematchRequestedPlayerIds: [],
        selectedEnemyId: null,
        selectedAllyId: null,
        battleNotice: "已加入房間，等待同步。"
      });
    } catch (error) {
      socket.disconnect();
      if (versusSocket === socket) versusSocket = null;
      set({ versusConnection: "error", battleNotice: error instanceof Error ? error.message : "加入真人道館失敗。" });
    }
  },
  selectEnemyTarget: (targetId) => set({ selectedEnemyId: targetId, battleNotice: null }),
  selectAllyTarget: (targetId) => set({ selectedAllyId: targetId, battleNotice: null }),
  selectBattleMove: (actorId, moveId) => {
    const state = get();
    const battle = state.activeBattle;
    const actor = battle?.left.find((pet) => pet.id === actorId);
    const move = getRpgMoveById(moveId);
    if (!battle || !actor || !move) return;
    if ((battle.activeSide ?? "left") !== "left") {
      set({ battleNotice: "還沒輪到我方行動。" });
      return;
    }
    const targetId = actionTargetForMove(battle, actor, move, state.selectedEnemyId, state.selectedAllyId);
    set((current) => ({
      pendingActions: { ...current.pendingActions, [actorId]: { moveId, targetId } },
      battleNotice: null
    }));
  },
  clearBattleAction: (actorId) =>
    set((state) => {
      const next = { ...state.pendingActions };
      delete next[actorId];
      return { pendingActions: next, battleNotice: null };
    }),
  resolveBattleTurn: () => {
    const state = get();
    const battle = state.activeBattle;
    if (!battle || battle.winner) return;

    const activeSide = battle.activeSide ?? "left";
    const roundEnergy = getRpgBattleEnergyForTurn(battle.turn);
    if (activeSide === "right") {
      if (state.battleMode === "ai") {
        const aiActions = createAiRpgActions(battle, "right", roundEnergy);
        if (aiActions.length <= 0) {
          set({ battleNotice: "敵方目前無法行動。" });
          return;
        }
        const nextBattle = resolveRpgBattleTurn(battle, aiActions);
        set({
          activeBattle: nextBattle,
          pendingActions: {},
          selectedEnemyId: firstLivingEnemyId(nextBattle),
          selectedAllyId: firstLivingAllyId(nextBattle),
          battleNotice: nextBattle.winner ? "戰鬥結束。" : null
        });
        return;
      }
      set({ battleNotice: "等待對手行動。" });
      return;
    }

    const playerActions: RpgBattleAction[] = battle.left
      .filter((pet) => !pet.defeated && pet.hp > 0)
      .flatMap((pet) => {
        const pendingAction = state.pendingActions[pet.id];
        return pendingAction ? [{ actorId: pet.id, moveId: pendingAction.moveId, targetId: pendingAction.targetId }] : [];
      });
    if (playerActions.length <= 0) {
      set({ battleNotice: "請至少選擇一隻我方寵物的招式。" });
      return;
    }
    const spentEnergy = playerActions.reduce((sum, action) => sum + (getRpgMoveById(action.moveId)?.energyCost ?? roundEnergy + 1), 0);
    if (spentEnergy > roundEnergy) {
      set({ battleNotice: `本回合最多 ${roundEnergy} EN，目前選招超出能量。` });
      return;
    }

    if (state.battleMode === "versus") {
      if (!versusSocket || !state.versusRoomCode) {
        set({ battleNotice: "真人道館尚未連線。" });
        return;
      }
      if (state.versusConnection !== "connected") {
        set({ battleNotice: state.versusConnection === "reconnecting" ? "重新連線中，暫停送出選招。" : "真人道館尚未同步完成。" });
        return;
      }
      versusSocket.submitActions(state.versusRoomCode, playerActions);
      set({ battleNotice: `已送出 ${playerActions.length} 個行動，等待同步。`, versusSubmittedPlayerIds: state.versusPlayerId ? [...new Set([...state.versusSubmittedPlayerIds, state.versusPlayerId])] : state.versusSubmittedPlayerIds });
      return;
    }

    if (state.battleMode === "ai") {
      const nextBattle = resolveRpgBattleTurn(battle, playerActions);
      set({
        activeBattle: nextBattle,
        pendingActions: {},
        selectedEnemyId: firstLivingEnemyId(nextBattle),
        selectedAllyId: firstLivingAllyId(nextBattle),
        battleNotice: nextBattle.winner ? "戰鬥結束。" : null
      });
      return;
    }
  },
  requestVersusRematch: () => {
    const state = get();
    if (state.battleMode !== "versus" || !state.activeBattle?.winner) {
      set({ battleNotice: "目前沒有已結束的真人戰鬥。" });
      return;
    }
    if (!versusSocket || !state.versusRoomCode) {
      set({ battleNotice: "真人道館尚未連線。" });
      return;
    }
    if (state.versusConnection !== "connected") {
      set({ battleNotice: "真人道館重新同步中，暫時不能再戰。" });
      return;
    }
    versusSocket.requestRematch(state.versusRoomCode);
    set({
      battleNotice: state.versusOpponentConnected ? "已準備再戰，等待對手確認。" : "已準備再戰，等待對手重連。",
      versusRematchRequestedPlayerIds: state.versusPlayerId ? [...new Set([...state.versusRematchRequestedPlayerIds, state.versusPlayerId])] : state.versusRematchRequestedPlayerIds
    });
  },
  resetBattle: () => {
    disconnectVersusSocket();
    set({
      screen: "gym",
      activeBattle: null,
      battleMode: null,
      activeAiDifficulty: null,
      versusConnection: "idle",
      versusRoomCode: null,
      versusPlayerId: null,
      versusPlayerName: null,
      versusPlayerSide: null,
      versusRoomStatus: null,
      versusOpponentName: null,
      versusOpponentConnected: false,
      versusSubmittedPlayerIds: [],
      versusRematchRequestedPlayerIds: [],
      pendingActions: {},
      selectedEnemyId: null,
      selectedAllyId: null,
      battleNotice: null
    });
  }
}), {
  name: RPG_PROGRESS_STORAGE_KEY,
  version: 1,
  storage: createJSONStorage(() => localStorage),
  partialize: (state): RpgPersistedProgress => ({
    playerName: state.playerName,
    ownedPetIds: state.ownedPetIds,
    selectedPartyPetIds: state.selectedPartyPetIds,
    ticketInventory: state.ticketInventory,
    skillInventory: state.skillInventory,
    petMoveLoadouts: state.petMoveLoadouts,
    selectedAiDifficulty: state.selectedAiDifficulty,
    drawHistory: state.drawHistory
  }),
  merge: (persistedState, currentState) => ({
    ...currentState,
    ...sanitizeRpgProgress(persistedState, currentState)
  })
}));

export function getStarterPetDefinition(definitionId: string) {
  return RPG_STARTER_PETS.find((pet) => pet.id === definitionId) ?? null;
}

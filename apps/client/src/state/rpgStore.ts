import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  RPG_INITIAL_SKILL_TICKET_INVENTORY,
  RPG_STARTER_PETS,
  createAiRpgActions,
  createRpgAiRoster,
  createRpgBattleState,
  createStarterRoster,
  drawRpgSkillTicket,
  getRpgBattleEnergyForTurn,
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
import { rpgAiDifficultyCopy, rpgCopy, rpgElementLabel, rpgMoveName, rpgNotice, rpgPetName, rpgTicketCopy } from "../i18n/rpg";

export type RpgLocation = "village" | "house";
export type RpgPlace = "shop" | "gym" | "arena" | "house" | "cabinet" | "houseExit";
export type RpgNavigationTarget = Extract<RpgPlace, "gym" | "arena">;
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
  villageNavigationTarget: RpgNavigationTarget | null;
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
  pendingCardEquipPetId: string | null;
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
  requestVillageNavigation: (place: RpgNavigationTarget) => void;
  clearVillageNavigation: () => void;
  openProfile: () => void;
  openShop: () => void;
  openBag: () => void;
  openGym: () => void;
  openCardEquipForElement: (element: RpgElement) => void;
  consumePendingCardEquipPet: () => string | null;
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

function normalizePartySlots(selectedPetIds: readonly string[]) {
  const next = selectedPetIds.slice(0, 3);
  while (next.length < 3) next.push("");
  return next;
}

function sanitizePartyPetSlots(value: unknown, ownedPetIds: readonly string[], fallback: readonly string[]) {
  if (!Array.isArray(value)) return normalizePartySlots(fallback);
  const seen = new Set<string>();
  const slots = value.slice(0, 3).map((rawPetId) => {
    if (typeof rawPetId !== "string" || rawPetId.length === 0) return "";
    if (!STARTER_PET_IDS.includes(rawPetId) || !ownedPetIds.includes(rawPetId) || seen.has(rawPetId)) return "";
    seen.add(rawPetId);
    return rawPetId;
  });
  const normalized = normalizePartySlots(slots);
  return normalized.some(Boolean) ? normalized : normalizePartySlots(fallback);
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
      ticketLabel: rpgTicketCopy(ticket).label,
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
  const selectedPartyPetIds = sanitizePartyPetSlots(value.selectedPartyPetIds, ownedPetIds, current.selectedPartyPetIds);
  const ticketInventory = sanitizeTicketInventory(value.ticketInventory);
  const skillInventory = sanitizeSkillInventory(value.skillInventory);
  const playerName = typeof value.playerName === "string" && value.playerName.trim().length > 0 ? value.playerName.trim().slice(0, 18) : current.playerName;
  return {
    playerName,
    ownedPetIds,
    selectedPartyPetIds,
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
    return [...new Set([...cardMoveIdsForPet(definitionId, cardSkillBindings, petCardLoadouts), ...baseMoves])].slice(0, RPG_MAX_EQUIPPED_MOVES);
  }
  return baseMoves;
}

function isStarterMove(definitionId: string, moveId: string) {
  return Boolean(RPG_STARTER_PETS.find((pet) => pet.id === definitionId)?.startingMoveIds.includes(moveId));
}

function selectedRosterForOwner(ownerId: string, selectedPetIds: readonly string[], loadouts: Record<string, string[]>, cardSkillBindings: Record<string, string>, petCardLoadouts: Record<string, string[]>) {
  const filledPetIds = selectedPetIds.filter(Boolean);
  if (filledPetIds.length !== 3) return null;
  const roster = createStarterRoster(ownerId);
  const selected = filledPetIds.flatMap((definitionId) => {
    const pet = roster.find((candidate) => candidate.definitionId === definitionId);
    return pet ? [{ ...pet, moveIds: moveIdsForPet(definitionId, loadouts, cardSkillBindings, petCardLoadouts) }] : [];
  });
  return selected.length === 3 && selected.every((pet) => pet.moveIds.length > 0) ? selected : null;
}

function selectedRosterSelection(selectedPetIds: readonly string[], loadouts: Record<string, string[]>, cardSkillBindings: Record<string, string>, petCardLoadouts: Record<string, string[]>): RpgRosterSelection[] | null {
  const filledPetIds = selectedPetIds.filter(Boolean);
  if (filledPetIds.length !== 3) return null;
  const selected = filledPetIds.flatMap((definitionId) => {
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

function retargetPendingActions(state: RpgStore, targetKind: "enemy" | "ally", targetId: string) {
  const battle = state.activeBattle;
  if (!battle) return state.pendingActions;
  let changed = false;
  const next = { ...state.pendingActions };
  for (const [actorId, action] of Object.entries(state.pendingActions)) {
    const actor = battle.left.find((pet) => pet.id === actorId);
    const move = getRpgMoveById(action.moveId);
    if (!actor || !move) continue;
    if (targetKind === "enemy" && move.target !== "singleEnemy") continue;
    if (targetKind === "ally" && move.target !== "singleAlly") continue;
    const nextTargetId = actionTargetForMove(
      battle,
      actor,
      move,
      targetKind === "enemy" ? targetId : state.selectedEnemyId,
      targetKind === "ally" ? targetId : state.selectedAllyId
    );
    if (nextTargetId !== action.targetId) {
      next[actorId] = { ...action, targetId: nextTargetId };
      changed = true;
    }
  }
  return changed ? next : state.pendingActions;
}

function disconnectVersusSocket() {
  versusSocket?.leave();
  versusSocket?.disconnect();
  versusSocket = null;
}

function applyVersusSnapshot(snapshot: RpgVersusSnapshot, set: (partial: Partial<RpgStore> | ((state: RpgStore) => Partial<RpgStore>)) => void) {
  set((state) => {
    const notice = rpgNotice();
    const nextBattle = snapshot.battle;
    const battleChanged = Boolean(nextBattle && state.activeBattle && nextBattle.id !== state.activeBattle.id);
    const turnChanged = Boolean(nextBattle && state.activeBattle && nextBattle.turn !== state.activeBattle.turn);
    const phaseChanged = Boolean(nextBattle && state.activeBattle && (nextBattle.activeSide ?? "left") !== (state.activeBattle.activeSide ?? "left"));
    const pendingActions = battleChanged || turnChanged || phaseChanged || nextBattle?.winner ? {} : state.pendingActions;
    const battleNotice = snapshot.message ??
      (snapshot.status === "waiting"
        ? notice.waitingOpponent
        : snapshot.status === "finished"
          ? notice.battleFinishedAwaiting
        : snapshot.status === "opponentDisconnected"
          ? notice.opponentDisconnected
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
  villageNavigationTarget: null,
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
  pendingCardEquipPetId: null,
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
  requestVillageNavigation: (place) =>
    set({
      activeLocation: "village",
      screen: "village",
      nearPlace: null,
      villageNavigationTarget: place,
      battleNotice: null
    }),
  clearVillageNavigation: () => set({ villageNavigationTarget: null }),
  openProfile: () => set({ screen: "profile", battleNotice: null }),
  openShop: () => set({ screen: "bag", battleNotice: null }),
  openBag: () => set({ screen: "bag", battleNotice: null }),
  openGym: () => set({ screen: "gym", battleNotice: null }),
  openCardEquipForElement: (element) =>
    set((state) => {
      const notice = rpgNotice();
      const partyPet = state.selectedPartyPetIds
        .map((petId) => RPG_STARTER_PETS.find((pet) => pet.id === petId) ?? null)
        .find((pet) => pet?.element === element);
      const ownedPet = RPG_STARTER_PETS.find((pet) => pet.element === element && state.ownedPetIds.includes(pet.id));
      const targetPet = partyPet ?? ownedPet ?? null;
      if (!targetPet) {
        return {
          screen: "gym",
          pendingCardEquipPetId: null,
          battleNotice: notice.noElementPet(rpgElementLabel(element))
        };
      }
      return {
        screen: "gym",
        pendingCardEquipPetId: targetPet.id,
        battleNotice: notice.switchedCardSlot(rpgPetName(targetPet.id, targetPet.name))
      };
    }),
  consumePendingCardEquipPet: () => {
    const pendingPetId = get().pendingCardEquipPetId;
    if (pendingPetId) set({ pendingCardEquipPetId: null });
    return pendingPetId;
  },
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
        battleNotice: result.stale ? rpgNotice().walletStale : result.fallbackUsed ? rpgNotice().walletFallback : null
      });
    } catch (error) {
      set({
        walletCardsStatus: "error",
        walletCardsError: error instanceof Error ? error.message : rpgNotice().walletReadFailed,
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
      const selected = normalizePartySlots(state.selectedPartyPetIds);
      const selectedIndex = selected.indexOf(definitionId);
      if (selectedIndex >= 0) {
        const next = [...selected];
        next[selectedIndex] = "";
        return { selectedPartyPetIds: next, battleNotice: null };
      }
      const emptyIndex = selected.findIndex((id) => !id);
      if (emptyIndex < 0) {
        return { battleNotice: rpgNotice().partyFull };
      }
      const next = [...selected];
      next[emptyIndex] = definitionId;
      return { selectedPartyPetIds: next, battleNotice: null };
    }),
  movePartyPetSlot: (fromIndex, toIndex) =>
    set((state) => {
      const selected = normalizePartySlots(state.selectedPartyPetIds);
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= 3 || toIndex >= 3) return {};
      const next = [...selected];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return { selectedPartyPetIds: next, battleNotice: null };
    }),
  equipMoveToPet: (definitionId, moveId) =>
    set((state) => {
      const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
      const move = getRpgMoveById(moveId);
      if (!definition || !move) return {};
      const notice = rpgNotice();
      const petName = rpgPetName(definition.id, definition.name);
      const moveName = rpgMoveName(move);
      const elementLabel = rpgElementLabel(move.element);
      if (move.element !== definition.element) return { battleNotice: notice.wrongPetElement(moveName, elementLabel) };
      if (!isStarterMove(definitionId, moveId) && !state.skillInventory[moveId]) return { battleNotice: notice.missingSkill };
      const current = moveIdsForPet(definitionId, state.petMoveLoadouts);
      if (current.includes(moveId)) return { battleNotice: notice.alreadyEquipped(petName, moveName) };
      const nextMoves = current.length >= RPG_MAX_EQUIPPED_MOVES ? [...current.slice(1), moveId] : [...current, moveId];
      return {
        petMoveLoadouts: { ...state.petMoveLoadouts, [definitionId]: nextMoves },
        battleNotice: notice.equippedMove(petName, moveName)
      };
    }),
  unequipMoveFromPet: (definitionId, moveId) =>
    set((state) => {
      const definition = RPG_STARTER_PETS.find((pet) => pet.id === definitionId);
      const move = getRpgMoveById(moveId);
      if (!definition || !move) return {};
      const notice = rpgNotice();
      const current = moveIdsForPet(definitionId, state.petMoveLoadouts);
      if (!current.includes(moveId)) return {};
      if (current.length <= 1) return { battleNotice: notice.keepOneMove };
      const nextMoves = current.filter((id) => id !== moveId);
      return {
        petMoveLoadouts: { ...state.petMoveLoadouts, [definitionId]: nextMoves },
        battleNotice: notice.unequippedMove(rpgPetName(definition.id, definition.name), rpgMoveName(move))
      };
    }),
  drawSkill: (ticketId, preferredElement) => {
    const state = get();
    const remainingTickets = state.ticketInventory[ticketId] ?? 0;
    if (remainingTickets <= 0) {
      set({ battleNotice: rpgNotice().noSkillTicket });
      return null;
    }
    const result = drawRpgSkillTicket(ticketId, { preferredElement });
    const createdAt = Date.now();
    const entry: RpgDrawHistoryEntry = {
      id: `${ticketId}-${createdAt}-${state.drawHistory.length}`,
      ticketId,
      ticketLabel: rpgTicketCopy(result.ticket).label,
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
      battleNotice: rpgNotice().skillCardsAdded(result.moves.length)
    });
    return entry;
  },
  drawWalletCardSkill: async (cardId) => {
    const state = get();
    const notice = rpgNotice();
    const card = state.walletCards.find((candidate) => walletCardKey(candidate) === cardId);
    if (!card) {
      set({ battleNotice: notice.missingWalletCard });
      return null;
    }
    const existingMove = getRpgMoveById(state.cardSkillBindings[cardId]);
    if (existingMove) {
      set({ battleNotice: notice.cardAlreadyBound(card.pokemonName || card.name, rpgMoveName(existingMove)) });
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
        set({ battleNotice: notice.missingBackendMove });
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
        battleNotice: notice.cardBound(card.pokemonName || card.name, rpgElementLabel(move.element), rpgMoveName(move))
      }));
      return entry;
    } catch (error) {
      set({ battleNotice: error instanceof Error ? error.message : notice.cardBindFailed });
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
      set({ battleNotice: rpgNotice().cardNoSkill });
      return;
    }
    if (move.element !== definition.element) {
      set({ battleNotice: rpgNotice().cardWrongElement(rpgMoveName(move), rpgElementLabel(move.element)) });
      return;
    }
    try {
      const result = await equipRpgWalletCard(state.walletAddress, definition.id, cardId);
      set({
        petCardLoadouts: sanitizePetCardLoadouts(result.petCardLoadouts, state.cardSkillBindings),
        battleNotice: rpgNotice().cardEquipped(rpgPetName(definition.id, definition.name), card.pokemonName || card.name, rpgMoveName(move))
      });
    } catch (error) {
      set({ battleNotice: error instanceof Error ? error.message : rpgNotice().equipCardFailed });
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
        battleNotice: rpgNotice().cardUnequipped(rpgPetName(definition.id, definition.name), card?.pokemonName || card?.name || rpgCopy().cabinet.card, move ? rpgMoveName(move) : undefined)
      });
    } catch (error) {
      set({ battleNotice: error instanceof Error ? error.message : rpgNotice().unequipCardFailed });
    }
  },
  setAiDifficulty: (difficulty) => set({ selectedAiDifficulty: difficulty, battleNotice: null }),
  startAiBattle: (difficulty) => {
    const aiDifficulty = difficulty ?? get().selectedAiDifficulty;
    const playerRoster = selectedRosterForOwner("player", get().selectedPartyPetIds, get().petMoveLoadouts, get().cardSkillBindings, get().petCardLoadouts);
    if (!playerRoster) {
      set({ battleNotice: rpgNotice().partyNeedsThree });
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
      battleNotice: rpgNotice().aiBattleStarted(rpgAiDifficultyCopy(aiDifficulty).title)
    });
  },
  createVersusRoom: async () => {
    const roster = selectedRosterSelection(get().selectedPartyPetIds, get().petMoveLoadouts, get().cardSkillBindings, get().petCardLoadouts);
    if (!roster) {
      set({ battleNotice: rpgNotice().partyNeedsThree });
      return;
    }
    disconnectVersusSocket();
    set({ versusConnection: "connecting", battleMode: "versus", battleNotice: rpgNotice().connectingVersus });
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
        battleNotice: rpgNotice().roomCreated
      });
    } catch (error) {
      socket.disconnect();
      if (versusSocket === socket) versusSocket = null;
      set({ versusConnection: "error", battleNotice: error instanceof Error ? error.message : rpgNotice().versusConnectFailed });
    }
  },
  joinVersusRoom: async (roomCode) => {
    const roster = selectedRosterSelection(get().selectedPartyPetIds, get().petMoveLoadouts, get().cardSkillBindings, get().petCardLoadouts);
    if (!roster) {
      set({ battleNotice: rpgNotice().partyNeedsThree });
      return;
    }
    disconnectVersusSocket();
    set({ versusConnection: "connecting", battleMode: "versus", battleNotice: rpgNotice().joiningVersus });
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
        battleNotice: rpgNotice().roomJoined
      });
    } catch (error) {
      socket.disconnect();
      if (versusSocket === socket) versusSocket = null;
      set({ versusConnection: "error", battleNotice: error instanceof Error ? error.message : rpgNotice().joinFailed });
    }
  },
  selectEnemyTarget: (targetId) =>
    set((state) => ({
      selectedEnemyId: targetId,
      pendingActions: retargetPendingActions(state, "enemy", targetId),
      battleNotice: null
    })),
  selectAllyTarget: (targetId) =>
    set((state) => ({
      selectedAllyId: targetId,
      pendingActions: retargetPendingActions(state, "ally", targetId),
      battleNotice: null
    })),
  selectBattleMove: (actorId, moveId) => {
    const state = get();
    const battle = state.activeBattle;
    const actor = battle?.left.find((pet) => pet.id === actorId);
    const move = getRpgMoveById(moveId);
    if (!battle || !actor || !move) return;
    if ((battle.activeSide ?? "left") !== "left") {
      set({ battleNotice: rpgNotice().notPlayerTurn });
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
          set({ battleNotice: rpgNotice().enemyNoAction });
          return;
        }
        const nextBattle = resolveRpgBattleTurn(battle, aiActions);
        set({
          activeBattle: nextBattle,
          pendingActions: {},
          selectedEnemyId: firstLivingEnemyId(nextBattle),
          selectedAllyId: firstLivingAllyId(nextBattle),
          battleNotice: nextBattle.winner ? rpgNotice().battleFinished : null
        });
        return;
      }
      set({ battleNotice: rpgNotice().waitingOpponentAction });
      return;
    }

    const playerActions: RpgBattleAction[] = battle.left
      .filter((pet) => !pet.defeated && pet.hp > 0)
      .flatMap((pet) => {
        const pendingAction = state.pendingActions[pet.id];
        return pendingAction ? [{ actorId: pet.id, moveId: pendingAction.moveId, targetId: pendingAction.targetId }] : [];
    });
    if (playerActions.length <= 0) {
      set({ battleNotice: rpgNotice().chooseOneMove });
      return;
    }
    const spentEnergy = playerActions.reduce((sum, action) => sum + (getRpgMoveById(action.moveId)?.energyCost ?? roundEnergy + 1), 0);
    if (spentEnergy > roundEnergy) {
      set({ battleNotice: rpgNotice().energyExceeded(roundEnergy) });
      return;
    }

    if (state.battleMode === "versus") {
      if (!versusSocket || !state.versusRoomCode) {
        set({ battleNotice: rpgNotice().versusNotConnected });
        return;
      }
      if (state.versusConnection !== "connected") {
        set({ battleNotice: state.versusConnection === "reconnecting" ? rpgNotice().reconnectingNoSubmit : rpgNotice().versusNotSynced });
        return;
      }
      versusSocket.submitActions(state.versusRoomCode, playerActions);
      set({ battleNotice: rpgNotice().submittedActions(playerActions.length), versusSubmittedPlayerIds: state.versusPlayerId ? [...new Set([...state.versusSubmittedPlayerIds, state.versusPlayerId])] : state.versusSubmittedPlayerIds });
      return;
    }

    if (state.battleMode === "ai") {
      const nextBattle = resolveRpgBattleTurn(battle, playerActions);
      set({
        activeBattle: nextBattle,
        pendingActions: {},
        selectedEnemyId: firstLivingEnemyId(nextBattle),
        selectedAllyId: firstLivingAllyId(nextBattle),
        battleNotice: nextBattle.winner ? rpgNotice().battleFinished : null
      });
      return;
    }
  },
  requestVersusRematch: () => {
    const state = get();
    if (state.battleMode !== "versus" || !state.activeBattle?.winner) {
      set({ battleNotice: rpgNotice().noFinishedVersus });
      return;
    }
    if (!versusSocket || !state.versusRoomCode) {
      set({ battleNotice: rpgNotice().versusNotConnected });
      return;
    }
    if (state.versusConnection !== "connected") {
      set({ battleNotice: rpgNotice().versusResyncNoRematch });
      return;
    }
    versusSocket.requestRematch(state.versusRoomCode);
    set({
      battleNotice: state.versusOpponentConnected ? rpgNotice().rematchWaitingConfirm : rpgNotice().rematchWaitingReconnect,
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

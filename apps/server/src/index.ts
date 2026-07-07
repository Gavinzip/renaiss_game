import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { CLASS_ORDER, MAP_PROP_TYPES, RPG_ELEMENT_META, RPG_STARTER_PETS, WORLD, drawRpgSkillTicket, getRpgMoveById, getRpgWalletCardElement, type ClassId, type Collider, type ClassSwitchRequest, type JoinRequest, type MapProp, type PlayerInput, type RpgVersusJoinRequest, type RpgVersusRematchRequest, type RpgVersusSubmitActions } from "@renaiss-game/shared";
import { loadServerEnv } from "./env";
import { GameRoom } from "./game/GameRoom";
import { RpgBattleRoomManager } from "./rpg/RpgBattleRoom";
import { fetchWalletCollectibles, type RpgWalletCollectible } from "./rpg/walletCards";
import { DEFAULT_RPG_WALLET_ADDRESS, DEFAULT_RPG_WALLET_CARDS } from "./rpg/defaultWalletCards";
import { installXAuthRoutes } from "./auth/xAuth";
import { allowedOriginList, resolveCorsOrigin } from "./http/corsPolicy";
import {
  bindRpgWalletCardSkill,
  equipRpgCardToPet,
  getRpgCardSkillBindings,
  getRpgPetCardLoadouts,
  getStoredRpgWalletCard,
  getStoredRpgWalletCards,
  normalizeRpgWalletAddress,
  persistRpgWalletCards,
  rpgProfileDbPath,
  rpgProfileStorageInfo,
  unequipRpgCardFromPet
} from "./rpg/rpgProfileDb";

loadServerEnv();

const port = Number(process.env.PORT ?? 8787);
const app = express();
const httpServer = createServer(app);
const defaultRoom = new GameRoom();
const rpgRooms = new RpgBattleRoomManager();
const previewRooms = new Map<string, GameRoom>();
const socketRooms = new Map<string, GameRoom>();
const VALID_PROP_TYPES = new Set<string>(MAP_PROP_TYPES);
const MAX_PREVIEW_PROPS = 220;
const RPG_ROOM_SWEEP_MS = 30_000;
const preferSqliteWalletCards = process.env.RENAISS_RPG_WALLET_SQLITE_FIRST === "1";
const allowDefaultWalletRefresh = process.env.RENAISS_RPG_REFRESH_DEFAULT_WALLET === "1";

app.use(cors({ origin: resolveCorsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

installXAuthRoutes(app);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    players: defaultRoom.playerCount(),
    bots: defaultRoom.botCount(),
    previewRooms: previewRooms.size,
    previewPlayers: [...previewRooms.values()].reduce((count, room) => count + room.playerCount(), 0),
    rpgRooms: rpgRooms.roomCount(),
    rpgPlayers: rpgRooms.playerCount(),
    storage: rpgProfileStorageInfo(),
    cors: {
      allowedOrigins: allowedOriginList()
    }
  });
});

app.get("/api/rpg/wallet-cards/:walletAddress", async (req, res) => {
  const wallet = normalizeRpgWalletAddress(req.params.walletAddress);
  if (isDefaultRpgWallet(wallet) && (!allowDefaultWalletRefresh || req.query.refresh !== "1")) {
    persistRpgWalletCards(wallet, DEFAULT_RPG_WALLET_CARDS);
    const stored = getStoredRpgWalletCards(wallet);
    const cards = stored.cards.length > 0 ? stored.cards : [...DEFAULT_RPG_WALLET_CARDS];
    res.json({
      success: true,
      reason: "default_wallet_fixture_pinned",
      stale: false,
      staleReason: null,
      walletAddress: wallet,
      source: "default_wallet_fixture",
      fallbackUsed: false,
      cached: true,
      collectibleCount: cards.length,
      totalFMV: totalWalletFmv(cards),
      scannedRows: cards.length,
      collectibles: cards,
      profileDb: rpgProfileDbPath(),
      cachedAt: stored.lastSeenAt || Date.now(),
      cardSkillBindings: getRpgCardSkillBindings(wallet),
      petCardLoadouts: getRpgPetCardLoadouts(wallet)
    });
    return;
  }

  if (preferSqliteWalletCards) {
    const stored = getStoredRpgWalletCards(wallet);
    if (stored.cards.length > 0) {
      res.json({
        success: true,
        reason: "wallet_collection_sqlite_preferred",
        stale: true,
        staleReason: "playtest_sqlite_wallet_source",
        walletAddress: wallet,
        source: "sqlite_wallet_cards_preferred",
        fallbackUsed: true,
        collectibleCount: stored.cards.length,
        totalFMV: Number(stored.cards.reduce((sum, card) => sum + card.fmvUSD, 0).toFixed(2)),
        scannedRows: stored.cards.length,
        collectibles: stored.cards,
        profileDb: rpgProfileDbPath(),
        cachedAt: stored.lastSeenAt,
        cardSkillBindings: getRpgCardSkillBindings(wallet),
        petCardLoadouts: getRpgPetCardLoadouts(wallet)
      });
      return;
    }
  }

  const result = await fetchWalletCollectibles(req.params.walletAddress, { force: req.query.refresh === "1" });
  if (result.success) {
    persistRpgWalletCards(result.walletAddress, result.collectibles);
    res.json({
      ...result,
      profileDb: rpgProfileDbPath(),
      cardSkillBindings: getRpgCardSkillBindings(result.walletAddress),
      petCardLoadouts: getRpgPetCardLoadouts(result.walletAddress)
    });
    return;
  }

  const stored = getStoredRpgWalletCards(wallet);
  if (stored.cards.length > 0) {
    res.json({
      success: true,
      reason: "wallet_collection_fetch_failed_using_sqlite_cache",
      stale: true,
      staleReason: result.error ?? result.reason ?? "wallet_collection_fetch_failed",
      walletAddress: wallet,
      source: "sqlite_wallet_cards_cache",
      fallbackUsed: true,
      collectibleCount: stored.cards.length,
      totalFMV: Number(stored.cards.reduce((sum, card) => sum + card.fmvUSD, 0).toFixed(2)),
      scannedRows: result.scannedRows,
      collectibles: stored.cards,
      profileDb: rpgProfileDbPath(),
      cachedAt: stored.lastSeenAt,
      cardSkillBindings: getRpgCardSkillBindings(wallet),
      petCardLoadouts: getRpgPetCardLoadouts(wallet)
    });
    return;
  }

  res.status(502).json({
    ...result,
    profileDb: rpgProfileDbPath(),
    cardSkillBindings: {},
    petCardLoadouts: {}
  });
});

app.post("/api/rpg/wallet-cards/:walletAddress/draw", (req, res) => {
  const wallet = normalizeRpgWalletAddress(req.params.walletAddress);
  if (isDefaultRpgWallet(wallet)) {
    persistRpgWalletCards(wallet, DEFAULT_RPG_WALLET_CARDS);
  }

  const cardId = typeof req.body?.cardId === "string" ? req.body.cardId.trim() : "";
  if (!cardId) {
    res.status(400).json({ success: false, reason: "missing_card_id" });
    return;
  }

  const card = getStoredRpgWalletCard(wallet, cardId);
  if (!card) {
    res.status(404).json({ success: false, reason: "card_not_synced", message: "Sync wallet cards before drawing this card." });
    return;
  }

  const existingMove = getRpgMoveById(getRpgCardSkillBindings(wallet)[cardId]);
  if (existingMove) {
    res.json({
      success: true,
      alreadyBound: true,
      cardSkillBindings: getRpgCardSkillBindings(wallet),
      petCardLoadouts: getRpgPetCardLoadouts(wallet),
      entry: {
        id: `${cardId}-${existingMove.id}`,
        ticketId: walletCardTicketId(card),
        ticketLabel: walletCardTierLabel(card),
        createdAt: Date.now(),
        moves: [existingMove]
      }
    });
    return;
  }

  const storedCards = getStoredRpgWalletCards(wallet).cards;
  const result = drawRpgSkillTicket(walletCardTicketId(card), { preferredElement: getRpgWalletCardElement(card, storedCards) });
  const move = result.moves[0];
  if (!move) {
    res.status(500).json({ success: false, reason: "empty_draw_result" });
    return;
  }

  const createdAt = Date.now();
  const cardSkillBindings = bindRpgWalletCardSkill(wallet, cardId, move.id, result.ticket.id);
  const persistedMove = getRpgMoveById(cardSkillBindings[cardId]) ?? move;
  res.json({
    success: true,
    alreadyBound: false,
    cardSkillBindings,
    petCardLoadouts: getRpgPetCardLoadouts(wallet),
    entry: {
      id: `${cardId}-${move.id}-${createdAt}`,
      ticketId: result.ticket.id,
      ticketLabel: result.ticket.label,
      createdAt,
      moves: [persistedMove]
    }
  });
});

app.post("/api/rpg/pet-card-loadouts/:walletAddress/equip", (req, res) => {
  const wallet = normalizeRpgWalletAddress(req.params.walletAddress);
  const petId = typeof req.body?.petId === "string" ? req.body.petId.trim() : "";
  const cardId = typeof req.body?.cardId === "string" ? req.body.cardId.trim() : "";
  const pet = RPG_STARTER_PETS.find((candidate) => candidate.id === petId);
  const move = getRpgMoveById(getRpgCardSkillBindings(wallet)[cardId]);
  if (!pet || !cardId) {
    res.status(400).json({ success: false, reason: "invalid_pet_or_card" });
    return;
  }
  if (!move) {
    res.status(400).json({ success: false, reason: "card_skill_not_bound" });
    return;
  }
  if (move.element !== pet.element) {
    res.status(400).json({
      success: false,
      reason: "wrong_pet_element",
      message: `${move.name} 是${RPG_ELEMENT_META[move.element].label}屬性，只能裝到${RPG_ELEMENT_META[move.element].label}寵物。`
    });
    return;
  }
  res.json({ success: true, petCardLoadouts: equipRpgCardToPet(wallet, pet.id, cardId, move.element) });
});

app.post("/api/rpg/pet-card-loadouts/:walletAddress/unequip", (req, res) => {
  const wallet = normalizeRpgWalletAddress(req.params.walletAddress);
  const petId = typeof req.body?.petId === "string" ? req.body.petId.trim() : "";
  const cardId = typeof req.body?.cardId === "string" ? req.body.cardId.trim() : "";
  if (!petId || !cardId) {
    res.status(400).json({ success: false, reason: "invalid_pet_or_card" });
    return;
  }
  res.json({ success: true, petCardLoadouts: unequipRpgCardFromPet(wallet, petId, cardId) });
});

function walletCardTier(card: RpgWalletCollectible): "low" | "middle" | "high" {
  if (card.fmvUSD >= 500) return "high";
  if (card.fmvUSD >= 100) return "middle";
  return "low";
}

function walletCardTicketId(card: RpgWalletCollectible) {
  const tier = walletCardTier(card);
  if (tier === "high") return "ticket_ultimate_card";
  if (tier === "middle") return "ticket_intermediate_card";
  return "ticket_basic_card";
}

function walletCardTierLabel(card: RpgWalletCollectible) {
  const tier = walletCardTier(card);
  if (tier === "high") return "高階技能卡券";
  if (tier === "middle") return "中階技能卡券";
  return "初階技能卡券";
}

function isDefaultRpgWallet(walletAddress: string) {
  return normalizeRpgWalletAddress(walletAddress) === DEFAULT_RPG_WALLET_ADDRESS;
}

function totalWalletFmv(cards: readonly RpgWalletCollectible[]) {
  return Number(cards.reduce((sum, card) => sum + card.fmvUSD, 0).toFixed(2));
}

const io = new Server(httpServer, {
  cors: {
    origin: resolveCorsOrigin,
    credentials: true
  }
});

io.on("connection", (socket) => {
  socket.on("join", (request: JoinRequest) => {
    const room = roomForJoin(socket.id, request);
    if (!room) {
      socket.emit("join_error", { message: "Invalid map draft payload" });
      return;
    }

    socketRooms.set(socket.id, room);
    const accepted = room.addHuman(socket.id, request);
    socket.emit("joined", accepted);
  });

  socket.on("input", (input: PlayerInput) => {
    roomForSocket(socket.id).setHumanInput(socket.id, input);
  });

  socket.on("switch_class", (request: Partial<ClassSwitchRequest> = {}) => {
    if (!isClassId(request.classId)) {
      socket.emit("switch_class_error", { message: "Invalid class selection." });
      return;
    }
    const switched = roomForSocket(socket.id).switchHumanClass(socket.id, request.classId);
    if (!switched) {
      socket.emit("switch_class_error", { message: "Class can only be changed while knocked out." });
    }
  });

  socket.on("rpg_create_room", (request: Partial<RpgVersusJoinRequest> = {}) => {
    try {
      const sessionId = normalizeRpgSessionId(request.sessionId);
      if (!sessionId) {
        socket.emit("rpg_error", { message: "Missing RPG session. Please reopen the gym room." });
        return;
      }
      const accepted = rpgRooms.createRoom(socket.id, sessionId, request.playerName ?? "GUEST_2AC1", request.roster);
      socket.emit("rpg_joined", accepted);
      emitRpgRoomState(socket.id);
    } catch (error) {
      socket.emit("rpg_error", { message: error instanceof Error ? error.message : "Unable to create RPG room." });
    }
  });

  socket.on("rpg_join_room", (request: Partial<RpgVersusJoinRequest> = {}) => {
    const sessionId = normalizeRpgSessionId(request.sessionId);
    if (!sessionId) {
      socket.emit("rpg_error", { message: "Missing RPG session. Please reopen the gym room." });
      return;
    }
    const accepted = rpgRooms.joinRoom(socket.id, sessionId, request.roomCode ?? "", request.playerName ?? "GUEST_2AC1", request.roster);
    if (!accepted) {
      socket.emit("rpg_error", { message: "RPG room not found, full, or missing a valid three-pet roster." });
      return;
    }
    socket.emit("rpg_joined", accepted);
    emitRpgRoomState(socket.id);
  });

  socket.on("rpg_submit_actions", (request: RpgVersusSubmitActions) => {
    if (!request || !Array.isArray(request.actions)) {
      socket.emit("rpg_error", { message: "Invalid RPG action payload." });
      return;
    }
    rpgRooms.submit(socket.id, request.actions);
    emitRpgRoomState(socket.id);
  });

  socket.on("rpg_request_rematch", (request: RpgVersusRematchRequest) => {
    if (!request?.roomCode) {
      socket.emit("rpg_error", { message: "Invalid RPG rematch payload." });
      return;
    }
    rpgRooms.requestRematch(socket.id);
    emitRpgRoomState(socket.id);
  });

  socket.on("rpg_leave", () => {
    const relatedSocketIds = rpgRooms.socketIdsFor(socket.id);
    rpgRooms.leave(socket.id);
    for (const relatedSocketId of relatedSocketIds) {
      if (relatedSocketId !== socket.id) emitRpgState(relatedSocketId);
    }
  });

  socket.on("disconnect", () => {
    const room = roomForSocket(socket.id);
    const relatedSocketIds = rpgRooms.socketIdsFor(socket.id);
    room.removeHuman(socket.id);
    socketRooms.delete(socket.id);
    previewRooms.delete(socket.id);
    rpgRooms.disconnect(socket.id);
    for (const relatedSocketId of relatedSocketIds) {
      if (relatedSocketId !== socket.id) emitRpgState(relatedSocketId);
    }
  });
});

setInterval(() => {
  for (const room of activeRooms()) {
    room.update(1000 / WORLD.tickRate);
  }
}, 1000 / WORLD.tickRate);

setInterval(() => {
  for (const socket of io.sockets.sockets.values()) {
    socket.emit("state", roomForSocket(socket.id).snapshotFor(socket.id));
  }
}, 1000 / WORLD.broadcastRate);

setInterval(() => {
  rpgRooms.pruneStaleRooms();
}, RPG_ROOM_SWEEP_MS);

httpServer.listen(port, () => {
  console.log(`Renaiss Arena server listening on http://localhost:${port}`);
});

function roomForJoin(socketId: string, request: JoinRequest) {
  const noBots = request.review?.noBots === true;
  const fixedSpawn = request.review?.fixedSpawn === true;
  const fixedSpawnPoint = fixedSpawn && request.review?.spawnPoint ? sanitizeReviewSpawnPoint(request.review.spawnPoint) : undefined;
  if (!request.mapDraft && !noBots) {
    return defaultRoom;
  }

  if (request.mapDraft && !isValidMapDraftProps(request.mapDraft.props)) {
    return null;
  }

  const room = new GameRoom({ mapProps: request.mapDraft?.props, noBots, fixedSpawn, fixedSpawnPoint });
  previewRooms.set(socketId, room);
  return room;
}

function roomForSocket(socketId: string) {
  return socketRooms.get(socketId) ?? defaultRoom;
}

function activeRooms() {
  return [defaultRoom, ...previewRooms.values()];
}

function isValidMapDraftProps(value: unknown): value is MapProp[] {
  return Array.isArray(value) && value.length <= MAX_PREVIEW_PROPS && value.every(isValidMapProp);
}

function isValidMapProp(value: unknown): value is MapProp {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prop = value as Partial<MapProp>;
  return (
    typeof prop.id === "string" &&
    typeof prop.type === "string" &&
    VALID_PROP_TYPES.has(prop.type) &&
    isFiniteNumber(prop.x) &&
    isFiniteNumber(prop.y) &&
    isFiniteNumber(prop.width) &&
    isFiniteNumber(prop.height) &&
    isFiniteNumber(prop.depthOffset) &&
    (prop.collider === undefined || isValidCollider(prop.collider))
  );
}

function isValidCollider(value: unknown): value is Collider {
  if (!value || typeof value !== "object") {
    return false;
  }

  const collider = value as Partial<Collider>;
  if (collider.kind === "circle") {
    return isFiniteNumber(collider.x) && isFiniteNumber(collider.y) && isFiniteNumber(collider.radius);
  }

  if (collider.kind === "rect") {
    return isFiniteNumber(collider.x) && isFiniteNumber(collider.y) && isFiniteNumber(collider.width) && isFiniteNumber(collider.height);
  }

  return false;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeReviewSpawnPoint(point: unknown) {
  if (!point || typeof point !== "object") {
    return undefined;
  }

  const candidate = point as Partial<{ x: unknown; y: unknown }>;
  if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) {
    return undefined;
  }

  return {
    x: Math.max(0, Math.min(WORLD.width, candidate.x)),
    y: Math.max(0, Math.min(WORLD.height, candidate.y))
  };
}

function isClassId(value: unknown): value is ClassId {
  return typeof value === "string" && CLASS_ORDER.includes(value as ClassId);
}

function normalizeRpgSessionId(sessionId: unknown) {
  if (typeof sessionId !== "string") return null;
  const normalized = sessionId.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return normalized.length >= 16 ? normalized : null;
}

function emitRpgState(socketId: string) {
  const snapshot = rpgRooms.snapshotFor(socketId);
  if (!snapshot) return;
  io.to(socketId).emit("rpg_state", snapshot);
}

function emitRpgRoomState(socketId: string) {
  const socketIds = rpgRooms.socketIdsFor(socketId);
  if (socketIds.length === 0) {
    emitRpgState(socketId);
    return;
  }
  for (const relatedSocketId of socketIds) {
    emitRpgState(relatedSocketId);
  }
}

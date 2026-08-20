import cors from "cors";
import { randomUUID } from "node:crypto";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ARENA_CONTENT_MANIFEST_V1_SOURCE_SHA256, ARENA_PROTOCOL_V1_SCHEMA_SHA256, CLASS_ORDER, MAP_PROP_TYPES, RPG_ELEMENT_META, RPG_STARTER_PETS, WORLD, drawRpgSkillTicket, getRpgMoveById, getRpgWalletCardElement, isArenaCatalogLoadout, isArenaCatalogLoadoutCompatibleWithTurretKind, isArenaGameMode, isArenaLoadout, isEngineerTurretKind, type AssetsReadyRequest, type ClassId, type Collider, type ClassSwitchRequest, type JoinRequest, type MapProp, type MatchAssetManifest, type MatchPrepareRequest, type RpgVersusJoinRequest, type RpgVersusRematchRequest, type RpgVersusSubmitActions } from "@renaiss-game/shared";
import { loadServerEnv } from "./env";
import { GameRoom } from "./game/GameRoom";
import { ArenaMatchRegistry } from "./game/ArenaMatchRegistry";
import { ArenaInputGuard } from "./game/arenaInputGuard";
import { buildMatchAssetManifest, requiredPackHashes } from "./game/arenaContentReadiness";
import { RpgBattleRoomManager } from "./rpg/RpgBattleRoom";
import { fetchWalletCollectibles, type RpgWalletCollectible } from "./rpg/walletCards";
import { DEFAULT_RPG_WALLET_ADDRESS, DEFAULT_RPG_WALLET_CARDS } from "./rpg/defaultWalletCards";
import { installXAuthRoutes, resolveArenaSocketAuthUser, resolveHttpAuthUser } from "./auth/xAuth";
import { allowedOriginList, isAllowedGameOrigin, resolveCorsOrigin } from "./http/corsPolicy";
import {
  bindRpgWalletCardSkill,
  arenaProgressionOwnerKey,
  drawArenaSkill,
  getArenaCatalogLoadouts,
  getArenaSkillDrawAllowance,
  equipRpgCardToPet,
  getArenaUnlockedSkillIds,
  getRpgCardSkillBindings,
  getRpgPetCardLoadouts,
  getStoredRpgWalletCard,
  getStoredRpgWalletCards,
  normalizeRpgWalletAddress,
  persistRpgWalletCards,
  rpgProfileDbPath,
  rpgProfileStorageInfo,
  isArenaCatalogLoadoutUnlocked,
  isArenaCatalogLoadoutSelectionUnlocked,
  saveArenaCatalogLoadout,
  unlockAllArenaSkills,
  unequipRpgCardFromPet
} from "./rpg/rpgProfileDb";

loadServerEnv();

const port = Number(process.env.PORT ?? 8787);
const app = express();
const httpServer = createServer(app);
const arenaMatches = new ArenaMatchRegistry();
const arenaInputGuard = new ArenaInputGuard();
const rpgRooms = new RpgBattleRoomManager();
const previewRooms = new Map<string, GameRoom>();
const socketRooms = new Map<string, GameRoom>();
const readyGatedSockets = new Set<string>();
const pendingReadiness = new Map<string, PendingReadiness>();
const pendingReadinessByRoom = new Map<GameRoom, string>();
const arenaSessions = new Map<string, ArenaSession>();
const arenaSessionTokenBySocket = new Map<string, string>();
const VALID_PROP_TYPES = new Set<string>(MAP_PROP_TYPES);
const MAX_PREVIEW_PROPS = 220;
const RPG_ROOM_SWEEP_MS = 30_000;
const ARENA_READINESS_TTL_MS = 45_000;
const ARENA_RECONNECT_GRACE_MS = 20_000;
const preferSqliteWalletCards = process.env.RENAISS_RPG_WALLET_SQLITE_FIRST === "1";
const allowDefaultWalletRefresh = process.env.RENAISS_RPG_REFRESH_DEFAULT_WALLET === "1";

interface PendingReadiness {
  readinessId: string;
  joiningSocketId: string;
  request: JoinRequest;
  room: GameRoom;
  manifest: MatchAssetManifest;
  participantSocketIds: Set<string>;
  acknowledgedSocketIds: Set<string>;
  reconnectSessionToken: string | null;
  authUserId: string;
}

interface ArenaSession {
  token: string;
  room: GameRoom;
  playerId: string;
  socketId: string | null;
  expiresAt: number | null;
  authUserId: string;
}

app.use(cors({ origin: resolveCorsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

installXAuthRoutes(app);

app.get("/api/arena/skill-collection", (req, res) => {
  const user = resolveHttpAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, reason: "arena_auth_required" });
    return;
  }
  const ownerKey = arenaProgressionOwnerKey(user.provider, user.id);
  const allowance = getArenaSkillDrawAllowance(ownerKey);
  res.json({
    success: true,
    unlockedSkillIds: getArenaUnlockedSkillIds(ownerKey),
    catalogLoadouts: getArenaCatalogLoadouts(ownerKey),
    ...allowance
  });
});

app.post("/api/arena/catalog-loadout", (req, res) => {
  const requestOrigin = req.get("origin");
  if (!requestOrigin || !isAllowedGameOrigin(requestOrigin)) {
    res.status(403).json({ success: false, reason: "arena_catalog_loadout_origin_required" });
    return;
  }
  const user = resolveHttpAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, reason: "arena_auth_required" });
    return;
  }
  if (!isClassId(req.body?.classId) || !isArenaCatalogLoadout(req.body.classId, req.body?.loadout)) {
    res.status(400).json({ success: false, reason: "invalid_arena_catalog_loadout" });
    return;
  }
  const ownerKey = arenaProgressionOwnerKey(user.provider, user.id);
  if (!isArenaCatalogLoadoutSelectionUnlocked(ownerKey, req.body.loadout)) {
    res.status(403).json({ success: false, reason: "arena_catalog_loadout_contains_locked_skill" });
    return;
  }
  res.json({
    success: true,
    classId: req.body.classId,
    loadout: saveArenaCatalogLoadout(ownerKey, req.body.classId, req.body.loadout)
  });
});

app.post("/api/arena/skill-draw", (req, res) => {
  const requestOrigin = req.get("origin");
  if (!requestOrigin || !isAllowedGameOrigin(requestOrigin)) {
    res.status(403).json({ success: false, reason: "arena_skill_draw_origin_required" });
    return;
  }
  const user = resolveHttpAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, reason: "arena_auth_required" });
    return;
  }
  if (!isClassId(req.body?.classId)) {
    res.status(400).json({ success: false, reason: "invalid_arena_class" });
    return;
  }
  const ownerKey = arenaProgressionOwnerKey(user.provider, user.id);
  const result = drawArenaSkill(ownerKey, req.body.classId);
  if (result.retryAfterMs > 0) {
    res.status(429).json({
      success: false,
      reason: "arena_skill_draw_cooldown",
      retryAfterMs: result.retryAfterMs,
      unlockedSkillIds: result.unlockedSkillIds
    });
    return;
  }
  res.json({
    success: true,
    ...result,
    catalogLoadouts: getArenaCatalogLoadouts(ownerKey)
  });
});

app.post("/api/arena/skill-unlock-all", (req, res) => {
  const requestOrigin = req.get("origin");
  if (!requestOrigin || !isAllowedGameOrigin(requestOrigin)) {
    res.status(403).json({ success: false, reason: "arena_skill_unlock_origin_required" });
    return;
  }
  const user = resolveHttpAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, reason: "arena_auth_required" });
    return;
  }
  const ownerKey = arenaProgressionOwnerKey(user.provider, user.id);
  res.json({
    success: true,
    ...unlockAllArenaSkills(ownerKey),
    catalogLoadouts: getArenaCatalogLoadouts(ownerKey)
  });
});

app.get("/health", (_req, res) => {
  const freeForAll = arenaMatches.totals("free_for_all");
  const team = arenaMatches.totals("team_3v3");
  res.json({
    ok: true,
    players: freeForAll.players,
    bots: freeForAll.bots,
    teamPlayers: team.players,
    teamBots: team.bots,
    arenaMatches: {
      freeForAllRooms: freeForAll.rooms,
      teamRooms: team.rooms,
      active: arenaMatches.summaries()
    },
    previewRooms: previewRooms.size,
    previewPlayers: [...previewRooms.values()].reduce((count, room) => count + room.playerCount(), 0),
    arenaReadiness: {
      readyGatedPlayers: readyGatedSockets.size,
      pendingJoins: pendingReadiness.size,
      reconnectingPlayers: [...arenaSessions.values()].filter(
        (session) => session.expiresAt !== null
      ).length,
      inputSecurity: arenaInputGuard.metrics()
    },
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
  const arenaAuthUser = resolveArenaSocketAuthUser(socket.request, socket.handshake.auth);

  socket.on("prepare_match", (request: Partial<MatchPrepareRequest> = {}) => {
    if (!arenaAuthUser) {
      socket.emit("assets_ready_error", { message: "Arena authentication is required." });
      return;
    }
    if (!isValidArenaJoinRequest(request.join)) {
      socket.emit("assets_ready_error", { message: "Invalid arena loadout." });
      return;
    }
    const ownerKey = arenaProgressionOwnerKey(arenaAuthUser.provider, arenaAuthUser.id);
    if (!isArenaCatalogLoadoutUnlocked(ownerKey, request.join.catalogLoadout)) {
      socket.emit("assets_ready_error", { message: "Arena loadout contains a locked or empty skill." });
      return;
    }
    if (request.protocolSchemaHash !== ARENA_PROTOCOL_V1_SCHEMA_SHA256) {
      socket.emit("assets_ready_error", { message: "Arena Protocol v1 schema hash mismatch." });
      return;
    }
    if (typeof request.clientBuildId !== "string" || !request.clientBuildId.trim()) {
      socket.emit("assets_ready_error", { message: "Arena client build ID is required." });
      return;
    }
    if (
      request.clientBuildId.startsWith("web-") &&
      request.clientBuildId !== `web-${ARENA_CONTENT_MANIFEST_V1_SOURCE_SHA256}`
    ) {
      socket.emit("assets_ready_error", { message: "Arena Web content revision mismatch." });
      return;
    }
    if (socketRooms.has(socket.id) || findPendingReadinessForSocket(socket.id)) {
      socket.emit("assets_ready_error", { message: "Arena socket already joined or is preparing a match." });
      return;
    }

    const reconnectSessionToken = normalizeArenaSessionToken(request.sessionToken);
    if (request.sessionToken !== undefined && !reconnectSessionToken) {
      socket.emit("assets_ready_error", { message: "Arena reconnect session token is invalid." });
      return;
    }
    const reconnectSession = reconnectSessionToken
      ? getReconnectableArenaSession(reconnectSessionToken, arenaAuthUser.id)
      : null;
    if (reconnectSessionToken && !reconnectSession) {
      socket.emit("assets_ready_error", {
        message: "Arena reconnect session expired or is already active."
      });
      return;
    }
    const authenticatedJoin: JoinRequest = {
      ...request.join,
      name: arenaAuthUser.provider === "x"
        ? arenaAuthUser.username.trim().slice(0, 14).toUpperCase()
        : request.join.name
    };
    const room = reconnectSession?.room ?? roomForJoin(socket.id, authenticatedJoin);
    if (!room) {
      socket.emit("assets_ready_error", { message: "Invalid map draft payload." });
      return;
    }
    if (pendingReadinessByRoom.has(room)) {
      socket.emit("assets_ready_error", { message: "Another player is already passing the room readiness gate." });
      return;
    }

    const readinessId = randomUUID();
    const manifest = buildMatchAssetManifest(
      readinessId,
      Date.now() + ARENA_READINESS_TTL_MS,
      room.contentRequirementsFor(request.join)
    );
    const participantSocketIds = new Set<string>([socket.id]);
    for (const participantId of readyGatedSockets) {
      if (socketRooms.get(participantId) === room && io.sockets.sockets.has(participantId)) {
        participantSocketIds.add(participantId);
      }
    }
    const pending: PendingReadiness = {
      readinessId,
      joiningSocketId: socket.id,
      request: authenticatedJoin,
      room,
      manifest,
      participantSocketIds,
      acknowledgedSocketIds: new Set(),
      reconnectSessionToken,
      authUserId: arenaAuthUser.id
    };
    pendingReadiness.set(readinessId, pending);
    pendingReadinessByRoom.set(room, readinessId);
    for (const participantId of participantSocketIds) {
      io.sockets.sockets.get(participantId)?.emit("match_assets", manifest);
    }
  });

  socket.on("assets_ready", (request: Partial<AssetsReadyRequest> = {}) => {
    const readinessId = typeof request.readinessId === "string" ? request.readinessId : "";
    const pending = pendingReadiness.get(readinessId);
    if (!pending || !pending.participantSocketIds.has(socket.id)) {
      socket.emit("assets_ready_error", { message: "Unknown or unauthorized Arena readiness ticket." });
      return;
    }
    if (pending.manifest.expiresAt <= Date.now()) {
      failReadiness(pending, "Arena readiness ticket expired before all clients became ready.");
      return;
    }
    if (request.protocolSchemaHash !== ARENA_PROTOCOL_V1_SCHEMA_SHA256) {
      socket.emit("assets_ready_error", { message: "Arena Protocol v1 schema hash mismatch." });
      return;
    }
    const stages = request.stages;
    if (!stages?.downloaded || !stages.decoded || !stages.gpuUploaded || !stages.shadersWarmed) {
      socket.emit("assets_ready_error", {
        message: "Arena assets_ready requires download, decode, GPU upload, and shader warmup."
      });
      return;
    }
    if (!Array.isArray(request.readyPackHashes) ||
        !sameStrings(request.readyPackHashes, requiredPackHashes(pending.manifest))) {
      socket.emit("assets_ready_error", { message: "Arena required content hashes do not match the server manifest." });
      return;
    }
    if (typeof request.downloadedBytes !== "number" ||
        !Number.isSafeInteger(request.downloadedBytes) || request.downloadedBytes < 0) {
      socket.emit("assets_ready_error", { message: "Arena downloaded byte telemetry is invalid." });
      return;
    }
    pending.acknowledgedSocketIds.add(socket.id);
    tryFinalizeReadiness(pending);
  });

  socket.on("join", (request: JoinRequest) => {
    void request;
    socket.emit("join_error", {
      message: "Legacy Arena join is disabled. Use prepare_match and assets_ready."
    });
  });

  socket.on("input", (input: unknown) => {
    const room = roomForSocket(socket.id);
    const acceptedInput = arenaInputGuard.accept(socket.id, input, Boolean(room));
    if (room && acceptedInput) room.setHumanInput(socket.id, acceptedInput);
  });

  socket.on("switch_class", (request: Partial<ClassSwitchRequest> = {}) => {
    if (
      !isClassId(request.classId) ||
      !isArenaLoadout(request.loadout) ||
      !isArenaCatalogLoadout(request.classId, request.catalogLoadout) ||
      (request.engineerTurretKind !== undefined &&
        !isEngineerTurretKind(request.engineerTurretKind)) ||
      !isArenaCatalogLoadoutCompatibleWithTurretKind(
        request.classId,
        request.catalogLoadout ?? { skillQ: null, skillE: null, skillR: null },
        request.engineerTurretKind ?? "mechanical"
      )
    ) {
      socket.emit("switch_class_error", { message: "Invalid class or loadout selection." });
      return;
    }
    const room = roomForSocket(socket.id);
    if (!arenaAuthUser || !room) {
      socket.emit("switch_class_error", { message: "Arena authentication and an active match are required." });
      return;
    }
    const ownerKey = arenaProgressionOwnerKey(arenaAuthUser.provider, arenaAuthUser.id);
    if (!isArenaCatalogLoadoutUnlocked(ownerKey, request.catalogLoadout)) {
      socket.emit("switch_class_error", { message: "Class loadout contains a locked or empty skill." });
      return;
    }
    const switched = room.switchHumanClass(
      socket.id,
      request.classId,
      request.loadout,
      request.catalogLoadout,
      request.engineerTurretKind
    );
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
    const sessionToken = arenaSessionTokenBySocket.get(socket.id);
    const session = sessionToken ? arenaSessions.get(sessionToken) : null;
    if (room && session && session.room === room) {
      const detachedPlayerId = room.detachHuman(socket.id);
      if (detachedPlayerId === session.playerId) {
        session.socketId = null;
        session.expiresAt = Date.now() + ARENA_RECONNECT_GRACE_MS;
      } else {
        room.removeHuman(socket.id);
        arenaSessions.delete(session.token);
      }
      arenaSessionTokenBySocket.delete(socket.id);
    } else if (room) {
      room.removeHuman(socket.id);
    }
    socketRooms.delete(socket.id);
    arenaInputGuard.disconnect(socket.id);
    readyGatedSockets.delete(socket.id);
    handleReadinessDisconnect(socket.id);
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
    const room = socketRooms.get(socket.id);
    if (room) socket.emit("state", room.snapshotFor(socket.id));
  }
}, 1000 / WORLD.broadcastRate);

setInterval(() => {
  rpgRooms.pruneStaleRooms();
}, RPG_ROOM_SWEEP_MS);

setInterval(() => {
  const now = Date.now();
  for (const pending of pendingReadiness.values()) {
    if (pending.manifest.expiresAt <= now) {
      failReadiness(pending, "Arena readiness ticket expired before all clients became ready.");
    }
  }
  for (const session of [...arenaSessions.values()]) {
    if (session.expiresAt === null || session.expiresAt > now) continue;
    session.room.removeHumanByPlayerId(session.playerId);
    arenaSessions.delete(session.token);
    releaseArenaRoomIfEmpty(session.room);
  }
}, 1_000);

httpServer.listen(port, () => {
  console.log(`Renaiss Arena server listening on http://localhost:${port}`);
});

function tryFinalizeReadiness(pending: PendingReadiness) {
  for (const participantId of pending.participantSocketIds) {
    if (!pending.acknowledgedSocketIds.has(participantId)) return;
  }
  const joiningSocket = io.sockets.sockets.get(pending.joiningSocketId);
  if (!joiningSocket || socketRooms.has(pending.joiningSocketId)) {
    failReadiness(pending, "Arena joining socket disconnected or entered another room.");
    return;
  }

  socketRooms.set(pending.joiningSocketId, pending.room);
  let accepted;
  if (pending.reconnectSessionToken) {
    const session = getReconnectableArenaSession(
      pending.reconnectSessionToken,
      pending.authUserId
    );
    accepted = session
      ? pending.room.reconnectHuman(
          pending.joiningSocketId,
          session.playerId,
          session.token
        )
      : null;
    if (!accepted || !session) {
      socketRooms.delete(pending.joiningSocketId);
      failReadiness(pending, "Arena reconnect session expired before assets became ready.");
      return;
    }
    session.socketId = pending.joiningSocketId;
    session.expiresAt = null;
    arenaSessionTokenBySocket.set(pending.joiningSocketId, session.token);
  } else {
    if (!pending.room.hasHumanCapacity()) {
      socketRooms.delete(pending.joiningSocketId);
      failReadiness(pending, "Arena match reached capacity before spawn.");
      return;
    }
    const sessionToken = randomUUID();
    accepted = pending.room.addHuman(
      pending.joiningSocketId,
      pending.request,
      sessionToken
    );
    registerArenaSession(
      sessionToken,
      pending.room,
      accepted.playerId,
      pending.joiningSocketId,
      pending.authUserId
    );
  }
  readyGatedSockets.add(pending.joiningSocketId);
  joiningSocket.emit("joined", accepted);
  clearReadiness(pending);
}

function failReadiness(pending: PendingReadiness, message: string) {
  for (const participantId of pending.participantSocketIds) {
    io.sockets.sockets.get(participantId)?.emit("assets_ready_error", { message });
  }
  if (previewRooms.get(pending.joiningSocketId) === pending.room) {
    previewRooms.delete(pending.joiningSocketId);
  }
  clearReadiness(pending);
  releaseArenaRoomIfEmpty(pending.room);
}

function clearReadiness(pending: PendingReadiness) {
  pendingReadiness.delete(pending.readinessId);
  if (pendingReadinessByRoom.get(pending.room) === pending.readinessId) {
    pendingReadinessByRoom.delete(pending.room);
  }
}

function registerArenaSession(
  token: string,
  room: GameRoom,
  playerId: string,
  socketId: string,
  authUserId: string
) {
  arenaSessions.set(token, {
    token,
    room,
    playerId,
    socketId,
    expiresAt: null,
    authUserId
  });
  arenaSessionTokenBySocket.set(socketId, token);
}

function normalizeArenaSessionToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
    ? token
    : null;
}

function getReconnectableArenaSession(token: string, authUserId: string) {
  const session = arenaSessions.get(token);
  if (
    !session ||
    session.authUserId !== authUserId ||
    session.socketId !== null ||
    session.expiresAt === null
  ) return null;
  if (session.expiresAt <= Date.now()) {
    session.room.removeHumanByPlayerId(session.playerId);
    arenaSessions.delete(token);
    releaseArenaRoomIfEmpty(session.room);
    return null;
  }
  return session;
}

function releaseArenaRoomIfEmpty(room: GameRoom) {
  if (room.playerCount() > 0) return;
  for (const [socketId, previewRoom] of previewRooms) {
    if (previewRoom === room) previewRooms.delete(socketId);
  }
  arenaMatches.releaseIfEmpty(room);
}

function handleReadinessDisconnect(socketId: string) {
  for (const pending of [...pendingReadiness.values()]) {
    if (!pending.participantSocketIds.has(socketId)) continue;
    if (pending.joiningSocketId === socketId) {
      failReadiness(pending, "Joining player disconnected during the Arena readiness gate.");
      continue;
    }
    pending.participantSocketIds.delete(socketId);
    pending.acknowledgedSocketIds.delete(socketId);
    tryFinalizeReadiness(pending);
  }
}

function findPendingReadinessForSocket(socketId: string) {
  return [...pendingReadiness.values()].find((pending) =>
    pending.participantSocketIds.has(socketId)
  );
}

function sameStrings(actual: readonly string[], expected: readonly string[]) {
  if (actual.length !== expected.length || new Set(actual).size !== actual.length) return false;
  const sorted = [...actual].sort();
  return sorted.every((value, index) => value === expected[index]);
}

function isValidArenaJoinRequest(request: Partial<JoinRequest> | null | undefined): request is JoinRequest {
  return !!request &&
    isClassId(request.classId) &&
    isArenaLoadout(request.loadout) &&
    isArenaCatalogLoadout(request.classId, request.catalogLoadout) &&
    isArenaCatalogLoadoutCompatibleWithTurretKind(
      request.classId,
      request.catalogLoadout,
      request.engineerTurretKind ?? "mechanical"
    ) &&
    (request.mode === undefined || isArenaGameMode(request.mode)) &&
    (request.engineerTurretKind === undefined ||
      isEngineerTurretKind(request.engineerTurretKind));
}

function roomForJoin(socketId: string, request: JoinRequest) {
  const noBots = request.review?.noBots === true;
  const fixedSpawn = request.review?.fixedSpawn === true;
  const invulnerableHumans = request.review?.invulnerable === true;
  const freezeBots = request.review?.freezeBots === true;
  const invulnerableBots = request.review?.invulnerableBots === true;
  const reviewBotCount = sanitizeReviewBotCount(request.review?.botCount);
  const reviewBotHealth = sanitizeReviewBotHealth(request.review?.botHealth);
  const fixedSpawnPoint = fixedSpawn && request.review?.spawnPoint ? sanitizeReviewSpawnPoint(request.review.spawnPoint) : undefined;
  const fixedBotSpawnPoint = request.review?.targetPoint
    ? sanitizeReviewSpawnPoint(request.review.targetPoint)
    : undefined;
  const mode = request.mode ?? "free_for_all";
  const requestedMapProps = request.mapDraft?.props;
  if (!request.mapDraft && !noBots && !fixedSpawn) {
    return arenaMatches.acquire(mode, new Set(pendingReadinessByRoom.keys()));
  }

  if (requestedMapProps !== undefined && !isValidMapDraftProps(requestedMapProps)) {
    return null;
  }

  const room = new GameRoom({
    mode,
    mapProps: requestedMapProps,
    noBots,
    fixedSpawn,
    invulnerableHumans,
    fixedSpawnPoint,
    freezeBots,
    invulnerableBots,
    reviewBotCount,
    reviewBotHealth,
    fixedBotSpawnPoint
  });
  previewRooms.set(socketId, room);
  return room;
}

function sanitizeReviewBotCount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(8, value));
}

function sanitizeReviewBotHealth(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.min(10000, value));
}

function roomForSocket(socketId: string) {
  return socketRooms.get(socketId) ?? null;
}

function activeRooms() {
  return [...new Set([...arenaMatches.rooms(), ...previewRooms.values()])];
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

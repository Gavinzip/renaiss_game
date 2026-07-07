import {
  createRpgBattleState,
  createStarterRoster,
  getRpgBattleEnergyForTurn,
  getRpgMoveById,
  isLegalRpgActionTarget,
  RPG_STARTER_PETS,
  resolveRpgBattleTurn,
  type RpgBattleAction,
  type RpgBattleState,
  type RpgRosterPet,
  type RpgRosterSelection,
  type RpgVersusJoinAccepted,
  type RpgVersusSnapshot
} from "@renaiss-game/shared";

interface RpgRoomPlayer {
  id: string;
  sessionId: string;
  socketId: string | null;
  name: string;
  side: "left" | "right";
  connected: boolean;
  disconnectedAt: number | null;
  roster: RpgRosterPet[];
}

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DISCONNECT_GRACE_MS = 2 * 60 * 1000;

export class RpgBattleRoom {
  readonly code: string;
  private players: RpgRoomPlayer[] = [];
  private battle: RpgBattleState | null = null;
  private submissions = new Map<string, RpgBattleAction[]>();
  private rematchRequests = new Set<string>();
  private lastMessage: string | null = null;
  private matchNumber = 0;

  constructor(code: string) {
    this.code = code;
  }

  addPlayer(socketId: string, sessionId: string, name: string, rosterSelection: readonly RpgRosterSelection[] | undefined): RpgVersusJoinAccepted | null {
    const existing = this.players.find((player) => player.socketId === socketId);
    if (existing) {
      return { roomCode: this.code, playerId: existing.id, playerSide: existing.side };
    }

    const reconnecting = this.players.find((player) => player.sessionId === sessionId);
    if (reconnecting) {
      reconnecting.socketId = socketId;
      reconnecting.connected = true;
      reconnecting.disconnectedAt = null;
      reconnecting.name = name.trim().slice(0, 14) || reconnecting.name;
      this.lastMessage = `${reconnecting.name} 已重新連回房間。`;
      this.tryStartRematch();
      return { roomCode: this.code, playerId: reconnecting.id, playerSide: reconnecting.side };
    }

    if (this.players.length >= 2) return null;

    const side = this.players.length === 0 ? "left" : "right";
    const id = `rpg_${side}_${sessionId.slice(0, 8)}`;
    const roster = createRosterForPlayer(id, rosterSelection);
    if (roster.length !== 3) return null;

    const player: RpgRoomPlayer = {
      id,
      sessionId,
      socketId,
      name: name.trim().slice(0, 14) || "GUEST_2AC1",
      side,
      connected: true,
      disconnectedAt: null,
      roster
    };
    this.players.push(player);
    if (this.players.length === 2) this.startBattle();
    return { roomCode: this.code, playerId: player.id, playerSide: player.side };
  }

  removeSocket(socketId: string, mode: "disconnect" | "leave") {
    const removed = this.players.find((player) => player.socketId === socketId) ?? null;
    if (!removed) return;

    if (mode === "disconnect") {
      removed.socketId = null;
      removed.connected = false;
      removed.disconnectedAt = Date.now();
      if (this.battle && !this.battle.winner) {
        this.submissions.clear();
        this.lastMessage = `${removed.name} 連線中斷，房間保留中。`;
      } else {
        this.lastMessage = `${removed.name} 已離線，等待重連。`;
      }
      return;
    }

    this.players = this.players.filter((player) => player.id !== removed.id);
    this.submissions.delete(removed.id);
    this.rematchRequests.delete(removed.id);
    if (this.players.length < 2) {
      this.lastMessage = `${removed.name} 已離開房間。`;
      if (this.battle && !this.battle.winner) {
        this.battle = null;
        this.submissions.clear();
        this.rematchRequests.clear();
      }
    }
  }

  submit(socketId: string, actions: readonly RpgBattleAction[]) {
    const player = this.playerForSocket(socketId);
    if (!player || !player.connected || !this.battle || this.battle.winner) return;
    if (this.players.some((candidate) => !candidate.connected)) {
      this.submissions.clear();
      this.lastMessage = "對手離線，等待重連後再選招。";
      return;
    }
    const validation = this.validateSubmittedActions(player, actions);
    if (!validation.ok) {
      this.lastMessage = validation.message;
      return;
    }
    this.resolveTurn(validation.actions);
    this.lastMessage = this.battle?.winner ? "戰鬥結束。" : `${player.name} 已完成行動。`;
  }

  requestRematch(socketId: string) {
    const player = this.playerForSocket(socketId);
    if (!player || !player.connected || !this.battle || !this.battle.winner) return;
    this.rematchRequests.add(player.id);
    const waitingForOpponent = this.players.some((candidate) => candidate.id !== player.id && !this.rematchRequests.has(candidate.id));
    this.lastMessage = waitingForOpponent ? `${player.name} 已準備再戰。` : "雙方準備完成，重新開局。";
    this.tryStartRematch();
  }

  snapshotFor(socketId: string): RpgVersusSnapshot | null {
    const player = this.playerForSocket(socketId);
    if (!player) return null;
    const opponent = this.players.find((candidate) => candidate.id !== player.id) ?? null;
    const battle = this.battleFor(player);
    const opponentConnected = opponent?.connected ?? false;
    const status = !battle ? "waiting" : battle.winner ? "finished" : opponent && !opponentConnected ? "opponentDisconnected" : "selecting";
    return {
      roomCode: this.code,
      playerId: player.id,
      playerSide: player.side,
      playerName: player.name,
      opponentName: opponent?.name ?? null,
      opponentConnected,
      status,
      battle,
      submittedPlayerIds: [...this.submissions.keys()],
      rematchRequestedPlayerIds: [...this.rematchRequests],
      message: this.lastMessage
    };
  }

  hasSocket(socketId: string) {
    return this.players.some((player) => player.socketId === socketId);
  }

  socketIds() {
    return this.players.flatMap((player) => (player.socketId ? [player.socketId] : []));
  }

  isEmpty() {
    return this.players.length === 0;
  }

  playerCount() {
    return this.players.filter((player) => player.connected).length;
  }

  isAbandoned(now = Date.now()) {
    if (this.players.length === 0) return true;
    return this.players.every((player) => !player.connected && player.disconnectedAt !== null && now - player.disconnectedAt > DISCONNECT_GRACE_MS);
  }

  private startBattle() {
    const left = this.players.find((player) => player.side === "left");
    const right = this.players.find((player) => player.side === "right");
    if (!left || !right) return;
    this.matchNumber += 1;
    this.battle = createRpgBattleState(`rpg-room-${this.code}-m${this.matchNumber}`, left.roster, right.roster);
    this.submissions.clear();
    this.rematchRequests.clear();
    this.lastMessage = "雙方已到齊，開始選招。";
  }

  private resolveTurn(actions: readonly RpgBattleAction[]) {
    if (!this.battle) return;
    this.battle = resolveRpgBattleTurn(this.battle, actions);
    this.submissions.clear();
  }

  private playerForSocket(socketId: string) {
    return this.players.find((player) => player.socketId === socketId) ?? null;
  }

  private tryStartRematch() {
    if (!this.battle?.winner) return;
    if (this.players.length !== 2) return;
    const allConnected = this.players.every((player) => player.connected);
    const allReady = this.players.every((player) => this.rematchRequests.has(player.id));
    if (allConnected && allReady) this.startBattle();
  }

  private validateSubmittedActions(player: RpgRoomPlayer, actions: readonly RpgBattleAction[]) {
    if (!this.battle) return { ok: false as const, message: "戰鬥尚未開始。" };
    const activeSide = this.battle.activeSide ?? "left";
    if (activeSide !== player.side) {
      return { ok: false as const, message: `還沒輪到 ${player.name}。` };
    }
    if (actions.length <= 0) {
      return { ok: false as const, message: `${player.name} 需要至少選擇一個行動。` };
    }

    const actorById = new Map((player.side === "left" ? this.battle.left : this.battle.right).map((pet) => [pet.id, pet]));
    const usedActorIds = new Set<string>();
    const acceptedActions: RpgBattleAction[] = [];
    let spentEnergy = 0;
    const roundEnergy = getRpgBattleEnergyForTurn(this.battle.turn);
    for (const action of actions) {
      if (!action || typeof action.actorId !== "string" || typeof action.moveId !== "string" || (action.targetId !== undefined && typeof action.targetId !== "string")) {
        return { ok: false as const, message: `${player.name} 的選招資料格式不合法。` };
      }
      if (usedActorIds.has(action.actorId)) {
        return { ok: false as const, message: "每隻寵物每回合最多只能選一招。" };
      }
      usedActorIds.add(action.actorId);

      const actor = actorById.get(action.actorId);
      if (!actor || actor.defeated || actor.hp <= 0) {
        return { ok: false as const, message: "不能指定非本方或已倒下的寵物。" };
      }
      const move = getRpgMoveById(action.moveId);
      if (!move || !actor.moveIds.includes(move.id)) {
        return { ok: false as const, message: `${actor.name} 沒有這個招式。` };
      }
      spentEnergy += move.energyCost;
      if (spentEnergy > roundEnergy) {
        return { ok: false as const, message: `本回合最多 ${roundEnergy} EN。` };
      }
      if (!isLegalRpgActionTarget(this.battle, actor.id, move.id, action.targetId)) {
        return { ok: false as const, message: `${actor.name} 的 ${move.name} 目標不合法。` };
      }
      acceptedActions.push({ actorId: action.actorId, moveId: action.moveId, targetId: action.targetId });
    }

    return { ok: true as const, actions: acceptedActions };
  }

  private battleFor(player: RpgRoomPlayer): RpgBattleState | null {
    if (!this.battle) return null;
    return presentRpgBattleForSide(this.battle, player.side);
  }
}

export function presentRpgBattleForSide(battle: RpgBattleState, side: "left" | "right"): RpgBattleState {
  if (side === "left") return battle;
  return {
    ...battle,
    activeSide: battle.activeSide === "right" ? "left" : "right",
    left: battle.right.map((pet) => ({ ...pet, side: "left" as const })),
    right: battle.left.map((pet) => ({ ...pet, side: "right" as const })),
    winner: flipBattleSide(battle.winner),
    log: battle.log.map(localizeRightSeatLogEntry)
  };
}

function flipBattleSide(side: RpgBattleState["winner"]) {
  if (side === "left") return "right";
  if (side === "right") return "left";
  return side;
}

function localizeRightSeatLogEntry(entry: RpgBattleState["log"][number]) {
  if (entry.type !== "victory") return entry;
  if (entry.message === "左方獲勝。") return { ...entry, message: "右方獲勝。" };
  if (entry.message === "右方獲勝。") return { ...entry, message: "左方獲勝。" };
  return entry;
}

export class RpgBattleRoomManager {
  private rooms = new Map<string, RpgBattleRoom>();
  private socketToRoom = new Map<string, string>();

  createRoom(socketId: string, sessionId: string, playerName: string, roster: readonly RpgRosterSelection[] | undefined) {
    this.pruneStaleRooms();
    this.leave(socketId);
    const room = new RpgBattleRoom(this.nextRoomCode());
    this.rooms.set(room.code, room);
    const accepted = room.addPlayer(socketId, sessionId, playerName, roster);
    if (!accepted) {
      this.rooms.delete(room.code);
      throw new Error("Unable to create RPG battle room.");
    }
    this.socketToRoom.set(socketId, room.code);
    return accepted;
  }

  joinRoom(socketId: string, sessionId: string, roomCode: string, playerName: string, roster: readonly RpgRosterSelection[] | undefined) {
    this.pruneStaleRooms();
    this.leave(socketId);
    const normalized = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalized);
    if (!room) return null;
    const accepted = room.addPlayer(socketId, sessionId, playerName, roster);
    if (!accepted) return null;
    this.socketToRoom.set(socketId, room.code);
    return accepted;
  }

  submit(socketId: string, actions: readonly RpgBattleAction[]) {
    this.roomForSocket(socketId)?.submit(socketId, actions);
  }

  requestRematch(socketId: string) {
    this.roomForSocket(socketId)?.requestRematch(socketId);
  }

  snapshotFor(socketId: string) {
    return this.roomForSocket(socketId)?.snapshotFor(socketId) ?? null;
  }

  socketIdsFor(socketId: string) {
    return this.roomForSocket(socketId)?.socketIds() ?? [];
  }

  disconnect(socketId: string) {
    const room = this.roomForSocket(socketId);
    if (!room) return;
    room.removeSocket(socketId, "disconnect");
    this.socketToRoom.delete(socketId);
    if (room.isAbandoned()) this.rooms.delete(room.code);
  }

  leave(socketId: string) {
    const room = this.roomForSocket(socketId);
    if (!room) return;
    room.removeSocket(socketId, "leave");
    this.socketToRoom.delete(socketId);
    if (room.isEmpty()) this.rooms.delete(room.code);
  }

  roomCount() {
    return this.rooms.size;
  }

  playerCount() {
    return [...this.rooms.values()].reduce((count, room) => count + room.playerCount(), 0);
  }

  pruneStaleRooms(now = Date.now()) {
    for (const [code, room] of this.rooms.entries()) {
      if (room.isAbandoned(now)) this.rooms.delete(code);
    }
  }

  private roomForSocket(socketId: string) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  private nextRoomCode() {
    let code = "";
    do {
      code = Array.from({ length: 5 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
    } while (this.rooms.has(code));
    return code;
  }
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function createRosterForPlayer(ownerId: string, selection: readonly RpgRosterSelection[] | undefined): RpgRosterPet[] {
  if (!selection || selection.length !== 3) return [];
  const starterRoster = createStarterRoster(ownerId);
  const seen = new Set<string>();
  return selection.flatMap((selected) => {
    if (seen.has(selected.definitionId)) return [];
    seen.add(selected.definitionId);
    const starter = starterRoster.find((pet) => pet.definitionId === selected.definitionId);
    const definition = RPG_STARTER_PETS.find((pet) => pet.id === selected.definitionId);
    if (!starter || !definition) return [];
    const requestedMoveIds = selected.moveIds && selected.moveIds.length > 0 ? selected.moveIds : starter.moveIds;
    const cleanMoveIds = [...new Set(requestedMoveIds)]
      .filter((moveId) => getRpgMoveById(moveId)?.element === definition.element)
      .slice(0, 4);
    if (cleanMoveIds.length === 0) return [];
    return [
      {
        ...starter,
        nickname: selected.nickname,
        moveIds: cleanMoveIds
      }
    ];
  });
}

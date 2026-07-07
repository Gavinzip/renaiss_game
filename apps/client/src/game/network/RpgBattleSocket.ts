import type { RpgBattleAction, RpgVersusJoinAccepted, RpgVersusJoinRequest, RpgVersusRematchRequest, RpgVersusSnapshot, RpgVersusSubmitActions } from "@renaiss-game/shared";
import { io, type Socket } from "socket.io-client";
import { gameServerUrl } from "../../api/gameServer";

const RPG_VERSUS_SESSION_KEY = "renaiss:rpg-versus-session-id";
type RpgVersusJoinDraft = Omit<RpgVersusJoinRequest, "sessionId">;

export class RpgBattleSocket {
  private socket: Socket | null = null;
  private readonly sessionId = readOrCreateRpgVersusSessionId();
  private reconnectRequest: RpgVersusJoinRequest | null = null;
  private manualDisconnect = false;

  connect(
    onSnapshot: (snapshot: RpgVersusSnapshot) => void,
    onError: (message: string) => void,
    onStatus?: (status: "connecting" | "reconnecting" | "connected", message: string) => void
  ): Promise<void> {
    const serverUrl = gameServerUrl();
    this.manualDisconnect = false;
    this.socket = io(serverUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8
    });

    this.socket.on("rpg_state", onSnapshot);
    this.socket.on("rpg_error", (payload?: { message?: string }) => onError(payload?.message ?? "RPG room error."));
    this.socket.on("disconnect", () => {
      if (!this.manualDisconnect) onStatus?.("reconnecting", "連線中斷，保留真人房並嘗試重連。");
    });
    this.socket.on("connect", () => {
      if (this.reconnectRequest) {
        onStatus?.("reconnecting", "重新同步真人房。");
        this.socket?.emit("rpg_join_room", this.reconnectRequest);
      } else {
        onStatus?.("connected", "真人道館已連線。");
      }
    });
    this.socket.io.on("reconnect_attempt", () => {
      onStatus?.("reconnecting", "重新連線真人道館中。");
    });
    this.socket.io.on("reconnect", () => {
      onStatus?.("reconnecting", "重新連線成功，同步房間中。");
    });

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not initialized"));
        return;
      }
      const fail = () => reject(new Error("Unable to connect to RPG server"));
      this.socket.once("connect_error", fail);
      this.socket.once("connect", () => {
        this.socket?.off("connect_error", fail);
        resolve();
      });
    });
  }

  createRoom(request: RpgVersusJoinDraft): Promise<RpgVersusJoinAccepted> {
    return this.joinLike("rpg_create_room", request);
  }

  joinRoom(request: RpgVersusJoinDraft): Promise<RpgVersusJoinAccepted> {
    return this.joinLike("rpg_join_room", request);
  }

  submitActions(roomCode: string, actions: readonly RpgBattleAction[]) {
    const payload: RpgVersusSubmitActions = { roomCode, actions: [...actions] };
    this.socket?.emit("rpg_submit_actions", payload);
  }

  requestRematch(roomCode: string) {
    const payload: RpgVersusRematchRequest = { roomCode };
    this.socket?.emit("rpg_request_rematch", payload);
  }

  leave() {
    this.manualDisconnect = true;
    this.socket?.emit("rpg_leave");
  }

  disconnect() {
    this.manualDisconnect = true;
    this.socket?.disconnect();
    this.socket = null;
  }

  private joinLike(eventName: "rpg_create_room" | "rpg_join_room", request: RpgVersusJoinDraft): Promise<RpgVersusJoinAccepted> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("RPG socket is not connected."));
        return;
      }
      const requestWithSession: RpgVersusJoinRequest = { ...request, sessionId: this.sessionId };
      const fail = (payload?: { message?: string }) => {
        cleanup();
        reject(new Error(payload?.message ?? "Unable to join RPG room."));
      };
      const success = (accepted: RpgVersusJoinAccepted) => {
        cleanup();
        this.reconnectRequest = { ...requestWithSession, roomCode: accepted.roomCode };
        resolve(accepted);
      };
      const cleanup = () => {
        this.socket?.off("rpg_error", fail);
        this.socket?.off("rpg_joined", success);
      };
      this.socket.once("rpg_error", fail);
      this.socket.once("rpg_joined", success);
      this.socket.emit(eventName, requestWithSession);
    });
  }
}

function readOrCreateRpgVersusSessionId() {
  const stored = window.localStorage.getItem(RPG_VERSUS_SESSION_KEY);
  if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
  const next = crypto.randomUUID().replace(/-/g, "");
  window.localStorage.setItem(RPG_VERSUS_SESSION_KEY, next);
  return next;
}

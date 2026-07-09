import type { RpgBattleAction, RpgVersusJoinAccepted, RpgVersusJoinRequest, RpgVersusRematchRequest, RpgVersusSnapshot, RpgVersusSubmitActions } from "@renaiss-game/shared";
import { io, type Socket } from "socket.io-client";
import { gameServerUrl } from "../../api/gameServer";
import { rpgNotice } from "../../i18n/rpg";

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
    this.socket.on("rpg_error", (payload?: { message?: string }) => onError(payload?.message ?? rpgNotice().rpgRoomError));
    this.socket.on("disconnect", () => {
      if (!this.manualDisconnect) onStatus?.("reconnecting", rpgNotice().versusDisconnected);
    });
    this.socket.on("connect", () => {
      if (this.reconnectRequest) {
        onStatus?.("reconnecting", rpgNotice().versusResyncing);
        this.socket?.emit("rpg_join_room", this.reconnectRequest);
      } else {
        onStatus?.("connected", rpgNotice().versusConnected);
      }
    });
    this.socket.io.on("reconnect_attempt", () => {
      onStatus?.("reconnecting", rpgNotice().versusReconnecting);
    });
    this.socket.io.on("reconnect", () => {
      onStatus?.("reconnecting", rpgNotice().versusReconnectSyncing);
    });

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error(rpgNotice().socketNotInitialized));
        return;
      }
      const fail = () => reject(new Error(rpgNotice().unableConnectRpgServer));
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
        reject(new Error(rpgNotice().socketNotConnected));
        return;
      }
      const requestWithSession: RpgVersusJoinRequest = { ...request, sessionId: this.sessionId };
      const fail = (payload?: { message?: string }) => {
        cleanup();
        reject(new Error(payload?.message ?? rpgNotice().unableJoinRpgRoom));
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

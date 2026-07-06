import type { ClassId, GameSnapshot, JoinAccepted, JoinRequest, PlayerInput } from "@renaiss-game/shared";
import { io, type Socket } from "socket.io-client";

export class GameSocket {
  private socket: Socket | null = null;

  connect(request: JoinRequest, onSnapshot: (snapshot: GameSnapshot) => void): Promise<JoinAccepted> {
    const serverUrl = import.meta.env.VITE_GAME_SERVER_URL ?? "http://localhost:8787";
    this.socket = io(serverUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8
    });

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not initialized"));
        return;
      }

      const fail = () => reject(new Error("Unable to connect to game server"));
      const joinFail = (payload?: { message?: string }) => reject(new Error(payload?.message ?? "Unable to join game room"));
      this.socket.once("connect_error", fail);
      this.socket.once("connect", () => {
        this.socket?.off("connect_error", fail);
        this.socket?.emit("join", request);
      });
      this.socket.once("joined", (accepted: JoinAccepted) => resolve(accepted));
      this.socket.once("join_error", joinFail);
      this.socket.on("state", onSnapshot);
    });
  }

  sendInput(input: PlayerInput) {
    this.socket?.emit("input", input);
  }

  switchClass(classId: ClassId) {
    this.socket?.emit("switch_class", { classId });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

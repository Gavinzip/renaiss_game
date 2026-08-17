import {
  ARENA_PROTOCOL_V1_SCHEMA_SHA256,
  type AssetsReadyRequest,
  type ClassSwitchRequest,
  type GameSnapshot,
  type JoinAccepted,
  type JoinRequest,
  type MatchAssetManifest,
  type PlayerInput
} from "@renaiss-game/shared";
import { io, type Socket } from "socket.io-client";
import { fetchArenaSocketTicket } from "../../api/auth";
import { gameServerUrl } from "../../api/gameServer";
import { WEB_ARENA_BUILD_ID } from "./arenaWebReadiness";

export type ArenaConnectionStatus =
  | "connecting"
  | "preparing"
  | "connected"
  | "reconnecting"
  | "error";

interface GameSocketCallbacks {
  prepareAssets: (manifest: MatchAssetManifest) => Promise<AssetsReadyRequest>;
  onStatus: (status: ArenaConnectionStatus) => void;
  onJoined: (accepted: JoinAccepted) => void;
  onError?: (message: string) => void;
}

const INITIAL_JOIN_TIMEOUT_MS = 20_000;
const SNAPSHOT_STALE_MS = 1_500;
const SNAPSHOT_RECOVERY_MS = 2_500;

export class GameSocket {
  private socket: Socket | null = null;
  private request: JoinRequest | null = null;
  private callbacks: GameSocketCallbacks | null = null;
  private sessionToken: string | null = null;
  private joined = false;
  private manualDisconnect = false;
  private lastSnapshotAt = 0;
  private inputSequence = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private staleRecoveryStarted = false;

  async connect(
    request: JoinRequest,
    onSnapshot: (snapshot: GameSnapshot) => void,
    callbacks: GameSocketCallbacks
  ): Promise<JoinAccepted> {
    if (this.socket) {
      return Promise.reject(new Error("Arena socket is already initialized."));
    }
    this.request = request;
    this.callbacks = callbacks;
    this.manualDisconnect = false;
    callbacks.onStatus("connecting");

    const arenaSocketTicket = await fetchArenaSocketTicket();

    this.socket = io(gameServerUrl(), {
      auth: { arenaSocketTicket },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 300,
      reconnectionDelayMax: 2_000,
      timeout: 8_000,
      withCredentials: true
    });

    this.socket.on("state", (snapshot: GameSnapshot) => {
      this.lastSnapshotAt = performance.now();
      this.staleRecoveryStarted = false;
      if (this.joined) callbacks.onStatus("connected");
      onSnapshot(snapshot);
    });
    this.socket.on("connect", () => {
      this.joined = false;
      callbacks.onStatus(this.sessionToken ? "reconnecting" : "connecting");
      this.prepareMatch();
    });
    this.socket.on("disconnect", () => {
      this.joined = false;
      if (!this.manualDisconnect) callbacks.onStatus("reconnecting");
    });
    this.socket.on("match_assets", (manifest: MatchAssetManifest) => {
      void this.handleMatchAssets(manifest);
    });
    this.socket.io.on("reconnect_attempt", () => callbacks.onStatus("reconnecting"));

    this.startWatchdog();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanupInitialListeners();
        reject(new Error("Arena join timed out before server spawn."));
      }, INITIAL_JOIN_TIMEOUT_MS);
      const onJoined = (accepted: JoinAccepted) => {
        this.sessionToken = accepted.sessionToken;
        this.joined = true;
        this.lastSnapshotAt = performance.now();
        callbacks.onJoined(accepted);
        callbacks.onStatus("connected");
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(accepted);
        }
      };
      const onArenaError = (payload?: { message?: string }) => {
        const message = payload?.message ?? "Arena server rejected the request.";
        callbacks.onError?.(message);
        callbacks.onStatus("error");
        if (!resolved) {
          clearTimeout(timeout);
          cleanupInitialListeners();
          reject(new Error(message));
        }
      };
      const onReconnectFailed = () => {
        const message = "Unable to reconnect to the Arena server.";
        callbacks.onError?.(message);
        callbacks.onStatus("error");
        if (!resolved) {
          clearTimeout(timeout);
          cleanupInitialListeners();
          reject(new Error(message));
        }
      };
      const cleanupInitialListeners = () => {
        this.socket?.off("assets_ready_error", onArenaError);
        this.socket?.off("join_error", onArenaError);
        this.socket?.io.off("reconnect_failed", onReconnectFailed);
      };
      let resolved = false;
      this.socket?.on("joined", onJoined);
      this.socket?.on("assets_ready_error", onArenaError);
      this.socket?.on("join_error", onArenaError);
      this.socket?.io.on("reconnect_failed", onReconnectFailed);
    });
  }

  sendInput(input: PlayerInput) {
    if (!this.canSendGameplay()) return;
    this.inputSequence += 1;
    this.socket?.emit("input", { ...input, sequence: this.inputSequence });
  }

  switchClass(request: ClassSwitchRequest) {
    if (!this.canSendGameplay()) return;
    this.socket?.emit("switch_class", request);
  }

  disconnect() {
    this.manualDisconnect = true;
    this.joined = false;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.socket?.disconnect();
    this.socket = null;
  }

  private prepareMatch() {
    if (!this.socket?.connected || !this.request) return;
    this.socket.emit("prepare_match", {
      join: this.request,
      clientBuildId: WEB_ARENA_BUILD_ID,
      protocolSchemaHash: ARENA_PROTOCOL_V1_SCHEMA_SHA256,
      ...(this.sessionToken ? { sessionToken: this.sessionToken } : {})
    });
  }

  private async handleMatchAssets(manifest: MatchAssetManifest) {
    if (!this.socket?.connected || !this.callbacks) return;
    const wasJoined = this.joined;
    this.callbacks.onStatus(wasJoined ? "preparing" : this.sessionToken ? "reconnecting" : "preparing");
    try {
      const readiness = await this.callbacks.prepareAssets(manifest);
      if (!this.socket?.connected) return;
      this.socket.emit("assets_ready", readiness);
      if (wasJoined) this.callbacks.onStatus("connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Arena asset readiness failed.";
      this.callbacks.onError?.(message);
      this.callbacks.onStatus("error");
      this.socket.disconnect();
    }
  }

  private canSendGameplay() {
    return Boolean(
      this.socket?.connected &&
      this.joined &&
      this.lastSnapshotAt > 0 &&
      performance.now() - this.lastSnapshotAt <= SNAPSHOT_STALE_MS
    );
  }

  private startWatchdog() {
    this.watchdog = setInterval(() => {
      if (!this.socket?.connected || !this.joined || this.lastSnapshotAt <= 0) return;
      const snapshotAge = performance.now() - this.lastSnapshotAt;
      if (snapshotAge > SNAPSHOT_STALE_MS) this.callbacks?.onStatus("reconnecting");
      if (snapshotAge > SNAPSHOT_RECOVERY_MS && !this.staleRecoveryStarted) {
        this.staleRecoveryStarted = true;
        this.socket.io.engine?.close();
      }
    }, 250);
  }
}

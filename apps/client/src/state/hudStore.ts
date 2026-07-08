import { create } from "zustand";
import type { ClassId, GameSnapshot, JoinRequest } from "@renaiss-game/shared";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
export type HudAction = "attack" | "skillQ" | "skillE" | "skillR";
export type HudSkillAction = Exclude<HudAction, "attack">;
const emptySkillReleaseQueue = (): Record<HudSkillAction, number> => ({
  skillQ: 0,
  skillE: 0,
  skillR: 0
});

interface HudStore {
  joined: boolean;
  connection: ConnectionState;
  selectedClass: ClassId;
  selfId: string | null;
  joinRequest: JoinRequest | null;
  classSwitchRequest: { classId: ClassId; requestedAt: number } | null;
  snapshot: GameSnapshot | null;
  hudInput: {
    attack: boolean;
    skillQ: boolean;
    skillE: boolean;
    skillR: boolean;
  };
  hudSkillReleaseQueue: Record<HudSkillAction, number>;
  setSelectedClass: (classId: ClassId) => void;
  requestJoin: (request: JoinRequest) => void;
  requestClassSwitch: (classId: ClassId) => void;
  setConnection: (connection: ConnectionState) => void;
  setJoined: (playerId: string) => void;
  setSnapshot: (snapshot: GameSnapshot) => void;
  setHudAction: (action: HudAction, active: boolean) => void;
  queueHudSkillRelease: (action: HudSkillAction) => void;
  consumeHudSkillReleases: () => Record<HudSkillAction, number>;
  leaveArena: () => void;
}

export const useHudStore = create<HudStore>((set, get) => ({
  joined: false,
  connection: "idle",
  selectedClass: "warrior",
  selfId: null,
  joinRequest: null,
  classSwitchRequest: null,
  snapshot: null,
  hudInput: {
    attack: false,
    skillQ: false,
    skillE: false,
    skillR: false
  },
  hudSkillReleaseQueue: emptySkillReleaseQueue(),
  setSelectedClass: (classId) => set({ selectedClass: classId }),
  requestJoin: (request) => set({ joinRequest: request, selectedClass: request.classId, connection: "connecting" }),
  requestClassSwitch: (classId) => set({ classSwitchRequest: { classId, requestedAt: Date.now() }, selectedClass: classId }),
  setConnection: (connection) => set({ connection }),
  setJoined: (playerId) => set({ joined: true, selfId: playerId, connection: "connected" }),
  setSnapshot: (snapshot) => set({ snapshot, selfId: snapshot.selfId }),
  setHudAction: (action, active) => set((state) => ({ hudInput: { ...state.hudInput, [action]: active } })),
  queueHudSkillRelease: (action) =>
    set((state) => ({
      hudSkillReleaseQueue: {
        ...state.hudSkillReleaseQueue,
        [action]: state.hudSkillReleaseQueue[action] + 1
      }
    })),
  consumeHudSkillReleases: () => {
    const queue = get().hudSkillReleaseQueue;
    set({ hudSkillReleaseQueue: emptySkillReleaseQueue() });
    return queue;
  },
  leaveArena: () => set({
    joined: false,
    connection: "idle",
    selfId: null,
    joinRequest: null,
    classSwitchRequest: null,
    snapshot: null,
    hudInput: {
      attack: false,
      skillQ: false,
      skillE: false,
      skillR: false
    },
    hudSkillReleaseQueue: emptySkillReleaseQueue()
  })
}));

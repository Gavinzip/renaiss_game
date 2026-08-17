import { create } from "zustand";
import {
  isArenaCatalogSkillAllowedInSlot,
  isArenaCatalogLoadoutComplete,
  isArenaSkillAllowedInSlot,
  type ArenaCatalogLoadouts,
  type ArenaCatalogSkillId,
  type ArenaGameMode,
  type ArenaLoadout,
  type ArenaLoadoutSlot,
  type ClassId,
  type ClassSwitchRequest,
  type EngineerTurretKind,
  type GameSnapshot,
  type JoinRequest,
  type SkillKey
} from "@renaiss-game/shared";
import {
  loadArenaCatalogLoadouts,
  saveArenaCatalogLoadouts
} from "./arenaCatalogLoadoutStorage";
import { persistArenaCatalogLoadout } from "../api/arenaSkillCollection";
import { loadArenaLoadouts, saveArenaLoadouts, type ArenaLoadouts } from "./arenaLoadoutStorage";
import type { ArenaConnectionStatus } from "../game/network/GameSocket";

export type ConnectionState = "idle" | ArenaConnectionStatus;
export type ArenaAssetPreparationStatus = "idle" | "loading" | "ready" | "error";
export type HudAction = "attack" | "skillF" | "skillQ" | "skillE" | "skillR";
export type HudSkillAction = Exclude<HudAction, "attack">;
export interface MobileMoveInput {
  x: number;
  y: number;
}
export interface MobileAimInput {
  active: boolean;
  viewportX: number;
  viewportY: number;
  action: HudSkillAction | null;
}

const emptySkillArmQueue = (): Record<HudSkillAction, number> => ({
  skillF: 0,
  skillQ: 0,
  skillE: 0,
  skillR: 0
});

const emptyMobileAim = (): MobileAimInput => ({
  active: false,
  viewportX: 0,
  viewportY: 0,
  action: null
});

interface HudStore {
  joined: boolean;
  connection: ConnectionState;
  arenaAssets: {
    status: ArenaAssetPreparationStatus;
    loaded: number;
    total: number;
  };
  selectedClass: ClassId;
  selectedMode: ArenaGameMode;
  engineerTurretKind: EngineerTurretKind;
  arenaLoadouts: ArenaLoadouts;
  arenaCatalogLoadouts: ArenaCatalogLoadouts;
  catalogLoadoutSyncPending: number;
  catalogLoadoutSyncError: string | null;
  selfId: string | null;
  joinRequest: JoinRequest | null;
  classSwitchRequest: ClassSwitchRequest & { requestedAt: number } | null;
  snapshot: GameSnapshot | null;
  hudInput: {
    attack: boolean;
    skillF: boolean;
    skillQ: boolean;
    skillE: boolean;
    skillR: boolean;
  };
  mobileMove: MobileMoveInput;
  mobileAim: MobileAimInput;
  mobileControlsActive: boolean;
  armedSkillAction: HudSkillAction | null;
  hudSkillArmQueue: Record<HudSkillAction, number>;
  setSelectedClass: (classId: ClassId) => void;
  setSelectedMode: (mode: ArenaGameMode) => void;
  setEngineerTurretKind: (kind: EngineerTurretKind) => void;
  setLoadoutSkill: (classId: ClassId, slot: ArenaLoadoutSlot, skill: SkillKey) => void;
  setCatalogLoadoutSkill: (
    classId: ClassId,
    slot: ArenaLoadoutSlot,
    skill: ArenaCatalogSkillId
  ) => void;
  hydrateCatalogLoadouts: (
    serverLoadouts: ArenaCatalogLoadouts,
    unlockedSkillIds: readonly ArenaCatalogSkillId[]
  ) => void;
  requestJoin: (request: JoinRequest) => void;
  requestClassSwitch: (classId: ClassId) => void;
  setConnection: (connection: ConnectionState) => void;
  beginArenaAssetPreparation: (total: number) => void;
  setArenaAssetProgress: (loaded: number, total: number) => void;
  finishArenaAssetPreparation: () => void;
  failArenaAssetPreparation: () => void;
  resetArenaAssetPreparation: () => void;
  setJoined: (playerId: string) => void;
  setSnapshot: (snapshot: GameSnapshot) => void;
  setHudAction: (action: HudAction, active: boolean) => void;
  setMobileMove: (move: MobileMoveInput) => void;
  resetMobileMove: () => void;
  setMobileAim: (action: HudSkillAction, viewportX: number, viewportY: number) => void;
  resetMobileAim: () => void;
  setMobileControlsActive: (active: boolean) => void;
  setArmedSkillAction: (action: HudSkillAction | null) => void;
  queueHudSkillArm: (action: HudSkillAction) => void;
  consumeHudSkillArms: () => Record<HudSkillAction, number>;
  leaveArena: () => void;
}

export const useHudStore = create<HudStore>((set, get) => ({
  joined: false,
  connection: "idle",
  arenaAssets: { status: "idle", loaded: 0, total: 0 },
  selectedClass: "warrior",
  selectedMode: loadArenaMode(),
  engineerTurretKind: loadEngineerTurretKind(),
  arenaLoadouts: loadArenaLoadouts(),
  arenaCatalogLoadouts: loadArenaCatalogLoadouts(),
  catalogLoadoutSyncPending: 0,
  catalogLoadoutSyncError: null,
  selfId: null,
  joinRequest: null,
  classSwitchRequest: null,
  snapshot: null,
  hudInput: {
    attack: false,
    skillF: false,
    skillQ: false,
    skillE: false,
    skillR: false
  },
  mobileMove: { x: 0, y: 0 },
  mobileAim: emptyMobileAim(),
  mobileControlsActive: false,
  armedSkillAction: null,
  hudSkillArmQueue: emptySkillArmQueue(),
  setSelectedClass: (classId) => set({ selectedClass: classId }),
  setSelectedMode: (selectedMode) => {
    window.localStorage.setItem("renaiss.arena.mode", selectedMode);
    set({ selectedMode });
  },
  setEngineerTurretKind: (engineerTurretKind) => {
    window.localStorage.setItem("renaiss.engineer.turret-kind", engineerTurretKind);
    set({ engineerTurretKind });
  },
  setLoadoutSkill: (classId, slot, skill) =>
    set((state) => {
      if (!isArenaSkillAllowedInSlot(slot, skill)) {
        return state;
      }
      const current = state.arenaLoadouts[classId];
      const nextLoadout: ArenaLoadout = { ...current, [slot]: skill };
      const arenaLoadouts = {
        ...state.arenaLoadouts,
        [classId]: nextLoadout
      };
      saveArenaLoadouts(arenaLoadouts);
      return { arenaLoadouts };
    }),
  setCatalogLoadoutSkill: (classId, slot, skill) => {
    if (!isArenaCatalogSkillAllowedInSlot(classId, slot, skill)) return;
    const state = get();
    const nextLoadout = {
      ...state.arenaCatalogLoadouts[classId],
      [slot]: skill
    };
    const arenaCatalogLoadouts = {
      ...state.arenaCatalogLoadouts,
      [classId]: nextLoadout
    };
    saveArenaCatalogLoadouts(arenaCatalogLoadouts);
    set((current) => ({
      arenaCatalogLoadouts,
      catalogLoadoutSyncPending: current.catalogLoadoutSyncPending + 1,
      catalogLoadoutSyncError: null
    }));
    void persistArenaCatalogLoadout(classId, nextLoadout).then(
      () => set((current) => ({
        catalogLoadoutSyncPending: Math.max(0, current.catalogLoadoutSyncPending - 1)
      })),
      (error) => set((current) => ({
        catalogLoadoutSyncPending: Math.max(0, current.catalogLoadoutSyncPending - 1),
        catalogLoadoutSyncError:
          error instanceof Error ? error.message : "Unable to save Arena skill loadout."
      }))
    );
  },
  hydrateCatalogLoadouts: (serverLoadouts, unlockedSkillIds) => {
    const state = get();
    const unlocked = new Set(unlockedSkillIds);
    const slots = ["skillQ", "skillE", "skillR"] as const;
    const arenaCatalogLoadouts = { ...serverLoadouts };
    const migrations: ClassId[] = [];
    for (const classId of ["warrior", "archer", "engineer", "mage"] as const) {
      const serverLoadout = serverLoadouts[classId];
      const localLoadout = state.arenaCatalogLoadouts[classId];
      const merged = { ...serverLoadout };
      for (const slot of slots) {
        const localSkill = localLoadout[slot];
        if (
          merged[slot] === null &&
          localSkill !== null &&
          unlocked.has(localSkill) &&
          isArenaCatalogSkillAllowedInSlot(classId, slot, localSkill)
        ) {
          merged[slot] = localSkill;
        }
      }
      arenaCatalogLoadouts[classId] = merged;
      if (slots.some((slot) => merged[slot] !== serverLoadout[slot])) {
        migrations.push(classId);
      }
    }
    saveArenaCatalogLoadouts(arenaCatalogLoadouts);
    set((current) => ({
      arenaCatalogLoadouts,
      catalogLoadoutSyncPending:
        current.catalogLoadoutSyncPending + migrations.length,
      catalogLoadoutSyncError: null
    }));
    for (const classId of migrations) {
      void persistArenaCatalogLoadout(classId, arenaCatalogLoadouts[classId]).then(
        () => set((current) => ({
          catalogLoadoutSyncPending: Math.max(0, current.catalogLoadoutSyncPending - 1)
        })),
        (error) => set((current) => ({
          catalogLoadoutSyncPending: Math.max(0, current.catalogLoadoutSyncPending - 1),
          catalogLoadoutSyncError:
            error instanceof Error ? error.message : "Unable to migrate Arena skill loadout."
        }))
      );
    }
  },
  requestJoin: (request) => set({ joinRequest: request, selectedClass: request.classId, connection: "connecting" }),
  requestClassSwitch: (classId) =>
    set((state) => isArenaCatalogLoadoutComplete(state.arenaCatalogLoadouts[classId]) ? ({
      classSwitchRequest: {
        classId,
        loadout: { ...state.arenaLoadouts[classId] },
        catalogLoadout: { ...state.arenaCatalogLoadouts[classId] },
        engineerTurretKind: state.engineerTurretKind,
        requestedAt: Date.now()
      },
      selectedClass: classId
    }) : state),
  setConnection: (connection) => set({ connection }),
  beginArenaAssetPreparation: (total) => set({
    arenaAssets: {
      status: "loading",
      loaded: 0,
      total: Math.max(0, Math.floor(total))
    }
  }),
  setArenaAssetProgress: (loaded, total) => set({
    arenaAssets: {
      status: "loading",
      loaded: Math.max(0, Math.floor(loaded)),
      total: Math.max(0, Math.floor(total))
    }
  }),
  finishArenaAssetPreparation: () => set((state) => ({
    arenaAssets: {
      status: "ready",
      loaded: state.arenaAssets.total,
      total: state.arenaAssets.total
    }
  })),
  failArenaAssetPreparation: () => set((state) => ({
    arenaAssets: { ...state.arenaAssets, status: "error" }
  })),
  resetArenaAssetPreparation: () => set({
    arenaAssets: { status: "idle", loaded: 0, total: 0 }
  }),
  setJoined: (playerId) => set({ joined: true, selfId: playerId, connection: "connected" }),
  setSnapshot: (snapshot) => set({ snapshot, selfId: snapshot.selfId }),
  setHudAction: (action, active) => set((state) => ({ hudInput: { ...state.hudInput, [action]: active } })),
  setMobileMove: (move) => set({ mobileMove: move, mobileControlsActive: true }),
  resetMobileMove: () => set({ mobileMove: { x: 0, y: 0 } }),
  setMobileAim: (action, viewportX, viewportY) =>
    set({
      mobileAim: { active: true, viewportX, viewportY, action },
      mobileControlsActive: true
    }),
  resetMobileAim: () => set({ mobileAim: emptyMobileAim() }),
  setMobileControlsActive: (active) => set({ mobileControlsActive: active }),
  setArmedSkillAction: (armedSkillAction) => set({ armedSkillAction }),
  queueHudSkillArm: (action) =>
    set((state) => ({
      hudSkillArmQueue: {
        ...state.hudSkillArmQueue,
        [action]: state.hudSkillArmQueue[action] + 1
      }
    })),
  consumeHudSkillArms: () => {
    const queue = get().hudSkillArmQueue;
    set({ hudSkillArmQueue: emptySkillArmQueue() });
    return queue;
  },
  leaveArena: () => set({
    joined: false,
    connection: "idle",
    arenaAssets: { status: "idle", loaded: 0, total: 0 },
    selfId: null,
    joinRequest: null,
    classSwitchRequest: null,
    snapshot: null,
    hudInput: {
      attack: false,
      skillF: false,
      skillQ: false,
      skillE: false,
      skillR: false
    },
    mobileMove: { x: 0, y: 0 },
    mobileAim: emptyMobileAim(),
    mobileControlsActive: false,
    armedSkillAction: null,
    hudSkillArmQueue: emptySkillArmQueue()
  })
}));

function loadArenaMode(): ArenaGameMode {
  return window.localStorage.getItem("renaiss.arena.mode") === "team_3v3"
    ? "team_3v3"
    : "free_for_all";
}

function loadEngineerTurretKind(): EngineerTurretKind {
  return window.localStorage.getItem("renaiss.engineer.turret-kind") === "magic_missile"
    ? "magic_missile"
    : "mechanical";
}

import { create } from "zustand";
import type { ArenaCatalogSkill, ArenaCatalogSkillId, ClassId } from "@renaiss-game/shared";
import {
  drawArenaClassSkill,
  fetchArenaSkillCollection,
  unlockAllArenaSkills,
  type ArenaSkillCollectionResult,
  type ArenaSkillDrawResult
} from "../api/arenaSkillCollection";

type CollectionStatus = "idle" | "loading" | "ready" | "error";

interface ArenaSkillCollectionStore {
  ownerKey: string | null;
  status: CollectionStatus;
  unlockedSkillIds: ArenaCatalogSkillId[];
  drawLimit: number | null;
  drawsRemaining: number | null;
  lastDraw: ArenaCatalogSkill | null;
  error: string | null;
  loadForOwner: (ownerKey: string) => Promise<void>;
  drawForClass: (classId: ClassId) => Promise<ArenaSkillDrawResult>;
  unlockAllSkills: () => Promise<ArenaSkillCollectionResult>;
  commitDrawResult: (result: ArenaSkillDrawResult) => void;
}

export const useArenaSkillCollectionStore = create<ArenaSkillCollectionStore>((set, get) => ({
  ownerKey: null,
  status: "idle",
  unlockedSkillIds: [],
  drawLimit: null,
  drawsRemaining: null,
  lastDraw: null,
  error: null,
  loadForOwner: async (ownerKey) => {
    const current = get();
    if (current.ownerKey === ownerKey && (current.status === "loading" || current.status === "ready")) return;
    set({
      ownerKey,
      status: "loading",
      unlockedSkillIds: [],
      drawLimit: null,
      drawsRemaining: null,
      lastDraw: null,
      error: null
    });
    try {
      const result = await fetchArenaSkillCollection();
      if (get().ownerKey !== ownerKey) return;
      set({
        status: "ready",
        unlockedSkillIds: result.unlockedSkillIds,
        drawLimit: result.drawLimit,
        drawsRemaining: result.drawsRemaining,
        error: null
      });
    } catch (error) {
      if (get().ownerKey !== ownerKey) return;
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load Arena skill collection."
      });
    }
  },
  drawForClass: async (classId) => {
    if (get().status !== "ready") throw new Error("Arena skill collection is not ready.");
    return drawArenaClassSkill(classId);
  },
  unlockAllSkills: async () => {
    if (get().status !== "ready") throw new Error("Arena skill collection is not ready.");
    const result = await unlockAllArenaSkills();
    set({
      unlockedSkillIds: result.unlockedSkillIds,
      drawLimit: result.drawLimit,
      drawsRemaining: result.drawsRemaining,
      lastDraw: null,
      error: null
    });
    return result;
  },
  commitDrawResult: (result) => {
    set({
      unlockedSkillIds: result.unlockedSkillIds,
      drawLimit: result.drawLimit,
      drawsRemaining: result.drawsRemaining,
      lastDraw: result.skill,
      error: null
    });
  }
}));

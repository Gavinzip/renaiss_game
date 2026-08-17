import { create } from "zustand";
import type { MobileMoveVector } from "../components/MobileJoystick";

interface RpgInputStore {
  move: MobileMoveVector;
  setMove: (move: MobileMoveVector) => void;
  resetMove: () => void;
}

const ZERO_MOVE: MobileMoveVector = { x: 0, y: 0 };

export const useRpgInputStore = create<RpgInputStore>((set) => ({
  move: ZERO_MOVE,
  setMove: (move) => set({ move }),
  resetMove: () => set({ move: ZERO_MOVE })
}));

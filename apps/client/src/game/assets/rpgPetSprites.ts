import type { RpgElement } from "@renaiss-game/shared";

export const RPG_PET_SPRITE_FRAME = 128;
export const RPG_PET_SPRITE_COLUMNS = 18;
export const RPG_PET_SPRITE_ROWS = 5;

export const RPG_PET_SPRITE_ROW: Record<RpgElement, number> = {
  water: 0,
  fire: 1,
  grass: 2,
  dark: 3,
  light: 4
};

export const RPG_PET_ANIMATION_FRAMES = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7],
  attack: [8, 9, 10, 11, 12],
  hit: [13, 14, 15],
  faint: [16, 17],
  follow: [4, 5, 6, 7]
} as const;

export type RpgPetSpritePose = keyof typeof RPG_PET_ANIMATION_FRAMES;

export function rpgPetFrameIndex(element: RpgElement, column: number) {
  return RPG_PET_SPRITE_ROW[element] * RPG_PET_SPRITE_COLUMNS + column;
}

export function rpgPetAnimationFrameIndexes(element: RpgElement, pose: RpgPetSpritePose) {
  return RPG_PET_ANIMATION_FRAMES[pose].map((column) => rpgPetFrameIndex(element, column));
}

export function rpgPetBackgroundPosition(element: RpgElement, column: number) {
  const x = RPG_PET_SPRITE_COLUMNS <= 1 ? 0 : (column / (RPG_PET_SPRITE_COLUMNS - 1)) * 100;
  const y = RPG_PET_SPRITE_ROWS <= 1 ? 0 : (RPG_PET_SPRITE_ROW[element] / (RPG_PET_SPRITE_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

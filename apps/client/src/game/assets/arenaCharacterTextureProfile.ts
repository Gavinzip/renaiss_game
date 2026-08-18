export const ARENA_CHARACTER_RUNTIME_TEXTURE_SCALE = 0.75;
export const ARENA_CHARACTER_RUNTIME_CONTENT_SCALE = 0.72;
export const ARENA_CHARACTER_RUNTIME_EDGE_MARGIN = 2;

const SOURCE_WALK_CELL = {
  width: 165,
  height: 194,
  footY: 174,
  topInset: 18
} as const;

export function scaleArenaCharacterTextureDimension(value: number) {
  return Math.max(1, Math.round(value * ARENA_CHARACTER_RUNTIME_TEXTURE_SCALE));
}

export const ARENA_CHARACTER_RUNTIME_WALK_CELL = {
  width: scaleArenaCharacterTextureDimension(SOURCE_WALK_CELL.width),
  height: scaleArenaCharacterTextureDimension(SOURCE_WALK_CELL.height),
  footY: scaleArenaCharacterTextureDimension(SOURCE_WALK_CELL.footY),
  topInset: scaleArenaCharacterTextureDimension(SOURCE_WALK_CELL.topInset)
} as const;

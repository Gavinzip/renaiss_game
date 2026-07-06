import { RPG_ELEMENTS, type RpgElement, type RpgMove, type RpgSkillTier } from "./rpgTypes";

export const RPG_SKILL_VFX_COLUMNS = 16;
export const RPG_SKILL_VFX_ROWS_PER_ELEMENT = 25;
export const RPG_SKILL_VFX_FRAME_WIDTH = 160;
export const RPG_SKILL_VFX_FRAME_HEIGHT = 112;

export const RPG_SKILL_VFX_ELEMENT_SHEET: Record<RpgElement, string> = {
  water: "rpg-skill-vfx-water",
  fire: "rpg-skill-vfx-fire",
  grass: "rpg-skill-vfx-grass",
  dark: "rpg-skill-vfx-dark",
  light: "rpg-skill-vfx-light"
};

const RPG_SKILL_VFX_TIER_ROW_OFFSET: Record<RpgSkillTier, number> = {
  basic: 0,
  intermediate: 10,
  ultimate: 20
};

const RPG_SKILL_VFX_TIER_COUNT: Record<RpgSkillTier, number> = {
  basic: 10,
  intermediate: 10,
  ultimate: 5
};

export interface RpgSkillVfxSpec {
  sheet: string;
  row: number;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  durationMs: number;
}

export function rpgSkillVfxRow(move: RpgMove) {
  const tierCount = RPG_SKILL_VFX_TIER_COUNT[move.tier];
  if (move.slot < 1 || move.slot > tierCount) {
    throw new Error(`Invalid RPG move slot for ${move.id}: ${move.slot}`);
  }
  return RPG_SKILL_VFX_TIER_ROW_OFFSET[move.tier] + move.slot - 1;
}

export function getRpgSkillVfxSpec(move: RpgMove): RpgSkillVfxSpec {
  return {
    sheet: RPG_SKILL_VFX_ELEMENT_SHEET[move.element],
    row: rpgSkillVfxRow(move),
    columns: RPG_SKILL_VFX_COLUMNS,
    rows: RPG_SKILL_VFX_ROWS_PER_ELEMENT,
    frameWidth: RPG_SKILL_VFX_FRAME_WIDTH,
    frameHeight: RPG_SKILL_VFX_FRAME_HEIGHT,
    frameCount: RPG_SKILL_VFX_COLUMNS,
    durationMs: Math.max(640, Math.min(1240, move.animation.frameCount * 78))
  };
}

export function rpgSkillVfxBackgroundPosition(move: RpgMove, column: number) {
  const spec = getRpgSkillVfxSpec(move);
  const clampedColumn = Math.max(0, Math.min(spec.columns - 1, column));
  const x = spec.columns <= 1 ? 0 : (clampedColumn / (spec.columns - 1)) * 100;
  const y = spec.rows <= 1 ? 0 : (spec.row / (spec.rows - 1)) * 100;
  return `${x}% ${y}%`;
}

export function rpgSkillVfxExpectedFiles() {
  return RPG_ELEMENTS.map((element) => RPG_SKILL_VFX_ELEMENT_SHEET[element]);
}

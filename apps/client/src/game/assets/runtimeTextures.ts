import Phaser from "phaser";
import { CLASS_ORDER } from "@renaiss-game/shared";
import {
  ABILITY_VFX_FRAME_COUNT,
  ABILITY_VFX_KEYS,
  ARCHER_ATTACK_DIRECTIONS,
  ARCHER_ATTACK_FRAME_COUNT,
  ARENA_DECAL_KEYS,
  ARENA_DECAL_TEXTURES,
  COMBAT_VFX_FRAME_COUNT,
  COMBAT_VFX_KEYS,
  ENGINEER_VFX_FRAME_COUNT,
  ENGINEER_VFX_KEYS,
  ENV_CROPS,
  ENV_TEXTURES,
  COMBAT_OBJECT_KEYS,
  ENGINEER_ACTION_DIRECTIONS,
  ENGINEER_ACTION_FRAME_COUNT,
  getAbilityVfxFrameTexture,
  getAbilityVfxRow,
  getArcherAttackDirectionRow,
  getArcherAttackFrameTexture,
  getArenaDecalGridPosition,
  getArenaDecalTexturePadding,
  getArenaDecalTextureTrimPadding,
  getClassFrameCrop,
  getClassFrameTexture,
  getCombatVfxFrameTexture,
  getCombatVfxRow,
  getCombatObjectGridPosition,
  getCombatObjectTexture,
  getEngineerActionDirectionRow,
  getEngineerActionFrameTexture,
  getEngineerVfxFrameTexture,
  getEngineerVfxRow,
  getMageAttackDirectionRow,
  getMageAttackFrameTexture,
  getMageVfxFrameTexture,
  getMageVfxRow,
  getRpgSkillProjectileFrameTexture,
  getRpgSkillProjectileRow,
  getStatusAuraFrameTexture,
  getStatusAuraRow,
  getVfxFrameTexture,
  getVfxRow,
  getWarriorAttackDirectionRow,
  getWarriorAttackFrameTexture,
  getWarriorArcherVfxFrameTexture,
  getWarriorArcherVfxRow,
  getWarriorVerticalSlashFrameTexture,
  getWarriorVerticalSlashRow,
  getWarriorVerdictVfxFrameTexture,
  MAGE_ATTACK_DIRECTIONS,
  MAGE_ATTACK_FRAME_COUNT,
  MAGE_VFX_FRAME_COUNT,
  MAGE_VFX_KEYS,
  RPG_SKILL_PROJECTILE_FRAME_COUNT,
  RPG_SKILL_PROJECTILE_ROW_COUNT,
  shouldTrimArenaDecalTexture,
  STATUS_AURA_FRAME_COUNT,
  STATUS_AURA_KEYS,
  STATUS_AURA_SOURCE_ROWS,
  VFX_FRAME_COUNT,
  WARRIOR_ATTACK_DIRECTIONS,
  WARRIOR_ATTACK_FRAME_COUNT,
  WARRIOR_ARCHER_VFX_FRAME_COUNT,
  WARRIOR_ARCHER_VFX_KEYS,
  WARRIOR_VERTICAL_SLASH_FRAME_COUNT,
  WARRIOR_VERTICAL_SLASH_ROWS,
  WARRIOR_VERDICT_VFX_FRAME_COUNT,
  type Crop,
  type TexturePadding,
  type VfxKey
} from "./crops";

const VFX_KEYS: VfxKey[] = ["shield"];
const RPG_SKILL_PROJECTILE_ELEMENTS = ["water", "fire", "grass", "dark", "light"] as const;

export function buildRuntimeTextures(scene: Phaser.Scene) {
  for (const [name, crop] of Object.entries(ENV_CROPS)) {
    sliceTexture(scene, "villageAssetsClean", ENV_TEXTURES[name as keyof typeof ENV_TEXTURES], crop);
  }

  for (const key of ARENA_DECAL_KEYS) {
    const { column, row } = getArenaDecalGridPosition(key);
    sliceGridTexture(
      scene,
      "arenaDecals",
      ARENA_DECAL_TEXTURES[key],
      5,
      4,
      column,
      row,
      getArenaDecalTexturePadding(key),
      shouldTrimArenaDecalTexture(key),
      getArenaDecalTextureTrimPadding(key)
    );
  }

  for (const classId of CLASS_ORDER) {
    for (let frame = 0; frame < 8; frame += 1) {
      sliceTexture(scene, "classSpritesClean", getClassFrameTexture(classId, frame), getClassFrameCrop(classId, frame));
    }
  }

  for (const direction of WARRIOR_ATTACK_DIRECTIONS) {
    for (let frame = 0; frame < WARRIOR_ATTACK_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "warriorAttackSprites",
        getWarriorAttackFrameTexture(direction, frame),
        WARRIOR_ATTACK_FRAME_COUNT,
        WARRIOR_ATTACK_DIRECTIONS.length,
        frame,
        getWarriorAttackDirectionRow(direction)
      );
    }
  }

  for (const direction of ARCHER_ATTACK_DIRECTIONS) {
    for (let frame = 0; frame < ARCHER_ATTACK_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "archerAttackSprites",
        getArcherAttackFrameTexture(direction, frame),
        ARCHER_ATTACK_FRAME_COUNT,
        ARCHER_ATTACK_DIRECTIONS.length,
        frame,
        getArcherAttackDirectionRow(direction)
      );
    }
  }

  for (const direction of ENGINEER_ACTION_DIRECTIONS) {
    for (let frame = 0; frame < ENGINEER_ACTION_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "engineerActionSprites",
        getEngineerActionFrameTexture(direction, frame),
        ENGINEER_ACTION_FRAME_COUNT,
        ENGINEER_ACTION_DIRECTIONS.length,
        frame,
        getEngineerActionDirectionRow(direction)
      );
    }
  }

  for (const direction of MAGE_ATTACK_DIRECTIONS) {
    for (let frame = 0; frame < MAGE_ATTACK_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "mageAttackSprites",
        getMageAttackFrameTexture(direction, frame),
        MAGE_ATTACK_FRAME_COUNT,
        MAGE_ATTACK_DIRECTIONS.length,
        frame,
        getMageAttackDirectionRow(direction)
      );
    }
  }

  for (const vfx of VFX_KEYS) {
    for (let frame = 0; frame < VFX_FRAME_COUNT; frame += 1) {
      sliceGridTexture(scene, "skillEffectsClean", getVfxFrameTexture(vfx, frame), VFX_FRAME_COUNT, 6, frame, getVfxRow(vfx));
    }
  }

  for (const status of STATUS_AURA_KEYS) {
    for (let frame = 0; frame < STATUS_AURA_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "statusEffects",
        getStatusAuraFrameTexture(status, frame),
        STATUS_AURA_FRAME_COUNT,
        STATUS_AURA_SOURCE_ROWS,
        frame,
        getStatusAuraRow(status)
      );
    }
  }

  for (const vfx of ABILITY_VFX_KEYS) {
    for (let frame = 0; frame < ABILITY_VFX_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "abilityEffects",
        getAbilityVfxFrameTexture(vfx, frame),
        ABILITY_VFX_FRAME_COUNT,
        ABILITY_VFX_KEYS.length,
        frame,
        getAbilityVfxRow(vfx)
      );
    }
  }

  for (const direction of Object.keys(WARRIOR_VERTICAL_SLASH_ROWS) as Array<keyof typeof WARRIOR_VERTICAL_SLASH_ROWS>) {
    for (let frame = 0; frame < WARRIOR_VERTICAL_SLASH_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "warriorVerticalSlash",
        getWarriorVerticalSlashFrameTexture(direction, frame),
        WARRIOR_VERTICAL_SLASH_FRAME_COUNT,
        Object.keys(WARRIOR_VERTICAL_SLASH_ROWS).length,
        frame,
        getWarriorVerticalSlashRow(direction)
      );
    }
  }

  for (const vfx of WARRIOR_ARCHER_VFX_KEYS) {
    for (let frame = 0; frame < WARRIOR_ARCHER_VFX_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "warriorArcherEffects",
        getWarriorArcherVfxFrameTexture(vfx, frame),
        WARRIOR_ARCHER_VFX_FRAME_COUNT,
        WARRIOR_ARCHER_VFX_KEYS.length,
        frame,
        getWarriorArcherVfxRow(vfx),
        { top: 0, right: 0, bottom: 0, left: 0 },
        vfx === "warriorCharge",
        getWarriorArcherVfxTrimPadding(vfx)
      );
    }
  }

  for (let frame = 0; frame < WARRIOR_VERDICT_VFX_FRAME_COUNT; frame += 1) {
    sliceGridTexture(
      scene,
      "warriorVerdictCombatFx",
      getWarriorVerdictVfxFrameTexture(frame),
      WARRIOR_VERDICT_VFX_FRAME_COUNT,
      1,
      frame,
      0,
      { top: 0, right: 0, bottom: 0, left: 0 },
      false
    );
  }

  for (const vfx of ENGINEER_VFX_KEYS) {
    for (let frame = 0; frame < ENGINEER_VFX_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "engineerEffects",
        getEngineerVfxFrameTexture(vfx, frame),
        ENGINEER_VFX_FRAME_COUNT,
        ENGINEER_VFX_KEYS.length,
        frame,
        getEngineerVfxRow(vfx),
        { top: 0, right: 0, bottom: 0, left: 0 },
        true,
        getEngineerVfxTrimPadding(vfx)
      );
    }
  }

  for (const vfx of MAGE_VFX_KEYS) {
    for (let frame = 0; frame < MAGE_VFX_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "mageEffects",
        getMageVfxFrameTexture(vfx, frame),
        MAGE_VFX_FRAME_COUNT,
        MAGE_VFX_KEYS.length,
        frame,
        getMageVfxRow(vfx),
        getMageVfxTexturePadding()
      );
    }
  }

  for (const vfx of COMBAT_VFX_KEYS) {
    for (let frame = 0; frame < COMBAT_VFX_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "combatEffects",
        getCombatVfxFrameTexture(vfx, frame),
        COMBAT_VFX_FRAME_COUNT,
        COMBAT_VFX_KEYS.length,
        frame,
        getCombatVfxRow(vfx),
        { top: 0, right: 0, bottom: 0, left: 0 },
        true,
        getCombatVfxTrimPadding(vfx)
      );
    }
  }

  for (const element of RPG_SKILL_PROJECTILE_ELEMENTS) {
    for (let frame = 0; frame < RPG_SKILL_PROJECTILE_FRAME_COUNT; frame += 1) {
      sliceGridTexture(
        scene,
        "rpgSkillProjectiles",
        getRpgSkillProjectileFrameTexture(element, frame),
        RPG_SKILL_PROJECTILE_FRAME_COUNT,
        RPG_SKILL_PROJECTILE_ROW_COUNT,
        frame,
        getRpgSkillProjectileRow(element),
        { top: 0, right: 0, bottom: 0, left: 0 },
        true,
        { top: 6, right: 10, bottom: 6, left: 14 }
      );
    }
  }

  for (const key of COMBAT_OBJECT_KEYS) {
    const { column, row } = getCombatObjectGridPosition(key);
    sliceGridTexture(
      scene,
      "combatObjectsClean",
      getCombatObjectTexture(key),
      4,
      4,
      column,
      row,
      { top: 0, right: 0, bottom: 0, left: 0 },
      shouldTrimCombatObjectTexture(key),
      getCombatObjectTrimPadding(key)
    );
  }

}

function sliceTexture(scene: Phaser.Scene, sourceKey: string, outputKey: string, crop: Crop) {
  if (scene.textures.exists(outputKey)) {
    scene.textures.remove(outputKey);
  }

  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const canvas = scene.textures.createCanvas(outputKey, crop.width, crop.height);
  if (!canvas) {
    return;
  }

  const context = canvas.getContext();
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, crop.width, crop.height);
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  canvas.refresh();
}

function sliceGridTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  outputKey: string,
  columns: number,
  rows: number,
  column: number,
  row: number,
  padding: TexturePadding = { top: 0, right: 0, bottom: 0, left: 0 },
  trimAlpha = false,
  trimPadding: TexturePadding = { top: 0, right: 0, bottom: 0, left: 0 }
) {
  if (scene.textures.exists(outputKey)) {
    scene.textures.remove(outputKey);
  }

  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const cellWidth = source.width / columns;
  const cellHeight = source.height / rows;
  const sourceWidth = Math.floor(cellWidth);
  const sourceHeight = Math.floor(cellHeight);
  const outputWidth = sourceWidth + padding.left + padding.right;
  const outputHeight = sourceHeight + padding.top + padding.bottom;
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = outputWidth;
  rawCanvas.height = outputHeight;

  const context = rawCanvas.getContext("2d");
  if (!context) {
    return;
  }
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    source,
    column * cellWidth,
    row * cellHeight,
    cellWidth,
    cellHeight,
    padding.left,
    padding.top,
    sourceWidth,
    sourceHeight
  );

  const textureCanvas = trimAlpha ? trimCanvasToAlpha(rawCanvas, trimPadding) : rawCanvas;
  const canvas = scene.textures.createCanvas(outputKey, textureCanvas.width, textureCanvas.height);
  if (!canvas) {
    return;
  }

  const outputContext = canvas.getContext();
  outputContext.imageSmoothingEnabled = false;
  outputContext.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  outputContext.drawImage(textureCanvas, 0, 0);
  canvas.refresh();
}

function trimCanvasToAlpha(canvas: HTMLCanvasElement, padding: TexturePadding) {
  const context = canvas.getContext("2d");
  if (!context) {
    return canvas;
  }

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 8) {
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return canvas;
  }

  const cropLeft = Math.max(0, left - padding.left);
  const cropTop = Math.max(0, top - padding.top);
  const cropRight = Math.min(width, right + 1 + padding.right);
  const cropBottom = Math.min(height, bottom + 1 + padding.bottom);
  const output = document.createElement("canvas");
  output.width = cropRight - cropLeft;
  output.height = cropBottom - cropTop;
  const outputContext = output.getContext("2d");
  if (!outputContext) {
    return canvas;
  }
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(canvas, cropLeft, cropTop, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

function getCombatVfxTrimPadding(key: string): TexturePadding {
  if (key === "arrowProjectile") {
    return { top: 5, right: 10, bottom: 5, left: 16 };
  }
  if (key === "mageSolarBeam") {
    return { top: 10, right: 12, bottom: 10, left: 8 };
  }
  if (key === "magicOrbProjectile" || key === "healPickup" || key === "deathBurst") {
    return { top: 10, right: 10, bottom: 10, left: 10 };
  }
  return { top: 6, right: 8, bottom: 6, left: 8 };
}

function getEngineerVfxTrimPadding(key: string): TexturePadding {
  if (key === "repulsorPulse") {
    return { top: 10, right: 10, bottom: 10, left: 10 };
  }
  return { top: 10, right: 10, bottom: 10, left: 10 };
}

function getMageVfxTexturePadding(): TexturePadding {
  // Mage ground effects use 384x256 source cells but render into square radius displays.
  // Centering them in a square texture preserves the circular VFX shape.
  return { top: 64, right: 0, bottom: 64, left: 0 };
}

function getWarriorArcherVfxTrimPadding(key: string): TexturePadding {
  if (key === "warriorCharge") {
    return { top: 8, right: 12, bottom: 8, left: 12 };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function getCombatObjectTrimPadding(key: string): TexturePadding {
  if (key === "groundShadow") {
    return { top: 2, right: 4, bottom: 2, left: 4 };
  }
  if (key === "turretBase") {
    return { top: 12, right: 12, bottom: 8, left: 12 };
  }
  if (key === "turretHead" || key === "turretHeadFiring" || key === "turretHeadBoosted") {
    return { top: 10, right: 12, bottom: 10, left: 12 };
  }
  if (key === "healthCrystal" || key === "healthCrystalGlow") {
    return { top: 10, right: 10, bottom: 10, left: 10 };
  }
  return { top: 8, right: 8, bottom: 8, left: 8 };
}

function shouldTrimCombatObjectTexture(key: string) {
  return true;
}

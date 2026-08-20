import { generatedAssetPath } from "./generatedAssets";
import { warmAllArenaSkillRuntimeAssets } from "./arenaSkillRuntime";
import { NEW_COMPATIBLE_WALK_CLASS_IDS } from "./runtimeTextures";

const ARCHER_DRAW_ASSET_VERSION =
  "2026-08-11-moving-full-draw-v5-west-palette-corrected";

export interface ArenaStartupImageAsset {
  key: string;
  url: string;
}

export const ARENA_STARTUP_IMAGE_ASSETS: readonly ArenaStartupImageAsset[] = [
  ...NEW_COMPATIBLE_WALK_CLASS_IDS.map((classId) => ({
    key: `newCompatibleWalk_${classId}`,
    url: generatedAssetPath(`characters/new-compatible/${classId}/walk-8dir`)
  })),
  { key: "villageAssets", url: generatedAssetPath("village-assets") },
  { key: "skillEffects", url: generatedAssetPath("skill-effects") },
  { key: "combatObjects", url: generatedAssetPath("combat-objects") },
  { key: "healthLogo", url: generatedAssetPath("vinci-favicon") },
  { key: "attackMushroom", url: generatedAssetPath("attack-mushroom") },
  { key: "statusEffects", url: generatedAssetPath("status-effects") },
  { key: "abilityEffects", url: generatedAssetPath("ability-effects") },
  {
    key: "warriorVerticalSlash",
    url: generatedAssetPath("warrior-vertical-slash")
  },
  {
    key: "warriorArcherEffects",
    url: generatedAssetPath("warrior-archer-effects")
  },
  { key: "combatEffects", url: generatedAssetPath("combat-effects") },
  { key: "arenaDecals", url: generatedAssetPath("arena-decals") },
  {
    key: "warriorM1Sprites",
    url: generatedAssetPath("characters/new-compatible/warrior/melee-m1-8dir")
  },
  {
    key: "archerMovingBowSprites",
    url: generatedAssetPath(
      "characters/new-compatible/archer/moving-full-draw-8dir",
      ARCHER_DRAW_ASSET_VERSION
    )
  },
  {
    key: "archerStandingFullDrawSprites",
    url: generatedAssetPath(
      "characters/new-compatible/archer/standing-full-draw-8dir",
      ARCHER_DRAW_ASSET_VERSION
    )
  },
  {
    key: "archerForestRollSprites",
    url: generatedAssetPath("characters/new-compatible/archer/forest-roll-8dir")
  },
  {
    key: "engineerActionSprites",
    url: generatedAssetPath("engineer-action-sprites")
  },
  {
    key: "mageStaffCastSprites",
    url: generatedAssetPath("characters/new-compatible/mage/staff-cast-8dir")
  }
];

const prefetchedArenaStartupUrls = new Set<string>();
let arenaStartupWarmup: Promise<void> | null = null;

async function drainAsset(url: string) {
  if (prefetchedArenaStartupUrls.has(url)) return;
  const response = await fetch(url, {
    cache: "force-cache",
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`Arena startup asset download failed (${response.status}): ${url}`);
  }
  if (!response.body) {
    await response.blob();
  } else {
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {
      // Drain incrementally so iOS does not retain a second full asset buffer.
    }
  }
  prefetchedArenaStartupUrls.add(url);
}

async function warmArenaStartupImages() {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < ARENA_STARTUP_IMAGE_ASSETS.length) {
      const index = nextIndex;
      nextIndex += 1;
      await drainAsset(ARENA_STARTUP_IMAGE_ASSETS[index].url);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(3, ARENA_STARTUP_IMAGE_ASSETS.length) },
      () => worker()
    )
  );
}

/**
 * Begins downloading the complete 60-skill source set and Arena boot images
 * while the player is still in the lobby. Images are left in the browser HTTP
 * cache; Phaser decodes/uploads only the current match set before spawning.
 */
export function warmArenaStartupAssetCache() {
  if (!arenaStartupWarmup) {
    arenaStartupWarmup = (async () => {
      await warmAllArenaSkillRuntimeAssets();
      await warmArenaStartupImages();
    })().catch((error) => {
      arenaStartupWarmup = null;
      throw error;
    });
  }
  return arenaStartupWarmup;
}

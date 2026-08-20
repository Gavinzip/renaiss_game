import { staticAssetUrl } from "./staticAssets";
import { getArenaSkillPackagePreview } from "./arenaSkillPackageCatalog";
import type { ArenaCatalogSkillId } from "@renaiss-game/shared";

export const GENERATED_ASSET_VERSION =
  "2026-08-20-mage-05-prism-shatter-r3";

export function generatedAssetPath(fileName: string, version = GENERATED_ASSET_VERSION) {
  return `${staticAssetUrl(`/assets/generated/${fileName}.png`)}?v=${version}`;
}

export function arenaSkillPreviewPath(skillId: ArenaCatalogSkillId) {
  return arenaSkillPreviewMedia(skillId).url;
}

export function arenaSkillPreviewMedia(skillId: ArenaCatalogSkillId) {
  const packaged = getArenaSkillPackagePreview(skillId);
  if (packaged) {
    return {
      ...packaged,
      url: `${staticAssetUrl(packaged.file)}?v=${packaged.sha256.slice(0, 12)}`
    };
  }
  throw new Error(`Arena skill package preview is missing for ${skillId}`);
}

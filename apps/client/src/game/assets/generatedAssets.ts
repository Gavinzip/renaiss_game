import { staticAssetUrl } from "./staticAssets";

export const GENERATED_ASSET_VERSION = "2026-07-08-mage-circular-vfx-v1-attack-mushroom-buff-v1";

export function generatedAssetPath(fileName: string) {
  return `${staticAssetUrl(`/assets/generated/${fileName}.png`)}?v=${GENERATED_ASSET_VERSION}`;
}

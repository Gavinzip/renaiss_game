export const GENERATED_ASSET_VERSION = "2026-07-06-clean-pickups-mage-side-walk-v3-mage-circular-vfx-v1";

export function generatedAssetPath(fileName: string) {
  return `/assets/generated/${fileName}.png?v=${GENERATED_ASSET_VERSION}`;
}

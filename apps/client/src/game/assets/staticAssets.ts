import releaseManifest from "./staticAssetReleaseManifest.json";

const CSS_ASSET_URLS: Record<string, string> = {
  "--asset-vinci-login-cover-village": "/assets/generated/vinci-login-cover-village.jpg",
  "--asset-rpg-ui-panel": "/assets/ui/sprout-lands/button-large.png",
  "--asset-rpg-ui-panel-hover": "/assets/ui/sprout-lands/button-large-hover.png",
  "--asset-rpg-ui-square": "/assets/ui/sprout-lands/button-square.png",
  "--asset-rpg-ui-square-hover": "/assets/ui/sprout-lands/button-square-hover.png",
  "--asset-rpg-ui-square-green": "/assets/ui/sprout-lands/button-square-green.png",
  "--asset-rpg-ui-dialog-big": "/assets/ui/sprout-lands/dialog-box-big.png",
  "--asset-rpg-ui-dialog-medium": "/assets/ui/sprout-lands/dialog-box-medium.png",
  "--asset-rpg-ui-dialog-small": "/assets/ui/sprout-lands/dialog-box-small.png",
  "--arena-chrome-panel": "/assets/generated/arena-ui/arena-panel-frame.png",
  "--arena-chrome-inset": "/assets/generated/arena-ui/arena-inset-frame.png",
  "--arena-chrome-gold": "/assets/generated/arena-ui/arena-gold-button.png",
  "--arena-chrome-primary": "/assets/generated/arena-ui/arena-primary-button.png",
  "--arena-chrome-square": "/assets/generated/arena-ui/arena-square-button.png",
  "--rpg-arena-url": "/assets/generated/rpg-battle-arena.png"
};
const SPROUT_FONT_STYLE_ID = "renaiss-sprout-pixel-font-cdn";
const RELEASE_BASE_URL = trimTrailingSlash(releaseManifest.publicBaseUrl);

export function staticAssetBaseUrl() {
  const configured = (import.meta.env.VITE_STATIC_ASSET_BASE_URL as string | undefined)?.trim();
  if (configured) {
    const normalized = trimTrailingSlash(configured);
    if (import.meta.env.PROD && normalized !== RELEASE_BASE_URL) {
      throw new Error(
        `Static asset release mismatch: expected ${RELEASE_BASE_URL}, received ${normalized}`
      );
    }
    return normalized;
  }
  return RELEASE_BASE_URL;
}

export function staticAssetUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = staticAssetBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export function shouldLoadStaticAssetsWithCors() {
  return /^https?:\/\//.test(staticAssetBaseUrl());
}

export function installStaticAssetCssVariables() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const [name, path] of Object.entries(CSS_ASSET_URLS)) {
    root.style.setProperty(name, `url("${staticAssetUrl(path)}")`);
  }
  installSproutPixelFontFace();
}

function installSproutPixelFontFace() {
  if (document.getElementById(SPROUT_FONT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = SPROUT_FONT_STYLE_ID;
  style.textContent = `
@font-face {
  font-family: "SproutPixel";
  src: url("${staticAssetUrl("/assets/ui/sprout-lands/pixelFont-7-8x14-sproutLands.ttf")}") format("truetype");
  font-display: swap;
}
@font-face {
  font-family: "ArenaPixel";
  src: url("${staticAssetUrl("/assets/ui/sprout-lands/pixelFont-7-8x14-sproutLands.ttf")}") format("truetype");
  font-display: swap;
}
`;
  document.head.appendChild(style);
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

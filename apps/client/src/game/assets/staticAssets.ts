const DEFAULT_PRODUCTION_STATIC_ASSET_BASE_URL = "https://pub-043b57dfe27c4f7e9a469bbc5d7f33dc.r2.dev/renaiss-game";

const CSS_ASSET_URLS: Record<string, string> = {
  "--asset-vinci-login-cover-village": "/assets/generated/vinci-login-cover-village.jpg",
  "--asset-rpg-ui-panel": "/assets/ui/sprout-lands/button-large.png",
  "--asset-rpg-ui-panel-hover": "/assets/ui/sprout-lands/button-large-hover.png",
  "--asset-rpg-ui-square": "/assets/ui/sprout-lands/button-square.png",
  "--asset-rpg-ui-square-hover": "/assets/ui/sprout-lands/button-square-hover.png",
  "--asset-rpg-ui-square-green": "/assets/ui/sprout-lands/button-square-green.png",
  "--asset-rpg-ui-dialog-big": "/assets/ui/sprout-lands/dialog-box-big.png",
  "--asset-rpg-ui-dialog-medium": "/assets/ui/sprout-lands/dialog-box-medium.png",
  "--asset-rpg-ui-dialog-small": "/assets/ui/sprout-lands/dialog-box-small.png"
};
const SPROUT_FONT_STYLE_ID = "renaiss-sprout-pixel-font-cdn";

export function staticAssetBaseUrl() {
  const configured = (import.meta.env.VITE_STATIC_ASSET_BASE_URL as string | undefined)?.trim();
  if (configured) return trimTrailingSlash(configured);
  return import.meta.env.PROD ? DEFAULT_PRODUCTION_STATIC_ASSET_BASE_URL : "";
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
`;
  document.head.appendChild(style);
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

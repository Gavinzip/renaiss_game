import type { MapProp, MapPropType } from "@renaiss-game/shared";
import { ARENA_DECAL_TEXTURES, ENV_TEXTURES, type ArenaDecalKey, type EnvCropKey } from "./assets/crops";

export type MapPropSource =
  | {
      kind: "env";
      cropKey: EnvCropKey;
    }
  | {
      kind: "arena";
      key: ArenaDecalKey;
    };

export type MapPropColliderRecipe = "none" | "circle" | "rect";

export interface MapPropShadowSpec {
  width: number;
  height: number;
  offsetY: number;
  alpha: number;
  color?: number;
  anchor?: "foot" | "visualBase";
}

export interface MapPropVisualBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface MapPropRenderFrame {
  imageX: number;
  imageY: number;
  originX: number;
  originY: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MapPropShadowFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  color: number;
}

export interface MapPropCatalogEntry {
  type: MapPropType;
  label: string;
  source: MapPropSource;
  width: number;
  height: number;
  collider: MapPropColliderRecipe;
  originY: number;
  footOffsetY: number;
  visualBounds: MapPropVisualBounds;
  shadow?: MapPropShadowSpec;
}

const DEFAULT_VISUAL_BOUNDS: MapPropVisualBounds = {
  left: 0.42,
  right: 0.42,
  top: 0.28,
  bottom: 0.42
};

export const MAP_PROP_CATALOG = [
  {
    type: "fountain",
    label: "Fountain",
    source: { kind: "env", cropKey: "fountain" },
    width: 470,
    height: 542,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.39,
    visualBounds: { left: 0.42, right: 0.42, top: 0.34, bottom: 0.42 },
    shadow: { width: 360, height: 92, offsetY: -34, alpha: 0.2, color: 0x07130e }
  },
  {
    type: "houseA",
    label: "House A",
    source: { kind: "env", cropKey: "houseA" },
    width: 300,
    height: 218,
    collider: "rect",
    originY: 1,
    footOffsetY: 0.39,
    visualBounds: { left: 0.44, right: 0.44, top: 0.38, bottom: 0.42 },
    shadow: { width: 250, height: 48, offsetY: -18, alpha: 0.18 }
  },
  {
    type: "houseB",
    label: "House B",
    source: { kind: "env", cropKey: "houseB" },
    width: 330,
    height: 256,
    collider: "rect",
    originY: 1,
    footOffsetY: 0.39,
    visualBounds: { left: 0.44, right: 0.44, top: 0.38, bottom: 0.42 },
    shadow: { width: 284, height: 54, offsetY: -18, alpha: 0.18 }
  },
  {
    type: "fence",
    label: "Fence",
    source: { kind: "env", cropKey: "fence" },
    width: 350,
    height: 123,
    collider: "rect",
    originY: 1,
    footOffsetY: 0.42,
    visualBounds: { left: 0.43, right: 0.43, top: 0.18, bottom: 0.26 },
    shadow: { width: 286, height: 20, offsetY: 2, alpha: 0.25, color: 0x120b05, anchor: "visualBase" }
  },
  {
    type: "lamp",
    label: "Lamp",
    source: { kind: "env", cropKey: "lamp" },
    width: 68,
    height: 170,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.42,
    visualBounds: { left: 0.24, right: 0.24, top: 0.42, bottom: 0.42 },
    shadow: { width: 34, height: 13, offsetY: 1, alpha: 0.22, anchor: "visualBase" }
  },
  {
    type: "banner",
    label: "Hanging Banner",
    source: { kind: "env", cropKey: "banner" },
    width: 96,
    height: 146,
    collider: "none",
    originY: 1,
    footOffsetY: 0.4,
    visualBounds: { left: 0.32, right: 0.32, top: 0.38, bottom: 0.42 },
    shadow: { width: 42, height: 16, offsetY: 1, alpha: 0.24, anchor: "visualBase" }
  },
  {
    type: "bannerPost",
    label: "Banner Post",
    source: { kind: "arena", key: "bannerPost" },
    width: 128,
    height: 146,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.42,
    visualBounds: { left: 0.28, right: 0.28, top: 0.42, bottom: 0.42 },
    shadow: { width: 78, height: 22, offsetY: 2, alpha: 0.2, color: 0x0c1009, anchor: "visualBase" }
  },
  {
    type: "barrel",
    label: "Barrel",
    source: { kind: "env", cropKey: "barrel" },
    width: 78,
    height: 82,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.42,
    visualBounds: { left: 0.36, right: 0.36, top: 0.34, bottom: 0.4 },
    shadow: { width: 66, height: 20, offsetY: 0, alpha: 0.24, anchor: "visualBase" }
  },
  {
    type: "crate",
    label: "Crate",
    source: { kind: "env", cropKey: "crate" },
    width: 72,
    height: 72,
    collider: "rect",
    originY: 1,
    footOffsetY: 0.42,
    visualBounds: { left: 0.36, right: 0.36, top: 0.34, bottom: 0.4 },
    shadow: { width: 58, height: 18, offsetY: 0, alpha: 0.22, anchor: "visualBase" }
  },
  {
    type: "rockCluster",
    label: "Rock Cluster",
    source: { kind: "arena", key: "rockCluster" },
    width: 124,
    height: 112,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.38,
    visualBounds: { left: 0.35, right: 0.35, top: 0.25, bottom: 0.32 },
    shadow: { width: 76, height: 22, offsetY: 0, alpha: 0.23, color: 0x0c1009, anchor: "visualBase" }
  },
  {
    type: "mossStone",
    label: "Moss Stone",
    source: { kind: "arena", key: "mossStone" },
    width: 132,
    height: 104,
    collider: "rect",
    originY: 1,
    footOffsetY: 0.36,
    visualBounds: { left: 0.35, right: 0.35, top: 0.24, bottom: 0.3 },
    shadow: { width: 92, height: 24, offsetY: 0, alpha: 0.2, color: 0x0c1009, anchor: "visualBase" }
  },
  {
    type: "flatRock",
    label: "Flat Rock",
    source: { kind: "arena", key: "flatRock" },
    width: 112,
    height: 86,
    collider: "rect",
    originY: 1,
    footOffsetY: 0.34,
    visualBounds: { left: 0.35, right: 0.35, top: 0.22, bottom: 0.28 },
    shadow: { width: 78, height: 20, offsetY: 0, alpha: 0.19, color: 0x0c1009, anchor: "visualBase" }
  },
  { type: "runeGem", label: "Rune Gem", source: { kind: "arena", key: "runeGem" }, width: 132, height: 114, collider: "none", originY: 1, footOffsetY: 0.28, visualBounds: { left: 0.3, right: 0.3, top: 0.22, bottom: 0.26 } },
  { type: "runeRound", label: "Rune Round", source: { kind: "arena", key: "runeRound" }, width: 118, height: 104, collider: "none", originY: 1, footOffsetY: 0.28, visualBounds: { left: 0.3, right: 0.3, top: 0.22, bottom: 0.26 } },
  { type: "crackedStone", label: "Cracked Stone", source: { kind: "arena", key: "crackedStone" }, width: 118, height: 92, collider: "none", originY: 1, footOffsetY: 0.24, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "whiteFlowers", label: "White Flowers", source: { kind: "arena", key: "whiteFlowers" }, width: 88, height: 66, collider: "none", originY: 1, footOffsetY: 0.22, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "yellowFlowers", label: "Yellow Flowers", source: { kind: "arena", key: "yellowFlowers" }, width: 88, height: 66, collider: "none", originY: 1, footOffsetY: 0.22, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "blueFlowers", label: "Blue Flowers", source: { kind: "arena", key: "blueFlowers" }, width: 88, height: 66, collider: "none", originY: 1, footOffsetY: 0.22, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "pinkFlowers", label: "Pink Flowers", source: { kind: "arena", key: "pinkFlowers" }, width: 88, height: 66, collider: "none", originY: 1, footOffsetY: 0.22, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "leaves", label: "Leaves", source: { kind: "arena", key: "leaves" }, width: 88, height: 66, collider: "none", originY: 1, footOffsetY: 0.22, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "battleScuff", label: "Battle Scuff", source: { kind: "arena", key: "battleScuff" }, width: 88, height: 66, collider: "none", originY: 1, footOffsetY: 0.22, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "diamondRune", label: "Diamond Rune", source: { kind: "arena", key: "diamondRune" }, width: 96, height: 86, collider: "none", originY: 1, footOffsetY: 0.26, visualBounds: DEFAULT_VISUAL_BOUNDS },
  { type: "berryShrub", label: "Berry Shrub", source: { kind: "arena", key: "berryShrub" }, width: 102, height: 92, collider: "none", originY: 1, footOffsetY: 0.34, visualBounds: DEFAULT_VISUAL_BOUNDS, shadow: { width: 82, height: 23, offsetY: 0, alpha: 0.2, color: 0x071406, anchor: "visualBase" } },
  {
    type: "crystal",
    label: "Crystal",
    source: { kind: "env", cropKey: "crystal" },
    width: 112,
    height: 132,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.36,
    visualBounds: { left: 0.33, right: 0.33, top: 0.4, bottom: 0.35 },
    shadow: { width: 116, height: 36, offsetY: 0, alpha: 0.24, color: 0x0a1c23, anchor: "visualBase" }
  },
  {
    type: "treePine",
    label: "Pine",
    source: { kind: "env", cropKey: "treePine" },
    width: 116,
    height: 156,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.36,
    visualBounds: { left: 0.34, right: 0.34, top: 0.45, bottom: 0.34 },
    shadow: { width: 78, height: 25, offsetY: 0, alpha: 0.27, color: 0x071406, anchor: "visualBase" }
  },
  {
    type: "treeRound",
    label: "Round Tree",
    source: { kind: "env", cropKey: "treeRound" },
    width: 116,
    height: 142,
    collider: "circle",
    originY: 1,
    footOffsetY: 0.36,
    visualBounds: { left: 0.36, right: 0.36, top: 0.42, bottom: 0.34 },
    shadow: { width: 86, height: 26, offsetY: 0, alpha: 0.28, color: 0x071406, anchor: "visualBase" }
  },
  { type: "grassMound", label: "Grass Mound", source: { kind: "arena", key: "grassMound" }, width: 98, height: 82, collider: "none", originY: 1, footOffsetY: 0.28, visualBounds: DEFAULT_VISUAL_BOUNDS, shadow: { width: 74, height: 18, offsetY: 0, alpha: 0.13, color: 0x0c1208, anchor: "visualBase" } },
  { type: "shrub", label: "Shrub", source: { kind: "arena", key: "shrub" }, width: 102, height: 92, collider: "none", originY: 1, footOffsetY: 0.34, visualBounds: DEFAULT_VISUAL_BOUNDS, shadow: { width: 82, height: 23, offsetY: 0, alpha: 0.2, color: 0x071406, anchor: "visualBase" } },
  { type: "fenceShort", label: "Short Fence", source: { kind: "arena", key: "fenceShort" }, width: 140, height: 64, collider: "rect", originY: 1, footOffsetY: 0.36, visualBounds: { left: 0.42, right: 0.42, top: 0.18, bottom: 0.26 }, shadow: { width: 112, height: 18, offsetY: 0, alpha: 0.21, color: 0x120b05, anchor: "visualBase" } },
  { type: "stoneCorner", label: "Stone Corner", source: { kind: "arena", key: "stoneCorner" }, width: 118, height: 92, collider: "rect", originY: 1, footOffsetY: 0.34, visualBounds: DEFAULT_VISUAL_BOUNDS, shadow: { width: 94, height: 20, offsetY: 0, alpha: 0.19, color: 0x0c1009, anchor: "visualBase" } },
  { type: "brokenFence", label: "Broken Fence", source: { kind: "arena", key: "brokenFence" }, width: 140, height: 64, collider: "rect", originY: 1, footOffsetY: 0.36, visualBounds: { left: 0.42, right: 0.42, top: 0.18, bottom: 0.26 }, shadow: { width: 112, height: 18, offsetY: 0, alpha: 0.2, color: 0x120b05, anchor: "visualBase" } }
] satisfies MapPropCatalogEntry[];

export const MAP_PROP_CATALOG_BY_TYPE = Object.fromEntries(
  MAP_PROP_CATALOG.map((entry) => [entry.type, entry])
) as Record<MapPropType, MapPropCatalogEntry>;

export const MAP_EDITOR_PALETTE = MAP_PROP_CATALOG.filter((entry) =>
  new Set<MapPropType>([
    "fountain",
    "houseA",
    "houseB",
    "fence",
    "fenceShort",
    "brokenFence",
    "lamp",
    "banner",
    "bannerPost",
    "barrel",
    "crate",
    "rockCluster",
    "mossStone",
    "flatRock",
    "stoneCorner",
    "runeGem",
    "runeRound",
    "crystal",
    "treePine",
    "treeRound",
    "grassMound",
    "shrub"
  ]).has(entry.type)
);

export function getMapPropTexture(type: MapPropType) {
  const source = MAP_PROP_CATALOG_BY_TYPE[type].source;
  return source.kind === "env" ? ENV_TEXTURES[source.cropKey] : ARENA_DECAL_TEXTURES[source.key];
}

export function getMapPropRenderFrame(prop: MapProp): MapPropRenderFrame {
  const spec = MAP_PROP_CATALOG_BY_TYPE[prop.type];
  const originX = 0.5;
  const originY = spec.originY;
  const imageX = prop.x;
  const imageY = prop.y + (originY - 0.5) * prop.height;
  return {
    imageX,
    imageY,
    originX,
    originY,
    left: imageX - prop.width * originX,
    top: imageY - prop.height * originY,
    width: prop.width,
    height: prop.height
  };
}

export function getMapPropShadowFrame(prop: MapProp): MapPropShadowFrame | null {
  const spec = MAP_PROP_CATALOG_BY_TYPE[prop.type];
  if (!spec.shadow) {
    return null;
  }

  const shadow = spec.shadow;
  const frame = getMapPropRenderFrame(prop);
  const foot = getMapPropFootPoint(prop);
  const y =
    shadow.anchor === "visualBase"
      ? frame.top + frame.height - shadow.height * 0.42 + shadow.offsetY
      : foot.y + shadow.offsetY;

  return {
    x: prop.x,
    y,
    width: shadow.width,
    height: shadow.height,
    alpha: shadow.alpha,
    color: shadow.color ?? 0x090604
  };
}

export function getMapPropFootPoint(prop: MapProp) {
  const spec = MAP_PROP_CATALOG_BY_TYPE[prop.type];
  return {
    x: prop.x,
    y: prop.y + prop.height * spec.footOffsetY
  };
}

export function getMapPropVisualBounds(prop: MapProp) {
  const bounds = MAP_PROP_CATALOG_BY_TYPE[prop.type].visualBounds;
  return {
    left: prop.x - prop.width * bounds.left,
    right: prop.x + prop.width * bounds.right,
    top: prop.y - prop.height * bounds.top,
    bottom: prop.y + prop.height * bounds.bottom
  };
}

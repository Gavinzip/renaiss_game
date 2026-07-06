import Phaser from "phaser";
import { WORLD, type MapProp } from "@renaiss-game/shared";
import { ARENA_DECAL_TEXTURES, ENV_TEXTURES, type ArenaDecalKey } from "../assets/crops";
import { getMapPropRenderFrame, getMapPropShadowFrame, getMapPropTexture } from "../mapPropCatalog";
import { getRenderableMapProps } from "../mapDraft";

const TILE_SIZE = 96;

export function renderVillageMap(scene: Phaser.Scene) {
  const center = WORLD.width / 2;
  const mapProps = getRenderableMapProps();
  const roadEdges = scene.add.graphics().setDepth(-2700);

  for (let y = TILE_SIZE / 2; y < WORLD.height; y += TILE_SIZE) {
    for (let x = TILE_SIZE / 2; x < WORLD.width; x += TILE_SIZE) {
      const road = isRoadTile(x, y, center);
      const hash = tileHash(x, y);
      const texture = road ? (hash % 3 === 0 ? ENV_TEXTURES.stoneAlt : ENV_TEXTURES.stone) : ENV_TEXTURES.grass;
      const tile = addCropped(scene, texture, x, y, TILE_SIZE + 3, TILE_SIZE + 3, y - 4000);
      tile.setFlipX(Boolean(hash & 1)).setFlipY(Boolean(hash & 2));
      if (road) {
        tile.setTint(hash % 4 === 0 ? 0xf2eef6 : 0xffffff);
        drawRoadEdges(roadEdges, x, y, center);
      } else if (hash % 7 === 0) {
        tile.setTint(0xf3ffd3);
      } else if (hash % 11 === 0) {
        tile.setTint(0xe4f5bd);
      }
    }
  }

  renderTerrainDecals(scene, center, mapProps);

  for (const prop of mapProps) {
    addMapProp(scene, prop);
  }
}

export function addCropped(
  scene: Phaser.Scene,
  textureKey: string,
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
  depth: number
) {
  const image = scene.add.image(x, y, textureKey);
  image.setOrigin(0.5);
  image.setDisplaySize(displayWidth, displayHeight);
  image.setDepth(depth);
  return image;
}

function addMapProp(scene: Phaser.Scene, prop: MapProp) {
  const frame = getMapPropRenderFrame(prop);
  const depth = prop.y + prop.depthOffset;

  const shadow = getMapPropShadowFrame(prop);
  if (shadow) {
    scene.add
      .ellipse(
        shadow.x,
        shadow.y,
        shadow.width,
        shadow.height,
        shadow.color,
        shadow.alpha
      )
      .setDepth(depth - 5);
  }

  const image = addCropped(scene, getMapPropTexture(prop.type), frame.imageX, frame.imageY, frame.width, frame.height, depth);
  image.setOrigin(frame.originX, frame.originY);
  return image;
}

function isRoadTile(x: number, y: number, center: number) {
  const dx = x - center;
  const dy = y - center;
  const distanceFromCenter = Math.hypot(dx, dy);
  return (
    distanceFromCenter < 720 ||
    Math.abs(x - center) < 155 ||
    Math.abs(y - center) < 155 ||
    (Math.abs(distanceFromCenter - 1700) < 110 && Math.abs(dx) < 2050 && Math.abs(dy) < 2050) ||
    (Math.abs(Math.abs(dx) - Math.abs(dy)) < 95 && distanceFromCenter > 780 && distanceFromCenter < 2350) ||
    (Math.abs(y - WORLD.height * 0.22) < 90 && x > 720 && x < WORLD.width - 720) ||
    (Math.abs(y - WORLD.height * 0.78) < 90 && x > 720 && x < WORLD.width - 720) ||
    (Math.abs(x - WORLD.width * 0.22) < 90 && y > 720 && y < WORLD.height - 720) ||
    (Math.abs(x - WORLD.width * 0.78) < 90 && y > 720 && y < WORLD.height - 720)
  );
}

function drawRoadEdges(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: number) {
  const half = TILE_SIZE / 2;
  const edgeWidth = 7;
  const outerColor = 0x233216;
  const innerColor = 0xd8d0b7;

  drawEdgeIfGrass(graphics, x, y, center, x, y - TILE_SIZE, x - half, y - half, TILE_SIZE, edgeWidth, outerColor, 0.22);
  drawEdgeIfGrass(graphics, x, y, center, x, y + TILE_SIZE, x - half, y + half - edgeWidth, TILE_SIZE, edgeWidth, outerColor, 0.2);
  drawEdgeIfGrass(graphics, x, y, center, x - TILE_SIZE, y, x - half, y - half, edgeWidth, TILE_SIZE, outerColor, 0.2);
  drawEdgeIfGrass(graphics, x, y, center, x + TILE_SIZE, y, x + half - edgeWidth, y - half, edgeWidth, TILE_SIZE, outerColor, 0.18);

  drawEdgeIfGrass(graphics, x, y, center, x, y - TILE_SIZE, x - half, y - half + edgeWidth, TILE_SIZE, 2, innerColor, 0.12);
  drawEdgeIfGrass(graphics, x, y, center, x - TILE_SIZE, y, x - half + edgeWidth, y - half, 2, TILE_SIZE, innerColor, 0.1);
}

function drawEdgeIfGrass(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  center: number,
  neighborX: number,
  neighborY: number,
  rectX: number,
  rectY: number,
  width: number,
  height: number,
  color: number,
  alpha: number
) {
  if (!isRoadTile(x, y, center) || isRoadTile(neighborX, neighborY, center)) {
    return;
  }
  graphics.fillStyle(color, alpha);
  graphics.fillRect(rectX, rectY, width, height);
}

function renderTerrainDecals(scene: Phaser.Scene, center: number, mapProps: MapProp[]) {
  for (let y = TILE_SIZE / 2; y < WORLD.height; y += TILE_SIZE) {
    for (let x = TILE_SIZE / 2; x < WORLD.width; x += TILE_SIZE) {
      const hash = tileHash(x, y);
      const road = isRoadTile(x, y, center);
      const jitterX = ((hash >> 3) % 46) - 23;
      const jitterY = ((hash >> 9) % 44) - 22;
      if (road) {
        if (hash % 41 === 0) {
          addDecal(scene, hash % 3 === 0 ? "crackedStone" : "battleScuff", x + jitterX, y + jitterY, hash % 3 === 0 ? 84 : 58, 0.58);
        } else if (hash % 67 === 0) {
          addDecal(scene, "runeRound", x + jitterX, y + jitterY, 52, 0.46);
        }
      } else if (hash % 23 === 0) {
        const key = pickGrassDecal(hash);
        if (!canPlaceGrassDecal(x + jitterX, y + jitterY, key, center, mapProps)) {
          continue;
        }
        const size = getGrassDecalSize(key, hash);
        addDecal(scene, key, x + jitterX, y + jitterY, size, key === "leaves" ? 0.68 : 0.78);
      }
    }
  }
}

function canPlaceGrassDecal(x: number, y: number, key: ArenaDecalKey, center: number, mapProps: MapProp[]) {
  if (isNearMapPropVisual(x, y, key, mapProps)) {
    return false;
  }

  if ((key === "shrub" || key === "grassMound" || key === "flatRock") && isNearRoadEdge(x, y, center)) {
    return false;
  }

  return true;
}

function isNearMapPropVisual(x: number, y: number, key: ArenaDecalKey, mapProps: MapProp[]) {
  const extraPadding = key === "shrub" || key === "grassMound" ? 52 : 28;
  return mapProps.some((prop) => {
    const halfWidth = prop.width * 0.5 + extraPadding;
    const lowerHalf = prop.height * 0.42 + extraPadding;
    const upperHalf = prop.height * 0.26 + extraPadding;
    return (
      Math.abs(x - prop.x) < halfWidth &&
      y > prop.y - upperHalf &&
      y < prop.y + lowerHalf
    );
  });
}

function isNearRoadEdge(x: number, y: number, center: number) {
  const samples = [
    { x, y },
    { x: x + TILE_SIZE * 0.65, y },
    { x: x - TILE_SIZE * 0.65, y },
    { x, y: y + TILE_SIZE * 0.65 },
    { x, y: y - TILE_SIZE * 0.65 }
  ];
  const roadSamples = samples.filter((sample) => isRoadTile(sample.x, sample.y, center)).length;
  return roadSamples > 0 && roadSamples < samples.length;
}

function addDecal(scene: Phaser.Scene, key: ArenaDecalKey, x: number, y: number, size: number, alpha: number) {
  const image = addCropped(scene, ARENA_DECAL_TEXTURES[key], x, y, size, Math.round(size * 0.72), y - 3600);
  image.setAlpha(alpha).setFlipX(Boolean(tileHash(x, y) & 1));
  return image;
}

function pickGrassDecal(hash: number): ArenaDecalKey {
  const options: ArenaDecalKey[] = [
    "whiteFlowers",
    "yellowFlowers",
    "blueFlowers",
    "pinkFlowers",
    "leaves"
  ];
  return options[hash % options.length];
}

function getGrassDecalSize(key: ArenaDecalKey, hash: number) {
  const base = key === "shrub" ? 74 : key === "grassMound" ? 78 : key === "flatRock" ? 66 : 48;
  return base + (hash % 5) * 4;
}

function tileHash(x: number, y: number) {
  const gx = Math.floor(x / TILE_SIZE);
  const gy = Math.floor(y / TILE_SIZE);
  return Math.abs(Math.imul(gx + 17, 73856093) ^ Math.imul(gy + 31, 19349663));
}

import Phaser from "phaser";

export interface HouseInteractZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HouseInteractZones {
  cabinet: HouseInteractZone;
  door: HouseInteractZone;
}

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const VINCI_HOUSE_WORLD = {
  width: 2400,
  height: 1600
} as const;

export const VINCI_HOUSE_ZONES: HouseInteractZones = {
  cabinet: { x: 680, y: 350, width: 270, height: 310 },
  door: { x: 76, y: 500, width: 130, height: 150 }
};

const ENTRY_DOOR = {
  x: 76,
  y: 500
} as const;

const CROPS = {
  tallGlassCabinet: { x: 0, y: 0, width: 232, height: 224 },
  mirrorStand: { x: 28, y: 546, width: 146, height: 224 },
  desk: { x: 0, y: 778, width: 192, height: 118 },
  bookTable: { x: 392, y: 790, width: 124, height: 106 },
  redRug: { x: 338, y: 319, width: 172, height: 132 }
} satisfies Record<string, Crop>;

export function renderVinciHouseRoom(scene: Phaser.Scene) {
  scene.cameras.main.setBackgroundColor("#b7bbb1");

  renderFloorTiles(scene);
  renderLeftDoorway(scene);
  renderFurniture(scene);

  return VINCI_HOUSE_ZONES;
}

function renderFloorTiles(scene: Phaser.Scene) {
  const graphics = scene.add.graphics().setDepth(-10);
  const startX = 0;
  const startY = 0;
  const endX = VINCI_HOUSE_WORLD.width;
  const endY = VINCI_HOUSE_WORLD.height;
  graphics.fillStyle(0xb7bbb1, 1);
  graphics.fillRect(startX, startY, endX - startX, endY - startY);

  const tileW = 82;
  const tileH = 58;
  for (let y = startY; y < endY; y += tileH) {
    const row = Math.floor((y - startY) / tileH);
    for (let x = startX - (row % 2) * 36; x < endX; x += tileW) {
      const width = tileW - 3 + ((row + Math.floor(x / tileW)) % 3) * 5;
      const height = tileH - 3;
      const shade = (row + Math.floor(x / tileW)) % 3 === 0 ? 0xbec1b7 : (row + Math.floor(x / tileW)) % 3 === 1 ? 0xadb1a7 : 0xb5b9af;
      graphics.fillStyle(shade, 1);
      graphics.fillRect(Math.max(startX, x), y, Math.min(width, endX - x), height);
      graphics.lineStyle(1, 0x858a80, 0.26);
      graphics.strokeRect(Math.max(startX, x), y, Math.min(width, endX - x), height);
      graphics.lineStyle(1, 0xd0d3ca, 0.18);
      graphics.lineBetween(x + 10, y + 14, x + width - 18, y + 8);
      if ((row + x) % 2 === 0) graphics.lineBetween(x + 18, y + height - 10, x + width - 20, y + 24);
    }
  }
}

function renderLeftDoorway(scene: Phaser.Scene) {
  const graphics = scene.add.graphics().setDepth(70);
  const doorY = ENTRY_DOOR.y;
  const top = doorY - 58;
  const bottom = doorY + 58;

  graphics.fillStyle(0x080403, 1);
  graphics.fillRect(0, top - 8, 82, 132);
  graphics.fillStyle(0x0c0704, 1);
  graphics.fillRect(0, top, 56, 116);
  graphics.fillStyle(0x241008, 1);
  graphics.fillRect(0, top + 14, 40, 88);
  graphics.fillStyle(0x5b2a14, 1);
  graphics.fillRect(52, top - 6, 14, 128);
  graphics.fillStyle(0xb86d2d, 1);
  graphics.fillRect(64, top + 4, 12, 108);
  graphics.fillStyle(0xc87832, 1);
  graphics.fillRect(42, top - 14, 40, 14);
  graphics.fillRect(42, bottom, 40, 14);
  graphics.fillStyle(0xe3a04a, 1);
  graphics.fillRect(67, top + 16, 4, 78);
  graphics.fillRect(48, top - 10, 24, 4);
  graphics.fillStyle(0x32150a, 1);
  graphics.fillRect(0, top - 14, 42, 6);
  graphics.fillRect(0, bottom + 14, 42, 6);
  graphics.fillStyle(0xb7bbb1, 0.35);
  graphics.fillRect(16, top + 18, 6, 10);
  graphics.fillRect(30, bottom - 28, 8, 8);
}

function renderFurniture(scene: Phaser.Scene) {
  addCroppedImage(scene, "vinciShowroomEntity", CROPS.mirrorStand, 510, 380, 122, 187, 380);
  addCroppedImage(scene, "vinciShowroomEntity", CROPS.tallGlassCabinet, 680, 392, 206, 199, 392);
  addCroppedImage(scene, "vinciShowroomProps", CROPS.redRug, 698, 688, 210, 156, 506);
  addCroppedImage(scene, "vinciShowroomEntity", CROPS.desk, 698, 650, 252, 155, 650);
  addCroppedImage(scene, "vinciShowroomEntity", CROPS.bookTable, 972, 660, 144, 123, 660);
}

function addCroppedImage(
  scene: Phaser.Scene,
  texture: string,
  crop: Crop,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  origin = { x: 0.5, y: 1 }
) {
  const frame = ensureCropFrame(scene, texture, crop);
  return scene.add
    .image(x, y, texture, frame)
    .setOrigin(origin.x, origin.y)
    .setDisplaySize(width, height)
    .setDepth(depth);
}

function ensureCropFrame(scene: Phaser.Scene, texture: string, crop: Crop) {
  const frame = `${texture}-${crop.x}-${crop.y}-${crop.width}-${crop.height}`;
  const sourceTexture = scene.textures.get(texture);
  if (!sourceTexture.has(frame)) {
    sourceTexture.add(frame, 0, crop.x, crop.y, crop.width, crop.height);
  }
  return frame;
}

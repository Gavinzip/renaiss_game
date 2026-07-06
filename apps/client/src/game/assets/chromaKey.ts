import Phaser from "phaser";
import { removeMatteFromImageData, type MatteKind } from "./spriteMatte";

export function makeMatteTransparent(scene: Phaser.Scene, sourceKey: string, outputKey: string, matte: MatteKind) {
  const texture = scene.textures.get(sourceKey);
  const source = texture.getSourceImage() as HTMLImageElement;
  if (scene.textures.exists(outputKey)) {
    scene.textures.remove(outputKey);
  }

  const canvasTexture = scene.textures.createCanvas(outputKey, source.width, source.height);

  if (!canvasTexture) {
    return;
  }

  const context = canvasTexture.getContext();
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, source.width, source.height);
  removeMatteFromImageData(image, matte);
  context.putImageData(image, 0, 0);
  canvasTexture.refresh();
}

export function copyTexture(scene: Phaser.Scene, sourceKey: string, outputKey: string) {
  const texture = scene.textures.get(sourceKey);
  const source = texture.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  if (scene.textures.exists(outputKey)) {
    scene.textures.remove(outputKey);
  }

  const canvasTexture = scene.textures.createCanvas(outputKey, source.width, source.height);
  if (!canvasTexture) {
    return;
  }

  const context = canvasTexture.getContext();
  context.clearRect(0, 0, source.width, source.height);
  context.drawImage(source, 0, 0);
  canvasTexture.refresh();
}

import type { ClassId } from "@renaiss-game/shared";
import { useEffect, useRef } from "react";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import { getClassFrameCrop } from "../game/assets/crops";
import { getOpaqueBounds } from "../game/assets/spriteMatte";

interface ClassPortraitProps {
  classId: ClassId;
  frame?: number;
}

const CANVAS_WIDTH = 220;
const CANVAS_HEIGHT = 260;
const CANVAS_PADDING = 18;

export function ClassPortrait({ classId, frame = 0 }: ClassPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const crop = getClassFrameCrop(classId, frame);
      const buffer = document.createElement("canvas");
      buffer.width = crop.width;
      buffer.height = crop.height;
      const bufferContext = buffer.getContext("2d");
      if (!bufferContext) {
        return;
      }

      bufferContext.imageSmoothingEnabled = false;
      bufferContext.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      const pixels = bufferContext.getImageData(0, 0, crop.width, crop.height);

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      const bounds = getOpaqueBounds(pixels);
      if (!bounds) {
        return;
      }

      const scale = Math.min(
        (canvas.width - CANVAS_PADDING * 2) / bounds.width,
        (canvas.height - CANVAS_PADDING * 2) / bounds.height
      );
      const drawWidth = Math.floor(bounds.width * scale);
      const drawHeight = Math.floor(bounds.height * scale);
      const drawX = Math.floor((canvas.width - drawWidth) / 2);
      const drawY = Math.floor((canvas.height - drawHeight) / 2);
      context.drawImage(buffer, bounds.x, bounds.y, bounds.width, bounds.height, drawX, drawY, drawWidth, drawHeight);
    };
    image.src = generatedAssetPath("class-sprites");

    return () => {
      disposed = true;
    };
  }, [classId, frame]);

  return <canvas ref={canvasRef} className="class-portrait" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden="true" />;
}

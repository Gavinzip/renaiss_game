import { useEffect, useRef } from "react";

interface RpgPixelCardImageProps {
  alt: string;
  src: string;
}

const CANVAS_WIDTH = 84;
const CANVAS_HEIGHT = Math.round((CANVAS_WIDTH * 989) / 593);
// Square NFT renders are cropped to the same 593:989 slab template used by the football prize cards.
const CARD_CROP = {
  x: 0.25,
  y: 0.054,
  width: 0.5,
  aspect: 989 / 593
};
const CARD_IMAGE_CACHE_KEY = "renaiss:rpg-card-image-cache-v1";
const cardImageCache = new Map<string, HTMLImageElement>();
const cardImagePromises = new Map<string, Promise<HTMLImageElement>>();

function drawCardBack(canvas: HTMLCanvasElement, label: string) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3b2418";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e2b969";
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = "#6c3f25";
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = "#1b0d07";
  context.fillRect(14, 18, canvas.width - 28, canvas.height - 36);
  context.strokeStyle = "#f7dc94";
  context.lineWidth = 2;
  context.strokeRect(18, 22, canvas.width - 36, canvas.height - 44);
  context.fillStyle = "#f7dc94";
  context.font = "bold 10px monospace";
  context.textAlign = "center";
  context.fillText(label.slice(0, 4).toUpperCase() || "CARD", canvas.width / 2, canvas.height / 2 + 4);
}

function drawCardImage(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const cropWidth = image.naturalWidth * CARD_CROP.width;
  const cropHeight = cropWidth * CARD_CROP.aspect;
  const cropX = image.naturalWidth * CARD_CROP.x;
  const cropY = Math.min(image.naturalHeight - cropHeight, image.naturalHeight * CARD_CROP.y);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, cropX, Math.max(0, cropY), cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
}

function rememberLoadedCardImage(src: string) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CARD_IMAGE_CACHE_KEY) ?? "[]");
    const urls = Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
    if (urls.includes(src)) return;
    window.localStorage.setItem(CARD_IMAGE_CACHE_KEY, JSON.stringify([src, ...urls].slice(0, 240)));
  } catch {
    // The in-memory cache is still used when localStorage is unavailable.
  }
}

function loadCardImage(src: string) {
  const cached = cardImageCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = cardImagePromises.get(src);
  if (pending) return pending;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      cardImageCache.set(src, image);
      cardImagePromises.delete(src);
      rememberLoadedCardImage(src);
      resolve(image);
    };
    image.onerror = () => {
      cardImagePromises.delete(src);
      reject(new Error(`Unable to load card image: ${src}`));
    };
    image.src = src;
  });
  cardImagePromises.set(src, promise);
  return promise;
}

export function RpgPixelCardImage({ alt, src }: RpgPixelCardImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const cached = cardImageCache.get(src);
    if (cached) {
      drawCardImage(canvas, cached);
      return () => {
        disposed = true;
      };
    }
    drawCardBack(canvas, alt);
    void loadCardImage(src).then((image) => {
      if (disposed) return;
      drawCardImage(canvas, image);
    }).catch(() => {
      if (!disposed) drawCardBack(canvas, alt);
    });

    return () => {
      disposed = true;
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className="rpg-wallet-card-art rpg-wallet-card-canvas"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-label={alt}
      role="img"
    />
  );
}

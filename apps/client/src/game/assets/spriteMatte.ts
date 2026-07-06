export type MatteKind = "green" | "magenta" | "edgeBlack";

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function removeMatteFromImageData(image: ImageData, matte: MatteKind) {
  if (matte === "edgeBlack") {
    removeEdgeBlackMatte(image);
    return;
  }

  const { data, width, height } = image;
  for (let index = 0; index < data.length; index += 4) {
    const strength =
      matte === "green"
        ? greenMatteStrength(data[index], data[index + 1], data[index + 2])
        : magentaMatteStrength(data[index], data[index + 1], data[index + 2]);
    if (strength >= 0.76) {
      data[index + 3] = 0;
    } else if (strength > 0) {
      data[index + 3] = Math.round(data[index + 3] * Math.pow(1 - strength, 1.5));
    }
  }

  if (matte === "green") {
    removeConnectedGreenScreenFringe(data, width, height);
  }
  removeColorSpill(data, width, height, matte);
}

export function getOpaqueBounds(image: ImageData, alphaThreshold = 18): ContentBounds | null {
  const { data, width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] <= alphaThreshold) {
      continue;
    }

    const pixel = index / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function greenMatteStrength(r: number, g: number, b: number) {
  const dominance = Math.min(g - r, g - b);
  if (g < 118 || dominance < 28) {
    return 0;
  }

  const saturation = saturationOf(r, g, b);
  if (saturation < 0.33) {
    return 0;
  }

  const brightScore = clamp01((g - 132) / 92);
  const dominanceScore = clamp01((dominance - 28) / 82);
  return Math.max(brightScore, dominanceScore);
}

function removeConnectedGreenScreenFringe(data: Uint8ClampedArray, width: number, height: number) {
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    const pixel = y * width + x;
    if (visited[pixel]) {
      return;
    }
    visited[pixel] = 1;
    if (isLooseGreenScreen(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2])) {
      queue.push(pixel);
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length) {
    const pixel = queue.pop()!;
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) {
      enqueue(x - 1, y);
    }
    if (x < width - 1) {
      enqueue(x + 1, y);
    }
    if (y > 0) {
      enqueue(x, y - 1);
    }
    if (y < height - 1) {
      enqueue(x, y + 1);
    }
  }
}

function isLooseGreenScreen(r: number, g: number, b: number) {
  if (g < 68 || g <= r + 8 || g <= b + 8) {
    return false;
  }

  return saturationOf(r, g, b) > 0.18;
}

function magentaMatteStrength(r: number, g: number, b: number) {
  const dominance = Math.min(r - g, b - g);
  if (r < 132 || b < 126 || dominance < 34) {
    return 0;
  }

  const balance = 1 - clamp01(Math.abs(r - b) / 118);
  const dominanceScore = clamp01((dominance - 34) / 92);
  const brightScore = clamp01((Math.max(r, b) - 148) / 94);
  return Math.max(0, Math.min(1, Math.max(dominanceScore, brightScore) * balance));
}

function removeColorSpill(data: Uint8ClampedArray, width: number, height: number, matte: "green" | "magenta") {
  const alpha = new Uint8Array(width * height);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = data[pixel * 4 + 3];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const index = pixel * 4;
      if (alpha[pixel] <= 0 || !touchesTransparent(alpha, width, height, x, y)) {
        continue;
      }

      if (matte === "green") {
        const neutral = Math.max(data[index], data[index + 2]) + 14;
        if (data[index + 1] > neutral) {
          data[index + 1] = neutral;
        }
      } else {
        const neutral = data[index + 1] + 16;
        if (data[index] > neutral) {
          data[index] = neutral;
        }
        if (data[index + 2] > neutral) {
          data[index + 2] = neutral;
        }
      }
    }
  }
}

function removeEdgeBlackMatte(image: ImageData) {
  const { data, width, height } = image;
  const keep = new Uint8Array(width * height);

  for (let pixel = 0; pixel < keep.length; pixel += 1) {
    const index = pixel * 4;
    const lum = luminance(data[index], data[index + 1], data[index + 2]);
    const color = Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]);
    if (lum > 8 || color > 16) {
      keep[pixel] = 1;
    }
  }

  // Preserve black outlines directly attached to visible artwork, while dropping the flat sheet background.
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Uint8Array(keep);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        if (keep[pixel]) {
          continue;
        }

        if (hasKeptNeighbor(keep, width, height, x, y)) {
          next[pixel] = 1;
        }
      }
    }
    keep.set(next);
  }

  for (let pixel = 0; pixel < keep.length; pixel += 1) {
    if (keep[pixel]) {
      continue;
    }
    data[pixel * 4 + 3] = 0;
  }
}

function touchesTransparent(alpha: Uint8Array, width: number, height: number, x: number, y: number) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const nx = x + offsetX;
      const ny = y + offsetY;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return true;
      }
      if (alpha[ny * width + nx] === 0) {
        return true;
      }
    }
  }
  return false;
}

function hasKeptNeighbor(keep: Uint8Array, width: number, height: number, x: number, y: number) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const nx = x + offsetX;
      const ny = y + offsetY;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && keep[ny * width + nx]) {
        return true;
      }
    }
  }
  return false;
}

function saturationOf(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function luminance(r: number, g: number, b: number) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

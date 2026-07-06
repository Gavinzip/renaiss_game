#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
CLASS_SPRITES = ASSET_DIR / "class-sprites.png"
OUTPUT = ASSET_DIR / "mage-attack-sprites.png"

MAGE_ROW_Y = 748
FRAME_X = [55, 222, 392, 562, 724, 892, 1058, 1228]
CELL_W = 165
CELL_H = 194
FOOTLINE_Y = 176

DIRECTION_ROWS = {
    "right": 0,
    "down": 1,
    "left": 2,
    "up": 3,
}

RIGHT_FRAMES = (6, 7, 4)
DOWN_FRAMES = (1, 0, 2)
UP_FRAMES = (3, 3, 3)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()


def frame_cell(sheet: Image.Image, frame: int) -> Image.Image:
    x = FRAME_X[frame]
    return sheet.crop((x, MAGE_ROW_Y, x + CELL_W, MAGE_ROW_Y + CELL_H))


def remove_small_opaque_components(cell: Image.Image, min_pixels: int) -> None:
    pixels = cell.load()
    width, height = cell.size
    visited = [[False for _ in range(width)] for _ in range(height)]

    for y in range(height):
        for x in range(width):
            if visited[y][x] or pixels[x, y][3] <= 18:
                continue

            component: list[tuple[int, int]] = []
            queue = [(x, y)]
            visited[y][x] = True
            while queue:
                cx, cy = queue.pop()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < width and 0 <= ny < height and not visited[ny][nx] and pixels[nx, ny][3] > 18:
                        visited[ny][nx] = True
                        queue.append((nx, ny))

            if len(component) < min_pixels:
                for cx, cy in component:
                    r, g, b, _ = pixels[cx, cy]
                    pixels[cx, cy] = (r, g, b, 0)


def fit_content(cell: Image.Image, max_width: int = 152, max_height: int = 160, min_margin_x: int = 8) -> Image.Image:
    cleaned = cell.copy()
    remove_small_opaque_components(cleaned, 18)
    box = alpha_bbox(cleaned)
    fitted = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    if not box:
        return fitted

    left, top, right, bottom = box
    content = cleaned.crop(box)
    content_w = right - left
    content_h = bottom - top
    scale = min(1, max_width / content_w, max_height / content_h)
    new_w = max(1, round(content_w * scale))
    new_h = max(1, round(content_h * scale))
    if (new_w, new_h) != content.size:
        content = content.resize((new_w, new_h), Image.Resampling.NEAREST)

    available_x = max(0, CELL_W - new_w)
    dest_x = max(min_margin_x, min(available_x - min_margin_x, round((CELL_W - new_w) / 2)))
    if available_x < min_margin_x * 2:
        dest_x = max(0, round((CELL_W - new_w) / 2))
    dest_y = max(18, min(CELL_H - new_h - 8, FOOTLINE_Y - new_h))
    fitted.alpha_composite(content, (dest_x, dest_y))
    return fitted


def shifted(cell: Image.Image, dx: int = 0, dy: int = 0) -> Image.Image:
    canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    canvas.alpha_composite(cell, (dx, dy))
    return canvas


def make_side_attack_frames(source: Image.Image) -> list[Image.Image]:
    return [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(RIGHT_FRAMES, (-2, 2, -1))]


def make_down_attack_frames(source: Image.Image) -> list[Image.Image]:
    return [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(DOWN_FRAMES, (-1, 0, 1))]


def make_up_attack_frames(source: Image.Image) -> list[Image.Image]:
    return [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(UP_FRAMES, (-1, 0, 1))]


def paste_strip(output: Image.Image, row: int, cells: list[Image.Image]) -> None:
    for column, cell in enumerate(cells):
        output.alpha_composite(cell, (column * CELL_W, row * CELL_H))


def generate() -> None:
    source = Image.open(CLASS_SPRITES).convert("RGBA")
    output = Image.new("RGBA", (CELL_W * 3, CELL_H * 4), (0, 0, 0, 0))

    right = make_side_attack_frames(source)
    left = [ImageOps.mirror(frame) for frame in right]
    down = make_down_attack_frames(source)
    up = make_up_attack_frames(source)

    paste_strip(output, DIRECTION_ROWS["right"], right)
    paste_strip(output, DIRECTION_ROWS["down"], down)
    paste_strip(output, DIRECTION_ROWS["left"], left)
    paste_strip(output, DIRECTION_ROWS["up"], up)
    output.save(OUTPUT)


if __name__ == "__main__":
    generate()

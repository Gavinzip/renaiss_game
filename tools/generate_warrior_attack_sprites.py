#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
CLASS_SPRITES_SOURCE = ASSET_DIR / "class-sprites-source.png"
CLASS_SPRITES = ASSET_DIR / "class-sprites.png"
OUTPUT = ASSET_DIR / "warrior-attack-sprites.png"

WARRIOR_ROW_Y = 36
FRAME_X = [55, 222, 392, 562, 724, 892, 1058, 1228]
CELL_W = 165
CELL_H = 194

DIRECTION_ROWS = {
    "right": 0,
    "down": 1,
    "left": 2,
    "up": 3,
}

RIGHT_FRAMES = (6, 7, 4)
DOWN_FRAMES = (1, 0, 2)
UP_FRAMES = (3, 3, 3)
STRIKE_FRAME = 7
STRIKE_MAX_WIDTH = 148
STRIKE_MAX_HEIGHT = 158
SAFE_MARGIN_X = 10


def frame_cell(sheet: Image.Image, frame: int) -> Image.Image:
    x = FRAME_X[frame]
    return sheet.crop((x, WARRIOR_ROW_Y, x + CELL_W, WARRIOR_ROW_Y + CELL_H))


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()


def saturation(r: int, g: int, b: int) -> float:
    high = max(r, g, b)
    low = min(r, g, b)
    return 0 if high == 0 else (high - low) / high


def is_border_green(r: int, g: int, b: int) -> bool:
    return g > 132 and g > r + 34 and g > b + 34 and saturation(r, g, b) > 0.32


def matte_cell(cell: Image.Image) -> Image.Image:
    image = cell.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    remove = [[False for _ in range(width)] for _ in range(height)]
    queue: list[tuple[int, int]] = []

    def enqueue(x: int, y: int) -> None:
        if remove[y][x]:
            return
        r, g, b, _ = pixels[x, y]
        if not is_border_green(r, g, b):
            return
        remove[y][x] = True
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(1, height - 1):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.pop()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    for y in range(height):
        for x in range(width):
            if remove[y][x]:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)

    return image


def remove_warrior_slash_trail(cell: Image.Image) -> None:
    pixels = cell.load()
    width, height = cell.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 20:
                continue

            far_right = x > width - 88
            lower_arc = y > height - 80 and x > width - 114
            vivid_gold = r > 210 and g > 138 and b < 128 and saturation(r, g, b) > 0.28
            warm_white_arc = r > 232 and g > 204 and b > 122 and r - b > 30 and g - b > 18
            pure_white_trail = x > 180 and r > 220 and g > 220 and b > 210
            far_trail = x > 180 and vivid_gold
            if pure_white_trail or far_trail or ((far_right or lower_arc) and (vivid_gold or warm_white_arc)):
                pixels[x, y] = (r, g, b, 0)


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


def clear_warrior_green_spill(cell: Image.Image) -> None:
    pixels = cell.load()
    width, height = cell.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 20:
                continue
            if g > r + 14 and g > b + 8 and saturation(r, g, b) > 0.24:
                pixels[x, y] = (r, g, b, 0)


def fit_content(cell: Image.Image, max_width: int, max_height: int, min_margin_x: int = SAFE_MARGIN_X) -> Image.Image:
    box = alpha_bbox(cell)
    fitted = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    if not box:
        return fitted

    left, top, right, bottom = box
    content = cell.crop(box)
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
    dest_y = max(18, min(CELL_H - new_h - 8, 176 - new_h))
    fitted.alpha_composite(content, (dest_x, dest_y))
    return fitted


def source_strike_frame() -> Image.Image:
    source = Image.open(CLASS_SPRITES_SOURCE).convert("RGBA")
    frame_x = FRAME_X[STRIKE_FRAME]
    source_crop = source.crop((frame_x - 28, WARRIOR_ROW_Y - 22, frame_x + CELL_W + 62, WARRIOR_ROW_Y + CELL_H + 8))
    matted = matte_cell(source_crop)
    remove_warrior_slash_trail(matted)
    remove_small_opaque_components(matted, 18)
    fitted = fit_content(matted, STRIKE_MAX_WIDTH, STRIKE_MAX_HEIGHT)
    clear_warrior_green_spill(fitted)
    remove_small_opaque_components(fitted, 18)
    return fitted


def safe_source_frame(sheet: Image.Image, frame: int) -> Image.Image:
    fitted = fit_content(frame_cell(sheet, frame), 148, 158)
    clear_warrior_green_spill(fitted)
    return fitted


def shifted(cell: Image.Image, dx: int = 0, dy: int = 0) -> Image.Image:
    canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    canvas.alpha_composite(cell, (dx, dy))
    return canvas


def fit_final_attack_frame(cell: Image.Image) -> Image.Image:
    fitted = fit_content(cell, STRIKE_MAX_WIDTH, STRIKE_MAX_HEIGHT, min_margin_x=SAFE_MARGIN_X)
    clear_warrior_green_spill(fitted)
    remove_small_opaque_components(fitted, 18)
    return fitted


def draw_pixel_diamond(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: tuple[int, int, int, int]) -> None:
    draw.polygon([(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)], fill=fill)


def draw_combat_fx_sparkles(canvas: Image.Image, center: tuple[int, int], phase: int) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    sx, sy = center
    color_hot = (255, 247, 194, 226)
    color_mid = (236, 174, 62, 190)
    shadow = (18, 11, 8, 84)
    offsets = ((-8, 3), (-3, -4), (5, 4), (12, -1)) if phase == 1 else ((-5, 2), (4, -3))
    for index, (ox, oy) in enumerate(offsets):
        fill = color_hot if index % 2 == 0 else color_mid
        draw_pixel_diamond(draw, sx + ox + 1, sy + oy + 2, 2, 3, shadow)
        draw_pixel_diamond(draw, sx + ox, sy + oy, 1 + (phase == 1 and index % 3 == 0), 2, fill)


def draw_attached_sword_fx(cell: Image.Image, direction: str, phase: int) -> Image.Image:
    if direction == "left":
        return ImageOps.mirror(draw_attached_sword_fx(ImageOps.mirror(cell), "right", phase))

    output = cell.copy()
    spark_positions = {
        "right": ((102, 127), (116, 116), (113, 128)),
        "down": ((63, 136), (83, 139), (76, 136)),
        "up": ((67, 96), (60, 100), (78, 101)),
    }
    position = spark_positions[direction][phase]
    draw_combat_fx_sparkles(output, position, phase)
    return output


def make_down_attack_frames(source: Image.Image) -> list[Image.Image]:
    ready = shifted(safe_source_frame(source, DOWN_FRAMES[0]), dx=-2)
    strike = draw_attached_sword_fx(shifted(safe_source_frame(source, DOWN_FRAMES[1]), dy=1), "down", 1)
    recover = shifted(safe_source_frame(source, DOWN_FRAMES[2]), dx=2)
    return [
        draw_attached_sword_fx(ready, "down", 0),
        strike,
        draw_attached_sword_fx(recover, "down", 2),
    ]


def make_up_attack_frames(source: Image.Image) -> list[Image.Image]:
    ready = draw_attached_sword_fx(shifted(safe_source_frame(source, UP_FRAMES[0]), dx=-1), "up", 0)
    strike = draw_attached_sword_fx(safe_source_frame(source, UP_FRAMES[1]), "up", 1)
    recover = draw_attached_sword_fx(shifted(safe_source_frame(source, UP_FRAMES[2]), dx=1), "up", 2)
    return [ready, strike, recover]


def paste_strip(output: Image.Image, row: int, cells: list[Image.Image]) -> None:
    for column, cell in enumerate(cells):
        output.alpha_composite(cell, (column * CELL_W, row * CELL_H))


def generate() -> None:
    source = Image.open(CLASS_SPRITES).convert("RGBA")
    output = Image.new("RGBA", (CELL_W * 3, CELL_H * 4), (0, 0, 0, 0))

    right = [
        draw_attached_sword_fx(safe_source_frame(source, RIGHT_FRAMES[0]), "right", 0),
        fit_final_attack_frame(draw_attached_sword_fx(source_strike_frame(), "right", 1)),
        draw_attached_sword_fx(safe_source_frame(source, RIGHT_FRAMES[2]), "right", 2),
    ]
    left = [ImageOps.mirror(cell) for cell in right]
    down = make_down_attack_frames(source)
    up = make_up_attack_frames(source)

    paste_strip(output, DIRECTION_ROWS["right"], right)
    paste_strip(output, DIRECTION_ROWS["down"], down)
    paste_strip(output, DIRECTION_ROWS["left"], left)
    paste_strip(output, DIRECTION_ROWS["up"], up)
    output.save(OUTPUT)


if __name__ == "__main__":
    generate()

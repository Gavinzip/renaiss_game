#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
CLASS_SPRITES = ASSET_DIR / "class-sprites.png"
OUTPUT = ASSET_DIR / "engineer-action-sprites.png"

ENGINEER_ROW_Y = 516
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
    return sheet.crop((x, ENGINEER_ROW_Y, x + CELL_W, ENGINEER_ROW_Y + CELL_H))


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


def fit_content(cell: Image.Image, max_width: int = 150, max_height: int = 160, min_margin_x: int = 8) -> Image.Image:
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


def draw_pixel_spark(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: int = 1) -> None:
    dark = (19, 20, 28, 235)
    blue = (74, 195, 246, 255)
    core = (238, 255, 232, 255)
    gold = (242, 183, 66, 255)
    draw.line([(cx - 8 * scale, cy), (cx + 8 * scale, cy)], fill=dark, width=3 * scale)
    draw.line([(cx, cy - 8 * scale), (cx, cy + 8 * scale)], fill=dark, width=3 * scale)
    draw.line([(cx - 7 * scale, cy), (cx + 7 * scale, cy)], fill=blue, width=scale)
    draw.line([(cx, cy - 7 * scale), (cx, cy + 7 * scale)], fill=blue, width=scale)
    draw.rectangle([cx - scale, cy - scale, cx + scale, cy + scale], fill=core)
    draw.point((cx - 11 * scale, cy - 4 * scale), fill=gold)
    draw.point((cx + 10 * scale, cy + 5 * scale), fill=gold)


def draw_micro_spark(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    dark = (18, 14, 12, 132)
    gold = (239, 179, 75, 235)
    blue = (88, 201, 242, 190)
    core = (255, 245, 181, 255)
    draw.rectangle([cx - 2, cy - 1, cx + 2, cy + 1], fill=dark)
    draw.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=core)
    draw.point((cx - 4, cy + 2), fill=gold)
    draw.point((cx + 4, cy - 2), fill=blue)
    draw.point((cx + 2, cy + 4), fill=gold)


def draw_tapered_path(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    widths: list[int],
    fill: tuple[int, int, int, int],
) -> None:
    if len(points) < 2:
        return

    left: list[tuple[int, int]] = []
    right: list[tuple[int, int]] = []
    for index, (x, y) in enumerate(points):
        if index == 0:
            px, py = points[index]
            nx, ny = points[index + 1]
        elif index == len(points) - 1:
            px, py = points[index - 1]
            nx, ny = points[index]
        else:
            px, py = points[index - 1]
            nx, ny = points[index + 1]

        dx = nx - px
        dy = ny - py
        length = math.hypot(dx, dy) or 1
        normal_x = -dy / length
        normal_y = dx / length
        half_width = widths[min(index, len(widths) - 1)] / 2
        left.append((round(x + normal_x * half_width), round(y + normal_y * half_width)))
        right.append((round(x - normal_x * half_width), round(y - normal_y * half_width)))

    draw.polygon(left + list(reversed(right)), fill=fill)


def draw_pixel_bolt(draw: ImageDraw.ImageDraw, cx: int, cy: int, flip: int = 1) -> None:
    dark = (18, 15, 14, 190)
    gold = (231, 174, 75, 242)
    core = (255, 242, 171, 255)
    draw.rectangle([cx - 3, cy - 2, cx + 3, cy + 2], fill=dark)
    draw.polygon([(cx - 2 * flip, cy - 4), (cx + 3 * flip, cy), (cx - 1 * flip, cy + 5)], fill=gold)
    draw.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=core)


def draw_wrench_arc(cell: Image.Image, direction: str, phase: int) -> Image.Image:
    output = cell.copy()
    draw = ImageDraw.Draw(output, "RGBA")
    ink = (24, 18, 14, 190)
    metal = (132, 142, 137, 225)
    hot_metal = (232, 171, 68, 230)
    core = (255, 243, 183, 248)
    ember = (250, 114, 54, 188)

    if direction == "right":
        points = [
            [(97, 107), (110, 104), (122, 104)],
            [(91, 112), (113, 108), (134, 103)],
            [(94, 117), (109, 121), (124, 121)],
        ][phase]
    elif direction == "left":
        points = [
            [(68, 107), (55, 104), (43, 104)],
            [(74, 112), (52, 108), (31, 103)],
            [(71, 117), (56, 121), (41, 121)],
        ][phase]
    elif direction == "down":
        points = [
            [(62, 124), (77, 133), (94, 140)],
            [(58, 128), (80, 145), (106, 150)],
            [(76, 124), (94, 132), (111, 133)],
        ][phase]
    else:
        points = [
            [(62, 95), (78, 88), (96, 88)],
            [(58, 91), (82, 81), (109, 84)],
            [(80, 92), (99, 95), (115, 102)],
        ][phase]

    sx, sy = points[-1]
    if phase == 1:
        widths = [5, 12, 7]
        draw_tapered_path(draw, [(x + 2, y + 4) for x, y in points], [value + 5 for value in widths], (13, 11, 10, 104))
        draw_tapered_path(draw, points, [value + 3 for value in widths], ink)
        draw_tapered_path(draw, points, widths, metal)
        draw_tapered_path(draw, points[1:], [9, 4], hot_metal)
        draw_tapered_path(draw, [(points[1][0] + 1, points[1][1] - 1), points[2]], [4, 2], core)
        draw_pixel_bolt(draw, sx + (7 if direction != "left" else -7), sy - 5, -1 if direction == "left" else 1)
        draw_pixel_bolt(draw, sx - (9 if direction != "left" else -9), sy + 7, 1 if direction == "left" else -1)
        draw.rectangle([sx - 2, sy - 2, sx + 2, sy + 2], fill=core)
        draw.point((sx + (12 if direction != "left" else -12), sy - 2), fill=ember)
        draw.point((sx + (10 if direction != "left" else -10), sy + 5), fill=hot_metal)
    else:
        draw_micro_spark(draw, sx, sy)
    if phase == 1:
        draw_pixel_spark(draw, sx, sy, 1)

    return output


def make_side_attack_frames(source: Image.Image) -> list[Image.Image]:
    frames = [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(RIGHT_FRAMES, (-3, 2, -1))]
    return [draw_wrench_arc(frame, "right", phase) for phase, frame in enumerate(frames)]


def make_down_attack_frames(source: Image.Image) -> list[Image.Image]:
    frames = [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(DOWN_FRAMES, (-1, 0, 1))]
    return [draw_wrench_arc(frame, "down", phase) for phase, frame in enumerate(frames)]


def make_up_attack_frames(source: Image.Image) -> list[Image.Image]:
    frames = [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(UP_FRAMES, (-1, 0, 1))]
    return [draw_wrench_arc(frame, "up", phase) for phase, frame in enumerate(frames)]


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

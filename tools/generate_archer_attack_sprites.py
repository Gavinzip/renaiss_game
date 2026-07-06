#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
CLASS_SPRITES = ASSET_DIR / "class-sprites.png"
OUTPUT = ASSET_DIR / "archer-attack-sprites.png"

ARCHER_ROW_Y = 276
FRAME_X = [55, 222, 392, 562, 724, 892, 1058, 1228]
CELL_W = 165
CELL_H = 194
FOOTLINE_Y = 176

DIRECTION_ROWS = {
    "right": 0,
    "down": 1,
    "left": 2,
    "up": 3
}

RIGHT_FRAMES = (6, 7, 4)
DOWN_FRAMES = (1, 0, 2)
UP_FRAMES = (3, 3, 3)


def saturation(r: int, g: int, b: int) -> float:
    high = max(r, g, b)
    low = min(r, g, b)
    return 0 if high == 0 else (high - low) / high


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()


def frame_cell(sheet: Image.Image, frame: int) -> Image.Image:
    x = FRAME_X[frame]
    return sheet.crop((x, ARCHER_ROW_Y, x + CELL_W, ARCHER_ROW_Y + CELL_H))


def remove_archer_background_green_artifacts(image: Image.Image) -> None:
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            chroma_background = g > 82 and r < 72 and b < 46 and g > r + 44 and g > b + 48
            if chroma_background:
                pixels[x, y] = (r, g, b, 0)


def remove_bow_hole_artifacts(image: Image.Image, rois: list[tuple[int, int, int, int]]) -> None:
    pixels = image.load()
    for left, top, right, bottom in rois:
        for y in range(top, min(bottom, image.height)):
            for x in range(left, min(right, image.width)):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                artifact_green = g > r + 18 and g > b + 10 and b < 86 and saturation(r, g, b) > 0.24
                if artifact_green:
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


def fit_content(cell: Image.Image, max_width: int = 150, max_height: int = 160, min_margin_x: int = 8) -> Image.Image:
    cleaned = cell.copy()
    remove_archer_background_green_artifacts(cleaned)
    remove_small_opaque_components(cleaned, 16)
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


def draw_pixel_arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    direction: str,
    alpha: int = 255
) -> None:
    dark = (32, 20, 13, min(235, alpha))
    shaft = (221, 178, 95, alpha)
    core = (245, 240, 196, min(255, alpha + 18))
    tip = (176, 194, 183, alpha)
    fletch = (116, 159, 128, alpha)
    x1, y1 = start
    x2, y2 = end
    draw.line([(x1, y1), (x2, y2)], fill=dark, width=5)
    draw.line([(x1, y1), (x2, y2)], fill=shaft, width=3)
    draw.line([(x1, y1), (x2, y2)], fill=core, width=1)

    if direction == "right":
        draw.polygon([(x2 + 7, y2), (x2 - 4, y2 - 5), (x2 - 2, y2 + 5)], fill=tip)
        draw.rectangle([x1 - 5, y1 - 4, x1 - 1, y1 - 1], fill=fletch)
        draw.rectangle([x1 - 5, y1 + 1, x1 - 1, y1 + 4], fill=fletch)
    elif direction == "left":
        draw.polygon([(x2 - 7, y2), (x2 + 4, y2 - 5), (x2 + 2, y2 + 5)], fill=tip)
        draw.rectangle([x1 + 1, y1 - 4, x1 + 5, y1 - 1], fill=fletch)
        draw.rectangle([x1 + 1, y1 + 1, x1 + 5, y1 + 4], fill=fletch)
    elif direction == "down":
        draw.polygon([(x2, y2 + 7), (x2 - 5, y2 - 4), (x2 + 5, y2 - 2)], fill=tip)
        draw.rectangle([x1 - 4, y1 - 5, x1 - 1, y1 - 1], fill=fletch)
        draw.rectangle([x1 + 1, y1 - 5, x1 + 4, y1 - 1], fill=fletch)
    else:
        draw.polygon([(x2, y2 - 7), (x2 - 5, y2 + 4), (x2 + 5, y2 + 2)], fill=tip)
        draw.rectangle([x1 - 4, y1 + 1, x1 - 1, y1 + 5], fill=fletch)
        draw.rectangle([x1 + 1, y1 + 1, x1 + 4, y1 + 5], fill=fletch)


def draw_bow(draw: ImageDraw.ImageDraw, center: tuple[int, int], direction: str, phase: int) -> None:
    x, y = center
    wood = (104, 66, 29, 255)
    dark = (31, 20, 12, 240)
    gold = (213, 152, 58, 255)
    string = (238, 229, 184, 235)

    if direction == "down":
        pull = [0, 5, 2][phase]
        bow_points = [(x - 26, y - 14), (x - 18, y + 18), (x - 3, y + 38)]
        draw.line(bow_points, fill=dark, width=5)
        draw.line(bow_points, fill=wood, width=3)
        draw.line([bow_points[0], (x - 12 + pull, y + 16), bow_points[-1]], fill=string, width=1)
        if phase == 1:
            draw_pixel_arrow(draw, (x - 7 + pull, y + 6), (x - 2 + pull, y + 34), "down", 230)
        elif phase == 0:
            draw_pixel_arrow(draw, (x - 7 + pull, y + 11), (x - 4 + pull, y + 24), "down", 168)
        else:
            draw.line([(x - 5 + pull, y + 16), (x - 2 + pull, y + 30)], fill=(245, 240, 196, 124), width=2)
            draw.point((x - 8 + pull, y + 32), fill=(118, 219, 142, 160))
        draw.rectangle([x - 13, y + 18, x - 9, y + 24], fill=gold)
        return

    if direction == "up":
        pull = [0, 5, 2][phase]
        bow_points = [(x - 28, y + 18), (x - 16, y - 14), (x + 1, y - 36)]
        draw.line(bow_points, fill=dark, width=5)
        draw.line(bow_points, fill=wood, width=3)
        draw.line([bow_points[0], (x - 10 + pull, y - 12), bow_points[-1]], fill=string, width=1)
        if phase == 1:
            draw_pixel_arrow(draw, (x - 5 + pull, y - 2), (x + 1 + pull, y - 31), "up", 230)
        elif phase == 0:
            draw_pixel_arrow(draw, (x - 5 + pull, y - 8), (x - 1 + pull, y - 21), "up", 168)
        else:
            draw.line([(x - 4 + pull, y - 10), (x + 1 + pull, y - 25)], fill=(245, 240, 196, 124), width=2)
            draw.point((x - 7 + pull, y - 27), fill=(118, 219, 142, 160))
        draw.rectangle([x - 12, y - 18, x - 8, y - 12], fill=gold)


def draw_release_streak(cell: Image.Image, direction: str) -> Image.Image:
    output = cell.copy()
    if direction == "right":
        remove_bow_hole_artifacts(output, [(82, 68, 132, 158)])
    elif direction == "left":
        remove_bow_hole_artifacts(output, [(33, 68, 83, 158)])
    remove_small_opaque_components(output, 16)
    draw = ImageDraw.Draw(output, "RGBA")
    if direction == "right":
        draw_pixel_arrow(draw, (102, 99), (140, 99), "right", 238)
        draw.line([(118, 104), (135, 107)], fill=(118, 219, 142, 130), width=2)
    elif direction == "left":
        draw_pixel_arrow(draw, (63, 99), (25, 99), "left", 238)
        draw.line([(47, 104), (30, 107)], fill=(118, 219, 142, 130), width=2)
    return output


def make_down_attack_frames(source: Image.Image) -> list[Image.Image]:
    frames = [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in zip(DOWN_FRAMES, (-1, 0, 1))]
    for phase, frame in enumerate(frames):
        draw_bow(ImageDraw.Draw(frame, "RGBA"), (92, 100), "down", phase)
    return frames


def make_up_attack_frames(source: Image.Image) -> list[Image.Image]:
    frames = [shifted(fit_content(frame_cell(source, frame)), dx=dx) for frame, dx in ((UP_FRAMES[0], -1), (UP_FRAMES[1], 0), (UP_FRAMES[2], 1))]
    for phase, frame in enumerate(frames):
        draw_bow(ImageDraw.Draw(frame, "RGBA"), (92, 102), "up", phase)
    return frames


def paste_strip(output: Image.Image, row: int, cells: list[Image.Image]) -> None:
    for column, cell in enumerate(cells):
        output.alpha_composite(cell, (column * CELL_W, row * CELL_H))


def generate() -> None:
    source = Image.open(CLASS_SPRITES).convert("RGBA")
    output = Image.new("RGBA", (CELL_W * 3, CELL_H * 4), (0, 0, 0, 0))

    right = [
        fit_content(frame_cell(source, RIGHT_FRAMES[0])),
        draw_release_streak(fit_content(frame_cell(source, RIGHT_FRAMES[1])), "right"),
        fit_content(frame_cell(source, RIGHT_FRAMES[2]))
    ]
    left = [draw_release_streak(ImageOps.mirror(cell), "left") if index == 1 else ImageOps.mirror(cell) for index, cell in enumerate(right)]
    down = make_down_attack_frames(source)
    up = make_up_attack_frames(source)

    paste_strip(output, DIRECTION_ROWS["right"], right)
    paste_strip(output, DIRECTION_ROWS["down"], down)
    paste_strip(output, DIRECTION_ROWS["left"], left)
    paste_strip(output, DIRECTION_ROWS["up"], up)
    output.save(OUTPUT)


if __name__ == "__main__":
    generate()

#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
SOURCE = ASSET_DIR / "class-sprites-source.png"
OUTPUT = ASSET_DIR / "class-sprites.png"
MAGE_FRONT_REPAIR_SOURCE = ASSET_DIR / "mage-front-repair-source.png"
MAGE_SIDE_WALK_GENERATED_SOURCE = ASSET_DIR / "source" / "mage-side-walk-generated-source.png"

CLASS_ROWS = {
    "warrior": 36,
    "archer": 276,
    "engineer": 516,
    "mage": 748,
}
FRAME_X = [55, 222, 392, 562, 724, 892, 1058, 1228]
CELL_W = 165
CELL_H = 194
FOOTLINE_Y = 176
MIN_TOP_MARGIN = 18
MAGE_ROW_Y = CLASS_ROWS["mage"]
ENGINEER_SOURCE_TOP_EXPAND = 44
MAGE_FRONT_REPAIR_FRAMES = (0, 1, 2)
MAGE_SIDE_WALK_SEED_FRAME = 7
MAGE_SIDE_WALK_FRAMES = (4, 5, 6)
MAGE_ATTACK_FRAME = 7
MAGE_ATTACK_MAX_WIDTH = 158
MAGE_ATTACK_MAX_HEIGHT = 160
MAGE_SIDE_MIN_HEIGHT = 158
MAGE_SIDE_MAX_WIDTH = 158
MAGE_SIDE_MAX_HEIGHT = 164
MAGE_SOURCE_TOP_EXPAND = 38
MAGE_EXPANDED_SOURCE_FRAMES = (3, 4, 5, 6, 7)
SAFETY_FIT_FRAMES = {
    ("archer", 7): (158, 160),
    ("engineer", 6): (158, 160),
    ("engineer", 7): (158, 160),
    ("mage", 1): (158, 160),
}
KEEP_LARGEST_COMPONENT_FRAMES = {
    ("warrior", 7),
    ("engineer", 6),
    ("engineer", 7),
}


def cell_box(frame_x: int, row_y: int) -> tuple[int, int, int, int]:
    return (frame_x, row_y, frame_x + CELL_W, row_y + CELL_H)


def source_cell_box(class_id: str, frame: int, frame_x: int, row_y: int) -> tuple[int, int, int, int]:
    if class_id == "engineer":
        return (frame_x, row_y - ENGINEER_SOURCE_TOP_EXPAND, frame_x + CELL_W, row_y + CELL_H)
    if class_id == "mage" and frame in MAGE_EXPANDED_SOURCE_FRAMES:
        return (frame_x, row_y - MAGE_SOURCE_TOP_EXPAND, frame_x + CELL_W, row_y + CELL_H)
    return cell_box(frame_x, row_y)


def saturation(r: int, g: int, b: int) -> float:
    high = max(r, g, b)
    low = min(r, g, b)
    return 0 if high == 0 else (high - low) / high


def is_border_green(r: int, g: int, b: int) -> bool:
    return g > 132 and g > r + 34 and g > b + 34 and saturation(r, g, b) > 0.32


def is_strong_green(r: int, g: int, b: int) -> bool:
    return g > 152 and min(g - r, g - b) > 42 and saturation(r, g, b) > 0.38


def matte_cell(cell: Image.Image) -> Image.Image:
    image = cell.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    remove = [[False for _ in range(width)] for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

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
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if remove[y][x]:
                pixels[x, y] = (r, g, b, 0)
                continue
            if a == 0:
                continue
            touches_clear = any(
                0 <= x + dx < width
                and 0 <= y + dy < height
                and remove[y + dy][x + dx]
                for dy in (-1, 0, 1)
                for dx in (-1, 0, 1)
                if dx or dy
            )
            if touches_clear and is_strong_green(r, g, b):
                pixels[x, y] = (r, g, b, 0)
            elif touches_clear and g > max(r, b) + 12:
                neutral = max(r, b) + 10
                pixels[x, y] = (r, min(g, neutral), b, a)

    return image


def remove_interior_chroma_green(image: Image.Image) -> None:
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if g > 170 and r < 120 and b < 140 and saturation(r, g, b) > 0.52:
                pixels[x, y] = (r, g, b, 0)


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


def remove_archer_bow_hole_artifacts(image: Image.Image, frame: int) -> None:
    rois: dict[int, list[tuple[int, int, int, int]]] = {
        5: [(70, 102, 94, 152)],
        6: [(70, 104, 108, 142)],
        7: [(82, 68, 132, 158)]
    }
    pixels = image.load()
    for left, top, right, bottom in rois.get(frame, []):
        for y in range(top, min(bottom, image.height)):
            for x in range(left, min(right, image.width)):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                artifact_green = g > r + 18 and g > b + 10 and b < 86 and saturation(r, g, b) > 0.24
                if artifact_green:
                    pixels[x, y] = (r, g, b, 0)


def remove_engineer_green_artifacts(image: Image.Image) -> None:
    pixels = image.load()
    width, height = image.size

    def near_clear(x: int, y: int) -> bool:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                nx = x + dx
                ny = y + dy
                if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny][3] <= 18:
                    return True
        return False

    for _ in range(3):
        to_clear: list[tuple[int, int]] = []
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue

                bright_chroma = g > 125 and g > r + 22 and g > b + 28 and b < 140
                edge_spill = g > 55 and g > r + 14 and g > b + 8 and b < 140 and near_clear(x, y)
                if bright_chroma or edge_spill:
                    to_clear.append((x, y))

        if not to_clear:
            return

        for x, y in to_clear:
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a <= 18:
                continue
            if g > 72 and g > r + 24 and g > b + 14 and b < 115 and near_clear(x, y):
                pixels[x, y] = (r, g, b, 0)


def bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.point(lambda value: 255 if value > 18 else 0).getbbox()


def normalize_cell(cell: Image.Image) -> Image.Image:
    matted = matte_cell(cell)
    box = bounds(matted)
    normalized = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    if not box:
        return normalized

    left, top, right, bottom = box
    content = matted.crop(box)
    content_w = right - left
    content_h = bottom - top
    dest_x = max(0, min(CELL_W - content_w, left))
    dest_y = max(MIN_TOP_MARGIN, min(CELL_H - content_h - 8, FOOTLINE_Y - content_h))
    normalized.alpha_composite(content, (dest_x, dest_y))
    return normalized


def normalize() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing required class sprite source: {SOURCE}")

    source = Image.open(SOURCE).convert("RGBA")
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))

    for class_id, row_y in CLASS_ROWS.items():
        for frame, frame_x in enumerate(FRAME_X):
            cell = source.crop(source_cell_box(class_id, frame, frame_x, row_y))
            normalized = normalize_cell(cell)
            normalized = post_process_class_frame(normalized, class_id, frame)
            output.alpha_composite(normalized, (frame_x, row_y))

    replace_warrior_attack_frame(output, source)
    replace_mage_front_frames(output)
    fit_mage_attack_frame(output)
    repair_mage_side_frames(output)
    output.save(OUTPUT)


def post_process_class_frame(cell: Image.Image, class_id: str, frame: int) -> Image.Image:
    processed = cell
    if class_id == "archer":
        remove_archer_background_green_artifacts(processed)
        remove_archer_bow_hole_artifacts(processed, frame)
    elif class_id == "engineer":
        remove_engineer_green_artifacts(processed)
    else:
        remove_interior_chroma_green(processed)

    if (class_id, frame) in KEEP_LARGEST_COMPONENT_FRAMES:
        processed = keep_largest_opaque_component(processed)

    fit = SAFETY_FIT_FRAMES.get((class_id, frame))
    if fit:
        processed = fit_cell_content(processed, *fit)
        remove_small_opaque_components(processed, 18)

    return processed


def replace_warrior_attack_frame(sheet: Image.Image, source: Image.Image) -> None:
    frame = 7
    frame_x = FRAME_X[frame]
    row_y = CLASS_ROWS["warrior"]
    source_crop = source.crop((frame_x, row_y - 18, frame_x + 190, row_y + 198))
    matted = matte_cell(source_crop)
    remove_interior_chroma_green(matted)
    remove_warrior_attack_slash(matted)
    repaired = fit_dynamic_content_to_cell(matted, 156, 160, min_margin_x=4)
    clear_warrior_attack_green_fringe(repaired)
    remove_small_opaque_components(repaired, 18)
    sheet.paste(Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0)), (frame_x, row_y))
    sheet.alpha_composite(repaired, (frame_x, row_y))


def remove_warrior_attack_slash(cell: Image.Image) -> None:
    pixels = cell.load()
    width, height = cell.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 20 or x < 118:
                continue

            vivid_gold = r > 210 and g > 138 and b < 128 and saturation(r, g, b) > 0.28
            warm_white_arc = x > 140 and r > 232 and g > 204 and b > 122 and r - b > 30 and g - b > 18
            lower_white_arc = x > 132 and y > 136 and r > 205 and g > 190 and b > 150
            if vivid_gold or warm_white_arc:
                pixels[x, y] = (r, g, b, 0)
            elif lower_white_arc:
                pixels[x, y] = (r, g, b, 0)


def clear_warrior_attack_green_fringe(cell: Image.Image) -> None:
    pixels = cell.load()
    for y in range(42, 70):
        for x in range(20, 40):
            r, g, b, a = pixels[x, y]
            if a < 20:
                continue
            if g > r + 28 and g > b + 18:
                pixels[x, y] = (r, g, b, 0)


def fit_dynamic_content_to_cell(cell: Image.Image, max_width: int, max_height: int, min_margin_x: int = 6) -> Image.Image:
    box = bounds(cell)
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
    dest_y = max(MIN_TOP_MARGIN, min(CELL_H - new_h - 8, FOOTLINE_Y - new_h))
    fitted.alpha_composite(content, (dest_x, dest_y))
    return fitted


def repair_mage_side_frames(sheet: Image.Image) -> None:
    seed_x = FRAME_X[MAGE_SIDE_WALK_SEED_FRAME]
    seed = fit_cell_content_with_min_height(
        sheet.crop(cell_box(seed_x, MAGE_ROW_Y)),
        MAGE_SIDE_MIN_HEIGHT,
        MAGE_SIDE_MAX_WIDTH,
        MAGE_SIDE_MAX_HEIGHT,
    )
    if not bounds(seed):
        raise ValueError("Mage side walk seed frame is empty")

    sheet.paste(Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0)), (seed_x, MAGE_ROW_Y))
    sheet.alpha_composite(seed, (seed_x, MAGE_ROW_Y))

    side_walk_strip = load_mage_side_walk_generated_source()
    for source_index, frame in enumerate(MAGE_SIDE_WALK_FRAMES):
        target_x = FRAME_X[frame]
        generated = side_walk_strip.crop((source_index * CELL_W, 0, (source_index + 1) * CELL_W, CELL_H))
        if not bounds(generated):
            raise ValueError(f"Mage generated side walk source frame {source_index} is empty")

        clear_mage_side_edge_artifacts(generated)
        stabilize_mage_side_feet(generated)
        remove_small_opaque_components(generated, 32)
        sheet.paste(Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0)), (target_x, MAGE_ROW_Y))
        sheet.alpha_composite(generated, (target_x, MAGE_ROW_Y))


def load_mage_side_walk_generated_source() -> Image.Image:
    if not MAGE_SIDE_WALK_GENERATED_SOURCE.exists():
        raise FileNotFoundError(f"Missing required Mage generated side walk source: {MAGE_SIDE_WALK_GENERATED_SOURCE}")

    side_walk_strip = Image.open(MAGE_SIDE_WALK_GENERATED_SOURCE).convert("RGBA")
    expected_size = (CELL_W * len(MAGE_SIDE_WALK_FRAMES), CELL_H)
    if side_walk_strip.size != expected_size:
        raise ValueError(f"Mage generated side walk source must be {expected_size}, got {side_walk_strip.size}")
    if not bounds(side_walk_strip):
        raise ValueError("Mage generated side walk source is empty")
    return side_walk_strip


def replace_mage_front_frames(sheet: Image.Image) -> None:
    if not MAGE_FRONT_REPAIR_SOURCE.exists():
        raise FileNotFoundError(f"Missing required Mage front repair source: {MAGE_FRONT_REPAIR_SOURCE}")

    repair_strip = Image.open(MAGE_FRONT_REPAIR_SOURCE).convert("RGBA")
    expected_size = (CELL_W * len(MAGE_FRONT_REPAIR_FRAMES), CELL_H)
    if repair_strip.size != expected_size:
        raise ValueError(f"Mage front repair source must be {expected_size}, got {repair_strip.size}")

    for source_index, frame in enumerate(MAGE_FRONT_REPAIR_FRAMES):
        target_x = FRAME_X[frame]
        repaired = repair_strip.crop((source_index * CELL_W, 0, (source_index + 1) * CELL_W, CELL_H))
        if not bounds(repaired):
            raise ValueError(f"Mage front repair source frame {source_index} is empty")

        remove_small_opaque_components(repaired, 18)
        sheet.paste(Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0)), (target_x, MAGE_ROW_Y))
        sheet.alpha_composite(repaired, (target_x, MAGE_ROW_Y))


def stabilize_mage_side_feet(cell: Image.Image) -> None:
    box = bounds(cell)
    if not box:
        return

    left, top, right, bottom = box
    if bottom == FOOTLINE_Y:
        return

    shifted = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    dy = FOOTLINE_Y - bottom
    shifted.alpha_composite(cell, (0, dy))
    cell.paste(shifted)


def clear_mage_side_edge_artifacts(cell: Image.Image) -> None:
    pixels = cell.load()
    for y in range(CELL_H):
        for x in range(CELL_W):
            if 3 <= x < CELL_W - 3 and 3 <= y < CELL_H - 3:
                continue
            r, g, b, a = pixels[x, y]
            if a < 20:
                continue
            dark_matte = max(r, g, b) < 48 and min(r, g, b) < 26
            green_spill = g > r + 8 and g > b + 4
            if dark_matte or green_spill:
                pixels[x, y] = (r, g, b, 0)


def fit_mage_attack_frame(sheet: Image.Image) -> None:
    frame_x = FRAME_X[MAGE_ATTACK_FRAME]
    cell = sheet.crop(cell_box(frame_x, MAGE_ROW_Y))
    fitted = fit_cell_content(cell, MAGE_ATTACK_MAX_WIDTH, MAGE_ATTACK_MAX_HEIGHT)
    remove_small_opaque_components(fitted, 18)
    sheet.paste(Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0)), (frame_x, MAGE_ROW_Y))
    sheet.alpha_composite(fitted, (frame_x, MAGE_ROW_Y))


def fit_cell_content(cell: Image.Image, max_width: int, max_height: int) -> Image.Image:
    box = bounds(cell)
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

    dest_x = max(6, min(CELL_W - new_w - 6, round((CELL_W - new_w) / 2)))
    dest_y = max(MIN_TOP_MARGIN, min(CELL_H - new_h - 8, FOOTLINE_Y - new_h))
    fitted.alpha_composite(content, (dest_x, dest_y))
    return fitted


def fit_cell_content_with_min_height(cell: Image.Image, min_height: int, max_width: int, max_height: int) -> Image.Image:
    box = bounds(cell)
    fitted = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    if not box:
        return fitted

    left, top, right, bottom = box
    content = cell.crop(box)
    content_w = right - left
    content_h = bottom - top
    max_scale = min(max_width / content_w, max_height / content_h)
    desired_scale = max(1, min_height / content_h)
    scale = min(max_scale, desired_scale)
    new_w = max(1, round(content_w * scale))
    new_h = max(1, round(content_h * scale))
    if (new_w, new_h) != content.size:
        content = content.resize((new_w, new_h), Image.Resampling.NEAREST)

    dest_x = max(4, min(CELL_W - new_w - 4, round((CELL_W - new_w) / 2)))
    dest_y = max(MIN_TOP_MARGIN, min(CELL_H - new_h - 8, FOOTLINE_Y - new_h))
    fitted.alpha_composite(content, (dest_x, dest_y))
    return fitted


def remove_small_opaque_components(cell: Image.Image, min_pixels: int) -> None:
    for component in collect_opaque_components(cell):
        if len(component) < min_pixels:
            pixels = cell.load()
            for cx, cy in component:
                r, g, b, _ = pixels[cx, cy]
                pixels[cx, cy] = (r, g, b, 0)


def keep_largest_opaque_component(cell: Image.Image) -> Image.Image:
    components = collect_opaque_components(cell)
    kept = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    if not components:
        return kept

    largest = max(components, key=len)
    pixels = cell.load()
    kept_pixels = kept.load()
    for x, y in largest:
        kept_pixels[x, y] = pixels[x, y]
    return kept


def collect_opaque_components(cell: Image.Image) -> list[list[tuple[int, int]]]:
    pixels = cell.load()
    visited = [[False for _ in range(CELL_W)] for _ in range(CELL_H)]
    components: list[list[tuple[int, int]]] = []

    for y in range(CELL_H):
        for x in range(CELL_W):
            if visited[y][x] or pixels[x, y][3] <= 18:
                continue

            component: list[tuple[int, int]] = []
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y][x] = True
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < CELL_W and 0 <= ny < CELL_H and not visited[ny][nx] and pixels[nx, ny][3] > 18:
                        visited[ny][nx] = True
                        queue.append((nx, ny))

            components.append(component)
    return components


if __name__ == "__main__":
    normalize()

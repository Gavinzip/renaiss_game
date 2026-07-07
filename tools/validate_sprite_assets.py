#!/usr/bin/env python3
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"

EDGE_MARGIN = 2
CHROMA_LIMIT = 18
WARRIOR_STRIKE_MARGIN = 8
SKILL_ICON_EDGE_MARGIN = 5
SKILL_ICON_MIN_OPAQUE = 520
ATTACK_MIRROR_MAX_DIFF = 160
ATTACK_DIRECTION_MIN_DIFF = 6000
VFX_MIN_ACTIVE_FRAMES = 3
VFX_MIN_ROW_OPAQUE = 80
MAGE_CLEAN_STORM_MAX_WHITE_RATIO = 0.28
MAGE_CLEAN_STORM_MIN_VIOLET_RATIO = 0.18
RPG_PET_COLUMNS = 18
RPG_PET_ROWS = 5
RPG_PET_FRAME = 128
RPG_PET_MIN_OPAQUE = 380
RPG_PET_MIN_QUANTIZED_COLORS = 180
RPG_PET_MIN_SOLID_COLORS = 1800
RPG_PET_MIN_DARK_OUTLINE_PIXELS = 45
RPG_PET_IDLE_MIN_MASK_DIFF = 500
RPG_PET_ANIMATION_MIN_ALPHA_DIFF = 400
RPG_PET_ANIMATION_MIN_IMAGE_DIFF = 1000
RPG_PET_MIN_SIGNATURE_PIXELS = 90
RPG_PET_GROUND_DECORATION_TOP = 96
RPG_PET_GROUND_DECORATION_MIN_WIDTH = 30
RPG_PET_GROUND_DECORATION_MAX_HEIGHT = 10
RPG_PET_GROUND_DECORATION_MIN_OPAQUE = 18
RPG_SKILL_VFX_COLUMNS = 16
RPG_SKILL_VFX_ROWS = 25
RPG_SKILL_VFX_FRAME_W = 160
RPG_SKILL_VFX_FRAME_H = 112
RPG_SKILL_VFX_MIN_ACTIVE_FRAMES = 6
RPG_SKILL_VFX_MIN_FRAME_OPAQUE = 20
RPG_SKILL_VFX_MIN_FRAME_MOTION = 480
RPG_SKILL_VFX_MIN_NEAREST_ROW_DIFF = 1800
RPG_PROJECTILE_COLUMNS = 10
RPG_PROJECTILE_ROWS = 5
RPG_PROJECTILE_FRAME_W = 96
RPG_PROJECTILE_FRAME_H = 56
RPG_PROJECTILE_MIN_ACTIVE_FRAMES = 8
RPG_PROJECTILE_MIN_FRAME_OPAQUE = 550
RPG_PROJECTILE_MAX_FRAME_OPAQUE = 3200
RPG_EXTERNAL_VFX_MANIFEST = ASSET_DIR / "rpg-external-vfx-manifest.json"
RPG_EXTERNAL_VFX_ASSET_VERSION = "2026-07-04-rpg-status-five-core-v1"
RPG_EXTERNAL_VFX_PACK_KEYS = ("impactPack", "projectilePack", "spellPack", "gigapackPack")
RPG_ELEMENTS = ("water", "fire", "grass", "dark", "light")
RPG_STATUSES = ("burn", "poison", "stun", "guard", "regen")
RPG_STATUS_SPELL_SOURCES = {
    "burn": "Spritesheet/Flameburst.png",
    "stun": "Spritesheet/Thunder Charge.png",
    "regen": "Spritesheet/Poison Spores.png",
}
RPG_SKILL_STYLES = (
    "strike", "projectile", "projectile", "aura", "aura",
    "burst", "wave", "beam", "field", "strike",
    "strike", "rain", "burst", "field", "aura",
    "beam", "field", "aura", "strike", "field",
    "beam", "rain", "field", "burst", "summon",
)
RPG_GIGAPACK_SEQUENCE_ROWS = (5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24)
RPG_SPELL_SEQUENCE_ROW_KEYS = {
    ("water", 6), ("water", 20), ("water", 21), ("water", 22), ("water", 23), ("water", 24),
    ("fire", 20), ("fire", 21), ("fire", 23),
    ("grass", 17), ("grass", 20), ("grass", 21), ("grass", 22), ("grass", 24),
    ("dark", 8), ("dark", 11), ("dark", 13), ("dark", 17), ("dark", 20), ("dark", 23),
    ("light", 20), ("light", 21), ("light", 22), ("light", 23), ("light", 24),
}
RPG_STATUS_VFX_COLUMNS = 12
RPG_STATUS_VFX_ROWS = 5
RPG_STATUS_VFX_FRAME_W = 96
RPG_STATUS_VFX_FRAME_H = 96
RPG_STATUS_VFX_MIN_ACTIVE_FRAMES = 8
RPG_STATUS_VFX_MIN_FRAME_OPAQUE = 120
RPG_STATUS_VFX_MIN_FRAME_MOTION = 90
RPG_STATUS_VFX_MIN_NEAREST_ROW_DIFF = 1500
RPG_STATUS_VFX_EDGE_MARGIN = 2
SKILL_ICON_SOURCE_SCRIPT = ROOT / "tools" / "generate_skill_icons.py"


@dataclass(frozen=True)
class SheetSpec:
    path: Path
    columns: int
    rows: int
    label: str


SPECS = [
    SheetSpec(ASSET_DIR / "warrior-attack-sprites.png", 3, 4, "warrior-attack"),
    SheetSpec(ASSET_DIR / "archer-attack-sprites.png", 3, 4, "archer-attack"),
    SheetSpec(ASSET_DIR / "engineer-action-sprites.png", 3, 4, "engineer-action"),
    SheetSpec(ASSET_DIR / "mage-attack-sprites.png", 3, 4, "mage-attack"),
]
VFX_SPECS = [
    SheetSpec(ASSET_DIR / "skill-effects.png", 12, 6, "skill-effects"),
    SheetSpec(ASSET_DIR / "status-effects.png", 12, 4, "status-effects"),
    SheetSpec(ASSET_DIR / "ability-effects.png", 12, 10, "ability-effects"),
    SheetSpec(ASSET_DIR / "warrior-archer-effects.png", 12, 6, "warrior-archer-effects"),
    SheetSpec(ASSET_DIR / "engineer-effects.png", 12, 3, "engineer-effects"),
    SheetSpec(ASSET_DIR / "mage-effects.png", 20, 2, "mage-effects"),
    SheetSpec(ASSET_DIR / "combat-effects.png", 12, 9, "combat-effects"),
]
VFX_ACTIVE_ROWS: dict[str, tuple[int, ...]] = {
    "skill-effects": (1, 2, 3),
    "status-effects": (1, 2, 3),
}
SKILL_ICON_SPEC = SheetSpec(ASSET_DIR / "skill-icons.png", 4, 4, "skill-icons")
RPG_PET_SPEC = SheetSpec(ASSET_DIR / "rpg-pet-sprites.png", RPG_PET_COLUMNS, RPG_PET_ROWS, "rpg-pet-sprites")
RPG_PET_SIGNATURE_REGIONS = {
    "water": (
        (18, 16, 60, 66, "water left fin"),
        (80, 24, 116, 74, "water right fin"),
    ),
    "fire": (
        (26, 8, 78, 62, "fire back flames"),
        (82, 28, 116, 84, "fire side flame"),
    ),
    "grass": (
        (28, 8, 62, 58, "grass left antler"),
        (76, 8, 110, 58, "grass right antler"),
    ),
    "dark": (
        (56, 6, 116, 64, "dark crescent"),
        (18, 48, 74, 104, "dark smoke"),
    ),
    "light": (
        (12, 42, 56, 100, "light left wing"),
        (84, 38, 124, 100, "light right wing"),
    ),
}
RPG_BATTLE_ARENA_PATH = ASSET_DIR / "rpg-battle-arena.png"
RPG_BATTLE_ARENA_SIZE = (1600, 900)
RPG_SKILL_VFX_SPECS = [
    SheetSpec(ASSET_DIR / "rpg-skill-vfx-water.png", RPG_SKILL_VFX_COLUMNS, RPG_SKILL_VFX_ROWS, "rpg-skill-vfx-water"),
    SheetSpec(ASSET_DIR / "rpg-skill-vfx-fire.png", RPG_SKILL_VFX_COLUMNS, RPG_SKILL_VFX_ROWS, "rpg-skill-vfx-fire"),
    SheetSpec(ASSET_DIR / "rpg-skill-vfx-grass.png", RPG_SKILL_VFX_COLUMNS, RPG_SKILL_VFX_ROWS, "rpg-skill-vfx-grass"),
    SheetSpec(ASSET_DIR / "rpg-skill-vfx-dark.png", RPG_SKILL_VFX_COLUMNS, RPG_SKILL_VFX_ROWS, "rpg-skill-vfx-dark"),
    SheetSpec(ASSET_DIR / "rpg-skill-vfx-light.png", RPG_SKILL_VFX_COLUMNS, RPG_SKILL_VFX_ROWS, "rpg-skill-vfx-light"),
]
RPG_PROJECTILE_SPEC = SheetSpec(ASSET_DIR / "rpg-skill-projectiles.png", RPG_PROJECTILE_COLUMNS, RPG_PROJECTILE_ROWS, "rpg-skill-projectiles")
RPG_STATUS_VFX_SPEC = SheetSpec(ASSET_DIR / "rpg-status-vfx.png", RPG_STATUS_VFX_COLUMNS, RPG_STATUS_VFX_ROWS, "rpg-status-vfx")

CLASS_FRAME_X = [55, 222, 392, 562, 724, 892, 1058, 1228]
CLASS_ROWS = {
    "warrior": 36,
    "archer": 276,
    "engineer": 516,
    "mage": 748,
}
CLASS_CELL_W = 165
CLASS_CELL_H = 194
MAGE_SOURCE_TOP_EXPAND = 38
MAGE_EXPANDED_SOURCE_FRAMES = (3, 4, 5, 6, 7)
MAGE_REPAIRED_TOP_MAX_BY_FRAME = {
    3: 30,
    4: 30,
    5: 30,
    6: 30,
    7: 38,
}
MAGE_SIDE_BODY_ROI = (46, 102, 88, 170)
MAGE_SIDE_BODY_MIN_OPAQUE = 620
MAGE_SIDE_MAX_DETACHED_COMPONENT = 120


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()


def is_chroma_green(r: int, g: int, b: int, a: int) -> bool:
    return a > 18 and g > 170 and r < 120 and b < 140 and saturation(r, g, b) > 0.52


def is_chroma_magenta(r: int, g: int, b: int, a: int) -> bool:
    return a > 18 and r > 170 and b > 150 and g < 95 and saturation(r, g, b) > 0.45


def is_source_green(r: int, g: int, b: int, a: int) -> bool:
    return a > 18 and g > 132 and g > r + 34 and g > b + 34 and saturation(r, g, b) > 0.32


def is_archer_background_green(r: int, g: int, b: int, a: int) -> bool:
    return a > 18 and g > 82 and r < 72 and b < 46 and g > r + 44 and g > b + 48


def is_archer_bow_hole_green(r: int, g: int, b: int, a: int) -> bool:
    return a > 18 and g > 155 and r < 76 and g > r + 30 and g > b + 22 and b < 92 and saturation(r, g, b) > 0.34


def engineer_green_artifact_count(image: Image.Image) -> int:
    pixels = image.convert("RGBA").load()
    width, height = image.size
    count = 0

    def near_clear(x: int, y: int) -> bool:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                nx = x + dx
                ny = y + dy
                if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny][3] <= 18:
                    return True
        return False

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a <= 18:
                continue

            bright_chroma = g > 125 and g > r + 22 and g > b + 28 and b < 140
            edge_spill = g > 55 and g > r + 14 and g > b + 8 and b < 140 and near_clear(x, y)
            if bright_chroma or edge_spill:
                count += 1

    return count


def saturation(r: int, g: int, b: int) -> float:
    high = max(r, g, b)
    low = min(r, g, b)
    return 0 if high == 0 else (high - low) / high


def chroma_residue_count(image: Image.Image) -> int:
    pixels = image.convert("RGBA").getdata()
    return sum(1 for r, g, b, a in pixels if is_chroma_green(r, g, b, a) or is_chroma_magenta(r, g, b, a))


def opaque_pixel_count(image: Image.Image) -> int:
    return sum(1 for _r, _g, _b, a in image.convert("RGBA").getdata() if a > 18)


def quantized_palette_count(image: Image.Image, alpha_threshold: int = 80, bucket: int = 16) -> int:
    return len({(r // bucket, g // bucket, b // bucket) for r, g, b, a in image.convert("RGBA").getdata() if a > alpha_threshold})


def solid_palette_count(image: Image.Image, alpha_threshold: int = 180) -> int:
    return len({(r, g, b) for r, g, b, a in image.convert("RGBA").getdata() if a > alpha_threshold})


def dark_outline_pixel_count(image: Image.Image) -> int:
    def is_outline(r: int, g: int, b: int, a: int) -> bool:
        if a <= 120:
            return False
        near_black = r + g + b < 95
        warm_brown = r < 175 and g < 145 and b < 115 and r >= g >= b and r - b > 25
        return near_black or warm_brown

    return sum(1 for r, g, b, a in image.convert("RGBA").getdata() if is_outline(r, g, b, a))


def pet_signature_pixel_count(element: str, image: Image.Image) -> int:
    def is_signature(r: int, g: int, b: int, a: int) -> bool:
        if a <= 80:
            return False
        if element == "water":
            return b > 130 and g > 120 and b >= r + 35
        if element == "fire":
            return r > 180 and 55 < g < 230 and b < 110
        if element == "grass":
            return g > 120 and r > 70 and b < 130 and g >= b + 30
        if element == "dark":
            return b > 105 and r > 55 and g < 165 and b >= g + 5
        return r > 205 and g > 175 and b > 110 and r >= g and g >= b - 10

    return sum(1 for r, g, b, a in image.convert("RGBA").getdata() if is_signature(r, g, b, a))


def alpha_mask(image: Image.Image) -> Image.Image:
    return image.getchannel("A").point(lambda value: 255 if value > 18 else 0)


def alpha_mask_diff_pixels(a: Image.Image, b: Image.Image) -> int:
    diff = ImageChops.difference(alpha_mask(a), alpha_mask(b))
    return sum(1 for value in diff.getdata() if value > 0)


def sprite_frames_have_motion(frames: Iterable[Image.Image]) -> bool:
    sequence = list(frames)
    if len(sequence) < 2:
        return False

    first = sequence[0]
    return any(
        alpha_mask_diff_pixels(first, frame) >= RPG_PET_ANIMATION_MIN_ALPHA_DIFF
        or image_diff_score(first, frame) >= RPG_PET_ANIMATION_MIN_IMAGE_DIFF
        for frame in sequence[1:]
    )


def alpha_connected_components(image: Image.Image, threshold: int = 18) -> list[tuple[int, int, int, int, int]]:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited = bytearray(width * height)
    components: list[tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y][3] <= threshold:
                continue

            stack = [(x, y)]
            visited[index] = 1
            count = 0
            left = right = x
            top = bottom = y

            while stack:
                cx, cy = stack.pop()
                count += 1
                left = min(left, cx)
                right = max(right, cx)
                top = min(top, cy)
                bottom = max(bottom, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    neighbor_index = ny * width + nx
                    if visited[neighbor_index] or pixels[nx, ny][3] <= threshold:
                        continue
                    visited[neighbor_index] = 1
                    stack.append((nx, ny))

            components.append((count, left, top, right + 1, bottom + 1))

    return components


def pet_ground_decoration_errors(frame_label: str, image: Image.Image) -> list[str]:
    errors: list[str] = []
    for opaque, left, top, right, bottom in alpha_connected_components(image):
        width = right - left
        height = bottom - top
        if (
            top >= RPG_PET_GROUND_DECORATION_TOP
            and width >= RPG_PET_GROUND_DECORATION_MIN_WIDTH
            and height <= RPG_PET_GROUND_DECORATION_MAX_HEIGHT
            and opaque >= RPG_PET_GROUND_DECORATION_MIN_OPAQUE
        ):
            errors.append(
                f"{RPG_PET_SPEC.label} {frame_label}: detached ground decoration detected "
                f"({width}x{height}, {opaque} opaque pixels at {left},{top})"
            )
    return errors


def image_diff_score(a: Image.Image, b: Image.Image) -> int:
    diff = ImageChops.difference(a.convert("RGBA"), b.convert("RGBA"))
    return round(sum(sum(pixel) for pixel in diff.getdata()) / 255)


def archer_background_artifact_count(image: Image.Image) -> int:
    pixels = image.convert("RGBA").getdata()
    return sum(1 for r, g, b, a in pixels if is_archer_background_green(r, g, b, a))


def archer_roi_artifact_count(image: Image.Image, rois: list[tuple[int, int, int, int]]) -> int:
    pixels = image.convert("RGBA").load()
    count = 0
    for left, top, right, bottom in rois:
        for y in range(top, min(bottom, image.height)):
            for x in range(left, min(right, image.width)):
                if is_archer_bow_hole_green(*pixels[x, y]):
                    count += 1
    return count


def edge_errors(label: str, frame_label: str, image: Image.Image) -> list[str]:
    box = alpha_bbox(image)
    if not box:
        return [f"{label} {frame_label}: empty frame"]

    left, top, right, bottom = box
    errors = []
    if left < EDGE_MARGIN:
        errors.append(f"{label} {frame_label}: content too close to left edge ({left}px)")
    if top < EDGE_MARGIN:
        errors.append(f"{label} {frame_label}: content too close to top edge ({top}px)")
    if image.width - right < EDGE_MARGIN:
        errors.append(f"{label} {frame_label}: content too close to right edge ({image.width - right}px)")
    if image.height - bottom < EDGE_MARGIN:
        errors.append(f"{label} {frame_label}: content too close to bottom edge ({image.height - bottom}px)")

    residue = chroma_residue_count(image)
    if residue > CHROMA_LIMIT:
        errors.append(f"{label} {frame_label}: chroma residue too high ({residue} pixels)")
    return errors


def bbox_margins(image: Image.Image) -> tuple[int, int, int, int] | None:
    box = alpha_bbox(image)
    if not box:
        return None

    left, top, right, bottom = box
    return left, top, image.width - right, image.height - bottom


def iter_grid_frames(spec: SheetSpec) -> Iterable[tuple[str, Image.Image]]:
    sheet = Image.open(spec.path).convert("RGBA")
    cell_w = sheet.width // spec.columns
    cell_h = sheet.height // spec.rows
    for row in range(spec.rows):
        for column in range(spec.columns):
            yield f"r{row}c{column}", sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))


def validate_class_sprites() -> list[str]:
    path = ASSET_DIR / "class-sprites.png"
    sheet = Image.open(path).convert("RGBA")
    errors: list[str] = []
    for class_id, row_y in CLASS_ROWS.items():
        for frame, x in enumerate(CLASS_FRAME_X):
            cell = sheet.crop((x, row_y, x + CLASS_CELL_W, row_y + CLASS_CELL_H))
            errors.extend(edge_errors("class-sprites", f"{class_id}-{frame}", cell))
            if class_id == "archer":
                artifact_count = archer_background_artifact_count(cell)
                if artifact_count > 8:
                    errors.append(f"class-sprites archer-{frame}: archer background green artifacts too high ({artifact_count} pixels)")
                roi_artifact_count = archer_roi_artifact_count(
                    cell,
                    {
                        5: [(70, 102, 94, 152)],
                        6: [(70, 104, 108, 142)],
                        7: [(82, 68, 132, 158)]
                    }.get(frame, [])
                )
                if roi_artifact_count > 4:
                    errors.append(f"class-sprites archer-{frame}: bow-hole green artifacts too high ({roi_artifact_count} pixels)")
            if class_id == "engineer":
                artifact_count = engineer_green_artifact_count(cell)
                if artifact_count > 6:
                    errors.append(f"class-sprites engineer-{frame}: engineer green artifacts too high ({artifact_count} pixels)")
            if class_id == "mage" and frame in MAGE_EXPANDED_SOURCE_FRAMES:
                box = alpha_bbox(cell)
                if not box:
                    continue
                _left, top, _right, _bottom = box
                top_max = MAGE_REPAIRED_TOP_MAX_BY_FRAME[frame]
                if top > top_max:
                    errors.append(f"class-sprites mage-{frame}: repaired top margin too low ({top}px)")
                if frame in (4, 5, 6):
                    left, roi_top, right, roi_bottom = MAGE_SIDE_BODY_ROI
                    body_crop = cell.crop((left, roi_top, right, roi_bottom))
                    opaque = sum(1 for _r, _g, _b, a in body_crop.getdata() if a > 18)
                    if opaque < MAGE_SIDE_BODY_MIN_OPAQUE:
                        errors.append(
                            f"class-sprites mage-{frame}: side robe/body coverage too low "
                            f"({opaque} opaque pixels, expected {MAGE_SIDE_BODY_MIN_OPAQUE})"
                        )
                    components = sorted(alpha_connected_components(cell), reverse=True)
                    if len(components) > 1 and components[1][0] > MAGE_SIDE_MAX_DETACHED_COMPONENT:
                        count, left, top, right, bottom = components[1]
                        errors.append(
                            f"class-sprites mage-{frame}: detached side-walk component too large "
                            f"({count} opaque pixels at {left},{top},{right},{bottom})"
                        )
    return errors


def validate_mage_source_crop_coverage() -> list[str]:
    path = ROOT / "tools" / "assets" / "generated-sources" / "class-sprites-source.png"
    if not path.exists():
        return [f"class-sprites-source: missing required source {path}"]

    source = Image.open(path).convert("RGBA")
    errors: list[str] = []
    row_y = CLASS_ROWS["mage"]
    for frame in MAGE_EXPANDED_SOURCE_FRAMES:
        x = CLASS_FRAME_X[frame]
        crop = source.crop((x, row_y - MAGE_SOURCE_TOP_EXPAND, x + CLASS_CELL_W, row_y + CLASS_CELL_H))
        pixels = crop.load()
        non_green_top = 0
        for px in range(CLASS_CELL_W):
            r, g, b, a = pixels[px, 0]
            if a > 18 and not is_source_green(r, g, b, a):
                non_green_top += 1
        if non_green_top:
            errors.append(f"class-sprites-source mage-{frame}: expanded crop still touches top art ({non_green_top} pixels)")
    return errors


def validate_grid_sheet(spec: SheetSpec) -> list[str]:
    if not spec.path.exists():
        return [f"{spec.label}: missing {spec.path}"]

    errors: list[str] = []
    for frame_label, image in iter_grid_frames(spec):
        errors.extend(edge_errors(spec.label, frame_label, image))
        if spec.label == "archer-attack":
            artifact_count = archer_background_artifact_count(image)
            if artifact_count > 8:
                errors.append(f"{spec.label} {frame_label}: archer background green artifacts too high ({artifact_count} pixels)")
            roi_artifact_count = archer_roi_artifact_count(
                image,
                {
                    "r0c1": [(82, 68, 132, 158)],
                    "r2c1": [(33, 68, 83, 158)]
                }.get(frame_label, [])
            )
            if roi_artifact_count > 4:
                errors.append(f"{spec.label} {frame_label}: bow-hole green artifacts too high ({roi_artifact_count} pixels)")
        if spec.label == "engineer-action":
            artifact_count = engineer_green_artifact_count(image)
            if artifact_count > 6:
                errors.append(f"{spec.label} {frame_label}: engineer green artifacts too high ({artifact_count} pixels)")
    return errors


def validate_warrior_attack_strikes() -> list[str]:
    spec = SPECS[0]
    errors: list[str] = []
    strike_frames = {
        "right strike": (0, 1),
        "left strike": (2, 1)
    }
    sheet = Image.open(spec.path).convert("RGBA")
    cell_w = sheet.width // spec.columns
    cell_h = sheet.height // spec.rows
    for label, (row, column) in strike_frames.items():
        frame = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
        margins = bbox_margins(frame)
        if not margins:
            errors.append(f"warrior-attack {label}: empty frame")
            continue
        left, _top, right, _bottom = margins
        if left < WARRIOR_STRIKE_MARGIN or right < WARRIOR_STRIKE_MARGIN:
            errors.append(
                f"warrior-attack {label}: strike needs at least {WARRIOR_STRIKE_MARGIN}px horizontal margin "
                f"(left {left}px, right {right}px)"
            )
    return errors


def validate_attack_direction_rows() -> list[str]:
    errors: list[str] = []
    for spec in SPECS:
        sheet = Image.open(spec.path).convert("RGBA")
        cell_w = sheet.width // spec.columns
        cell_h = sheet.height // spec.rows
        if spec.columns != 3 or spec.rows != 4:
            errors.append(f"{spec.label}: expected 3x4 attack direction grid, got {spec.columns}x{spec.rows}")
            continue

        for column in range(spec.columns):
            right = sheet.crop((column * cell_w, 0, (column + 1) * cell_w, cell_h))
            left = sheet.crop((column * cell_w, 2 * cell_h, (column + 1) * cell_w, 3 * cell_h))
            mirror_score = image_diff_score(right, ImageOps.mirror(left))
            if mirror_score > ATTACK_MIRROR_MAX_DIFF:
                errors.append(
                    f"{spec.label} frame {column}: right/left rows are not mirrored "
                    f"(diff {mirror_score}, max {ATTACK_MIRROR_MAX_DIFF})"
                )

            for row, direction in ((1, "down"), (3, "up")):
                directional = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
                side_diff = image_diff_score(directional, right)
                if side_diff < ATTACK_DIRECTION_MIN_DIFF:
                    errors.append(
                        f"{spec.label} {direction} frame {column}: direction row looks copied from right row "
                        f"(diff {side_diff}, min {ATTACK_DIRECTION_MIN_DIFF})"
                    )
    return errors


def validate_vfx_sheets() -> list[str]:
    errors: list[str] = []
    for spec in VFX_SPECS:
        if not spec.path.exists():
            errors.append(f"{spec.label}: missing {spec.path}")
            continue

        sheet = Image.open(spec.path).convert("RGBA")
        if sheet.width % spec.columns != 0 or sheet.height % spec.rows != 0:
            errors.append(f"{spec.label}: size {sheet.width}x{sheet.height} is not divisible by {spec.columns}x{spec.rows}")
            continue

        cell_w = sheet.width // spec.columns
        cell_h = sheet.height // spec.rows
        active_rows = VFX_ACTIVE_ROWS.get(spec.label, tuple(range(spec.rows)))
        for row in active_rows:
            counts = []
            for column in range(spec.columns):
                frame = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
                counts.append(opaque_pixel_count(frame))

            active_frames = sum(1 for count in counts if count >= VFX_MIN_ROW_OPAQUE)
            if active_frames < VFX_MIN_ACTIVE_FRAMES:
                errors.append(
                    f"{spec.label} row {row}: too few active frames "
                    f"({active_frames}, min {VFX_MIN_ACTIVE_FRAMES}; max opaque {max(counts) if counts else 0})"
                )
            if spec.label == "mage-effects" and row == 1:
                errors.extend(validate_mage_clean_storm_row(sheet, cell_w, cell_h))
    return errors


def validate_mage_clean_storm_row(sheet: Image.Image, cell_w: int, cell_h: int) -> list[str]:
    errors: list[str] = []
    white = 0
    violet = 0
    opaque = 0
    for column in range(20):
        frame = sheet.crop((column * cell_w, cell_h, (column + 1) * cell_w, 2 * cell_h))
        for r, g, b, a in frame.convert("RGBA").getdata():
            if a <= 80:
                continue
            opaque += 1
            sat = saturation(r, g, b)
            if r > 210 and g > 210 and b > 210 and sat < 0.16:
                white += 1
            if b > 130 and r > 80 and b >= g + 18:
                violet += 1

    if opaque == 0:
        errors.append("mage-effects row 1: Clean Storm row is empty")
        return errors

    white_ratio = white / opaque
    violet_ratio = violet / opaque
    if white_ratio > MAGE_CLEAN_STORM_MAX_WHITE_RATIO:
        errors.append(
            f"mage-effects row 1: Clean Storm reads as a white splatter "
            f"({white_ratio:.0%} white pixels, max {MAGE_CLEAN_STORM_MAX_WHITE_RATIO:.0%})"
        )
    if violet_ratio < MAGE_CLEAN_STORM_MIN_VIOLET_RATIO:
        errors.append(
            f"mage-effects row 1: Clean Storm needs a stronger violet mage palette "
            f"({violet_ratio:.0%} violet pixels, min {MAGE_CLEAN_STORM_MIN_VIOLET_RATIO:.0%})"
        )
    return errors


def validate_skill_icons() -> list[str]:
    if not SKILL_ICON_SPEC.path.exists():
        return [f"{SKILL_ICON_SPEC.label}: missing {SKILL_ICON_SPEC.path}"]

    sheet = Image.open(SKILL_ICON_SPEC.path).convert("RGBA")
    errors: list[str] = []
    expected_size = (64 * SKILL_ICON_SPEC.columns, 64 * SKILL_ICON_SPEC.rows)
    if sheet.size != expected_size:
        errors.append(f"{SKILL_ICON_SPEC.label}: expected {expected_size[0]}x{expected_size[1]}, got {sheet.width}x{sheet.height}")
        return errors

    for frame_label, image in iter_grid_frames(SKILL_ICON_SPEC):
        box = alpha_bbox(image)
        if not box:
            errors.append(f"{SKILL_ICON_SPEC.label} {frame_label}: empty icon")
            continue

        left, top, right, bottom = box
        margins = (left, top, image.width - right, image.height - bottom)
        if min(margins) < SKILL_ICON_EDGE_MARGIN:
            errors.append(f"{SKILL_ICON_SPEC.label} {frame_label}: content too close to edge {margins}")

        opaque = sum(1 for _r, _g, _b, a in image.getdata() if a > 18)
        if opaque < SKILL_ICON_MIN_OPAQUE:
            errors.append(f"{SKILL_ICON_SPEC.label} {frame_label}: icon too sparse ({opaque} opaque pixels)")

    return errors


def validate_skill_icon_source_contract() -> list[str]:
    if not SKILL_ICON_SOURCE_SCRIPT.exists():
        return [f"skill-icons source contract: missing {SKILL_ICON_SOURCE_SCRIPT}"]

    source = SKILL_ICON_SOURCE_SCRIPT.read_text(encoding="utf-8")
    required = {
        "warrior justice charge icon": 'IconSource("combat", "23"',
        "warrior attack icon": 'IconSource("combat", "25"',
        "archer forest roll icon": "spell_haste_001_large_green",
        "archer root bind icon": "spell_poison_001_large_green",
        "archer seed rain icon": "Splatters/burst_splatter_003/burst_splatter_003_large_green",
        "engineer auto turret icon": "scifi_warp_003_large_blue",
        "engineer repulsor pulse icon": "symmetrical_impact_002_large_blue",
        "engineer attack icon": 'IconSource("spells", "Fire Hit"',
        "mage solar beam icon": 'IconSource("spells", "Energy Pillar"',
        "mage basic orb icon": 'IconSource("spells", "Blue Orb"',
    }
    forbidden = {
        "old warrior flat spear icon": 'IconSource("spells", "Solar Spear"',
        "old warrior sparse current icon": 'IconSource("spells", "Energy Current"',
        "old warrior thin slash": 'IconSource("combat", "17"',
        "old archer sand roll icon": 'IconSource("spells", "Sand Vortex"',
        "old archer sparse root icon": 'IconSource("spells", "Poison Spores"',
        "old archer bubble seed rain icon": "round_sparkle_burst_002",
        "old archer seed-diamond icon": "Free/Part 15/700.png#3",
        "old generated turret icon": 'IconSource("generated", "turretHead"',
        "old engineer muzzle flash icon": "scifi_muzzle_flash_001_large_yellow",
        "old generated engineer attack icon": 'IconSource("generated", "hitSpark"',
        "old sparse engineer spark icon": "scifi_spark_burst_001_large_yellow",
        "old sparse combat engineer spark icon": 'IconSource("combat", "6"',
        "old engineer sparse attack icon": 'IconSource("spells", "Ion Strike"',
        "old mage thin solar icon": 'IconSource("spells", "Celestial Beam"',
        "old mage sparse solar icon": 'IconSource("spells", "Spark"',
        "old plain arcane orb icon": 'IconSource("spells", "Arcane Orb"',
        "old generated mage orb icon": 'IconSource("generated", "magicOrb"',
    }

    errors: list[str] = []
    for label, needle in required.items():
        if needle not in source:
            errors.append(f"skill-icons source contract: missing {label} ({needle})")
    for label, needle in forbidden.items():
        if needle in source:
            errors.append(f"skill-icons source contract: still uses {label} ({needle})")
    return errors


def validate_rpg_pet_sprites() -> list[str]:
    if not RPG_PET_SPEC.path.exists():
        return [f"{RPG_PET_SPEC.label}: missing {RPG_PET_SPEC.path}"]

    sheet = Image.open(RPG_PET_SPEC.path).convert("RGBA")
    errors: list[str] = []
    expected_size = (RPG_PET_FRAME * RPG_PET_COLUMNS, RPG_PET_FRAME * RPG_PET_ROWS)
    if sheet.size != expected_size:
        errors.append(f"{RPG_PET_SPEC.label}: expected {expected_size[0]}x{expected_size[1]}, got {sheet.width}x{sheet.height}")
        return errors

    cell_w = sheet.width // RPG_PET_COLUMNS
    cell_h = sheet.height // RPG_PET_ROWS
    idle_frames: list[Image.Image] = []
    pet_elements = ("water", "fire", "grass", "dark", "light")
    for row in range(RPG_PET_ROWS):
        row_counts: list[int] = []
        row_frames: list[Image.Image] = []
        for column in range(RPG_PET_COLUMNS):
            frame = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
            row_frames.append(frame)
            opaque = opaque_pixel_count(frame)
            row_counts.append(opaque)
            if opaque < RPG_PET_MIN_OPAQUE:
                errors.append(f"{RPG_PET_SPEC.label} r{row}c{column}: frame too sparse ({opaque} opaque pixels)")

            errors.extend(pet_ground_decoration_errors(f"r{row}c{column}", frame))

            quantized_colors = quantized_palette_count(frame)
            if quantized_colors < RPG_PET_MIN_QUANTIZED_COLORS:
                errors.append(f"{RPG_PET_SPEC.label} r{row}c{column}: palette too flat ({quantized_colors} quantized colors)")

            solid_colors = solid_palette_count(frame)
            if solid_colors < RPG_PET_MIN_SOLID_COLORS:
                errors.append(f"{RPG_PET_SPEC.label} r{row}c{column}: sprite detail too low ({solid_colors} solid colors)")

            dark_outline = dark_outline_pixel_count(frame)
            if dark_outline < RPG_PET_MIN_DARK_OUTLINE_PIXELS:
                errors.append(f"{RPG_PET_SPEC.label} r{row}c{column}: dark pixel-art outline too weak ({dark_outline} pixels)")

            box = alpha_bbox(frame)
            if not box:
                errors.append(f"{RPG_PET_SPEC.label} r{row}c{column}: empty frame")
                continue

            left, top, right, _bottom = box
            margins = (left, top, frame.width - right)
            if min(margins) < EDGE_MARGIN:
                errors.append(f"{RPG_PET_SPEC.label} r{row}c{column}: content too close to side/top edge {margins}")

            if column == 0:
                idle_frames.append(frame)
                element = pet_elements[row]
                for left_region, top_region, right_region, bottom_region, region_label in RPG_PET_SIGNATURE_REGIONS[element]:
                    signature_crop = frame.crop((left_region, top_region, right_region, bottom_region))
                    signature_pixels = pet_signature_pixel_count(element, signature_crop)
                    if signature_pixels < RPG_PET_MIN_SIGNATURE_PIXELS:
                        errors.append(
                            f"{RPG_PET_SPEC.label} {element} {region_label}: signature silhouette too weak "
                            f"({signature_pixels} pixels, min {RPG_PET_MIN_SIGNATURE_PIXELS})"
                        )

        if not sprite_frames_have_motion(row_frames[:4]):
            errors.append(f"{RPG_PET_SPEC.label} row {row}: idle frames do not vary")
        if not sprite_frames_have_motion(row_frames[4:8]):
            errors.append(f"{RPG_PET_SPEC.label} row {row}: walk frames do not vary")

    for left in range(len(idle_frames)):
        for right in range(left + 1, len(idle_frames)):
            diff = alpha_mask_diff_pixels(idle_frames[left], idle_frames[right])
            if diff < RPG_PET_IDLE_MIN_MASK_DIFF:
                errors.append(f"{RPG_PET_SPEC.label}: idle silhouettes r{left}/r{right} too similar ({diff} differing alpha pixels)")

    return errors


def doubled_pixel_block_errors(image: Image.Image, label: str, sample_stride: int = 2) -> list[str]:
    pixels = image.convert("RGBA").load()
    errors: list[str] = []
    checked = 0
    mismatched = 0
    for y in range(0, image.height - 1, sample_stride):
        for x in range(0, image.width - 1, sample_stride):
            checked += 1
            base = pixels[x, y]
            if pixels[x + 1, y] != base or pixels[x, y + 1] != base or pixels[x + 1, y + 1] != base:
                mismatched += 1
                if mismatched > 64:
                    break
        if mismatched > 64:
            break
    if mismatched:
        errors.append(f"{label}: expected crisp 2x pixel blocks, found {mismatched} mismatched blocks out of {checked}")
    return errors


def color_count_in_region(image: Image.Image, box: tuple[int, int, int, int], predicate) -> int:
    crop = image.crop(box).convert("RGBA")
    return sum(1 for r, g, b, a in crop.getdata() if predicate(r, g, b, a))


def color_count_in_region_excluding(
    image: Image.Image,
    box: tuple[int, int, int, int],
    predicate,
    exclusions: tuple[tuple[int, int, int, int], ...],
) -> int:
    pixels = image.convert("RGBA").load()
    left, top, right, bottom = box
    count = 0
    for y in range(top, bottom):
        for x in range(left, right):
            if any(ex_left <= x < ex_right and ex_top <= y < ex_bottom for ex_left, ex_top, ex_right, ex_bottom in exclusions):
                continue
            if predicate(*pixels[x, y]):
                count += 1
    return count


def validate_rpg_battle_arena() -> list[str]:
    if not RPG_BATTLE_ARENA_PATH.exists():
        return [f"rpg-battle-arena: missing {RPG_BATTLE_ARENA_PATH}"]

    image = Image.open(RPG_BATTLE_ARENA_PATH).convert("RGBA")
    errors: list[str] = []
    if image.size != RPG_BATTLE_ARENA_SIZE:
        errors.append(f"rpg-battle-arena: expected {RPG_BATTLE_ARENA_SIZE[0]}x{RPG_BATTLE_ARENA_SIZE[1]}, got {image.width}x{image.height}")
        return errors

    if image.getchannel("A").getextrema() != (255, 255):
        errors.append("rpg-battle-arena: must be fully opaque so no browser layer shows through")

    errors.extend(doubled_pixel_block_errors(image, "rpg-battle-arena"))

    solid_colors = solid_palette_count(image)
    if solid_colors < 220:
        errors.append(f"rpg-battle-arena: scene detail too low ({solid_colors} solid colors)")

    marker_regions = (
        (770, 190, 830, 820),
        (120, 470, 1480, 530),
        (560, 300, 1040, 650),
    )
    baked_marker = lambda r, g, b, a: a == 255 and (
        (b > 145 and g > 110 and b > r + 45)
        or (r > 180 and 95 < g < 205 and b < 115 and r > b + 55)
        or (r > 165 and g > 120 and b < 120 and abs(r - g) < 75)
    )
    intentional_logo_regions: tuple[tuple[int, int, int, int], ...] = ()
    for index, region in enumerate(marker_regions):
        count = color_count_in_region_excluding(image, region, baked_marker, intentional_logo_regions)
        if count > 40:
            errors.append(f"rpg-battle-arena: baked slot/court marker still visible in region {index} ({count} pixels)")

    grass_frame_regions = (
        (0, 0, image.width, 92),
        (0, 812, image.width, image.height),
        (0, 92, 132, 812),
        (1468, 92, image.width, 812),
    )
    very_dark_grass_speckle = lambda r, g, b, a: a == 255 and r < 45 and g < 70 and b < 45
    speckle_count = sum(color_count_in_region(image, region, very_dark_grass_speckle) for region in grass_frame_regions)
    if speckle_count > 80:
        errors.append(f"rpg-battle-arena: grass frame has too many dark speckles ({speckle_count})")

    return errors


def validate_rpg_skill_vfx() -> list[str]:
    errors: list[str] = []
    expected_size = (RPG_SKILL_VFX_FRAME_W * RPG_SKILL_VFX_COLUMNS, RPG_SKILL_VFX_FRAME_H * RPG_SKILL_VFX_ROWS)
    for spec in RPG_SKILL_VFX_SPECS:
        if not spec.path.exists():
            errors.append(f"{spec.label}: missing {spec.path}")
            continue

        sheet = Image.open(spec.path).convert("RGBA")
        if sheet.size != expected_size:
            errors.append(f"{spec.label}: expected {expected_size[0]}x{expected_size[1]}, got {sheet.width}x{sheet.height}")
            continue

        row_images: list[Image.Image] = []
        for row in range(RPG_SKILL_VFX_ROWS):
            active_frames = 0
            row_opaque = 0
            row_frames: list[Image.Image] = []
            adjacent_diffs: list[int] = []
            row_images.append(
                sheet.crop(
                    (
                        0,
                        row * RPG_SKILL_VFX_FRAME_H,
                        RPG_SKILL_VFX_COLUMNS * RPG_SKILL_VFX_FRAME_W,
                        (row + 1) * RPG_SKILL_VFX_FRAME_H,
                    )
                )
            )
            for column in range(RPG_SKILL_VFX_COLUMNS):
                frame = sheet.crop(
                    (
                        column * RPG_SKILL_VFX_FRAME_W,
                        row * RPG_SKILL_VFX_FRAME_H,
                        (column + 1) * RPG_SKILL_VFX_FRAME_W,
                        (row + 1) * RPG_SKILL_VFX_FRAME_H,
                    )
                )
                opaque = opaque_pixel_count(frame)
                row_opaque += opaque
                if opaque >= RPG_SKILL_VFX_MIN_FRAME_OPAQUE:
                    active_frames += 1
                if row_frames:
                    adjacent_diffs.append(alpha_mask_diff_pixels(row_frames[-1], frame))
                row_frames.append(frame)

            if active_frames < RPG_SKILL_VFX_MIN_ACTIVE_FRAMES:
                errors.append(f"{spec.label} row {row}: only {active_frames} active frames")
            if row_opaque < RPG_SKILL_VFX_MIN_FRAME_OPAQUE * RPG_SKILL_VFX_MIN_ACTIVE_FRAMES:
                errors.append(f"{spec.label} row {row}: row too sparse ({row_opaque} opaque pixels)")
            if adjacent_diffs and max(adjacent_diffs) < RPG_SKILL_VFX_MIN_FRAME_MOTION:
                errors.append(
                    f"{spec.label} row {row}: VFX animation barely changes "
                    f"({max(adjacent_diffs)} alpha pixels, min {RPG_SKILL_VFX_MIN_FRAME_MOTION})"
                )

        for left in range(len(row_images)):
            nearest = min(
                alpha_mask_diff_pixels(row_images[left], row_images[right])
                for right in range(len(row_images))
                if right != left
            )
            if nearest < RPG_SKILL_VFX_MIN_NEAREST_ROW_DIFF:
                errors.append(
                    f"{spec.label} row {left}: VFX row too similar to another move "
                    f"({nearest} differing alpha pixels, min {RPG_SKILL_VFX_MIN_NEAREST_ROW_DIFF})"
                )

    return errors


def validate_rpg_projectiles() -> list[str]:
    if not RPG_PROJECTILE_SPEC.path.exists():
        return [f"{RPG_PROJECTILE_SPEC.label}: missing {RPG_PROJECTILE_SPEC.path}"]

    errors: list[str] = []
    sheet = Image.open(RPG_PROJECTILE_SPEC.path).convert("RGBA")
    expected_size = (RPG_PROJECTILE_FRAME_W * RPG_PROJECTILE_COLUMNS, RPG_PROJECTILE_FRAME_H * RPG_PROJECTILE_ROWS)
    if sheet.size != expected_size:
        errors.append(f"{RPG_PROJECTILE_SPEC.label}: expected {expected_size[0]}x{expected_size[1]}, got {sheet.width}x{sheet.height}")
        return errors

    for row in range(RPG_PROJECTILE_ROWS):
        active_frames = 0
        row_frames: list[Image.Image] = []
        adjacent_diffs: list[int] = []
        for column in range(RPG_PROJECTILE_COLUMNS):
            frame = sheet.crop(
                (
                    column * RPG_PROJECTILE_FRAME_W,
                    row * RPG_PROJECTILE_FRAME_H,
                    (column + 1) * RPG_PROJECTILE_FRAME_W,
                    (row + 1) * RPG_PROJECTILE_FRAME_H,
                )
            )
            opaque = opaque_pixel_count(frame)
            if opaque >= RPG_PROJECTILE_MIN_FRAME_OPAQUE:
                active_frames += 1
            if opaque < RPG_PROJECTILE_MIN_FRAME_OPAQUE:
                errors.append(f"{RPG_PROJECTILE_SPEC.label} r{row}c{column}: projectile too sparse ({opaque} opaque pixels)")
            if opaque > RPG_PROJECTILE_MAX_FRAME_OPAQUE:
                errors.append(f"{RPG_PROJECTILE_SPEC.label} r{row}c{column}: projectile too large for travel layer ({opaque} opaque pixels)")

            box = alpha_bbox(frame)
            if not box:
                errors.append(f"{RPG_PROJECTILE_SPEC.label} r{row}c{column}: empty projectile")
                continue
            left, top, right, bottom = box
            margins = (left, top, frame.width - right, frame.height - bottom)
            if min(margins) < EDGE_MARGIN:
                errors.append(f"{RPG_PROJECTILE_SPEC.label} r{row}c{column}: projectile too close to edge {margins}")

            if row_frames:
                adjacent_diffs.append(alpha_mask_diff_pixels(row_frames[-1], frame))
            row_frames.append(frame)

        if active_frames < RPG_PROJECTILE_MIN_ACTIVE_FRAMES:
            errors.append(f"{RPG_PROJECTILE_SPEC.label} row {row}: only {active_frames} active frames")

        if adjacent_diffs and max(adjacent_diffs) < 80:
            errors.append(f"{RPG_PROJECTILE_SPEC.label} row {row}: projectile animation barely changes ({max(adjacent_diffs)} alpha pixels)")

    return errors


def rpg_tier_for_row(row: int) -> str:
    if row >= 20:
        return "ultimate"
    if row >= 10:
        return "intermediate"
    return "basic"


def rpg_slot_for_row(row: int) -> int:
    if row >= 20:
        return row - 19
    if row >= 10:
        return row - 9
    return row + 1


def rpg_expected_primary_pack(element: str, row: int) -> str:
    if (element, row) in RPG_SPELL_SEQUENCE_ROW_KEYS:
        return "external-spellsfx-2"
    return "external-super-pixel-gigapack" if row in RPG_GIGAPACK_SEQUENCE_ROWS else "external-spellsfx-2"


def rpg_expected_status_pack(status: str) -> str:
    return "external-spellsfx-2" if status in RPG_STATUS_SPELL_SOURCES else "external-super-pixel-gigapack"


def validate_rpg_external_vfx_license(license_info: dict) -> list[str]:
    status = license_info.get("status")
    if status == "pending-commercial-proof":
        errors: list[str] = []
        for pack_key in RPG_EXTERNAL_VFX_PACK_KEYS:
            pack = license_info.get(pack_key, {})
            if not isinstance(pack, dict):
                errors.append(f"rpg-external-vfx-manifest: license.{pack_key} must be an object")
                continue
            pack_status = pack.get("licenseStatus")
            if pack_status not in {"pending-commercial-proof", "commercial-proof-confirmed"}:
                errors.append(
                    f"rpg-external-vfx-manifest: license.{pack_key}.licenseStatus must be "
                    f"pending-commercial-proof or commercial-proof-confirmed, got {pack_status}"
                )
            reference = pack.get("licenseReference", {})
            if not isinstance(reference, dict):
                errors.append(f"rpg-external-vfx-manifest: license.{pack_key}.licenseReference must be an object")
            else:
                for key in ("source", "reference", "checkedAt"):
                    if not reference.get(key):
                        errors.append(f"rpg-external-vfx-manifest: license.{pack_key}.licenseReference.{key} is required")
            if pack_status == "commercial-proof-confirmed":
                proof = pack.get("proof", {})
                if not isinstance(proof, dict):
                    errors.append(f"rpg-external-vfx-manifest: license.{pack_key}.proof must be an object")
                    continue
                for key in ("source", "reference", "checkedAt"):
                    if not proof.get(key):
                        errors.append(f"rpg-external-vfx-manifest: license.{pack_key}.commercial-proof-confirmed requires proof.{key}")
        return errors

    if status != "commercial-proof-confirmed":
        return [
            "rpg-external-vfx-manifest: external VFX license status must be "
            f"pending-commercial-proof or commercial-proof-confirmed, got {status}"
        ]

    proof = license_info.get("proof", {})
    errors: list[str] = []
    for key in ("source", "reference", "checkedAt"):
        if not proof.get(key):
            errors.append(f"rpg-external-vfx-manifest: commercial-proof-confirmed requires license.proof.{key}")
    for pack_key in RPG_EXTERNAL_VFX_PACK_KEYS:
        pack = license_info.get(pack_key, {})
        if not isinstance(pack, dict):
            errors.append(f"rpg-external-vfx-manifest: license.{pack_key} must be an object")
            continue
        if pack.get("licenseStatus") != "commercial-proof-confirmed":
            errors.append(
                f"rpg-external-vfx-manifest: license.{pack_key}.licenseStatus must be commercial-proof-confirmed "
                "when the top-level license is release-cleared"
            )
        pack_proof = pack.get("proof", {})
        if not isinstance(pack_proof, dict):
            errors.append(f"rpg-external-vfx-manifest: license.{pack_key}.proof must be an object")
            continue
        for key in ("source", "reference", "checkedAt"):
            if not pack_proof.get(key):
                errors.append(f"rpg-external-vfx-manifest: license.{pack_key}.proof.{key} is required")
    return errors


def validate_rpg_external_vfx_manifest() -> list[str]:
    if not RPG_EXTERNAL_VFX_MANIFEST.exists():
        return [f"rpg-external-vfx-manifest: missing {RPG_EXTERNAL_VFX_MANIFEST}"]

    try:
        manifest = json.loads(RPG_EXTERNAL_VFX_MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return [f"rpg-external-vfx-manifest: invalid JSON ({error})"]

    errors: list[str] = []
    if manifest.get("schemaVersion") != 1:
        errors.append(f"rpg-external-vfx-manifest: expected schemaVersion 1, got {manifest.get('schemaVersion')}")
    if manifest.get("assetVersion") != RPG_EXTERNAL_VFX_ASSET_VERSION:
        errors.append(
            "rpg-external-vfx-manifest: assetVersion mismatch "
            f"({manifest.get('assetVersion')} != {RPG_EXTERNAL_VFX_ASSET_VERSION})"
        )

    license_info = manifest.get("license", {})
    errors.extend(validate_rpg_external_vfx_license(license_info))

    runtime = manifest.get("runtimeSheets", {})
    impact = runtime.get("skillImpact", {})
    expected_impact_files = [spec.path.name for spec in RPG_SKILL_VFX_SPECS]
    if impact.get("files") != expected_impact_files:
        errors.append(f"rpg-external-vfx-manifest: skillImpact files mismatch {impact.get('files')}")
    for key, expected in (
        ("columns", RPG_SKILL_VFX_COLUMNS),
        ("rows", RPG_SKILL_VFX_ROWS),
        ("frameWidth", RPG_SKILL_VFX_FRAME_W),
        ("frameHeight", RPG_SKILL_VFX_FRAME_H),
    ):
        if impact.get(key) != expected:
            errors.append(f"rpg-external-vfx-manifest: skillImpact.{key} expected {expected}, got {impact.get(key)}")

    projectiles = runtime.get("projectiles", {})
    if projectiles.get("file") != RPG_PROJECTILE_SPEC.path.name:
        errors.append(f"rpg-external-vfx-manifest: projectiles.file mismatch {projectiles.get('file')}")
    for key, expected in (
        ("columns", RPG_PROJECTILE_COLUMNS),
        ("rows", RPG_PROJECTILE_ROWS),
        ("frameWidth", RPG_PROJECTILE_FRAME_W),
        ("frameHeight", RPG_PROJECTILE_FRAME_H),
    ):
        if projectiles.get(key) != expected:
            errors.append(f"rpg-external-vfx-manifest: projectiles.{key} expected {expected}, got {projectiles.get(key)}")

    selection_contract = manifest.get("selectionContract", {})
    if not isinstance(selection_contract, dict):
        errors.append("rpg-external-vfx-manifest: selectionContract must be an object")
        selection_contract = {}
    if selection_contract.get("runtimeComposition") != "one-primary-sequence-per-skill-row":
        errors.append(
            "rpg-external-vfx-manifest: selectionContract.runtimeComposition must be "
            "one-primary-sequence-per-skill-row"
        )
    if selection_contract.get("allowsPackLayering") is not False:
        errors.append("rpg-external-vfx-manifest: selectionContract.allowsPackLayering must be false")
    if selection_contract.get("moveRowsExposeOnlySelectedSources") is not True:
        errors.append("rpg-external-vfx-manifest: selectionContract.moveRowsExposeOnlySelectedSources must be true")
    if selection_contract.get("statusRowsArePersistentOverlays") is not True:
        errors.append("rpg-external-vfx-manifest: selectionContract.statusRowsArePersistentOverlays must be true")

    if "spellStyleSources" in manifest:
        errors.append("rpg-external-vfx-manifest: spellStyleSources must not be emitted; rows may only expose selectedSources")
    if "gigapackStyleSources" in manifest:
        errors.append("rpg-external-vfx-manifest: gigapackStyleSources must not be emitted; rows may only expose selectedSources")

    spell_sources = manifest.get("spellSources", [])
    if not isinstance(spell_sources, list) or not spell_sources:
        errors.append("rpg-external-vfx-manifest: spellSources must be a non-empty list")

    gigapack_sources = manifest.get("gigapackSources", [])
    if not isinstance(gigapack_sources, list) or not gigapack_sources:
        errors.append("rpg-external-vfx-manifest: gigapackSources must be a non-empty list")

    status_gigapack_sources = manifest.get("statusGigapackSources", [])
    if not isinstance(status_gigapack_sources, list) or not status_gigapack_sources:
        errors.append("rpg-external-vfx-manifest: statusGigapackSources must be a non-empty list")

    impact_sources = manifest.get("impactSources", [])
    if manifest.get("compositionMode") != "single-sequence-per-row":
        errors.append(f"rpg-external-vfx-manifest: expected compositionMode single-sequence-per-row, got {manifest.get('compositionMode')}")
    if not isinstance(impact_sources, list) or not impact_sources:
        errors.append("rpg-external-vfx-manifest: impactSources must be a non-empty list")
    else:
        spell_source_set = set(spell_sources) if isinstance(spell_sources, list) else set()
        gigapack_source_set = set(gigapack_sources) if isinstance(gigapack_sources, list) else set()
        if sorted(impact_sources) != sorted({*spell_source_set, *gigapack_source_set}):
            errors.append("rpg-external-vfx-manifest: impactSources must match only the top-level SpellsFX plus Gigapack selected-source catalog")

    element_rows = manifest.get("elementRows", {})
    if sorted(element_rows.keys()) != sorted(RPG_ELEMENTS):
        errors.append(f"rpg-external-vfx-manifest: elementRows keys mismatch {sorted(element_rows.keys())}")
    for row, element in enumerate(RPG_ELEMENTS):
        element_info = element_rows.get(element, {})
        if element_info.get("projectileRow") != row:
            errors.append(f"rpg-external-vfx-manifest: {element}.projectileRow expected {row}, got {element_info.get('projectileRow')}")
        if not str(element_info.get("projectileSource", "")).endswith(".png"):
            errors.append(f"rpg-external-vfx-manifest: {element}.projectileSource must point to a PNG")
        if not isinstance(element_info.get("impactColorRow"), int):
            errors.append(f"rpg-external-vfx-manifest: {element}.impactColorRow must be numeric")

    move_rows = manifest.get("moveRows", [])
    if len(move_rows) != RPG_SKILL_VFX_ROWS:
        errors.append(f"rpg-external-vfx-manifest: expected {RPG_SKILL_VFX_ROWS} moveRows, got {len(move_rows)}")
    for row, expected_style in enumerate(RPG_SKILL_STYLES):
        entry = move_rows[row] if row < len(move_rows) and isinstance(move_rows[row], dict) else {}
        if entry.get("row") != row:
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].row expected {row}, got {entry.get('row')}")
        if entry.get("tier") != rpg_tier_for_row(row):
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].tier mismatch {entry.get('tier')}")
        if entry.get("slot") != rpg_slot_for_row(row):
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].slot mismatch {entry.get('slot')}")
        if entry.get("style") != expected_style:
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].style expected {expected_style}, got {entry.get('style')}")
        if "spellSources" in entry:
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].spellSources must not be emitted; use selectedSources only")
        if "gigapackSources" in entry:
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].gigapackSources must not be emitted; use selectedSources only")
        selected_sources = entry.get("selectedSources")
        if not isinstance(selected_sources, dict):
            errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources must be an object")
        else:
            if sorted(selected_sources.keys()) != sorted(RPG_ELEMENTS):
                errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources keys mismatch {sorted(selected_sources.keys())}")
            for element in RPG_ELEMENTS:
                selected = selected_sources.get(element)
                if not isinstance(selected, dict):
                    errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources.{element} must be an object")
                    continue
                expected_pack = rpg_expected_primary_pack(element, row)
                if selected.get("pack") != expected_pack:
                    errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources.{element}.pack expected {expected_pack}, got {selected.get('pack')}")
                source = selected.get("source")
                if not isinstance(source, str) or not source:
                    errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources.{element}.source is required")
                elif expected_pack == "external-super-pixel-gigapack":
                    allowed = set(gigapack_sources) if isinstance(gigapack_sources, list) else set()
                    if source not in allowed:
                        errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources.{element}.source is not in the top-level Gigapack selected-source catalog")
                else:
                    allowed = set(spell_sources) if isinstance(spell_sources, list) else set()
                    if source not in allowed:
                        errors.append(f"rpg-external-vfx-manifest: moveRows[{row}].selectedSources.{element}.source is not in the top-level SpellsFX selected-source catalog")

    status_rows = manifest.get("statusRows", [])
    if not isinstance(status_rows, list) or len(status_rows) != len(RPG_STATUSES):
        errors.append(f"rpg-external-vfx-manifest: expected {len(RPG_STATUSES)} statusRows, got {len(status_rows) if isinstance(status_rows, list) else type(status_rows).__name__}")
    else:
        for row, status in enumerate(RPG_STATUSES):
            entry = status_rows[row] if isinstance(status_rows[row], dict) else {}
            if entry.get("row") != row:
                errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].row expected {row}, got {entry.get('row')}")
            if entry.get("status") != status:
                errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].status expected {status}, got {entry.get('status')}")
            expected_pack = rpg_expected_status_pack(status)
            if entry.get("pack") != expected_pack:
                errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].pack expected {expected_pack}, got {entry.get('pack')}")
            source = entry.get("source")
            if not isinstance(source, str) or not source:
                errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].source is required")
            elif expected_pack == "external-super-pixel-gigapack":
                if isinstance(status_gigapack_sources, list) and source not in set(status_gigapack_sources):
                    errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].source is not in statusGigapackSources")
            else:
                expected_source = RPG_STATUS_SPELL_SOURCES[status]
                if source != expected_source:
                    errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].source expected {expected_source}, got {source}")
                allowed = set(spell_sources) if isinstance(spell_sources, list) else set()
                if source not in allowed:
                    errors.append(f"rpg-external-vfx-manifest: statusRows[{row}].source is not in the top-level SpellsFX selected-source catalog")

    projectile_frames = manifest.get("projectileFrames", [])
    if len(projectile_frames) != RPG_PROJECTILE_COLUMNS:
        errors.append(f"rpg-external-vfx-manifest: expected {RPG_PROJECTILE_COLUMNS} projectileFrames, got {len(projectile_frames)}")
    for column in range(min(len(projectile_frames), RPG_PROJECTILE_COLUMNS)):
        frame = projectile_frames[column]
        if not isinstance(frame, dict):
            errors.append(f"rpg-external-vfx-manifest: projectileFrames[{column}] must be an object")
            continue
        if frame.get("column") != column:
            errors.append(f"rpg-external-vfx-manifest: projectileFrames[{column}].column mismatch {frame.get('column')}")
        if frame.get("sourceFrameWidth") != 16 or frame.get("sourceFrameHeight") != 16:
            errors.append(f"rpg-external-vfx-manifest: projectileFrames[{column}] must describe 16x16 source frames")

    return errors


def validate_rpg_status_vfx() -> list[str]:
    if not RPG_STATUS_VFX_SPEC.path.exists():
        return [f"{RPG_STATUS_VFX_SPEC.label}: missing {RPG_STATUS_VFX_SPEC.path}"]

    errors: list[str] = []
    sheet = Image.open(RPG_STATUS_VFX_SPEC.path).convert("RGBA")
    expected_size = (RPG_STATUS_VFX_FRAME_W * RPG_STATUS_VFX_COLUMNS, RPG_STATUS_VFX_FRAME_H * RPG_STATUS_VFX_ROWS)
    if sheet.size != expected_size:
        errors.append(f"{RPG_STATUS_VFX_SPEC.label}: expected {expected_size[0]}x{expected_size[1]}, got {sheet.width}x{sheet.height}")
        return errors

    row_images: list[Image.Image] = []
    for row in range(RPG_STATUS_VFX_ROWS):
        active_frames = 0
        row_frames: list[Image.Image] = []
        adjacent_diffs: list[int] = []
        row_images.append(
            sheet.crop(
                (
                    0,
                    row * RPG_STATUS_VFX_FRAME_H,
                    RPG_STATUS_VFX_COLUMNS * RPG_STATUS_VFX_FRAME_W,
                    (row + 1) * RPG_STATUS_VFX_FRAME_H,
                )
            )
        )
        for column in range(RPG_STATUS_VFX_COLUMNS):
            frame = sheet.crop(
                (
                    column * RPG_STATUS_VFX_FRAME_W,
                    row * RPG_STATUS_VFX_FRAME_H,
                    (column + 1) * RPG_STATUS_VFX_FRAME_W,
                    (row + 1) * RPG_STATUS_VFX_FRAME_H,
                )
            )
            opaque = opaque_pixel_count(frame)
            if opaque >= RPG_STATUS_VFX_MIN_FRAME_OPAQUE:
                active_frames += 1
            if opaque < RPG_STATUS_VFX_MIN_FRAME_OPAQUE:
                errors.append(f"{RPG_STATUS_VFX_SPEC.label} r{row}c{column}: status frame too sparse ({opaque} opaque pixels)")
            bbox = alpha_bbox(frame)
            if bbox and (
                bbox[0] <= RPG_STATUS_VFX_EDGE_MARGIN
                or bbox[1] <= RPG_STATUS_VFX_EDGE_MARGIN
                or bbox[2] >= RPG_STATUS_VFX_FRAME_W - RPG_STATUS_VFX_EDGE_MARGIN
                or bbox[3] >= RPG_STATUS_VFX_FRAME_H - RPG_STATUS_VFX_EDGE_MARGIN
            ):
                errors.append(
                    f"{RPG_STATUS_VFX_SPEC.label} r{row}c{column}: status frame touches edge {bbox}; "
                    "persistent overlays must fit fully inside the frame"
                )

            if row_frames:
                adjacent_diffs.append(alpha_mask_diff_pixels(row_frames[-1], frame))
            row_frames.append(frame)

        if active_frames < RPG_STATUS_VFX_MIN_ACTIVE_FRAMES:
            errors.append(f"{RPG_STATUS_VFX_SPEC.label} row {row}: only {active_frames} active frames")
        if adjacent_diffs and max(adjacent_diffs) < RPG_STATUS_VFX_MIN_FRAME_MOTION:
            errors.append(
                f"{RPG_STATUS_VFX_SPEC.label} row {row}: status animation barely changes "
                f"({max(adjacent_diffs)} alpha pixels, min {RPG_STATUS_VFX_MIN_FRAME_MOTION})"
            )

    for left in range(len(row_images)):
        nearest = min(
            alpha_mask_diff_pixels(row_images[left], row_images[right])
            for right in range(len(row_images))
            if right != left
        )
        if nearest < RPG_STATUS_VFX_MIN_NEAREST_ROW_DIFF:
            errors.append(
                f"{RPG_STATUS_VFX_SPEC.label} row {left}: status row too similar to another status "
                f"({nearest} differing alpha pixels, min {RPG_STATUS_VFX_MIN_NEAREST_ROW_DIFF})"
            )

    return errors


def main() -> None:
    errors = validate_class_sprites()
    errors.extend(validate_mage_source_crop_coverage())
    for spec in SPECS:
        errors.extend(validate_grid_sheet(spec))
    errors.extend(validate_warrior_attack_strikes())
    errors.extend(validate_attack_direction_rows())
    errors.extend(validate_vfx_sheets())
    errors.extend(validate_skill_icons())
    errors.extend(validate_skill_icon_source_contract())
    errors.extend(validate_rpg_pet_sprites())
    errors.extend(validate_rpg_battle_arena())
    errors.extend(validate_rpg_skill_vfx())
    errors.extend(validate_rpg_projectiles())
    errors.extend(validate_rpg_external_vfx_manifest())
    errors.extend(validate_rpg_status_vfx())

    if errors:
        print("Sprite validation failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Sprite validation passed")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
SOURCE_DIR = ASSET_DIR / "source"
SHEET = ASSET_DIR / "combat-objects.png"
TURRET_BASE_SOURCE = SOURCE_DIR / "turret-base-alpha-v2.png"
TURRET_HEAD_SOURCE = SOURCE_DIR / "turret-head-alpha-v2.png"
GRID = 4
TURRET_ROW = 1
LOW = 104

Color = tuple[int, int, int, int]


def color(hex_color: str, alpha: int = 255) -> Color:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


INK = color("#15100c")
GOLD_LIGHT = color("#ffe085")
BLUE = color("#43e6ff")
BLUE_DARK = color("#126ec0")


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def draw_spark(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, fill: Color) -> None:
    draw.rectangle([cx - 1, cy - radius, cx, cy + radius], fill=fill)
    draw.rectangle([cx - radius, cy - 1, cx + radius, cy], fill=fill)


def load_component(path: Path, max_width: int, max_height: int, anchor: str) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Missing turret component source: {path}")

    source = Image.open(path).convert("RGBA")
    bbox = alpha_bbox(source, 12)
    if bbox is None:
        raise ValueError(f"Turret component source has no visible pixels: {path}")

    pad = 18
    crop = source.crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(source.width, bbox[2] + pad),
            min(source.height, bbox[3] + pad),
        )
    )
    scale = min(max_width / crop.width, max_height / crop.height)
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )

    rgb = ImageEnhance.Contrast(resized.convert("RGB")).enhance(1.04)
    rgb = ImageEnhance.Color(rgb).enhance(1.02)
    palette = rgb.quantize(colors=56, method=Image.Quantize.MEDIANCUT).convert("RGB")
    component = Image.merge("RGBA", (*palette.split(), resized.getchannel("A")))

    canvas = Image.new("RGBA", (LOW, LOW), (0, 0, 0, 0))
    x = (LOW - component.width) // 2
    if anchor == "bottom":
        y = LOW - component.height - 4
    elif anchor == "center":
        y = (LOW - component.height) // 2
    else:
        raise ValueError(f"Unsupported turret component anchor: {anchor}")
    canvas.alpha_composite(component, (x, y))
    return canvas


def tint_boosted(image: Image.Image) -> Image.Image:
    result = image.copy()
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 10:
                continue
            if blue > 90 or (green > 90 and red > 90):
                pixels[x, y] = (min(255, red + 12), min(255, green + 32), min(255, blue + 54), alpha)
            elif red > 92 and green > 65:
                pixels[x, y] = (min(255, red + 8), min(255, green + 18), min(255, blue + 30), alpha)
    return result


def add_muzzle_flare(head: Image.Image, boosted: bool = False) -> Image.Image:
    result = head.copy()
    bbox = alpha_bbox(result, 12)
    if bbox is None:
        return result

    draw = ImageDraw.Draw(result, "RGBA")
    center_y = (bbox[1] + bbox[3]) // 2
    tip_x = min(LOW - 8, bbox[2] - 2)
    flare = BLUE if boosted else color("#ffb64a")
    hot = color("#eaffff") if boosted else color("#fff3c8")
    draw.polygon([(tip_x - 2, center_y - 11), (LOW - 2, center_y - 4), (LOW - 2, center_y + 5), (tip_x - 2, center_y + 12)], fill=(flare[0], flare[1], flare[2], 215))
    draw.polygon([(tip_x + 4, center_y - 7), (LOW - 5, center_y - 2), (LOW - 5, center_y + 3), (tip_x + 4, center_y + 8)], fill=(hot[0], hot[1], hot[2], 230))
    draw_spark(draw, min(LOW - 7, tip_x + 11), center_y, 5, hot)
    return result


def add_head_glow(head: Image.Image) -> Image.Image:
    result = tint_boosted(head)
    draw = ImageDraw.Draw(result, "RGBA")
    bbox = alpha_bbox(result, 12)
    if bbox is not None:
        x1, y1, x2, y2 = bbox
        draw.arc([x1 - 8, y1 - 7, x2 + 8, y2 + 9], 202, 338, fill=BLUE, width=2)
        draw_spark(draw, x1 - 4, (y1 + y2) // 2, 4, BLUE)
        draw_spark(draw, x2 + 3, (y1 + y2) // 2, 4, BLUE)
    return result


def paste_cell(sheet: Image.Image, column: int, row: int, image: Image.Image) -> None:
    cell_w = sheet.width // GRID
    cell_h = sheet.height // GRID
    x = column * cell_w
    y = row * cell_h
    sheet.paste(Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0)), (x, y))
    scaled = image.resize((LOW * 3, LOW * 3), Image.Resampling.NEAREST)
    sheet.alpha_composite(scaled, (x + (cell_w - scaled.width) // 2, y + (cell_h - scaled.height) // 2))


def draw_layered_turret_cells() -> tuple[Image.Image, Image.Image, Image.Image, Image.Image]:
    base = load_component(TURRET_BASE_SOURCE, 96, 60, "bottom")
    head = load_component(TURRET_HEAD_SOURCE, 82, 56, "center")
    firing = add_muzzle_flare(head)
    boosted = add_muzzle_flare(add_head_glow(head), boosted=True)
    return base, head, firing, boosted


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    for column, image in enumerate(draw_layered_turret_cells()):
        paste_cell(sheet, column, TURRET_ROW, image)
    sheet.save(SHEET)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
SOURCE_SHEET = "Combat-Sheet + Weapon + Glow.png"
SOURCE_CELL = 64
SOURCE_COLUMNS = 10

Color = tuple[int, int, int]


@dataclass(frozen=True)
class Palette:
    shadow: Color
    mid: Color
    hot: Color


@dataclass(frozen=True)
class ImportRow:
    target_sheet: str
    target_columns: int
    target_rows: int
    target_row: int
    source_row: int
    scale: float
    palette: Palette | None = None
    x_offset: int = 0
    y_offset: int = 0
    fit_width: int | None = None
    fit_height: int | None = None


PALETTES: dict[str, Palette] = {
    "steel_white": Palette((35, 42, 46), (188, 222, 230), (255, 255, 246)),
    "warrior_gold": Palette((74, 45, 24), (236, 174, 62), (255, 248, 202)),
    "archer_leaf": Palette((25, 56, 33), (112, 214, 112), (244, 255, 191)),
    "turret_blue": Palette((22, 46, 62), (72, 202, 239), (243, 255, 255)),
    "impact_warm": Palette((64, 32, 18), (238, 142, 45), (255, 248, 197)),
    "heal_green": Palette((24, 70, 44), (118, 235, 111), (247, 255, 206)),
    "mage_orb": Palette((48, 28, 92), (84, 193, 255), (255, 241, 171)),
}


IMPORT_ROWS: tuple[ImportRow, ...] = (
    ImportRow(
        target_sheet="ability-effects.png",
        target_columns=12,
        target_rows=10,
        target_row=0,
        source_row=25,
        scale=2.25,
        palette=PALETTES["steel_white"],
        y_offset=2,
        fit_width=142,
        fit_height=102,
    ),
    ImportRow(
        target_sheet="ability-effects.png",
        target_columns=12,
        target_rows=10,
        target_row=1,
        source_row=25,
        scale=2.42,
        palette=PALETTES["warrior_gold"],
        y_offset=3,
        fit_width=164,
        fit_height=108,
    ),
    ImportRow(
        target_sheet="ability-effects.png",
        target_columns=12,
        target_rows=10,
        target_row=2,
        source_row=14,
        scale=2.4,
        palette=PALETTES["turret_blue"],
        y_offset=2,
        fit_width=158,
        fit_height=98,
    ),
    ImportRow(
        target_sheet="ability-effects.png",
        target_columns=12,
        target_rows=10,
        target_row=8,
        source_row=6,
        scale=2.5,
        palette=PALETTES["impact_warm"],
        fit_width=150,
        fit_height=132,
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=1,
        source_row=13,
        scale=3.0,
        palette=PALETTES["archer_leaf"],
        fit_width=168,
        fit_height=58,
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=2,
        source_row=26,
        scale=3.2,
        palette=PALETTES["mage_orb"],
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=3,
        source_row=13,
        scale=3.2,
        palette=PALETTES["turret_blue"],
        fit_width=176,
        fit_height=68,
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=4,
        source_row=13,
        scale=3.4,
        palette=PALETTES["warrior_gold"],
        fit_width=214,
        fit_height=76,
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=5,
        source_row=6,
        scale=2.5,
        palette=PALETTES["impact_warm"],
        fit_width=156,
        fit_height=156,
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=6,
        source_row=7,
        scale=2.5,
        palette=PALETTES["steel_white"],
        fit_width=156,
        fit_height=156,
    ),
    ImportRow(
        target_sheet="combat-effects.png",
        target_columns=12,
        target_rows=9,
        target_row=7,
        source_row=28,
        scale=2.7,
        palette=PALETTES["heal_green"],
        fit_width=180,
        fit_height=180,
    ),
    ImportRow(
        target_sheet="warrior-archer-effects.png",
        target_columns=12,
        target_rows=6,
        target_row=0,
        source_row=27,
        scale=3.0,
        palette=PALETTES["warrior_gold"],
        fit_width=252,
        fit_height=116,
    ),
    ImportRow(
        target_sheet="warrior-archer-effects.png",
        target_columns=12,
        target_rows=6,
        target_row=3,
        source_row=12,
        scale=3.0,
        palette=PALETTES["archer_leaf"],
        fit_width=248,
        fit_height=116,
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import selected rows from RagnaPixel Combat FX into game VFX sheets.")
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default=os.environ.get("COMBAT_FX_ZIP"),
        help="Path to Combat FX 1.1.zip. Can also be set with COMBAT_FX_ZIP.",
    )
    parser.add_argument("--preview-out", type=Path, default=None, help="Optional local preview sheet path.")
    return parser.parse_args()


def require_zip(path_value: str | None) -> Path:
    candidates: list[Path] = []
    if path_value:
        candidates.append(Path(path_value).expanduser())
    candidates.extend(
        [
            Path.home() / "Desktop" / "game_pixel" / "Combat FX 1.1.zip",
            Path.home() / "Downloads" / "Combat FX 1.1.zip",
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit("Missing Combat FX zip. Pass --zip /path/to/Combat FX 1.1.zip or set COMBAT_FX_ZIP.")


def visible_frames(source_sheet: Image.Image, source_row: int) -> list[int]:
    row = source_row - 1
    frames: list[int] = []
    for frame in range(SOURCE_COLUMNS):
        cell = source_sheet.crop((frame * SOURCE_CELL, row * SOURCE_CELL, (frame + 1) * SOURCE_CELL, (row + 1) * SOURCE_CELL))
        if cell.getchannel("A").getbbox():
            frames.append(frame)
    if not frames:
        raise ValueError(f"Source row {source_row} has no visible pixels")
    return frames


def source_frame_for(source_frames: list[int], frame: int, target_columns: int) -> int:
    if len(source_frames) == 1:
        return source_frames[0]
    amount = frame / max(1, target_columns - 1)
    return source_frames[round(amount * (len(source_frames) - 1))]


def mix(a: Color, b: Color, amount: float) -> Color:
    amount = max(0.0, min(1.0, amount))
    return (
        round(a[0] + (b[0] - a[0]) * amount),
        round(a[1] + (b[1] - a[1]) * amount),
        round(a[2] + (b[2] - a[2]) * amount),
    )


def paletteize(image: Image.Image, palette: Palette | None) -> Image.Image:
    if palette is None:
        return image
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    source = image.load()
    target = result.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = source[x, y]
            if alpha == 0:
                continue
            luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
            if luminance < 0.52:
                color = mix(palette.shadow, palette.mid, luminance / 0.52)
            else:
                color = mix(palette.mid, palette.hot, (luminance - 0.52) / 0.48)
            target[x, y] = (*color, alpha)
    return result


def crop_to_alpha(image: Image.Image, padding: int) -> Image.Image:
    bbox = image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


def render_cell(source_sheet: Image.Image, spec: ImportRow, frame: int, target_w: int, target_h: int) -> Image.Image:
    source_frames = visible_frames(source_sheet, spec.source_row)
    source_frame = source_frame_for(source_frames, frame, spec.target_columns)
    row = spec.source_row - 1
    source_cell = source_sheet.crop(
        (
            source_frame * SOURCE_CELL,
            row * SOURCE_CELL,
            (source_frame + 1) * SOURCE_CELL,
            (row + 1) * SOURCE_CELL,
        )
    )
    source_cell = paletteize(source_cell, spec.palette)
    source_cell = crop_to_alpha(source_cell, 2)
    if spec.fit_width is not None and spec.fit_height is not None:
        scale = min(spec.fit_width / source_cell.width, spec.fit_height / source_cell.height)
        scaled_size = (max(1, round(source_cell.width * scale)), max(1, round(source_cell.height * scale)))
    else:
        scaled_size = (round(source_cell.width * spec.scale), round(source_cell.height * spec.scale))
    source_cell = source_cell.resize(scaled_size, Image.Resampling.NEAREST)

    target = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    x = (target_w - scaled_size[0]) // 2 + spec.x_offset
    y = (target_h - scaled_size[1]) // 2 + spec.y_offset
    target.alpha_composite(source_cell, (x, y))
    return target


def import_row(source_sheet: Image.Image, spec: ImportRow) -> list[Image.Image]:
    target_path = ASSET_DIR / spec.target_sheet
    if not target_path.exists():
        raise FileNotFoundError(f"Missing target sheet: {target_path}")
    target_sheet = Image.open(target_path).convert("RGBA")
    target_w = target_sheet.width // spec.target_columns
    target_h = target_sheet.height // spec.target_rows
    if target_sheet.size != (target_w * spec.target_columns, target_h * spec.target_rows):
        raise ValueError(f"{spec.target_sheet} does not divide cleanly into {spec.target_columns}x{spec.target_rows}")

    imported_cells: list[Image.Image] = []
    for frame in range(spec.target_columns):
        cell = render_cell(source_sheet, spec, frame, target_w, target_h)
        target_sheet.paste(cell, (frame * target_w, spec.target_row * target_h))
        imported_cells.append(cell)
    target_sheet.save(target_path)
    return imported_cells


def write_preview(imported_rows: list[tuple[ImportRow, list[Image.Image]]], out: Path) -> None:
    gap = 8
    width = max(sum(cell.width for cell in cells) for _, cells in imported_rows)
    height = sum(cells[0].height for _, cells in imported_rows) + gap * (len(imported_rows) - 1)
    canvas = Image.new("RGBA", (width, height), (23, 18, 14, 255))
    y = 0
    for _, cells in imported_rows:
        x = 0
        for cell in cells:
            canvas.alpha_composite(cell, (x, y))
            x += cell.width
        y += cells[0].height + gap
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)


def main() -> None:
    args = parse_args()
    zip_path = require_zip(args.zip_path)
    with ZipFile(zip_path) as archive:
        try:
            source_sheet = Image.open(archive.open(SOURCE_SHEET)).convert("RGBA")
        except KeyError as exc:
            raise SystemExit(f"{SOURCE_SHEET} not found in {zip_path}") from exc

    if source_sheet.size[0] != SOURCE_COLUMNS * SOURCE_CELL or source_sheet.size[1] % SOURCE_CELL != 0:
        raise SystemExit(f"Unexpected Combat FX sheet size: {source_sheet.size}")

    imported_rows: list[tuple[ImportRow, list[Image.Image]]] = []
    for spec in IMPORT_ROWS:
        imported_rows.append((spec, import_row(source_sheet, spec)))

    if args.preview_out:
        write_preview(imported_rows, args.preview_out)

    names = ", ".join(f"{spec.target_sheet}:row{spec.target_row}" for spec, _ in imported_rows)
    print(f"Imported Combat FX rows into {names}")


if __name__ == "__main__":
    main()

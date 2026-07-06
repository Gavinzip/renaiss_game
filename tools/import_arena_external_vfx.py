#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"


@dataclass(frozen=True)
class ImportRow:
    target_sheet: str
    target_columns: int
    target_rows: int
    target_row: int
    source_sheet: str
    source_columns: int
    source_rows: int
    source_row: int
    fit_width: int
    fit_height: int
    x_offset: int = 0
    y_offset: int = 0
    crop_padding: int = 3


IMPORT_ROWS: tuple[ImportRow, ...] = (
    # ability-effects rows 0, 1, 2 and 8 are imported from Combat FX.
    ImportRow("ability-effects.png", 12, 10, 3, "rpg-skill-vfx-light.png", 16, 25, 16, 184, 132, y_offset=6),
    ImportRow("ability-effects.png", 12, 10, 4, "rpg-skill-vfx-grass.png", 16, 25, 11, 188, 148, y_offset=2),
    ImportRow("ability-effects.png", 12, 10, 5, "rpg-skill-vfx-water.png", 16, 25, 17, 178, 130, y_offset=6),
    ImportRow("ability-effects.png", 12, 10, 6, "rpg-skill-vfx-water.png", 16, 25, 21, 190, 154, y_offset=2),
    ImportRow("ability-effects.png", 12, 10, 7, "rpg-skill-vfx-dark.png", 16, 25, 23, 184, 146, y_offset=4),
    ImportRow("ability-effects.png", 12, 10, 9, "rpg-skill-vfx-dark.png", 16, 25, 24, 184, 146, y_offset=4),
    # Warrior/archer class-specific rows.
    ImportRow("warrior-archer-effects.png", 12, 6, 1, "rpg-skill-vfx-light.png", 16, 25, 14, 282, 172, y_offset=8),
    ImportRow("warrior-archer-effects.png", 12, 6, 2, "rpg-skill-vfx-light.png", 16, 25, 16, 304, 178, y_offset=8),
    ImportRow("warrior-archer-effects.png", 12, 6, 4, "rpg-skill-vfx-grass.png", 16, 25, 16, 304, 178, y_offset=8),
    ImportRow("warrior-archer-effects.png", 12, 6, 5, "rpg-skill-vfx-grass.png", 16, 25, 6, 304, 190, y_offset=4),
    # Engineer ground/deploy rows and beam row.
    ImportRow("engineer-effects.png", 12, 3, 0, "rpg-skill-vfx-fire.png", 16, 25, 16, 316, 184, y_offset=10),
    ImportRow("engineer-effects.png", 12, 3, 1, "rpg-skill-vfx-light.png", 16, 25, 20, 350, 122, y_offset=2),
    ImportRow("engineer-effects.png", 12, 3, 2, "rpg-skill-vfx-water.png", 16, 25, 17, 304, 174, y_offset=8),
    # Mage rows use the higher-frame arena sheet but sample from the external 16-frame RPG rows.
    ImportRow("mage-effects.png", 20, 2, 0, "rpg-skill-vfx-grass.png", 16, 25, 23, 330, 220, y_offset=6),
    ImportRow("mage-effects.png", 20, 2, 1, "rpg-skill-vfx-water.png", 16, 25, 21, 350, 224, y_offset=6),
    # combat-effects rows 1-7 are imported from Combat FX; replace remaining generated rows here.
    ImportRow("combat-effects.png", 12, 9, 0, "rpg-skill-vfx-dark.png", 16, 25, 20, 350, 136, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 8, "rpg-skill-vfx-dark.png", 16, 25, 24, 330, 188, y_offset=8),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import external RPG VFX rows into arena-specific VFX sheets.")
    parser.add_argument("--preview-dir", type=Path, default=None, help="Optional directory for post-import contact sheets.")
    return parser.parse_args()


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def crop_to_alpha(image: Image.Image, padding: int) -> Image.Image:
    bbox = alpha_bbox(image)
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


def source_frame_for(frame: int, target_columns: int, source_columns: int) -> int:
    if source_columns <= 1:
        return 0
    return round(frame * (source_columns - 1) / max(1, target_columns - 1))


def render_cell(source: Image.Image, spec: ImportRow, frame: int, target_w: int, target_h: int) -> Image.Image:
    source_w = source.width // spec.source_columns
    source_h = source.height // spec.source_rows
    source_column = source_frame_for(frame, spec.target_columns, spec.source_columns)
    source_cell = source.crop(
        (
            source_column * source_w,
            spec.source_row * source_h,
            (source_column + 1) * source_w,
            (spec.source_row + 1) * source_h,
        )
    )
    source_cell = crop_to_alpha(source_cell, spec.crop_padding)
    bbox = alpha_bbox(source_cell)
    if bbox is None:
        return Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))

    scale = min(spec.fit_width / source_cell.width, spec.fit_height / source_cell.height)
    size = (max(1, round(source_cell.width * scale)), max(1, round(source_cell.height * scale)))
    source_cell = source_cell.resize(size, Image.Resampling.NEAREST)

    target = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    x = (target_w - source_cell.width) // 2 + spec.x_offset
    y = (target_h - source_cell.height) // 2 + spec.y_offset
    target.alpha_composite(source_cell, (x, y))
    return target


def import_row(spec: ImportRow, source_cache: dict[str, Image.Image]) -> None:
    target_path = ASSET_DIR / spec.target_sheet
    source_path = ASSET_DIR / spec.source_sheet
    if not target_path.exists():
        raise SystemExit(f"Missing target sheet: {target_path}")
    if not source_path.exists():
        raise SystemExit(f"Missing source sheet: {source_path}")

    target = Image.open(target_path).convert("RGBA")
    source = source_cache.setdefault(spec.source_sheet, Image.open(source_path).convert("RGBA"))
    target_w = target.width // spec.target_columns
    target_h = target.height // spec.target_rows

    if spec.target_row >= spec.target_rows:
        raise SystemExit(f"Invalid target row {spec.target_row} for {spec.target_sheet}")
    if spec.source_row >= spec.source_rows:
        raise SystemExit(f"Invalid source row {spec.source_row} for {spec.source_sheet}")

    for frame in range(spec.target_columns):
        cell = render_cell(source, spec, frame, target_w, target_h)
        target.paste(cell, (frame * target_w, spec.target_row * target_h))

    target.save(target_path)


def make_contact_sheet(sheet_name: str, columns: int, rows: int, output_path: Path) -> None:
    sheet = Image.open(ASSET_DIR / sheet_name).convert("RGBA")
    cell_w = sheet.width // columns
    cell_h = sheet.height // rows
    thumb_w = 128
    thumb_h = 92
    label_h = 18
    output = Image.new("RGBA", (columns * thumb_w, rows * (thumb_h + label_h)), (24, 20, 16, 255))
    draw = Image.new("RGBA", output.size, (0, 0, 0, 0))
    from PIL import ImageDraw

    painter = ImageDraw.Draw(output)
    for row in range(rows):
        for column in range(columns):
            x0 = column * thumb_w
            y0 = row * (thumb_h + label_h)
            for yy in range(0, thumb_h, 8):
                for xx in range(0, thumb_w, 8):
                    color = (54, 49, 43, 255) if ((xx // 8 + yy // 8) % 2) else (38, 34, 30, 255)
                    painter.rectangle((x0 + xx, y0 + yy, x0 + xx + 7, y0 + yy + 7), fill=color)
            cell = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
            bbox = alpha_bbox(cell)
            if bbox:
                crop = cell.crop(bbox)
                scale = min((thumb_w - 8) / crop.width, (thumb_h - 8) / crop.height, 1.0)
                crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.NEAREST)
                output.alpha_composite(crop, (x0 + (thumb_w - crop.width) // 2, y0 + (thumb_h - crop.height) // 2))
            painter.text((x0 + 3, y0 + thumb_h + 2), f"r{row} f{column}", fill=(223, 190, 125, 255))
    output.convert("RGB").save(output_path)


def write_previews(preview_dir: Path) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)
    touched: dict[str, tuple[int, int]] = {
        spec.target_sheet: (spec.target_columns, spec.target_rows)
        for spec in IMPORT_ROWS
    }
    for sheet_name, (columns, rows) in touched.items():
        make_contact_sheet(sheet_name, columns, rows, preview_dir / sheet_name.replace(".png", "-arena-external-preview.png"))


def main() -> None:
    args = parse_args()
    source_cache: dict[str, Image.Image] = {}
    for spec in IMPORT_ROWS:
        import_row(spec, source_cache)
    if args.preview_dir:
        write_previews(args.preview_dir)
    print("Imported external arena VFX rows:")
    for spec in IMPORT_ROWS:
        print(f"- {spec.target_sheet} row {spec.target_row} <- {spec.source_sheet} row {spec.source_row}")


if __name__ == "__main__":
    main()

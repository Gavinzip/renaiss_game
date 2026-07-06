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
SOURCE_CELL = 64


@dataclass(frozen=True)
class ImportRow:
    target_sheet: str
    target_columns: int
    target_rows: int
    target_row: int
    source_file: str
    fit_width: int
    fit_height: int
    x_offset: int = 0
    y_offset: int = 0
    crop_padding: int = 3
    source_row: int | None = None


IMPORT_ROWS: tuple[ImportRow, ...] = (
    # Generic ability rows. Melee rows 0 and 1 stay on Combat FX because SpellsFX slash variants mix colors.
    ImportRow("ability-effects.png", 12, 10, 2, "Spritesheet/Ion Strike.png", 172, 126, y_offset=2, source_row=1),
    ImportRow("ability-effects.png", 12, 10, 3, "Spritesheet/Judgment Ray.png", 180, 146, y_offset=4),
    ImportRow("ability-effects.png", 12, 10, 4, "Spritesheet/Toxic Wave.png", 184, 144, y_offset=4),
    ImportRow("ability-effects.png", 12, 10, 5, "Spritesheet/Glacial Core.png", 188, 150, y_offset=4),
    ImportRow("ability-effects.png", 12, 10, 6, "Spritesheet/Magic Vortex.png", 188, 150, y_offset=4),
    ImportRow("ability-effects.png", 12, 10, 7, "Spritesheet/Power Burst.png", 182, 146, y_offset=4),
    ImportRow("ability-effects.png", 12, 10, 8, "Spritesheet/Fire Hit.png", 184, 106, y_offset=0),
    ImportRow("ability-effects.png", 12, 10, 9, "Spritesheet/Black Hole.png", 180, 138, y_offset=4),
    # Warrior and archer class rows.
    ImportRow("warrior-archer-effects.png", 12, 6, 0, "Spritesheet/Solar Spear.png", 300, 124, y_offset=2),
    ImportRow("warrior-archer-effects.png", 12, 6, 1, "Spritesheet/Protection Field.png", 282, 168, y_offset=8, source_row=0),
    ImportRow("warrior-archer-effects.png", 12, 6, 2, "Spritesheet/Judgment Ray.png", 292, 188, y_offset=8),
    # Archer root needs a grounded snare read. Poison Spores reads as bubbles in-game.
    ImportRow("warrior-archer-effects.png", 12, 6, 4, "Spritesheet/Quake Surge.png", 304, 146, y_offset=14),
    # Seed Rain fallback must avoid bubble-like toxic wave reads.
    ImportRow("warrior-archer-effects.png", 12, 6, 5, "Spritesheet/Leaf Flow.png", 288, 168, y_offset=6),
    # Engineer rows.
    ImportRow("engineer-effects.png", 12, 3, 0, "Spritesheet/Energy Pillar.png", 310, 184, y_offset=8),
    ImportRow("engineer-effects.png", 12, 3, 1, "Spritesheet/Celestial Beam.png", 354, 118, y_offset=2, source_row=1),
    ImportRow("engineer-effects.png", 12, 3, 2, "Spritesheet/Glacial Core.png", 312, 188, y_offset=8),
    # Mage high-frame rows.
    ImportRow("mage-effects.png", 20, 2, 0, "Spritesheet/Power Burst.png", 330, 210, y_offset=8),
    ImportRow("mage-effects.png", 20, 2, 1, "Spritesheet/Magic Vortex.png", 344, 220, y_offset=8),
    # Combat rows used by projectiles, impacts and death.
    ImportRow("combat-effects.png", 12, 9, 0, "Spritesheet/Celestial Beam.png", 350, 132, y_offset=0, source_row=1),
    ImportRow("combat-effects.png", 12, 9, 2, "Spritesheet/Arcane Orb.png", 154, 154, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 3, "Spritesheet/Ice Lance.png", 146, 52, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 4, "Spritesheet/Laser.png", 218, 72, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 5, "Spritesheet/Fire Hit.png", 172, 96, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 6, "Spritesheet/Celestial Impact.png", 178, 152, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 7, "Spritesheet/Rising Energy.png", 136, 184, y_offset=0),
    ImportRow("combat-effects.png", 12, 9, 8, "Spritesheet/Black Hole.png", 204, 172, y_offset=4),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import SpellsFX2.0 spritesheets into arena VFX sheets.")
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default=os.environ.get("SPELLS_FX_ZIP"),
        help="Path to SpellsFX2.0.zip. Can also be set with SPELLS_FX_ZIP.",
    )
    parser.add_argument("--preview-out", type=Path, default=None, help="Optional preview sheet of imported rows.")
    return parser.parse_args()


def require_zip(path_value: str | None) -> Path:
    candidates: list[Path] = []
    if path_value:
        candidates.append(Path(path_value).expanduser())
    candidates.extend(
        [
            Path.home() / "Downloads" / "SpellsFX2.0.zip",
            Path.home() / "Desktop" / "game_pixel" / "SpellsFX2.0.zip",
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit("Missing SpellsFX2.0.zip. Pass --zip /path/to/SpellsFX2.0.zip or set SPELLS_FX_ZIP.")


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


def visible_frames(source: Image.Image, source_row: int | None = None) -> list[Image.Image]:
    columns = source.width // SOURCE_CELL
    rows = source.height // SOURCE_CELL
    if source_row is not None and not 0 <= source_row < rows:
        raise ValueError(f"Source row {source_row} is out of range for {columns}x{rows} source sheet")
    frames: list[Image.Image] = []
    for row in range(rows):
        if source_row is not None and row != source_row:
            continue
        for column in range(columns):
            frame = source.crop(
                (
                    column * SOURCE_CELL,
                    row * SOURCE_CELL,
                    (column + 1) * SOURCE_CELL,
                    (row + 1) * SOURCE_CELL,
                )
            )
            if alpha_bbox(frame):
                frames.append(frame)
    if not frames:
        raise ValueError("Source sheet has no visible frames")
    return frames


def source_frame_for(frames: list[Image.Image], frame: int, target_columns: int) -> Image.Image:
    if len(frames) == 1:
        return frames[0]
    amount = frame / max(1, target_columns - 1)
    return frames[round(amount * (len(frames) - 1))]


def render_cell(source_frames: list[Image.Image], spec: ImportRow, frame: int, target_w: int, target_h: int) -> Image.Image:
    source = source_frame_for(source_frames, frame, spec.target_columns)
    source = crop_to_alpha(source, spec.crop_padding)
    if not alpha_bbox(source):
        return Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))

    scale = min(spec.fit_width / source.width, spec.fit_height / source.height)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    source = source.resize(size, Image.Resampling.NEAREST)

    target = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    x = (target_w - source.width) // 2 + spec.x_offset
    y = (target_h - source.height) // 2 + spec.y_offset
    target.alpha_composite(source, (x, y))
    return target


def import_row(archive: ZipFile, source_cache: dict[str, list[Image.Image]], spec: ImportRow) -> list[Image.Image]:
    target_path = ASSET_DIR / spec.target_sheet
    if not target_path.exists():
        raise FileNotFoundError(f"Missing target sheet: {target_path}")
    if spec.source_file not in archive.namelist():
        raise FileNotFoundError(f"Missing source sheet in SpellsFX archive: {spec.source_file}")

    target = Image.open(target_path).convert("RGBA")
    target_w = target.width // spec.target_columns
    target_h = target.height // spec.target_rows
    if target.size != (target_w * spec.target_columns, target_h * spec.target_rows):
        raise ValueError(f"{spec.target_sheet} does not divide cleanly into {spec.target_columns}x{spec.target_rows}")

    source_cache_key = f"{spec.source_file}#{spec.source_row if spec.source_row is not None else 'all'}"
    if source_cache_key not in source_cache:
        with archive.open(spec.source_file) as file:
            source_cache[source_cache_key] = visible_frames(Image.open(file).convert("RGBA"), spec.source_row)
    source_frames = source_cache[source_cache_key]

    imported: list[Image.Image] = []
    for frame in range(spec.target_columns):
        cell = render_cell(source_frames, spec, frame, target_w, target_h)
        target.paste(cell, (frame * target_w, spec.target_row * target_h))
        imported.append(cell)

    target.save(target_path)
    return imported


def write_preview(rows: list[tuple[ImportRow, list[Image.Image]]], out: Path) -> None:
    gap = 8
    label_width = 250
    width = label_width + max(sum(cell.width for cell in cells) for _, cells in rows)
    height = sum(cells[0].height for _, cells in rows) + gap * (len(rows) - 1)
    canvas = Image.new("RGBA", (width, height), (23, 18, 14, 255))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(canvas)
    y = 0
    for spec, cells in rows:
        draw.text((8, y + 8), f"{spec.target_sheet} r{spec.target_row}", fill=(236, 202, 139, 255))
        draw.text((8, y + 26), spec.source_file.replace("Spritesheet/", ""), fill=(174, 143, 95, 255))
        x = label_width
        for cell in cells:
            canvas.alpha_composite(cell, (x, y))
            x += cell.width
        y += cells[0].height + gap
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)


def main() -> None:
    args = parse_args()
    zip_path = require_zip(args.zip_path)
    imported_rows: list[tuple[ImportRow, list[Image.Image]]] = []
    source_cache: dict[str, list[Image.Image]] = {}
    with ZipFile(zip_path) as archive:
        for spec in IMPORT_ROWS:
            imported_rows.append((spec, import_row(archive, source_cache, spec)))

    if args.preview_out:
        write_preview(imported_rows, args.preview_out)

    print("Imported SpellsFX rows:")
    for spec, _ in imported_rows:
        print(f"- {spec.target_sheet} row {spec.target_row} <- {spec.source_file}")


if __name__ == "__main__":
    main()

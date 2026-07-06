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
ARCHIVE_ROOT = "Super Pixel Effects Gigapack (Free Version)"
PNG_ROOT = f"{ARCHIVE_ROOT}/PNG"


@dataclass(frozen=True)
class ImportRow:
    target_sheet: str
    target_columns: int
    target_rows: int
    target_row: int
    source_folder: str
    fit_width: int
    fit_height: int
    x_offset: int = 0
    y_offset: int = 0
    crop_padding: int = 4


IMPORT_ROWS: tuple[ImportRow, ...] = (
    # Rows already handled well by Combat FX/SpellsFX are left alone. Super Pixel is used where
    # it clearly improves impact, shield, overclock and death reads.
    ImportRow(
        "ability-effects.png",
        12,
        10,
        5,
        "Sci-fi/scifi_charge_up_001/scifi_charge_up_001_large_yellow",
        182,
        138,
        y_offset=4,
    ),
    ImportRow(
        "ability-effects.png",
        12,
        10,
        6,
        "Lightning/lightning_burst_003/lightning_burst_003_large_violet",
        184,
        150,
        y_offset=4,
    ),
    ImportRow(
        "ability-effects.png",
        12,
        10,
        8,
        "Impacts/symmetrical_impact_002/symmetrical_impact_002_large_blue",
        168,
        138,
        y_offset=2,
    ),
    ImportRow(
        "ability-effects.png",
        12,
        10,
        9,
        "Explosions/epic_explosion_002/epic_explosion_002_small_yellow",
        184,
        148,
        y_offset=4,
    ),
    ImportRow(
        "warrior-archer-effects.png",
        12,
        6,
        1,
        "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_large_blue",
        282,
        190,
        y_offset=8,
    ),
    ImportRow(
        "warrior-archer-effects.png",
        12,
        6,
        5,
        "Splatters/burst_splatter_003/burst_splatter_003_large_green",
        304,
        184,
        y_offset=2,
    ),
    ImportRow(
        "engineer-effects.png",
        12,
        3,
        0,
        "Sci-fi/scifi_warp_003/scifi_warp_003_large_blue",
        320,
        210,
        y_offset=8,
    ),
    ImportRow(
        "engineer-effects.png",
        12,
        3,
        1,
        "Impacts/symmetrical_impact_002/symmetrical_impact_002_large_blue",
        326,
        206,
        y_offset=2,
    ),
    ImportRow(
        "engineer-effects.png",
        12,
        3,
        2,
        "Sci-fi/scifi_charge_up_001/scifi_charge_up_001_large_yellow",
        318,
        202,
        y_offset=8,
    ),
    # mage-effects row 1 is Clean Storm. Keep it on the SpellsFX Magic Vortex
    # sequence; the Gigapack lightning burst created a white splatter read in-game.
    ImportRow(
        "combat-effects.png",
        12,
        9,
        5,
        "Impacts/symmetrical_impact_002/symmetrical_impact_002_large_blue",
        218,
        178,
        y_offset=0,
    ),
    ImportRow(
        "combat-effects.png",
        12,
        9,
        6,
        "Impacts/symmetrical_impact_006/symmetrical_impact_006_large_yellow",
        230,
        184,
        y_offset=2,
    ),
    ImportRow(
        "combat-effects.png",
        12,
        9,
        8,
        "Explosions/epic_explosion_002/epic_explosion_002_small_yellow",
        242,
        192,
        y_offset=8,
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import selected Super Pixel Effects Gigapack rows into arena VFX sheets.")
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default=os.environ.get("SUPER_PIXEL_FX_ZIP"),
        help="Path to Super Pixel Effects Gigapack zip. Can also be set with SUPER_PIXEL_FX_ZIP.",
    )
    parser.add_argument("--preview-out", type=Path, default=None, help="Optional preview sheet of imported rows.")
    return parser.parse_args()


def require_zip(path_value: str | None) -> Path:
    candidates: list[Path] = []
    if path_value:
        candidates.append(Path(path_value).expanduser())
    candidates.extend(
        [
            Path.home() / "Desktop" / "game_pixel" / "world" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip",
            Path.home() / "Desktop" / "game_pixel" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip",
            Path.home() / "Downloads" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip",
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit(
        "Missing Super Pixel Effects Gigapack zip. Pass --zip /path/to/zip or set SUPER_PIXEL_FX_ZIP."
    )


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def union_bbox(frames: list[Image.Image], padding: int) -> tuple[int, int, int, int]:
    bounds = [bbox for frame in frames if (bbox := alpha_bbox(frame))]
    if not bounds:
        raise ValueError("Source sequence has no visible frames")
    left = max(0, min(bbox[0] for bbox in bounds) - padding)
    top = max(0, min(bbox[1] for bbox in bounds) - padding)
    right = min(frames[0].width, max(bbox[2] for bbox in bounds) + padding)
    bottom = min(frames[0].height, max(bbox[3] for bbox in bounds) + padding)
    return (left, top, right, bottom)


def source_sequence(archive: ZipFile, source_folder: str) -> list[Image.Image]:
    prefix = f"{PNG_ROOT}/{source_folder}/"
    names = sorted(name for name in archive.namelist() if name.startswith(prefix) and name.endswith(".png"))
    if not names:
        raise FileNotFoundError(f"Missing Super Pixel PNG sequence: {source_folder}")
    frames: list[Image.Image] = []
    expected_size: tuple[int, int] | None = None
    for name in names:
        with archive.open(name) as file:
            frame = Image.open(file).convert("RGBA")
        if expected_size is None:
            expected_size = frame.size
        if frame.size != expected_size:
            raise ValueError(f"Mixed frame sizes in {source_folder}: expected {expected_size}, got {frame.size}")
        frames.append(frame)
    return frames


def source_frame_for(frames: list[Image.Image], frame: int, target_columns: int) -> Image.Image:
    if len(frames) == 1:
        return frames[0]
    amount = frame / max(1, target_columns - 1)
    return frames[round(amount * (len(frames) - 1))]


def render_cell(
    source_frames: list[Image.Image],
    shared_bbox: tuple[int, int, int, int],
    spec: ImportRow,
    frame: int,
    target_w: int,
    target_h: int,
) -> Image.Image:
    source = source_frame_for(source_frames, frame, spec.target_columns).crop(shared_bbox)
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

    target = Image.open(target_path).convert("RGBA")
    target_w = target.width // spec.target_columns
    target_h = target.height // spec.target_rows
    if target.size != (target_w * spec.target_columns, target_h * spec.target_rows):
        raise ValueError(f"{spec.target_sheet} does not divide cleanly into {spec.target_columns}x{spec.target_rows}")

    if spec.source_folder not in source_cache:
        source_cache[spec.source_folder] = source_sequence(archive, spec.source_folder)
    source_frames = source_cache[spec.source_folder]
    shared_bbox = union_bbox(source_frames, spec.crop_padding)

    imported: list[Image.Image] = []
    for frame in range(spec.target_columns):
        cell = render_cell(source_frames, shared_bbox, spec, frame, target_w, target_h)
        target.paste(cell, (frame * target_w, spec.target_row * target_h))
        imported.append(cell)

    target.save(target_path)
    return imported


def write_preview(rows: list[tuple[ImportRow, list[Image.Image]]], out: Path) -> None:
    gap = 8
    label_width = 300
    width = label_width + max(sum(cell.width for cell in cells) for _, cells in rows)
    height = sum(cells[0].height for _, cells in rows) + gap * (len(rows) - 1)
    canvas = Image.new("RGBA", (width, height), (23, 18, 14, 255))

    from PIL import ImageDraw

    draw = ImageDraw.Draw(canvas)
    y = 0
    for spec, cells in rows:
        draw.text((8, y + 8), f"{spec.target_sheet} r{spec.target_row}", fill=(236, 202, 139, 255))
        draw.text((8, y + 26), spec.source_folder.split("/")[-1], fill=(174, 143, 95, 255))
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
        if f"{ARCHIVE_ROOT}/license.txt" not in archive.namelist():
            raise SystemExit("Super Pixel Effects Gigapack archive is missing license.txt")
        for spec in IMPORT_ROWS:
            imported_rows.append((spec, import_row(archive, source_cache, spec)))

    if args.preview_out:
        write_preview(imported_rows, args.preview_out)

    print("Imported Super Pixel arena VFX rows:")
    for spec, _ in imported_rows:
        print(f"- {spec.target_sheet} row {spec.target_row} <- {spec.source_folder}")


if __name__ == "__main__":
    main()

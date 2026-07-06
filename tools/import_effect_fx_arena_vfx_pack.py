#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from io import BytesIO
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
    source_row: int
    fit_width: int
    fit_height: int
    x_offset: int = 0
    y_offset: int = 0
    crop_padding: int = 3


IMPORT_ROWS: tuple[ImportRow, ...] = ()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import selected Effect and FX Pixel All rows into arena VFX sheets.")
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default=os.environ.get("EFFECT_FX_ZIP") or os.environ.get("RPG_EFFECT_FX_ZIP"),
        help="Path to Effect and FX Pixel All Free.zip. Can also be set with EFFECT_FX_ZIP.",
    )
    parser.add_argument("--preview-out", type=Path, default=None, help="Optional preview sheet of imported rows.")
    return parser.parse_args()


def require_zip(path_value: str | None) -> Path:
    candidates: list[Path] = []
    if path_value:
        candidates.append(Path(path_value).expanduser())
    candidates.extend(
        [
            Path.home() / "Desktop" / "game_pixel" / "Effect and FX Pixel All Free.zip",
            Path.home() / "Downloads" / "Effect and FX Pixel All Free.zip",
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit("Missing Effect and FX Pixel All Free.zip. Pass --zip /path/to/zip or set EFFECT_FX_ZIP.")


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def source_frames(archive: ZipFile, spec: ImportRow) -> list[Image.Image]:
    if spec.source_file not in archive.namelist():
        raise FileNotFoundError(f"Missing Effect/FX source sheet: {spec.source_file}")

    with archive.open(spec.source_file) as file:
        sheet = Image.open(BytesIO(file.read())).convert("RGBA")

    columns = sheet.width // SOURCE_CELL
    rows = sheet.height // SOURCE_CELL
    if sheet.size != (columns * SOURCE_CELL, rows * SOURCE_CELL):
        raise ValueError(f"{spec.source_file} does not divide into {SOURCE_CELL}px cells")
    if not 0 <= spec.source_row < rows:
        raise ValueError(f"{spec.source_file} row {spec.source_row} is outside 0..{rows - 1}")

    frames = [
        sheet.crop(
            (
                column * SOURCE_CELL,
                spec.source_row * SOURCE_CELL,
                (column + 1) * SOURCE_CELL,
                (spec.source_row + 1) * SOURCE_CELL,
            )
        )
        for column in range(columns)
    ]
    visible = [frame for frame in frames if alpha_bbox(frame)]
    if not visible:
        raise ValueError(f"{spec.source_file} row {spec.source_row} has no visible frames")
    return visible


def union_bbox(frames: list[Image.Image], padding: int) -> tuple[int, int, int, int]:
    bounds = [bbox for frame in frames if (bbox := alpha_bbox(frame))]
    if not bounds:
        raise ValueError("Source sequence has no visible frames")
    left = max(0, min(bbox[0] for bbox in bounds) - padding)
    top = max(0, min(bbox[1] for bbox in bounds) - padding)
    right = min(frames[0].width, max(bbox[2] for bbox in bounds) + padding)
    bottom = min(frames[0].height, max(bbox[3] for bbox in bounds) + padding)
    return (left, top, right, bottom)


def source_frame_for(frames: list[Image.Image], frame: int, target_columns: int) -> Image.Image:
    if len(frames) == 1:
        return frames[0]
    amount = frame / max(1, target_columns - 1)
    return frames[round(amount * (len(frames) - 1))]


def render_cell(
    frames: list[Image.Image],
    shared_bbox: tuple[int, int, int, int],
    spec: ImportRow,
    frame: int,
    target_w: int,
    target_h: int,
) -> Image.Image:
    source = source_frame_for(frames, frame, spec.target_columns).crop(shared_bbox)
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


def import_row(archive: ZipFile, spec: ImportRow) -> list[Image.Image]:
    target_path = ASSET_DIR / spec.target_sheet
    if not target_path.exists():
        raise FileNotFoundError(f"Missing target sheet: {target_path}")

    target = Image.open(target_path).convert("RGBA")
    target_w = target.width // spec.target_columns
    target_h = target.height // spec.target_rows
    if target.size != (target_w * spec.target_columns, target_h * spec.target_rows):
        raise ValueError(f"{spec.target_sheet} does not divide cleanly into {spec.target_columns}x{spec.target_rows}")

    frames = source_frames(archive, spec)
    shared_bbox = union_bbox(frames, spec.crop_padding)
    imported: list[Image.Image] = []
    for frame in range(spec.target_columns):
        cell = render_cell(frames, shared_bbox, spec, frame, target_w, target_h)
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
        draw.text((8, y + 26), f"{spec.source_file} row {spec.source_row}", fill=(174, 143, 95, 255))
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
    with ZipFile(zip_path) as archive:
        for spec in IMPORT_ROWS:
            imported_rows.append((spec, import_row(archive, spec)))

    if args.preview_out:
        write_preview(imported_rows, args.preview_out)

    print("Imported Effect/FX arena VFX rows:")
    for spec, _ in imported_rows:
        print(f"- {spec.target_sheet} row {spec.target_row} <- {spec.source_file} row {spec.source_row}")


if __name__ == "__main__":
    main()

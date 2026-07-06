#!/usr/bin/env python3
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
OUT = ASSET_DIR / "skill-icons.png"

CELL = 64
GRID = 4
SAFE_MARGIN = 5
SPELLS_CELL = 64
SUPER_PIXEL_ROOT = "Super Pixel Effects Gigapack (Free Version)/PNG"
COMBAT_FX_SOURCE_SHEET = "Combat-Sheet + Weapon + Glow.png"
COMBAT_FX_CELL = 64
COMBAT_FX_COLUMNS = 10
EFFECT_FX_CELL = 64
GENERATED_OBJECT_GRID = {
    "arrow": (0, 0),
    "magicOrb": (1, 0),
    "turretHead": (1, 1),
    "hitSpark": (0, 3),
}


@dataclass(frozen=True)
class IconSource:
    archive: str
    source: str
    frame_mode: str = "best"
    frame_index: int = 0
    frame_percent: float = 0.5
    fit: int = 60
    x_offset: int = 0
    y_offset: int = 0
    padding: int = 4


# Class rows: warrior, archer, engineer, mage.
# Slot columns: Q, E, R, M1 attack.
#
# Each icon is sampled from exactly one complete production sequence or one
# shipped gameplay object. Do not compose multiple effects or hand-draw
# symbolic overlays in this sheet.
ICONS: tuple[tuple[IconSource, ...], ...] = (
    (
        IconSource("combat", "23", frame_mode="best", fit=60),
        IconSource("super_pixel", "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_large_blue", frame_mode="index", frame_index=9, fit=58),
        IconSource("spells", "Judgment Ray", frame_mode="percent", frame_percent=0.36, fit=60),
        IconSource("combat", "25", frame_mode="best", fit=60),
    ),
    (
        IconSource("super_pixel", "Fantasy Spells/spell_haste_001/spell_haste_001_large_green", frame_mode="best", fit=60),
        IconSource("super_pixel", "Fantasy Spells/spell_poison_001/spell_poison_001_large_green", frame_mode="index", frame_index=0, fit=62),
        IconSource("super_pixel", "Splatters/burst_splatter_003/burst_splatter_003_large_green", frame_mode="best", fit=72, padding=0),
        IconSource("generated", "arrow", frame_mode="index", frame_index=0, fit=60),
    ),
    (
        IconSource("super_pixel", "Sci-fi/scifi_warp_003/scifi_warp_003_large_blue", frame_mode="best", fit=60),
        IconSource("super_pixel", "Impacts/symmetrical_impact_002/symmetrical_impact_002_large_blue", frame_mode="index", frame_index=1, fit=60),
        IconSource("super_pixel", "Sci-fi/scifi_charge_up_001/scifi_charge_up_001_large_yellow", frame_mode="index", frame_index=4, fit=62),
        IconSource("spells", "Fire Hit", frame_mode="best", fit=60),
    ),
    (
        IconSource("spells", "Energy Pillar", frame_mode="best", fit=62),
        IconSource("spells", "Power Burst", frame_mode="index", frame_index=4, fit=58),
        IconSource("spells", "Magic Vortex", frame_mode="index", frame_index=2, fit=58),
        IconSource("spells", "Blue Orb", frame_mode="best", fit=58),
    ),
)


def require_archive(kind: str) -> Path:
    if kind == "spells":
        candidates = [
            os.environ.get("SPELLS_FX_ZIP"),
            Path.home() / "Downloads" / "SpellsFX2.0.zip",
            Path.home() / "Desktop" / "game_pixel" / "SpellsFX2.0.zip",
        ]
        label = "SpellsFX2.0.zip"
    elif kind == "super_pixel":
        candidates = [
            os.environ.get("SUPER_PIXEL_FX_ZIP"),
            Path.home() / "Desktop" / "game_pixel" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip",
            Path.home() / "Desktop" / "game_pixel" / "world" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip",
            Path.home() / "Downloads" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip",
        ]
        label = "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip"
    elif kind == "combat":
        candidates = [
            os.environ.get("COMBAT_FX_ZIP"),
            Path.home() / "Desktop" / "game_pixel" / "Combat FX 1.1.zip",
            Path.home() / "Downloads" / "Combat FX 1.1.zip",
        ]
        label = "Combat FX 1.1.zip"
    elif kind == "effect_fx":
        candidates = [
            os.environ.get("EFFECT_FX_ZIP"),
            os.environ.get("RPG_EFFECT_FX_ZIP"),
            Path.home() / "Desktop" / "game_pixel" / "Effect and FX Pixel All Free.zip",
            Path.home() / "Downloads" / "Effect and FX Pixel All Free.zip",
        ]
        label = "Effect and FX Pixel All Free.zip"
    else:
        raise ValueError(f"Unsupported icon archive kind: {kind}")

    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if path.exists():
            return path
    raise SystemExit(f"Missing {label}; this icon sheet intentionally has no fallback source.")


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def visible_spells_frames(archive: ZipFile, source: str) -> list[Image.Image]:
    source_file = f"Spritesheet/{source}.png"
    if source_file not in archive.namelist():
        raise FileNotFoundError(f"Missing SpellsFX icon source: {source_file}")

    with archive.open(source_file) as file:
        sheet = Image.open(file).convert("RGBA")

    columns = sheet.width // SPELLS_CELL
    rows = sheet.height // SPELLS_CELL
    if sheet.size != (columns * SPELLS_CELL, rows * SPELLS_CELL):
        raise ValueError(f"{source_file} does not divide into {SPELLS_CELL}px cells")

    frames: list[Image.Image] = []
    for row in range(rows):
        for column in range(columns):
            frame = sheet.crop(
                (
                    column * SPELLS_CELL,
                    row * SPELLS_CELL,
                    (column + 1) * SPELLS_CELL,
                    (row + 1) * SPELLS_CELL,
                )
            )
            if alpha_bbox(frame):
                frames.append(frame)
    if not frames:
        raise ValueError(f"{source_file} has no visible frames")
    return frames


def visible_super_pixel_frames(archive: ZipFile, source: str) -> list[Image.Image]:
    prefix = f"{SUPER_PIXEL_ROOT}/{source}/"
    names = sorted(name for name in archive.namelist() if name.startswith(prefix) and name.endswith(".png"))
    if not names:
        raise FileNotFoundError(f"Missing Super Pixel icon sequence: {source}")

    frames: list[Image.Image] = []
    for name in names:
        with archive.open(name) as file:
            frame = Image.open(file).convert("RGBA")
        if alpha_bbox(frame):
            frames.append(frame)
    if not frames:
        raise ValueError(f"{source} has no visible frames")
    return frames


def visible_combat_frames(archive: ZipFile, source: str) -> list[Image.Image]:
    if COMBAT_FX_SOURCE_SHEET not in archive.namelist():
        raise FileNotFoundError(f"Missing Combat FX icon sheet: {COMBAT_FX_SOURCE_SHEET}")
    try:
        source_row = int(source)
    except ValueError as error:
        raise ValueError(f"Combat FX icon source must be a 1-based row number, got {source!r}") from error
    if source_row < 1:
        raise ValueError(f"Combat FX icon source row must be >= 1, got {source_row}")

    with archive.open(COMBAT_FX_SOURCE_SHEET) as file:
        sheet = Image.open(file).convert("RGBA")

    row = source_row - 1
    if row >= sheet.height // COMBAT_FX_CELL:
        raise ValueError(f"Combat FX row {source_row} is out of range for {COMBAT_FX_SOURCE_SHEET}")

    frames: list[Image.Image] = []
    for column in range(COMBAT_FX_COLUMNS):
        frame = sheet.crop(
            (
                column * COMBAT_FX_CELL,
                row * COMBAT_FX_CELL,
                (column + 1) * COMBAT_FX_CELL,
                (row + 1) * COMBAT_FX_CELL,
            )
        )
        if alpha_bbox(frame):
            frames.append(frame)
    if not frames:
        raise ValueError(f"Combat FX row {source_row} has no visible frames")
    return frames


def visible_effect_fx_frames(archive: ZipFile, source: str) -> list[Image.Image]:
    source_file, _, row_value = source.partition("#")
    if source_file not in archive.namelist():
        raise FileNotFoundError(f"Missing Effect/FX icon source: {source_file}")
    if not row_value:
        raise ValueError(f"Effect/FX icon source must include a row suffix like path/to/sheet.png#3: {source!r}")
    source_row = int(row_value)

    with archive.open(source_file) as file:
        sheet = Image.open(file).convert("RGBA")

    columns = sheet.width // EFFECT_FX_CELL
    rows = sheet.height // EFFECT_FX_CELL
    if sheet.size != (columns * EFFECT_FX_CELL, rows * EFFECT_FX_CELL):
        raise ValueError(f"{source_file} does not divide into {EFFECT_FX_CELL}px cells")
    if not 0 <= source_row < rows:
        raise ValueError(f"Effect/FX row {source_row} is out of range for {source_file}")

    frames: list[Image.Image] = []
    for column in range(columns):
        frame = sheet.crop(
            (
                column * EFFECT_FX_CELL,
                source_row * EFFECT_FX_CELL,
                (column + 1) * EFFECT_FX_CELL,
                (source_row + 1) * EFFECT_FX_CELL,
            )
        )
        if alpha_bbox(frame):
            frames.append(frame)
    if not frames:
        raise ValueError(f"{source_file} row {source_row} has no visible frames")
    return frames


def visible_generated_frames(source: str) -> list[Image.Image]:
    if source not in GENERATED_OBJECT_GRID:
        raise FileNotFoundError(f"Missing generated object icon source: {source}")
    sheet_path = ASSET_DIR / "combat-objects.png"
    if not sheet_path.exists():
        raise FileNotFoundError(f"Missing generated object sheet: {sheet_path}")

    sheet = Image.open(sheet_path).convert("RGBA")
    cell_w = sheet.width // GRID
    cell_h = sheet.height // GRID
    column, row = GENERATED_OBJECT_GRID[source]
    frame = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
    if not alpha_bbox(frame):
        raise ValueError(f"Generated object source {source} has no visible pixels")
    return [frame]


def frame_score(frame: Image.Image) -> float:
    bbox = alpha_bbox(frame)
    if bbox is None:
        return -1

    opaque = 0
    bright = 0
    saturated = 0
    for red, green, blue, alpha in frame.getdata():
        if alpha <= 16:
            continue
        opaque += 1
        if max(red, green, blue) > 180:
            bright += 1
        if max(red, green, blue) - min(red, green, blue) > 50:
            saturated += 1

    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    return opaque + bright * 0.4 + saturated * 0.22 + width * height * 0.12


def select_frame(frames: list[Image.Image], source: IconSource) -> Image.Image:
    if source.frame_mode == "best":
        return max(frames, key=frame_score)
    if source.frame_mode == "index":
        index = max(0, min(len(frames) - 1, source.frame_index))
        return frames[index]
    if source.frame_mode == "percent":
        index = round(max(0, min(1, source.frame_percent)) * (len(frames) - 1))
        return frames[index]
    raise ValueError(f"Unsupported frame mode: {source.frame_mode}")


def icon_frame(source: IconSource, archives: dict[str, ZipFile]) -> Image.Image:
    if source.archive == "spells":
        archive = archives[source.archive]
        frames = visible_spells_frames(archive, source.source)
    elif source.archive == "super_pixel":
        archive = archives[source.archive]
        frames = visible_super_pixel_frames(archive, source.source)
    elif source.archive == "combat":
        archive = archives[source.archive]
        frames = visible_combat_frames(archive, source.source)
    elif source.archive == "effect_fx":
        archive = archives[source.archive]
        frames = visible_effect_fx_frames(archive, source.source)
    elif source.archive == "generated":
        frames = visible_generated_frames(source.source)
    else:
        raise ValueError(f"Unsupported icon archive kind: {source.archive}")
    return select_frame(frames, source)


def render_icon(source: IconSource, archives: dict[str, ZipFile]) -> Image.Image:
    frame = icon_frame(source, archives)
    bbox = alpha_bbox(frame)
    if bbox is None:
        raise ValueError(f"{source.source}: empty icon source")

    crop = frame.crop(
        (
            max(0, bbox[0] - source.padding),
            max(0, bbox[1] - source.padding),
            min(frame.width, bbox[2] + source.padding),
            min(frame.height, bbox[3] + source.padding),
        )
    )

    scale = min(source.fit / crop.width, source.fit / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(size, Image.Resampling.NEAREST)

    output = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    x = (CELL - crop.width) // 2 + source.x_offset
    y = (CELL - crop.height) // 2 + source.y_offset
    output.alpha_composite(crop, (x, y))
    return enforce_safe_margin(output)


def enforce_safe_margin(icon: Image.Image) -> Image.Image:
    bbox = alpha_bbox(icon)
    if bbox is None:
        return icon

    left, top, right, bottom = bbox
    margin = min(left, top, CELL - right, CELL - bottom)
    if margin >= SAFE_MARGIN:
        return icon

    crop = icon.crop(bbox)
    max_size = CELL - SAFE_MARGIN * 2
    scale = min(max_size / crop.width, max_size / crop.height, 1)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(size, Image.Resampling.NEAREST)

    output = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    output.alpha_composite(crop, ((CELL - crop.width) // 2, (CELL - crop.height) // 2))
    return output


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    archives: dict[str, ZipFile] = {}
    try:
        archives["spells"] = ZipFile(require_archive("spells"))
        archives["super_pixel"] = ZipFile(require_archive("super_pixel"))
        archives["combat"] = ZipFile(require_archive("combat"))
        archives["effect_fx"] = ZipFile(require_archive("effect_fx"))

        sheet = Image.new("RGBA", (CELL * GRID, CELL * GRID), (0, 0, 0, 0))
        for row, icon_row in enumerate(ICONS):
            for column, source in enumerate(icon_row):
                sheet.alpha_composite(render_icon(source, archives), (column * CELL, row * CELL))
        sheet.save(OUT)
    finally:
        for archive in archives.values():
            archive.close()


if __name__ == "__main__":
    main()

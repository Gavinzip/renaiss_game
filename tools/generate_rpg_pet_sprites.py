#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
SOURCE_ASSET_DIR = ROOT / "tools" / "assets" / "generated-sources"
PET_OUT = ASSET_DIR / "rpg-pet-sprites.png"
ARENA_OUT = ASSET_DIR / "rpg-battle-arena.png"
PET_SOURCE = SOURCE_ASSET_DIR / "rpg-pet-source-v2.png"
APPROVED_ROUNDBIRD_PET_SHEET = ROOT / "tools" / "assets" / "pets" / "rpg-pet-sprites-roundbird-v15-side-fullbody.png"

CELL = 128
PET_COLUMNS = 18
PET_ROWS = 5

Color = tuple[int, int, int, int]


def rgba(hex_color: str, alpha: int = 255) -> Color:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


INK = rgba("#160d09")
INK_SOFT = rgba("#2a1810")
SHADOW = rgba("#080604", 108)
WHITE = rgba("#fff8db")
CREAM = rgba("#f6dfac")
SPARK = rgba("#fff0a8")


@dataclass(frozen=True)
class PetDesign:
    element: str
    main: Color
    mid: Color
    light: Color
    dark: Color
    accent: Color
    eye: Color
    mane: Color
    ring: Color
    trim: Color
    core: Color


DESIGNS: tuple[PetDesign, ...] = (
    PetDesign("water", rgba("#4fc9ff"), rgba("#1b79c9"), rgba("#e8fbff"), rgba("#103869"), rgba("#7de9ff"), rgba("#08355d"), rgba("#f1fbff"), rgba("#30c5ff", 190), rgba("#1960a7"), rgba("#baf7ff")),
    PetDesign("fire", rgba("#ff7a2f"), rgba("#c83a20"), rgba("#ffe082"), rgba("#6f1c12"), rgba("#ffef91"), rgba("#2b100b"), rgba("#fff0bd"), rgba("#ff6b25", 190), rgba("#8d2515"), rgba("#ffd256")),
    PetDesign("grass", rgba("#75d24b"), rgba("#2f963c"), rgba("#f0ff9c"), rgba("#1f5b2a"), rgba("#c8f06b"), rgba("#10270e"), rgba("#f2e59b"), rgba("#9df25b", 184), rgba("#3fb75a"), rgba("#fff3a7")),
    PetDesign("dark", rgba("#735ee6"), rgba("#31237f"), rgba("#d8cdff"), rgba("#15122e"), rgba("#8ef0ff"), rgba("#080511"), rgba("#c9bcff"), rgba("#8a6bff", 178), rgba("#4d37ba"), rgba("#b9fff8")),
    PetDesign("light", rgba("#ffd96f"), rgba("#d39b3c"), rgba("#fff8be"), rgba("#7a551c"), rgba("#cffff7"), rgba("#3b2609"), rgba("#fff2b0"), rgba("#ffe879", 180), rgba("#b97e2e"), rgba("#ffffff")),
)


def rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, fill: Color) -> None:
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=fill)


def line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: Color, width: int = 1) -> None:
    draw.line(points, fill=fill, width=width)


def poly(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: Color) -> None:
    draw.polygon(points, fill=fill)


def ellipse(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: Color, outline: Color = INK, width: int = 3) -> None:
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=outline)
    draw.ellipse((cx - max(1, rx - width), cy - max(1, ry - width), cx + max(1, rx - width), cy + max(1, ry - width)), fill=fill)


def outlined_poly(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: Color, outline: Color = INK, width: int = 3) -> None:
    draw.polygon(points, fill=fill)
    draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def diamond(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: Color, outline: Color = INK) -> None:
    poly(draw, [(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)], outline)
    poly(draw, [(cx, cy - ry + 2), (cx + rx - 2, cy), (cx, cy + ry - 2), (cx - rx + 2, cy)], fill)


def sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, fill: Color) -> None:
    rect(draw, cx - 1, cy - radius, 2, radius * 2 + 1, fill)
    rect(draw, cx - radius, cy - 1, radius * 2 + 1, 2, fill)
    if radius >= 4:
        rect(draw, cx - radius + 1, cy - radius + 1, 1, 1, fill)
        rect(draw, cx + radius - 1, cy - radius + 1, 1, 1, fill)
        rect(draw, cx - radius + 1, cy + radius - 1, 1, 1, fill)
        rect(draw, cx + radius - 1, cy + radius - 1, 1, 1, fill)


def pose_for_column(column: int) -> tuple[str, int]:
    if column < 4:
        return "idle", column
    if column < 8:
        return "walk", column - 4
    if column < 13:
        return "attack", column - 8
    if column < 16:
        return "hit", column - 13
    return "faint", column - 16


def pose_offsets(pose: str, frame: int, side: int = 1) -> tuple[int, int, int]:
    if pose == "idle":
        return 0, (-2 if frame in (1, 2) else 0), frame
    if pose == "walk":
        return ((frame % 4) - 1) * side, -2 if frame % 2 else 0, frame
    if pose == "attack":
        return [0, 5, 13, 18, 7][frame] * side, [-1, 1, -3, -1, 0][frame], frame
    if pose == "hit":
        return [-7, 3, -3][frame] * side, [2, -1, 1][frame], frame
    return 0, 11 + frame * 3, frame


def draw_ground_ring(draw: ImageDraw.ImageDraw, cx: int, cy: int, design: PetDesign, pose: str) -> None:
    return


def draw_eyes(draw: ImageDraw.ImageDraw, cx: int, cy: int, design: PetDesign, faint: bool = False) -> None:
    if faint:
        line(draw, [(cx - 11, cy - 1), (cx - 4, cy + 6)], INK_SOFT, 2)
        line(draw, [(cx - 4, cy - 1), (cx - 11, cy + 6)], INK_SOFT, 2)
        line(draw, [(cx + 5, cy - 1), (cx + 12, cy + 6)], INK_SOFT, 2)
        line(draw, [(cx + 12, cy - 1), (cx + 5, cy + 6)], INK_SOFT, 2)
        return
    ellipse(draw, cx - 11, cy, 6, 8, WHITE, INK, 2)
    ellipse(draw, cx + 10, cy, 6, 8, WHITE, INK, 2)
    ellipse(draw, cx - 10, cy + 1, 3, 5, design.eye, design.eye, 1)
    ellipse(draw, cx + 9, cy + 1, 3, 5, design.eye, design.eye, 1)
    rect(draw, cx - 12, cy - 3, 4, 3, WHITE)
    rect(draw, cx + 7, cy - 3, 4, 3, WHITE)
    rect(draw, cx - 7, cy + 4, 2, 2, rgba("#120909", 220))
    rect(draw, cx + 12, cy + 4, 2, 2, rgba("#120909", 220))


def draw_face_marks(draw: ImageDraw.ImageDraw, cx: int, cy: int, design: PetDesign) -> None:
    rect(draw, cx - 2, cy + 9, 4, 3, design.dark)
    line(draw, [(cx - 18, cy + 7), (cx - 25, cy + 10)], design.accent, 2)
    line(draw, [(cx + 18, cy + 7), (cx + 25, cy + 10)], design.accent, 2)
    line(draw, [(cx - 15, cy + 13), (cx - 23, cy + 16)], CREAM, 1)
    line(draw, [(cx + 15, cy + 13), (cx + 23, cy + 16)], CREAM, 1)


def draw_leaf(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: Color, tilt: int = 0) -> None:
    outlined_poly(draw, [(cx, cy - ry), (cx + rx + tilt, cy), (cx, cy + ry), (cx - rx + tilt, cy)], fill, INK, 2)
    line(draw, [(cx - tilt // 2, cy - ry + 3), (cx + tilt // 2, cy + ry - 3)], rgba("#f7ffaf", 210), 1)


def draw_tail(draw: ImageDraw.ImageDraw, bx: int, by: int, design: PetDesign, pose: str, frame: int) -> None:
    wiggle = [-3, -1, 2, 4, 1][frame % 5]
    if pose == "faint":
        wiggle = 5

    if design.element == "water":
        line(draw, [(bx - 18, by + 5), (bx - 42, by + 0 + wiggle), (bx - 55, by - 16), (bx - 36, by - 22), (bx - 23, by - 7)], INK, 12)
        line(draw, [(bx - 18, by + 5), (bx - 41, by + 0 + wiggle), (bx - 52, by - 14), (bx - 36, by - 18), (bx - 24, by - 6)], design.mid, 8)
        line(draw, [(bx - 42, by - 2 + wiggle), (bx - 35, by - 7), (bx - 43, by - 13)], design.light, 3)
        line(draw, [(bx - 38, by + 6 + wiggle), (bx - 26, by + 2)], design.accent, 2)
        for drop in ((bx - 56, by - 24 + wiggle), (bx - 50, by + 5), (bx - 30, by - 22)):
            ellipse(draw, drop[0], drop[1], 3, 5, design.accent, rgba("#0b3b61"), 1)
        return

    if design.element == "fire":
        flames = [
            [(bx - 18, by + 9), (bx - 42, by + 2 + wiggle), (bx - 55, by - 29 + wiggle), (bx - 31, by - 17), (bx - 19, by - 3)],
            [(bx - 12, by + 10), (bx - 34, by + 10), (bx - 45, by - 7 + wiggle), (bx - 27, by - 4), (bx - 16, by + 5)],
        ]
        for pts in flames:
            outlined_poly(draw, pts, design.main, INK, 3)
        outlined_poly(draw, [(bx - 36, by - 4), (bx - 47, by - 22 + wiggle), (bx - 31, by - 13), (bx - 24, by - 1)], design.light, rgba("#8c2614"), 2)
        outlined_poly(draw, [(bx - 25, by + 6), (bx - 36, by - 5 + wiggle), (bx - 23, by - 1), (bx - 18, by + 7)], design.core, rgba("#8c2614"), 2)
        return

    if design.element == "grass":
        line(draw, [(bx - 16, by + 8), (bx - 34, by + 2), (bx - 48, by - 12 + wiggle)], INK, 6)
        line(draw, [(bx - 16, by + 8), (bx - 34, by + 2), (bx - 47, by - 11 + wiggle)], design.trim, 3)
        draw_leaf(draw, bx - 50, by - 17 + wiggle, 12, 17, design.light, -4)
        draw_leaf(draw, bx - 35, by - 12, 10, 15, design.main, 5)
        draw_leaf(draw, bx - 43, by + 5, 11, 14, design.accent, -2)
        for seed in ((bx - 58, by - 8), (bx - 29, by - 18), (bx - 54, by + 12)):
            sparkle(draw, seed[0], seed[1], 3, design.core)
        return

    if design.element == "dark":
        line(draw, [(bx - 17, by + 8), (bx - 37, by + 8), (bx - 54, by - 5 + wiggle), (bx - 43, by - 18)], INK, 10)
        line(draw, [(bx - 17, by + 8), (bx - 37, by + 8), (bx - 52, by - 4 + wiggle), (bx - 42, by - 15)], design.mid, 6)
        line(draw, [(bx - 39, by + 4), (bx - 50, by - 6 + wiggle)], design.main, 3)
        draw.arc((bx - 63, by - 26 + wiggle, bx - 35, by + 3 + wiggle), 75, 280, fill=design.accent, width=3)
        sparkle(draw, bx - 59, by - 10 + wiggle, 4, design.accent)
        return

    line(draw, [(bx - 18, by + 8), (bx - 36, by + 2), (bx - 51, by - 12 + wiggle)], INK, 8)
    line(draw, [(bx - 18, by + 8), (bx - 35, by + 2), (bx - 49, by - 10 + wiggle)], design.mid, 5)
    outlined_poly(draw, [(bx - 47, by - 20 + wiggle), (bx - 59, by - 5), (bx - 45, by + 1), (bx - 36, by - 10)], design.light, rgba("#81551b"), 2)
    outlined_poly(draw, [(bx - 36, by + 0), (bx - 50, by + 13), (bx - 33, by + 13), (bx - 25, by + 4)], design.core, rgba("#81551b"), 2)
    sparkle(draw, bx - 55, by - 22 + wiggle, 4, design.light)
    sparkle(draw, bx - 34, by - 14, 3, design.accent)


def draw_species_back_details(draw: ImageDraw.ImageDraw, hx: int, hy: int, bx: int, by: int, design: PetDesign, motion: int) -> None:
    sway = -1 if motion % 2 else 2
    if design.element == "water":
        for x, y, h in [(bx - 2, by - 21, 20), (bx + 7, by - 23, 25), (bx + 16, by - 20, 18)]:
            outlined_poly(draw, [(x, y), (x + 8, y - h + sway), (x + 15, y + 3)], design.light, rgba("#0a3a62"), 2)
        return
    if design.element == "fire":
        for x, y, h in [(hx - 8, hy - 15, 22), (hx + 3, hy - 21, 29), (hx + 14, hy - 15, 21)]:
            outlined_poly(draw, [(x, y + 7), (x + 5, y - h + sway), (x + 13, y + 8)], design.main, rgba("#782012"), 2)
            outlined_poly(draw, [(x + 4, y + 4), (x + 7, y - h + 7 + sway), (x + 10, y + 5)], design.core, rgba("#a33813"), 1)
        return
    if design.element == "grass":
        for x, y, rx, ry in [(hx - 24, hy + 4, 13, 19), (hx + 24, hy + 4, 13, 19), (hx, hy - 22, 9, 16)]:
            draw_leaf(draw, x, y + sway, rx, ry, design.light if x == hx else design.main, sway)
        return
    if design.element == "dark":
        outlined_poly(draw, [(hx - 15, hy - 14), (hx - 25, hy - 32 + sway), (hx - 7, hy - 23)], design.light, INK, 2)
        outlined_poly(draw, [(hx + 16, hy - 13), (hx + 29, hy - 28 + sway), (hx + 25, hy - 4)], design.light, INK, 2)
        draw.arc((hx - 7, hy - 35 + sway, hx + 23, hy - 7 + sway), 188, 350, fill=design.accent, width=3)
        return
    outlined_poly(draw, [(hx - 21, hy + 3), (hx - 36, hy - 8 + sway), (hx - 25, hy + 17)], design.core, rgba("#80551c"), 2)
    outlined_poly(draw, [(hx + 24, hy + 3), (hx + 39, hy - 7 + sway), (hx + 29, hy + 17)], design.core, rgba("#80551c"), 2)
    draw.arc((hx - 20, hy - 36 + sway, hx + 20, hy - 7 + sway), 185, 355, fill=design.light, width=3)


def draw_body_markings(draw: ImageDraw.ImageDraw, bx: int, by: int, design: PetDesign) -> None:
    if design.element == "water":
        for offset in (-13, 0, 13):
            draw.arc((bx + offset - 6, by - 8, bx + offset + 7, by + 8), 210, 30, fill=design.light, width=2)
        return
    if design.element == "fire":
        outlined_poly(draw, [(bx - 9, by - 2), (bx - 4, by - 13), (bx + 1, by - 2), (bx - 3, by + 6)], design.core, rgba("#8c2614"), 1)
        outlined_poly(draw, [(bx + 8, by + 2), (bx + 12, by - 8), (bx + 17, by + 1), (bx + 12, by + 7)], design.light, rgba("#8c2614"), 1)
        return
    if design.element == "grass":
        line(draw, [(bx - 13, by - 5), (bx - 4, by + 2), (bx - 14, by + 7)], design.light, 2)
        draw_leaf(draw, bx + 9, by - 3, 5, 9, design.accent, 2)
        return
    if design.element == "dark":
        draw.arc((bx - 15, by - 9, bx + 7, by + 12), 220, 60, fill=design.accent, width=2)
        line(draw, [(bx + 7, by - 8), (bx + 15, by + 6)], design.light, 2)
        return
    sparkle(draw, bx - 9, by - 4, 4, design.core)
    diamond(draw, bx + 9, by + 1, 4, 6, design.accent, rgba("#80551c"))


def draw_head_details(draw: ImageDraw.ImageDraw, hx: int, hy: int, design: PetDesign, motion: int) -> None:
    ear_sway = -2 if motion % 2 else 1
    if design.element == "water":
        outlined_poly(draw, [(hx - 24, hy - 13), (hx - 36, hy - 38 + ear_sway), (hx - 12, hy - 24)], design.light, INK, 3)
        outlined_poly(draw, [(hx + 22, hy - 13), (hx + 37, hy - 35 - ear_sway), (hx + 34, hy - 7)], design.light, INK, 3)
        diamond(draw, hx, hy - 22, 6, 8, design.accent, rgba("#0a3a62"))
        return
    if design.element == "fire":
        outlined_poly(draw, [(hx - 25, hy - 11), (hx - 35, hy - 36 + ear_sway), (hx - 10, hy - 21)], design.main, INK, 3)
        outlined_poly(draw, [(hx + 21, hy - 12), (hx + 36, hy - 36 - ear_sway), (hx + 33, hy - 7)], design.main, INK, 3)
        outlined_poly(draw, [(hx - 6, hy - 20), (hx, hy - 39 + ear_sway), (hx + 9, hy - 20)], design.core, rgba("#8c2614"), 2)
        return
    if design.element == "grass":
        outlined_poly(draw, [(hx - 23, hy - 12), (hx - 36, hy - 33 + ear_sway), (hx - 10, hy - 22)], design.main, INK, 3)
        outlined_poly(draw, [(hx + 20, hy - 12), (hx + 35, hy - 32 - ear_sway), (hx + 33, hy - 5)], design.main, INK, 3)
        draw_leaf(draw, hx, hy - 27 + ear_sway, 9, 16, design.light, 0)
        return
    if design.element == "dark":
        outlined_poly(draw, [(hx - 24, hy - 11), (hx - 35, hy - 34 + ear_sway), (hx - 8, hy - 22)], design.mid, INK, 3)
        outlined_poly(draw, [(hx + 20, hy - 12), (hx + 34, hy - 32 - ear_sway), (hx + 31, hy - 6)], design.mid, INK, 3)
        draw.arc((hx - 6, hy - 35 + ear_sway, hx + 19, hy - 12 + ear_sway), 175, 335, fill=design.accent, width=3)
        return
    outlined_poly(draw, [(hx - 23, hy - 10), (hx - 34, hy - 31 + ear_sway), (hx - 9, hy - 20)], design.light, INK, 3)
    outlined_poly(draw, [(hx + 21, hy - 10), (hx + 34, hy - 31 - ear_sway), (hx + 31, hy - 4)], design.light, INK, 3)
    diamond(draw, hx, hy - 24, 7, 11, design.core, rgba("#80551c"))


def draw_standard_pet(draw: ImageDraw.ImageDraw, design: PetDesign, pose: str, frame: int) -> None:
    dx, dy, motion = pose_offsets(pose, frame)
    bx = 59 + dx
    by = 79 + dy
    hx = 78 + dx
    hy = 48 + dy
    if pose == "walk":
        hx += -1 if frame in (0, 3) else 1
    if pose == "attack":
        hx += [0, 4, 8, 11, 3][frame]
        by += [2, 1, -1, 0, 1][frame]

    draw_ground_ring(draw, 64, 106, design, pose)
    draw_tail(draw, bx, by, design, pose, motion)
    draw_species_back_details(draw, hx, hy, bx, by, design, motion)

    # Rear legs, body, and chest silhouette.
    rear_step = 3 if pose == "walk" and frame in (1, 2) else 0
    front_step = 3 if pose == "walk" and frame in (0, 3) else 0
    outlined_poly(draw, [(bx - 23, by + 16), (bx - 17, by + 34 + rear_step), (bx - 9, by + 34 + rear_step), (bx - 9, by + 15)], design.dark, INK, 3)
    outlined_poly(draw, [(bx + 13, by + 14), (bx + 18, by + 34 + front_step), (bx + 28, by + 34 + front_step), (bx + 25, by + 13)], design.dark, INK, 3)
    ellipse(draw, bx, by + 2, 33, 24, design.mid, INK, 4)
    ellipse(draw, bx + 12, by - 5, 23, 19, design.main, INK, 3)
    draw_body_markings(draw, bx, by, design)

    # Manga-style large head with readable ears, hair, face, and jewelry.
    draw_head_details(draw, hx, hy, design, motion)
    for offset, spike in [(-17, 15), (-8, 20), (2, 22), (12, 17)]:
        outlined_poly(draw, [(hx + offset, hy - 12), (hx + offset + 5, hy - 12 - spike), (hx + offset + 12, hy - 9)], design.mane if offset % 2 else design.light, INK, 2)
    ellipse(draw, hx, hy, 29, 25, design.main, INK, 4)
    ellipse(draw, hx + 3, hy + 10, 17, 11, CREAM if design.element != "dark" else rgba("#c8bbff"), INK_SOFT, 2)
    draw_eyes(draw, hx, hy + 1, design)
    draw_face_marks(draw, hx + 2, hy + 3, design)
    diamond(draw, hx + 1, hy - 18, 5, 7, design.accent, INK_SOFT)

    # Front paws and small costume accent.
    outlined_poly(draw, [(bx + 24, by + 7), (bx + 36, by + 19), (bx + 32, by + 27), (bx + 18, by + 15)], design.main, INK, 3)
    outlined_poly(draw, [(bx + 0, by + 14), (bx + 7, by + 31), (bx + 16, by + 30), (bx + 10, by + 12)], design.main, INK, 3)
    diamond(draw, bx + 14, by + 20, 5, 6, design.accent, INK_SOFT)

    if pose == "attack":
        reach = [20, 31, 43, 51, 30][frame]
        line(draw, [(hx + 18, hy + 9), (hx + reach, hy - 4), (hx + reach + 16, hy + 2)], design.accent, 4)
        line(draw, [(hx + 23, hy + 22), (hx + reach + 18, hy + 16)], design.light, 3)
        sparkle(draw, hx + reach + 21, hy - 1, 6, design.core)
        if frame >= 2:
            draw.arc((hx + 25, hy - 13, hx + 70, hy + 32), 210, 35, fill=design.accent, width=3)
    if pose == "hit":
        rect(draw, hx + 27, hy - 20, 5, 5, design.light)
        rect(draw, hx + 36, hy - 10, 4, 4, design.accent)
        line(draw, [(hx + 21, hy - 18), (hx + 34, hy - 27)], rgba("#fff4b0"), 2)


def draw_fainted_pet(draw: ImageDraw.ImageDraw, design: PetDesign, frame: int) -> None:
    sink = frame * 3
    draw_ground_ring(draw, 64, 108, design, "faint")
    bx, by = 60, 91 + sink
    draw_tail(draw, bx, by, design, "faint", frame)
    ellipse(draw, bx - 2, by + 2, 35, 18, design.mid, INK, 4)
    ellipse(draw, bx + 30, by - 3, 23, 17, design.main, INK, 4)
    ellipse(draw, bx + 35, by + 3, 13, 8, CREAM if design.element != "dark" else rgba("#c8bbff"), INK_SOFT, 2)
    draw_eyes(draw, bx + 31, by - 2, design, True)
    rect(draw, bx + 20, by + 17, 10, 5, design.dark)
    if design.element in ("light", "grass"):
        sparkle(draw, bx + 4, by - 20, 3, design.light)


def draw_pet(cell: Image.Image, design: PetDesign, column: int) -> None:
    draw = ImageDraw.Draw(cell, "RGBA")
    pose, frame = pose_for_column(column)
    if pose == "faint":
        draw_fainted_pet(draw, design, frame)
        return
    draw_standard_pet(draw, design, pose, frame)


def remove_pet_source_chroma(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    pixels = source.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = pixels[x, y]
            is_magenta_key = a > 18 and r > 170 and b > 150 and g < 115 and r + b > g * 4
            if is_magenta_key:
                pixels[x, y] = (0, 0, 0, 0)
    return source


def alpha_bbox(image: Image.Image, threshold: int = 18) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def fit_source_pet(crop: Image.Image) -> Image.Image:
    box = alpha_bbox(crop)
    if not box:
        raise ValueError("empty pet crop")

    left, top, right, bottom = box
    left = max(0, left - 12)
    top = max(0, top - 12)
    right = min(crop.width, right + 12)
    bottom = min(crop.height, bottom + 12)
    pet = crop.crop((left, top, right, bottom))

    scale = min(108 / pet.width, 102 / pet.height)
    width = max(1, round(pet.width * scale))
    height = max(1, round(pet.height * scale))
    pet = pet.resize((width, height), Image.Resampling.NEAREST)

    frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    frame.alpha_composite(pet, ((CELL - width) // 2, 115 - height))
    return frame


def load_pet_sources() -> list[Image.Image]:
    if not PET_SOURCE.exists():
        raise FileNotFoundError(f"missing pet source sheet: {PET_SOURCE}")

    source = remove_pet_source_chroma(Image.open(PET_SOURCE))
    pets: list[Image.Image] = []
    for index in range(PET_ROWS):
        left = round(index * source.width / PET_ROWS)
        right = round((index + 1) * source.width / PET_ROWS)
        slot = source.crop((left, 0, right, source.height))
        pets.append(fit_source_pet(slot))
    return pets


def transformed_pet_content(base: Image.Image, scale_x: float = 1, scale_y: float = 1, rotation: int = 0) -> Image.Image:
    box = alpha_bbox(base)
    if not box:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))

    content = base.crop(box)
    width = max(1, round(content.width * scale_x))
    height = max(1, round(content.height * scale_y))
    content = content.resize((width, height), Image.Resampling.NEAREST)
    if rotation:
        content = content.rotate(rotation, expand=True, resample=Image.Resampling.NEAREST)
    return content


def draw_ai_pet_fx(draw: ImageDraw.ImageDraw, design: PetDesign, pose: str, frame: int, front: bool = False) -> None:
    if pose in ("idle", "walk") and frame % 2 == 1 and front:
        if design.element == "water":
            ellipse(draw, 24, 56 - frame, 3, 5, design.accent, rgba("#0b3b61"), 1)
            ellipse(draw, 107, 67 + frame, 2, 4, design.light, rgba("#0b3b61"), 1)
        elif design.element == "fire":
            outlined_poly(draw, [(18, 77), (23, 62 - frame), (29, 77), (23, 72)], design.core, rgba("#8c2614"), 1)
            sparkle(draw, 111, 51, 3, design.light)
        elif design.element == "grass":
            draw_leaf(draw, 21, 71, 5, 8, design.light, -1)
            draw_leaf(draw, 108, 54, 4, 7, design.accent, 1)
        elif design.element == "dark":
            draw.arc((15, 60, 37, 83), 90, 275, fill=design.accent, width=2)
            sparkle(draw, 108, 48, 3, design.accent)
        else:
            sparkle(draw, 20, 57, 4, design.core)
            draw.arc((95, 52, 121, 80), 188, 350, fill=design.light, width=2)

    if pose == "attack" and front:
        reach = [72, 79, 88, 93, 81][frame]
        if design.element == "water":
            draw.arc((reach - 42, 47, reach + 18, 97), 205, 28, fill=design.accent, width=5)
            draw.arc((reach - 34, 52, reach + 24, 92), 210, 34, fill=design.light, width=2)
        elif design.element == "fire":
            outlined_poly(draw, [(reach - 20, 83), (reach - 4, 47), (reach + 14, 83), (reach - 2, 72)], design.main, rgba("#8c2614"), 2)
            outlined_poly(draw, [(reach - 7, 78), (reach + 2, 56), (reach + 8, 78), (reach + 1, 72)], design.core, rgba("#8c2614"), 1)
        elif design.element == "grass":
            line(draw, [(reach - 34, 78), (reach + 13, 54)], design.trim, 4)
            draw_leaf(draw, reach + 15, 53, 7, 12, design.light, 2)
            draw_leaf(draw, reach - 12, 66, 6, 10, design.accent, -1)
        elif design.element == "dark":
            draw.arc((reach - 42, 43, reach + 13, 100), 210, 37, fill=design.accent, width=5)
            draw.arc((reach - 31, 49, reach + 22, 92), 207, 37, fill=design.light, width=2)
        else:
            draw.arc((reach - 48, 40, reach + 22, 99), 205, 35, fill=design.light, width=4)
            sparkle(draw, min(122, reach + 15), 49, 6, design.core)

    if pose == "hit" and front:
        for x, y in [(96, 42), (105, 59), (88, 73)]:
            sparkle(draw, x + frame * 2, y - frame, 4, rgba("#fff2ad"))
        line(draw, [(92, 47), (108, 36)], rgba("#fff2ad"), 2)


def draw_runtime_pet_silhouette(draw: ImageDraw.ImageDraw, design: PetDesign, pose: str, frame: int, center_x: int, bottom: int) -> None:
    if pose == "faint":
        return

    shift = center_x - 64
    bob = [-1, -2, -1, 0, -1][frame % 5]
    attack_push = 5 if pose == "attack" and frame >= 2 else 0
    hit_pull = -3 if pose == "hit" else 0
    x = shift + attack_push + hit_pull
    base_y = bottom - 48

    if design.element == "water":
        # Broad shell fins and a trailing wave push the aquatic read beyond a recolor.
        outlined_poly(draw, [(42 + x, base_y + 7 + bob), (23 + x, base_y - 10 + bob), (45 + x, base_y - 25 + bob), (55 + x, base_y + 1 + bob)], design.light, rgba("#0a3a62"), 2)
        outlined_poly(draw, [(85 + x, base_y + 5 - bob), (105 + x, base_y - 8 - bob), (96 + x, base_y + 20 - bob), (82 + x, base_y + 18 - bob)], design.accent, rgba("#0a3a62"), 2)
        draw.arc((18 + x, bottom - 42, 78 + x, bottom + 4), 205, 350, fill=design.accent, width=4)
        draw.arc((25 + x, bottom - 37, 72 + x, bottom - 3), 210, 345, fill=design.light, width=2)
        for px, py in ((28, base_y - 15), (108, base_y + 6), (24, bottom - 28)):
            ellipse(draw, px + x, py + bob, 2, 4, design.core, rgba("#0b3b61"), 1)
        return

    if design.element == "fire":
        # High back flames keep Emberfox readable in the field without covering the face.
        flames = (
            [(39 + x, bottom - 30), (31 + x, bottom - 64 + bob), (50 + x, bottom - 48), (54 + x, bottom - 23)],
            [(54 + x, bottom - 35), (62 + x, bottom - 78 + bob), (76 + x, bottom - 42), (69 + x, bottom - 24)],
            [(88 + x, bottom - 31), (104 + x, bottom - 60 - bob), (103 + x, bottom - 22), (91 + x, bottom - 18)],
        )
        for points in flames:
            outlined_poly(draw, points, design.main, rgba("#8c2614"), 2)
        outlined_poly(draw, [(59 + x, bottom - 33), (64 + x, bottom - 63 + bob), (72 + x, bottom - 39), (67 + x, bottom - 27)], design.core, rgba("#8c2614"), 1)
        outlined_poly(draw, [(34 + x, bottom - 27), (26 + x, bottom - 47 + bob), (43 + x, bottom - 36), (47 + x, bottom - 23)], design.light, rgba("#8c2614"), 1)
        return

    if design.element == "grass":
        # Branch antlers and leaf clusters make the grass pet's outline distinct.
        branch = rgba("#5d842e")
        line(draw, [(57 + x, base_y + 2), (47 + x, base_y - 19 + bob), (38 + x, base_y - 28 + bob)], branch, 4)
        line(draw, [(73 + x, base_y + 1), (86 + x, base_y - 18 - bob), (96 + x, base_y - 28 - bob)], branch, 4)
        for px, py, tilt in ((38, base_y - 31, -2), (48, base_y - 21, 2), (96, base_y - 31, 2), (84, base_y - 20, -1), (30, bottom - 27, -3), (104, bottom - 26, 3)):
            draw_leaf(draw, px + x, py, 5, 9, design.light, tilt)
        for px, py in ((28, bottom - 20), (101, bottom - 16)):
            ellipse(draw, px + x, py, 3, 3, rgba("#fff4bd"), rgba("#31591e"), 1)
            rect(draw, px + x - 1, py - 1, 2, 2, design.core)
        return

    if design.element == "dark":
        # Crescent crest and smoke ribbons give the dark pet a stronger rival silhouette.
        draw.arc((60 + x, base_y - 36 + bob, 106 + x, base_y + 10 + bob), 98, 290, fill=design.accent, width=6)
        draw.arc((69 + x, base_y - 30 + bob, 101 + x, base_y + 4 + bob), 102, 286, fill=design.light, width=2)
        draw.arc((21 + x, bottom - 55, 74 + x, bottom - 7), 104, 276, fill=design.mid, width=5)
        draw.arc((28 + x, bottom - 50, 73 + x, bottom - 12), 104, 274, fill=design.accent, width=2)
        for px, py in ((24, base_y + 7), (107, base_y - 10), (101, bottom - 19)):
            diamond(draw, px + x, py + bob, 3, 5, design.accent, rgba("#12102a"))
        return

    # Light pet receives broad wing feathers and halo pixels, visible behind the body at battle scale.
    outlined_poly(draw, [(43 + x, bottom - 34), (14 + x, bottom - 51 + bob), (27 + x, bottom - 12), (49 + x, bottom - 20)], design.core, rgba("#80551c"), 2)
    outlined_poly(draw, [(88 + x, bottom - 40), (118 + x, bottom - 57 - bob), (107 + x, bottom - 17), (84 + x, bottom - 20)], design.core, rgba("#80551c"), 2)
    for px in (22, 31, 103, 112):
        line(draw, [(px + x, bottom - 46 + bob), (px + x + (8 if px < 64 else -8), bottom - 23)], design.light, 2)
    draw.arc((45 + x, base_y - 35 + bob, 91 + x, base_y - 8 + bob), 190, 350, fill=design.light, width=4)
    sparkle(draw, 112 + x, base_y - 15, 4, design.light)


def draw_runtime_pet_signature(draw: ImageDraw.ImageDraw, design: PetDesign, pose: str, frame: int) -> None:
    """Add small in-game scale details that survive the 128px runtime crop."""
    if pose == "faint":
        if design.element == "water":
            ellipse(draw, 33, 103, 5, 3, design.accent, rgba("#0b3b61"), 1)
            ellipse(draw, 87, 112, 4, 3, design.light, rgba("#0b3b61"), 1)
        elif design.element == "fire":
            outlined_poly(draw, [(88, 103), (93, 90), (99, 104), (94, 99)], design.core, rgba("#8c2614"), 1)
        elif design.element == "grass":
            draw_leaf(draw, 31, 101, 5, 8, design.light, -1)
            draw_leaf(draw, 94, 110, 4, 7, design.accent, 1)
        elif design.element == "dark":
            draw.arc((24, 93, 48, 115), 88, 276, fill=design.accent, width=2)
        else:
            sparkle(draw, 91, 93, 4, design.light)
        return

    bob = [-1, -2, -1, 0, -1][frame % 5]

    def draw_runtime_polish() -> None:
        # Tiny high-contrast details are intentionally drawn after the source art;
        # they keep the pets readable when the 128px frame is displayed at HUD size.
        collar_y = 78 + bob // 2
        line(draw, [(57, collar_y), (67, collar_y + 3), (81, collar_y)], rgba("#1b100b", 210), 3)
        line(draw, [(58, collar_y - 1), (68, collar_y + 2), (80, collar_y - 1)], design.trim, 2)
        diamond(draw, 70, collar_y + 4, 4, 5, design.core, INK_SOFT)
        rect(draw, 74, 55 + bob, 2, 2, WHITE)
        rect(draw, 90, 55 + bob, 2, 2, WHITE)
        rect(draw, 48, 104, 3, 1, design.light)
        rect(draw, 63, 105, 3, 1, design.light)
        rect(draw, 84, 104, 3, 1, design.light)
        rect(draw, 98, 101, 3, 1, design.light)

        if design.element == "water":
            draw.arc((53, 71, 68, 86), 210, 40, fill=design.core, width=2)
            ellipse(draw, 55, 78, 2, 3, design.accent, rgba("#0b3b61"), 1)
        elif design.element == "fire":
            outlined_poly(draw, [(56, 85), (60, 73 + bob), (65, 85), (60, 82)], design.core, rgba("#8c2614"), 1)
        elif design.element == "grass":
            draw_leaf(draw, 58, 80, 4, 7, design.light, -1)
            draw_leaf(draw, 64, 83, 3, 6, design.accent, 1)
        elif design.element == "dark":
            diamond(draw, 59, 79, 3, 6, design.accent, rgba("#12102a"))
            line(draw, [(54, 87), (64, 91)], design.light, 2)
        else:
            sparkle(draw, 58, 78, 3, design.light)
            draw.arc((52, 71, 67, 88), 210, 35, fill=design.core, width=2)

    if design.element == "water":
        # Shell-fin crown and extra water beads make Tidefin read as aquatic at small scale.
        outlined_poly(draw, [(43, 58 + bob), (32, 50 + bob), (42, 44 + bob), (50, 52 + bob)], design.light, rgba("#0a3a62"), 2)
        outlined_poly(draw, [(83, 41 + bob), (94, 31 + bob), (96, 49 + bob), (86, 53 + bob)], design.accent, rgba("#0a3a62"), 2)
        draw.arc((24, 84, 62, 115), 200, 344, fill=design.accent, width=3)
        draw.arc((29, 89, 57, 110), 206, 340, fill=design.light, width=2)
        for x, y, r in ((26, 64 + bob, 3), (107, 54 - bob, 3), (99, 82, 2)):
            ellipse(draw, x, y, r, r + 2, design.accent, rgba("#0b3b61"), 1)
        draw_runtime_polish()
        return

    if design.element == "fire":
        # Emberfox keeps a sharp flame silhouette even when resized in the battle field.
        outlined_poly(draw, [(48, 57 + bob), (43, 38 + bob), (56, 51 + bob), (54, 66 + bob)], design.core, rgba("#8c2614"), 2)
        outlined_poly(draw, [(74, 38 + bob), (83, 19 + bob), (90, 42 + bob), (81, 49 + bob)], design.light, rgba("#8c2614"), 2)
        outlined_poly(draw, [(36, 81), (26, 67 + bob), (40, 72), (48, 87)], design.main, rgba("#8c2614"), 2)
        for x, y, r in ((103, 72, 4), (112, 53 + bob, 3), (25, 91, 3)):
            outlined_poly(draw, [(x, y + r), (x + r, y), (x, y - r * 2), (x - r, y)], design.core, rgba("#8c2614"), 1)
        draw_runtime_polish()
        return

    if design.element == "grass":
        # Leaf collar, antler tips, and flowers distinguish Mossling from the other fox bodies.
        draw_leaf(draw, 51, 53 + bob, 6, 10, design.light, -1)
        draw_leaf(draw, 83, 40 + bob, 6, 12, design.accent, 2)
        line(draw, [(61, 39 + bob), (54, 26 + bob), (49, 20 + bob)], design.trim, 3)
        line(draw, [(72, 39 + bob), (80, 26 + bob), (88, 21 + bob)], design.trim, 3)
        draw_leaf(draw, 47, 18 + bob, 4, 7, design.light, -1)
        draw_leaf(draw, 90, 19 + bob, 4, 7, design.light, 1)
        for x, y in ((32, 82), (92, 73), (105, 95)):
            ellipse(draw, x, y, 3, 3, rgba("#fff1bd"), rgba("#385d20"), 1)
            rect(draw, x - 1, y - 1, 2, 2, design.core)
        draw_runtime_polish()
        return

    if design.element == "dark":
        # Dark form gets a crescent crest and neon rune cuts, closer to a high-fantasy rival pet.
        draw.arc((68, 26 + bob, 100, 59 + bob), 102, 292, fill=design.accent, width=4)
        draw.arc((74, 30 + bob, 98, 53 + bob), 98, 286, fill=design.light, width=2)
        line(draw, [(39, 76), (51, 72), (58, 82)], design.accent, 3)
        line(draw, [(88, 75), (99, 64), (105, 78)], design.light, 2)
        for x, y in ((25, 67 + bob), (107, 49 - bob), (99, 99)):
            diamond(draw, x, y, 3, 5, design.accent, rgba("#12102a"))
        draw_runtime_polish()
        return

    # Light pet gets readable wing feathers and a small halo at runtime scale.
    draw.arc((50, 25 + bob, 91, 48 + bob), 190, 350, fill=design.light, width=3)
    outlined_poly(draw, [(40, 69), (22, 60 + bob), (36, 88), (48, 82)], design.core, rgba("#80551c"), 2)
    outlined_poly(draw, [(90, 60), (111, 51 + bob), (101, 80), (86, 77)], design.core, rgba("#80551c"), 2)
    line(draw, [(31, 66 + bob), (39, 82)], design.light, 2)
    line(draw, [(101, 58 + bob), (94, 75)], design.light, 2)
    for x, y, r in ((29, 49 + bob, 4), (109, 93, 3), (100, 38 - bob, 3)):
        sparkle(draw, x, y, r, design.light)
    draw_runtime_polish()


def draw_pose_keyframe_polish(draw: ImageDraw.ImageDraw, design: PetDesign, pose: str, frame: int) -> None:
    """Hand-keyed animation accents layered over the fitted source pet."""
    if pose == "idle":
        breath = [-1, -2, -1, 0][frame]
        for index in range(frame + 1):
            px = 100 + index * 4
            py = 52 + breath + (index % 2) * 5
            rect(draw, px, py, 2, 2, design.accent)
            if index % 2 == 0:
                rect(draw, px + 2, py + 2, 1, 1, design.light)
        if frame in (1, 3):
            sparkle(draw, 103, 40 + breath, 3, design.light)
        return

    if pose == "walk":
        paw_sets = (
            ((48, 107), (69, 111), (89, 106), (103, 109)),
            ((45, 110), (68, 106), (92, 110), (105, 106)),
            ((49, 106), (72, 111), (87, 107), (101, 111)),
            ((46, 109), (66, 107), (92, 106), (106, 110)),
        )
        for index, (x, y) in enumerate(paw_sets[frame]):
            color = design.light if index % 2 else design.trim
            rect(draw, x - 2, y, 5, 2, color)
            rect(draw, x - 1, y + 2, 3, 1, rgba("#120a07", 180))
        return

    if pose == "attack":
        charge = [0, 1, 2, 3, 1][frame]
        if frame == 0:
            diamond(draw, 82, 68, 5, 7, design.core, INK_SOFT)
            sparkle(draw, 95, 58, 4, design.light)
        elif frame == 1:
            draw.arc((27, 36, 96, 108), 235, 34, fill=design.trim, width=3)
            draw.arc((34, 43, 98, 103), 238, 32, fill=design.light, width=1)
        elif frame in (2, 3):
            reach = 94 if frame == 2 else 108
            if design.element == "fire":
                outlined_poly(draw, [(70, 83), (reach - 5, 51), (121, 82), (reach - 2, 75)], design.main, rgba("#8c2614"), 2)
                outlined_poly(draw, [(reach - 2, 78), (reach + 5, 59), (reach + 12, 79), (reach + 4, 74)], design.core, rgba("#8c2614"), 1)
            elif design.element == "water":
                draw.arc((55, 42, 126, 104), 202, 32, fill=design.accent, width=5)
                draw.arc((62, 48, 124, 97), 206, 32, fill=design.core, width=2)
                ellipse(draw, 112, 60 + charge, 3, 5, design.light, rgba("#0b3b61"), 1)
            elif design.element == "grass":
                line(draw, [(64, 82), (reach, 55), (124, 62)], design.trim, 4)
                draw_leaf(draw, reach + 5, 54, 7, 13, design.light, 3)
                draw_leaf(draw, reach - 12, 64, 5, 10, design.accent, -2)
            elif design.element == "dark":
                draw.arc((55, 36, 124, 107), 205, 38, fill=design.accent, width=5)
                draw.arc((65, 43, 124, 96), 210, 35, fill=design.light, width=2)
                diamond(draw, 113, 54, 4, 6, design.core, rgba("#12102a"))
            else:
                draw.arc((53, 35, 126, 108), 205, 32, fill=design.light, width=5)
                draw.arc((61, 43, 123, 100), 210, 32, fill=design.core, width=2)
                sparkle(draw, 115, 52, 6, design.light)
            line(draw, [(56, 88), (83, 76), (108, 78)], rgba("#fff3bf", 190), 2)
        else:
            for x, y in ((98, 61), (109, 75), (85, 87)):
                rect(draw, x, y, 4, 2, design.accent)
        return

    if pose == "hit":
        offsets = ((104, 45), (96, 61), (111, 76))
        for index, (x, y) in enumerate(offsets):
            sparkle(draw, x + frame * 2, y - frame, 4 - (index == 1), rgba("#fff2ad"))
        line(draw, [(24, 72 + frame), (39, 68 + frame)], design.light, 2)
        line(draw, [(29, 83 + frame), (43, 81 + frame)], design.accent, 2)
        rect(draw, 99 + frame * 2, 88 - frame, 6, 2, rgba("#fff6c0", 210))
        return

    if pose == "faint":
        for x, y in ((34, 95), (92, 88), (105, 104)):
            if design.element == "grass":
                draw_leaf(draw, x, y, 4, 7, design.light, -1)
            elif design.element == "fire":
                outlined_poly(draw, [(x, y + 4), (x + 4, y - 5), (x + 8, y + 4), (x + 4, y + 2)], design.core, rgba("#8c2614"), 1)
            elif design.element == "water":
                ellipse(draw, x, y, 2, 4, design.accent, rgba("#0b3b61"), 1)
            elif design.element == "dark":
                diamond(draw, x, y, 3, 5, design.accent, rgba("#12102a"))
            else:
                sparkle(draw, x, y, 3, design.light)


def draw_element_silhouette_boosters(draw: ImageDraw.ImageDraw, design: PetDesign, pose: str, frame: int) -> None:
    """Add element-specific silhouette pixels that read as part of the pet, not as floor markers."""
    if pose == "faint":
        return

    bob = [-1, -2, -1, 0, -1][frame % 5]
    if design.element == "water":
        draw.arc((14, 76 + bob, 72, 126 + bob), 200, 350, fill=design.accent, width=5)
        draw.arc((22, 82 + bob, 68, 119 + bob), 205, 345, fill=design.light, width=2)
        for x, y in ((22, 66 + bob), (33, 91), (109, 63 - bob)):
            ellipse(draw, x, y, 3, 5, design.core, rgba("#0b3b61"), 1)
        return

    if design.element == "fire":
        outlined_poly(draw, [(27, 82), (18, 53 + bob), (40, 68), (46, 91)], design.main, rgba("#8c2614"), 2)
        outlined_poly(draw, [(42, 62 + bob), (46, 31 + bob), (61, 58), (57, 76)], design.core, rgba("#8c2614"), 2)
        outlined_poly(draw, [(92, 44 - bob), (106, 25 - bob), (111, 55), (99, 66)], design.light, rgba("#8c2614"), 2)
        return

    if design.element == "grass":
        line(draw, [(54, 44 + bob), (43, 24 + bob), (34, 15 + bob)], design.trim, 4)
        line(draw, [(76, 43 + bob), (91, 24 - bob), (103, 15 - bob)], design.trim, 4)
        for x, y, tilt in ((31, 16 + bob, -2), (43, 25 + bob, 2), (104, 16 - bob, 2), (91, 25 - bob, -1), (21, 76, -3), (111, 79, 3)):
            draw_leaf(draw, x, y, 6, 11, design.light, tilt)
        return

    if design.element == "dark":
        draw.arc((60, 14 + bob, 116, 73 + bob), 92, 292, fill=design.accent, width=7)
        draw.arc((70, 21 + bob, 112, 65 + bob), 98, 288, fill=design.light, width=3)
        draw.arc((13, 63, 65, 118), 98, 276, fill=design.mid, width=5)
        for x, y in ((24, 70 + bob), (108, 47 - bob), (104, 91)):
            diamond(draw, x, y, 4, 6, design.accent, rgba("#12102a"))
        if pose == "attack" and frame in (2, 3):
            for index in range(90):
                x = 61 + (index * 7) % 57
                y = 24 + (index * 11) % 67
                color = (
                    96 + (index * 5) % 72,
                    146 + (index * 7) % 86,
                    198 + (index * 3) % 50,
                    238,
                )
                rect(draw, x, y, 1, 1, color)
        return

    wing_outline = rgba("#2a1908")
    wing_gold = rgba("#d39b3c")
    wing_light = rgba("#fff0a8")
    outlined_poly(draw, [(42, 71), (15, 53 + bob), (29, 95), (51, 84)], wing_gold, wing_outline, 3)
    outlined_poly(draw, [(88, 63), (119, 44 - bob), (110, 91), (84, 79)], wing_gold, wing_outline, 3)
    for x1, y1, x2, y2 in (
        (22, 58 + bob, 38, 87),
        (31, 61 + bob, 45, 84),
        (111, 50 - bob, 98, 84),
        (101, 53 - bob, 91, 79),
    ):
        line(draw, [(x1, y1), (x2, y2)], wing_light, 3)
        line(draw, [(x1, y1 + 2), (x2, y2 + 2)], wing_outline, 1)
    draw.arc((48, 23 + bob, 93, 50 + bob), 188, 352, fill=wing_light, width=4)


def enforce_pet_safe_margin(frame: Image.Image, margin: int = 2) -> Image.Image:
    box = alpha_bbox(frame)
    if not box:
        return frame

    left, top, right, _bottom = box
    dx = 0
    dy = 0
    if left < margin:
        dx = margin - left
    if frame.width - right < margin:
        dx = min(dx, frame.width - right - margin)
    if top < margin:
        dy = margin - top

    if dx == 0 and dy == 0:
        return frame

    shifted = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    shifted.alpha_composite(frame, (dx, dy))
    return shifted


def compose_ai_pet_frame(base: Image.Image, design: PetDesign, column: int) -> Image.Image:
    pose, frame = pose_for_column(column)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw_ground_ring(draw, 64, 116, design, pose)
    draw_ai_pet_fx(draw, design, pose, frame, front=False)

    if pose == "idle":
        x_offsets = [0, 0, 0, 0]
        y_offsets = [0, -2, -3, -1]
        content = transformed_pet_content(base)
        center_x = 64 + x_offsets[frame]
        bottom = 116 + y_offsets[frame]
    elif pose == "walk":
        x_offsets = [-4, -1, 3, 0]
        y_offsets = [0, -4, 0, -2]
        stretch = [1, 1.02, 1, 0.98][frame]
        content = transformed_pet_content(base, scale_x=stretch, scale_y=1)
        center_x = 64 + x_offsets[frame]
        bottom = 116 + y_offsets[frame]
    elif pose == "attack":
        x_offsets = [0, 4, 9, 12, 5]
        y_offsets = [0, -1, -4, -2, 0]
        scale_x = [1, 1.02, 1.04, 1.05, 1.01][frame]
        scale_y = [1, 0.99, 0.96, 0.97, 1][frame]
        content = transformed_pet_content(base, scale_x=scale_x, scale_y=scale_y)
        center_x = 64 + x_offsets[frame]
        bottom = 116 + y_offsets[frame]
    elif pose == "hit":
        x_offsets = [-4, 3, -2]
        y_offsets = [2, -1, 1]
        content = transformed_pet_content(base, scale_x=0.98, scale_y=1.02)
        center_x = 64 + x_offsets[frame]
        bottom = 116 + y_offsets[frame]
    else:
        content = transformed_pet_content(base, scale_x=0.9, scale_y=0.9, rotation=-86)
        center_x = 63 - frame * 2
        bottom = 121 + frame * 2

    draw_runtime_pet_silhouette(draw, design, pose, frame, center_x, bottom)
    canvas.alpha_composite(content, (round(center_x - content.width / 2), round(bottom - content.height)))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw_ai_pet_fx(draw, design, pose, frame, front=True)
    draw_runtime_pet_signature(draw, design, pose, frame)
    draw_element_silhouette_boosters(draw, design, pose, frame)
    draw_pose_keyframe_polish(draw, design, pose, frame)
    return enforce_pet_safe_margin(canvas)


def generate_pet_sheet() -> None:
    if not APPROVED_ROUNDBIRD_PET_SHEET.exists():
        raise FileNotFoundError(f"missing approved roundbird pet sheet: {APPROVED_ROUNDBIRD_PET_SHEET}")

    approved = Image.open(APPROVED_ROUNDBIRD_PET_SHEET)
    expected_size = (CELL * PET_COLUMNS, CELL * PET_ROWS)
    if approved.size != expected_size:
        raise ValueError(
            f"approved roundbird pet sheet must be {expected_size[0]}x{expected_size[1]}, "
            f"got {approved.width}x{approved.height}"
        )

    PET_OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(APPROVED_ROUNDBIRD_PET_SHEET, PET_OUT)


def crop_rgba(path: Path, box: tuple[int, int, int, int]) -> Image.Image:
    image = Image.open(path).convert("RGBA").crop(box)
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if r > 120 and g < 90 and b > 120 and r + b > g * 4:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (r, g, b, a)
    return image


def soften_grass_tile(tile: Image.Image) -> Image.Image:
    cleaned = tile.copy().convert("RGBA")
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if r < 70 and g < 118 and b < 72:
                pixels[x, y] = (61, 122, 51, a)
    return cleaned


def paste_scaled(base: Image.Image, source: Image.Image, x: int, y: int, width: int, height: int, flip: bool = False) -> None:
    image = source.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else source
    image = image.resize((width, height), Image.Resampling.NEAREST)
    base.alpha_composite(image, (x, y))


def draw_pixel_shadow(surface: Image.Image, cx: int, cy: int, rx: int, ry: int, alpha: int = 62) -> None:
    overlay = Image.new("RGBA", surface.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(8, 6, 4, alpha))
    surface.alpha_composite(overlay)


def generate_battle_arena() -> None:
    random.seed(626)
    low_w, low_h = 800, 450
    source = ASSET_DIR / "village-assets.png"
    world_source = ROOT / "tools" / "assets" / "world" / "cute-fantasy"
    grass = soften_grass_tile(crop_rgba(source, (45, 45, 167, 167)))
    stone = crop_rgba(source, (390, 45, 512, 167))
    stone_alt = crop_rgba(source, (558, 45, 662, 167))
    cute_grass = Image.open(world_source / "Grass_Middle.png").convert("RGBA")
    cute_decor = Image.open(world_source / "Outdoor_Decor_Free.png").convert("RGBA")
    cute_fences = Image.open(world_source / "Fences.png").convert("RGBA")
    img = Image.new("RGBA", (low_w, low_h), (45, 85, 39, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    def px_rect(box: tuple[int, int, int, int], fill: tuple[int, int, int, int]) -> None:
        draw.rectangle(box, fill=fill)

    def draw_tuft(target_draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int, int], accent: tuple[int, int, int, int]) -> None:
        target_draw.rectangle((x - 4, y + 3, x + 5, y + 4), fill=(40, 82, 38, 62))
        target_draw.line((x - 3, y + 4, x - 1, y), fill=color, width=1)
        target_draw.line((x, y + 4, x + 1, y - 3), fill=accent, width=1)
        target_draw.line((x + 3, y + 4, x + 5, y + 1), fill=color, width=1)

    def draw_moss_seam(target_draw: ImageDraw.ImageDraw, x: int, y: int, horizontal: bool) -> None:
        dark = (78, 138, 61, 92)
        light = (151, 196, 87, 74)
        if horizontal:
            target_draw.rectangle((x, y, x + 8, y), fill=dark)
            target_draw.rectangle((x + 2, y - 1, x + 5, y - 1), fill=light)
        else:
            target_draw.rectangle((x, y, x, y + 8), fill=dark)
            target_draw.rectangle((x - 1, y + 2, x - 1, y + 5), fill=light)

    def paste_grass_patch(x: int, y: int, width: int, height: int, points: list[tuple[int, int]]) -> None:
        patch = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        for patch_y in range(-8, height + tile, tile):
            for patch_x in range(-8, width + tile, tile):
                paste_scaled(patch, grass, patch_x, patch_y, tile + 4, tile + 4, flip=bool((patch_x + patch_y) & 1))
        mask = Image.new("L", (width, height), 0)
        ImageDraw.Draw(mask).polygon(points, fill=255)
        patch.putalpha(mask)
        img.alpha_composite(patch, (x, y))

    def cute_grid(sheet: Image.Image, gx: int, gy: int, gw: int = 1, gh: int = 1) -> Image.Image:
        return sheet.crop((gx * 16, gy * 16, (gx + gw) * 16, (gy + gh) * 16))

    def paste_cute(sheet_crop: Image.Image, x: int, y: int, scale: int = 1, flip: bool = False) -> None:
        crop = sheet_crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else sheet_crop
        if scale != 1:
            crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.NEAREST)
        img.alpha_composite(crop, (x, y))

    tile = 56

    # Village-style grass foundation.
    for y in range(-16, low_h + tile, tile):
        for x in range(-20, low_w + tile, tile):
            crop = grass
            paste_scaled(img, crop, x, y, tile + 4, tile + 4, flip=bool((x * 7 + y * 3) & 1))
            if (x * 11 + y * 17) % 5 == 0:
                px_rect((x + 11, y + 18, x + 15, y + 19), (92, 139, 58, 120))

    # Central stone battle courtyard. The wide shape supports the 1-front/2-back 3v3 layout without baked markers.
    court_x1, court_y1, court_x2, court_y2 = 66, 46, 734, 406

    def draw_court_curb() -> None:
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay, "RGBA")

        def curb_rect(box: tuple[int, int, int, int], fill: Color) -> None:
            overlay_draw.rectangle(box, fill=fill)

        curb_rect((court_x1 - 7, court_y2 + 1, court_x2 + 7, court_y2 + 8), (54, 86, 48, 36))
        curb_rect((court_x2 + 1, court_y1 - 2, court_x2 + 8, court_y2 + 6), (54, 84, 50, 30))
        curb_rect((court_x1 - 6, court_y1 - 6, court_x2 + 6, court_y1 - 3), (141, 148, 160, 122))
        curb_rect((court_x1 - 6, court_y2 + 2, court_x2 + 6, court_y2 + 5), (75, 84, 96, 124))
        curb_rect((court_x1 - 6, court_y1 - 3, court_x1 - 3, court_y2 + 5), (105, 116, 120, 112))
        curb_rect((court_x2 + 3, court_y1 - 3, court_x2 + 6, court_y2 + 5), (59, 71, 77, 104))
        curb_rect((court_x1 + 4, court_y1 + 3, court_x2 - 4, court_y1 + 3), (146, 152, 160, 18))
        curb_rect((court_x1 + 4, court_y2 - 5, court_x2 - 4, court_y2 - 5), (50, 58, 66, 24))
        curb_rect((court_x1 + 4, court_y1 + 4, court_x1 + 4, court_y2 - 5), (139, 145, 148, 16))
        curb_rect((court_x2 - 5, court_y1 + 4, court_x2 - 5, court_y2 - 5), (46, 54, 61, 22))
        img.alpha_composite(overlay)

    def draw_cracked_tile(cx: int, cy: int, mirror: bool = False) -> None:
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay, "RGBA")
        branches = [
            [(0, 0), (9, -4), (19, -3), (31, -10)],
            [(9, -4), (12, -14), (20, -20)],
            [(18, -3), (23, 7), (32, 11)],
            [(0, 0), (-9, 5), (-17, 3)],
        ]
        for points in branches:
            transformed = [(cx - x if mirror else cx + x, cy + y) for x, y in points]
            overlay_draw.line(transformed, fill=(55, 60, 72, 72), width=1)
            if len(transformed) > 1:
                offset = [(x, y + 1) for x, y in transformed[:2]]
                overlay_draw.line(offset, fill=(222, 216, 204, 32), width=1)
        img.alpha_composite(overlay)

    def draw_battle_scuff(cx: int, cy: int, rx: int, ry: int, seed: int) -> None:
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay, "RGBA")
        overlay_draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(54, 50, 53, 16))
        for index in range(6):
            angle = (seed * 37 + index * 41) * math.pi / 180
            length = 7 + (seed + index * 5) % 13
            x1 = round(cx + math.cos(angle) * (rx * 0.25))
            y1 = round(cy + math.sin(angle) * (ry * 0.25))
            x2 = round(cx + math.cos(angle) * length)
            y2 = round(cy + math.sin(angle) * max(4, length * 0.42))
            overlay_draw.line((x1, y1, x2, y2), fill=(53, 47, 52, 28), width=1)
        for index in range(5):
            x = cx - rx + 2 + (seed * 11 + index * 9) % max(4, rx * 2 - 4)
            y = cy - ry + 1 + (seed * 7 + index * 5) % max(4, ry * 2 - 2)
            overlay_draw.rectangle((x, y, x + 1, y), fill=(183, 181, 184, 44))
        img.alpha_composite(overlay)

    def draw_court_damage() -> None:
        for index, (x, y, mirror) in enumerate((
            (148, 96, False), (668, 90, True), (126, 344, False), (676, 350, True),
            (264, 80, False), (544, 365, True), (226, 344, True), (612, 132, False),
        )):
            draw_cracked_tile(x, y, mirror)

        for index, (x, y, rx, ry) in enumerate((
            (184, 132, 19, 6), (620, 132, 17, 6), (198, 324, 21, 7), (604, 326, 19, 7),
            (330, 104, 14, 5), (474, 348, 16, 5), (114, 226, 15, 5), (686, 230, 15, 5),
        )):
            draw_battle_scuff(x, y, rx, ry, index + 3)

    court = Image.new("RGBA", (low_w, low_h), (0, 0, 0, 0))
    court_draw = ImageDraw.Draw(court, "RGBA")
    for y in range(court_y1, court_y2 + tile, tile):
        for x in range(court_x1, court_x2 + tile, tile):
            crop = stone_alt if ((x // tile) + (y // tile)) % 3 == 0 else stone
            paste_scaled(court, crop, x, y, tile + 4, tile + 4, flip=bool((x * 5 + y * 3) & 1))
    court_mask = Image.new("L", (low_w, low_h), 0)
    mask_draw = ImageDraw.Draw(court_mask)
    mask_draw.rectangle((court_x1, court_y1, court_x2, court_y2), fill=255)
    court.putalpha(court_mask)
    img.alpha_composite(court)
    draw_court_curb()
    draw_court_damage()

    # Dress the venue through texture only: grass creep and tiny chips, without bright seams or gameplay slot markers.
    chip_palette = (
        (157, 165, 177, 42),
        (214, 216, 223, 36),
        (122, 135, 116, 38),
        (110, 150, 83, 42),
    )
    for index in range(34):
        x = court_x1 + 24 + (index * 89) % (court_x2 - court_x1 - 52)
        y = court_y1 + 22 + (index * 53) % (court_y2 - court_y1 - 48)
        # Keep the visual field clear around the six battle silhouettes.
        if 190 < x < 610 and 150 < y < 302:
            continue
        color = chip_palette[index % len(chip_palette)]
        px_rect((x, y, x + 1 + (index % 3), y), color)

    for index in range(36):
        edge = index % 4
        if edge == 0:
            x, y = court_x1 + 14 + (index * 37) % (court_x2 - court_x1 - 30), court_y1 - 11
        elif edge == 1:
            x, y = court_x2 + 10, court_y1 + 18 + (index * 31) % (court_y2 - court_y1 - 40)
        elif edge == 2:
            x, y = court_x1 + 20 + (index * 43) % (court_x2 - court_x1 - 44), court_y2 + 11
        else:
            x, y = court_x1 - 10, court_y1 + 18 + (index * 29) % (court_y2 - court_y1 - 40)
        draw_tuft(draw, x, y, (86, 148, 64, 174), (147, 198, 86, 146))

    # Keep the grass frame alive with small pixel details only; no large props that can be cropped by the court.
    flower_clusters = [
        (24, 28, (211, 165, 244, 255)), (42, 94, (255, 230, 112, 255)),
        (28, 182, (156, 211, 255, 255)), (54, 318, (228, 170, 255, 255)),
        (742, 38, (255, 230, 112, 255)), (764, 122, (211, 165, 244, 255)),
        (734, 226, (156, 211, 255, 255)), (760, 366, (228, 170, 255, 255)),
        (126, 20, (255, 230, 112, 255)), (248, 24, (211, 165, 244, 255)),
        (520, 22, (156, 211, 255, 255)), (660, 24, (228, 170, 255, 255)),
        (148, 424, (156, 211, 255, 255)), (314, 426, (255, 230, 112, 255)),
        (514, 424, (211, 165, 244, 255)), (686, 426, (228, 170, 255, 255)),
    ]
    for x, y, petal in flower_clusters:
        px_rect((x - 2, y, x + 2, y + 1), petal)
        px_rect((x, y - 2, x + 1, y + 3), petal)
        px_rect((x, y, x + 1, y + 1), (255, 241, 151, 255))
        px_rect((x - 4, y + 4, x + 5, y + 5), (77, 132, 58, 180))

    for index in range(42):
        x = 18 + (index * 73) % 764
        y = 18 + (index * 47) % 414
        if court_x1 - 8 <= x <= court_x2 + 8 and court_y1 - 8 <= y <= court_y2 + 8:
            continue
        px_rect((x, y, x + 7, y + 1), (70, 125, 55, 130))
        px_rect((x + 2, y - 2, x + 3, y + 2), (95, 151, 68, 120))

    # Use only small complete world props around the grass frame; keep the combat floor unobstructed.
    fence_segment = cute_grid(cute_fences, 1, 0, 3, 1)
    fence_positions = ((92, 22), (338, 22), (578, 22), (116, 412), (364, 412), (600, 412))
    for index, (x, y) in enumerate(fence_positions):
        paste_cute(fence_segment, x, y, flip=bool(index % 2))

    world_grass_positions = (
        (18, 56, 0, 0), (52, 118, 1, 0), (36, 284, 2, 0), (116, 430, 0, 1),
        (694, 58, 2, 0), (740, 152, 1, 0), (708, 318, 0, 0), (638, 428, 2, 0),
    )
    for x, y, gx, gy in world_grass_positions:
        paste_cute(cute_grid(cute_decor, gx, gy), x, y)

    rock_positions = (
        (34, 348, 1, 2), (106, 18, 1, 3), (708, 28, 2, 2), (738, 376, 1, 3),
        (20, 214, 0, 3), (760, 246, 3, 3),
    )
    for x, y, gx, gy in rock_positions:
        paste_cute(cute_grid(cute_decor, gx, gy), x, y)

    flower_positions = (
        (78, 58, 0, 8), (146, 24, 1, 8), (286, 18, 2, 8), (496, 24, 3, 8),
        (664, 62, 0, 9), (56, 394, 1, 9), (240, 420, 2, 9), (548, 420, 3, 9),
        (716, 396, 0, 10), (760, 88, 1, 10),
    )
    for x, y, gx, gy in flower_positions:
        paste_cute(cute_grid(cute_decor, gx, gy), x, y)

    # Blend a few 16px Cute Fantasy grass squares into the edge so the frame does not read as a single repeated tile.
    for x, y in ((6, 20), (48, 438), (188, 6), (386, 430), (742, 18), (734, 422)):
        patch = cute_grass.copy()
        alpha = patch.getchannel("A").point(lambda value: round(value * 0.78))
        patch.putalpha(alpha)
        paste_cute(patch, x, y)

    ARENA_OUT.parent.mkdir(parents=True, exist_ok=True)
    if img.getchannel("A").getextrema()[0] < 255:
        img.putalpha(Image.new("L", img.size, 255))
    img.resize((low_w * 2, low_h * 2), Image.Resampling.NEAREST).save(ARENA_OUT)


def main() -> None:
    generate_pet_sheet()
    generate_battle_arena()
    print(f"generated {PET_OUT}")
    print(f"generated {ARENA_OUT}")


if __name__ == "__main__":
    main()

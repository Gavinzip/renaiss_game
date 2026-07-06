#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
DEFAULT_PIXEL_SCALE = 2
FRAME_COUNT = 12
MAGE_FRAME_COUNT = 20
CURRENT_FRAME_COUNT = FRAME_COUNT

Color = tuple[int, int, int, int]
DrawFn = Callable[[ImageDraw.ImageDraw, int, int, int, int], None]


def rgba(hex_color: str, alpha: int = 255) -> Color:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


RPG_SKILL_VFX_COLUMNS = 16
RPG_SKILL_VFX_ROWS = 25
RPG_SKILL_VFX_CELL_W = 160
RPG_SKILL_VFX_CELL_H = 112
RPG_PROJECTILE_COLUMNS = 10
RPG_PROJECTILE_ROWS = 5
RPG_PROJECTILE_CELL_W = 96
RPG_PROJECTILE_CELL_H = 56
RPG_STATUS_VFX_COLUMNS = 12
RPG_STATUS_VFX_ROWS = 5
RPG_STATUS_VFX_CELL_W = 96
RPG_STATUS_VFX_CELL_H = 96

RPG_ELEMENTS = ("water", "fire", "grass", "dark", "light")
RPG_STATUSES = ("burn", "poison", "stun", "guard", "regen")
RPG_ELEMENT_PALETTES: dict[str, tuple[Color, Color, Color]] = {
    "water": (rgba("#1f8dff", 150), rgba("#65ddff", 225), rgba("#f2fdff", 244)),
    "fire": (rgba("#ff5b24", 155), rgba("#ffb640", 230), rgba("#fff0a8", 244)),
    "grass": (rgba("#83b05a", 150), rgba("#caff72", 224), rgba("#fff6a8", 240)),
    "dark": (rgba("#4c35d8", 150), rgba("#8d6dff", 225), rgba("#86f4ff", 242)),
    "light": (rgba("#f4b936", 145), rgba("#fff07a", 228), rgba("#ffffff", 245)),
}
RPG_STATUS_PALETTES: dict[str, tuple[Color, Color, Color]] = {
    "burn": (rgba("#8c2414", 168), rgba("#ff7042", 230), rgba("#ffd166", 246)),
    "poison": (rgba("#1f5c28", 160), rgba("#63c95d", 226), rgba("#d8ff8f", 242)),
    "stun": (rgba("#7a531c", 154), rgba("#ffd76d", 230), rgba("#fff6bb", 244)),
    "guard": (rgba("#155082", 150), rgba("#54a7e8", 226), rgba("#b9ecff", 242)),
    "regen": (rgba("#1d6a33", 154), rgba("#61d267", 228), rgba("#dcffd7", 242)),
}
RPG_SKILL_STYLE_ROWS = (
    "strike", "projectile", "projectile", "aura", "aura",
    "burst", "wave", "beam", "field", "strike",
    "strike", "rain", "burst", "field", "aura",
    "beam", "field", "aura", "strike", "field",
    "beam", "rain", "field", "burst", "summon",
)


def phase(frame: int) -> float:
    return frame / max(1, CURRENT_FRAME_COUNT - 1)


def pulse(frame: int) -> float:
    return math.sin(phase(frame) * math.pi)


def point(cx: int, cy: int, radius_x: float, radius_y: float, angle: float) -> tuple[int, int]:
    return (round(cx + math.cos(angle) * radius_x), round(cy + math.sin(angle) * radius_y))


def line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: Color, width: int = 1) -> None:
    draw.line(points, fill=color, width=width)


def rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: Color) -> None:
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def diamond(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: Color, outline: Color | None = None) -> None:
    pts = [(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)]
    draw.polygon(pts, fill=fill)
    if outline:
        draw.line(pts + [pts[0]], fill=outline, width=1)


def sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, color: Color) -> None:
    draw.rectangle([cx - 1, cy - radius, cx + 1, cy + radius], fill=color)
    draw.rectangle([cx - radius, cy - 1, cx + radius, cy + 1], fill=color)
    if radius >= 3:
        draw.point((cx - radius + 1, cy - radius + 1), fill=color)
        draw.point((cx + radius - 1, cy - radius + 1), fill=color)
        draw.point((cx - radius + 1, cy + radius - 1), fill=color)
        draw.point((cx + radius - 1, cy + radius - 1), fill=color)


def ellipse_ring(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    rx: int,
    ry: int,
    color: Color,
    width: int = 1,
    start: int = 0,
    end: int = 360,
) -> None:
    for inset in range(width):
        box = [cx - rx + inset, cy - ry + inset, cx + rx - inset, cy + ry - inset]
        if start == 0 and end == 360:
            draw.ellipse(box, outline=color)
        else:
            draw.arc(box, start=start, end=end, fill=color, width=1)


def shard_circle(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, color: Color, frame: int, count: int = 6) -> None:
    for i in range(count):
        angle = math.tau * (i / count + phase(frame) * 0.18)
        x, y = point(cx, cy, rx, ry, angle)
        diamond(draw, x, y, 2 + (i % 2), 3 + (i % 3 == 0), color, rgba("#1b120b", 120))


def rune_ticks(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, color: Color, frame: int, count: int = 8) -> None:
    for i in range(count):
        angle = math.tau * (i / count + phase(frame) * 0.1)
        x, y = point(cx, cy, rx, ry, angle)
        if i % 2 == 0:
            diamond(draw, x, y, 2, 4, color, rgba("#1b120b", 140))
        else:
            line(draw, [(x - 2, y), (x + 2, y)], color, 1)
            line(draw, [(x, y - 2), (x, y + 2)], color, 1)


def with_alpha(color: Color, alpha: int) -> Color:
    return (color[0], color[1], color[2], max(0, min(255, alpha)))


def segmented_arc(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    rx: float,
    ry: float,
    start: float,
    span: float,
    color: Color,
    shadow: Color,
    width: int = 1,
    steps: int = 14,
) -> None:
    points = [point(cx, cy, rx, ry, start + span * (index / max(1, steps - 1))) for index in range(steps)]
    if len(points) < 2:
        return
    line(draw, [(x + 1, y + 2) for x, y in points], shadow, max(1, width + 1))
    line(draw, points, color, width)


def orbit_crystals(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    rx: float,
    ry: float,
    frame: int,
    count: int,
    colors: tuple[Color, Color],
    alpha: int,
) -> None:
    for index in range(count):
        angle = math.tau * (index / count + phase(frame) * 0.12)
        x, y = point(cx, cy, rx, ry, angle)
        size = 2 + (index % 3 == 0)
        diamond(draw, x + 1, y + 2, size + 1, size + 2, rgba("#120b17", max(70, alpha // 3)))
        diamond(draw, x, y, size, size + 2, with_alpha(colors[index % 2], alpha), rgba("#241028", max(95, alpha // 2)))


def starburst(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: float, color: Color, frame: int, count: int = 8) -> None:
    for index in range(count):
        angle = math.tau * (index / count + phase(frame) * 0.06)
        inner = point(cx, cy, radius * 0.18, radius * 0.12, angle)
        outer = point(cx, cy, radius, radius * 0.58, angle)
        line(draw, [(inner[0] + 1, inner[1] + 2), (outer[0] + 1, outer[1] + 2)], rgba("#160b19", 92), 2)
        line(draw, [inner, outer], color, 1)


def sigil_diamond_chain(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    rx: float,
    ry: float,
    frame: int,
    count: int,
    primary: Color,
    secondary: Color,
    alpha: int,
) -> None:
    for index in range(count):
        angle = math.tau * (index / count + phase(frame) * 0.08)
        x, y = point(cx, cy, rx, ry, angle)
        size = 3 + (index % 3 == 0)
        diamond(draw, x + 1, y + 2, size + 1, size + 2, rgba("#120a14", max(70, alpha // 3)))
        diamond(draw, x, y, size, size + 2, with_alpha(primary if index % 2 == 0 else secondary, alpha), rgba("#2b1833", max(110, alpha // 2)))
        if index % 4 == 0:
            sparkle(draw, x, y - size - 4, 2, with_alpha(rgba("#fff5bf"), max(90, alpha - 32)))


def prism_lotus(draw: ImageDraw.ImageDraw, cx: int, cy: int, frame: int, scale: float, alpha: int) -> None:
    p = pulse(frame)
    petals = (
        (0, rgba("#fff6a8", alpha)),
        (math.pi / 3, rgba("#93ff7a", max(80, alpha - 24))),
        (math.pi * 2 / 3, rgba("#6df3ff", max(80, alpha - 30))),
        (math.pi, rgba("#d9a3ff", max(80, alpha - 36))),
        (math.pi * 4 / 3, rgba("#8fffa4", max(80, alpha - 26))),
        (math.pi * 5 / 3, rgba("#fff0a0", max(80, alpha - 18))),
    )
    for angle, color in petals:
        outer = point(cx, cy, (11 + p * 7) * scale, (8 + p * 5) * scale, angle + phase(frame) * 0.2)
        inner = point(cx, cy, 4 * scale, 3 * scale, angle)
        diamond(draw, outer[0] + 1, outer[1] + 2, round(4 * scale), round(6 * scale), rgba("#11100b", max(80, alpha // 3)))
        diamond(draw, outer[0], outer[1], round(3 * scale), round(6 * scale), color, rgba("#263518", max(120, alpha // 2)))
        line(draw, [inner, outer], with_alpha(color, max(90, alpha - 48)), 1)
    diamond(draw, cx + 1, cy + 2, round((8 + p * 3) * scale), round((7 + p * 3) * scale), rgba("#15140a", max(105, alpha // 2)))
    diamond(draw, cx, cy, round((7 + p * 3) * scale), round((8 + p * 3) * scale), rgba("#f9ff9a", alpha), rgba("#2e4118", max(135, alpha // 2)))
    sparkle(draw, cx, cy - round(13 * scale), max(2, round(3 * scale)), with_alpha(rgba("#fff9cf"), max(120, alpha - 20)))


def make_sheet(
    file_name: str,
    columns: int,
    rows: int,
    cell_w: int,
    cell_h: int,
    draw_cell: DrawFn,
    pixel_scale: int = DEFAULT_PIXEL_SCALE,
) -> None:
    global CURRENT_FRAME_COUNT
    previous_frame_count = CURRENT_FRAME_COUNT
    CURRENT_FRAME_COUNT = columns
    sheet = Image.new("RGBA", (columns * cell_w, rows * cell_h), (0, 0, 0, 0))
    low_w = cell_w // pixel_scale
    low_h = cell_h // pixel_scale
    try:
        for row in range(rows):
            for frame in range(columns):
                cell = Image.new("RGBA", (low_w, low_h), (0, 0, 0, 0))
                draw = ImageDraw.Draw(cell, "RGBA")
                draw_cell(draw, low_w, low_h, row, frame)
                if pixel_scale != 1:
                    cell = cell.resize((cell_w, cell_h), Image.Resampling.NEAREST)
                sheet.alpha_composite(cell, (frame * cell_w, row * cell_h))
    finally:
        CURRENT_FRAME_COUNT = previous_frame_count
    sheet.save(OUT_DIR / file_name)


def draw_slash(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    smooth = lambda value: (lambda clamped: clamped * clamped * (3 - 2 * clamped))(max(0.0, min(1.0, value)))
    reveal = smooth(t / 0.42)
    fade = 1 - max(0.0, t - 0.76) / 0.24
    alpha = round(230 * max(0.0, min(1.0, fade)))
    outer, mid, core = palette
    trail = max(0.0, (t - 0.64) / 0.36)
    start_s = smooth(trail) * 0.38
    end_s = max(start_s + 0.12, reveal)
    samples = 18
    points: list[tuple[int, int]] = []
    for index in range(samples):
        s = start_s + (end_s - start_s) * (index / max(1, samples - 1))
        x = w * (0.18 + 0.66 * s)
        y = h * (0.69 - 0.42 * math.sin(s * math.pi * 0.92) - 0.07 * s)
        y += math.sin(t * math.tau * 1.2 + s * 4.0) * 1.6
        points.append((round(x), round(y)))

    if len(points) < 2:
        return

    lower_points = [(x + 2, y + 6) for x, y in points]
    upper_points = [(x - 1, y - 4) for x, y in points[max(0, len(points) // 5) :]]
    line(draw, [(x + 2, y + 3) for x, y in points], rgba("#0e0a12", max(46, alpha // 3)), 8)
    line(draw, points, with_alpha(outer, max(70, round(alpha * 0.52))), 6)
    line(draw, points, with_alpha(mid, max(90, alpha)), 4)
    line(draw, upper_points, with_alpha(core, min(245, alpha + 18)), 2)
    line(draw, lower_points, with_alpha(outer, max(55, round(alpha * 0.36))), 2)

    head_x, head_y = points[-1]
    tail_x, tail_y = points[0]
    diamond(draw, head_x, head_y, 4 + round(p * 2), 5 + round(p * 2), with_alpha(core, min(245, alpha + 20)), with_alpha(mid, max(110, alpha - 15)))
    diamond(draw, tail_x, tail_y + 2, 2, 3, with_alpha(outer, max(80, alpha - 40)), rgba("#120b18", 92))
    for i in range(6):
        amount = i / 5
        if amount > reveal:
            continue
        x = round(w * (0.22 + amount * 0.48 + t * 0.04))
        y = round(h * (0.7 - amount * 0.2 + math.sin(t * math.tau + i) * 0.035))
        diamond(draw, x, y, 1 + (i % 3 == 0), 2, with_alpha(core if i % 2 else outer, max(82, alpha - 55)), rgba("#1f1430", 82))


def draw_warrior_charge_afterimage(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    ease = lambda value: (lambda clamped: clamped * clamped * (3 - 2 * clamped))(max(0.0, min(1.0, value)))
    travel = ease(min(1.0, t / 0.72))
    fade = max(0.0, 1 - max(0.0, t - 0.82) / 0.18)
    cx = round(w * (0.28 + travel * 0.42))
    cy = round(h * (0.66 - p * 0.03))

    draw.ellipse(
        [round(w * 0.18), round(h * 0.74), round(w * 0.83), round(h * 0.85)],
        fill=rgba("#140c08", round(74 * fade)),
    )

    for ghost in range(4):
        amount = ghost / 3
        gx = cx - round((10 + ghost * 11) * (0.72 + travel * 0.35))
        gy = cy + round(math.sin(t * math.tau + ghost * 0.8) * 2) + ghost
        alpha = round((136 - ghost * 24) * fade)
        if alpha <= 8:
            continue
        body = [
            (gx - 10, gy - 10),
            (gx + 4, gy - 13),
            (gx + 15, gy - 5),
            (gx + 12, gy + 9),
            (gx - 4, gy + 13),
            (gx - 15, gy + 4),
        ]
        draw.polygon([(x + 2, y + 3) for x, y in body], fill=rgba("#0d0806", max(30, alpha // 2)))
        draw.polygon(body, fill=rgba("#9a4a22", alpha))
        draw.polygon(
            [(gx - 5, gy - 6), (gx + 5, gy - 8), (gx + 10, gy - 2), (gx + 7, gy + 7), (gx - 6, gy + 7), (gx - 10, gy)],
            fill=rgba("#ffc35b", max(45, alpha - 8)),
        )
        line(draw, [(gx - 13, gy + 11), (gx + 8, gy + 14)], rgba("#5ed8ff", max(34, alpha - 22)), 1)

    start = math.radians(206 - p * 10)
    for band, (color, width, radius) in enumerate(
        (
            (rgba("#311208", round(118 * fade)), 5, 33),
            (rgba("#ff8c38", round(204 * fade)), 3, 29),
            (rgba("#fff0a6", round(236 * fade)), 1, 24),
        )
    ):
        segmented_arc(
            draw,
            cx + 8,
            cy - 2,
            radius,
            round(radius * 0.42),
            start + band * 0.06,
            math.radians(58 + p * 10),
            color,
            rgba("#170909", round(82 * fade)),
            width,
            8,
        )

    for i in range(10):
        drift = (i / 9) * max(0.18, travel)
        x = round(cx - 46 * drift + math.sin(i + t * math.tau) * 2)
        y = round(cy + 13 + math.cos(i * 1.7 + t * math.tau) * 3)
        alpha = round((176 - i * 12) * fade)
        if i % 3 == 0:
            diamond(draw, x, y, 2, 3, rgba("#ffd36e", alpha), rgba("#4d2110", max(34, alpha // 2)))
        else:
            draw.rectangle([x - 1, y - 1, x + 1, y + 1], fill=rgba("#78eaff", max(40, alpha - 28)))


def draw_archer_roll_afterimage(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    ease = lambda value: (lambda clamped: clamped * clamped * (3 - 2 * clamped))(max(0.0, min(1.0, value)))
    travel = ease(min(1.0, t / 0.78))
    fade = max(0.0, 1 - max(0.0, t - 0.82) / 0.18)
    cx = round(w * (0.3 + travel * 0.36))
    cy = round(h * (0.68 + math.sin(t * math.tau) * 0.018))

    draw.ellipse(
        [round(w * 0.18), round(h * 0.74), round(w * 0.82), round(h * 0.86)],
        fill=rgba("#07130a", round(96 * fade)),
    )

    for ghost in range(4):
        gx = cx - 8 - ghost * 13
        gy = cy + ghost
        alpha = round((130 - ghost * 24) * fade)
        if alpha <= 8:
            continue
        draw.ellipse([gx - 21, gy - 15, gx + 19, gy + 12], fill=rgba("#102916", max(38, alpha // 2)))
        segmented_arc(
            draw,
            gx,
            gy,
            22,
            15,
            math.radians(205 + t * 38 + ghost * 8),
            math.radians(175),
            rgba("#5fa95c", alpha),
            rgba("#071209", max(40, alpha // 2)),
            3,
            8,
        )
        segmented_arc(
            draw,
            gx + 2,
            gy - 1,
            16,
            10,
            math.radians(36 + t * 32 + ghost * 6),
            math.radians(126),
            rgba("#caff7a", max(34, alpha - 12)),
            rgba("#0b1809", max(30, alpha // 2)),
            2,
            7,
        )

    for i in range(12):
        amount = i / 11
        x = round(cx - 56 * amount + math.sin(i * 1.4 + t * math.tau) * 4)
        y = round(cy + 10 + math.cos(i + t * math.tau) * 4)
        alpha = round((202 - i * 11) * fade)
        leaf_color = rgba("#8fd85f", alpha) if i % 2 else rgba("#d6ff88", max(50, alpha - 20))
        diamond(draw, x, y, 2 + (i % 4 == 0), 4 + (i % 3 == 0), leaf_color, rgba("#1c3717", max(42, alpha // 2)))

    sparkle(draw, cx + 20, cy - 8, 4, rgba("#f5ffd3", round(206 * fade)))


def draw_warrior_basic_slash(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    smooth = lambda value: (lambda clamped: clamped * clamped * (3 - 2 * clamped))(max(0.0, min(1.0, value)))
    reveal = smooth(t / 0.32)
    fade = round(225 * max(0.0, min(1.0, 1 - max(0.0, t - 0.72) / 0.28)))
    head = round(w * (0.34 + reveal * 0.42))
    tail = round(w * (0.18 + max(0.0, t - 0.62) * 0.12))
    outer = [
        (tail, round(h * 0.66)),
        (round(w * 0.35), round(h * 0.5 - p * 5)),
        (head, round(h * 0.34)),
        (min(w - 6, head + 8), round(h * 0.4)),
        (round(w * 0.43), round(h * 0.59 + p * 4)),
        (tail + 3, round(h * 0.75)),
    ]
    draw.polygon([(x + 2, y + 3) for x, y in outer], fill=rgba("#130c0d", max(55, fade // 2)))
    draw.polygon(outer, fill=rgba("#1f71a8", max(88, fade // 2)))
    inner = [
        (tail + 8, round(h * 0.65)),
        (round(w * 0.39), round(h * 0.52 - p * 3)),
        (head - 5, round(h * 0.39)),
        (round(w * 0.45), round(h * 0.55 + p * 2)),
    ]
    draw.polygon(inner, fill=rgba("#65dfff", max(110, fade)))
    line(draw, [(tail + 12, round(h * 0.65)), (round(w * 0.43), round(h * 0.53 - p * 2)), (head - 8, round(h * 0.41))], rgba("#fff0aa", 235), 2)
    diamond(draw, min(w - 8, head + 3), round(h * 0.39), 4 + round(p * 2), 5 + round(p * 2), rgba("#ffffff", 230), rgba("#74e7ff", 180))
    for i in range(4):
        x = round(tail + 12 + i * 11 + t * 4)
        y = round(h * (0.62 - i * 0.035 + math.sin(t * math.tau + i) * 0.025))
        diamond(draw, x, y, 1 + (i % 2), 2, rgba("#ffd47a", max(120, fade)), rgba("#4d2810", 120))


def draw_engineer_basic_strike(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    smooth = lambda value: (lambda clamped: clamped * clamped * (3 - 2 * clamped))(max(0.0, min(1.0, value)))
    reveal = smooth(t / 0.34)
    fade = round(222 * max(0.0, min(1.0, 1 - max(0.0, t - 0.7) / 0.3)))
    head = round(w * (0.35 + reveal * 0.34))
    tail = round(w * (0.2 + max(0.0, t - 0.62) * 0.11))
    cy = round(h * (0.54 + math.sin(t * math.tau) * 0.025))
    band = [
        (tail, cy + 8),
        (round(w * 0.37), cy - 2 - round(p * 4)),
        (head, cy - 13),
        (min(w - 8, head + 9), cy - 5),
        (round(w * 0.43), cy + 8),
        (tail + 4, cy + 16),
    ]
    draw.polygon([(x + 2, y + 3) for x, y in band], fill=rgba("#160f0b", max(60, fade // 2)))
    draw.polygon(band, fill=rgba("#af7b43", max(88, fade)))
    inner = [(tail + 8, cy + 8), (round(w * 0.4), cy), (head - 5, cy - 7), (round(w * 0.45), cy + 5)]
    draw.polygon(inner, fill=rgba("#ffd887", max(120, min(240, fade + 12))))
    impact_x = min(w - 9, head + 4)
    impact_y = cy - 7
    for i in range(7):
        angle = math.radians(-72 + i * 21 + t * 18)
        length = 5 + (i % 3) * 3 + p * 5
        x1, y1 = point(impact_x, impact_y, 3, 2, angle)
        x2, y2 = point(impact_x, impact_y, length, length * 0.7, angle)
        line(draw, [(x1, y1), (x2, y2)], rgba("#32211a", 110), 2)
        line(draw, [(x1, y1), (x2, y2)], rgba("#ffb84f", max(100, fade)), 1)
    diamond(draw, impact_x, impact_y, 5 + round(p * 2), 4 + round(p * 2), rgba("#fff3b3", 230), rgba("#ffb84f", 170))
    for i in range(3):
        x = round(tail + 12 + i * 12 + t * 4)
        y = round(cy + 7 + math.sin(i + t * math.tau) * 4)
        draw.rectangle([x - 1, y - 1, x + 2, y + 2], fill=rgba("#58dcff", max(100, fade)))


def draw_ground_rune(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, h * 3 // 5
    fade = max(0.0, 1 - max(0.0, t - 0.82) / 0.18)
    open_amount = 1 - (1 - min(1.0, t / 0.24)) ** 3
    rx = round(w * (0.13 + 0.19 * open_amount + 0.04 * p))
    ry = round(h * (0.08 + 0.12 * open_amount + 0.03 * p))
    outer, mid, core = palette
    shadow_alpha = round(112 * fade)
    draw.ellipse([cx - rx - 18, cy - ry - 10, cx + rx + 18, cy + ry + 11], fill=rgba("#08050a", shadow_alpha))
    draw.ellipse([cx - rx - 7, cy - ry - 5, cx + rx + 7, cy + ry + 6], fill=with_alpha(outer, round(42 * fade)))

    for band in range(3):
        offset = band * 0.17
        band_rx = max(8, rx + 11 - band * 7)
        band_ry = max(5, ry + 7 - band * 4)
        segmented_arc(
            draw,
            cx,
            cy,
            band_rx,
            band_ry,
            math.tau * (offset + t * (0.28 + band * 0.08)),
            math.tau * (0.34 + open_amount * 0.12),
            with_alpha(mid if band != 1 else core, round((210 - band * 28) * fade)),
            rgba("#10080d", round(126 * fade)),
            2 if band < 2 else 1,
            13,
        )
        segmented_arc(
            draw,
            cx,
            cy,
            max(5, band_rx - 5),
            max(4, band_ry - 3),
            math.tau * (0.58 + offset - t * (0.22 + band * 0.05)),
            math.tau * (0.24 + open_amount * 0.08),
            with_alpha(core if band != 0 else outer, round((168 - band * 20) * fade)),
            rgba("#10080d", round(104 * fade)),
            1,
            10,
        )

    for index in range(12):
        angle = math.tau * (index / 12 + t * 0.12)
        x, y = point(cx, cy, rx + 9, ry + 6, angle)
        if index % 3 == 0:
            diamond(draw, x + 1, y + 2, 4, 6, rgba("#0e0709", round(110 * fade)))
            diamond(draw, x, y, 3, 6, with_alpha(core, round(220 * fade)), with_alpha(outer, round(142 * fade)))
        elif index % 3 == 1:
            sparkle(draw, x, y, 2 + (index % 2), with_alpha(core, round(198 * fade)))
        else:
            line(draw, [(x - 4, y), (x + 4, y)], with_alpha(mid, round(176 * fade)), 1)
            line(draw, [(x, y - 3), (x, y + 3)], with_alpha(core, round(160 * fade)), 1)

    for spoke in range(8):
        angle = math.tau * (spoke / 8 - t * 0.08)
        inner = point(cx, cy, rx * 0.16, ry * 0.12, angle)
        outer_pt = point(cx, cy, rx * 0.72, ry * 0.62, angle)
        line(draw, [(inner[0] + 1, inner[1] + 2), (outer_pt[0] + 1, outer_pt[1] + 2)], rgba("#12090b", round(78 * fade)), 2)
        line(draw, [inner, outer_pt], with_alpha(mid if spoke % 2 else core, round(96 * fade)), 1)

    diamond(draw, cx + 1, cy + 3, 11 + round(p * 3), 8 + round(p * 2), rgba("#12090b", round(132 * fade)))
    diamond(draw, cx, cy, 8 + round(p * 3), 10 + round(p * 3), with_alpha(core, round(236 * fade)), with_alpha(mid, round(172 * fade)))
    sparkle(draw, cx, cy - ry - 8, 4 + round(p * 2), with_alpha(rgba("#fff8c9"), round(220 * fade)))


def draw_seed_rain(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    for i in range(8):
        x = round(w * (0.18 + i * 0.095 + math.sin(i) * 0.015))
        y = round(h * (0.12 + ((t + i * 0.17) % 1) * 0.62))
        color = rgba("#c7ff76", 190 if i % 2 else 230)
        line(draw, [(x - 2, y - 5), (x + 1, y + 4)], rgba("#f8ffd4", 220), 1)
        diamond(draw, x + 2, y + 5, 2, 3, color, rgba("#31531f", 180))
    ellipse_ring(draw, w // 2, round(h * 0.72), round(w * 0.26), round(h * 0.08), rgba("#82d65a", 110), 1)


def draw_overclock(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, round(h * 0.58)
    fade = max(0.0, 1 - max(0.0, t - 0.84) / 0.16)
    charge = 1 - (1 - min(1.0, t / 0.22)) ** 3
    rx = round(w * (0.12 + charge * 0.17 + p * 0.035))
    ry = round(h * (0.09 + charge * 0.12 + p * 0.025))
    outer, mid, core = palette
    draw.ellipse([cx - rx - 17, cy - ry - 11, cx + rx + 17, cy + ry + 12], fill=rgba("#06080d", round(104 * fade)))
    draw.ellipse([cx - rx - 5, cy - ry - 4, cx + rx + 5, cy + ry + 5], fill=with_alpha(outer, round(48 * fade)))

    for gear in range(16):
        angle = math.tau * (gear / 16 + t * 0.26)
        tooth = point(cx, cy, rx + 8 + (gear % 2) * 2, ry + 6 + (gear % 2), angle)
        color = core if gear % 4 == 0 else mid
        if gear % 2 == 0:
            diamond(draw, tooth[0], tooth[1], 3 + (gear % 4 == 0), 4, with_alpha(color, round(205 * fade)), rgba("#0b1019", round(120 * fade)))
        else:
            line(draw, [(tooth[0] - 3, tooth[1]), (tooth[0] + 3, tooth[1])], with_alpha(color, round(170 * fade)), 1)

    for band in range(4):
        segmented_arc(
            draw,
            cx,
            cy,
            max(8, rx + 4 - band * 5),
            max(6, ry + 3 - band * 3),
            math.tau * (0.04 + band * 0.21 + t * (0.34 + band * 0.06)),
            math.tau * (0.22 + charge * 0.1),
            with_alpha(core if band % 2 == 0 else mid, round((210 - band * 28) * fade)),
            rgba("#07101a", round(126 * fade)),
            2 if band < 2 else 1,
            11,
        )

    for spoke in range(8):
        angle = math.tau * (spoke / 8 - t * 0.18)
        inner = point(cx, cy, rx * 0.18, ry * 0.16, angle)
        outer_pt = point(cx, cy, rx * 0.82, ry * 0.72, angle)
        line(draw, [(inner[0] + 1, inner[1] + 2), (outer_pt[0] + 1, outer_pt[1] + 2)], rgba("#070b12", round(96 * fade)), 2)
        line(draw, [inner, outer_pt], with_alpha(mid, round(112 * fade)), 1)

    for spark_index in range(10):
        angle = math.tau * (spark_index / 10 + t * 0.42)
        x, y = point(cx, cy, rx * (0.45 + 0.4 * p), ry * (0.42 + 0.34 * p), angle)
        if spark_index % 3 == 0:
            sparkle(draw, x, y, 3, with_alpha(core, round(220 * fade)))
        else:
            draw.rectangle([x - 1, y - 1, x + 2, y + 2], fill=with_alpha(mid, round(185 * fade)))

    diamond(draw, cx + 1, cy + 3, 11 + round(p * 2), 9 + round(p * 2), rgba("#07101a", round(148 * fade)))
    diamond(draw, cx, cy, 8 + round(p * 2), 10 + round(p * 2), with_alpha(core, round(236 * fade)), with_alpha(mid, round(172 * fade)))
    sparkle(draw, cx, cy - round(ry * 0.62) - 8, 4 + round(p), with_alpha(rgba("#fff6bc"), round(212 * fade)))


def draw_clean_storm(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, round(h * 0.57)
    fade = max(0.0, 1 - max(0.0, t - 0.84) / 0.16)
    ignite = 1 - (1 - min(1.0, t / 0.22)) ** 3
    recoil = max(0.0, 1 - max(0.0, t - 0.72) / 0.28)
    alpha = max(44, round(250 * fade * (0.7 + ignite * 0.3)))
    rx = round(w * (0.12 + 0.2 * ignite + 0.035 * p))
    ry = round(h * (0.07 + 0.13 * ignite + 0.026 * p))

    draw.ellipse([cx - rx - 26, cy - ry - 15, cx + rx + 26, cy + ry + 16], fill=rgba("#07050b", round(118 * fade)))
    draw.ellipse([cx - rx - 11, cy - ry - 7, cx + rx + 11, cy + ry + 8], fill=rgba("#0b1b25", round(58 * fade)))

    for arm in range(6):
        base = math.tau * (arm / 6 + t * (0.34 + arm * 0.012))
        points: list[tuple[int, int]] = []
        for step in range(9):
            amount = step / 8
            twist = base + amount * (1.1 + 0.42 * ignite)
            points.append(point(cx, cy, rx * (0.12 + amount * 0.9), ry * (0.14 + amount * 0.95), twist))
        line(draw, [(x + 2, y + 3) for x, y in points], rgba("#08060f", round(120 * fade)), 4 if arm % 2 == 0 else 3)
        line(draw, points, rgba("#63efff" if arm % 2 else "#f3e8ff", round(alpha * (0.64 + (arm % 2) * 0.1))), 2)
        line(draw, points[3:], rgba("#fff3a9" if arm % 3 == 0 else "#b37aff", round(alpha * 0.62)), 1)

        blade_x, blade_y = points[-1]
        diamond(draw, blade_x + 2, blade_y + 3, 5 + (arm % 2), 9, rgba("#100918", round(124 * fade)))
        diamond(
            draw,
            blade_x,
            blade_y,
            4 + (arm % 2),
            8,
            rgba("#f8f1ff" if arm % 2 else "#74f7ff", round(226 * fade)),
            rgba("#281033", round(168 * fade)),
        )

    for band in range(5):
        start = math.tau * (0.06 + t * (0.58 + band * 0.11) + band * 0.17)
        span = math.tau * (0.18 + band * 0.018 + ignite * 0.06)
        segmented_arc(
            draw,
            cx,
            cy,
            rx + 18 - band * 5,
            ry + 12 - band * 3,
            start,
            span,
            rgba("#fbf4ff" if band == 0 else "#74f4ff", round(alpha * (0.82 - band * 0.08))),
            rgba("#120718", round(142 * fade)),
            3 if band < 2 else 2,
            15,
        )
        segmented_arc(
            draw,
            cx,
            cy,
            rx + 8 - band * 3,
            ry + 5 - band * 2,
            start + math.pi * 0.88,
            span * 0.82,
            rgba("#b97aff" if band % 2 else "#fff1a6", round(alpha * (0.7 - band * 0.06))),
            rgba("#201027", round(122 * fade)),
            2,
            12,
        )

    for index in range(18):
        fall = (t * 1.45 + index * 0.117) % 1
        x = round(cx - rx * 0.84 + (index % 9) * rx * 0.21 + math.sin(index + t * math.tau) * 5)
        y = round(cy - ry - 28 + fall * (ry * 2.2 + 38))
        length = 9 + (index % 4) * 3
        color = rgba("#7ff5ff" if index % 2 else "#e5d2ff", round(120 * fade * recoil))
        line(draw, [(x + 1, y - length // 2 + 2), (x + 1, y + length // 2 + 2)], rgba("#080711", round(82 * fade)), 2)
        line(draw, [(x, y - length // 2), (x, y + length // 2)], color, 1)

    for index in range(14):
        angle = math.tau * (index / 14 - t * 0.2)
        x, y = point(cx, cy, rx * 0.68, ry * 0.54, angle)
        if index % 3 == 0:
            sparkle(draw, x, y, 3, rgba("#fff8c7", round(218 * fade)))
        else:
            diamond(draw, x, y, 2, 4, rgba("#9a72ff" if index % 2 else "#74f7ff", round(190 * fade)), rgba("#211035", round(130 * fade)))

    starburst(draw, cx, cy, 18 + p * 22, rgba("#ffffff", round(164 * fade)), frame, 14)
    prism_lotus(draw, cx, cy, frame, 1.04 + p * 0.08, round(alpha * 0.88))
    diamond(draw, cx + 1, cy + 3, 12 + round(p * 3), 8 + round(p * 2), rgba("#10091b", round(140 * fade)))
    diamond(draw, cx, cy, 9 + round(p * 3), 10 + round(p * 3), rgba("#fdf4ff", round(236 * fade)), rgba("#58307d", round(185 * fade)))

    rune_ticks(draw, cx, cy, rx + 20, ry + 14, rgba("#e9dcff", round(alpha * 0.62)), frame, 18)
    starburst(draw, cx, cy, 22 + p * 18, rgba("#ffffff", round(175 * fade)), frame, 12)
    prism_lotus(draw, cx, cy, frame, 0.95 + p * 0.1, round(alpha * 0.92))
    diamond(draw, cx, cy - round(ry * 0.55) - 8, 5 + round(p * 2), 10 + round(p * 3), rgba("#fff7bd", round(232 * fade)), rgba("#2e1636", round(185 * fade)))
    diamond(draw, cx + round(rx * 0.48), cy + round(ry * 0.28), 4, 7, rgba("#78f1ff", round(210 * fade)), rgba("#12323a", round(160 * fade)))
    diamond(draw, cx - round(rx * 0.5), cy + round(ry * 0.2), 4, 7, rgba("#c29aff", round(210 * fade)), rgba("#211035", round(160 * fade)))


def draw_mage_burst(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    p = pulse(frame)
    t = phase(frame)
    cx, cy = w // 2, round(h * 0.58)
    charge = 1 - (1 - min(1.0, t / 0.26)) ** 3
    bloom = min(1.0, max(0.18, (t + 0.07) / 0.64))
    fade = max(0.0, 1 - max(0.0, t - 0.82) / 0.18)
    alpha = max(52, round(252 * fade))
    rx = round(w * (0.075 + 0.18 * bloom + 0.024 * p))
    ry = round(h * (0.043 + 0.108 * bloom + 0.018 * p))

    draw.ellipse([cx - rx - 16, cy - ry - 10, cx + rx + 16, cy + ry + 11], fill=rgba("#06130a", round(104 * fade)))
    draw.ellipse([cx - rx - 6, cy - ry - 5, cx + rx + 6, cy + ry + 6], fill=rgba("#11311c", round(58 * fade)))

    for tier in range(3):
        spin = math.tau * (0.08 + tier * 0.29 + t * (0.22 + tier * 0.07))
        segmented_arc(
            draw,
            cx,
            cy,
            rx + 12 - tier * 4,
            ry + 8 - tier * 2,
            spin,
            math.tau * (0.22 + charge * 0.11),
            rgba("#fff6b7" if tier == 0 else "#81f6ff", round(alpha * (0.78 - tier * 0.1))),
            rgba("#101407", round(130 * fade)),
            2,
            12,
        )
        segmented_arc(
            draw,
            cx,
            cy,
            rx + 8 - tier * 3,
            ry + 5 - tier * 2,
            spin + math.pi * 0.96,
            math.tau * (0.18 + charge * 0.09),
            rgba("#bfff74" if tier != 1 else "#fff1a6", round(alpha * (0.68 - tier * 0.08))),
            rgba("#101407", round(116 * fade)),
            2 if tier == 0 else 1,
            10,
        )

    for index in range(12):
        angle = math.tau * (index / 12 + t * 0.11)
        dist_x = rx * (0.58 + 0.34 * p)
        dist_y = ry * (0.6 + 0.22 * p)
        x, y = point(cx, cy, dist_x, dist_y, angle)
        leaf = rgba("#c8ff72" if index % 2 == 0 else "#70f4ff", round(216 * fade))
        diamond(draw, x + 1, y + 2, 3 + (index % 4 == 0), 6, rgba("#101408", round(116 * fade)))
        diamond(draw, x, y, 3, 6, leaf, rgba("#233c16", round(158 * fade)))
        if index % 3 == 0:
            line(draw, [point(cx, cy, 5, 4, angle), (x, y)], rgba("#fff2a7", round(104 * fade)), 1)

    for index in range(16):
        angle = math.tau * (index / 16 - t * 0.16)
        if t < 0.36:
            dist = (1 - charge * 0.72) * (w * 0.22)
            x, y = point(cx, cy, dist, dist * 0.48, angle)
            sparkle(draw, x, y, 2 + (index % 5 == 0), rgba("#fff8bd", round(184 * (0.3 + charge * 0.7))))
        else:
            inner = point(cx, cy, rx * 0.12, ry * 0.12, angle)
            outer = point(cx, cy, rx * (0.76 + (index % 3) * 0.05), ry * (0.78 + (index % 2) * 0.05), angle)
            line(draw, [(inner[0] + 1, inner[1] + 2), (outer[0] + 1, outer[1] + 2)], rgba("#101006", round(82 * fade)), 2)
            line(draw, [inner, outer], rgba("#fff2a7", round(132 * fade)), 1)

    rune_ticks(draw, cx, cy, max(12, rx + 12), max(8, ry + 8), rgba("#fff2a8", round(alpha * 0.52)), frame, 12)
    sigil_diamond_chain(draw, cx, cy, rx + 10, ry + 7, frame, 8, rgba("#c8ff72"), rgba("#70f4ff"), round(alpha * 0.66))
    starburst(draw, cx, cy, 13 + p * 13, rgba("#fff4ad", round(160 * fade)), frame, 12)
    prism_lotus(draw, cx, cy, frame, 0.78 + p * 0.1, round(alpha * 0.9))
    diamond(draw, cx, cy - max(7, round(ry * 0.55)), 4 + round(p), 8 + round(p * 2), rgba("#faffea", round(228 * fade)), rgba("#264116", round(165 * fade)))


def draw_heal_pickup(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, round(h * 0.54)
    fade = max(0.0, 1 - t * 0.72)
    rx = round(w * (0.08 + 0.19 * p + 0.1 * t))
    ry = round(h * (0.05 + 0.12 * p + 0.07 * t))

    draw.ellipse([cx - rx - 9, cy - ry - 7, cx + rx + 9, cy + ry + 7], fill=rgba("#08170f", round(78 * fade)))
    segmented_arc(draw, cx, cy, rx + 8, ry + 6, math.tau * (0.12 + t * 0.42), math.tau * 0.58, rgba("#bfff74", round(210 * fade)), rgba("#0e1f10", 105), 2, 12)
    segmented_arc(draw, cx, cy, max(6, rx - 3), max(4, ry - 2), math.tau * (0.74 - t * 0.55), math.tau * 0.48, rgba("#65efff", round(180 * fade)), rgba("#0b1f22", 92), 1, 10)
    for index in range(8):
        angle = math.tau * (index / 8 + t * 0.24)
        x, y = point(cx, cy, rx + 11, ry + 8, angle)
        if index % 2 == 0:
            diamond(draw, x, y, 2, 4, rgba("#fff7b7", round(210 * fade)), rgba("#193014", 130))
        else:
            sparkle(draw, x, y, 2, rgba("#bfff74", round(190 * fade)))
    rect_alpha = round(232 * fade)
    rect(draw, cx - 3, cy - 10, 7, 21, rgba("#f7ffe0", rect_alpha))
    rect(draw, cx - 10, cy - 3, 21, 7, rgba("#f7ffe0", rect_alpha))
    rect(draw, cx - 2, cy - 8, 5, 17, rgba("#8cff72", rect_alpha))
    rect(draw, cx - 8, cy - 2, 17, 5, rgba("#8cff72", rect_alpha))
    sparkle(draw, cx + round(p * 12), cy - 10, 3, rgba("#fff7be", round(210 * fade)))


def draw_hit_impact(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, h // 2
    outer, mid, core = palette
    for i in range(10):
        angle = math.tau * i / 10
        length = round((5 + t * 26) * (1 + (i % 2) * 0.26))
        x1, y1 = point(cx, cy, length * 0.36, length * 0.23, angle)
        x2, y2 = point(cx, cy, length, length * 0.62, angle)
        line(draw, [(x1, y1), (x2, y2)], rgba("#20120b", 120), 3)
        line(draw, [(x1, y1), (x2, y2)], outer if i % 2 else mid, 1 + (i % 3 == 0))
    diamond(draw, cx, cy, 5 + round(p * 4), 4 + round(p * 3), core, rgba("#27150c", 170))
    if frame % 2 == 0:
        sparkle(draw, cx + round(p * 7), cy - round(p * 5), 3, core)


def draw_death_burst(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int) -> None:
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, h // 2
    ellipse_ring(draw, cx, cy, round(w * (0.06 + 0.25 * t)), round(h * (0.045 + 0.18 * t)), rgba("#51265f", round(210 * (1 - t * 0.72))), 3)
    ellipse_ring(draw, cx, cy, round(w * (0.03 + 0.16 * t)), round(h * (0.025 + 0.11 * t)), rgba("#d8a7ff", round(150 * (1 - t * 0.55))), 1)
    for i in range(14):
        angle = math.tau * (i / 10 + t * 0.08)
        x, y = point(cx, cy, w * (0.06 + 0.28 * t), h * (0.05 + 0.2 * t), angle)
        if i % 3 == 0:
            diamond(draw, x, y, 2, 3, rgba("#b36cff", round(210 * (1 - t * 0.35))), rgba("#221033", 130))
        else:
            sparkle(draw, x, y, 2 + (i % 3 == 0), rgba("#b36cff", round(210 * (1 - t * 0.4))))
    if p > 0.1:
        diamond(draw, cx, cy, 6 + round(p * 5), 5 + round(p * 4), rgba("#201226", 220), rgba("#f0d4ff", 170))


def draw_beam(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    cy = h // 2
    outer, mid, core = palette
    ease = lambda value: 1 - (1 - max(0.0, min(1.0, value))) ** 3
    smooth = lambda value: (lambda clamped: clamped * clamped * (3 - 2 * clamped))(max(0.0, min(1.0, value)))
    charge = ease(t / 0.18)
    if t < 0.46:
        extension = smooth(t / 0.46)
    elif t < 0.78:
        extension = 1.0
    else:
        extension = max(0.18, 1 - ease((t - 0.78) / 0.22) * 0.72)
    fade = max(0.0, min(1.0, 1 - max(0.0, t - 0.88) / 0.12))
    energy = fade * (0.45 + charge * 0.55)
    tail = 22 + round(math.sin(t * math.tau * 1.2) * 2)
    max_head = w - 28
    head = tail + round((max_head - tail) * (0.06 + extension * 0.94))
    head = max(tail + 14, min(max_head, head))
    span = max(1, head - tail)
    throat = tail + max(10, min(34, round(span * 0.18)))
    body_end = max(throat + 8, head - 18)
    core_end = max(throat + 12, head - 28)
    wobble = math.sin(t * math.tau * 1.1) * 2.3

    outer_half = 9 + round(p * 5)
    mid_half = 5 + round(p * 3)
    core_half = 2 + round(p * 1.4)
    shadow = rgba("#070914", round(118 * energy))
    glow = with_alpha(outer, round(132 * energy))
    body = with_alpha(mid, round(214 * energy))
    hot = with_alpha(core, round(246 * energy))
    gold = rgba("#fff2a8", round(220 * energy))

    # Starts as a hand-side casting spark, then grows into a narrow lance and retracts.
    origin_x = tail + 2
    draw.ellipse([origin_x - 22, cy - 17, origin_x + 23, cy + 18], fill=rgba("#080914", round(72 * energy)))
    ellipse_ring(draw, origin_x, cy, 15 + round(charge * 7), 16 + round(charge * 5), with_alpha(mid, round(176 * energy)), 3)
    ellipse_ring(draw, origin_x, cy, 8 + round(p * 3), 9 + round(p * 2), gold, 2, start=round(t * 270), end=round(t * 270 + 255))
    diamond(draw, origin_x + 1, cy + 2, 7 + round(p * 3), 10 + round(p * 3), rgba("#080914", round(132 * energy)))
    diamond(draw, origin_x, cy, 5 + round(p * 2), 8 + round(p * 2), hot, rgba("#120a18", round(168 * energy)))

    for i in range(6):
        angle = math.tau * (i / 6 + t * 0.22)
        x, y = point(origin_x, cy, 16 + charge * 10, 11 + charge * 6, angle)
        sparkle(draw, x, y, 2 + (i % 3 == 0), with_alpha(core if i % 2 else rgba("#fff2a8"), round(144 * energy)))

    if extension < 0.16 or span < 28:
        return

    top_curve = [
        (throat, cy - outer_half),
        (round((throat + body_end) * 0.52), round(cy - outer_half - 2 + wobble)),
        (body_end, round(cy - outer_half * 0.58 + wobble * 0.4)),
        (head, cy),
    ]
    bottom_curve = [
        (head, cy),
        (body_end, round(cy + outer_half * 0.58 - wobble * 0.4)),
        (round((throat + body_end) * 0.52), round(cy + outer_half + 2 - wobble)),
        (throat, cy + outer_half),
    ]
    draw.polygon([(x + 2, y + 3) for x, y in top_curve + bottom_curve], fill=rgba("#03050d", round(90 * energy)))
    draw.polygon(top_curve + bottom_curve, fill=shadow)
    draw.polygon(
        [
            (throat + 4, cy - outer_half + 2),
            (body_end, round(cy - outer_half * 0.52 + wobble)),
            (head + 8, cy),
            (body_end, round(cy + outer_half * 0.52 - wobble)),
            (throat + 4, cy + outer_half - 2),
        ],
        fill=glow,
    )
    draw.polygon(
        [
            (throat + 11, cy - mid_half),
            (core_end, round(cy - mid_half + wobble * 0.55)),
            (head - 8, cy),
            (core_end, round(cy + mid_half - wobble * 0.55)),
            (throat + 11, cy + mid_half),
        ],
        fill=body,
    )
    line(draw, [(throat + 18, cy), (core_end, round(cy + wobble * 0.35)), (head - 18, cy)], hot, max(2, core_half + 1))
    line(draw, [(throat + 11, cy - mid_half - 5), (body_end - 7, round(cy - mid_half - 3 + wobble))], with_alpha(core, round(168 * energy)), 2)
    line(draw, [(throat + 11, cy + mid_half + 5), (body_end - 7, round(cy + mid_half + 3 - wobble))], gold, 2)
    line(draw, [(throat + 18, cy - mid_half), (head - 24, round(cy - mid_half * 0.44))], with_alpha(rgba("#9cf8ff"), round(132 * energy)), 1)
    line(draw, [(throat + 18, cy + mid_half), (head - 24, round(cy + mid_half * 0.44))], with_alpha(rgba("#d9bcff"), round(118 * energy)), 1)

    for step in range(9):
        amount = step / 8
        x = round(throat + 22 + amount * max(10, span - 62) + math.sin(t * math.tau * 1.4 + step) * 2)
        if x > head - 15:
            continue
        side = -1 if step % 2 else 1
        y = round(cy + side * (outer_half + 5 + step % 3) + math.cos(t * math.tau + step) * 2)
        line(draw, [(x - 8, y + side * 3), (x + 10, y - side * 1)], with_alpha(core, round(136 * energy)), 2 if step % 3 == 0 else 1)
        if step % 2 == 0:
            diamond(draw, x, y, 2, 3, with_alpha(rgba("#fff2a8") if step % 4 == 0 else core, round(154 * energy)), rgba("#160c1e", round(88 * energy)))

    for i in range(8):
        x = round(head - 16 + math.cos(t * math.tau + i * 0.7) * (4 + p * 2))
        y = round(cy + math.sin(t * math.tau + i * 0.8) * (7 + p * 2))
        sparkle(draw, x, y, 2 + (i % 4 == 0), with_alpha(core, round(190 * energy)))
    diamond(draw, head - 13, cy + round(wobble * 0.6), 10 + round(p * 3), 8 + round(p * 2), hot, with_alpha(mid, round(178 * energy)))
    diamond(draw, head - 2, cy, 5 + round(p * 2), 5 + round(p), gold, with_alpha(core, round(170 * energy)))


def draw_projectile(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, kind: str) -> None:
    t = phase(frame)
    p = pulse(frame)
    cy = h // 2
    x = round(w * (0.48 + math.sin(t * math.tau) * 0.02))
    if kind == "arrow":
        tail = x - 42
        head = x + 38
        line(draw, [(tail - 8, cy + 9), (tail + 22, cy + 4), (head - 22, cy + 2)], rgba("#4ee083", 86), 3)
        line(draw, [(tail - 3, cy - 9), (tail + 24, cy - 4), (head - 24, cy - 2)], rgba("#d8ff99", 78), 2)
        line(draw, [(tail, cy + 3), (head - 13, cy)], rgba("#1b100b", 225), 5)
        line(draw, [(tail + 2, cy + 2), (head - 12, cy - 1)], rgba("#714420", 255), 3)
        line(draw, [(tail + 7, cy - 1), (head - 17, cy - 3)], rgba("#e1ad55", 238), 1)
        draw.polygon([(head - 13, cy - 11), (head + 13, cy), (head - 13, cy + 11)], fill=rgba("#211916", 245))
        draw.polygon([(head - 9, cy - 7), (head + 9, cy), (head - 9, cy + 7)], fill=rgba("#e9e5c9", 250))
        draw.polygon([(head - 5, cy - 4), (head + 5, cy), (head - 5, cy + 4)], fill=rgba("#fff8bd", 235))
        draw.polygon([(tail, cy), (tail - 18, cy - 10), (tail - 14, cy), (tail - 18, cy + 10)], fill=rgba("#203216", 235))
        draw.polygon([(tail + 1, cy - 1), (tail - 13, cy - 7), (tail - 10, cy - 1)], fill=rgba("#79d45b", 238))
        draw.polygon([(tail + 1, cy + 1), (tail - 13, cy + 7), (tail - 10, cy + 1)], fill=rgba("#b7ff8a", 218))
        if frame % 2 == 0:
            sparkle(draw, head - 5, cy - 1, 2 + round(p), rgba("#fff8d2", 220))
    elif kind == "orb":
        draw.ellipse([x - 22, cy - 18, x + 20, cy + 18], fill=rgba("#0f0620", 166))
        ellipse_ring(draw, x, cy, 18 + round(p * 3), 15 + round(p * 2), rgba("#241055", 245), 2)
        ellipse_ring(draw, x, cy, 14, 11, rgba("#aa72ff", 238), 2, start=round(t * 360), end=round(t * 360 + 250))
        ellipse_ring(draw, x, cy, 22, 8, rgba("#56edff", 196), 1, start=round(360 - t * 360), end=round(360 - t * 360 + 226))
        segmented_arc(draw, x, cy, 21, 13, math.tau * (0.72 - t), math.tau * 0.36, rgba("#fff2a8", 210), rgba("#170b23", 120), 1, 9)
        draw.ellipse([x - 10, cy - 10, x + 10, cy + 10], fill=rgba("#6f49e8", 238))
        draw.ellipse([x - 6, cy - 6, x + 6, cy + 6], fill=rgba("#cda8ff", 246))
        diamond(draw, x, cy, 6 + round(p * 2), 7 + round(p * 2), rgba("#f8f1ff", 240), rgba("#342060", 185))
        sparkle(draw, x + 1, cy - 1, 4 + round(p * 2), rgba("#fff7d0", 242))
        for i in range(7):
            tx = x - 32 - i * 7
            ty = cy + 6 + round(math.sin(t * math.tau + i * 0.75) * 5)
            alpha = max(45, 172 - i * 18)
            diamond(draw, tx, ty, 2 + (i == 0), 2 + (i % 2), rgba("#8a67ff", alpha), rgba("#251044", 70))
            if i % 2 == 0:
                sparkle(draw, tx + 1, ty - 3, 2, rgba("#5df2ff", max(45, alpha - 20)))
        line(draw, [(x - 48, cy + 10), (x - 16, cy + 2)], rgba("#5c38c8", 112), 3)
        line(draw, [(x - 43, cy - 8), (x - 13, cy - 2)], rgba("#52eaff", 84), 1)
    elif kind == "turret":
        tail = x - 42
        head = x + 34
        draw.polygon(
            [(tail + 2, cy - 12), (head - 14, cy - 8), (head + 11, cy), (head - 14, cy + 8), (tail + 2, cy + 12), (tail - 10, cy)],
            fill=rgba("#0a1524", 150),
        )
        draw.polygon(
            [(tail + 8, cy - 8), (head - 15, cy - 6), (head + 5, cy), (head - 15, cy + 6), (tail + 8, cy + 8), (tail - 3, cy)],
            fill=rgba("#245b93", 218),
        )
        draw.polygon(
            [(tail + 15, cy - 4), (head - 19, cy - 4), (head - 3, cy), (head - 19, cy + 4), (tail + 15, cy + 4), (tail + 8, cy)],
            fill=rgba("#66dfff", 238),
        )
        line(draw, [(tail + 18, cy), (head - 12, cy)], rgba("#fff1a8", 230), 2)
        draw.polygon([(head - 8, cy - 8), (head + 14, cy), (head - 8, cy + 8)], fill=rgba("#f8fdff", 238))
        draw.polygon([(head - 5, cy - 5), (head + 8, cy), (head - 5, cy + 5)], fill=rgba("#fff0a0", 230))
        for i in range(7):
            tx = tail - 4 - i * 7
            ty = cy + round(math.sin(t * math.tau + i * 0.8) * 5)
            alpha = max(40, 160 - i * 18)
            diamond(draw, tx, ty, 2 + (i % 2 == 0), 2 + (i % 3 == 0), rgba("#45d7ff", alpha), rgba("#10264d", 58))
        if frame % 2 == 0:
            sparkle(draw, head - 5, cy, 3, rgba("#fff8d2", 220))
    else:
        tail = x - 50
        head = x + 42
        draw.polygon(
            [(tail + 2, cy - 14), (head - 18, cy - 10), (head + 13, cy), (head - 18, cy + 10), (tail + 2, cy + 14), (tail - 13, cy)],
            fill=rgba("#24110a", 150),
        )
        draw.polygon(
            [(tail + 9, cy - 10), (head - 19, cy - 8), (head + 7, cy), (head - 19, cy + 8), (tail + 9, cy + 10), (tail - 4, cy)],
            fill=rgba("#b76424", 224),
        )
        draw.polygon(
            [(tail + 17, cy - 5), (head - 24, cy - 5), (head - 5, cy), (head - 24, cy + 5), (tail + 17, cy + 5), (tail + 8, cy)],
            fill=rgba("#ffd36e", 240),
        )
        line(draw, [(tail + 20, cy), (head - 15, cy)], rgba("#9df7ff", 226), 3)
        draw.polygon([(head - 10, cy - 10), (head + 17, cy), (head - 10, cy + 10)], fill=rgba("#fff4c9", 242))
        draw.polygon([(head - 6, cy - 6), (head + 10, cy), (head - 6, cy + 6)], fill=rgba("#ffffff", 230))
        for i in range(9):
            tx = tail - 2 - i * 8
            ty = cy + round(math.sin(t * math.tau + i * 0.72) * 7)
            alpha = max(36, 180 - i * 17)
            color = rgba("#ffb23d", alpha) if i % 2 else rgba("#6ff3ff", alpha)
            diamond(draw, tx, ty, 2 + (i % 3 == 0), 2 + (i % 2 == 0), color, rgba("#25110a", 64))
        sparkle(draw, head + 3, cy, 4, rgba("#ffffff", 236))


def draw_status(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 0:
        return
    if row == 1:
        t = phase(frame)
        p = pulse(frame)
        cx, cy = w // 2, round(h * 0.58)
        rx = round(w * (0.22 + p * 0.035))
        ry = round(h * (0.13 + p * 0.022))
        draw.ellipse([cx - rx - 7, cy - ry - 5, cx + rx + 7, cy + ry + 5], fill=rgba("#07131f", 64))
        for offset, color in ((0.04, rgba("#72dfff", 190)), (0.42, rgba("#fff1a8", 210)), (0.72, rgba("#476dff", 160))):
            segmented_arc(draw, cx, cy, rx, ry, math.tau * (offset + t * 0.38), math.tau * 0.32, color, rgba("#061123", 102), 2, 9)
        orbit_crystals(draw, cx, cy, rx + 5, ry + 4, frame, 6, (rgba("#fff1a8"), rgba("#72dfff")), 180)
        diamond(draw, cx, cy, 5 + round(p * 2), 4 + round(p), rgba("#e8f9ff", 205), rgba("#18334a", 150))
    elif row == 2:
        cx, cy = w // 2, round(h * 0.58)
        rx, ry = round(w * 0.24), round(h * 0.13)
        segmented_arc(draw, cx, cy, rx, ry, math.tau * (0.16 + phase(frame) * 0.15), math.tau * 0.62, rgba("#75d64f", 168), rgba("#10220f", 115), 2, 12)
        for i in range(8):
            x, y = point(cx, cy, w * 0.23, h * 0.12, math.tau * (i / 8 + phase(frame) * 0.1))
            diamond(draw, x, y, 2, 3, rgba("#b8ff75", 210), rgba("#21451c", 160))
    else:
        cx, cy = w // 2, round(h * 0.54)
        segmented_arc(draw, cx, cy, round(w * 0.21), round(h * 0.12), math.tau * phase(frame), math.tau * 0.58, rgba("#a66dff", 166), rgba("#160c24", 110), 2, 10)
        for i in range(7):
            x, y = point(cx, cy, w * 0.17, h * 0.1, math.tau * (i / 7 + phase(frame) * 0.25))
            sparkle(draw, x, y, 2 + (i % 3 == 0), rgba("#f4d8ff", 210))


def draw_rpg_status_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    status = RPG_STATUSES[row]
    outer, mid, core = RPG_STATUS_PALETTES[status]
    t = phase(frame)
    p = pulse(frame)
    cx, cy = w // 2, round(h * 0.56)
    shadow = rgba("#100806", 95)

    if status == "burn":
        draw.ellipse([cx - 18, cy + 11, cx + 18, cy + 19], fill=rgba("#100806", 64))
        for index in range(5):
            x = cx - 15 + index * 7 + round(math.sin(t * math.tau + index) * 2)
            base_y = cy + 17 - (index % 2) * 3
            height = 10 + (index % 3) * 4 + round(p * 5)
            pts = [(x - 4, base_y), (x + 1, base_y - height), (x + 5, base_y), (x, base_y + 3)]
            draw.polygon([(px + 1, py + 2) for px, py in pts], fill=shadow)
            draw.polygon(pts, fill=with_alpha(mid, 224))
            draw.polygon([(x - 2, base_y - 1), (x + 1, base_y - height + 5), (x + 3, base_y - 1)], fill=with_alpha(core, 235))
        return

    if status == "poison":
        ellipse_ring(draw, cx, cy + 7, 20 + round(p * 2), 11, with_alpha(mid, 120), 1)
        for index in range(7):
            rise = (t + index * 0.14) % 1
            x = cx - 19 + (index % 4) * 13 + round(math.sin(t * math.tau + index) * 2)
            y = cy + 18 - round(rise * 34)
            radius = 2 + (index % 3 == 0)
            draw.ellipse([x - radius + 1, y - radius + 2, x + radius + 1, y + radius + 2], fill=shadow)
            ellipse_ring(draw, x, y, radius + 1, radius + 1, with_alpha(mid, 220), 1)
            rect(draw, x, y - 1, 2, 2, with_alpha(core, 220))
        return

    if status == "stun":
        ellipse_ring(draw, cx, cy - 6, 22, 8 + round(p * 2), with_alpha(mid, 185), 1, start=round(t * 360), end=round(t * 360 + 270))
        for index in range(6):
            angle = math.tau * (index / 6 + t * 0.18)
            x, y = point(cx, cy - 8, 22, 9, angle)
            sparkle(draw, x + 1, y + 2, 3, shadow)
            sparkle(draw, x, y, 2 + (index % 2), with_alpha(core if index % 2 else mid, 228))
        return

    if status == "guard":
        rx = 27 + round(p * 3)
        ry = 22 + round(p * 2)
        draw.ellipse([cx - rx - 3, cy - ry - 2, cx + rx + 3, cy + ry + 4], fill=rgba("#06101b", 58))
        segmented_arc(draw, cx, cy, rx, ry, math.tau * (0.04 + t * 0.18), math.tau * 0.78, with_alpha(mid, 230), shadow, 2, 14)
        segmented_arc(draw, cx, cy, rx - 9, ry - 7, math.tau * (0.66 - t * 0.16), math.tau * 0.58, with_alpha(core, 180), shadow, 1, 11)
        for x, y in ((cx - rx, cy - 2), (cx + rx, cy - 2), (cx, cy + ry - 1)):
            diamond(draw, x + 1, y + 2, 3, 4, shadow)
            diamond(draw, x, y, 2, 3, with_alpha(core, 230), with_alpha(mid, 160))
        return

    if status == "regen":
        ellipse_ring(draw, cx, cy + 13, 23, 8, with_alpha(mid, 120), 1)
        for index in range(5):
            rise = (t + index * 0.17) % 1
            x = cx - 18 + index * 9
            y = cy + 17 - round(rise * 31)
            sparkle(draw, x + 1, y + 2, 4, shadow)
            line(draw, [(x, y - 4), (x, y + 4)], with_alpha(core, 226), 2)
            line(draw, [(x - 4, y), (x + 4, y)], with_alpha(mid, 226), 2)
        return


def draw_ability(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 0:
        draw_slash(draw, w, h, frame, (rgba("#6ecbff", 110), rgba("#7ff2ff", 210), rgba("#ffffff", 240)))
    elif row == 1:
        draw_warrior_basic_slash(draw, w, h, frame)
    elif row == 2:
        draw_engineer_basic_strike(draw, w, h, frame)
    elif row == 3:
        draw_ground_rune(draw, w, h, frame, (rgba("#6b4a21", 150), rgba("#ffc35b", 220), rgba("#fff6bc", 240)))
        draw_slash(draw, w, h, frame, (rgba("#f08b38", 110), rgba("#ffd070", 210), rgba("#ffffff", 230)))
    elif row == 4:
        draw_seed_rain(draw, w, h, frame)
    elif row == 5:
        draw_overclock(draw, w, h, frame, (rgba("#2c4fd6", 180), rgba("#4ed8ff", 220), rgba("#fff9a8", 230)))
    elif row == 6:
        draw_clean_storm(draw, w, h, frame)
    elif row == 7:
        draw_mage_burst(draw, w, h, frame)
    elif row == 8:
        draw_hit_impact(draw, w, h, frame, (rgba("#ff8f34", 160), rgba("#ffd25b", 220), rgba("#ffffff", 240)))
    else:
        draw_death_burst(draw, w, h, frame)


def draw_warrior_archer(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 0:
        draw_warrior_charge_afterimage(draw, w, h, frame)
    elif row == 1:
        draw_ground_rune(draw, w, h, frame, (rgba("#4459ff", 120), rgba("#72caff", 210), rgba("#fff1a6", 235)))
    elif row == 2:
        draw_ground_rune(draw, w, h, frame, (rgba("#6b2d16", 150), rgba("#ffb34e", 220), rgba("#fff4bd", 240)))
        sparkle(draw, w // 2, h // 3, 5, rgba("#ffffff", 240))
    elif row == 3:
        draw_archer_roll_afterimage(draw, w, h, frame)
    elif row == 4:
        cx, cy = w // 2, round(h * 0.63)
        t = phase(frame)
        p = pulse(frame)
        rx = round(w * (0.2 + 0.05 * p))
        ry = round(h * (0.105 + 0.032 * p))
        draw.ellipse([cx - rx - 12, cy - ry - 7, cx + rx + 12, cy + ry + 7], fill=rgba("#07170b", 72))
        ellipse_ring(draw, cx, cy, rx + 7, ry + 4, rgba("#153b18", 210), 4)
        ellipse_ring(draw, cx, cy, rx + 3, ry + 2, rgba("#6fe45a", 220), 2, start=round(t * 260), end=round(t * 260 + 236))
        segmented_arc(draw, cx, cy, rx + 10, ry + 6, math.tau * (0.1 + t * 0.16), math.tau * 0.72, rgba("#d7ff8b", 218), rgba("#112c12", 135), 2, 14)
        segmented_arc(draw, cx, cy, rx - 4, max(7, ry - 3), math.tau * (0.62 - t * 0.14), math.tau * 0.48, rgba("#67d94a", 204), rgba("#0f2711", 120), 2, 10)
        for i in range(12):
            angle = math.tau * (i / 12 + t * 0.12)
            x, y = point(cx, cy, rx * (0.48 + 0.44 * p), ry * (0.48 + 0.44 * p), angle)
            leaf = rgba("#baff73", 230) if i % 3 else rgba("#f3ffad", 230)
            diamond(draw, x, y, 3, 5, leaf, rgba("#1d4017", 185))
        for i in range(5):
            angle = math.tau * (i / 5 + 0.18 + t * 0.08)
            x, y = point(cx, cy, rx * 0.72, ry * 0.65, angle)
            line(draw, [(cx, cy + 2), (x, y)], rgba("#5aa643", 88), 1)
    else:
        draw_seed_rain(draw, w, h, frame)


def draw_engineer(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 0:
        draw_ground_rune(draw, w, h, frame, (rgba("#32313a", 160), rgba("#8ba0b8", 210), rgba("#ffcc68", 230)))
        for i in range(4):
            x, y = point(w // 2, round(h * 0.58), w * 0.17, h * 0.11, math.tau * (i / 4 + phase(frame) * 0.08))
            draw.rectangle([x - 3, y - 3, x + 3, y + 3], fill=rgba("#524033", 220))
    elif row == 1:
        draw_beam(draw, w, h, frame, (rgba("#ff7229", 110), rgba("#ffd050", 225), rgba("#ffffff", 240)))
    else:
        draw_overclock(draw, w, h, frame, (rgba("#293d68", 190), rgba("#5ddcff", 220), rgba("#fff2a4", 235)))


def draw_mage(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 0:
        draw_mage_burst(draw, w, h, frame)
    else:
        draw_clean_storm(draw, w, h, frame)


def draw_combat(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 0:
        draw_beam(draw, w, h, frame, (rgba("#6c5cff", 100), rgba("#45e8ff", 220), rgba("#ffffff", 240)))
    elif row == 1:
        draw_projectile(draw, w, h, frame, "arrow")
    elif row == 2:
        draw_projectile(draw, w, h, frame, "orb")
    elif row == 3:
        draw_projectile(draw, w, h, frame, "turret")
    elif row == 4:
        draw_projectile(draw, w, h, frame, "boosted")
    elif row == 5:
        draw_hit_impact(draw, w, h, frame, (rgba("#ff7c32", 150), rgba("#ffd256", 220), rgba("#ffffff", 240)))
    elif row == 6:
        draw_hit_impact(draw, w, h, frame, (rgba("#5d77ff", 145), rgba("#9be8ff", 220), rgba("#fff4a4", 235)))
    elif row == 7:
        draw_heal_pickup(draw, w, h, frame)
    else:
        draw_death_burst(draw, w, h, frame)


def draw_rpg_projectile_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, element: str, variant: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    outer, mid, core = palette
    cy = round(h * (0.52 + math.sin(t * math.tau + variant) * 0.025))
    x = round(w * (0.18 + 0.64 * t))
    trail = 22 + (variant % 5) * 3
    shadow = rgba("#120b08", round(115 * (1 - max(0, t - 0.82) / 0.18)))
    if element == "water":
        draw.arc([x - trail, cy - 19, x + 20, cy + 18], 198, 32, fill=with_alpha(mid, 210), width=3)
        draw.arc([x - trail + 7, cy - 14, x + 16, cy + 14], 198, 28, fill=with_alpha(core, 210), width=1)
        ellipse_ring(draw, x, cy, 8 + round(p * 2), 7 + round(p * 2), with_alpha(mid, 225), 2)
        for i in range(4):
            ellipse_ring(draw, x - 15 - i * 8, cy + (i % 2) * 4, 2, 3, with_alpha(outer, 150 - i * 18), 1)
    elif element == "fire":
        draw.polygon([(x - trail, cy + 13), (x - 4, cy - 22 - round(p * 5)), (x + 19, cy), (x - 4, cy + 20)], fill=shadow)
        draw.polygon([(x - trail + 5, cy + 9), (x - 1, cy - 18 - round(p * 4)), (x + 15, cy), (x - 1, cy + 16)], fill=with_alpha(mid, 222))
        draw.polygon([(x - 12, cy + 5), (x, cy - 10), (x + 9, cy), (x, cy + 10)], fill=with_alpha(core, 238))
    elif element == "grass":
        line(draw, [(x - trail, cy + 8), (x - 6, cy + 1), (x + 18, cy - 2)], shadow, 4)
        line(draw, [(x - trail + 4, cy + 6), (x - 4, cy), (x + 15, cy - 1)], with_alpha(mid, 225), 2)
        for i in range(4):
            leaf_x = x - 17 + i * 9
            leaf_y = cy - 7 + round(math.sin(t * math.tau + i) * 4)
            diamond(draw, leaf_x, leaf_y, 3, 6, with_alpha(core if i % 2 else outer, 212), rgba("#1b320f", 150))
    elif element == "dark":
        draw.arc([x - trail, cy - 19, x + 19, cy + 19], 205, 28, fill=with_alpha(mid, 220), width=4)
        draw.arc([x - trail + 8, cy - 14, x + 13, cy + 15], 210, 28, fill=with_alpha(core, 190), width=2)
        diamond(draw, x, cy, 9 + round(p * 2), 11 + round(p * 2), with_alpha(outer, 230), rgba("#170a26", 170))
        for i in range(5):
            sparkle(draw, x - 18 - i * 7, cy + round(math.sin(i + t * 5) * 7), 2, with_alpha(core, 160 - i * 14))
    else:
        starburst(draw, x, cy, 12 + p * 8, with_alpha(core, 220), frame, 8)
        diamond(draw, x + 1, cy + 2, 12, 10, shadow)
        diamond(draw, x, cy, 9 + round(p * 2), 11 + round(p * 2), with_alpha(mid, 226), rgba("#5d3f13", 160))
        sparkle(draw, x + 2, cy - 1, 5, with_alpha(core, 238))


def draw_rpg_rain_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, element: str, variant: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    outer, mid, core = palette
    for i in range(13):
        fall = (t * 1.28 + i * 0.103 + variant * 0.017) % 1
        x = round(w * (0.12 + (i % 7) * 0.125 + math.sin(i + variant) * 0.012))
        y = round(h * (0.05 + fall * 0.78))
        length = 7 + (i % 4) * 3
        color = core if i % 3 == 0 else mid if i % 2 else outer
        line(draw, [(x + 1, y - length + 2), (x + 1, y + length // 2 + 2)], rgba("#0d0908", 82), 2)
        line(draw, [(x, y - length), (x, y + length // 2)], with_alpha(color, 210), 1)
        if element in ("grass", "light") and i % 3 == 0:
            diamond(draw, x + 3, y + 4, 2, 4, with_alpha(core, 190), rgba("#21320f", 130))
        if element == "fire" and i % 2 == 0:
            sparkle(draw, x, y + 7, 2, with_alpha(core, 205))
    ellipse_ring(draw, w // 2, round(h * 0.78), round(w * 0.28), round(h * 0.08), with_alpha(mid, 122), 1)


def draw_rpg_wave_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, element: str, variant: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    outer, mid, core = palette
    cy = round(h * (0.6 + math.sin(t * math.tau) * 0.03))
    for band in range(3):
        points: list[tuple[int, int]] = []
        for step in range(14):
            amount = step / 13
            x = round(w * (-0.08 + amount * 1.18))
            y = round(cy + math.sin(amount * math.tau * (1.1 + band * 0.12) + t * math.tau + variant) * (5 + band * 3 + p * 4) - band * 7)
            points.append((x, y))
        color = (core, mid, outer)[band]
        line(draw, [(x + 2, y + 3) for x, y in points], rgba("#0e0907", 76), 4 - min(2, band))
        line(draw, points, with_alpha(color, 216 - band * 28), 3 - min(2, band))
    for i in range(7):
        x = round(w * (0.12 + i * 0.13 + t * 0.08))
        y = round(cy + math.sin(i + t * math.tau) * 12)
        diamond(draw, x, y, 2 + (i % 2), 3 + (i % 3 == 0), with_alpha(core if i % 2 else mid, 185), rgba("#1b1008", 100))


def draw_rpg_aura_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, element: str, variant: int, palette: tuple[Color, Color, Color], field: bool = False) -> None:
    t = phase(frame)
    p = pulse(frame)
    outer, mid, core = palette
    cx, cy = w // 2, round(h * (0.63 if field else 0.58))
    rx = round(w * ((0.34 if field else 0.23) + p * 0.05))
    ry = round(h * ((0.15 if field else 0.11) + p * 0.035))
    draw.ellipse([cx - rx - 10, cy - ry - 7, cx + rx + 10, cy + ry + 7], fill=rgba("#070604", round(64 + p * 40)))
    segmented_arc(draw, cx, cy, rx + 5, ry + 4, math.tau * (0.12 + t * 0.28), math.tau * 0.62, with_alpha(mid, 220), rgba("#100a08", 120), 2, 14)
    segmented_arc(draw, cx, cy, max(8, rx - 8), max(5, ry - 5), math.tau * (0.72 - t * 0.24), math.tau * 0.5, with_alpha(core, 195), rgba("#100a08", 108), 1, 12)
    count = 10 if field else 7
    for i in range(count):
        angle = math.tau * (i / count + t * 0.12 + variant * 0.013)
        x, y = point(cx, cy, rx + 6, ry + 4, angle)
        if i % 2 == 0:
            diamond(draw, x, y, 2 + (i % 3 == 0), 4, with_alpha(core, 214), rgba("#25160a", 140))
        else:
            sparkle(draw, x, y, 2 + (i % 3 == 0), with_alpha(mid, 190))
    if field:
        for offset in (-34, 0, 34):
            ellipse_ring(draw, cx + offset, cy - 2 + round(math.sin(t * math.tau + offset) * 2), 13, 7, with_alpha(outer, 110), 1)
    diamond(draw, cx, cy - ry - 8, 4 + round(p * 2), 7 + round(p * 2), with_alpha(core, 230), rgba("#291a0b", 155))


def draw_rpg_burst_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, element: str, variant: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    outer, mid, core = palette
    cx, cy = w // 2, round(h * 0.54)
    radius = 8 + t * 33
    for i in range(12):
        angle = math.tau * (i / 12 + variant * 0.011)
        inner = point(cx, cy, radius * 0.16, radius * 0.1, angle)
        outer_point = point(cx, cy, radius * (0.7 + (i % 3) * 0.1), radius * (0.45 + (i % 2) * 0.05), angle + t * 0.34)
        line(draw, [(inner[0] + 1, inner[1] + 2), (outer_point[0] + 1, outer_point[1] + 2)], rgba("#0d0907", 92), 3)
        line(draw, [inner, outer_point], with_alpha(mid if i % 2 else outer, 215), 1 + (i % 3 == 0))
    ellipse_ring(draw, cx, cy, round(radius * 0.52), round(radius * 0.34), with_alpha(mid, 168), 2)
    diamond(draw, cx + 1, cy + 2, 8 + round(p * 4), 8 + round(p * 3), rgba("#100b08", 130))
    diamond(draw, cx, cy, 7 + round(p * 4), 8 + round(p * 4), with_alpha(core, 235), with_alpha(mid, 170))
    if element in ("dark", "light"):
        starburst(draw, cx, cy, 18 + p * 18, with_alpha(core, 150), frame, 10)


def draw_rpg_summon_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, frame: int, element: str, variant: int, palette: tuple[Color, Color, Color]) -> None:
    t = phase(frame)
    p = pulse(frame)
    outer, mid, core = palette
    cx, cy = w // 2, round(h * 0.58)
    gate_h = round(h * (0.2 + 0.42 * p))
    gate_w = round(w * (0.11 + 0.08 * p))
    draw.rectangle([cx - gate_w - 4, cy - gate_h - 3, cx + gate_w + 4, cy + gate_h + 5], fill=rgba("#090607", round(72 + 52 * p)))
    segmented_arc(draw, cx, cy, gate_w + 12, gate_h, math.tau * (0.72 + t * 0.24), math.tau * 0.58, with_alpha(mid, 224), rgba("#120907", 125), 2, 14)
    segmented_arc(draw, cx, cy, gate_w + 5, max(12, gate_h - 8), math.tau * (0.18 - t * 0.2), math.tau * 0.54, with_alpha(core, 200), rgba("#120907", 110), 1, 12)
    for i in range(9):
        angle = math.tau * (i / 9 + t * 0.14)
        x, y = point(cx, cy, gate_w + 18, max(12, gate_h - 2), angle)
        diamond(draw, x, y, 3, 5, with_alpha(core if i % 2 else outer, 210), rgba("#251208", 145))
    starburst(draw, cx, cy, 15 + p * 22, with_alpha(core, 160), frame, 12)
    diamond(draw, cx, cy - gate_h - 4, 5 + round(p * 2), 8 + round(p * 3), with_alpha(core, 232), with_alpha(mid, 165))


def draw_rpg_projectile_sprite(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    element = RPG_ELEMENTS[row]
    outer, mid, core = RPG_ELEMENT_PALETTES[element]
    t = phase(frame)
    p = pulse(frame)
    cy = max(14, min(h - 13, round(h * (0.56 + math.sin(t * math.tau + row * 0.71) * 0.05))))
    tip_x = min(w - 12, round(w * (0.66 + math.sin(t * math.tau + row) * 0.035)))
    tail_x = max(5, tip_x - 26 - row - round(p * 4))
    mid_x = round((tail_x + tip_x) / 2)
    shadow = rgba("#0f0806", 132)
    drift = round(math.sin(t * math.tau * 2 + row) * 2)
    head_rx = 6 + round(p * 2)
    head_ry = 7 + round(p * 2)

    line(draw, [(tail_x + 2, cy + 5), (mid_x, cy + 2 + drift), (tip_x - 2, cy + 3)], shadow, 10)
    line(draw, [(tail_x, cy + 2), (mid_x, cy + drift), (tip_x - 3, cy)], with_alpha(outer, 218), 7)
    line(draw, [(tail_x + 5, cy + 1), (mid_x + 2, cy - 1 + drift), (tip_x - 2, cy - 1)], with_alpha(mid, 232), 5)
    line(draw, [(tail_x + 11, cy), (tip_x - 3, cy - 1)], with_alpha(core, 244), 2)

    if element == "fire":
        draw.polygon(
            [(tail_x + 5, cy + 6), (mid_x, cy - 7 - round(p * 2)), (tip_x + 4, cy), (mid_x + 1, cy + 8)],
            fill=with_alpha(mid, 220),
        )
        diamond(draw, tip_x - 1, cy, head_rx, head_ry, with_alpha(core, 242), rgba("#6b240e", 160))
    elif element == "grass":
        for index in range(5):
            leaf_x = tail_x + 7 + index * 7
            leaf_y = cy - 5 + round(math.sin(t * math.tau + index) * 2)
            diamond(draw, leaf_x, leaf_y, 2 + index % 2, 4, with_alpha(core if index % 2 else outer, 220), rgba("#16240c", 150))
        diamond(draw, tip_x, cy, head_rx, head_ry, with_alpha(mid, 226), rgba("#21320f", 165))
    elif element == "dark":
        draw.arc([tail_x - 1, cy - 10, tip_x + 4, cy + 10], 198, 38, fill=with_alpha(mid, 225), width=5)
        draw.arc([tail_x + 6, cy - 7, tip_x + 1, cy + 8], 205, 36, fill=with_alpha(core, 202), width=2)
        diamond(draw, tip_x, cy, head_rx + 1, head_ry + 2, with_alpha(outer, 235), rgba("#16091f", 174))
    elif element == "light":
        light_cy = min(cy, h - 15)
        starburst(draw, tip_x, light_cy, 7 + p * 3, with_alpha(core, 205), frame, 8)
        diamond(draw, tip_x + 1, light_cy + 1, head_rx + 2, head_ry, shadow)
        diamond(draw, tip_x, light_cy, head_rx, head_ry, with_alpha(mid, 232), rgba("#5d3f13", 168))
        sparkle(draw, tip_x + 3, light_cy - 2, 3, with_alpha(core, 240))
    else:
        ellipse_ring(draw, tip_x, cy, head_rx + 2, head_ry, with_alpha(mid, 230), 2)
        ellipse_ring(draw, tip_x, cy, max(3, head_rx - 2), max(3, head_ry - 2), with_alpha(core, 222), 1)
        for index in range(4):
            ellipse_ring(draw, tail_x + 6 + index * 6, cy + (index % 2) * 2 - 2, 2, 3, with_alpha(outer, 170 - index * 20), 1)

    for index in range(3):
        mote_x = max(4, tail_x + 2 + index * 8 + round(math.sin(t * math.tau + index + row) * 2))
        mote_y = max(4, min(h - 5, cy - 8 + index * 7 + round(math.cos(t * math.tau + index) * 2)))
        sparkle(draw, mote_x, mote_y, 1 + (index == 1 and frame % 2 == 0), with_alpha(core if index % 2 else mid, 158 - index * 18))


def draw_rpg_move_signature(
    draw: ImageDraw.ImageDraw,
    w: int,
    h: int,
    frame: int,
    row: int,
    element: str,
    palette: tuple[Color, Color, Color],
) -> None:
    t = phase(frame)
    p = pulse(frame)
    outer, mid, core = palette
    motif = row % 5
    tier = 2 if row >= 20 else 1 if row >= 10 else 0
    cx = round(w * (0.22 + (row % 4) * 0.18))
    cy = round(h * (0.24 + ((row * 3) % 5) * 0.08))
    drift = round(math.sin(t * math.tau + row) * (2 + tier))
    alpha = 128 + tier * 26
    shadow = rgba("#100906", 88)

    if motif == 0:
        sigil_diamond_chain(draw, cx, cy + drift, 10 + tier * 4, 6 + tier * 2, frame, 4 + tier, mid, core, alpha)
    elif motif == 1:
        for index in range(4 + tier):
            x = round(w * (0.16 + index * 0.18 + math.sin(t * math.tau + index + row) * 0.012))
            y = round(h * (0.2 + ((index + row) % 3) * 0.17 + p * 0.05))
            sparkle(draw, x + 1, y + 2, 3 + (index % 2), shadow)
            sparkle(draw, x, y, 2 + (index % 2) + tier, with_alpha(core if index % 2 else mid, alpha + 40))
    elif motif == 2:
        start = math.tau * (0.1 + t * (0.18 + row % 3 * 0.04))
        segmented_arc(draw, cx, cy + drift, 18 + tier * 5, 9 + tier * 2, start, math.tau * 0.58, with_alpha(mid, alpha + 44), shadow, 1 + tier, 10)
        segmented_arc(draw, cx, cy + drift, 9 + tier * 3, 5 + tier, start + math.pi, math.tau * 0.44, with_alpha(core, alpha + 22), shadow, 1, 8)
    elif motif == 3:
        for index in range(5 + tier):
            angle = math.tau * (index / (5 + tier) + t * 0.09)
            x, y = point(cx, cy + drift, 14 + tier * 5, 8 + tier * 3, angle)
            diamond(draw, x + 1, y + 2, 3 + (index % 2), 4 + (index % 3 == 0), shadow)
            diamond(draw, x, y, 2 + (index % 2), 4 + (index % 3 == 0), with_alpha(core if index % 2 else outer, alpha + 30), with_alpha(mid, 122))
    else:
        offset = 4 + tier * 2
        line(draw, [(cx - 12, cy + drift + offset), (cx + 12, cy + drift - offset)], shadow, 3)
        line(draw, [(cx - 10, cy + drift + offset - 1), (cx + 10, cy + drift - offset - 1)], with_alpha(mid, alpha + 46), 1 + tier)
        diamond(draw, cx, cy + drift, 4 + tier, 7 + tier, with_alpha(core, alpha + 52), with_alpha(outer, 150))

    if element == "light" and row % 2 == 0:
        sparkle(draw, min(w - 10, cx + 18), max(8, cy - 10), 2 + tier, with_alpha(core, 170))
    elif element == "dark" and row % 2 == 1:
        diamond(draw, max(8, cx - 18), min(h - 8, cy + 12), 3 + tier, 5 + tier, with_alpha(outer, 170), rgba("#16091f", 150))


def draw_rpg_skill_vfx(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int, element: str) -> None:
    style = RPG_SKILL_STYLE_ROWS[row]
    palette = RPG_ELEMENT_PALETTES[element]
    variant = row + RPG_ELEMENTS.index(element) * 7
    if style == "strike":
        draw_slash(draw, w, h, frame, palette)
        if row % 5 == 4:
            draw_hit_impact(draw, w, h, frame, palette)
    elif style == "projectile":
        draw_rpg_projectile_vfx(draw, w, h, frame, element, variant, palette)
    elif style == "beam":
        draw_beam(draw, w, h, frame, palette)
    elif style == "burst":
        draw_rpg_burst_vfx(draw, w, h, frame, element, variant, palette)
    elif style == "rain":
        draw_rpg_rain_vfx(draw, w, h, frame, element, variant, palette)
    elif style == "aura":
        draw_rpg_aura_vfx(draw, w, h, frame, element, variant, palette, field=False)
    elif style == "wave":
        draw_rpg_wave_vfx(draw, w, h, frame, element, variant, palette)
    elif style == "field":
        draw_rpg_aura_vfx(draw, w, h, frame, element, variant, palette, field=True)
    elif style == "summon":
        draw_rpg_summon_vfx(draw, w, h, frame, element, variant, palette)
    else:
        draw_ground_rune(draw, w, h, frame, palette)
    draw_rpg_move_signature(draw, w, h, frame, row, element, palette)


def draw_skill_effects(draw: ImageDraw.ImageDraw, w: int, h: int, row: int, frame: int) -> None:
    if row == 1:
        draw_status(draw, w, h, 1, frame)
    elif row == 2:
        draw_mage_burst(draw, w, h, frame)
    elif row == 3:
        draw_clean_storm(draw, w, h, frame)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_sheet("status-effects.png", FRAME_COUNT, 4, 192, 116, draw_status)
    make_sheet("ability-effects.png", FRAME_COUNT, 10, 192, 160, draw_ability)
    make_sheet("warrior-archer-effects.png", FRAME_COUNT, 6, 320, 224, draw_warrior_archer)
    make_sheet("engineer-effects.png", FRAME_COUNT, 3, 384, 240, draw_engineer)
    make_sheet("mage-effects.png", MAGE_FRAME_COUNT, 2, 384, 256, draw_mage)
    make_sheet("combat-effects.png", FRAME_COUNT, 9, 384, 240, draw_combat)
    make_sheet("skill-effects.png", FRAME_COUNT, 6, 192, 192, draw_skill_effects)
    make_sheet(
        "rpg-status-vfx.png",
        RPG_STATUS_VFX_COLUMNS,
        RPG_STATUS_VFX_ROWS,
        RPG_STATUS_VFX_CELL_W,
        RPG_STATUS_VFX_CELL_H,
        draw_rpg_status_vfx,
    )
    make_sheet(
        "rpg-skill-projectiles.png",
        RPG_PROJECTILE_COLUMNS,
        RPG_PROJECTILE_ROWS,
        RPG_PROJECTILE_CELL_W,
        RPG_PROJECTILE_CELL_H,
        draw_rpg_projectile_sprite,
    )
    for element in RPG_ELEMENTS:
        make_sheet(
            f"rpg-skill-vfx-{element}.png",
            RPG_SKILL_VFX_COLUMNS,
            RPG_SKILL_VFX_ROWS,
            RPG_SKILL_VFX_CELL_W,
            RPG_SKILL_VFX_CELL_H,
            lambda draw, w, h, row, frame, element=element: draw_rpg_skill_vfx(draw, w, h, row, frame, element),
        )


if __name__ == "__main__":
    main()

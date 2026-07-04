#!/usr/bin/env python3
"""Generate visual upgrade candidate art for Starfall Survivor.

The output is intentionally non-destructive: files are written under
assets/art_source/visual_upgrade_candidates/ for review before any runtime
asset replacement.
"""
from __future__ import annotations

import json
import math
import random
import uuid
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "art_source" / "visual_upgrade_candidates"

PALETTE = {
    "void": "#070A12",
    "ink": "#0B1020",
    "navy": "#101A3A",
    "slate": "#18213A",
    "steel": "#273654",
    "cream": "#FFF4D6",
    "teal": "#37F0D4",
    "cyan": "#4AB8FF",
    "amber": "#FFB84A",
    "orange": "#FF6A3D",
    "magenta": "#F25CFF",
    "violet": "#8A64FF",
    "lime": "#A7FF5A",
    "red": "#FF426A",
}


def rgb(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
        alpha,
    )


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "",
    ]
    for path in candidates:
        if not path:
            continue
        try:
            return ImageFont.truetype(path, size=size, index=0)
        except Exception:
            continue
    return ImageFont.load_default()


def gradient(size: tuple[int, int], stops: Sequence[tuple[float, str]]) -> Image.Image:
    width, height = size
    img = Image.new("RGBA", size)
    px = img.load()
    stop_values = [(p, rgb(c)) for p, c in stops]
    assert px is not None
    for y in range(height):
        t = y / max(1, height - 1)
        left = stop_values[0]
        right = stop_values[-1]
        for index in range(len(stop_values) - 1):
            if stop_values[index][0] <= t <= stop_values[index + 1][0]:
                left = stop_values[index]
                right = stop_values[index + 1]
                break
        span = max(0.001, right[0] - left[0])
        m = (t - left[0]) / span
        for x in range(width):
            vignette = 0.15 * (1 - min(1, math.hypot((x / width) - 0.5, (y / height) - 0.52) / 0.72))
            mm = max(0, min(1, m - vignette))
            px[x, y] = tuple(int(left[1][i] * (1 - mm) + right[1][i] * mm) for i in range(4))
    return img


def add_noise(img: Image.Image, amount: int = 16, alpha: int = 28, seed: int = 7) -> None:
    rng = random.Random(seed)
    noise = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px = noise.load()
    assert px is not None
    for y in range(img.height):
        for x in range(img.width):
            if rng.random() < 0.38:
                v = rng.randint(-amount, amount)
                if v >= 0:
                    px[x, y] = (255, 255, 255, min(alpha, v + 8))
                else:
                    px[x, y] = (0, 0, 0, min(alpha, -v + 8))
    img.alpha_composite(noise)


def add_starfield(img: Image.Image, count: int, seed: int = 11) -> None:
    rng = random.Random(seed)
    d = ImageDraw.Draw(img, "RGBA")
    width, height = img.size
    for _ in range(count):
        x = rng.randint(0, width - 1)
        y = int(height * (rng.random() ** 1.8))
        r = rng.choice([1, 1, 1, 2])
        color = rng.choice([rgb(PALETTE["cream"], 160), rgb(PALETTE["cyan"], 115), rgb(PALETTE["amber"], 130)])
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)
    for _ in range(max(2, count // 36)):
        x = rng.randint(20, width - 20)
        y = rng.randint(30, int(height * 0.48))
        d.line((x - 10, y, x + 10, y), fill=rgb(PALETTE["teal"], 85), width=1)
        d.line((x, y - 10, x, y + 10), fill=rgb(PALETTE["teal"], 85), width=1)


def glow(img: Image.Image, shape_layer: Image.Image, radius: int = 14, strength: float = 1.0) -> None:
    blurred = shape_layer.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1:
        a = blurred.getchannel("A").point(lambda v: min(255, int(v * strength)))
        blurred.putalpha(a)
    img.alpha_composite(blurred)
    img.alpha_composite(shape_layer)


def rounded_rect_layer(
    size: tuple[int, int],
    rect: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    width: int = 2,
) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    d.rounded_rectangle(rect, radius=radius, fill=fill, outline=outline, width=width)
    return layer


def draw_neon_grid(img: Image.Image, horizon: int, color: str = "teal", seed: int = 3) -> None:
    width, height = img.size
    d = ImageDraw.Draw(img, "RGBA")
    floor_top = horizon
    van_x = width // 2
    for i in range(-10, 11):
        start_x = van_x + i * 96
        d.line((start_x, height + 60, van_x + i * 8, floor_top), fill=rgb(PALETTE[color], 46), width=2)
    for row in range(13):
        t = row / 12
        y = int(floor_top + (height - floor_top) * (t ** 1.75))
        d.line((0, y, width, y), fill=rgb(PALETTE[color], 34 + row * 4), width=1 + row // 5)

    rng = random.Random(seed)
    for _ in range(28):
        cx = rng.randint(28, width - 28)
        cy = rng.randint(floor_top + 40, height - 40)
        w = rng.randint(22, 82)
        h = rng.randint(6, 18)
        col = rng.choice(["orange", "amber", "violet", "teal"])
        d.polygon(
            [(cx - w, cy), (cx - w // 2, cy - h), (cx + w, cy - h), (cx + w // 2, cy)],
            fill=rgb(PALETTE["ink"], 185),
            outline=rgb(PALETTE[col], 80),
        )


def draw_crystal_cluster(img: Image.Image, center: tuple[int, int], scale: float, hue: str = "magenta") -> None:
    cx, cy = center
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for i, offset in enumerate([-20, -6, 12, 26]):
        h = int((46 + i * 14) * scale)
        w = int((14 + i * 3) * scale)
        x = int(cx + offset * scale)
        poly = [(x, cy - h), (x - w, cy - h // 3), (x - int(w * 0.7), cy), (x + int(w * 0.8), cy), (x + w, cy - h // 3)]
        d.polygon(poly, fill=rgb(PALETTE[hue], 150), outline=rgb(PALETTE["cream"], 95))
        d.line((x, cy - h + 4, x, cy - 3), fill=rgb(PALETTE["cream"], 80), width=max(1, int(2 * scale)))
    glow(img, layer, radius=int(9 * scale), strength=0.8)


def draw_player(img: Image.Image, center: tuple[int, int], scale: float = 1.0, facing: float = -18) -> None:
    cx, cy = center
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    s = scale
    # Shadow
    d.ellipse((cx - 58 * s, cy + 70 * s, cx + 58 * s, cy + 96 * s), fill=(0, 0, 0, 90))
    # Legs
    d.rounded_rectangle((cx - 34 * s, cy + 34 * s, cx - 8 * s, cy + 96 * s), radius=int(10 * s), fill=rgb("#172033", 255), outline=rgb(PALETTE["teal"], 110), width=max(1, int(2 * s)))
    d.rounded_rectangle((cx + 12 * s, cy + 28 * s, cx + 39 * s, cy + 91 * s), radius=int(10 * s), fill=rgb("#1A2744", 255), outline=rgb(PALETTE["cyan"], 110), width=max(1, int(2 * s)))
    # Torso armor
    d.rounded_rectangle((cx - 48 * s, cy - 42 * s, cx + 48 * s, cy + 52 * s), radius=int(20 * s), fill=rgb("#202E4A", 255), outline=rgb(PALETTE["cream"], 135), width=max(2, int(3 * s)))
    d.polygon([(cx - 34 * s, cy - 32 * s), (cx + 34 * s, cy - 32 * s), (cx + 22 * s, cy + 34 * s), (cx - 22 * s, cy + 34 * s)], fill=rgb("#31466B", 255))
    # Helmet
    d.rounded_rectangle((cx - 38 * s, cy - 106 * s, cx + 38 * s, cy - 36 * s), radius=int(24 * s), fill=rgb("#151B2C", 255), outline=rgb(PALETTE["teal"], 160), width=max(2, int(3 * s)))
    d.rounded_rectangle((cx - 27 * s, cy - 82 * s, cx + 27 * s, cy - 58 * s), radius=int(10 * s), fill=rgb(PALETTE["teal"], 230))
    d.rectangle((cx - 21 * s, cy - 77 * s, cx + 21 * s, cy - 63 * s), fill=rgb("#DFFFF7", 220))
    # Arms and rifle
    d.rounded_rectangle((cx - 78 * s, cy - 12 * s, cx - 28 * s, cy + 14 * s), radius=int(10 * s), fill=rgb("#18243B", 255), outline=rgb(PALETTE["amber"], 90), width=max(1, int(2 * s)))
    d.rounded_rectangle((cx + 26 * s, cy - 14 * s, cx + 82 * s, cy + 12 * s), radius=int(10 * s), fill=rgb("#18243B", 255), outline=rgb(PALETTE["amber"], 90), width=max(1, int(2 * s)))
    d.rounded_rectangle((cx + 16 * s, cy - 42 * s, cx + 142 * s, cy - 14 * s), radius=int(11 * s), fill=rgb("#F6D38E", 255), outline=rgb("#120E12", 255), width=max(2, int(4 * s)))
    d.rectangle((cx + 96 * s, cy - 34 * s, cx + 159 * s, cy - 22 * s), fill=rgb(PALETTE["teal"], 255))
    d.rounded_rectangle((cx + 46 * s, cy - 11 * s, cx + 71 * s, cy + 26 * s), radius=int(8 * s), fill=rgb(PALETTE["orange"], 255), outline=rgb("#120E12", 255), width=max(1, int(3 * s)))
    beam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(beam, "RGBA")
    bd.polygon([(cx + 154 * s, cy - 34 * s), (cx + 278 * s, cy - 52 * s), (cx + 278 * s, cy - 5 * s), (cx + 154 * s, cy - 20 * s)], fill=rgb(PALETTE["teal"], 50))
    glow(layer, beam, radius=int(14 * s), strength=1.1)
    rotated = layer.rotate(facing, center=center, resample=Image.Resampling.BICUBIC)
    img.alpha_composite(rotated)


def draw_enemy(img: Image.Image, center: tuple[int, int], kind: str, scale: float = 1.0, alpha: int = 255) -> None:
    cx, cy = center
    s = scale
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    outline = rgb("#090B12", alpha)
    if kind == "mite":
        fill, accent = "#513922", "amber"
        body = (cx - 30 * s, cy - 22 * s, cx + 30 * s, cy + 22 * s)
        for lx in [-32, -18, 18, 32]:
            d.line((cx + lx * s, cy + 4 * s, cx + lx * 1.25 * s, cy + 32 * s), fill=outline, width=max(2, int(5 * s)))
            d.line((cx + lx * s, cy - 4 * s, cx + lx * 1.25 * s, cy - 32 * s), fill=outline, width=max(2, int(5 * s)))
        d.ellipse(body, fill=rgb(fill, alpha), outline=outline, width=max(2, int(4 * s)))
        d.line((cx - 14 * s, cy - 4 * s, cx + 14 * s, cy - 4 * s), fill=rgb(PALETTE[accent], alpha), width=max(1, int(4 * s)))
    elif kind == "runner":
        fill, accent = "#183D68", "cyan"
        d.polygon([(cx - 42 * s, cy), (cx - 5 * s, cy - 30 * s), (cx + 45 * s, cy - 12 * s), (cx + 35 * s, cy + 26 * s), (cx - 6 * s, cy + 31 * s)], fill=rgb(fill, alpha), outline=outline)
        d.line((cx - 12 * s, cy, cx + 34 * s, cy - 3 * s), fill=rgb(PALETTE[accent], alpha), width=max(2, int(5 * s)))
        for lx in [-28, -12, 18, 32]:
            d.line((cx + lx * s, cy + 20 * s, cx + (lx + 8) * s, cy + 43 * s), fill=outline, width=max(2, int(4 * s)))
    elif kind == "brute":
        fill, accent = "#154B32", "lime"
        d.rounded_rectangle((cx - 48 * s, cy - 36 * s, cx + 48 * s, cy + 36 * s), radius=int(18 * s), fill=rgb(fill, alpha), outline=outline, width=max(2, int(5 * s)))
        for i in [-24, 0, 24]:
            d.line((cx + i * s, cy - 28 * s, cx + i * s, cy + 28 * s), fill=rgb(PALETTE[accent], 130), width=max(1, int(3 * s)))
        d.ellipse((cx - 12 * s, cy - 12 * s, cx + 12 * s, cy + 12 * s), fill=rgb(PALETTE[accent], alpha))
    elif kind == "splitter":
        fill, accent = "#5D2C86", "magenta"
        d.ellipse((cx - 42 * s, cy - 42 * s, cx + 42 * s, cy + 42 * s), fill=rgb(fill, alpha), outline=outline, width=max(2, int(4 * s)))
        for ang in [20, 92, 155, 221, 310]:
            x = cx + math.cos(math.radians(ang)) * 30 * s
            y = cy + math.sin(math.radians(ang)) * 30 * s
            d.line((cx, cy, x, y), fill=rgb(PALETTE[accent], 165), width=max(1, int(4 * s)))
    elif kind == "warden":
        fill, accent = "#123784", "cyan"
        points = [(cx, cy - 54 * s), (cx + 50 * s, cy - 24 * s), (cx + 46 * s, cy + 34 * s), (cx, cy + 58 * s), (cx - 46 * s, cy + 34 * s), (cx - 50 * s, cy - 24 * s)]
        d.polygon(points, fill=rgb(fill, alpha), outline=outline)
        d.ellipse((cx - 19 * s, cy - 19 * s, cx + 19 * s, cy + 19 * s), fill=rgb(PALETTE[accent], alpha))
        for a in range(0, 360, 60):
            d.line((cx, cy, cx + math.cos(math.radians(a)) * 46 * s, cy + math.sin(math.radians(a)) * 46 * s), fill=rgb(PALETTE["cream"], 80), width=max(1, int(2 * s)))
    else:
        fill, accent = "#2B123E", "violet"
        d.ellipse((cx - 58 * s, cy - 58 * s, cx + 58 * s, cy + 58 * s), fill=rgb(fill, alpha), outline=outline, width=max(3, int(6 * s)))
        d.ellipse((cx - 24 * s, cy - 18 * s, cx + 24 * s, cy + 18 * s), fill=rgb(PALETTE["cream"], alpha))
        d.ellipse((cx - 9 * s, cy - 9 * s, cx + 9 * s, cy + 9 * s), fill=rgb(PALETTE[accent], alpha))
        for r in [78, 99]:
            d.ellipse((cx - r * s, cy - r * s, cx + r * s, cy + r * s), outline=rgb(PALETTE[accent], 120), width=max(1, int(3 * s)))
    glow(img, layer, radius=max(4, int(8 * s)), strength=0.55)


def draw_weapon_icon(kind: str, size: int = 128) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    s = size / 128
    cx, cy = size // 2, size // 2
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    sd.ellipse((17 * s, 88 * s, 111 * s, 110 * s), fill=(0, 0, 0, 85))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(int(4 * s))))

    if kind == "storm":
        d.rounded_rectangle((22 * s, 45 * s, 92 * s, 72 * s), radius=int(10 * s), fill=rgb("#F2D28B"), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.rectangle((84 * s, 52 * s, 115 * s, 62 * s), fill=rgb(PALETTE["teal"]))
        d.rounded_rectangle((42 * s, 72 * s, 59 * s, 103 * s), radius=int(6 * s), fill=rgb(PALETTE["orange"]), outline=rgb("#10131F"), width=max(1, int(3 * s)))
        d.polygon([(26 * s, 45 * s), (45 * s, 31 * s), (66 * s, 45 * s)], fill=rgb(PALETTE["cyan"]), outline=rgb("#10131F"))
    elif kind == "plague":
        d.rounded_rectangle((18 * s, 50 * s, 82 * s, 80 * s), radius=int(14 * s), fill=rgb("#79B15C"), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.ellipse((66 * s, 39 * s, 101 * s, 74 * s), fill=rgb(PALETTE["lime"], 210), outline=rgb("#10131F"), width=max(2, int(3 * s)))
        d.rectangle((87 * s, 56 * s, 116 * s, 65 * s), fill=rgb(PALETTE["lime"]))
        for x in [76, 87, 98]:
            d.ellipse(((x - 4) * s, 29 * s, (x + 4) * s, 37 * s), fill=rgb(PALETTE["lime"], 150))
    elif kind == "frost":
        d.rounded_rectangle((18 * s, 49 * s, 96 * s, 73 * s), radius=int(9 * s), fill=rgb("#CDEEFF"), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.polygon([(88 * s, 42 * s), (120 * s, 61 * s), (88 * s, 80 * s)], fill=rgb(PALETTE["cyan"], 210), outline=rgb("#10131F"))
        for a in [0, 60, 120]:
            d.line((54 * s, 35 * s, (54 + math.cos(math.radians(a)) * 22) * s, (35 + math.sin(math.radians(a)) * 22) * s), fill=rgb(PALETTE["cyan"]), width=max(1, int(3 * s)))
    elif kind == "rail":
        d.rounded_rectangle((16 * s, 46 * s, 104 * s, 76 * s), radius=int(8 * s), fill=rgb("#C4B5A5"), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.rectangle((39 * s, 36 * s, 106 * s, 45 * s), fill=rgb(PALETTE["violet"]))
        d.rectangle((39 * s, 77 * s, 106 * s, 86 * s), fill=rgb(PALETTE["violet"]))
        d.rectangle((97 * s, 54 * s, 120 * s, 68 * s), fill=rgb(PALETTE["teal"]))
    elif kind == "drone":
        d.ellipse((29 * s, 25 * s, 99 * s, 95 * s), fill=rgb("#F3CF58"), outline=rgb("#10131F"), width=max(2, int(5 * s)))
        d.ellipse((48 * s, 44 * s, 80 * s, 76 * s), fill=rgb(PALETTE["teal"]), outline=rgb("#10131F"), width=max(1, int(3 * s)))
        for a in [30, 150, 270]:
            x = cx + math.cos(math.radians(a)) * 45 * s
            y = cy + math.sin(math.radians(a)) * 45 * s
            d.polygon([(cx, cy), (x - 8 * s, y), (x + 8 * s, y)], fill=rgb(PALETTE["orange"]), outline=rgb("#10131F"))
    elif kind == "hammer":
        d.rounded_rectangle((23 * s, 31 * s, 85 * s, 67 * s), radius=int(9 * s), fill=rgb("#6E7B8E"), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.rectangle((62 * s, 62 * s, 78 * s, 111 * s), fill=rgb("#322C44"))
        d.ellipse((17 * s, 24 * s, 43 * s, 50 * s), fill=rgb(PALETTE["magenta"], 190))
        d.arc((6 * s, 9 * s, 68 * s, 72 * s), 205, 30, fill=rgb(PALETTE["magenta"], 190), width=max(2, int(4 * s)))
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer, "RGBA")
    gd.ellipse((14 * s, 14 * s, 114 * s, 114 * s), outline=rgb(PALETTE["teal"], 80), width=max(1, int(2 * s)))
    glow(img, glow_layer, radius=max(5, int(8 * s)), strength=0.7)
    return img


def draw_pickup_icon(kind: str, size: int = 128) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    s = size / 128
    cx, cy = size // 2, size // 2
    if kind == "alloy":
        for i, (x, y) in enumerate([(42, 72), (60, 52), (82, 75)]):
            col = ["#A8B4C7", "#DFE9F5", "#7E8EA4"][i]
            d.polygon([(x * s, (y - 28) * s), ((x - 20) * s, y * s), (x * s, (y + 28) * s), ((x + 20) * s, y * s)], fill=rgb(col), outline=rgb("#10131F"), width=max(2, int(3 * s)))
            d.line(((x - 10) * s, y * s, (x + 13) * s, (y - 12) * s), fill=rgb(PALETTE["teal"], 190), width=max(1, int(3 * s)))
    elif kind == "xp":
        d.ellipse((33 * s, 22 * s, 95 * s, 84 * s), fill=rgb(PALETTE["cyan"], 210), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.polygon([(64 * s, 16 * s), (83 * s, 64 * s), (64 * s, 112 * s), (45 * s, 64 * s)], fill=rgb(PALETTE["teal"], 210), outline=rgb("#10131F"))
    elif kind == "chest":
        d.rounded_rectangle((25 * s, 44 * s, 103 * s, 95 * s), radius=int(9 * s), fill=rgb("#B86A2E"), outline=rgb("#10131F"), width=max(2, int(4 * s)))
        d.rectangle((25 * s, 60 * s, 103 * s, 72 * s), fill=rgb(PALETTE["amber"]))
        d.rounded_rectangle((55 * s, 55 * s, 73 * s, 82 * s), radius=int(4 * s), fill=rgb(PALETTE["teal"]), outline=rgb("#10131F"), width=max(1, int(2 * s)))
    else:
        d.ellipse((24 * s, 24 * s, 104 * s, 104 * s), fill=rgb("#171C34"), outline=rgb(PALETTE["magenta"]), width=max(2, int(5 * s)))
        for a in range(0, 360, 45):
            x = cx + math.cos(math.radians(a)) * 31 * s
            y = cy + math.sin(math.radians(a)) * 31 * s
            d.line((cx, cy, x, y), fill=rgb(PALETTE["magenta"], 150), width=max(1, int(3 * s)))
        d.ellipse((49 * s, 49 * s, 79 * s, 79 * s), fill=rgb(PALETTE["cream"]))
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer, "RGBA")
    gd.ellipse((20 * s, 20 * s, 108 * s, 108 * s), fill=rgb(PALETTE["teal"], 30))
    glow(img, glow_layer, radius=max(5, int(8 * s)), strength=0.8)
    return img


def save_battlefield() -> Path:
    img = gradient(
        (720, 1280),
        [(0, PALETTE["void"]), (0.32, PALETTE["navy"]), (0.62, "#311C35"), (1, "#3B241F")],
    )
    add_noise(img, amount=10, alpha=18, seed=13)
    add_starfield(img, 180, seed=17)
    draw_neon_grid(img, 560, "teal", seed=5)
    d = ImageDraw.Draw(img, "RGBA")
    # Crash arc and distant planet glow.
    planet = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(planet, "RGBA")
    pd.ellipse((-220, 210, 930, 1360), outline=rgb(PALETTE["orange"], 42), width=5)
    pd.arc((-130, 290, 860, 1280), 202, 336, fill=rgb(PALETTE["magenta"], 64), width=4)
    glow(img, planet, 22, 1.0)
    for pos, sc, hue in [((158, 858), 0.85, "magenta"), ((584, 764), 0.72, "teal"), ((504, 1085), 0.55, "amber")]:
        draw_crystal_cluster(img, pos, sc, hue)
    for x, y, w in [(106, 1058, 178), (424, 936, 220), (250, 720, 134)]:
        d.rounded_rectangle((x, y, x + w, y + 22), radius=9, fill=rgb("#111827", 170), outline=rgb(PALETTE["amber"], 75), width=2)
        for stripe in range(0, w, 28):
            d.line((x + stripe, y + 22, x + stripe + 17, y), fill=rgb(PALETTE["orange"], 82), width=3)
    path = OUT / "neon_ruins_battlefield_720x1280.png"
    img.save(path)
    return path


def save_key_art() -> Path:
    img = gradient((720, 1280), [(0, "#050712"), (0.36, "#101A3A"), (0.68, "#3B1641"), (1, "#4A251B")])
    add_noise(img, amount=10, alpha=16, seed=19)
    add_starfield(img, 150, seed=23)
    draw_neon_grid(img, 610, "violet", seed=12)
    for pos, kind, sc, a in [((540, 625), "boss", 1.4, 210), ((140, 760), "runner", 0.9, 220), ((580, 875), "splitter", 0.72, 220), ((110, 965), "mite", 0.62, 210)]:
        draw_enemy(img, pos, kind, sc, a)
    draw_player(img, (332, 760), 2.0, facing=-8)
    draw_crystal_cluster(img, (578, 1035), 0.65, "teal")
    d = ImageDraw.Draw(img, "RGBA")
    title = "星坠幸存者"
    subtitle = "自动开火 · 合金拾取 · 无尽撤离"
    title_font = load_font(68, True)
    sub_font = load_font(30)
    d.text((64, 128), title, font=title_font, fill=rgb(PALETTE["cream"]), stroke_width=4, stroke_fill=rgb("#060914"))
    d.text((74, 226), subtitle, font=sub_font, fill=rgb("#FFE1A0"), stroke_width=2, stroke_fill=rgb("#060914"))
    badge = rounded_rect_layer(img.size, (72, 292, 302, 348), 24, rgb(PALETTE["teal"], 212), rgb(PALETTE["cream"], 90), 2)
    img.alpha_composite(badge)
    d.text((104, 304), "立即出击", font=load_font(31, True), fill=rgb("#061018"))
    path = OUT / "neon_key_art_720x1280.png"
    img.save(path)
    return path


def save_share_cover() -> Path:
    img = gradient((1280, 720), [(0, "#050712"), (0.48, "#111C43"), (1, "#4B1F27")])
    add_noise(img, amount=9, alpha=15, seed=29)
    add_starfield(img, 155, seed=31)
    draw_neon_grid(img, 360, "teal", seed=33)
    draw_enemy(img, (1010, 384), "boss", 1.28, 225)
    draw_enemy(img, (875, 535), "runner", 0.88, 230)
    draw_enemy(img, (1116, 546), "warden", 0.62, 215)
    draw_player(img, (725, 445), 1.56, facing=-20)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((78, 92), "星坠幸存者", font=load_font(82, True), fill=rgb(PALETTE["cream"]), stroke_width=4, stroke_fill=rgb("#050712"))
    d.text((84, 202), "竖屏科幻幸存者 · 一把武器打穿星坠之夜", font=load_font(34), fill=rgb("#FFE1A0"), stroke_width=2, stroke_fill=rgb("#050712"))
    panel = rounded_rect_layer(img.size, (84, 286, 432, 354), 28, rgb(PALETTE["teal"], 218), rgb(PALETTE["cream"], 90), 2)
    img.alpha_composite(panel)
    d.text((124, 303), "自动射击", font=load_font(34, True), fill=rgb("#061018"))
    d.text((80, 608), "NEON CRASH-SITE ART DIRECTION", font=load_font(22, True), fill=rgb(PALETTE["teal"], 170))
    path = OUT / "neon_share_cover_1280x720.png"
    img.save(path)
    return path


def save_ui_assets() -> list[Path]:
    paths: list[Path] = []
    # Standalone panel texture candidate.
    panel = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    base = rounded_rect_layer(panel.size, (8, 8, 248, 248), 18, rgb("#101827", 236), rgb(PALETTE["teal"], 110), 3)
    glow(panel, base, 8, 0.7)
    d = ImageDraw.Draw(panel, "RGBA")
    for inset, alpha in [(18, 50), (28, 34), (44, 22)]:
        d.rounded_rectangle((inset, inset, 256 - inset, 256 - inset), radius=16, outline=rgb(PALETTE["cyan"], alpha), width=1)
    d.rectangle((26, 10, 112, 15), fill=rgb(PALETTE["amber"], 160))
    d.rectangle((144, 241, 226, 246), fill=rgb(PALETTE["magenta"], 120))
    p = OUT / "ui_panel_bg_neon_v1.png"
    panel.save(p)
    paths.append(p)

    for name, fill, offset in [("normal", "teal", 0), ("pressed", "orange", 5)]:
        btn = Image.new("RGBA", (512, 160), (0, 0, 0, 0))
        layer = rounded_rect_layer(btn.size, (12, 18 + offset, 500, 132 + offset), 32, rgb("#101827", 238), rgb(PALETTE[fill], 170), 4)
        glow(btn, layer, 12, 0.85)
        bd = ImageDraw.Draw(btn, "RGBA")
        bd.rounded_rectangle((38, 40 + offset, 474, 75 + offset), radius=16, fill=rgb(PALETTE[fill], 44))
        bd.text((178, 55 + offset), "出击", font=load_font(42, True), fill=rgb(PALETTE["cream"]))
        p = OUT / f"ui_btn_{name}_neon_v1.png"
        btn.save(p)
        paths.append(p)

    sheet = Image.new("RGBA", (1024, 1024), rgb("#070A12"))
    add_noise(sheet, amount=7, alpha=14, seed=37)
    sd = ImageDraw.Draw(sheet, "RGBA")
    sd.text((54, 40), "Starfall UI upgrade candidates", font=load_font(42, True), fill=rgb(PALETTE["cream"]))
    sd.text((56, 94), "High contrast, compact, neon salvage interface", font=load_font(24), fill=rgb(PALETTE["teal"], 205))
    # Main combat panel sample.
    main_panel = panel.resize((420, 420), Image.Resampling.LANCZOS)
    sheet.alpha_composite(main_panel, (54, 154))
    sd.text((100, 210), "波次 10", font=load_font(34, True), fill=rgb(PALETTE["cream"]))
    sd.rounded_rectangle((100, 270, 430, 304), radius=15, fill=rgb("#080D18", 220), outline=rgb(PALETTE["teal"], 120), width=2)
    sd.rounded_rectangle((104, 274, 352, 300), radius=12, fill=rgb(PALETTE["teal"], 205))
    sd.text((100, 332), "护盾", font=load_font(25, True), fill=rgb(PALETTE["cyan"]))
    sd.text((206, 332), "合金 +76", font=load_font(25, True), fill=rgb(PALETTE["amber"]))
    # Shop slots.
    for i in range(6):
        x = 538 + (i % 3) * 142
        y = 166 + (i // 3) * 150
        slot = rounded_rect_layer(sheet.size, (x, y, x + 118, y + 126), 18, rgb("#101827", 238), rgb(PALETTE["violet" if i % 2 else "teal"], 135), 3)
        glow(sheet, slot, 8, 0.48)
        icon = draw_pickup_icon(["alloy", "xp", "chest", "core"][i % 4], 72)
        sheet.alpha_composite(icon, (x + 23, y + 18))
        sd.text((x + 24, y + 95), f"{50 + i * 22}", font=load_font(22, True), fill=rgb(PALETTE["amber"]))
    # Choice cards.
    labels = [("攻击强化", "orange"), ("神经反射", "teal"), ("无人机指挥", "magenta")]
    for i, (label, col) in enumerate(labels):
        x = 86 + i * 302
        y = 646
        card = rounded_rect_layer(sheet.size, (x, y, x + 250, y + 260), 20, rgb("#101827", 238), rgb(PALETTE[col], 145), 3)
        glow(sheet, card, 10, 0.5)
        sd.text((x + 28, y + 32), label, font=load_font(28, True), fill=rgb(PALETTE["cream"]))
        sd.rounded_rectangle((x + 28, y + 90, x + 222, y + 118), radius=12, fill=rgb(PALETTE[col], 64))
        sd.text((x + 28, y + 142), "+ 随机成长", font=load_font(23), fill=rgb("#FFE1A0"))
    p = OUT / "neon_ui_kit_sheet.png"
    sheet.save(p)
    paths.append(p)
    return paths


def save_icon_sheets() -> list[Path]:
    paths: list[Path] = []
    weapon_names = [
        ("storm", "storm_rifle"),
        ("plague", "plague_sprayer"),
        ("frost", "frost_beam"),
        ("rail", "rail_cannon"),
        ("drone", "orbital_drone"),
        ("hammer", "gravity_hammer"),
    ]
    sheet = Image.new("RGBA", (768, 256), rgb("#070A12"))
    d = ImageDraw.Draw(sheet, "RGBA")
    d.text((28, 22), "Weapon icon candidates", font=load_font(30, True), fill=rgb(PALETTE["cream"]))
    for i, (kind, name) in enumerate(weapon_names):
        icon = draw_weapon_icon(kind)
        p = OUT / f"icon_weapon_{name}_neon_v1.png"
        icon.save(p)
        paths.append(p)
        x = 28 + i * 122
        sheet.alpha_composite(icon, (x, 76))
        d.text((x + 10, 210), name.replace("_", " "), font=load_font(14), fill=rgb(PALETTE["teal"], 210))
    p = OUT / "neon_weapon_icon_sheet.png"
    sheet.save(p)
    paths.append(p)

    pickup_names = [("alloy", "alloy"), ("xp", "xp_energy"), ("chest", "supply_chest"), ("core", "boss_core")]
    sheet2 = Image.new("RGBA", (560, 240), rgb("#070A12"))
    d2 = ImageDraw.Draw(sheet2, "RGBA")
    d2.text((28, 22), "Pickup icon candidates", font=load_font(30, True), fill=rgb(PALETTE["cream"]))
    for i, (kind, name) in enumerate(pickup_names):
        icon = draw_pickup_icon(kind)
        p = OUT / f"icon_pickup_{name}_neon_v1.png"
        icon.save(p)
        paths.append(p)
        x = 30 + i * 128
        sheet2.alpha_composite(icon, (x, 78))
        d2.text((x + 18, 206), name.replace("_", " "), font=load_font(15), fill=rgb(PALETTE["amber"], 220))
    p = OUT / "neon_pickup_icon_sheet.png"
    sheet2.save(p)
    paths.append(p)
    return paths


def save_enemy_sheet() -> Path:
    sheet = Image.new("RGBA", (1024, 640), rgb("#070A12"))
    add_noise(sheet, amount=7, alpha=12, seed=41)
    d = ImageDraw.Draw(sheet, "RGBA")
    d.text((42, 34), "Enemy silhouette direction", font=load_font(38, True), fill=rgb(PALETTE["cream"]))
    d.text((44, 88), "Readable at small size: strong shapes, bright mechanic color, dark body mass", font=load_font(22), fill=rgb(PALETTE["teal"], 215))
    items = [
        ("mite", "碎壳虫"),
        ("runner", "疾行体"),
        ("brute", "重甲块"),
        ("splitter", "裂变囊"),
        ("warden", "磁暴卫士"),
        ("boss", "虚空巨像"),
    ]
    for i, (kind, label) in enumerate(items):
        x = 118 + (i % 3) * 300
        y = 238 + (i // 3) * 226
        card = rounded_rect_layer(sheet.size, (x - 95, y - 100, x + 95, y + 104), 18, rgb("#101827", 224), rgb(PALETTE["teal" if i % 2 == 0 else "violet"], 120), 2)
        glow(sheet, card, 8, 0.45)
        draw_enemy(sheet, (x, y - 10), kind, 1.0 if kind != "boss" else 0.62)
        d.text((x - 52, y + 72), label, font=load_font(22, True), fill=rgb(PALETTE["cream"]))
    path = OUT / "neon_enemy_silhouette_sheet.png"
    sheet.save(path)
    return path


def save_prompt_pack() -> Path:
    prompts = {
        "style": "Neon crash-site survivor, dark readable silhouettes, teal/orange/magenta accents, clean top-down 2D game art, thick outline, compact Douyin vertical mobile readability.",
        "sprite_sheet_base": (
            "Game-ready 2D top-down sprite sheet for Starfall Survivor, a vertical mobile sci-fi survivor roguelike. "
            "Style: neon crash-site survivor, dark body mass, thick clean outline, flat-to-soft cel shading, "
            "high readability at 64-96px, teal/orange/magenta mechanic highlights, no gritty realism. "
            "Exactly {frames} frames in one horizontal row, same character size and camera angle in every cell, transparent background if supported; "
            "otherwise perfectly flat #00ff00 chroma-key background with no shadows. No text, labels, borders, watermark, or UI."
        ),
        "recommended_assets": {
            "player": "Regenerate player idle/run strips first; current player is too monochrome and low-presence compared with enemies.",
            "boss": "Unify bosses with darker silhouettes and clearer readable attack-color cores.",
            "weapons": "Replace warm toy-like weapon icons with this darker neon salvage set for a less casual tone.",
            "ui": "Move UI toward compact dark glass panels with cyan/orange semantic highlights."
        },
        "example_prompts": {
            "player_idle": "Human survivor in compact dark graphite tactical armor, cyan visor, amber alloy shoulder plates, teal backpack reactor, holding one fixed sci-fi rifle, heroic but small-screen readable.",
            "enemy_mite": "Small beetle-machine mite, dark bronze chitin, six sharp legs, amber eye slit, low crawling silhouette.",
            "enemy_runner": "Fast quadruped bio-mechanical runner, navy streamlined body, cyan spine stripe, red tracking eye, long aggressive legs.",
            "storm_rifle_icon": "Compact salvaged storm rifle icon, cream worn metal body, teal rail, orange grip, strong black outline, transparent background."
        },
    }
    path = OUT / "neon_survivor_prompt_pack.json"
    path.write_text(json.dumps(prompts, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def directory_meta() -> dict:
    return {
        "ver": "1.2.0",
        "importer": "directory",
        "imported": True,
        "uuid": str(uuid.uuid4()),
        "files": [],
        "subMetas": {},
        "userData": {},
    }


def json_meta() -> dict:
    return {
        "ver": "2.0.1",
        "importer": "json",
        "imported": True,
        "uuid": str(uuid.uuid4()),
        "files": [".json"],
        "subMetas": {},
        "userData": {},
    }


def image_meta(path: Path) -> dict:
    uid = str(uuid.uuid4())
    texture_id = "6c48a"
    sprite_id = "f9941"
    name = path.stem
    with Image.open(path) as image:
        width, height = image.size
    half_w = width / 2
    half_h = height / 2
    return {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": uid,
        "files": [".json", ".png"],
        "subMetas": {
            texture_id: {
                "importer": "texture",
                "uuid": f"{uid}@{texture_id}",
                "displayName": name,
                "id": texture_id,
                "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge",
                    "wrapModeT": "clamp-to-edge",
                    "imageUuidOrDatabaseUri": uid,
                    "isUuid": True,
                    "visible": False,
                    "minfilter": "linear",
                    "magfilter": "linear",
                    "mipfilter": "none",
                    "anisotropy": 0,
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
            sprite_id: {
                "importer": "sprite-frame",
                "uuid": f"{uid}@{sprite_id}",
                "displayName": name,
                "id": sprite_id,
                "name": "spriteFrame",
                "userData": {
                    "trimThreshold": 1,
                    "rotated": False,
                    "offsetX": 0,
                    "offsetY": 0,
                    "trimX": 0,
                    "trimY": 0,
                    "width": width,
                    "height": height,
                    "rawWidth": width,
                    "rawHeight": height,
                    "borderTop": 0,
                    "borderBottom": 0,
                    "borderLeft": 0,
                    "borderRight": 0,
                    "packable": True,
                    "pixelsToUnit": 100,
                    "pivotX": 0.5,
                    "pivotY": 0.5,
                    "meshType": 0,
                    "vertices": {
                        "rawPosition": [
                            -half_w, -half_h, 0,
                            half_w, -half_h, 0,
                            -half_w, half_h, 0,
                            half_w, half_h, 0,
                        ],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [0, height, width, height, 0, 0, width, 0],
                        "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                        "minPos": [-half_w, -half_h, 0],
                        "maxPos": [half_w, half_h, 0],
                    },
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": f"{uid}@{texture_id}",
                    "atlasUuid": "",
                    "trimType": "custom",
                },
                "ver": "1.0.12",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
        },
        "userData": {
            "type": "sprite-frame",
            "fixAlphaTransparencyArtifacts": False,
            "hasAlpha": True,
            "redirect": f"{uid}@{texture_id}",
        },
    }


def write_meta_if_missing(path: Path, data: dict) -> bool:
    if path.exists():
        return False
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def write_cocos_metas(paths: Iterable[Path]) -> int:
    created = 0
    created += int(write_meta_if_missing(OUT.with_suffix(OUT.suffix + ".meta"), directory_meta()))
    for path in paths:
        if path.suffix.lower() == ".png":
            created += int(write_meta_if_missing(path.with_suffix(path.suffix + ".meta"), image_meta(path)))
        elif path.suffix.lower() == ".json":
            created += int(write_meta_if_missing(path.with_suffix(path.suffix + ".meta"), json_meta()))
    return created


def save_contact_sheet(paths: Iterable[Path]) -> Path:
    previews = []
    for path in paths:
        if path.suffix.lower() != ".png":
            continue
        im = Image.open(path).convert("RGBA")
        im.thumbnail((260, 220), Image.Resampling.LANCZOS)
        card = Image.new("RGBA", (300, 276), rgb("#0B1020"))
        card.alpha_composite(im, ((300 - im.width) // 2, 18 + (210 - im.height) // 2))
        d = ImageDraw.Draw(card, "RGBA")
        d.text((16, 238), path.name[:34], font=load_font(14), fill=rgb(PALETTE["cream"], 220))
        previews.append(card)
    cols = 3
    rows = math.ceil(len(previews) / cols)
    sheet = Image.new("RGBA", (cols * 300, rows * 276), rgb("#070A12"))
    for i, card in enumerate(previews):
        sheet.alpha_composite(card, ((i % cols) * 300, (i // cols) * 276))
    path = OUT / "visual_upgrade_contact_sheet.png"
    sheet.save(path)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    paths.append(save_battlefield())
    paths.append(save_key_art())
    paths.append(save_share_cover())
    paths.extend(save_ui_assets())
    paths.extend(save_icon_sheets())
    paths.append(save_enemy_sheet())
    paths.append(save_prompt_pack())
    contact = save_contact_sheet(paths)
    paths.append(contact)
    meta_count = write_cocos_metas(paths)
    print(json.dumps({"output_dir": str(OUT), "count": len(paths), "contact_sheet": str(contact), "metas_created": meta_count}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

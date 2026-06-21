from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "resources" / "art" / "placeholder"
SIZE = 128


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = hex_color.strip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha


def canvas(size: int = SIZE) -> Image.Image:
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def glow(base: Image.Image, blur: int = 8, alpha: float = 0.75) -> Image.Image:
    glow_layer = base.filter(ImageFilter.GaussianBlur(blur))
    if alpha < 1:
        r, g, b, a = glow_layer.split()
        a = a.point(lambda px: int(px * alpha))
        glow_layer = Image.merge("RGBA", (r, g, b, a))
    out = canvas(base.width)
    out.alpha_composite(glow_layer)
    out.alpha_composite(base)
    return out


def polygon(points: list[tuple[float, float]], scale: float = 1.0, cx: float = 64, cy: float = 64) -> list[tuple[float, float]]:
    return [(cx + x * scale, cy + y * scale) for x, y in points]


def ellipse(draw: ImageDraw.ImageDraw, center: tuple[float, float], radius: float, fill: str, outline: str | None = None, width: int = 3, alpha: int = 255) -> None:
    x, y = center
    box = (x - radius, y - radius, x + radius, y + radius)
    draw.ellipse(box, fill=rgba(fill, alpha), outline=rgba(outline, alpha) if outline else None, width=width)


def rounded(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], radius: int, fill: str, outline: str | None = None, width: int = 3, alpha: int = 255) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=rgba(fill, alpha), outline=rgba(outline, alpha) if outline else None, width=width)


def save(name: str, painter: Callable[[ImageDraw.ImageDraw], None]) -> Path:
    img = canvas()
    d = ImageDraw.Draw(img)
    painter(d)
    img = glow(img, 7, 0.62)
    path = OUT / f"{name}.png"
    img.save(path)
    return path


def player(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -42), (29, 30), (7, 20), (0, 39), (-7, 20), (-29, 30)]), fill=rgba("#4cc9f0"), outline=rgba("#f8fafc"))
    d.polygon(polygon([(0, -24), (13, 16), (0, 9), (-13, 16)]), fill=rgba("#e0f7ff"), outline=rgba("#0f172a", 170))
    rounded(d, (48, 67, 80, 83), 8, "#f94144", "#f8fafc", 2)
    ellipse(d, (64, 53), 7, "#ffffff", "#0f172a", 2)


def enemy_mite(d: ImageDraw.ImageDraw) -> None:
    ellipse(d, (64, 64), 28, "#9be564", "#31572c", 4)
    ellipse(d, (55, 57), 8, "#d9ff99")
    ellipse(d, (73, 57), 8, "#d9ff99")
    rounded(d, (49, 75, 79, 83), 6, "#31572c")
    for angle in range(0, 360, 60):
        x = 64 + math.cos(math.radians(angle)) * 38
        y = 64 + math.sin(math.radians(angle)) * 38
        d.line((64, 64, x, y), fill=rgba("#6ab04c", 210), width=4)


def enemy_runner(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -36), (34, -2), (13, 8), (20, 35), (0, 20), (-20, 35), (-13, 8), (-34, -2)]), fill=rgba("#4cc9f0"), outline=rgba("#1b4965"))
    ellipse(d, (55, 56), 5, "#e0fbff")
    ellipse(d, (73, 56), 5, "#e0fbff")
    d.line((41, 81, 23, 99), fill=rgba("#4cc9f0", 190), width=5)
    d.line((87, 81, 105, 99), fill=rgba("#4cc9f0", 190), width=5)


def enemy_brute(d: ImageDraw.ImageDraw) -> None:
    rounded(d, (29, 26, 99, 102), 22, "#f9c74f", "#8a5a00", 5)
    rounded(d, (42, 39, 86, 84), 14, "#ffe08a", "#8a5a00", 3)
    d.line((35, 65, 93, 65), fill=rgba("#8a5a00"), width=5)
    d.line((51, 28, 28, 12), fill=rgba("#f9c74f"), width=7)
    d.line((77, 28, 100, 12), fill=rgba("#f9c74f"), width=7)


def enemy_splitter(d: ImageDraw.ImageDraw) -> None:
    ellipse(d, (64, 64), 33, "#f15bb5", "#6a0572", 4)
    for cx, cy, r in [(48, 54, 13), (78, 49, 11), (75, 77, 15), (53, 80, 9)]:
        ellipse(d, (cx, cy), r, "#ff99d8", "#6a0572", 2)
    d.line((39, 35, 90, 95), fill=rgba("#6a0572", 170), width=4)
    d.line((88, 34, 40, 96), fill=rgba("#6a0572", 130), width=3)


def enemy_warden(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -42), (38, -13), (30, 33), (0, 47), (-30, 33), (-38, -13)]), fill=rgba("#f3722c"), outline=rgba("#6b240c"))
    ellipse(d, (64, 62), 19, "#ffb36a", "#6b240c", 3)
    d.arc((34, 30, 94, 91), 210, 330, fill=rgba("#ffe08a"), width=5)
    d.arc((28, 24, 100, 98), 35, 145, fill=rgba("#ffe08a", 190), width=4)


def enemy_boss(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -49), (43, -24), (49, 19), (24, 49), (-24, 49), (-49, 19), (-43, -24)]), fill=rgba("#f94144"), outline=rgba("#7f1d1d"))
    for angle in range(0, 360, 45):
        x = 64 + math.cos(math.radians(angle)) * 48
        y = 64 + math.sin(math.radians(angle)) * 48
        ellipse(d, (x, y), 6, "#ffe08a", "#7f1d1d", 2)
    ellipse(d, (64, 64), 23, "#ffb3b3", "#7f1d1d", 4)
    ellipse(d, (64, 64), 9, "#ffffff", "#f94144", 2)


def bullet_plasma(d: ImageDraw.ImageDraw) -> None:
    ellipse(d, (64, 64), 18, "#4cc9f0", "#f8fafc", 3)
    ellipse(d, (64, 64), 8, "#ffffff")
    d.line((28, 64, 48, 64), fill=rgba("#4cc9f0", 140), width=7)


def pickup_xp(d: ImageDraw.ImageDraw) -> None:
    ellipse(d, (64, 64), 24, "#4cc9f0", "#e0fbff", 4)
    d.polygon(polygon([(0, -15), (14, 0), (0, 15), (-14, 0)]), fill=rgba("#ffffff"))


def pickup_alloy(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -35), (31, -13), (24, 27), (0, 39), (-24, 27), (-31, -13)]), fill=rgba("#f9c74f"), outline=rgba("#8a5a00"))
    d.line((44, 58, 84, 58), fill=rgba("#fff3b0"), width=5)
    d.line((49, 76, 79, 76), fill=rgba("#8a5a00", 150), width=4)


def pickup_core(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -38), (34, 0), (0, 38), (-34, 0)]), fill=rgba("#f94144"), outline=rgba("#f8fafc"))
    d.polygon(polygon([(0, -18), (16, 0), (0, 18), (-16, 0)]), fill=rgba("#ffffff"))


def icon_rifle(d: ImageDraw.ImageDraw) -> None:
    rounded(d, (22, 55, 88, 73), 8, "#4cc9f0", "#0f172a", 3)
    rounded(d, (77, 49, 111, 61), 5, "#e0fbff", "#0f172a", 2)
    rounded(d, (30, 74, 47, 100), 6, "#577590", "#0f172a", 2)


def icon_split(d: ImageDraw.ImageDraw) -> None:
    for y in (48, 64, 80):
        rounded(d, (25, y - 6, 102, y + 6), 6, "#f15bb5", "#6a0572", 2)
    ellipse(d, (38, 64), 18, "#ff99d8", "#6a0572", 3)


def icon_drone(d: ImageDraw.ImageDraw) -> None:
    ellipse(d, (64, 64), 23, "#90be6d", "#31572c", 4)
    for angle in range(0, 360, 90):
        x = 64 + math.cos(math.radians(angle)) * 38
        y = 64 + math.sin(math.radians(angle)) * 38
        ellipse(d, (x, y), 10, "#eaffcc", "#31572c", 2)
        d.line((64, 64, x, y), fill=rgba("#90be6d"), width=5)


def icon_magnet(d: ImageDraw.ImageDraw) -> None:
    d.arc((28, 24, 100, 102), 35, 325, fill=rgba("#577590"), width=16)
    rounded(d, (26, 72, 44, 103), 6, "#f94144", "#0f172a", 2)
    rounded(d, (84, 72, 102, 103), 6, "#4cc9f0", "#0f172a", 2)


def icon_armor(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -40), (33, -25), (27, 24), (0, 47), (-27, 24), (-33, -25)]), fill=rgba("#f8961e"), outline=rgba("#6b240c"))
    d.polygon(polygon([(0, -24), (18, -13), (14, 17), (0, 31), (-14, 17), (-18, -13)]), fill=rgba("#ffe08a"))


def icon_boots(d: ImageDraw.ImageDraw) -> None:
    rounded(d, (35, 37, 57, 91), 8, "#43aa8b", "#0f172a", 3)
    rounded(d, (57, 71, 91, 94), 8, "#43aa8b", "#0f172a", 3)
    d.line((29, 39, 15, 25), fill=rgba("#9be564"), width=5)
    d.line((90, 71, 110, 58), fill=rgba("#9be564"), width=5)


def icon_reactor(d: ImageDraw.ImageDraw) -> None:
    ellipse(d, (64, 64), 36, "#f94144", "#7f1d1d", 5)
    ellipse(d, (64, 64), 18, "#ffffff", "#f94144", 3)
    for angle in range(0, 360, 120):
        x = 64 + math.cos(math.radians(angle)) * 25
        y = 64 + math.sin(math.radians(angle)) * 25
        d.line((64, 64, x, y), fill=rgba("#7f1d1d"), width=5)


def icon_vampire(d: ImageDraw.ImageDraw) -> None:
    d.polygon(polygon([(0, -36), (28, -8), (18, 34), (0, 48), (-18, 34), (-28, -8)]), fill=rgba("#b5179e"), outline=rgba("#4a044e"))
    d.polygon(polygon([(-13, 0), (-3, 0), (-7, 27)]), fill=rgba("#ffffff"))
    d.polygon(polygon([(13, 0), (3, 0), (7, 27)]), fill=rgba("#ffffff"))


def contact_sheet(paths: list[Path]) -> None:
    labels = [p.stem for p in paths]
    cell = 156
    cols = 5
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGBA", (cols * cell, rows * cell), rgba("#0b1020"))
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGBA")
        x = (index % cols) * cell + 14
        y = (index // cols) * cell + 8
        sheet.alpha_composite(image, (x, y))
        draw.text((index % cols * cell + 12, y + 126), labels[index], fill=rgba("#e2e8f0"))
    sheet.save(OUT / "contact_sheet.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    painters: list[tuple[str, Callable[[ImageDraw.ImageDraw], None]]] = [
        ("player_ship", player),
        ("enemy_mite", enemy_mite),
        ("enemy_runner", enemy_runner),
        ("enemy_brute", enemy_brute),
        ("enemy_splitter", enemy_splitter),
        ("enemy_warden", enemy_warden),
        ("enemy_boss", enemy_boss),
        ("bullet_plasma", bullet_plasma),
        ("pickup_xp", pickup_xp),
        ("pickup_alloy", pickup_alloy),
        ("pickup_core", pickup_core),
        ("equipment_storm_rifle", icon_rifle),
        ("equipment_split_barrel", icon_split),
        ("equipment_orbital_drone", icon_drone),
        ("equipment_magnet_coil", icon_magnet),
        ("equipment_phase_armor", icon_armor),
        ("equipment_kinetic_boots", icon_boots),
        ("equipment_reactor_core", icon_reactor),
        ("equipment_vampire_chip", icon_vampire),
    ]
    paths = [save(name, painter) for name, painter in painters]
    contact_sheet(paths)
    print(f"Generated {len(paths)} sprites in {OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate lightweight UI/key-art assets for Douyin mini-game submission.

This uses the existing in-project character/enemy/weapon sprites so the upload
icon and cover stay consistent with the current warm cartoon style.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "assets" / "resources" / "art"
APP_STORE = ROOT / "assets" / "app_store"
UI_DIR = ART / "ui"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size, index=0)
        except Exception:
            continue
    return ImageFont.load_default()


def gradient(size: Tuple[int, int], top: str = "#172554", bottom: str = "#7C2D12") -> Image.Image:
    w, h = size
    top_rgb = tuple(int(top[i:i+2], 16) for i in (1, 3, 5))
    bot_rgb = tuple(int(bottom[i:i+2], 16) for i in (1, 3, 5))
    img = Image.new("RGBA", size)
    px = img.load()
    assert px is not None
    for y in range(h):
        t = y / max(1, h - 1)
        for x in range(w):
            radial = 0.18 * (1 - min(1, math.hypot((x / w) - 0.55, (y / h) - 0.42) / 0.72))
            mix = max(0, min(1, t - radial))
            rgb = tuple(int(top_rgb[i] * (1 - mix) + bot_rgb[i] * mix) for i in range(3))
            px[x, y] = (*rgb, 255)
    return img


def first_strip_frame(path: Path, frames: int, cell: int) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    return img.crop((0, 0, cell, cell))


def fit(img: Image.Image, size: Tuple[int, int]) -> Image.Image:
    out = img.copy()
    out.thumbnail(size, Image.Resampling.LANCZOS)
    return out


def paste_center(base: Image.Image, img: Image.Image, center: Tuple[int, int]) -> None:
    x = int(center[0] - img.width / 2)
    y = int(center[1] - img.height / 2)
    base.alpha_composite(img, (x, y))


def rounded_panel(size: Tuple[int, int], color: str, radius: int, alpha: int = 235) -> Image.Image:
    panel = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=(*tuple(int(color[i:i+2], 16) for i in (1, 3, 5)), alpha))
    return panel


def draw_starfield(draw: ImageDraw.ImageDraw, w: int, h: int, count: int) -> None:
    for i in range(count):
        x = (i * 137 + 91) % w
        y = (i * 251 + 47) % h
        r = 1 + (i % 3)
        color = (255, 239, 186, 75 + (i % 4) * 34)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def save_app_icon() -> None:
    APP_STORE.mkdir(parents=True, exist_ok=True)
    UI_DIR.mkdir(parents=True, exist_ok=True)
    icon = gradient((1024, 1024), "#1D4ED8", "#F97316")
    d = ImageDraw.Draw(icon)
    draw_starfield(d, 1024, 1024, 72)

    # Soft playable arena badge.
    badge = rounded_panel((790, 790), "#F8FAFC", 180, 42)
    badge = badge.filter(ImageFilter.GaussianBlur(1.2))
    icon.alpha_composite(badge, (117, 117))

    player = first_strip_frame(ART / "characters" / "player_survivor_idle.png", 6, 160)
    boss = first_strip_frame(ART / "enemies" / "enemy_boss_idle.png", 8, 192)
    weapon = Image.open(ART / "weapons" / "weapon_storm_rifle_icon.png").convert("RGBA")

    boss = fit(boss, (380, 380))
    boss = boss.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    boss.putalpha(boss.getchannel("A").point(lambda a: int(a * 0.78)))
    paste_center(icon, boss, (620, 430))

    player = fit(player, (470, 470))
    paste_center(icon, player, (470, 570))

    weapon = fit(weapon, (230, 230)).rotate(-22, expand=True, resample=Image.Resampling.BICUBIC)
    paste_center(icon, weapon, (666, 650))

    # Icon-safe title mark: short, thick, readable.
    title_font = load_font(106, True)
    text = "星坠"
    bbox = d.textbbox((0, 0), text, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.rounded_rectangle((250, 76, 774, 214), radius=58, fill=(15, 23, 42, 180))
    d.text(((1024 - tw) / 2, 90), text, font=title_font, fill=(255, 247, 237, 255), stroke_width=4, stroke_fill=(15, 23, 42, 255))

    for out in [APP_STORE / "app_icon_1024.png", UI_DIR / "app_icon_1024.png"]:
        icon.save(out)


def save_share_cover() -> None:
    APP_STORE.mkdir(parents=True, exist_ok=True)
    cover = gradient((1280, 720), "#0F172A", "#C2410C")
    d = ImageDraw.Draw(cover)
    draw_starfield(d, 1280, 720, 92)

    player = fit(first_strip_frame(ART / "characters" / "player_survivor_run_east.png", 6, 160), (420, 420))
    boss = fit(first_strip_frame(ART / "enemies" / "enemy_boss_idle.png", 8, 192), (330, 330))
    runner = fit(first_strip_frame(ART / "enemies" / "enemy_runner_walk.png", 6, 160), (210, 210))
    weapon = fit(Image.open(ART / "weapons" / "weapon_rail_cannon_icon.png").convert("RGBA"), (190, 190)).rotate(-18, expand=True)
    paste_center(cover, boss, (965, 388))
    paste_center(cover, runner, (820, 520))
    paste_center(cover, player, (690, 402))
    paste_center(cover, weapon, (782, 425))

    title_font = load_font(86, True)
    body_font = load_font(34)
    d.text((78, 108), "星坠幸存者", font=title_font, fill=(255, 247, 237, 255), stroke_width=3, stroke_fill=(15, 23, 42, 255))
    d.text((84, 222), "自动开火 · 肉鸽成长 · 无尽撤离", font=body_font, fill=(254, 243, 199, 255))
    d.rounded_rectangle((82, 296, 426, 360), radius=28, fill=(67, 170, 139, 230))
    d.text((116, 309), "立即出击", font=load_font(36, True), fill=(248, 250, 252, 255))
    cover.save(APP_STORE / "share_cover_1280x720.png")


def save_loading_key_art() -> None:
    UI_DIR.mkdir(parents=True, exist_ok=True)
    key = gradient((720, 1280), "#172554", "#EA580C")
    d = ImageDraw.Draw(key)
    draw_starfield(d, 720, 1280, 96)
    player = fit(first_strip_frame(ART / "characters" / "player_survivor_idle.png", 6, 160), (360, 360))
    boss = fit(first_strip_frame(ART / "enemies" / "enemy_boss_idle.png", 8, 192), (280, 280))
    boss.putalpha(boss.getchannel("A").point(lambda a: int(a * 0.72)))
    paste_center(key, boss, (458, 518))
    paste_center(key, player, (320, 660))
    d.text((94, 198), "星坠幸存者", font=load_font(58, True), fill=(255, 247, 237, 255), stroke_width=3, stroke_fill=(15, 23, 42, 255))
    d.text((134, 278), "正在整备星舰与武器", font=load_font(28), fill=(254, 243, 199, 255))
    key.save(UI_DIR / "loading_key_art.png")
    key.save(APP_STORE / "loading_key_art_720x1280.png")


def main() -> None:
    save_app_icon()
    save_share_cover()
    save_loading_key_art()
    print(f"Generated UI assets in {APP_STORE} and {UI_DIR}")


if __name__ == "__main__":
    main()

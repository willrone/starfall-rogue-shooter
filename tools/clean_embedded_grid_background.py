#!/usr/bin/env python3
"""Remove embedded gray/white checker/grid backgrounds from runtime sprites.

The image generator sometimes emits a fake transparency checkerboard as actual pixels.
This script removes only low-saturation, bright, edge-connected pixels inside each cell,
then leaves the real subject pixels intact as much as possible.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class ImageSpec:
    path: Path
    frames: int = 1
    cell: int | None = None


STRIP_SPECS = [
    # Player strips
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_idle.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_south.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_south_east.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_east.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_north_east.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_north.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_north_west.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_west.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/characters/player_survivor_run_south_west.png", 6, 160),
    # Enemy strips
    ImageSpec(ROOT / "assets/resources/art/enemies/enemy_mite_walk.png", 6, 128),
    ImageSpec(ROOT / "assets/resources/art/enemies/enemy_runner_walk.png", 6, 128),
    ImageSpec(ROOT / "assets/resources/art/enemies/enemy_brute_walk.png", 4, 160),
    ImageSpec(ROOT / "assets/resources/art/enemies/enemy_splitter_idle.png", 6, 160),
    ImageSpec(ROOT / "assets/resources/art/enemies/enemy_warden_idle.png", 6, 192),
    ImageSpec(ROOT / "assets/resources/art/enemies/enemy_boss_idle.png", 8, 224),
]

ICON_SPECS = [ImageSpec(path) for path in sorted((ROOT / "assets/resources/art/weapons").glob("*.png"))]


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    mask = image.getchannel("A").point([0 if value <= 8 else 255 for value in range(256)], "L")
    return mask.getbbox()


def is_grid_candidate(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a <= 8:
        return False
    bright = max(r, g, b)
    dark = min(r, g, b)
    sat = bright - dark
    # Fake transparent backgrounds are gray/white with low saturation. Include
    # semi-transparent grid squares as they often survive resizing with alpha 64-220.
    return sat <= 30 and bright >= 168


def clean_cell(frame: Image.Image) -> tuple[Image.Image, int]:
    img = frame.convert("RGBA")
    bbox = alpha_bbox(img)
    if not bbox:
        return img, 0
    left, top, right, bottom = bbox
    pix = img.load()
    if pix is None:
        return img, 0
    q: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    def push(x: int, y: int) -> None:
        if (x, y) in seen:
            return
        if not (left <= x < right and top <= y < bottom):
            return
        if is_grid_candidate(cast(tuple[int, int, int, int], pix[x, y])):
            seen.add((x, y))
            q.append((x, y))

    for x in range(left, right):
        push(x, top)
        push(x, bottom - 1)
    for y in range(top, bottom):
        push(left, y)
        push(right - 1, y)

    removed = 0
    while q:
        x, y = q.popleft()
        r, g, b, a = cast(tuple[int, int, int, int], pix[x, y])
        if a > 0:
            pix[x, y] = (r, g, b, 0)
            removed += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            push(nx, ny)
    return img, removed


def clean_image(spec: ImageSpec) -> int:
    img = Image.open(spec.path).convert("RGBA")
    if spec.cell and spec.frames > 1:
        expected = (spec.cell * spec.frames, spec.cell)
        if img.size != expected:
            raise ValueError(f"{spec.path} expected {expected}, got {img.size}")
        out = Image.new("RGBA", img.size, (0, 0, 0, 0))
        total_removed = 0
        for index in range(spec.frames):
            frame = img.crop((index * spec.cell, 0, (index + 1) * spec.cell, spec.cell))
            cleaned, removed = clean_cell(frame)
            total_removed += removed
            out.alpha_composite(cleaned, (index * spec.cell, 0))
    else:
        out, total_removed = clean_cell(img)
    if total_removed > 0:
        out.save(spec.path, optimize=True)
    return total_removed


def main() -> None:
    specs = [*STRIP_SPECS, *ICON_SPECS]
    total = 0
    for spec in specs:
        removed = clean_image(spec)
        total += removed
        if removed:
            print(f"{spec.path.relative_to(ROOT)} removed_pixels={removed}")
    print(f"total_removed_pixels={total}")


if __name__ == "__main__":
    main()

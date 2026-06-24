#!/usr/bin/env python3
"""Normalize runtime sprite strips so visual size stays stable across frames/directions.

This is a local post-process for already approved runtime PNG sheets. It does not call
any external service. It rescales the visible alpha bounds of every cell into a target
box, then recenters the content in the original cell size.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class StripSpec:
    path: Path
    frames: int
    cell: int
    target_w: int
    target_h: int
    alpha_threshold: int = 8


PLAYER_SPECS: list[StripSpec] = [
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_idle.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_south.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_south_east.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_east.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_north_east.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_north.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_north_west.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_west.png", 6, 160, 110, 136),
    StripSpec(ROOT / "assets/resources/art/characters/player_survivor_run_south_west.png", 6, 160, 110, 136),
]

ENEMY_SPECS: list[StripSpec] = [
    StripSpec(ROOT / "assets/resources/art/enemies/enemy_mite_walk.png", 6, 128, 104, 112),
    StripSpec(ROOT / "assets/resources/art/enemies/enemy_runner_walk.png", 6, 128, 116, 104),
    StripSpec(ROOT / "assets/resources/art/enemies/enemy_brute_walk.png", 4, 160, 124, 144),
    StripSpec(ROOT / "assets/resources/art/enemies/enemy_splitter_idle.png", 6, 160, 124, 144),
    StripSpec(ROOT / "assets/resources/art/enemies/enemy_warden_idle.png", 6, 192, 164, 172),
    StripSpec(ROOT / "assets/resources/art/enemies/enemy_boss_idle.png", 8, 224, 204, 206),
]


def alpha_bbox(image: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    table = [0 if value <= threshold else 255 for value in range(256)]
    mask = alpha.point(table, "L")
    return mask.getbbox()


def normalize_cell(cell: Image.Image, spec: StripSpec) -> Image.Image:
    rgba = cell.convert("RGBA")
    bbox = alpha_bbox(rgba, spec.alpha_threshold)
    if not bbox:
        return rgba

    content = rgba.crop(bbox)
    # Non-uniform scaling is intentional here: the generated directional sprites
    # have wildly different silhouette widths. A fixed target box makes apparent
    # character/enemy size stable in-game.
    content = content.resize((spec.target_w, spec.target_h), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (spec.cell, spec.cell), (0, 0, 0, 0))
    out.alpha_composite(content, ((spec.cell - spec.target_w) // 2, (spec.cell - spec.target_h) // 2))
    return out


def normalize_strip(spec: StripSpec) -> dict[str, object]:
    image = Image.open(spec.path).convert("RGBA")
    expected_w = spec.frames * spec.cell
    if image.size != (expected_w, spec.cell):
        raise ValueError(f"{spec.path} expected {(expected_w, spec.cell)}, got {image.size}")

    before: list[tuple[int, int]] = []
    after: list[tuple[int, int]] = []
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for index in range(spec.frames):
        frame = image.crop((index * spec.cell, 0, (index + 1) * spec.cell, spec.cell))
        bbox = alpha_bbox(frame, spec.alpha_threshold)
        before.append((bbox[2] - bbox[0], bbox[3] - bbox[1]) if bbox else (0, 0))
        normalized = normalize_cell(frame, spec)
        bbox_after = alpha_bbox(normalized, spec.alpha_threshold)
        after.append((bbox_after[2] - bbox_after[0], bbox_after[3] - bbox_after[1]) if bbox_after else (0, 0))
        out.alpha_composite(normalized, (index * spec.cell, 0))

    out.save(spec.path, optimize=True)
    return {
        "file": str(spec.path.relative_to(ROOT)),
        "target": (spec.target_w, spec.target_h),
        "before": before,
        "after": after,
    }


def normalize_all(specs: Iterable[StripSpec]) -> list[dict[str, object]]:
    return [normalize_strip(spec) for spec in specs]


def main() -> None:
    results = normalize_all([*PLAYER_SPECS, *ENEMY_SPECS])
    for result in results:
        print(result["file"])
        print(f"  target: {result['target']}")
        print(f"  before: {result['before']}")
        print(f"  after:  {result['after']}")


if __name__ == "__main__":
    main()

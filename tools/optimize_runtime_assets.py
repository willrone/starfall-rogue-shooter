#!/usr/bin/env python3
"""Losslessly optimize runtime PNG assets used by the mini-game build.

This intentionally skips art_source/archive/previews because those are source
and preview materials, not runtime resources. The optimization is conservative:
Pillow re-encodes PNG with maximum compression and only replaces files when the
result is smaller.
"""
from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [
    ROOT / "assets" / "resources" / "art" / "characters",
    ROOT / "assets" / "resources" / "art" / "enemies",
    ROOT / "assets" / "resources" / "art" / "weapons",
]


def optimize_png(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path) as img:
        converted = img.convert("RGBA") if img.mode not in ("RGBA", "RGB", "P") else img
        with NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            converted.save(tmp_path, format="PNG", optimize=True, compress_level=9)
            after = tmp_path.stat().st_size
            if after < before:
                tmp_path.replace(path)
                return before, after
            tmp_path.unlink(missing_ok=True)
            return before, before
        finally:
            tmp_path.unlink(missing_ok=True)


def main() -> None:
    total_before = 0
    total_after = 0
    changed = 0
    for directory in TARGET_DIRS:
        for path in sorted(directory.rglob("*.png")):
            before, after = optimize_png(path)
            total_before += before
            total_after += after
            if after < before:
                changed += 1
                print(f"optimized {path.relative_to(ROOT)}: {before/1024:.1f}KB -> {after/1024:.1f}KB")
    saved = total_before - total_after
    print(f"Optimized {changed} files; saved {saved/1024:.1f}KB ({total_before/1024/1024:.2f}MB -> {total_after/1024/1024:.2f}MB)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Create minimal Cocos Creator .meta files for generated runtime PNG assets.

Cocos Creator will usually create these in the editor, but generating them here
keeps newly-created art assets importable/reproducible from git before the editor
has scanned the project.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ART_DIRS = [
    PROJECT_ROOT / "assets" / "resources" / "art" / "characters",
    PROJECT_ROOT / "assets" / "resources" / "art" / "enemies",
    PROJECT_ROOT / "assets" / "resources" / "art" / "weapons",
]


def directory_meta(path: Path) -> dict:
    return {
        "ver": "1.2.0",
        "importer": "directory",
        "imported": True,
        "uuid": str(uuid.uuid4()),
        "files": [],
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


def write_if_missing(path: Path, data: dict) -> bool:
    if path.exists():
        return False
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def main() -> None:
    created = []
    for directory in RUNTIME_ART_DIRS:
        directory.mkdir(parents=True, exist_ok=True)
        if write_if_missing(directory.with_suffix(directory.suffix + ".meta"), directory_meta(directory)):
            created.append(str(directory.with_suffix(directory.suffix + ".meta")))
        for png in sorted(directory.glob("*.png")):
            meta_path = png.with_suffix(png.suffix + ".meta")
            if write_if_missing(meta_path, image_meta(png)):
                created.append(str(meta_path))
    print(json.dumps({"created": created, "count": len(created)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

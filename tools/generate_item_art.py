#!/usr/bin/env python3
"""Generate Starfall weapon/item icon atlases and install RGBA assets.

Reads TOKENX_API_KEY (or ART_API_KEY) only from the process environment. The key is never printed or
written. Each request produces a fixed grid on a flat chroma background; cells
are cropped, keyed, normalized, and installed as PNG files. Cocos AssetDB owns
all new `.meta` files and UUID assignment; this script never creates metadata.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/art_source/yuz_generated_candidates/item_art"
UI = ROOT / "assets/resources/effects/ui_icons"
WEAPONS = ROOT / "assets/resources/art/weapons"
OFFHAND = ROOT / "assets/resources/art/offhand"
PICKUP_ART = ROOT / "assets/resources/art/pickups"
DEFAULT_ENDPOINT = "https://tokenx24.com/v1/images/generations"
DEFAULT_MODEL = "gpt-image-2"
KEY = "#00FF00"

WEAPON_IDS = [
    "storm-rifle", "plague-sprayer", "frost-beamer", "echo-bow", "split-barrel",
    "mirror-prism", "quantum-loom", "ion-lance", "thorn-crossbow", "rail-cannon",
    "void-needle", "meteor-launcher", "orbital-drone", "gravity-hammer",
    "void-tearer", "icefire-judge", "webmaster",
]
OFFHAND_IDS = [
    "orbit-blade", "orbit-block", "orbit-burn", "summon-blade", "summon-bee",
    "summon-clone", "summon-bird", "control-mine", "control-field", "control-seal",
    "burst-rift", "burst-eye", "burst-time", "support-nano", "support-shield",
]
PICKUPS = [
    "pickup_alloy", "pickup_cores", "pickup_shards", "pickup_biomass",
    "pickup_circuits", "pickup_crystals", "pickup_voidFragment",
    "pickup_energyCore", "pickup_frostCore", "pickup_infernoCore",
    "pickup_webSilk", "pickup_chest_common", "pickup_chest_rare",
]


def ids_from(path: Path, marker: str) -> list[str]:
    text = path.read_text(encoding="utf-8")
    start = text.index(marker)
    tail = text[start:]
    end = tail.index("];")
    return re.findall(r"\{\s*id:\s*'([^']+)'", tail[:end])


GEAR_IDS = ids_from(ROOT / "assets/scripts/catalogs/equipmentCatalog.ts", "export const GEAR_BLUEPRINTS")
RUN_IDS = ids_from(ROOT / "assets/scripts/catalogs/runItemCatalog.ts", "export const RUN_ITEM_BLUEPRINTS")


def request_image(prompt: str, output: Path, endpoint: str, model: str) -> None:
    api_key = os.environ.get("TOKENX_API_KEY") or os.environ.get("ART_API_KEY")
    if not api_key:
        raise SystemExit("Missing TOKENX_API_KEY or ART_API_KEY in environment")
    payload = json.dumps({"model": model, "prompt": prompt, "size": "1536x1024", "n": 1}).encode()
    req = urllib.request.Request(endpoint, payload, {
        "Authorization": f"Bearer {api_key}", "Content-Type": "application/json",
        "User-Agent": "StarfallItemArtPipeline/1.0",
    })
    with urllib.request.urlopen(req, timeout=600) as response:
        result = json.loads(response.read())
    item = result["data"][0]
    if item.get("b64_json"):
        raw = base64.b64decode(item["b64_json"])
    else:
        with urllib.request.urlopen(item["url"], timeout=600) as response:
            raw = response.read()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)


def atlas_prompt(kind: str, ids: list[str], cols: int, rows: int) -> str:
    numbered = ", ".join(f"{i + 1}:{name}" for i, name in enumerate(ids))
    subject = {
        "weapon": "distinct sci-fi handheld weapons, strict side view, muzzle or active end pointing right",
        "offhand": "distinct magical-tech companion devices matching each named mechanic",
        "gear": "distinct wearable sci-fi salvage equipment matching each name",
        "run_item": "distinct compact upgrade modules and consumable tech matching each name",
        "pickup": "distinct collectible resource crystals and treasure chests matching each name",
    }[kind]
    return f"""Use case: stylized-concept
Asset type: Cocos Creator mobile survivor game icon atlas
Primary request: create exactly {len(ids)} separate polished icons in a strict {cols} columns by {rows} rows grid, ordered left-to-right then top-to-bottom.
Subjects: {subject}.
Cell order: {numbered}.
Style: refined flat sci-fi cartoon, chunky readable silhouettes, soft dark-navy 3px outline, restrained medium saturation, flat colors with two-step cel shading, consistent camera and scale, professional mobile game production art. Use one dominant hue, one supporting hue, and a small warm or cool accent per icon. Preserve clear value separation without neon intensity.
Layout: every subject centered inside its own equal cell with generous padding. Perfectly regular grid placement but no visible grid lines, no labels, no numbers, no text.
Background: perfectly flat solid {KEY} chroma-key only, including all gutters and corners. No shadows, gradients, texture, floor, glow spilling into background, or green on subjects.
Avoid: duplicate designs, merged neighboring icons, cropped parts, photorealism, tiny detail, UI frames, text, watermark, fluorescent colors, rainbow palettes, excessive glow, candy-plastic rendering, every color competing at equal intensity."""


def chroma_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for r, g, b, a in rgba.getdata():
        green = g - max(r, b)
        if green > 90 and g > 130:
            pixels.append((r, g, b, 0))
        elif green > 25 and g > 100:
            alpha = max(0, min(255, 255 - (green - 25) * 3))
            pixels.append((r, min(g, max(r, b) + 18), b, alpha))
        else:
            pixels.append((r, g, b, a))
    rgba.putdata(pixels)
    return rgba


def normalize(cell: Image.Image, size: int = 128) -> Image.Image:
    rgba = chroma_alpha(cell)
    bbox = rgba.getchannel("A").getbbox()
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if not bbox:
        return out
    content = rgba.crop(bbox)
    scale = min((size - 18) / max(1, content.width), (size - 18) / max(1, content.height))
    content = content.resize((max(1, round(content.width * scale)), max(1, round(content.height * scale))), Image.Resampling.LANCZOS)
    out.alpha_composite(content, ((size - content.width) // 2, (size - content.height) // 2))
    return out


def install(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def process_atlas(raw: Path, ids: list[str], cols: int, rows: int, kind: str) -> None:
    image = Image.open(raw).convert("RGBA")
    for index, asset_id in enumerate(ids):
        col, row = index % cols, index // cols
        x0, x1 = round(col * image.width / cols), round((col + 1) * image.width / cols)
        y0, y1 = round(row * image.height / rows), round((row + 1) * image.height / rows)
        icon = normalize(image.crop((x0, y0, x1, y1)))
        key = asset_id.replace("-", "_")
        if kind == "weapon":
            install(UI / f"wpn_{key}.png", icon)
            install(WEAPONS / f"weapon_{key}_icon.png", icon)
        elif kind == "offhand":
            install(UI / f"offhand_{key}.png", icon)
            install(OFFHAND / f"offhand_{key}.png", icon)
        elif kind == "gear":
            install(UI / f"gear_{key}.png", icon)
        elif kind == "run_item":
            install(UI / f"run_{key}.png", icon)
        else:
            install(PICKUP_ART / f"{key}.png", icon)


def batches() -> list[tuple[str, list[str], int, int]]:
    result = [("weapon", WEAPON_IDS, 5, 4), ("offhand", OFFHAND_IDS, 5, 3), ("gear", GEAR_IDS, 6, 8)]
    for i in range(0, len(RUN_IDS), 20):
        chunk = RUN_IDS[i:i + 20]
        result.append((f"run_item_{i // 20 + 1}", chunk, 5, 4))
    result.append(("pickup", PICKUPS, 4, 4))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--process", action="store_true")
    parser.add_argument("--endpoint", default=os.environ.get("ART_API_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--model", default=os.environ.get("ART_IMAGE_MODEL", DEFAULT_MODEL))
    parser.add_argument("--batch", action="append", help="generate/process only a named batch")
    args = parser.parse_args()
    if not args.generate and not args.process:
        parser.error("choose --generate and/or --process")
    for batch, ids, cols, rows in batches():
        if args.batch and batch not in args.batch:
            continue
        kind = "run_item" if batch.startswith("run_item_") else batch
        raw = SOURCE / f"{batch}_atlas_raw.png"
        if args.generate:
            request_image(atlas_prompt(kind, ids, cols, rows), raw, args.endpoint, args.model)
            time.sleep(1)
        if args.process:
            process_atlas(raw, ids, cols, rows, kind)
        print(json.dumps({"batch": batch, "count": len(ids), "raw": str(raw.relative_to(ROOT))}))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate and install UI/world art through an OpenAI-compatible image API.

The API key is read only from TOKENX_API_KEY (or YUZ_API_KEY for backwards
compatibility). Generated source images are archived
under art_source, then resized into deterministic runtime and app-store assets.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/art_source/yuz_generated_candidates/ui_world"
WORLD = ROOT / "assets/resources/art/world"
APP_STORE = ROOT / "assets/app_store"
DEFAULT_ENDPOINT = "https://tokenx24.com/v1/images/generations"
DEFAULT_MODEL = "gpt-image-2"

PROMPTS = {
    "battlefield": """Use case: stylized-concept
Asset type: seamless top-down battlefield texture for a portrait mobile survivor game
Primary request: a polished square top-down alien moon battlefield tile, empty play surface, designed to repeat seamlessly on every edge.
Style: refined flat arcade sci-fi cartoon, chunky hand-painted shapes, crisp readable surface details, restrained medium saturation, subtle two-step cel shading, production mobile game art.
Composition: strict orthographic top-down view, evenly distributed small cracks, shallow craters, embedded cyan energy seams, sparse coral and gold salvage markings. No horizon and no perspective convergence. The central and edge areas must stay open for dozens of characters and projectiles.
Palette: deep desaturated teal-blue stone, muted cyan energy, sparse coral and warm gold accents; medium-dark and calm, with clear value contrast against characters. Accent colors occupy no more than fifteen percent of the surface.
Constraints: seamless tileable edges; no characters, enemies, weapons, pickups, UI, text, logos, border, large central landmark, vignette, watermark, transparent areas, fluorescent colors, excessive glow, or visually busy equal-intensity details.""",
    "loading": """Use case: stylized-concept
Asset type: 720x1280 portrait loading and menu key art background for a mobile survivor game
Primary request: a charming cartoon sci-fi astronaut survivor standing on a stylized alien battlefield while a looming rust-red crystal-armored alien boss and a few small monster silhouettes approach from the distance.
Style: polished mobile game key art, refined flat arcade cartoon, chunky silhouettes, two-step cel shading, restrained medium saturation, limited teal/coral/warm-gold palette, attractive and cohesive rather than flashy.
Composition: portrait, astronaut in the lower-middle, boss in upper-middle, open dark-blue negative space across the top quarter for the game title and around the lower edge for loading text. Dynamic but not cluttered.
Constraints: no text, letters, numbers, logos, UI, fake gameplay HUD, border, photorealism, gore, watermark, fluorescent colors, excessive bloom, rainbow palette, candy-plastic rendering.""",
    "share": """Use case: ads-marketing
Asset type: 1280x720 landscape share cover for a mobile survivor game
Primary request: the same charming cartoon sci-fi astronaut survivor firing a muted-cyan energy rifle into a wave of distinctive alien monsters, with a rust-red crystal-armored boss behind them on an alien moon battlefield.
Style: polished arcade mobile game promotional illustration, refined flat cartoon shapes, clean two-step cel shading, chunky readable silhouettes, restrained teal/coral/warm-gold palette with one small green accent.
Composition: landscape action sweep from lower-left astronaut toward upper-right enemies, clear open dark-blue space on the left/top-left for platform-added title copy, readable at phone thumbnail size.
Constraints: no text, letters, numbers, logos, UI, fake gameplay HUD, border, gore, photorealism, watermark, fluorescent colors, excessive glow, rainbow palette, candy-plastic rendering.""",
    "icon": """Use case: logo-brand
Asset type: square mobile game app icon artwork
Primary request: a close-up emblematic portrait of a cute determined sci-fi astronaut helmet with a muted-cyan visor, warm ochre-gold helmet shell, and a small coral starfall streak reflected in the visor.
Style: premium refined flat arcade cartoon icon, chunky silhouette, soft navy outline, restrained medium saturation, limited cyan/coral/ochre palette, two-step cel shading, highly readable at 64 pixels.
Composition: centered face filling most of the square, simple deep-blue circular space backdrop, generous safe margin, balanced and symmetrical.
Constraints: no text, letters, numbers, logo wordmark, weapons, extra characters, thin details, transparent background, rounded-square mask, border, watermark, fluorescent colors, excessive gloss, rainbow palette.""",
}


def request_image(prompt: str, output: Path, size: str, endpoint: str, model: str) -> None:
    api_key = os.environ.get("TOKENX_API_KEY") or os.environ.get("YUZ_API_KEY")
    if not api_key:
        raise SystemExit("Missing TOKENX_API_KEY in environment")
    payload = json.dumps({"model": model, "prompt": prompt, "size": size, "n": 1}).encode()
    request = urllib.request.Request(endpoint, payload, {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "StarfallUiWorldArtPipeline/1.0",
    })
    with urllib.request.urlopen(request, timeout=600) as response:
        result = json.loads(response.read())
    item = result["data"][0]
    if item.get("b64_json"):
        raw = base64.b64decode(item["b64_json"])
    else:
        with urllib.request.urlopen(item["url"], timeout=600) as response:
            raw = response.read()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h)).convert("RGBA")


def make_mirrored_seamless_tile(image: Image.Image, size: int) -> Image.Image:
    """Build a periodic tile without inventing pixels or touching Cocos metadata.

    Each source edge meets a mirrored copy of itself at the internal seams, and
    opposite output edges are identical. This is deliberately deterministic so
    a regenerated runtime asset can be checked pixel-for-pixel in CI.
    """
    half = size // 2
    quadrant = cover(image, (half, half))
    tile = Image.new("RGBA", (size, size))
    tile.paste(quadrant, (0, 0))
    tile.paste(quadrant.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (half, 0))
    tile.paste(quadrant.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, half))
    tile.paste(quadrant.transpose(Image.Transpose.ROTATE_180), (half, half))
    return tile


def install(name: str, raw: Path) -> Path:
    image = Image.open(raw).convert("RGB")
    if name == "battlefield":
        # A slight contrast lift keeps the ground legible beneath translucent VFX.
        image = ImageEnhance.Contrast(image).enhance(1.08).filter(ImageFilter.SHARPEN)
        destination = WORLD / "battlefield_tile.png"
        rendered = make_mirrored_seamless_tile(image, 1024)
    elif name == "loading":
        destination = APP_STORE / "loading_key_art_720x1280.png"
        rendered = cover(image, (720, 1280))
    elif name == "share":
        destination = APP_STORE / "share_cover_1280x720.png"
        rendered = cover(image, (1280, 720))
    else:
        destination = APP_STORE / "app_icon_1024.png"
        rendered = cover(image, (1024, 1024))
    destination.parent.mkdir(parents=True, exist_ok=True)
    rendered.save(destination, optimize=True)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*", metavar="ASSET")
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--process", action="store_true")
    parser.add_argument("--endpoint", default=os.environ.get("IMAGE_API_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--model", default=os.environ.get("IMAGE_API_MODEL", DEFAULT_MODEL))
    args = parser.parse_args()
    if not args.generate and not args.process:
        parser.error("choose --generate and/or --process")
    names = args.names or list(PROMPTS)
    invalid = sorted(set(names) - PROMPTS.keys())
    if invalid:
        parser.error(f"unknown assets: {', '.join(invalid)}; choose from {', '.join(PROMPTS)}")
    for name in names:
        raw = SOURCE / f"{name}_raw.png"
        if args.generate:
            request_image(
                PROMPTS[name],
                raw,
                "1024x1536" if name == "loading" else "1536x1024" if name == "share" else "1024x1024",
                args.endpoint,
                args.model,
            )
        destination = install(name, raw) if args.process else None
        print(json.dumps({"name": name, "source": str(raw.relative_to(ROOT)), "installed": str(destination.relative_to(ROOT)) if destination else None}))


if __name__ == "__main__":
    main()

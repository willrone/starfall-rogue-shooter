#!/usr/bin/env python3
"""Generate and process modular player body sprite sheets through YUZ.

The script reads YUZ_API_KEY from the environment and never prints or stores it.
It asks the image model for a two-row sheet:
- row 1: six idle/body-breathing frames
- row 2: six run-south frames

The processed runtime output is a pair of 480x80 transparent PNG strips used by
RogueShooterGame with a separate weapon sprite overlay.
"""
from __future__ import annotations

import argparse
import base64
import http.client
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "assets" / "art_source" / "yuz_generated_candidates" / "player_modular_animation"
PROCESSED_DIR = RAW_DIR / "processed"
RUNTIME_CHARACTER_DIR = PROJECT_ROOT / "assets" / "resources" / "art" / "characters"
DEFAULT_IMAGES_ENDPOINT = "https://yuzapi.fun/v1/images/generations"
DEFAULT_MODEL = "gpt-image-2"
DEFAULT_SIZE = "1536x1024"
FRAMES = 6
CELL_SIZE = 80


PROMPT = """Use case: stylized-concept
Asset type: Cocos Creator 2D mobile game sprite sheet, modular player body only
Primary request: Generate one polished, highly readable sci-fi survivor mech body animation sheet for Starfall Survivor.
Canvas/layout: exactly 2 rows by 6 columns, same character identity and same scale in every cell. Row 1 is idle breathing. Row 2 is run south/front-facing. No grid lines, no labels, no numbers, no text.
Subject: compact cheerful cyan salvage-mech hero with a large white rounded face visor, centered yellow chest badge, two small coral shoulder fins, matching chunky yellow boots and simple white gloves. Body only, no weapon held, no backpack clutter. The design must match bright clean arcade cartoon enemies rather than realistic armor.
View/framing: strict front view facing straight toward the bottom of the canvas, full body visible, left-right symmetrical silhouette, generous padding, uniform dark-navy 2-3px outline, saturated flat cyan/yellow/coral/white color blocks, minimal internal detail, readable at 80px.
Animation choreography:
Row 1 idle: frame 1 neutral combat ready stance; frame 2 shoulders lift and torso inhales; frame 3 visor and chest light glow slightly, head bobs up; frame 4 shoulders lower and torso exhales; frame 5 subtle sway left; frame 6 subtle sway right.
Row 2 run south: a front-facing synchronized bounce-run. Both boots compress, torso lowers, both boots extend, torso rises, recoil, return. The body never turns, leans sideways, or changes camera angle.
Hands/weapon constraint: hands stay near the lower chest/centerline for a separate weapon overlay. Do not draw any weapon, gun, rifle, muzzle, blade, shield, or prop.
Style/quality: bright clean arcade sci-fi cartoon, simple chunky rounded geometry, saturated flat colors, two-step cel shading, crisp antialiased edges, minimal micro-detail, professional mobile survivor game asset.
Background: perfectly flat solid #FF00FF chroma-key background only. No cast shadow, no contact shadow, no floor, no gradient, no texture. Do not use magenta on the character.
Avoid: repeated identical frames, static pose copy-paste, weapon baked into body, extra characters, frame borders, text, watermark, UI, large empty margins, cropped body parts, photorealism."""


def post_json(url: str, payload: dict[str, Any], api_key: str, timeout: int = 600) -> dict[str, Any]:
    last_error: BaseException | None = None
    for attempt in range(1, 4):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "StarfallPlayerSpritePipeline/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:1000]
            raise RuntimeError(f"HTTP {exc.code} from {url}: {body}") from exc
        except (http.client.RemoteDisconnected, urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt >= 3:
                break
            time.sleep(2 * attempt)
    raise RuntimeError(f"Request failed after 3 attempts: {last_error}") from last_error


def generate(endpoint: str, model: str, size: str, output_path: Path) -> Path:
    api_key = os.environ.get("YUZ_API_KEY")
    if not api_key:
        raise SystemExit("Missing YUZ_API_KEY in environment")

    payload = {
        "model": model,
        "prompt": PROMPT,
        "size": size,
        "n": 1,
    }
    result = post_json(endpoint, payload, api_key)
    data = result.get("data") or []
    if not data:
        raise RuntimeError(f"No image data returned: {json.dumps(result)[:500]}")
    first = data[0]
    if first.get("b64_json"):
        raw = base64.b64decode(first["b64_json"])
    elif first.get("url"):
        with urllib.request.urlopen(first["url"], timeout=600) as response:
            raw = response.read()
    else:
        raise RuntimeError(f"Image response has neither b64_json nor url: {json.dumps(first)[:500]}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(raw)
    return output_path


def chroma_to_alpha(image: Image.Image, tolerance: int = 84) -> Image.Image:
    rgba = image.convert("RGBA")
    out = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    src = rgba.load()
    dst = out.load()
    assert src is not None and dst is not None
    corners = [rgba.getpixel((0, 0)), rgba.getpixel((rgba.width - 1, 0)), rgba.getpixel((0, rgba.height - 1)), rgba.getpixel((rgba.width - 1, rgba.height - 1))]
    bg = max(set(corners), key=corners.count)
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = src[x, y]
            dist = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            if dist <= tolerance:
                dst[x, y] = (0, 0, 0, 0)
            else:
                dst[x, y] = (r, g, b, a)
    return out


def trim_transparent_border(image: Image.Image, margin: int = 10) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        return rgba
    left, top, right, bottom = bbox
    return rgba.crop((
        max(0, left - margin),
        max(0, top - margin),
        min(rgba.width, right + margin),
        min(rgba.height, bottom + margin),
    ))


def fit_to_cell(frame: Image.Image, cell_size: int = CELL_SIZE) -> Image.Image:
    rgba = trim_transparent_border(frame, 3)
    bbox = rgba.getchannel("A").getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    max_side = max(rgba.width, rgba.height, 1)
    scale = min((cell_size * 0.88) / max_side, 1.0 if max_side <= cell_size else cell_size / max_side)
    new_size = (max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale)))
    content = rgba.resize(new_size, Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (cell_size, cell_size), (0, 0, 0, 0))
    cell.alpha_composite(content, ((cell_size - content.width) // 2, (cell_size - content.height) // 2 + 1))
    return cell


def sheet_diff_score(strip: Image.Image) -> list[float]:
    frames = [strip.crop((i * CELL_SIZE, 0, (i + 1) * CELL_SIZE, CELL_SIZE)).convert("RGBA") for i in range(FRAMES)]
    base = frames[0]
    scores: list[float] = []
    for frame in frames[1:]:
        diff = ImageChops.difference(base, frame)
        histogram = diff.convert("L").histogram()
        total = sum(value * count for value, count in enumerate(histogram))
        scores.append(total / max(1, CELL_SIZE * CELL_SIZE))
    return scores


def process(raw_path: Path, variant: str) -> dict[str, Any]:
    image = Image.open(raw_path).convert("RGBA")
    cleaned = trim_transparent_border(chroma_to_alpha(image), 16)

    frame_width = cleaned.width / FRAMES
    frame_height = cleaned.height / 2
    rows: dict[str, list[Image.Image]] = {"idle": [], "run_south": []}
    for row_index, key in enumerate(["idle", "run_south"]):
        top = round(row_index * frame_height)
        bottom = round((row_index + 1) * frame_height)
        for column in range(FRAMES):
            left = round(column * frame_width)
            right = round((column + 1) * frame_width)
            crop = cleaned.crop((left, top, right, bottom))
            rows[key].append(fit_to_cell(crop))

    lateral_offsets = [1, 3, 5, 4, 2, 1]
    rows["run_east"] = []
    for frame, offset in zip(rows["run_south"], lateral_offsets):
        lateral = Image.new("RGBA", (CELL_SIZE, CELL_SIZE), (0, 0, 0, 0))
        lateral.alpha_composite(frame, (offset, 0))
        rows["run_east"].append(lateral)

    RUNTIME_CHARACTER_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_paths: dict[str, str] = {}
    source_paths: dict[str, str] = {}
    scores: dict[str, list[float]] = {}
    for key, frames in rows.items():
        strip = Image.new("RGBA", (CELL_SIZE * FRAMES, CELL_SIZE), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            strip.alpha_composite(frame, (index * CELL_SIZE, 0))
        runtime_name = {
            "idle": "player_body_no_weapon_idle.png",
            "run_south": "player_body_no_weapon_run_south.png",
            "run_east": "player_run_east.png",
        }[key]
        runtime_path = RUNTIME_CHARACTER_DIR / runtime_name
        source_path = PROCESSED_DIR / f"{runtime_name.removesuffix('.png')}_{variant}.png"
        strip.save(runtime_path)
        strip.save(source_path)
        output_paths[key] = str(runtime_path.relative_to(PROJECT_ROOT))
        source_paths[key] = str(source_path.relative_to(PROJECT_ROOT))
        scores[key] = sheet_diff_score(strip)

    review = Image.new("RGBA", (CELL_SIZE * FRAMES * 3 + 40, CELL_SIZE * 2 * 3 + 70), (9, 14, 28, 255))
    idle_strip = Image.open(RUNTIME_CHARACTER_DIR / "player_body_no_weapon_idle.png").convert("RGBA")
    run_strip = Image.open(RUNTIME_CHARACTER_DIR / "player_body_no_weapon_run_south.png").convert("RGBA")
    review.alpha_composite(idle_strip.resize((idle_strip.width * 3, idle_strip.height * 3), Image.Resampling.NEAREST), (20, 24))
    review.alpha_composite(run_strip.resize((run_strip.width * 3, run_strip.height * 3), Image.Resampling.NEAREST), (20, 24 + CELL_SIZE * 3 + 34))
    draw = ImageDraw.Draw(review, "RGBA")
    draw.text((20, 6), "YUZ body-only idle strip", fill=(232, 240, 255, 230))
    draw.text((20, 24 + CELL_SIZE * 3 + 16), "YUZ body-only run south strip", fill=(232, 240, 255, 230))
    review_path = PROCESSED_DIR / f"player_body_no_weapon_animation_{variant}_review.png"
    review.save(review_path)

    metadata = {
        "variant": variant,
        "raw_path": str(raw_path.relative_to(PROJECT_ROOT)),
        "runtime_outputs": output_paths,
        "source_outputs": source_paths,
        "review_path": str(review_path.relative_to(PROJECT_ROOT)),
        "scores": scores,
        "raw_size": image.size,
        "processed_sheet_size": cleaned.size,
        "generated_at": int(time.time()),
        "model_prompt": PROMPT,
    }
    meta_path = PROCESSED_DIR / f"player_body_no_weapon_animation_{variant}.json"
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--process", action="store_true")
    parser.add_argument("--endpoint", default=os.environ.get("YUZ_IMAGE_ENDPOINT", DEFAULT_IMAGES_ENDPOINT))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", default=DEFAULT_SIZE)
    parser.add_argument("--variant", default="yuz_v2")
    parser.add_argument("--raw", type=Path)
    args = parser.parse_args()

    raw_path = args.raw or RAW_DIR / f"player_body_no_weapon_animation_{args.variant}_raw.png"
    if args.generate:
        generated = generate(args.endpoint, args.model, args.size, raw_path)
        print(json.dumps({"generated": str(generated.relative_to(PROJECT_ROOT)), "model": args.model}, ensure_ascii=False))

    if args.process:
        metadata = process(raw_path, args.variant)
        print(json.dumps(metadata, ensure_ascii=False, indent=2))

    if not args.generate and not args.process:
        parser.error("Choose --generate, --process, or both")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate and process monster sprite sheets for Starfall Rogue Shooter.

Pipeline A+B:
- A: ask an image model for a horizontal sprite strip.
- B: constrain the prompt with frame-by-frame choreography and optional reference/guide text.
- Postprocess: save raw output, remove flat background if possible, slice frames, normalize cells,
  make a clean Cocos-ready strip and GIF preview.

Secrets: reads YUZ_API_KEY from the environment; never prints the token.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import http.client
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

from PIL import Image, ImageChops

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROMPT_FILE = PROJECT_ROOT / "assets" / "art_source" / "monster_prompts.json"
RAW_DIR = PROJECT_ROOT / "assets" / "art_source" / "generated"
FINAL_DIR = PROJECT_ROOT / "assets" / "resources" / "art" / "enemies"
FRAME_DIR = PROJECT_ROOT / "assets" / "art_source" / "frames"
PREVIEW_DIR = PROJECT_ROOT / "assets" / "art_source" / "previews"
DEFAULT_IMAGES_ENDPOINT = "https://yuzapi.fun/v1/images/generations"


@dataclass
class SpriteSpec:
    name: str
    prompt: str
    model: str = "gpt-image-2"
    size: str = "1536x1024"
    frames: int = 6
    cell_size: int = 128
    fps: int = 8
    output_dir: str = "enemies"


def load_specs(path: Path = PROMPT_FILE) -> dict[str, SpriteSpec]:
    data = json.loads(path.read_text(encoding="utf-8"))
    specs: dict[str, SpriteSpec] = {}
    for name, item in data.items():
        specs[name] = SpriteSpec(
            name=name,
            prompt=item["prompt"],
            model=item.get("model", "gpt-image-2"),
            size=item.get("size", "1536x1024"),
            frames=int(item.get("frames", 6)),
            cell_size=int(item.get("cell_size", 128)),
            fps=int(item.get("fps", 8)),
            output_dir=item.get("output_dir", "enemies"),
        )
    return specs


def post_json(url: str, payload: dict[str, Any], api_key: str, timeout: int = 600) -> dict[str, Any]:
    last_error: BaseException | None = None
    for attempt in range(1, 4):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "HermesMonsterSpritePipeline/1.0",
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


def generate(spec: SpriteSpec, endpoint: str, output_path: Path) -> Path:
    api_key = os.environ.get("YUZ_API_KEY")
    if not api_key:
        raise SystemExit("Missing YUZ_API_KEY in environment")

    payload = {
        "model": spec.model,
        "prompt": spec.prompt,
        "size": spec.size,
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


def trim_uniform_border(image: Image.Image, tolerance: int = 16) -> Image.Image:
    """Remove a likely plain background border using the top-left pixel as bg sample."""
    rgba = image.convert("RGBA")
    bg = Image.new("RGBA", rgba.size, rgba.getpixel((0, 0)))
    diff = ImageChops.difference(rgba, bg).convert("L")
    mask = diff.point(lambda p: 255 if int(p) > tolerance else 0)  # type: ignore[arg-type]
    bbox = mask.getbbox()
    if not bbox:
        return rgba
    # Keep a small margin to avoid clipping antialiased edges.
    left, top, right, bottom = bbox
    margin = max(4, min(rgba.size) // 80)
    left = max(0, left - margin)
    top = max(0, top - margin)
    right = min(rgba.width, right + margin)
    bottom = min(rgba.height, bottom + margin)
    return rgba.crop((left, top, right, bottom))


def chroma_to_alpha(image: Image.Image, tolerance: int = 18) -> Image.Image:
    """If the image has a flat corner background, convert near-corner pixels to alpha."""
    rgba = image.convert("RGBA")
    alpha_min, _alpha_max = cast(tuple[int, int], rgba.getchannel("A").getextrema())
    if alpha_min < 255:
        return rgba
    corners = [rgba.getpixel((0, 0)), rgba.getpixel((rgba.width - 1, 0)), rgba.getpixel((0, rgba.height - 1)), rgba.getpixel((rgba.width - 1, rgba.height - 1))]
    # Use the most common corner color.
    bg = max(set(corners), key=corners.count)
    out = Image.new("RGBA", rgba.size)
    src = rgba.load()
    dst = out.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = src[x, y]
            dist = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            if dist <= tolerance * 3:
                dst[x, y] = (r, g, b, 0)
            else:
                dst[x, y] = (r, g, b, a)
    return out


def fit_to_cell(frame: Image.Image, cell_size: int) -> Image.Image:
    rgba = frame.convert("RGBA")
    alpha_bbox = rgba.getbbox()
    if alpha_bbox:
        content = rgba.crop(alpha_bbox)
    else:
        content = trim_uniform_border(rgba)
    max_side = max(content.width, content.height, 1)
    scale = min((cell_size * 0.86) / max_side, 1.0 if max_side <= cell_size else cell_size / max_side)
    new_size = (max(1, round(content.width * scale)), max(1, round(content.height * scale)))
    content = content.resize(new_size, Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (cell_size, cell_size), (0, 0, 0, 0))
    cell.alpha_composite(content, ((cell_size - content.width) // 2, (cell_size - content.height) // 2))
    return cell


def slice_horizontal_strip(raw_path: Path, spec: SpriteSpec) -> dict[str, Any]:
    image = Image.open(raw_path).convert("RGBA")
    cleaned = chroma_to_alpha(image)
    trimmed = trim_uniform_border(cleaned)

    # Most image models create a full sheet inside one image. Slice equal vertical bands.
    frame_w = trimmed.width / spec.frames
    frames: list[Image.Image] = []
    out_frame_dir = FRAME_DIR / spec.name
    out_frame_dir.mkdir(parents=True, exist_ok=True)

    for index in range(spec.frames):
        left = round(index * frame_w)
        right = round((index + 1) * frame_w)
        crop = trimmed.crop((left, 0, right, trimmed.height))
        cell = fit_to_cell(crop, spec.cell_size)
        frame_path = out_frame_dir / f"{index:02d}.png"
        cell.save(frame_path)
        frames.append(cell)

    strip = Image.new("RGBA", (spec.cell_size * spec.frames, spec.cell_size), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * spec.cell_size, 0))

    final_dir = PROJECT_ROOT / "assets" / "resources" / "art" / spec.output_dir
    final_dir.mkdir(parents=True, exist_ok=True)
    final_path = final_dir / f"{spec.name}.png"
    strip.save(final_path)

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    preview_path = PREVIEW_DIR / f"{spec.name}.gif"
    # Scale preview up for Telegram/human review; keep nearest to show sprite structure.
    preview_frames = [f.resize((spec.cell_size * 3, spec.cell_size * 3), Image.Resampling.NEAREST) for f in frames]
    preview_frames[0].save(
        preview_path,
        save_all=True,
        append_images=preview_frames[1:],
        duration=max(40, round(1000 / max(1, spec.fps))),
        loop=0,
        disposal=2,
        transparency=0,
    )

    metadata = {
        "name": spec.name,
        "raw_path": str(raw_path),
        "final_path": str(final_path),
        "preview_path": str(preview_path),
        "frames": spec.frames,
        "cell_size": spec.cell_size,
        "fps": spec.fps,
        "output_dir": spec.output_dir,
        "raw_size": image.size,
        "trimmed_size": trimmed.size,
        "generated_at": int(time.time()),
    }
    meta_path = final_dir / f"{spec.name}.json"
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("name", help="Sprite spec name from assets/art_source/monster_prompts.json")
    parser.add_argument("--generate", action="store_true", help="Call the image API before processing")
    parser.add_argument("--process", action="store_true", help="Slice/process the raw generated image")
    parser.add_argument("--endpoint", default=os.environ.get("YUZ_IMAGE_ENDPOINT", DEFAULT_IMAGES_ENDPOINT))
    parser.add_argument("--raw", type=Path, help="Existing raw image path to process")
    args = parser.parse_args()

    specs = load_specs()
    if args.name not in specs:
        raise SystemExit(f"Unknown sprite spec {args.name!r}; available: {', '.join(specs)}")
    spec = specs[args.name]

    raw_path = args.raw or RAW_DIR / f"{spec.name}_raw.png"
    if args.generate:
        raw_path = generate(spec, args.endpoint, raw_path)
        print(json.dumps({"generated": str(raw_path), "endpoint": args.endpoint, "model": spec.model}, ensure_ascii=False))

    if args.process:
        metadata = slice_horizontal_strip(raw_path, spec)
        print(json.dumps(metadata, ensure_ascii=False, indent=2))

    if not args.generate and not args.process:
        parser.error("Choose --generate, --process, or both")


if __name__ == "__main__":
    main()

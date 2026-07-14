#!/usr/bin/env python3
"""Generate and process monster sprite sheets for Starfall Rogue Shooter.

Pipeline A+B:
- A: ask an image model for a horizontal sprite strip.
- B: constrain the prompt with frame-by-frame choreography and optional reference/guide text.
- Postprocess: save raw output, remove flat background if possible, slice frames, normalize cells,
  make a clean Cocos-ready strip and GIF preview.

Secrets: reads TOKENX_API_KEY or YUZ_API_KEY from the environment; never prints the token.
"""
from __future__ import annotations

import argparse
import base64
from collections import deque
import json
import os
import sys
import time
import http.client
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFilter

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROMPT_FILE = PROJECT_ROOT / "assets" / "art_source" / "monster_prompts.json"
RAW_DIR = PROJECT_ROOT / "assets" / "art_source" / "generated"
FINAL_DIR = PROJECT_ROOT / "assets" / "resources" / "art" / "enemies"
FRAME_DIR = PROJECT_ROOT / "assets" / "art_source" / "frames"
PREVIEW_DIR = PROJECT_ROOT / "assets" / "art_source" / "previews"
DEFAULT_IMAGES_ENDPOINT = "https://tokenx24.com/v1/images/generations"
MONSTER_STYLE_GUARD = (
    "Mandatory style lock: polished flat 2D mobile-game cartoon, vector-like silhouettes, "
    "large clean color blocks, broad readable features, very few internal seams, minimal surface texture, "
    "raised midtones, soft deep-navy outlines, exactly two hard cel-shading tones. "
    "Do not use painterly rendering, realistic metal, realistic lighting, glossy 3D rendering, "
    "dense facets, tiny scratches, excessive glow, or dark crushed shadows."
)


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
    frame_order: list[int] | None = None


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
            frame_order=item.get("frame_order"),
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
    api_key = os.environ.get("TOKENX_API_KEY") or os.environ.get("YUZ_API_KEY")
    if not api_key:
        raise SystemExit("Missing TOKENX_API_KEY or YUZ_API_KEY in environment")

    payload = {
        "model": spec.model,
        "prompt": f"{MONSTER_STYLE_GUARD}\n\n{spec.prompt}",
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
    corners = [rgba.getpixel((0, 0)), rgba.getpixel((rgba.width - 1, 0)), rgba.getpixel((0, rgba.height - 1)), rgba.getpixel((rgba.width - 1, rgba.height - 1))]
    # Use the most common corner color.
    bg = max(set(corners), key=corners.count)
    out = Image.new("RGBA", rgba.size)
    src = rgba.load()
    dst = out.load()
    removable = bytearray(rgba.width * rgba.height)
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = src[x, y]
            dist = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            magenta_key = r > 145 and b > 145 and g < 155 and abs(r - b) < 120
            green_key = g > 145 and r < 155 and b < 155
            yellow_key = r > 155 and g > 155 and b < 145 and abs(r - g) < 110
            exact_key = dist <= tolerance * 2
            removable[y * rgba.width + x] = 1 if exact_key or magenta_key or green_key or yellow_key else 0
            # Exact key-color islands can be enclosed by legs or detached parts,
            # so remove them globally. Broader purple/green ranges are still
            # protected by the edge-connected flood fill below.
            # Prompt contracts forbid the selected key hue in the subject, so
            # remove high-confidence key pixels globally as well as the broader
            # edge-connected matte. This clears tiny enclosed islands between
            # horns, fingers and armor plates.
            dst[x, y] = (0, 0, 0, 0) if exact_key or magenta_key or green_key or yellow_key else (r, g, b, a)

    # Only erase key-colored pixels connected to the canvas edge, so purple
    # details enclosed by the creature remain intact.
    visited = bytearray(rgba.width * rgba.height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(rgba.width):
        queue.append((x, 0))
        queue.append((x, rgba.height - 1))
    for y in range(rgba.height):
        queue.append((0, y))
        queue.append((rgba.width - 1, y))
    while queue:
        x, y = queue.popleft()
        index = y * rgba.width + x
        if visited[index] or not removable[index]:
            continue
        visited[index] = 1
        r, g, b, _a = dst[x, y]
        dst[x, y] = (r, g, b, 0)
        if x > 0: queue.append((x - 1, y))
        if x + 1 < rgba.width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < rgba.height: queue.append((x, y + 1))
    # Contract the matte by one source pixel and suppress key-color spill on
    # antialiased edge pixels before the much smaller runtime cells are built.
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    pixels = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, _a = pixels[x, y]
            if bg[1] > bg[0] + 40 and bg[1] > bg[2] + 40 and g > max(r, b) + 18:
                g = min(g, max(r, b) + 18)
            elif bg[0] > bg[1] + 40 and bg[2] > bg[1] + 40:
                excess = max(0, min(r, b) - g - 18)
                r = max(g, r - excess)
                b = max(g, b - excess)
            pixels[x, y] = (r, g, b, alpha.getpixel((x, y)))
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
    content_pixels = content.load()
    for y in range(content.height):
        for x in range(content.width):
            r, g, b, a = content_pixels[x, y]
            keyed_edge = (
                g > max(r, b) + 28
                or (r > g + 34 and b > g + 34)
                or (r > 150 and g > 150 and b + 38 < min(r, g))
            )
            if a < 245 and keyed_edge:
                content_pixels[x, y] = (r, g, b, 0)
    cell = Image.new("RGBA", (cell_size, cell_size), (0, 0, 0, 0))
    cell.alpha_composite(content, ((cell_size - content.width) // 2, (cell_size - content.height) // 2))
    return cell


def find_frame_bounds(image: Image.Image, frame_count: int) -> list[tuple[int, int]]:
    """Split a generated row at alpha-projection valleys instead of equal widths."""
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return [(round(i * image.width / frame_count), round((i + 1) * image.width / frame_count)) for i in range(frame_count)]

    left_edge, _top, right_edge, _bottom = bbox
    pixels = alpha.load()
    projection = [sum(1 for y in range(image.height) if pixels[x, y] > 12) for x in range(image.width)]
    boundaries = [left_edge]
    span = right_edge - left_edge
    for index in range(1, frame_count):
        expected = left_edge + span * index / frame_count
        radius = max(8, round(span / frame_count * 0.28))
        start = max(boundaries[-1] + 1, round(expected - radius))
        end = min(right_edge - 1, round(expected + radius))
        minimum = min(projection[start:end + 1])
        candidates = [x for x in range(start, end + 1) if projection[x] == minimum]
        boundaries.append(round(sum(candidates) / len(candidates)))
    boundaries.append(right_edge)
    bounds = [(boundaries[i], boundaries[i + 1]) for i in range(frame_count)]
    for boundary in boundaries[1:-1]:
        if projection[boundary] > max(1, round(image.height * 0.005)):
            raise ValueError(f"No clean frame gap near x={boundary}; projection={projection[boundary]}")
    return bounds


def slice_horizontal_strip(raw_path: Path, spec: SpriteSpec) -> dict[str, Any]:
    image = Image.open(raw_path).convert("RGBA")
    cleaned = chroma_to_alpha(image)
    trimmed = trim_uniform_border(cleaned)
    frame_bounds = find_frame_bounds(trimmed, spec.frames)
    frames: list[Image.Image] = []
    out_frame_dir = FRAME_DIR / spec.name
    out_frame_dir.mkdir(parents=True, exist_ok=True)

    for index in range(spec.frames):
        left, right = frame_bounds[index]
        crop = trimmed.crop((left, 0, right, trimmed.height))
        cell = fit_to_cell(crop, spec.cell_size)
        frame_path = out_frame_dir / f"{index:02d}.png"
        cell.save(frame_path)
        frames.append(cell)

    if spec.frame_order is not None:
        if sorted(spec.frame_order) != list(range(spec.frames)):
            raise ValueError(f"Invalid frame_order for {spec.name}: {spec.frame_order}")
        frames = [frames[index] for index in spec.frame_order]

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
    meta_path = RAW_DIR / f"{spec.name}.json"
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("name", help="Sprite spec name from assets/art_source/monster_prompts.json")
    parser.add_argument("--prompt-file", type=Path, default=PROMPT_FILE)
    parser.add_argument("--generate", action="store_true", help="Call the image API before processing")
    parser.add_argument("--process", action="store_true", help="Slice/process the raw generated image")
    parser.add_argument(
        "--endpoint",
        default=os.environ.get("TOKENX_IMAGE_ENDPOINT") or os.environ.get("YUZ_IMAGE_ENDPOINT") or DEFAULT_IMAGES_ENDPOINT,
    )
    parser.add_argument("--raw", type=Path, help="Existing raw image path to process")
    args = parser.parse_args()

    specs = load_specs(args.prompt_file)
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

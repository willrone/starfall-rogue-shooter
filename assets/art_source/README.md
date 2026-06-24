# Monster Sprite Generation Pipeline

This folder is for AI-generated monster animation sources.

## Current workflow: Scheme A + Scheme B

- **Scheme A**: ask an image model to generate one horizontal sprite strip.
- **Scheme B**: constrain the strip with frame-by-frame choreography in the prompt, so the model has a clear animation plan.
- Postprocess with `tools/monster_sprite_pipeline.py`:
  - save raw output under `assets/art_source/generated/`
  - remove a flat/chroma background when possible
  - slice equal-width frames
  - normalize each frame into a fixed cell
  - export a Cocos-ready strip under `assets/resources/art/enemies/`
  - export GIF/checker previews under `assets/art_source/previews/`

## Commands

```bash
# Generate through YUZ image endpoint and process into frames/sheet/GIF.
python3 tools/monster_sprite_pipeline.py enemy_mite_walk --generate --process

# Reprocess an existing raw model output.
python3 tools/monster_sprite_pipeline.py enemy_mite_walk --process \
  --raw assets/art_source/generated/enemy_mite_walk_raw.png
```

The script reads `YUZ_API_KEY` from the environment and does not print it.

Note: direct forwarding on `https://image.yuzapi.fun/v1/...` returned `AI_GATEWAY_DISABLED` during the first smoke test, while the same YUZ token worked on `https://yuzapi.fun/v1/images/generations`. The script therefore defaults to `https://yuzapi.fun/v1/images/generations`; override with `--endpoint` or `YUZ_IMAGE_ENDPOINT` if the image subdomain is enabled later.

## Prompt specs

Edit `monster_prompts.json`. Each entry supports:

```json
{
  "model": "gpt-image-2",
  "size": "1536x1024",
  "frames": 6,
  "cell_size": 128,
  "fps": 8,
  "prompt": "..."
}
```

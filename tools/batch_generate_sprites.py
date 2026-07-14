#!/usr/bin/env python3
"""Batch generate all monster sprites."""
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path('/Users/ronghui/Documents/game_dev_cocos')
pf = ROOT / 'assets/art_source/monster_prompts.json'
prompts = json.loads(pf.read_text())

monsters = [k for k in prompts if k.startswith('enemy_')]
print(f"Batch generating {len(monsters)} monsters...")

for i, name in enumerate(monsters):
    spec = prompts[name]
    cell = spec.get('cell_size', 128)
    raw = ROOT / 'assets/art_source/generated' / f'{name}_raw.png'
    if raw.exists():
        raw.unlink()

    print(f"[{i+1}/{len(monsters)}] {name} (cell={cell}px)... ", end='', flush=True)
    t0 = time.time()
    result = subprocess.run(
        [sys.executable, 'tools/monster_sprite_pipeline.py', name, '--generate', '--process'],
        cwd=ROOT, capture_output=True, text=True, timeout=300
    )
    dt = time.time() - t0

    if result.returncode != 0:
        print(f"FAILED ({dt:.0f}s)\n{result.stderr[:300]}")
    else:
        final = ROOT / 'assets/resources/art/enemies' / f'{name}.png'
        print(f"OK ({dt:.0f}s, {final.stat().st_size//1024 if final.exists() else 0}KB)")

    if i < len(monsters) - 1:
        time.sleep(1)

print("\n=== Done ===")
for f in sorted((ROOT / 'assets/resources/art/enemies').glob('*.png')):
    print(f"  {f.name:<35s} {f.stat().st_size//1024:>4}KB")

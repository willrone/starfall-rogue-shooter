#!/usr/bin/env python3
"""Generate HUD bar gradient textures for the Starfall Survivor HUD overhaul."""
import uuid
import json
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path('/Users/ronghui/Documents/game_dev_cocos/assets/resources/effects')
ICON_DIR = OUT / 'ui_icons'

def gen_bar(name, w, h, colors, corner_r=3):
    """Generate a gradient bar image and its .meta file."""
    img = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    # Draw rounded rect with horizontal gradient
    for x in range(w):
        t = x / max(w-1, 1)
        r = int(colors[0][0] + (colors[1][0] - colors[0][0]) * t)
        g = int(colors[0][1] + (colors[1][1] - colors[0][1]) * t)
        b = int(colors[0][2] + (colors[1][2] - colors[0][2]) * t)
        a = int(colors[0][3] + (colors[1][3] - colors[0][3]) * t)
        for y in range(h):
            # Simple corner rounding
            dx = min(x, w-1-x)
            dy = min(y, h-1-y)
            dist = (dx - corner_r + 1)**2 + (dy - corner_r + 1)**2
            if dx < corner_r and dy < corner_r and dist > corner_r**2:
                continue
            img.putpixel((x, y), (r, g, b, a))
    
    # Save PNG
    img.save(OUT / f'{name}.png')
    
    # Generate .meta
    uid = str(uuid.uuid4())
    meta = {
        "ver": "3.8.8",
        "importer": "texture",
        "imported": True,
        "uuid": uid,
        "files": [],
        "subMetas": {
            f"{uid}@6c48a": {
                "ver": "3.8.8",
                "importer": "texture",
                "imported": True,
                "uuid": f"{uid}@6c48a",
                "files": [],
                "subMetas": {},
                "userData": {}
            },
            f"{uid}@f9941": {
                "ver": "3.8.8",
                "importer": "sprite-frame",
                "imported": True,
                "uuid": f"{uid}@f9941",
                "files": [],
                "subMetas": {},
                "userData": {
                    "spriteType": "sliced",
                    "borderTop": 0,
                    "borderBottom": 0,
                    "borderLeft": corner_r,
                    "borderRight": corner_r,
                }
            }
        },
        "userData": {}
    }
    with open(OUT / f'{name}.png.meta', 'w') as f:
        json.dump(meta, f, indent=2)
    
    size = img.tell() if hasattr(img, 'tell') else 0
    print(f'  {name}.png  {w}x{h}  {size}B')

# ── Bar textures ──
# HP fill: dark red → bright red → orange (full width 668)
gen_bar('hud_bar_hp', 668, 6, [(200,20,30,220), (240,120,20,220)], corner_r=3)
# HP background: dark
gen_bar('hud_bar_hp_bg', 668, 6, [(15,23,42,200), (20,30,50,200)], corner_r=3)
# XP fill: purple → violet
gen_bar('hud_bar_xp', 334, 6, [(130,50,200,220), (170,100,255,220)], corner_r=3)
# XP background
gen_bar('hud_bar_xp_bg', 334, 6, [(15,23,42,180), (20,30,50,180)], corner_r=3)
# Shield fill: blue → cyan
gen_bar('hud_bar_shield', 334, 6, [(30,100,220,220), (20,200,220,220)], corner_r=3)
# Shield background
gen_bar('hud_bar_shield_bg', 334, 6, [(15,23,42,180), (20,30,50,180)], corner_r=3)

# ── Icon: alloy coin ──
def gen_icon(name, size, color, symbol=''):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    cx = cy = size // 2
    r = size // 2 - 2
    # Outer circle
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)
    # Inner highlight
    hr = max(2, r - 3)
    hl = (min(255, color[0]+80), min(255, color[1]+80), min(255, color[2]+80), color[3])
    draw.ellipse([cx-hr, cy-hr, cx+hr, cy+hr], fill=hl)
    # Center dot (if big enough)
    if hr > 3:
        dr = max(1, hr - 4)
        dc = (color[0]//2, color[1]//2, color[2]//2, color[3])
        draw.ellipse([cx-dr, cy-dr, cx+dr, cy+dr], fill=dc)
    img.save(ICON_DIR / f'{name}.png')
    
    uid = str(uuid.uuid4())
    meta = {
        "ver": "3.8.8", "importer": "texture", "imported": True, "uuid": uid, "files": [],
        "subMetas": {
            f"{uid}@6c48a": {"ver": "3.8.8", "importer": "texture", "imported": True, "uuid": f"{uid}@6c48a", "files": [], "subMetas": {}, "userData": {}},
            f"{uid}@f9941": {"ver": "3.8.8", "importer": "sprite-frame", "imported": True, "uuid": f"{uid}@f9941", "files": [], "subMetas": {}, "userData": {}}
        }, "userData": {}
    }
    with open(ICON_DIR / f'{name}.png.meta', 'w') as f:
        json.dump(meta, f, indent=2)
    print(f'  {name}.png  {size}x{size}')

gen_icon('hud_icon_alloy', 20, (249, 199, 79, 255))
gen_icon('hud_icon_hp', 16, (239, 68, 68, 255))
gen_icon('hud_icon_xp', 16, (167, 139, 250, 255))
gen_icon('hud_icon_shield', 16, (56, 189, 248, 255))

print('Done!')

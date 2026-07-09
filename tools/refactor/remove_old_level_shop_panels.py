#!/usr/bin/env python3
from pathlib import Path
p = Path('/Users/ronghui/Documents/game_dev_cocos/assets/scripts/RogueShooterGame.ts')
lines = p.read_text().splitlines()

# Remove calls in buildScene
lines = [l for l in lines if 'this.buildLevelPanel(root);' not in l and 'this.buildShopPanel(root);' not in l]

# Remove buildLevelPanel through before buildHangarPanel
try:
    s = next(i for i,l in enumerate(lines) if '    private buildLevelPanel(root: Node)' in l)
    e = next(i for i,l in enumerate(lines) if i > s and '    private buildHangarPanel(root: Node)' in l)
    del lines[s:e]
    # Insert replacement note before buildHangarPanel
    lines.insert(s, '    // level panel → ChoicePopup')
    lines.insert(s + 1, '    // shop panel  → ShopPopup')
    lines.insert(s + 2, '')
except StopIteration:
    # ensure comments exist
    if not any('level panel → ChoicePopup' in l for l in lines):
        ins = next(i for i,l in enumerate(lines) if '    private buildHangarPanel(root: Node)' in l)
        lines[ins:ins] = ['    // level panel → ChoicePopup', '    // shop panel  → ShopPopup', '']

p.write_text('\n'.join(lines) + '\n')
print('removed old level/shop panel builders')
print('lines', len(lines))

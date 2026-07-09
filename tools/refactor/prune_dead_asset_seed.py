#!/usr/bin/env python3
import json
from pathlib import Path
p = Path('/Users/ronghui/Documents/game_dev_cocos/tools/bot/assets-data-web-mobile-seed.json')
if not p.exists():
    print('seed missing')
    raise SystemExit(0)
markers = ['icons_equip_resource', 'icons_weapons_1', 'icons_weapons_2', 'ui/icons']
data = json.loads(p.read_text())
removed = []
if isinstance(data, dict):
    for k in list(data.keys()):
        s = json.dumps(data[k], ensure_ascii=False)
        if any(m in s for m in markers):
            removed.append(k)
            del data[k]
else:
    raise SystemExit('unexpected seed shape')
p.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(f'removed {len(removed)} dead asset records')
print('remaining refs', sum(json.dumps(data, ensure_ascii=False).count(m) for m in markers))

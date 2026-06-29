#!/usr/bin/env python3
"""Debug: why aren't weapons firing?"""

import sys, json
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# Check weapon state
checks = [
    ("weapon cooldowns", "JSON.stringify(window.__starfallGame.weaponCooldowns)"),
    ("equipped weapons", "JSON.stringify(window.__starfallGame.shop.getEquippedWeapons().map(function(w){return w.id}))"),
    ("active weapon", "JSON.stringify(window.__starfallGame.shop.getActiveWeapon())"),
    ("has ammo?", "JSON.stringify({shotTimer: window.__starfallGame.cs.shotTimer, phase: window.__starfallGame.cs.phase})"),
    ("weaponStats", "JSON.stringify(window.__starfallGame.shop.getActiveWeapon() ? window.__starfallGame.shop.getActiveWeapon().weaponStats : null)"),
]

for name, expr in checks:
    result = cdp.evaluate("(function(){try{return " + expr + "}catch(e){return 'err:'+e.message}})()", timeout=2)
    print(f"{name:20s}: {result[:100]}")

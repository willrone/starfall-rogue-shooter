#!/usr/bin/env python3
"""
Full bot: setup, run, collect data.
Uses __starfall hooks, auto-manages waves.
"""

import sys, json, time
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# Start battle from menu
print("=== Starting battle ===")
cdp.evaluate("""
(function(){
    try {
        var g = window.__starfallGame;
        var shop = g.shop;
        shop.ownedEquipment.add('storm-rifle');
        shop.equippedEquipment = ['storm-rifle'];
        // Also add starter gear
        ['tactical-visor','phase-armor','kinetic-boots','magnet-coil'].forEach(function(id){
            shop.ownedEquipment.add(id);
            if(shop.equippedEquipment.length < 8) shop.equippedEquipment.push(id);
        });
        g.beginBattle(false);
    } catch(e) {}
})()
""", timeout=3)
time.sleep(2)

gs = cdp.evaluate("(function(){var s=window.__starfallCombatState;return s?JSON.stringify(s):'null'})()", timeout=2)
print(f"Phase: {json.loads(gs).get('phase') if gs != 'null' else 'null'}")

# Game loop
print(f"\n{'T(s)':>5} {'Wave':>4} {'Enemies':>7} {'HP':>6} {'Kills':>5} {'Level':>5}")
results = []
for step in range(300):  # up to 5 min
    for _ in range(60):
        cdp.evaluate("window.__starfallTick(1/60)", timeout=0.3)
    
    gs = cdp.evaluate(
        "(function(){var g=window.__starfallGame,cs=g.cs,mgr=g.enemyMgr;return JSON.stringify({t:cs.combatTime.toFixed(0),w:cs.waveIndex,e:mgr.enemies.length,hp:cs.playerHp.toFixed(0),k:cs.killCount,l:cs.level,bk:cs.bossKills,al:cs.battleAlloy})})()",
        timeout=2)
    
    try:
        d = json.loads(gs)
        if step % 5 == 0:
            print(f"{d['t']:>5} {d['w']:>4} {d['e']:>7} {d['hp']:>6} {d['k']:>5} {d['l']:>5}")
        results.append(d)
        
        if int(d['hp']) <= 0:
            print(f"DEATH at T={d['t']}s, wave={d['w']}")
            break
    except:
        pass

# Summary
if results:
    last = results[-1]
    print(f"\n=== SUMMARY ===")
    print(f"Duration: {last.get('t','?')}s")
    print(f"Final wave: {last.get('w','?')}")
    print(f"Kills: {last.get('k','?')}")
    print(f"Level: {last.get('l','?')}")
    print(f"Boss kills: {last.get('bk','?')}")
    print(f"Alloy: {last.get('al','?')}")

print("\nDone!")

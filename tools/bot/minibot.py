#!/usr/bin/env python3
"""
Minimal bot test: start battle with weapon, drive game loop, collect data.
"""

import sys, time, json
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# 1. Start fresh from menu
cdp.evaluate("window.__starfallStartBattle()", timeout=3)
time.sleep(1)

# 2. Check if battle started
gs = cdp.evaluate(
    "(function(){var s=window.__starfallCombatState;return s?JSON.stringify(s):'null'})()", 
    timeout=2)
print(f"Phase: {json.loads(gs).get('phase') if gs != 'null' else 'null'}")

if 'combat' not in str(gs):
    # Force start with weapon
    cdp.evaluate("""
    (function(){
        var g = window.__starfallGame;
        var shop = g.shop;
        shop.ownedEquipment.add('storm-rifle');
        shop.equippedEquipment = ['storm-rifle'];
        g.beginBattle(false);
    })()
    """, timeout=3)
    time.sleep(1)

# 3. Start wave 1
cdp.evaluate("""
(function(){
    var g = window.__starfallGame, cs = g.cs, mgr = g.enemyMgr;
    cs.waveIndex = 1;
    cs.waveElapsed = 0;
    cs.waveSpawnTimer = 0;
    cs.endlessCycle = 1;
    mgr.currentWaveSpecs = mgr.getWaveEnemySpecs(1);
    mgr.spawnCurrentWaveBatch();
})()
""", timeout=3)

# 4. Game loop: tick and report
print(f"{'T(s)':>5} {'Wave':>4} {'Enemies':>7} {'HP':>6} {'Kills':>5} {'Level':>5}")
for step in range(30):
    for _ in range(60):
        cdp.evaluate("window.__starfallTick(1/60)", timeout=0.3)
    
    gs = cdp.evaluate(
        "(function(){var g=window.__starfallGame,cs=g.cs,mgr=g.enemyMgr;return JSON.stringify({t:cs.combatTime.toFixed(0),w:cs.waveIndex,e:mgr.enemies.length,hp:cs.playerHp.toFixed(0),k:cs.killCount,l:cs.level})})()",
        timeout=2)
    
    try:
        d = json.loads(gs)
        print(f"{d['t']:>5} {d['w']:>4} {d['e']:>7} {d['hp']:>6} {d['k']:>5} {d['l']:>5}")
        if int(d['hp']) <= 0:
            print("PLAYER DIED!")
            break
        if int(d['e']) == 0 and step > 2:
            # Next wave
            wave_num = int(d['w']) + 1
            if wave_num <= 10:
                cdp.evaluate("""
                (function(){
                    var g=window.__starfallGame,cs=g.cs,mgr=g.enemyMgr;
                    cs.waveIndex=""" + str(wave_num) + """;
                    mgr.currentWaveSpecs = mgr.getWaveEnemySpecs(cs.waveIndex);
                    mgr.spawnCurrentWaveBatch();
                })()
                """, timeout=2)
    except:
        print(f"  {step+1}s: {gs}")

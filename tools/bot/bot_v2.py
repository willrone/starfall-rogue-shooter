#!/usr/bin/env python3
"""Bot test v2: CDP drives wave automatically."""

import sys, json, time
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# Start battle with equipment
cdp.evaluate("""
(function(){
    var g = window.__starfallGame, shop = g.shop;
    shop.ownedEquipment.add('storm-rifle');
    shop.equippedEquipment = ['storm-rifle'];
    g.beginBattle(false);
})()
""", timeout=3)
time.sleep(1)

auto_wave = """
(function(){
    var g = window.__starfallGame;
    if(!g || g.cs.phase !== "combat") return;
    if(g.cs.waveIndex <= 0 && g.cs.combatTime > 3) {
        g.cs.waveIndex = 1;
        g.cs.waveElapsed = 0;
        g.cs.waveSpawnTimer = 0;
        g.cs.endlessCycle = 1;
        g.enemyMgr.currentWaveSpecs = g.enemyMgr.getWaveEnemySpecs(1);
        g.enemyMgr.spawnCurrentWaveBatch();
    }
})()
"""

fmt = "{:>5} {:>4} {:>7} {:>6} {:>5}"
print(fmt.format("T(s)", "Wave", "Enemies", "HP", "Kills"))

for step in range(180):
    for _ in range(30):
        cdp.evaluate("window.__starfallTick(1/60)", timeout=0.3)
        cdp.evaluate(auto_wave, timeout=0.2)
    
    gs = cdp.evaluate(
        "(function(){var g=window.__starfallGame,cs=g.cs,mgr=g.enemyMgr;return JSON.stringify({t:cs.combatTime.toFixed(0),w:cs.waveIndex,e:mgr.enemies.length,hp:cs.playerHp.toFixed(0),k:cs.killCount,l:cs.level})})()",
        timeout=2)
    
    try:
        d = json.loads(gs)
        wi = int(d['w'])
        ki = int(d['k'])
        if step % 5 == 0 or ki > 0 or wi > 0:
            print(fmt.format(d['t'], d['w'], d['e'], d['hp'], d['k']))
        if int(d['hp']) <= 0:
            print(f"DEATH at T={d['t']}s")
            break
    except:
        pass

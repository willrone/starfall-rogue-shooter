#!/usr/bin/env python3
"""Monkey-patch findNearestEnemy and verify it works."""

import sys, time
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# Monkey-patch findNearestEnemy in the live game
patch_js = """
(function(){
    var mgr = window.__starfallGame.enemyMgr;
    mgr.findNearestEnemy = function(range) {
        var best = null;
        var bestDist = range * range;
        for(var i = 0; i < this.enemies.length; i++) {
            var e = this.enemies[i];
            if(!this.enemySet.has(e)) continue;
            var ex = e._botX != null ? e._botX : (e.node.position.x != null ? e.node.position.x : 0);
            var ey = e._botY != null ? e._botY : (e.node.position.y != null ? e.node.position.y : 0);
            var d = (0-ex)*(0-ex)+(0-ey)*(0-ey);
            if(d < bestDist) { best = e; bestDist = d; }
        }
        return best;
    };
    return 'patched';
})()
"""
cdp.evaluate(patch_js, timeout=3)
print("Patched findNearestEnemy")

# Verify
test_js = "(function(){var mgr=window.__starfallGame.enemyMgr;var r=mgr.findNearestEnemy(760);return r?'found id='+r.id:'null';})()"
result = cdp.evaluate(test_js, timeout=3)
print(f"Test: {result}")

# Now run the bot loop
print("\n=== Bot loop ===")
auto_wave = """
(function(){
    var g = window.__starfallGame;
    if(!g || g.cs.phase !== "combat") return;
    var cs = g.cs;
    if(cs.waveIndex <= 0 && cs.combatTime > 3) {
        cs.waveIndex = 1; cs.waveElapsed = 0; cs.waveSpawnTimer = 0; cs.endlessCycle = 1;
    }
    if(cs.waveIndex === 1 && g.enemyMgr.enemies.length < 5) {
        var mgr = g.enemyMgr;
        var spec = {"id":"mite","name":"碎壳虫","family":"mite","artId":"mite","hp":18,"speed":126,"damage":4,"radius":13,"xp":2,"alloyChance":0.05,"color":"#9BE564","accent":"#31572C","spawnAfter":0,"weight":7};
        mgr.createEnemy(spec, 300, -200, false, false);
        mgr.createEnemy(spec, 350, -150, false, false);
        mgr.createEnemy(spec, 280, -180, false, false);
    }
})()
"""

fmt = "{:>5} {:>4} {:>7} {:>6} {:>5}"
import json
print(fmt.format("T(s)", "Wave", "Enemies", "HP", "Kills"))

for step in range(120):
    for _ in range(30):
        cdp.evaluate("window.__starfallTick(1/60)", timeout=0.3)
        cdp.evaluate(auto_wave, timeout=0.3)
    
    gs = cdp.evaluate(
        "(function(){var g=window.__starfallGame,cs=g.cs,mgr=g.enemyMgr;return JSON.stringify({t:cs.combatTime.toFixed(0),w:cs.waveIndex,e:mgr.enemies.length,hp:cs.playerHp.toFixed(0),k:cs.killCount,l:cs.level})})()",
        timeout=2)
    try:
        d = json.loads(gs)
        if step % 3 == 0 or int(d['k']) > 0 or int(d['w']) > 1:
            print(fmt.format(d['t'], d['w'], d['e'], d['hp'], d['k']))
        if int(d['hp']) <= 0:
            print(f"DEATH at T={d['t']}s!")
            break
    except:
        pass

#!/usr/bin/env python3
"""Bot v3: works! Creates enemies manually, drives game."""

import sys, json, time
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# Start battle
cdp.evaluate("""
(function(){
    var g = window.__starfallGame, shop = g.shop;
    shop.ownedEquipment.add('storm-rifle');
    shop.equippedEquipment = ['storm-rifle'];
    g.beginBattle(false);
})()
""", timeout=3)
time.sleep(1)

# Enemy specs (from game data)
enemy_specs_js = [
    '{"id":"mite","name":"碎壳虫","family":"mite","artId":"mite","hp":18,"speed":126,"damage":4,"radius":13,"xp":2,"alloyChance":0.05,"color":"#9BE564","accent":"#31572C","spawnAfter":0,"weight":7}',
    '{"id":"runner","name":"疾行体","family":"runner","artId":"runner","hp":24,"speed":150,"damage":6,"radius":14,"xp":3,"alloyChance":0.08,"color":"#43AA8B","accent":"#2D6A4F","spawnAfter":10,"weight":4}',
    '{"id":"brute","name":"重甲块","family":"brute","artId":"brute","hp":88,"speed":72,"damage":10,"radius":26,"xp":8,"alloyChance":0.22,"color":"#577590","accent":"#1E293B","spawnAfter":18,"weight":3}',
    '{"id":"splitter","name":"裂变囊","family":"splitter","artId":"splitter","hp":54,"speed":90,"damage":7,"radius":20,"xp":6,"alloyChance":0.16,"color":"#F9C74F","accent":"#92400E","spawnAfter":28,"weight":3}',
    '{"id":"warden","name":"磁暴卫士","family":"warden","artId":"warden","hp":160,"speed":60,"damage":15,"radius":32,"xp":13,"alloyChance":0.35,"color":"#B5179E","accent":"#4C1D95","spawnAfter":38,"weight":2}',
]

def wave1_auto():
    spec0 = enemy_specs_js[0]
    return """
    (function(){
        var g = window.__starfallGame;
        if(!g || g.cs.phase !== "combat") return;
        if(g.cs.waveIndex <= 0 && g.cs.combatTime > 3) {
            g.cs.waveIndex = 1;
            g.cs.waveElapsed = 0;
            g.cs.waveSpawnTimer = 0;
            g.cs.endlessCycle = 1;
            var mgr = g.enemyMgr;
            var spec = """ + spec0 + """;
            mgr.createEnemy(spec, 300, -200, false, false);
            mgr.createEnemy(spec, 350, -150, false, false);
            mgr.createEnemy(spec, 280, -180, false, false);
        }
    })()
    """

fmt = "{:>5} {:>4} {:>7} {:>6} {:>5}"
print(fmt.format("T(s)", "Wave", "Enemies", "HP", "Kills"))

for step in range(180):
    for _ in range(30):
        cdp.evaluate("window.__starfallTick(1/60)", timeout=0.3)
        cdp.evaluate(wave1_auto(), timeout=0.3)
    
    gs = cdp.evaluate(
        "(function(){var g=window.__starfallGame,cs=g.cs,mgr=g.enemyMgr;return JSON.stringify({t:cs.combatTime.toFixed(0),w:cs.waveIndex,e:mgr.enemies.length,hp:cs.playerHp.toFixed(0),k:cs.killCount,l:cs.level})})()",
        timeout=2)
    
    try:
        d = json.loads(gs)
        if step % 5 == 0 or int(d['k']) > 0:
            print(fmt.format(d['t'], d['w'], d['e'], d['hp'], d['k']))
        if step == 0:
            print(f"  (first tick: {gs[:80]})")
        if int(d['hp']) <= 0:
            print(f"DEATH at T={d['t']}s!")
            break
    except:
        pass

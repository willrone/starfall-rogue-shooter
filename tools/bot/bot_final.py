#!/usr/bin/env python3
"""Final bot test: position sync + findNearestEnemy patch + full loop."""

import sys, time, json
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')
time.sleep(3)

cdp.evaluate('window.__starfallBotMode = true', timeout=2)

# Start battle
cdp.evaluate(
    "(function(){var g=window.__starfallGame,s=g.shop;s.ownedEquipment.add('storm-rifle');s.equippedEquipment=['storm-rifle'];g.beginBattle(false);})()",
    timeout=3)
time.sleep(2)

# Wait for wave auto-start
time.sleep(4)

# Check state
gs = cdp.evaluate("(function(){var s=window.__starfallCombatState;return s?JSON.stringify({t:s.time,w:s.wave,e:s.enemyCount}):'null'})()", timeout=2)
print(f'State: {gs}')

# Spawn if needed
cdp.evaluate(
    "(function(){var g=window.__starfallGame,cs=g.cs;if(cs.waveIndex<=0&&cs.combatTime>3){cs.waveIndex=1;cs.waveElapsed=0;cs.waveSpawnTimer=0;cs.endlessCycle=1;}var mgr=g.enemyMgr;if(mgr.enemies.length<3){var spec={id:'mite',name:'mite',family:'mite',artId:'mite',hp:18,speed:126,damage:4,radius:13,xp:2,alloyChance:0.05,color:'#9BE564',accent:'#31572C',spawnAfter:0,weight:7};mgr.createEnemy(spec,200,-100,false,false);mgr.createEnemy(spec,250,-80,false,false);mgr.createEnemy(spec,220,-120,false,false);}})()",
    timeout=3)
time.sleep(1)

# Patch findNearestEnemy
cdp.evaluate(
    "(function(){var mgr=window.__starfallGame.enemyMgr;mgr.findNearestEnemy=function(range){var best=null,bestDist=range*range;for(var i=0;i<this.enemies.length;i++){var e=this.enemies[i];if(!this.enemySet.has(e))continue;var ex=e._botX!=null?e._botX:(e.node.position.x!=null?e.node.position.x:0);var ey=e._botY!=null?e._botY:(e.node.position.y!=null?e.node.position.y:0);var d=(0-ex)*(0-ex)+(0-ey)*(0-ey);if(d<bestDist){best=e;bestDist=d;}}return best;};})()",
    timeout=2)

# Tick loop
print(f"{'T':>5} {'Kills':>5} {'Wave':>4} {'Enemy':>6}")
for tick in range(30):
    for _ in range(30):
        cdp.evaluate('window.__starfallTick(1/60)', timeout=0.3)
    gs = cdp.evaluate(
        "(function(){var s=window.__starfallCombatState;return s?JSON.stringify({t:s.time.toFixed(0),w:s.wave,k:s.kills,e:s.enemyCount}):'null'})()",
        timeout=2)
    try:
        d = json.loads(gs)
        print(f"{d['t']:>5} {d['k']:>5} {d['w']:>4} {d['e']:>6}")
        if int(d['k']) > 0:
            print("*** KILLS HAPPENED! BOT WORKS! ***")
            break
    except:
        pass

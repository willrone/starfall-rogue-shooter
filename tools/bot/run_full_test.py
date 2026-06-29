#!/usr/bin/env python3
"""
Full bot test via CDP using __starfall hooks.
Starts battle, manually starts wave 1, runs for a while.
"""

import sys, time, json
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

gs_raw = cdp.evaluate("(function(){if(window.__starfallCombatState)return JSON.stringify(window.__starfallCombatState);return'{}'})()", timeout=3)
print(f"Initial: {gs_raw[:100]}")

# Start
cdp.evaluate("window.__starfallStartBattle()", timeout=3)
time.sleep(2)

# Init wave
cdp.evaluate("""
(function(){
  try {
    var g = window.__starfallGame;
    g.cs.waveIndex = 1;
    g.cs.waveElapsed = 0;
    g.cs.waveSpawnTimer = 0;
    g.cs.endlessCycle = 1;
    g.enemyMgr.currentWaveSpecs = g.enemyMgr.getWaveEnemySpecs(1);
    g.enemyMgr.spawnCurrentWaveBatch();
    return 'ok';
  } catch(e) { return 'err: ' + e.message; }
})()
""", timeout=3)

# Step
for step in range(20):
    for _ in range(60):
        cdp.evaluate("window.__starfallTick(1/60)", timeout=0.5)
    
    state = cdp.evaluate("""
    (function(){
      try {
        var g = window.__starfallGame, cs = g.cs, mgr = g.enemyMgr;
        return JSON.stringify({t: cs.combatTime.toFixed(1), w: cs.waveIndex, e: mgr.enemies.length, hp: cs.playerHp.toFixed(0), k: cs.killCount, l: cs.level});
      } catch(e) { return 'err'; }
    })()
    """, timeout=2)
    print(f"T+{step+1}s: {state}")
    
    # Check death
    if 'hp' in str(state) and '"hp":"0"' in str(state):
        print("DEATH!")
        break
    
    # Wave completion: enemies=0 -> next wave
    if step > 0 and step % 5 == 0:
        cdp.evaluate("""
        (function(){
          try {
            var g = window.__starfallGame, mgr = g.enemyMgr;
            if(mgr.enemies.length === 0 && g.cs.waveIndex < 10) {
              g.cs.waveIndex += 1;
              mgr.currentWaveSpecs = mgr.getWaveEnemySpecs(g.cs.waveIndex);
              mgr.spawnCurrentWaveBatch();
            }
          } catch(e) {}
        })()
        """, timeout=2)

print("\nDone!")

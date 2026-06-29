#!/usr/bin/env python3
"""Debug: test findNearestEnemy inline."""

import sys
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# Test findNearestEnemy
result = cdp.evaluate(
    "(function(){try{var g=window.__starfallGame;var mgr=g.enemyMgr;var r=mgr.findNearestEnemy(760);if(r)return 'found id='+r.id;var msg='';for(var i=0;i<mgr.enemies.length;i++){var e=mgr.enemies[i];msg+=i+':set='+mgr.enemySet.has(e)+' bx='+e._botX+' ';}return 'NOT FOUND: '+msg;}catch(e){return 'err: '+e.message;}})()",
    timeout=3)
print(f"findNearestEnemy: {result}")

# Test direct iteration
result2 = cdp.evaluate(
    "(function(){try{var mgr=window.__starfallGame.enemyMgr;for(var i=0;i<mgr.enemies.length;i++){var e=mgr.enemies[i];var ex=e._botX!=null?e._botX:0;var ey=e._botY!=null?e._botY:0;var d=(0-ex)*(0-ex)+(0-ey)*(0-ey);if(d<577600)return 'found via loop id='+e.id+' d='+d;}return 'none found';}catch(e){return 'err: '+e.message;}})()",
    timeout=3)
print(f"Direct loop: {result2}")

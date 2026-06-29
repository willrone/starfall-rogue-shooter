#!/usr/bin/env python3
"""Debug: try to fix node position in Cocos build."""

import sys, json
sys.path.insert(0, '/Users/ronghui/Documents/game_dev_cocos/tools/bot')
from cdp_client import CDPClient

cdp = CDPClient()
cdp.connect(target_url_filter='localhost:7457')

# 1) Try setting position via the enemy after creation
result = cdp.evaluate("""
(function(){
    try {
        var g = window.__starfallGame;
        var mgr = g.enemyMgr;
        
        // Create via spec + createEnemy
        var spec = {"id":"mite","name":"mite","family":"mite","artId":"mite",
            "hp":18,"speed":126,"damage":4,"radius":13,"xp":2,"alloyChance":0.05,
            "color":"#9BE564","accent":"#31572C","spawnAfter":0,"weight":7};
        mgr.createEnemy(spec, 200, -100, false, false);
        
        var enemy = mgr.enemies[mgr.enemies.length - 1];
        if(!enemy) return "no enemy";
        
        // Read current position
        var pos1 = {x: enemy.node.position.x, y: enemy.node.position.y};
        
        // Try setPosition again
        enemy.node.setPosition(200, -100, 4);
        var pos2 = {x: enemy.node.position.x, y: enemy.node.position.y};
        
        // Try setting _lpos (local position)
        if(enemy.node._lpos) {
            enemy.node._lpos.x = 200;
            enemy.node._lpos.y = -100;
        }
        var pos3 = {x: enemy.node.position.x, y: enemy.node.position.y};
        
        // Check if node has a UITransform
        var uiTransform = enemy.node.getComponent('UITransform');
        
        return JSON.stringify({
            pos1: pos1, pos2: pos2, pos3: pos3,
            hasUITransform: !!uiTransform,
            hp: enemy.hp,
            maxHp: enemy.maxHp
        });
    } catch(e) { return "err: " + e.message; }
})()
""", timeout=3)
print(f"Result: {result}")

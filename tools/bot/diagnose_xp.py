#!/usr/bin/env python3
"""
Quick diagnostic: check bot XP pickup behavior.
Uses the same infrastructure as run_balance_pipeline.py.
"""
import json, sys

sys.path.insert(0, 'tools/bot')
from run_balance_pipeline import (
    CDP_PORT, HTTP_PORT,
    stage_start_server, stage_start_chrome, stage_wait_game_ready,
    _load_cdp, evaluate, read_state, handle_modal,
    tick_game, start_battle, select_weapon, set_seed,
    kill_pattern,
)

def run_diagnostic():
    # ── Setup ──
    print("Setting up...")
    if not stage_start_server():
        return False
    if not stage_start_chrome():
        return False
    
    CDPClient = _load_cdp()
    cdp = CDPClient("localhost", CDP_PORT)
    if not cdp.connect(target_url_filter=f"localhost:{HTTP_PORT}"):
        return False
    if not stage_wait_game_ready(cdp):
        return False
    
    # ── Run ──
    set_seed(cdp, 42)
    select_weapon(cdp, "storm-rifle")
    start_battle(cdp)
    
    print("\n=== Bot XP 拾取诊断 (60秒) ===")
    print(f"{'T':>4} {'Kills':>6} {'XP':>8} {'NextXP':>8} {'Level':>6} {'XPGround':>10} {'Pickups':>8} {'BotPos':>14} {'State':>10}")
    print("-" * 80)
    
    for sec in range(60):
        tick_game(cdp, 60)
        state = read_state(cdp)
        handle_modal(cdp, state)
        
        # Get detailed pickup info
        detail = evaluate(cdp, """
            (function(){
                var g = window.__starfallGame;
                var pickups = (g.pickupMgr.pickups || []);
                var xpTotal = 0, xpCount = 0;
                for (var i = 0; i < pickups.length; i++){
                    if (pickups[i].type === 'xp') {
                        xpTotal += (pickups[i].amount || 0);
                        xpCount++;
                    }
                }
                var stats = g.getCharacterStats ? g.getCharacterStats() : {};
                return JSON.stringify({
                    xpGround: xpTotal,
                    xpCount: xpCount,
                    pickupRange: stats.pickupRange || 0,
                    pr: g.pickupMgr.getPickupRadius ? g.pickupMgr.getPickupRadius() : 0,
                    botState: g._botState || '?',
                    botPickupTimer: (g._botPickupChaseTimer || 0).toFixed(1),
                    px: g.cs.playerX,
                    py: g.cs.playerY
                });
            })()
        """, timeout=3)
        
        if sec % 5 == 0:
            d = json.loads(detail) if isinstance(detail, str) else {}
            print(f"{sec:4.0f} {state.get('kills',0):6} {state.get('xp',0):8.1f} {state.get('xpNext',0):8.1f} {state.get('level',0):6} {d.get('xpGround',0):10.1f} {d.get('xpCount',0):8} ({d.get('px',0):.0f},{d.get('py',0):.0f}) {d.get('botState','?'):>10} pickupT={d.get('botPickupTimer','?')}")
    
    # ── Summary ──
    state = read_state(cdp)
    print(f"\n=== 60秒结束 ===")
    print(f"Kills: {state.get('kills', 0)}")
    print(f"Level: {state.get('level', 0)}")
    print(f"XP: {state.get('xp', 0):.1f} / {state.get('xpNext', 0):.1f}")
    
    # Kill cleanup
    try: cdp.close()
    except Exception: pass
    kill_pattern('http.server 7457', 'http.server 7457')
    kill_pattern('--remote-debugging-port=9222', 'Chrome CDP :9222')
    
    return True

if __name__ == "__main__":
    run_diagnostic()
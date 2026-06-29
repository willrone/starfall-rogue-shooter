#!/usr/bin/env python3
"""bot_v6.py — CDP-driven Starfall Survivor balance bot (Google Chrome).

Connects to Chrome via CDP (port 9222 with --remote-debugging-port=9222
--remote-allow-origins=*). Reads live game state through window.__starfallGame
and drives a single storm-rifle build all the way to death/extraction.
Collects wave-cleared / boss-defeated / clear-time per run.
"""

import json, math, random, time
from dataclasses import dataclass, field, asdict
from typing import List, Optional

sys_path_added = False
def _ensure_path():
    global sys_path_added
    if not sys_path_added:
        import sys
        sys.path.insert(0, 'tools/bot')
        sys_path_added = True

@dataclass
class RunResult:
    weapon: str = "storm-rifle"
    unlockedWave: int = 0
    clearTime: float = 0.0
    deaths: int = 0
    extractions: int = 0
    bossDefeated: bool = False
    kills: int = 0
    level: int = 1
    totalAlloy: int = 0
    sampleType: str = "progression"
    fallbackReason: str = ""


def _load_cdp_client():
    _ensure_path()
    from cdp_client import CDPClient
    return CDPClient


def _state_snapshot(cdp) -> Optional[dict]:
    """Read live game state via JS eval."""
    expr = """(function(){
        var g = window.__starfallGame;
        if (!g) return null;
        var s = {
            phase: g.cs.phase,
            hp: g.cs.playerHp, maxHp: g.cs.playerMaxHp,
            x: g.cs.playerX, y: g.cs.playerY,
            wave: g.cs.waveIndex, cycle: g.cs.endlessCycle,
            kills: g.cs.killCount, level: g.cs.level,
            xp: g.cs.xp, xpNext: g.cs.xpToNext,
            alloy: g.cs.battleAlloy,
            combatTime: g.cs.combatTime,
            shield: g.cs.playerShield || 0,
        };
        try {
            var enemies = (g.enemyMgr.enemies || []).map(function(e){
                var p = g.enemyMgr.getEnemyPosition(e);
                return {x:p.x, y:p.y, hp:e.hp, maxHp:e.maxHp,
                        damage:e.damage, radius:e.radius||14,
                        speed:e.speed, boss:!!e.boss,
                        elite:!!(e.variantId)};
            }).sort(function(a,b){
                var da=(a.x-s.x)*(a.x-s.x)+(a.y-s.y)*(a.y-s.y);
                var db=(b.x-s.x)*(b.x-s.x)+(b.y-s.y)*(b.y-s.y);
                return da-db;
            });
            s.enemies = enemies;
            var enemiesAlive = g.enemyMgr.enemies.filter(function(e){return e.hp > 0;}).length;
            s.enemiesAlive = enemiesAlive;
        } catch(ex) { s.enemies = []; s.enemiesAlive = 0; }
        return s;
    })()"""
    try:
        raw = cdp.evaluate(expr, timeout=5)
        if isinstance(raw, dict):
            return raw
        return None
    except Exception:
        return None


def _start_battle(cdp):
    """From hangar/menu: press space to start, then confirm."""
    cdp.press_key(' ')
    time.sleep(2.5)
    cdp.press_key('enter')
    time.sleep(1.5)


def _pickup_nearby(cdp, state, pickup_range=120):
    """Move towards nearest XP/alloy pickup."""
    px, py = state['x'], state['y']
    pickups_expr = """(function(){
        var g = window.__starfallGame;
        if (!g || !g.pickupMgr) return [];
        return (g.pickupMgr.pickups || []).map(function(p){
            return {x:p.x, y:p.y, type:p.type||'unknown', value:p.value||0};
        }).slice(0,20);
    })()"""
    pickups = cdp.evaluate(pickups_expr, timeout=3) or []
    if not pickups:
        return False
    pickups.sort(key=lambda p: math.hypot(p['x']-px, p['y']-py))
    target = pickups[0]
    d = _move_towards(cdp, target['x'], target['y'], px, py)
    return d is not None


def _move_towards(cdp, tx, ty, px, py, bias_wave=False):
    dx = tx - px
    dy = ty - py
    dist = math.sqrt(dx*dx + dy*dy)
    if dist < 15:
        return None
    ndx, ndy = dx / dist, dy / dist
    if bias_wave:
        # When boss wave, stay mobile: prefer horizontal movement
        if abs(ndx) < 0.35:
            ndx = 0.5 if dx > 0 else -0.5
            ndy = 0
    if abs(ndx) > abs(ndy):
        return 'right' if ndx > 0 else 'left'
    else:
        return 'up' if ndy < 0 else 'down'


def _attack_move(cdp, state):
    """Move towards nearest enemy, prioritizing boss on wave >= 9."""
    enemies = state.get('enemies', [])
    if not enemies:
        return None
    px, py = state['x'], state['y']
    wave = state.get('wave', 0)
    boss_enemies = [e for e in enemies if e.get('boss')]
    regular_enemies = [e for e in enemies if not e.get('boss')]
    if wave >= 9 and boss_enemies:
        target = boss_enemies[0]
    elif regular_enemies:
        target = regular_enemies[0]
    else:
        target = enemies[0]
    return _move_towards(cdp, target['x'], target['y'], px, py, bias_wave=(wave >= 9))


class CDPBotV6:
    """CDP-driven bot: reads state, presses WASD, loops runs."""

    def __init__(self, host='localhost', port=9222, target_filter=None):
        Cls = _load_cdp_client()
        self.cdp = Cls(host=host, port=port)
        self.target_filter = target_filter
        self.connected = False

    def connect(self):
        self.connected = self.cdp.connect(self.target_filter)
        if self.connected:
            self.cdp._send_sync('Runtime.enable', timeout=3)
            self.cdp._send_sync('Input.enable', timeout=3)
        return self.connected

    def wait_for_game(self, timeout=30):
        """Wait until window.__starfallGame is defined."""
        deadline = time.time() + timeout
        last = ""
        while time.time() < deadline:
            try:
                phase = self.cdp.evaluate("""(function(){var g=window.__starfallGame;return g?g.cs.phase:'?';})()""", timeout=3)
                if isinstance(phase, str) and phase != '?':
                    return phase
                last = str(phase)
            except Exception:
                pass
            time.sleep(1)
        raise TimeoutError(f"Game not ready after {timeout}s (last={last})")

    def run_once(self, max_time=180, max_wave=12) -> RunResult:
        """Run a single battle from start to death/extraction."""
        res = RunResult()
        start = time.time()
        last_pickup_time = 0
        last_level_idx = 0

        while True:
            elapsed = time.time() - start
            if elapsed > max_time:
                res.clearTime = elapsed
                res.fallbackReason = "timeout"
                return res

            state = _state_snapshot(self.cdp)
            if not state:
                time.sleep(0.5)
                continue

            phase = state['phase']
            wave = state.get('wave', 0)
            hp = state.get('hp', 0)
            res.unlockedWave = max(res.unlockedWave, wave)
            res.kills = max(res.kills, state.get('kills', 0))
            res.level = max(res.level, state.get('level', 1))
            res.totalAlloy = max(res.totalAlloy, state.get('alloy', 0))

            # Death check
            if phase == 'dead' or hp <= 0:
                res.clearTime = elapsed
                res.deaths = 1
                return res

            # Extraction check
            if phase == 'settlement':
                res.clearTime = elapsed
                return res

            # Phase: hangar — start battle
            if phase == 'hangar':
                _start_battle(self.cdp)
                time.sleep(2)
                continue

            # Phase: combat — main loop
            if phase == 'combat':
                # Wave 1 starts at waveIndex=1; Boss is wave 10 (endlessCycle >= 1)
                if wave >= 9:
                    # Check if boss present
                    boss_present = any(e.get('boss') for e in state.get('enemies', []))
                    if boss_present:
                        # Aggressive boss approach
                        direction = _attack_move(self.cdp, state)
                        if direction:
                            direction_key = _dir_to_key(direction)
                            if direction_key:
                                self.cdp.press_key(direction_key[0])
                                time.sleep(0.04)
                        # Try extraction after 20s on boss wave if low HP
                        if hp < state.get('maxHp', 999) * 0.25 and elapsed > 20:
                            self.cdp.press_key('E')
                            time.sleep(1)
                            continue
                    else:
                        # Post-boss: search for pickups
                        direction = _attack_move(self.cdp, state)
                        if direction:
                            direction_key = _dir_to_key(direction)
                            if direction_key:
                                self.cdp.press_key(direction_key[0])
                                time.sleep(0.04)
                else:
                    # Normal waves: move to nearest enemy
                    direction = _attack_move(self.cdp, state)
                    if direction:
                        direction_key = _dir_to_key(direction)
                        if direction_key:
                            self.cdp.press_key(direction_key[0])
                            time.sleep(0.04)

                # Pickup collection (throttled)
                if elapsed - last_pickup_time > 2.0:
                    if _pickup_nearby(self.cdp, state):
                        last_pickup_time = elapsed

                time.sleep(0.12)
                continue

            # Phase: level_up — auto-pick first option
            if phase == 'level_up':
                # Cycle through level choices; pick the first one
                if last_level_idx == 0:
                    self.cdp.press_key('1')
                    last_level_idx = 1
                time.sleep(0.5)
                continue

            # Phase: shop — buy first affordable item
            if phase == 'shop':
                # Close shop (no purchase for bot)
                self.cdp.press_key(' ')
                time.sleep(0.5)
                continue

            # Other phases — brief wait
            time.sleep(0.3)

        # Should not reach here
        res.clearTime = time.time() - start
        return res

    def close(self):
        if self.cdp:
            self.cdp.close()


def _dir_to_key(d):
    mapping = {
        'up': 'w', 'down': 's', 'left': 'a', 'right': 'd',
        'up-left': 'w', 'up-right': 'w', 'down-left': 's', 'down-right': 'd',
    }
    return mapping.get(d)


def run_balance_cdp(host='localhost', port=9222, target_filter=None,
                    weapon='storm-rifle', runs=5, max_time=180):
    """Main balance entry: run N battles, collect aggregated data."""
    bot = CDPBotV6(host=host, port=port, target_filter=target_filter)
    if not bot.connect():
        return {"ok": False, "error": "CDP connection failed"}

    try:
        phase = bot.wait_for_game(timeout=30)
        print(f"[CDP] Game ready, phase={phase}")
    except TimeoutError as e:
        return {"ok": False, "error": str(e)}

    results: List[RunResult] = []
    for i in range(runs):
        print(f"[CDP] Run {i+1}/{runs} starting...")
        r = bot.run_once(max_time=max_time)
        results.append(r)
        print(f"[CDP] Run {i+1}: wave={r.unlockedWave}, "
              f"time={r.clearTime:.1f}s, boss_defeated={r.bossDefeated}, "
              f"deaths={r.deaths}, extractions={r.extractions}")

        # Return to hangar via click
        if r.extractions > 0:
            # Click main menu after extraction
            self.cdp.press_key(' ')
            time.sleep(1)

        # Brief cooldown before next run
        time.sleep(2)

    # Aggregate
    agg = _aggregate(results, weapon=weapon)
    return agg


def _aggregate(results: List[RunResult], weapon: str = "storm-rifle") -> dict:
    waves = [r.unlockedWave for r in results]
    times = [r.clearTime for r in results]
    boss_rate = sum(1 for r in results if r.bossDefeated) / max(1, len(results))
    p50_wave = sorted(waves)[len(waves)//2] if waves else 0
    avg_time = sum(times)/max(1, len(times))

    return {
        "ok": True,
        "weapon": weapon,
        "runs": len(results),
        "p50Wave": p50_wave,
        "p90Wave": max(waves) if waves else 0,
        "avgTimeSec": round(avg_time, 1),
        "bossDefeatRate": round(boss_rate, 3),
        "engagementSum": {
            r.unlockedWave: asdict(r) for r in results
        },
        "targetSample": {
            "storm-rifle": {"p50Wave": "5-6", "p90Wave": 7,
                            "bossDefeatRate": 0.0, "stage": "beginner"},
            "nova-shotgun": {"p50Wave": "8-9", "p90Wave": 10,
                             "bossDefeatRate": 0.1, "stage": "mid"},
            "meteor-launcher": {"p50Wave": 10, "p90Wave": 10,
                                "bossDefeatRate": 0.4, "stage": "strong"},
            "gravity-hammer": {"p50Wave": 11, "p90Wave": 12,
                               "bossDefeatRate": 0.65, "stage": "top"},
        }
    }


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--host', default='localhost')
    p.add_argument('--port', type=int, default=9222)
    p.add_argument('--target-filter', default=None)
    p.add_argument('--weapon', default='storm-rifle')
    p.add_argument('--runs', type=int, default=5)
    p.add_argument('--max-seconds', type=int, default=180)
    args = p.parse_args()

    result = run_balance_cdp(
        host=args.host, port=args.port,
        target_filter=args.target_filter,
        weapon=args.weapon, runs=args.runs,
        max_time=args.max_seconds
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))

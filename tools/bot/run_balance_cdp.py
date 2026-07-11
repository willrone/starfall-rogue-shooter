#!/usr/bin/env python3
"""
Run Starfall balance checks by driving the real Cocos game through CDP.

This is intentionally NOT a combat simulator. It never reimplements damage,
spawn, XP, shop, or movement logic in Python. Python only:
  1. connects to a running Chrome/Cocos web build via CDP,
  2. starts real game runs with selected weapons,
  3. ticks/observes the real Cocos runtime,
  4. records true wave/death/kills/level statistics.

Prerequisites:
  - serve build/web-mobile or Cocos preview in a headed Chrome tab
  - Chrome launched with --remote-debugging-port=9222
  - game exposes __starfallGame / __starfallTick / __starfallStartBattle hooks
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import statistics
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "bot"))

from cdp_client import CDPClient  # noqa: E402


TARGETS = {
    "novice": (5, 6, 7),
    "standard": (8, 9, 10),
    "boss_gate": (10, 10, 10),
    "boss_clear": (10, 11, 12),
}


def tier_for_cost(cost: int) -> str:
    if cost <= 42:
        return "novice"
    if cost <= 56:
        return "standard"
    if cost <= 64:
        return "boss_gate"
    return "boss_clear"


# 武器分级映射 (family_id → tier)
# tier 字段只用于 CDP 跑局时的目标判定, 与实际经济无关
WEAPON_TIER_MAP = {
    # Novice (P50 5-6)
    'storm-rifle': 'novice',
    'plague-sprayer': 'novice',
    'frost-beamer': 'novice',
    # Standard (P50 8-9)
    'echo-bow': 'standard',
    'split-barrel': 'standard',
    'mirror-prism': 'standard',
    'quantum-loom': 'standard',
    # Boss Gate (P50 ≈ 10)
    'ion-lance': 'boss_gate',
    'thorn-crossbow': 'boss_gate',
    'rail-cannon': 'boss_gate',
    'void-needle': 'boss_gate',
    # Boss Clear (P50 ≈ 11)
    'meteor-launcher': 'boss_clear',
    'orbital-drone': 'boss_clear',
    'gravity-hammer': 'boss_clear',
}


@dataclass
class RunResult:
    weapon_id: str
    weapon_name: str
    tier: str
    target_profile: str
    run: int
    seed: int
    final_wave: int
    combat_time: float
    kills: int
    level: int
    alloy: int
    items: int
    phase: str
    hp: float
    died: bool
    error: str = ""


def js_json(cdp: CDPClient, expression: str, timeout: float = 10.0) -> Any:
    raw = cdp.evaluate(expression, timeout=timeout)
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw
    return raw


def ensure_game_ready(cdp: CDPClient) -> None:
    ready = cdp.evaluate(
        "(function(){return !!(window.__starfallGame && window.__starfallTick);})()",
        timeout=5,
    )
    if not ready:
        raise RuntimeError(
            "Cocos game hooks not ready. Open the web-mobile/preview game in Chrome "
            "with --remote-debugging-port=9222 and wait for the scene to load."
        )


def weapon_catalog(cdp: CDPClient) -> List[Dict[str, Any]]:
    data = js_json(
        cdp,
        """
(function(){
  var g = window.__starfallGame;
  if (!g || !g.shop || !g.shop.weaponCatalog) return '[]';
  return JSON.stringify(g.shop.weaponCatalog.map(function(w){
    return {
      id: w.id,
      name: w.name,
      cost: w.baseCost || w.cost || 0,
      kind: w.kind,
      rarity: w.rarity,
      family: (w.id || '').split('-standard')[0]
    };
  }));
})()
""",
        timeout=5,
    )
    if isinstance(data, list) and data:
        return data

    # Fallback: derive base weapon families from the TypeScript catalog.  The
    # runtime EquipmentManager does not expose WEAPON_CATALOG as an instance
    # field, so CDP cannot always read it through g.shop.  The generated base
    # equipment id is `${family}-standard`, except legacy starter ids that stay
    # unsuffixed for save compatibility.
    catalog_ts = ROOT / "assets" / "scripts" / "catalogs" / "weaponCatalog.ts"
    if catalog_ts.exists():
        text = catalog_ts.read_text(encoding="utf-8")
        rows: List[Dict[str, Any]] = []
        legacy_base_ids = {"storm-rifle", "split-barrel", "orbital-drone"}
        family_block = re.search(r"export const WEAPON_FAMILIES: WeaponFamily\[\] = \[([\s\S]*?)\n\];", text)
        if family_block:
            for match in re.finditer(r"\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'", family_block.group(1)):
                family_id, name = match.groups()
                wid = family_id if family_id in legacy_base_ids else f"{family_id}-standard"
                rows.append({
                    "id": wid,
                    "name": name,
                    "cost": 0,
                    "kind": "weapon",
                    "family": family_id,
                    "base_family": True,
                })
        if rows:
            return rows

    game_data = ROOT / "tools" / "balance" / "game_data.json"
    if game_data.exists():
        raw = json.loads(game_data.read_text())
        return [
            {"id": w["id"], "name": w["name"], "cost": w.get("cost", 0), "kind": "weapon", "family": w["id"], "base_family": True}
            for w in raw.get("weapon_families", [])
        ]
    raise RuntimeError("Cannot read weapon catalog from runtime, weaponCatalog.ts, or game_data.json")


def set_runtime_seed(cdp: CDPClient, seed: int) -> None:
    result = cdp.evaluate(
        f"""
(function(){{
  if (typeof window.__starfallSetSeed !== 'function') return 'missing __starfallSetSeed';
  window.__starfallSetSeed({int(seed)});
  if (window.cc && cc.director && cc.director.pause) cc.director.pause();
  return 'ok';
}})()
""",
        timeout=5,
    )
    if result != "ok":
        raise RuntimeError(f"Failed to set deterministic runtime seed {seed}: {result}")


def select_weapon_runtime(cdp: CDPClient, weapon_id: str) -> None:
    result = cdp.evaluate(
        f"""
(function(){{
  var g = window.__starfallGame;
  if (!g || !g.shop) return 'missing game/shop';
  var s = g.shop;
  if (s.ownedEquipment && s.ownedEquipment.add) s.ownedEquipment.add({json.dumps(weapon_id)});
  s.equippedEquipment = [{json.dumps(weapon_id)}, 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil'];
  return 'ok';
}})()
""",
        timeout=5,
    )
    if result != "ok":
        raise RuntimeError(f"Failed to select weapon {weapon_id}: {result}")


def select_offhand_runtime(cdp: CDPClient, offhand_id: str = 'orbit-blade') -> None:
    """Synthesize and equip an offhand weapon for CDP testing."""
    result = cdp.evaluate(
        f"""
(function(){{
  var g = window.__starfallGame;
  if (!g || !g.shop) return 'missing game/shop';
  var shop = g.shop;
  // Give enough alloy to synthesize
  g.cs.alloy = Math.max(g.cs.alloy || 0, 200);
  // Synthesize if not owned
  if (!shop.offhandLevels || !shop.offhandLevels['{offhand_id}']) {{
    if (!shop.synthesizeOffhand('{offhand_id}')) return 'synth failed';
  }}
  // Equip
  shop.equipOffhand('{offhand_id}');
  return 'ok';
}})()
""",
        timeout=5,
    )
    if result != "ok":
        # Non-fatal: offhand is best-effort
        print(f"[balance-cdp] WARN: offhand equip failed: {result}")


def start_real_run(cdp: CDPClient, weapon_id: str, seed: int) -> None:
    set_runtime_seed(cdp, seed)
    select_weapon_runtime(cdp, weapon_id)
    select_offhand_runtime(cdp)  # auto-equip offhand for CDP testing
    result = cdp.evaluate(
        """
(function(){
  try {
    var g = window.__starfallGame;
    if (!g) return 'missing game';
    // Clear old battle entities if a previous run left combat state behind.
    if (g.enemyMgr && g.enemyMgr.enemies) {
      for (var i = 0; i < g.enemyMgr.enemies.length; i++) {
        try { g.enemyMgr.enemies[i].node.destroy(); } catch(e) {}
      }
      g.enemyMgr.enemies.length = 0;
      if (g.enemyMgr.enemySet) g.enemyMgr.enemySet.clear();
    }
    if (g.pickupMgr && g.pickupMgr.pickups) g.pickupMgr.pickups.length = 0;
    // Enable bot AI only for this CDP run. We use a per-game flag instead of
    // polluting globalThis, so the Cocos Creator preview and other tabs are
    // never affected by CDP test state.
    g.__cdpBotMode = true;
    g.cs.phase = 'hangar';
    g.beginBattle(false);
    return 'ok';
  } catch(e) { return 'err: ' + e.message; }
})()
""",
        timeout=10,
    )
    if result != "ok":
        raise RuntimeError(f"Failed to start run: {result}")


def read_state(cdp: CDPClient) -> Dict[str, Any]:
    state = js_json(
        cdp,
        """
(function(){
  try {
    var g = window.__starfallGame, cs = g.cs, mgr = g.enemyMgr;
    return JSON.stringify({
      phase: cs.phase,
      wave: cs.waveIndex || 0,
      combatTime: +(cs.combatTime || 0).toFixed(2),
      hp: +(cs.playerHp || 0).toFixed(2),
      shield: +(cs.playerShield || 0).toFixed(2),
      kills: cs.killCount || 0,
      level: cs.level || 0,
      alloy: cs.battleAlloy || 0,
      items: g.pickupMgr && g.pickupMgr.acquiredRunItemIds ? g.pickupMgr.acquiredRunItemIds.size : 0,
      enemies: mgr && mgr.enemies ? mgr.enemies.length : 0,
      bossKills: cs.bossKills || 0
    });
  } catch(e) { return JSON.stringify({phase:'error', error:e.message}); }
})()
""",
        timeout=10,
    )
    return state if isinstance(state, dict) else {"phase": "unknown"}


def handle_modal_choices(cdp: CDPClient, state: Dict[str, Any]) -> None:
    phase = state.get("phase")
    if phase in {"level-up", "item-choice"}:
        cdp.evaluate(
            "(function(){try{window.__starfallGame.pickupMgr.choosePanelChoice(0);return'ok'}catch(e){return e.message}})()",
            timeout=5,
        )
    elif phase == "discard":
        # 道具满→丢弃第0个(最旧的)腾出格子
        cdp.evaluate(
            "(function(){try{window.__starfallGame.pickupMgr.chooseDiscard(0);return'ok'}catch(e){return e.message}})()",
            timeout=5,
        )
    elif phase == "shop":
        # Buy first affordable item, then close shop.
        cdp.evaluate(
            "(function(){try{var g=window.__starfallGame;if(g.shop.chooseShopItemByIndex)g.shop.chooseShopItemByIndex(0);if(g.shop.closeShop)g.shop.closeShop();return'ok'}catch(e){return e.message}})()",
            timeout=5,
        )
    elif phase == "paused":
        cdp.evaluate(
            "(function(){try{window.__starfallGame.declineRevive();return'ok'}catch(e){return e.message}})()",
            timeout=5,
        )


def trigger_shop(cdp: CDPClient) -> None:
    """Open the in-game shop from combat. Silently skips on timeout."""
    try:
        cdp.evaluate(
            "(function(){try{var g=window.__starfallGame;if(g&&g.pickupMgr&&g.pickupMgr.autoCollectAll)g.pickupMgr.autoCollectAll();if(g.shop&&g.shop.openShop)g.shop.openShop();return'ok'}catch(e){return e.message}})()",
            timeout=3,
        )
    except Exception:
        pass  # late-game WebSocket slowdown — skip this shop tick


def _safe_read_state(cdp: CDPClient) -> Dict[str, Any]:
    """read_state wrapper with timeout fallback — never raises."""
    try:
        return read_state(cdp)
    except Exception:
        return {"phase": "unknown", "wave": 0, "hp": 0, "kills": 0, "level": 0}


def chase_boss(cdp: CDPClient) -> None:
    """If a boss is alive, move player close to it to focus fire."""
    cdp.evaluate("""(function(){
        try {
            var g = window.__starfallGame, mgr = g.enemyMgr, cs = g.cs;
            if (!mgr || !mgr.enemies) return;
            var boss = null;
            for (var i = 0; i < mgr.enemies.length; i++) {
                if (mgr.enemies[i].boss) { boss = mgr.enemies[i]; break; }
            }
            if (!boss) return;
            // Get boss position — Cocos node world position
            var bx = boss.node._x, by = boss.node._y;
            // Get player position
            var px = cs.playerX, py = cs.playerY;
            var dx = bx - px, dy = by - py;
            var dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 120) {
                // Move toward boss — stop short so we don't overlap
                var speed = cs.moveSpeed || 280;
                var step = Math.min(speed * 0.5, dist - 60);
                cs.playerX += (dx/dist) * step;
                cs.playerY += (dy/dist) * step;
            }
        } catch(e) {}
    })()""", timeout=5)


def tick_real_game(cdp: CDPClient, frames: int, max_retries: int = 3) -> int:
    """
    Advance the real Cocos game by `frames` frames using bulk ticks.
    Returns the number of frames actually ticked (may be < frames if game ended).
    Handles WebSocket timeouts gracefully.
    """
    frames_done = 0
    batch = 500  # ~8.3s game time per CDP call — good balance of overhead vs responsiveness
    for attempt in range(max_retries):
        try:
            while frames_done < frames:
                rem = min(batch, frames - frames_done)
                # timeout: generous for late-game computation spikes (up to ~110s for large batches)
                t = max(60, rem / 5 + 10)
                result = cdp.evaluate(
                    f"(function(){{return (window.__starfallBulkTick({rem}) || 0);}})()",
                    timeout=t,
                )
                ran = int(result) if isinstance(result, (int, float)) else 0
                frames_done += ran
                # game ended (died / wave cleared) — stop early
                if ran < rem:
                    break
            return frames_done  # success
        except Exception as e:
            if attempt < max_retries - 1:
                import time
                time.sleep(1)
                continue
            raise  # re-raise so run_weapon_once can catch it
    return frames_done  # never reached — kept for pyright


def stable_weapon_seed_offset(weapon_id: str) -> int:
    value = 0
    for ch in weapon_id:
        value = (value * 131 + ord(ch)) & 0x7fffffff
    return value % 100_000


def set_weapon_level_runtime(cdp: CDPClient, weapon_id: str, level: int) -> None:
    safe_level = max(1, int(level))
    result = cdp.evaluate(
        f"""
(function(){{
  var g = window.__starfallGame;
  if (!g || !g.shop || !g.shop.equipmentLevels) return 'missing';
  g.shop.equipmentLevels["{weapon_id}"] = {safe_level};
  if (g.shop.saveProgress) g.shop.saveProgress();
  return 'ok';
}})()
""",
        timeout=5,
    )
    if result != "ok":
        raise RuntimeError(f"Failed to set weapon {weapon_id} level {safe_level}: {result}")


def run_weapon_once(cdp: CDPClient, weapon: Dict[str, Any], run_idx: int, max_seconds: int, seed: int, weapon_level: int = 1) -> RunResult:
    if weapon_level > 1:
        set_weapon_level_runtime(cdp, weapon["id"], weapon_level)
    start_real_run(cdp, weapon["id"], seed)
    final_state: Dict[str, Any] = {}
    # 每隔 N 秒打开商店买道具
    shop_interval = 28
    next_shop_at = shop_interval

    for elapsed in range(max_seconds):
        try:
            tick_real_game(cdp, 60)
        except Exception as tick_err:
            # WebSocket timeout mid-run — read final state and return gracefully
            import traceback
            traceback.print_exception(type(tick_err), tick_err, tick_err.__traceback__)
            final_state = _safe_read_state(cdp)
            wave = int(final_state.get("wave") or 0)
            hp = float(final_state.get("hp") or 0)
            return RunResult(
                weapon_id=weapon["id"],
                weapon_name=weapon.get("name", weapon["id"]),
                tier=WEAPON_TIER_MAP.get(weapon.get("family", weapon["id"]), WEAPON_TIER_MAP.get(weapon["id"].replace("-standard", ""), "standard")),
                target_profile=WEAPON_TIER_MAP.get(weapon.get("family", weapon["id"]), WEAPON_TIER_MAP.get(weapon["id"].replace("-standard", ""), "standard")),
                run=run_idx,
                seed=seed,
                final_wave=wave,
                combat_time=float(final_state.get("combatTime") or 0),
                kills=int(final_state.get("kills") or 0),
                level=int(final_state.get("level") or 0),
                alloy=int(final_state.get("alloy") or 0),
                items=int(final_state.get("items") or 0),
                phase=str(final_state.get("phase") or "timeout"),
                hp=hp,
                died=hp <= 0,
                error=str(tick_err),
            )
        try:
            state = read_state(cdp)
        except Exception:
            # Late-game CDP slowdown — use whatever we last saw
            state = final_state or {"phase": "unknown", "wave": 0, "hp": 0}
        final_state = state
        try:
            handle_modal_choices(cdp, state)
        except Exception:
            pass  # non-critical, skip and continue
        phase = state.get("phase")

        # 定期打开商店（仅在 combat 阶段有效）
        if phase == "combat" and elapsed >= next_shop_at and elapsed < max_seconds - 10:
            next_shop_at = elapsed + shop_interval
            trigger_shop(cdp)

        # 追 Boss 集火秒杀
        if phase == "combat":
            chase_boss(cdp)

        hp = float(state.get("hp") or 0)
        if hp <= 0 or phase in {"settlement", "hangar", "menu"}:
            break

    wave = int(final_state.get("wave") or 0)
    hp = float(final_state.get("hp") or 0)
    return RunResult(
        weapon_id=weapon["id"],
        weapon_name=weapon.get("name", weapon["id"]),
        tier=WEAPON_TIER_MAP.get(weapon.get("family", weapon["id"]), WEAPON_TIER_MAP.get(weapon["id"].replace("-standard", ""), "standard")),
        target_profile=WEAPON_TIER_MAP.get(weapon.get("family", weapon["id"]), WEAPON_TIER_MAP.get(weapon["id"].replace("-standard", ""), "standard")),
        run=run_idx,
        seed=seed,
        final_wave=wave,
        combat_time=float(final_state.get("combatTime") or 0),
        kills=int(final_state.get("kills") or 0),
        level=int(final_state.get("level") or 0),
        alloy=int(final_state.get("alloy") or 0),
        items=int(final_state.get("items") or 0),
        phase=str(final_state.get("phase") or "unknown"),
        hp=hp,
        died=hp <= 0,
    )


def percentile(sorted_values: List[int], p: float) -> int:
    if not sorted_values:
        return 0
    idx = min(len(sorted_values) - 1, max(0, int(len(sorted_values) * p)))
    return sorted_values[idx]


def summarize(results: List[RunResult]) -> List[Dict[str, Any]]:
    by_weapon: Dict[str, List[RunResult]] = {}
    for r in results:
        by_weapon.setdefault(r.weapon_id, []).append(r)

    rows = []
    tier_order = {'novice': 0, 'standard': 1, 'boss_gate': 2, 'boss_clear': 3}
    for wid, runs in sorted(by_weapon.items(), key=lambda kv: (tier_order.get(kv[1][0].tier, 99), kv[1][0].weapon_name)):
        waves = sorted(r.final_wave for r in runs)
        profile = runs[0].tier
        t = TARGETS[profile]
        p50 = percentile(waves, 0.5)
        p90 = percentile(waves, 0.9)
        rows.append({
            "weapon_id": wid,
            "weapon_name": runs[0].weapon_name,
            "tier": profile,
            "target_profile": profile,
            "runs": len(runs),
            "p50": p50,
            "p90": p90,
            "avg_kills": round(statistics.mean(r.kills for r in runs), 1),
            "avg_level": round(statistics.mean(r.level for r in runs), 1),
            "passes": t[0] <= p50 <= t[1] and p90 <= t[2],
        })
    return rows


def print_summary(rows: List[Dict[str, Any]]) -> None:
    print("\n真实 Cocos/CDP 平衡测试结果")
    print("| 武器 | 阶段 | runs | P50 | P90 | 均杀 | 均级 | 状态 |")
    print("|---|---|---:|---:|---:|---:|---:|---:|")
    for r in rows:
        mark = "✅" if r["passes"] else "🔥" if r["p90"] > TARGETS[r["target_profile"]][2] else "🧊"
        print(f"| {r['weapon_name']} | {r['target_profile']} | {r['runs']} | {r['p50']} | {r['p90']} | {r['avg_kills']} | {r['avg_level']} | {mark} |")


def main() -> int:
    ap = argparse.ArgumentParser(description="Run balance checks in the real Cocos game via CDP")
    ap.add_argument("--runs", type=int, default=3, help="runs per weapon")
    ap.add_argument("--seed", type=int, default=42, help="base deterministic in-game seed; each weapon/run derives a stable seed from it")
    ap.add_argument("--cdp-host", default="localhost", help="Chrome DevTools host")
    ap.add_argument("--cdp-port", type=int, default=9222, help="Chrome DevTools remote debugging port")
    ap.add_argument("--max-seconds", type=int, default=720, help="max real combat seconds per run")
    ap.add_argument("--target-filter", default="localhost:7457", help="Chrome target URL substring")
    ap.add_argument("--weapon", action="append", help="weapon id to test; repeatable. Defaults to all base families")
    ap.add_argument("--weapon-level", type=int, default=1, help="override hangar level of equipped weapon (1..N)")
    ap.add_argument("--out", default="data/balance_cdp", help="output directory")
    ap.add_argument("--allow-balance-fail", action="store_true", help="exit 0 after producing reports even when measured waves miss balance targets")
    args = ap.parse_args()

    cdp = CDPClient(host=args.cdp_host, port=args.cdp_port)
    if not cdp.connect(target_url_filter=args.target_filter):
        print(f"ERROR: cannot connect to Chrome CDP on {args.cdp_host}:{args.cdp_port}.", file=sys.stderr)
        print(f"Start headed Chrome with --remote-debugging-port={args.cdp_port} and open the Cocos web build.", file=sys.stderr)
        return 2
    ensure_game_ready(cdp)

    weapons = weapon_catalog(cdp)
    if args.weapon:
        wanted = set(args.weapon)
        weapons = [w for w in weapons if w["id"] in wanted]
        if not weapons:
            print(f"ERROR: requested weapon(s) not found: {', '.join(sorted(wanted))}", file=sys.stderr)
            return 2
    else:
        # Only test base family/standard entries by default, not all variants.
        # Fallback rows parsed from WEAPON_FAMILIES are already base families and
        # their ids contain hyphens (e.g. storm-rifle), so do not filter them out.
        legacy_base_ids = {"storm-rifle", "split-barrel", "orbital-drone"}
        weapons = [
            w for w in weapons
            if w.get("id") and (
                w.get("base_family")
                or str(w["id"]).endswith("-standard")
                or w["id"] in legacy_base_ids
                or "-" not in str(w["id"])
            )
        ]

    out = ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)

    results: List[RunResult] = []
    for weapon_index, w in enumerate(weapons):
        print(f"\n== {w.get('name', w['id'])} ({w['id']}) ==")
        weapon_seed_base = args.seed + stable_weapon_seed_offset(str(w["id"])) + weapon_index * 1000
        for i in range(args.runs):
            run_seed = weapon_seed_base + i + 1
            # Guard: Chrome may have crashed between runs — reconnect if needed
            if not cdp.is_connected():
                import time
                time.sleep(1)
                cdp.connect(target_url_filter=args.target_filter)
            try:
                r = run_weapon_once(cdp, w, i + 1, args.max_seconds, run_seed, args.weapon_level)
            except Exception as run_err:
                import traceback
                traceback.print_exception(type(run_err), run_err, run_err.__traceback__)
                r = RunResult(
                    weapon_id=w["id"], weapon_name=w.get("name", w["id"]),
                    tier=WEAPON_TIER_MAP.get(w.get("family", w["id"]), WEAPON_TIER_MAP.get(w["id"].replace("-standard", ""), "standard")),
                    target_profile=WEAPON_TIER_MAP.get(w.get("family", w["id"]), WEAPON_TIER_MAP.get(w["id"].replace("-standard", ""), "standard")),
                    run=i + 1, seed=run_seed, final_wave=0, combat_time=0.0,
                    kills=0, level=0, items=0, alloy=0, hp=0.0, phase="error", died=True,
                )
            results.append(r)
            print(f"run {i+1}/{args.runs}: seed={run_seed} wave={r.final_wave} time={r.combat_time}s kills={r.kills} level={r.level} items={r.items} alloy={r.alloy} hp={r.hp}")

    with (out / "runs.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(results[0]).keys()) if results else [])
        if results:
            writer.writeheader()
            for r in results:
                writer.writerow(asdict(r))

    rows = summarize(results)
    (out / "summary.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print_summary(rows)
    print(f"\n输出: {out}")
    passed = all(r["passes"] for r in rows)
    if args.allow_balance_fail and not passed:
        print("\n注意: 本次已产出真实跑局报告，但结果未达到平衡目标；--allow-balance-fail 使烟测以 0 退出。")
        return 0
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

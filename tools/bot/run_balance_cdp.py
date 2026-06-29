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
    tier: str  # 'novice' / 'standard' / 'boss_gate' / 'boss_clear'
    target_profile: str
    run: int
    seed: int
    final_wave: int
    combat_time: float
    kills: int
    level: int
    alloy: int
    phase: str
    hp: float
    died: bool


def js_json(cdp: CDPClient, expression: str, timeout: float = 5.0) -> Any:
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
    # field, so CDP cannot always read it through g.shop.
    catalog_ts = ROOT / "assets" / "scripts" / "catalogs" / "weaponCatalog.ts"
    if catalog_ts.exists():
        text = catalog_ts.read_text(encoding="utf-8")
        rows: List[Dict[str, Any]] = []
        for match in re.finditer(
            r"\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'[\s\S]*?cost:\s*(\d+)",
            text,
        ):
            wid, name, cost = match.groups()
            rows.append({
                "id": wid,
                "name": name,
                "cost": int(cost),
                "kind": "weapon",
                "family": wid,
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
  window.__starfallBotMode = true;
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


def start_real_run(cdp: CDPClient, weapon_id: str, seed: int) -> None:
    set_runtime_seed(cdp, seed)
    select_weapon_runtime(cdp, weapon_id)
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
    g.cs.phase = 'hangar';
    g.beginBattle(false);
    return 'ok';
  } catch(e) { return 'err: ' + e.message; }
})()
""",
        timeout=5,
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
      enemies: mgr && mgr.enemies ? mgr.enemies.length : 0,
      bossKills: cs.bossKills || 0
    });
  } catch(e) { return JSON.stringify({phase:'error', error:e.message}); }
})()
""",
        timeout=3,
    )
    return state if isinstance(state, dict) else {"phase": "unknown"}


def handle_modal_choices(cdp: CDPClient, state: Dict[str, Any]) -> None:
    phase = state.get("phase")
    if phase in {"level-up", "item-choice"}:
        cdp.evaluate(
            "(function(){try{window.__starfallGame.pickupMgr.choosePanelChoice(0);return 'ok'}catch(e){return e.message}})()",
            timeout=2,
        )
    elif phase == "shop":
        # Buy first item if affordable/available, otherwise close shop.
        cdp.evaluate(
            "(function(){try{var g=window.__starfallGame; if(g.shop.chooseShopItemByIndex) g.shop.chooseShopItemByIndex(0); if(g.shop.closeShop) g.shop.closeShop(); return 'ok'}catch(e){return e.message}})()",
            timeout=2,
        )
    elif phase == "paused":
        # Death revive panel: decline revive so final run state settles.
        cdp.evaluate(
            "(function(){try{window.__starfallGame.declineRevive();return 'ok'}catch(e){return e.message}})()",
            timeout=2,
        )


def tick_real_game(cdp: CDPClient, frames: int) -> None:
    # One JS loop is much faster and less flaky than 60 separate CDP calls.
    cdp.evaluate(
        f"(function(){{for(var i=0;i<{frames};i++) window.__starfallTick(1/60); return 'ok';}})()",
        timeout=max(5, frames / 300),
    )


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

    for _ in range(max_seconds):
        tick_real_game(cdp, 60)
        state = read_state(cdp)
        final_state = state
        handle_modal_choices(cdp, state)

        phase = state.get("phase")
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
            r = run_weapon_once(cdp, w, i + 1, args.max_seconds, run_seed, args.weapon_level)
            results.append(r)
            print(f"run {i+1}/{args.runs}: seed={run_seed} wave={r.final_wave} time={r.combat_time}s kills={r.kills} level={r.level} phase={r.phase} hp={r.hp}")

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

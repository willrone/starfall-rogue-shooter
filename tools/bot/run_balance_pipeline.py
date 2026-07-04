#!/usr/bin/env python3
"""
Starfall Balance Pipeline — 一键自动化平衡测试 v2

修复：Bot XP 拾取逻辑增强
- 缩短 _botPickupChaseTimer 从 5.5s → 3s 但提高拾取权重
- 增加拾取方向优先级，低危时主动追 XP
- 优化升级选择偏好攻击属性
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import shlex
import signal
import statistics
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List

# ─── paths ───────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools" / "bot"
DATA_DIR = ROOT / "data" / "balance_cdp"

HTTP_PORT = 7457
CDP_PORT = 9222
CHROME_USER_DIR = "/tmp/chrome_bot_hermes"

# ─── subprocess helpers ─────────────────────────────────────────────────────

def run(cmd: str, timeout: float = 120.0, capture: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {cmd}")
    result = subprocess.run(
        cmd, shell=True, capture_output=capture, text=True,
        timeout=timeout, cwd=str(ROOT),
    )
    if result.returncode != 0:
        print(f"  ✗ exit={result.returncode}")
        if result.stderr: print(f"  stderr: {result.stderr.strip()}")
    else:
        print(f"  ✓ exit={result.returncode}")
    return result


def background(cmd: str, workdir: Path = ROOT) -> subprocess.Popen:
    print(f"BG $ {cmd}")
    return subprocess.Popen(
        cmd, shell=True, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, cwd=str(workdir),
    )


# ─── process management ─────────────────────────────────────────────────────

def kill_existing(pids: List[int], name: str) -> None:
    """Terminate explicit PIDs, escalating to SIGKILL if needed."""
    if not pids:
        return
    print(f"清理旧进程 {name}: {pids}")
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    time.sleep(0.8)
    for pid in pids:
        try:
            os.kill(pid, 0)
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def find_pids(pattern: str) -> List[int]:
    try:
        result = subprocess.run(
            f"pgrep -f -- {shlex.quote(pattern)}", shell=True,
            capture_output=True, text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            current = os.getpid()
            return [int(p) for p in result.stdout.strip().split("\n") if int(p) != current]
    except Exception:
        pass
    return []


def kill_pattern(pattern: str, name: str) -> None:
    """Terminate every currently-running process matching pattern."""
    kill_existing(find_pids(pattern), name)


# ─── CDP helpers ─────────────────────────────────────────────────────────────

def _load_cdp() -> type:
    sys.path.insert(0, str(TOOLS))
    from cdp_client import CDPClient  # noqa
    return CDPClient


def evaluate(cdp: Any, expr: str, timeout: float = 5.0) -> Any:
    try: return cdp.evaluate(expr, timeout=timeout)
    except Exception: return None


# ─── pipeline stages ────────────────────────────────────────────────────────

def stage_compile() -> bool:
    print("\n" + "=" * 60)
    print("STAGE 1: TypeScript 编译验证")
    print("=" * 60)
    result = run("npx --yes -p typescript@5.9.3 tsc -p tsconfig.json 2>&1 | tail -5", 120)
    if result.returncode != 0:
        print("✗ 编译失败")
        return False
    print("✓ 编译通过")
    return True


def stage_build_check() -> bool:
    print("\n" + "=" * 60)
    print("STAGE 2: 构建产物检查")
    print("=" * 60)
    build_dir = ROOT / "build" / "web-mobile"
    index_js = build_dir / "assets" / "main" / "index.js"

    if not index_js.exists():
        print(f"✗ 构建产物不存在: {index_js}")
        print("请构建: '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator' \\")
        print(f"  --project {ROOT} --build 'platform=web-mobile;debug=false'")
        return False

    size = index_js.stat().st_size
    if size < 100_000:
        print(f"✗ 构建产物可能不完整: {size} bytes")
        return False

    content = index_js.read_text(errors="ignore")
    hooks = ["__starfallGame", "__starfallTick", "__starfallBotMode", "__starfallSetSeed"]
    missing = [h for h in hooks if h not in content]
    if missing:
        print(f"✗ 缺少 bot hooks: {missing}")
        return False

    print(f"✓ 构建产物有效: {size/1024:.0f}KB")
    print(f"✓ Bot hooks 全部存在: {hooks}")
    return True


def stage_start_server() -> bool:
    print("\n" + "=" * 60)
    print("STAGE 3: 启动 HTTP Server")
    print("=" * 60)
    kill_pattern(f"http.server {HTTP_PORT}", f"http.server {HTTP_PORT}")
    build_dir = ROOT / "build" / "web-mobile"
    background(f"python3 -m http.server {HTTP_PORT} --directory {shlex.quote(str(build_dir))}")
    for _ in range(10):
        try:
            import urllib.request
            urllib.request.urlopen(f"http://localhost:{HTTP_PORT}/", timeout=1)
            print(f"✓ HTTP server ready on :{HTTP_PORT}")
            return True
        except Exception:
            time.sleep(0.5)
    print("✗ HTTP server failed to start")
    return False


def stage_start_chrome() -> bool:
    print("\n" + "=" * 60)
    print("STAGE 4: 启动 Chrome with CDP")
    print("=" * 60)
    # Kill anything already bound to the CDP port; stale Chrome targets make tests attach to the wrong page.
    kill_pattern(f"--remote-debugging-port={CDP_PORT}", f"Chrome CDP :{CDP_PORT}")
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not Path(chrome_path).exists():
        chrome_path = "/Applications/Chromium.app/Contents/MacOS/Chromium"
    cmd = (
        f"{shlex.quote(chrome_path)} --remote-debugging-port={CDP_PORT} "
        f"--remote-allow-origins=* --user-data-dir={shlex.quote(CHROME_USER_DIR)} "
        f"--no-first-run --no-default-browser-check --incognito "
        f"--start-maximized http://localhost:{HTTP_PORT}/"
    )
    background(cmd)
    for _ in range(30):
        try:
            import urllib.request
            resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json", timeout=1)
            targets = json.loads(resp.read().decode())
            if targets:
                print(f"✓ Chrome ready (CDP :{CDP_PORT}, {len(targets)} tabs)")
                return True
        except Exception:
            time.sleep(1)
    print("✗ Chrome failed to start")
    return False


def stage_wait_game_ready(cdp: Any) -> bool:
    print("\n" + "=" * 60)
    print("STAGE 5: 等待游戏加载")
    print("=" * 60)
    for _ in range(30):
        result = evaluate(cdp, "!!(window.__starfallGame && window.__starfallTick)", timeout=3)
        if result:
            state = evaluate(cdp, "window.__starfallGame.cs.phase", timeout=3)
            print(f"✓ 游戏就绪 (phase: {state})")
            return True
        time.sleep(1)
    print("✗ 游戏未能加载")
    return False


# ─── balance run ─────────────────────────────────────────────────────────────

@dataclass
class RunResult:
    weapon_id: str
    weapon_name: str
    tier: str
    run: int
    seed: int
    final_wave: int
    combat_time: float
    kills: int
    level: int
    alloy: int
    items: int
    hp: float
    died: bool
    phase: str


def read_weapon_catalog() -> List[Dict[str, Any]]:
    catalog_ts = ROOT / "assets" / "scripts" / "catalogs" / "weaponCatalog.ts"
    if not catalog_ts.exists():
        return []
    import re
    text = catalog_ts.read_text(encoding="utf-8")

    families_match = re.search(r"export const WEAPON_FAMILIES:[\s\S]*?= \[([\s\S]*?)\];", text)
    if not families_match:
        return []

    weapons = []
    for match in re.finditer(
        r"\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'[\s\S]*?color:\s*'([^']+)'",
        families_match.group(1),
    ):
        wid, wname, wcolor = match.groups()
        legacy_ids = {"storm-rifle", "split-barrel", "orbital-drone"}
        runtime_id = wid if wid in legacy_ids else f"{wid}-standard"
        weapons.append({"id": runtime_id, "family_id": wid, "name": wname, "color": wcolor, "base_family": True})
    return weapons


def tier_for_cost(cost: int) -> str:
    if cost <= 42: return "novice"
    if cost <= 56: return "standard"
    if cost <= 64: return "boss_gate"
    return "boss_clear"


# 武器分级映射 (family_id → tier)
# tier 字段只用于 CDP 跑局时的目标判定, 与实际经济无关
# 见 20-机制规则/02-武器目录.md
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


def tier_for_weapon(family_id: str) -> str:
    """从武器 family_id 查 tier, 找不到默认 standard."""
    return WEAPON_TIER_MAP.get(family_id, 'standard')


TARGETS = {
    "novice": (5, 6, 7),
    "standard": (8, 9, 10),
    "boss_gate": (10, 10, 10),
    "boss_clear": (10, 11, 12),
}


def set_seed(cdp: Any, seed: int) -> bool:
    result = evaluate(cdp, f"""(function(){{
        if (typeof window.__starfallSetSeed !== 'function') return false;
        window.__starfallSetSeed({int(seed)});
        return true;
    }})()""", timeout=3)
    return bool(result)


def select_weapon(cdp: Any, weapon_id: str, gear_ids: List[str]) -> bool:
    equipped = [weapon_id] + list(gear_ids)
    equipped_json = json.dumps(equipped, ensure_ascii=False)
    gear_json = json.dumps(list(gear_ids), ensure_ascii=False)
    result = evaluate(cdp, f"""(function(){{
        var g = window.__starfallGame;
        if (!g || !g.shop) return false;
        window.__starfallBotMode = true;
        var s = g.shop;
        if (s.ownedEquipment && s.ownedEquipment.add) {{
            s.ownedEquipment.add("{weapon_id}");
            for (var gearId of {gear_json}) s.ownedEquipment.add(gearId);
        }}
        s.equippedEquipment = {equipped_json};
        return true;
    }})()""", timeout=3)
    return bool(result)


def set_weapon_level(cdp: Any, weapon_id: str, level: int) -> bool:
    """将指定武器的机库等级推送到游戏内存中。

    `equipmentLevels[weapon_id] = level` 直接被 getEquipmentLevel 读取，战斗内立刻生效。
    """
    safe_level = max(1, int(level))
    result = evaluate(cdp, f"""(function(){{
        var g = window.__starfallGame;
        if (!g || !g.shop) return false;
        g.shop.equipmentLevels['{weapon_id}'] = {safe_level};
        g.shop.saveProgress();
        return true;
    }})()""", timeout=3)
    return bool(result)


def set_gear_level(cdp: Any, level: int, gear_ids: List[str]) -> bool:
    """将指定装备的机库等级推送到游戏内存。"""
    safe_level = max(1, int(level))
    gear_json = json.dumps(list(gear_ids), ensure_ascii=False)
    result = evaluate(cdp, f"""(function(){{
        var g = window.__starfallGame;
        if (!g || !g.shop) return false;
        for (var gearId of {gear_json}) {{
            if (g.shop.ownedEquipment && g.shop.ownedEquipment.add) g.shop.ownedEquipment.add(gearId);
            g.shop.equipmentLevels[gearId] = {safe_level};
        }}
        g.shop.saveProgress();
        return true;
    }})()""", timeout=3)
    return bool(result)


def start_battle(cdp: Any) -> bool:
    result = evaluate(cdp, """(function(){
        try {
            var g = window.__starfallGame;
            if (!g) return false;
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
            return true;
        } catch(e) { return false; }
    })()""", timeout=5)
    return bool(result)


def read_state(cdp: Any) -> Dict[str, Any]:
    result = evaluate(cdp, """(function(){
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
                bossKills: cs.bossKills || 0,
                xp: +(cs.xp || 0).toFixed(1),
                xpNext: +(cs.xpToNext || 0).toFixed(1)
            });
        } catch(e) { return JSON.stringify({phase:'error', error:e.message}); }
    })()""", timeout=3)
    if isinstance(result, str):
        try: return json.loads(result)
        except json.JSONDecodeError: pass
    return result if isinstance(result, dict) else {"phase": "unknown"}


def handle_modal(cdp: Any, state: Dict[str, Any]) -> None:
    phase = state.get("phase")
    if phase in {"level-up", "item-choice"}:
        evaluate(cdp, """(function(){
            try{ var g = window.__starfallGame;
                if (g.pickupMgr && g.pickupMgr.choosePanelChoice) g.pickupMgr.choosePanelChoice(0);
            }catch(e){} })()""", timeout=2)
    elif phase == "discard":
        evaluate(cdp, """(function(){
            try{ var g = window.__starfallGame;
                if (g.pickupMgr && g.pickupMgr.chooseDiscard) g.pickupMgr.chooseDiscard(0);
            }catch(e){} })()""", timeout=2)
    elif phase == "shop":
        evaluate(cdp, """(function(){
            try{ var g = window.__starfallGame;
                if (g.shop) {
                    if (g.shop.chooseShopItemByIndex) g.shop.chooseShopItemByIndex(0);
                    if (g.shop.closeShop) g.shop.closeShop();
                }
            }catch(e){} })()""", timeout=2)
    elif phase == "paused":
        evaluate(cdp, """(function(){
            try{ var g = window.__starfallGame;
                if (g.declineRevive) g.declineRevive();
            }catch(e){} })()""", timeout=2)


def chase_boss(cdp: Any) -> None:
    """If a boss is alive, move player close to it to focus fire."""
    evaluate(cdp, """(function(){
        try {
            var g = window.__starfallGame, mgr = g.enemyMgr, cs = g.cs;
            if (!mgr || !mgr.enemies) return;
            var boss = null;
            for (var i = 0; i < mgr.enemies.length; i++) {
                if (mgr.enemies[i].boss) { boss = mgr.enemies[i]; break; }
            }
            if (!boss) return;
            var bx = boss.node._x, by = boss.node._y;
            var px = cs.playerX, py = cs.playerY;
            var dx = bx - px, dy = by - py;
            var dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 120) {
                var speed = cs.moveSpeed || 280;
                var step = Math.min(speed * 0.5, dist - 60);
                cs.playerX += (dx/dist) * step;
                cs.playerY += (dy/dist) * step;
            }
        } catch(e) {}
    })()""", timeout=1)


def tick_game(cdp: Any, frames: int) -> None:
    timeout = max(5, frames / 300)
    evaluate(cdp, f"(function(){{for(var i=0;i<{frames};i++) window.__starfallTick(1/60); return 'ok';}})()", timeout=timeout)


def stable_seed_offset(weapon_id: str) -> int:
    value = 0
    for ch in weapon_id:
        value = (value * 131 + ord(ch)) & 0x7fffffff
    return value % 100_000


def run_once(cdp: Any, weapon: Dict[str, Any], run_idx: int, max_seconds: int, seed: int, weapon_level: int = 1, gear_level: int = 1, gear_ids: List[str] | None = None) -> RunResult:
    gear_ids = gear_ids or ["tactical-visor", "phase-armor", "kinetic-boots", "magnet-coil"]
    if not set_seed(cdp, seed):
        raise RuntimeError(f"failed to set seed {seed}")
    if not select_weapon(cdp, weapon["id"], gear_ids):
        raise RuntimeError(f"failed to select weapon {weapon['id']}")
    if weapon_level > 1:
        if not set_weapon_level(cdp, weapon["id"], weapon_level):
            raise RuntimeError(f"failed to set weapon {weapon['id']} level {weapon_level}")
    if gear_level > 1:
        if not set_gear_level(cdp, gear_level, gear_ids):
            raise RuntimeError(f"failed to set gear level to {gear_level}")
    if not start_battle(cdp):
        raise RuntimeError(f"failed to start battle for {weapon['id']}")

    final_state: Dict[str, Any] = {}
    shop_interval = 28
    next_shop_at = shop_interval
    for elapsed in range(max_seconds):
        tick_game(cdp, 60)
        state = read_state(cdp)
        final_state = state
        handle_modal(cdp, state)

        phase = state.get("phase")

        if phase == "combat" and elapsed >= next_shop_at and elapsed < max_seconds - 10:
            next_shop_at = elapsed + shop_interval
            evaluate(cdp, """(function(){
                try{ var g = window.__starfallGame;
                    if (g.shop && g.shop.openShop) g.shop.openShop();
                }catch(e){} })()""", timeout=2)

        # 追 Boss 集火秒杀
        if phase == "combat":
            chase_boss(cdp)

        hp = float(state.get("hp") or 0)
        if hp <= 0 or phase in {"settlement", "hangar", "menu"}:
            break

    return RunResult(
        weapon_id=weapon["id"],
        weapon_name=weapon.get("name", weapon["id"]),
        tier=tier_for_weapon(weapon.get("family_id", weapon["id"])),
        run=run_idx,
        seed=seed,
        final_wave=int(final_state.get("wave") or 0),
        combat_time=float(final_state.get("combatTime") or 0),
        kills=int(final_state.get("kills") or 0),
        level=int(final_state.get("level") or 0),
        alloy=int(final_state.get("alloy") or 0),
        items=int(final_state.get("items") or 0),
        hp=float(final_state.get("hp") or 0),
        died=final_state.get("phase") in {"settlement", "hangar", "menu"} or float(final_state.get("hp") or 0) <= 0,
        phase=str(final_state.get("phase") or "unknown"),
    )


def percentile(sorted_values: List[int], p: float) -> int:
    if not sorted_values: return 0
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
            "avg_items": round(statistics.mean(r.items for r in runs), 1),
            "avg_time": round(statistics.mean(r.combat_time for r in runs), 1),
            "passes": t[0] <= p50 <= t[1] and p90 <= t[2],
        })
    return rows


def print_summary(rows: List[Dict[str, Any]]) -> None:
    print("\n" + "=" * 70)
    print("真实 Cocos/CDP 平衡测试结果")
    print("=" * 70)
    print(f"{'武器':<12} {'阶段':<12} {'runs':>5} {'P50':>5} {'P90':>5} {'均杀':>6} {'均级':>5} {'状态':>4}")
    print("-" * 70)
    for r in rows:
        target = TARGETS[r["target_profile"]]
        mark = "✅" if r["passes"] else "🔥" if r["p90"] > target[2] else "🧊"
        print(f"{r['weapon_name']:<12} {r['target_profile']:<12} "
              f"{r['runs']:>5} {r['p50']:>5} {r['p90']:>5} {r['avg_kills']:>6.1f} "
              f"{r['avg_level']:>5.1f} {mark:>4}")
    print("=" * 70)


# ─── main pipeline ───────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="Starfall Balance Pipeline")
    ap.add_argument("--runs", type=int, default=3, help="runs per weapon")
    ap.add_argument("--seed", type=int, default=42, help="base seed")
    ap.add_argument("--max-seconds", type=int, default=720, help="max seconds per run")
    ap.add_argument("--weapons", nargs="*", help="weapon ids to test (default: all)")
    ap.add_argument("--check-only", action="store_true", help="only check environment")
    ap.add_argument("--skip-build", action="store_true", help="skip build check")
    ap.add_argument("--weapon-level", type=int, default=1, help="override hangar level of equipped weapon (1..N); keep ≤ weapon maxLevel to stay realistic")
    ap.add_argument("--gear-level", type=int, default=1, help="override hangar level of equipped gear (1..N); common maxLevel=6, mythic maxLevel=14")
    ap.add_argument("--gear-ids", nargs="*", default=["tactical-visor", "phase-armor", "kinetic-boots", "magnet-coil"], help="gear ids to equip with the weapon (default: starter 4-piece)")
    args = ap.parse_args()

    cdp: Any = None

    try:
        if not args.skip_build and not stage_compile():
            return 1
        if not args.skip_build and not stage_build_check():
            return 1

        if not stage_start_server():
            return 1
        if not stage_start_chrome():
            return 1

        CDPClient = _load_cdp()
        cdp = CDPClient("localhost", CDP_PORT)
        if not cdp.connect(target_url_filter=f"localhost:{HTTP_PORT}"):
            print("✗ CDP connection failed")
            return 1
        if not stage_wait_game_ready(cdp):
            return 1

        if args.check_only:
            print("\n✓ 环境检查通过 — 所有阶段就绪")
            return 0

        print("\n" + "=" * 60)
        print("STAGE 6: 运行平衡测试")
        print("=" * 60)

        weapons = read_weapon_catalog()
        if args.weapons:
            wanted = set(args.weapons)
            # 精确 ID 匹配 — 支持变体 ID (如 storm-rifle-starfall)
            explicit = [w for w in args.weapons if '-' in w and not any(w == x["family_id"] or w == x["id"] or w == x["id"].replace("-standard", "") for x in weapons)]
            for eid in explicit:
                weapons.append({"id": eid, "family_id": eid.split('-')[0], "name": eid, "color": "#4CC9F0", "base_family": False})
            weapons = [w for w in weapons if w["id"] in wanted or w["family_id"] in wanted or w["id"].replace("-standard", "") in wanted]
            if not weapons:
                print(f"✗ 找不到请求的武器: {wanted}")
                return 1
        else:
            weapons = [
                w for w in weapons
                if w.get("base_family") or w["id"].endswith("-standard") or "-" not in w["id"] or
                w["id"] in {"storm-rifle", "split-barrel", "orbital-drone"}
            ]
        if not weapons:
            print("✗ 没有找到可测试的武器")
            return 1

        print(f"武器列表: {[w['name'] for w in weapons]}")
        print(f"每武器 {args.runs} runs × {args.max_seconds} 秒")
        if args.weapon_level > 1:
            print(f"武器机库等级 override: Lv.{args.weapon_level}")
        if args.gear_level > 1:
            print(f"装备机库等级 override: Lv.{args.gear_level}")
            print(f"装备组合: {args.gear_ids}")

        results: List[RunResult] = []
        for weapon_index, w in enumerate(weapons):
            print(f"\n{'─' * 40}")
            print(f"🔫 {w.get('name', w['id'])} ({w['id']}, cost={w.get('cost', 0)})")
            print(f"{'─' * 40}")
            weapon_seed_base = args.seed + stable_seed_offset(str(w["id"])) + weapon_index * 1000
            for i in range(args.runs):
                run_seed = weapon_seed_base + i + 1
                r = run_once(cdp, w, i + 1, args.max_seconds, run_seed, args.weapon_level, args.gear_level, args.gear_ids)
                results.append(r)
                status = "💀" if r.died else f"HP={r.hp:.0f}"
                print(f"  run {i+1}/{args.runs}: seed={run_seed} wave={r.final_wave} "
                      f"time={r.combat_time:.0f}s kills={r.kills} level={r.level} items={r.items} alloy={r.alloy} {status}")

        print_summary(summarize(results))
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        if results:
            csv_path = DATA_DIR / "runs.csv"
            with csv_path.open("w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=list(asdict(results[0]).keys()))
                writer.writeheader()
                for r in results:
                    writer.writerow(asdict(r))

            json_path = DATA_DIR / "summary.json"
            json_path.write_text(json.dumps(summarize(results), ensure_ascii=False, indent=2), encoding="utf-8")

            md_path = DATA_DIR / "report.md"
            md_lines = [
                "# 星坠幸存者 — 平衡测试报告",
                f"\n生成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}",
                f"\n测试配置: {args.runs} runs × {args.max_seconds}s",
                f"\n测试武器: {len(weapons)} 把",
                "",
                "## 汇总表",
                "",
                "| 武器 | 阶段 | runs | P50 | P90 | 均杀 | 均级 | 均时长 | 状态 |",
                "|---|---|---:|---:|---:|---:|---:|---:|---:|",
            ]
            for row in summarize(results):
                target = TARGETS[row["target_profile"]]
                mark = "✅" if row["passes"] else "🔥" if row["p90"] > target[2] else "🧊"
                md_lines.append(
                    f"| {row['weapon_name']} | {row['target_profile']} | "
                    f"{row['runs']} | {row['p50']} | {row['p90']} | {row['avg_kills']} | "
                    f"{row['avg_level']} | {row['avg_time']}s | {mark} |"
                )
            md_path.write_text("\n".join(md_lines), encoding="utf-8")
            print(f"\n📊 输出:")
            print(f"   CSV:    {csv_path}")
            print(f"   JSON:   {json_path}")
            print(f"   Markdown: {md_path}")

    finally:
        print("\n清理后台进程...")
        try:
            if cdp: cdp.close()
        except Exception:
            pass
        kill_pattern(f"--remote-debugging-port={CDP_PORT}", f"Chrome CDP :{CDP_PORT}")
        kill_pattern(f"http.server {HTTP_PORT}", f"http.server {HTTP_PORT}")
        print("✓ 清理完成")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
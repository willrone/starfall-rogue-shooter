#!/usr/bin/env python3
"""
星坠幸存者 — 分层目标验证器 v1
读取 balance_simulator CSV 输出，按 Tier 分层检查是否命中设计目标。
也支持直接输入武器数据进行公式估算（不依赖模拟器）。

用法：
  # 读取模拟器CSV
  python3 tools/balance_simulator.py --runs 300 --seed 42 --export-csv /tmp/sim.csv
  python3 tools/verify_tier_targets.py --input /tmp/sim.csv

  # 直接公式估算（不跑模拟）
  python3 tools/verify_tier_targets.py --quick
"""
import argparse, csv, sys, math
from collections import defaultdict

# ─── Tier 分层标准 ───
# 出自 AGENTS.md 2.8 武器系统分组
# 支持中文名映射
TIER_MAP = {
    # id → tier
    "storm-rifle":    "novice",
    "frost-beamer":   "novice",
    "plague-sprayer": "novice",
    "ember-smg":      "novice",
    # Standard
    "split-barrel":   "standard",
    "echo-bow":       "standard",
    "mirror-prism":   "standard",
    "quantum-loom":   "standard",
    # Boss Gate
    "thorn-chain":    "boss_gate",
    "void-needle":    "boss_gate",
    "ion-lance":      "boss_gate",
    "rail-cannon":    "boss_gate",
    "sun-disc":       "boss_gate",
    "nova-shotgun":   "boss_gate",
    "redline-carbine":"boss_gate",
    # Boss Clear
    "meteor-launcher":"boss_clear",
    "gravity-hammer": "boss_clear",
    "star-scythe":    "boss_clear",
    "orbital-drone":  "boss_clear",
    "pulse-fan":      "boss_clear",
}

# 中文名 → id 映射
NAME_TO_ID = {
    "风暴步枪": "storm-rifle", "霜束发射器": "frost-beamer",
    "瘟疫喷射器": "plague-sprayer", "余烬冲锋枪": "ember-smg",
    "裂变枪管": "split-barrel", "回声弓": "echo-bow",
    "镜像棱镜": "mirror-prism", "量子织机": "quantum-loom",
    "荆棘链": "thorn-chain", "虚空针": "void-needle",
    "离子长枪": "ion-lance", "磁轨炮": "rail-cannon",
    "日冕飞盘": "sun-disc", "新星霰弹": "nova-shotgun",
    "红线卡宾": "redline-carbine",
    "流星发射器": "meteor-launcher", "重力锤": "gravity-hammer",
    "星镰": "star-scythe", "轨道无人机": "orbital-drone",
    "脉冲扇": "pulse-fan",
}

# 分层目标（与 AGENTS.md 2.7/2.8 一致）
# 注意：P50 / P90 是死亡波次（越大越强）
TIER_TARGETS = {
    "novice": {
        "label": "新手武器(波1解锁)",
        "target_wave": "5-6",
        "p90_max": 7,       # P90 死亡波次 ≤ 7
        "p50_max": 6,       # P50 死亡波次 ≤ 6
        "p10_max": 6,       # 最强也得在波7前死
    },
    "standard": {
        "label": "标准武器(波3解锁)",
        "target_wave": "8-9",
        "p90_min": 7,       # 至少活到波7
        "p90_max": 10,      # 最多活到波10
        "p50_target": "8-9",
    },
    "boss_gate": {
        "label": "Boss门神(波6解锁)",
        "target_wave": "10",
        "p50_min": 8,       # 中位数至少见到波9
        "p50_max": 10,      # 中位数在波10左右
        "p90_max": 10,      # 最强的也在波10死
        "note": "面对第一个Boss，输赢参半",
    },
    "boss_clear": {
        "label": "Boss通关(波9解锁)",
        "target_wave": "11-12",
        "p50_min": 11,      # 中位至少波11
        "p90_max": 12,      # 最强波12
        "note": "刚好能过第一个Boss，赢面稍大",
    },
    "legendary": {
        "label": "传说武器(合成)",
        "target_wave": "12+",
        "p50_min": 12,      # 至少稳定活过波12
        "p90_min": 11,
    },
}


def load_simulated(path: str) -> list[dict]:
    """读取模拟器 CSV 输出"""
    rows = []
    with open(path, "r") as f:
        reader = csv.DictReader(f)
        for r in reader:
            for k in ("p10", "p50", "p90", "avg_k", "avg_lv", "avg_it", "dps"):
                r[k] = float(r[k]) if r[k] else 0.0
            rows.append(r)
    return rows


def check_weapon(name: str, tier_key: str, p10: float, p50: float, p90: float, avg_k: float = 0, avg_lv: float = 0) -> list[str]:
    """检查一把武器是否命中目标，返回 PASS/FAIL 列表"""
    results = []
    targets = TIER_TARGETS.get(tier_key)
    if not targets:
        return [f"  ❓ 未知 tier '{tier_key}'"]

    if "p90_max" in targets:
        if p90 <= targets["p90_max"]:
            results.append(f"  ✅ P90={p90:.0f} ≤ {targets['p90_max']} ✓ 符合预期")
        else:
            results.append(f"  ❌ P90={p90:.0f} > {targets['p90_max']} ✗ 太强了，需削弱")

    if "p90_min" in targets:
        if p90 >= targets["p90_min"]:
            results.append(f"  ✅ P90={p90:.0f} ≥ {targets['p90_min']} ✓")
        else:
            results.append(f"  ❌ P90={p90:.0f} < {targets['p90_min']} ✗ 太弱了")

    if "p50_max" in targets:
        if p50 <= targets["p50_max"]:
            results.append(f"  ✅ P50={p50:.0f} ≤ {targets['p50_max']} ✓")
        else:
            results.append(f"  ❌ P50={p50:.0f} > {targets['p50_max']} ✗ 中位过强")

    if "p50_min" in targets:
        if p50 >= targets["p50_min"]:
            results.append(f"  ✅ P50={p50:.0f} ≥ {targets['p50_min']} ✓")
        else:
            results.append(f"  ❌ P50={p50:.0f} < {targets['p50_min']} ✗ 中位偏弱")

    if "p10_max" in targets:
        if p10 <= targets["p10_max"]:
            results.append(f"  ✅ P10={p10:.0f} ≤ {targets['p10_max']} ✓")
        else:
            results.append(f"  ❌ P10={p10:.0f} > {targets['p10_max']} ✗ 最强态也太强")

    # 额外数据
    if avg_k > 0:
        results.append(f"    均杀={avg_k:.0f}  均级={avg_lv:.1f}")

    return results


def verify(rows: list[dict], name_field: str = "name"):
    """运行全量验证"""
    print("=" * 70)
    print("  星坠幸存者 — 分层目标验证")
    print("=" * 70)

    # 按 tier 分组
    by_tier = defaultdict(list)
    for r in rows:
        name = r[name_field]
        # 优先用中文名查，其次直接查 TIER_MAP
        wid = NAME_TO_ID.get(name)
        if wid is None:
            wid = next((k for k, v in TIER_MAP.items() if k in name or name in k), None)
        if wid is None:
            wid = name
        tier_key = TIER_MAP.get(wid, "unknown")
        by_tier[tier_key].append(r)

    total = len(rows)
    passed = 0
    failed = 0

    # 按 tier 顺序展示
    tier_order = ["novice", "standard", "boss_gate", "boss_clear", "legendary"]
    for tk in tier_order:
        group = by_tier.get(tk, [])
        if not group:
            continue
        t = TIER_TARGETS[tk]
        print(f"\n─── {t['label']} ─── 目标: 波 {t['target_wave']} ───")
        for r in sorted(group, key=lambda x: -x["p90"]):
            print(f"\n  {r[name_field]}")
            checks = check_weapon(
                r[name_field], tk,
                r.get("p10", 0), r.get("p50", 0), r.get("p90", 0),
                r.get("avg_k", 0), r.get("avg_lv", 0)
            )
            for c in checks:
                print(c)
                if c.startswith("  ✅"):
                    passed += 1
                elif c.startswith("  ❌"):
                    failed += 1

    # 未知 tier
    unknown = by_tier.get("unknown", [])
    if unknown:
        print(f"\n─── 未分类 ({len(unknown)}把) ───")
        for r in unknown:
            print(f"  {r.get(name_field)} (P50={r.get('p50','?'):.0f} P90={r.get('p90','?'):.0f})")

    # 汇总
    print(f"\n{'='*70}")
    print(f"  总计: {total} 把武器 · {passed} 项通过 · {failed} 项未达标")
    if failed > 0:
        print(f"  ⚠️  有 {failed} 个检查未命中目标")
    else:
        print(f"  🎉  全部命中目标!")
    print(f"{'='*70}")


# ─── 快速公式估算（不依赖模拟器） ───
def quick_estimate(weapons: list[tuple]) -> list[dict]:
    """用纯公式快速估算 DPS 和预期生存波次"""
    results = []

    for wid, name, dmg, rate, prc, mul, drn, tag in weapons:
        # 波10时的估算DPS（等级~5级加成）
        atk = 16 + 4 * 12  # ~4级攻击强化
        aspd = 0.0 + 3 * 0.14  # ~3级神经反射
        prc_bonus = prc + 2 * 1.0  # ~2级穿透
        mul_bonus = mul + 1 * 0.6  # ~1级多弹

        dmg_calc = max(2.0, dmg + 16 * 0.15 + (atk - 16))
        fi = max(0.07, 1.0 / max(0.15, rate + aspd * 0.45))
        pe = 1.0 + prc_bonus * 0.35
        se = 1.0 + (min(3, mul_bonus / 2.2)) * 0.5
        ce = 1.0 + 0.05 * 2.0  # 基础暴击

        # 无人机
        drone = 0
        if drn > 0:
            c = min(8, 1 + int(drn / 4))
            iv = max(0.28, 1.18 - min(0.78, drn * 0.035))
            drone = c * drn * 8 / iv

        dps = dmg_calc / max(fi, 0.07) * pe * se * ce + drone

        # 从 DPS 估算生存波次
        wave_low = min(20, max(1, int(dps / 60)))
        wave_high = min(20, max(1, int(dps / 35)))

        results.append({
            "name": name,
            "id": wid,
            "dps": round(dps, 1),
            "p50": (wave_low + wave_high) // 2,
            "p90": wave_low,
            "avg_k": 0,
            "avg_lv": 0,
        })

    return results


def main():
    p = argparse.ArgumentParser(description="星坠幸存者 — 分层目标验证器")
    p.add_argument("--input", type=str, help="模拟器CSV路径")
    p.add_argument("--quick", action="store_true", help="用公式估算（不跑模拟器）")
    a = p.parse_args()

    if a.input:
        rows = load_simulated(a.input)
        verify(rows)
    elif a.quick:
        # 从 balance_simulator.py 导入武器列表
        from tools.balance_simulator import WEAPONS
        rows = quick_estimate(WEAPONS)
        verify(rows, name_field="name")
        print("\n  ⚠️  快速估算仅供参考，建议跑完整模拟器验证")
    else:
        p.print_help()


if __name__ == "__main__":
    main()

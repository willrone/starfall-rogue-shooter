#!/usr/bin/env python3
"""Starfall Rogue Shooter — 数值平衡模拟器 v4 (全部武器 + 真实伤害模型)"""
import random, argparse
from collections import defaultdict

WEAPONS = [
    # id, name, dmg, rate, pierce, multi, drone, 定位标签
    ("storm-rifle",    "风暴步枪",  4.5,  1.12, 0,    0,    0,    "均衡"),
    ("split-barrel",   "裂变枪管",  3.4,  0.5,  0.9,  1.25, 0,    "散射穿透"),
    ("orbital-drone",  "轨道无人机",1.6,  0.18, 0,    0,    1.25, "无人机"),
    ("rail-cannon",    "磁轨炮",    7.2,  0.0,  1.1,  0,    0,    "重穿"),
    ("nova-shotgun",   "新星霰弹",  4.0,  0.35, 0.2,  1.65, 0,    "散射"),
    ("ion-lance",      "离子长枪",  5.5,  0.35, 0.9,  0.15, 0,    "穿刺"),
    ("ember-smg",      "余烬冲锋枪",3.2, 1.65, 0.15, 0.45, 0,    "射速"),
    ("frost-beamer",   "霜束发射器",4.2,  0.82, 0.4,  0.3,  0.12, "均衡"),
    ("void-needle",    "虚空针",    4.8,  0.58, 1.35, 0,    0,    "穿透"),
    ("sun-disc",       "日冕飞盘",  4.2,  0.38, 0.55, 0.7,  0.3,  "混合"),
    ("echo-bow",       "回声弓",    4.6,  0.72, 0.5,  0.6,  0,    "弹射"),
    ("plague-sprayer", "瘟疫喷射器",3.8,  1.1,  0.25, 0.85, 0,    "喷射"),
    ("gravity-hammer", "重力锤",    8.0, -0.12, 0.6,  0,    0.15, "重爆发"),
    ("mirror-prism",   "镜像棱镜",  3.4,  0.72, 0.3,  1.2,  0.2,  "弹幕"),
    ("meteor-launcher","流星发射器",7.0,  0.15, 0.3,  0.5,  0,    "重爆发"),
    ("pulse-fan",      "脉冲扇",    3.2,  1.0,  0.2,  1.05, 0,    "扇形"),
    ("thorn-chain",    "荆棘链",    3.9,  0.42, 0.9,  0.25, 0.25, "链式"),
    ("star-scythe",    "星镰",      5.6,  0.36, 0.75, 0.45, 0,    "成长"),
    ("quantum-loom",   "量子织机",  3.4,  0.7,  0.45, 0.7,  0.35, "均衡"),
    ("redline-carbine","红线卡宾",  4.6,  0.82, 0.35, 0.25, 0,    "精准"),
]

ENEMIES = [
    {"hp":18, "dmg":4,  "xp":2,  "ac":0.05, "w":7,  "after":0},
    {"hp":24, "dmg":6,  "xp":3,  "ac":0.08, "w":4,  "after":10},
    {"hp":88, "dmg":10, "xp":8,  "ac":0.22, "w":3,  "after":18},
    {"hp":54, "dmg":7,  "xp":6,  "ac":0.16, "w":3,  "after":28},
    {"hp":160,"dmg":15, "xp":13, "ac":0.35, "w":2,  "after":38},
]

# ── 真实公式 ──
def enemy_scale(w, t): return 1 + w * 0.028 + t * 0.0018
def enemy_dmg_s(w, t): return 1 + w * 0.02 + t * 0.0009
def spawn_interval(w, t): return max(0.95, 1.42 - w * 0.035 - t / 38)
def xp_req(lv):
    if lv <= 0: return 65
    return int(65 * (1.24 ** lv) + 22 + lv * 5)
def shop_price(wi): return max(18, round(15 + 8 + int(wi / 5) * 2))

def effective_dps(dmg, rate, pierce, multi, drone, atk_mult=1.0):
    """修正版 DPS: 穿透按 AOE 放大, 散射按命中率折算"""
    base = dmg * atk_mult
    firerate = 1.8 * (1 + max(0, rate))  # 基础射速 × rate系数

    # 穿透: 每层 pierce ≈ +25% AOE 效率 (不是线性)
    pierce_aoe = 1.0 + pierce * 0.28

    # 散射: 多弹道但远距离命中率递减, 有效约 +40% per multi
    multi_eff = 1.0 + multi * 0.40

    # 无人机
    drone_d = drone * atk_mult * 12 if drone > 0 else 0

    return base * firerate * pierce_aoe * multi_eff + drone_d

def simulate(weapon, num_waves=20, rng=None):
    if rng is None: rng = random.Random()
    _, _, dmg, rate, pierce, multi, drone, _ = weapon
    atk = 1.0
    dps = effective_dps(dmg, rate, pierce, multi, drone, atk)

    hp = 100; xp = 0; lv = 0; alloy = 0; bought = 0; kills = 0
    log = []

    for wi in range(num_waves):
        dur = rng.uniform(50, 60)
        ct = wi * dur
        sc = enemy_scale(wi, ct)
        ds = enemy_dmg_s(wi, ct)
        wk = 0; ws = 0; ma = 0; pool = []; st = 0.0; dt = 0.4

        for ti in range(int(dur / dt)):
            t = ti * dt
            si = spawn_interval(wi, t); st += dt
            while st >= si and st >= 0.01:
                st -= si
                avail = [e for e in ENEMIES if wi >= e["after"]]
                if not avail: avail = [ENEMIES[0]]
                tw = sum(e["w"] for e in avail)
                r = rng.random() * tw; ch = avail[-1]
                for e in avail:
                    r -= e["w"]
                    if r <= 0: ch = e; break
                pool.append({"hp":ch["hp"]*sc, "dmg":ch["dmg"]*ds, "xp":ch["xp"], "ac":ch["ac"]})
                ws += 1

            tick = dps * dt; rem = tick; killed = []
            for idx, e in enumerate(pool):
                if rem <= 0: break
                if e["hp"] <= rem:
                    rem -= e["hp"]; killed.append(idx); wk += 1; kills += 1
                    if rng.random() < 0.38: xp += e["xp"] * 2.1
                    if rng.random() < min(0.92, e["ac"]*2.35 + wi*0.025):
                        alloy += rng.randint(2, 5) + int(wi / 4)
                else: e["hp"] -= rem; rem = 0
            for i in reversed(killed): pool.pop(i)

            for e in pool:
                if rng.random() < 0.05: hp -= e["dmg"] * 0.2
            ma = max(ma, len(pool))
            if hp <= 0: break

        while xp >= xp_req(lv):
            xp -= xp_req(lv); lv += 1; atk += 0.065
            dps = effective_dps(dmg, rate, pierce, multi, drone, atk)
        pr = shop_price(wi)
        while alloy >= pr and bought < wi + 3:
            alloy -= pr; bought += 1; atk += 0.045
            dps = effective_dps(dmg, rate, pierce, multi, drone, atk)

        log.append({"w":wi+1,"kills":wk,"alive":len(pool),"ma":ma,"dps":round(dps,1),
                     "hp":round(hp,1),"lv":lv,"items":bought})
        if hp <= 0: break

    waves = [l["w"] for l in log]
    return {"waves": len(log), "kills": kills, "level": lv,
            "items": bought, "died": len(log) if hp <= 0 else None,
            "final_dps": round(dps, 1), "tag": weapon[7]}

def run_all(n=1000, seed=42):
    results = []
    for w in WEAPONS:
        rng = random.Random(seed)
        runs = [simulate(w, rng=rng) for _ in range(n)]
        ws = sorted(r["waves"] for r in runs)
        deaths = [r["died"] for r in runs if r["died"]]
        results.append({
            "id": w[0], "name": w[1], "tag": w[7],
            "avg_w": sum(ws)/len(ws),
            "p10": ws[int(n*0.1)], "p50": ws[n//2], "p90": ws[int(n*0.9)],
            "avg_k": sum(r["kills"] for r in runs)/n,
            "avg_lv": sum(r["level"] for r in runs)/n,
            "avg_it": sum(r["items"] for r in runs)/n,
            "death%": len(deaths)/n*100,
            "dps": sum(r["final_dps"] for r in runs)/n,
        })
    return sorted(results, key=lambda r: -r["p90"])

def report(results):
    print("=" * 108)
    print("  星坠幸存者 — 武器平衡模拟 v4 (全部20把武器 + 修正AOE/散射模型)")
    print("=" * 108)
    print(f"\n{'武器':<12} {'类型':<8} {'P10':>4} {'P50':>4} {'P90':>4} "
          f"{'均杀':>6} {'均级':>5} {'均道具':>5} {'终DPS':>7}")
    print("-" * 108)

    for r in results:
        marker = " ⭐" if r["p90"] >= 8 else (" ⚠️" if r["p90"] <= 4 else "")
        print(f"{r['name']:<12} {r['tag']:<8} {r['p10']:>4} {r['p50']:>4} {r['p90']:>4} "
              f"{r['avg_k']:>6.0f} {r['avg_lv']:>5.1f} {r['avg_it']:>5.1f} "
              f"{r['dps']:>7.1f}{marker}")

    p90s = [r["p90"] for r in results]
    p50s = [r["p50"] for r in results]
    print(f"\n  全武器 P90 中位数: {sorted(p90s)[len(p90s)//2]}  "
          f"| 最高: {max(p90s)} ({results[0]['name']})  "
          f"| 最低: {min(p90s)} ({results[-1]['name']})  "
          f"| 极差: {max(p90s)-min(p90s)}")
    print(f"  全武器 P50 中位数: {sorted(p50s)[len(p50s)//2]}")

    ok = sum(1 for r in results if r["p90"] >= 7)
    print(f"\n  达标武器(P90≥7): {ok}/{len(results)} ({ok/len(results)*100:.0f}%)")
    weak = [r for r in results if r["p90"] <= 4]
    if weak:
        print(f"  ⚠️ 仍弱(P90≤4): {', '.join(r['name'] for r in weak)}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--runs", type=int, default=1000)
    p.add_argument("--seed", type=int, default=42)
    a = p.parse_args()
    report(run_all(a.runs, a.seed))

#!/usr/bin/env python3
"""
星坠幸存者 — 数值平衡模拟器 v5-correct
基于真实游戏公式，逐秒模拟，不跳过细节。
用法: python3 tools/balance_simulator.py [--runs 300] [--seed 42]
"""
import random, argparse, math
from collections import defaultdict

# ─── 武器 ───
WEAPONS = [
    ("storm-rifle",    "风暴步枪",  4.5,  1.12, 0,    0,    0,    "均衡"),
    ("split-barrel",   "裂变枪管",  3.4,  0.5,  0.9,  1.25, 0,    "散射穿透"),
    ("orbital-drone",  "轨道无人机",1.6,  0.18, 0,    0,    1.25, "无人机"),
    ("rail-cannon",    "磁轨炮",    7.2,  0.0,  1.1,  0,    0,    "重穿"),
    ("nova-shotgun",   "新星霰弹",  4.0,  0.35, 0.2,  1.65, 0,    "散射"),
    ("ion-lance",      "离子长枪",  5.5,  0.35, 0.9,  0.15, 0,    "穿刺"),
    ("ember-smg",      "余烬冲锋枪",3.2,  1.65, 0.15, 0.45, 0,    "射速"),
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

# ─── 怪物 ───
ENEMIES = [
    (18,  4,  2,  0.05, 7,  0),
    (24,  6,  3,  0.08, 4,  10),
    (88,  10, 8,  0.22, 3,  18),
    (54,  7,  6,  0.16, 3,  28),
    (160, 15, 13, 0.35, 2,  38),
]

# ─── 伤害公式 ───
def bullet_dmg(w_dmg, atk): return max(2.0, w_dmg + 16*0.15 + (atk-16))
def fire_int(w_rate, aspd): return max(0.07, 1.0/max(0.15, w_rate+aspd*0.45))
def get_pierce(w_prc, prc): return int(w_prc + prc*0.3)  # floor
def drone_dps(drn):
    if drn<=0: return 0
    c=min(8,1+int(drn/4)); iv=max(0.28,1.18-min(0.78,drn*0.035))
    return c*drn*8/iv
def get_shots(mul): return 1+min(3,int(mul/2.2))

def compute_dps(w, atk, aspd, prc, mul, drn, crit, cdmg, lch, ldm, lmx):
    dmg=bullet_dmg(w[2],atk); fi=fire_int(w[3],aspd)
    p=get_pierce(w[4],prc); shots=get_shots(mul)
    pe=1.0+p*0.35; se=1.0+(shots-1)*0.5
    ce=1.0+crit*cdmg+lch*(ldm-1)+lmx*0.5
    return dmg/max(fi,0.07)*pe*se*ce + drone_dps(drn)

# ─── 升级选项 ───
UPGS = [
    (1,12,0,0,0,0,0,0,0,0,0),  # 火控
    (1,0,0.14,0,0,0,0,0,0,0,0), # 神经
    (1,0,0,1.0,0,0,0,0,0,0,0),  # 穿透
    (1,0,0,0,0.6,0,0,0,0,0,0),  # 多弹
    (1,0,0,0,0,1.4,0,0,0,0,0),  # 无人机
    (1,0,0.14,0,0,0,0.055,0,0,0,0), # 暴击直觉
    (1,0,0,0,0,0,0.012,0.28,0,0,0), # 弱点
    (1,0,0,0,0,0,0,0,0.014,0.2,0), # 致命
    (1,5,0,0,0,0,0,0,0.012,0,0.012), # 斩杀
]

# ─── 商店道具 ───
SHOP = [
    (6,0.05,0,0,0,0,0,0),   # 高能弹匣
    (0,0,0,0,0,0.045,0.15,0), # 暴击透镜
    (1.5,-0.02,0.5,0,0,0,0,0), # 穿甲线圈
    (-2,0.02,0,0.75,0,0,0,0), # 弹幕分流器
    (8,0,0,0,0,0,0,0),       # 过载反应
    (0,0,0,0,1.1,0,0,0),     # 无人机上行链
    (2,0.1,0,0,0,0.02,0.1,0),# 高能火控
    (0,0,0.3,0,0,0,0,0),     # 穿透核心
    (0,0,0,0.4,0,0,0,0),     # 弹幕芯片
    (0,0.2,0,0,0,0,0,0),     # 加速模组
    (0,0,0,0,0,0.03,0.08,0), # 暴击模块
]

# ─── 主模拟：逐秒步进 ───
def run_one(wi, rng):
    w=WEAPONS[wi]
    atk=16.0; aspd=0.0; prc=0.0; mul=0.0; drn=0.0
    crit=0.05; cdmg=2.0; lch=0.006; ldm=2.75; lmx=0.05
    hp=180.0; shld=24.0; shld_reg=1.8; defense=4.0; dodge=0.03
    xp=0.0; lv=0; xp_next=65; alloy=0; bought=0; kills=0
    dps=compute_dps(w,atk,aspd,prc,mul,drn,crit,cdmg,lch,ldm,lmx)
    shot_timer=0; drone_timer=0

    for wi in range(20):
        dur=rng.uniform(50,60); ct=wi*dur
        hp_s=1+wi*0.028+ct*0.0018; dmg_s=1+wi*0.02+ct*0.0009
        sp=0.0; pool=[]  # 活跃怪物 HP
        w_kills=0; elapsed=0

        for _ in range(int(dur)):
            # ── 生成 ──
            si=max(0.95,1.42-wi*0.035-elapsed/38)
            sp+=1.0
            while sp>=si and sp>=0.01:
                sp-=si
                avail=[e for e in ENEMIES if wi>=e[5]]
                if not avail: avail=[ENEMIES[0]]
                tw=sum(e[4] for e in avail); r=rng.random()*tw; ch=avail[-1]
                for e in avail:
                    r-=e[4]
                    if r<=0: ch=e; break
                pool.append([ch[0]*hp_s,ch[2],ch[3]])

            # ── 射击 ──
            shot_timer+=1.0
            fi=fire_int(w[3],aspd)
            while shot_timer>=fi:
                shot_timer-=fi
                dmg=bullet_dmg(w[2],atk); p=get_pierce(w[4],prc)
                shots=get_shots(mul)
                for _ in range(shots):
                    if not pool: break
                    left=dmg; pool.sort(key=lambda e:e[0])  # 打最弱的
                    removed=[]
                    for i,e in enumerate(pool):
                        if left<=0: break
                        if e[0]<=left:
                            left-=e[0]; removed.append(i)
                            w_kills+=1; kills+=1
                            if rng.random()<0.38: xp+=e[1]*2.1
                            if rng.random()<min(0.92,e[2]*2.35+wi*0.025):
                                alloy+=rng.randint(2,5)+int(wi/4)
                        else:
                            e[0]-=left; left=0
                    for i in sorted(removed,reverse=True):
                        pool.pop(i)
                    if p<=0: break
                    # 穿透：再穿一次
                    p-=1

            # ── 无人机 ──
            if drn>0:
                drone_timer+=1.0
                dint=max(0.28,1.18-min(0.78,drn*0.035))
                while drone_timer>=dint:
                    drone_timer-=dint
                    if pool:
                        e=pool[0]; dmg_strike=drn*8
                        if e[0]<=dmg_strike:
                            w_kills+=1; kills+=1; pool.pop(0)
                            if rng.random()<0.38: xp+=e[1]*2.1
                            if rng.random()<min(0.92,e[2]*2.35+wi*0.025):
                                alloy+=rng.randint(2,5)+int(wi/4)
                        else:
                            e[0]-=dmg_strike

            # ── 怪物伤害 ──
            for e in pool:
                if rng.random()<0.05:
                    raw=6*dmg_s*0.2  # 平均怪物伤害
                    reduced=raw*max(0.3,1-defense/400)
                    if rng.random()<dodge: continue
                    if shld>0:
                        ab=min(shld,reduced); shld-=ab; reduced-=ab
                    hp-=reduced
                    if hp<=0:
                        return wi+1,kills,lv,bought,wi+1,dps

            # ── 护盾回复（每秒） ──
            shld=min(24.0,shld+shld_reg)

            elapsed+=1

        # ── 升级 ──
        while xp>=xp_next:
            xp-=xp_next; lv+=1
            xp_next=int(65*(1.24**lv)+22+lv*5)
            best=0; picked=UPGS[0]
            for up in rng.sample(UPGS,min(3,len(UPGS))):
                nd=compute_dps(w,atk+up[1],aspd+up[2],prc+up[3],mul+up[4],
                    drn+up[5],min(0.86,crit+up[6]),cdmg+up[7],lch+up[8],ldm+up[9],lmx+up[10])
                g=nd-dps
                if g>best: best=g; picked=up
            atk+=picked[1]; aspd+=picked[2]; prc+=picked[3]
            mul+=picked[4]; drn+=picked[5]; crit=min(0.86,crit+picked[6])
            cdmg+=picked[7]; lch+=picked[8]; ldm+=picked[9]; lmx+=picked[10]
            dps=compute_dps(w,atk,aspd,prc,mul,drn,crit,cdmg,lch,ldm,lmx)

        # ── 商店 ──
        wf=int(wi/4)*5
        for _ in range(15):
            price=max(50,44+22+wf)
            if alloy<price: break
            best=0; picked=None
            for item in SHOP:
                nd=compute_dps(w,atk+item[0],aspd+item[1],prc+item[2],mul+item[3],
                    drn+item[4],min(0.86,crit+item[5]),cdmg+item[6],lch,ldm,lmx)
                g=nd-dps
                if g>best: best=g; picked=item
            if picked is None or best<=0: break
            alloy-=price; bought+=1
            atk+=picked[0]; aspd+=picked[1]; prc+=picked[2]
            mul+=picked[3]; drn+=picked[4]; crit=min(0.86,crit+picked[5])
            cdmg+=picked[6]
            dps=compute_dps(w,atk,aspd,prc,mul,drn,crit,cdmg,lch,ldm,lmx)

        if hp<=0:
            return wi+1,kills,lv,bought,wi+1,round(dps,1)

    return 20,kills,lv,bought,None,round(dps,1)

# ─── 跑 ───
def run_all(n=300,seed=42):
    res=[]
    for i,w in enumerate(WEAPONS):
        rng=random.Random(seed)
        runs=[run_one(i,rng) for _ in range(n)]
        ws=sorted(r[0] for r in runs)
        deaths=[r[4] for r in runs if r[4]]
        res.append({
            "name":w[1],"tag":w[7],
            "p10":ws[int(n*0.1)],"p50":ws[n//2],"p90":ws[int(n*0.9)],
            "avg_k":sum(r[1] for r in runs)/n,"avg_lv":sum(r[2] for r in runs)/n,
            "avg_it":sum(r[3] for r in runs)/n,"dps":sum(r[5] for r in runs)/n,
        })
    return sorted(res,key=lambda r:-r["p90"])

def report(res):
    print("="*105)
    print("  星坠幸存者 — 数值平衡模拟 v5 (逐秒 真实公式)")
    print("="*105)
    print(f"\n{'武器':<12} {'类型':<8} {'P10':>4} {'P50':>4} {'P90':>4} {'均杀':>6} {'均级':>5} {'均道具':>5}")
    print("-"*105)
    for r in res:
        m=" ⭐" if r["p90"]>=8 else " ⚠️" if r["p90"]<=4 else ""
        print(f"{r['name']:<12} {r['tag']:<8} {r['p10']:>4} {r['p50']:>4} {r['p90']:>4} {r['avg_k']:>6.0f} {r['avg_lv']:>5.1f} {r['avg_it']:>5.1f}{m}")
    p90s=[r["p90"] for r in res]
    print(f"\n  P90中位数:{sorted(p90s)[len(p90s)//2]} "
          f"最高:{max(p90s)}({res[0]['name']}) 最低:{min(p90s)}({res[-1]['name']}) 极差:{max(p90s)-min(p90s)}")
    ok=sum(1 for r in res if r["p90"]>=8)
    print(f"  达标(P90>=8):{ok}/{len(res)} ({ok/len(res)*100:.0f}%)")
    weak=[r["name"] for r in res if r["p90"]<=4]
    print(f"  偏弱(P90<=4):{', '.join(weak) or '无'}")
    print(f"\n  目标: P90中位数≥7, 达标率≥60%, 极差<6")

    # 死亡分布
    best_name=res[0]["name"]; worst_name=res[-1]["name"]
    for name,label in [(best_name,"最强"),(worst_name,"最弱")]:
        wi=next(i for i,w in enumerate(WEAPONS) if w[1]==name)
        print(f"\n  --- {label}: {name} ---")
        rng=random.Random(42); d=defaultdict(int)
        for _ in range(1000):
            r=run_one(wi,rng)
            if r[4]: d[r[4]]+=1
        for w in range(1,21):
            c=d.get(w,0); bar="█"*max(0,c//8)
            print(f"  Wave {w:>2}: {c:>4} {bar}")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--runs",type=int,default=300)
    p.add_argument("--seed",type=int,default=42)
    a=p.parse_args()
    report(run_all(a.runs,a.seed))

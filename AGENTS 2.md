# ⚠️ AI AGENT 在读这个文件前，不要改任何代码

这个文件是本项目的权威约束。每次修改代码前，必须确认改动不违反以下规则。

---

## 1. 这是什么游戏

**星坠幸存者**（Starfall Survivor）= Cocos Creator 3.8.8 + TypeScript，抖音小游戏（竖屏 720×1280）。

**核心循环**：
```
进入战斗 → 自动射击 → 杀怪 → 合金/宝箱掉落（XP 直接获得，不需捡）
→ 升级（3 选 1 属性成长，数值随机范围）→ 商店买道具（6 格，用合金）→ 更强
→ 波次推进，怪物越密越强
→ 死亡/撤离 → 永久进度（机库装备升级 + 副武器合成/升级）
```

**关键约束**：战斗内装备 1 主武器 + 1 副武器（同时生效，不切换）。
主武器升级/强化在机库完成；副武器有独立的合成+升级面板。副武器不占用道具槽。

---

## 2. 战斗内系统真实机制（最重要，AI 经常搞错）

### 2.1 伤害公式（源码位置）

**子弹伤害** `projectileManager.ts getBulletDamage()` (加法不复利)：
```typescript
bulletDamage = max(2,
  weaponDamage × (1 + (level - 1) × 0.12 + weaponDamagePct)
  + baseAttackPower × 0.15 + (attackPower - baseAttackPower))
```

**开火间隔** `projectileManager.ts getFireInterval()` (加法不复利)：
```typescript
fireInterval = max(0.07, 1 / max(0.15,
  weaponFireRate × (1 + (level - 1) × 0.10 + weaponFireRatePct + critBoost)
  + attackSpeed × 0.45))
```

**穿透个数** `projectileManager.ts getBulletPierce()`：
```typescript
pierce = floor(weaponPierce × (1 + (level - 1) × 0.10) + characterPierce + pierceStacks)
       + (random < fractional_part ? 1 : 0)   // 随机额外穿透
```

**弹速** `projectileManager.ts getBulletSpeed()`：
```typescript
bulletSpeed = max(260, 300 + weaponBulletSpeed × (1 + (level - 1) × 0.08) × 140 + bonus × 0.4)
```

**每级成长率**（统一在 `combatFormulas.ts`）：
| 属性 | 每级 |
|---|---|
| 伤害 | +12% |
| 射速 | +10% |
| 穿透 | +10% |
| 弹速 | +8% |
| 无人机 | +8% |

**baseAttackPower = 16**（`createBaseCharacterStats()` 的值）

### 2.2 无人机伤害（`combatFormulas.ts`）

```typescript
droneCount = min(8, 1 + floor(dronePower / 4))
droneInterval = max(0.28, 1.18 - min(0.78, dronePower × 0.035))
每轮电击伤害 ≈ dronePower × 8
```

### 2.3 角色属性来源（`RogueShooterGame.ts`）

```
stats = createBaseCharacterStats()        // 基础属性
     + runStats                           // 升级选项 + 商店道具
     + weaponStat('fireRate')×0.18       // 武器属性贡献（战斗内不升级）
     + weaponStat('pierce')×0.18
     + 装备 gearStats×gearLevel          // 战斗内装备 level 固定为 1
```

### 2.4 升级系统（`runItemCatalog.ts LEVEL_UP_BLUEPRINTS`）

每次升级 → 3 选 1 → 直接加到 runStats（永久本局），**纯加不减**。

XP 直接获得（杀怪时自动加，不需要捡经验球）。只有合金、宝箱需要捡。

每个升级选项的数值是**随机范围**，每次 roll 不同。

**4 大类 × 3 种 = 12 种属性（2026-07-02 加强版，每级3选1）：**

| 💪 力量 | 范围 | ⚡ 敏捷 | 范围 | ❤️ 体魄 | 范围 | 🎯 技巧 | 范围 |
|---|---|---|---|---|---|---|---|
| 攻击强化 `attackPower` | +8~16 | 神经反射 `attackSpeed` | +0.05~0.12 | 生命扩展 `maxHp` | +30~60 | 精准瞄准 `attackRange` | +55~120 |
| 暴击训练 `critChance` | +4%~10% | 移速强化 `moveSpeed` | +18~42 | 护盾扩容 `shieldMax` | +24~48 | 穿透强化 `pierceDamagePct` | +12%~28% |
| 弱点打击 `critDamage` | +15%~36% | 身法训练 `dodgeChance` | +4%~7% | 坚韧体质 `damageReduction` | +3%~6% | 无人机指挥 `dronePower` | +1.0~4.5 |

> `attackPower` 和 `attackSpeed` 是升级**专属**属性（道具不加）。

### 2.5 商店系统（`equipmentManager.ts`）

**卖的是 RUN_ITEM（本局道具），不是武器。**

```
价格 = max(50, round((44 + tier×22 + waveFee + cycleFee) × endlessMultiplier × cumulativeMultiplier))
waveFee = floor(waveIndex/4) × 5
cycleFee = (endlessCycle-1) × 10
```

**定价公式不变**，但 **取消硬上限**（`MAX_RUN_ITEM_SLOTS = 999`），可以无限买。累计涨价 35%/件 保持不变，后期越来越贵但不会硬卡你。

**道具全是纯正面效果**，无负面。22 件 blueprint × 5 个 tier = 110 个道具实例。
按 category 分布：攻击(12) / 防御/生存/机动(10) / 资源/成长/其他(5) / 混合(5)。

### 2.6 XP 曲线（`combatState.ts`）

```
xpToNext = 65 × 1.24^level + 22 + level × 5
XP 掉率 = 56%，掉落量 = monsterXP × 2.6
```

### 2.7 怪物公式（`waveCatalog.ts` + `enemyManager.ts` + `enemyCatalog.ts`）

**10 种基础怪**（`BASE_ENEMY_ARCHETYPES`）：

| 怪 | HP | 伤害 | 速度 | 权重 | 首次出 |
|---|---:|---:|---:|---:|---:|
| 碎壳虫 mite | 18 | 4 | 126 | 7.0 | 波 1+ |
| 疾行体 runner | 24 | 6 | 196 | 4.0 | 波 3+ |
| 重甲块 brute | 88 | 10 | 78 | 3.0 | 波 5+ |
| 裂变囊 splitter | 54 | 7 | 112 | 3.0 | 波 7+ |
| 磁暴卫士 warden | 160 | 15 | 92 | 2.0 | 波 9+ |
| 自爆虫 bomber | 14 | 8 | 140 | 3.0 | 波 4+ |
| 蜂群 swarm | 8 | 2 | 140 | 3.0 | 波 2+ |
| 灵能体 aura | 40 | 5 | 80 | 1.5 | 波 6+ |
| 追踪眼 seeker | 30 | 8 | 100 | 2.0 | 波 8+ |
| 信标 beacon | 60 | 0 | 0 | 1.0 | 波 9+ |

**显式压力表**：波1～9的间隔、批次、场上限、HP/伤害进度系数统一由 `waveCatalog.ts::EARLY_WAVE_PROFILES` 提供；波10走Boss状态机；波11+使用指数公式。阵型只能重新分配固定budget，不得额外补怪。

**场上限**：波 1: 40 → 波 8+: 240 / 波 11+: max(240, 200×1.05^(wave-10)), min(600)

**HP 缩放** = 1 + wave×0.028 + combatTime×0.0018
**伤害缩放** = 1 + wave×0.012 + combatTime×0.0009

**无尽缩放**：波 ≥ 11 时，scale = 1.05^(wave-10)，作用于 HP/伤害/间隔/上限。

**5 种小 Boss**（波14起非Boss波开波只判定一次，35%命中后于20～35秒出现，每波最多1只；不掉Boss材料，不挡进度）：
狂暴重甲块 / 电弧灵能体 / 自爆母体 / 迅捷分裂体 / 再生巨兽

**5 种大 Boss**（波10/13/16...；intro 3秒，combat每5秒3～4只援军上限24，60秒overtime后每10秒4只上限16，死亡2.5秒后进下一波）：虚空巨像 / 噬能蠕虫 / 冰霜女皇 / 狱炎领主 / 虚空织网者

### 2.8 武器系统（`weaponCatalog.ts`）

**17 把主武器**（3 把传说 + 14 把基础），详见 `weaponCatalog.ts`：

**15 把副武器**（设计基线见 `docs/offhand_weapon_design.md`），分类：
- 环绕型 3 把（回旋利刃 / 守护星环 / 烈焰漩涡）
- 召唤型 4 把（影刃猎手 / 静电蜂群 / 幽影分身 / 治愈蜂鸟）
- 控场型 3 把（冰霜地雷 / 静电力场 / 黑曜石封印）
- 爆发型 3 把（虚空裂隙 / 暴风之眼 / 时间扭曲）
- 防御/辅助 2 把（纳米修复器 / 铜墙护盾）

副武器独立升级（T1-T5），使用独立材料系统。

| 分组 | 武器 |
|---|---|
| Novice | 风暴步枪 / 瘟疫喷射器 / 霜束发射器 |
| Standard | 回声弓 / 裂变枪管 / 镜像棱镜 / 量子织机 |
| Boss Gate | 荆棘连弩 / 虚空针 / 离子长枪 / 磁轨炮 |
| Boss Clear | 流星发射器 / 轨道无人机 / 重力锤 |
| Legendary | 虚空撕裂者 / 冰狱审判 / 织网支配者 |

**变体系统**：10 种变体（T1~T10），同一武器换变体改变定位。
T3 脉冲：伤害系数 ×4.44（设计意图：均衡提升，大幅增加单发伤害）

### 2.9 机制词条（17 个，已全接入）

| ID | 武器 | 机制 | 状态 |
|---|---|---|---|
| `crit_stacks` | 风暴步枪 | 暴击叠加攻速，5 层封顶，6 秒不暴击衰减 1 层 | ✅ |
| `slow` | 霜束发射器 | 命中减速 0.4 秒 | ✅ |
| `poison` | 瘟疫喷射器 | 叠 5 层毒，每层 1%/秒，1 秒 tick | ✅ |
| `knockback` | 重力锤 | 命中击退，暴击 2 倍 | ✅ |
| `multishot_3` | 裂变枪管 | 同时 3 颗扇形分布 | ✅ |
| `radial_5` | 镜像棱镜 | 5 颗 360° 全方向散射 | ✅ |
| `split` | 量子织机 | 飞行 0.5 秒后分裂 2 颗 | ✅ |
| `pierce_stacks` | 回声弓 | 暴击叠加穿透，6 秒衰减 | ✅ |
| `pierce_bonus` | 磁轨炮 | 每次穿透 +8% 伤害 | ✅ |
| `straight` | 离子长枪 | 弹道笔直不衰减 | ✅ |
| `ricochet` | 荆棘连弩 | 撞墙反弹 2 次，每次 +15% 伤害 | ✅ |
| `aoe_burn` | 流星发射器 | 命中留 3 秒燃烧区，每秒 12% 攻击力 | ✅ |
| `drone_charge` | 轨道无人机 | 击杀充能，满 100% 召唤爆炸无人机 | ✅ |
| `crit_master` | 虚空针 | 高暴击率+暴击伤害加成 | ✅ |
| `void_tearer` | 虚空撕裂者（传说） | 穿透叠加虚空撕裂，每穿透 +18% 伤害（比磁轨炮更暴力） | ✅ |
| `icefire_judge` | 冰狱审判（传说） | 冰弹减速 + 火弹爆炸，击杀触发 90 范围 AOE | ✅ |
| `webmaster_lifesteal` | 织网支配者（传说） | 击杀回血 15% + 无人机充能爆炸 + 缓速 | ✅ |

### 2.10 装备系统（`equipmentCatalog.ts`）

**Starter 装备**（开局自带）：
tactical-visor（攻击范围+36，暴击率+1.2%）/
phase-armor（生命+22，物防+2.2，魔防+1，火防+1，冰防+1）/
kinetic-boots（移速+17，闪避率+0.8%）/
magnet-coil（拾取范围+22，幸运+1.2）

**装备品质**：普通 / 稀有 / 史诗 / 传奇 / 神话

**武器解锁进度**（`equipmentProgression.ts`）：
- 家族解锁：按完成战斗次数逐步解锁
- 变体 T2-T10：按完成战斗次数 + 蓝图数量解锁
- T9+ 需要蓝图，蓝图由 Boss 低概率掉落

---

## 3. 绝对不能改的东西

| 项 | 原因 |
|---|---|
| `core/stats.ts` 的 `createBaseCharacterStats()` | 所有公式依赖这些基础值 |
| `core/types.ts` 的 `CharacterStats` / `StatKey` | 全项目用这套类型 |
| `combatFormulas.ts` | 伤害/射速/穿透/弹速的纯函数，测试和游戏共享 |
| `combatState.ts` 的 `xpToNext` 初始值和升级公式 | 已经过平衡调整（65/1.24/22+lv×5） |
| `state/combatState.ts` 的状态字段名 | 多模块共享 |
| `assets/resources/audio/` 下的音效文件名 | 代码里硬编码引用 |
| `STARTER_EQUIPMENT_IDS` 数组内容 | 新手装备已固定 |
| 抖音小游戏包体 < 20MB 限制 | 构建配置不能动 |
| `docs/offhand_weapon_design.md` 的 15 把副武器基准 | 基线设计，副武器数量/类型修改需重新确认 |
| `catalogs/offhandCatalog.ts` 的 15 把副武器数据 | 与 design.md 同步，修改需同时更新两端 |
| `offhand/offhandManager.ts` 的 15 种机制实现 | 每种机制对应一把副武器，不能随意改机制类型 |

---

## 4. 改代码时的规则

### 4.1 数值修改必须跑验证

```bash
# TypeScript 编译
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json

# 数值平衡：跑真实 Cocos 游戏 + CDP bot
npm run balance:cdp
# 或 pipeline（多把武器）
npm run balance:pipeline
```

### 4.7 CDP 自动化测试工作流（正确流程）

**核心入口**（带自动构建/清理/报告，一次搞定）：

| 用途 | 命令 | 说明 |
|---|---|---|
| 快速烟测 | `npm run balance:e2e:smoke` | 1 把武器(风暴步枪) × 1 局 × 240s |
| 全武器平衡 | `npm run balance:pipeline` | 17 把武器 × 3 局 × 720s/局 |
| 手动单测 | `python3 tools/bot/run_balance_e2e.py --runs 1 --weapon X --seed 42 --skip-build` | 指定武器、seed |

**关键规则（踩过的坑）：**

1. **`--skip-build` 优先** — 只要 `build/web-mobile/assets/main/index.js` ≥ 100KB 且含 `__starfallGame`，就 `--skip-build`。省掉 2-3 分钟的构建时间。
2. **验证 build 是否有效**：
   ```bash
   python3 -c "text=open('build/web-mobile/assets/main/index.js','r',encoding='utf-8').read(); print(f'size: {len(text)//1024}KB, __starfallGame: {\"__starfallGame\" in text}')"
   ```
3. **必须重新构建时**：`python3 tools/bot/build_web_mobile_for_bot.py` 会自动处理种子恢复和重试。**不要手动开 Cocos GUI 等导入**（没用，GUI 360s 也导不完）。不要 `rm -rf library/`（删了更慢）。
4. **构建失败 `scenes=0/scripts=0`**：自动重试机制已经修复（去掉了 `clean_editor_cache=True` 的白给轮次）。如果还是失败，检查 `library/` 下有无 macOS 冲突副本（`* 2*` 文件），有就删了重跑。
5. **CDP bot 找不到钩子**：跑不起来时检查 `build_web_mobile_for_bot.py` 的输出——`__starfallGame` 和 `__starfallBulkTick` 必须都在 index.js 里。不在的话说明 Cocos 缓存了旧代码，删一次 `temp/` 再构建。
6. **Cocos CLI 构建缓存过强**：如果改代码后构建时间 < 10s 且产物没变，说明缓存命中跳过了重编译。删 `rm -rf temp/` 再构建。

### 4.2 新增武器格式（`weaponCatalog.ts`）

```typescript
// WEAPON_FAMILIES
{ id, name, color, damage, fireRate, pierce, drone, bulletSpeed, mechanic, desc }
// WEAPON_VARIANTS
{ id, prefix, suffix, tier, damage, fireRate, pierce, drone, speed, cost }
```

变体 `damage`/`fireRate` 等是**倍率系数**（如 0.86 表示 ×0.86，4.44 表示 ×4.44），不是绝对值。
装备价格 = `baseDamage × 5 + tier.cost × 30 × rarityMultiplier`。

### 4.3 新增怪物格式（`enemyCatalog.ts`）

```typescript
{ id, name, family, artId, hp, speed, damage, radius, xp,
  alloyChance, color, accent, unlockWave, weight,
  bossMaterial? }  // bossMaterial: 大 Boss 掉落材料
```

基础值会被 HP/伤害缩放公式直接乘。`unlockWave` 是唯一首次出现规则；组合实例取家族和变体解锁波次的较大值，候选池累计扩大。

### 4.4 新增道具格式（`runItemCatalog.ts`）

```typescript
{ id, name, category, color, effects: [{ stat, amount }] }
```

blueprint 基础值 × tier 缩放后生效。正面无负面道具不加 1.24 倍率。

### 4.5 新增装备格式（`equipmentCatalog.ts`）

```typescript
{ id, name, slot, color, baseCost, desc, effects: [{ stat, amount }] }
```

`gearStats` 乘 `gearLevel`（机库升级，战斗内固定 level=1）。

### 4.6 不能动 Cocos 节点结构

场景 JSON 里有 UUID 引用，手动编辑会破坏。所有节点用代码创建。

---

## 5. 文件结构

```
assets/scripts/
├── RogueShooterGame.ts              # 主入口，所有系统协调
├── core/
│   ├── types.ts                     # CharacterStats / StatKey / WeaponStats / EquipmentDef / EnemySpec
│   ├── stats.ts                     # createBaseCharacterStats / addCharacterStats / STAT_META
│   ├── resources.ts                 # 资源定义和钱包
│   ├── gameContext.ts               # GameEventBus
│   └── combatFormulas.ts            # 伤害/射速/穿透/弹速纯函数（测试和游戏共享）
├── catalogs/
│   ├── weaponCatalog.ts             # 17 把武器（14 基础 + 3 传说）+ 10 种变体
│   ├── equipmentCatalog.ts           # 装备蓝图 + 品质 + Starter 装备
│   ├── equipmentProgression.ts       # 武器/装备解锁进度
│   ├── runItemCatalog.ts            # 22 blueprint × 5 tiers 道具 + 12 种升级选项
│   ├── enemyCatalog.ts              # 10 种基础怪 + 5 小 Boss + 5 大 Boss + 11 变体
│   └── waveCatalog.ts               # 波1~9压力、Boss状态机、小Boss调度、阵型budget
├── enemy/
│   ├── enemyManager.ts              # 怪物生成/更新/死亡/分裂
│   └── enemyConstants.ts            # 怪物常量
├── projectile/
│   └── projectileManager.ts          # 子弹伤害/穿透/速度/14 个机制词条
├── pickup/
│   └── pickupManager.ts             # XP/合金掉落、升级选择、宝箱
├── shop/
│   └── equipmentManager.ts           # 商店系统、装备管理、机库
├── state/
│   └── combatState.ts               # 战斗状态（xpToNext 等在这里）
├── flow/
│   └── battleFlow.ts                # 战斗流程纯函数（撤离/结算/提示）
└── ui/
    └── panels.ts                    # UI 面板管理
tools/bot/
├── run_balance_cdp.py               # 单把武器 CDP 测试
└── run_balance_pipeline.py          # 多把武器 CDP 批量测试
tests/                               # 纯 TS 测试
├── catalogs/                        # catalog 正确性测试
├── core/                            # 公式正确性测试
├── balance/                         # DPS / 波次需求 / P50 估算测试
└── flows/                          # 战斗流程测试
```

---

## 6. 已知问题 / 已知待调

| 问题 | 状态 | 位置 |
|---|---|---|
| 裂变囊分裂旧残留代码（spawn mite） | ✅ 已修复（删重复） | enemyManager.ts L1827 |
| 波 10 Boss 需要走位风筝，Bot 打不过但真人可过 | 已确认 | enemyManager.ts spawnBoss() |
| boss_gate/boss_clear 武器偏弱 | 待调 | 需 CDP 重新跑 1200s 验证 |
| 瘟疫 DoT 每层 1%/秒（代码），文档写 0.4%/层 | 需确认是否过强 | projectileManager.ts onPoisonHit / enemyManager.ts dot |
| T3 脉冲 damage 系数 ×4.44（代码），文档写 ×1.04 | 文档已更正，代码值正确 | weaponCatalog.ts T3 pulse |

*最后更新：2026-07-01*
*本文件是 AI 修改代码前的必读文件。违反以上规则的修改不会被接受。*

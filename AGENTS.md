# ⚠️ AI AGENT 在读这个文件前，不要改任何代码

这个文件是本项目的权威约束。每次修改代码前，必须确认改动不违反以下规则。

---

## 1. 这是什么游戏

**星坠幸存者**（Starfall Survivor）= Cocos Creator 3.8.8 + TypeScript，抖音小游戏（竖屏 720×1280）。

**核心循环**：
```
进入战斗 → 自动射击 → 杀怪 → XP/合金掉落
→ 升级（3选1属性成长）→ 商店买道具（6格，用合金）→ 更强
→ 波次推进，怪物越密越强
→ 死亡/撤离 → 永久进度（机库装备升级）
```

**关键约束**：战斗内武器固定1把，不会换武器。武器升级只在战后机库完成。

---

## 2. 战斗内系统真实机制（最重要，AI 经常搞错）

### 2.1 伤害公式（projectileManager.ts:176-213）

```typescript
// 子弹伤害
bulletDamage = max(2, weaponDamage × weaponLevel + baseAttackPower×0.15 + (attackPower - baseAttackPower))
// 开火间隔
fireInterval = max(0.07, 1 / max(0.15, weaponFireRate × weaponLevel + attackSpeed × 0.45))
// 穿透（整数地板）
pierce = floor(weaponPierce × weaponLevel + characterPierce × 0.3)
// 多弹丸（不是每次触发，有门槛）
spreadPower = character.multiShot
guaranteedExtra = min(3, floor(spreadPower / 2.2))  // 每次射击额外弹道
// 低于 2.2 只有概率触发侧射
```

**baseAttackPower = 16**（createBaseCharacterStats 里的值）
**weaponLevel = 战斗内等于机库等级**（非固定 1），每级成长：伤害+12%、射速+10%、穿透+10%、弹速+8%、多弹丸+8%、无人机+8%

### 2.2 无人机伤害

```
droneCount = min(8, 1 + floor(dronePower / 4))
droneInterval = max(0.28, 1.18 - min(0.78, dronePower × 0.035))
每轮电击伤害 ≈ dronePower × 8
```

### 2.3 角色属性来源（RogueShooterGame.ts:1959-1989）

```
stats = createBaseCharacterStats()        // 基础属性
     + runStats                           // 升级选项 + 商店道具加的属性
     + weaponStat('fireRate')×0.18        // 武器属性贡献（战斗内不升级）
     + weaponStat('pierce')×0.18
     + weaponStat('multiShot')
     + weaponStat('drone')
     + 装备 gearStats×gearLevel           // 战斗内装备 level 固定为 1
```

### 2.4 升级系统（runItemCatalog.ts STAT_UPGRADE_BLUEPRINTS）

每次升级 → 3 选 1 → 直接加到 runStats 上（永久本局）。

**攻击选项**（选这些会直接影响 DPS）：
| 选项 | 效果 |
|---|---|
| 火控训练 | attackPower +16 |
| 神经加速 | attackSpeed +0.14 |
| 穿透训练 | pierce +1.2 |
| 多弹操控 | multiShot +0.75 |
| 无人机指挥 | dronePower +1.4 |
| 暴击直觉 | critChance +0.055 |
| 弱点解析 | critDamage +0.28, critChance +0.012 |
| 致命判断 | lethalChance +0.014, lethalDamage +0.2 |

### 2.5 商店系统（equipmentManager.ts:448-489）

**卖的是 RUN_ITEM（本局道具），不是武器。**

```
RUN_ITEM 有 tier (1-5)，随战斗时间解锁
价格 = max(46, round((44 + tier×18 + waveFee + cycleFee) × typeMultiplier))
waveFee = floor(waveIndex/4) × 5
cycleFee = (endlessCycle-1) × 10
```

RUN_ITEM 买后直接 `applyRunItem(id)` 加到 runStats，效果和升级选项一样。

### 2.6 XP 曲线

```
xpToNext = 65 × 1.24^level + 22 + level×5
XP 掉率 = 56%，掉落量 = monsterXP × 2.6
```

### 2.7 怪物公式

```
生成间隔 = max(0.95, 1.42 - wave×0.035 - elapsed/38)
HP 缩放 = 1 + wave×0.028 + combatTime×0.0018
伤害缩放 = 1 + wave×0.02 + combatTime×0.0009
每批数量 = 3 + floor(wave×0.45) + floor(elapsed/24) + rand(0,2)
波时长 = uniform(50, 60) 秒
```

### 2.8 Starter 装备

```
storm-rifle:    weaponStats.damage=4.5, fireRate=1.12, pierce=0, multi=0, drone=0
tactical-visor: attackRange+36, critChance+0.012
phase-armor:    maxHp+22, physicalDefense+2.2, magicDefense+1
kinetic-boots:  moveSpeed+17, dodgeChance+0.008
magnet-coil:    pickupRange+22, luck+1.2
```

---

## 3. 绝对不能改的东西

| 项 | 原因 |
|---|---|
| `core/stats.ts` 的 `createBaseCharacterStats()` | 所有公式依赖这些基础值 |
| `core/types.ts` 的 `CharacterStats` / `StatKey` | 全项目用这套类型 |
| `projectileManager.ts` 的 `getBulletDamage()` / `getFireInterval()` / `getBulletPierce()` | 伤害公式，改了会影响全局平衡 |
| `combatState.ts` 的 `xpToNext` 初始值和升级公式 | 已经过平衡调整（65/1.24/22+lv×5） |
| `state/combatState.ts` 的状态字段名 | 多模块共享 |
| `assets/resources/audio/` 下的音效文件名 | 代码里硬编码引用 |
| `STARTER_EQUIPMENT_IDS` 数组内容 | 新手装备已固定 |
| 抖音小游戏包体 < 20MB 限制 | 构建配置不能动 |

---

## 4. 改代码时的规则

### 4.1 数值修改必须跑验证

```bash
# TypeScript 编译
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json

# 数值平衡：跑真实 Cocos 游戏 + CDP bot（不要用 Python 重写战斗仿真）
# 先启动 web-mobile/preview，并用 headed Chrome --remote-debugging-port=9222 打开游戏页
npm run balance:cdp
```

**当前无广告生存目标按武器阶段分层，不再统一按 8-12 波判断：**

| 阶段 | 目标 |
|---|---|
| 新手/弱武器 | P50 死在 5-6 波，P90 不超过 7 |
| 中等武器 | P50 死在 8-9 波，P90 不超过 10 |
| 强武器 | 可以见到第一只 Boss，但多数局打不过（P50≈10，P90≤10） |
| 顶级武器 | 可以刚好打过第一只 Boss，但不应一路滚到 20 波（P50≈11，P90≤12） |

```bash
# Cocos 抖音构建（可选）
'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator' \
  --project /Users/ronghui/Documents/game_dev_cocos \
  --build 'platform=bytedance-mini-game;debug=false'
```

### 4.2 新增武器必须在 weaponCatalog.ts

格式：
```typescript
{ id: 'xxx', name: 'xxx', color: '#HEX',
  damage: N, fireRate: N, pierce: N, multiShot: N, drone: N,
  bulletSpeed: N, cost: N, desc: 'xxx' }
```
- `damage` 和 `fireRate` 直接乘 weaponLevel（=1）算伤害
- `pierce` 乘 weaponLevel 后 + characterPierce×0.3，再 floor
- `cost` 是商店购买价（机库用 cores/shards，不是合金）

### 4.3 新增怪物必须在 enemyCatalog.ts

格式：
```typescript
{ id: 'xxx', name: 'xxx', family: 'xxx', artId: 'xxx',
  hp: N, speed: N, damage: N, radius: N, xp: N,
  alloyChance: 0.0N, color: '#HEX', accent: '#HEX', spawnAfter: waveN, weight: N }
```
- `hp` 和 `damage` 会被 HP缩放/伤害缩放 直接乘
- `spawnAfter` = 最早出现的波次（0-based index）
- `weight` = 生成权重（越大越常出现）

### 4.4 新增道具必须在 runItemCatalog.ts

格式：
```typescript
{ id: 'xxx', name: 'xxx', category: '攻击|防御|元素防御|资源|成长|机动|其他属性',
  color: '#HEX', effects: [{ stat: 'xxx', amount: N }] }
```
- `effects` 直接加到 runStats 上（和升级选项完全一样的机制）
- 正面 +1.24 倍率（TRADEOFF_POSITIVE_BONUS）只在有负面效果时触发
- 同 category 的道具在3选1里不会同时出现

### 4.5 新增装备必须在 equipmentCatalog.ts

格式：
```typescript
{ id: 'xxx', name: 'xxx', slot: 'hat|armor|boots|accessory',
  color: '#HEX', baseCost: N, desc: 'xxx',
  effects: [{ stat: 'xxx', amount: N }] }
```
- `gearStats` 乘 `gearLevel`（机库升级，战斗内固定 level=1）
- 同 slot 不能装备两件

### 4.6 不能动 Cocos 节点结构

场景 JSON 里有 UUID 引用，手动编辑会破坏。所有节点用代码创建。

### 4.7 音效文件

`sfx_*` 和 `bgm_*` 文件名硬编码在 `RogueShooterGame.ts`，改文件名必须同步改代码。

---

## 5. 文件结构（实际目录，非目标目录）

```
assets/scripts/
├── RogueShooterGame.ts              # 主入口，所有系统协调
├── core/
│   ├── types.ts                     # CharacterStats / StatKey / WeaponStats / EquipmentDef
│   ├── stats.ts                     # createBaseCharacterStats / addCharacterStats
│   ├── resources.ts                 # 资源定义和钱包
│   └── gameContext.ts               # GameEventBus
├── catalogs/
│   ├── weaponCatalog.ts             # 20 把武器定义 + 变体系统
│   ├── equipmentCatalog.ts          # 装备蓝图 + 品质 + STARTER_EQUIPMENT_IDS
│   ├── enemyCatalog.ts              # 5 种基础怪 + Boss
│   └── runItemCatalog.ts            # 商店道具 + 升级选项（STAT_UPGRADE_BLUEPRINTS）
├── enemy/
│   ├── enemyManager.ts              # 怪物生成/更新/死亡/分离
│   └── enemyConstants.ts            # 怪物常量（掉率等）
├── projectile/
│   └── projectileManager.ts         # 子弹伤害/穿透/速度/多弹丸
├── pickup/
│   └── pickupManager.ts             # XP/合金掉落、升级选择、宝箱
├── shop/
│   └── equipmentManager.ts          # 商店系统、装备管理、机库
├── state/
│   └── combatState.ts               # 战斗状态（xpToNext 等在这里）
└── ui/
    └── panels.ts                    # UI 面板管理

tools/
└── bot/
    └── run_balance_cdp.py           # 真实 Cocos 运行时 + CDP bot 数值平衡测试

docs/
├── AGENTS.md                        # 本文件（AI 权威参考）
├── GDD.md                           # 游戏设计文档
├── PROJECT_ARCHITECTURE.md          # 架构设计
├── CODING_STANDARDS.md              # 编码规范
├── REFACTORING_PLAN.md              # 重构计划
└── playtest/
    └── PLAYTEST_TEMPLATE.md         # Playtest 记录模板
```

---

## 6. 已知问题

| 问题 | 状态 | 位置 |
|---|---|---|
| 主文件 RogueShooterGame.ts 仍 6000+ 行 | 待拆 | 整个文件 |
| 需要真实 CDP 跑局数据补充分层样本 | 待做 | tools/bot/run_balance_cdp.py |

---

*最后更新：2026-06-25*
*本文件是 AI 修改代码前的必读文件。违反以上规则的修改不会被接受。*

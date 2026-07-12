# 星坠幸存者：游戏机制实现基线

> 基线日期：2026-07-11
>
> 适用版本：Cocos Creator 3.8.8 / TypeScript / 抖音小游戏 / 720×1280 竖屏
>
> 本文只描述当前源码能够确认的运行事实。设计期望、未接线功能和历史文档冲突统一登记在 [`BASELINE_GAPS.md`](./BASELINE_GAPS.md)。

## 1. 文档权威规则

后续开发按以下顺序判断事实：

1. `AGENTS.md`：项目边界、禁止修改项和设计约束。
2. 实际运行入口与 Manager：当前游戏真实行为。
3. `catalogs/`：内容数量、基础数值和静态配置。
4. 本文：以上源码在 2026-07-11 的机制索引和解释。
5. 带日期的平衡计划、审查报告和测试记录：仅作历史资料，不定义当前行为。

当 `AGENTS.md`、本文与源码不一致时，不得自行选择一个版本继续开发。先在 `BASELINE_GAPS.md` 登记，再决定修代码还是修设计文档。

## 2. 核心循环与状态流

核心循环：

```text
主菜单 → 机库整备 → 进入战斗 → 自动索敌射击 → 击杀获得 XP
→ 拾取合金/材料/宝箱 → 升级三选一或商店购买本局道具
→ 波次推进与 Boss → 主动撤离或死亡 → 复活/结算 → 返回机库
```

`GamePhase` 当前包含：

| 状态 | 用途 |
|---|---|
| `menu` | 主菜单 |
| `hangar` | 机库、装备、合成与结算后的整备 |
| `combat` | 战斗更新运行 |
| `paused` | 手动暂停或死亡复活等待 |
| `level-up` | 属性成长三选一，战斗更新暂停 |
| `item-choice` | 宝箱道具三选一，战斗更新暂停 |
| `discard` | 理论上的道具替换状态；当前上限为 999，正常局内基本不会进入 |
| `shop` | 战场商店，战斗更新暂停 |
| `loot` | Boss 战利品流程的状态类型；新结算弹窗主要在 `hangar` 阶段承载选择 |

只有 `phase === 'combat'` 时，角色、刷怪、子弹、敌人、副武器、掉落和战斗计时才会更新。

权威源码：

- `assets/scripts/core/types.ts`：`GamePhase`、`BattleEndReason`
- `assets/scripts/state/combatState.ts`：战斗状态字段与单局重置
- `assets/scripts/RogueShooterGame.ts`：`update()`、`beginBattle()`、暂停、撤离、死亡与结算编排
- `assets/scripts/flow/battleFlow.ts`：结算流纯函数

## 3. 出战配置

当前出战容量为：

```text
1 把主武器 + 4 件部位装备 + 0~1 把独立副武器
```

- 主武器至少保留 1 把，否则不能进入战斗。
- 点击另一把已拥有的主武器时，会原子替换当前主武器，不占用额外槽位。
- 四个装备部位固定为帽子、护甲、鞋子、首饰；每个部位最多 1 件。
- 副武器使用独立存档字段，不占主武器或装备槽；装备后与主武器同时自动生效，不进行战斗内切换。
- 默认 Starter 配置为冲锋枪、战术目镜、相位护甲、动能靴、磁吸线圈；副武器默认可为空。

权威源码：

- `assets/scripts/shop/equipmentManager.ts`：`EQUIPPED_SLOT_COUNT`、`MAX_EQUIPPED_WEAPONS`、`MAX_EQUIPPED_GEAR`、`normalizeEquippedEquipment()`、`toggleSelectedEquipment()`
- `assets/scripts/shop/equipmentLoadout.ts`：主武器原子替换
- `assets/scripts/catalogs/equipmentCatalog.ts`：`STARTER_EQUIPMENT_IDS`
- `assets/scripts/RogueShooterGame.ts`：`beginBattle()` 中主、副武器同步

## 4. 角色属性与战斗公式

### 4.1 属性来源

最终角色属性由以下来源叠加：

```text
基础属性 createBaseCharacterStats()
+ 本局 runStats（升级三选一和本局道具）
+ 主武器贡献：家族 attackRange 替换基础420，再叠加 run/gear 范围；fireRate×0.18、bulletSpeed×6、pierce×0.18、drone
+ 已装备 gearStats×该装备持久等级
+ 幸运对暴击、致命、闪避、XP、资源收益的换算
```

关键基础值：攻击力 16、攻击距离 420、暴击率 5%、暴击伤害 2 倍、最大生命 50、基础护盾 12、移动速度 180、拾取范围 82。`getMaxHp()` 另设 60 的运行时下限。

最终属性还会执行边界限制，例如攻速 `[-0.55, 4.5]`、暴击率最高 86%、致命率最高 28%、减伤最高 72%、闪避最高 72%。

### 4.2 主武器等级成长

| 属性 | 每个装备等级的线性成长 |
|---|---:|
| 武器伤害 | +12% 基础值 |
| 武器射速 | +10% 基础值 |
| 武器穿透 | +10% 基础值 |
| 武器弹速 | +8% 基础值 |
| 无人机属性 | +8% 基础值 |

所有成长均按基础值线性叠加，不做逐级复利。

### 4.3 子弹伤害

```text
levelScale = 1 + (weaponLevel - 1) × 0.12
base = max(0.1, weaponDamage × (levelScale + weaponDamagePct))
bulletDamage = max(2, base + 16 × 0.15 + (attackPower - 16))
```

暴击和致命判定在命中时计算：先判定致命，再判定暴击。致命伤害取 `baseDamage×lethalDamage` 与 `enemy.maxHp×lethalMaxHpPct` 的较大值；暴击伤害为 `baseDamage×critDamage`。

### 4.4 开火间隔

```text
levelScale = 1 + (weaponLevel - 1) × 0.10
overheatBoost = overheatStacks × 0.10
offhandBoost = 时间扭曲生效时 max(0, offhandMultiplier - 1)
baseRate = max(0.1,
  weaponFireRate × (levelScale + weaponFireRatePct + overheatBoost + offhandBoost))
fireInterval = max(0.07, 1 / max(0.15, baseRate + attackSpeed × 0.45))
```

`overheatStacks` 由冲锋枪每次开火增加1层，最多5层；每层提供10%武器射速。停火0.8秒后开始逐层冷却。

### 4.5 穿透、弹速与无人机

```text
totalPierce = weaponPierce × (1 + (weaponLevel - 1) × 0.10)
             + characterPierce + pierceStacks
pierce = floor(totalPierce) + 按小数部分概率追加 1

bulletSpeed = max(260,
  300 + weaponBulletSpeed × (1 + (weaponLevel - 1) × 0.08) × 140
  + characterBulletSpeed × 0.4)

pierceRetention = clamp(0.5 + pierceDamagePct, 0.35, 0.9)
```

无人机：

```text
strikeCount = min(8, 1 + floor(dronePower / 4))
range = 320 + dronePower × 18
interval = max(0.28, 1.18 - min(0.78, dronePower × 0.035))
damage = 12 + dronePower × 3.4 + reactorCoreLevel × 2
```

### 4.6 玩家受伤

先判定闪避，再按伤害类型选择防御：物理使用物防，魔法使用魔防，火/雷/冰使用 `魔防×0.35 + 元素防御`，毒使用 `魔防×0.25 + 毒防`。

```text
defenseRatio = 1 - clamp(defense / (defense + 80), 0, 0.7)
damage = max(1, incomingDamage × defenseRatio × (1 - damageReduction))
```

伤害先扣护盾，再扣生命；有效受击后获得 0.42 秒无敌并延迟护盾恢复 1.6 秒。

权威源码：

- `assets/scripts/core/stats.ts`
- `assets/scripts/RogueShooterGame.ts`：`getCharacterStats()`、`takeDamage()`、`getDefenseAgainst()`、无人机函数
- `assets/scripts/projectile/projectileManager.ts`：四个武器数值 getter、穿透保留率
- `assets/scripts/enemy/enemyManager.ts`：`rollOutgoingDamage()`、`droneStrike()`
- `assets/scripts/core/combatFormulas.ts`：测试镜像；与运行时不一致处见 `GAP-ARCH-001`

## 5. 主武器系统

### 5.1 内容规模

当前主武器为 17 个家族 × 10 个变体，共 170 个 `EquipmentDef` 实例。

| T | 变体 | 伤害 | 射速 | 穿透 | 无人机 | 弹速 |
|---:|---|---:|---:|---:|---:|---:|
| 1 | 标准 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| 2 | 轻型 | 0.86 | 1.22 | 0.80 | 0.90 | 1.16 |
| 3 | 脉冲 | 4.44 | 1.12 | 1.00 | 1.00 | 1.10 |
| 4 | 精准 | 1.22 | 0.92 | 1.12 | 0.90 | 1.24 |
| 5 | 重载 | 1.48 | 0.72 | 1.18 | 0.85 | 0.92 |
| 6 | 连射 | 0.94 | 1.55 | 0.88 | 0.95 | 1.08 |
| 7 | 穿甲 | 4.48 | 0.96 | 1.75 | 0.90 | 1.02 |
| 8 | 超频 | 1.22 | 1.36 | 1.10 | 1.18 | 1.18 |
| 9 | 共振 | 1.36 | 1.08 | 1.30 | 1.28 | 1.04 |
| 10 | 星陨 | 1.68 | 1.18 | 1.55 | 1.42 | 1.20 |

### 5.2 家族与机制接线状态

| 家族 | mechanic | 当前运行状态 |
|---|---|---|
| 冲锋枪 | `overheat` | 每次开火叠1层，每层+10%武器射速、5层封顶；停火0.8秒后逐层冷却 |
| 瘟疫喷射器 | `poison` | 已有扇形检测、每次 3 层、15 层上限、DoT 与毒爆；Boss 不叠毒 |
| 霜束发射器 | `slow` | 普通敌人减速 0.6 秒、速度×0.5；精英/Boss 免疫 |
| 回声弓 | `echo_chain` | 击杀后 600 范围内最多连续弹射 12 次，弹射时穿透归零 |
| 裂变枪管 | `multishot_3` | 每次三发 ±0.16rad 窄扇形弹 |
| 镜像棱镜 | `radial_5` | 每次五发 360° 环射，主目标方向弹伤害×1.65 |
| 量子织机 | `split` | 子弹飞行 0.42 秒后按 ±0.30rad 分裂 |
| 离子长枪 | `straight` | 穿透伤害不衰减 |
| 荆棘连弩 | `ricochet` | 命中敌人或墙壁后最多反弹 2 次，每次增伤 15% |
| 磁轨炮 | `pierce_bonus` | 每次穿透增伤 15%，弹道碰撞半径 7 |
| 虚空针 | `crit_master` | 命中额外 +15% 暴击率、+0.30 暴击伤害 |
| 流星发射器 | `aoe_burn` | 命中先触发半径110/40%即时爆炸，再生成3秒/半径72燃烧区；固定6次tick（总48%子弹伤害）并轻减速 |
| 轨道无人机 | `drone_charge` | 击杀 +34 充能，达到 100 触发范围爆炸 |
| 重力锤 | `knockback` | 弹丸寿命1.5秒；命中产生半径120/40%伤害冲击并硬直0.45秒，主目标击退115/暴击230 |
| 虚空撕裂者 | `void_tearer` | 运行时按穿透层数增伤；与 catalog 的“减防”描述不一致 |
| 冰狱审判 | `icefire_judge` | 弹丸寿命1.55秒；冰弹减速普通目标1秒（精英/Boss免疫）；火弹主伤害对已减速目标×2并产生80范围/25% AOE，该AOE对已减速的次级目标同样×2；击杀产生115范围/45% AOE |
| 织网支配者 | `webmaster_lifesteal` | 命中缓速、击杀充能、按子弹伤害5%回血 |

每个家族都有独立 `WeaponAttackStyle`、子弹贴图和射击音效映射。美术与音效替换规则不在本文展开。

权威源码：

- `assets/scripts/catalogs/weaponCatalog.ts`
- `assets/scripts/RogueShooterGame.ts`：`fireAt()`
- `assets/scripts/projectile/projectileManager.ts`
- `assets/scripts/enemy/enemyManager.ts`：伤害判定与击杀
- `assets/scripts/audio/audioManager.ts`
- `docs/weapon_attack_effects.md`：只作为表现层说明，机制字段冲突见 gaps

## 6. 副武器系统

副武器共 15 把，分为环绕 3、召唤 4、控场 3、爆发 3、辅助 2。战斗开始时把机库选择的 ID 和持久等级同步到 `CombatState`，之后由 `OffhandManager.tick()` 自动运行。

| 类型 | 副武器 |
|---|---|
| 环绕 | 回旋利刃、守护星环、烈焰漩涡 |
| 召唤 | 影刃猎手、静电蜂群、幽影分身、治愈蜂鸟 |
| 控场 | 冰霜地雷、静电力场、黑曜石封印 |
| 爆发 | 虚空裂隙、暴风之眼、时间扭曲 |
| 辅助 | 纳米修复器、铜墙护盾 |

副武器声明为 T1-T5；数据模型为 `baseStats` 加四段 `levelUpgrades`。当前累计方式、材料消费和若干行为尚不符合设计文档，因此本文不宣称 15 种机制已经完整实现，详见 `GAP-OFFHAND-001` 至 `GAP-OFFHAND-003`。

持续效果的当前运行节奏：回旋利刃、烈焰漩涡和静电力场的全怪伤害查询按固定 `0.1` 秒 tick（10 Hz）执行，视觉仍逐帧更新。回旋利刃使用相邻 tick 之间的扫掠弧碰撞，避免高速旋转时只检查瞬时圆点而漏过目标；烈焰轨迹按固定 tick 插值玩家路径并结算已存轨迹，静电力场按固定 tick 刷新范围伤害和减速。低帧 catch-up 逐个补齐固定 tick，不把任意大 `dt` 整段按末位置结算。

权威源码：

- `assets/scripts/core/types.ts`：副武器类型
- `assets/scripts/catalogs/offhandCatalog.ts`：15 把数据和 T1-T5 配置
- `assets/scripts/offhand/offhandManager.ts`：运行行为
- `assets/scripts/shop/equipmentManager.ts`：持有、装备、合成、升级和存档
- `docs/offhand_weapon_design.md`：设计期望，不代表所有行为已接线

## 7. XP 与升级三选一

- 单局初始等级 1，`xpToNext = 65`。
- 击杀 XP 直接加入经验，不生成需要拾取的经验球。
- 普通、精英、Boss 的 XP 倍率分别为 2.6、2.4、3.0，再乘角色 `1 + xpGain`。
- 升级后递归更新：`xpToNext = round(oldXpToNext×1.24 + 22 + newLevel×5)`。
- 每次升级随机生成 3 个属性选项，前两个尽量来自不同类别。
- 升级选项刷新消耗 28 本局合金；合金不足时会尝试奖励广告刷新。
- 源码在每 3 级尝试额外增加 20 最大生命和当前生命，但后续属性重算会覆盖该效果，见 `GAP-GROWTH-001`。

当前 12 个随机范围：

| 类别 | 选项 | 单次数值范围 |
|---|---|---:|
| 力量 | 攻击强化 | 攻击力 +8~16 |
| 力量 | 暴击训练 | 暴击率 +4%~10% |
| 力量 | 弱点打击 | 暴击伤害 +0.15~0.36 |
| 敏捷 | 神经反射 | 攻速 +0.05~0.12 |
| 敏捷 | 移速强化 | 移速 +8~18 |
| 敏捷 | 身法训练 | 闪避 +4%~7% |
| 体魄 | 生命扩展 | 最大生命 +30~60 |
| 体魄 | 护盾扩容 | 护盾 +24~48 |
| 体魄 | 坚韧体质 | 减伤 +3%~6% |
| 技巧 | 精准瞄准 | 攻击距离 +20~50 |
| 技巧 | 穿透强化 | 穿透保留 +12%~28% |
| 技巧 | 无人机指挥 | 无人机强度 +1.0~4.5 |

权威源码：

- `assets/scripts/state/combatState.ts`
- `assets/scripts/catalogs/runItemCatalog.ts`：`LEVEL_UP_BLUEPRINTS`
- `assets/scripts/pickup/pickupManager.ts`：`gainXp()`、`openLevelChoices()`、`applyLevelUpgrade()`
- `assets/scripts/RogueShooterGame.ts`：`pickLevelChoices()`

## 8. 本局道具、宝箱与商店

### 8.1 本局道具

- 65 个单属性 blueprint × 5 个 tier，共 325 个道具实例。
- 当前 blueprint 全为正面效果；tier 正面缩放为 `1 + (tier - 1)×0.52`。
- 道具效果直接累加到 `runStats`，战斗结束时清空。
- `MAX_RUN_ITEM_SLOTS = 999`，等同取消正常游玩中的硬槽位限制。
- 已获得道具按实例 ID 去重记录；商店和宝箱优先避开已获得 ID。

### 8.2 宝箱

- 精英在非 Boss 波有 5.5% 概率尝试掉宝箱，其中 14% 为稀有宝箱。
- 每波最多生成 2 个宝箱；大 Boss 保证尝试掉 1 个稀有宝箱。
- 宝箱需拾取，打开后从本局道具中三选一。
- 普通宝箱主要提供 T1-T3，稀有宝箱主要提供 T3-T5，仍受当前 tier 上限影响。
- 宝箱选项刷新消耗 34 本局合金。

### 8.3 战场商店

- 商店固定 6 格，只出售 `RUN_ITEM`，不出售主武器或机库装备。
- 购买后原格自动补货；11 波后按 tier 加权，更偏向高阶道具。
- 单格刷新逻辑实际扣除 22 本局合金；界面仍显示 18，见 `GAP-SHOP-001`。

实际价格：

```text
waveFee = floor(waveIndex / 4) × 5
cycleFee = (endlessCycle - 1) × 10
baseCost = 44 + tier × 22 + waveFee + cycleFee
endlessMultiplier = waveIndex >= 11 ? 1.05^(waveIndex - 10) : 1
cumulativeMultiplier = 1 + acquiredRunItemCount × 0.35
effectMultiplier = clamp(按效果强度估值, 0.72, 1.55)
price = max(50, round(baseCost × effectMultiplier
                      × endlessMultiplier × cumulativeMultiplier))
```

权威源码：

- `assets/scripts/catalogs/runItemCatalog.ts`
- `assets/scripts/pickup/pickupManager.ts`
- `assets/scripts/shop/equipmentManager.ts`：商店池、tier、定价与购买
- `assets/scripts/ui/ShopPopup.ts`：商店显示

## 9. 波次、怪物与 Boss

### 9.1 波次规则

- 每波持续时间随机 50~60 秒。
- Boss 波为第 10 波，以及之后每 3 波一次：13、16、19、22……
- Boss 波超时后停止继续刷怪；必须击败 Boss 才能进入下一波。
- 第 11 波开始进入无尽指数缩放：`endlessScale = 1.05^(wave - 10)`。
- `endlessCycle = floor((wave - 1) / 10) + 1`，用于部分额外成长和奖励。
- 第 13 波起的非 Boss 波，每次刷怪批次有 30% 概率尝试加入一只小 Boss；场上已有小 Boss 时不重复加入。

### 9.2 怪物内容

- 10 个基础 archetype：碎壳虫、疾行体、重甲块、裂变囊、磁暴卫士、自爆虫、蜂群、灵能体、追踪眼、信标。
- 11 个变体档位：基础、腐蚀、晶化、迅捷、装甲、暴怒、幽影、电弧、再生、剧毒、原初。
- 普通 catalog 共 110 个组合实例。
- 5 个小 Boss：狂暴重甲块、电弧灵能体、自爆母体、迅捷分裂体、再生巨兽。
- 5 个大 Boss：虚空巨像、噬能蠕虫、冰霜女皇、狱炎领主、虚空织网者。

首轮怪池大致按以下方式扩展：1-2 波碎壳虫；3-4 波加入疾行体；5-6 波加入重甲块；7-8 波加入裂变囊；9-10 波由 catalog 分片选择；11 波后开放全部普通实例。`spawnAfter` 与实际怪池选择没有统一，见 `GAP-WAVE-002`。

### 9.3 刷怪与场上限

运行时生成间隔：

```text
base = 1.62 - waveSlot×0.035 - (endlessCycle-1)×0.06
       - min(0.12, waveElapsed/420)
```

1-10 波另叠加 early relief 和各波硬下限；11 波后使用 `max(0.45, (base + wave11Breather)/endlessScale)`。

首轮 1-2 波每批固定 4 只；3-4 波约 3~4 只；5-6 波约 4~5 只；7-8 波约 5~7 只。11 波后批量按 `endlessScale` 增长并限制为 60。

首轮非 Boss 场上限：波 1~9 分别为 40、55、75、95、130、170、200、240、240，再加 `battleIndex×2`。Boss 波为 `60 + endlessCycle×10`。11 波后非 Boss 上限为 `min(600, max(240, round(200×endlessScale)))`。

### 9.4 HP 与伤害缩放

当前常量：`ENEMY_HP_PROGRESS_SCALE = 1.8`，`ENEMY_DAMAGE_PROGRESS_SCALE = 1.0`。

```text
hpScale = (1 + battleIndex×0.06 + (endlessCycle-1)×0.28
           + (waveIndex×0.028 + combatTime×0.0018)
             × 1.8 × earlyProgressFactor)
          × endlessScale

finalHp = round(spec.hp × hpScale × eliteScale)
eliteScale = boss ? (6.4 + endlessCycle×0.58) : elite ? 2.65 : 1

damage = spec.damage × (boss ? 1.85 : elite ? 1.42 : 1.05)
         × (1 + (endlessCycle-1)×0.16
            + (waveIndex×0.012 + combatTime×0.0009)
              × 1.0 × earlyProgressFactor)
         × earlyDamageFactor × endlessScale
```

首轮 `earlyProgressFactor` 为：波 1-2 `0.3`，3-4 `0.4`，5-6 `0.55`，7-8 `0.78`，9-10 `1`。首轮 `earlyDamageFactor` 为：波 1-2 `0.82`，3-4 `0.75`，5-6 `0.85`，7-8 `0.95`，之后 `1`。

权威源码：

- `assets/scripts/enemy/enemyConstants.ts`
- `assets/scripts/catalogs/enemyCatalog.ts`
- `assets/scripts/enemy/enemyManager.ts`：`startNextWave()`、刷怪 getter、怪池 getter、`createEnemy()`、Boss 行为
- `assets/scripts/enemy/enemySpawnPatterns.ts`
- `assets/scripts/enemy/enemyMovement.ts`

## 10. 掉落与资源

### 10.1 XP

所有击杀直接获得 XP，不需要拾取，也不存在 56% XP 掉率。

### 10.2 普通掉落

| 掉落 | 当前运行规则 |
|---|---|
| 合金 | 普通怪概率 `min(32%, spec.alloyChance×0.75 + wave×0.4%)`；精英/Boss 必掉 |
| 普通材料 | 普通怪 4.5%，精英 30%；重甲/卫士掉电路、疾行体掉碎片，其余掉生体样本 |
| 核心 | 精英额外 18% 概率掉 1 |
| 宝箱 | 非 Boss 波精英 5.5% 尝试，受每波最多 2 个限制 |
| 护盾碎片计数 | 每次击杀 20% 增加 1；目前没有消费效果 |

非宝箱掉落会受 `resourceGain` 影响，并通过 78 像素合并半径、190 软上限和 260 硬上限控制节点数量。

### 10.3 Boss 掉落声明

Boss 击杀会声明掉落核心、碎片、晶体、合金、稀有宝箱和该 Boss 的专属材料 1~3 个，并尝试掉落武器蓝图。当前 Boss 专属材料与永久合金的入库链路存在阻断，不能把“看到掉落提示”视为已经存入永久钱包，详见 `GAP-ECON-001`。

蓝图掉率为 `min(26%, 16% + completedBattles×0.6%)`，只会选择已发现、未拥有且仍缺蓝图的武器实例。

权威源码：

- `assets/scripts/enemy/enemyManager.ts`：`killEnemy()`
- `assets/scripts/pickup/pickupManager.ts`：生成、合并、拾取与宝箱
- `assets/scripts/RogueShooterGame.ts`：`addBattleResource()`、资源倍率
- `assets/scripts/core/resources.ts`
- `assets/scripts/shop/equipmentManager.ts`：`tryDropBossBlueprint()`

## 11. 死亡、复活、撤离与结算

### 11.1 复活

- HP 降到 0 后进入 `paused` 并显示复活弹窗。
- 奖励广告成功后恢复 50% 最大生命、护盾清零，并获得 1.5 秒无敌。
- `AdManager` 声明最多 3 次“每日复活”；当前没有按日期自动重置，见 `GAP-AD-001`。
- 开发环境广告为 0.5 秒 stub，成功概率 80%；正式 TT 广告位尚未填写。
- 放弃复活后以 `death` 结束本次出击。

### 11.2 结算

主动撤离和死亡都会进入 `finishBattle()`，增加一次 `battlesWon` 并保存进度；该字段实际表示“已完成出击次数”，不是只统计胜利。

结算在本局已拾取资源上额外增加：

```text
shards   += floor(combatTime/48 + kills/78 + bossKills×5)
biomass  += floor(combatTime/56 + kills/66 + bossKills×2)
circuits += floor(combatTime/70 + kills/98 + bossKills×3)
cores    += bossKills
crystals += floor(bossKills/2)
```

上述非合金资源先乘 `max(0.25, 1 + resourceGain)`。死亡结算再乘 0.68；主动撤离不折损，并可通过奖励广告再领取一份同等结算奖励。

只要本局击败过至少 1 个 Boss，结算弹窗就生成 3 个 Boss 战利品候选，来源包括新装备、已有装备免费升级和资源箱。新弹窗选择后的即时存档缺失见 `GAP-SETTLE-001`。

权威源码：

- `assets/scripts/RogueShooterGame.ts`：`showRevivePanel()`、`reviveFromAd()`、`finishBattle()`、`calculateEndlessReward()`、`openSettlement()`
- `assets/scripts/ad/AdManager.ts`
- `assets/scripts/flow/battleFlow.ts`
- `assets/scripts/catalogs/equipmentLootChoices.ts`
- `assets/scripts/ui/RevivePopup.ts`
- `assets/scripts/ui/SettlementPopup.ts`

## 12. 永久进度、装备与存档

### 12.1 存档

当前使用 `sys.localStorage`，key 为 `starfall-rogue-shooter-progress-v1`。持久字段包括：

- 已完成出击次数 `battlesWon`
- 11 种资源余额
- 已拥有装备 ID
- 当前主武器与四件部位装备
- 装备等级、装备蓝图数量
- 已装备副武器和各副武器等级

无存档时默认持有 24 碎片、12 生体样本、10 电路，以及 5 件 Starter 装备，均为 Lv.1。

### 12.2 装备内容

- 44 个 gear blueprint × 5 品质，共 220 件 gear 实例。
- 品质为普通、稀有、史诗、传奇、神话；属性倍率分别为 1、1.42、2.02、2.78、3.66。
- 最高等级分别为 6、8、10、12、14。
- gear 实际效果为 `gearStats × 持久装备等级`。
- 部分 gear 有正负取舍，Starter 和一部分高阶 gear 为纯正面效果。

### 12.3 发现、蓝图、合成与升级

- 武器家族、武器 T2-T10 和 gear 品质按已完成出击次数逐步发现。
- 武器必须先拥有同家族低阶型号；T9+ 还要求已有高阶型号。
- 武器蓝图需求：T1-T3 为 0，T4=1，T5=2，T6=4，T7=5，T8=7，T9=9，T10=12。
- 装备合成和升级消耗碎片、生体样本、电路、核心、晶体等永久资源；具体成本按种类、部位、tier、等级和 `baseCost` 动态计算。
- Lv.9+ 升级会尝试追加一种当前库存足够的 Boss 材料。
- 三把传说武器另有锻造面板和专属配方；与通用合成路径的成本不一致，见 `GAP-EQUIP-001`。

权威源码：

- `assets/scripts/shop/equipmentManager.ts`：存档、装备、成本、锻造与升级
- `assets/scripts/catalogs/equipmentCatalog.ts`
- `assets/scripts/catalogs/equipmentProgression.ts`
- `assets/scripts/catalogs/equipmentLootChoices.ts`
- `assets/scripts/core/resources.ts`

## 13. 内容规模快照

| 内容 | 当前规模 | 生成方式 |
|---|---:|---|
| 主武器 | 17 家族 × 10 变体 = 170 | `buildWeaponCatalog()` |
| gear | 44 blueprint × 5 品质 = 220 | `buildGearCatalog()` |
| 本局道具 | 65 个单属性 blueprint × 5 tier = 325 | `buildRunItemCatalog()` |
| 升级属性 | 4 类 × 3 = 12 | `LEVEL_UP_BLUEPRINTS` |
| 普通敌人 | 10 archetype × 11 变体 = 110 | `buildEnemyCatalog()` |
| 小 Boss | 5 | 静态 catalog |
| 大 Boss | 5 | 静态 catalog |
| 副武器 | 15 | 静态 catalog |

## 14. 变更基线要求

修改机制时必须同时完成：

1. 修改唯一运行时权威源码，避免再复制一份公式。
2. 更新本文对应章节和 `BASELINE_GAPS.md` 状态。
3. 更新 catalog/公式/流程单元测试。
4. 运行 TypeScript 与全量测试；数值改动还必须运行真实 Cocos/CDP 平衡验证。
5. 若改动主武器、副武器、基础属性、XP、敌人缩放、Starter 装备或存档字段，先核对 `AGENTS.md` 的禁止项并取得必要确认。

本文不覆盖 UI 布局、资源目录和美术替换流程；这些应由独立的 UI/美术基线文档维护。

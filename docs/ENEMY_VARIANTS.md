# 怪物变体系统详解

> 基线：SF-2026-07-13
> 源码分析确认：2026-07-13
> 相关文件：`assets/scripts/catalogs/enemyCatalog.ts`、`assets/scripts/enemy/enemyManager.ts`、`assets/scripts/enemy/enemyConstants.ts`

---

## 总览

110 种普通怪 = 10 个 archetype × 11 档变体（base + 10 种词缀）。<br>
每个变体都有代码级的实际效果，不是装饰性前缀。

| 层 | 效果 | 是否全部接线 |
|---|---|---|
| 数值 | HP/速度/伤害/半径/XP/掉率 乘数缩放 | ✅ 全部 |
| 行为 | 冲刺/射击/霸体/回血/爆炸等特殊逻辑 | ✅ 全部 |
| 视觉 | 独立 Graphics 标记 + 色调 | ✅ 全部 |

---

## 一、11 档变体一览

### 1.1 基础属性乘数

| 变体 ID | 前缀 | 解锁波 | HP× | 速度× | 伤害× | 半径× | XP× | 掉率× |
|---|---|---|---|---|---|---|---|---|
| `base` | — | 1 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| `acid` | 腐蚀 | 2 | 1.12 | 0.96 | 1.18 | 1.00 | 1.12 | 1.20 |
| `crystal` | 晶化 | 3 | 1.38 | 0.88 | 1.08 | 1.05 | 1.24 | 1.35 |
| `swift` | 迅捷 | 4 | 0.82 | **1.34** | 1.06 | 0.94 | 1.16 | 1.05 |
| `armored` | 装甲 | 5 | **1.72** | 0.78 | 1.12 | 1.08 | 1.42 | 1.55 |
| `rage` | 暴怒 | 6 | 1.18 | 1.16 | **1.42** | 1.02 | 1.32 | 1.30 |
| `shade` | 幽影 | 7 | 0.94 | 1.22 | 1.22 | 0.90 | 1.28 | 1.24 |
| `arc` | 电弧 | 8 | 1.24 | 1.08 | 1.32 | 1.00 | 1.44 | 1.42 |
| `regen` | 再生 | 9 | 1.58 | 0.94 | 1.18 | 1.04 | 1.50 | 1.48 |
| `venom` | 剧毒 | 10 | 1.30 | 1.06 | **1.58** | 1.00 | 1.62 | 1.58 |
| `prime` | 原初 | 11 | **2.10** | 1.05 | **1.85** | **1.16** | 2.05 | 2.10 |

> 最终属性 = `base × multiplier`。解锁波次取 `max(archetype.unlockWave, variant.unlockWave)`。

### 1.2 特殊行为一览

| 变体 | 行为 | 代码位置 | 玩家感知 |
|---|---|---|---|
| `swift` | **必冲刺** | `shouldEnemyDash()` line 1274 | 频繁突进扑脸 |
| `rage` | 冲刺 + **死亡爆炸** | `shouldEnemyDash()` + `shouldEnemyExplodeOnDeath()` line 2142 | 死了还炸 |
| `armored` | **霸体**（不受击退） | `updateEnemySkill()` line 961-966 | 白圈光环环绕 |
| `regen` | **自动回血** | `updateEnemySkill()` line 884-887 | 血条往回涨 |
| `prime` | **3 发散弹** + 死亡爆炸 | `enemyShoot()` line 478 + `shouldEnemyExplodeOnDeath()` line 2145 | 射三发+死爆 |
| `acid` | 远程射击 + 死亡爆炸 | `shouldEnemyShoot()` line 1282 + `shouldEnemyExplodeOnDeath()` line 2143 | 远程毒弹+死爆 |
| `crystal` | 远程射击 | `shouldEnemyShoot()` line 1285 | 远程菱形弹 |
| `arc` | 远程射击 | `shouldEnemyShoot()` line 1283 | 电射弹幕 |
| `venom` | 远程射击 + 死亡爆炸 | `shouldEnemyShoot()` line 1286 + `shouldEnemyExplodeOnDeath()` line 2144 | 射毒弹+死爆 |
| `shade` | 远程射击 | `shouldEnemyShoot()` line 1287 | 远处射击 |

### 1.3 技能冷却影响

变体影响怪物技能的冷却时间（`getEnemySkillDelay()`）：

| 变体/家族 | 冷却范围 |
|---|---|
| `swift` / `runner` | 最快（1.1~2.35s） |
| `arc` / `warden` | 较快（1.45~2.65s） |
| `rage` / `venom` / `crystal` | 中等（1.55~2.75s） |
| 其他 | 较慢（2.0~3.4s） |

### 1.4 视觉标记

源码 `drawEnemyVariantMark()`（line 2229-2302）为每种变体绘制独立标记：

| 变体 | Graphics 标记 | 色调索引 |
|---|---|---|
| `base` | 无额外标记 | 使用原始 `enemy.spec.color` |
| `acid` | 两个小圆圈 ⭕⭕ | 调色板索引 1 (`#9BE564`) |
| `crystal` | 菱形 ◇ | 索引 2 (`#43AA8B`) |
| `swift` | 三角箭头 ▷ | 索引 3 (`#4CC9F0`) |
| `armored` | 方框 □ | 索引 4 (`#577590`) |
| `rage` | 锯齿 Z 形 ⚡ | 索引 5 (`#F9C74F`) |
| `shade` | 半透明暗色填充 | 索引 6 (`#F3722C`) |
| `arc` | 之字形折线 ⚡ | 索引 7 (`#B5179E`) |
| `regen` | 十字 + | 索引 8 (`#A7F3D0`) |
| `venom` | 绿色实心圆点 | 索引 9 (`#90BE6D`) |
| `prime` | 双同心圆 ◎ | 索引 10 (`#F94144`) |

色调映射：`(enemy.spec.variantIndex || 0) % ENEMY_TINT_PALETTE.length`（line 2214），base 保持原始色，其余用调色板索引。

---

## 二、archetype 原生行为（非变体专属）

以下行为是**怪物家族自身的特性**，与变体无关：

| 家族 | 行为 | 代码位置 |
|---|---|---|
| `mite` | 无特殊行为（基础近战） | — |
| `swarm` | 近玩家时轨道环绕分散 | `updateEnemySkill()` line 889-896 |
| `runner` | 必冲刺 | `shouldEnemyDash()` line 1274 |
| `bomber` | — | 无特殊skill行为 |
| `brute` | 霸体 | `updateEnemySkill()` line 961 |
| `aura` | 光环脉冲（对友军buff范围） | `updateEnemySkill()` line 877 |
| `splitter` | 死亡分裂 | `shouldEnemyExplodeOnDeath()` line 2141 |
| `seeker` | 保持距离后退射击 | `updateEnemySkill()` line 913-920 + `shouldEnemyShoot()` |
| `warden` | 霸体 + 远程射击 | `updateEnemySkill()` line 961 + `shouldEnemyShoot()` line 1280 |
| `beacon` | 召唤怪物 | `updateEnemySkill()` line 928-933 |

**组合叠加规则**：archetype 行为 + 变体行为叠加生效。<br>
例：`brute-rage` = 霸体（archetype） + 冲刺 + 死亡爆炸（变体）

---

## 三、实战识别速查表

| 你看到 | 判断 | 应对 |
|---|---|---|
| **方框**标记 + 白圈光环 + 击退无效 | 装甲变体（霸体） | 持续输出，别想控它 |
| **十字**标记 + 血条往上涨 | 再生变体（回血） | 集火秒掉，否则白打 |
| **三角箭头** + 频繁突进 | 迅捷变体（必冲刺） | 保持移动，别被扑到 |
| **闪电锯齿** + 死后爆炸 | 暴怒变体（自爆） | 远程击杀，近战远离 |
| **双同心圆** + 三发弹幕 + 死爆 | 原初变体（精英级） | 优先处理，伤害极高 |
| **绿点**标记 + 毒弹 + 死爆 | 剧毒变体 | 注意躲弹幕 |
| **菱形**标记 + 远程射击 | 晶化变体 | 远程威胁 |
| 普通圆形 + 无额外标记 | base 变体 | 普通怪 |
| 蜂群**绕着你飞** | swarm 家族 | 用 AOE 清 |
| 站着不动**召唤小怪** | beacon | 先打掉它 |
| 边退边**射弹幕** | seeker 家族 | 贴身打 |

---

## 四、变体如何工作（技术细节）

### 实例化

`buildEnemyCatalog()`（`enemyCatalog.ts:371`）遍历 10×11 组合，按 `base × variant` 乘数生成全部 110 个 `EnemySpec`。运行时 `ENEMY_SPECS` 是缓存数组。

### 刷怪

`getUnlockedEnemySpecsForWave()`（`waveCatalog.ts:114`）按 `unlockWave` 筛选怪物池。池内累加——早期波次解锁少，后期越来越多。

### 运行时

`Enemy` 接口携带 `spec.variantId` 和 `spec.variantIndex`（`enemyTypes.ts`），`enemyManager.ts` 中所有涉及行为判断的函数通过 `enemy.spec.variantId === 'xxx'` 或 `enemy.spec.variantIndex >= 1` 来查询。

---

## 五、代码索引

| 功能 | 文件 | 行号 |
|---|---|---|
| archetype 定义 | `assets/scripts/catalogs/enemyCatalog.ts` | 3-164 |
| 变体乘数定义 | `assets/scripts/catalogs/enemyCatalog.ts` | 357-369 |
| 实例化 | `assets/scripts/catalogs/enemyCatalog.ts` | 371-395 |
| 冲刺判定 | `assets/scripts/enemy/enemyManager.ts` | 1272-1276 |
| 射击判定 | `assets/scripts/enemy/enemyManager.ts` | 1277-1289 |
| 死亡爆炸判定 | `assets/scripts/enemy/enemyManager.ts` | 2139-2146 |
| 霸体/回血/召唤 | `assets/scripts/enemy/enemyManager.ts` | 881-966 |
| 视觉标记绘制 | `assets/scripts/enemy/enemyManager.ts` | 2218-2302 |
| 色调映射 | `assets/scripts/enemy/enemyManager.ts` | 2212-2217 |
| 技能冷却 | `assets/scripts/enemy/enemyManager.ts` | 1256-1271 |

---

## 六、注意

1. **变体不是装饰**：每一种都有视觉标记 + 行为逻辑 + 数值乘数，三层全接线。
2. **行为叠加**：变体行为 + archetype 原生行为同时生效，不要混淆。
3. **波次解锁**：怪池累加，后期波次变体更丰富、威胁更立体。
4. **色调辅助识别**：每种变体的颜色来自独立调色板，即使不仔细看标记也能通过颜色区别。

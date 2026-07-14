# 星坠幸存者开发约束入口

> 基线编号：`SF-2026-07-11`
>
> 项目：Cocos Creator 3.8.8 + TypeScript / 抖音小游戏 / 竖屏 720×1280
>
> 所有 AI Agent 和开发者在修改代码、资源、配置或文档前，必须完整阅读本文件。

本文件只保存不可违反的产品与工程约束，以及开发前必须知道的当前事实。完整机制、架构、UI、美术、测试和存档说明由专题基线维护，不在这里复制第二份。

## 1. 文档入口与权威顺序

开发前依次阅读：

1. 本文件：不可修改项、产品边界和验证门禁。
2. [文档中心](docs/README.md)：专题文档总入口与更新合同。
3. [项目基线](docs/BASELINE.md)：`SF-2026-07-11` 的范围、内容规模和基线升级规则。
4. [机制实现基线](docs/GAMEPLAY_MECHANICS.md)：当前运行机制、公式、内容规模及权威源码索引。
5. [基线差异清单](docs/BASELINE_GAPS.md)：设计、约束、文档与当前实现之间尚未闭合的差异。

事实判断顺序：

1. 本文件中的受保护约束。
2. 实际运行源码与 catalog。
3. 可重复执行的测试和本次源码生成的构建产物。
4. `docs/BASELINE.md` 与专题基线。
5. GDD、专项设计稿和历史报告。

如果本文件、专题文档与源码冲突，不得静默选择其中一个，也不得把计划写成现状。先在 [`docs/BASELINE_GAPS.md`](docs/BASELINE_GAPS.md) 登记，明确是修实现还是更新基线，再同步代码、测试和文档。

## 2. 核心产品约束

**星坠幸存者**是单人竖屏自动射击生存肉鸽。玩家控制移动，武器自动索敌攻击。

核心循环：

```text
进入战斗 → 自动射击 → 击杀直接获得 XP
→ 拾取合金、材料和宝箱 → 升级三选一 / 6 格商店购买本局道具
→ 波次与 Boss 推进 → 死亡、复活或主动撤离
→ 结算 → 机库装备、蓝图、主武器和副武器养成
```

当前出战结构固定为：

```text
1 把主武器 + 4 件固定部位 gear + 1 个独立 offhand 槽
```

- 主武器至少保留 1 把，不能卸到 0 把。
- 装备另一把主武器必须原子替换当前主武器，不能先因总槽位已满而拒绝。
- gear 部位为帽子、护甲、鞋子、首饰，每个部位最多 1 件。
- offhand 与主武器同时生效，不切换，不占主武器、gear 或本局道具槽；该槽允许暂时未装备。
- 主武器和 gear 的升级在机库完成；offhand 使用独立合成与升级入口。
- XP 由击杀直接获得，不生成需要拾取的经验球；合金、材料和宝箱走拾取系统。
- 商店只出售 `RUN_ITEM`，不出售主武器或永久 gear。

## 3. 当前实现事实快照

以下数值是 `SF-2026-07-11` 的开发基线。详细公式、边界和权威函数见 [`docs/GAMEPLAY_MECHANICS.md`](docs/GAMEPLAY_MECHANICS.md)。发现源码偏离时先登记 gap，不得顺手改写本表来掩盖差异。

### 3.1 内容规模

| 内容 | 当前基线 |
|---|---:|
| 主武器 | 17 个家族 × 10 个变体 = 170 |
| gear | 44 个 blueprint × 5 个品质 = 220 |
| offhand | 15 把，T1-T5 |
| 本局道具 | 65 个单属性 blueprint × 5 个 tier = 325 |
| 升级选项 | 4 类 × 3 种 = 12 |
| 普通怪 | 10 个 archetype × 11 个变体 = 110 |
| 小 Boss / 大 Boss | 5 / 5 |

不要把“17 个主武器家族”写成只有 17 个装备实例，也不要把 offhand 或未闭合机制描述为全部完成。主武器与 offhand 的接线状态以 [差异清单](docs/BASELINE_GAPS.md) 为准。

### 3.2 角色与主武器公式

基础攻击力为 `16`。主武器等级成长按基础值线性叠加，不复利：

| 属性 | 每级 |
|---|---:|
| 伤害 | +12% |
| 射速 | +10% |
| 穿透 | +10% |
| 弹速 | +8% |
| 无人机 | +8% |

运行时子弹伤害：

```text
levelScale = 1 + (weaponLevel - 1) × 0.12
base = max(0.1, weaponDamage × (levelScale + weaponDamagePct))
bulletDamage = max(2, base + 16 × 0.15 + (attackPower - 16))
```

运行时基础开火间隔：

```text
levelScale = 1 + (weaponLevel - 1) × 0.10
baseRate = weaponFireRate × (levelScale + weaponFireRatePct + runtimeMechanicBoost)
fireInterval = max(0.07, 1 / max(0.15, baseRate + attackSpeed × 0.45))
```

`runtimeMechanicBoost` 只能包含实际已接线的运行状态；不能仅依据 catalog 描述假定机制存在。

运行时穿透和弹速：

```text
totalPierce = weaponPierce × (1 + (weaponLevel - 1) × 0.10)
              + characterPierce + pierceStacks
pierce = floor(totalPierce) + 按小数部分概率额外 +1

bulletSpeed = max(260,
  300 + weaponBulletSpeed × (1 + (weaponLevel - 1) × 0.08) × 140
  + characterBulletSpeed × 0.4)
```

角色属性由基础属性、本局 `runStats`、主武器贡献和已装备 gear 共同汇总。gear 效果乘持久装备等级，不是战斗内固定为 Lv.1。主武器当前还贡献射速、弹速、穿透和无人机属性；完整汇总与上下限以运行时 `getCharacterStats()` 为准。

`assets/scripts/core/combatFormulas.ts` 当前存在运行时/测试镜像差异，不能只凭纯函数测试断言真实游戏行为，详见 `GAP-ARCH-001`。

### 3.3 XP 与升级三选一

```text
初始等级 = 1
初始 xpToNext = 65
普通 / 精英 / Boss XP 倍率 = 2.6 / 2.4 / 3.0
升级后 xpToNext = round(oldXpToNext × 1.24 + 22 + newLevel × 5)
```

每次升级随机生成 3 个选项，效果直接累加到本局 `runStats`。当前 12 个随机范围：

| 类别 | 选项 | 当前范围 |
|---|---|---:|
| 力量 | 攻击强化 `attackPower` | +8~16 |
| 力量 | 暴击训练 `critChance` | +4%~10% |
| 力量 | 弱点打击 `critDamage` | +15%~36% |
| 敏捷 | 神经反射 `attackSpeed` | +0.05~0.12 |
| 敏捷 | 移速强化 `moveSpeed` | +8~18 |
| 敏捷 | 身法训练 `dodgeChance` | +4%~7% |
| 体魄 | 生命扩展 `maxHp` | +30~60 |
| 体魄 | 护盾扩容 `shieldMax` | +24~48 |
| 体魄 | 坚韧体质 `damageReduction` | +3%~6% |
| 技巧 | 精准瞄准 `attackRange` | +20~50 |
| 技巧 | 穿透强化 `pierceDamagePct` | +12%~28% |
| 技巧 | 无人机指挥 `dronePower` | +1.0~4.5 |

不要恢复旧文档中的移速 `+18~42`、射程 `+55~120` 或“XP 56% 概率掉落”等描述，除非先完成正式数值变更和验证。

### 3.4 本局道具与商店

- 本局道具基线为 65 个单属性 blueprint × 5 tier。
- tier 正面缩放为 `1 + (tier - 1) × 0.52`。
- `MAX_RUN_ITEM_SLOTS = 999`，正常游玩中等同没有硬槽位上限。
- 商店固定 6 格，购买后原格补货。
- 累计购买涨价为每件 +35%，并叠加波次、无尽和效果强度倍率。

```text
waveFee = floor(waveIndex / 4) × 5
cycleFee = (endlessCycle - 1) × 10
baseCost = 44 + tier × 22 + waveFee + cycleFee
price = max(50, round(baseCost × effectMultiplier
                      × endlessMultiplier × cumulativeMultiplier))
```

商店刷新显示与实际扣款等差异不得在这里任选一个值，统一以 [`docs/BASELINE_GAPS.md`](docs/BASELINE_GAPS.md) 的状态处理。

### 3.5 波次与敌人

- 普通波持续 50~60 秒；Boss 波使用独立状态机，不继承普通波时长作为通关条件。
- Boss 波为第 10 波，之后每 3 波一次：13、16、19……
- 第 11 波开始使用 `endlessScale = 1.05^(wave - 10)`。
- `assets/scripts/catalogs/waveCatalog.ts` 是波 1~9 压力表、Boss 阶段、Boss 援军、小 Boss 调度和阵型 budget 的权威配置；不得在文档或 Manager 中另抄第二套早期表。
- 普通怪只使用 `unlockWave`：家族依次在波 1~9 解锁 `mite`、`swarm`、`runner`、`bomber`、`brute`、`aura`、`splitter`、`seeker`、`warden/beacon`；基础到 `prime` 的 11 档变体依次在波 1~11 解锁。组合实例取家族与变体解锁波次的较大值，怪池只累计扩大，不再使用 `spawnAfter` 或波 9~10 分片。
- 阵型只改变空间分布，所有分组共享本批固定 budget，不得额外补怪。
- 第 14 波起的非 Boss 波在开波时只判定一次小 Boss：35% 成功时安排在开波后 20~35 秒出现，每波最多 1 只。
- Boss 波开场 3 秒；战斗阶段每 5 秒生成 3~4 只普通援军，普通援军存活上限 24；60 秒进入 overtime，Boss 速度 ×1.15、伤害 ×1.20、技能冷却 ×0.85，援军改为每 10 秒固定 4 只、存活上限 16；Boss 死亡 2.5 秒后进入下一波。
- catalog 规模为 10 个基础 archetype × 11 个变体；另有 5 小 Boss 和 5 大 Boss。

当前进度常量：

```text
ENEMY_HP_PROGRESS_SCALE = 1.8
ENEMY_DAMAGE_PROGRESS_SCALE = 1.0
```

运行时缩放：

```text
hpScale = (1 + battleIndex×0.06 + (endlessCycle-1)×0.28
           + (waveIndex×0.028 + combatTime×0.0018)
             × 1.8 × hpProgressFactor)
          × endlessScale

damageScale = (1 + (endlessCycle-1)×0.16
               + (waveIndex×0.012 + combatTime×0.0009)
                 × 1.0 × hpProgressFactor)
              × damageProgressFactor × endlessScale
```

`hpProgressFactor / damageProgressFactor` 由 `waveCatalog.ts` 给出：波 1~9 使用显式压力表，波 10 均为 `1.0`，波 11+ 保持 `1.0` 并叠加无尽指数。不得继续引用旧常量 `2.5 / 1.3`、旧 `spawnAfter` 双规则或旧批次/场上限表；完整压力表见机制基线第 9 节。

### 3.6 永久进度与未闭合机制

- 主武器、gear、蓝图、资源、offhand 装备和等级写入本地存档。
- 死亡和撤离都计入当前字段 `battlesWon`；文档语义统一称“已完成出击次数”。
- offhand 有 15 把和 T1-T5 数据，但材料消费、逐级数值与若干行为不能写成完整闭环。
- 主武器机制也不能使用“17 个已全部接入”的总括结论。
- Boss 材料、永久合金、结算保存、广告日切等能力必须按 gap 实际状态描述。

唯一差异清单：[docs/BASELINE_GAPS.md](docs/BASELINE_GAPS.md)。

## 4. 受保护项

下列内容未经用户明确确认不得修改、删除、重命名或绕过：

| 受保护项 | 约束 |
|---|---|
| `assets/scripts/core/stats.ts` 的 `createBaseCharacterStats()` | 所有战斗公式依赖基础属性 |
| `assets/scripts/core/types.ts` 的 `CharacterStats` / `StatKey` | 全项目共享类型合同 |
| `assets/scripts/core/combatFormulas.ts` | 受保护的公式与测试合同；存在双源 gap 不等于可以直接重写 |
| `assets/scripts/state/combatState.ts` 的字段名 | 多模块共享；变更需要迁移和全链路验证 |
| `xpToNext` 初始值及 `65 / 1.24 / 22 + level×5` 曲线 | 已平衡的升级合同 |
| `assets/resources/audio/` 下现有音效文件名 | 代码存在硬编码引用 |
| `STARTER_EQUIPMENT_IDS` 数组内容 | 新手初始装备固定 |
| 抖音小游戏 20 MB 包体上限与项目 19 MiB 守门线 | 不得放宽或绕过构建检查 |
| `docs/offhand_weapon_design.md` 的 15 把副武器数量和类型 | 产品设计基准；变更前必须重新确认 |
| `assets/scripts/catalogs/offhandCatalog.ts` 的 15 把副武器数据 | 修改必须同步设计、实现、测试和基线 |
| `assets/scripts/offhand/offhandManager.ts` 的机制类型对应关系 | 不得随意替换机制身份 |
| `assets/scene/Main.scene` 及其他 Cocos 场景 JSON / UUID | 禁止文本方式编辑 |

受保护项确需调整时，先说明原因、影响、存档或兼容风险、测试方案，并取得明确确认。不能通过复制一套新字段或新公式来规避约束。

## 5. 开发规则

1. 修改前先运行 `git status --short --branch`，保留所有不属于当前任务的工作区改动。
2. 先定位实际运行时调用链，再修改 catalog、Manager 或 UI；不得只改说明文字让界面看似正确。
3. 静态内容放在 `catalogs/`，运行行为由对应 Manager 负责，共享类型和纯函数放在 `core/`。
4. 不手工编辑 Cocos 场景 JSON。新增节点、层级和组件使用代码创建。
5. 不手改资源 `.meta` 中的 UUID；同名换图保留原 `.meta`，新增资源使用唯一 UUID。
6. UI 图标、角色、怪物、武器、VFX 和音频替换必须遵守 [美术替换指南](docs/ART_REPLACEMENT_GUIDE.md) 与 [UI 系统说明](docs/UI_SYSTEM.md)。
7. 存档字段变更必须提供旧存档兼容、默认值和重载测试，遵守 [存档与平台说明](docs/SAVE_AND_PLATFORM.md)。
8. 机制、数值或内容数量变更必须同步 catalog 测试、机制基线和差异状态。
9. 不新增第二份公式、价格、资源 key 或内容数量常量；需要共享时导出单一权威值。
10. 不把 TODO、设计稿、catalog 描述或未调用纯函数当作已经运行的能力。

当前模块边界见 [项目架构说明](docs/PROJECT_ARCHITECTURE.md)，日常环境和工作流见 [开发说明](docs/DEVELOPMENT_GUIDE.md)。

## 6. 验证门禁

普通代码改动至少执行：

```bash
npm run typecheck
npm test
```

`npm run typecheck` 等价于：

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
```

任何数值、公式、主武器、offhand、敌人、掉落、波次或成长改动，必须同时完成 TypeScript 检查、相关测试和真实 Cocos/CDP 跑局：

```bash
npm run typecheck
npm test
npm run balance:e2e:smoke
```

涉及多把武器或整体平衡时：

```bash
npm run balance:build-web
npm run balance:pipeline
```

`balance:pipeline` 默认带 `--skip-build`，必须先确认 `build/web-mobile/assets/main/index.js` 是本次源码生成、大小至少 100 KB，并包含 `__starfallGame` 与 `__starfallBulkTick`。不得用 `combatFormulas.ts` 的纯函数测试替代真实 Cocos 跑局。

UI、角色、怪物、武器或 VFX 改动必须在 720×1280 真实 Web/Cocos 画面中检查；抖音交付还必须运行：

```bash
npm run build:bytedance
npm run size:bytedance
```

完整命令、缓存处理和验收矩阵见 [测试与构建基线](docs/TESTING_AND_BUILD.md)。不要把删除整个 `library/` 或反复打开 Cocos GUI 当作常规修复手段。

## 7. 文档更新合同

同一次改动必须更新对应基线：

| 改动 | 必须同步 |
|---|---|
| 机制、公式、数值、内容规模 | `docs/GAMEPLAY_MECHANICS.md`、相关测试 |
| 发现、决定或关闭差异 | `docs/BASELINE_GAPS.md` |
| 架构、模块所有权、帧循环 | `docs/PROJECT_ARCHITECTURE.md`、`docs/DEVELOPMENT_GUIDE.md` |
| UI、图标、布局或皮肤 key | `docs/UI_SYSTEM.md` |
| 角色、怪物、武器、VFX、音频或资源目录 | `docs/ART_REPLACEMENT_GUIDE.md` |
| 存档、广告、抖音 SDK 或平台配置 | `docs/SAVE_AND_PLATFORM.md`、`docs/SUBMISSION_CHECKLIST.md` |
| 受保护约束或全项目事实 | 本文件、`docs/BASELINE.md` |

历史审查、平衡计划和带日期报告只保存当时结论，不得反向覆盖当前基线。

## 8. 交付前检查

- 改动范围只包含本任务需要的文件。
- 没有手工编辑场景 JSON、UUID 或受保护项。
- 当前行为能追溯到运行时源码，不是仅存在于描述或测试镜像。
- 必需验证已运行，并明确记录通过、失败或未运行原因。
- 真实 Cocos/CDP 产物来自本次源码。
- 受影响的基线文档与 gap 状态已同步。
- 新资源和抖音产物满足 19 MiB 守门线。

最后更新：2026-07-11（`SF-2026-07-11`）。

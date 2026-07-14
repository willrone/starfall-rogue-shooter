# 星坠幸存者项目架构基线

基线日期：2026-07-11
项目：`starfall-rogue-shooter`
运行环境：Cocos Creator 3.8.8 + TypeScript + 抖音小游戏
设计分辨率：竖屏 `720 x 1280`

本文只描述当前仓库中已经存在并实际运行的架构，不把未来重构目标写成已完成能力。任何架构调整都必须同时更新本文和 `AGENTS.md`。

## 1. 权威边界

项目约束和行为事实按以下方式判定：

1. `AGENTS.md` 定义不可违反的产品与工程约束。
2. 当前运行时行为以 `assets/scripts/` 下实际执行的代码为准。
3. 数据规模和 ID 以 `assets/scripts/catalogs/` 为准。
4. 自动化契约以 `tests/run.ts` 实际导入的测试为准。
5. 构建行为以 `package.json`、`tools/cocos_build_guard.py` 和 `tools/bot/` 下的当前脚本为准。

如果文档与代码冲突，不能只修改文档掩盖问题。应先确认设计意图，再在同一变更中同步代码、测试、`AGENTS.md` 和对应基线文档。

## 2. 运行时总览

项目只有一个 Cocos 场景：

```text
assets/scene/Main.scene
```

场景只负责挂载入口组件。Canvas、Camera、战斗世界、HUD、菜单、机库、商店、弹窗等节点都由 `assets/scripts/RogueShooterGame.ts` 在运行时创建。

```text
Main.scene
    |
    v
RogueShooterGame.start()
    |-- createCanvas()                  创建 Camera 和 Canvas
    |-- UIManager.init()                初始化动态 UI 根节点
    |-- EquipmentManager.loadProgress() 读取本地进度
    |-- buildScene()                    创建世界、HUD 和全部代码面板
    |-- openHome()                      显示首屏
    |-- AudioManager.initAudio()        初始化音频
    `-- loadPlaceholderArt()            异步加载运行时美术
```

关键规则：禁止手工编辑 `assets/scene/Main.scene` 或其 JSON 节点结构。场景中的 UUID 引用由 Cocos 管理；新增或调整界面、世界节点时应修改代码构建逻辑。

## 3. 当前目录与模块职责

```text
assets/scripts/
├── RogueShooterGame.ts
├── ad/
│   └── AdManager.ts
├── ai/
│   └── botAI.ts
├── audio/
│   └── audioManager.ts
├── catalogs/
│   ├── enemyCatalog.ts
│   ├── waveCatalog.ts
│   ├── equipmentCatalog.ts
│   ├── equipmentLootChoices.ts
│   ├── equipmentProgression.ts
│   ├── offhandCatalog.ts
│   ├── runItemCatalog.ts
│   └── weaponCatalog.ts
├── core/
│   ├── combatFormulas.ts
│   ├── gameContext.ts
│   ├── gameTimer.ts
│   ├── resources.ts
│   ├── stats.ts
│   └── types.ts
├── enemy/
│   ├── enemyConstants.ts
│   ├── enemyManager.ts
│   ├── enemyMovement.ts
│   ├── enemySpawnPatterns.ts
│   └── enemyTypes.ts
├── flow/
│   └── battleFlow.ts
├── offhand/
│   └── offhandManager.ts
├── pickup/
│   └── pickupManager.ts
├── projectile/
│   └── projectileManager.ts
├── shop/
│   ├── equipmentLoadout.ts
│   └── equipmentManager.ts
├── state/
│   └── combatState.ts
└── ui/
    ├── AsyncHelper.ts
    ├── ChoicePopup.ts
    ├── EventManager.ts
    ├── PopupBase.ts
    ├── RevivePopup.ts
    ├── SettlementPopup.ts
    ├── ShopPopup.ts
    ├── UIBase.ts
    ├── UIConfig.ts
    ├── UIHelpers.ts
    ├── UIManager.ts
    └── panels.ts
```

### 3.1 入口编排层

`assets/scripts/RogueShooterGame.ts` 是唯一入口组件，当前负责：

- Cocos 生命周期、输入注册和帧循环。
- 创建 Camera、Canvas、World、HUD 和代码面板。
- 持有并调度各 Manager。
- 玩家移动、镜头、角色朝向和部分战斗逻辑。
- 角色属性汇总、战斗开始/结束、暂停、撤离和结算编排。
- 资源预加载、图标缓存、通用视觉反馈。
- 暴露 CDP 自动化钩子。

该文件仍是较大的编排组件，并非纯粹的薄入口。文件顶部存在 `// @ts-nocheck`，因此 `npm run typecheck` 不会对该文件执行完整类型检查。新增职责不应继续无条件堆入入口；优先放到已有 Manager、纯函数或 catalog 中。

### 3.2 Core 纯逻辑层

`assets/scripts/core/` 定义共享类型、基础属性、资源钱包、事件和可测试公式：

| 文件 | 当前职责 |
|---|---|
| `types.ts` | `CharacterStats`、装备、武器、副武器、敌人、资源、阶段等跨模块类型 |
| `stats.ts` | 基础属性、空属性、属性相加和显示格式 |
| `resources.ts` | 资源定义、钱包创建、检查、扣除和显示 |
| `combatFormulas.ts` | 子弹公式及部分波次/平衡近似函数 |
| `gameContext.ts` | `GameEventBus` 和事件类型 |
| `gameTimer.ts` | 与 Cocos 解耦的计时器 |

`core/` 不应 import `cc`，也不应创建 Node、Sprite 或 Graphics。

注意：当前部分公式在 `combatFormulas.ts` 与运行时 Manager 中仍有重复。尤其是射速机制和波次函数，不能假定纯函数与运行时永远自动同步。修改公式时必须同时检查：

- `assets/scripts/core/combatFormulas.ts`
- `assets/scripts/projectile/projectileManager.ts`
- `assets/scripts/enemy/enemyManager.ts`
- `assets/scripts/enemy/enemyConstants.ts`
- `tests/balance/`

### 3.3 Catalog 数据层

`assets/scripts/catalogs/` 负责静态定义和数据生成，不创建 Cocos 节点：

| 文件 | 当前职责 |
|---|---|
| `weaponCatalog.ts` | 主武器家族、T1-T10 变体、攻击风格和武器实例生成 |
| `equipmentCatalog.ts` | 被动装备蓝图、品质、Starter 装备和装备总目录 |
| `equipmentProgression.ts` | 家族、变体、品质和蓝图解锁条件 |
| `equipmentLootChoices.ts` | Boss 装备战利品候选和应用规则 |
| `runItemCatalog.ts` | 本局商店道具和升级三选一蓝图 |
| `enemyCatalog.ts` | 基础怪、词缀、小 Boss 和大 Boss 数据 |
| `waveCatalog.ts` | 波 1~9 压力表、累计解锁过滤、阵型 budget、Boss 阶段/援军和小 Boss 调度合同 |
| `offhandCatalog.ts` | 15 把副武器及 T1-T5 数值 |

新增内容时，catalog 负责“它是什么”，对应 Manager 负责“它如何运行”。不要把 Cocos Node 或存档副作用写进 catalog。

### 3.4 状态层

当前只有一个显式状态对象：

```text
assets/scripts/state/combatState.ts
```

`CombatState` 同时保存：

- 当前 `GamePhase`。
- 永久资源和完成出击次数。
- 玩家位置、生命、护盾和机制计时器。
- 波次、无尽循环、Boss 和战斗统计。
- 本局资源、等级、XP 和副武器战斗状态。

它尚未拆成 `ProgressState`、`RunState`、`PlayerState` 或 `WorldState`。实体数组也分别由 Manager 持有，例如敌人在 `EnemyManager`、子弹在 `ProjectileManager`、拾取物在 `PickupManager`。

`resetCombatSession()` 只重置本局状态。增删 `CombatState` 字段时，必须同步检查 `createCombatState()`、`resetCombatSession()`、HostContext、存档和测试。

### 3.5 运行时 Manager

| Manager | 文件 | 所有权 |
|---|---|---|
| `EnemyManager` | `enemy/enemyManager.ts` | 消费 `waveCatalog.ts` 执行普通波/Boss 波调度，并负责刷怪、移动、技能、受伤、死亡、敌人视觉和敌方掉落 |
| `ProjectileManager` | `projectile/projectileManager.ts` | 玩家子弹、敌方弹、命中、主武器机制和攻击 VFX 对象池；子弹贴图成功时只启用 Sprite，缺图时使用 Graphics fallback |
| `PickupManager` | `pickup/pickupManager.ts` | 拾取物、浮字、本局属性、升级/宝箱选择和道具应用 |
| `EquipmentManager` | `shop/equipmentManager.ts` | 商店、仓库、配装、强化、合成、进度和本地存档 |
| `OffhandManager` | `offhand/offhandManager.ts` | 15 种副武器战斗行为和副武器实体；持续范围伤害使用固定频率结算 |
| `AudioManager` | `audio/audioManager.ts` | BGM、SFX、冷却和淡入淡出 |
| `BotAIController` | `ai/botAI.ts` | CDP 平衡跑局使用的移动和选择策略 |
| `AdManager` | `ad/AdManager.ts` | 激励广告占位实现、战前增益和复活次数 |

这些 Manager 仍依赖 Cocos，并不是纯逻辑系统。

### 3.6 HostContext 通信边界

主要 Manager 各自声明结构化 Host 接口：

- `EnemyHostContext`
- `ProjectileHostContext`
- `PickupHostContext`
- `ShopHostContext`
- `OffhandHostContext`
- `AudioHostContext`
- `BotAIHost`

入口通过类似下面的方式把自身作为宿主传入：

```ts
new EnemyManager(this as unknown as EnemyHostContext)
```

这样减少了 Manager 对入口具体类名的 import，但仍是同步回调和共享状态耦合。`as unknown as` 会绕开实例化点的完整类型验证，因此调整 HostContext 时必须运行 `tests/flows/hostContextContract.test.ts`，并检查入口实际提供了所有字段和方法。

### 3.7 事件总线现状

`assets/scripts/core/gameContext.ts` 提供类型化 `GameEventBus`。当前运行时会发射敌人死亡、波次、玩家受伤、治疗和战斗结束等事件，但模块间主通信仍以 HostContext 直接调用为主。

不要在文档或新代码中把当前系统描述成“全部事件驱动”。新增事件前应先确认是否真的存在多个订阅者或需要解耦；否则优先保持清晰的直接接口。

## 4. 帧循环顺序

`RogueShooterGame.update()` 的顺序是战斗行为的一部分，不能随意交换：

1. 更新 Toast、音频冷却/BGM 淡变和浮字。
2. 战斗阶段把 `dt` 截断到最大 `1/30` 秒。
3. 更新玩家、无人机视觉和镜头。
4. 刷怪并更新主武器开火。
5. 更新玩家子弹。
6. 更新敌方弹。
7. 更新敌人、副武器和玩家/敌人碰撞修正。
8. 更新拾取、生命恢复和护盾。
9. 更新攻击特效池、`WorldVfxLayer` 短时特效池、地面标记、死亡粒子和屏幕 VFX；共享敌人血条层按 0.1 秒整体重绘。
10. 逐帧检查 HUD 条形宽度；HUD 文案按 0.1 秒节流，阶段变化时立即刷新。

变更顺序可能影响命中、死亡掉落、副武器触发、碰撞和同帧结算。涉及顺序调整时必须补回归测试并跑真实 Cocos 烟测。

## 5. 游戏阶段与流程

`assets/scripts/core/types.ts` 中的 `GamePhase` 是当前阶段全集：

```text
menu
hangar
combat
level-up
item-choice
discard
shop
loot
paused
```

主要流转：

```text
menu -> hangar -> combat
combat -> level-up/item-choice/shop/paused -> combat
combat -> death/extract -> settlement -> loot 或 hangar
loot -> hangar
```

战斗结束规则的纯逻辑位于 `assets/scripts/flow/battleFlow.ts`，实际弹窗和节点切换由入口、`PickupManager`、`EquipmentManager` 和 UI 模块协同完成。

## 6. UI 架构

当前 UI 是两套互补体系，不应混写成单一框架。

### 6.1 常驻和代码面板

以下组件负责 HUD、主菜单、机库、副武器、锻造、暂停和设置等常驻节点：

- `assets/scripts/ui/panels.ts`：保存节点与 `ButtonView` 引用，统一显隐。
- `assets/scripts/ui/UIHelpers.ts`：创建 Label、Rect、Button、九宫格 Sprite 和坐标换算。
- `assets/scripts/RogueShooterGame.ts`：创建和刷新具体面板。

这些节点在 `buildScene()` 中一次性创建，再通过 `PanelManager` 切换状态。

### 6.2 动态弹窗

以下组件负责需要异步返回结果、遮罩和栈管理的弹窗：

- `assets/scripts/ui/UIManager.ts`
- `assets/scripts/ui/UIBase.ts`
- `assets/scripts/ui/PopupBase.ts`
- `assets/scripts/ui/ChoicePopup.ts`
- `assets/scripts/ui/ShopPopup.ts`
- `assets/scripts/ui/RevivePopup.ts`
- `assets/scripts/ui/SettlementPopup.ts`

`UIManager` 必须在 Canvas 创建后初始化，动态弹窗也必须挂在 Canvas 下，否则可能出现遮罩拦截输入但内容不可见的问题。

新增 UI 前先判断其生命周期：常驻面板使用 `PanelManager + UIHelpers`；需要异步结果和模态遮罩的界面使用 `UIManager + PopupBase`。不要在同一功能里同时创建两套可见节点。

## 7. 资源加载

运行时资源必须位于 `assets/resources/`。入口会预加载：

```text
art/placeholder
art/characters
art/enemies
art/weapons
```

UI、攻击特效和音频按各模块中的 `resources.load()` / `resources.loadDir()` 路径加载。玩家子弹的对应 SpriteFrame 成功加载后会关闭并清空该弹丸的 `Graphics` fallback；资源尚未加载或缺失时才保留程序化弹丸。其他部分对象也可能回退为 `Graphics` 程序绘制。

源素材和预览位于 `assets/art_source/`，不属于运行时 resources。替换资源时必须同时保留或正确更新对应 `.meta`，避免 UUID 变化和引用失效。

## 8. 持久化和平台边界

永久进度目前由 `assets/scripts/shop/equipmentManager.ts` 直接使用 `sys.localStorage` 读写：

```text
starfall-rogue-shooter-progress-v1
```

存档包括永久资源、已拥有装备、出战装备、装备等级、蓝图、副武器拥有/等级和当前副武器。

当前没有 `StorageAdapter`、云存档或正式迁移器。修改字段时必须兼容旧字段缺失、非法 ID、重复主武器和 Starter 装备补齐。不能无提示更换存档键或清空用户进度。

`assets/scripts/ad/AdManager.ts` 当前仍是模拟广告回调，广告位 ID 为空，不是正式抖音广告接入。平台能力不能在基线中描述为已上线。

## 9. 自动化接口

入口在 Web 运行时暴露以下 CDP 钩子：

- `window.__starfallGame`
- `window.__starfallTick`
- `window.__starfallStartBattle`
- `window.__starfallBulkTick`
- `window.__starfallPressKey`
- `window.__starfallSetSeed`
- `window.__starfallResetRandom`

这些接口由 `tools/bot/run_balance_cdp.py`、`tools/bot/run_balance_e2e.py` 和 `tools/bot/run_balance_pipeline.py` 使用。修改名称、可见字段或阶段流转时，必须同步 Bot 工具和测试。

## 10. 当前类型与测试边界

`tsconfig.json` 当前配置：

- `strict: false`
- `noEmit: true`
- 只包含 `assets/**/*.ts` 和 `temp/declarations/**/*.d.ts`

因此：

- `npm run typecheck` 不检查 `tests/**/*.ts` 和 Python 工具。
- `RogueShooterGame.ts` 因 `@ts-nocheck` 不受完整检查。
- `npm test` 只执行 `tests/run.ts` 显式 import 的测试。
- Cocos Node、资源加载、触控和画面仍需 Web/Cocos 运行时验证。

新代码应按严格类型风格编写，即使全局尚未开启 `strict`。不要新增无边界的 `any` 或继续扩大 `@ts-nocheck` 范围。

## 11. 依赖规则

当前允许的主要依赖方向：

```text
RogueShooterGame
    -> Manager / UI / Flow
Manager
    -> state / catalogs / core / Cocos
UI
    -> core types / Cocos
catalogs
    -> core types
state
    -> core types
core
    -> 不依赖 Cocos 和上层模块
```

必须保持：

- `core/` 不 import `cc`。
- catalog 不创建节点、不访问存档、不修改战斗状态。
- Manager 不 import `RogueShooterGame`，通过 HostContext 获取宿主能力。
- UI 不直接定义战斗公式或 catalog 数据。
- 禁止循环依赖。
- 新增运行时资源必须放入 `assets/resources/`，源素材不能混入运行包。
- 禁止手工修改场景 JSON、资源 UUID 或受保护的状态字段名。

## 12. 演进原则

后续重构可以继续缩小入口职责，但必须遵循小步迁移：

1. 先增加测试或明确现有行为。
2. 一次只迁移一个职责。
3. 保留稳定 HostContext 或提供兼容层。
4. 不在重构中顺带修改数值和玩法。
5. 每步运行 TypeScript、测试和对应的真实 Cocos 验证。
6. 架构落地后再更新本文，不能提前把目标目录写成现状。

当前优先技术债：

- 逐步移除入口的 `@ts-nocheck`。
- 收敛运行时公式与 `core/combatFormulas.ts` 的重复实现。
- 为本地存档增加版本化迁移边界。
- 继续补 Manager 层行为测试。
- 明确并减少静态面板与动态弹窗的重复职责。

# 星坠幸存者编程规范

基线日期：2026-07-11
适用范围：`assets/scripts/**/*.ts`、`tests/**/*.ts`、`tools/**/*.py`、运行时资源、构建配置和项目文档

本文定义新增和修改代码必须遵守的规则。项目真实架构见 [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md)，开发与验证命令见 [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md)。根目录 `AGENTS.md` 的不可修改项优先于本文。

## 1. 基本原则

1. **先确认事实**：以实际运行时源码、catalog、测试和构建脚本为依据，不从旧计划推断现状。
2. **改动聚焦**：一个变更处理一个明确问题，避免顺带改架构、数值、UI 和美术。
3. **保持模块所有权**：数据放 catalog，运行行为放 Manager，纯逻辑放 core/flow，表现放 UI 或对应运行时模块。
4. **显式副作用**：函数名、参数和返回值要让调用者知道是否修改状态、创建节点、消费资源或写存档。
5. **测试与文档同行**：行为、资源 key、目录、命令或约束变化时，同一变更必须更新测试和对应基线文档。
6. **不把目标写成现状**：不存在的 `systems/`、`adapters/` 或拆分状态只能写成技术债，不能在代码和文档中假装已完成。
7. **保护用户工作**：工作区可能已有改动，不回滚、不覆盖、不格式化无关文件。

## 2. 当前目录所有权

新增代码先选择已有边界：

| 目录/文件 | 当前所有权 |
|---|---|
| `assets/scripts/RogueShooterGame.ts` | Cocos 生命周期、入口编排、Canvas/世界/UI 创建和跨系统协调 |
| `assets/scripts/core/` | 共享类型、基础属性、资源钱包、事件和可测试纯逻辑 |
| `assets/scripts/catalogs/` | 武器、装备、道具、敌人、副武器和进度静态数据 |
| `assets/scripts/state/combatState.ts` | 当前显式战斗与部分永久状态 |
| `assets/scripts/enemy/` | 敌人实体、刷怪、移动、技能、Boss、伤害和死亡 |
| `assets/scripts/projectile/` | 玩家子弹、敌方弹、主武器机制和攻击 VFX |
| `assets/scripts/pickup/` | 拾取、浮字、升级、宝箱和本局属性 |
| `assets/scripts/shop/` | 商店、仓库、配装、强化、合成、解锁和本地存档 |
| `assets/scripts/offhand/` | 副武器运行时实体与机制 |
| `assets/scripts/flow/` | 不依赖 Cocos 的阶段与结算规则 |
| `assets/scripts/ui/` | UI helper、节点引用、弹窗生命周期和具体弹窗 |
| `assets/scripts/audio/` | BGM/SFX 加载和播放 |
| `assets/scripts/ad/` | 广告占位与平台广告边界 |
| `assets/scripts/ai/` | CDP/Bot 决策，不承载真人玩法补偿 |

新增目录必须解决真实边界问题。禁止为“看起来更架构化”创建空壳 `Manager2`、`NewSystem`、`CommonUtils` 或只有一层转发的 Adapter。

## 3. TypeScript 规范

### 3.1 当前类型安全限制

`tsconfig.json` 当前为：

```text
strict: false
noEmit: true
include: assets/**/*.ts, temp/declarations/**/*.d.ts
```

此外 `assets/scripts/RogueShooterGame.ts` 顶部存在 `// @ts-nocheck`。

必须清楚：

- `npm run typecheck` 不检查 `tests/**/*.ts` 和 Python 工具。
- 入口文件不会得到完整类型检查。
- HostContext 在入口通过 `as unknown as` 连接，编译通过不能证明契约完整。
- 新代码不能因为全局不严格就省略类型或扩大 `@ts-nocheck`。

新增代码要求：

- 公共函数、Manager public 方法和 HostContext 方法显式声明返回类型。
- 优先使用具体类型、union、泛型和 `unknown` 收窄，不使用无边界 `any`。
- 可缺失值按真实语义使用 `T | null` 或可选字段，不用虚假非空断言掩盖初始化问题。
- 不新增文件级 `@ts-nocheck`；必须局部绕过时写明原因和清理条件。
- 不用双重断言替代契约修复。当前入口已有的 `as unknown as HostContext` 是技术债，不是新代码模板。

### 3.2 命名

- 文件名使用项目现有的 `camelCase.ts` 或已建立的 `PascalCase.ts` UI 类风格，不为统一大小写批量重命名旧文件。
- 类型、接口、类、枚举使用 `PascalCase`。
- 函数、方法、字段使用 `camelCase`。
- 常量使用 `UPPER_SNAKE_CASE`。
- Catalog ID 使用稳定的小写连字符形式，例如 `storm-rifle`。
- 资源 key 遵循现有小写下划线形式，例如 `wpn_storm_rifle`。
- 不使用 `temp2`、`newManager`、`fixFinal` 等缺少领域含义的名称。

### 3.3 Import

推荐顺序：

1. `cc` import。
2. 项目运行时 import。
3. `import type`。

规则：

- 纯类型必须使用 `import type`。
- `core/` 不得 import `cc` 或上层 Manager/UI。
- catalog 不得 import `RogueShooterGame`、Cocos 节点、存档或 UI。
- Manager 不得 import `RogueShooterGame`；通过 HostContext 获取宿主能力。
- 禁止循环依赖。
- 不为缩短路径引入新的 barrel file，除非确认不会制造循环和 Cocos 打包问题。

### 3.4 函数与副作用

| 语义 | 推荐命名 | 约束 |
|---|---|---|
| 查询 | `getX`、`findX`、`isX`、`canX` | 不修改状态 |
| 格式化 | `formatX` | 不修改状态，不访问 Cocos 节点 |
| 创建 | `createX`、`buildX`、`spawnX` | 明确是否创建 Node 或数据 |
| 修改 | `applyX`、`addX`、`spendX`、`resetX`、`clearX` | 明确修改对象和失败语义 |
| 持久化 | `loadX`、`saveX`、`migrateX` | 集中处理兼容和异常 |

要求：

- 纯计算不要同时播放音效、创建浮字或写存档。
- 消费资源的函数返回成功/失败或明确错误原因，不能先扣资源再静默失败。
- 随机逻辑通过现有随机入口或可注入函数测试，不能在测试中依赖不稳定概率。
- 较长方法优先按领域步骤拆分，但不要为了行数制造无意义一行 wrapper。
- 新增大 switch 前检查是否应由 catalog 字段、策略表或独立方法承载。

### 3.5 注释

- 注释解释原因、约束、单位、公式来源和非显然顺序，不复述代码。
- 数值注释必须与实际单位一致，例如秒、像素、比例或倍率。
- TODO 必须说明未完成行为和验收条件；长期差异登记到 `docs/BASELINE_GAPS.md`。
- 不保留已经失效的“已修复”“临时”叙述。
- 对受保护公式的修改要在注释中链接权威源码或测试，而不是复制另一份易漂移公式。

## 4. Core、Catalog 与运行时规则

### 4.1 Core

- `core/types.ts` 只放跨模块稳定类型，不放 Cocos 组件实现。
- `core/stats.ts` 和 `core/resources.ts` 保持纯函数和显式输入输出。
- `core/combatFormulas.ts` 当前与运行时存在部分镜像差异。修改公式必须同时核对 `projectileManager.ts`、`enemyManager.ts`、`enemyConstants.ts` 和平衡测试。
- 不把测试近似函数描述为唯一运行时实现。

### 4.2 Catalog

Catalog 负责“定义什么”，Manager 负责“如何运行”：

- Catalog 数据不创建 Node、Sprite、Graphics 或 AudioSource。
- Catalog 不读写 `CombatState`、localStorage 或文件。
- ID 一旦进入存档，不能无迁移地重命名。
- 新增字段必须更新类型、生成函数、消费者和 catalog 测试。
- 内容数量从 catalog 生成或测试，不在多个文档手工维护重复表。
- 描述文字必须与实际 mechanic 一致；发现差异先登记 gap，不用文案掩盖未实现行为。

### 4.3 运行时 Manager

- Manager 拥有自己的实体数组、对象池和运行规则。
- 不直接操作其他 Manager 的私有字段；通过 HostContext 或明确 public 方法通信。
- 战斗重开前必须清理节点、池外状态、计时器、Set/Map 和临时效果。
- 高频路径不能每帧 `resources.load()`、创建大量临时 Node 或无界增长数组。
- 修改更新顺序时视为行为变更，必须增加回归测试和真实 Cocos 验证。

## 5. HostContext 合同

当前主要接口包括：

```text
EnemyHostContext
ProjectileHostContext
PickupHostContext
ShopHostContext
OffhandHostContext
AudioHostContext
BotAIHost
```

新增或修改 HostContext 时：

1. 只暴露 Manager 真正需要的最小能力。
2. 优先暴露领域方法，不暴露整个入口或无关 Manager。
3. 在 `RogueShooterGame.ts` 提供真实字段/方法。
4. 同步更新 `tests/flows/hostContextContract.test.ts`。
5. 运行 `npm run typecheck`、`npm test` 和真实 Web 烟测。

禁止：

- 在 Manager 中 import 并向下转型 `RogueShooterGame`。
- 为绕过接口缺失大量使用 `(ctx as any)`。
- 把可修改的内部集合暴露给不相关模块。
- 认为 `as unknown as HostContext` 已经完成运行时验证。

`GameEventBus` 当前只部分接入。只有存在真实多订阅者、异步边界或需要解除双向依赖时才新增事件；不要同时保留事件和直接调用两条重复业务路径。

## 6. 状态与存档

### 6.1 CombatState

增删 `assets/scripts/state/combatState.ts` 字段时必须同步：

- `CombatState` 接口。
- `createCombatState()` 初始值。
- `resetCombatSession()` 单局重置。
- 使用该字段的 HostContext。
- 阶段流、HUD、Bot 状态读取和测试。

不要重命名 `AGENTS.md` 保护的共享状态字段。需要迁移时先列出所有读写点和兼容方案。

### 6.2 永久进度

当前存档集中在 `assets/scripts/shop/equipmentManager.ts`，使用：

```text
sys.localStorage
starfall-rogue-shooter-progress-v1
```

存档规则：

- 新字段必须兼容旧存档缺失。
- 读取后验证数值范围、数组类型、ID 存在性和槽位不变量。
- Starter 装备补齐和配装归一化不得遗漏。
- 破坏性变更使用明确版本迁移，不复用旧键静默覆盖。
- 不在其他模块复制新的 localStorage 写入点；平台存储应建立统一边界。
- 写存档失败不得让当前战斗崩溃，但必须留下可定位日志。

## 7. Cocos 与场景规范

### 7.1 单场景合同

项目唯一场景是：

```text
assets/scene/Main.scene
```

Canvas、Camera、World、HUD、菜单、机库、商店和弹窗节点均由代码创建。

绝对禁止：

- 手工编辑场景 JSON。
- 复制或修改场景 UUID。
- 为普通 UI 改动新增平行场景。
- 把代码生成的节点再手工保存回场景形成双重来源。

需要调整节点时修改 `RogueShooterGame.buildScene()`、对应 `build*Panel()`、UI helper 或 Popup 类。

### 7.2 Node 和组件

- 创建 Node 后设置正确 layer。
- 固定格式控件显式设置 `UITransform` 尺寸和 anchor 语义。
- 节点所有者负责销毁、回收和移除监听器。
- 静态背景、边框和不变文本不在每帧重画。
- 高频实体使用现有对象池或有上限的复用结构。
- `resources.load()` 回调必须处理节点已销毁、界面已关闭和加载失败。
- 不依赖异步资源回调来决定首屏是否可进入；必须保留可用 fallback。

### 7.3 Update 与性能

- `RogueShooterGame.update()` 的系统顺序属于战斗合同，不随意交换。
- 使用项目现有的 `dt` 上限，避免卡顿帧穿透和瞬时大量刷新。
- 大量敌人查询使用空间网格、Set 和检查上限，避免嵌套全表扫描。
- 数组、对象池、掉落、敌方弹、浮字和 VFX 必须有清理或容量限制。
- 性能问题用可关闭的 debug HUD 和真实设备数据定位，不靠猜测。

## 8. UI 规范

当前 UI 有两条路径：

### 8.1 常驻代码面板

```text
RogueShooterGame.ts
ui/panels.ts
ui/UIHelpers.ts
```

适用于 HUD、主菜单、机库、副武器、锻造、暂停、设置。

### 8.2 动态模态弹窗

```text
ui/UIManager.ts
ui/UIBase.ts
ui/PopupBase.ts
ui/ChoicePopup.ts
ui/ShopPopup.ts
ui/RevivePopup.ts
ui/SettlementPopup.ts
```

适用于遮罩、异步返回、弹窗栈和输入阻断。

规则：

- 新界面先选择一条生命周期路径，不同时创建两份可见实现。
- 设计坐标固定为 720x1280。
- 全局布局使用 `place()`，面板左上坐标使用 `placeLocal()`，不自行发明相反 Y 轴。
- 固定卡片、按钮、格子、进度条显式设置尺寸，动态文字不能推动布局。
- 主要触控目标满足项目最小高度和安全区要求。
- 按钮业务状态变化时同步 label、disabled、skin 和交互。
- UIManager 必须在代码创建的 Canvas 下初始化，动态弹窗不能挂到场景根。
- UI 不直接修改战斗公式或 catalog。
- 修改后在 720x1280 验证主菜单、机库、战斗、升级、商店、复活和结算，不以单张静态截图代替交互检查。

完整 UI 合同见 [`UI_SYSTEM.md`](./UI_SYSTEM.md)。

## 9. 资源与 `.meta`

### 9.1 目录边界

```text
assets/resources/   运行时加载，进入包体
assets/art_source/  源文件、候选图、拆帧和预览，不应直接加载
assets/app_store/   上架和分享素材，不是游戏内资源
```

不要把原始生图、PSD、GIF、contact sheet、候选大图或生成 sidecar 放入 `assets/resources/`。

### 9.2 同名替换

- 替换现有 PNG/MP3 时保持路径和文件名，优先保留原 `.meta`。
- 不手工改 `.meta` UUID。
- 不复制另一资源的 `.meta` 给新文件。
- 新资源通过 Cocos 生成合法且唯一的 `.meta`。
- 资源和 `.meta` 必须成对提交。
- 删除资源前先搜索 loader、catalog、代码路径和 UUID 引用。

### 9.3 资源合同

- 图片透明通道、尺寸、帧数和九宫格 border 必须匹配运行时合同。
- `resources` 路径不写扩展名；SpriteFrame 路径通常以 `/spriteFrame` 结尾。
- UI 图标不会自动扫描，新增 key 必须同步 loader 和业务映射。
- 主武器美术通常同时涉及 UI 图标、手持图、子弹 VFX 和 SFX，不能只替换其中一个就声明完成。
- `assets/resources/audio/` 中现有硬编码文件名受保护，不得随意改名。
- 资源改动必须验证真实加载和包体，不只检查文件存在。

完整替换流程见 [`ART_REPLACEMENT_GUIDE.md`](./ART_REPLACEMENT_GUIDE.md)。

## 10. 测试规范

### 10.1 默认入口

```bash
npm run typecheck
npm test
```

`npm test` 只执行 `tests/run.ts` 显式 import 的文件。新增测试必须：

1. 放入职责对应目录。
2. 在 `tests/run.ts` import。
3. 能在旧错误行为下失败。
4. 不依赖执行顺序或未固定的随机数。
5. 清理修改过的全局状态、随机函数和 singleton。

未被 import 的 `*.test.ts` 不能在交付说明中计为已通过。

### 10.2 测试类型

- 纯逻辑测试验证输入、输出和边界。
- Catalog 测试验证唯一 ID、数量、引用和生成结果。
- HostContext 测试验证入口确实提供接口要求。
- UI 源码合同测试可验证 loader、key、节点接线和布局不变量，但不能替代运行截图和点击。
- 资源测试验证 PNG、alpha、`.meta`、音频和映射。
- 数值测试是快速回归，不代替真实 Cocos/CDP 跑局。
- 存档改动必须覆盖旧字段缺失、非法 ID、重复主武器、空配装和重新加载。

### 10.3 风险验证

验证矩阵和真实命令以 [`TESTING_AND_BUILD.md`](./TESTING_AND_BUILD.md) 为准。最低规则：

- TypeScript 改动：typecheck + 默认测试。
- UI/资源：上述验证 + 720x1280 Web/Cocos 运行检查。
- 数值、武器、怪物、掉落和波次：上述验证 + 真实 Cocos/CDP。
- 抖音配置和平台能力：正式抖音构建、开发者工具和真机。

## 11. Python 与工具脚本

- 正式入口、诊断脚本和历史实验脚本必须能从文件名和 README 区分。
- 新工具使用 `pathlib.Path` 和项目根路径，不写死个人临时目录；固定 Cocos/Chrome 安装路径要集中定义并允许参数覆盖。
- 外部命令检查返回码和产物，不只匹配“Finished”日志。
- 不在 shell 字符串中拼接未转义的用户输入。
- 生成脚本默认不覆盖源素材或已有 `.meta`，除非参数明确要求。
- 工具失败时输出首个有效错误、使用的路径和退出码。
- Bot 不得加入只对自动玩家生效的数值补偿。
- `npm run test:tools` 当前没有正式 Python 测试覆盖；新增关键构建逻辑应同步增加可发现的 `*test.py`。

## 12. 错误处理与日志

- 可恢复的资源、音频和存档失败记录上下文后使用明确 fallback。
- 不用空 `catch` 吞掉影响玩家进度或战斗阶段的错误。
- 高频循环中的日志必须节流或仅在 debug 模式开启。
- 用户可见错误使用可理解的 Toast/状态，不暴露堆栈和内部 ID。
- 平台 API 回调要防重复、超时、关闭和组件销毁后回调。
- 调试钩子和 HUD 必须可关闭，不能改变真人模式数值。

## 13. 文档同步合同

文档不是事后备注。以下变化必须在同一变更中同步：

| 变化 | 必须更新 |
|---|---|
| 产品定位、核心循环、系统范围 | `GDD.md`、`BASELINE.md` |
| 架构、目录、模块所有权、生命周期 | `PROJECT_ARCHITECTURE.md`、`DEVELOPMENT_GUIDE.md` |
| 公式、内容数量、掉落、价格、波次、机制 | `GAMEPLAY_MECHANICS.md` |
| UI 坐标、控件、皮肤、图标 key | `UI_SYSTEM.md` |
| 角色、怪物、武器、VFX、音频资源合同 | `ART_REPLACEMENT_GUIDE.md` |
| 存档字段、广告、平台能力 | `SAVE_AND_PLATFORM.md` |
| 测试命令、构建脚本、包体规则 | `TESTING_AND_BUILD.md`、`DEVELOPMENT_GUIDE.md` |
| 不可违反约束 | 根目录 `AGENTS.md` |
| 新发现或已关闭的实现差异 | `BASELINE_GAPS.md` |

同步规则：

- 详细公式和内容数字只在 `GAMEPLAY_MECHANICS.md` 维护；GDD 只链接，不复制。
- 历史计划和报告保留其当时结论，但必须标明非当前基线。
- 不能把未实现目标写成“已接入”“完整实现”。
- Gap 关闭必须附测试、验证命令和日期，再改为 `FIXED` 或 `ACCEPTED`。
- 新文档必须加入 `BASELINE.md` 或 README 导航，避免孤立。
- 文件路径、命令和资源 key 必须可在当前仓库找到。

## 14. Git 与提交

不提交生成目录：

```text
build/
library/
temp/
local/
profiles/
node_modules/
__pycache__/
*.pyc
*.log
```

规则：

- 不回滚用户已有改动。
- 不使用破坏性 reset/checkout 清理工作区。
- 脚本、资源和 `.meta` 随所属功能一起提交。
- 不把大量临时 `data/` 跑局结果混入功能提交；长期基准需明确整理。
- 不保留 `文件 2.ts`、`AGENTS 3.md` 等冲突副本作为正式源码。
- 提交说明写清行为变化和实际运行的验证，不笼统写“全部测试通过”。

推荐提交格式：

```text
<type>: <summary>
```

常用类型：`feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`build`、`art`。

## 15. 禁止事项

- 禁止手工编辑 `assets/scene/Main.scene` JSON 或资源 UUID。
- 禁止修改 `AGENTS.md` 保护的基础属性、状态字段和机制而不先获得设计确认。
- 禁止在 `core/` 引入 Cocos、UI、存档或平台依赖。
- 禁止在 catalog 中写运行时副作用。
- 禁止新增主武器战斗内切换或允许主武器卸到 0 把。
- 禁止用 Python 独立仿真替代真实 Cocos/CDP 数值验证。
- 禁止把 `strict:false` 或现有 `@ts-nocheck` 当成跳过类型设计的理由。
- 禁止新增测试却不导入 `tests/run.ts`。
- 禁止只换源素材、不更新运行时 resources 和映射，却声明美术已经替换。
- 禁止只更新代码、不更新对应测试、基线文档和 gap 状态。
- 禁止把模拟广告、占位资源、旧构建或历史报告描述为正式上线能力。

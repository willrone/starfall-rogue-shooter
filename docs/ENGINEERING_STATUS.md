# 星坠幸存者工程状态

状态日期：2026-07-12
基线编号：`SF-2026-07-11`
引擎：Cocos Creator 3.8.8
目标平台：抖音小游戏，竖屏 720x1280

本文记录当前工程事实和最近一次正式抖音构建结果，不代表游戏已经发布就绪。产品和工程约束见 [`BASELINE.md`](./BASELINE.md)，未闭合问题见 [`BASELINE_GAPS.md`](./BASELINE_GAPS.md)。

## 1. 当前结论

当前工程已经具备可编译、可测试、可生成正式抖音小游戏产物的基础链路：

- 正式抖音构建前的 TypeScript 检查通过。
- `npm test` 默认测试套件通过。
- `balance:e2e:smoke` 已完成真实 Web/Cocos 启动、CDP 钩子和单局运行。
- Cocos Creator 3.8.8 已生成有效 `bytedance-mini-game` 产物。
- 当前正式产物为 10.22 MiB，低于工程 19 MiB 守门线。
- “异星战斗”正式 AppID `tt646d12d0fa08833b02` 已重新导入抖音开发者工具项目。

但运行验证尚未闭环：抖音开发者工具模拟器目前停在“信任并运行”的用户安全确认，尚未确认游戏在模拟器中完成冷启动、进入主菜单或跑通核心流程。该确认必须由用户本人在开发者工具中完成。

同时，`BASELINE_GAPS.md` 中仍存在未关闭的 P0/P1 项，广告仍是 stub，正式美术也有缺口。因此当前状态是：

> 正式构建产物已生成，开发者工具运行和发布前验收未完成，不可声明发布就绪。

## 2. 最近一次正式抖音构建

标准构建命令：

```bash
npm run build:bytedance
```

输出目录：

```text
/Users/ronghui/Documents/game_dev_cocos/build/bytedance-mini-game
```

本次记录：

| 检查项 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm test` | 通过 |
| `balance:e2e:smoke` | 运行链通过；冲锋枪第 1 波 21.7 秒死亡，平衡目标未达标 |
| Cocos 正式抖音构建 | 产物有效 |
| 产物大小 | 10.22 MiB |
| 工程守门线 | 19 MiB |
| 抖音开发者工具 | 4.5.4 |
| 正式 AppID | `tt646d12d0fa08833b02`（异星战斗） |
| 开发者工具导入 | 已完成 |
| 模拟器启动 | 未完成，等待用户确认“信任并运行” |
| 真机预览 | 未验证 |
| 上传/提审 | 未执行 |

产物通过不等于运行通过。完成“信任并运行”后，还必须记录模拟器控制台、首屏、核心流程和资源加载结果。

## 3. 构建守门现状

当前守门脚本：

```text
tools/cocos_build_guard.py
```

它负责：

- 默认使用 `debug=false` 生成正式抖音包。
- 在正式构建前运行 typecheck 和默认测试，除非明确使用跳过参数。
- 检查 `assets/main/index.js` 存在且不小于 100 KB。
- 检查 `project.config.json`、`game.json`、`game.js`、`src/settings.json` 和 `engine-adapter.js`。
- 从 `config/bytedance-project.json` 把正式 AppID 和项目名写入生成的 `project.config.json`。
- 统计产物文件总大小并执行 19 MiB 守门。
- 不只依赖 Cocos CLI 的退出码判断产物是否有效。

常用命令：

```bash
npm run build:bytedance
npm run build:bytedance:fast
npm run build:check
npm run size:bytedance
npm run verify:bytedance
```

命令语义：

- `build:bytedance`：typecheck、测试、正式构建和产物检查。
- `build:bytedance:fast`：仍运行 typecheck，但跳过默认测试。
- `build:check`：重跑 typecheck 和默认测试，检查已有产物，但不重新构建。
- `size:bytedance`：只报告已有产物大小。
- `verify:bytedance`：包含 Web/Cocos 烟测和正式抖音构建，适合发布前完整验证。

旧文档中的 `--marker`、`--sync-slim2`、12 MiB 限制、自动备份和固定脚本数检查不属于当前守门器能力。

## 4. 当前真实架构

### 4.1 启动与场景

- 唯一场景为 `assets/scene/Main.scene`。
- `assets/scripts/RogueShooterGame.ts` 是入口和总编排器。
- Camera、Canvas、World、HUD、菜单、机库、商店和弹窗节点由 TypeScript 创建。
- 场景 JSON 和资源 UUID 不允许手工编辑。

### 4.2 模块边界

```text
core/        共享类型、属性、资源、事件和纯逻辑
catalogs/    主武器、装备、道具、敌人、副武器和进度数据
state/       当前 CombatState
enemy/       刷怪、移动、技能、Boss、伤害和死亡
projectile/  子弹、敌方弹、主武器机制和攻击 VFX
pickup/      拾取、升级、宝箱和本局属性
shop/        商店、仓库、配装、合成、强化和存档
offhand/     副武器运行时机制
ui/          常驻面板 helper 与动态 Popup 体系
audio/       BGM 和 SFX
ad/          广告 stub 和奖励入口
ai/          CDP/Bot 决策
```

主要 Manager 通过 `EnemyHostContext`、`ProjectileHostContext`、`PickupHostContext`、`ShopHostContext` 和 `OffhandHostContext` 等结构接口访问入口能力。入口仍使用 `as unknown as HostContext` 连接，属于需要测试补足的类型边界。

UI 当前同时存在：

- `PanelManager + UIHelpers + RogueShooterGame` 的常驻代码面板。
- `UIManager + PopupBase` 的动态模态弹窗。

永久进度仍由 `EquipmentManager` 直接写入 `sys.localStorage`，正式云存档和版本化 Storage Adapter 尚未实现。

完整架构见 [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md)。

## 5. 类型与测试限制

当前 `tsconfig.json`：

```text
strict: false
include: assets/**/*.ts, temp/declarations/**/*.d.ts
```

入口 `assets/scripts/RogueShooterGame.ts` 仍带有 `// @ts-nocheck`。

因此本次 typecheck 通过只能证明当前纳入检查的 TypeScript 在非严格配置下可编译，不能证明：

- 入口文件获得了完整类型检查。
- HostContext 的运行时连接完全正确。
- `tests/**/*.ts` 和 Python 工具得到类型检查。
- Cocos 节点、资源、触控和平台 API 在模拟器或真机正确运行。

`npm test` 只运行 `tests/run.ts` 显式导入的测试。未被导入的测试文件不能计入“默认测试通过”。

## 6. 当前内容规模

以下数量来自当前 catalog 和生成规则：

| 内容 | 当前规模 |
|---|---:|
| 主武器 | 17 个家族 x 10 个变体 = 170 |
| 被动装备 | 44 个蓝图 x 5 个品质 = 220 |
| `EQUIPMENT` 总实例 | 390 |
| 副武器 | 15 把，T1-T5 |
| 本局道具 | 65 个单属性 blueprint x 5 个 tier = 325 |
| 升级选项 | 4 类 x 3 种 = 12 |
| 普通怪 | 10 个家族 x 11 个变体 = 110 |
| 小 Boss / 大 Boss | 5 / 5 |
| Cocos 场景 | 1 个 |

具体机制、公式和接线状态以 [`GAMEPLAY_MECHANICS.md`](./GAMEPLAY_MECHANICS.md) 为准。不要从历史报告或旧 README 复制规模数字。

## 7. 当前交付状态

| 阶段 | 状态 | 证据/阻塞 |
|---|---|---|
| TypeScript 检查 | 已通过 | 本次正式构建前置步骤 |
| 默认测试 | 已通过 | `npm test` |
| Web/Cocos 烟测 | 运行通过 / 平衡未达标 | 冲锋枪：第 1 波、21.7 秒、29 击杀、Lv.2；命令带 `--allow-balance-fail` |
| 正式抖音产物 | 已生成 | `build/bytedance-mini-game` |
| 包体守门 | 已通过 | 10.22 MiB / 19 MiB |
| 正式 AppID 导入 | 已完成 | 2026-07-12 已重新创建“异星战斗”开发者工具项目 |
| 开发者工具运行 | 未完成 | 等待用户确认“信任并运行” |
| 模拟器核心流程 | 未验证 | 尚未取得首屏、控制台和流程证据 |
| 真机预览 | 未验证 | 需要实际设备 |
| 正式广告 | 未完成 | `AdManager` 仍为随机模拟 stub，广告位为空 |
| P0/P1 机制闭环 | 未完成 | 见 `BASELINE_GAPS.md` |
| 正式美术闭环 | 未完成 | 玩家、Boss、武器挂载和部分图标仍有 gap |
| 上传 | 未执行 | 必须在运行验收后进行 |
| 提审 | 未执行 | 技术、素材和控制台要求均未闭环 |

## 8. P0/P1 阻塞入口

所有严重度、状态、证据和关闭条件以 [`BASELINE_GAPS.md`](./BASELINE_GAPS.md) 为唯一清单。

当前不得忽略的类别包括：

- 永久资源和 Boss 材料的获得、结算、入库、存档和消费闭环。
- 副武器专用材料、T1-T5 数值语义和多种未完整接线机制。
- 商店显示与实际扣款不一致。
- Boss 战利品选择后的持久化。
- 等级生命成长被属性重算覆盖。
- 广告日切和正式广告接入。
- 怪物解锁规则、测试镜像与运行时公式差异。
- 玩家动画、Boss 专属表现、武器挂载图和部分 UI 图标资源缺口。

只要仍有未关闭的 P0，正式提审就应保持阻塞。P1 是否允许带入候选版本必须逐项明确为 `FIXED` 或经产品确认的 `ACCEPTED`，不能保持 `OPEN/DECISION` 后宣称就绪。

## 9. 下一步验收顺序

1. 用户在抖音开发者工具中确认“信任并运行”。
2. 检查首次启动、主菜单、机库、战斗、升级、商店、暂停、死亡、结算和重载存档。
3. 保存开发者工具控制台、首屏和核心流程证据，记录是否有资源 404、脚本异常或平台 API 错误。
4. 关闭 `BASELINE_GAPS.md` 中的 P0，并逐项处理 P1。
5. 完成正式广告 SDK、广告位、失败/关闭/重复回调和隐私数据边界验证。
6. 补齐阻塞提审的正式美术资源并进行 720x1280 布局复核。
7. 重新执行 `npm run verify:bytedance`，确认产物仍低于守门线。
8. 复核本次第 1 波死亡是 Bot 策略、当前平衡还是运行回归；不得把 `--allow-balance-fail` 当作平衡验收。
9. 进入真机预览，检查触控、音频、性能、前后台恢复和存档。
10. 真机与提交材料均闭环后，再执行上传和提审流程。

## 10. Git 与证据

正式交付时应记录：

- Git commit/branch。
- 构建命令和完成时间。
- typecheck 与测试结果。
- 产物大小和构建输出目录。
- 开发者工具版本（本次为 4.5.4）、正式 AppID 项目和模拟器结果。
- 真机型号、系统版本和验证结果。
- 对应 gap 状态与测试证据。

不要提交 `build/`、`library/`、`temp/`、`local/`、`profiles/` 或 `node_modules/`。构建产物用于本地开发者工具和上传，不作为源码基线提交。

# 星坠幸存者文档中心

基线日期：2026-07-11  
适用版本：Cocos Creator 3.8.8 / TypeScript / 抖音小游戏 / 720×1280 竖屏

本目录是项目正式文档入口。新成员、AI Agent 和外包协作者必须先阅读[项目基线](./BASELINE.md)与根目录 [`AGENTS.md`](../AGENTS.md)，再按改动类型查阅专题文档。

## 当前基线

| 文档 | 用途 | 何时必须更新 |
|---|---|---|
| [BASELINE.md](./BASELINE.md) | 版本、权威顺序、内容规模、变更纪律 | 任何基线版本或权威关系变化 |
| [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) | 当前真实模块、生命周期、状态和依赖边界 | 新增模块、调整所有权或帧循环 |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | 开发环境、日常工作流和改动规则 | 工具、目录或开发流程变化 |
| [GAMEPLAY_MECHANICS.md](./GAMEPLAY_MECHANICS.md) | 当前源码已经实现的完整机制 | 公式、数值、流程或内容规模变化 |
| [BASELINE_GAPS.md](./BASELINE_GAPS.md) | 设计与实现差异、阻塞项和验收条件 | 发现、决定或关闭任何缺口 |
| [UI_SYSTEM.md](./UI_SYSTEM.md) | UI 架构、尺寸、皮肤、图标和界面验收 | UI 结构、key、布局或皮肤合同变化 |
| [ART_REPLACEMENT_GUIDE.md](./ART_REPLACEMENT_GUIDE.md) | UI、角色、怪物、武器、VFX、音频替换流程 | 资源目录、规格、loader 或工具变化 |
| [TESTING_AND_BUILD.md](./TESTING_AND_BUILD.md) | 测试、Web/CDP、抖音构建和发布前验证 | 脚本、守门线或构建产物变化 |
| [SAVE_AND_PLATFORM.md](./SAVE_AND_PLATFORM.md) | 存档字段、迁移、广告和抖音平台接入 | 存档 schema、SDK 或平台配置变化 |
| [GDD.md](./GDD.md) | 产品定位、体验目标和系统范围 | 产品方向或核心循环变化 |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | TypeScript、模块、资源与测试规范 | 工程规范变化 |
| [ENGINEERING_STATUS.md](./ENGINEERING_STATUS.md) | 带日期的工程状态和发布阻塞 | 完成一次正式基线审计或重大里程碑 |
| [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md) | 抖音提审前逐项检查 | 平台能力或交付流程变化 |

## 专题设计

- [offhand_weapon_design.md](./offhand_weapon_design.md)：15 把副武器的设计目标。当前实现差异以 `BASELINE_GAPS.md` 为准。
- [weapon_attack_effects.md](./weapon_attack_effects.md)：主武器攻击表现规范；资源替换仍以 `ART_REPLACEMENT_GUIDE.md` 为总入口。
- [playtest/PLAYTEST_TEMPLATE.md](./playtest/PLAYTEST_TEMPLATE.md)：人工试玩记录模板。

## 历史资料

以下文件是审查、重构或平衡过程快照，不能覆盖当前基线：

- `ARCHITECTURE_REVIEW.md`
- `BP1_BALANCE_PROGRESS_2026-06-28.md`
- `BUILD_PIPELINE_2026-06-28.md`
- `CHANGESET_GROUPS.md`
- `REFACTORING_PLAN.md`
- `upgrade_thresholds.md`
- `p0-balance-plan-2026-07-10.md`

文件名带空格后缀（例如 ` 2`、` 3`）的冲突副本不属于正式文档或工具链。除非先确认内容归属，否则不得引用、提交或据此开发。

## 文档更新合同

同一次改动必须同步更新受影响文档：

- 机制或数值：`GAMEPLAY_MECHANICS.md`、相关测试；存在设计差异时再更新 `BASELINE_GAPS.md`。
- 架构或状态：`PROJECT_ARCHITECTURE.md`、`DEVELOPMENT_GUIDE.md`。
- UI 或资源：`UI_SYSTEM.md`、`ART_REPLACEMENT_GUIDE.md`。
- 存档或平台：`SAVE_AND_PLATFORM.md`、`SUBMISSION_CHECKLIST.md`。
- 受保护约束或全项目事实：根目录 `AGENTS.md`。

文档不得把计划写成已完成实现。当前事实必须能追溯到源码、catalog、测试或构建产物。

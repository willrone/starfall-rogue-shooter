# 星坠幸存者开发说明

基线日期：2026-07-11
适用项目：`starfall-rogue-shooter`
引擎：Cocos Creator 3.8.8
目标平台：抖音小游戏，竖屏 `720 x 1280`

本文说明如何在当前真实工程上开发、验证和交付。开始修改前必须先阅读根目录 `AGENTS.md`；架构边界见 `docs/PROJECT_ARCHITECTURE.md`。

## 1. 开发环境

必要环境：

- macOS 上安装 Cocos Creator 3.8.8。
- Node.js 和 npm。
- Python 3。
- Google Chrome，用于 Web/CDP 自动化测试。

当前构建脚本使用的固定 Cocos 路径是：

```text
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
```

安装 JavaScript 依赖：

```bash
npm install
```

安装 Bot/CDP Python 依赖：

```bash
python3 -m pip install -r tools/bot/requirements.txt
```

首次检出项目后，用 Cocos Creator 3.8.8 打开项目根目录并完成一次正常导入，以生成 `temp/declarations/cc.d.ts` 等本地文件。`temp/`、`library/`、`build/` 都是生成目录，不提交 Git。

后续构建优先使用项目包装脚本。不要把反复打开 Cocos GUI、删除整个 `library/` 或手改 AssetDB 当作常规修复手段。

## 2. 启动项目

项目根目录：

```text
/Users/ronghui/Documents/game_dev_cocos
```

唯一启动场景：

```text
assets/scene/Main.scene
```

场景只挂载入口；Canvas、Camera、世界和 UI 由 `assets/scripts/RogueShooterGame.ts` 动态创建。

禁止手工编辑 `assets/scene/Main.scene` 的 JSON 内容，也不要通过文本方式复制、重排或替换场景 UUID。需要新增节点时，修改入口或对应 UI/Manager 的代码创建逻辑。

## 3. 修改前检查

每次开始工作按以下顺序执行：

1. 阅读 `AGENTS.md`，确认受保护文件、公式和产品约束。
2. 查看 `git status --short --branch`，区分当前任务与已有用户改动。
3. 找到实际运行时来源，不用旧文档或历史报告猜行为。
4. 确认改动是否涉及数值、存档、资源、UI、构建或平台能力。
5. 选择对应验证级别。

工作区可能已经包含未提交改动。不得回滚、覆盖或清理不属于当前任务的文件。

## 4. 常用验证命令

### 4.1 TypeScript

```bash
npm run typecheck
```

该命令实际使用 TypeScript 5.9.3：

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
```

当前限制：

- `tsconfig.json` 为 `strict: false`。
- 只检查 `assets/**/*.ts` 和 Cocos 生成的声明。
- 不检查 `tests/**/*.ts` 或 Python 工具。
- `assets/scripts/RogueShooterGame.ts` 带有 `@ts-nocheck`。

因此 typecheck 通过不等于整个工程类型安全。新增公共接口必须显式标注参数和返回类型，并用测试覆盖入口与 HostContext 的连接。

### 4.2 TypeScript 测试

```bash
npm test
```

测试入口是 `tests/run.ts`。新建 `*.test.ts` 后必须在该文件中显式 import，否则 `npm test` 不会执行它。

测试目录职责：

```text
tests/core/       纯函数、状态和事件
tests/catalogs/   数据规模、ID、解锁和映射
tests/enemy/      移动与生成模式
tests/flows/      阶段、HostContext 和结算契约
tests/ui/         UI接线、布局和配装流程
tests/visual/     VFX资源及源码映射契约
tests/balance/    DPS、波次和数值门槛
```

`tests/balance/dpsAtWave10.test.ts` 当前是独立诊断脚本，没有被 `tests/run.ts` 导入，不能算作默认测试套件的一部分。

### 4.3 Python 工具测试

```bash
npm run test:tools
```

该命令会在 `tests/` 下发现 `*test.py`。当前仓库没有正式 Python 测试，因此不能把该命令的成功解释为 Bot 工具已经得到覆盖。

## 5. Web 构建与本地试玩

构建 CDP 使用的 Web Mobile 包：

```bash
npm run balance:build-web
```

等价入口：

```bash
python3 tools/bot/build_web_mobile_for_bot.py
```

输出目录：

```text
build/web-mobile
```

该脚本会：

- 清理 build、library 和 assets 下的 macOS 冲突副本。
- 检查或播种 `library/.assets-data.json`。
- 调用 Cocos CLI 构建。
- 验证 `assets/main/index.js` 大于 100 KB。
- 验证产物包含 `RogueShooterGame` 和 CDP 钩子。
- 必要时重试并切换 `configPath` 构建路径。

它会修改生成目录，不应在运行中手工同时操作 Cocos 导入或同一构建目录。

构建后可临时启动静态服务：

```bash
python3 -m http.server 8787 --bind 127.0.0.1 --directory build/web-mobile
```

浏览：

```text
http://127.0.0.1:8787/
```

UI、Sprite、触控、遮罩、动画和资源加载不能只靠静态测试验证，必须在真实 Web/Cocos 画面中检查。

## 6. CDP 平衡测试

### 6.1 一键烟测

```bash
npm run balance:e2e:smoke
```

该命令会自动：

1. 构建 `web-mobile`。
2. 启动本地 HTTP 服务。
3. 启动隔离的 Chrome CDP 实例。
4. 等待 `window.__starfallGame` 等钩子。
5. 使用 `storm-rifle`（冲锋枪）跑 1 局、最多 240 秒。
6. 清理它启动的 Chrome、服务和临时 profile。

只复用已有构建时：

```bash
python3 tools/bot/run_balance_e2e.py \
  --runs 1 \
  --weapon storm-rifle \
  --max-seconds 240 \
  --seed 42 \
  --skip-build
```

### 6.2 全武器基线

先生成有效 Web 包：

```bash
npm run balance:build-web
```

再运行：

```bash
npm run balance:pipeline
```

重要：`package.json` 中的 `balance:pipeline` 自带 `--skip-build`。它不会替你重新构建，也会跳过脚本内部的编译/产物检查，因此必须先确认 `build/web-mobile` 是本次代码生成的有效产物。

快速单武器 pipeline：

```bash
npm run balance:pipeline:smoke
```

手动 `balance:cdp`：

```bash
npm run balance:cdp
```

该命令不会自动启动服务或 Chrome。只有已经在 `localhost:7457` 提供游戏，并用 `--remote-debugging-port=9222` 启动 Chrome 时才使用它。日常优先使用 `balance:e2e:smoke`。

## 7. 抖音构建

### 7.1 验证现有产物

```bash
npm run build:check
```

该命令不会重新构建，但仍会先运行 typecheck 和默认测试，再检查现有 `build/bytedance-mini-game`。

### 7.2 包体报告

```bash
npm run size:bytedance
```

当前 `tools/cocos_build_guard.py` 使用 19 MiB 守门线，为平台 20 MB 限制保留余量。

### 7.3 完整构建

```bash
npm run build:bytedance
```

流程：typecheck -> `npm test` -> Cocos 抖音构建 -> 写入项目级 AppID/项目名 -> 产物和包体校验。

只跳过测试、不跳过 typecheck：

```bash
npm run build:bytedance:fast
```

输出目录：

```text
build/bytedance-mini-game
```

构建守门会检查：

- `assets/main/index.js` 存在且不小于 100 KB。
- `project.config.json`、`game.json`、`game.js`、`src/settings.json` 和 `engine-adapter.js` 存在。
- 总包体不超过 19 MiB。

平台身份来自 `config/bytedance-project.json`。Cocos 模板会生成 `testappId`，守门脚本在每次构建后把正式 AppID 和项目名写入生成的 `project.config.json`；不要直接修改 Cocos 安装目录模板。

旧文档中的 `--marker`、`--sync-slim2`、12 MiB 限制、自动备份和三次重试不是当前 `tools/cocos_build_guard.py` 的能力，不要继续使用这些参数或说法。

## 8. 完整验证入口

验证代码、真实 Web 跑局和现有抖音产物：

```bash
npm run verify
```

该命令包含：

```text
typecheck
npm test
balance:e2e:smoke
build:check
```

由于最后一步只检查现有抖音包，缺少 `build/bytedance-mini-game` 时会失败。

重新生成并验证抖音包：

```bash
npm run verify:bytedance
```

该命令包含完整抖音构建，适合发布前使用。

## 9. 按改动类型选择验证

| 改动 | 最低验证 |
|---|---|
| 文档 | 检查路径、命令和源码事实；必要时 `git diff --check` |
| 纯 TypeScript 重构 | `npm run typecheck` + `npm test` |
| HostContext / 状态字段 | 上述命令 + flows/state 相关测试 |
| 数值、武器、怪物、XP、商店 | `npm run typecheck` + `npm test` + `npm run balance:e2e:smoke` |
| 多武器平衡 | 先 `balance:build-web`，再 `balance:pipeline` |
| UI 布局或交互 | typecheck + tests + Web 720x1280 实际截图/点击验证 |
| PNG、音频、VFX、`.meta` | typecheck + visual tests + Web 运行时加载 + `size:bytedance` |
| 存档结构 | tests + 旧存档缺字段/非法ID/重复槽位迁移验证 |
| 构建配置或平台能力 | `npm run verify:bytedance` + 抖音开发者工具/真机验证 |

数值修改必须遵守 `AGENTS.md` 的真实 Cocos/CDP 验证要求，不能用独立 Python 战斗模拟代替运行时跑局。

## 10. 新增和修改 TypeScript 模块

### 10.1 目录选择

- 共享类型、纯公式、钱包：`assets/scripts/core/`
- 静态数据和生成：`assets/scripts/catalogs/`
- 战斗状态：`assets/scripts/state/`
- 怪物行为：`assets/scripts/enemy/`
- 子弹与武器命中：`assets/scripts/projectile/`
- 拾取和升级：`assets/scripts/pickup/`
- 商店、装备、存档：`assets/scripts/shop/`
- 副武器运行时：`assets/scripts/offhand/`
- UI：`assets/scripts/ui/`
- 入口编排：`assets/scripts/RogueShooterGame.ts`

新增 Cocos 脚本时必须让 Cocos 生成或正确维护对应 `.ts.meta`。不要复制其他脚本的 UUID。

### 10.2 HostContext

Manager 不应 import `RogueShooterGame`。需要宿主能力时：

1. 在对应 `*HostContext` 中声明最小字段/方法。
2. 在入口提供真实实现。
3. 更新 `tests/flows/hostContextContract.test.ts`。
4. 运行 typecheck 和测试。

不要用不断增加 `(ctx as any)` 绕开契约。

### 10.3 纯逻辑

无 Cocos 依赖的规则优先放入 `core/` 或 `flow/` 并直接测试。不要在纯逻辑模块中 import `Node`、`Graphics`、`Sprite`、`resources` 或 `sys`。

当前 `combatFormulas.ts` 与运行时仍有重复；修改伤害、射速、穿透、波次或敌人缩放时必须核对运行时 Manager，不能只改测试公式。

## 11. UI 开发规则

当前有两套 UI 路径：

### 常驻面板

使用：

```text
assets/scripts/ui/panels.ts
assets/scripts/ui/UIHelpers.ts
assets/scripts/RogueShooterGame.ts
```

适用：HUD、主菜单、机库、副武器、锻造、暂停、设置。

### 动态模态弹窗

使用：

```text
assets/scripts/ui/UIManager.ts
assets/scripts/ui/PopupBase.ts
assets/scripts/ui/ChoicePopup.ts
assets/scripts/ui/ShopPopup.ts
assets/scripts/ui/RevivePopup.ts
assets/scripts/ui/SettlementPopup.ts
```

适用：需要遮罩、异步结果、弹窗栈和输入阻断的流程。

UI 约束：

- 设计基准固定为 720x1280。
- 节点必须在代码中创建，不改场景 JSON。
- 使用 `UIHelpers.place()` / `placeLocal()` 保持坐标语义一致。
- 按钮状态改变时同步文字、禁用状态和 Sprite skin。
- 不在每帧重建静态节点或重复加载同一资源。
- 敌人共享血条层按 0.1 秒整体重绘；不要恢复为逐帧 `clear()` 和全敌扫描，也不要在清空共享层后按单怪计时跳过重画。
- 动态弹窗必须挂到已初始化的 Canvas/UIManager 下。
- 修改后至少检查主菜单、机库、战斗 HUD、升级、商店、复活和结算。

## 12. Catalog 内容开发

### 主武器

主要入口：

```text
assets/scripts/catalogs/weaponCatalog.ts
assets/scripts/core/types.ts
assets/scripts/projectile/projectileManager.ts
assets/scripts/audio/audioManager.ts
assets/resources/effects/
assets/resources/effects/ui_icons/
tests/catalogs/weaponCatalog.test.ts
tests/visual/weaponAttackPresentation.test.ts
```

新增主武器家族不只是增加一条数据，还要补齐 attack style、运行机制、弹体/VFX、枪口、命中、音效、图标和测试。

### 怪物

主要入口：

```text
assets/scripts/catalogs/enemyCatalog.ts
assets/scripts/catalogs/waveCatalog.ts
assets/scripts/enemy/enemyManager.ts
assets/scripts/enemy/enemyConstants.ts
assets/scripts/enemy/enemyMovement.ts
assets/scripts/enemy/enemySpawnPatterns.ts
assets/resources/art/enemies/
tests/catalogs/enemyCatalog.test.ts
tests/enemy/
```

敌人首次出现只有一套规则：`EnemySpec.unlockWave`。`enemyCatalog.ts` 生成组合实例时取家族与变体 `unlockWave` 的较大值，`EnemyManager` 通过 `waveCatalog.ts::getUnlockedEnemySpecsForWave()` 累计过滤；不得恢复 `spawnAfter`、波 9~10 分片或另一套隐式解锁规则。

波 1~9 压力表、Boss 阶段/援军、小 Boss 开波判定与阵型共享 budget 的静态合同统一放在 `waveCatalog.ts`。`enemyManager.ts` 只负责消费配置并执行运行行为；改波次时必须同步 `tests/enemy/waveSystem.test.ts`、`tests/flows/waveSystemWiring.test.ts`、机制基线和差异状态。

### 本局道具与升级

主要入口：

```text
assets/scripts/catalogs/runItemCatalog.ts
assets/scripts/pickup/pickupManager.ts
assets/scripts/shop/equipmentManager.ts
tests/catalogs/runItemCatalog.test.ts
```

商店价格不只由 tier、波次和累计购买数决定，还会调用 `getRunItemShopPriceMultiplier()`。新增属性效果时需要决定它在定价中的分类和权重。

### 副武器

主要入口：

```text
docs/offhand_weapon_design.md
assets/scripts/catalogs/offhandCatalog.ts
assets/scripts/offhand/offhandManager.ts
assets/scripts/shop/equipmentManager.ts
assets/scripts/RogueShooterGame.ts
tests/ui/offhandUiIntegration.test.ts
```

15 把副武器的数量、类型和机制受 `AGENTS.md` 保护。修改设计必须同步设计文档、catalog、Manager、UI 和测试，不能只改其中一层。

持续范围效果不得恢复为逐帧全怪扫描。当前回旋利刃、烈焰漩涡和静电力场统一使用 10 Hz 固定 tick；优化其碰撞或时间积分时必须保持固定 tick catch-up、回旋扫掠碰撞和每秒总伤害合同，并运行 `tests/offhand/offhandContinuousEffectCadence.test.ts` 与真实 Cocos 跑局。

短时战斗 VFX 优先复用有上限的对象池。`RogueShooterGame.ts` 的范围波纹和无人机电弧统一挂在 `WorldVfxLayer`，不能恢复为每次命中 `new Node + scheduleOnce(destroy)`；HUD 文案只在阶段变化或 0.1 秒节拍刷新，生命、XP、护盾条仍逐帧检查实际宽度变化。

## 13. 存档开发

当前存档实现：

```text
assets/scripts/shop/equipmentManager.ts
key = starfall-rogue-shooter-progress-v1
```

修改存档时：

1. 不删除 Starter 装备补齐逻辑。
2. 新字段必须有缺省值。
3. 旧数组要过滤非法类型和不存在 ID。
4. 配装加载后调用归一化，保持 1 主武器 + 4 部位装备。
5. 副武器仍是独立槽，不混入 `equippedEquipment`。
6. 需要破坏性迁移时先设计新存档版本，不直接复用旧键覆盖。

正式云存档尚未实现。不要把 `sys.localStorage` 逻辑复制到更多模块；新增平台存储时应先建立统一边界。

## 14. 资源和 `.meta`

运行时资源：

```text
assets/resources/
```

源素材、生成中间产物和预览：

```text
assets/art_source/
```

规则：

- 直接替换正式 PNG/MP3 时优先保持路径和文件名不变。
- 保留原 `.meta` 可维持 UUID 和现有引用。
- 新资源必须有对应 `.meta` 后再提交。
- 不能只提交 `.meta` 而漏掉资源，也不能只提交资源而漏掉 `.meta`。
- 不把 contact sheet、生成原图或预览放入 `assets/resources/`。
- `assets/resources/audio/` 下已有音效文件名由代码硬编码，不得随意重命名。
- 每次资源替换后检查透明通道、尺寸、导入类型、九宫格 border 和包体。

## 15. Git 和生成文件

默认不提交：

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

应随功能提交：

- `assets/scripts/**/*.ts` 及对应 `.meta`
- `assets/resources/**` 及对应 `.meta`
- 相关测试
- 对应基线文档
- 必需的工具脚本和配置

`data/` 下的跑局报告和截图默认是验证产物。只有明确作为长期基准或复现证据时才应整理后提交，不能把大量临时输出混入功能提交。

发现 `文件名 2.ts`、`AGENTS 3.md` 等 macOS/iCloud 冲突副本时，先确认它不是有效新改动，再清理。冲突副本不能作为源码或基线文档保留。

## 16. 完成标准

一项开发任务只有同时满足以下条件才算完成：

1. 行为与 `AGENTS.md` 和当前机制基线一致。
2. 修改位于正确模块，没有扩大不必要耦合。
3. 对应测试已增加或更新，并被 `tests/run.ts` 执行。
4. TypeScript 和相关自动化验证通过。
5. UI/资源改动已在真实 720x1280 运行时检查。
6. 数值改动完成真实 Cocos/CDP 跑局。
7. 抖音相关改动通过构建和包体守门。
8. 文档、代码、测试和资源映射在同一变更中同步。

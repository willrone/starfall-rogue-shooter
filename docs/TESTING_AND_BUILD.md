# 测试、构建与交付基线

基线日期：2026-07-11

本文定义当前仓库可以实际执行的验证链。开发环境与日常流程见 [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md)。

## 1. 验证层级

| 层级 | 命令 | 证明什么 | 不能证明什么 |
|---|---|---|---|
| TypeScript | `npm run typecheck` | `assets/**/*.ts` 在当前非严格配置下可编译 | `@ts-nocheck` 入口、测试和运行画面完全正确 |
| 默认测试 | `npm test` | `tests/run.ts` 显式导入的契约通过 | 未导入测试、Cocos 节点和资源真实加载正确 |
| Python 发现 | `npm run test:tools` | 当前可发现的 `*test.py` 通过 | 当前仓库实际没有正式 Python 测试覆盖 |
| Web 构建 | `npm run balance:build-web` | Cocos 可生成 CDP 用 web-mobile 包 | 抖音平台兼容与包体合规 |
| Cocos 跑局 | `npm run balance:e2e:smoke` | 真实 Web/Cocos 启动、钩子和一局跑通 | 全武器平衡和所有 UI 状态 |
| 全武器 | `npm run balance:pipeline` | 17 把主武器批量采样 | 它默认 `--skip-build`，不会验证源码已重建 |
| 抖音产物 | `npm run build:check` | typecheck、默认测试及现有 bytedance 产物结构与包体有效 | 不会重新构建 |
| 抖音构建 | `npm run build:bytedance` | typecheck、测试、正式构建和产物守门 | 真机登录、平台 API 和审核通过 |

## 2. 默认快速验证

非数值的窄改动至少执行：

```bash
npm run typecheck
npm test
```

新增测试文件必须在 `tests/run.ts` 显式 import。`tests/balance/dpsAtWave10.test.ts` 当前未被默认入口导入，只能算独立诊断脚本。

当前默认入口已包含以下性能回归合同：

- `tests/combat/projectileVisualFallback.test.ts`：Sprite/Graphics fallback 切换及对象池复用。
- `tests/combat/rogueShooterEntryPerformance.test.ts`：HUD 节流、条形脏更新、`WorldVfxLayer` 和短时特效池。
- `tests/offhand/offhandContinuousEffectCadence.test.ts`：持续副武器 10 Hz cadence、catch-up、扫掠碰撞和时间积分。

这些测试验证源码与纯逻辑合同，不采集真实渲染帧、GPU、GC、温控或功耗。性能结论必须保留真实 `requestAnimationFrame` 调度，并在目标真机持续运行；`__starfallBulkTick` 只适合玩法推进和平衡采样。

当前 `tsconfig.json` 使用 `strict: false`，`RogueShooterGame.ts` 使用 `@ts-nocheck`。因此公共接口、HostContext 和入口接线必须由针对性测试补足。

## 3. Web/CDP 验证

### 3.1 构建

```bash
npm run balance:build-web
```

有效产物至少满足：

- `build/web-mobile/assets/main/index.js` 大于 100 KB。
- 包含 `__starfallGame` 和 `__starfallBulkTick` 钩子。
- 本次源码或资源变化确实进入产物。

### 3.2 一键烟测

```bash
npm run balance:e2e:smoke
```

它会自动构建、启动本地服务和隔离 Chrome、运行 1 把武器 × 1 局 × 最多 240 秒，并清理自己创建的进程。

已有可信构建时可用：

```bash
python3 tools/bot/run_balance_e2e.py \
  --runs 1 \
  --weapon storm-rifle \
  --max-seconds 240 \
  --seed 42 \
  --skip-build
```

### 3.3 全武器

```bash
npm run balance:build-web
npm run balance:pipeline
```

`balance:pipeline` 当前自带 `--skip-build`，必须先构建。数值、武器、敌人、掉落或波次改动不得只跑纯 TypeScript 镜像测试。

## 4. 抖音小游戏构建

正式构建：

```bash
npm run build:bytedance
```

输出：

```text
build/bytedance-mini-game/
```

当前守门器 `tools/cocos_build_guard.py` 检查：

- `assets/main/index.js` 存在且至少 100 KB。
- `project.config.json`、`game.json`、`game.js`、`src/settings.json`、`engine-adapter.js` 存在。
- 总包体不超过 19 MiB，为 20 MB 平台限制保留余量。

Cocos 3.8.8 的抖音模板默认写入 `testappId`。项目包装器会在构建完成后读取 `config/bytedance-project.json`，把正式 AppID 和项目名写入生成的 `project.config.json`；不要直接修改 Cocos 安装目录中的模板。

检查现有产物与包体：

```bash
npm run build:check
npm run size:bytedance
```

`build:check` 不会重新构建，但仍会重跑 typecheck 和默认测试。发布前需要最新产物时必须执行 `build:bytedance` 或 `verify:bytedance`。

## 5. 聚合命令

```bash
npm run verify
```

依次执行 typecheck、默认测试、Web/Cocos 烟测和现有抖音产物检查。若本地还没有 `build/bytedance-mini-game`，最后一步会失败。

```bash
npm run verify:bytedance
```

在上述基础上重新生成抖音包，适合发布前使用。

## 6. 改动到验证的映射

| 改动 | 必须执行 |
|---|---|
| 纯文档 | 链接/路径检查、`git diff --check` |
| 纯函数/状态 | typecheck、默认测试 |
| HostContext/入口 | typecheck、默认测试、Web 烟测 |
| UI 布局/皮肤/图标 | typecheck、默认测试、720×1280 运行截图、包体报告 |
| 角色/怪物/武器/VFX | 默认测试、Web 构建、逐类运行观察、包体报告 |
| 战斗性能热路径 | 默认性能合同、真实 Web/Cocos 帧循环压力场景、目标真机持续 FPS/温控记录 |
| 数值/武器/敌人/掉落/波次 | typecheck、默认测试、CDP 烟测；高风险时全武器 pipeline |
| 存档 schema | 默认测试、旧存档迁移测试、重载验证 |
| 抖音 SDK/平台配置 | 正式抖音构建、开发者工具预览、真机调试 |

## 7. 构建缓存与冲突副本

- web-mobile 构建异常快且产物未变化时，先确认 hash/时间，再按项目脚本流程处理 `temp/` 缓存。
- 不要把删除整个 `library/` 作为常规操作。
- 文件名含 ` 2`、` 3`、` 4` 的 macOS 冲突副本不属于正式入口。
- 不要同时让 Cocos GUI 导入和命令行脚本写同一个生成目录。

## 8. 失败记录

交付说明必须区分：

- 已运行且通过的命令。
- 因环境缺失未运行的命令。
- 运行失败及其首个有效错误。
- 只检查旧产物还是已重新构建。

不能用“测试通过”概括未被 `tests/run.ts` 导入的测试，也不能用纯公式单测代替真实 Cocos 跑局。

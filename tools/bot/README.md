# Starfall 真实 Cocos/CDP Bot

> 基线日期：2026-07-11
>
> 正式命令来源：项目根目录 [`package.json`](../../package.json)

本目录的正式用途是驱动真实 `web-mobile` Cocos 运行时进行烟测和平衡采样。Python 只负责构建编排、启动服务和 Chrome、通过 CDP 操作游戏、读取真实状态并生成报告，不应重写伤害、XP、刷怪、商店或移动逻辑。

完整验证门禁见 [测试与构建基线](../../docs/TESTING_AND_BUILD.md)，环境准备和日常开发流程见 [开发说明](../../docs/DEVELOPMENT_GUIDE.md)。

## 1. 正式入口

只有 `package.json` 中的以下脚本是当前推荐入口：

| 命令 | 用途 | 是否自动构建 | 是否自动启动服务和 Chrome |
|---|---|---:|---:|
| `npm run balance:build-web` | 构建并验证 `build/web-mobile` | 是 | 否 |
| `npm run balance:e2e:smoke` | 冲锋枪 1 局、最多 240 秒的真实运行烟测 | 是 | 是 |
| `npm run balance:e2e` | 默认 3 局的 E2E 跑局 | 是 | 是 |
| `npm run balance:pipeline:check` | 检查现有产物能否启动并连接 CDP | 否 | 是 |
| `npm run balance:pipeline:smoke` | 复用现有产物，单武器快速 pipeline | 否 | 是 |
| `npm run balance:pipeline` | 复用现有产物，主武器批量平衡采样 | 否 | 是 |
| `npm run balance:cdp:smoke` | 连接已经运行的服务和 Chrome 做单武器烟测 | 否 | 否 |
| `npm run balance:cdp` | 连接已经运行的服务和 Chrome 做 CDP 采样 | 否 | 否 |

`npm run balance:sim` 只是 `balance:cdp` 的兼容别名，前置条件完全相同。

不要从文件名猜入口，也不要用 `bot.py`、`bot_v*` 或某个 `cdp_*.py` 替代上述命令作为交付验证。

## 2. 推荐流程

### 2.1 日常真实运行烟测

```bash
npm run balance:e2e:smoke
```

这是日常首选。[`run_balance_e2e.py`](./run_balance_e2e.py) 会依次：

1. 调用 `build_web_mobile_for_bot.py` 构建 `web-mobile`。
2. 为 `build/web-mobile` 启动本地 `http.server`。
3. 启动带隔离临时 profile 和 CDP 端口的 Chrome。
4. 等待游戏钩子可用。
5. 调用 `run_balance_cdp.py` 跑真实游戏。
6. 在成功或失败退出时停止它启动的 Chrome、HTTP 服务并删除临时 profile。

首选端口为 HTTP `7457`、CDP `9222`；被占用时 E2E 包装器会在邻近端口中选择空闲端口。除非显式传入 `--keep-open`，否则不要预期进程在命令结束后继续存在。

`balance:e2e:smoke` 带 `--allow-balance-fail`：平衡目标未达标时仍可返回成功，但运行时错误仍会失败。它证明真实 Cocos 路径可运行，不等于全武器平衡通过。

### 2.2 复用可信构建

只有确定现有产物来自本次源码时，才使用：

```bash
python3 tools/bot/run_balance_e2e.py \
  --runs 1 \
  --weapon storm-rifle \
  --max-seconds 240 \
  --seed 42 \
  --skip-build
```

`--skip-build` 只节省 Cocos 构建时间，不会证明产物与当前源码一致。源码、catalog、资源或 Cocos 接线变化后，应重新构建。

### 2.3 全武器 pipeline

```bash
npm run balance:build-web
npm run balance:pipeline
```

必须按这个顺序执行。当前 `package.json` 中的 `balance:pipeline` 固定传入：

```text
--runs 3 --max-seconds 720 --skip-build
```

因此 pipeline 默认：

- 不重新构建 `web-mobile`；
- 不执行自己的 TypeScript 编译阶段；
- 不证明现有产物来自本次源码；
- 会基于现有产物启动 HTTP 服务和 Chrome，完成 CDP 跑局并在结束时清理对应进程。

单武器快速检查：

```bash
npm run balance:pipeline:smoke
```

该命令同样带 `--skip-build`。环境检查：

```bash
npm run balance:pipeline:check
```

它验证现有产物、服务、Chrome 和钩子能否连接，但不能替代重新构建或正式跑局。

### 2.4 手动 CDP

```bash
npm run balance:cdp
```

[`run_balance_cdp.py`](./run_balance_cdp.py) 不会构建、启动服务、启动 Chrome 或清理进程。运行前必须已经具备：

- `build/web-mobile` 或等效的 Cocos Web 预览；
- 页面可通过 `http://localhost:7457/` 访问；
- Chrome 以 `--remote-debugging-port=9222` 启动；
- 对应 Chrome 标签页 URL 包含 `localhost:7457`；
- 游戏已经加载并暴露所需 CDP 钩子。

手动启动示例：

```bash
python3 -m http.server 7457 --bind 127.0.0.1 --directory build/web-mobile
```

在另一个终端启动 Chrome：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  http://localhost:7457/
```

然后再执行 `npm run balance:cdp`。如果不需要手动控制进程，优先使用 `balance:e2e:smoke`。

## 3. 有效 Web 产物

正式产物入口：

```text
build/web-mobile/assets/main/index.js
```

复用产物前至少确认：

- 文件存在且大于 `100 KB`；
- 包含 `__starfallGame`；
- 包含 `__starfallTick` 和 `__starfallBulkTick`；
- 包含确定性跑局需要的 `__starfallSetSeed`；
- 文件时间或 hash 能证明它来自本次源码。

只看到 Cocos CLI 退出码为 0 不代表构建有效。空场景构建可能生成很小的 `index.js`，必须检查大小和钩子。

构建命令：

```bash
npm run balance:build-web
```

[`build_web_mobile_for_bot.py`](./build_web_mobile_for_bot.py) 会调用 Cocos Creator 3.8.8、验证产物，并在必要时使用备用构建参数重试。构建日志写入：

```text
temp/builder/log/bot-web-mobile-*.log
```

构建异常快但产物未变化时，先检查时间、hash 和日志。不要把删除整个 `library/` 或反复打开 Cocos GUI 当作常规修复。

## 4. 输出文件

### E2E 与直接 CDP

`run_balance_e2e.py` 最终调用 `run_balance_cdp.py`，两者报告格式相同：

```text
<out>/
├── runs.csv
└── summary.json
```

正式脚本的默认输出：

| 命令 | 输出目录 |
|---|---|
| `npm run balance:e2e:smoke` | `data/balance_e2e_smoke/` |
| `npm run balance:e2e` | `data/balance_e2e/` |
| `npm run balance:cdp:smoke` | `data/balance_cdp_smoke/` |
| `npm run balance:cdp` | `data/balance_cdp/` |

`runs.csv` 每局一行，包含武器、seed、最终波次、战斗时长、击杀、等级、道具、合金、HP、阶段、死亡和错误字段。`summary.json` 按武器汇总 runs、P50/P90 波次、均值和目标判定。

可通过 `--out` 指定其他目录。报告会覆盖同目录的同名文件；运行前确认是否需要保留旧快照。

### Pipeline

`run_balance_pipeline.py` 固定写入：

```text
data/balance_cdp/
├── runs.csv
├── summary.json
└── report.md
```

`report.md` 是便于人工阅读的汇总表。pipeline 与直接 `balance:cdp` 共用 `data/balance_cdp/`，连续运行会覆盖已有报告。

## 5. 常用参数

直接调用 E2E/CDP 时常用：

| 参数 | 含义 |
|---|---|
| `--runs N` | 每把武器跑局数 |
| `--weapon ID` | 指定武器；CDP/E2E 可重复传入 |
| `--weapon-level N` | 覆盖机库武器等级 |
| `--max-seconds N` | 单局最大游戏内秒数 |
| `--seed N` | 确定性基础 seed |
| `--with-offhand` | 加入默认 offhand；默认隔离主武器 |
| `--with-shop` | 启用商店随机性；默认关闭 |
| `--per-weapon-seed` | 不同武器使用不同派生 seed |
| `--out PATH` | 设置 E2E/CDP 输出目录 |
| `--allow-balance-fail` | 只放宽平衡目标失败，不掩盖运行时错误 |
| `--skip-build` | E2E 复用现有 `web-mobile` |
| `--keep-open` | E2E 结束后保留其 Chrome、服务和临时 profile |

完整参数以各正式脚本的 `--help` 为准。

## 6. 历史与诊断脚本

本目录保留了大量早期键盘模拟、截图识别、临时验证和一次性诊断脚本。它们不是当前正式入口，包括但不限于：

- `bot.py`、`bot_final.py`、`bot_v2.py` 至 `bot_v6.py`；
- `minibot.py`、`run_bot*.py`、`run_full_test.py`、`balance_hermes.py`；
- `cdp_*.py`、`debug_*.py`、`diagnose_*.py`；
- 没有 `package.json` 正式脚本入口的临时 benchmark；
- 文件名带空格编号的冲突副本，例如 `build_web_mobile_for_bot 2.py`、`run_balance_cdp 3.py`。

这些文件只能用于历史追溯或针对性诊断：

- 不得在基线文档、CI 或交付说明中把它们当正式命令；
- 不得因为名字中的版本号更大就认为它更新；
- 不得让带空格冲突副本进入新调用链；
- 需要吸收其中逻辑时，应把经过审查和测试的最小改动合并到正式脚本，再通过 `package.json` 暴露入口。

## 7. 验证边界

- Bot 结果来自真实 Cocos Web 运行时，但不代表抖音真机、平台 API、触控和所有 UI 状态已经通过。
- `--allow-balance-fail` 不应在正式平衡验收中掩盖目标偏差。
- `--skip-build` 不证明源码与产物一致。
- 单武器烟测不证明 17 把主武器整体平衡。
- 当前不能声称这些 Python Bot 已有完整或可靠的 Python 单元测试覆盖；主要证据仍是实际构建、钩子检查、真实跑局和报告。
- 交付说明必须区分“重新构建后跑局”和“复用旧产物跑局”。

故障处理、验证层级和抖音交付要求统一以 [`docs/TESTING_AND_BUILD.md`](../../docs/TESTING_AND_BUILD.md) 为准。

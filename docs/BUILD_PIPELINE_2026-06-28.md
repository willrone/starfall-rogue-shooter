# 抖音构建管线修复记录（2026-06-28）

> [!WARNING]
> **历史快照（已归档）**
> 本文保留 2026-06-28 的构建排障记录，不得作为当前构建实现、命令或数值基线。当前开发入口请使用 [文档索引](./README.md)、[基线总览](./BASELINE.md)、[机制基线](./GAMEPLAY_MECHANICS.md) 和 [基线差异清单](./BASELINE_GAPS.md)。

> **问题**：`npm run build:bytedance:fast` 永远产出 590 字节空包（scenes=0, scripts=0），守门脚本拦截恢复旧包但根因未修。
>
> **结论**：现三条链路全部稳定通过。

---

## 根因

### 1. Cocos 3.8.8 CLI `configPath=...` 对 bytedance 平台失效

使用 `--build configPath=tools/bytedance-build-config.json` 时，Cocos 会进入 `scenes=0/scripts=0` 路径，产出 590 字节空 `assets/main/index.js`。

但使用**分号语法** `--build 'platform=bytedance-mini-game;debug=false'` 工作正常，`scenes=1/scripts=28`。

**web-mobile 的 configPath 没有这个问题。** 根因疑似 Cocos 3.8.8 不同平台对 configPath 的处理差异，不作深究。

### 2. macOS 冲突副本导致备份死锁

`backup_current()` 用 `shutil.copytree()` 备份先前构建，但若 build output 下有 macOS iCloud 冲突副本（如 `game 2.json`、`project.config 2.json`），copytree 遇到 dataless placeholder 会报 `Errno 11: Resource deadlock avoided`，导致整个构建中断。

**修复**：备份前先调用 `clean_macos_conflict_copies(OUTPUT)`。

### 3. 无重试机制

旧版 guard 只构建一次，失败直接恢复备份并退出。web-mobile 构建器已有 3 次重试 + 每次重试前 seed AssetDB 的逻辑。

**修复**：为 `cocos_build_guard.py` 添加 3 次重试循环，每次重试前：
- 清理 macOS 冲突副本（assets + output）
- seed AssetDB
- 清理 editor 编译缓存

---

## 改动文件

| 文件 | 改动 |
|---|---|
| `tools/cocos_build_guard.py` | 改分号 CLI 语法、加 retry 循环、备份前清冲突副本 |

## 当前管线状态

| 阶段 | 命令 | 状态 |
|---|---|---|
| TypeScript 编译 | `npm run typecheck` | ✅ 稳定 |
| 单元测试 | `npm test` | ✅ 稳定 |
| web-mobile 构建 + CDP 平衡测试 | `npm run balance:pipeline` | ✅ 稳定 |
| 抖音构建（含 tsc + tests） | `npm run build:bytedance` | ✅ 稳定 |
| 抖音快速构建 | `npm run build:bytedance:fast` | ✅ 稳定 |
| 构建产物验证 | `npm run build:check` | ✅ 稳定 |
| 同步到 slim2 | `--sync-slim2` flag | ✅ 稳定 |

### 包体

```
Release 模式: 11.41 MiB / 12.0 MiB 限制 ✅
```

---

## 下一步

BP1 数值平衡的 bytedance 构建守门已闭环。建议：

1. **BP2 平衡精调**：把 standard 武器从 wave 6-7 推到 8-9，boss_gate 武器推到 ≈10
2. 每次改数值后走标准流程：
   ```bash
   npm run typecheck
   npm test
   npm run balance:pipeline:smoke   # 快速验证
   npm run build:bytedance:fast      # 抖音构建守门
   ```

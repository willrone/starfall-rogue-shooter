# Engineering Status — 星坠幸存者

更新时间：2026-06-27 14:47:16 CST

## 1. 唯一抖音开发者工具目录

抖音开发者工具只打开这个目录：

```text
/Users/ronghui/Documents/game_dev_cocos/build/bytedance-mini-game
```

不要打开历史副本目录。历史副本已经清理；构建守门脚本内部备份位于：

```text
build/.guard-backups/
```

该目录只用于失败回滚，不给抖音开发者工具使用，也不提交 Git。

## 2. 构建命令

### 快速构建抖音包

```bash
npm run build:bytedance:fast -- --marker "本次改动的JS特征"
```

### 完整构建抖音包

```bash
npm run build:bytedance
```

### 验当前抖音包

```bash
npm run build:check -- --marker "本次改动的JS特征"
```

### 包体报告

```bash
npm run size:bytedance
```

### 常规验证，不重新构建

```bash
npm run verify
```

### 完整验证并重新构建抖音包

```bash
npm run verify:bytedance
```

## 3. 构建守门脚本

脚本：

```text
tools/cocos_build_guard.py
```

守门内容：

- 默认 `debug=false`，避免 debug 包膨胀。
- 不裸信 Cocos CLI exit code；以产物和日志为准。
- 校验 bytedance 包不是空 main bundle。
- 校验 Cocos 日志里 `Number of all scenes: 1`、`Number of all scripts: 28`。
- 校验抖音项目必需文件：
  - `project.config.json`
  - `game.json`
  - `game.js`
  - `src/settings.json`
  - `assets/main/index.js`
  - `engine-adapter.js`
  - `web-adapter.js`
- 校验 marker 已进入 `assets/main/index.js`。
- 校验包体不超过 12 MiB。
- 构建失败或产物无效时恢复上一个可用包。
- 构建成功后写入：
  - `build/bytedance-mini-game/build-manifest.json`
  - `build/bytedance-mini-game/size-report.json`

## 4. 当前包体快照

| 目录 | 大小 | 说明 |
|---|---:|---|
| `build/bytedance-mini-game` | 11.406 MiB | 抖音开发者工具使用 |
| `build/web-mobile` | 17.35 MiB | Web 调试产物 |
| `build/web-desktop` | 11.87 MiB | Web 调试产物 |
| `build/.guard-backups` | 26.59 MiB | 内部回滚备份 |

## 5. 当前主代码规模

| 文件 | 行数 |
|---|---:|
| `assets/scripts/RogueShooterGame.ts` | 3107 |
| `assets/scripts/enemy/enemyManager.ts` | 1300 |
| `assets/scripts/shop/equipmentManager.ts` | 1166 |
| `assets/scripts/pickup/pickupManager.ts` | 771 |
| `assets/scripts/projectile/projectileManager.ts` | 632 |
| `assets/scripts/ui/panels.ts` | 247 |
| `assets/scripts/state/combatState.ts` | 194 |
| `assets/scripts/audio/audioManager.ts` | 177 |
| `assets/scripts/flow/battleFlow.ts` | 40 |

## 6. Git / 资源卫生规则

### 必须提交

- 正式 TypeScript 代码：`assets/scripts/**/*.ts`
- Cocos 脚本 `.meta`：`assets/scripts/**/*.ts.meta`
- 正式运行资源：`assets/resources/**` 及其 `.meta`
- 测试：`tests/**`
- 工具脚本：`tools/*.py`、`tools/bot/**`（非缓存；平衡测试用 CDP 跑真实 Cocos 游戏）
- 工程文档：`AGENTS.md`、`docs/**`

### 不提交

- `build/**`
- `library/**`
- `temp/**`
- `local/**`
- `profiles/**`
- `node_modules/**`
- `.codegraph/**`
- `__pycache__/**`
- `*.pyc`
- `*.log`

### 需要人工判断

- `assets/art_source/**`：源素材/预览归档，是否提交取决于是否要保留生成过程。
- `submission/**`：上架材料，应单独成组提交，不和玩法代码混在一起。

## 7. 当前质量缺口

优先补 Manager 层测试：

1. `EquipmentManager`：蓝图、合成、升级、装备切换、存档恢复。
2. `EnemyManager`：wave 推进、Boss 掉落、`_botX/_botY` fallback、死亡奖励。
3. `PickupManager`：宝箱、升级 3 选 1、资源拾取。
4. `ProjectileManager`：命中、穿透、子弹池回收。

## 8. Cocos CLI 已知坑

- `exit_code=36` 在 macOS 上不一定代表失败。
- 日志 `Finished` 也不够，必须检查产物。
- 错误 `scenes` / `startScene` 参数可能构出 609 字节空 main 包。
- JSON build options 在 Cocos 3.8 CLI 可能被当成空参数，跑成默认 web 平台。
- Cocos 可能改写 `assets/scene.meta` 和 `assets/scene/Main.scene.meta`；守门脚本会在构建前后归一化为当前工程可稳定构建的格式。

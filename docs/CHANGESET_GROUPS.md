# Changeset Groups — 星坠幸存者

更新时间：2026-06-27

当前工作区变更量很大，不能一把提交。按职责拆成下面这些提交组；每组单独 `git add`、单独验证、单独提交。

## 0. 当前分类快照

| 组 | 数量 | 处理方式 |
|---|---:|---|
| runtime-code | 14 | 和对应测试一起提交 |
| tests | 6 | 跟 runtime-code / balance-contract 分组提交 |
| build-tools | 1 | 单独提交 |
| balance-tools | 2 | 单独提交，必须跑模拟器 |
| bot-tools | 1 | 单独提交，避免和玩法混在一起 |
| runtime-assets | 107 | 单独资源提交，必须跑 bytedance 构建和包体报告 |
| art-source | 209 | 源素材/预览归档，人工确认是否提交；不要混入 runtime |
| docs | 2 | 文档提交 |
| submission | 1 | 上架材料提交，不和玩法/资源混合 |
| cocos-meta-only | 30 | 随对应脚本/资源一起提交，禁止孤立提交 |
| config | 3 | 配置提交，逐项说明 |
| other | 4 | 逐项核查归属 |

## 1. 建议提交顺序

### A. 工程化代码与测试

```bash
git add assets/scripts/RogueShooterGame.ts \
  assets/scripts/audio/audioManager.ts \
  assets/scripts/catalogs/*.ts \
  assets/scripts/core/*.ts \
  assets/scripts/enemy/*.ts \
  assets/scripts/pickup/*.ts \
  assets/scripts/projectile/*.ts \
  assets/scripts/shop/*.ts \
  assets/scripts/state/*.ts \
  assets/scripts/ui/*.ts \
  assets/scripts/**/*.meta \
  tests/**/*.ts \
  package.json
```

提交前验证：

```bash
npm run typecheck
npm test
npm run build:bytedance:fast -- --marker "Boss 战利品"
```

建议 commit：

```text
refactor: modularize gameplay managers and equipment progression
```

### B. 数值验证契约

```bash
git add tools/bot/run_balance_cdp.py package.json tools/cocos_build_guard.py AGENTS.md
```

提交前验证：

```bash
python3 -m unittest discover -s tests/tools -p '*test.py'
# 启动 web-mobile/preview + headed Chrome --remote-debugging-port=9222 后：
npm run balance:cdp
```

建议 commit：

```text
test: align balance simulator gates with retention target
```

### C. 构建守门脚本

```bash
git add tools/cocos_build_guard.py docs/ENGINEERING_STATUS.md .gitignore
```

提交前验证：

```bash
npm run build:preflight
npm run build:bytedance:fast -- --marker "Boss 战利品"
```

建议 commit：

```text
build: add guarded bytedance build validation
```

### D. Bot / CDP 自动测试工具

```bash
git add tools/bot
```

提交前验证：

```bash
python3 -m py_compile tools/bot/*.py
```

建议 commit：

```text
test: add cdp bot playtest tooling
```

### E. Runtime 资源压缩/替换

```bash
git add assets/resources
```

提交前验证：

```bash
npm run build:bytedance:fast -- --marker "Boss 战利品"
npm run size:bytedance
```

建议 commit：

```text
assets: optimize runtime art and audio
```

### F. 源素材与上架材料

这两组不要和代码混提：

```bash
git add assets/art_source assets/app_store
# commit: assets: archive source art and store creatives

git add submission docs/SUBMISSION_CHECKLIST.md
# commit: docs: add app store submission materials
```

## 2. 禁止事项

- 不要提交 `build/**`、`temp/**`、`library/**`、`local/**`。
- 不要只提交 `.meta` 而不提交对应 `.ts` / `.png` / `.mp3`。
- 不要把 `submission/**` 和玩法代码混在一个 commit。
- 不要把 `art_source/**` 和 `assets/resources/**` 混为一组；前者是源素材，后者是 runtime 资源。

## 3. 当前待人工确认

- `assets/art_source/**` 是否需要长期保留完整生成过程。
- `submission/**` 是否已经是最终上架材料。
- `settings/v2/packages/information.json` 是否只是 Cocos 自动改写；如无必要可考虑回滚。

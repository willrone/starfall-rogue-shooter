# BP1 平衡调整进展快照（2026-06-28）

> [!WARNING]
> **历史快照（已归档）**
> 本文保留 2026-06-28 的平衡工作现场，不得作为当前实现、武器强度或数值基线。当前开发入口请使用 [文档索引](./README.md)、[基线总览](./BASELINE.md)、[机制基线](./GAMEPLAY_MECHANICS.md) 和 [基线差异清单](./BASELINE_GAPS.md)。

> 用途：保存当前数值平衡工作现场，方便下次继续。不要把本文当成最终结论；最终闭环还差 bytedance build guard。

## 当前结论

BP1 已经把《星坠幸存者》的早期体验从“多数武器 wave 3 暴毙、level=1、成长循环没启动”推进到：

- 新手武器 `storm-rifle` 已基本达到目标：wave 5-6。
- 标准武器部分接近，但多数仍偏低：wave 6-7，目标是 P50 8-9。
- boss_gate / boss_clear 武器开始能进入 wave 6-8，个别强武器能到 wave 10，但整体仍未达目标。
- 成长循环已启动：多数跑局能到 level 3-4，不再普遍卡 level=1。
- 抖音构建守门失败，原因是 Cocos CLI bytedance 构建仍会产出空 main bundle；守门脚本正确拦截并恢复旧包，因此还不能宣称完整闭环。

## 主要改动范围

| 文件 | 当前改动方向 |
|---|---|
| `assets/scripts/enemy/enemyManager.ts` | 降低早期刷怪压力；调整 wave 1-8 interval / batch / cap；修正早期怪物池；修正 `spawnPack()` 不再把候选池长度误当最小批量；放缓早期 HP/伤害成长。 |
| `assets/scripts/enemy/enemyConstants.ts` | 提高普通 XP 掉率。 |
| `assets/scripts/catalogs/weaponCatalog.ts` | 提升中高价武器底盘，尤其 `split-barrel`、`orbital-drone`、`rail-cannon`、`gravity-hammer`、`meteor-launcher`、`star-scythe`。 |
| `assets/scripts/RogueShooterGame.ts` | 加强 bot 角落/边界避让，降低被墙角挤死造成的假性偏难。 |
| `tools/bot/run_balance_pipeline.py` | 选择武器 / seed / startBattle 失败时硬报错，避免假数据。 |
| `AGENTS.md` | 同步 XP 规则说明：`XP 掉率 = 56%，掉落量 = monsterXP × 2.6`。 |

## 已通过验证

已实际跑过：

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
npm test
npm run balance:build-web
```

结果：

- `tsc` 通过。
- `npm test` 通过，最终输出 `All tests passed.`
- `balance:build-web` 可产出有效 web-mobile artifact。
- 真实 Cocos/CDP pipeline 可启动 HTTP server + Chrome CDP + 游戏 hooks 并跑出 CSV/JSON/Markdown。

## 最新有效平衡回归结果

命令形态：

```bash
npm run balance:build-web
python3 tools/bot/run_balance_pipeline.py \
  --runs 1 \
  --max-seconds 600 \
  --skip-build \
  --weapons storm-rifle split-barrel ember-smg-standard frost-beamer-standard mirror-prism-standard rail-cannon-standard meteor-launcher-standard gravity-hammer-standard orbital-drone star-scythe-standard
```

最新结果摘要：

| 武器 | 阶段 | 结果 | 备注 |
|---|---|---:|---|
| 风暴步枪 | novice | wave 6 | ✅ 新手目标 5-6 基本达标 |
| 余烬冲锋枪 | standard | wave 7 | 偏低，目标 8-9 |
| 霜束发射器 | standard | wave 6 | 偏低 |
| 裂变枪管 | standard | wave 9 | ✅ 达标，但击杀数很高，需多 seed 确认是否过强 |
| 镜像棱镜 | standard | wave 7 | 偏低 |
| 轨道无人机 | boss_gate | wave 8 | 偏低，目标接近 10 |
| 磁轨炮 | boss_gate | wave 7 | 偏低 |
| 星镰 | boss_gate | wave 6 | 偏低 |
| 流星发射器 | boss_clear | wave 6 | 偏低 |
| 重力锤 | boss_clear | wave 10，600s 时仍存活 HP≈12 | 接近强武器目标，但仍需多 seed |

## 与 BP1 前对比

BP1 前代表性结果：

| 武器 | BP1 前 | BP1 后最新 |
|---|---:|---:|
| 风暴步枪 | wave 3 | wave 6 |
| 余烬冲锋枪 | wave 3 | wave 7 |
| 霜束发射器 | wave 3 | wave 6 |
| 镜像棱镜 | wave 3-4 | wave 7 |
| 磁轨炮 | wave 3 | wave 7 |
| 流星发射器 | wave 3 | wave 6 |

核心改善：

- 早期不再 wave 3 集体暴毙。
- 多数局升级链启动，level 从 1 提升到 3-4。
- 风暴步枪进入目标区间。

## 当前未完成 / 阻塞

### bytedance build guard 未通过

命令：

```bash
npm run build:bytedance:fast
```

失败摘要：

```text
[build-guard] ERROR: build artifact invalid after Cocos run:
  - main index too small: 590 bytes < 100000; likely empty main bundle
  - main index does not contain RogueShooterGame
  - settings.json has empty scripting.scriptPackages
  - latest bytedance build log has scenes=0, scripts=0
```

守门脚本已正确恢复旧包：

```text
restored previous build from build/.guard-backups/...
```

所以当前问题不是代码编译失败，而是 Cocos CLI bytedance 构建阶段仍会进入 `scenes=0/scripts=0` 空包路径。

## 下一步建议

### 先修构建守门，不继续调数值

优先处理 `tools/cocos_build_guard.py`：

1. 对齐 `tools/bot/build_web_mobile_for_bot.py` 的稳定逻辑。
2. 每次 bytedance build attempt 前强制 seed `library/.assets-data.json`，而不是只在 preflight 缺依赖时 seed。
3. 如果 Cocos log 出现 `Number of all scenes: 0` / `Number of all scripts: 0`，或 `assets/main/index.js` 只有几百字节，自动 retry。
4. retry 前再次清理 `temp/programming/packer-driver/targets/editor` 和 seed AssetDB。
5. 直到产物同时满足：
   - `assets/main/index.js` > 100KB
   - 包含 `RogueShooterGame`
   - `settings.json` 有非空 `scripting.scriptPackages`
   - 最新 log 不是 scenes=0/scripts=0
6. 再跑：

```bash
npm run build:bytedance:fast
npm run build:check
```

### 构建守门通过后再进入 BP2

BP2 目标：

| 阶段 | 目标 |
|---|---|
| novice | P50 5-6，P90≤7 |
| standard | P50 8-9，P90≤10 |
| boss_gate | P50≈10，多数见 Boss 但打不过 |
| boss_clear | P50≈11，刚好可过 Boss，不能滚雪球到 20 波 |

BP2 建议先跑多 seed：

```bash
python3 tools/bot/run_balance_pipeline.py --runs 3 --max-seconds 720 --skip-build
```

然后重点微调：

- standard 偏低：余烬、霜束、镜像、红线、脉冲等。
- boss_gate 偏低：轨道无人机、磁轨炮、星镰、量子织机等。
- boss_clear 偏低：流星发射器；重力锤接近但需多 seed 确认。
- 裂变枪管可能偏强，要多 seed 看是否稳定过 9。

## 注意事项

- 不要把当前 BP1 后 1-run 结果当最终平衡结论；必须多 seed。
- 不要用 Python 独立战斗仿真器替代真实 Cocos/CDP。
- 不要为了 bot 结果加 bot-only 数值补偿。
- bytedance build guard 不通过前，不能说“构建闭环完成”。

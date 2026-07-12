# 架构整改重构计划

> [!WARNING]
> **历史快照（已归档）**
> 本文保留早期单文件架构的重构计划，不得作为当前实现、目录结构或数值基线。当前开发入口请使用 [文档索引](./README.md)、[基线总览](./BASELINE.md)、[机制基线](./GAMEPLAY_MECHANICS.md) 和 [基线差异清单](./BASELINE_GAPS.md)。

> **For Hermes:** 按本计划小步执行，每步完成后运行 TypeScript 校验；涉及资源/构建后运行 Cocos 抖音构建。

**Goal:** 将 `RogueShooterGame.ts` 从 6000+ 行 God Component 逐步改造成入口编排组件。

**Architecture:** 使用绞杀者模式，先抽 `core/` 纯逻辑，再抽 `catalogs/` 数据，再抽 `state/` 状态，最后抽 `systems/` 和 `adapters/`。每一步保留主类薄 wrapper，避免大范围改调用点。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript ES2015、抖音小游戏构建。

---

## 当前基线

```text
assets/scripts/RogueShooterGame.ts
行数：6058
业务 TS 文件数：1
class 方法数：约 283
顶层 const：约 97
```

## 阶段 P0：抽纯逻辑核心模块

### Task 1: 建立架构与规范文档

**Objective:** 让后续重构有明确项目约束。

**Files:**

- Create: `docs/PROJECT_ARCHITECTURE.md`
- Create: `docs/CODING_STANDARDS.md`
- Create: `docs/REFACTORING_PLAN.md`

**Verification:**

```bash
git status --short
```

预期看到 3 个新增文档。

### Task 2: 抽出资源类型与资源钱包模块

**Objective:** 将 `ResourceType`、`ResourceWallet`、资源定义、钱包格式化从主类迁出。

**Files:**

- Create: `assets/scripts/core/types.ts`
- Create: `assets/scripts/core/resources.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

**Expected module:**

```text
core/types.ts       # ResourceType / ResourceDef / ResourceWallet
core/resources.ts   # RESOURCE_DEFS / RESOURCE_ZERO / createEmptyWallet / getResourceDef / formatWallet
```

**Verification:**

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
```

Expected: no output, exit code 0.

### Task 3: 抽出角色属性模块

**Objective:** 将 `CharacterStats`、`StatKey`、`StatEffect`、`STAT_META`、`createEmptyCharacterStats()`、`createBaseCharacterStats()` 迁入 `core/stats.ts`。

**Files:**

- Modify: `assets/scripts/core/types.ts`
- Create: `assets/scripts/core/stats.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

**Verification:**

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
```

### Task 4: 抽出装备槽和稀有度基础类型

**Objective:** 为后续 catalog 拆分建立共享类型。

**Files:**

- Modify: `assets/scripts/core/types.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

**Verification:** TypeScript 校验通过。

## 阶段 P1：抽 catalog

### Task 5: 抽本局道具 catalog

**Objective:** `RUN_ITEM_BLUEPRINTS`、tier、tradeoff 生成逻辑迁出。

**Files:**

- Create: `assets/scripts/catalogs/runItemCatalog.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

**Acceptance:** 新增/修改本局道具不再编辑主类。

### Task 6: 抽装备/武器 catalog

**Objective:** `EQUIPMENT` 和武器/装备生成函数迁出。

**Files:**

- Create: `assets/scripts/catalogs/equipmentCatalog.ts`
- Create: `assets/scripts/catalogs/weaponCatalog.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

**Acceptance:** 新增武器数据只改 catalog。

### Task 7: 抽敌人 catalog

**Objective:** `ENEMY_SPECS`、词缀、家族、波次解锁数据迁出。

**Files:**

- Create: `assets/scripts/catalogs/enemyCatalog.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

**Acceptance:** 新增敌人数据只改 catalog。

## 阶段 P2：状态对象

### Task 8: 建立 ProgressState

**Objective:** 永久资源、装备拥有、装备等级、出战槽从主类字段迁出。

**Files:**

- Create: `assets/scripts/state/progressState.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

### Task 9: 建立 RunState / PlayerState / WorldState

**Objective:** 当前战斗状态分组，减少主类字段数量。

**Files:**

- Create: `assets/scripts/state/runState.ts`
- Create: `assets/scripts/state/playerState.ts`
- Create: `assets/scripts/state/worldState.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

## 阶段 P3：Adapter

### Task 10: StorageAdapter

**Objective:** 隔离 `sys.localStorage`，为抖音/云存档/版本迁移留 seam。

**Files:**

- Create: `assets/scripts/adapters/storageAdapter.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

### Task 11: AudioService / AssetLoader

**Objective:** 音频和资源加载从主类迁出，统一处理超时和 fallback。

**Files:**

- Create: `assets/scripts/adapters/audioService.ts`
- Create: `assets/scripts/adapters/assetLoader.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

## 阶段 P4：玩法系统

### Task 12: DamageCalculator

**Objective:** 伤害、暴击、致命、防御公式变成纯逻辑可测模块。

**Files:**

- Create: `assets/scripts/systems/damageCalculator.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

### Task 13: WaveDirector

**Objective:** 波次、怪物池、Boss 规则、刷怪节奏迁出。

**Files:**

- Create: `assets/scripts/systems/waveDirector.ts`
- Modify: `assets/scripts/RogueShooterGame.ts`

## 每步固定验证命令

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
```

涉及 Cocos 资源或构建配置时：

```bash
'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator' \
  --project /Users/ronghui/Documents/game_dev_cocos \
  --build 'platform=bytedance-mini-game;debug=false'
```

## 提交策略

建议本轮提交：

```text
docs: add architecture and coding standards
refactor: extract resource wallet core module
```

如果文档和第一刀重构同时完成，也可以合并为：

```text
refactor: add architecture docs and extract resource core
```

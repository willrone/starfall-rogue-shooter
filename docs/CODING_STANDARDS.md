# 星坠幸存者项目编程规范

日期：2026-06-25  
适用范围：`assets/scripts/**/*.ts`、`tools/**/*.py`、项目文档与资源目录

## 1. 总原则

1. **先稳定，再漂亮**：重构不能破坏当前可玩版本。
2. **小步提交**：每次提交只做一种重构或一个功能。
3. **先纯逻辑，后 Cocos 节点**：优先拆不依赖 `cc` 的代码。
4. **显式命名**：用玩法领域词汇命名，不用 `manager2`、`helperNew` 这类模糊名。
5. **避免隐式副作用**：函数名必须体现是否会修改状态。
6. **不为未来过度设计**：当前没有第二个 Adapter 的 seam 可以先保留薄 wrapper，不强行抽象复杂接口。

## 2. TypeScript 规范

### 2.1 文件组织

推荐目录：

```text
assets/scripts/core/       # 纯逻辑；不依赖 Cocos
assets/scripts/catalogs/   # 数据表和数据生成
assets/scripts/state/      # 状态对象
assets/scripts/systems/    # 玩法系统
assets/scripts/adapters/   # 平台/引擎 Adapter
assets/scripts/ui/         # UI 构建和刷新
```

文件命名：

- TypeScript 文件使用 `camelCase.ts`。
- 类型名、接口名使用 `PascalCase`。
- 常量使用 `UPPER_SNAKE_CASE`。
- 普通函数使用 `camelCase`。

### 2.2 import 规则

1. `cc` import 放第一组。
2. 项目 import 放第二组。
3. type-only import 必须使用 `import type`。
4. 禁止循环依赖。
5. `core/` 不得 import `cc`。

示例：

```ts
import { Node, Graphics } from 'cc';

import { RESOURCE_DEFS } from './core/resources';
import type { ResourceWallet } from './core/types';
```

### 2.3 类型规则

当前 `tsconfig` 仍是 `strict: false`，但新代码按以下标准写：

- 新模块必须尽量避免 `any`。
- 公共函数必须标注参数和返回类型。
- 可空值用 `T | null`，不要用隐式 `undefined`。
- 字符串枚举优先用 union type，例如：

```ts
type GamePhase = 'menu' | 'combat' | 'paused';
```

### 2.4 函数规则

函数分三类命名：

| 类型 | 命名前缀/形式 | 说明 |
|---|---|---|
| 查询 | `getX` / `isX` / `formatX` | 不修改状态 |
| 创建 | `createX` / `buildX` | 返回新对象或创建节点 |
| 修改 | `applyX` / `addX` / `spendX` / `clearX` | 会修改状态 |

要求：

- 纯函数优先放在 `core/`。
- Cocos Node 创建函数不要混入数值公式。
- 超过 80 行的函数要优先考虑拆分。
- 新增 switch 时，必须问一句：是否应该是 behavior 表或 catalog 字段。

### 2.5 状态修改规则

禁止随意散改主类字段。新增状态优先放入：

- `ProgressState`
- `RunState`
- `PlayerState`
- `WorldState`

如果临时仍放在 `RogueShooterGame`，必须满足：

- 字段分组清晰。
- 初始化位置唯一。
- 清理位置明确。
- 存档字段集中在 `loadProgress()` / `saveProgress()` 或未来的 `StorageAdapter`。

## 3. Cocos 代码规范

### 3.1 Node / Graphics

- 静态背景只绘制一次，不在 `update()` 每帧重画。
- 高频对象必须优先对象池，例如 Bullet、EnemyProjectile、FloatingText。
- 创建节点必须设置 layer。
- 大量实体位置更新要缓存，避免无意义 setter。

### 3.2 update 循环

`update()` 只做编排：

```ts
update(dt) {
  updatePlayer(dt)
  updateWeapons(dt)
  updateBullets(dt)
  updateEnemies(dt)
  refreshHud()
}
```

禁止在 `update()` 内新增大段业务逻辑。

### 3.3 性能规则

- 实体查找避免 `Array.indexOf()` 嵌套 O(n²)。
- 命中检测使用空间网格。
- 分离/转向逻辑必须有检查次数上限。
- 掉落物数量必须有软上限和硬上限。
- 真机问题优先加可关闭的 debug HUD，而不是猜。

## 4. 游戏玩法代码规范

### 4.1 武器

新增武器时，不应在主类多处硬编码。目标是逐步收敛到：

```text
weaponCatalog.ts        # 武器数据
weaponBehavior.ts       # 武器行为参数/策略
weaponSystem.ts         # 开火、冷却、生成子弹
```

新增武器风格时必须检查：

- 子弹半径
- 子弹生命周期
- 子弹速度
- 穿透规则
- 命中特效
- 枪口闪光
- 音效
- 图标

### 4.2 敌人

新增敌人词缀时必须检查：

- 基础属性
- 解锁波次
- 权重
- 移动/技能
- 死亡效果
- 视觉标记
- 掉落/爆炸/远程弹

目标是逐步收敛到：

```text
enemyCatalog.ts
enemyBehavior.ts
enemySystem.ts
waveDirector.ts
```

### 4.3 资源和经济

资源类型只允许通过 `core/resources.ts` 统一定义。禁止散落写死：

```ts
'alloy' | 'cores' | 'shards'
```

钱包操作优先使用统一函数：

- `createEmptyWallet()`
- `hasResources()`
- `spendResources()`
- `formatWallet()`

## 5. 文档规范

必须维护：

```text
docs/PROJECT_ARCHITECTURE.md
项目架构设计，记录目标模块和依赖规则。

docs/CODING_STANDARDS.md
编程规范，记录新增代码必须遵守的约束。

docs/REFACTORING_PLAN.md
分阶段重构计划，记录当前阶段、验收标准、命令。

docs/ARCHITECTURE_REVIEW.md
阶段性审查报告，可随重构更新。
```

文档更新原则：

- 架构方向变化，先改文档再改代码。
- 拒绝某个架构建议且理由长期有效时，新增 ADR。
- 临时 TODO 不写进架构文档。

## 6. 验证规范

每次代码重构至少运行：

```bash
npx --yes -p typescript@5.9.3 tsc -p tsconfig.json
```

涉及 Cocos 构建/资源/平台时还要运行：

```bash
'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator' \
  --project /Users/ronghui/Documents/game_dev_cocos \
  --build 'platform=bytedance-mini-game;debug=false'
```

注意：Cocos CLI 可能返回非 0 退出码，但需要以 builder log 中是否出现 `build Task ... Finished` 辅助判断。

## 7. Git 提交规范

提交信息格式：

```text
<type>: <summary>
```

常用 type：

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 不改变行为的重构 |
| `docs` | 文档 |
| `perf` | 性能优化 |
| `test` | 测试 |
| `build` | 构建配置 |
| `art` | 美术资源 |

示例：

```text
refactor: extract resource wallet core module
docs: add architecture and coding standards
```

## 8. 禁止事项

- 禁止一次提交同时改架构、数值、美术、UI。
- 禁止为了“看起来更架构化”引入空壳模块。
- 禁止在 `core/` 里访问 Cocos Node、Graphics、AudioSource、resources。
- 禁止新增不可关闭的 debug 文案或日志进入发行版本。
- 禁止把构建产物 `build/`、`temp/`、`library/` 加入 git。
- 禁止把美术源文件放入 `assets/resources/` 运行时包，除非确实需要加载。

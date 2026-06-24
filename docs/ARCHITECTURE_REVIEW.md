# 架构与包体复查报告

日期：2026-06-24  
项目：`starfall-rogue-shooter` / Cocos Creator 3.8.8

## 结论

当前项目已经是一个可运行、可快速迭代的 MVP，但从长期工程质量看，`assets/scripts/RogueShooterGame.ts` 仍属于 **God Component / 功能型单体模块**，还不能算“高内聚、低耦合、设计优秀”的架构。

优点：

- 数据 catalog 有一定数据驱动基础：武器、装备、怪物、道具可以批量生成。
- 战斗循环、对象池、空间网格、dt clamp 等移动端/小游戏性能意识已经有雏形。
- Cocos 节点创建、Graphics 绘制、SpriteFrame 加载等都集中在一个入口，MVP 阶段迭代很快。

问题：

- 单个 TypeScript 文件约 5795 行，约 260KB。
- 项目当前只有 1 个业务脚本：`assets/scripts/RogueShooterGame.ts`。
- `RogueShooterGame` 同时承担生命周期、场景、UI、输入、音频、资源、战斗、敌人、武器、拾取、商店、装备、存档、HUD 和工具函数。
- Module 过大，Interface 不清晰，Seam 不明显，Adapter 基本缺失。

因此它更准确的定位是：

> 好用的单文件原型，不是可长期扩展的优秀架构。

## 代码规模与证据

| 指标 | 当前值 |
|---|---:|
| TS 业务文件数 | 1 |
| 主脚本行数 | 5795 行 |
| 主脚本大小 | 约 264KB |
| 粗略方法数 | 约 281 个 |
| 顶层 const 数 | 约 68 个 |
| interface/type/enum 数 | 34 个 |

关键代码位置：

- 类型和常量：`RogueShooterGame.ts:32-311`
- 数据 catalog：`RogueShooterGame.ts:313-980`
- 主类字段：`RogueShooterGame.ts:983-1165`
- 主循环：`RogueShooterGame.ts:1191-1217`
- 战斗/子弹/敌人：`RogueShooterGame.ts:2160-3270`
- UI/HUD/商店/机库：`RogueShooterGame.ts:1536-1699`、`4333+`
- 存档：`RogueShooterGame.ts:5413-5501`
- UI helper：`RogueShooterGame.ts:5620-5752`

## 按 Module / Interface / Seam 评价

### Module

当前主要 Module 是 `RogueShooterGame`，但它承载了几乎整个游戏。这个 Module 太浅：调用者/维护者需要知道大量内部字段和状态顺序，复杂性没有被隐藏。

### Interface

现有 interface 多为数据结构：

- `EnemySpec`
- `EquipmentDef`
- `LevelUpgrade`
- `CharacterStats`
- `Bullet`
- `Pickup`

这些对数据建模有帮助，但行为 Interface 缺失，例如：

- `StorageAdapter`
- `AudioService`
- `AssetLoader`
- `WeaponBehavior`
- `EnemyBehavior`
- `WaveDirector`
- `DamageCalculator`

### Seam

已有较好的 seam：

- catalog builder：武器/装备/怪物/本局道具生成逻辑已经比较适合拆出。
- UI helper：`button()`、`label()`、`rect()` 等有基础封装。
- 对象池：`Bullet`、`EnemyProjectile`、`FloatingText` 有回收路径。

不足的 seam：

- 存档直接耦合 `sys.localStorage`。
- 音频直接耦合 `AudioSource`、`resources.loadDir`。
- UI 和游戏状态互相直接修改。
- 武器/敌人行为靠多个 `switch` / 字符串判断分散在主类各处。
- Simulation 和 View 混在同一个更新函数里。

## 扩展性风险

### 1. 新增武器风格要改多处

`WeaponAttackStyle` 扩展后，通常要同时改：

- 风格命名
- 子弹半径
- 子弹生命周期
- 命中特效
- 枪口闪光
- 子弹绘制
- 音效映射
- 图标映射

这说明武器行为缺少一个统一的 `WeaponBehavior` seam。

### 2. 新增敌人技能要改多处

敌人行为分散在：

- `updateEnemySkill()`
- `shouldEnemyDash()`
- `shouldEnemyShoot()`
- `killEnemy()`
- `shouldEnemyExplodeOnDeath()`
- `updateEnemyVisual()`

新增一个敌人词缀时，很容易漏改其中一处。

### 3. 存档和平台能力没有 Adapter

当前 `loadProgress()` / `saveProgress()` 直接使用 `sys.localStorage`。如果后续接抖音/微信云存档、账号登录、版本迁移或加密存档，会污染主类。

### 4. 难以做自动化数值测试

`updateBullets()`、`updateEnemies()`、`damageEnemy()` 同时操作：

- 数值
- 碰撞
- Node 位置
- Graphics/Sprite 绘制
- SFX
- 浮字

这使得脱离 Cocos 运行纯逻辑模拟比较困难。后续要做 5-10 分钟自动平衡模拟时，最好把计算逻辑拆出来。

## 推荐重构顺序

### P0：先拆数据与公式，低风险

建议新增：

```text
assets/scripts/core/stats.ts
assets/scripts/core/resourceWallet.ts
assets/scripts/catalogs/equipmentCatalog.ts
assets/scripts/catalogs/enemyCatalog.ts
assets/scripts/catalogs/runItemCatalog.ts
```

目标：让 `RogueShooterGame.ts` 不再承载几百行 catalog 数据和公式。

收益：

- Locality 提升：数值改动集中在 catalog / stats 模块。
- Leverage 提升：主类只消费 catalog，不负责构造所有内容。
- 测试更容易：纯函数可脱离 Cocos 跑。

### P1：引入状态对象

建议分组：

```text
ProgressState  永久资源、装备、存档
RunState       当前出击、波次、击杀、商店、升级
PlayerState    位置、血量、护盾、当前属性
WorldState     enemies / bullets / pickups / projectiles
```

目标：减少 `RogueShooterGame` 内 170+ 字段散落。

### P2：提取 Adapter

优先级：

1. `StorageAdapter`
2. `AudioService`
3. `AssetLoader`
4. `InputController`

目标：平台能力通过 Adapter 接入，主玩法不直接依赖平台 API。

### P3：战斗系统拆分

建议拆：

```text
ProjectileSystem
EnemySystem
PickupSystem
WaveDirector
DamageCalculator
```

先从 `DamageCalculator` 和 `WaveDirector` 开始，因为 Cocos 依赖较少。

### P4：行为策略表

武器：

```ts
interface WeaponBehavior {
  style: WeaponAttackStyle;
  radius: number;
  life: number;
  accentColor(baseColor: string): string;
}
```

敌人：

```ts
interface EnemyBehavior {
  updateSkill(enemy, ctx): void;
  onDeath(enemy, ctx): void;
}
```

目标：新增武器/敌人时新增模块，而不是修改主类多个 switch。

## 包体复查

最新抖音小游戏 release 构建：

| 部分 | 大小 |
|---|---:|
| 总包 | 9.09 MiB |
| `cocos-js` | 4.81 MiB |
| `assets` | 4.14 MiB |
| `src` | 0.05 MiB |

最大瓶颈仍是 Cocos 引擎模块：

- `_virtual_cc-*.js`：约 2.85 MiB
- `bullet.release.asm`：约 0.90 MiB
- `bullet.release.wasm`：约 0.45 MiB
- `spine.asm`：约 0.35 MiB
- `spine.wasm`：约 0.20 MiB

构建日志显示当前 includeModules 包含很多本项目暂不需要的模块：

```text
3d, physics-ammo, physics-2d-box2d, spine-3.8, dragon-bones,
particle, particle-2d, terrain, tiled-map, video, webview,
light-probe, custom-pipeline, profiler ...
```

下一步真正有效的瘦身点是：

> 在 Cocos 构建配置里裁剪引擎 includeModules，只保留 2D、UI、Graphics、Sprite、Audio 等实际需要模块。

这比继续删几十 KB 资源更有收益，理论上还有 1MB+ 空间。

## 本轮已做的轻量瘦身

本轮清理了 resources 下不参与运行的文件：

- `assets/resources/art/placeholder/contact_sheet.png`
- `assets/resources/art/placeholder/contact_sheet.png.meta`
- `assets/resources/art/**/*.json` 的生成记录 sidecar

并修改：

- `tools/generate_placeholder_art.py`：以后总览图输出到 `assets/art_source/previews/placeholder_contact_sheet.png`，不再放入运行时 resources。
- `README.md`：更新占位美术说明。

本轮直接删除约 89KB 源资源，release 构建总大小约从 9.18MiB 降到 9.09MiB。

## 推荐下一步

建议下一轮不要继续硬删资源，而是做两个方向：

1. **架构第一刀**：拆 `stats` + `catalogs`，不碰战斗手感，风险最低。
2. **包体第一刀**：通过 Cocos 构建配置裁剪 includeModules，移除 physics / spine / 3D / terrain / video / webview 等。

这两个方向一个提升长期可维护性，一个提升上线包体质量。

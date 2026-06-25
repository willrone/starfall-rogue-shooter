# 星坠幸存者项目架构设计

日期：2026-06-25  
项目：`starfall-rogue-shooter` / Cocos Creator 3.8.8 / TypeScript

## 1. 架构目标

本项目从单文件 MVP 原型进入可维护阶段。架构目标不是过度工程化，而是让后续新增武器、怪物、道具、平台能力、抖音审核能力时，不再持续扩大 `RogueShooterGame.ts`。

核心目标：

1. **玩法稳定**：重构不得改变已有战斗手感、数值、UI 流程。
2. **低风险演进**：先拆纯数据和纯公式，再拆状态，最后拆 Cocos 节点系统。
3. **可测试**：数值、钱包、掉落、波次、伤害公式应能脱离 Cocos 运行单元测试。
4. **可定位**：每类问题有明确模块位置，而不是全都进主类。
5. **可上线**：兼顾小游戏包体、真机加载、平台 Adapter、审核合规 UI。

## 2. 分层架构

目标结构：

```text
assets/scripts/
├── RogueShooterGame.ts              # Cocos 入口组件；最终只做编排
├── core/                            # 纯逻辑、类型、公式；不依赖 Cocos Node/Graphics
│   ├── types.ts                     # 跨模块基础类型
│   ├── resources.ts                 # 资源钱包、资源定义、格式化
│   ├── stats.ts                     # 角色属性、属性叠加、格式化
│   └── formulas.ts                  # 通用数值公式
├── catalogs/                        # 静态数据和数据生成
│   ├── weaponCatalog.ts
│   ├── equipmentCatalog.ts
│   ├── enemyCatalog.ts
│   └── runItemCatalog.ts
├── state/                           # 游戏状态对象
│   ├── progressState.ts             # 永久进度：仓库、资源、装备、存档版本
│   ├── runState.ts                  # 当前出击：波次、击杀、商店、升级
│   ├── playerState.ts               # 玩家位置、血量、护盾、当前属性
│   └── worldState.ts                # enemies / bullets / pickups / projectiles
├── systems/                         # 玩法系统，逐步从主类中拆出
│   ├── damageCalculator.ts
│   ├── waveDirector.ts
│   ├── projectileSystem.ts
│   ├── enemySystem.ts
│   ├── weaponSystem.ts
│   └── pickupSystem.ts
├── adapters/                        # 平台/引擎能力 Adapter
│   ├── storageAdapter.ts
│   ├── audioService.ts
│   ├── assetLoader.ts
│   └── inputController.ts
└── ui/                              # UI 构建与显示逻辑
    ├── uiFactory.ts
    ├── hudView.ts
    ├── menuView.ts
    ├── hangarView.ts
    └── shopView.ts
```

## 3. 模块职责

### 3.1 `RogueShooterGame.ts`

定位：Cocos Component 入口与编排层。

允许职责：

- Cocos `start/update/onDestroy` 生命周期。
- 创建根 Canvas / Camera。
- 持有系统实例。
- 调用系统更新。
- 接收 UI/Input 回调并转发。

禁止长期职责：

- 不直接维护大段 catalog 数据。
- 不直接实现所有战斗公式。
- 不直接访问平台存储细节。
- 不直接塞入新增武器/敌人所有分支。

### 3.2 `core/`

定位：无 Cocos 依赖的纯逻辑模块。

要求：

- 不 import `cc`。
- 函数优先设计为纯函数。
- 可用 Node/TypeScript 单独测试。
- 包含资源钱包、属性、公式、基础类型。

### 3.3 `catalogs/`

定位：数据定义和数据生成。

要求：

- 负责“有哪些武器/敌人/装备/道具”。
- 不负责 Cocos 节点创建。
- 不负责运行时状态修改。
- 输出只读数据或新对象。

### 3.4 `state/`

定位：显式状态容器。

拆分原则：

| State | 内容 |
|---|---|
| `ProgressState` | 永久资源、装备拥有情况、装备等级、出战槽、存档版本 |
| `RunState` | 当前出击资源、波次、击杀、当前商店、本局升级 |
| `PlayerState` | 位置、血量、护盾、当前移动/朝向 |
| `WorldState` | enemies、bullets、pickups、enemyProjectiles、floatingTexts |

### 3.5 `systems/`

定位：玩法行为模块。

拆分顺序：

1. `DamageCalculator`：伤害、暴击、致命、护甲、防御、减伤。
2. `WaveDirector`：波次、怪物池、刷怪节奏、Boss 规则。
3. `ProjectileSystem`：子弹和敌方弹移动/命中。
4. `EnemySystem`：敌人移动、技能、分离、死亡。
5. `WeaponSystem`：武器开火、弹型、特效触发。
6. `PickupSystem`：掉落、合并、拾取、压缩。

### 3.6 `adapters/`

定位：隔离 Cocos/平台能力。

首批 Adapter：

- `StorageAdapter`：本地存档、未来抖音/微信云存档、版本迁移。
- `AudioService`：BGM/SFX 加载、播放、静音、解锁。
- `AssetLoader`：SpriteFrame/AudioClip 加载、超时、fallback。
- `InputController`：键盘/触控输入归一化。

## 4. 依赖规则

依赖只能单向流动：

```text
RogueShooterGame -> ui/systems/adapters -> state/catalogs/core
systems -> state/catalogs/core
ui -> state/core
catalogs -> core
core -> 无项目内依赖
```

禁止：

- `core` import `cc`。
- `catalogs` import `RogueShooterGame`。
- `systems` 直接创建复杂 UI。
- `ui` 直接改战斗公式。
- 多个模块互相循环 import。

## 5. 重构策略

采用“绞杀者模式”：

1. 新模块先创建在 `core/`、`catalogs/` 等目录。
2. 主类保留薄 wrapper，保证调用点稳定。
3. 每次只搬一类职责。
4. 每次搬迁后运行 TypeScript 校验。
5. 每个阶段保证 Cocos 构建仍可完成。

禁止一次性大爆炸重构。

## 6. 验收标准

阶段性目标：

| 阶段 | 目标 |
|---|---|
| P0 | 拆出 `core/types.ts`、`core/resources.ts`、`core/stats.ts`，主类减少纯数据/公式负担 |
| P1 | 拆出武器/装备/敌人/道具 catalog，新增内容只改 catalog |
| P2 | 引入状态对象，减少主类字段数量 |
| P3 | 引入 Storage/Audio/Asset/Input Adapter |
| P4 | 拆出 Damage/Wave/Projectile/Enemy/Weapon/Pickup systems |
| P5 | 补纯逻辑测试和数值模拟脚本 |

长期目标：

- `RogueShooterGame.ts` 控制在 1500 行以内。
- 每个新武器风格最多改 1 个 catalog + 1 个 behavior 表。
- 每个新敌人词缀最多改 1 个 catalog + 1 个 behavior 表。
- 数值公式可脱离 Cocos 做自动化测试。

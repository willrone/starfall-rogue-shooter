# 星坠幸存者 — Slash-The-Hordes 架构借鉴改造计划

> **适用对象:** Hermes Agent（用 subagent-driven-development 逐任务执行）
>
> **状态:** 计划阶段，等待确认后执行

**目标:** 基于对 Slash-The-Hordes（同类型 Cocos 3.8.8 VS-like 项目）的源码研究，分阶段移植其优秀设计模式到星坠幸存者，同时清理美术资产积压，最终恢复并验证平衡性工具链。

**Src:** `~/cocos-ref/Slash-The-Hordes/` — 104 个 TS 文件，8.4M 项目

---

## 总览

| 阶段 | 内容 | 文件数 | 估计工时 | 优先级 |
|------|------|--------|---------|--------|
| **P1 基础设施修复** | 修复损坏的 balance_simulator + 编写独立验证脚本 | 2-3 | ~20min | 🔴 最高 |
| **P2 GameTimer 工具** | 20行通用计时器，替换散落的 dt 累加 | 1 新建 + 5+ 修改 | ~15min | 🔴 高 |
| **P3 Signal 事件系统** | 30行泛型事件系统，逐步解耦 Manager 间调用 | 1 新建 + 逐步替换 | ~15min | 🔴 高 |
| **P4 Enemy 移动策略解耦** | 借鉴 IEnemyMover 策略模式，抽离 EnemyManager 的移动逻辑 | 3-5 新建 + 重构 | ~45min | 🟡 中 |
| **P5 Spawner 出怪模式补充** | 环形包抄 + 弹射冲锋 + 移动节奏变化 | 3-4 新建 | ~30min | 🟡 中 |
| **P6 美术资产清理** | 清理未引用资源 + 确认占位图退役 + 伤害特效 | 文件操作 | ~20min | 🟡 中 |
| **P7 平衡性验证** | 恢复 simulator pipeline，运行 stratified targets 验证 | 2-3 | ~20min | 🟢 低 |

---

## 前置检查：当前项目健康度

执行所有改动前，先记录基准状态：

```bash
cd /Users/ronghui/Documents/game_dev_cocos

# 1. TS 编译检查
npx tsc -p tsconfig.json --noEmit 2>&1

# 2. 现有测试
npx jest --passWithNoTests 2>&1 | tail -10

# 3. 包体大小
du -sh build/web-mobile/ 2>/dev/null
python3 -c "text=open('build/web-mobile/assets/main/index.js','r',encoding='utf-8').read(); print(f'main.js: {len(text)//1024}KB, __starfallGame: {\"__starfallGame\" in text}')"

# 4. Python 工具链
python3 tools/balance_simulator.py --help 2>&1 | head -5 || echo "SIMULATOR BROKEN"
```

---

## P1: 基础设施修复

### 当前问题

`tools/balance_simulator.py` 因之前反复 patch 产生了嵌套函数定义和截断 docstring，导致 SyntaxError。`tools/verify_tier_targets.py` 尚未创建。

### Task 1.1: 修复 balance_simulator.py

**Objective:** 将 `balance_simulator.py` 修复为干净的、可运行的版本

**Files:**
- Modify: `tools/balance_simulator.py` — 修复重复的 `def ` 和截断的 docstring
- Validate: `npx tsc -p tsconfig.json --noEmit` (验证 TS 端)
- Validate: `python3 -c "import ast; ast.parse(open('tools/balance_simulator.py').read())"` (验证 Python 语法)

**步骤:**
1. 用 `python3 -c "compile(open('tools/balance_simulator.py').read(), 'tools/balance_simulator.py', 'exec')"` 找到具体错误行号
2. 用 `patch()` 删除多余嵌套的函数定义和截断文本
3. 验证语法通过
4. 运行 `python3 tools/balance_simulator.py --runs 5 --seed 42` 确认可产出结果

### Task 1.2: 创建 verify_tier_targets.py

**Objective:** 创建一个不依赖 simulator 内部状态的独立验证脚本，直接从 `weaponCatalog.ts` 的数值 + 纯函数公式估算 Tier 命中率

**Files:**
- Create: `tools/verify_tier_targets.py`
- Reference: `tools/balance_simulator.py` (数值抽取逻辑)
- Reference: `assets/scripts/catalogs/weaponCatalog.ts` (武器数据)

**核心逻辑:**
```python
# 复刻 combatFormulas.ts 的核心纯函数
def estimate_bullet_damage(weapon_damage, level=1):
    return max(2, weapon_damage * (1 + (level - 1) * 0.12))

def estimate_fire_interval(weapon_fire_rate, level=1):
    interval = 1 / max(0.15, weapon_fire_rate * (1 + (level - 1) * 0.10))
    return max(0.07, interval)

def estimate_dps(weapon, level=1):
    dmg = estimate_bullet_damage(weapon.damage, level)
    interval = estimate_fire_interval(weapon.fireRate, level)
    return dmg / interval

# Tier targets
TIER_TARGETS = {
    'novice':    {'target_wave': '5-6',  'p90_max_wave': 7},
    'standard':  {'target_wave': '8-9',  'p90_max_wave': 10},
    'boss_gate': {'target_wave': '10',   'p50_max_wave': 10, 'p90_max_wave': 10},
    'boss_clear':{'target_wave': '11-12','p50_min_wave': 11, 'p90_max_wave': 12},
    'legendary': {'target_wave': '12+',  'p50_min_wave': 12},
}
```

**验证方法：**
```bash
python3 tools/verify_tier_targets.py
# 输出：每个武器的 Tier、基础 DPS、估算存活波次、是否命中目标
```

---

## P2: GameTimer 工具类

### 参考来源

Slash-The-Hordes: `assets/Scripts/Services/GameTimer.ts`

```typescript
// 原版 25 行
export class GameTimer {
    private currentTime = 0;
    public constructor(private periodSec: number) {}
    public gameTick(deltaTime: number): void {
        this.currentTime += deltaTime;
    }
    public tryFinishPeriod(): boolean {
        if (this.currentTime < this.periodSec) return false;
        this.currentTime -= this.periodSec;
        return true;
    }
}
```

### 对你的价值

你现在的散落模式：
```typescript
// weaponManager.ts: timer += dt; if (timer >= cd) { timer = 0; ... }
// enemyManager.ts:  interval = ... 每帧手动累加
// projectileManager.ts: fireTimer 手动管理
```

改成 GameTimer 后统一管理，消除"忘了清零"类 bug。

### Task 2.1: 创建 GameTimer

**Files:**
- Create: `assets/scripts/core/gameTimer.ts`

**代码：**
```typescript
/**
 * 周期计时器。每帧调用 gameTick(dt)，到周期时 tryFinishPeriod() 返回 true 并自动重置。
 * 适配星坠幸存者的 combatFormulas 加法公式体系。
 */
export class GameTimer {
    private elapsed = 0;

    /**
     * @param period 周期（秒）。<=0 表示每帧都触发。
     */
    public constructor(private period: number) {}

    public gameTick(deltaTime: number): void {
        this.elapsed += deltaTime;
    }

    /** 如果经过了至少一个周期，消耗一个周期并返回 true */
    public tryFinishPeriod(): boolean {
        if (this.period <= 0) return true;
        if (this.elapsed < this.period) return false;
        this.elapsed -= this.period;
        return true;
    }

    /** 重置计时器 */
    public reset(): void {
        this.elapsed = 0;
    }

    /** 强制设定经过时间（用于恢复/加载） */
    public setElapsed(value: number): void {
        this.elapsed = value;
    }

    /** 当前周期进度 [0, 1) */
    public get progress(): number {
        if (this.period <= 0) return 0;
        return Math.min(this.elapsed / this.period, 0.999);
    }
}
```

### Task 2.2: 替换 "timer += dt" 散落模式

**查找目标：**
```bash
grep -rn "timer\s*+=\s*dt\|timer\s*+=\s*deltaTime\|currentTime\s*+=\|elapsed\s*+=" assets/scripts/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
```

**替换模式：**
- `timer += deltaTime; if (timer >= cooldown) { timer = 0; action(); }`
  → `timer.gameTick(deltaTime); if (timer.tryFinishPeriod()) { action(); }`
- `this.currentTime += dt;`
  → 如果用于计时触发 → `GameTimer`

**典型修改文件：**
- `assets/scripts/managers/weaponManager.ts`
- `assets/scripts/combat/projectileManager.ts`
- `enemyManager.ts` 中的 spawn interval 计时

### Task 2.3: 测试

**File:** `tests/core/gameTimer.test.ts`

```typescript
describe('GameTimer', () => {
    it('triggers after period', () => {
        const t = new GameTimer(0.5);
        t.gameTick(0.3);
        expect(t.tryFinishPeriod()).toBe(false);
        t.gameTick(0.3); // 0.6 秒累计
        expect(t.tryFinishPeriod()).toBe(true);  // 消耗一次
        expect(t.tryFinishPeriod()).toBe(false); // 已消耗
    });
});
```

---

## P3: Signal 事件系统

### 参考来源

Slash-The-Hordes: `assets/Scripts/Services/EventSystem/Signal.ts`

```typescript
// 原版 ~30 行
export class Signal<T> {
    private handlers: ((data: T) => void)[] = [];
    public on(handler: (data: T) => void, context?: any): void { ... }
    public off(handler: (data: T) => void): void { ... }
    public trigger(data: T): void { ... }
}
```

### 对你的价值

你现在是直接函数调用链：
```
RogueShooterGame.ts → weaponManager.fire() → 直接调 projectileManager
                   → enemyManager.spawn()  → 直接 spawn 并绑定
```

改成事件后（渐进式，不一次性全改）：
```
Enemy死亡事件 → ItemManager监听掉落 → ProjectileManager监听杀敌数
Boss击杀事件 → LootPanel监听显示
```

### Task 3.1: 创建 Signal

**Files:**
- Create: `assets/scripts/core/signal.ts`

```typescript
type Handler<T> = (data: T) => void;

export class Signal<T = void> {
    private handlers: Array<Handler<T>> = [];

    public on(handler: Handler<T>): void {
        if (!this.handlers.includes(handler)) {
            this.handlers.push(handler);
        }
    }

    public off(handler: Handler<T>): void {
        const idx = this.handlers.indexOf(handler);
        if (idx !== -1) this.handlers.splice(idx, 1);
    }

    public trigger(data: T): void {
        // 快照迭代，避免在回调中 off 导致下标错乱
        for (const h of [...this.handlers]) {
            h(data);
        }
    }

    public clear(): void {
        this.handlers.length = 0;
    }
}
```

### Task 3.2: 测试

```typescript
describe('Signal', () => {
    it('triggers handlers', () => {
        const s = new Signal<number>();
        let result = 0;
        s.on((v) => { result = v; });
        s.trigger(42);
        expect(result).toBe(42);
    });
    it('supports off', () => { ... });
});
```

### Task 3.3: 试点替换：敌人死亡事件

**当前模式：** `enemyDeathManager.ts` 里循环处理死亡，直接调多个 Manager 的方法

**新模式：** 发一个 `Signal<EnemyDeathData>`，监听者在各自的 update 里响应

**Files:**
- Modify: `assets/scripts/events/` (如果有) 或直接加在 `enemyManager.ts`
- 试点：`EnemyManager.deathEvent` → `ItemManager` 监听掉落 + `ProjectileManager` 监听计数

---

## P4: Enemy 移动策略解耦

### 参考来源

Slash-The-Hordes: strategy pattern for movement

```
IEnemyMover 接口: addEnemy / removeEnemy / gameTick
  ├── FollowTargetEnemyMover   — 追踪玩家 (你的默认行为)
  ├── WaveEnemyMover            — 直线弹射 (冲过去不停)
  └── PeriodicFollowMovers      — 追一阵→停一阵→再追 (远程怪)
```

### 你的 EnemyManager 现状

~1300 行的大文件里，移动逻辑、碰撞、生成混在一起。每次加新移动行为要改核心文件。

### Task 4.1: 创建 Mover 接口 + 基础实现

**Files:**
- Create: `assets/scripts/unit/movement/iEnemyMover.ts`
- Create: `assets/scripts/unit/movement/followMover.ts` (你已有的追踪行为，抽取)
- Create: `assets/scripts/unit/movement/periodicFollowMover.ts` (追停节奏)

```typescript
// iEnemyMover.ts
import { Enemy } from '../enemy/enemy';

export interface IEnemyMover {
    addEnemy(enemy: Enemy): void;
    removeEnemy(enemy: Enemy): void;
    gameTick(deltaTime: number): void;
}

// followMover.ts — 追踪玩家（最基础）
export class FollowMover implements IEnemyMover {
    private enemies: Enemy[] = [];
    constructor(private targetNode: Node) {}
    addEnemy(e: Enemy) { this.enemies.push(e); }
    removeEnemy(e: Enemy) { /* find + splice */ }
    gameTick(dt: number) {
        for (const e of this.enemies) {
            // 朝玩家方向移动
        }
    }
}

// periodicFollowMover.ts — 追 X 秒→停 Y 秒→再追
export class PeriodicFollowMover implements IEnemyMover {
    // 用 GameTimer 管理节奏
}
```

### Task 4.2: 重构 EnemyManager 的移动部分

**Files:**
- Modify: `assets/scripts/managers/enemyManager.ts`
  - 抽取 `Map<MovementType, IEnemyMover>` 
  - `onEnemyAdded` 时根据 type 分配到对应 Mover
- Risk: 大文件修改需先备份或小步提交

---

## P5: Spawner 出怪模式补充

### 参考来源

Slash 有 4 种 spawner 变体：

| 模式 | 描述 | 对你的价值 |
|------|------|-----------|
| IndividualEnemySpawner | 每 N 秒生 1 只 → 你已有 | — |
| CircularEnemySpawner | 每 N 秒出一圈包围玩家 | 🔥 Boss 战/精英出怪 |
| WaveEnemySpawner | 直线高速冲锋(有去无回) | 🔥 刺客型新怪 |
| 周期性移动 | 追→停→射→追节奏 | 🔥 远程怪差异化 |

### Task 5.1: 环形出怪 CircularSpawner

用于 Boss 战：Boss 半血时，环形出一圈小怪从外围包围玩家。

```typescript
// 简化版——在 EnemyManager 上加一个方法
spawnCircle(enemyId: string, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const x = Math.sin(angle) * radius;
        const y = Math.cos(angle) * radius;
        this.spawnAt(playerPos.x + x, playerPos.y + y, enemyId);
    }
}
```

### Task 5.2: 周期性移动 PeriodicFollowMover

给远程怪（seeker, aura）装上：追 2 秒 → 停 1.5 秒（期间有可能射击）→ 再追。

**配置方式：** 在 `enemyCatalog.ts` 里给怪物加一个 `movementConfig` 字段：
```typescript
{ id: 'seeker', ..., movementConfig: { 
    type: 'periodicFollow', 
    followDuration: 2, 
    pauseDuration: 1.5,
    shootDuringPause: true 
}}
```

---

## P6: 美术资产清理

### 问题诊断

| 目录 | 文件数 | 问题 | 处理 |
|------|-------|------|------|
| `assets/art_source/generated/` | 37 PNG | 原始 AI 出图，不在 `resources/` 下不影响包体，但污染 git | 加到 `.gitignore` |
| `assets/art_source/frames/` | ~150 PNG | 精灵帧拆分源文件 | 加到 `.gitignore` |
| `assets/art_source/previews/` | ~30 GIF | 预览文件 | 加到 `.gitignore` |
| `archive_v1/` & `archive_*` | ~15 | 旧版废弃 | 加到 `.gitignore` |
| `visual_upgrade_candidates/` | ~20 | 概念探索 | 加到 `.gitignore` |
| `yuz_generated_candidates/` | ~20 | 概念探索 | 加到 `.gitignore` |
| `assets/resources/art/placeholder/` | 17 PNG | **在 resources 路径下，影响包体** | 逐个追查是否被引用 |

### Task 6.1: 配置 .gitignore 保护 art_source

**Files:**
- Modify: `.gitignore`

添加：
```
# 美术原始源文件（不参与构建）
assets/art_source/generated/
assets/art_source/frames/
assets/art_source/previews/
assets/art_source/archive_*/
assets/art_source/visual_upgrade_candidates/
assets/art_source/yuz_generated_candidates/
```

### Task 6.2: 占位图审计

**方法：**
```bash
# 对每个 placeholder PNG，在 TS 源码中搜索引用
for f in assets/resources/art/placeholder/*.png; do
    name=$(basename "$f" .png)
    count=$(grep -rl "$name" assets/Scripts/ assets/scripts/ 2>/dev/null | wc -l)
    if [ "$count" -eq 0 ]; then
        echo "未引用: $f → 可删除"
    fi
done
```

**结果判断：**
- 未被任何 TS 文件引用的 → 删除
- 被引用的 → 确认是否有正式资源替代 → 切换引用到正式资源后删除

### Task 6.3: 伤害特效增强

参考 Slash-The-Hordes 的 `DeathEffect.anim` + `PickBonus.anim`，增加：
- 敌人受伤闪白（你现在已有 `flashEffect`？没有的话加一行）
- 敌人死亡简单爆炸粒子（复用现有的 `bullet_*.png` + 一个 animation）

**Files:**
- Create or modify: `assets/resources/effects/deathEffect.prefab` (如果不存在)

---

## P7: 平衡性验证（收官门禁）

### Task 7.1: 全武器 tier 校验

```bash
# 修复后的 simulator
python3 tools/balance_simulator.py --runs 300 --seed 42 --export-csv /tmp/balance_result.csv

# 分层目标验证
python3 tools/verify_tier_targets.py --input /tmp/balance_result.csv

# 结果输出示例
# [PASS] novice: 风暴步枪 P90=6 ✓ (target ≤7)
# [FAIL] novice: 余烬冲锋枪 P90=9 ✗ (target ≤7)
# [PASS] standard: 裂变枪管 P50=8.5 ✓ (target 8-10)
# ...
```

### Task 7.2: 包体大小门禁

```bash
python3 tools/cocos_build_guard.py  # 已有脚本
du -sh build/bytedance-mini-game-release-slim2/  # 抖音构建目录
```

**门禁规则：**
- ✅ tsc 零错
- ✅ 所有测试通过
- ✅ simulator 可运行且输出 CSV
- ✅ 包体 < 11.8 MiB (留 0.2 MiB 余量)
- ⚠️ Tier 目标 60%+ 通过可接受，低于 60% 需要调数值

---

## 执行策略

### 建议执行顺序

```
P1 (修复模拟器)        → 立即解除阻塞
P2 + P3 (GameTimer+Signal) → 40分钟，最大收益
P4 (移动策略)          → 如果 P2/P3 顺利则继续
P6 (美术清理)          → 可在任何阶段并行
P7 (验证)              → 最后关门
P5 (Spawner新模式)     → 加到 Boss 设计稿一起做
```

### 每次提交规则

```bash
# 每完成一个 Task 提交一次
git add -A
git commit -m "refactor: add GameTimer utility class"
git commit -m "refactor: add Signal event system"
git commit -m "refactor: extract enemy movement strategy pattern"
# 以此类推
```

### 风险提醒

1. **EnemyManager (~1300行) 重构风险最高** — 改成 Mover 策略模式前，先确保有完善的测试覆盖，或者用 feature flag 逐步切换
2. **Signal 试点替换要保持向后兼容** — 不要在重构中破坏现有调用链
3. **包体逼近上限 (11.4/12 MiB)** — 任何新增资源都需要确认不会导致超标

---

## 附录：Slash-The-Hordes 完整文件索引

参考位置: `~/cocos-ref/Slash-The-Hordes/`

| 你的需求 | 参考文件 |
|---------|---------|
| GameTimer | `assets/Scripts/Services/GameTimer.ts` |
| Signal 事件 | `assets/Scripts/Services/EventSystem/Signal.ts` |
| 对象池 | `assets/Scripts/Services/ObjectPool.ts` |
| Enemy 移动策略 | `assets/Scripts/Game/Unit/Enemy/EnemyMover/*.ts` |
| 生怪器 | `assets/Scripts/Game/Unit/Enemy/EnemySpawner/*.ts` |
| 掉落管理 | `assets/Scripts/Game/Items/ItemManager.ts` |
| JSON 数据驱动 | `assets/Data/GameSettings.json` |

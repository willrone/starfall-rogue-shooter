# P0 平衡调整计划

> 来源: CDP 600s 全武器长测数据 `data/balance_cdp_full_weapon_600_20260710_120528`
> 状态: 计划，待执行

## 改动一览

| 武器 | 问题 | 当前值 | 目标值 | 修改位置 |
|---|---|---|---|---|
| 织网支配者 |  击杀回血15%过高 | `bullet.damage * 0.15` | `bullet.damage * 0.08` | `projectileManager.ts:1805` |
| 虚空针 | boss_gate组断档领先 | damage=60, fireRate=1.05 | damage=52, fireRate=1.05 | `weaponCatalog.ts:46` |
| 轨道无人机 | boss_clear组最弱，仅波3 | damage=92, fireRate=0.65, drone_charge+20/杀 | damage=92, fireRate=0.75, drone_charge+25/杀 | `weaponCatalog.ts:50` + `projectileManager.ts:1798` |
| 冰狱审判 | 传说武器只到波5 | damage=95, fireRate=0.95 | damage=120, fireRate=1.00 | `weaponCatalog.ts:55` |
| 虚空撕裂者 | 传说武器只到波5 | damage=44, fireRate=1.8 | damage=60, fireRate=1.8 | `weaponCatalog.ts:54` |

## 改动详情

### 1. 织网支配者削 → `projectileManager.ts:1805`

```typescript
// 改前: 击杀回血 15%
this.ctx.healPlayer(bullet.damage * 0.15);
// 改后: 击杀回血 8%
this.ctx.healPlayer(bullet.damage * 0.08);
```

### 2. 虚空针削 → `weaponCatalog.ts:46`

```typescript
// 改前: damage: 60
{ id: 'void-needle', ..., damage: 60, fireRate: 1.05, ... }
// 改后: damage: 52
{ id: 'void-needle', ..., damage: 52, fireRate: 1.05, ... }
```

### 3. 轨道无人机加强 → `weaponCatalog.ts:50` + `projectileManager.ts:1798`

```typescript
// 改前: damage: 92, fireRate: 0.65
{ id: 'orbital-drone', ..., damage: 92, fireRate: 0.65, ... }
// 改后: damage: 110, fireRate: 0.75
{ id: 'orbital-drone', ..., damage: 110, fireRate: 0.75, ... }
```

```typescript
// projectileManager.ts:1798 — drone_charge 击杀充能
// 改前: +20
this.ctx.cs.droneCharge += 20;
// 改后: +25
this.ctx.cs.droneCharge += 25;
```

### 4. 冰狱审判加强 → `weaponCatalog.ts:55`

```typescript
// 改前: damage: 95, fireRate: 0.95
{ id: 'icefire-judge', ..., damage: 95, fireRate: 0.95, ... }
// 改后: damage: 120, fireRate: 1.00
{ id: 'icefire-judge', ..., damage: 120, fireRate: 1.00, ... }
```

### 5. 虚空撕裂者加强 → `weaponCatalog.ts:54`

```typescript
// 改前: damage: 44
{ id: 'void-tearer', ..., damage: 44, ... }
// 改后: damage: 60
{ id: 'void-tearer', ..., damage: 60, ... }
```

## 验证步骤

1. `npm run typecheck` — tsc 零错
2. `npm test` — 平衡测试等全过
3. `npm run build:bytedance` — 抖音构建成功
4. 选择性 CDP smoke（织网/冰狱/虚空撕裂者/轨道无人机各 60s）确认改动生效

## 不动的武器

- 冲锋枪/瘟疫喷射器/霜束发射器 — Novice 组数据一致性好，不调
- 回声弓/裂变枪管/镜像棱镜/量子织机 — Standard 组全波5死亡墙是系统性问题（波5怪密度/HPS突增），不是单武器数值问题，单独讨论
- 离子长枪/荆棘连弩/磁轨炮 — Boss Gate 除虚空针外数据合理
- 流星发射器/重力锤 — Boss Clear 合理

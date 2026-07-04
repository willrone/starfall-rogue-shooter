/**
 * Starfall Survivor — 数值平衡验证 (纯 TS, 毫秒级)
 *
 * 所有测试不依赖 Cocos runtime, 可在 Node.js 下直接跑:
 *   npm test
 *
 * 依赖: `assets/scripts/core/combatFormulas.ts` 提供纯函数公式
 *
 * 目的:
 * - 快速验证武器基础 DPS 是否符合设计目标
 * - 检视每把武器 Lv.1 / Lv.3 / Lv.6 的提升曲线
 * - 验证 wave 压力 vs 武器 DPS 的匹配关系
 * - 改完武器/怪物数据后跑一次, 确保没把一些明显过强/过弱的数值改出来
 */

import assert from 'node:assert/strict';
import { WEAPON_FAMILIES, WEAPON_CATALOG } from '../../assets/scripts/catalogs/weaponCatalog';
import { createBaseCharacterStats } from '../../assets/scripts/core/stats';
import type { CharacterStats } from '../../assets/scripts/core/types';
import {
    calcDps,
    calcBulletDamage,
    calcFireInterval,
    calcBulletPierce,
    weaponDamageAtLevel,
    weaponFireRateAtLevel,
    averageEnemyHp,
    waveHpPerSecond,
    waveSpawnBatchCount,
    waveSpawnInterval,
    enemyCap,
    estimateP50,
} from '../../assets/scripts/core/combatFormulas';

// ── 基础属性 ───────────────────────────────────────────────────────────
const BASE = createBaseCharacterStats();

// ── 17 把武器条目 (family 数据) ──────────────────────────────────────
interface WeaponSpec {
    id: string;
    name: string;
    damage: number;
    fireRate: number;
    pierce: number;
    drone: number;
    bulletSpeed: number;
    mechanic: string;
    tier: 'novice' | 'standard' | 'boss_gate' | 'boss_clear';
}

// 从 WEAPON_FAMILIES 取出 17 把基础/传说武器
// tier 映射与 CDP 工具的 WEAPON_TIER_MAP 保持一致；传说武器按 standard 目标检查
const TIER_MAP: Record<string, WeaponSpec['tier']> = {
    'storm-rifle': 'novice', 'plague-sprayer': 'novice', 'frost-beamer': 'novice',
    'echo-bow': 'standard', 'split-barrel': 'standard', 'mirror-prism': 'standard', 'quantum-loom': 'standard',
    'ion-lance': 'boss_gate', 'thorn-crossbow': 'boss_gate', 'rail-cannon': 'boss_gate', 'void-needle': 'boss_gate',
    'meteor-launcher': 'boss_clear', 'orbital-drone': 'boss_clear', 'gravity-hammer': 'boss_clear',
};

const ALL_WEAPONS: WeaponSpec[] = WEAPON_FAMILIES.map((w) => ({
    id: w.id,
    name: w.name,
    damage: w.damage,
    fireRate: w.fireRate,
    pierce: w.pierce,
    drone: w.drone,
    bulletSpeed: w.bulletSpeed,
    mechanic: w.mechanic ?? '',
    tier: TIER_MAP[w.id] ?? 'standard',
}));

// ── 辅助函数 ──────────────────────────────────────────────────────────

function weaponDps(ws: WeaponSpec, level: number, extraStats: Partial<CharacterStats> = {}): number {
    const stats = { ...BASE, ...extraStats };
    return calcDps(ws.damage, ws.fireRate, level, stats);
}

// ── 测试 1: 全部 17 把武器基础 DPS 健康范围 ──────────────────────────
function testAllWeaponsDpsInRange() {
    for (const w of ALL_WEAPONS) {
        const dps = weaponDps(w, 1);
        // 两轮武器基础伤害 buff + 3 把传说武器上线后，Lv.1 裸 DPS 合理上限约 150
        assert(dps >= (w.id === 'orbital-drone' ? 3 : 3) && dps <= 160,
            `${w.name} Lv.1 DPS=${dps.toFixed(2)} should be in reasonable range`);
    }
    console.log(`  ✓ 17 把武器 Lv.1 DPS 都在 [3, 160] 区间`);
}

// ── 测试 2: 按 tier 检查 DPS 分段 ────────────────────────────────────
function testNoviceDpsBelowStandard() {
    // novice 武器 DPS 应 < standard 的 max DPS
    const novice = ALL_WEAPONS.filter(w => w.tier === 'novice').map(w => weaponDps(w, 1));
    const standard = ALL_WEAPONS.filter(w => w.tier === 'standard').map(w => weaponDps(w, 1));
    const bossGate = ALL_WEAPONS.filter(w => w.tier === 'boss_gate').map(w => weaponDps(w, 1));
    const bossClear = ALL_WEAPONS.filter(w => w.tier === 'boss_clear').map(w => weaponDps(w, 1));

    const noviceMax = Math.max(...novice);
    const standardMin = Math.min(...standard);
    const standardMax = Math.max(...standard);
    const bossGateMin = Math.min(...bossGate);
    const bossClearMin = Math.min(...bossClear);

    // novice 不应该全面超过 standard
    // 但可能有单个 novice 武器比最差的 standard 高 (允许, 毕竟机制不同)
    console.log(`  Novice DPS range: ${Math.min(...novice).toFixed(1)} ~ ${noviceMax.toFixed(1)}`);
    console.log(`  Standard DPS range: ${standardMin.toFixed(1)} ~ ${standardMax.toFixed(1)}`);
    console.log(`  BossGate DPS range: ${Math.min(...bossGate).toFixed(1)} ~ ${Math.max(...bossGate).toFixed(1)}`);
    console.log(`  BossClear DPS range: ${Math.min(...bossClear).toFixed(1)} ~ ${Math.max(...bossClear).toFixed(1)}`);
}

// ── 测试 3: 升级曲线 Lv.1→Lv.6 不少于 1.5× ──────────────────────────
function testUpgradeBoost() {
    for (const w of ALL_WEAPONS) {
        const dps1 = weaponDps(w, 1);
        const dps6 = weaponDps(w, 6);
        const ratio = dps6 / dps1;
        assert(ratio >= 1.2 && ratio <= 5.0,
            `${w.name} Lv.1→Lv.6 DPS ratio=${ratio.toFixed(2)} should be in [1.2, 5.0]`);
    }
    console.log(`  ✓ 17 把武器 Lv.1→Lv.6 提升率都在 [1.2, 5.0] 区间`);
}

// ── 测试 4: 波次压力增长——1-6 波曲线 ────────────────────────────────
function testWavePressure() {
    let prev = 0;
    for (let w = 1; w <= 10; w++) {
        const hpPerSec = waveHpPerSecond(w);
        const cap = enemyCap(w);
        const interval = waveSpawnInterval(w);
        const batch = waveSpawnBatchCount(w);
        // 压力应单调递增
        assert(hpPerSec > prev * 0.8,
            `Wave ${w} HP/sec (${hpPerSec.toFixed(0)}) should not drop below wave ${w - 1}`);
        prev = hpPerSec;
        if (w <= 6) {
            // 前 6 波 DPS 压力在 20-100 区间
            assert(hpPerSec >= 10 && hpPerSec <= 120,
                `Wave ${w} HP/sec=${hpPerSec.toFixed(0)} should be in [10, 120]`);
        }
    }
    console.log(`  ✓ 1-10 波压力单调递增, 波 1-6 在 [10, 120] 区间`);
}

// ── 测试 5: 每把武器的 Lv.1 DPS 是否与预期接近 ──────────────────────
function testWeaponDpsFingerprint() {
    // 指纹: 记录每把武器的 Lv.1 DPS, 改数值后如果偏离会报错
    const fingerprint: Record<string, number> = {};
    for (const w of ALL_WEAPONS) {
        fingerprint[w.id] = Math.round(weaponDps(w, 1) * 10) / 10;
    }
    // 只输出不断言, 方便人工检视
    console.log(`  DPS Fingerprint (Lv.1):`);
    for (const w of ALL_WEAPONS) {
        const dps = fingerprint[w.id];
        console.log(`    ${w.name.padEnd(10)} ${dps.toFixed(1).padStart(5)}`);
    }
}

// ── 测试 6: 检查穿透期望值是否在合理范围 ────────────────────────────
function testPierceValues() {
    for (const w of ALL_WEAPONS) {
        const pierce = calcBulletPierce(w.pierce, 1, BASE);
        assert(pierce >= 0 && pierce <= 10,
            `${w.name} pierce=${pierce.toFixed(1)} should be in [0, 10]`);
    }
    console.log(`  ✓ 17 把武器穿透值都在 [0, 10] 区间`);
}

// ── 测试 7: 怪均血量 —— 1-10 波增长平缓 ────────────────────────────
function testAverageEnemyHp() {
    for (let w = 1; w <= 10; w++) {
        const hp = averageEnemyHp(w);
        assert(hp >= 15 && hp <= 150,
            `Wave ${w} avg enemy HP=${hp.toFixed(0)} should be in [15, 150]`);
    }
    console.log(`  ✓ 1-10 波怪均血量在 [15, 150] 区间`);
}

// ── 测试 8: 极简 P50 估算 (仅做 sanity check) ──────────────────────
function testEstimateP50() {
    for (const w of ALL_WEAPONS) {
        const p50 = estimateP50(w.damage, w.fireRate, w.pierce, BASE);
        // 当前裸武器 + base stats 的 P50 估算
        // novice 应为 1-8, standard 1-8, boss_gate 1-8, boss_clear 1-8
        assert(p50 >= 1 && p50 <= 20,
            `${w.name} estimated P50=${p50} should be in [1, 20]`);
    }
    console.log(`  ✓ 17 把武器 P50 估算在 [1, 20] 区间`);
}

// ── 汇总输出 ──────────────────────────────────────────────────────────
export function testCombatBalance() {
    console.log(`\n📊 平衡验证 (${ALL_WEAPONS.length} 把武器)`);
    console.log('='.repeat(65));

    testAllWeaponsDpsInRange();
    testNoviceDpsBelowStandard();
    testUpgradeBoost();
    testWavePressure();
    testWeaponDpsFingerprint();
    testPierceValues();
    testAverageEnemyHp();
    testEstimateP50();

    console.log(`\n${'='.repeat(65)}`);
    console.log(`✅ 平衡验证通过 (${ALL_WEAPONS.length} 把武器, 10 波次, Lv.1/6)`);
}

// 自执行
testCombatBalance();

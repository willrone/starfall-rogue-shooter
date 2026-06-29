/**
 * Combat formula pure functions.
 *
 * All formulas that determine bullet damage, fire interval, pierce,
 * enemy wave generation, etc.  No Cocos runtime dependencies —
 * import this module in tests and in the game runtime.
 *
 * Source of truth: projectileManager.ts getBulletDamage/getFireInterval/…
 *                 enemyManager.ts   getWaveSpawnInterval/…
 *                 enemyConstants.ts
 * Last synced: 2026-06-28
 */

import type { CharacterStats } from './types';
import { createBaseCharacterStats } from './stats';

// ═══════════════════════════════════════════════════════════════════════
// Weapon stat growth (每级成长率)
// ═══════════════════════════════════════════════════════════════════════

export function weaponDamageAtLevel(base: number, level: number): number {
    return base * (1 + (level - 1) * 0.12);
}

export function weaponFireRateAtLevel(base: number, level: number): number {
    return base * (1 + (level - 1) * 0.10);
}

export function weaponPierceAtLevel(base: number, level: number): number {
    return base * (1 + (level - 1) * 0.10);
}

export function weaponBulletSpeedAtLevel(base: number, level: number): number {
    return base * (1 + (level - 1) * 0.08);
}

// ═══════════════════════════════════════════════════════════════════════
// Bullet damage / fire interval / pierce (纯函数版, 无 ctx.critStacks)
// ═══════════════════════════════════════════════════════════════════════

/** 计算单发子弹伤害 (不含机制加成) */
export function calcBulletDamage(
    weaponDamage: number,
    level: number,
    stats: CharacterStats,
): number {
    const base = weaponDamageAtLevel(weaponDamage, level)
        * Math.max(0.1, 1 + stats.weaponDamagePct);
    const baseAttackPower = createBaseCharacterStats().attackPower;
    const attackDelta = stats.attackPower - baseAttackPower;
    return Math.max(2, base + baseAttackPower * 0.15 + attackDelta);
}

/** 计算开火间隔 (秒) */
export function calcFireInterval(
    weaponFireRate: number,
    level: number,
    stats: CharacterStats,
    critStacks = 0,
): number {
    const critBoost = critStacks * 0.01;
    const baseRate = weaponFireRateAtLevel(weaponFireRate, level)
        * Math.max(0.1, 1 + stats.weaponFireRatePct + critBoost);
    return Math.max(0.07, 1 / Math.max(0.15, baseRate + stats.attackSpeed * 0.45));
}

/** 计算 DPS (不含机制/暴击/穿透加成) */
export function calcDps(
    weaponDamage: number,
    weaponFireRate: number,
    level: number,
    stats: CharacterStats,
    critStacks = 0,
): number {
    const dmg = calcBulletDamage(weaponDamage, level, stats);
    const interval = calcFireInterval(weaponFireRate, level, stats, critStacks);
    return dmg / interval;
}

/** 计算穿透个数 (含随机, 返回期望值) */
export function calcBulletPierce(
    weaponPierce: number,
    level: number,
    stats: CharacterStats,
): number {
    const base = weaponPierceAtLevel(weaponPierce, level);
    const total = base + stats.pierce;
    return total; // 期望值 = floor(total) + probability
}

/** 穿透伤害保留率 */
export function calcPierceDamageRetention(stats: CharacterStats): number {
    return Math.min(0.9, Math.max(0.35, 0.5 + stats.pierceDamagePct));
}

// ═══════════════════════════════════════════════════════════════════════
// Enemy wave generation (纯函数近似, 不含随机)
// ═══════════════════════════════════════════════════════════════════════

/** 生成间隔 (秒) */
export function waveSpawnInterval(wave: number, endlessCycle = 1): number {
    const slot = wave >= 11 ? 10 : ((wave - 1) % 10) + 1;
    const base = 1.62 - slot * 0.035 - (endlessCycle - 1) * 0.06;
    const earlyRelief = wave <= 1 ? 0.6 : wave === 2 ? 0.5 : wave === 3 ? 0.4
        : wave === 4 ? 0.3 : wave === 5 ? 0.2 : wave === 6 ? 0.1
            : wave >= 11 ? 0 : 0;
    const hardFloor = wave <= 1 ? 1.5 : wave === 2 ? 1.4 : wave === 3 ? 1.3
        : wave === 4 ? 1.2 : wave === 5 ? 1.1 : wave === 6 ? 1.0
            : wave <= 8 ? 0.95 : 0.95;
    // 无尽模式: 11 波起间隔指数缩短
    let interval = Math.max(hardFloor, base + earlyRelief);
    if (wave >= 11) {
        const endlessScale = Math.pow(1.05, wave - 10);
        interval = Math.max(0.5, (base + 0.2) / endlessScale);
    }
    return interval;
}

/** 每批生成数量 */
export function waveSpawnBatchCount(wave: number): number {
    if (wave <= 2) return 2;
    if (wave <= 4) return 3;
    if (wave <= 6) return 4;
    if (wave <= 10) return 5;
    // 无尽模式
    const endlessScale = Math.pow(1.05, wave - 10);
    return Math.min(60, Math.round(5 * endlessScale));
}

/** 场上限 */
export function enemyCap(wave: number): number {
    const caps: Record<number, number> = { 1: 40, 2: 55, 3: 75, 4: 95, 5: 130, 6: 170, 7: 200, 8: 240 };
    if (wave in caps) return caps[wave];
    if (wave >= 11) {
        const endlessScale = Math.pow(1.05, wave - 10);
        return Math.min(600, Math.round(168 * endlessScale));
    }
    return 240;
}

/** 波时长 (秒, 近似) */
export function waveDuration(_wave: number): number {
    return 55; // uniform(50, 60) → 近似 55
}

/**
 * 怪物在波中的平均基础 HP (不含缩放) — 按最常见怪估算
 * 1-2 波: 碎壳虫 18HP
 * 3-6 波: 碎壳虫+疾行体 20-30HP
 * 7+ 波: 更多种类
 */
function baseEnemyHp(wave: number): number {
    if (wave <= 2) return 18;
    if (wave <= 4) return 24;
    if (wave <= 6) return 32;
    if (wave <= 8) return 55;
    return 80;
}

/** 怪物 HP 缩放因子 */
export function enemyHpScale(wave: number, combatTime: number): number {
    return 1 + wave * 0.028 + combatTime * 0.0018;
}

/** 单个怪的平均血量 (在当前波中点) */
export function averageEnemyHp(wave: number): number {
    const midTime = waveDuration(wave) * 0.5;
    return baseEnemyHp(wave) * enemyHpScale(wave, midTime);
}

/**
 * 每波怪方 HP/秒 需求 —— 武器 DPS 需要高于此值才能清完当前波
 * 这只算"纯理论"值, 实际局内升级 + 机制 + 上限会修正
 */
export function waveHpPerSecond(wave: number): number {
    const interval = waveSpawnInterval(wave);
    const batch = waveSpawnBatchCount(wave);
    const rate = batch / interval;                  // 生成/秒
    const cap = enemyCap(wave);
    const dur = waveDuration(wave);
    const maxSpawned = rate * dur;
    const effectiveCount = Math.min(maxSpawned, cap);
    const avgHp = averageEnemyHp(wave);
    return (effectiveCount * avgHp) / dur;
}

/**
 * 怪方伤害/秒 (估算玩家受伤害)
 */
export function waveDmgPerSecond(wave: number): number {
    const interval = waveSpawnInterval(wave);
    const batch = waveSpawnBatchCount(wave);
    const rate = batch / interval;
    // avgDmg ≈ 所有怪平均攻击力 * 伤害缩放
    const baseDmg: Record<number, number> = { 1: 4, 2: 4.2, 3: 4.5, 4: 5, 5: 5.5, 6: 6, 7: 8, 8: 10, 9: 11, 10: 12 };
    const dmg = baseDmg[Math.min(wave, 10)] || 12;
    const scale = 1 + wave * 0.012;
    return rate * dmg * scale;
}

/**
 * 经验掉落/秒 (估算)
 */
export function waveXpPerSecond(wave: number): number {
    const interval = waveSpawnInterval(wave);
    const batch = waveSpawnBatchCount(wave);
    const rate = batch / interval;
    const baseXp: Record<number, number> = { 1: 2, 2: 2, 3: 2.5, 4: 2.5, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8 };
    const xp = baseXp[Math.min(wave, 10)] || 8;
    const dropChance = 0.56;
    const xpMult = 2.6;
    return rate * xp * dropChance * xpMult;
}

// ═══════════════════════════════════════════════════════════════════════
// 简化 P50 估算 (不精确, 仅用于初步调参)
// ═══════════════════════════════════════════════════════════════════════

/** 估算裸武器 (无局内升级) 的 P50 */
export function estimateP50(
    weaponDamage: number,
    weaponFireRate: number,
    weaponPierce: number,
    stats: CharacterStats,
): number {
    const dps = calcDps(weaponDamage, weaponFireRate, 1, stats);
    const hpPerKill = averageEnemyHp(1); // 初期怪
    const killsPerSecond = dps / hpPerKill;
    const xpPerKill = 2; // 初期
    const xpPerSecond = killsPerSecond * xpPerKill * 0.56 * 2.6;
    const xpToNext = 65 * 1.24 + 22 + 1 * 5; // Lv.0→1
    const secondsToLevel2 = xpToNext / Math.max(0.1, xpPerSecond);

    // 极简: 你每秒杀多少怪, 能扛到第几波
    for (let w = 1; w <= 20; w++) {
        const demand = waveHpPerSecond(w);
        if (dps * 1.5 < demand) { // * 1.5 假设局内升级累积
            return w;
        }
    }
    return 20;
}

// DPS 对比：波10各阶段
import { createBaseCharacterStats } from '../../assets/scripts/core/stats';
import { calcDps } from '../../assets/scripts/core/combatFormulas';
import { WEAPON_FAMILIES } from '../../assets/scripts/catalogs/weaponCatalog';
import type { CharacterStats } from '../../assets/scripts/core/types';

const BASE = createBaseCharacterStats();

// 场景1: Lv.1 裸体
const sBase: CharacterStats = { ...BASE };

// 场景2: Lv.8 中等运气（7次升级）
const sMid: CharacterStats = {
    ...BASE,
    attackPower: 16 + 11,
    attackSpeed: 0 + 0.11,
    maxHp: 180 + 45,
    damageReduction: 0 + 0.02,
    dronePower: 0 + 1.2,
};

// 场景3: Lv.12 巅峰（11次升级 + 3件攻击道具）
const sPeak: CharacterStats = {
    ...BASE,
    attackPower: 16 + 18,
    attackSpeed: 0 + 0.18,
    maxHp: 180 + 80,
    damageReduction: 0 + 0.045,
    dronePower: 0 + 2.4,
    weaponDamagePct: 0.85,
    weaponFireRatePct: 1.05,
    critChance: 0.10,
    critDamage: 0.40,
};

// 场景4: Lv.13 毕业（装备齐）
const sGod: CharacterStats = {
    ...BASE,
    attackPower: 16 + 22,
    attackSpeed: 0 + 0.12,
    maxHp: 180 + 148,
    damageReduction: 0 + 0.115,
    dronePower: 0 + 1.8,
    weaponDamagePct: 1.00,
    weaponFireRatePct: 1.23,
    critChance: 0.15,
    critDamage: 0.40,
};

interface W {
    name: string; dmg: number; fr: number;
}
const weapons: W[] = WEAPON_FAMILIES.map(w => ({
    name: w.name, dmg: w.damage, fr: w.fireRate
}));

function h(v: number) { return v.toFixed(1).padStart(7); }

console.log('');
console.log('='.repeat(95));
console.log('  DPS 对比表：起步 Lv.1 → 波10各阶段 (weaponLevel=1, 含道具+升级)');
console.log('='.repeat(95));
console.log('');
console.log(`  ${'武器'.padEnd(12)} ${'裸体'.padEnd(8)} ${'Lv.8升级'.padEnd(10)} ${'Lv.12巅峰'.padEnd(12)} ${'Lv.13毕业'.padEnd(12)} ${'增长倍率'}`);
console.log('  ' + '-'.repeat(90));

for (const w of weapons) {
    const b  = calcDps(w.dmg, w.fr, 1, sBase);
    const m  = calcDps(w.dmg, w.fr, 1, sMid);
    const p  = calcDps(w.dmg, w.fr, 1, sPeak);
    const g  = calcDps(w.dmg, w.fr, 1, sGod);
    const r  = (g / b).toFixed(1);
    console.log(`  ${w.name.padEnd(12)} ${h(b)} ${h(m)} ${h(p)} ${h(g)}  ${r.padStart(4)}x`);
}

// 怪物方需求
import { waveHpPerSecond, averageEnemyHp, enemyHpScale } from '../../assets/scripts/core/combatFormulas';
console.log('');
console.log('  --- 波次压力参考 ---');
for (let w = 1; w <= 12; w++) {
    const hpSec = waveHpPerSecond(w);
    const avgHp = averageEnemyHp(w);
    console.log(`  波 ${w.toString().padStart(2)}: HP/sec需求=${hpSec.toFixed(0)}  怪均HP=${avgHp.toFixed(0)}`);
}

// Boss 血量
const bossWave10 = 10;
const bossBaseHp = 800;
const hpScale = 1 + bossWave10 * 0.028 + 550 * 0.0018; // ~550s at wave 10
const bossActualHp = Math.round(bossBaseHp * hpScale);
console.log('');
console.log(`  --- 波10 Boss(虚空巨像) ---`);
console.log(`  基础HP: 800  缩放因子: ${hpScale.toFixed(2)}`);
console.log(`  实际HP: ~${bossActualHp}`);
console.log(`  Lv.12巅峰DPS范围: ${calcDps(4.5, 1.12, 1, sPeak).toFixed(0)}~${calcDps(22, 1.8, 1, sPeak).toFixed(0)}`);
console.log(`  Boss击杀时间(裂变枪管): ${(bossActualHp / calcDps(7.5, 1.85, 1, sPeak)).toFixed(0)}s`);

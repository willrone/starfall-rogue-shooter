import type { CharacterStats, StatKey } from './types';

export type StatKind = 'number' | 'percent' | 'multiplier';

export interface StatMeta {
    name: string;
    kind: StatKind;
}

export const STAT_META: Record<StatKey, StatMeta> = {
    attackPower: { name: '攻击力', kind: 'number' },
    attackSpeed: { name: '攻击速度', kind: 'percent' },
    attackRange: { name: '攻击距离', kind: 'number' },
    critChance: { name: '暴击率', kind: 'percent' },
    critDamage: { name: '暴击伤害', kind: 'multiplier' },
    lethalChance: { name: '致命几率', kind: 'percent' },
    lethalDamage: { name: '致命伤害', kind: 'multiplier' },
    lethalMaxHpPct: { name: '致命生命斩杀', kind: 'percent' },
    bulletSpeed: { name: '弹速', kind: 'number' },
    pierce: { name: '穿透个数', kind: 'number' },
    pierceDamagePct: { name: '穿透伤害', kind: 'percent' },
    weaponDamagePct: { name: '武器伤害加成', kind: 'percent' },
    weaponFireRatePct: { name: '武器射速加成', kind: 'percent' },
    dronePower: { name: '无人机强度', kind: 'number' },
    physicalDefense: { name: '物理防御', kind: 'number' },
    magicDefense: { name: '魔法防御', kind: 'number' },
    fireDefense: { name: '火防', kind: 'number' },
    lightningDefense: { name: '雷防', kind: 'number' },
    poisonDefense: { name: '毒防', kind: 'number' },
    iceDefense: { name: '冰防', kind: 'number' },
    maxHp: { name: '生命值', kind: 'number' },
    shieldMax: { name: '护盾值', kind: 'number' },
    shieldRegen: { name: '护盾回复', kind: 'number' },
    hpRegen: { name: '生命恢复', kind: 'number' },
    damageReduction: { name: '全减伤', kind: 'percent' },
    dodgeChance: { name: '闪避率', kind: 'percent' },
    moveSpeed: { name: '移动速度', kind: 'number' },
    pickupRange: { name: '拾取范围', kind: 'number' },
    luck: { name: '幸运值', kind: 'number' },
    xpGain: { name: '经验收益', kind: 'percent' },
    resourceGain: { name: '资源收益', kind: 'percent' },
};

export function createEmptyCharacterStats(): CharacterStats {
    return {
        attackPower: 0,
        attackSpeed: 0,
        attackRange: 0,
        critChance: 0,
        critDamage: 0,
        lethalChance: 0,
        lethalDamage: 0,
        lethalMaxHpPct: 0,
        bulletSpeed: 0,
        pierce: 0,
        pierceDamagePct: 0,
        weaponDamagePct: 0,
        weaponFireRatePct: 0,
        dronePower: 0,
        physicalDefense: 0,
        magicDefense: 0,
        fireDefense: 0,
        lightningDefense: 0,
        poisonDefense: 0,
        iceDefense: 0,
        maxHp: 0,
        shieldMax: 0,
        shieldRegen: 0,
        hpRegen: 0,
        damageReduction: 0,
        dodgeChance: 0,
        moveSpeed: 0,
        pickupRange: 0,
        luck: 0,
        xpGain: 0,
        resourceGain: 0,
    };
}

export function createBaseCharacterStats(): CharacterStats {
    return {
        attackPower: 16,
        attackSpeed: 0,
        attackRange: 760,
        critChance: 0.05,
        critDamage: 2,
        lethalChance: 0.006,
        lethalDamage: 2.75,
        lethalMaxHpPct: 0.05,
        bulletSpeed: 620,
        pierce: 0,
        pierceDamagePct: 0,
        weaponDamagePct: 0,
        weaponFireRatePct: 0,
        dronePower: 0,
        physicalDefense: 4,
        magicDefense: 2,
        fireDefense: 0,
        lightningDefense: 0,
        poisonDefense: 0,
        iceDefense: 0,
        maxHp: 180,
        shieldMax: 24,
        shieldRegen: 1.8,
        hpRegen: 0,
        damageReduction: 0,
        dodgeChance: 0.03,
        moveSpeed: 238,
        pickupRange: 82,
        luck: 0,
        xpGain: 0,
        resourceGain: 0,
    };
}

export function addCharacterStats(target: CharacterStats, source: CharacterStats): CharacterStats {
    const result: CharacterStats = { ...target };
    for (const key of Object.keys(result) as StatKey[]) {
        result[key] += source[key];
    }
    return result;
}

export function formatStat(key: StatKey, value: number): string {
    const meta = STAT_META[key];
    const sign = value >= 0 ? '+' : '';
    switch (meta.kind) {
        case 'percent':
            return `${sign}${(value * 100).toFixed(1)}%`;
        case 'multiplier':
            return `${sign}${value.toFixed(2)}`;
        case 'number':
        default:
            return `${sign}${value}`;
    }
}

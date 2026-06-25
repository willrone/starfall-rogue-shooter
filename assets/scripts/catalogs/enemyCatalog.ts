import type { EnemySpec } from '../core/types';

export const BASE_ENEMY_ARCHETYPES: EnemySpec[] = [
    {
        id: 'mite',
        name: '碎壳虫',
        family: 'mite',
        artId: 'mite',
        hp: 18,
        speed: 126,
        damage: 4,
        radius: 13,
        xp: 2,
        alloyChance: 0.05,
        color: '#9BE564',
        accent: '#31572C',
        spawnAfter: 0,
        weight: 7,
    },
    {
        id: 'runner',
        name: '疾行体',
        family: 'runner',
        artId: 'runner',
        hp: 24,
        speed: 196,
        damage: 6,
        radius: 12,
        xp: 3,
        alloyChance: 0.08,
        color: '#4CC9F0',
        accent: '#1B4965',
        spawnAfter: 10,
        weight: 4,
    },
    {
        id: 'brute',
        name: '重甲块',
        family: 'brute',
        artId: 'brute',
        hp: 88,
        speed: 78,
        damage: 10,
        radius: 22,
        xp: 8,
        alloyChance: 0.22,
        color: '#F9C74F',
        accent: '#8A5A00',
        spawnAfter: 18,
        weight: 3,
    },
    {
        id: 'splitter',
        name: '裂变囊',
        family: 'splitter',
        artId: 'splitter',
        hp: 54,
        speed: 112,
        damage: 7,
        radius: 18,
        xp: 6,
        alloyChance: 0.16,
        color: '#F15BB5',
        accent: '#6A0572',
        spawnAfter: 28,
        weight: 3,
    },
    {
        id: 'warden',
        name: '磁暴卫士',
        family: 'warden',
        artId: 'warden',
        hp: 160,
        speed: 92,
        damage: 15,
        radius: 26,
        xp: 13,
        alloyChance: 0.35,
        color: '#F3722C',
        accent: '#6B240C',
        spawnAfter: 46,
        weight: 2,
    },
];

export interface EnemyVariantDef {
    id: string;
    prefix: string;
    hp: number;
    speed: number;
    damage: number;
    radius: number;
    xp: number;
    alloy: number;
    spawn: number;
    weight: number;
}

export const ENEMY_VARIANTS: EnemyVariantDef[] = [
    { id: '', prefix: '', hp: 1, speed: 1, damage: 1, radius: 1, xp: 1, alloy: 1, spawn: 0, weight: 1 },
    { id: 'acid', prefix: '腐蚀', hp: 1.12, speed: 0.96, damage: 1.18, radius: 1, xp: 1.12, alloy: 1.2, spawn: 6, weight: 0.86 },
    { id: 'crystal', prefix: '晶化', hp: 1.38, speed: 0.88, damage: 1.08, radius: 1.05, xp: 1.24, alloy: 1.35, spawn: 10, weight: 0.78 },
    { id: 'swift', prefix: '迅捷', hp: 0.82, speed: 1.34, damage: 1.06, radius: 0.94, xp: 1.16, alloy: 1.05, spawn: 14, weight: 0.82 },
    { id: 'armored', prefix: '装甲', hp: 1.72, speed: 0.78, damage: 1.12, radius: 1.08, xp: 1.42, alloy: 1.55, spawn: 22, weight: 0.58 },
    { id: 'rage', prefix: '暴怒', hp: 1.18, speed: 1.16, damage: 1.42, radius: 1.02, xp: 1.32, alloy: 1.3, spawn: 30, weight: 0.52 },
    { id: 'shade', prefix: '幽影', hp: 0.94, speed: 1.22, damage: 1.22, radius: 0.9, xp: 1.28, alloy: 1.24, spawn: 38, weight: 0.48 },
    { id: 'arc', prefix: '电弧', hp: 1.24, speed: 1.08, damage: 1.32, radius: 1, xp: 1.44, alloy: 1.42, spawn: 48, weight: 0.42 },
    { id: 'regen', prefix: '再生', hp: 1.58, speed: 0.94, damage: 1.18, radius: 1.04, xp: 1.5, alloy: 1.48, spawn: 58, weight: 0.36 },
    { id: 'venom', prefix: '剧毒', hp: 1.3, speed: 1.06, damage: 1.58, radius: 1, xp: 1.62, alloy: 1.58, spawn: 68, weight: 0.3 },
    { id: 'prime', prefix: '原初', hp: 2.1, speed: 1.05, damage: 1.85, radius: 1.16, xp: 2.05, alloy: 2.1, spawn: 78, weight: 0.22 },
];

export function buildEnemyCatalog(): EnemySpec[] {
    const enemies: EnemySpec[] = [];
    for (const base of BASE_ENEMY_ARCHETYPES) {
        for (let variantIndex = 0; variantIndex < ENEMY_VARIANTS.length; variantIndex++) {
            const variant = ENEMY_VARIANTS[variantIndex];
            const suffix = variant.id ? `-${variant.id}` : '';
            enemies.push({
                ...base,
                id: `${base.id}${suffix}`,
                name: `${variant.prefix}${base.name}`,
                variantId: variant.id || 'base',
                variantIndex,
                hp: Math.round(base.hp * variant.hp),
                speed: Math.round(base.speed * variant.speed),
                damage: Math.max(2, Math.round(base.damage * variant.damage)),
                radius: Math.max(9, Math.round(base.radius * variant.radius)),
                xp: Math.max(1, Math.round(base.xp * variant.xp)),
                alloyChance: Math.min(0.85, Number((base.alloyChance * variant.alloy).toFixed(3))),
                spawnAfter: base.spawnAfter + variant.spawn,
                weight: Number(Math.max(0.12, base.weight * variant.weight).toFixed(2)),
            });
        }
    }
    return enemies;
}

export const ENEMY_SPECS: EnemySpec[] = buildEnemyCatalog();
export const BOSS_ENEMY_COUNT = 1;
export const TOTAL_ENEMY_TYPES = ENEMY_SPECS.length + BOSS_ENEMY_COUNT;

import type { EquipmentDef, EquipmentRarity, WeaponAttackStyle } from '../core/types';

export interface WeaponFamily {
    id: string;
    name: string;
    color: string;
    damage: number;
    fireRate: number;
    pierce: number;
    drone: number;
    bulletSpeed: number;
    desc: string;
    mechanic?: string;
}

export interface WeaponVariant {
    id: string;
    prefix: string;
    suffix: string;
    tier: number;
    damage: number;
    fireRate: number;
    pierce: number;
    drone: number;
    speed: number;
    cost: number;
}

export const WEAPON_FAMILIES: WeaponFamily[] = [
    // ── Novice (3 把) ─────────────────────────────
    { id: 'storm-rifle', name: '风暴步枪', color: '#4CC9F0', damage: 4.6, fireRate: 1.36, pierce: 0.0, drone: 0.0, bulletSpeed: 1.0, mechanic: 'crit_stacks', desc: '均衡型入门武器。暴击时叠加攻速, 5 层封顶。' },
    { id: 'plague-sprayer', name: '瘟疫喷射器', color: '#84CC16', damage: 1.1, fireRate: 3.18, pierce: 0.0, drone: 0.0, bulletSpeed: 0.8, mechanic: 'poison', desc: '机关枪型毒液喷射, 命中叠 5 层毒 (每层 0.4% HP/秒流失)。' },
    { id: 'frost-beamer', name: '霜束发射器', color: '#A7F3D0', damage: 2.2, fireRate: 2.55, pierce: 0.3, drone: 0.0, bulletSpeed: 1.4, mechanic: 'slow', desc: '高频冰弹, 命中减速目标 0.4 秒。' },

    // ── Standard (4 把) ─────────────────────────────
    { id: 'echo-bow', name: '回声弓', color: '#38BDF8', damage: 6.1, fireRate: 1.18, pierce: 1.0, drone: 0.0, bulletSpeed: 1.7, mechanic: 'pierce_stacks', desc: '暴击时穿透 +1, 适合打直线敌群。' },
    { id: 'split-barrel', name: '裂变枪管', color: '#F15BB5', damage: 3.1, fireRate: 2.09, pierce: 0.4, drone: 0.0, bulletSpeed: 1.2, mechanic: 'multishot_3', desc: '每次射击同时 3 颗扇形分布, 适合清群。' },
    { id: 'mirror-prism', name: '镜像棱镜', color: '#E879F9', damage: 4.3, fireRate: 1.27, pierce: 0.3, drone: 0.3, bulletSpeed: 1.0, mechanic: 'radial_5', desc: '5 颗 360° 全方向散射, 清屏型武器。' },
    { id: 'quantum-loom', name: '量子织机', color: '#14B8A6', damage: 6.6, fireRate: 1.09, pierce: 0.6, drone: 0.4, bulletSpeed: 1.0, mechanic: 'split', desc: '子弹飞行 0.5 秒后分裂成 2 颗, 范围自动扩散。' },

    // ── Boss Gate (4 把) ─────────────────────────────
    { id: 'ion-lance', name: '离子长枪', color: '#43AA8B', damage: 13.2, fireRate: 0.77, pierce: 1.5, drone: 0.0, bulletSpeed: 1.8, mechanic: 'straight', desc: '笔直弹道, 远距离命中不衰减。' },
    { id: 'thorn-crossbow', name: '荆棘连弩', color: '#65A30D', damage: 6.6, fireRate: 1.64, pierce: 0.6, drone: 0.0, bulletSpeed: 1.6, mechanic: 'ricochet', desc: '子弹撞墙反弹 2 次, 死角反杀。' },
    { id: 'rail-cannon', name: '磁轨炮', color: '#577590', damage: 15.6, fireRate: 0.64, pierce: 3.5, drone: 0.0, bulletSpeed: 2.5, mechanic: 'pierce_bonus', desc: '高速穿透, 每次穿透下次伤害 +8% (可叠加)。' },
    { id: 'void-needle', name: '虚空针', color: '#B5179E', damage: 10.1, fireRate: 1.05, pierce: 1.2, drone: 0.0, bulletSpeed: 2.0, mechanic: 'crit_master', desc: '高暴击率+暴击伤害, 适合打 Boss。' },

    // ── Boss Clear (3 把) ─────────────────────────────
    { id: 'meteor-launcher', name: '流星发射器', color: '#EF4444', damage: 24.0, fireRate: 0.55, pierce: 1.0, drone: 0.0, bulletSpeed: 1.3, mechanic: 'aoe_burn', desc: '命中留下 3 秒燃烧区 (每秒 12% 攻击力的持续伤害)。' },
    { id: 'orbital-drone', name: '轨道无人机', color: '#90BE6D', damage: 4.8, fireRate: 0.36, pierce: 0.0, drone: 2.8, bulletSpeed: 0.0, mechanic: 'drone_charge', desc: '击杀充能, 满 100% 召唤 1 个爆炸无人机。' },
    { id: 'gravity-hammer', name: '重力锤', color: '#64748B', damage: 34.9, fireRate: 0.3, pierce: 1.0, drone: 0.5, bulletSpeed: 0.7, mechanic: 'knockback', desc: '极慢射重击, 命中强力击退, 暴击 2 倍击退。' },
];

export const WEAPON_VARIANTS: WeaponVariant[] = [
    { id: '', prefix: '', suffix: '', tier: 1, damage: 1, fireRate: 1, pierce: 1, drone: 1, speed: 1, cost: 1 },
    { id: 'light', prefix: '轻型', suffix: '', tier: 2, damage: 0.86, fireRate: 1.22, pierce: 0.8, drone: 0.9, speed: 1.16, cost: 1.08 },
    { id: 'pulse', prefix: '脉冲', suffix: '', tier: 3, damage: 1.14, fireRate: 1.12, pierce: 1, drone: 1, speed: 1.1, cost: 1.18 },
    { id: 'accurate', prefix: '精准', suffix: '', tier: 4, damage: 1.22, fireRate: 0.92, pierce: 1.12, drone: 0.9, speed: 1.24, cost: 1.28 },
    { id: 'heavy', prefix: '重载', suffix: '', tier: 5, damage: 1.48, fireRate: 0.72, pierce: 1.18, drone: 0.85, speed: 0.92, cost: 1.42 },
    { id: 'rapid', prefix: '连射', suffix: '', tier: 6, damage: 0.94, fireRate: 1.55, pierce: 0.88, drone: 0.95, speed: 1.08, cost: 1.55 },
    { id: 'piercing', prefix: '穿甲', suffix: '', tier: 7, damage: 1.18, fireRate: 0.96, pierce: 1.75, drone: 0.9, speed: 1.02, cost: 1.72 },
    { id: 'overclock', prefix: '超频', suffix: '', tier: 8, damage: 1.22, fireRate: 1.36, pierce: 1.1, drone: 1.18, speed: 1.18, cost: 1.9 },
    { id: 'resonance', prefix: '共振', suffix: '', tier: 9, damage: 1.36, fireRate: 1.08, pierce: 1.3, drone: 1.28, speed: 1.04, cost: 2.1 },
    { id: 'starfall', prefix: '星陨', suffix: '', tier: 10, damage: 1.68, fireRate: 1.18, pierce: 1.55, drone: 1.42, speed: 1.2, cost: 2.35 },
];

export function getEquipmentRarityForTier(tier: number): EquipmentRarity {
    if (tier >= 10) return '神话';
    if (tier >= 8) return '传奇';
    if (tier >= 5) return '史诗';
    if (tier >= 3) return '稀有';
    return '普通';
}

export function getRarityCostMultiplier(rarity: EquipmentRarity) {
    switch (rarity) {
        case '神话': return 1.85;
        case '传奇': return 1.55;
        case '史诗': return 1.28;
        case '稀有': return 1.12;
        default: return 1;
    }
}

export function getWeaponAttackStyle(familyId: string): WeaponAttackStyle {
    switch (familyId) {
        case 'split-barrel':
        case 'nova-shotgun':
            return 'shotgun';
        case 'rail-cannon':
        case 'ion-lance':
        case 'void-needle':
            return 'rail';
        case 'orbital-drone':
            return 'drone';
        case 'frost-beamer':
            return 'laser';
        case 'sun-disc':
            return 'disc';
        case 'plague-sprayer':
            return 'spray';
        case 'meteor-launcher':
        case 'gravity-hammer':
            return 'meteor';
        case 'pulse-fan':
            return 'pulse';
        case 'thorn-chain':
            return 'chain';
        case 'star-scythe':
            return 'scythe';
        case 'echo-bow':
        case 'mirror-prism':
            return 'ricochet';
        default:
            return 'rifle';
    }
}

export function getWeaponStyleName(style: WeaponAttackStyle) {
    switch (style) {
        case 'shotgun': return '近距宽弹道';
        case 'rail': return '高速穿透';
        case 'laser': return '光束锁定';
        case 'chain': return '链式跳跃';
        case 'pulse': return '扇形脉冲';
        case 'drone': return '无人机电击';
        case 'disc': return '旋转飞盘';
        case 'spray': return '喷射覆盖';
        case 'meteor': return '重型爆发';
        case 'ricochet': return '弹射折返';
        case 'scythe': return '成长镰刃';
        default: return '标准弹道';
    }
}

export function getWeaponFamilyId(id: string): string {
    for (const family of WEAPON_FAMILIES) {
        if (id.startsWith(family.id)) return family.id;
    }
    return 'storm-rifle';
}

export function getWeaponVariantId(id: string): string {
    const familyId = getWeaponFamilyId(id);
    const suffix = id.slice(familyId.length);
    if (suffix === '' || suffix === '-standard') return '';
    const variantId = suffix.startsWith('-') ? suffix.slice(1) : suffix;
    return WEAPON_VARIANTS.some((variant) => variant.id === variantId) ? variantId : '';
}

export function getWeaponTierForId(id: string): number {
    const variantId = getWeaponVariantId(id);
    const variant = WEAPON_VARIANTS.find((candidate) => candidate.id === variantId);
    return variant ? variant.tier : 1;
}

export function buildWeaponCatalog(): EquipmentDef[] {
    const weapons: EquipmentDef[] = [];
    for (const family of WEAPON_FAMILIES) {
        for (const variant of WEAPON_VARIANTS) {
            const legacyIds = ['storm-rifle', 'split-barrel', 'orbital-drone'];
            const legacyId = variant.id === '' && legacyIds.indexOf(family.id) >= 0;
            const id = legacyId ? family.id : `${family.id}${variant.id ? `-${variant.id}` : '-standard'}`;
            const name = `${variant.prefix}${family.name}`;
            const attackStyle = getWeaponAttackStyle(family.id);
            const rarity = getEquipmentRarityForTier(variant.tier);
            weapons.push({
                id,
                name,
                kind: 'weapon',
                color: family.color,
                maxLevel: 6 + Math.ceil(variant.tier / 2),
                baseCost: Math.round(family.damage * 5 + variant.cost * 30 * getRarityCostMultiplier(rarity)),
                desc: `${family.desc} ${getWeaponStyleName(attackStyle)}，${rarity}品质 T${variant.tier} 型。`,
                attackStyle,
                rarity,
                weaponStats: {
                    damage: Number((family.damage * variant.damage).toFixed(2)),
                    fireRate: Number((family.fireRate * variant.fireRate).toFixed(2)),
                    pierce: Number((family.pierce * variant.pierce).toFixed(2)),
                    drone: Number((family.drone * variant.drone).toFixed(2)),
                    bulletSpeed: Number((family.bulletSpeed * variant.speed).toFixed(2)),
                },
            });
        }
    }
    return weapons;
}

export const WEAPON_CATALOG: EquipmentDef[] = buildWeaponCatalog();
export const WEAPON_COUNT = WEAPON_CATALOG.length;

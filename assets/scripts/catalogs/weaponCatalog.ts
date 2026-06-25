import type { EquipmentDef, EquipmentRarity, WeaponAttackStyle } from '../core/types';

export interface WeaponFamily {
    id: string;
    name: string;
    color: string;
    damage: number;
    fireRate: number;
    pierce: number;
    multiShot: number;
    drone: number;
    bulletSpeed: number;
    cost: number;
    desc: string;
}

export interface WeaponVariant {
    id: string;
    prefix: string;
    suffix: string;
    tier: number;
    damage: number;
    fireRate: number;
    pierce: number;
    multiShot: number;
    drone: number;
    speed: number;
    cost: number;
}

export const WEAPON_FAMILIES: WeaponFamily[] = [
    { id: 'storm-rifle', name: '风暴步枪', color: '#4CC9F0', damage: 4.5, fireRate: 1.12, pierce: 0, multiShot: 0, drone: 0, bulletSpeed: 1.1, cost: 38, desc: '稳定提升自动射击伤害和射速。' },
    { id: 'split-barrel', name: '裂变枪管', color: '#F15BB5', damage: 3.4, fireRate: 0.5, pierce: 0.9, multiShot: 1.25, drone: 0, bulletSpeed: 0.35, cost: 52, desc: '追加散射弹、分裂弹和穿透。' },
    { id: 'orbital-drone', name: '轨道无人机', color: '#90BE6D', damage: 1.6, fireRate: 0.18, pierce: 0, multiShot: 0, drone: 1.25, bulletSpeed: 0, cost: 58, desc: '自动电击附近怪物。' },
    { id: 'rail-cannon', name: '磁轨炮', color: '#577590', damage: 7.2, fireRate: 0.0, pierce: 1.1, multiShot: 0, drone: 0, bulletSpeed: 1.8, cost: 62, desc: '高伤害、高弹速、偏穿透。' },
    { id: 'nova-shotgun', name: '新星霰弹', color: '#F8961E', damage: 4.0, fireRate: 0.35, pierce: 0.2, multiShot: 1.65, drone: 0, bulletSpeed: 0.0, cost: 56, desc: '近距离多弹道爆发。' },
    { id: 'ion-lance', name: '离子长枪', color: '#43AA8B', damage: 5.5, fireRate: 0.35, pierce: 0.9, multiShot: 0.15, drone: 0, bulletSpeed: 1.4, cost: 60, desc: '稳定穿刺线性火力。' },
    { id: 'ember-smg', name: '余烬冲锋枪', color: '#F3722C', damage: 3.2, fireRate: 1.65, pierce: 0.15, multiShot: 0.45, drone: 0, bulletSpeed: 0.7, cost: 44, desc: '高速低伤弹幕。' },
    { id: 'frost-beamer', name: '霜束发射器', color: '#A7F3D0', damage: 4.2, fireRate: 0.82, pierce: 0.4, multiShot: 0.3, drone: 0.12, bulletSpeed: 0.8, cost: 50, desc: '均衡火力和控场弹速。' },
    { id: 'void-needle', name: '虚空针', color: '#B5179E', damage: 4.8, fireRate: 0.58, pierce: 1.35, multiShot: 0, drone: 0, bulletSpeed: 1.2, cost: 64, desc: '细小高穿透弹。' },
    { id: 'sun-disc', name: '日冕飞盘', color: '#F9C74F', damage: 4.2, fireRate: 0.38, pierce: 0.55, multiShot: 0.7, drone: 0.3, bulletSpeed: 0.4, cost: 54, desc: '旋转火力和少量无人支援。' },
    { id: 'echo-bow', name: '回声弓', color: '#38BDF8', damage: 4.6, fireRate: 0.72, pierce: 0.5, multiShot: 0.6, drone: 0, bulletSpeed: 1.0, cost: 48, desc: '中速多段弹道。' },
    { id: 'plague-sprayer', name: '瘟疫喷射器', color: '#84CC16', damage: 3.8, fireRate: 1.1, pierce: 0.25, multiShot: 0.85, drone: 0, bulletSpeed: 0.15, cost: 46, desc: '高频散射清群。' },
    { id: 'gravity-hammer', name: '重力锤', color: '#64748B', damage: 8.0, fireRate: -0.12, pierce: 0.6, multiShot: 0, drone: 0.15, bulletSpeed: -0.3, cost: 70, desc: '重型慢射高伤。' },
    { id: 'mirror-prism', name: '镜像棱镜', color: '#E879F9', damage: 3.4, fireRate: 0.72, pierce: 0.3, multiShot: 1.2, drone: 0.2, bulletSpeed: 0.6, cost: 56, desc: '镜像弹道数量成长。' },
    { id: 'meteor-launcher', name: '流星发射器', color: '#EF4444', damage: 7.0, fireRate: 0.15, pierce: 0.3, multiShot: 0.5, drone: 0, bulletSpeed: 0.25, cost: 66, desc: '重火力爆发武器。' },
    { id: 'pulse-fan', name: '脉冲扇', color: '#22D3EE', damage: 3.2, fireRate: 1.0, pierce: 0.2, multiShot: 1.05, drone: 0, bulletSpeed: 0.75, cost: 44, desc: '扇形覆盖和高速射击。' },
    { id: 'thorn-chain', name: '荆棘链', color: '#65A30D', damage: 3.9, fireRate: 0.42, pierce: 0.9, multiShot: 0.25, drone: 0.25, bulletSpeed: 0.45, cost: 52, desc: '穿透和链式辅助。' },
    { id: 'star-scythe', name: '星镰', color: '#C084FC', damage: 5.6, fireRate: 0.36, pierce: 0.75, multiShot: 0.45, drone: 0, bulletSpeed: 0.9, cost: 64, desc: '后期成长型穿刺武器。' },
    { id: 'quantum-loom', name: '量子织机', color: '#14B8A6', damage: 3.4, fireRate: 0.7, pierce: 0.45, multiShot: 0.7, drone: 0.35, bulletSpeed: 0.6, cost: 58, desc: '均衡弹幕与无人支援。' },
    { id: 'redline-carbine', name: '红线卡宾', color: '#FB7185', damage: 4.6, fireRate: 0.82, pierce: 0.35, multiShot: 0.25, drone: 0, bulletSpeed: 1.3, cost: 54, desc: '高速精准火力。' },
];

export const WEAPON_VARIANTS: WeaponVariant[] = [
    { id: '', prefix: '', suffix: '', tier: 1, damage: 1, fireRate: 1, pierce: 1, multiShot: 1, drone: 1, speed: 1, cost: 1 },
    { id: 'light', prefix: '轻型', suffix: '', tier: 2, damage: 0.86, fireRate: 1.22, pierce: 0.8, multiShot: 1.06, drone: 0.9, speed: 1.16, cost: 1.08 },
    { id: 'pulse', prefix: '脉冲', suffix: '', tier: 3, damage: 1.04, fireRate: 1.12, pierce: 1, multiShot: 1.1, drone: 1, speed: 1.1, cost: 1.18 },
    { id: 'accurate', prefix: '精准', suffix: '', tier: 4, damage: 1.22, fireRate: 0.92, pierce: 1.12, multiShot: 0.9, drone: 0.9, speed: 1.24, cost: 1.28 },
    { id: 'heavy', prefix: '重载', suffix: '', tier: 5, damage: 1.48, fireRate: 0.72, pierce: 1.18, multiShot: 0.84, drone: 0.85, speed: 0.92, cost: 1.42 },
    { id: 'rapid', prefix: '连射', suffix: '', tier: 6, damage: 0.94, fireRate: 1.55, pierce: 0.88, multiShot: 1.16, drone: 0.95, speed: 1.08, cost: 1.55 },
    { id: 'piercing', prefix: '穿甲', suffix: '', tier: 7, damage: 1.18, fireRate: 0.96, pierce: 1.75, multiShot: 0.95, drone: 0.9, speed: 1.02, cost: 1.72 },
    { id: 'overclock', prefix: '超频', suffix: '', tier: 8, damage: 1.22, fireRate: 1.36, pierce: 1.1, multiShot: 1.12, drone: 1.18, speed: 1.18, cost: 1.9 },
    { id: 'resonance', prefix: '共振', suffix: '', tier: 9, damage: 1.36, fireRate: 1.08, pierce: 1.3, multiShot: 1.35, drone: 1.28, speed: 1.04, cost: 2.1 },
    { id: 'starfall', prefix: '星陨', suffix: '', tier: 10, damage: 1.68, fireRate: 1.18, pierce: 1.55, multiShot: 1.45, drone: 1.42, speed: 1.2, cost: 2.35 },
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
                baseCost: Math.round(family.cost * variant.cost * getRarityCostMultiplier(rarity)),
                desc: `${family.desc} ${getWeaponStyleName(attackStyle)}，${rarity}品质 T${variant.tier} 型。`,
                attackStyle,
                rarity,
                weaponStats: {
                    damage: Number((family.damage * variant.damage).toFixed(2)),
                    fireRate: Number((family.fireRate * variant.fireRate).toFixed(2)),
                    pierce: Number((family.pierce * variant.pierce).toFixed(2)),
                    multiShot: Number((family.multiShot * variant.multiShot).toFixed(2)),
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

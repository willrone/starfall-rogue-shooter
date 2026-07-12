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
    attackRange: number;   // 武器基础攻击距离（像素），升级/道具加成叠加上去
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
    // ── Novice (3 把) ─── 目标 DPS 25-38 ──────────
    { id: 'storm-rifle', name: '冲锋枪', color: '#F97316', damage: 6.5, fireRate: 3.0, pierce: 0.0, drone: 0.0, bulletSpeed: 1.6, attackRange: 510, mechanic: 'overheat', desc: '冲锋枪，连续射击射速逐层提升（+50%），停火冷却。攻击距离短。' },
    { id: 'plague-sprayer', name: '瘟疫喷射器', color: '#84CC16', damage: 5, fireRate: 2.5, pierce: 0.0, drone: 0.0, bulletSpeed: 0.0, attackRange: 450, mechanic: 'poison', desc: '扇形毒雾，每次叠3层毒；满15层达到最高持续伤害；被毒杀目标尸体爆炸。' },
    { id: 'frost-beamer', name: '霜束发射器', color: '#60A5FA', damage: 14, fireRate: 2.2, pierce: 0.3, drone: 0.0, bulletSpeed: 1.4, attackRange: 660, mechanic: 'slow', desc: '高频冰弹, 命中减速普通目标 0.6 秒。' },

    // ── Standard (4 把) ─── 目标 DPS 30-50 ────────
    { id: 'echo-bow', name: '回声弓', color: '#2DD4BF', damage: 48, fireRate: 1.40, pierce: 0, drone: 0.0, bulletSpeed: 1.7, attackRange: 820, mechanic: 'echo_chain', desc: '子弹命中怪物, 若击杀则自动弹射到附近下一个怪, 连续弹射不衰减。与穿透互斥。' },
    { id: 'split-barrel', name: '裂变枪管', color: '#F15BB5', damage: 8.5, fireRate: 2.4, pierce: 0.4, drone: 0.0, bulletSpeed: 1.2, attackRange: 600, mechanic: 'multishot_3', desc: '每次射击同时 3 颗窄扇形分布, 适合清群。' },
    { id: 'mirror-prism', name: '镜像棱镜', color: '#C084FC', damage: 6.5, fireRate: 1.35, pierce: 0.3, drone: 0.3, bulletSpeed: 1.0, attackRange: 620, mechanic: 'radial_5', desc: '5 颗 360° 全方向散射, 主目标方向棱镜弹强化。' },
    { id: 'quantum-loom', name: '量子织机', color: '#0EA5E9', damage: 30, fireRate: 1.09, pierce: 0.6, drone: 0.4, bulletSpeed: 1.0, attackRange: 740, mechanic: 'split', desc: '子弹飞行 0.42 秒后分裂成 2 颗, 范围自动扩散。' },

    // ── Boss Gate (4 把) ─── 目标 DPS 65-94 ─────
    { id: 'ion-lance', name: '离子长枪', color: '#34D399', damage: 100, fireRate: 0.77, pierce: 1.5, drone: 0.0, bulletSpeed: 2.5, attackRange: 960, mechanic: 'straight', desc: '笔直弹道, 远距离命中不衰减。' },
    { id: 'thorn-crossbow', name: '荆棘连弩', color: '#D97706', damage: 68, fireRate: 1.5, pierce: 0.6, drone: 0.0, bulletSpeed: 1.6, attackRange: 800, mechanic: 'ricochet', desc: '命中敌人或墙壁后反弹 2 次, 每次反弹增伤。' },
    { id: 'rail-cannon', name: '磁轨炮', color: '#818CF8', damage: 95, fireRate: 1.05, pierce: 3.5, drone: 0.0, bulletSpeed: 5.0, attackRange: 940, mechanic: 'pierce_bonus', desc: '超高速宽轨贯穿, 每次穿透下次伤害 +15% (可叠加)。最高弹速, 极远射程。' },
    { id: 'void-needle', name: '虚空针', color: '#9333EA', damage: 72, fireRate: 1.20, pierce: 1.2, drone: 0.0, bulletSpeed: 2.0, attackRange: 880, mechanic: 'crit_master', desc: '高暴击率+暴击伤害, 兼顾清杂与 Boss。' },

    // ── Boss Clear (3 把) ─── 目标 DPS 60-95 ─────
    { id: 'meteor-launcher', name: '流星发射器', color: '#EF4444', damage: 200, fireRate: 0.78, pierce: 1.0, drone: 0.0, bulletSpeed: 1.7, attackRange: 680, mechanic: 'aoe_burn', desc: '重型火炮。命中先造成半径110/40%爆炸，再留下3秒燃烧区，固定6次tick总计48%子弹伤害。' },
    { id: 'orbital-drone', name: '轨道无人机', color: '#A3E635', damage: 160, fireRate: 0.85, pierce: 0.0, drone: 3.2, bulletSpeed: 0.0, attackRange: 560, mechanic: 'drone_charge', desc: '击杀充能, 满 100% 召唤 1 个爆炸无人机。' },
    { id: 'gravity-hammer', name: '重力锤', color: '#64748B', damage: 220, fireRate: 0.62, pierce: 1.0, drone: 0.5, bulletSpeed: 0.9, attackRange: 600, mechanic: 'knockback', desc: '慢射重击, 命中强力击退, 暴击 2 倍击退。' },

    // ── Legendary (3 把) ─── 目标 DPS 83-95 ────────
    { id: 'void-tearer', name: '虚空撕裂者', color: '#06B6D4', damage: 72, fireRate: 1.8, pierce: 3.2, drone: 0.0, bulletSpeed: 1.8, attackRange: 720, mechanic: 'void_tearer', desc: '高速穿透型。子弹附带虚空撕裂，每穿透一层减目标防御，高射速清群。' },
    { id: 'icefire-judge', name: '冰狱审判', color: '#8B5CF6', damage: 95, fireRate: 1.35, pierce: 1.2, drone: 0.0, bulletSpeed: 1.5, attackRange: 760, mechanic: 'icefire_judge', desc: '冰火交替爆发。冰弹减速普通目标1秒（精英/Boss免疫）；火弹对已减速目标主伤害翻倍，并触发小范围爆炸。' },
    { id: 'webmaster', name: '织网支配者', color: '#FACC15', damage: 56, fireRate: 1.6, pierce: 0.5, drone: 1.2, bulletSpeed: 1.2, attackRange: 640, mechanic: 'webmaster_lifesteal', desc: '召唤续航型。子弹缓速，击杀任意敌人时回复子弹伤害5%的生命值，召唤无人机助战。' },
];

export const WEAPON_VARIANTS: WeaponVariant[] = [
    { id: '', prefix: '', suffix: '', tier: 1, damage: 1, fireRate: 1, pierce: 1, drone: 1, speed: 1, cost: 1 },
    { id: 'light', prefix: '轻型', suffix: '', tier: 2, damage: 0.86, fireRate: 1.22, pierce: 0.8, drone: 0.9, speed: 1.16, cost: 1.08 },
    { id: 'pulse', prefix: '脉冲', suffix: '', tier: 3, damage: 4.44, fireRate: 1.12, pierce: 1, drone: 1, speed: 1.1, cost: 1.18 },
    { id: 'accurate', prefix: '精准', suffix: '', tier: 4, damage: 1.22, fireRate: 0.92, pierce: 1.12, drone: 0.9, speed: 1.24, cost: 1.28 },
    { id: 'heavy', prefix: '重载', suffix: '', tier: 5, damage: 1.48, fireRate: 0.72, pierce: 1.18, drone: 0.85, speed: 0.92, cost: 1.42 },
    { id: 'rapid', prefix: '连射', suffix: '', tier: 6, damage: 0.94, fireRate: 1.55, pierce: 0.88, drone: 0.95, speed: 1.08, cost: 1.55 },
    { id: 'piercing', prefix: '穿甲', suffix: '', tier: 7, damage: 4.48, fireRate: 0.96, pierce: 1.75, drone: 0.9, speed: 1.02, cost: 1.72 },
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
        case 'storm-rifle':
            return 'smg';
        case 'plague-sprayer':
            return 'spray';
        case 'frost-beamer':
            return 'frost';
        case 'echo-bow':
            return 'echo';
        case 'split-barrel':
            return 'scatter';
        case 'mirror-prism':
            return 'prism';
        case 'quantum-loom':
            return 'quantum';
        case 'ion-lance':
            return 'ion';
        case 'thorn-crossbow':
            return 'thorn';
        case 'rail-cannon':
            return 'rail';
        case 'void-needle':
            return 'void_needle';
        case 'meteor-launcher':
            return 'meteor';
        case 'orbital-drone':
            return 'drone';
        case 'gravity-hammer':
            return 'gravity';
        case 'void-tearer':
            return 'void_tear';
        case 'icefire-judge':
            return 'icefire';
        case 'webmaster':
            return 'web';
        default:
            return 'rifle';
    }
}

export function getWeaponStyleName(style: WeaponAttackStyle) {
    switch (style) {
        case 'smg': return '高速曳光';
        case 'spray': return '毒雾扇面';
        case 'frost': return '冰晶光束';
        case 'echo': return '回声穿箭';
        case 'scatter':
        case 'shotgun': return '近距三连';
        case 'prism': return '镜像环射';
        case 'quantum': return '量子分裂';
        case 'ion': return '离子长枪';
        case 'thorn': return '荆棘反弹';
        case 'rail': return '磁轨贯穿';
        case 'void_needle': return '虚空针刺';
        case 'meteor': return '流星燃烧';
        case 'drone': return '无人机电弧';
        case 'gravity': return '重力冲击';
        case 'void_tear':
        case 'scythe': return '虚空裂刃';
        case 'icefire': return '冰火审判';
        case 'web':
        case 'chain': return '织网链束';
        case 'laser': return '光束锁定';
        case 'pulse': return '扇形脉冲';
        case 'disc': return '旋转飞盘';
        case 'ricochet': return '弹射折返';
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
                    attackRange: family.attackRange,
                },
            });
        }
    }
    return weapons;
}

export const WEAPON_CATALOG: EquipmentDef[] = buildWeaponCatalog();
export const WEAPON_COUNT = WEAPON_CATALOG.length;

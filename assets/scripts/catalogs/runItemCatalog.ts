import type { LevelUpgrade, StatEffect } from '../core/types';
import { STAT_META } from '../core/stats';

export interface RunItemBlueprint {
    id: string;
    name: string;
    category: string;
    color: string;
    effects: StatEffect[];
}

export const ITEM_TIER_NAMES = ['I', 'II', 'III', 'IV', 'V'];
export const TRADEOFF_POSITIVE_BONUS = 1.24;

export const RUN_ITEM_BLUEPRINTS: RunItemBlueprint[] = [
    { id: 'charged-magazine', name: '高能弹匣', category: '攻击', color: '#F94144', effects: [{ stat: 'attackPower', amount: 6 }, { stat: 'attackSpeed', amount: 0.05 }, { stat: 'moveSpeed', amount: -5 }] },
    { id: 'rapid-trigger', name: '急速扳机', category: '攻击', color: '#4CC9F0', effects: [{ stat: 'attackSpeed', amount: 0.14 }, { stat: 'attackPower', amount: -1.5 }] },
    { id: 'longscope', name: '远距瞄具', category: '攻击', color: '#38BDF8', effects: [{ stat: 'attackRange', amount: 70 }, { stat: 'critChance', amount: 0.02 }, { stat: 'dodgeChance', amount: -0.01 }] },
    { id: 'crit-lens', name: '暴击透镜', category: '攻击', color: '#F15BB5', effects: [{ stat: 'critChance', amount: 0.045 }, { stat: 'critDamage', amount: 0.15 }] },
    { id: 'execution-protocol', name: '处决协议', category: '攻击', color: '#B5179E', effects: [{ stat: 'lethalChance', amount: 0.012 }, { stat: 'lethalDamage', amount: 0.25 }, { stat: 'attackSpeed', amount: -0.02 }] },
    { id: 'fracture-warhead', name: '裂解弹头', category: '攻击', color: '#C084FC', effects: [{ stat: 'lethalMaxHpPct', amount: 0.01 }, { stat: 'attackPower', amount: 4 }, { stat: 'critChance', amount: -0.015 }] },
    { id: 'piercing-coil', name: '穿甲线圈', category: '攻击', color: '#F9C74F', effects: [{ stat: 'pierce', amount: 0.5 }, { stat: 'attackPower', amount: 1.5 }, { stat: 'attackSpeed', amount: -0.02 }] },
    { id: 'barrage-splitter', name: '弹幕分流器', category: '攻击', color: '#E879F9', effects: [{ stat: 'multiShot', amount: 0.75 }, { stat: 'attackSpeed', amount: 0.02 }, { stat: 'attackPower', amount: -2 }] },
    { id: 'superconductor-round', name: '超导弹体', category: '攻击', color: '#22D3EE', effects: [{ stat: 'bulletSpeed', amount: 40 }, { stat: 'attackRange', amount: 45 }] },
    { id: 'overload-reactor', name: '过载反应', category: '攻击', color: '#EF4444', effects: [{ stat: 'attackPower', amount: 8 }, { stat: 'maxHp', amount: -18 }, { stat: 'shieldMax', amount: -16 }] },
    { id: 'drone-uplink', name: '无人机上行链', category: '攻击', color: '#90BE6D', effects: [{ stat: 'dronePower', amount: 1.1 }, { stat: 'attackRange', amount: 24 }, { stat: 'magicDefense', amount: -2 }] },
    { id: 'sniper-heuristic', name: '狙击演算', category: '攻击', color: '#577590', effects: [{ stat: 'critDamage', amount: 0.28 }, { stat: 'attackRange', amount: 95 }, { stat: 'attackSpeed', amount: -0.04 }] },
    { id: 'composite-armor', name: '复合护甲', category: '防御', color: '#64748B', effects: [{ stat: 'physicalDefense', amount: 9 }, { stat: 'maxHp', amount: 18 }, { stat: 'moveSpeed', amount: -6 }] },
    { id: 'arcane-film', name: '秘法隔膜', category: '防御', color: '#8B5CF6', effects: [{ stat: 'magicDefense', amount: 10 }, { stat: 'shieldMax', amount: 20 }] },
    { id: 'flame-coating', name: '火焰涂层', category: '元素防御', color: '#F3722C', effects: [{ stat: 'fireDefense', amount: 14 }, { stat: 'magicDefense', amount: 2 }, { stat: 'attackPower', amount: 3 }, { stat: 'iceDefense', amount: -3 }] },
    { id: 'grounding-spike', name: '雷击接地桩', category: '元素防御', color: '#4CC9F0', effects: [{ stat: 'lightningDefense', amount: 14 }, { stat: 'magicDefense', amount: 2 }, { stat: 'attackSpeed', amount: 0.03 }, { stat: 'poisonDefense', amount: -2 }] },
    { id: 'antitoxin-serum', name: '解毒血清', category: '元素防御', color: '#84CC16', effects: [{ stat: 'poisonDefense', amount: 16 }, { stat: 'magicDefense', amount: 2 }, { stat: 'hpRegen', amount: 0.32 }] },
    { id: 'cryo-insulation', name: '冰霜绝缘层', category: '元素防御', color: '#A7F3D0', effects: [{ stat: 'iceDefense', amount: 14 }, { stat: 'magicDefense', amount: 2 }, { stat: 'moveSpeed', amount: 6 }, { stat: 'fireDefense', amount: -2 }] },
    { id: 'deflector-shield', name: '偏转护盾', category: '防御', color: '#14B8A6', effects: [{ stat: 'shieldMax', amount: 35 }, { stat: 'shieldRegen', amount: 1 }, { stat: 'maxHp', amount: -8 }] },
    { id: 'evasion-servo', name: '闪避伺服', category: '机动', color: '#43AA8B', effects: [{ stat: 'dodgeChance', amount: 0.035 }, { stat: 'moveSpeed', amount: 12 }, { stat: 'physicalDefense', amount: -4 }] },
    { id: 'regen-vat', name: '再生培养仓', category: '生存', color: '#90BE6D', effects: [{ stat: 'hpRegen', amount: 0.8 }, { stat: 'maxHp', amount: 10 }, { stat: 'attackSpeed', amount: -0.02 }] },
    { id: 'bulwark-protocol', name: '坚壁协议', category: '防御', color: '#475569', effects: [{ stat: 'damageReduction', amount: 0.025 }, { stat: 'physicalDefense', amount: 4 }, { stat: 'moveSpeed', amount: -8 }] },
    { id: 'lucky-dice', name: '幸运骰', category: '其他', color: '#F9C74F', effects: [{ stat: 'luck', amount: 10 }, { stat: 'critChance', amount: 0.01 }, { stat: 'maxHp', amount: -6 }] },
    { id: 'scavenger-field', name: '拾荒磁场', category: '资源', color: '#577590', effects: [{ stat: 'pickupRange', amount: 45 }, { stat: 'resourceGain', amount: 0.04 }, { stat: 'attackRange', amount: -20 }] },
    { id: 'xp-prism', name: '经验棱镜', category: '成长', color: '#38BDF8', effects: [{ stat: 'xpGain', amount: 0.07 }, { stat: 'luck', amount: 2 }, { stat: 'physicalDefense', amount: -2 }] },
    { id: 'greed-converter', name: '贪婪转换器', category: '资源', color: '#F8961E', effects: [{ stat: 'resourceGain', amount: 0.16 }, { stat: 'attackPower', amount: -1 }, { stat: 'damageReduction', amount: -0.005 }] },
    { id: 'phase-thruster', name: '相位推进器', category: '机动', color: '#2DD4BF', effects: [{ stat: 'moveSpeed', amount: 24 }, { stat: 'dodgeChance', amount: 0.012 }, { stat: 'pickupRange', amount: 12 }] },
    { id: 'stable-core', name: '稳态核心', category: '生存', color: '#CBD5E1', effects: [{ stat: 'maxHp', amount: 25 }, { stat: 'shieldMax', amount: 15 }, { stat: 'critChance', amount: -0.015 }] },
    { id: 'precision-chip', name: '精密芯片', category: '攻击', color: '#FB7185', effects: [{ stat: 'critChance', amount: 0.025 }, { stat: 'attackRange', amount: 40 }, { stat: 'shieldMax', amount: -8 }] },
    { id: 'frenzy-injector', name: '狂热注射', category: '混合', color: '#DC2626', effects: [{ stat: 'attackSpeed', amount: 0.16 }, { stat: 'hpRegen', amount: -0.3 }, { stat: 'physicalDefense', amount: -2 }] },
];

const SCALE_POSITIVE = (tier: number) => 1 + (tier - 1) * 0.52;
const SCALE_NEGATIVE = (tier: number) => 0.45 + (tier - 1) * 0.24;

export function scaleRunItemEffect(effect: StatEffect, tier: number, tradeoffItem = false): StatEffect {
    const scale = effect.amount < 0
        ? SCALE_NEGATIVE(tier)
        : SCALE_POSITIVE(tier) * (tradeoffItem ? TRADEOFF_POSITIVE_BONUS : 1);
    const amount = effect.amount * scale;
    return {
        stat: effect.stat,
        amount: Math.abs(amount) >= 3 ? Math.round(amount) : Number(amount.toFixed(3)),
    };
}

export function scaleRunItemEffects(effects: StatEffect[], tier: number): StatEffect[] {
    const tradeoffItem = effects.some((effect) => effect.amount < 0);
    return effects.map((effect) => scaleRunItemEffect(effect, tier, tradeoffItem));
}

export function formatRunItemEffect(effect: StatEffect): string {
    const meta = STAT_META[effect.stat];
    const sign = effect.amount >= 0 ? '+' : '-';
    const value = Math.abs(effect.amount);
    if (meta.kind === 'percent') return `${meta.name} ${sign}${Math.round(value * 100)}%`;
    if (meta.kind === 'multiplier') return `${meta.name} ${sign}${value.toFixed(2)}x`;
    return `${meta.name} ${sign}${Number(value.toFixed(1))}`;
}

export function buildRunItemCatalog(): LevelUpgrade[] {
    const items: LevelUpgrade[] = [];
    for (const blueprint of RUN_ITEM_BLUEPRINTS) {
        for (let tier = 1; tier <= ITEM_TIER_NAMES.length; tier++) {
            const effects = scaleRunItemEffects(blueprint.effects, tier);
            items.push({
                id: `${blueprint.id}-${tier}`,
                name: `${blueprint.name} ${ITEM_TIER_NAMES[tier - 1]}`,
                desc: effects.map(formatRunItemEffect).join(' / '),
                color: blueprint.color,
                category: blueprint.category,
                tier,
                effects,
            });
        }
    }
    return items;
}

export const STAT_UPGRADE_BLUEPRINTS: RunItemBlueprint[] = [
    { id: 'fire-control', name: '火控训练', category: '攻击属性', color: '#F94144', effects: [{ stat: 'attackPower', amount: 12 }] },
    { id: 'neural-rapid', name: '神经加速', category: '攻击属性', color: '#4CC9F0', effects: [{ stat: 'attackSpeed', amount: 0.14 }] },
    { id: 'long-lock', name: '远距锁定', category: '攻击属性', color: '#38BDF8', effects: [{ stat: 'attackRange', amount: 110 }, { stat: 'bulletSpeed', amount: 38 }] },
    { id: 'crit-instinct', name: '暴击直觉', category: '攻击属性', color: '#F15BB5', effects: [{ stat: 'critChance', amount: 0.055 }] },
    { id: 'weakpoint-study', name: '弱点解析', category: '攻击属性', color: '#C084FC', effects: [{ stat: 'critDamage', amount: 0.28 }, { stat: 'critChance', amount: 0.012 }] },
    { id: 'lethal-judgement', name: '致命判断', category: '攻击属性', color: '#F59E0B', effects: [{ stat: 'lethalChance', amount: 0.014 }, { stat: 'lethalDamage', amount: 0.2 }] },
    { id: 'execution-sense', name: '斩杀本能', category: '攻击属性', color: '#B5179E', effects: [{ stat: 'lethalMaxHpPct', amount: 0.012 }, { stat: 'attackPower', amount: 5 }] },
    { id: 'pierce-drill', name: '穿透训练', category: '攻击属性', color: '#F9C74F', effects: [{ stat: 'pierce', amount: 1.0 }] },
    { id: 'multi-control', name: '多弹操控', category: '攻击属性', color: '#E879F9', effects: [{ stat: 'multiShot', amount: 0.6 }] },
    { id: 'drone-command', name: '无人机指挥', category: '攻击属性', color: '#90BE6D', effects: [{ stat: 'dronePower', amount: 1.4 }, { stat: 'attackRange', amount: 28 }] },
    { id: 'armor-body', name: '装甲体魄', category: '防御属性', color: '#64748B', effects: [{ stat: 'physicalDefense', amount: 12 }, { stat: 'maxHp', amount: 22 }] },
    { id: 'arcane-resolve', name: '秘法抗性', category: '防御属性', color: '#8B5CF6', effects: [{ stat: 'magicDefense', amount: 12 }, { stat: 'shieldMax', amount: 22 }] },
    { id: 'element-balance', name: '元素调和', category: '防御属性', color: '#14B8A6', effects: [{ stat: 'fireDefense', amount: 9 }, { stat: 'lightningDefense', amount: 9 }, { stat: 'poisonDefense', amount: 9 }, { stat: 'iceDefense', amount: 9 }] },
    { id: 'life-expansion', name: '生命扩容', category: '防御属性', color: '#43AA8B', effects: [{ stat: 'maxHp', amount: 48 }] },
    { id: 'shield-expansion', name: '护盾扩容', category: '防御属性', color: '#22D3EE', effects: [{ stat: 'shieldMax', amount: 46 }, { stat: 'shieldRegen', amount: 0.9 }] },
    { id: 'regen-loop', name: '自愈循环', category: '防御属性', color: '#90BE6D', effects: [{ stat: 'hpRegen', amount: 1.0 }, { stat: 'maxHp', amount: 10 }] },
    { id: 'damage-soften', name: '冲击缓释', category: '防御属性', color: '#475569', effects: [{ stat: 'damageReduction', amount: 0.028 }, { stat: 'physicalDefense', amount: 4 }] },
    { id: 'evasion-steps', name: '闪避步伐', category: '其他属性', color: '#2DD4BF', effects: [{ stat: 'dodgeChance', amount: 0.038 }, { stat: 'moveSpeed', amount: 12 }] },
    { id: 'mobility-drill', name: '移动训练', category: '其他属性', color: '#43AA8B', effects: [{ stat: 'moveSpeed', amount: 40 }] },
    { id: 'lucky-sense', name: '幸运感知', category: '其他属性', color: '#F9C74F', effects: [{ stat: 'luck', amount: 14 }, { stat: 'pickupRange', amount: 18 }] },
    { id: 'field-sweep', name: '战场拾取', category: '其他属性', color: '#577590', effects: [{ stat: 'pickupRange', amount: 70 }, { stat: 'xpGain', amount: 0.055 }] },
    { id: 'combat-learning', name: '战斗学习', category: '其他属性', color: '#38BDF8', effects: [{ stat: 'xpGain', amount: 0.12 }, { stat: 'luck', amount: 4 }] },
    { id: 'salvage-sense', name: '资源嗅觉', category: '其他属性', color: '#F8961E', effects: [{ stat: 'resourceGain', amount: 0.08 }, { stat: 'luck', amount: 5 }] },
];

const SCALE_STAT = (tier: number) => 1 + (tier - 1) * 0.58;

export function scaleStatUpgradeEffect(effect: StatEffect, tier: number): StatEffect {
    const amount = effect.amount * SCALE_STAT(tier);
    return {
        stat: effect.stat,
        amount: Math.abs(amount) >= 3 ? Math.round(amount) : Number(amount.toFixed(3)),
    };
}

export function buildStatUpgradeCatalog(): LevelUpgrade[] {
    const upgrades: LevelUpgrade[] = [];
    for (const blueprint of STAT_UPGRADE_BLUEPRINTS) {
        for (let tier = 1; tier <= ITEM_TIER_NAMES.length; tier++) {
            const effects = blueprint.effects.map((effect) => scaleStatUpgradeEffect(effect, tier));
            upgrades.push({
                id: `stat-${blueprint.id}-${tier}`,
                name: `${blueprint.name} ${tier}段`,
                desc: effects.map(formatRunItemEffect).join(' / '),
                color: blueprint.color,
                category: blueprint.category,
                tier,
                effects,
            });
        }
    }
    return upgrades;
}

export const RUN_ITEMS: LevelUpgrade[] = buildRunItemCatalog();
export const RUN_ITEM_COUNT = RUN_ITEMS.length;
export const LEVEL_UPGRADES: LevelUpgrade[] = buildStatUpgradeCatalog();
export const STAT_UPGRADE_COUNT = LEVEL_UPGRADES.length;

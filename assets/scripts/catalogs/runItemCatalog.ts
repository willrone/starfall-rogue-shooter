import type { LevelUpgrade, StatEffect } from '../core/types';
import { STAT_META } from '../core/stats';

export interface RunItemBlueprint {
    id: string;
    name: string;
    category: string;
    color: string;
    effects: StatEffect[];
}

// ── Range-based upgrade blueprint for level-up choices ──────────────

export interface StatUpgradeRange {
    stat: keyof typeof STAT_META;
    min: number;
    max: number;
}

export interface StatUpgradeBlueprint {
    id: string;
    name: string;
    category: string;
    color: string;
    effects: StatUpgradeRange[];
}

export const ITEM_TIER_NAMES = ['I', 'II', 'III', 'IV', 'V'];
export const TRADEOFF_POSITIVE_BONUS = 1.24;

export const RUN_ITEM_BLUEPRINTS: RunItemBlueprint[] = [
    // ── 攻击（12件）数值大幅提升，纯正面 ──────────────────────────
    { id: 'charged-magazine', name: '高能弹匣', category: '攻击', color: '#F94144', effects: [{ stat: 'weaponDamagePct', amount: 0.36 }, { stat: 'weaponFireRatePct', amount: 0.18 }] },
    { id: 'rapid-trigger', name: '急速扳机', category: '攻击', color: '#4CC9F0', effects: [{ stat: 'weaponFireRatePct', amount: 0.48 }] },
    { id: 'longscope', name: '远距瞄具', category: '攻击', color: '#38BDF8', effects: [{ stat: 'attackRange', amount: 132 }, { stat: 'critChance', amount: 0.07 }] },
    { id: 'crit-lens', name: '暴击透镜', category: '攻击', color: '#F15BB5', effects: [{ stat: 'critChance', amount: 0.12 }, { stat: 'critDamage', amount: 0.48 }] },
    { id: 'execution-protocol', name: '处决协议', category: '攻击', color: '#B5179E', effects: [{ stat: 'lethalChance', amount: 0.04 }, { stat: 'lethalDamage', amount: 0.72 }] },
    { id: 'fracture-warhead', name: '裂解弹头', category: '攻击', color: '#C084FC', effects: [{ stat: 'lethalMaxHpPct', amount: 0.03 }, { stat: 'weaponDamagePct', amount: 0.18 }] },
    { id: 'piercing-coil', name: '穿甲线圈', category: '攻击', color: '#F9C74F', effects: [{ stat: 'pierce', amount: 1.8 }, { stat: 'pierceDamagePct', amount: 0.42 }] },
    { id: 'armor-piercing-round', name: '破甲弹', category: '攻击', color: '#E879F9', effects: [{ stat: 'pierceDamagePct', amount: 0.54 }, { stat: 'pierce', amount: 1.2 }] },
    { id: 'superconductor-round', name: '超导弹体', category: '攻击', color: '#22D3EE', effects: [{ stat: 'bulletSpeed', amount: 96 }, { stat: 'attackRange', amount: 96 }] },
    { id: 'overload-reactor', name: '过载反应', category: '攻击', color: '#EF4444', effects: [{ stat: 'weaponDamagePct', amount: 0.48 }] },
    { id: 'drone-uplink', name: '无人机上行链', category: '攻击', color: '#90BE6D', effects: [{ stat: 'dronePower', amount: 3.0 }, { stat: 'attackRange', amount: 60 }] },
    { id: 'sniper-heuristic', name: '狙击演算', category: '攻击', color: '#577590', effects: [{ stat: 'critDamage', amount: 0.72 }, { stat: 'attackRange', amount: 168 }] },

    // ── 防御/生存（7件，替代原元素防） ────────────────────────────
    { id: 'composite-armor', name: '复合护甲', category: '防御', color: '#64748B', effects: [{ stat: 'maxHp', amount: 84 }, { stat: 'damageReduction', amount: 0.04 }] },
    { id: 'arcane-film', name: '秘法隔膜', category: '防御', color: '#8B5CF6', effects: [{ stat: 'shieldMax', amount: 72 }, { stat: 'shieldRegen', amount: 3.6 }] },
    { id: 'warmog-heart', name: '狂徒之心', category: '生存', color: '#F3722C', effects: [{ stat: 'hpRegen', amount: 3.6 }, { stat: 'maxHp', amount: 48 }] },
    { id: 'evasion-field', name: '闪避力场', category: '机动', color: '#4CC9F0', effects: [{ stat: 'dodgeChance', amount: 0.08 }, { stat: 'moveSpeed', amount: 36 }] },
    { id: 'bullet-time', name: '子弹时间', category: '攻击', color: '#84CC16', effects: [{ stat: 'weaponFireRatePct', amount: 0.22 }, { stat: 'attackSpeed', amount: 0.05 }] },
    { id: 'cryo-field', name: '冰霜力场', category: '机动', color: '#A7F3D0', effects: [{ stat: 'moveSpeed', amount: 60 }, { stat: 'shieldMax', amount: 36 }] },
    { id: 'deflector-shield', name: '偏转护盾', category: '防御', color: '#14B8A6', effects: [{ stat: 'shieldMax', amount: 96 }, { stat: 'shieldRegen', amount: 3.6 }] },

    // ── 机动/生存（3件） ───────────────────────────────────────────
    { id: 'evasion-servo', name: '闪避伺服', category: '机动', color: '#43AA8B', effects: [{ stat: 'dodgeChance', amount: 0.10 }, { stat: 'moveSpeed', amount: 42 }, { stat: 'shieldMax', amount: 24 }] },
    { id: 'regen-vat', name: '再生培养仓', category: '生存', color: '#90BE6D', effects: [{ stat: 'hpRegen', amount: 3.6 }, { stat: 'maxHp', amount: 60 }] },
    { id: 'bulwark-protocol', name: '坚壁协议', category: '防御', color: '#475569', effects: [{ stat: 'damageReduction', amount: 0.07 }, { stat: 'maxHp', amount: 60 }] },

    // ── 资源/成长/其他（4件） ──────────────────────────────────────
    { id: 'lucky-dice', name: '幸运骰', category: '其他', color: '#F9C74F', effects: [{ stat: 'luck', amount: 30 }, { stat: 'critChance', amount: 0.06 }] },
    { id: 'scavenger-field', name: '拾荒磁场', category: '资源', color: '#577590', effects: [{ stat: 'pickupRange', amount: 108 }, { stat: 'resourceGain', amount: 0.14 }, { stat: 'moveSpeed', amount: 18 }] },
    { id: 'xp-prism', name: '经验棱镜', category: '成长', color: '#38BDF8', effects: [{ stat: 'xpGain', amount: 0.30 }, { stat: 'luck', amount: 10 }] },
    { id: 'greed-converter', name: '贪婪转换器', category: '资源', color: '#F8961E', effects: [{ stat: 'resourceGain', amount: 0.42 }, { stat: 'xpGain', amount: 0.10 }] },

    // ── 混合（2件） ────────────────────────────────────────────────
    { id: 'phase-thruster', name: '相位推进器', category: '机动', color: '#2DD4BF', effects: [{ stat: 'moveSpeed', amount: 72 }, { stat: 'dodgeChance', amount: 0.06 }, { stat: 'pickupRange', amount: 36 }] },
    { id: 'stable-core', name: '稳态核心', category: '生存', color: '#CBD5E1', effects: [{ stat: 'maxHp', amount: 96 }, { stat: 'shieldMax', amount: 48 }] },
    { id: 'precision-chip', name: '精密芯片', category: '攻击', color: '#FB7185', effects: [{ stat: 'critChance', amount: 0.08 }, { stat: 'attackRange', amount: 108 }] },
    { id: 'frenzy-injector', name: '狂热注射', category: '攻击', color: '#DC2626', effects: [{ stat: 'weaponFireRatePct', amount: 0.60 }, { stat: 'moveSpeed', amount: 18 }] },
];

// ── RUN_ITEM (chest/shop) catalog ──────────────────────────────────

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

export const RUN_ITEMS: LevelUpgrade[] = buildRunItemCatalog();
export const RUN_ITEM_COUNT = RUN_ITEMS.length;

// ── NEW range-based upgrade blueprints for level-up (replaces old STAT_UPGRADE_BLUEPRINTS) ──

/**
 * Stat upgrade blueprints with random ranges.
 * Each time you level up, the actual values are rolled within [min, max].
 */
export const LEVEL_UP_BLUEPRINTS: StatUpgradeBlueprint[] = [
    // ── 💪 力量（Power） ─────────────────────────────────────────
    { id: 'power-attack',        name: '攻击强化', category: '力量', color: '#F94144', effects: [{ stat: 'attackPower', min: 8, max: 16 }] },
    { id: 'power-crit',          name: '暴击训练', category: '力量', color: '#F15BB5', effects: [{ stat: 'critChance', min: 0.04, max: 0.10 }] },
    { id: 'power-crit-damage',   name: '弱点打击', category: '力量', color: '#B5179E', effects: [{ stat: 'critDamage', min: 0.15, max: 0.36 }] },

    // ── ⚡ 敏捷（Agility） ───────────────────────────────────────
    { id: 'agility-reflex',      name: '神经反射', category: '敏捷', color: '#4CC9F0', effects: [{ stat: 'attackSpeed', min: 0.05, max: 0.12 }] },
    { id: 'agility-speed',       name: '移速强化', category: '敏捷', color: '#43AA8B', effects: [{ stat: 'moveSpeed', min: 18, max: 42 }] },
    { id: 'agility-dodge',       name: '身法训练', category: '敏捷', color: '#2DD4BF', effects: [{ stat: 'dodgeChance', min: 0.04, max: 0.07 }] },

    // ── ❤️ 体魄（Physique） ──────────────────────────────────────
    { id: 'physique-hp',         name: '生命扩展', category: '体魄', color: '#64748B', effects: [{ stat: 'maxHp', min: 30, max: 60 }] },
    { id: 'physique-shield',     name: '护盾扩容', category: '体魄', color: '#22D3EE', effects: [{ stat: 'shieldMax', min: 24, max: 48 }] },
    { id: 'physique-toughness',  name: '坚韧体质', category: '体魄', color: '#475569', effects: [{ stat: 'damageReduction', min: 0.03, max: 0.06 }] },

    // ── 🎯 技巧（Technique） ─────────────────────────────────────
    { id: 'technique-range',     name: '精准瞄准', category: '技巧', color: '#38BDF8', effects: [{ stat: 'attackRange', min: 55, max: 120 }] },
    { id: 'technique-pierce',    name: '穿透强化', category: '技巧', color: '#F9C74F', effects: [{ stat: 'pierceDamagePct', min: 0.12, max: 0.28 }] },
    { id: 'technique-drone',     name: '无人机指挥', category: '技巧', color: '#90BE6D', effects: [{ stat: 'dronePower', min: 1.0, max: 4.5 }] },
];

/** Roll a random value within [min, max] and produce a proper StatEffect. */
function rollRangeValue(stat: keyof typeof STAT_META, min: number, max: number): StatEffect {
    const raw = min + Math.random() * (max - min);
    const meta = STAT_META[stat];
    let amount: number;
    if (meta.kind === 'number') {
        amount = Math.round(raw);
    } else {
        // percent / multiplier → keep 3 decimal places
        amount = Number(raw.toFixed(3));
    }
    return { stat, amount };
}

/**
 * Roll a fresh LevelUpgrade from a blueprint with random values.
 */
export function rollStatUpgradeChoice(blueprint: StatUpgradeBlueprint): LevelUpgrade {
    const effects = blueprint.effects.map((e) => rollRangeValue(e.stat, e.min, e.max));
    const desc = effects.map(formatRunItemEffect).join(' / ');
    return {
        id: blueprint.id,
        name: blueprint.name,
        desc,
        color: blueprint.color,
        category: blueprint.category,
        tier: 1,
        effects,
    };
}

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

// ── Every blueprint has exactly ONE effect (single-stat). ────────────
// Split from original 32 multi-effect blueprints → 65 single-stat items.
// Each standalone value is ~1.4-1.75x the old combo component to compensate
// for losing the bundled bonus.

export const RUN_ITEM_BLUEPRINTS: RunItemBlueprint[] = [
    // ── 攻击（32 件）─────────────────────────────────────────────
    { id: 'charged-magazine',      name: '高能弹匣',      category: '攻击', color: '#F94144', effects: [{ stat: 'weaponDamagePct',    amount: 0.54 }] },
    { id: 'rapid-feed',            name: '速射弹匣',      category: '攻击', color: '#F94144', effects: [{ stat: 'weaponFireRatePct', amount: 0.32 }] },
    { id: 'rapid-trigger',         name: '急速扳机',      category: '攻击', color: '#4CC9F0', effects: [{ stat: 'weaponFireRatePct', amount: 0.55 }] },
    { id: 'longscope',             name: '远距瞄具',      category: '攻击', color: '#38BDF8', effects: [{ stat: 'attackRange',       amount: 72 }] },
    { id: 'target-lens',           name: '精准透镜',      category: '攻击', color: '#38BDF8', effects: [{ stat: 'critChance',        amount: 0.10 }] },
    { id: 'crit-lens',             name: '暴击透镜',      category: '攻击', color: '#F15BB5', effects: [{ stat: 'critChance',        amount: 0.16 }] },
    { id: 'deadly-lens',           name: '致命透镜',      category: '攻击', color: '#F15BB5', effects: [{ stat: 'critDamage',        amount: 0.72 }] },
    { id: 'execution-protocol',    name: '处决协议',      category: '攻击', color: '#B5179E', effects: [{ stat: 'lethalChance',      amount: 0.06 }] },
    { id: 'lethal-strike',         name: '致命处决',      category: '攻击', color: '#B5179E', effects: [{ stat: 'lethalDamage',      amount: 1.00 }] },
    { id: 'fracture-warhead',      name: '裂解弹头',      category: '攻击', color: '#C084FC', effects: [{ stat: 'lethalMaxHpPct',    amount: 0.05 }] },
    { id: 'explosive-charge',      name: '高爆弹药',      category: '攻击', color: '#C084FC', effects: [{ stat: 'weaponDamagePct',    amount: 0.30 }] },
    { id: 'piercing-coil',         name: '穿甲线圈',      category: '攻击', color: '#F9C74F', effects: [{ stat: 'pierce',            amount: 2.6 }] },
    { id: 'armor-piercing-tip',    name: '穿甲弹头',      category: '攻击', color: '#E879F9', effects: [{ stat: 'pierceDamagePct',   amount: 0.65 }] },
    { id: 'armor-piercing-round',  name: '破甲弹',        category: '攻击', color: '#E879F9', effects: [{ stat: 'pierceDamagePct',   amount: 0.80 }] },
    { id: 'reinforced-pin',        name: '强化穿透',      category: '攻击', color: '#F9C74F', effects: [{ stat: 'pierce',            amount: 1.8 }] },
    { id: 'superconductor-round',  name: '超导弹体',      category: '攻击', color: '#22D3EE', effects: [{ stat: 'bulletSpeed',       amount: 140 }] },
    { id: 'range-extender',        name: '增距镜',        category: '攻击', color: '#22D3EE', effects: [{ stat: 'attackRange',       amount: 54 }] },
    { id: 'overload-reactor',      name: '过载反应',      category: '攻击', color: '#EF4444', effects: [{ stat: 'weaponDamagePct',    amount: 0.60 }] },
    { id: 'drone-uplink',          name: '无人机上行链',  category: '攻击', color: '#90BE6D', effects: [{ stat: 'dronePower',        amount: 4.5 }] },
    { id: 'recon-scan',            name: '侦查扫描',      category: '攻击', color: '#90BE6D', effects: [{ stat: 'attackRange',       amount: 40 }] },
    { id: 'sniper-heuristic',      name: '狙击演算',      category: '攻击', color: '#577590', effects: [{ stat: 'critDamage',        amount: 1.00 }] },
    { id: 'long-range-targeting',  name: '长程瞄准',      category: '攻击', color: '#577590', effects: [{ stat: 'attackRange',       amount: 90 }] },
    { id: 'bullet-time',           name: '子弹时间',      category: '攻击', color: '#84CC16', effects: [{ stat: 'weaponFireRatePct', amount: 0.36 }] },
    { id: 'neural-accelerator',    name: '神经加速',      category: '攻击', color: '#84CC16', effects: [{ stat: 'weaponFireRatePct', amount: 0.42 }] },
    { id: 'precision-chip',        name: '精密芯片',      category: '攻击', color: '#FB7185', effects: [{ stat: 'critChance',        amount: 0.12 }] },
    { id: 'scope-lens',            name: '瞄准镜',        category: '攻击', color: '#FB7185', effects: [{ stat: 'attackRange',       amount: 60 }] },
    { id: 'frenzy-injector',       name: '狂热注射',      category: '攻击', color: '#DC2626', effects: [{ stat: 'weaponFireRatePct', amount: 0.90 }] },
    { id: 'stimulant',             name: '兴奋剂',        category: '攻击', color: '#DC2626', effects: [{ stat: 'moveSpeed',         amount: 14 }] },
    { id: 'blast-focuser',         name: '爆破聚焦器',    category: '攻击', color: '#F97316', effects: [{ stat: 'aoeDamagePct',      amount: 0.80 }] },
    { id: 'shockwave',             name: '冲击波',        category: '攻击', color: '#F97316', effects: [{ stat: 'aoeRangePct',       amount: 0.36 }] },
    { id: 'napalm-catalyst',       name: '燃油催化',      category: '攻击', color: '#EF4444', effects: [{ stat: 'aoeRangePct',       amount: 0.72 }] },
    { id: 'volatile-fuel',         name: '烈性燃料',      category: '攻击', color: '#EF4444', effects: [{ stat: 'aoeDamagePct',      amount: 0.28 }] },

    // ── 防御（8 件）───────────────────────────────────────────────
    { id: 'composite-armor',       name: '复合护甲',      category: '防御', color: '#64748B', effects: [{ stat: 'maxHp',            amount: 120 }] },
    { id: 'alloy-plating',         name: '合金镀层',      category: '防御', color: '#64748B', effects: [{ stat: 'damageReduction',  amount: 0.06 }] },
    { id: 'arcane-film',           name: '秘法隔膜',      category: '防御', color: '#8B5CF6', effects: [{ stat: 'shieldMax',        amount: 100 }] },
    { id: 'fast-recharge',         name: '快速充能',      category: '防御', color: '#8B5CF6', effects: [{ stat: 'shieldRegen',      amount: 5.4 }] },
    { id: 'deflector-shield',      name: '偏转护盾',      category: '防御', color: '#14B8A6', effects: [{ stat: 'shieldMax',        amount: 140 }] },
    { id: 'energy-recovery',       name: '能量回复',      category: '防御', color: '#14B8A6', effects: [{ stat: 'shieldRegen',      amount: 5.4 }] },
    { id: 'bulwark-protocol',      name: '坚壁协议',      category: '防御', color: '#475569', effects: [{ stat: 'damageReduction',  amount: 0.10 }] },
    { id: 'fortified-constitution',name: '耐久强化',      category: '防御', color: '#475569', effects: [{ stat: 'maxHp',            amount: 90 }] },

    // ── 生存（6 件）───────────────────────────────────────────────
    { id: 'warmog-heart',          name: '狂徒之心',      category: '生存', color: '#F3722C', effects: [{ stat: 'hpRegen',          amount: 5.4 }] },
    { id: 'life-boost',            name: '生命强化',      category: '生存', color: '#F3722C', effects: [{ stat: 'maxHp',            amount: 72 }] },
    { id: 'regen-vat',             name: '再生培养仓',    category: '生存', color: '#90BE6D', effects: [{ stat: 'hpRegen',          amount: 5.4 }] },
    { id: 'cellular-activation',   name: '细胞活化',      category: '生存', color: '#90BE6D', effects: [{ stat: 'maxHp',            amount: 90 }] },
    { id: 'stable-core',           name: '稳态核心',      category: '生存', color: '#CBD5E1', effects: [{ stat: 'maxHp',            amount: 140 }] },
    { id: 'energy-core',           name: '能量核心',      category: '生存', color: '#CBD5E1', effects: [{ stat: 'shieldMax',        amount: 72 }] },

    // ── 机动（10 件）─────────────────────────────────────────────
    { id: 'evasion-field',         name: '闪避力场',      category: '机动', color: '#4CC9F0', effects: [{ stat: 'dodgeChance',      amount: 0.12 }] },
    { id: 'lightweight-frame',     name: '轻量化',        category: '机动', color: '#4CC9F0', effects: [{ stat: 'moveSpeed',         amount: 20 }] },
    { id: 'cryo-field',            name: '冰霜力场',      category: '机动', color: '#A7F3D0', effects: [{ stat: 'moveSpeed',         amount: 32 }] },
    { id: 'ice-shield',            name: '冰盾',          category: '机动', color: '#A7F3D0', effects: [{ stat: 'shieldMax',        amount: 56 }] },
    { id: 'evasion-servo',         name: '闪避伺服',      category: '机动', color: '#43AA8B', effects: [{ stat: 'dodgeChance',      amount: 0.14 }] },
    { id: 'thrusters',             name: '推进器',        category: '机动', color: '#43AA8B', effects: [{ stat: 'moveSpeed',         amount: 26 }] },
    { id: 'shimmer-shield',        name: '微光盾',        category: '机动', color: '#43AA8B', effects: [{ stat: 'shieldMax',        amount: 36 }] },
    { id: 'phase-thruster',        name: '相位推进器',    category: '机动', color: '#2DD4BF', effects: [{ stat: 'moveSpeed',         amount: 44 }] },
    { id: 'phase-dodge',           name: '相位闪避',      category: '机动', color: '#2DD4BF', effects: [{ stat: 'dodgeChance',      amount: 0.09 }] },
    { id: 'wide-pickup',           name: '广域拾取',      category: '机动', color: '#2DD4BF', effects: [{ stat: 'pickupRange',       amount: 54 }] },

    // ── 资源/成长/其他（9 件）───────────────────────────────────
    { id: 'scavenger-field',       name: '拾荒磁场',      category: '资源', color: '#577590', effects: [{ stat: 'pickupRange',       amount: 160 }] },
    { id: 'resource-recycling',    name: '资源回收',      category: '资源', color: '#577590', effects: [{ stat: 'resourceGain',      amount: 0.22 }] },
    { id: 'swift-looting',         name: '迅捷拾荒',      category: '资源', color: '#577590', effects: [{ stat: 'moveSpeed',         amount: 14 }] },
    { id: 'xp-prism',              name: '经验棱镜',      category: '成长', color: '#38BDF8', effects: [{ stat: 'xpGain',           amount: 0.44 }] },
    { id: 'luck-prism',            name: '幸运棱镜',      category: '成长', color: '#38BDF8', effects: [{ stat: 'luck',             amount: 16 }] },
    { id: 'greed-converter',       name: '贪婪转换器',    category: '资源', color: '#F8961E', effects: [{ stat: 'resourceGain',      amount: 0.60 }] },
    { id: 'xp-boost',              name: '经验增幅',      category: '成长', color: '#F8961E', effects: [{ stat: 'xpGain',           amount: 0.16 }] },
    { id: 'lucky-dice',            name: '幸运骰',        category: '其他', color: '#F9C74F', effects: [{ stat: 'luck',             amount: 48 }] },
    { id: 'crit-dice',             name: '暴击骰',        category: '其他', color: '#F9C74F', effects: [{ stat: 'critChance',        amount: 0.09 }] },
];

// ── RUN_ITEM (chest/shop) catalog ──────────────────────────────────

const SCALE_POSITIVE = (tier: number) => 1 + (tier - 1) * 0.52;
const SCALE_NEGATIVE = (tier: number) => 0.45 + (tier - 1) * 0.24;

export function scaleRunItemEffect(effect: StatEffect, tier: number, tradeoffItem = false): StatEffect {
    if (tier === 1 && !tradeoffItem) {
        return { stat: effect.stat, amount: effect.amount };
    }
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
    { id: 'agility-speed',       name: '移速强化', category: '敏捷', color: '#43AA8B', effects: [{ stat: 'moveSpeed', min: 8, max: 18 }] },
    { id: 'agility-dodge',       name: '身法训练', category: '敏捷', color: '#2DD4BF', effects: [{ stat: 'dodgeChance', min: 0.04, max: 0.07 }] },

    // ── ❤️ 体魄（Physique） ──────────────────────────────────────
    { id: 'physique-hp',         name: '生命扩展', category: '体魄', color: '#64748B', effects: [{ stat: 'maxHp', min: 30, max: 60 }] },
    { id: 'physique-shield',     name: '护盾扩容', category: '体魄', color: '#22D3EE', effects: [{ stat: 'shieldMax', min: 24, max: 48 }] },
    { id: 'physique-toughness',  name: '坚韧体质', category: '体魄', color: '#475569', effects: [{ stat: 'damageReduction', min: 0.03, max: 0.06 }] },

    // ── 🎯 技巧（Technique） ─────────────────────────────────────
    { id: 'technique-range',     name: '精准瞄准', category: '技巧', color: '#38BDF8', effects: [{ stat: 'attackRange', min: 20, max: 50 }] },
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

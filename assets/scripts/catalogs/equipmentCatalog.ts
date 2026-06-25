import type { EquipmentDef, GearBlueprint, GearRarityDef, StatEffect } from '../core/types';

export const GEAR_RARITIES: GearRarityDef[] = [
    { id: 'common', name: '普通', prefix: '', scale: 1, cost: 1, maxLevel: 6 },
    { id: 'rare', name: '稀有', prefix: '精制', scale: 1.42, cost: 1.72, maxLevel: 8 },
    { id: 'epic', name: '史诗', prefix: '超导', scale: 2.02, cost: 2.85, maxLevel: 10 },
    { id: 'legendary', name: '传奇', prefix: '星铸', scale: 2.78, cost: 4.7, maxLevel: 12 },
    { id: 'mythic', name: '神话', prefix: '神话', scale: 3.66, cost: 7.4, maxLevel: 14 },
];

export const GEAR_BLUEPRINTS: GearBlueprint[] = [
    { id: 'tactical-visor', name: '战术目镜', slot: 'hat', color: '#38BDF8', baseCost: 28, desc: '稳定强化索敌距离和弱点判断。', effects: [{ stat: 'attackRange', amount: 36 }, { stat: 'critChance', amount: 0.012 }] },
    { id: 'ember-crown', name: '燃焰头冠', slot: 'hat', color: '#F3722C', baseCost: 34, desc: '适合对抗火焰怪潮的进攻头冠。', effects: [{ stat: 'fireDefense', amount: 8 }, { stat: 'attackPower', amount: 3 }, { stat: 'iceDefense', amount: -1.5 }] },
    { id: 'storm-hood', name: '雷鸣兜帽', slot: 'hat', color: '#4CC9F0', baseCost: 36, desc: '把雷抗转成更快的武器节奏。', effects: [{ stat: 'lightningDefense', amount: 8 }, { stat: 'attackSpeed', amount: 0.025 }, { stat: 'physicalDefense', amount: -1.5 }] },
    { id: 'venom-mask', name: '防毒面罩', slot: 'hat', color: '#84CC16', baseCost: 32, desc: '降低毒系持续压制并提供少量续航。', effects: [{ stat: 'poisonDefense', amount: 10 }, { stat: 'hpRegen', amount: 0.12 }] },
    { id: 'cryo-helm', name: '寒霜头盔', slot: 'hat', color: '#A7F3D0', baseCost: 34, desc: '以冰抗和护盾稳定正面压力。', effects: [{ stat: 'iceDefense', amount: 9 }, { stat: 'shieldMax', amount: 8 }] },
    { id: 'command-crown', name: '指挥王冠', slot: 'hat', color: '#90BE6D', baseCost: 42, desc: '增强无人机协同和掉落运气。', effects: [{ stat: 'dronePower', amount: 0.55 }, { stat: 'luck', amount: 2 }] },
    { id: 'execution-visor', name: '处决目镜', slot: 'hat', color: '#F59E0B', baseCost: 44, desc: '提升致命判定，适合处理高血量 Boss。', effects: [{ stat: 'lethalChance', amount: 0.004 }, { stat: 'lethalDamage', amount: 0.08 }] },
    { id: 'scholar-band', name: '研习额带', slot: 'hat', color: '#38BDF8', baseCost: 38, desc: '牺牲少量生命换取更快角色成长。', effects: [{ stat: 'xpGain', amount: 0.035 }, { stat: 'pickupRange', amount: 12 }, { stat: 'maxHp', amount: -3 }] },
    { id: 'fortress-helm', name: '堡垒头盔', slot: 'hat', color: '#64748B', baseCost: 40, desc: '重型头盔，提升生存但拖慢移动。', effects: [{ stat: 'physicalDefense', amount: 5 }, { stat: 'maxHp', amount: 8 }, { stat: 'moveSpeed', amount: -3 }] },
    { id: 'prism-helm', name: '棱光头盔', slot: 'hat', color: '#C084FC', baseCost: 46, desc: '提高魔防和暴击倍率，但节奏略慢。', effects: [{ stat: 'magicDefense', amount: 6 }, { stat: 'critDamage', amount: 0.08 }, { stat: 'attackSpeed', amount: -0.01 }] },

    { id: 'phase-armor', name: '相位护甲', slot: 'armor', color: '#F8961E', baseCost: 46, desc: '均衡生命、物防、魔防和冷热抗性。', effects: [{ stat: 'maxHp', amount: 22 }, { stat: 'physicalDefense', amount: 2.2 }, { stat: 'magicDefense', amount: 1 }, { stat: 'fireDefense', amount: 0.8 }, { stat: 'iceDefense', amount: 0.8 }] },
    { id: 'bulwark-carapace', name: '壁垒甲壳', slot: 'armor', color: '#64748B', baseCost: 52, desc: '重型减伤护甲，牺牲机动换硬度。', effects: [{ stat: 'maxHp', amount: 34 }, { stat: 'damageReduction', amount: 0.008 }, { stat: 'moveSpeed', amount: -4 }] },
    { id: 'ember-mail', name: '灼焰胸甲', slot: 'armor', color: '#F3722C', baseCost: 48, desc: '针对火焰远程怪和爆炸怪。', effects: [{ stat: 'fireDefense', amount: 12 }, { stat: 'physicalDefense', amount: 4 }, { stat: 'iceDefense', amount: -2 }] },
    { id: 'storm-mail', name: '雷纹胸甲', slot: 'armor', color: '#4CC9F0', baseCost: 50, desc: '抵御雷电和电弧怪，并加快护盾恢复。', effects: [{ stat: 'lightningDefense', amount: 12 }, { stat: 'shieldRegen', amount: 0.25 }, { stat: 'poisonDefense', amount: -1.5 }] },
    { id: 'toxin-weave', name: '抗毒织甲', slot: 'armor', color: '#84CC16', baseCost: 44, desc: '对毒系持续伤害更稳，同时带回复。', effects: [{ stat: 'poisonDefense', amount: 13 }, { stat: 'hpRegen', amount: 0.18 }] },
    { id: 'frost-plate', name: '寒钢板甲', slot: 'armor', color: '#A7F3D0', baseCost: 50, desc: '强化冰抗和护盾容量。', effects: [{ stat: 'iceDefense', amount: 13 }, { stat: 'shieldMax', amount: 14 }, { stat: 'fireDefense', amount: -2 }] },
    { id: 'arcane-robe', name: '秘法战袍', slot: 'armor', color: '#8B5CF6', baseCost: 54, desc: '面对魔法和 Boss 技能时更稳定。', effects: [{ stat: 'magicDefense', amount: 10 }, { stat: 'shieldMax', amount: 18 }, { stat: 'physicalDefense', amount: -2 }] },
    { id: 'kinetic-vest', name: '动能背心', slot: 'armor', color: '#43AA8B', baseCost: 42, desc: '轻甲路线，兼顾闪避和速度。', effects: [{ stat: 'dodgeChance', amount: 0.008 }, { stat: 'moveSpeed', amount: 6 }, { stat: 'maxHp', amount: 6 }] },
    { id: 'titan-frame', name: '泰坦骨架', slot: 'armor', color: '#475569', baseCost: 60, desc: '极重护甲，大幅抗压但降低节奏。', effects: [{ stat: 'physicalDefense', amount: 9 }, { stat: 'maxHp', amount: 18 }, { stat: 'attackSpeed', amount: -0.015 }, { stat: 'moveSpeed', amount: -5 }] },
    { id: 'living-armor', name: '活体装甲', slot: 'armor', color: '#90BE6D', baseCost: 56, desc: '偏回复和毒抗的生存护甲。', effects: [{ stat: 'hpRegen', amount: 0.35 }, { stat: 'maxHp', amount: 14 }, { stat: 'poisonDefense', amount: 4 }] },

    { id: 'kinetic-boots', name: '动能靴', slot: 'boots', color: '#43AA8B', baseCost: 42, desc: '提高移动速度和闪避空间。', effects: [{ stat: 'moveSpeed', amount: 17 }, { stat: 'dodgeChance', amount: 0.008 }] },
    { id: 'phase-greaves', name: '相位胫甲', slot: 'boots', color: '#2DD4BF', baseCost: 48, desc: '高闪避位移装备，牺牲少量护盾。', effects: [{ stat: 'moveSpeed', amount: 12 }, { stat: 'dodgeChance', amount: 0.014 }, { stat: 'shieldMax', amount: -3 }] },
    { id: 'magnet-treads', name: '磁吸足具', slot: 'boots', color: '#577590', baseCost: 40, desc: '扩大拾取半径并增加资源效率。', effects: [{ stat: 'pickupRange', amount: 28 }, { stat: 'resourceGain', amount: 0.018 }, { stat: 'moveSpeed', amount: -2 }] },
    { id: 'storm-runners', name: '雷暴跑鞋', slot: 'boots', color: '#4CC9F0', baseCost: 46, desc: '雷抗和射击节奏兼顾。', effects: [{ stat: 'lightningDefense', amount: 8 }, { stat: 'attackSpeed', amount: 0.022 }] },
    { id: 'frost-skates', name: '霜滑靴', slot: 'boots', color: '#A7F3D0', baseCost: 44, desc: '冰抗型高速移动鞋。', effects: [{ stat: 'iceDefense', amount: 8 }, { stat: 'moveSpeed', amount: 15 }, { stat: 'fireDefense', amount: -1.5 }] },
    { id: 'ember-spurs', name: '焰刺靴', slot: 'boots', color: '#F3722C', baseCost: 44, desc: '提供火抗和少量进攻属性。', effects: [{ stat: 'fireDefense', amount: 8 }, { stat: 'attackPower', amount: 2.8 }, { stat: 'dodgeChance', amount: -0.002 }] },
    { id: 'toxic-waders', name: '防毒涉靴', slot: 'boots', color: '#84CC16', baseCost: 42, desc: '毒潮和持续伤害环境下更舒服。', effects: [{ stat: 'poisonDefense', amount: 10 }, { stat: 'hpRegen', amount: 0.08 }, { stat: 'moveSpeed', amount: 4 }] },
    { id: 'gravity-boots', name: '重力靴', slot: 'boots', color: '#64748B', baseCost: 46, desc: '用速度换取物防和减伤。', effects: [{ stat: 'physicalDefense', amount: 5 }, { stat: 'damageReduction', amount: 0.006 }, { stat: 'moveSpeed', amount: -3 }] },
    { id: 'scout-sandals', name: '侦察轻履', slot: 'boots', color: '#38BDF8', baseCost: 38, desc: '偏经验和幸运的轻装鞋。', effects: [{ stat: 'xpGain', amount: 0.025 }, { stat: 'luck', amount: 2.5 }, { stat: 'maxHp', amount: -3 }] },
    { id: 'blink-soles', name: '闪现鞋底', slot: 'boots', color: '#C084FC', baseCost: 52, desc: '高闪避鞋底，但防御略低。', effects: [{ stat: 'dodgeChance', amount: 0.02 }, { stat: 'moveSpeed', amount: 10 }, { stat: 'physicalDefense', amount: -2 }] },

    { id: 'magnet-coil', name: '磁吸线圈', slot: 'accessory', color: '#577590', baseCost: 34, desc: '扩大经验和资源拾取范围。', effects: [{ stat: 'pickupRange', amount: 22 }, { stat: 'luck', amount: 1.2 }] },
    { id: 'reactor-core', name: '反应堆芯', slot: 'accessory', color: '#F94144', baseCost: 68, desc: '提高弹速、伤害和后期上限。', effects: [{ stat: 'attackPower', amount: 3.4 }, { stat: 'bulletSpeed', amount: 22 }, { stat: 'maxHp', amount: 9 }, { stat: 'lightningDefense', amount: 1.2 }] },
    { id: 'vampire-chip', name: '汲能芯片', slot: 'accessory', color: '#B5179E', baseCost: 64, desc: '提供回复和毒抗，击杀时仍会少量回血。', effects: [{ stat: 'hpRegen', amount: 0.22 }, { stat: 'poisonDefense', amount: 1.1 }, { stat: 'maxHp', amount: 5 }] },
    { id: 'crit-lattice', name: '暴击晶格', slot: 'accessory', color: '#F15BB5', baseCost: 52, desc: '强化暴击率和暴击倍率。', effects: [{ stat: 'critChance', amount: 0.018 }, { stat: 'critDamage', amount: 0.08 }] },
    { id: 'execution-ring', name: '处决指环', slot: 'accessory', color: '#F59E0B', baseCost: 62, desc: '专门处理高血量 Boss 的致命首饰。', effects: [{ stat: 'lethalChance', amount: 0.005 }, { stat: 'lethalMaxHpPct', amount: 0.004 }, { stat: 'lethalDamage', amount: 0.08 }] },
    { id: 'shield-orb', name: '护盾宝珠', slot: 'accessory', color: '#22D3EE', baseCost: 50, desc: '增加护盾容量和回复。', effects: [{ stat: 'shieldMax', amount: 22 }, { stat: 'shieldRegen', amount: 0.45 }] },
    { id: 'salvage-charm', name: '拾荒护符', slot: 'accessory', color: '#F8961E', baseCost: 48, desc: '用少量攻击换取资源收益。', effects: [{ stat: 'resourceGain', amount: 0.035 }, { stat: 'luck', amount: 4 }, { stat: 'attackPower', amount: -1.5 }] },
    { id: 'learning-prism', name: '经验棱镜', slot: 'accessory', color: '#38BDF8', baseCost: 48, desc: '加快升级节奏，防御略低。', effects: [{ stat: 'xpGain', amount: 0.045 }, { stat: 'pickupRange', amount: 10 }, { stat: 'physicalDefense', amount: -1 }] },
    { id: 'drone-relay', name: '无人机中继', slot: 'accessory', color: '#90BE6D', baseCost: 54, desc: '强化无人机电击和索敌半径。', effects: [{ stat: 'dronePower', amount: 0.7 }, { stat: 'attackRange', amount: 18 }, { stat: 'magicDefense', amount: -1 }] },
    { id: 'element-signet', name: '元素徽记', slot: 'accessory', color: '#14B8A6', baseCost: 58, desc: '均衡四元素抗性和魔防。', effects: [{ stat: 'fireDefense', amount: 5 }, { stat: 'lightningDefense', amount: 5 }, { stat: 'poisonDefense', amount: 5 }, { stat: 'iceDefense', amount: 5 }, { stat: 'magicDefense', amount: 2 }] },
];

function scaleGearEffects(effects: StatEffect[], rarity: GearRarityDef): StatEffect[] {
    const rarityIndex = GEAR_RARITIES.indexOf(rarity);
    const hasTradeoff = effects.some((effect) => effect.amount < 0);
    return effects.map((effect) => {
        const scale = effect.amount < 0
            ? 0.5 + rarityIndex * 0.15
            : rarity.scale * (hasTradeoff ? 1.12 : 1);
        const amount = effect.amount * scale;
        return {
            stat: effect.stat,
            amount: Math.abs(amount) >= 3 ? Number(amount.toFixed(1)) : Number(amount.toFixed(3)),
        };
    });
}

function buildGearCatalog(): EquipmentDef[] {
    const gear: EquipmentDef[] = [];
    for (const blueprint of GEAR_BLUEPRINTS) {
        for (const rarity of GEAR_RARITIES) {
            const common = rarity.id === 'common';
            const id = common ? blueprint.id : `${blueprint.id}-${rarity.id}`;
            gear.push({
                id,
                name: `${rarity.prefix}${blueprint.name}`,
                kind: 'gear',
                gearSlot: blueprint.slot,
                rarity: rarity.name,
                color: blueprint.color,
                maxLevel: rarity.maxLevel,
                baseCost: Math.round(blueprint.baseCost * rarity.cost),
                desc: `${GEAR_SLOT_LABELS[blueprint.slot]}装备。${blueprint.desc}${rarity.name}品质。`,
                gearStats: scaleGearEffects(blueprint.effects, rarity),
            });
        }
    }
    return gear;
}

const GEAR_SLOT_LABELS: Record<string, string> = {
    hat: '帽子',
    armor: '护甲',
    boots: '鞋子',
    accessory: '首饰',
};

export const GEAR_CATALOG: EquipmentDef[] = buildGearCatalog();
export const GEAR_COUNT = GEAR_CATALOG.length;
export const EQUIPMENT: EquipmentDef[] = [...WEAPON_CATALOG, ...GEAR_CATALOG];
export const STARTER_EQUIPMENT_IDS = ['storm-rifle', 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil'];

import { WEAPON_CATALOG } from './weaponCatalog';

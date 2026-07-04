import type { EquipmentDef } from '../core/types';
import { WEAPON_CATALOG, getWeaponFamilyId, getWeaponTierForId } from './weaponCatalog';

export interface EquipmentProgressionState {
    battlesWon: number;
    ownedEquipment: Set<string>;
    equipmentBlueprints?: Record<string, number>;
}

export const WEAPON_FAMILY_UNLOCK_BATTLES: Record<string, number> = {
    'storm-rifle': 0,
    'plague-sprayer': 1,
    'frost-beamer': 2,
    'echo-bow': 1,
    'split-barrel': 2,
    'mirror-prism': 3,
    'quantum-loom': 3,
    'ion-lance': 3,
    'thorn-crossbow': 4,
    'rail-cannon': 4,
    'void-needle': 4,
    'meteor-launcher': 4,
    'orbital-drone': 3,
    'gravity-hammer': 5,
    // ── Legendary（3 把，需 Boss 材料合成）────────────────────
    'void-tearer': 8,
    'icefire-judge': 8,
    'webmaster': 8,
};

export const WEAPON_TIER_UNLOCK_BATTLES: Record<number, number> = {
    1: 0,
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    7: 6,
    8: 7,
    9: 9,
    10: 11,
};

export const GEAR_RARITY_UNLOCK_BATTLES: Record<string, number> = {
    '普通': 0,
    '稀有': 2,
    '史诗': 4,
    '传奇': 6,
    '神话': 8,
};

function completedBattles(state: EquipmentProgressionState): number {
    return Math.max(0, Math.floor(Number(state.battlesWon) || 0));
}

export function getEquipmentBlueprintCount(state: EquipmentProgressionState, equipmentId: string): number {
    return Math.max(0, Math.floor(Number(state.equipmentBlueprints?.[equipmentId]) || 0));
}

export function getEquipmentBlueprintRequirement(equipment: EquipmentDef): number {
    if (equipment.kind !== 'weapon') return 0;
    const tier = getWeaponTierForId(equipment.id);
    if (tier <= 3) return 0;
    if (tier <= 5) return tier - 3;          // T4=1, T5=2
    if (tier <= 7) return tier - 2;          // T6=4, T7=5
    if (tier === 8) return 7;
    if (tier === 9) return 9;
    return 12;                               // T10: long-term chase target
}

export function hasEquipmentBlueprints(state: EquipmentProgressionState, equipment: EquipmentDef): boolean {
    return getEquipmentBlueprintCount(state, equipment.id) >= getEquipmentBlueprintRequirement(equipment);
}

export function formatEquipmentBlueprintProgress(state: EquipmentProgressionState, equipment: EquipmentDef): string {
    const required = getEquipmentBlueprintRequirement(equipment);
    if (required <= 0 || state.ownedEquipment.has(equipment.id)) return '';
    return `蓝图 ${getEquipmentBlueprintCount(state, equipment.id)}/${required}（Boss 低概率掉落）`;
}

export function hasOwnedWeaponFamilyTier(state: EquipmentProgressionState, familyId: string, minTier: number, maxTier: number): boolean {
    return WEAPON_CATALOG.some((weapon) => state.ownedEquipment.has(weapon.id)
        && getWeaponFamilyId(weapon.id) === familyId
        && getWeaponTierForId(weapon.id) >= minTier
        && getWeaponTierForId(weapon.id) <= maxTier);
}

export function getEquipmentUnlockReason(state: EquipmentProgressionState, equipment: EquipmentDef): string {
    if (state.ownedEquipment.has(equipment.id)) return '';
    const battles = completedBattles(state);
    if (equipment.kind === 'weapon') {
        const familyId = getWeaponFamilyId(equipment.id);
        const familyBattle = WEAPON_FAMILY_UNLOCK_BATTLES[familyId] ?? 99;
        if (battles < familyBattle) return `需完成 ${familyBattle} 次出击后发现该武器系。`;
        const tier = getWeaponTierForId(equipment.id);
        const tierBattle = WEAPON_TIER_UNLOCK_BATTLES[tier] ?? 99;
        if (battles < tierBattle) return `T${tier} 蓝图需完成 ${tierBattle} 次出击后解锁。`;
        if (tier >= 2 && !hasOwnedWeaponFamilyTier(state, familyId, 1, tier - 1)) {
            return '需先拥有该武器系的低阶型号。';
        }
        if (tier >= 9 && !hasOwnedWeaponFamilyTier(state, familyId, 8, tier - 1)) {
            return '需先拥有该武器系的高阶型号。';
        }
        const requiredBlueprints = getEquipmentBlueprintRequirement(equipment);
        const ownedBlueprints = getEquipmentBlueprintCount(state, equipment.id);
        if (ownedBlueprints < requiredBlueprints) {
            return `蓝图不足：${ownedBlueprints}/${requiredBlueprints}，Boss 低概率掉落。`;
        }
        return '';
    }

    const rarity = equipment.rarity || '普通';
    const requiredBattles = GEAR_RARITY_UNLOCK_BATTLES[rarity] ?? 0;
    if (battles < requiredBattles) return `${rarity}装备需完成 ${requiredBattles} 次出击后发现。`;
    return '';
}

export function isEquipmentDiscoverable(state: EquipmentProgressionState, equipment: EquipmentDef): boolean {
    if (state.ownedEquipment.has(equipment.id)) return true;
    const battles = completedBattles(state);
    if (equipment.kind === 'weapon') {
        const familyBattle = WEAPON_FAMILY_UNLOCK_BATTLES[getWeaponFamilyId(equipment.id)] ?? 99;
        const tierBattle = WEAPON_TIER_UNLOCK_BATTLES[getWeaponTierForId(equipment.id)] ?? 99;
        return battles >= familyBattle && battles >= tierBattle;
    }
    const requiredBattles = GEAR_RARITY_UNLOCK_BATTLES[equipment.rarity || '普通'] ?? 0;
    return battles >= requiredBattles;
}

export function isEquipmentCraftable(state: EquipmentProgressionState, equipment: EquipmentDef): boolean {
    return isEquipmentDiscoverable(state, equipment) && getEquipmentUnlockReason(state, equipment) === '';
}

export function isEquipmentLootEligible(state: EquipmentProgressionState, equipment: EquipmentDef, rare: boolean): boolean {
    if (state.ownedEquipment.has(equipment.id)) return false;
    if (!isEquipmentDiscoverable(state, equipment)) return false;
    if (equipment.kind === 'weapon') {
        const tier = getWeaponTierForId(equipment.id);
        return tier <= (rare ? 3 : 2);
    }
    const rarity = equipment.rarity || '普通';
    return rare ? rarity !== '神话' : rarity === '普通' || rarity === '稀有';
}

import type { EquipmentDef, ResourceWallet } from '../core/types';
import { createEmptyWallet } from '../core/resources';
import { EQUIPMENT } from './equipmentCatalog';

export type EquipmentLootChoiceKind = 'unlock' | 'upgrade' | 'resource-box' | 'calibrate';

export interface EquipmentLootState {
    ownedEquipment: Set<string>;
    equipmentLevels: Record<string, number>;
    battleIndex: number;
    getEquipmentLevel(id: string): number;
    isEquipmentLootEligible(equipment: EquipmentDef, rare: boolean): boolean;
}

export interface EquipmentLootApplyState {
    ownedEquipment: Set<string>;
    equipmentLevels: Record<string, number>;
    getEquipmentLevel(id: string): number;
    addResources(wallet: ResourceWallet): void;
}

export interface EquipmentLootChoiceSpec {
    kind: EquipmentLootChoiceKind;
    title: string;
    desc: string;
    color: string;
    equipment?: EquipmentDef;
    resourceReward?: ResourceWallet;
}

export type EquipmentShuffle = <T>(items: T[]) => T[];

export function shouldOfferEquipmentLoot(bossKills: number): boolean {
    return Math.max(0, Math.floor(Number(bossKills) || 0)) > 0;
}

export function buildResourceBoxReward(battleIndex: number): ResourceWallet {
    const reward = createEmptyWallet();
    const safeBattleIndex = Math.max(0, Math.floor(Number(battleIndex) || 0));
    reward.shards = 8 + safeBattleIndex * 2;
    reward.biomass = 5 + safeBattleIndex;
    reward.circuits = 4 + Math.floor(safeBattleIndex / 2);
    reward.cores = 1;
    return reward;
}

export function buildCalibrationFallbackReward(): ResourceWallet {
    const reward = createEmptyWallet();
    reward.shards = 10;
    reward.cores = 1;
    return reward;
}

export function createEquipmentLootChoiceSpecs(
    state: EquipmentLootState,
    shuffle: EquipmentShuffle,
    rare = true,
    catalog: EquipmentDef[] = EQUIPMENT,
): EquipmentLootChoiceSpec[] {
    const choices: EquipmentLootChoiceSpec[] = [];
    const locked = shuffle(catalog.filter((equipment) => {
        if (state.ownedEquipment.has(equipment.id)) return false;
        return state.isEquipmentLootEligible(equipment, rare);
    }));
    if (locked.length > 0) {
        const unlock = locked[0];
        choices.push({
            kind: 'unlock',
            title: `新装备：${unlock.name}`,
            desc: unlock.desc,
            color: unlock.color,
            equipment: unlock,
        });
    }

    const ownedUpgradable = shuffle(catalog.filter((equipment) =>
        state.ownedEquipment.has(equipment.id) && state.getEquipmentLevel(equipment.id) < equipment.maxLevel
    ));
    for (const equipment of ownedUpgradable.slice(0, 2)) {
        choices.push({
            kind: 'upgrade',
            title: `强化：${equipment.name}`,
            desc: `免费升 1 级。${equipment.desc}`,
            color: equipment.color,
            equipment,
        });
    }

    choices.push({
        kind: 'resource-box',
        title: '资源箱',
        desc: '立刻获得装备碎片、生体样本、电路板和 1 核心。',
        color: '#43AA8B',
        resourceReward: buildResourceBoxReward(state.battleIndex),
    });

    while (choices.length < 3 && catalog.length > 0) {
        const equipment = ownedUpgradable[choices.length % Math.max(1, ownedUpgradable.length)] || catalog[0];
        choices.push({
            kind: 'calibrate',
            title: `校准：${equipment.name}`,
            desc: '免费升 1 级，若已满级则转化为装备碎片和核心。',
            color: equipment.color,
            equipment,
        });
    }

    return shuffle(choices).slice(0, 3);
}

export function applyEquipmentLootChoiceSpec(state: EquipmentLootApplyState, spec: EquipmentLootChoiceSpec): void {
    if (spec.kind === 'resource-box') {
        state.addResources(spec.resourceReward || buildResourceBoxReward(0));
        return;
    }

    const equipment = spec.equipment;
    if (!equipment) return;

    if (spec.kind === 'unlock') {
        state.ownedEquipment.add(equipment.id);
        state.equipmentLevels[equipment.id] = Math.max(1, state.getEquipmentLevel(equipment.id));
        return;
    }

    if (spec.kind === 'upgrade') {
        state.equipmentLevels[equipment.id] = Math.min(equipment.maxLevel, state.getEquipmentLevel(equipment.id) + 1);
        return;
    }

    if (state.getEquipmentLevel(equipment.id) < equipment.maxLevel) {
        state.equipmentLevels[equipment.id] = state.getEquipmentLevel(equipment.id) + 1;
    } else {
        state.addResources(buildCalibrationFallbackReward());
    }
}

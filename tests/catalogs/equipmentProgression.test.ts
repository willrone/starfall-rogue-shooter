import assert from 'node:assert/strict';
import { STARTER_EQUIPMENT_IDS, EQUIPMENT } from '../../assets/scripts/catalogs/equipmentCatalog';
import { WEAPON_CATALOG } from '../../assets/scripts/catalogs/weaponCatalog';
import {
    formatEquipmentBlueprintProgress,
    getEquipmentBlueprintRequirement,
    getEquipmentUnlockReason,
    isEquipmentCraftable,
    isEquipmentDiscoverable,
    isEquipmentLootEligible,
    type EquipmentProgressionState,
} from '../../assets/scripts/catalogs/equipmentProgression';
import type { EquipmentDef } from '../../assets/scripts/core/types';

function weapon(id: string): EquipmentDef {
    const found = WEAPON_CATALOG.find((entry) => entry.id === id);
    assert(found, `Expected weapon ${id} to exist`);
    return found!;
}

function equipment(id: string): EquipmentDef {
    const found = EQUIPMENT.find((entry) => entry.id === id);
    assert(found, `Expected equipment ${id} to exist`);
    return found!;
}

function state(partial: Partial<EquipmentProgressionState> = {}): EquipmentProgressionState {
    return {
        battlesWon: 0,
        ownedEquipment: new Set(STARTER_EQUIPMENT_IDS),
        equipmentBlueprints: {},
        ...partial,
    };
}

function testFamilyUnlocksGateDiscovery() {
    const splitBarrel = weapon('split-barrel');
    assert.equal(isEquipmentDiscoverable(state({ battlesWon: 1 }), splitBarrel), false,
        'split-barrel family should not be discoverable before its unlock battle');
    assert.equal(isEquipmentDiscoverable(state({ battlesWon: 2 }), splitBarrel), true,
        'split-barrel family should be discoverable once its battle gate is met');
    assert.equal(isEquipmentCraftable(state({ battlesWon: 2 }), splitBarrel), true,
        'T1 family weapon should be craftable after discovery because it has no blueprint requirement');
}

function testHighTierWeaponsNeedBlueprintsAndPreviousTiers() {
    const starfall = weapon('storm-rifle-starfall');
    const enoughBattles = 11;
    assert.equal(getEquipmentBlueprintRequirement(starfall), 12, 'T10 should be a long-term blueprint chase');

    const noPreviousTier = state({ battlesWon: enoughBattles });
    assert.equal(isEquipmentDiscoverable(noPreviousTier, starfall), true,
        'T10 may be discoverable after battle gates, but still not craftable');
    assert.match(getEquipmentUnlockReason(noPreviousTier, starfall), /高阶型号/,
        'T9+ should require an owned T8/T9 family model before blueprint checks matter');
    assert.equal(isEquipmentCraftable(noPreviousTier, starfall), false);

    const previousTierNoBlueprints = state({
        battlesWon: enoughBattles,
        ownedEquipment: new Set([...STARTER_EQUIPMENT_IDS, 'storm-rifle-overclock']),
    });
    assert.match(getEquipmentUnlockReason(previousTierNoBlueprints, starfall), /蓝图不足：0\/12/);
    assert.equal(isEquipmentCraftable(previousTierNoBlueprints, starfall), false);

    const previousTierAndBlueprints = state({
        battlesWon: enoughBattles,
        ownedEquipment: new Set([...STARTER_EQUIPMENT_IDS, 'storm-rifle-overclock']),
        equipmentBlueprints: { [starfall.id]: 12 },
    });
    assert.equal(getEquipmentUnlockReason(previousTierAndBlueprints, starfall), '');
    assert.equal(isEquipmentCraftable(previousTierAndBlueprints, starfall), true);
}

function testChestLootStaysLowTier() {
    const t2 = weapon('storm-rifle-light');
    const t3 = weapon('storm-rifle-pulse');
    const t10 = weapon('storm-rifle-starfall');
    const progress = state({ battlesWon: 11 });

    assert.equal(isEquipmentLootEligible(progress, t2, false), true,
        'common chest may offer low-tier unlocked weapons');
    assert.equal(isEquipmentLootEligible(progress, t3, false), false,
        'common chest should not offer T3+ weapons');
    assert.equal(isEquipmentLootEligible(progress, t3, true), true,
        'rare chest may stretch to T3 weapons');
    assert.equal(isEquipmentLootEligible(progress, t10, true), false,
        'rare chest must never jump to chase-tier weapons');
}

function testGearRarityDiscoveryAndLoot() {
    const mythicVisor = equipment('tactical-visor-mythic');
    assert.equal(isEquipmentDiscoverable(state({ battlesWon: 7 }), mythicVisor), false,
        'mythic gear should stay hidden before its battle gate');
    assert.equal(isEquipmentDiscoverable(state({ battlesWon: 8 }), mythicVisor), true,
        'mythic gear should become visible at its battle gate');
    assert.equal(isEquipmentLootEligible(state({ battlesWon: 8 }), mythicVisor, true), false,
        'even rare chest loot should exclude mythic gear');
}

function testBlueprintProgressFormatting() {
    const t8 = weapon('storm-rifle-overclock');
    const progress = state({ battlesWon: 7, equipmentBlueprints: { [t8.id]: 3 } });
    assert.equal(formatEquipmentBlueprintProgress(progress, t8), '蓝图 3/7（Boss 低概率掉落）');
}

testFamilyUnlocksGateDiscovery();
testHighTierWeaponsNeedBlueprintsAndPreviousTiers();
testChestLootStaysLowTier();
testGearRarityDiscoveryAndLoot();
testBlueprintProgressFormatting();

console.log('equipmentProgression tests passed.');

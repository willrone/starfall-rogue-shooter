import assert from 'node:assert/strict';
import { STARTER_EQUIPMENT_IDS, EQUIPMENT } from '../../assets/scripts/catalogs/equipmentCatalog';
import { WEAPON_CATALOG } from '../../assets/scripts/catalogs/weaponCatalog';
import {
    applyEquipmentLootChoiceSpec,
    buildResourceBoxReward,
    createEquipmentLootChoiceSpecs,
    shouldOfferEquipmentLoot,
    type EquipmentLootChoiceSpec,
} from '../../assets/scripts/catalogs/equipmentLootChoices';
import {
    isEquipmentLootEligible,
    type EquipmentProgressionState,
} from '../../assets/scripts/catalogs/equipmentProgression';
import { createEmptyWallet } from '../../assets/scripts/core/resources';
import type { EquipmentDef, ResourceWallet } from '../../assets/scripts/core/types';

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

function identityShuffle<T>(items: T[]): T[] {
    return [...items];
}

function makeProgress(overrides: Partial<EquipmentProgressionState> = {}): EquipmentProgressionState {
    return {
        battlesWon: 11,
        ownedEquipment: new Set(STARTER_EQUIPMENT_IDS),
        equipmentBlueprints: {},
        ...overrides,
    };
}

function levelReader(levels: Record<string, number>, owned: Set<string>) {
    return (id: string) => owned.has(id) ? Math.max(1, Math.floor(levels[id] || 1)) : 0;
}

function testCommonLootDoesNotOfferT3OrChaseTier() {
    const owned = new Set(STARTER_EQUIPMENT_IDS);
    const levels: Record<string, number> = Object.fromEntries([...owned].map((id) => [id, 1]));
    const progress = makeProgress({ ownedEquipment: owned });
    const catalog = [
        weapon('storm-rifle-starfall'),
        weapon('storm-rifle-pulse'),
        weapon('storm-rifle-light'),
        equipment('tactical-visor'),
    ];

    const specs = createEquipmentLootChoiceSpecs({
        ownedEquipment: owned,
        equipmentLevels: levels,
        battleIndex: 3,
        getEquipmentLevel: levelReader(levels, owned),
        isEquipmentLootEligible: (item, rare) => isEquipmentLootEligible(progress, item, rare),
    }, identityShuffle, false, catalog);

    assert.equal(specs.length, 3, 'loot should always present three choices when catalog is non-empty');
    assert(specs.some((spec) => spec.kind === 'unlock' && spec.equipment?.id === 'storm-rifle-light'),
        'common loot should offer eligible T2 weapon from unlocked family');
    assert(!specs.some((spec) => spec.equipment?.id === 'storm-rifle-pulse'),
        'common loot should not offer T3 weapon');
    assert(!specs.some((spec) => spec.equipment?.id === 'storm-rifle-starfall'),
        'common loot should not offer chase-tier weapon');
}

function testRareLootMayOfferT3ButStillBlocksChaseTier() {
    const owned = new Set(STARTER_EQUIPMENT_IDS);
    const levels: Record<string, number> = Object.fromEntries([...owned].map((id) => [id, 1]));
    const progress = makeProgress({ ownedEquipment: owned });
    const catalog = [
        weapon('storm-rifle-starfall'),
        weapon('storm-rifle-pulse'),
        equipment('tactical-visor'),
    ];

    const specs = createEquipmentLootChoiceSpecs({
        ownedEquipment: owned,
        equipmentLevels: levels,
        battleIndex: 3,
        getEquipmentLevel: levelReader(levels, owned),
        isEquipmentLootEligible: (item, rare) => isEquipmentLootEligible(progress, item, rare),
    }, identityShuffle, true, catalog);

    assert(specs.some((spec) => spec.kind === 'unlock' && spec.equipment?.id === 'storm-rifle-pulse'),
        'rare loot may offer T3 weapon');
    assert(!specs.some((spec) => spec.equipment?.id === 'storm-rifle-starfall'),
        'rare loot should still block chase-tier weapon');
}

function testResourceBoxRewardScalesWithBattleIndex() {
    assert.equal(shouldOfferEquipmentLoot(0), false, 'no boss kills means no settlement equipment loot');
    assert.equal(shouldOfferEquipmentLoot(1), true, 'at least one boss kill should open settlement equipment loot');

    const reward = buildResourceBoxReward(4);
    assert.deepEqual(
        { shards: reward.shards, biomass: reward.biomass, circuits: reward.circuits, cores: reward.cores, crystals: reward.crystals },
        { shards: 16, biomass: 9, circuits: 6, cores: 1, crystals: 0 },
    );
}

function testApplyUnlockUpgradeAndCalibrationFallback() {
    const owned = new Set<string>([]);
    const levels: Record<string, number> = {};
    let resources: ResourceWallet = createEmptyWallet();
    const storm = weapon('storm-rifle');

    const applyState = {
        ownedEquipment: owned,
        equipmentLevels: levels,
        getEquipmentLevel: levelReader(levels, owned),
        addResources: (wallet: ResourceWallet) => {
            resources.shards += wallet.shards;
            resources.biomass += wallet.biomass;
            resources.circuits += wallet.circuits;
            resources.cores += wallet.cores;
            resources.crystals += wallet.crystals;
        },
    };

    const unlock: EquipmentLootChoiceSpec = { kind: 'unlock', title: '', desc: '', color: '', equipment: storm };
    applyEquipmentLootChoiceSpec(applyState, unlock);
    assert(owned.has('storm-rifle'), 'unlock choice should add equipment ownership');
    assert.equal(levels['storm-rifle'], 1, 'unlock choice should initialize equipment level');

    const upgrade: EquipmentLootChoiceSpec = { kind: 'upgrade', title: '', desc: '', color: '', equipment: storm };
    applyEquipmentLootChoiceSpec(applyState, upgrade);
    assert.equal(levels['storm-rifle'], 2, 'upgrade choice should raise level by one');

    levels['storm-rifle'] = storm.maxLevel;
    const calibrate: EquipmentLootChoiceSpec = { kind: 'calibrate', title: '', desc: '', color: '', equipment: storm };
    applyEquipmentLootChoiceSpec(applyState, calibrate);
    assert.equal(levels['storm-rifle'], storm.maxLevel, 'calibration should not exceed max level');
    assert.equal(resources.shards, 10, 'max-level calibration should convert to shards');
    assert.equal(resources.cores, 1, 'max-level calibration should convert to one core');
}

testCommonLootDoesNotOfferT3OrChaseTier();
testRareLootMayOfferT3ButStillBlocksChaseTier();
testResourceBoxRewardScalesWithBattleIndex();
testApplyUnlockUpgradeAndCalibrationFallback();

console.log('equipmentLootChoices tests passed.');

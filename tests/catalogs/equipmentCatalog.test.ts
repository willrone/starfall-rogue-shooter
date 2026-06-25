import assert from 'node:assert/strict';
import {
    GEAR_RARITIES,
    GEAR_BLUEPRINTS,
    GEAR_CATALOG,
    GEAR_COUNT,
    EQUIPMENT,
    STARTER_EQUIPMENT_IDS,
} from '../../assets/scripts/catalogs/equipmentCatalog';

function testGearCatalogCount() {
    // 40 blueprints × 5 rarities = 200 gear items
    assert(GEAR_COUNT === GEAR_BLUEPRINTS.length * GEAR_RARITIES.length,
        `GEAR_COUNT should be ${GEAR_BLUEPRINTS.length * GEAR_RARITIES.length}, got ${GEAR_COUNT}`);
    assert(GEAR_CATALOG.length === GEAR_COUNT, 'GEAR_CATALOG length must match GEAR_COUNT');
}

function testGearIdsAreUnique() {
    const ids = GEAR_CATALOG.map(g => g.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate gear IDs: ${ids.length - unique.size}`);
}

function testGearKind() {
    for (const gear of GEAR_CATALOG) {
        assert(gear.kind === 'gear', `Gear ${gear.id} should have kind 'gear'`);
        assert(gear.gearSlot !== undefined, `Gear ${gear.id} should have gearSlot`);
    }
}

function testGearRarityScaling() {
    // Mythic should cost more than common for same blueprint
    const bp = GEAR_BLUEPRINTS[0]; // tactical-visor
    const common = GEAR_CATALOG.find(g => g.id === bp.id);
    const mythic = GEAR_CATALOG.find(g => g.id === `${bp.id}-mythic`);
    assert(common && mythic, 'Should find common and mythic variants');
    assert(mythic!.baseCost > common!.baseCost,
        `Mythic ${mythic!.baseCost} should cost more than common ${common!.baseCost}`);
}

function testEquipmentIncludesWeaponsAndGear() {
    // EQUIPMENT = WEAPON_CATALOG + GEAR_CATALOG
    assert(EQUIPMENT.length >= GEAR_COUNT, 'EQUIPMENT should include at least all gear');
    const weaponCount = EQUIPMENT.filter(e => e.kind === 'weapon').length;
    const gearCount = EQUIPMENT.filter(e => e.kind === 'gear').length;
    assert(weaponCount > 0, 'EQUIPMENT should include weapons');
    assert(gearCount === GEAR_COUNT, `EQUIPMENT gear count should be ${GEAR_COUNT}, got ${gearCount}`);
}

function testStarterEquipmentExists() {
    for (const starterId of STARTER_EQUIPMENT_IDS) {
        const found = EQUIPMENT.find(e => e.id === starterId);
        assert(found, `Starter equipment ${starterId} should exist in EQUIPMENT`);
    }
}

function testGearSlotCoverage() {
    const slots = new Set(GEAR_CATALOG.map(g => g.gearSlot));
    assert(slots.has('hat'), 'Should have hat slot');
    assert(slots.has('armor'), 'Should have armor slot');
    assert(slots.has('boots'), 'Should have boots slot');
    assert(slots.has('accessory'), 'Should have accessory slot');
    assert(slots.size === 4, `Should have exactly 4 slots, got ${slots.size}`);
}

// Run all tests
testGearCatalogCount();
testGearIdsAreUnique();
testGearKind();
testGearRarityScaling();
testEquipmentIncludesWeaponsAndGear();
testStarterEquipmentExists();
testGearSlotCoverage();

console.log('equipmentCatalog tests passed.');

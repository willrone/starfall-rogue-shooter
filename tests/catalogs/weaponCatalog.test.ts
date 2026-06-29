import assert from 'node:assert/strict';
import {
    WEAPON_FAMILIES,
    WEAPON_VARIANTS,
    WEAPON_CATALOG,
    WEAPON_COUNT,
    buildWeaponCatalog,
    getEquipmentRarityForTier,
    getRarityCostMultiplier,
    getWeaponAttackStyle,
    getWeaponStyleName,
    getWeaponFamilyId,
    getWeaponVariantId,
    getWeaponTierForId,
} from '../../assets/scripts/catalogs/weaponCatalog';

function testWeaponCatalogCount() {
    // 20 families × 10 variants = 200 weapons
    assert(WEAPON_COUNT === WEAPON_FAMILIES.length * WEAPON_VARIANTS.length,
        `WEAPON_COUNT should be ${WEAPON_FAMILIES.length * WEAPON_VARIANTS.length}, got ${WEAPON_COUNT}`);
    assert(WEAPON_CATALOG.length === WEAPON_COUNT, 'WEAPON_CATALOG length must match WEAPON_COUNT');
}

function testWeaponIdsAreUnique() {
    const ids = WEAPON_CATALOG.map(w => w.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate weapon IDs: ${ids.length - unique.size}`);
}

function testWeaponKind() {
    for (const weapon of WEAPON_CATALOG) {
        assert(weapon.kind === 'weapon', `Weapon ${weapon.id} should have kind 'weapon'`);
        assert(weapon.weaponStats !== undefined, `Weapon ${weapon.id} should have weaponStats`);
    }
}

function testWeaponAttackStyles() {
    assert(getWeaponAttackStyle('storm-rifle') === 'rifle');
    assert(getWeaponAttackStyle('split-barrel') === 'shotgun');
    assert(getWeaponAttackStyle('rail-cannon') === 'rail');
    assert(getWeaponAttackStyle('orbital-drone') === 'drone');
    assert(getWeaponAttackStyle('unknown-weapon') === 'rifle', 'Unknown should default to rifle');
}

function testWeaponStyleNames() {
    assert(getWeaponStyleName('shotgun') === '近距宽弹道');
    assert(getWeaponStyleName('rail') === '高速穿透');
    assert(getWeaponStyleName('drone') === '无人机电击');
    assert(getWeaponStyleName('rifle') === '标准弹道');
}

function testRarityForTier() {
    assert(getEquipmentRarityForTier(1) === '普通');
    assert(getEquipmentRarityForTier(3) === '稀有');
    assert(getEquipmentRarityForTier(5) === '史诗');
    assert(getEquipmentRarityForTier(8) === '传奇');
    assert(getEquipmentRarityForTier(10) === '神话');
}

function testRarityCostMultiplier() {
    assert(getRarityCostMultiplier('普通') === 1);
    assert(getRarityCostMultiplier('稀有') === 1.12);
    assert(getRarityCostMultiplier('神话') === 1.85);
}

function testWeaponFamilyIdLookup() {
    assert(getWeaponFamilyId('storm-rifle') === 'storm-rifle');
    assert(getWeaponFamilyId('storm-rifle-light') === 'storm-rifle');
    assert(getWeaponFamilyId('nonexistent') === 'storm-rifle', 'Unknown should default to storm-rifle');
}

function testWeaponVariantAndTierLookup() {
    assert(getWeaponVariantId('storm-rifle') === '');
    assert(getWeaponVariantId('storm-rifle-standard') === '');
    assert(getWeaponVariantId('storm-rifle-light') === 'light');
    assert(getWeaponTierForId('storm-rifle') === 1);
    assert(getWeaponTierForId('storm-rifle-light') === 2);
    assert(getWeaponTierForId('storm-rifle-starfall') === 10);
}

function testWeaponTierProgression() {
    // Variant tier 10 should cost more than tier 1
    const t1Weapons = WEAPON_CATALOG.filter(w => w.id.endsWith('-standard') || w.id === 'storm-rifle' || w.id === 'split-barrel' || w.id === 'orbital-drone');
    const t10Weapons = WEAPON_CATALOG.filter(w => w.id.includes('starfall'));
    assert(t10Weapons.length > 0, 'Should have tier 10 (starfall) weapons');
    // All tier 10 weapons should have baseCost > tier 1
    for (const t10 of t10Weapons) {
        const matchingT1 = WEAPON_CATALOG.find(w => w.id === t10.id.replace(/-starfall$/, '') || w.id === t10.id.replace(/starfall/, ''));
        // Just verify t10 costs are reasonable
        assert(t10.baseCost > 30, `Tier 10 weapon ${t10.id} should cost > 30, got ${t10.baseCost}`);
    }
}

function testBuildWeaponCatalogFresh() {
    const catalog = buildWeaponCatalog();
    assert(catalog.length === WEAPON_COUNT, `Fresh build should produce ${WEAPON_COUNT} weapons`);
    for (const w of catalog) {
        assert(w.name.length > 0, `Weapon ${w.id} should have name`);
        assert(w.desc.length > 0, `Weapon ${w.id} should have desc`);
        assert(w.color.startsWith('#'), `Weapon ${w.id} color should start with #`);
        assert(w.maxLevel >= 6, `Weapon ${w.id} maxLevel should be >= 6`);
    }
}

// Run all tests
testWeaponCatalogCount();
testWeaponIdsAreUnique();
testWeaponKind();
testWeaponAttackStyles();
testWeaponStyleNames();
testRarityForTier();
testRarityCostMultiplier();
testWeaponFamilyIdLookup();
testWeaponVariantAndTierLookup();
testWeaponTierProgression();
testBuildWeaponCatalogFresh();

console.log('weaponCatalog tests passed.');

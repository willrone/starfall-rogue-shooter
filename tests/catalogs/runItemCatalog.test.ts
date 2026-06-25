import assert from 'node:assert/strict';
import {
    RUN_ITEMS,
    RUN_ITEM_COUNT,
    LEVEL_UPGRADES,
    STAT_UPGRADE_COUNT,
    RUN_ITEM_BLUEPRINTS,
    STAT_UPGRADE_BLUEPRINTS,
    ITEM_TIER_NAMES,
    TRADEOFF_POSITIVE_BONUS,
    buildRunItemCatalog,
    buildStatUpgradeCatalog,
    scaleRunItemEffect,
    scaleRunItemEffects,
    scaleStatUpgradeEffect,
    formatRunItemEffect,
} from '../../assets/scripts/catalogs/runItemCatalog';

function testRunItemCatalogCount() {
    // 30 blueprints × 5 tiers = 150 run items
    assert(RUN_ITEM_COUNT === RUN_ITEM_BLUEPRINTS.length * ITEM_TIER_NAMES.length,
        `RUN_ITEM_COUNT should be ${RUN_ITEM_BLUEPRINTS.length * ITEM_TIER_NAMES.length}, got ${RUN_ITEM_COUNT}`);
    assert(RUN_ITEMS.length === RUN_ITEM_COUNT, 'RUN_ITEMS length must match RUN_ITEM_COUNT');
}

function testStatUpgradeCatalogCount() {
    // 23 blueprints × 5 tiers = 115 stat upgrades
    assert(STAT_UPGRADE_COUNT === STAT_UPGRADE_BLUEPRINTS.length * ITEM_TIER_NAMES.length,
        `STAT_UPGRADE_COUNT should be ${STAT_UPGRADE_BLUEPRINTS.length * ITEM_TIER_NAMES.length}, got ${STAT_UPGRADE_COUNT}`);
    assert(LEVEL_UPGRADES.length === STAT_UPGRADE_COUNT, 'LEVEL_UPGRADES length must match STAT_UPGRADE_COUNT');
}

function testRunItemIdsAreUnique() {
    const ids = RUN_ITEMS.map(item => item.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate run item IDs found: ${ids.length - unique.size} duplicates`);
}

function testStatUpgradeIdsAreUnique() {
    const ids = LEVEL_UPGRADES.map(item => item.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate stat upgrade IDs found: ${ids.length - unique.size} duplicates`);
}

function testRunItemTierProgression() {
    // Higher tiers should have higher positive effects
    const blueprint = RUN_ITEM_BLUEPRINTS[0]; // charged-magazine
    const tier1 = RUN_ITEMS.find(item => item.id === `${blueprint.id}-1`);
    const tier5 = RUN_ITEMS.find(item => item.id === `${blueprint.id}-5`);
    assert(tier1 && tier5, 'Should find tier 1 and tier 5 items');
    // attackPower is positive, tier 5 should be > tier 1
    const t1Atk = tier1!.effects.find(e => e.stat === 'attackPower');
    const t5Atk = tier5!.effects.find(e => e.stat === 'attackPower');
    assert(t1Atk && t5Atk, 'Should have attackPower effect');
    assert(t5Atk!.amount > t1Atk!.amount, `Tier 5 atk (${t5Atk!.amount}) should exceed tier 1 (${t1Atk!.amount})`);
}

function testScaleRunItemEffectPositive() {
    const effect = { stat: 'attackPower' as const, amount: 10 };
    const scaled = scaleRunItemEffect(effect, 1);
    assert(scaled.amount === 10, `Tier 1 positive should be unchanged: got ${scaled.amount}`);

    const scaled3 = scaleRunItemEffect(effect, 3);
    // SCALE_POSITIVE(3) = 1 + 2*0.52 = 2.04 → 10*2.04 = 20.4 → round to 20
    assert(scaled3.amount === 20, `Tier 3 positive should be ~20: got ${scaled3.amount}`);
}

function testScaleRunItemEffectNegative() {
    const effect = { stat: 'moveSpeed' as const, amount: -10 };
    const scaled = scaleRunItemEffect(effect, 3);
    // SCALE_NEGATIVE(3) = 0.45 + 2*0.24 = 0.93 → -10*0.93 = -9.3 → round to -9
    assert(scaled.amount === -9, `Tier 3 negative should be ~-9: got ${scaled.amount}`);
}

function testScaleRunItemEffectTradeoff() {
    const effect = { stat: 'attackPower' as const, amount: 10 };
    const scaled = scaleRunItemEffect(effect, 2, true);
    // SCALE_POSITIVE(2) = 1 + 0.52 = 1.52, tradeoff bonus 1.24 → 1.52*1.24 = 1.8848 → 10*1.8848 = 18.848 → round to 19
    assert(scaled.amount === 19, `Tradeoff tier 2 should be ~19: got ${scaled.amount}`);
}

function testFormatRunItemEffect() {
    const atkEffect = { stat: 'attackPower' as const, amount: 10 };
    const formatted = formatRunItemEffect(atkEffect);
    assert(formatted.includes('+10'), `Should contain +10: got "${formatted}"`);

    const negEffect = { stat: 'moveSpeed' as const, amount: -5 };
    const negFormatted = formatRunItemEffect(negEffect);
    assert(negFormatted.includes('-5'), `Should contain -5: got "${negFormatted}"`);
}

function testBuildRunItemCatalogFresh() {
    const catalog = buildRunItemCatalog();
    assert(catalog.length === RUN_ITEM_COUNT, `Fresh build should produce ${RUN_ITEM_COUNT} items, got ${catalog.length}`);
    // Each item should have required fields
    for (const item of catalog) {
        assert(item.id.length > 0, `Item should have non-empty id`);
        assert(item.name.length > 0, `Item ${item.id} should have non-empty name`);
        assert(item.effects.length > 0, `Item ${item.id} should have effects`);
        assert(item.tier >= 1 && item.tier <= 5, `Item ${item.id} tier should be 1-5, got ${item.tier}`);
    }
}

function testBuildStatUpgradeCatalogFresh() {
    const catalog = buildStatUpgradeCatalog();
    assert(catalog.length === STAT_UPGRADE_COUNT, `Fresh build should produce ${STAT_UPGRADE_COUNT} upgrades, got ${catalog.length}`);
    for (const item of catalog) {
        assert(item.id.startsWith('stat-'), `Stat upgrade ${item.id} should start with 'stat-'`);
        assert(item.effects.length > 0, `Stat upgrade ${item.id} should have effects`);
    }
}

function testScaleStatUpgradeEffect() {
    const effect = { stat: 'attackPower' as const, amount: 16 };
    const scaled1 = scaleStatUpgradeEffect(effect, 1);
    assert(scaled1.amount === 16, `Tier 1 stat upgrade should be unchanged: got ${scaled1.amount}`);

    const scaled3 = scaleStatUpgradeEffect(effect, 3);
    // SCALE_STAT(3) = 1 + 2*0.66 = 2.32 → 16*2.32 = 37.12 → round to 37
    assert(scaled3.amount === 37, `Tier 3 stat upgrade should be ~37: got ${scaled3.amount}`);
}

// Run all tests
testRunItemCatalogCount();
testStatUpgradeCatalogCount();
testRunItemIdsAreUnique();
testStatUpgradeIdsAreUnique();
testRunItemTierProgression();
testScaleRunItemEffectPositive();
testScaleRunItemEffectNegative();
testScaleRunItemEffectTradeoff();
testFormatRunItemEffect();
testBuildRunItemCatalogFresh();
testBuildStatUpgradeCatalogFresh();
testScaleStatUpgradeEffect();

console.log('runItemCatalog tests passed.');

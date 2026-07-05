import assert from 'node:assert/strict';
import {
    RUN_ITEMS,
    RUN_ITEM_COUNT,
    RUN_ITEM_BLUEPRINTS,
    LEVEL_UP_BLUEPRINTS,
    ITEM_TIER_NAMES,
    TRADEOFF_POSITIVE_BONUS,
    buildRunItemCatalog,
    scaleRunItemEffect,
    scaleRunItemEffects,
    formatRunItemEffect,
    rollStatUpgradeChoice,
} from '../../assets/scripts/catalogs/runItemCatalog';

function testRunItemCatalogCount() {
    // 30 blueprints × 5 tiers = 150 run items
    assert(RUN_ITEM_COUNT === RUN_ITEM_BLUEPRINTS.length * ITEM_TIER_NAMES.length,
        `RUN_ITEM_COUNT should be ${RUN_ITEM_BLUEPRINTS.length * ITEM_TIER_NAMES.length}, got ${RUN_ITEM_COUNT}`);
    assert(RUN_ITEMS.length === RUN_ITEM_COUNT, 'RUN_ITEMS length must match RUN_ITEM_COUNT');
}

function testLevelUpBlueprintsCount() {
    // 12 blueprints in 4 categories
    assert(LEVEL_UP_BLUEPRINTS.length === 12,
        `LEVEL_UP_BLUEPRINTS should have 12 entries, got ${LEVEL_UP_BLUEPRINTS.length}`);

    // Verify all 4 categories are present
    const categories = new Set(LEVEL_UP_BLUEPRINTS.map(bp => bp.category));
    for (const cat of ['力量', '敏捷', '体魄', '技巧']) {
        assert(categories.has(cat), `Missing category: ${cat}`);
    }

    // Each category should have exactly 3 entries
    for (const cat of categories) {
        const count = LEVEL_UP_BLUEPRINTS.filter(bp => bp.category === cat).length;
        assert(count === 3, `Category ${cat} should have 3 entries, got ${count}`);
    }
}

function testLevelUpBlueprintRanges() {
    for (const bp of LEVEL_UP_BLUEPRINTS) {
        assert(bp.effects.length >= 1, `${bp.id} should have at least 1 effect`);
        for (const effect of bp.effects) {
            assert(typeof effect.min === 'number', `${bp.id} effect min should be a number`);
            assert(typeof effect.max === 'number', `${bp.id} effect max should be a number`);
            assert(effect.min <= effect.max, `${bp.id} min (${effect.min}) should be ≤ max (${effect.max})`);
        }
    }
}

function testRollStatUpgradeChoice() {
    // Test that rolling produces valid LevelUpgrade objects with values within range
    for (const bp of LEVEL_UP_BLUEPRINTS) {
        const results = new Map<string, number[]>();
        // Roll 20 times to see the random range
        for (let i = 0; i < 20; i++) {
            const upgrade = rollStatUpgradeChoice(bp);
            assert(typeof upgrade.id === 'string', `Should have string id`);
            assert(upgrade.id === bp.id, `id should match blueprint id`);
            assert(upgrade.name === bp.name, `name should match`);
            assert(upgrade.effects.length === bp.effects.length, `effect count should match`);
            for (const effect of upgrade.effects) {
                const spec = bp.effects.find(e => e.stat === effect.stat);
                assert(spec, `Unexpected stat ${effect.stat} in rolled upgrade`);
                assert(effect.amount >= spec.min, `${bp.id} ${effect.stat}: rolled ${effect.amount} < min ${spec.min}`);
                assert(effect.amount <= spec.max, `${bp.id} ${effect.stat}: rolled ${effect.amount} > max ${spec.max}`);
                const key = String(effect.stat);
                if (!results.has(key)) results.set(key, []);
                results.get(key)!.push(effect.amount);
            }
        }
        // Verify that we got at least some variance (not all rolls same)
        for (const [statKey, values] of results) {
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            assert(minVal < maxVal, `${bp.id} ${statKey}: all 20 rolls were identical (${minVal}) — range should produce variance`);
        }
    }
}

function testRunItemIdsAreUnique() {
    const ids = RUN_ITEMS.map(item => item.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate run item IDs found: ${ids.length - unique.size} duplicates`);
}

function testLevelUpBlueprintIdsAreUnique() {
    const ids = LEVEL_UP_BLUEPRINTS.map(item => item.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate level-up blueprint IDs found: ${ids.length - unique.size} duplicates`);
}

function testRunItemTierProgression() {
    // Higher tiers should have higher positive effects
    const blueprint = RUN_ITEM_BLUEPRINTS[0]; // charged-magazine
    const tier1 = RUN_ITEMS.find(item => item.id === `${blueprint.id}-1`);
    const tier5 = RUN_ITEMS.find(item => item.id === `${blueprint.id}-5`);
    assert(tier1 && tier5, 'Should find tier 1 and tier 5 items');
    // weaponDamagePct is positive, tier 5 should be > tier 1
    const t1Atk = tier1!.effects.find(e => e.stat === 'weaponDamagePct');
    const t5Atk = tier5!.effects.find(e => e.stat === 'weaponDamagePct');
    assert(t1Atk && t5Atk, 'Should have weaponDamagePct effect');
    assert(t5Atk!.amount > t1Atk!.amount, `Tier 5 weaponDamagePct (${t5Atk!.amount}) should exceed tier 1 (${t1Atk!.amount})`);
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

// Run all tests
testRunItemCatalogCount();
testLevelUpBlueprintsCount();
testLevelUpBlueprintRanges();
testRollStatUpgradeChoice();
testRunItemIdsAreUnique();
testLevelUpBlueprintIdsAreUnique();
testRunItemTierProgression();
testScaleRunItemEffectPositive();
testScaleRunItemEffectNegative();
testScaleRunItemEffectTradeoff();
testFormatRunItemEffect();
testBuildRunItemCatalogFresh();

console.log('runItemCatalog tests passed.');

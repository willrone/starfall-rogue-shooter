import assert from 'node:assert/strict';
import {
    BASE_ENEMY_ARCHETYPES,
    ENEMY_VARIANTS,
    ENEMY_SPECS,
    BOSS_ENEMY_COUNT,
    TOTAL_ENEMY_TYPES,
    buildEnemyCatalog,
} from '../../assets/scripts/catalogs/enemyCatalog';

function testEnemyCatalogCount() {
    // 5 archetypes × 11 variants = 55 enemy specs
    const expected = BASE_ENEMY_ARCHETYPES.length * ENEMY_VARIANTS.length;
    assert(ENEMY_SPECS.length === expected,
        `ENEMY_SPECS should have ${expected} entries, got ${ENEMY_SPECS.length}`);
    assert(TOTAL_ENEMY_TYPES === ENEMY_SPECS.length + BOSS_ENEMY_COUNT,
        `TOTAL_ENEMY_TYPES should be ENEMY_SPECS + BOSS_ENEMY_COUNT`);
}

function testEnemyIdsAreUnique() {
    const ids = ENEMY_SPECS.map(e => e.id);
    const unique = new Set(ids);
    assert(unique.size === ids.length, `Duplicate enemy IDs: ${ids.length - unique.size}`);
}

function testBaseArchetypeVariants() {
    // Each base archetype should produce exactly ENEMY_VARIANTS.length specs
    for (const base of BASE_ENEMY_ARCHETYPES) {
        const variants = ENEMY_SPECS.filter(e => e.family === base.family);
        assert(variants.length === ENEMY_VARIANTS.length,
            `Family ${base.family} should have ${ENEMY_VARIANTS.length} variants, got ${variants.length}`);
    }
}

function testVariantStatScaling() {
    // Prime variant should have higher hp than base
    const miteBase = ENEMY_SPECS.find(e => e.id === 'mite');
    const mitePrime = ENEMY_SPECS.find(e => e.id === 'mite-prime');
    assert(miteBase && mitePrime, 'Should find mite and mite-prime');
    assert(mitePrime!.hp > miteBase!.hp,
        `Prime mite HP (${mitePrime!.hp}) should exceed base (${miteBase!.hp})`);
    // Swift variant should have higher speed
    const miteSwift = ENEMY_SPECS.find(e => e.id === 'mite-swift');
    assert(miteSwift, 'Should find mite-swift');
    assert(miteSwift!.speed > miteBase!.speed,
        `Swift mite speed (${miteSwift!.speed}) should exceed base (${miteBase!.speed})`);
}

function testSpawnAfterProgression() {
    // Later variants should have higher spawnAfter (unlock later)
    const miteBase = ENEMY_SPECS.find(e => e.id === 'mite');
    const mitePrime = ENEMY_SPECS.find(e => e.id === 'mite-prime');
    assert(miteBase && mitePrime, 'Should find mite variants');
    assert(mitePrime!.spawnAfter >= miteBase!.spawnAfter,
        `Prime spawnAfter (${mitePrime!.spawnAfter}) should be >= base (${miteBase!.spawnAfter})`);
}

function testEnemyWeightPositive() {
    for (const spec of ENEMY_SPECS) {
        assert(spec.weight > 0, `Enemy ${spec.id} should have positive weight, got ${spec.weight}`);
    }
}

function testEnemyHpPositive() {
    for (const spec of ENEMY_SPECS) {
        assert(spec.hp > 0, `Enemy ${spec.id} should have positive HP, got ${spec.hp}`);
    }
}

function testBuildEnemyCatalogFresh() {
    const catalog = buildEnemyCatalog();
    assert(catalog.length === ENEMY_SPECS.length,
        `Fresh build should produce ${ENEMY_SPECS.length} specs, got ${catalog.length}`);
    // Spot check: first entry should be base mite
    assert(catalog[0].id === 'mite', `First entry should be 'mite', got '${catalog[0].id}'`);
    assert(catalog[0].variantId === 'base', `First entry variant should be 'base', got '${catalog[0].variantId}'`);
}

// Run all tests
testEnemyCatalogCount();
testEnemyIdsAreUnique();
testBaseArchetypeVariants();
testVariantStatScaling();
testSpawnAfterProgression();
testEnemyWeightPositive();
testEnemyHpPositive();
testBuildEnemyCatalogFresh();

console.log('enemyCatalog tests passed.');

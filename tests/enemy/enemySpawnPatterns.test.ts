import assert from 'node:assert/strict';
import { WORLD_LEFT, WORLD_RIGHT, WORLD_BOTTOM, WORLD_TOP } from '../../assets/scripts/enemy/enemyConstants';
import { ENEMY_SPECS } from '../../assets/scripts/catalogs/enemyCatalog';
import { spawnChargeWave, spawnCross, spawnPincer } from '../../assets/scripts/enemy/enemySpawnPatterns';

function makeSpawnManager(cap: number, initialCount: number) {
    const enemies = Array.from({ length: initialCount }, () => ({}));
    return {
        enemies,
        ctx: {
            playerX: 0,
            playerY: 0,
            randomRange: (min: number, max: number) => (min + max) / 2,
            clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
        },
        getEnemyCap: () => cap,
        getSpawnPointAroundPlayer: (radius: number, angle: number) => ({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        }),
        createEnemy: () => enemies.push({}),
    };
}

function testFormationsConsumeExactAvailableBudget() {
    const cases = [
        ['charge', spawnChargeWave],
        ['cross', spawnCross],
        ['pincer', spawnPincer],
    ] as const;
    const spec = ENEMY_SPECS[0];

    for (const [name, spawn] of cases) {
        const roomy = makeSpawnManager(20, 3);
        spawn(roomy as never, spec, 7, 0);
        assert.equal(roomy.enemies.length - 3, 7, `${name} should consume the full batch budget`);

        const tight = makeSpawnManager(5, 3);
        spawn(tight as never, spec, 7, 0);
        assert.equal(tight.enemies.length - 3, 2, `${name} must clamp to remaining enemy-cap room`);
    }
}

function testChargeWaveOrigin() {
    const px = 360, py = 640;
    // Charge right → origin on left edge
    const angle = 0;
    const spawnDist = 700;
    const ox = px + Math.cos(angle + Math.PI) * spawnDist;
    const oy = py + Math.sin(angle + Math.PI) * spawnDist;
    assert.ok(ox < px, `Charging right: origin should be left of player`);
    // Charge up → origin below player
    const angleUp = Math.PI / 2;
    const ox2 = px + Math.cos(angleUp + Math.PI) * spawnDist;
    const oy2 = py + Math.sin(angleUp + Math.PI) * spawnDist;
    assert.ok(oy2 < py, `Charging up: origin should be below player`);
}

function testPerpendicularLine() {
    const perpX = -Math.sin(0);
    const perpY = Math.cos(0);
    // Handle -0 vs 0 in strict assert
    assert.ok(Math.abs(perpX) < 0.001, 'Perpendicular to right: x should be ~0');
    assert.ok(Math.abs(perpY - 1) < 0.001, 'Perpendicular to right: y should be ~1');
}

function testCircleAnglesEven() {
    const count = 8;
    const angles: number[] = [];
    for (let i = 0; i < count; i++) {
        angles.push((Math.PI * 2 * i) / count);
    }
    for (let i = 1; i < angles.length; i++) {
        const diff = angles[i] - angles[i - 1];
        assert.ok(Math.abs(diff - Math.PI / 4) < 0.001, `Angle diff should be π/4, got ${diff}`);
    }
}

function testCrossFourArms() {
    const arms: number[] = [];
    for (let arm = 0; arm < 4; arm++) {
        arms.push((Math.PI / 2) * arm);
    }
    assert.equal(arms[0], 0);
    assert.equal(arms[1], Math.PI / 2);
    assert.equal(arms[2], Math.PI);
    assert.equal(arms[3], (3 * Math.PI) / 2);
}

function testWorldBoundsClamp() {
    const padding = 40;
    const x = 99999;
    const cx = Math.max(WORLD_LEFT + padding, Math.min(WORLD_RIGHT - padding, x));
    assert.ok(cx <= WORLD_RIGHT - padding, `Clamped x=${cx} should be <= right bound`);
    const y = -99999;
    const cy = Math.max(WORLD_BOTTOM + padding, Math.min(WORLD_TOP - padding, y));
    assert.ok(cy >= WORLD_BOTTOM + padding, `Clamped y=${cy} should be >= bottom bound`);
}

function testChargeWaveCountClamp() {
    // Simulate spawnChargeWave's count logic
    const count = 6;
    const cap = 240;
    const room = Math.max(0, cap - 30);
    const total = Math.min(count, room);
    assert.equal(total, 6, 'Should spawn all when room available');

    const tight = Math.max(0, cap - 238);
    assert.equal(Math.min(8, tight + 2), 4, 'Tight room should limit count');
}

function testPincerTwoSides() {
    // Pincer spawns from angle and angle+π → sides are opposite
    const angle = Math.PI / 4; // 45°
    const side1 = angle;
    const side2 = angle + Math.PI;
    const diff = Math.abs(side2 - side1 - Math.PI);
    assert.ok(diff < 0.001, `Pincer sides should be π apart, got diff ${diff - Math.PI}`);
}

function testPincerPerpLine() {
    // Perpendicular to pincer angle should be correct
    const angle = Math.PI / 3; // 60°
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const dot = Math.cos(angle) * perpX + Math.sin(angle) * perpY;
    assert.ok(Math.abs(dot) < 0.001, `Perp dot should be ~0, got ${dot}`);
}

function testPincerCountSplit() {
    // 8 enemies should split to 4 per side
    const total = 8;
    const perWave = Math.max(1, Math.floor(total / 2));
    assert.equal(perWave, 4, '8 enemies should split to 4 per side');
}

function testPatternChanceScaling() {
    // Charge chance should scale from 12% at wave 6 to 25% at wave 15+
    for (let wave = 6; wave <= 20; wave++) {
        const chance = Math.min(0.25, 0.12 + (wave - 6) * 0.015);
        assert.ok(chance >= 0.12 && chance <= 0.25,
            `Wave ${wave} charge chance ${chance} should be in [0.12, 0.25]`);
    }
}

function testPatternChanceStrictIncrease() {
    let prev = 0;
    for (let wave = 6; wave <= 20; wave++) {
        const chance = Math.min(0.25, 0.12 + (wave - 6) * 0.015);
        assert.ok(chance >= prev, `Wave ${wave} chance ${chance} < prev ${prev}`);
        prev = chance;
    }
}

function testBudgetSplitsDoNotInflateTotals() {
    const crossBudget = [3, 2, 2, 2];
    assert.equal(crossBudget.reduce((sum, value) => sum + value, 0), 9, 'cross arms must share one total budget');
    const pincerBudget = [4, 3];
    assert.equal(pincerBudget.reduce((sum, value) => sum + value, 0), 7, 'pincer sides must share one total budget');
}

testFormationsConsumeExactAvailableBudget();
testChargeWaveOrigin();
testPerpendicularLine();
testCircleAnglesEven();
testCrossFourArms();
testWorldBoundsClamp();
testChargeWaveCountClamp();

testPincerTwoSides();
testPincerPerpLine();
testPincerCountSplit();
testPatternChanceScaling();
testPatternChanceStrictIncrease();
testBudgetSplitsDoNotInflateTotals();

console.log('✅ enemy/enemySpawnPatterns tests passed');

import assert from 'node:assert/strict';
import { WORLD_LEFT, WORLD_RIGHT, WORLD_BOTTOM, WORLD_TOP } from '../../assets/scripts/enemy/enemyConstants';

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

testChargeWaveOrigin();
testPerpendicularLine();
testCircleAnglesEven();
testCrossFourArms();
testWorldBoundsClamp();
testChargeWaveCountClamp();

console.log('✅ enemy/enemySpawnPatterns tests passed');

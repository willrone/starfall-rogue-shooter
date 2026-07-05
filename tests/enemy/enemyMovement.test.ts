import assert from 'node:assert/strict';
import {
    dirToward,
    wobbleOffset,
    orbitSpread,
    periodicFollowPhase,
} from '../../assets/scripts/enemy/enemyMovement';

function testDirToward() {
    const { vx, vy, dist } = dirToward(0, 0, 10, 0);
    assert.ok(Math.abs(vx - 1) < 0.001, `vx should be 1, got ${vx}`);
    assert.ok(Math.abs(vy - 0) < 0.001, `vy should be 0, got ${vy}`);
    assert.ok(Math.abs(dist - 10) < 0.001, `dist should be 10, got ${dist}`);
}

function testDirTowardDiagonal() {
    const { vx, vy, dist } = dirToward(0, 0, 3, 4);
    assert.ok(Math.abs(dist - 5) < 0.001, `dist should be 5, got ${dist}`);
    assert.ok(Math.abs(vx - 0.6) < 0.01, `vx should be ~0.6`);
    assert.ok(Math.abs(vy - 0.8) < 0.01, `vy should be ~0.8`);
}

function testDirTowardZeroDistance() {
    const { dist } = dirToward(0, 0, 0, 0);
    assert.ok(dist >= 0.001, 'distance should be floored at 0.001');
}

function testWobbleOffset() {
    const wobble = wobbleOffset(0.5, 0.866, 0.3, 0.7);
    assert.ok(typeof wobble === 'number', 'wobble should be a number');
}

function testOrbitSpread() {
    const { ox, oy } = orbitSpread(1, 0, 500, 0);
    // Horizontal direction (1,0) → perpendicular in Y axis
    assert.ok(oy !== 0, 'at dist 500, orbit should push perpendicular to direction');
}

function testOrbitSpreadDiagonal() {
    const { ox, oy } = orbitSpread(0.6, 0.8, 500, 0);
    // Diagonal → both axes should get some orbit
    assert.ok(ox !== 0 && oy !== 0, 'diagonal direction should produce both-axis orbit');
}

function testOrbitSpreadClose() {
    const { ox, oy } = orbitSpread(1, 0, 100, 0);
    // Close enemies get minimal orbit
    assert.ok(Math.abs(ox) < 0.01, 'close enemies should have minimal orbit');
}

function testPeriodicFollowMoving() {
    const config = { followDuration: 2.0, pauseDuration: 1.0, shootDuringPause: true };
    // Start of cycle — should be moving
    const { isMoving, nextTimer } = periodicFollowPhase(0.5, 0, config);
    assert.equal(isMoving, true, 'Should be moving at start');
    assert.equal(nextTimer, 0.5, 'Timer should advance');
}

function testPeriodicFollowPause() {
    const config = { followDuration: 2.0, pauseDuration: 1.0, shootDuringPause: true };
    // 2.5s elapsed: follow=2s + 0.5s into pause
    const { isMoving, nextTimer } = periodicFollowPhase(2.5, 0, config);
    assert.equal(isMoving, false, 'Should be paused after followDuration');
    // nextTimer = 2.5 (absolute time since cycle start, 0.5 into pause)
    assert.ok(Math.abs(nextTimer - 2.5) < 0.01, `Timer should be 2.5 (0.5 into pause), got ${nextTimer}`);
}

function testPeriodicFollowCycleWrap() {
    const config = { followDuration: 2.0, pauseDuration: 1.0, shootDuringPause: true };
    // Go past entire cycle (3.5s past start = 3.5 into 3s cycle = 0.5 into new cycle)
    const { isMoving, nextTimer, newCycle } = periodicFollowPhase(3.5, 0, config);
    assert.equal(newCycle, true, 'Should wrap around after full cycle');
    assert.equal(isMoving, true, 'Should be moving in new cycle');
    assert.ok(Math.abs(nextTimer - 0.5) < 0.01, `Timer should be 0.5 into new cycle`);
}

function testPeriodicFollowExactBoundary() {
    const config = { followDuration: 2.0, pauseDuration: 1.0, shootDuringPause: true };
    // Exactly at boundary — followDuration just ended, timer=2.0 (start of pause)
    const { isMoving, nextTimer } = periodicFollowPhase(2.0, 0, config);
    assert.equal(isMoving, false, 'Should be paused exactly at boundary');
    assert.ok(Math.abs(nextTimer - 2.0) < 0.01, `Timer should be 2.0 at boundary, got ${nextTimer}`);
}

testDirToward();
testDirTowardDiagonal();
testDirTowardZeroDistance();
testWobbleOffset();
testOrbitSpread();
testOrbitSpreadDiagonal();
testOrbitSpreadClose();
testPeriodicFollowMoving();
testPeriodicFollowPause();
testPeriodicFollowCycleWrap();
testPeriodicFollowExactBoundary();

console.log('✅ enemy/enemyMovement tests passed');

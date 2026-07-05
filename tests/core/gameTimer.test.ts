import assert from 'node:assert/strict';
import { GameTimer } from '../../assets/scripts/core/gameTimer';

function testTimerTriggersAfterPeriod() {
    const t = new GameTimer(0.5);
    assert.equal(t.tryFinishPeriod(), false, 'Should not trigger immediately');
    t.gameTick(0.3);
    assert.equal(t.tryFinishPeriod(), false, 'Should not trigger at 0.3s');
    t.gameTick(0.3); // total 0.6s
    assert.equal(t.tryFinishPeriod(), true, 'Should trigger after 0.5s');
    assert.equal(t.tryFinishPeriod(), false, 'Consumed, should not re-trigger');
}

function testTimerExactPeriod() {
    const t = new GameTimer(1.0);
    t.gameTick(1.0);
    assert.equal(t.tryFinishPeriod(), true, 'Should trigger at exactly 1s');
}

function testTimerMultiplePeriodsAccumulate() {
    const t = new GameTimer(1.0);
    t.gameTick(2.5); // 2.5 periods accumulated
    assert.equal(t.tryFinishPeriod(), true, 'Should consume first period');
    assert.equal(t.tryFinishPeriod(), true, 'Should consume second period');
    // Only 0.5s remaining, not enough for third
    assert.equal(t.tryFinishPeriod(), false, '0.5s < 1.0s, should not trigger');
}

function testTimerZeroPeriod() {
    const t = new GameTimer(0);
    assert.equal(t.tryFinishPeriod(), true, 'Zero period = always triggers');
    assert.equal(t.tryFinishPeriod(), true, 'Always true even after consume');
}

function testTimerNegativePeriod() {
    const t = new GameTimer(-1);
    assert.equal(t.tryFinishPeriod(), true, 'Negative period = always triggers');
}

function testTimerReset() {
    const t = new GameTimer(1.0);
    t.gameTick(0.9);
    assert.equal(t.tryFinishPeriod(), false, '0.9s < 1.0s');
    t.reset();
    t.gameTick(0.9);
    assert.equal(t.tryFinishPeriod(), false, 'After reset, still < 1.0s');
    t.gameTick(0.2); // 1.1s from last reset
    assert.equal(t.tryFinishPeriod(), true, 'Should trigger after reset+accumulation');
}

function testTimerSetElapsed() {
    const t = new GameTimer(2.0);
    t.setElapsed(1.9);
    assert.equal(t.tryFinishPeriod(), false, '1.9s < 2.0s');
    t.setElapsed(2.0);
    assert.equal(t.tryFinishPeriod(), true, 'Force-set to exactly period');
}

function testTimerProgress() {
    const t = new GameTimer(10);
    t.gameTick(5);
    assert.ok(t.progress >= 0.49 && t.progress <= 0.51, `Expected progress ~0.5, got ${t.progress}`);
    t.gameTick(5);
    assert.ok(t.progress >= 0.99 || t.tryFinishPeriod(), 'Should be near 1.0 or ready to fire');
}

function testTimerCurrent() {
    const t = new GameTimer(1.0);
    t.gameTick(0.42);
    assert.equal(t.current, 0.42, 'current should reflect accumulated time');
}

// Run all
testTimerTriggersAfterPeriod();
testTimerExactPeriod();
testTimerMultiplePeriodsAccumulate();
testTimerZeroPeriod();
testTimerNegativePeriod();
testTimerReset();
testTimerSetElapsed();
testTimerProgress();
testTimerCurrent();

console.log('✅ core/gameTimer tests passed');

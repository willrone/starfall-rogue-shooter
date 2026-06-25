import assert from 'node:assert/strict';
import { GameEventBus, type GameEvents } from '../../assets/scripts/core/gameContext';

function testBusEmitOn() {
    const bus = new GameEventBus();
    let received: any = null;
    bus.on('enemy-killed', (data) => { received = data; });
    bus.emit('enemy-killed', { x: 10, y: 20, drops: true, isBoss: false, isSplitter: true, damageType: 'fire' });
    assert.equal(received.x, 10);
    assert.equal(received.y, 20);
    assert.equal(received.drops, true);
    assert.equal(received.isBoss, false);
    assert.equal(received.isSplitter, true);
    assert.equal(received.damageType, 'fire');
}

function testBusMultipleHandlers() {
    const bus = new GameEventBus();
    const calls: number[] = [];
    bus.on('battle-end', () => calls.push(1));
    bus.on('battle-end', () => calls.push(2));
    bus.on('battle-end', () => calls.push(3));
    bus.emit('battle-end', { reason: 'extract' });
    assert.equal(calls.length, 3);
    assert.deepEqual(calls, [1, 2, 3]);
}

function testBusOff() {
    const bus = new GameEventBus();
    let called = false;
    const handler = () => { called = true; };
    bus.on('battle-end', handler);
    bus.off('battle-end', handler);
    bus.emit('battle-end', { reason: 'death' });
    assert.equal(called, false, 'Handler should not be called after off()');
}

function testBusClear() {
    const bus = new GameEventBus();
    let count = 0;
    bus.on('wave-start', () => { count++; });
    bus.on('wave-start', () => { count++; });
    bus.clear();
    bus.emit('wave-start', { wave: 1, isBoss: false });
    assert.equal(count, 0, 'No handlers should be called after clear()');
}

function testBusErrorIsolation() {
    const bus = new GameEventBus();
    let secondCalled = false;
    bus.on('enemy-killed', () => { throw new Error('handler 1 error'); });
    bus.on('enemy-killed', () => { secondCalled = true; });
    bus.emit('enemy-killed', { x: 0, y: 0, drops: false, isBoss: false, isSplitter: false, damageType: 'physical' });
    assert.equal(secondCalled, true, 'Second handler should still be called even if first throws');
}

function testBusEmptyEmit() {
    const bus = new GameEventBus();
    // No handlers registered — should not throw
    bus.emit('boss-defeated', {});
    bus.emit('pickup-collected', { type: 'xp', amount: 10 });
    bus.emit('level-up', { level: 5 });
}

function testBusOnAll() {
    const bus = new GameEventBus();
    const events: string[] = [];
    bus.onAll({
        'enemy-killed': (d: any) => { events.push('enemy-killed'); },
        'battle-end': (d: any) => { events.push('battle-end'); },
    });
    bus.emit('enemy-killed', { x: 0, y: 0, drops: false, isBoss: false, isSplitter: false, damageType: 'physical' });
    bus.emit('battle-end', { reason: 'extract' });
    assert.equal(events.length, 2);
}

testBusEmitOn();
testBusMultipleHandlers();
testBusOff();
testBusClear();
testBusErrorIsolation();
testBusEmptyEmit();
testBusOnAll();

console.log('eventBus tests passed.');

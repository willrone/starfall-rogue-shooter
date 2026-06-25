/**
 * Integration tests for EventBus event chain + CombatState flow.
 * Simulates a minimal game round to verify modules communicate correctly.
 */
import assert from 'node:assert/strict';
import { GameEventBus } from '../../assets/scripts/core/gameContext';
import { createCombatState, resetCombatSession } from '../../assets/scripts/state/combatState';

// ── EventBus event chain tests ─────────────────────────────────────

function testWaveStartEventFlow() {
    const bus = new GameEventBus();
    const events: string[] = [];
    bus.on('wave-start', (d) => { events.push(`wave-${d.wave}-${d.isBoss ? 'boss' : 'normal'}`); });
    bus.on('enemy-killed', (d) => { events.push(`kill-${d.isBoss ? 'boss' : 'normal'}-${d.isSplitter ? 'split' : 'reg'}`); });
    bus.on('boss-defeated', () => { events.push('boss-down'); });

    // Simulate: wave starts → enemies die → boss spawns → boss dies
    bus.emit('wave-start', { wave: 1, isBoss: false });
    bus.emit('enemy-killed', { x: 10, y: 20, drops: true, isBoss: false, isSplitter: false, damageType: 'physical' });
    bus.emit('enemy-killed', { x: 30, y: 40, drops: true, isBoss: false, isSplitter: true, damageType: 'fire' });
    bus.emit('wave-start', { wave: 10, isBoss: true });
    bus.emit('enemy-killed', { x: 0, y: 0, drops: true, isBoss: true, isSplitter: false, damageType: 'magic' });
    bus.emit('boss-defeated', {});

    assert.deepEqual(events, [
        'wave-1-normal',
        'kill-normal-reg',
        'kill-normal-split',
        'wave-10-boss',
        'kill-boss-reg',
        'boss-down',
    ]);
}

function testPlayerHitHealFlow() {
    const bus = new GameEventBus();
    let hp = 180;
    const log: string[] = [];

    // Subscribe to events — simulates how modules would react
    bus.on('player-hit', (d) => {
        log.push(`hit-${d.damage.toFixed(0)}-${d.type}`);
    });
    bus.on('player-heal', (d) => {
        log.push(`heal-${d.amount.toFixed(0)}`);
    });
    bus.on('battle-end', (d) => {
        log.push(`end-${d.reason}`);
    });

    // Simulate: hit → heal → hit → die
    bus.emit('player-hit', { damage: 15, type: 'physical' });
    bus.emit('player-heal', { amount: 8 });
    bus.emit('player-hit', { damage: 200, type: 'magic' });
    bus.emit('battle-end', { reason: 'death' });

    assert.deepEqual(log, [
        'hit-15-physical',
        'heal-8',
        'hit-200-magic',
        'end-death',
    ]);
}

function testWaveClearRewardFlow() {
    const bus = new GameEventBus();
    const events: string[] = [];
    let totalReward = 0;

    bus.on('wave-start', (d) => { events.push(`start-w${d.wave}`); });
    bus.on('wave-clear', (d) => { 
        events.push(`clear-w${d.wave}`);
        totalReward += d.reward;
    });
    bus.on('wave-start', (d) => {
        // Simulate: on wave start, check if previous wave was cleared
        // In real code this is handled by startNextWave logic
    });

    bus.emit('wave-start', { wave: 1, isBoss: false });
    bus.emit('wave-clear', { wave: 1, reward: 12 });
    bus.emit('wave-start', { wave: 2, isBoss: false });
    bus.emit('wave-clear', { wave: 2, reward: 15 });

    assert.equal(totalReward, 27, 'Total reward should accumulate');
    assert.deepEqual(events, ['start-w1', 'clear-w1', 'start-w2', 'clear-w2']);
}

function testExtractFlow() {
    const bus = new GameEventBus();
    const events: string[] = [];

    bus.on('battle-end', (d) => { events.push(`extract-${d.reason}`); });

    // Simulate: player extracts during combat
    bus.emit('battle-end', { reason: 'extract' });

    assert.deepEqual(events, ['extract-extract']);
}

// ── CombatState lifecycle tests ─────────────────────────────────────

function testFullCombatLifecycle() {
    const cs = createCombatState();

    // Phase 1: menu
    assert.equal(cs.phase, 'menu');
    cs.phase = 'hangar';

    // Phase 2: hangar → begin battle
    cs.phase = 'combat';
    cs.battleIndex = 1;
    cs.playerHp = cs.playerMaxHp;
    assert.equal(cs.phase, 'combat');
    assert.equal(cs.combatTime, 0);

    // Phase 3: combat in progress
    cs.combatTime = 30;
    cs.waveIndex = 3;
    cs.endlessCycle = 1;
    cs.killCount = 15;
    cs.battleAlloy = 20;
    cs.playerHp = 100;

    // Phase 4: extract
    cs.battlesWon += 1;
    cs.phase = 'hangar';

    // Phase 5: reset for new battle
    resetCombatSession(cs);
    assert.equal(cs.combatTime, 0, 'combatTime reset');
    assert.equal(cs.waveIndex, 0, 'waveIndex reset');
    assert.equal(cs.killCount, 0, 'killCount reset');
    assert.equal(cs.battleAlloy, 0, 'battleAlloy reset');
    assert.equal(cs.battlesWon, 1, 'battlesWon persists');
    assert.equal(cs.battleIndex, 1, 'battleIndex persists');
}

function testBossWaveProgression() {
    const cs = createCombatState();
    cs.waveIndex = 10; // Boss wave
    const cycle = Math.floor((cs.waveIndex - 1) / 10) + 1;
    assert.equal(cycle, 1, 'First cycle');

    cs.waveIndex = 20;
    const cycle2 = Math.floor((cs.waveIndex - 1) / 10) + 1;
    assert.equal(cycle2, 2, 'Second cycle');
}

function testResourceAccumulation() {
    const cs = createCombatState();
    cs.battleAlloy = 50;
    cs.battleCores = 3;
    cs.battleShards = 8;

    // Simulate adding to inventory
    cs.alloy += cs.battleAlloy;
    cs.cores += cs.battleCores;
    cs.shards += cs.battleShards;

    assert.equal(cs.alloy, 50);
    assert.equal(cs.cores, 3);
    assert.equal(cs.shards, 8);

    // Reset battle resources
    cs.battleAlloy = 0;
    cs.battleCores = 0;
    cs.battleShards = 0;

    // Inventory persists
    assert.equal(cs.alloy, 50, 'Inventory alloy persists after battle reset');
    assert.equal(cs.battleAlloy, 0, 'Battle alloy reset');
}

function testShieldAndRegenFlow() {
    const cs = createCombatState();
    cs.playerShield = 40;
    cs.playerShieldMax = 50;
    cs.shieldRechargeDelay = 1.6;

    // Simulate shield recharge
    cs.shieldRechargeDelay = Math.max(0, cs.shieldRechargeDelay - 0.5);
    assert.equal(cs.shieldRechargeDelay, 1.1);

    cs.shieldRechargeDelay = Math.max(0, cs.shieldRechargeDelay - 1.2);
    assert.equal(cs.shieldRechargeDelay, 0, 'Shield recharge delay cleared');

    // Now shield can recharge
    const regenRate = 5; // shield regen per second
    const dt = 0.5;
    cs.playerShield = Math.min(cs.playerShieldMax, cs.playerShield + regenRate * dt);
    assert.equal(cs.playerShield, 42.5, 'Shield recharges after delay clears');
}

// ── Run all tests ──────────────────────────────────────────────────

// EventBus chain tests
testWaveStartEventFlow();
testPlayerHitHealFlow();
testWaveClearRewardFlow();
testExtractFlow();

// CombatState lifecycle tests
testFullCombatLifecycle();
testBossWaveProgression();
testResourceAccumulation();
testShieldAndRegenFlow();

console.log('integration tests passed.');

// ── EventBus event chain tests ─────────────────────────────────────


console.log("Integration tests passed!");

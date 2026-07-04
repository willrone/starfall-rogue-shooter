import assert from 'node:assert/strict';
import { createCombatState, resetCombatSession } from '../../assets/scripts/state/combatState';

function testCreateCombatState() {
    const cs = createCombatState();
    assert.equal(cs.phase, 'menu');
    assert.equal(cs.battleIndex, 1);
    assert.equal(cs.battlesWon, 0);
    assert.equal(cs.playerHp, 50);
    assert.equal(cs.playerMaxHp, 50);
    assert.equal(cs.playerX, 0);
    assert.equal(cs.playerY, -170);
    assert.equal(cs.waveIndex, 0);
    assert.equal(cs.endlessCycle, 1);
    assert.equal(cs.level, 1);
    assert.equal(cs.xp, 0);
    assert.equal(cs.alloy, 0);
    assert.equal(cs.killCount, 0);
}

function testResetCombatSession() {
    const cs = createCombatState();
    // Modify some values
    cs.combatTime = 123.45;
    cs.waveIndex = 5;
    cs.endlessCycle = 3;
    cs.killCount = 42;
    cs.battleAlloy = 100;
    cs.level = 10;
    cs.xp = 500;
    cs.playerHp = 50;
    cs.bossKills = 2;
    cs.battlesWon = 5;

    // Reset
    resetCombatSession(cs);

    // Per-battle fields should be reset
    assert.equal(cs.combatTime, 0);
    assert.equal(cs.waveIndex, 0);
    assert.equal(cs.endlessCycle, 1);
    assert.equal(cs.killCount, 0);
    assert.equal(cs.battleAlloy, 0);
    assert.equal(cs.level, 1);
    assert.equal(cs.xp, 0);
    assert.equal(cs.bossKills, 0);
    assert.equal(cs.shotTimer, 0);
    assert.equal(cs.droneTimer, 0.6, 'droneTimer reset to 0.6');
    assert.equal(cs.shieldRechargeDelay, 0);

    // playerHp/playerMaxHp are NOT reset by resetCombatSession (caller recalculates)
    assert.equal(cs.playerHp, 50, 'playerHp not reset by resetCombatSession');

    // Persistent fields should NOT be reset
    assert.equal(cs.battlesWon, 5, 'battlesWon should persist');
    assert.equal(cs.phase, 'menu');
}

function testCombatStateIsolation() {
    const cs1 = createCombatState();
    const cs2 = createCombatState();
    cs1.killCount = 999;
    cs1.phase = 'combat';
    assert.equal(cs2.killCount, 0, 'Different CombatState objects should be independent');
    assert.equal(cs2.phase, 'menu');
}

testCreateCombatState();
testResetCombatSession();
testCombatStateIsolation();

console.log('combatState tests passed.');

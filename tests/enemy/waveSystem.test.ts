import assert from 'node:assert/strict';
import {
    BOSS_ADD_PROFILE,
    BOSS_INTRO_DURATION,
    BOSS_OVERTIME_DAMAGE_MULTIPLIER,
    BOSS_OVERTIME_PROFILE,
    BOSS_OVERTIME_SKILL_COOLDOWN_MULTIPLIER,
    BOSS_OVERTIME_SPEED_MULTIPLIER,
    BOSS_OVERTIME_START,
    BOSS_VICTORY_DELAY,
    EARLY_WAVE_PROFILES,
    MINI_BOSS_SPAWN_MAX_TIME,
    MINI_BOSS_SPAWN_MIN_TIME,
    MINI_BOSS_START_WAVE,
    MINI_BOSS_WAVE_CHANCE,
    advanceBossSpawnState,
    advanceBossVictoryTimer,
    allocateSpawnBudget,
    getBossAddSpawnBudget,
    getBossWavePhase,
    getUnlockedEnemySpecsForWave,
    getWaveProgressFactors,
    getWaveSpawnInterval,
    getWaveSpawnProfile,
    scaleBossSkillCooldown,
    shouldScheduleMiniBoss,
} from '../../assets/scripts/catalogs/waveCatalog';
import { ENEMY_SPECS } from '../../assets/scripts/catalogs/enemyCatalog';

function testEarlyPressureIsMonotonic() {
    let previous = 0;
    for (let wave = 1; wave <= 9; wave++) {
        const profile = getWaveSpawnProfile(wave);
        const averageBatch = (profile.batchMin + profile.batchMax) / 2;
        const averageInterval = (profile.intervalStart + profile.intervalEnd) / 2;
        const pressure = averageBatch / averageInterval;
        assert.ok(pressure + 1e-9 >= previous,
            `wave ${wave} pressure ${pressure.toFixed(3)} must be >= ${previous.toFixed(3)}`);
        previous = pressure;
    }
    assert.equal(EARLY_WAVE_PROFILES.length, 9, 'waves 1-9 need explicit profiles');
}

function testWaveIntervalInterpolatesWithinProfile() {
    const profile = getWaveSpawnProfile(4);
    assert.equal(getWaveSpawnInterval(4, 0, 55), profile.intervalStart);
    assert.equal(getWaveSpawnInterval(4, 55, 55), profile.intervalEnd);
    const midpoint = getWaveSpawnInterval(4, 27.5, 55);
    assert.ok(Math.abs(midpoint - (profile.intervalStart + profile.intervalEnd) / 2) < 1e-9);
}

function testWaveTenUsesFullProgressFactors() {
    const profile = getWaveSpawnProfile(10);
    assert.equal(profile.wave, 10, 'wave 10 API result must identify wave 10 instead of clamping to wave 9');
    assert.equal(profile.hpProgressFactor, 1, 'wave 10 profile HP progress factor must be 1.0');
    assert.equal(profile.damageProgressFactor, 1, 'wave 10 profile damage progress factor must be 1.0');
    assert.deepEqual(
        getWaveProgressFactors(10),
        { hpProgressFactor: 1, damageProgressFactor: 1 },
        'wave 10 must not inherit the clamped wave 9 progress factors',
    );
}

function testEnemyPoolUnlocksCumulatively() {
    const wave2 = getUnlockedEnemySpecsForWave(ENEMY_SPECS, 2);
    const wave3 = getUnlockedEnemySpecsForWave(ENEMY_SPECS, 3);
    const wave9 = getUnlockedEnemySpecsForWave(ENEMY_SPECS, 9);
    const wave10 = getUnlockedEnemySpecsForWave(ENEMY_SPECS, 10);
    const wave11 = getUnlockedEnemySpecsForWave(ENEMY_SPECS, 11);

    assert.ok(wave2.every(spec => wave3.some(next => next.id === spec.id)), 'wave pools must be cumulative');
    assert.ok(!wave2.some(spec => spec.family === 'runner'), 'runner must not appear before wave 3');
    assert.ok(wave3.some(spec => spec.family === 'runner'), 'runner must unlock on wave 3');
    assert.ok(wave9.some(spec => spec.family === 'mite'), 'wave 9 must retain early families');
    assert.ok(wave9.some(spec => spec.family === 'beacon'), 'beacon must unlock on wave 9');
    assert.ok(wave10.length >= wave9.length, 'wave 10 pool must not shrink');
    assert.equal(ENEMY_SPECS.length, 110, 'ordinary enemy catalog must remain 10 families × 11 variants');
    assert.equal(wave11.length, 110, 'wave 11 must unlock all 110 ordinary enemies');
    assert.ok(wave10.every(spec => spec.variantId !== 'prime'), 'prime variants must wait until wave 11');
    assert.ok(wave11.some(spec => spec.variantId === 'prime'), 'prime variants unlock on wave 11');
}

function testEveryEnemyHasSingleUnlockWave() {
    for (const spec of ENEMY_SPECS) {
        assert.ok(Number.isInteger(spec.unlockWave) && spec.unlockWave >= 1,
            `${spec.id} needs a positive integer unlockWave`);
        assert.ok(!('spawnAfter' in spec), `${spec.id} must not keep the legacy spawnAfter rule`);
    }
}

function testFormationBudgetNeverInflates() {
    assert.deepEqual(allocateSpawnBudget(5, 4), [2, 1, 1, 1]);
    assert.deepEqual(allocateSpawnBudget(7, 2), [4, 3]);
    assert.equal(allocateSpawnBudget(3, 4).reduce((sum, value) => sum + value, 0), 3);
    assert.equal(allocateSpawnBudget(0, 4).reduce((sum, value) => sum + value, 0), 0);
}

function testBossWavePhases() {
    assert.equal(getBossWavePhase(0, 60, false), 'intro');
    assert.equal(getBossWavePhase(3, 60, false), 'combat');
    assert.equal(getBossWavePhase(55, 50, false), 'combat', 'Boss overtime must not inherit a 50-60 second ordinary-wave duration');
    assert.equal(getBossWavePhase(59.999, 60, false), 'combat');
    assert.equal(getBossWavePhase(60, 60, false), 'overtime');
    assert.equal(getBossWavePhase(5, 60, true), 'victory');
    assert.equal(BOSS_INTRO_DURATION, 3);
    assert.equal(BOSS_OVERTIME_START, 60);
    assert.equal(BOSS_VICTORY_DELAY, 2.5);
    assert.deepEqual(BOSS_ADD_PROFILE, { interval: 5, batchMin: 3, batchMax: 4, aliveCap: 24 });
    assert.deepEqual(BOSS_OVERTIME_PROFILE, { interval: 10, batchMin: 4, batchMax: 4, aliveCap: 16 });
    assert.equal(BOSS_OVERTIME_SPEED_MULTIPLIER, 1.15);
    assert.equal(BOSS_OVERTIME_DAMAGE_MULTIPLIER, 1.2);
    assert.equal(BOSS_OVERTIME_SKILL_COOLDOWN_MULTIPLIER, 0.85);
}

function testBossReinforcementStateMachine() {
    const atIntroEnd = advanceBossSpawnState({
        previousWaveElapsed: 0,
        waveElapsed: 3,
        bossDefeated: false,
        spawnTimer: BOSS_ADD_PROFILE.interval,
        overtimeActive: false,
    });
    assert.equal(atIntroEnd.phase, 'combat');
    assert.equal(atIntroEnd.spawnTimer, 5, 'the 3 second intro must not consume the reinforcement timer');
    assert.equal(atIntroEnd.batchesDue, 0);

    const beforeFirstBatch = advanceBossSpawnState({
        previousWaveElapsed: 3,
        waveElapsed: 7,
        bossDefeated: false,
        spawnTimer: atIntroEnd.spawnTimer,
        overtimeActive: false,
    });
    assert.equal(beforeFirstBatch.spawnTimer, 1);
    assert.equal(beforeFirstBatch.batchesDue, 0);
    const firstBatch = advanceBossSpawnState({
        previousWaveElapsed: 7,
        waveElapsed: 8,
        bossDefeated: false,
        spawnTimer: beforeFirstBatch.spawnTimer,
        overtimeActive: false,
    });
    assert.equal(firstBatch.batchesDue, 1, 'first combat adds must wait until intro 3s + combat 5s');
    assert.equal(firstBatch.spawnTimer, 5);

    const enterOvertime = advanceBossSpawnState({
        previousWaveElapsed: 59,
        waveElapsed: 60,
        bossDefeated: false,
        spawnTimer: 0,
        overtimeActive: false,
    });
    assert.equal(enterOvertime.phase, 'overtime');
    assert.equal(enterOvertime.enteredOvertime, true);
    assert.equal(enterOvertime.batchesDue, 0, 'the old combat reinforcement loop must not fire at overtime entry');
    assert.equal(enterOvertime.spawnTimer, 10, 'overtime must replace the old timer with a fresh 10 second timer');

    const overtimeBatch = advanceBossSpawnState({
        previousWaveElapsed: 60,
        waveElapsed: 70,
        bossDefeated: false,
        spawnTimer: enterOvertime.spawnTimer,
        overtimeActive: true,
    });
    assert.equal(overtimeBatch.enteredOvertime, false, 'overtime entry effects must only run once');
    assert.equal(overtimeBatch.batchesDue, 1);
    assert.equal(overtimeBatch.spawnTimer, 10);

    const deadBoss = advanceBossSpawnState({
        previousWaveElapsed: 20,
        waveElapsed: 30,
        bossDefeated: true,
        spawnTimer: 0,
        overtimeActive: false,
    });
    assert.equal(deadBoss.phase, 'victory');
    assert.equal(deadBoss.batchesDue, 0, 'Boss death must stop reinforcements immediately');
}

function testBossCapsEnrageAndVictoryDelay() {
    assert.equal(getBossAddSpawnBudget(BOSS_ADD_PROFILE, 22, 4), 2);
    assert.equal(getBossAddSpawnBudget(BOSS_ADD_PROFILE, 24, 4), 0, 'combat ordinary cap is 24');
    assert.equal(getBossAddSpawnBudget(BOSS_OVERTIME_PROFILE, 15, 4), 1);
    assert.equal(getBossAddSpawnBudget(BOSS_OVERTIME_PROFILE, 16, 4), 0, 'overtime ordinary cap is 16');
    assert.equal(scaleBossSkillCooldown(10, false), 10);
    assert.equal(scaleBossSkillCooldown(10, true), 8.5, 'overtime skill cooldowns use ×0.85');

    const armed = advanceBossVictoryTimer(-1, 0);
    assert.equal(armed.remaining, 2.5);
    assert.equal(armed.advanceWave, false);
    const halfway = advanceBossVictoryTimer(armed.remaining, 1.25);
    assert.equal(halfway.remaining, 1.25);
    assert.equal(halfway.advanceWave, false);
    const finished = advanceBossVictoryTimer(halfway.remaining, 1.25);
    assert.equal(finished.remaining, 0);
    assert.equal(finished.advanceWave, true, 'Boss victory must advance after 2.5 seconds, independent of wave duration');
}

function testMiniBossUsesOneRollPerEligibleWave() {
    assert.equal(MINI_BOSS_START_WAVE, 14);
    assert.equal(MINI_BOSS_WAVE_CHANCE, 0.35);
    assert.equal(MINI_BOSS_SPAWN_MIN_TIME, 20);
    assert.equal(MINI_BOSS_SPAWN_MAX_TIME, 35);
    assert.equal(shouldScheduleMiniBoss(13, true, 0), false, 'boss waves never schedule mini bosses');
    assert.equal(shouldScheduleMiniBoss(13, false, 0), false, 'mini bosses start from wave 14');
    assert.equal(shouldScheduleMiniBoss(14, false, 0.34), true);
    assert.equal(shouldScheduleMiniBoss(14, false, 0.35), false);
}

testEarlyPressureIsMonotonic();
testWaveIntervalInterpolatesWithinProfile();
testWaveTenUsesFullProgressFactors();
testEnemyPoolUnlocksCumulatively();
testEveryEnemyHasSingleUnlockWave();
testFormationBudgetNeverInflates();
testBossWavePhases();
testBossReinforcementStateMachine();
testBossCapsEnrageAndVictoryDelay();
testMiniBossUsesOneRollPerEligibleWave();

console.log('✅ enemy/waveSystem tests passed');

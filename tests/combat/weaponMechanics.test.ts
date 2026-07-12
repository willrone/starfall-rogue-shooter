import assert from 'node:assert/strict';
import {
    DRONE_CHARGE_PER_KILL,
    FROST_SLOW_DURATION,
    GRAVITY_BULLET_LIFE,
    GRAVITY_KNOCKBACK_FORCE,
    GRAVITY_KNOCKBACK_FORCE_CRIT,
    GRAVITY_IMPACT_DAMAGE_MULTIPLIER,
    GRAVITY_IMPACT_RADIUS,
    GRAVITY_IMPACT_STUN_DURATION,
    ICEFIRE_BULLET_LIFE,
    ICEFIRE_KILL_AOE_DAMAGE_MULTIPLIER,
    ICEFIRE_KILL_AOE_RADIUS,
    ICEFIRE_ON_HIT_AOE_DAMAGE_MULTIPLIER,
    ICEFIRE_ON_HIT_AOE_RADIUS,
    ICEFIRE_SLOW_DURATION,
    ICEFIRE_FROZEN_FIRE_MULTIPLIER,
    METEOR_BURN_DAMAGE_PER_SECOND,
    METEOR_BURN_RADIUS,
    METEOR_BURN_SLOW_DURATION,
    METEOR_BURN_SLOW_FACTOR,
    METEOR_BURN_TICK_INTERVAL,
    METEOR_IMPACT_AOE_DAMAGE_MULTIPLIER,
    METEOR_IMPACT_AOE_RADIUS,
    MIRROR_PRISM_FOCUSED_DAMAGE_MULTIPLIER,
    QUANTUM_SPLIT_ANGLE,
    QUANTUM_SPLIT_DELAY,
    RAIL_BULLET_RADIUS,
    RICOCHET_DAMAGE_MULTIPLIER,
    RICOCHET_ENEMY_RANGE,
    RICOCHET_MAX_BOUNCES,
    VOID_NEEDLE_CRIT_SPLASH_DAMAGE_MULTIPLIER,
    VOID_NEEDLE_CRIT_SPLASH_RADIUS,
    consumePeriodicTicks,
    resolveIcefirePrimaryDamageMultiplier,
    resolvePierceRetention,
    findNearestRicochetTarget,
} from '../../assets/scripts/core/weaponMechanics';

function testFirstRoundMechanicTuningConstants(): void {
    assert.equal(RAIL_BULLET_RADIUS, 7, 'rail corridor must be wider than the old radius 5');
    assert.equal(MIRROR_PRISM_FOCUSED_DAMAGE_MULTIPLIER, 1.65);
    assert.equal(RICOCHET_MAX_BOUNCES, 2);
    assert.equal(RICOCHET_ENEMY_RANGE, 420);
    assert.equal(RICOCHET_DAMAGE_MULTIPLIER, 1.15);
    assert.equal(METEOR_BURN_RADIUS, 72);
    assert.equal(METEOR_BURN_TICK_INTERVAL, 0.5);
    assert.equal(METEOR_BURN_DAMAGE_PER_SECOND, 0.16);
    assert.equal(METEOR_BURN_SLOW_DURATION, 0.35);
    assert.equal(METEOR_BURN_SLOW_FACTOR, 0.78);
    assert.equal(METEOR_IMPACT_AOE_RADIUS, 110);
    assert.equal(METEOR_IMPACT_AOE_DAMAGE_MULTIPLIER, 0.40);
    assert.equal(DRONE_CHARGE_PER_KILL, 34, 'three kills should trigger a drone explosion');
    assert.equal(FROST_SLOW_DURATION, 0.6);
    assert.equal(GRAVITY_KNOCKBACK_FORCE, 115);
    assert.equal(GRAVITY_KNOCKBACK_FORCE_CRIT, 230);
    assert.equal(GRAVITY_BULLET_LIFE, 1.50);
    assert.equal(GRAVITY_IMPACT_RADIUS, 120);
    assert.equal(GRAVITY_IMPACT_DAMAGE_MULTIPLIER, 0.40);
    assert.equal(GRAVITY_IMPACT_STUN_DURATION, 0.45);
    assert.equal(VOID_NEEDLE_CRIT_SPLASH_RADIUS, 75);
    assert.equal(VOID_NEEDLE_CRIT_SPLASH_DAMAGE_MULTIPLIER, 0.30);
    assert.equal(QUANTUM_SPLIT_DELAY, 0.42);
    assert.equal(QUANTUM_SPLIT_ANGLE, 0.30);
    assert.equal(ICEFIRE_KILL_AOE_RADIUS, 115);
    assert.equal(ICEFIRE_KILL_AOE_DAMAGE_MULTIPLIER, 0.45);
    assert.equal(ICEFIRE_BULLET_LIFE, 1.55);
    assert.equal(ICEFIRE_ON_HIT_AOE_RADIUS, 80);
    assert.equal(ICEFIRE_ON_HIT_AOE_DAMAGE_MULTIPLIER, 0.25);
    assert.equal(ICEFIRE_SLOW_DURATION, 1.0);
    assert.equal(ICEFIRE_FROZEN_FIRE_MULTIPLIER, 2.0);
}

function testRicochetChoosesNearestEligibleEnemy(): void {
    const enemies: Array<{ id: number; x: number; y: number; active: boolean }> = [
        { id: 1, x: 20, y: 0, active: true },
        { id: 2, x: 60, y: 0, active: true },
        { id: 3, x: 30, y: 0, active: false },
        { id: 4, x: 500, y: 0, active: true },
    ];
    const hitIds = new Set<number>([1]);
    const target = findNearestRicochetTarget(
        enemies,
        0,
        0,
        RICOCHET_ENEMY_RANGE,
        hitIds,
        (enemy: { active: boolean }) => enemy.active,
        (enemy: { x: number; y: number }) => enemy,
    );
    assert.equal(target?.id, 2, 'must skip already-hit, inactive and out-of-range enemies');
}

function testRicochetReturnsNullWithoutEligibleEnemy(): void {
    const loneEnemy: Array<{ id: number; x: number; y: number }> = [{ id: 1, x: 10, y: 0 }];
    const target = findNearestRicochetTarget(
        loneEnemy,
        0,
        0,
        100,
        new Set([1]),
        () => true,
        (enemy: { id: number; x: number; y: number }) => enemy,
    );
    assert.equal(target, null);
}

function testFrozenFireDoublesPrimaryDamageOnlyForFireShots(): void {
    assert.equal(resolveIcefirePrimaryDamageMultiplier('icefire_fire', true), 2.0);
    assert.equal(resolveIcefirePrimaryDamageMultiplier('icefire_fire', false), 1.0);
    assert.equal(resolveIcefirePrimaryDamageMultiplier('icefire_ice', true), 1.0);
}

function testRicochetDoesNotUsePierceDamageDecay(): void {
    assert.equal(resolvePierceRetention('ricochet', 0.5), 1.0);
    assert.equal(resolvePierceRetention('straight', 0.5), 1.0);
    assert.equal(resolvePierceRetention('poison', 0.5), 0.5);
}

function testPeriodicTickConsumptionIncludesLifetimeBoundary(): void {
    assert.deepEqual(consumePeriodicTicks(3.0, 0.5, 6), { ticks: 6, remainder: 0 });
    assert.deepEqual(consumePeriodicTicks(3.2, 0.5, 6), { ticks: 6, remainder: 0.2 });
    assert.deepEqual(consumePeriodicTicks(0.49, 0.5, 6), { ticks: 0, remainder: 0.49 });
}

testFirstRoundMechanicTuningConstants();
testRicochetChoosesNearestEligibleEnemy();
testRicochetReturnsNullWithoutEligibleEnemy();
testFrozenFireDoublesPrimaryDamageOnlyForFireShots();
testRicochetDoesNotUsePierceDamageDecay();
testPeriodicTickConsumptionIncludesLifetimeBoundary();

console.log('weaponMechanics tests passed.');

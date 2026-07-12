import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const game = readFileSync(resolve(root, 'assets/scripts/RogueShooterGame.ts'), 'utf8');
const projectile = readFileSync(resolve(root, 'assets/scripts/projectile/projectileManager.ts'), 'utf8');

function testMirrorPrismKeepsFiveShotsAndFocusesPrimaryRay(): void {
    const start = game.indexOf("shootMechanic === 'radial_5'");
    const end = game.indexOf("shootMechanic === 'poison'", start);
    assert(start >= 0 && end > start, 'radial_5 shooting branch must exist');
    const body = game.slice(start, end);
    assert.match(body, /i === 0\s*\?\s*damage \* MIRROR_PRISM_FOCUSED_DAMAGE_MULTIPLIER\s*:\s*damage/);
    assert.match(body, /for \(let i = 0; i < 5; i\+\+\)/, 'mirror prism must remain a five-ray radial weapon');
}

function testProjectileMechanicConstantsAreWired(): void {
    assert.match(projectile, /case 'rail': return RAIL_BULLET_RADIUS/);
    assert.match(projectile, /METEOR_BURN_DAMAGE_PER_SECOND \* bullet\.damage \* METEOR_BURN_TICK_INTERVAL/);
    assert.match(projectile, /METEOR_IMPACT_AOE_DAMAGE_MULTIPLIER/);
    assert.match(projectile, /const radius = Math\.round\(METEOR_BURN_RADIUS \* rangeMult\)/);
    assert.match(projectile, /tickInterval: METEOR_BURN_TICK_INTERVAL/);
    assert.match(projectile, /findNearestRicochetTarget\(/, 'thorn crossbow must ricochet between enemies in open terrain');
    assert.match(projectile, /this\.ctx\.cs\.droneCharge \+= DRONE_CHARGE_PER_KILL/);
    assert.match(projectile, /GRAVITY_IMPACT_DAMAGE_MULTIPLIER/);
    assert.match(projectile, /VOID_NEEDLE_CRIT_SPLASH_DAMAGE_MULTIPLIER/);
    assert.match(projectile, /bullet\.maxLife - QUANTUM_SPLIT_DELAY/);
    assert.match(projectile, /\[-QUANTUM_SPLIT_ANGLE, QUANTUM_SPLIT_ANGLE\]/);
    assert.match(projectile, /Math\.round\(ICEFIRE_KILL_AOE_RADIUS \* rangeMult\)/);
    assert.match(projectile, /case 'gravity': return GRAVITY_BULLET_LIFE/);
    assert.match(projectile, /case 'icefire': return ICEFIRE_BULLET_LIFE/);
    assert.match(projectile, /case 'icefire_ice'/);
    assert.match(projectile, /case 'icefire_fire'/);
    assert.match(game, /shootMechanic === 'icefire_judge'/);
}

function testRicochetStopsCollisionScanAfterRedirect(): void {
    const start = projectile.indexOf('// 机制: ricochet (荆棘连弩) — 开阔地形中');
    const end = projectile.indexOf('// 机制: echo_chain', start);
    assert(start >= 0 && end > start, 'enemy ricochet block must exist');
    const body = projectile.slice(start, end);
    assert.match(body, /bulletRemoved = true;[\s\S]*?break;/, 'successful redirect must break the current enemy bucket scan');
    assert.doesNotMatch(body, /bullet\.pierce\s*\+=/, 'redirect must not consume or artificially add pierce');
}

function testBurnZoneCanDamageSameEnemyOnLaterTicks(): void {
    const start = projectile.indexOf('private tickBurnZones');
    const end = projectile.indexOf('// ── Muzzle flash', start);
    assert(start >= 0 && end > start, 'tickBurnZones method must exist');
    const body = projectile.slice(start, end);
    assert.doesNotMatch(body, /zone\.hitSet\.has\(enemy\.id\)/, 'persistent hitSet incorrectly limits burn to one tick per enemy');
    assert.match(body, /consumePeriodicTicks\(/);
    assert.match(body, /for \(const enemy of \[\.\.\.this\.ctx\.enemyMgr\.enemies\]\)/);
}

function testGravityMutatesOnlySurvivingTargets(): void {
    const start = projectile.indexOf('private onKnockbackHit');
    const end = projectile.indexOf('private onVoidNeedleCritHit', start);
    const body = projectile.slice(start, end);
    assert.match(body, /damageEnemy\(other,[\s\S]*?enemySet\.has\(other\)[\s\S]*?other\.stunTimer/);
    assert.match(body, /if \(!this\.ctx\.enemyMgr\.enemySet\.has\(enemy\)[\s\S]*?return/);
}

function testWeaponFamilyAttackRangeAffectsTargetingStats(): void {
    assert.match(game, /weaponStats\?\.attackRange/);
    assert.match(game, /stats\.attackRange \+= weaponAttackRange - baseAttackRange/);
    assert.match(game, /findNearestEnemy\(this\.cs\.playerX, this\.cs\.playerY, this\.getAttackRange\(\)\)/);
}

function testOverheatMechanicIsWired(): void {
    assert.match(game, /shootMechanic === 'overheat'/);
    assert.match(game, /overheatStacks = Math\.min\(5, this\.cs\.overheatStacks \+ 1\)/);
    assert.match(game, /overheatStacks = Math\.max\(0, this\.cs\.overheatStacks - 1\)/);
}

function testIcefireImplementsCatalogSemantics(): void {
    assert.match(projectile, /enemy\.slowTimer = ICEFIRE_SLOW_DURATION/);
    assert.match(projectile, /resolveIcefirePrimaryDamageMultiplier\(/);
}

testMirrorPrismKeepsFiveShotsAndFocusesPrimaryRay();
testProjectileMechanicConstantsAreWired();
testRicochetStopsCollisionScanAfterRedirect();
testBurnZoneCanDamageSameEnemyOnLaterTicks();
testGravityMutatesOnlySurvivingTargets();
testWeaponFamilyAttackRangeAffectsTargetingStats();
testOverheatMechanicIsWired();
testIcefireImplementsCatalogSemantics();

console.log('weapon mechanic wiring tests passed.');

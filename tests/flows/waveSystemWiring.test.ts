import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const manager = fs.readFileSync(path.join(root, 'assets/scripts/enemy/enemyManager.ts'), 'utf8');
const patterns = fs.readFileSync(path.join(root, 'assets/scripts/enemy/enemySpawnPatterns.ts'), 'utf8');

assert.ok(manager.includes("from '../catalogs/waveCatalog'"), 'EnemyManager must consume the authoritative wave catalog');
assert.ok(manager.includes('getUnlockedEnemySpecsForWave(ENEMY_SPECS'), 'EnemyManager must use cumulative unlockWave filtering');
assert.ok(!manager.includes('ENEMY_SPECS.slice(start'), 'wave 9-10 tail slicing must be removed');
assert.ok(!manager.includes('maybeSpawnMiniBoss();'), 'mini boss scheduling must not roll once per spawn batch');
assert.ok(manager.includes("phase === 'overtime'"), 'Boss overtime needs an explicit runtime branch');
assert.ok(manager.includes('bossVictoryTimer'), 'Boss death needs a short victory transition timer');
assert.ok(manager.includes('advanceBossVictoryTimer'), 'Boss victory delay must use the tested state transition helper');
assert.ok(manager.includes('advanceBossSpawnState'), 'Boss reinforcement cadence must use the tested state transition helper');
assert.ok(manager.includes('getBossAddSpawnBudget'), 'Boss reinforcement caps must use the tested budget helper');
assert.ok(manager.includes('boss.speed *= BOSS_OVERTIME_SPEED_MULTIPLIER')
    && manager.includes('boss.damage *= BOSS_OVERTIME_DAMAGE_MULTIPLIER')
    && manager.includes('boss.skillTimer *= BOSS_OVERTIME_SKILL_COOLDOWN_MULTIPLIER'),
'Boss overtime must apply every approved enrage multiplier once');
assert.ok(manager.includes('scaleBossSkillCooldown'), 'all future Boss skill cooldown resets must consume the overtime ×0.85 helper');

const spawningBody = manager.slice(manager.indexOf('public updateSpawning(dt: number)'), manager.indexOf('public enemyShoot('));
assert.ok(
    spawningBody.indexOf('if (this.isBossWave())') < spawningBody.indexOf('this.cs.waveSpawnTimer -= dt;'),
    'Boss waves must return into their state machine before the ordinary spawn loop can run',
);
assert.equal((manager.match(/if \(shouldScheduleMiniBoss\(/g) || []).length, 1,
    'eligible non-Boss waves must roll for a mini boss exactly once at wave start');
assert.ok(manager.includes('this.miniBossSpawnedThisWave = true;')
    && manager.includes('this.spawnScheduledMiniBoss();'),
'mini boss schedule must be consumed once before spawning');
assert.ok(patterns.includes('allocateSpawnBudget'), 'spawn formations must consume the shared budget allocator');

console.log('✅ flows/waveSystemWiring tests passed');

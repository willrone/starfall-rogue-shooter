import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
    resolve(process.cwd(), 'assets/scripts/enemy/enemyManager.ts'),
    'utf8',
);

const intervalMatch = source.match(/const AURA_BUFF_INTERVAL = ([0-9.]+);/);
assert.ok(intervalMatch, 'aura buff interval must remain explicit');
const interval = Number(intervalMatch[1]);
assert.ok(interval >= 0.1 && interval <= 0.2, `aura buff tick must stay at 5-10 Hz, got ${1 / interval} Hz`);

const auraStart = source.indexOf('private updateEnemyAura(');
const skillStart = source.indexOf('public updateEnemySkill(', auraStart);
assert.ok(auraStart >= 0 && skillStart > auraStart, 'aura update must have a dedicated hotpath');
const auraBody = source.slice(auraStart, skillStart);

assert.match(auraBody, /enemy\.auraBuffTimer -= dt;/, 'aura scan must be timer-gated');
assert.match(auraBody, /for \(const other of this\.enemies\)/, 'aura must retain its ally scan');
assert.match(auraBody, /other\.dashVx = 1;/, 'aura must retain the existing ally marker');
assert.match(auraBody, /enemy\.auraPulseTimer -= dt;/, 'aura pulse must have an independent timer');
assert.equal(
    (auraBody.match(/drawAreaPulse\(/g) || []).length,
    1,
    'aura pulse must only be emitted from the visual timer branch',
);
assert.doesNotMatch(auraBody, /getEnemyPosition\(/, 'aura scan must not allocate position wrappers');

const skillBody = source.slice(skillStart, source.indexOf('public getEnemySkillDelay(', skillStart));
assert.doesNotMatch(
    skillBody,
    /enemy\.spec\.family === 'aura'/,
    'the full aura scan must not run from the per-frame skill path',
);

console.log('enemy/enemyAuraPerformance tests passed');

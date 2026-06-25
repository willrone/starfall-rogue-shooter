import assert from 'node:assert/strict';

import {
    STAT_META,
    addCharacterStats,
    createBaseCharacterStats,
    createEmptyCharacterStats,
    formatStat,
} from '../../assets/scripts/core/stats';

const empty = createEmptyCharacterStats();
assert.equal(Object.values(empty).every((value) => value === 0), true, 'empty stats should start at zero');

const base = createBaseCharacterStats();
assert.equal(base.attackPower > 0, true, 'base stats should include starting attack power');
assert.equal(base.attackRange > 0, true, 'base stats should include starting attack range');
assert.equal(STAT_META.attackPower.name, '攻击力', 'stat meta should expose readable names');
assert.equal(formatStat('attackSpeed', 0.14), '+14.0%', 'percent stats should format as percentages');
assert.equal(formatStat('critDamage', 0.25), '+0.25', 'multiplier stats should format as multipliers');
assert.equal(formatStat('attackPower', 6), '+6', 'number stats should format as plain numbers');

const delta = createEmptyCharacterStats();
delta.attackPower = 5;
delta.moveSpeed = 12;
const merged = addCharacterStats(base, delta);
assert.equal(merged.attackPower, base.attackPower + 5, 'stat merge should add attack power');
assert.equal(merged.moveSpeed, base.moveSpeed + 12, 'stat merge should add move speed');
assert.equal(base.attackPower !== merged.attackPower, true, 'merge should return a new object');

console.log('stats tests passed.');

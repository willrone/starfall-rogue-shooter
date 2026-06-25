import assert from 'node:assert/strict';

import {
    RESOURCE_DEFS,
    RESOURCE_ZERO,
    createEmptyWallet,
    formatWallet,
    getResourceDef,
    hasResources,
    spendResources,
} from '../../assets/scripts/core/resources';

const wallet = createEmptyWallet();
assert.deepEqual(wallet, RESOURCE_ZERO, 'empty wallet should start from zero values');
assert.notEqual(wallet, RESOURCE_ZERO, 'empty wallet should be a new object');

wallet.cores = 2;
wallet.shards = 5;
assert.equal(formatWallet(wallet), '核心 2  碎片 5', 'wallet formatting should follow resource definition order');
assert.equal(formatWallet(createEmptyWallet()), '无', 'empty wallet should be formatted as none');

assert.equal(getResourceDef('crystals').name, '虚空晶体', 'resource lookup should return matching definition');
assert.equal(RESOURCE_DEFS.length, 6, 'resource catalog should contain the six runtime resource types');

const inventory = createEmptyWallet();
inventory.cores = 2;
inventory.shards = 5;
const cost = createEmptyWallet();
cost.cores = 1;
cost.shards = 4;
assert.equal(hasResources(inventory, cost), true, 'wallet should report enough resources when all costs are covered');
assert.deepEqual(spendResources(inventory, cost), {
    alloy: 0,
    cores: 1,
    shards: 1,
    biomass: 0,
    circuits: 0,
    crystals: 0,
}, 'spending resources should return a debited wallet');

cost.crystals = 1;
assert.equal(hasResources(inventory, cost), false, 'wallet should reject costs with any missing resource');
assert.equal(spendResources(inventory, cost), null, 'spending unavailable resources should return null');

console.log('resources tests passed.');

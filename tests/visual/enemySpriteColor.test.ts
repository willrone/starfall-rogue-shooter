import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('assets/scripts/enemy/enemyManager.ts', 'utf8');
const visualColorBlock = source.match(/if \(hitColor !== wasHitColor\) \{([\s\S]*?)\n            \}/)?.[1] || '';

assert.match(
    visualColorBlock,
    /enemy\.sprite\.color = hitColor[\s\S]*?#FFF4B8[\s\S]*?#FFFFFF/,
    'sprite-backed enemies must render at original PNG color outside hit flash',
);
assert.doesNotMatch(
    visualColorBlock,
    /getEnemyTint\(/,
    'variant tint must not multiply sprite-backed enemy art',
);

console.log('enemy sprite color tests passed.');

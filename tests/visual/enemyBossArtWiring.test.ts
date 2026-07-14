import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

const constants = readFileSync('assets/scripts/enemy/enemyConstants.ts', 'utf8');
const game = readFileSync('assets/scripts/RogueShooterGame.ts', 'utf8');
const manager = readFileSync('assets/scripts/enemy/enemyManager.ts', 'utf8');

const strips = [
    'enemy_brute_prime_idle',
    'enemy_aura_arc_idle',
    'enemy_bomber_mother_idle',
    'enemy_splitter_swift_idle',
    'enemy_warden_regen_idle',
    'enemy_void_colossus_idle',
    'enemy_energy_worm_idle',
    'enemy_frost_queen_idle',
    'enemy_inferno_lord_idle',
    'enemy_void_weaver_idle',
];

for (const strip of strips) {
    assert(constants.includes(`frameName: '${strip}'`), `${strip} must have an animation contract`);
    assert(existsSync(`assets/resources/art/enemies/${strip}.png`), `${strip}.png must exist in runtime resources`);
}

assert.match(
    game,
    /ENEMY_STRIP_META\[spec\.family\] \|\| \(boss \? ENEMY_STRIP_META\.boss : undefined\)/,
    'enemy animation routing must prefer each mini-boss and boss family before the generic boss fallback',
);
assert.match(manager, /const variantIndex = enemy\.boss \? 0 : enemy\.spec\.variantIndex \|\| 0;/,
    'batched enemy rendering must retain a visible variant identity layer');
assert.match(manager, /tickCount = 1 \+ \(\(variantIndex - 1\) % 5\)/,
    'variant identity layer must vary beyond a shared halo');

console.log('enemy boss art wiring tests passed.');

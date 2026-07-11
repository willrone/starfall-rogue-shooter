import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rogueShooterGame = readFileSync(join(root, 'assets/scripts/RogueShooterGame.ts'), 'utf8');
const enemyManager = readFileSync(join(root, 'assets/scripts/enemy/enemyManager.ts'), 'utf8');

function testFindNearestEnemySignatureIsThreeArg(): void {
    assert.match(
        enemyManager,
        /findNearestEnemy\(x: number, y: number, range: number\): Enemy \| null/,
        'EnemyManager.findNearestEnemy must take origin x/y plus range',
    );
}

function testRogueShooterTargetingPassesPlayerOrigin(): void {
    const oneArgCalls = [...rogueShooterGame.matchAll(/enemyMgr\.findNearestEnemy\(([^)]*)\)/g)]
        .map((match) => match[1].replace(/\s+/g, ' ').trim())
        .filter((args) => !args.includes('this.cs.playerX') || !args.includes('this.cs.playerY'));

    assert.deepEqual(
        oneArgCalls,
        [],
        'RogueShooterGame must pass playerX/playerY/range to enemyMgr.findNearestEnemy; single-range calls silently break shooting',
    );
}

testFindNearestEnemySignatureIsThreeArg();
testRogueShooterTargetingPassesPlayerOrigin();

console.log('combatTargetingContract tests passed.');

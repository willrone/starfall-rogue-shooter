import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const enemySource = readFileSync(
    resolve(process.cwd(), 'assets/scripts/enemy/enemyManager.ts'),
    'utf8',
);
const enemyTypesSource = readFileSync(
    resolve(process.cwd(), 'assets/scripts/enemy/enemyTypes.ts'),
    'utf8',
);
const entrySource = readFileSync(
    resolve(process.cwd(), 'assets/scripts/RogueShooterGame.ts'),
    'utf8',
);

const intervalMatch = enemySource.match(/export const ENEMY_BAR_REFRESH_INTERVAL = ([0-9.]+);/);
assert.ok(intervalMatch, 'enemy bar refresh interval must remain explicit');
const interval = Number(intervalMatch[1]);
assert.ok(interval >= 0.1 && interval <= 0.125,
    `enemy bars must stay at 8-10 Hz, got ${1 / interval} Hz`);

const drawStart = enemySource.indexOf('public drawAllBars(dt: number)');
const drawEnd = enemySource.indexOf('private get cs', drawStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart, 'enemy bars must have a dedicated redraw hotpath');
const drawBody = enemySource.slice(drawStart, drawEnd);

const cadenceGate = drawBody.indexOf('this.barRefreshElapsed + 1e-6 < ENEMY_BAR_REFRESH_INTERVAL');
const clearCall = drawBody.indexOf('this.barGfx.clear()');
assert.ok(cadenceGate >= 0 && clearCall > cadenceGate,
    'the layer cadence gate must run before Graphics.clear and the full enemy scan');
assert.match(drawBody, /this\.barRefreshElapsed \+= Math\.max\(0, dt\)/,
    'bar cadence must advance from the combat frame delta');
assert.match(drawBody, /this\.barRefreshElapsed %= ENEMY_BAR_REFRESH_INTERVAL/,
    'bar cadence must retain fractional time instead of drifting at 30 or 60 FPS');
assert.doesNotMatch(drawBody, /lastBarDrawTime/,
    'a shared layer must not clear globally and then skip individual bars');

assert.doesNotMatch(enemyTypesSource, /lastBarDrawTime/,
    'obsolete per-enemy bar timers must not remain in the runtime entity shape');
assert.match(entrySource, /this\.enemyMgr\.drawAllBars\(combatDt\)/,
    'the combat frame loop must pass its bounded delta to the bar cadence');

const clearWorldStart = entrySource.indexOf('private clearWorld()');
const clearWorldEnd = entrySource.indexOf('private removePickup(', clearWorldStart);
assert.ok(clearWorldStart >= 0 && clearWorldEnd > clearWorldStart, 'clearWorld source markers must exist');
const clearWorldBody = entrySource.slice(clearWorldStart, clearWorldEnd);
assert.match(clearWorldBody, /this\.enemyMgr\.resetBarLayer\(\)/,
    'battle teardown must clear stale shared bars and prime the next run');

console.log('enemy/enemyBarPerformance tests passed');

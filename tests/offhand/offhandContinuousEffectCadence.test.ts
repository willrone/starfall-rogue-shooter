import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('assets/scripts/offhand/offhandManager.ts', 'utf8');

function readNumberConstant(name: string): number {
    const match = source.match(new RegExp(`export const ${name} = ([0-9.]+);`));
    assert.ok(match, `missing numeric constant ${name}`);
    return Number(match[1]);
}

function sliceBetween(startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
    return source.slice(start, end);
}

function readRuntimeFunction(name: string, endMarker: string): (...args: number[]) => number {
    const declaration = sliceBetween(`export function ${name}(`, endMarker).replace(/^export /, '');
    return new Function(
        `const CONTINUOUS_TICK_EPSILON = 1e-8; ${declaration}; return ${name};`,
    )() as (...args: number[]) => number;
}

const interval = readNumberConstant('OFFHAND_CONTINUOUS_TICK_INTERVAL');
const baselineFps = readNumberConstant('OFFHAND_CONTINUOUS_BASELINE_FPS');
assert.equal(interval, 0.1, 'continuous damage scans should run at 10 Hz');
assert.equal(baselineFps, 60, 'orbit blade damage must preserve the previous 60 Hz damage baseline');

function consumeCadence(dts: number[]): { ticks: number; remainder: number } {
    let ticks = 0;
    let remainder = 0;
    for (const dt of dts) {
        const accumulated = remainder + Math.max(0, dt);
        const consumed = Math.floor((accumulated + 1e-8) / interval);
        ticks += consumed;
        const next = accumulated - consumed * interval;
        remainder = next > 1e-8 ? next : 0;
    }
    return { ticks, remainder };
}

function repeated(value: number, count: number): number[] {
    return Array.from({ length: count }, () => value);
}

for (const dts of [
    repeated(1 / 60, 60),
    repeated(1 / 30, 30),
    [0.04, 0.02, 0.11, 0.03, 0.25, 0.05, 0.5],
]) {
    const result = consumeCadence(dts);
    assert.equal(result.ticks, 10, 'one elapsed second must always consume ten damage ticks');
    assert.ok(Math.abs(result.remainder) < 1e-7, `unexpected one-second remainder ${result.remainder}`);
}

const catchUp = consumeCadence([0.35]);
assert.equal(catchUp.ticks, 3, 'a delayed frame must catch up every complete fixed tick');
assert.ok(Math.abs(catchUp.remainder - 0.05) < 1e-7);
assert.equal(consumeCadence([0.35, 0.05]).ticks, 4, 'the unconsumed remainder must feed the next frame');

const oneSecondTicks = consumeCadence(repeated(1 / 60, 60)).ticks;
const sampleDamage = 17;
assert.equal(
    oneSecondTicks * sampleDamage * interval * baselineFps,
    sampleDamage * 60,
    'orbit blade must retain its previous per-second damage at the 60 Hz gameplay baseline',
);
assert.equal(
    oneSecondTicks * sampleDamage * interval,
    sampleDamage,
    'control field elapsed-time integration must retain damage per second',
);
assert.equal(
    oneSecondTicks * sampleDamage * interval * 2,
    sampleDamage * 2,
    'one burn trail point must retain its existing two-times damage-per-second integration',
);

const sweepHitProgress = readRuntimeFunction(
    'getOffhandSweepHitProgress',
    'export function getOffhandSweepContactFraction(',
);
const sweepContactFraction = readRuntimeFunction(
    'getOffhandSweepContactFraction',
    'export function interpolateOffhandTickPosition(',
);
const interpolateTickPosition = readRuntimeFunction(
    'interpolateOffhandTickPosition',
    '// ── Host Context',
);
const deg = (value: number) => value * Math.PI / 180;
const t1Sweep = Math.PI * 2 * interval;
assert.ok(
    sweepHitProgress(Math.cos(0.3) * 180, Math.sin(0.3) * 180, 0, t1Sweep, 180, 4) >= 0,
    'T1 sweep must hit a small target crossed between fixed-tick endpoints',
);
assert.equal(
    sweepHitProgress(Math.cos(0.9) * 180, Math.sin(0.9) * 180, 0, t1Sweep, 180, 4),
    -1,
    'T1 sweep must reject a target outside the swept angle',
);
assert.ok(
    sweepHitProgress(Math.cos(deg(5)) * 180, Math.sin(deg(5)) * 180, deg(350), deg(30), 180, 4) >= 0,
    'sweeps crossing the zero-angle boundary must not miss targets',
);
assert.ok(
    sweepHitProgress(Math.cos(deg(210)) * 180, Math.sin(deg(210)) * 180, 0, Math.PI * 2 * 0.7, 180, 2) >= 0,
    'high-speed sweeps must retain small-target coverage between endpoints',
);
assert.ok(
    sweepHitProgress(Math.cos(deg(350)) * 180, Math.sin(deg(350)) * 180, deg(10), deg(-30), 180, 4) >= 0,
    'reverse sweeps crossing the zero-angle boundary must work',
);
assert.equal(sweepHitProgress(145, 0, 0, Math.PI, 180, 10), -1, 'targets outside the radial band must not be hit');

const contactPadding = Math.asin(4 / 180);
const centeredContact = sweepContactFraction(
    Math.cos(0.3) * 180,
    Math.sin(0.3) * 180,
    0,
    t1Sweep,
    180,
    4,
);
assert.ok(
    Math.abs(centeredContact - contactPadding * 2 / t1Sweep) < 1e-7,
    'a narrow crossing must receive only its contact-time share of the fixed tick',
);
assert.ok(
    sweepContactFraction(Math.cos(0.15) * 180, Math.sin(0.15) * 180, 0, t1Sweep, 180, 4) > 0
        && sweepContactFraction(Math.cos(0.45) * 180, Math.sin(0.45) * 180, 0, t1Sweep, 180, 4) > 0,
    'one blade sweep must retain every intersected target, not just the first target',
);
let oneTurnContact = 0;
for (let tick = 0; tick < 10; tick++) {
    oneTurnContact += sweepContactFraction(180, 0, tick * t1Sweep, t1Sweep, 180, 4);
}
assert.ok(
    Math.abs(oneTurnContact * interval * baselineFps - 60 * contactPadding * 2 / (Math.PI * 2)) < 1e-7,
    'contact-weighted 10 Hz damage must match one turn of 60 Hz overlap sampling',
);

assert.equal(interpolateTickPosition(0, 100, 0.1, 0.25), 40);
assert.equal(interpolateTickPosition(0, 100, 0.2, 0.25), 80);
assert.equal(interpolateTickPosition(0, 100, 0.4, 0.25), 100, 'catch-up samples must clamp to frame movement');

function simulateFieldCatchUp(previous: string[], current: string[], ticks: number): Map<string, number> {
    const hits = new Map<string, number>();
    for (let tick = 0; tick < ticks; tick++) {
        const targets = tick < ticks - 1 ? previous : current;
        for (const target of targets) hits.set(target, (hits.get(target) || 0) + 1);
    }
    return hits;
}

const fieldCatchUp = simulateFieldCatchUp(['left-before-current-frame'], ['entered-on-current-frame'], 3);
assert.equal(fieldCatchUp.get('left-before-current-frame'), 2, 'a departed field target keeps completed prior ticks');
assert.equal(fieldCatchUp.get('entered-on-current-frame'), 1, 'a new field target must not receive pre-entry catch-up ticks');
const burnCatchUp = simulateFieldCatchUp(['left-burn-trail'], ['entered-burn-trail'], 3);
assert.equal(burnCatchUp.get('left-burn-trail'), 2, 'a departed burn target keeps completed prior ticks');
assert.equal(burnCatchUp.get('entered-burn-trail'), 1, 'a new burn target must not receive pre-entry catch-up ticks');

const cadenceBody = sliceBetween('private consumeContinuousEffectTicks(', 'private tickOrbitBlade(');
assert.match(cadenceBody, /Math\.floor\(\(accumulated \+ CONTINUOUS_TICK_EPSILON\) \/ OFFHAND_CONTINUOUS_TICK_INTERVAL\)/);
assert.match(cadenceBody, /this\.continuousEffectTime\[key\] = remainder/);

const orbitTick = sliceBetween('private tickOrbitBlade(', 'private applyOrbitBladeDamage(');
assert.match(orbitTick, /consumeContinuousEffectTicks\('orbit_blade', dt\)/);
assert.match(orbitTick, /if \(damageTicks > 0\)[\s\S]*applyOrbitBladeDamage/);
assert.match(orbitTick, /OFFHAND_CONTINUOUS_TICK_INTERVAL[\s\S]*OFFHAND_CONTINUOUS_BASELINE_FPS/);
assert.match(orbitTick, /endAngle - sweepAngle[\s\S]*sweepAngle/);
assert.doesNotMatch(orbitTick, /for \(const enemy of/, 'orbit blade must not scan enemies on non-damage frames');
const orbitDamage = sliceBetween('private applyOrbitBladeDamage(', 'private tickOrbitBlock(');
assert.match(orbitDamage, /getOffhandSweepContactFraction\(/);
assert.match(orbitDamage, /damage \* contactFraction/);
assert.doesNotMatch(orbitDamage, /bestProgress|break;/, 'a blade sweep must retain every intersected target');

const burnTick = sliceBetween('private tickOrbitBurn(', 'private advanceBurnTrailGeometry(');
assert.match(burnTick, /consumeContinuousEffectTicks\('orbit_burn', dt\)/);
assert.match(burnTick, /for \(let tick = 0; tick < damageTicks; tick\+\+\)/);
assert.match(burnTick, /interpolateOffhandTickPosition\(frameStartX, px, tickOffset, dt\)/);
assert.match(
    burnTick,
    /advanceBurnTrailGeometry\(stats, this\.burnTickX, this\.burnTickY, tickX, tickY\)/,
);
assert.match(burnTick, /tick < damageTicks - 1[\s\S]*applyStoredBurnTrailTick[\s\S]*applyCurrentBurnTrailTick/);
assert.doesNotMatch(burnTick, /for \(const enemy of/, 'burn trails must not scan enemies on non-damage frames');
assert.doesNotMatch(burnTick, /damageTime|retiredBurnTrail/);
const burnDamage = sliceBetween('private advanceBurnTrailGeometry(', 'private get cd');
assert.match(burnDamage, /stats\.damage \* OFFHAND_CONTINUOUS_TICK_INTERVAL \* 2/);
assert.match(burnDamage, /t -= OFFHAND_CONTINUOUS_TICK_INTERVAL/);
assert.match(burnDamage, /burnTrailTargetCounts\.clear\(\)/);
assert.match(burnDamage, /applyStoredBurnTrailTick/);
assert.match(burnDamage, /damage \* count/);

const fieldTick = sliceBetween('private tickControlField(', 'private applyCurrentControlFieldTick(');
assert.match(fieldTick, /consumeContinuousEffectTicks\('control_field', dt\)/);
assert.match(fieldTick, /for \(let tick = 0; tick < damageTicks; tick\+\+\)/);
assert.match(fieldTick, /tick < damageTicks - 1[\s\S]*applyStoredControlFieldTick[\s\S]*applyCurrentControlFieldTick/);
assert.doesNotMatch(fieldTick, /for \(const enemy of/, 'control field must not scan enemies on non-damage frames');
const fieldDamage = sliceBetween('private applyCurrentControlFieldTick(', 'private tickControlSeal(');
assert.match(fieldDamage, /controlFieldTargets\.clear\(\)/);
assert.match(fieldDamage, /stats\.damage \* OFFHAND_CONTINUOUS_TICK_INTERVAL/);
assert.match(fieldDamage, /enemy\.slowTimer = 0\.3/, 'the existing continuous slow refresh must be preserved');

const resetBody = sliceBetween('public clearBattleState()', '/** \u4e3b tick');
for (const key of ['orbit_blade', 'orbit_burn', 'control_field']) {
    assert.match(resetBody, new RegExp(`continuousEffectTime\\.${key} = 0`), `${key} accumulator must reset between battles`);
}
assert.match(resetBody, /controlFieldTargets\.clear\(\)/);
assert.match(resetBody, /burnTrailTargetCounts\.clear\(\)/);
assert.match(resetBody, /burnFrameInitialized = false/);

console.log('offhand continuous effect cadence tests passed.');

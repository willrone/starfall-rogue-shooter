import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
    resolve(process.cwd(), 'assets/scripts/RogueShooterGame.ts'),
    'utf8',
);

function sliceBetween(startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
    return source.slice(start, end);
}

function testHudTextIsThrottledWithoutThrottlingBars(): void {
    const intervalMatch = source.match(/const HUD_TEXT_REFRESH_INTERVAL = ([0-9.]+);/);
    assert.ok(intervalMatch, 'HUD text refresh interval must remain explicit');
    const interval = Number(intervalMatch[1]);
    assert.ok(interval >= 0.1 && interval <= 0.125, `HUD text must stay at 8-10 Hz, got ${1 / interval} Hz`);

    const updateBody = sliceBetween('update(dt: number)', 'private perfNow');
    assert.match(updateBody, /this\.updateHud\(dt\)/, 'the frame loop must delegate to the throttled HUD updater');
    assert.doesNotMatch(updateBody, /this\.refreshHud\(/, 'the frame loop must not rebuild HUD text every frame');

    const updateHudBody = sliceBetween('private updateHud(dt: number)', 'private setLabelText');
    assert.match(updateHudBody, /this\.drawBars\(\)/, 'HP, XP and shield fills must still be checked every frame');
    assert.match(updateHudBody, /hudTextRefreshTimer > 0/, 'HUD text refreshes must be timer-gated');
    assert.match(updateHudBody, /lastHudPhase === this\.cs\.phase/, 'phase changes must bypass the timer gate');

    const refreshBody = sliceBetween('private refreshHud(updateBars = true)', 'private ensureMenuVisible');
    assert.doesNotMatch(refreshBody, /getAvailableEnemySpecs\(/, 'HUD refresh must not scan an unused enemy pool');
    assert.match(refreshBody, /this\.setLabelText\(/, 'unchanged Label strings must not be assigned again');

    const buttonBody = sliceBetween('function drawButtonView', 'interface TimedGraphicsEffect');
    assert.match(buttonBody, /button\.renderKey === renderKey/, 'buttons must cache their rendered state');
    assert.match(buttonBody, /if \(button\.renderKey === renderKey\) return;/, 'unchanged buttons must skip Graphics redraws');
}

function testDroneVisualsOnlyRenderOncePerFrame(): void {
    const updateBody = sliceBetween('update(dt: number)', 'private perfNow');
    const calls = updateBody.match(/this\.updateDroneVisuals\(/g) || [];
    assert.equal(calls.length, 1, 'drone visuals must only be updated once in the frame loop');
    assert.match(updateBody, /this\.updateDroneVisuals\(combatDt\)/);
    assert.doesNotMatch(updateBody, /this\.updateDroneVisuals\(0\)/, 'a zero-delta second redraw doubles Graphics work');
}

function testTransientGraphicsEffectsUseBoundedPools(): void {
    const pulseSize = Number(source.match(/const AREA_PULSE_POOL_SIZE = (\d+);/)?.[1]);
    const zapSize = Number(source.match(/const DRONE_ZAP_POOL_SIZE = (\d+);/)?.[1]);
    assert.ok(pulseSize > 0 && pulseSize <= 64, `area pulse pool must be bounded, got ${pulseSize}`);
    assert.ok(zapSize > 0 && zapSize <= 32, `drone zap pool must be bounded, got ${zapSize}`);
    assert.match(source, /this\.initTransientGraphicsPools\(\)/, 'transient pools must be initialized with the world');
    assert.match(source, /this\.updateTransientGraphics\(dt\)/, 'transient pool lifetimes must update without scheduleOnce callbacks');

    const buildBody = sliceBetween('private buildScene()', 'private loadPlaceholderArt');
    const arenaIndex = buildBody.indexOf('this.drawWorldArena(this.worldNode)');
    const poolIndex = buildBody.indexOf('this.initTransientGraphicsPools()');
    assert.ok(arenaIndex >= 0 && poolIndex > arenaIndex,
        'WorldVfxLayer must be created after the battlefield so pooled effects are not hidden behind it');

    const initBody = sliceBetween('private initTransientGraphicsPools()', 'private createTransientGraphicsPool');
    assert.match(initBody, /new Node\('WorldVfxLayer'\)/, 'transient effects need a dedicated world VFX layer');
    assert.match(initBody, /this\.worldNode\.addChild\(layer\)/, 'WorldVfxLayer must follow the moving world transform');
    assert.match(initBody, /this\.createTransientGraphicsPool\(layer, 'EnemyAreaPulse'/,
        'area pulses must be children of WorldVfxLayer');
    assert.match(initBody, /this\.createTransientGraphicsPool\(layer, 'DroneZap'/,
        'drone zaps must be children of WorldVfxLayer');

    const factoryBody = sliceBetween('private createTransientGraphicsPool(', 'private keepWorldVfxLayerOnTop');
    assert.match(factoryBody, /parent\.addChild\(node\)/, 'pooled nodes must use the supplied VFX parent');
    const updateBody = sliceBetween('update(dt: number)', 'private perfNow');
    assert.match(updateBody, /this\.keepWorldVfxLayerOnTop\(\)/,
        'newly spawned world nodes must not overtake the persistent VFX layer');

    const pulseBody = sliceBetween('private drawAreaPulse(', 'private takeDamage(');
    assert.match(pulseBody, /acquireTransientGraphicsEffect/);
    assert.match(pulseBody, /gfx\.clear\(\)/, 'pooled pulse Graphics state must reset on reuse');
    assert.match(pulseBody, /effect\.remaining = 0\.16/);
    assert.doesNotMatch(pulseBody, /new Node\(/, 'drawAreaPulse must not allocate short-lived nodes');
    assert.doesNotMatch(pulseBody, /scheduleOnce|node\.destroy\(/, 'drawAreaPulse must not schedule per-effect destruction');

    const zapBody = sliceBetween('private drawZap(', 'private drawJoystick(');
    assert.match(zapBody, /acquireTransientGraphicsEffect/);
    assert.match(zapBody, /gfx\.clear\(\)/, 'pooled zap Graphics state must reset on reuse');
    assert.match(zapBody, /effect\.remaining = 0\.06/);
    assert.doesNotMatch(zapBody, /new Node\(/, 'drawZap must not allocate short-lived nodes');
    assert.doesNotMatch(zapBody, /scheduleOnce|node\.destroy\(/, 'drawZap must not schedule per-effect destruction');

    const destroyBody = sliceBetween('private destroyTransientGraphicsPools()', 'private drawAreaPulse(');
    assert.match(destroyBody, /this\.worldVfxLayer\.destroy\(\)/, 'destroy must release the VFX layer and all child pools');
    assert.match(destroyBody, /this\.worldVfxLayer = null/);
    assert.match(destroyBody, /this\.areaPulsePool = \[\]/);
    assert.match(destroyBody, /this\.droneZapPool = \[\]/);
    assert.match(destroyBody, /this\.areaPulsePoolCursor = 0/);
    assert.match(destroyBody, /this\.droneZapPoolCursor = 0/);
}

testHudTextIsThrottledWithoutThrottlingBars();
testDroneVisualsOnlyRenderOncePerFrame();
testTransientGraphicsEffectsUseBoundedPools();

console.log('combat/rogueShooterEntryPerformance tests passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../../assets/scripts/RogueShooterGame.ts'), 'utf8');

function methodBody(name: string, nextName: string): string {
    const methodPattern = (method: string) => new RegExp(`(?:^|\\n)\\s*(?:private\\s+)?${method}\\s*\\(`);
    const startMatch = source.match(methodPattern(name));
    assert.ok(startMatch, `${name} method should exist`);
    const start = startMatch!.index!;
    const endMatch = methodPattern(nextName).exec(source.slice(start + 1));
    assert.ok(endMatch, `${nextName} method should follow ${name}`);
    const end = start + 1 + endMatch!.index!;
    return source.slice(start, end);
}

function testStartShowsHomeBeforeAsyncArtLoading(): void {
    const body = methodBody('start', 'onDestroy');
    const openHomeIndex = body.indexOf('this.openHome();');
    const audioIndex = body.indexOf('this.audio.initAudio();');
    const loadArtIndex = body.indexOf('this.loadPlaceholderArt');
    assert.ok(openHomeIndex >= 0, 'start should open the home/menu immediately');
    assert.ok(audioIndex >= 0, 'start should still initialize audio after first paint');
    assert.ok(loadArtIndex >= 0, 'start should still load placeholder art asynchronously');
    assert.ok(openHomeIndex < audioIndex, 'menu should be visible before audio init can fail on preview/mobile runtimes');
    assert.ok(openHomeIndex < loadArtIndex, 'menu should be visible before async art loading can stall');
    assert.match(body, /try\s*\{[\s\S]*this\.audio\.initAudio\(\);[\s\S]*\}\s*catch/, 'audio init should be guarded so UI startup cannot abort');
}

function testCombatButtonsHiddenAfterHudConstruction(): void {
    const body = methodBody('buildHud', 'buildHangarPanel');
    assert.match(body, /setCombatHudControlsActive\(false\)/, 'buildHud should hide combat-only buttons by default');
}

function testMenuPhaseVisibilityInvariant(): void {
    const refreshBody = methodBody('refreshHud', 'ensureMenuVisible');
    assert.match(refreshBody, /this\.ensureMenuVisible\(\)/, 'refreshHud should enforce menu visibility invariant each frame');

    const body = methodBody('ensureMenuVisible', 'refreshDebugHud');
    assert.match(body, /this\.cs\.phase !== 'menu'/, 'ensureMenuVisible should only run in menu phase');
    assert.match(body, /hasBlockingOverlay/, 'ensureMenuVisible should not fight active modal panels');
    assert.match(body, /this\.panels\.menuPanel\.active = true/, 'ensureMenuVisible should recover hidden MenuPanel');
    assert.match(body, /setCombatHudControlsActive\(false\)/, 'ensureMenuVisible should keep combat buttons hidden on menu');
}

function testButtonViewDrawWrapperUsesGraphicsHelper(): void {
    assert.match(source, /drawButton as drawButtonGfx/, 'RogueShooterGame should alias the low-level Graphics drawButton helper');
    assert.match(
        source,
        /function drawButtonView\(button: ButtonView, disabled: boolean\): void[\s\S]*drawButtonGfx\(button\.gfx, button\.width, button\.height/,
        'RogueShooterGame should adapt ButtonView into the low-level Graphics drawButton helper',
    );
    assert.match(
        source,
        /private drawButton\(button: ButtonView, disabled: boolean\): void[\s\S]*drawButtonView\(button, disabled\)/,
        'RogueShooterGame should expose the drawButton HostContext wrapper expected by managers',
    );
}

testStartShowsHomeBeforeAsyncArtLoading();
testCombatButtonsHiddenAfterHudConstruction();
testMenuPhaseVisibilityInvariant();
testButtonViewDrawWrapperUsesGraphicsHelper();

console.log('startupVisibility tests passed.');

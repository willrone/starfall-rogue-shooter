import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../../assets/scripts/RogueShooterGame.ts'), 'utf8');

function methodBody(name: string, nextName: string): string {
    const marker = `private ${name}`;
    const nextMarker = `private ${nextName}`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${name} method should exist`);
    const end = source.indexOf(nextMarker, start + marker.length);
    assert.notEqual(end, -1, `${nextName} method should follow ${name}`);
    return source.slice(start, end);
}

function testRevivePanelStoresShadowAndButtonPanelSeparately(): void {
    const body = methodBody('buildRevivePanel', 'showRevivePanel');
    assert.match(body, /this\.panels\.revivePanelShadow\s*=\s*shadow;/, 'ReviveShadow must be stored as revivePanelShadow');
    assert.match(body, /this\.panels\.revivePanel\s*=\s*panel;/, 'RevivePanel must be stored as revivePanel');
    assert.doesNotMatch(body, /this\.panels\.revivePanel\s*=\s*shadow;/, 'revivePanel cannot point at the shadow-only node');
}

function testRevivePanelShowsBothNodes(): void {
    const body = methodBody('showRevivePanel', 'reviveFromAd');
    assert.match(body, /revivePanelShadow\)\s*this\.panels\.revivePanelShadow\.active\s*=\s*true;/, 'showRevivePanel must activate the shadow');
    assert.match(body, /revivePanel\)\s*this\.panels\.revivePanel\.active\s*=\s*true;/, 'showRevivePanel must activate the actual button panel');
}

function testReviveAdFailureRestoresBothNodes(): void {
    const body = methodBody('reviveFromAd', 'declineRevive');
    assert.match(body, /revivePanelShadow\)\s*this\.panels\.revivePanelShadow\.active\s*=\s*true;/, 'ad failure must restore the shadow');
    assert.match(body, /revivePanel\)\s*this\.panels\.revivePanel\.active\s*=\s*true;/, 'ad failure must restore the actual button panel');
}

function testDeclineHidesReviveOverlayBeforeSettlement(): void {
    const body = methodBody('declineRevive', 'preloadUiTextures');
    const hideIndex = body.indexOf('this.panels.hideAllOverlays()');
    const finishIndex = body.indexOf("this.finishBattle('death')");
    assert.ok(hideIndex >= 0, 'declineRevive must hide overlays');
    assert.ok(finishIndex >= 0, 'declineRevive must finish battle');
    assert.ok(hideIndex < finishIndex, 'declineRevive must hide the revive overlay before opening settlement');
}

testRevivePanelStoresShadowAndButtonPanelSeparately();
testRevivePanelShowsBothNodes();
testReviveAdFailureRestoresBothNodes();
testDeclineHidesReviveOverlayBeforeSettlement();

console.log('revivePanelWiring tests passed.');

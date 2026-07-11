import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../../assets/scripts/RogueShooterGame.ts'), 'utf8');

function methodBody(name: string, nextName: string): string {
    const pattern = new RegExp(`private\\s+(?:async\\s+)?${name}\\b`);
    const nextPattern = new RegExp(`private\\s+(?:async\\s+)?${nextName}\\b`);
    const startMatch = source.match(pattern);
    assert.ok(startMatch, `${name} method should exist`);
    const start = startMatch!.index!;
    const endMatch = nextPattern.exec(source.slice(start + 1));
    assert.ok(endMatch, `${nextName} method should follow ${name}`);
    const end = start + 1 + endMatch!.index!;
    return source.slice(start, end);
}

function testRevivePanelUsesPopupSystem(): void {
    const body = methodBody('showRevivePanel', 'reviveFromAd');
    assert.match(body, /uiMgr\.showDynamicPopupAsync/, 'showRevivePanel must use uiMgr.showDynamicPopupAsync');
    assert.match(body, /RevivePopup/, 'showRevivePanel must use RevivePopup');
    assert.match(body, /async/, 'showRevivePanel must be async');
    assert.match(body, /result === 'decline'/, 'showRevivePanel must handle decline result');
}

function testReviveFromAdReturnsPromise(): void {
    const body = methodBody('reviveFromAd', 'declineRevive');
    assert.match(body, /Promise<boolean>/, 'reviveFromAd should return Promise<boolean>');
    assert.match(body, /resolve\(false\)/, 'reviveFromAd resolves false on failure');
    assert.match(body, /resolve\(true\)/, 'reviveFromAd resolves true on success');
    assert.doesNotMatch(body, /revivePanelShadow/, 'reviveFromAd should not touch old revivePanelShadow');
    assert.doesNotMatch(body, /reviveWatchButton/, 'reviveFromAd should not touch old reviveWatchButton');
}

function testDeclineHidesReviveOverlayBeforeSettlement(): void {
    const body = methodBody('declineRevive', 'preloadUiTextures');
    assert.match(body, /hideAllOverlays/, 'declineRevive must hide overlays');
    assert.match(body, /finishBattle\('death'\)/, 'declineRevive must finish battle');
}

function testBuildRevivePanelRemoved(): void {
    assert.doesNotMatch(source, /buildRevivePanel/, 'buildRevivePanel method should be removed');
}

function testBuildLevelAndShopPanelsRemoved(): void {
    assert.ok(source.includes('level panel → ChoicePopup'), 'level panel should be documented as replaced');
    assert.ok(source.includes('shop panel  → ShopPopup'), 'shop panel should be documented as replaced');
}

testRevivePanelUsesPopupSystem();
testReviveFromAdReturnsPromise();
testDeclineHidesReviveOverlayBeforeSettlement();
testBuildRevivePanelRemoved();
testBuildLevelAndShopPanelsRemoved();

console.log('revivePanelWiring tests passed.');

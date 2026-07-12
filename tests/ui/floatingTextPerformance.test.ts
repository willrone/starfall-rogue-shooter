import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('assets/scripts/pickup/pickupManager.ts', 'utf8');

function sliceBetween(startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
    return source.slice(start, end);
}

function testFloatingTextPoolHasMobileBudget(): void {
    const limit = Number(source.match(/export const FLOATING_TEXT_LIMIT = (\d+);/)?.[1]);
    assert.ok(limit > 0 && limit <= 30, `floating text active limit must stay at or below 30, got ${limit}`);

    const spawnBody = sliceBetween('spawnFloatingText(', '// ── Resource scaling');
    assert.match(spawnBody, /this\.floatingTexts\.length >= FLOATING_TEXT_LIMIT/);
    assert.match(spawnBody, /this\.recycleFloatingText\(oldest, false\)/,
        'overflow must recycle the oldest active text instead of allocating another node');
}

function testFloatingTextFadeDoesNotAllocateColorsPerFrame(): void {
    const updateBody = sliceBetween('updateFloatingTexts(dt: number)', 'private recycleFloatingText');
    assert.doesNotMatch(updateBody, /\.label\.color\s*=/,
        'the frame loop must not allocate and assign a new Label Color for every active text');
    assert.doesNotMatch(updateBody, /this\.ctx\.hex\(/,
        'the frame loop must not construct colors while fading text');
    assert.match(updateBody, /FLOATING_TEXT_ALPHA_STEP/,
        'floating text alpha should be quantized to avoid dirtying render state every frame');
    assert.match(updateBody, /floatingText\.opacity\.opacity !== alpha/,
        'unchanged quantized alpha must skip the UIOpacity assignment');

    const acquireBody = sliceBetween('private acquireFloatingText()', 'spawnFloatingText(');
    assert.match(acquireBody, /node\.addComponent\(UIOpacity\)/,
        'pooled floating text nodes need a reusable UIOpacity component');

    const spawnBody = sliceBetween('spawnFloatingText(', '// ── Resource scaling');
    assert.match(spawnBody, /floatingText\.label\.color = this\.ctx\.hex\(color\)/,
        'semantic hit, critical and fatal colors must still be applied when text is spawned');
    assert.match(spawnBody, /floatingText\.opacity\.opacity = 255/,
        'reused text must start fully visible');
}

testFloatingTextPoolHasMobileBudget();
testFloatingTextFadeDoesNotAllocateColorsPerFrame();

console.log('ui/floatingTextPerformance tests passed.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('assets/scripts/projectile/projectileManager.ts', 'utf8');

function sliceBetween(startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    assert(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
    return source.slice(start, end);
}

function testLoadedSpriteDisablesGraphicsFallback(): void {
    const applyBody = sliceBetween(
        'private applyBulletSpriteFrame',
        'private getBulletSpriteSizeMultiplier',
    );

    assert.match(
        applyBody,
        /private applyBulletSpriteFrame\(bullet: Bullet\): boolean/,
        'the visual-mode switch must report whether the Sprite path is active',
    );
    assert.match(
        applyBody,
        /if \(sf\) \{[\s\S]*bullet\.sprite\.node\.active = true;[\s\S]*bullet\.gfx\.clear\(\);[\s\S]*bullet\.gfx\.enabled = false;[\s\S]*return true;/,
        'a loaded SpriteFrame must clear and disable the Graphics fallback',
    );
}

function testMissingSpriteKeepsGraphicsFallback(): void {
    const applyBody = sliceBetween(
        'private applyBulletSpriteFrame',
        'private getBulletSpriteSizeMultiplier',
    );
    const drawBody = sliceBetween('drawBullet(bullet: Bullet)', 'removeBullet(bullet: Bullet)');

    assert.match(
        applyBody,
        /bullet\.sprite\.node\.active = false;[\s\S]*bullet\.gfx\.enabled = true;[\s\S]*return false;/,
        'a missing SpriteFrame must hide the Sprite and re-enable Graphics',
    );
    assert.match(
        drawBody,
        /const usesSprite = this\.applyBulletSpriteFrame\(bullet\);/,
        'every draw must resolve the current visual mode',
    );
    assert.match(
        drawBody,
        /if \(usesSprite\) return;[\s\S]*gfx\.enabled = true;[\s\S]*gfx\.clear\(\);[\s\S]*switch \(bullet\.style\)/,
        'procedural weapon signatures must remain reachable only in fallback mode',
    );
}

function testAsyncLoadAndPoolReuseSwitchModes(): void {
    const initBody = sliceBetween('initEffectPools(worldNode: Node)', 'private acquireSpark');
    const createBody = sliceBetween('createBullet(', '\n    acquireBullet(): Bullet');
    const recycleBody = sliceBetween('recycleBullet(bullet: Bullet', 'private recycleRemovedBullets');

    assert.match(
        initBody,
        /this\.bulletSpriteFrames\[file\] = sf;[\s\S]*for \(const bullet of this\.bullets\)[\s\S]*this\.drawBullet\(bullet\);/,
        'live fallback bullets must switch as soon as their async SpriteFrame loads',
    );
    assert.match(
        createBody,
        /const bullet = this\.acquireBullet\(\);[\s\S]*this\.drawBullet\(bullet\);/,
        'new and pooled bullets must pass through the same visual-mode switch',
    );
    assert.match(
        recycleBody,
        /bullet\.gfx\.enabled = true;[\s\S]*bullet\.gfx\.clear\(\);[\s\S]*bullet\.sprite\.node\.active = false;[\s\S]*bullet\.node\.active = false;/,
        'recycling must reset both render paths before a bullet changes style',
    );
}

testLoadedSpriteDisablesGraphicsFallback();
testMissingSpriteKeepsGraphicsFallback();
testAsyncLoadAndPoolReuseSwitchModes();

console.log('projectileVisualFallback tests passed.');

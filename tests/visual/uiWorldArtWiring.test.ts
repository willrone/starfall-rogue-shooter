import { strict as assert } from 'assert';
import { readFileSync } from 'fs';

const game = readFileSync('assets/scripts/RogueShooterGame.ts', 'utf8');
const pipeline = readFileSync('tools/generate_ui_world_art.py', 'utf8');

function testBattlefieldKeepsTextureAndFallbackPaths(): void {
    assert.match(game, /resources\.load\('art\/world\/battlefield_tile\/spriteFrame'/);
    assert.match(game, /Battlefield texture unavailable; using procedural fallback/);
    assert.match(game, /floorGfx\.clear\(\)/, 'procedural floor should clear only after the texture loads');
    assert.doesNotMatch(game, /tile\.setScale\(column % 2/, 'periodic output should not need runtime checker mirroring');
}

function testPipelineProducesPeriodicOutputWithoutMetadataWrites(): void {
    assert.match(pipeline, /def make_mirrored_seamless_tile/);
    assert.match(pipeline, /Image\.Transpose\.FLIP_LEFT_RIGHT/);
    assert.match(pipeline, /Image\.Transpose\.FLIP_TOP_BOTTOM/);
    assert.doesNotMatch(pipeline, /\.meta["']|uuid/i, 'art generation must leave Cocos metadata to AssetDB');
}

testBattlefieldKeepsTextureAndFallbackPaths();
testPipelineProducesPeriodicOutputWithoutMetadataWrites();
console.log('uiWorldArtWiring tests passed.');

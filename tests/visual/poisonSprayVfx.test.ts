import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const projectileSource = readFileSync('assets/scripts/projectile/projectileManager.ts', 'utf8');
const gameSource = readFileSync('assets/scripts/RogueShooterGame.ts', 'utf8');

function testPoisonSprayHasDedicatedConeVfx() {
    assert(projectileSource.includes('spawnSprayCone('), 'ProjectileManager must expose a dedicated spray cone VFX method');
    assert(projectileSource.includes('PoisonSpray'), 'Poison spray VFX must keep pooled PoisonSpray debug nodes, not only muzzle flash');
    assert(projectileSource.includes('SPRAY_LIFE'), 'Poison spray VFX should have its own visible lifetime');
    assert(projectileSource.includes('粒子化毒雾喷射'), 'Poison spray code should document that the particleized spray is the main VFX');
    assert(projectileSource.includes('poison_mist_particle'), 'Poison spray should use a soft particle texture instead of a solid neon wedge');
    assert(projectileSource.includes('sprayMistNodes'), 'Poison spray should use pooled mist sprite particles');
    assert(projectileSource.includes('spawnSprayMistParticles'), 'Poison spray should emit particleized mist on every shot');
    assert(existsSync('assets/resources/effects/poison_mist_particle.png'), 'Soft poison mist particle texture must exist');
    assert(existsSync('assets/resources/effects/poison_mist_particle.png.meta'), 'Soft poison mist particle texture must have Cocos meta');
    assert(projectileSource.includes('sprayOverlayGfx'), 'Poison spray must render on a Canvas-level Graphics overlay');
    assert(projectileSource.includes('ensureSprayOverlayGfx'), 'Poison spray must lazily attach its overlay after world/batch render setup');
    assert(projectileSource.includes('renderSprayOverlay'), 'Poison spray overlay must redraw active cones while their timers are alive');
}

function testPoisonSprayDoesNotDependOnInvisibleChildPool() {
    const spawnStart = projectileSource.indexOf('spawnSprayCone(angle');
    assert(spawnStart >= 0, 'spawnSprayCone method must exist');
    const spawnBlock = projectileSource.slice(spawnStart, projectileSource.indexOf('spawnBulletHitSpark', spawnStart));
    assert(!spawnBlock.includes('if (idx < 0) return'),
        'Poison spray must not disappear when the legacy child-node pool is exhausted or invisible');
    assert(spawnBlock.includes('this.sprayCones.push(cone)'),
        'Poison spray must enqueue a world-overlay cone independent of child Graphics rendering');
    assert(spawnBlock.includes('this.renderSprayOverlay()'),
        'Poison spray must render immediately on the overlay when fired');
}

function testPoisonMechanicCallsConeVfx() {
    const poisonBranchStart = gameSource.indexOf("shootMechanic === 'poison'");
    assert(poisonBranchStart >= 0, 'RogueShooterGame must have a poison mechanic branch');
    const poisonBranch = gameSource.slice(poisonBranchStart, gameSource.indexOf('} else {', poisonBranchStart));
    assert(poisonBranch.includes('this.proj.spawnSprayCone(baseAngle, range, weaponColor)'),
        'Poison mechanic must spawn a visible cone every shot because it does not create bullets');
    assert(poisonBranch.includes('spawnBulletHitSpark'), 'Poison hits should emit visible hit feedback on affected enemies');
}

testPoisonSprayHasDedicatedConeVfx();
testPoisonSprayDoesNotDependOnInvisibleChildPool();
testPoisonMechanicCallsConeVfx();

console.log('poisonSprayVfx tests passed.');

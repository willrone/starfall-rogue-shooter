import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPON_FAMILIES, getWeaponAttackStyle } from '../../assets/scripts/catalogs/weaponCatalog';

const projectileSource = readFileSync('assets/scripts/projectile/projectileManager.ts', 'utf8');
const audioSource = readFileSync('assets/scripts/audio/audioManager.ts', 'utf8');
const gameSource = readFileSync('assets/scripts/RogueShooterGame.ts', 'utf8');
const audioGeneratorSource = readFileSync('tools/generate_audio_assets.py', 'utf8');
const audioDir = 'assets/resources/audio/sfx';

function parseShootSfxMap(): Record<string, string> {
    const map: Record<string, string> = {};
    const match = audioSource.match(/WEAPON_SHOOT_SFX:[\s\S]*?= \{([\s\S]*?)\n\};/);
    assert(match, 'AudioManager must expose WEAPON_SHOOT_SFX table');
    const body = match[1];
    const entryRe = /([a-zA-Z_][a-zA-Z0-9_]*): \{ clip: '([^']+)', volume: [0-9.]+, cooldown: [0-9.]+ \}/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRe.exec(body)) !== null) {
        map[entry[1]] = entry[2];
    }
    return map;
}

function parseBulletStyleMap(): Record<string, string> {
    const map: Record<string, string> = {};
    const match = projectileSource.match(/BULLET_STYLES:[\s\S]*?= \{([\s\S]*?)\n    \};/);
    assert(match, 'ProjectileManager must expose BULLET_STYLES table');
    const body = match[1];
    const entryRe = /([a-zA-Z_][a-zA-Z0-9_]*): '([^']+)'/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRe.exec(body)) !== null) {
        map[entry[1]] = entry[2];
    }
    return map;
}

function pngHasAlpha(path: string): boolean {
    const data = readFileSync(path);
    assert(data.subarray(1, 4).toString('ascii') === 'PNG', `${path} must be a PNG`);
    const colorType = data[25];
    return colorType === 4 || colorType === 6;
}

function testEachPrimaryWeaponHasDedicatedVfxStyle() {
    const styles = WEAPON_FAMILIES.map(family => getWeaponAttackStyle(family.id));
    assert.equal(new Set(styles).size, WEAPON_FAMILIES.length,
        'Every primary weapon family must have a unique WeaponAttackStyle');

    const drawBlock = projectileSource.slice(
        projectileSource.indexOf('drawBullet(bullet'),
        projectileSource.indexOf('removeBullet', projectileSource.indexOf('drawBullet(bullet')),
    );

    for (const family of WEAPON_FAMILIES) {
        const style = getWeaponAttackStyle(family.id);
        assert.notEqual(style, 'rifle', `${family.name} (${family.id}) must not fall back to rifle VFX`);
        assert(drawBlock.includes(`case '${style}':`),
            `${family.name} (${style}) needs a dedicated drawBullet case`);
    }

    // 瘟疫喷射器不走 createBullet；专属攻击效果必须是扇形毒雾，不是只靠 drawBullet。
    const poisonBranchStart = gameSource.indexOf("shootMechanic === 'poison'");
    assert(poisonBranchStart >= 0, 'Poison weapon branch must exist');
    const poisonBranch = gameSource.slice(poisonBranchStart, gameSource.indexOf('} else {', poisonBranchStart));
    assert(poisonBranch.includes('this.proj.spawnSprayCone(baseAngle, range, weaponColor)'),
        'Plague sprayer must spawn visible cone VFX because it does not create bullets');
    assert(projectileSource.includes('PoisonSpray'), 'Poison cone VFX must keep pooled PoisonSpray debug nodes');
    assert(projectileSource.includes('sprayOverlayGfx'), 'Poison cone VFX must render through Canvas-level Graphics overlay, not invisible child Graphics only');
    assert(projectileSource.includes('poison_mist_particle'), 'Poison cone VFX should use soft particle sprites instead of a solid neon wedge');
    assert(projectileSource.includes('spawnSprayMistParticles'), 'Poison cone VFX should emit pooled mist particles every shot');
}

function testBulletSpritesUseReplaceableTransparentResources() {
    assert(projectileSource.includes("new Node('BulletArt')"),
        'Bullet sprite child must be created directly so effects resources are not gated by art/placeholder preload');
    assert(!projectileSource.includes("addSpriteChild(node, 'BulletArt', 'bullet_plasma'"),
        'Bullet sprite must not depend on placeholder bullet_plasma; replacing effects PNGs should take effect');
    assert(projectileSource.includes("this.ctx.hex('#FFFFFF', 238)"),
        'Bullet sprite tint should preserve resource colors instead of recoloring every PNG to one accent');
    assert(projectileSource.includes('drawMuzzleSignature'), 'Weapon VFX should include per-style muzzle signatures');
    assert(projectileSource.includes('drawHitSparkSignature'), 'Weapon VFX should include per-style hit spark signatures');

    const bulletMap = parseBulletStyleMap();
    const assignedResources = new Map<string, string>();
    for (const family of WEAPON_FAMILIES) {
        const style = getWeaponAttackStyle(family.id);
        const resource = bulletMap[style];
        assert(resource, `${family.name} (${style}) must have a bullet sprite resource mapping`);
        assert(resource.startsWith('vfx_bullet_'), `${family.name} (${style}) must use the new transparent vfx_bullet_* primitive, got ${resource}`);
        assert(!assignedResources.has(resource),
            `${family.name} (${style}) shares VFX resource ${resource} with ${assignedResources.get(resource)}; primary weapons need dedicated attack resources`);
        assignedResources.set(resource, family.name);
        const png = `assets/resources/effects/${resource}.png`;
        const meta = `${png}.meta`;
        assert(existsSync(png), `${family.name} bullet VFX texture missing: ${png}`);
        assert(existsSync(meta), `${family.name} bullet VFX texture missing Cocos meta: ${meta}`);
        assert(pngHasAlpha(png), `${family.name} bullet VFX texture must be RGBA/alpha PNG: ${png}`);
        const metaJson = JSON.parse(readFileSync(meta, 'utf8'));
        assert.equal(metaJson.userData?.hasAlpha, true, `${family.name} bullet VFX meta must mark hasAlpha=true: ${meta}`);
    }

    assert.equal(assignedResources.size, WEAPON_FAMILIES.length,
        'Primary weapon bullet VFX resource count must match weapon family count');
}

function testEachPrimaryWeaponHasDedicatedShootSfxClip() {
    const map = parseShootSfxMap();
    const assignedClips = new Map<string, string>();

    for (const family of WEAPON_FAMILIES) {
        const style = getWeaponAttackStyle(family.id);
        const clip = map[style];
        assert(clip, `${family.name} (${style}) must have a WEAPON_SHOOT_SFX entry`);
        assert(!assignedClips.has(clip),
            `${family.name} (${style}) shares clip ${clip} with ${assignedClips.get(clip)}; primary weapons need dedicated shoot SFX`);
        assignedClips.set(clip, family.name);

        const mp3 = join(audioDir, `${clip}.mp3`);
        assert(existsSync(mp3), `${family.name} shoot clip missing: ${mp3}`);
        assert(existsSync(`${mp3}.meta`), `${family.name} shoot clip missing Cocos meta: ${mp3}.meta`);
    }

    assert.equal(assignedClips.size, WEAPON_FAMILIES.length,
        'Primary weapon shoot SFX clip count must match weapon family count');
}

function testPlagueSprayerUsesContinuousSpraySfx() {
    assert(audioSource.includes("spray: { clip: 'sfx_shoot_spray'"),
        'Plague sprayer must map to the dedicated spray SFX clip');
    assert(audioSource.includes('cooldown: 0.115'),
        'Plague sprayer SFX cooldown should be long enough to avoid clicky overlap');
    assert(audioGeneratorSource.includes('spray_hiss_sfx'),
        'sfx_shoot_spray should be generated by the continuous wet hiss helper, not the old short click noise');
    const sprayMp3 = join(audioDir, 'sfx_shoot_spray.mp3');
    assert(statSync(sprayMp3).size > 4200,
        'sfx_shoot_spray.mp3 should be the longer continuous hiss asset, not the old ~2.6KB short chirp');
}

testEachPrimaryWeaponHasDedicatedVfxStyle();
testBulletSpritesUseReplaceableTransparentResources();
testEachPrimaryWeaponHasDedicatedShootSfxClip();
testPlagueSprayerUsesContinuousSpraySfx();

console.log('weaponAttackPresentation tests passed.');

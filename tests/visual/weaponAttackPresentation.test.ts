import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPON_FAMILIES, getWeaponAttackStyle } from '../../assets/scripts/catalogs/weaponCatalog';

const projectileSource = readFileSync('assets/scripts/projectile/projectileManager.ts', 'utf8');
const audioSource = readFileSync('assets/scripts/audio/audioManager.ts', 'utf8');
const gameSource = readFileSync('assets/scripts/RogueShooterGame.ts', 'utf8');
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

testEachPrimaryWeaponHasDedicatedVfxStyle();
testEachPrimaryWeaponHasDedicatedShootSfxClip();

console.log('weaponAttackPresentation tests passed.');

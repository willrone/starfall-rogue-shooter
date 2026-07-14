import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GEAR_BLUEPRINTS, GEAR_CATALOG } from '../../assets/scripts/catalogs/equipmentCatalog';
import { OFFHAND_CATALOG } from '../../assets/scripts/catalogs/offhandCatalog';
import { RUN_ITEMS, RUN_ITEM_BLUEPRINTS } from '../../assets/scripts/catalogs/runItemCatalog';
import { WEAPON_FAMILIES } from '../../assets/scripts/catalogs/weaponCatalog';
import { gearIconKey, runItemIconKey } from '../../assets/scripts/core/artKeys';
import { RESOURCE_DEFS } from '../../assets/scripts/core/resources';

const root = process.cwd();
const iconDir = join(root, 'assets/resources/effects/ui_icons');

function assertRgba128AndUnique(label: string, paths: string[]): void {
    const hashes = new Set<string>();
    for (const path of paths) {
        const png = readFileSync(path);
        assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG`);
        assert.equal(png.readUInt32BE(16), 128, `${path} width must be 128`);
        assert.equal(png.readUInt32BE(20), 128, `${path} height must be 128`);
        assert.equal(png[25], 6, `${path} must use PNG RGBA color type 6`);
        hashes.add(createHash('sha256').update(png).digest('hex'));
    }
    assert.equal(hashes.size, paths.length, `${label} must not contain byte-identical icon designs`);
}

{
    assert.equal(WEAPON_FAMILIES.length, 17);
    for (const family of WEAPON_FAMILIES) {
        const key = family.id.replace(/-/g, '_');
        assert.ok(existsSync(join(iconDir, `wpn_${key}.png`)), `missing weapon UI icon: ${family.id}`);
        assert.ok(existsSync(join(root, `assets/resources/art/weapons/weapon_${key}_icon.png`)), `missing weapon field art: ${family.id}`);
    }

    assert.equal(OFFHAND_CATALOG.length, 15);
    for (const def of OFFHAND_CATALOG) {
        assert.ok(existsSync(join(iconDir, `${def.iconKey}.png`)), `missing offhand UI icon: ${def.id}`);
        assert.ok(existsSync(join(root, `assets/resources/art/offhand/${def.iconKey}.png`)), `missing offhand field art: ${def.id}`);
    }

    assert.equal(GEAR_BLUEPRINTS.length, 44);
    for (const blueprint of GEAR_BLUEPRINTS) {
        const instance = GEAR_CATALOG.find((item) => item.id === blueprint.id);
        assert.ok(instance, `missing common gear instance: ${blueprint.id}`);
        assert.ok(existsSync(join(iconDir, `${gearIconKey(instance!.id)}.png`)), `missing gear icon: ${blueprint.id}`);
    }

    assert.equal(RUN_ITEM_BLUEPRINTS.length, 65);
    for (const blueprint of RUN_ITEM_BLUEPRINTS) {
        const instance = RUN_ITEMS.find((item) => item.id === `${blueprint.id}-1`)!;
        assert.equal(runItemIconKey(instance.id), `run_${blueprint.id.replace(/-/g, '_')}`);
        assert.ok(existsSync(join(iconDir, `${runItemIconKey(instance.id)}.png`)), `missing run-item icon: ${blueprint.id}`);
    }
}

{
    const pickupDir = join(root, 'assets/resources/art/pickups');
    for (const resource of RESOURCE_DEFS) {
        const path = join(pickupDir, `pickup_${resource.id}.png`);
        assert.ok(existsSync(path), `missing pickup art: ${resource.id}`);
        assert.ok(existsSync(`${path}.meta`), `missing pickup Cocos meta: ${resource.id}`);
    }
    assert.ok(existsSync(join(pickupDir, 'pickup_chest_common.png')));
    assert.ok(existsSync(join(pickupDir, 'pickup_chest_rare.png')));
    assert.equal(existsSync(join(pickupDir, 'pickup_xp.png')), false);

    const manager = readFileSync(join(root, 'assets/scripts/pickup/pickupManager.ts'), 'utf8');
    assert.match(manager, /if \(type === 'xp'\) return '';/);
    const enemy = readFileSync(join(root, 'assets/scripts/enemy/enemyManager.ts'), 'utf8');
    assert.doesNotMatch(enemy, /dropPickup\(['"]xp['"]/);
    const placeholderGenerator = readFileSync(join(root, 'tools/generate_placeholder_art.py'), 'utf8');
    assert.doesNotMatch(placeholderGenerator, /pickup_xp/, 'placeholder generator must not recreate an XP pickup asset');

    const offhand = readFileSync(join(root, 'assets/scripts/offhand/offhandManager.ts'), 'utf8');
    assert.match(offhand, /`offhand_\$\{def\.id\.replace\(\/-\/g, '_'/, 'offhand field art must derive from the protected catalog id');
    assert.match(offhand, /if \(!sprite\) \{[\s\S]*fallback\.circle/, 'missing offhand sprites must retain a Graphics fallback');
}

{
    const script = readFileSync(join(root, 'tools/generate_item_art.py'), 'utf8');
    assert.doesNotMatch(script, /uuid4|\.meta["']|write_text\([^\n]*meta/);
    assert.match(script, /this script never creates metadata/i);
}

console.log('item art wiring tests passed.');

{
    assertRgba128AndUnique('weapon icons', WEAPON_FAMILIES.map((family) =>
        join(iconDir, `wpn_${family.id.replace(/-/g, '_')}.png`)));
    assertRgba128AndUnique('offhand icons', OFFHAND_CATALOG.map((def) =>
        join(iconDir, `${def.iconKey}.png`)));
    assertRgba128AndUnique('gear icons', GEAR_BLUEPRINTS.map((def) =>
        join(iconDir, `gear_${def.id.replace(/-/g, '_')}.png`)));
    assertRgba128AndUnique('run-item icons', RUN_ITEM_BLUEPRINTS.map((def) =>
        join(iconDir, `run_${def.id.replace(/-/g, '_')}.png`)));
    assertRgba128AndUnique('pickup art', [
        ...RESOURCE_DEFS.map((def) => join(root, `assets/resources/art/pickups/pickup_${def.id}.png`)),
        join(root, 'assets/resources/art/pickups/pickup_chest_common.png'),
        join(root, 'assets/resources/art/pickups/pickup_chest_rare.png'),
    ]);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceMainWeaponInLoadout } from '../../assets/scripts/shop/equipmentLoadout';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../../assets/scripts/shop/equipmentManager.ts'), 'utf8');

function methodSlice(startNeedle: string, endNeedle: string): string {
    const start = source.indexOf(startNeedle);
    assert.ok(start >= 0, `missing method marker: ${startNeedle}`);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(end > start, `missing method end marker: ${endNeedle}`);
    return source.slice(start, end);
}

function testNewMainWeaponAtomicallyReplacesCurrentWeapon(): void {
    const body = methodSlice('    toggleSelectedEquipment() {', '    upgradeSelectedEquipment() {');
    assert.match(body, /const equippedWeapons = this\.getEquippedWeapons\(\)/);
    assert.match(body, /this\.equippedEquipment = replaceMainWeaponInLoadout\(/);
    assert.match(body, /equippedWeapons\.map\(\(weapon\) => weapon\.id\)/);
    assert.match(body, /equipMessage = `\$\{equippedWeapons\[0\]\?\.name \|\| '当前武器'\} 已替换为 \$\{equipment\.name\}。`/);

    const replaceIndex = body.indexOf('this.equippedEquipment = replaceMainWeaponInLoadout');
    const capacityIndex = body.indexOf('this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT');
    assert.ok(replaceIndex >= 0 && replaceIndex < capacityIndex, 'weapon replacement must happen before the total-slot capacity guard');
    assert.doesNotMatch(body, /武器最多携带/, 'selecting another main weapon must not reject the replacement as a full weapon slot');
}

function testHangarActionCommunicatesReplacementAndLocksLastWeapon(): void {
    const body = methodSlice('    private refreshHangarActions() {', '    switchActiveWeapon() {');
    assert.match(body, /const lockedMainWeapon = selected\.kind === 'weapon'/);
    assert.match(body, /const replacingWeapon = selected\.kind === 'weapon'/);
    assert.match(body, /\? '出战中'/, 'the active main weapon should not offer an impossible unload action');
    assert.match(body, /replacingWeapon \|\| replacingGear[\s\S]*\? '替换'/, 'another owned main weapon should expose a replacement action');
    assert.match(body, /drawButton\(this\.ctx\.panels\.equipActionButton, lockedMainWeapon\)/, 'the last main weapon action must be disabled');
}

function testFullLoadoutReplacementPreservesEveryGearSlot(): void {
    const original = ['storm-rifle', 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil'];
    const replaced = replaceMainWeaponInLoadout(original, ['storm-rifle'], 'echo-bow-standard');
    assert.deepEqual(replaced, ['echo-bow-standard', 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil']);
    assert.equal(replaced.length, 5);
    assert.deepEqual(original, ['storm-rifle', 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil'], 'replacement must not mutate persisted input arrays');
}

function testReplacementCollapsesLegacyMultipleMainWeapons(): void {
    const replaced = replaceMainWeaponInLoadout(
        ['storm-rifle', 'tactical-visor', 'echo-bow-standard', 'phase-armor'],
        ['storm-rifle', 'echo-bow-standard'],
        'plague-sprayer-standard',
    );
    assert.deepEqual(replaced, ['plague-sprayer-standard', 'tactical-visor', 'phase-armor']);
}

testNewMainWeaponAtomicallyReplacesCurrentWeapon();
testHangarActionCommunicatesReplacementAndLocksLastWeapon();
testFullLoadoutReplacementPreservesEveryGearSlot();
testReplacementCollapsesLegacyMultipleMainWeapons();

console.log('main weapon replacement tests passed.');

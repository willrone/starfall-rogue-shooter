import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rogueSource = readFileSync(resolve(__dirname, '../../assets/scripts/RogueShooterGame.ts'), 'utf8');
const panelSource = readFileSync(resolve(__dirname, '../../assets/scripts/ui/panels.ts'), 'utf8');

function methodBody(name: string, nextName: string): string {
    const marker = `private ${name}`;
    const nextMarker = `private ${nextName}`;
    const start = rogueSource.indexOf(marker);
    assert.notEqual(start, -1, `${name} method should exist`);
    const end = rogueSource.indexOf(nextMarker, start + marker.length);
    assert.notEqual(end, -1, `${nextName} method should follow ${name}`);
    return rogueSource.slice(start, end);
}

function testOffhandRuntimeIsActuallyConnected(): void {
    assert.match(rogueSource, /import \{ OffhandManager, type OffhandHostContext \}/, 'RogueShooterGame must import OffhandManager');
    assert.match(rogueSource, /private offhandMgr\s*=\s*new OffhandManager\(this as unknown as OffhandHostContext\)/, 'RogueShooterGame must instantiate OffhandManager');
    assert.match(rogueSource, /this\.offhandMgr\.init\(this\.worldNode\)/, 'OffhandManager visual layer must initialize under worldNode');

    const beginBody = methodBody('beginBattle', 'randomPoint');
    assert.match(beginBody, /const equippedOffhandId\s*=\s*this\.shop\.getEquippedOffhandId\(\)/, 'beginBattle must read equipped offhand from shop');
    assert.match(beginBody, /this\.cs\.equippedOffhandId\s*=\s*equippedOffhandId/, 'beginBattle must copy equipped offhand id into combat state');
    assert.match(beginBody, /this\.cs\.offhandLevel\s*=\s*equippedOffhandId\s*\?\s*this\.shop\.getOffhandLevel\(equippedOffhandId\)\s*:\s*0/, 'beginBattle must copy offhand level into combat state');

        const updateStart = rogueSource.indexOf('update(dt: number)');
    assert.notEqual(updateStart, -1, 'update method should exist');
    const updateEnd = rogueSource.indexOf('private perfNow', updateStart);
    assert.notEqual(updateEnd, -1, 'perfNow method should follow update');
    const updateBody = rogueSource.slice(updateStart, updateEnd);
    assert.match(updateBody, /this\.offhandMgr\.tick\(combatDt\)/, 'combat update loop must tick equipped offhand');

    const damageBody = methodBody('takeDamage', 'getDefenseAgainst');
    assert.match(damageBody, /this\.offhandMgr\.onPlayerHit\(\)/, 'takeDamage must notify offhand shield after a real hit');
}

function testHangarContainsDedicatedOffhandAndForgeUi(): void {
    const sceneBody = methodBody('buildScene', 'loadPlaceholderArt');
    assert.match(sceneBody, /this\.buildOffhandPanel\(root\)/, 'scene construction must instantiate the offhand panel');
    assert.match(sceneBody, /this\.buildForgePanel\(root\)/, 'scene construction must instantiate the forge panel');

    const buildBody = methodBody('buildHangarPanel', 'buildJoystick');
    assert.match(buildBody, /LoadoutMainWeapon/, 'hangar should include a main weapon loadout card');
    assert.doesNotMatch(buildBody, /LoadoutMainWeaponA|LoadoutMainWeaponB/, 'hangar must present one main weapon, not a switchable A/B pair');
    assert.match(buildBody, /LoadoutOffhand/, 'hangar should include a dedicated offhand loadout card');
    assert.match(buildBody, /HangarTabOffhand/, 'hangar should expose an offhand tab button');
    assert.match(buildBody, /HangarTabForge/, 'hangar should expose a forge tab button');
    assert.match(buildBody, /EquipmentSlot_\$\{i\}/, 'hangar should still build reusable equipment grid buttons');

    assert.match(panelSource, /hangarTabButtons: ButtonView\[\]/, 'PanelManager must track hangar tab buttons');
    assert.match(panelSource, /offhandLoadoutButton: ButtonView \| null/, 'PanelManager must track the offhand loadout card');
    assert.match(rogueSource, /const MAX_EQUIPPED_WEAPONS = 1;/, 'combat UI must only expose one primary weapon');
}

function testOffhandPanelAndForgePanelHaveNonOverlappingCardGrids(): void {
    const offhandBody = methodBody('buildOffhandPanel', 'openOffhandPanel');
    assert.match(offhandBody, /const CARD_W = 184;/, 'offhand cards should use the 3-column card width');
    assert.match(offhandBody, /const CARD_H = 78;/, 'offhand cards should use readable 5-row card height');
    assert.match(offhandBody, /46 \+ col \* 198/, 'offhand x spacing must keep 3 columns inside 672px panel');
    assert.match(offhandBody, /124 \+ row \* 84/, 'offhand y spacing must keep 5 rows above action area');

    const forgeBody = methodBody('buildForgePanel', 'openForgePanel');
    assert.match(forgeBody, /ForgeRecipe_\$\{i\}/, 'forge should build separate recipe cards');
    assert.match(forgeBody, /138 \+ i \* 174/, 'forge cards should be vertically spaced without overlap');

    const renderOffhand = methodBody('renderOffhandPanel', 'synthesizeSelectedOffhand');
    assert.match(renderOffhand, /offhandListButtons/, 'offhand panel must render its card state');
    assert.match(rogueSource, /private synthesizeSelectedOffhand/, 'offhand panel must offer synthesis');
    assert.match(rogueSource, /private upgradeSelectedOffhand/, 'offhand panel must offer upgrades');
    assert.match(rogueSource, /private renderForgePanel\(\): void \{[\s\S]*getLegendaryRecipes/, 'forge panel must render recipe state');
}

testOffhandRuntimeIsActuallyConnected();
testHangarContainsDedicatedOffhandAndForgeUi();
testOffhandPanelAndForgePanelHaveNonOverlappingCardGrids();

console.log('offhand UI integration tests passed.');

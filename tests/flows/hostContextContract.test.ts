import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rogueShooterGame = readFileSync(join(root, 'assets/scripts/RogueShooterGame.ts'), 'utf8');
const pickupManager = readFileSync(join(root, 'assets/scripts/pickup/pickupManager.ts'), 'utf8');
const enemyManager = readFileSync(join(root, 'assets/scripts/enemy/enemyManager.ts'), 'utf8');

function assertHostWrapper(interfaceSource: string, interfaceName: string, member: string, wrapperPattern: string | RegExp): void {
    assert(
        interfaceSource.includes(member),
        `${interfaceName} should declare ${member}`,
    );
    const found = typeof wrapperPattern === 'string'
        ? rogueShooterGame.includes(wrapperPattern)
        : wrapperPattern.test(rogueShooterGame);
    assert(found, `RogueShooterGame should provide runtime wrapper for ${interfaceName}.${member}`);
}

function testPickupHostContextWrappers() {
    assertHostWrapper(pickupManager, 'PickupHostContext', 'ownedEquipment: Set<string>;', /private get ownedEquipment\(\): Set<string>/);
    assertHostWrapper(pickupManager, 'PickupHostContext', 'equipmentLevels: Record<string, number>;', /private get equipmentLevels\(\): Record<string, number>/);
    assertHostWrapper(pickupManager, 'PickupHostContext', 'getEquipmentLevel(id: string): number;', 'private getEquipmentLevel(id: string): number');
    assertHostWrapper(pickupManager, 'PickupHostContext', 'isEquipmentLootEligible?(equipment: EquipmentDef, rare: boolean): boolean;', 'private isEquipmentLootEligible(equipment: EquipmentDef, rare: boolean): boolean');
}

function testEnemyHostContextWrappers() {
    assertHostWrapper(enemyManager, 'EnemyHostContext', 'spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;', 'private spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number)');
    assertHostWrapper(enemyManager, 'EnemyHostContext', 'tryDropChest(type: ChestPickupType, x: number, y: number): boolean;', 'private tryDropChest(type: ChestPickupType, x: number, y: number): boolean');
    assertHostWrapper(enemyManager, 'EnemyHostContext', 'createEnemyProjectile(x: number, y: number, angle: number, damage: number, damageType: DamageType, speed: number): void;', 'private createEnemyProjectile(x: number, y: number, angle: number, damage: number, damageType: DamageType, speed: number)');
    assertHostWrapper(enemyManager, 'EnemyHostContext', 'getDroneZapOrigin(): { x: number; y: number };', /private getDroneZapOrigin\(\)/);
}

testPickupHostContextWrappers();
testEnemyHostContextWrappers();

console.log('hostContextContract tests passed.');

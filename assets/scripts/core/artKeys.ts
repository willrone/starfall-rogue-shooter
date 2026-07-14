import type { EquipmentDef } from './types';
import { getWeaponFamilyId } from '../catalogs/weaponCatalog';

export function weaponIconKey(equipment: EquipmentDef): string | null {
    const familyId = getWeaponFamilyId(equipment.id);
    return familyId ? `wpn_${familyId.replace(/-/g, '_')}` : null;
}

export function gearIconKey(equipmentId: string): string {
    const blueprintId = equipmentId.replace(/-(rare|epic|legendary|mythic)$/, '');
    return `gear_${blueprintId.replace(/-/g, '_')}`;
}

export function runItemIconKey(itemId: string): string {
    const blueprintId = itemId.replace(/-\d+$/, '');
    return `run_${blueprintId.replace(/-/g, '_')}`;
}

/** Atomically replace every equipped main weapon while preserving gear slots. */
export function replaceMainWeaponInLoadout(
    equippedIds: readonly string[],
    equippedMainWeaponIds: readonly string[],
    nextWeaponId: string,
): string[] {
    const currentMainWeapons = new Set(equippedMainWeaponIds);
    const preservedIds = equippedIds.filter((id) => id !== nextWeaponId && !currentMainWeapons.has(id));
    return [nextWeaponId, ...preservedIds];
}

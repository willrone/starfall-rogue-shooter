export type ResourceType = 'alloy' | 'cores' | 'shards' | 'biomass' | 'circuits' | 'crystals';

export interface ResourceDef {
    id: ResourceType;
    name: string;
    shortName: string;
    color: string;
}

export type ResourceWallet = Record<ResourceType, number>;

export type StatKey = keyof CharacterStats;

export interface CharacterStats {
    attackPower: number;
    attackSpeed: number;
    attackRange: number;
    critChance: number;
    critDamage: number;
    lethalChance: number;
    lethalDamage: number;
    lethalMaxHpPct: number;
    bulletSpeed: number;
    pierce: number;
    multiShot: number;
    dronePower: number;
    physicalDefense: number;
    magicDefense: number;
    fireDefense: number;
    lightningDefense: number;
    poisonDefense: number;
    iceDefense: number;
    maxHp: number;
    shieldMax: number;
    shieldRegen: number;
    hpRegen: number;
    damageReduction: number;
    dodgeChance: number;
    moveSpeed: number;
    pickupRange: number;
    luck: number;
    xpGain: number;
    resourceGain: number;
}

export interface StatEffect {
    stat: StatKey;
    amount: number;
}

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

export type WeaponAttackStyle = 'rifle' | 'shotgun' | 'rail' | 'laser' | 'chain' | 'pulse' | 'drone' | 'disc' | 'spray' | 'meteor' | 'ricochet' | 'scythe';
export type EquipmentKind = 'weapon' | 'gear';
export type GearSlot = 'hat' | 'armor' | 'boots' | 'accessory';
export type EquipmentRarity = '普通' | '稀有' | '史诗' | '传奇' | '神话';
export type WeaponRarity = EquipmentRarity;
export type PlayerDirection = 'south' | 'south_east' | 'east' | 'north_east' | 'north' | 'north_west' | 'west' | 'south_west';

export interface WeaponStats {
    damage: number;
    fireRate: number;
    pierce: number;
    multiShot: number;
    drone: number;
    bulletSpeed: number;
}

export interface EquipmentDef {
    id: string;
    name: string;
    kind: EquipmentKind;
    color: string;
    maxLevel: number;
    baseCost: number;
    desc: string;
    weaponStats?: WeaponStats;
    gearSlot?: GearSlot;
    gearStats?: StatEffect[];
    attackStyle?: WeaponAttackStyle;
    rarity?: EquipmentRarity;
}

export interface LevelUpgrade {
    id: string;
    name: string;
    desc: string;
    color: string;
    category: string;
    tier: number;
    effects: StatEffect[];
}

export interface LootChoice {
    title: string;
    desc: string;
    color: string;
    apply: () => void;
}

export interface EnemySpec {
    id: string;
    name: string;
    family: string;
    artId: string;
    variantId?: string;
    variantIndex?: number;
    hp: number;
    speed: number;
    damage: number;
    radius: number;
    xp: number;
    alloyChance: number;
    color: string;
    accent: string;
    spawnAfter: number;
    weight: number;
}

export interface GearBlueprint {
    id: string;
    name: string;
    slot: GearSlot;
    color: string;
    baseCost: number;
    desc: string;
    effects: StatEffect[];
}

export interface GearRarityDef {
    id: string;
    name: EquipmentRarity;
    prefix: string;
    scale: number;
    cost: number;
    maxLevel: number;
}

export type GamePhase = 'menu' | 'combat' | 'level-up' | 'item-choice' | 'shop' | 'loot' | 'hangar' | 'paused';
export type BattleEndReason = 'death' | 'extract';
export type ChestPickupType = 'chest-common' | 'chest-rare';
export type PickupType = 'xp' | ResourceType | ChestPickupType;
export type DamageType = 'physical' | 'magic' | 'fire' | 'lightning' | 'poison' | 'ice';
export type ItemChoiceQuality = 'common' | 'rare';

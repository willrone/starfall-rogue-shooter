export type ResourceType = 'alloy' | 'cores' | 'shards' | 'biomass' | 'circuits' | 'crystals' | 'voidFragment' | 'energyCore' | 'frostCore' | 'infernoCore' | 'webSilk';

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
    pierceDamagePct: number;
    weaponDamagePct: number;
    weaponFireRatePct: number;
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

export type WeaponAttackStyle =
    | 'rifle'          // fallback / legacy standard bullet
    | 'smg'            // 冲锋枪：高速曳光弹
    | 'spray'          // 瘟疫喷射器：毒雾扇面
    | 'frost'          // 霜束发射器：冰晶光束
    | 'echo'           // 回声弓：带回声残影的箭
    | 'scatter'        // 裂变枪管：三连霰弹
    | 'prism'          // 镜像棱镜：菱镜五向环射
    | 'quantum'        // 量子织机：量子分裂核
    | 'ion'            // 离子长枪：长枪光矛
    | 'thorn'          // 荆棘连弩：带倒刺弩矢
    | 'rail'           // 磁轨炮：超高速穿透光束
    | 'void_needle'    // 虚空针：细针暴击刺
    | 'meteor'         // 流星发射器：火球尾焰
    | 'drone'          // 轨道无人机：无人机电弧核心
    | 'gravity'        // 重力锤：暗物质冲击核
    | 'void_tear'      // 虚空撕裂者：虚空裂刃
    | 'icefire'        // 冰狱审判：冰火双色弹
    | 'web'            // 织网支配者：金色蛛网链束
    // Legacy style aliases kept so older saves/tests/default code still compile.
    | 'shotgun'
    | 'laser'
    | 'chain'
    | 'pulse'
    | 'disc'
    | 'ricochet'
    | 'scythe';
export type EquipmentKind = 'weapon' | 'gear';
export type GearSlot = 'hat' | 'armor' | 'boots' | 'accessory';
export type EquipmentRarity = '普通' | '稀有' | '史诗' | '传奇' | '神话';
export type WeaponRarity = EquipmentRarity;
export type PlayerDirection = 'south' | 'south_east' | 'east' | 'north_east' | 'north' | 'north_west' | 'west' | 'south_west';

export interface WeaponStats {
    damage: number;
    fireRate: number;
    pierce: number;
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

// ═══════════════════════════════════════════════════════════════════════
// 副武器系统（Offhand weapon / 协同自动武器）
// ═══════════════════════════════════════════════════════════════════════
// 15 把副武器，与主武器同时装备，战斗中不切换。
// 设计基线：docs/offhand_weapon_design.md

export type OffhandCategory = 'orbit' | 'summon' | 'control' | 'burst' | 'support';

export type OffhandMechanic =
    | 'orbit_blade'      // 1 回旋利刃
    | 'orbit_block'      // 2 守护星环
    | 'orbit_burn'       // 3 烈焰漩涡
    | 'summon_blade'     // 4 影刃猎手
    | 'summon_bee'       // 5 静电蜂群
    | 'summon_clone'     // 6 幽影分身
    | 'summon_bird'      // 7 治愈蜂鸟
    | 'control_mine'     // 8 冰霜地雷
    | 'control_field'    // 9 静电力场
    | 'control_seal'     // 10 黑曜石封印
    | 'burst_rift'       // 11 虚空裂隙
    | 'burst_eye'        // 12 暴风之眼
    | 'burst_time'       // 13 时间扭曲
    | 'support_nano'     // 14 纳米修复器
    | 'support_shield'   // 15 铜墙护盾
    ;

export interface OffhandStats {
    // ── 通用参数 ───────────────────────────────────────────────
    damage: number;         // 单次伤害
    damagePct: number;      // 直伤百分比（boss 用的 %maxHp）
    cooldown: number;       // 触发间隔（秒）
    duration: number;       // 持续时间（秒）
    radius: number;         // 作用半径
    count: number;          // 数量（飞刀数/蜜蜂数等）
    speed: number;          // 移动速度 / 转速
    pierce: number;         // 穿透 / 弹射
    slowFactor: number;     // 减速比例 (0-1)
    slowDuration: number;   // 减速持续（秒）
    shieldAmount: number;   // 免伤触发计数
    healPct: number;        // 治愈比例（maxHp %）
    triggerHpPct: number;   // 自动触发阈值（HP %）
    attackSpeedMultiplier: number; // 主武器攻速倍数
    burstDuration: number;  // 爆发持续秒数
}

export interface OffhandTierUpgrade {
    stats: Partial<OffhandStats>;
}

export interface OffhandDef {
    id: string;
    name: string;
    category: OffhandCategory;
    mechanic: OffhandMechanic;
    color: string;
    iconKey: string;
    baseStats: OffhandStats;
    levelUpgrades: OffhandTierUpgrade[];   // 长度=4（升 T2/T3/T4/T5 时的加成）
    desc: string;
    recipeMaterial: 'purifyCrystal' | 'voidShard' | 'timeLattice';
    recipeAlloy: number;
}

export type BossMaterialType = 'voidFragment' | 'energyCore' | 'frostCore' | 'infernoCore' | 'webSilk';

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
    bossMaterial?: BossMaterialType;
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

export type GamePhase = 'menu' | 'combat' | 'level-up' | 'item-choice' | 'discard' | 'shop' | 'loot' | 'hangar' | 'paused';
export type BattleEndReason = 'death' | 'extract';
export type ChestPickupType = 'chest-common' | 'chest-rare';
export type PickupType = 'xp' | ResourceType | ChestPickupType;
export type DamageType = 'physical' | 'magic' | 'fire' | 'lightning' | 'poison' | 'ice';
export type ItemChoiceQuality = 'common' | 'rare';

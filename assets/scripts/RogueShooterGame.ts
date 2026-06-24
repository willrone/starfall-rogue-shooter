import {
    _decorator,
    AudioClip,
    AudioSource,
    Camera,
    Canvas,
    Color,
    Component,
    EventKeyboard,
    EventTouch,
    Graphics,
    input,
    Input,
    KeyCode,
    Label,
    Layers,
    Node,
    Rect,
    resources,
    Size,
    Sprite,
    SpriteFrame,
    sys,
    UITransform,
    Vec2,
    Vec3,
    view,
} from 'cc';

const { ccclass } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const SAVE_KEY = 'starfall-rogue-shooter-progress-v1';
const VIEW_LEFT = -DESIGN_WIDTH / 2;
const VIEW_RIGHT = DESIGN_WIDTH / 2;
const VIEW_BOTTOM = -DESIGN_HEIGHT / 2;
const VIEW_TOP = DESIGN_HEIGHT / 2;
const WORLD_LEFT = -2400;
const WORLD_RIGHT = 2400;
const WORLD_BOTTOM = -3200;
const WORLD_TOP = 3200;
const CAMERA_FOCUS_X = 0;
const CAMERA_FOCUS_Y = -96;
const ART_DIR = 'art';
const AUDIO_DIR = 'audio';
const PLACEHOLDER_ART_DIR = 'art/placeholder';
const HANGAR_EQUIPMENT_SLOTS = 8;
const EQUIPPED_SLOT_COUNT = 6;
const MAX_EQUIPPED_WEAPONS = 2;
const MAX_EQUIPPED_GEAR = 4;
const FLOATING_TEXT_LIMIT = 90;
const WAVES_PER_CYCLE = 10;
const ORDINARY_WAVES_PER_CYCLE = WAVES_PER_CYCLE - 1;
const WAVE_MIN_DURATION = 50;
const WAVE_MAX_DURATION = 60;
const LEVEL_REFRESH_COST = 28;
const CHEST_REFRESH_COST = 34;
const SHOP_REFRESH_COST = 18;
const SHOP_ITEM_COUNT = 6;
const UI_SAFE_TOP = 56;
const UI_SAFE_BOTTOM = 32;
const MIN_TOUCH_BUTTON_HEIGHT = 48;
const ENEMY_PLAYER_PADDING = 3;
const ENEMY_SEPARATION_PADDING = 8;
const ENEMY_SEPARATION_CELL = 86;
const ENEMY_SEPARATION_BUCKET_SCAN = 6;
const ENEMY_SEPARATION_MAX_CHECKS = 18;
const BULLET_HIT_CELL = 160;
const ENEMY_PROJECTILE_LIMIT = 140;
const MAX_COMBAT_DT = 1 / 30;
const PICKUP_MERGE_RADIUS = 78;
const PICKUP_COMPACT_RADIUS = 240;
const PICKUP_SOFT_CAP = 190;
const PICKUP_HARD_CAP = 260;
const NORMAL_XP_DROP_CHANCE = 0.38;
const ELITE_XP_DROP_CHANCE = 0.82;
const NORMAL_ALLOY_DROP_MULTIPLIER = 0.55;
const NORMAL_MATERIAL_DROP_CHANCE = 0.045;
const ELITE_MATERIAL_DROP_CHANCE = 0.3;
const MAX_CHESTS_PER_WAVE = 2;
const ENEMY_HIT_FLASH_DURATION = 0.14;
const ENEMY_STATUS_KEY_ARMOR = 'armor';
const ENEMY_STATUS_KEY_DASH = 'dash';

type GamePhase = 'menu' | 'combat' | 'level-up' | 'item-choice' | 'shop' | 'loot' | 'hangar' | 'paused';
type BattleEndReason = 'death' | 'extract';
type ResourceType = 'alloy' | 'cores' | 'shards' | 'biomass' | 'circuits' | 'crystals';
type ChestPickupType = 'chest-common' | 'chest-rare';
type PickupType = 'xp' | ResourceType | ChestPickupType;
type EquipmentKind = 'weapon' | 'gear';
type DamageType = 'physical' | 'magic' | 'fire' | 'lightning' | 'poison' | 'ice';
type ItemChoiceQuality = 'common' | 'rare';
type WeaponAttackStyle = 'rifle' | 'shotgun' | 'rail' | 'laser' | 'chain' | 'pulse' | 'drone' | 'disc' | 'spray' | 'meteor' | 'ricochet' | 'scythe';
type EquipmentRarity = '普通' | '稀有' | '史诗' | '传奇' | '神话';
type WeaponRarity = EquipmentRarity;
type GearSlot = 'hat' | 'armor' | 'boots' | 'accessory';
type PlayerDirection = 'south' | 'south_east' | 'east' | 'north_east' | 'north' | 'north_west' | 'west' | 'south_west';

interface SpriteStripAnimation {
    frames: SpriteFrame[];
    fps: number;
    cellSize: number;
}

interface ResourceDef {
    id: ResourceType;
    name: string;
    shortName: string;
    color: string;
}

type ResourceWallet = Record<ResourceType, number>;

interface ButtonView {
    node: Node;
    gfx: Graphics;
    label: Label;
    width: number;
    height: number;
    color: string;
    disabledColor: string;
    disabled: boolean;
}

interface EnemySpec {
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

interface Enemy {
    id: number;
    spec: EnemySpec;
    node: Node;
    gfx: Graphics;
    sprite: Sprite | null;
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    radius: number;
    visualRadius: number;
    elite: boolean;
    boss: boolean;
    damageType: DamageType;
    skillTimer: number;
    dashTimer: number;
    dashVx: number;
    dashVy: number;
    armorTimer: number;
    animSeed: number;
    hitFlash: number;
    visualStateKey: string;
    animation: SpriteStripAnimation | null;
    animationFrameIndex: number;
}

interface EnemyProjectile {
    node: Node;
    gfx: Graphics;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    radius: number;
    life: number;
    damageType: DamageType;
    color: string;
}

interface Bullet {
    node: Node;
    gfx: Graphics;
    sprite: Sprite | null;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    radius: number;
    pierce: number;
    life: number;
    maxLife: number;
    color: string;
    accent: string;
    style: WeaponAttackStyle;
    hitIds: Set<number>;
}

interface Pickup {
    node: Node;
    gfx: Graphics;
    sprite: Sprite | null;
    type: PickupType;
    amount: number;
    x: number;
    y: number;
    radius: number;
    age: number;
}

interface FloatingText {
    node: Node;
    label: Label;
    x: number;
    y: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
}

interface DroneVisual {
    node: Node;
    gfx: Graphics;
    phase: number;
}

interface WeaponStats {
    damage: number;
    fireRate: number;
    pierce: number;
    multiShot: number;
    drone: number;
    bulletSpeed: number;
}

interface CharacterStats {
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

type StatKey = keyof CharacterStats;

interface StatEffect {
    stat: StatKey;
    amount: number;
}

interface EquipmentDef {
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

interface LevelUpgrade {
    id: string;
    name: string;
    desc: string;
    color: string;
    category: string;
    tier: number;
    effects: StatEffect[];
}

interface LootChoice {
    title: string;
    desc: string;
    color: string;
    apply: () => void;
}

const RESOURCE_DEFS: ResourceDef[] = [
    { id: 'alloy', name: '合金', shortName: '合金', color: '#F9C74F' },
    { id: 'cores', name: '核心', shortName: '核心', color: '#F94144' },
    { id: 'shards', name: '装备碎片', shortName: '碎片', color: '#C084FC' },
    { id: 'biomass', name: '生体样本', shortName: '样本', color: '#90BE6D' },
    { id: 'circuits', name: '电路板', shortName: '电路', color: '#4CC9F0' },
    { id: 'crystals', name: '虚空晶体', shortName: '晶体', color: '#B5179E' },
];

const RESOURCE_ZERO: ResourceWallet = {
    alloy: 0,
    cores: 0,
    shards: 0,
    biomass: 0,
    circuits: 0,
    crystals: 0,
};

const STAT_META: Record<StatKey, { name: string; kind: 'number' | 'percent' | 'multiplier' }> = {
    attackPower: { name: '攻击力', kind: 'number' },
    attackSpeed: { name: '攻击速度', kind: 'percent' },
    attackRange: { name: '攻击距离', kind: 'number' },
    critChance: { name: '暴击率', kind: 'percent' },
    critDamage: { name: '暴击伤害', kind: 'multiplier' },
    lethalChance: { name: '致命几率', kind: 'percent' },
    lethalDamage: { name: '致命伤害', kind: 'multiplier' },
    lethalMaxHpPct: { name: '致命生命斩杀', kind: 'percent' },
    bulletSpeed: { name: '弹速', kind: 'number' },
    pierce: { name: '穿透', kind: 'number' },
    multiShot: { name: '多重弹', kind: 'number' },
    dronePower: { name: '无人机强度', kind: 'number' },
    physicalDefense: { name: '物理防御', kind: 'number' },
    magicDefense: { name: '魔法防御', kind: 'number' },
    fireDefense: { name: '火防', kind: 'number' },
    lightningDefense: { name: '雷防', kind: 'number' },
    poisonDefense: { name: '毒防', kind: 'number' },
    iceDefense: { name: '冰防', kind: 'number' },
    maxHp: { name: '生命值', kind: 'number' },
    shieldMax: { name: '护盾值', kind: 'number' },
    shieldRegen: { name: '护盾回复', kind: 'number' },
    hpRegen: { name: '生命恢复', kind: 'number' },
    damageReduction: { name: '全减伤', kind: 'percent' },
    dodgeChance: { name: '闪避率', kind: 'percent' },
    moveSpeed: { name: '移动速度', kind: 'number' },
    pickupRange: { name: '拾取范围', kind: 'number' },
    luck: { name: '幸运值', kind: 'number' },
    xpGain: { name: '经验收益', kind: 'percent' },
    resourceGain: { name: '资源收益', kind: 'percent' },
};

const GEAR_SLOT_ORDER: GearSlot[] = ['hat', 'armor', 'boots', 'accessory'];
const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
    hat: '帽子',
    armor: '护甲',
    boots: '鞋子',
    accessory: '首饰',
};

function createEmptyCharacterStats(): CharacterStats {
    return {
        attackPower: 0,
        attackSpeed: 0,
        attackRange: 0,
        critChance: 0,
        critDamage: 0,
        lethalChance: 0,
        lethalDamage: 0,
        lethalMaxHpPct: 0,
        bulletSpeed: 0,
        pierce: 0,
        multiShot: 0,
        dronePower: 0,
        physicalDefense: 0,
        magicDefense: 0,
        fireDefense: 0,
        lightningDefense: 0,
        poisonDefense: 0,
        iceDefense: 0,
        maxHp: 0,
        shieldMax: 0,
        shieldRegen: 0,
        hpRegen: 0,
        damageReduction: 0,
        dodgeChance: 0,
        moveSpeed: 0,
        pickupRange: 0,
        luck: 0,
        xpGain: 0,
        resourceGain: 0,
    };
}

function createBaseCharacterStats(): CharacterStats {
    const stats = createEmptyCharacterStats();
    stats.attackPower = 16;
    stats.attackSpeed = 0;
    stats.attackRange = 760;
    stats.critChance = 0.05;
    stats.critDamage = 2;
    stats.lethalChance = 0.006;
    stats.lethalDamage = 2.75;
    stats.lethalMaxHpPct = 0.05;
    stats.bulletSpeed = 620;
    stats.physicalDefense = 4;
    stats.magicDefense = 2;
    stats.maxHp = 180;
    stats.shieldMax = 24;
    stats.shieldRegen = 1.8;
    stats.dodgeChance = 0.03;
    stats.moveSpeed = 238;
    stats.pickupRange = 82;
    return stats;
}

interface RunItemBlueprint {
    id: string;
    name: string;
    category: string;
    color: string;
    effects: StatEffect[];
}

const ITEM_TIER_NAMES = ['I', 'II', 'III', 'IV', 'V'];
const TRADEOFF_POSITIVE_BONUS = 1.24;

const RUN_ITEM_BLUEPRINTS: RunItemBlueprint[] = [
    { id: 'charged-magazine', name: '高能弹匣', category: '攻击', color: '#F94144', effects: [{ stat: 'attackPower', amount: 6 }, { stat: 'attackSpeed', amount: 0.05 }, { stat: 'moveSpeed', amount: -5 }] },
    { id: 'rapid-trigger', name: '急速扳机', category: '攻击', color: '#4CC9F0', effects: [{ stat: 'attackSpeed', amount: 0.14 }, { stat: 'attackPower', amount: -1.5 }] },
    { id: 'longscope', name: '远距瞄具', category: '攻击', color: '#38BDF8', effects: [{ stat: 'attackRange', amount: 70 }, { stat: 'critChance', amount: 0.02 }, { stat: 'dodgeChance', amount: -0.01 }] },
    { id: 'crit-lens', name: '暴击透镜', category: '攻击', color: '#F15BB5', effects: [{ stat: 'critChance', amount: 0.045 }, { stat: 'critDamage', amount: 0.15 }] },
    { id: 'execution-protocol', name: '处决协议', category: '攻击', color: '#B5179E', effects: [{ stat: 'lethalChance', amount: 0.012 }, { stat: 'lethalDamage', amount: 0.25 }, { stat: 'attackSpeed', amount: -0.02 }] },
    { id: 'fracture-warhead', name: '裂解弹头', category: '攻击', color: '#C084FC', effects: [{ stat: 'lethalMaxHpPct', amount: 0.01 }, { stat: 'attackPower', amount: 4 }, { stat: 'critChance', amount: -0.015 }] },
    { id: 'piercing-coil', name: '穿甲线圈', category: '攻击', color: '#F9C74F', effects: [{ stat: 'pierce', amount: 0.5 }, { stat: 'attackPower', amount: 1.5 }, { stat: 'attackSpeed', amount: -0.02 }] },
    { id: 'barrage-splitter', name: '弹幕分流器', category: '攻击', color: '#E879F9', effects: [{ stat: 'multiShot', amount: 0.75 }, { stat: 'attackSpeed', amount: 0.02 }, { stat: 'attackPower', amount: -2 }] },
    { id: 'superconductor-round', name: '超导弹体', category: '攻击', color: '#22D3EE', effects: [{ stat: 'bulletSpeed', amount: 40 }, { stat: 'attackRange', amount: 45 }] },
    { id: 'overload-reactor', name: '过载反应', category: '攻击', color: '#EF4444', effects: [{ stat: 'attackPower', amount: 8 }, { stat: 'maxHp', amount: -18 }, { stat: 'shieldMax', amount: -16 }] },
    { id: 'drone-uplink', name: '无人机上行链', category: '攻击', color: '#90BE6D', effects: [{ stat: 'dronePower', amount: 1.1 }, { stat: 'attackRange', amount: 24 }, { stat: 'magicDefense', amount: -2 }] },
    { id: 'sniper-heuristic', name: '狙击演算', category: '攻击', color: '#577590', effects: [{ stat: 'critDamage', amount: 0.28 }, { stat: 'attackRange', amount: 95 }, { stat: 'attackSpeed', amount: -0.04 }] },
    { id: 'composite-armor', name: '复合护甲', category: '防御', color: '#64748B', effects: [{ stat: 'physicalDefense', amount: 9 }, { stat: 'maxHp', amount: 18 }, { stat: 'moveSpeed', amount: -6 }] },
    { id: 'arcane-film', name: '秘法隔膜', category: '防御', color: '#8B5CF6', effects: [{ stat: 'magicDefense', amount: 10 }, { stat: 'shieldMax', amount: 20 }] },
    { id: 'flame-coating', name: '火焰涂层', category: '元素防御', color: '#F3722C', effects: [{ stat: 'fireDefense', amount: 14 }, { stat: 'magicDefense', amount: 2 }, { stat: 'attackPower', amount: 3 }, { stat: 'iceDefense', amount: -3 }] },
    { id: 'grounding-spike', name: '雷击接地桩', category: '元素防御', color: '#4CC9F0', effects: [{ stat: 'lightningDefense', amount: 14 }, { stat: 'magicDefense', amount: 2 }, { stat: 'attackSpeed', amount: 0.03 }, { stat: 'poisonDefense', amount: -2 }] },
    { id: 'antitoxin-serum', name: '解毒血清', category: '元素防御', color: '#84CC16', effects: [{ stat: 'poisonDefense', amount: 16 }, { stat: 'magicDefense', amount: 2 }, { stat: 'hpRegen', amount: 0.32 }] },
    { id: 'cryo-insulation', name: '冰霜绝缘层', category: '元素防御', color: '#A7F3D0', effects: [{ stat: 'iceDefense', amount: 14 }, { stat: 'magicDefense', amount: 2 }, { stat: 'moveSpeed', amount: 6 }, { stat: 'fireDefense', amount: -2 }] },
    { id: 'deflector-shield', name: '偏转护盾', category: '防御', color: '#14B8A6', effects: [{ stat: 'shieldMax', amount: 35 }, { stat: 'shieldRegen', amount: 1 }, { stat: 'maxHp', amount: -8 }] },
    { id: 'evasion-servo', name: '闪避伺服', category: '机动', color: '#43AA8B', effects: [{ stat: 'dodgeChance', amount: 0.035 }, { stat: 'moveSpeed', amount: 12 }, { stat: 'physicalDefense', amount: -4 }] },
    { id: 'regen-vat', name: '再生培养仓', category: '生存', color: '#90BE6D', effects: [{ stat: 'hpRegen', amount: 0.8 }, { stat: 'maxHp', amount: 10 }, { stat: 'attackSpeed', amount: -0.02 }] },
    { id: 'bulwark-protocol', name: '坚壁协议', category: '防御', color: '#475569', effects: [{ stat: 'damageReduction', amount: 0.025 }, { stat: 'physicalDefense', amount: 4 }, { stat: 'moveSpeed', amount: -8 }] },
    { id: 'lucky-dice', name: '幸运骰', category: '其他', color: '#F9C74F', effects: [{ stat: 'luck', amount: 10 }, { stat: 'critChance', amount: 0.01 }, { stat: 'maxHp', amount: -6 }] },
    { id: 'scavenger-field', name: '拾荒磁场', category: '资源', color: '#577590', effects: [{ stat: 'pickupRange', amount: 45 }, { stat: 'resourceGain', amount: 0.04 }, { stat: 'attackRange', amount: -20 }] },
    { id: 'xp-prism', name: '经验棱镜', category: '成长', color: '#38BDF8', effects: [{ stat: 'xpGain', amount: 0.07 }, { stat: 'luck', amount: 2 }, { stat: 'physicalDefense', amount: -2 }] },
    { id: 'greed-converter', name: '贪婪转换器', category: '资源', color: '#F8961E', effects: [{ stat: 'resourceGain', amount: 0.16 }, { stat: 'attackPower', amount: -1 }, { stat: 'damageReduction', amount: -0.005 }] },
    { id: 'phase-thruster', name: '相位推进器', category: '机动', color: '#2DD4BF', effects: [{ stat: 'moveSpeed', amount: 24 }, { stat: 'dodgeChance', amount: 0.012 }, { stat: 'pickupRange', amount: 12 }] },
    { id: 'stable-core', name: '稳态核心', category: '生存', color: '#CBD5E1', effects: [{ stat: 'maxHp', amount: 25 }, { stat: 'shieldMax', amount: 15 }, { stat: 'critChance', amount: -0.015 }] },
    { id: 'precision-chip', name: '精密芯片', category: '攻击', color: '#FB7185', effects: [{ stat: 'critChance', amount: 0.025 }, { stat: 'attackRange', amount: 40 }, { stat: 'shieldMax', amount: -8 }] },
    { id: 'frenzy-injector', name: '狂热注射', category: '混合', color: '#DC2626', effects: [{ stat: 'attackSpeed', amount: 0.16 }, { stat: 'hpRegen', amount: -0.3 }, { stat: 'physicalDefense', amount: -2 }] },
];

function scaleRunItemEffect(effect: StatEffect, tier: number, tradeoffItem = false): StatEffect {
    const positiveScale = 1 + (tier - 1) * 0.52;
    const negativeScale = 0.45 + (tier - 1) * 0.24;
    const scale = effect.amount < 0
        ? negativeScale
        : positiveScale * (tradeoffItem ? TRADEOFF_POSITIVE_BONUS : 1);
    const amount = effect.amount * scale;
    return {
        stat: effect.stat,
        amount: Math.abs(amount) >= 3 ? Math.round(amount) : Number(amount.toFixed(3)),
    };
}

function scaleRunItemEffects(effects: StatEffect[], tier: number): StatEffect[] {
    const tradeoffItem = effects.some((effect) => effect.amount < 0);
    return effects.map((effect) => scaleRunItemEffect(effect, tier, tradeoffItem));
}

function formatRunItemEffect(effect: StatEffect): string {
    const meta = STAT_META[effect.stat];
    const sign = effect.amount >= 0 ? '+' : '-';
    const value = Math.abs(effect.amount);
    if (meta.kind === 'percent') return `${meta.name} ${sign}${Math.round(value * 100)}%`;
    if (meta.kind === 'multiplier') return `${meta.name} ${sign}${value.toFixed(2)}x`;
    return `${meta.name} ${sign}${Number(value.toFixed(1))}`;
}

function buildRunItemCatalog(): LevelUpgrade[] {
    const items: LevelUpgrade[] = [];
    for (const blueprint of RUN_ITEM_BLUEPRINTS) {
        for (let tier = 1; tier <= ITEM_TIER_NAMES.length; tier++) {
            const effects = scaleRunItemEffects(blueprint.effects, tier);
            items.push({
                id: `${blueprint.id}-${tier}`,
                name: `${blueprint.name} ${ITEM_TIER_NAMES[tier - 1]}`,
                desc: effects.map(formatRunItemEffect).join(' / '),
                color: blueprint.color,
                category: blueprint.category,
                tier,
                effects,
            });
        }
    }
    return items;
}

const STAT_UPGRADE_BLUEPRINTS: RunItemBlueprint[] = [
    { id: 'fire-control', name: '火控训练', category: '攻击属性', color: '#F94144', effects: [{ stat: 'attackPower', amount: 16 }] },
    { id: 'neural-rapid', name: '神经加速', category: '攻击属性', color: '#4CC9F0', effects: [{ stat: 'attackSpeed', amount: 0.14 }] },
    { id: 'long-lock', name: '远距锁定', category: '攻击属性', color: '#38BDF8', effects: [{ stat: 'attackRange', amount: 110 }, { stat: 'bulletSpeed', amount: 38 }] },
    { id: 'crit-instinct', name: '暴击直觉', category: '攻击属性', color: '#F15BB5', effects: [{ stat: 'critChance', amount: 0.055 }] },
    { id: 'weakpoint-study', name: '弱点解析', category: '攻击属性', color: '#C084FC', effects: [{ stat: 'critDamage', amount: 0.28 }, { stat: 'critChance', amount: 0.012 }] },
    { id: 'lethal-judgement', name: '致命判断', category: '攻击属性', color: '#F59E0B', effects: [{ stat: 'lethalChance', amount: 0.014 }, { stat: 'lethalDamage', amount: 0.2 }] },
    { id: 'execution-sense', name: '斩杀本能', category: '攻击属性', color: '#B5179E', effects: [{ stat: 'lethalMaxHpPct', amount: 0.012 }, { stat: 'attackPower', amount: 5 }] },
    { id: 'pierce-drill', name: '穿透训练', category: '攻击属性', color: '#F9C74F', effects: [{ stat: 'pierce', amount: 1.2 }] },
    { id: 'multi-control', name: '多弹操控', category: '攻击属性', color: '#E879F9', effects: [{ stat: 'multiShot', amount: 0.75 }] },
    { id: 'drone-command', name: '无人机指挥', category: '攻击属性', color: '#90BE6D', effects: [{ stat: 'dronePower', amount: 1.4 }, { stat: 'attackRange', amount: 28 }] },
    { id: 'armor-body', name: '装甲体魄', category: '防御属性', color: '#64748B', effects: [{ stat: 'physicalDefense', amount: 12 }, { stat: 'maxHp', amount: 22 }] },
    { id: 'arcane-resolve', name: '秘法抗性', category: '防御属性', color: '#8B5CF6', effects: [{ stat: 'magicDefense', amount: 12 }, { stat: 'shieldMax', amount: 22 }] },
    { id: 'element-balance', name: '元素调和', category: '防御属性', color: '#14B8A6', effects: [{ stat: 'fireDefense', amount: 9 }, { stat: 'lightningDefense', amount: 9 }, { stat: 'poisonDefense', amount: 9 }, { stat: 'iceDefense', amount: 9 }] },
    { id: 'life-expansion', name: '生命扩容', category: '防御属性', color: '#43AA8B', effects: [{ stat: 'maxHp', amount: 42 }] },
    { id: 'shield-expansion', name: '护盾扩容', category: '防御属性', color: '#22D3EE', effects: [{ stat: 'shieldMax', amount: 46 }, { stat: 'shieldRegen', amount: 0.9 }] },
    { id: 'regen-loop', name: '自愈循环', category: '防御属性', color: '#90BE6D', effects: [{ stat: 'hpRegen', amount: 1.0 }, { stat: 'maxHp', amount: 10 }] },
    { id: 'damage-soften', name: '冲击缓释', category: '防御属性', color: '#475569', effects: [{ stat: 'damageReduction', amount: 0.028 }, { stat: 'physicalDefense', amount: 4 }] },
    { id: 'evasion-steps', name: '闪避步伐', category: '其他属性', color: '#2DD4BF', effects: [{ stat: 'dodgeChance', amount: 0.038 }, { stat: 'moveSpeed', amount: 12 }] },
    { id: 'mobility-drill', name: '移动训练', category: '其他属性', color: '#43AA8B', effects: [{ stat: 'moveSpeed', amount: 34 }] },
    { id: 'lucky-sense', name: '幸运感知', category: '其他属性', color: '#F9C74F', effects: [{ stat: 'luck', amount: 14 }, { stat: 'pickupRange', amount: 18 }] },
    { id: 'field-sweep', name: '战场拾取', category: '其他属性', color: '#577590', effects: [{ stat: 'pickupRange', amount: 58 }, { stat: 'xpGain', amount: 0.045 }] },
    { id: 'combat-learning', name: '战斗学习', category: '其他属性', color: '#38BDF8', effects: [{ stat: 'xpGain', amount: 0.09 }, { stat: 'luck', amount: 3 }] },
    { id: 'salvage-sense', name: '资源嗅觉', category: '其他属性', color: '#F8961E', effects: [{ stat: 'resourceGain', amount: 0.08 }, { stat: 'luck', amount: 5 }] },
];

function scaleStatUpgradeEffect(effect: StatEffect, tier: number): StatEffect {
    const scale = 1 + (tier - 1) * 0.66;
    const amount = effect.amount * scale;
    return {
        stat: effect.stat,
        amount: Math.abs(amount) >= 3 ? Math.round(amount) : Number(amount.toFixed(3)),
    };
}

function buildStatUpgradeCatalog(): LevelUpgrade[] {
    const upgrades: LevelUpgrade[] = [];
    for (const blueprint of STAT_UPGRADE_BLUEPRINTS) {
        for (let tier = 1; tier <= ITEM_TIER_NAMES.length; tier++) {
            const effects = blueprint.effects.map((effect) => scaleStatUpgradeEffect(effect, tier));
            upgrades.push({
                id: `stat-${blueprint.id}-${tier}`,
                name: `${blueprint.name} ${tier}段`,
                desc: effects.map(formatRunItemEffect).join(' / '),
                color: blueprint.color,
                category: blueprint.category,
                tier,
                effects,
            });
        }
    }
    return upgrades;
}

const BASE_ENEMY_ARCHETYPES: EnemySpec[] = [
    {
        id: 'mite',
        name: '碎壳虫',
        family: 'mite',
        artId: 'mite',
        hp: 18,
        speed: 126,
        damage: 4,
        radius: 13,
        xp: 2,
        alloyChance: 0.05,
        color: '#9BE564',
        accent: '#31572C',
        spawnAfter: 0,
        weight: 7,
    },
    {
        id: 'runner',
        name: '疾行体',
        family: 'runner',
        artId: 'runner',
        hp: 24,
        speed: 196,
        damage: 6,
        radius: 12,
        xp: 3,
        alloyChance: 0.08,
        color: '#4CC9F0',
        accent: '#1B4965',
        spawnAfter: 10,
        weight: 4,
    },
    {
        id: 'brute',
        name: '重甲块',
        family: 'brute',
        artId: 'brute',
        hp: 88,
        speed: 78,
        damage: 10,
        radius: 22,
        xp: 8,
        alloyChance: 0.22,
        color: '#F9C74F',
        accent: '#8A5A00',
        spawnAfter: 18,
        weight: 3,
    },
    {
        id: 'splitter',
        name: '裂变囊',
        family: 'splitter',
        artId: 'splitter',
        hp: 54,
        speed: 112,
        damage: 7,
        radius: 18,
        xp: 6,
        alloyChance: 0.16,
        color: '#F15BB5',
        accent: '#6A0572',
        spawnAfter: 28,
        weight: 3,
    },
    {
        id: 'warden',
        name: '磁暴卫士',
        family: 'warden',
        artId: 'warden',
        hp: 160,
        speed: 92,
        damage: 15,
        radius: 26,
        xp: 13,
        alloyChance: 0.35,
        color: '#F3722C',
        accent: '#6B240C',
        spawnAfter: 46,
        weight: 2,
    },
];

const ENEMY_VARIANTS = [
    { id: '', prefix: '', hp: 1, speed: 1, damage: 1, radius: 1, xp: 1, alloy: 1, spawn: 0, weight: 1 },
    { id: 'acid', prefix: '腐蚀', hp: 1.12, speed: 0.96, damage: 1.18, radius: 1, xp: 1.12, alloy: 1.2, spawn: 6, weight: 0.86 },
    { id: 'crystal', prefix: '晶化', hp: 1.38, speed: 0.88, damage: 1.08, radius: 1.05, xp: 1.24, alloy: 1.35, spawn: 10, weight: 0.78 },
    { id: 'swift', prefix: '迅捷', hp: 0.82, speed: 1.34, damage: 1.06, radius: 0.94, xp: 1.16, alloy: 1.05, spawn: 14, weight: 0.82 },
    { id: 'armored', prefix: '装甲', hp: 1.72, speed: 0.78, damage: 1.12, radius: 1.08, xp: 1.42, alloy: 1.55, spawn: 22, weight: 0.58 },
    { id: 'rage', prefix: '暴怒', hp: 1.18, speed: 1.16, damage: 1.42, radius: 1.02, xp: 1.32, alloy: 1.3, spawn: 30, weight: 0.52 },
    { id: 'shade', prefix: '幽影', hp: 0.94, speed: 1.22, damage: 1.22, radius: 0.9, xp: 1.28, alloy: 1.24, spawn: 38, weight: 0.48 },
    { id: 'arc', prefix: '电弧', hp: 1.24, speed: 1.08, damage: 1.32, radius: 1, xp: 1.44, alloy: 1.42, spawn: 48, weight: 0.42 },
    { id: 'regen', prefix: '再生', hp: 1.58, speed: 0.94, damage: 1.18, radius: 1.04, xp: 1.5, alloy: 1.48, spawn: 58, weight: 0.36 },
    { id: 'venom', prefix: '剧毒', hp: 1.3, speed: 1.06, damage: 1.58, radius: 1, xp: 1.62, alloy: 1.58, spawn: 68, weight: 0.3 },
    { id: 'prime', prefix: '原初', hp: 2.1, speed: 1.05, damage: 1.85, radius: 1.16, xp: 2.05, alloy: 2.1, spawn: 78, weight: 0.22 },
];

function buildEnemyCatalog(): EnemySpec[] {
    const enemies: EnemySpec[] = [];
    for (const base of BASE_ENEMY_ARCHETYPES) {
        for (let variantIndex = 0; variantIndex < ENEMY_VARIANTS.length; variantIndex++) {
            const variant = ENEMY_VARIANTS[variantIndex];
            const suffix = variant.id ? `-${variant.id}` : '';
            enemies.push({
                ...base,
                id: `${base.id}${suffix}`,
                name: `${variant.prefix}${base.name}`,
                variantId: variant.id || 'base',
                variantIndex,
                hp: Math.round(base.hp * variant.hp),
                speed: Math.round(base.speed * variant.speed),
                damage: Math.max(2, Math.round(base.damage * variant.damage)),
                radius: Math.max(9, Math.round(base.radius * variant.radius)),
                xp: Math.max(1, Math.round(base.xp * variant.xp)),
                alloyChance: Math.min(0.85, Number((base.alloyChance * variant.alloy).toFixed(3))),
                spawnAfter: base.spawnAfter + variant.spawn,
                weight: Number(Math.max(0.12, base.weight * variant.weight).toFixed(2)),
            });
        }
    }
    return enemies;
}

const ENEMY_SPECS: EnemySpec[] = buildEnemyCatalog();

const WEAPON_FAMILIES = [
    { id: 'storm-rifle', name: '风暴步枪', color: '#4CC9F0', damage: 4.2, fireRate: 1.05, pierce: 0, multiShot: 0, drone: 0, bulletSpeed: 1.1, cost: 38, desc: '稳定提升自动射击伤害和射速。' },
    { id: 'split-barrel', name: '裂变枪管', color: '#F15BB5', damage: 2.6, fireRate: 0.4, pierce: 0.7, multiShot: 1.2, drone: 0, bulletSpeed: 0.2, cost: 52, desc: '追加散射弹、分裂弹和穿透。' },
    { id: 'orbital-drone', name: '轨道无人机', color: '#90BE6D', damage: 1.7, fireRate: 0.18, pierce: 0, multiShot: 0, drone: 1.35, bulletSpeed: 0, cost: 58, desc: '自动电击附近怪物。' },
    { id: 'rail-cannon', name: '磁轨炮', color: '#577590', damage: 6.5, fireRate: -0.05, pierce: 1.1, multiShot: 0, drone: 0, bulletSpeed: 1.8, cost: 62, desc: '高伤害、高弹速、偏穿透。' },
    { id: 'nova-shotgun', name: '新星霰弹', color: '#F8961E', damage: 3.1, fireRate: 0.22, pierce: 0, multiShot: 1.55, drone: 0, bulletSpeed: -0.2, cost: 56, desc: '近距离多弹道爆发。' },
    { id: 'ion-lance', name: '离子长枪', color: '#43AA8B', damage: 5.1, fireRate: 0.28, pierce: 0.9, multiShot: 0.15, drone: 0, bulletSpeed: 1.4, cost: 60, desc: '稳定穿刺线性火力。' },
    { id: 'ember-smg', name: '余烬冲锋枪', color: '#F3722C', damage: 2.4, fireRate: 1.45, pierce: 0, multiShot: 0.25, drone: 0, bulletSpeed: 0.5, cost: 44, desc: '高速低伤弹幕。' },
    { id: 'frost-beamer', name: '霜束发射器', color: '#A7F3D0', damage: 3.7, fireRate: 0.72, pierce: 0.35, multiShot: 0.25, drone: 0.1, bulletSpeed: 0.8, cost: 50, desc: '均衡火力和控场弹速。' },
    { id: 'void-needle', name: '虚空针', color: '#B5179E', damage: 4.8, fireRate: 0.58, pierce: 1.35, multiShot: 0, drone: 0, bulletSpeed: 1.2, cost: 64, desc: '细小高穿透弹。' },
    { id: 'sun-disc', name: '日冕飞盘', color: '#F9C74F', damage: 3.8, fireRate: 0.32, pierce: 0.5, multiShot: 0.65, drone: 0.25, bulletSpeed: 0.35, cost: 54, desc: '旋转火力和少量无人支援。' },
    { id: 'echo-bow', name: '回声弓', color: '#38BDF8', damage: 4.4, fireRate: 0.66, pierce: 0.45, multiShot: 0.55, drone: 0, bulletSpeed: 1.0, cost: 48, desc: '中速多段弹道。' },
    { id: 'plague-sprayer', name: '瘟疫喷射器', color: '#84CC16', damage: 3.3, fireRate: 1.0, pierce: 0.2, multiShot: 0.75, drone: 0, bulletSpeed: 0.1, cost: 46, desc: '高频散射清群。' },
    { id: 'gravity-hammer', name: '重力锤', color: '#64748B', damage: 7.2, fireRate: -0.18, pierce: 0.55, multiShot: 0, drone: 0.1, bulletSpeed: -0.35, cost: 70, desc: '重型慢射高伤。' },
    { id: 'mirror-prism', name: '镜像棱镜', color: '#E879F9', damage: 2.9, fireRate: 0.62, pierce: 0.25, multiShot: 1.1, drone: 0.15, bulletSpeed: 0.55, cost: 56, desc: '镜像弹道数量成长。' },
    { id: 'meteor-launcher', name: '流星发射器', color: '#EF4444', damage: 6.1, fireRate: 0.08, pierce: 0.2, multiShot: 0.4, drone: 0, bulletSpeed: 0.2, cost: 66, desc: '重火力爆发武器。' },
    { id: 'pulse-fan', name: '脉冲扇', color: '#22D3EE', damage: 2.7, fireRate: 0.9, pierce: 0.15, multiShot: 0.95, drone: 0, bulletSpeed: 0.7, cost: 44, desc: '扇形覆盖和高速射击。' },
    { id: 'thorn-chain', name: '荆棘链', color: '#65A30D', damage: 3.9, fireRate: 0.42, pierce: 0.9, multiShot: 0.25, drone: 0.25, bulletSpeed: 0.45, cost: 52, desc: '穿透和链式辅助。' },
    { id: 'star-scythe', name: '星镰', color: '#C084FC', damage: 5.6, fireRate: 0.36, pierce: 0.75, multiShot: 0.45, drone: 0, bulletSpeed: 0.9, cost: 64, desc: '后期成长型穿刺武器。' },
    { id: 'quantum-loom', name: '量子织机', color: '#14B8A6', damage: 3.4, fireRate: 0.7, pierce: 0.45, multiShot: 0.7, drone: 0.35, bulletSpeed: 0.6, cost: 58, desc: '均衡弹幕与无人支援。' },
    { id: 'redline-carbine', name: '红线卡宾', color: '#FB7185', damage: 4.6, fireRate: 0.82, pierce: 0.35, multiShot: 0.25, drone: 0, bulletSpeed: 1.3, cost: 54, desc: '高速精准火力。' },
];

const WEAPON_VARIANTS = [
    { id: '', prefix: '', suffix: '', tier: 1, damage: 1, fireRate: 1, pierce: 1, multiShot: 1, drone: 1, speed: 1, cost: 1 },
    { id: 'light', prefix: '轻型', suffix: '', tier: 2, damage: 0.86, fireRate: 1.22, pierce: 0.8, multiShot: 1.06, drone: 0.9, speed: 1.16, cost: 1.08 },
    { id: 'pulse', prefix: '脉冲', suffix: '', tier: 3, damage: 1.04, fireRate: 1.12, pierce: 1, multiShot: 1.1, drone: 1, speed: 1.1, cost: 1.18 },
    { id: 'accurate', prefix: '精准', suffix: '', tier: 4, damage: 1.22, fireRate: 0.92, pierce: 1.12, multiShot: 0.9, drone: 0.9, speed: 1.24, cost: 1.28 },
    { id: 'heavy', prefix: '重载', suffix: '', tier: 5, damage: 1.48, fireRate: 0.72, pierce: 1.18, multiShot: 0.84, drone: 0.85, speed: 0.92, cost: 1.42 },
    { id: 'rapid', prefix: '连射', suffix: '', tier: 6, damage: 0.94, fireRate: 1.55, pierce: 0.88, multiShot: 1.16, drone: 0.95, speed: 1.08, cost: 1.55 },
    { id: 'piercing', prefix: '穿甲', suffix: '', tier: 7, damage: 1.18, fireRate: 0.96, pierce: 1.75, multiShot: 0.95, drone: 0.9, speed: 1.02, cost: 1.72 },
    { id: 'overclock', prefix: '超频', suffix: '', tier: 8, damage: 1.22, fireRate: 1.36, pierce: 1.1, multiShot: 1.12, drone: 1.18, speed: 1.18, cost: 1.9 },
    { id: 'resonance', prefix: '共振', suffix: '', tier: 9, damage: 1.36, fireRate: 1.08, pierce: 1.3, multiShot: 1.35, drone: 1.28, speed: 1.04, cost: 2.1 },
    { id: 'starfall', prefix: '星陨', suffix: '', tier: 10, damage: 1.68, fireRate: 1.18, pierce: 1.55, multiShot: 1.45, drone: 1.42, speed: 1.2, cost: 2.35 },
];

function getEquipmentRarityForTier(tier: number): EquipmentRarity {
    if (tier >= 10) return '神话';
    if (tier >= 8) return '传奇';
    if (tier >= 5) return '史诗';
    if (tier >= 3) return '稀有';
    return '普通';
}

function getRarityCostMultiplier(rarity: EquipmentRarity) {
    switch (rarity) {
        case '神话': return 1.85;
        case '传奇': return 1.55;
        case '史诗': return 1.28;
        case '稀有': return 1.12;
        default: return 1;
    }
}

function getWeaponAttackStyle(familyId: string): WeaponAttackStyle {
    switch (familyId) {
        case 'split-barrel':
        case 'nova-shotgun':
            return 'shotgun';
        case 'rail-cannon':
        case 'ion-lance':
        case 'void-needle':
            return 'rail';
        case 'orbital-drone':
            return 'drone';
        case 'frost-beamer':
            return 'laser';
        case 'sun-disc':
            return 'disc';
        case 'plague-sprayer':
            return 'spray';
        case 'meteor-launcher':
        case 'gravity-hammer':
            return 'meteor';
        case 'pulse-fan':
            return 'pulse';
        case 'thorn-chain':
            return 'chain';
        case 'star-scythe':
            return 'scythe';
        case 'echo-bow':
        case 'mirror-prism':
            return 'ricochet';
        default:
            return 'rifle';
    }
}

function getWeaponStyleName(style: WeaponAttackStyle) {
    switch (style) {
        case 'shotgun': return '近距宽弹道';
        case 'rail': return '高速穿透';
        case 'laser': return '光束锁定';
        case 'chain': return '链式跳跃';
        case 'pulse': return '扇形脉冲';
        case 'drone': return '无人机电击';
        case 'disc': return '旋转飞盘';
        case 'spray': return '喷射覆盖';
        case 'meteor': return '重型爆发';
        case 'ricochet': return '弹射折返';
        case 'scythe': return '成长镰刃';
        default: return '标准弹道';
    }
}

function buildWeaponCatalog(): EquipmentDef[] {
    const weapons: EquipmentDef[] = [];
    for (const family of WEAPON_FAMILIES) {
        for (const variant of WEAPON_VARIANTS) {
            const legacyIds = ['storm-rifle', 'split-barrel', 'orbital-drone'];
            const legacyId = variant.id === '' && legacyIds.indexOf(family.id) >= 0;
            const id = legacyId ? family.id : `${family.id}${variant.id ? `-${variant.id}` : '-standard'}`;
            const name = `${variant.prefix}${family.name}`;
            const attackStyle = getWeaponAttackStyle(family.id);
            const rarity = getEquipmentRarityForTier(variant.tier);
            weapons.push({
                id,
                name,
                kind: 'weapon',
                color: family.color,
                maxLevel: 6 + Math.ceil(variant.tier / 2),
                baseCost: Math.round(family.cost * variant.cost * getRarityCostMultiplier(rarity)),
                desc: `${family.desc} ${getWeaponStyleName(attackStyle)}，${rarity}品质 T${variant.tier} 型。`,
                attackStyle,
                rarity,
                weaponStats: {
                    damage: Number((family.damage * variant.damage).toFixed(2)),
                    fireRate: Number((family.fireRate * variant.fireRate).toFixed(2)),
                    pierce: Number((family.pierce * variant.pierce).toFixed(2)),
                    multiShot: Number((family.multiShot * variant.multiShot).toFixed(2)),
                    drone: Number((family.drone * variant.drone).toFixed(2)),
                    bulletSpeed: Number((family.bulletSpeed * variant.speed).toFixed(2)),
                },
            });
        }
    }
    return weapons;
}

interface GearBlueprint {
    id: string;
    name: string;
    slot: GearSlot;
    color: string;
    baseCost: number;
    desc: string;
    effects: StatEffect[];
}

interface GearRarityDef {
    id: string;
    name: EquipmentRarity;
    prefix: string;
    scale: number;
    cost: number;
    maxLevel: number;
}

const GEAR_RARITIES: GearRarityDef[] = [
    { id: 'common', name: '普通', prefix: '', scale: 1, cost: 1, maxLevel: 6 },
    { id: 'rare', name: '稀有', prefix: '精制', scale: 1.42, cost: 1.72, maxLevel: 8 },
    { id: 'epic', name: '史诗', prefix: '超导', scale: 2.02, cost: 2.85, maxLevel: 10 },
    { id: 'legendary', name: '传奇', prefix: '星铸', scale: 2.78, cost: 4.7, maxLevel: 12 },
    { id: 'mythic', name: '神话', prefix: '神话', scale: 3.66, cost: 7.4, maxLevel: 14 },
];

const GEAR_BLUEPRINTS: GearBlueprint[] = [
    { id: 'tactical-visor', name: '战术目镜', slot: 'hat', color: '#38BDF8', baseCost: 28, desc: '稳定强化索敌距离和弱点判断。', effects: [{ stat: 'attackRange', amount: 36 }, { stat: 'critChance', amount: 0.012 }] },
    { id: 'ember-crown', name: '燃焰头冠', slot: 'hat', color: '#F3722C', baseCost: 34, desc: '适合对抗火焰怪潮的进攻头冠。', effects: [{ stat: 'fireDefense', amount: 8 }, { stat: 'attackPower', amount: 3 }, { stat: 'iceDefense', amount: -1.5 }] },
    { id: 'storm-hood', name: '雷鸣兜帽', slot: 'hat', color: '#4CC9F0', baseCost: 36, desc: '把雷抗转成更快的武器节奏。', effects: [{ stat: 'lightningDefense', amount: 8 }, { stat: 'attackSpeed', amount: 0.025 }, { stat: 'physicalDefense', amount: -1.5 }] },
    { id: 'venom-mask', name: '防毒面罩', slot: 'hat', color: '#84CC16', baseCost: 32, desc: '降低毒系持续压制并提供少量续航。', effects: [{ stat: 'poisonDefense', amount: 10 }, { stat: 'hpRegen', amount: 0.12 }] },
    { id: 'cryo-helm', name: '寒霜头盔', slot: 'hat', color: '#A7F3D0', baseCost: 34, desc: '以冰抗和护盾稳定正面压力。', effects: [{ stat: 'iceDefense', amount: 9 }, { stat: 'shieldMax', amount: 8 }] },
    { id: 'command-crown', name: '指挥王冠', slot: 'hat', color: '#90BE6D', baseCost: 42, desc: '增强无人机协同和掉落运气。', effects: [{ stat: 'dronePower', amount: 0.55 }, { stat: 'luck', amount: 2 }] },
    { id: 'execution-visor', name: '处决目镜', slot: 'hat', color: '#F59E0B', baseCost: 44, desc: '提升致命判定，适合处理高血量 Boss。', effects: [{ stat: 'lethalChance', amount: 0.004 }, { stat: 'lethalDamage', amount: 0.08 }] },
    { id: 'scholar-band', name: '研习额带', slot: 'hat', color: '#38BDF8', baseCost: 38, desc: '牺牲少量生命换取更快角色成长。', effects: [{ stat: 'xpGain', amount: 0.035 }, { stat: 'pickupRange', amount: 12 }, { stat: 'maxHp', amount: -3 }] },
    { id: 'fortress-helm', name: '堡垒头盔', slot: 'hat', color: '#64748B', baseCost: 40, desc: '重型头盔，提升生存但拖慢移动。', effects: [{ stat: 'physicalDefense', amount: 5 }, { stat: 'maxHp', amount: 8 }, { stat: 'moveSpeed', amount: -3 }] },
    { id: 'prism-helm', name: '棱光头盔', slot: 'hat', color: '#C084FC', baseCost: 46, desc: '提高魔防和暴击倍率，但节奏略慢。', effects: [{ stat: 'magicDefense', amount: 6 }, { stat: 'critDamage', amount: 0.08 }, { stat: 'attackSpeed', amount: -0.01 }] },

    { id: 'phase-armor', name: '相位护甲', slot: 'armor', color: '#F8961E', baseCost: 46, desc: '均衡生命、物防、魔防和冷热抗性。', effects: [{ stat: 'maxHp', amount: 22 }, { stat: 'physicalDefense', amount: 2.2 }, { stat: 'magicDefense', amount: 1 }, { stat: 'fireDefense', amount: 0.8 }, { stat: 'iceDefense', amount: 0.8 }] },
    { id: 'bulwark-carapace', name: '壁垒甲壳', slot: 'armor', color: '#64748B', baseCost: 52, desc: '重型减伤护甲，牺牲机动换硬度。', effects: [{ stat: 'maxHp', amount: 34 }, { stat: 'damageReduction', amount: 0.008 }, { stat: 'moveSpeed', amount: -4 }] },
    { id: 'ember-mail', name: '灼焰胸甲', slot: 'armor', color: '#F3722C', baseCost: 48, desc: '针对火焰远程怪和爆炸怪。', effects: [{ stat: 'fireDefense', amount: 12 }, { stat: 'physicalDefense', amount: 4 }, { stat: 'iceDefense', amount: -2 }] },
    { id: 'storm-mail', name: '雷纹胸甲', slot: 'armor', color: '#4CC9F0', baseCost: 50, desc: '抵御雷电和电弧怪，并加快护盾恢复。', effects: [{ stat: 'lightningDefense', amount: 12 }, { stat: 'shieldRegen', amount: 0.25 }, { stat: 'poisonDefense', amount: -1.5 }] },
    { id: 'toxin-weave', name: '抗毒织甲', slot: 'armor', color: '#84CC16', baseCost: 44, desc: '对毒系持续伤害更稳，同时带回复。', effects: [{ stat: 'poisonDefense', amount: 13 }, { stat: 'hpRegen', amount: 0.18 }] },
    { id: 'frost-plate', name: '寒钢板甲', slot: 'armor', color: '#A7F3D0', baseCost: 50, desc: '强化冰抗和护盾容量。', effects: [{ stat: 'iceDefense', amount: 13 }, { stat: 'shieldMax', amount: 14 }, { stat: 'fireDefense', amount: -2 }] },
    { id: 'arcane-robe', name: '秘法战袍', slot: 'armor', color: '#8B5CF6', baseCost: 54, desc: '面对魔法和 Boss 技能时更稳定。', effects: [{ stat: 'magicDefense', amount: 10 }, { stat: 'shieldMax', amount: 18 }, { stat: 'physicalDefense', amount: -2 }] },
    { id: 'kinetic-vest', name: '动能背心', slot: 'armor', color: '#43AA8B', baseCost: 42, desc: '轻甲路线，兼顾闪避和速度。', effects: [{ stat: 'dodgeChance', amount: 0.008 }, { stat: 'moveSpeed', amount: 6 }, { stat: 'maxHp', amount: 6 }] },
    { id: 'titan-frame', name: '泰坦骨架', slot: 'armor', color: '#475569', baseCost: 60, desc: '极重护甲，大幅抗压但降低节奏。', effects: [{ stat: 'physicalDefense', amount: 9 }, { stat: 'maxHp', amount: 18 }, { stat: 'attackSpeed', amount: -0.015 }, { stat: 'moveSpeed', amount: -5 }] },
    { id: 'living-armor', name: '活体装甲', slot: 'armor', color: '#90BE6D', baseCost: 56, desc: '偏回复和毒抗的生存护甲。', effects: [{ stat: 'hpRegen', amount: 0.35 }, { stat: 'maxHp', amount: 14 }, { stat: 'poisonDefense', amount: 4 }] },

    { id: 'kinetic-boots', name: '动能靴', slot: 'boots', color: '#43AA8B', baseCost: 42, desc: '提高移动速度和闪避空间。', effects: [{ stat: 'moveSpeed', amount: 17 }, { stat: 'dodgeChance', amount: 0.008 }] },
    { id: 'phase-greaves', name: '相位胫甲', slot: 'boots', color: '#2DD4BF', baseCost: 48, desc: '高闪避位移装备，牺牲少量护盾。', effects: [{ stat: 'moveSpeed', amount: 12 }, { stat: 'dodgeChance', amount: 0.014 }, { stat: 'shieldMax', amount: -3 }] },
    { id: 'magnet-treads', name: '磁吸足具', slot: 'boots', color: '#577590', baseCost: 40, desc: '扩大拾取半径并增加资源效率。', effects: [{ stat: 'pickupRange', amount: 28 }, { stat: 'resourceGain', amount: 0.018 }, { stat: 'moveSpeed', amount: -2 }] },
    { id: 'storm-runners', name: '雷暴跑鞋', slot: 'boots', color: '#4CC9F0', baseCost: 46, desc: '雷抗和射击节奏兼顾。', effects: [{ stat: 'lightningDefense', amount: 8 }, { stat: 'attackSpeed', amount: 0.022 }] },
    { id: 'frost-skates', name: '霜滑靴', slot: 'boots', color: '#A7F3D0', baseCost: 44, desc: '冰抗型高速移动鞋。', effects: [{ stat: 'iceDefense', amount: 8 }, { stat: 'moveSpeed', amount: 15 }, { stat: 'fireDefense', amount: -1.5 }] },
    { id: 'ember-spurs', name: '焰刺靴', slot: 'boots', color: '#F3722C', baseCost: 44, desc: '提供火抗和少量进攻属性。', effects: [{ stat: 'fireDefense', amount: 8 }, { stat: 'attackPower', amount: 2.8 }, { stat: 'dodgeChance', amount: -0.002 }] },
    { id: 'toxic-waders', name: '防毒涉靴', slot: 'boots', color: '#84CC16', baseCost: 42, desc: '毒潮和持续伤害环境下更舒服。', effects: [{ stat: 'poisonDefense', amount: 10 }, { stat: 'hpRegen', amount: 0.08 }, { stat: 'moveSpeed', amount: 4 }] },
    { id: 'gravity-boots', name: '重力靴', slot: 'boots', color: '#64748B', baseCost: 46, desc: '用速度换取物防和减伤。', effects: [{ stat: 'physicalDefense', amount: 5 }, { stat: 'damageReduction', amount: 0.006 }, { stat: 'moveSpeed', amount: -3 }] },
    { id: 'scout-sandals', name: '侦察轻履', slot: 'boots', color: '#38BDF8', baseCost: 38, desc: '偏经验和幸运的轻装鞋。', effects: [{ stat: 'xpGain', amount: 0.025 }, { stat: 'luck', amount: 2.5 }, { stat: 'maxHp', amount: -3 }] },
    { id: 'blink-soles', name: '闪现鞋底', slot: 'boots', color: '#C084FC', baseCost: 52, desc: '高闪避鞋底，但防御略低。', effects: [{ stat: 'dodgeChance', amount: 0.02 }, { stat: 'moveSpeed', amount: 10 }, { stat: 'physicalDefense', amount: -2 }] },

    { id: 'magnet-coil', name: '磁吸线圈', slot: 'accessory', color: '#577590', baseCost: 34, desc: '扩大经验和资源拾取范围。', effects: [{ stat: 'pickupRange', amount: 22 }, { stat: 'luck', amount: 1.2 }] },
    { id: 'reactor-core', name: '反应堆芯', slot: 'accessory', color: '#F94144', baseCost: 68, desc: '提高弹速、伤害和后期上限。', effects: [{ stat: 'attackPower', amount: 3.4 }, { stat: 'bulletSpeed', amount: 22 }, { stat: 'maxHp', amount: 9 }, { stat: 'lightningDefense', amount: 1.2 }] },
    { id: 'vampire-chip', name: '汲能芯片', slot: 'accessory', color: '#B5179E', baseCost: 64, desc: '提供回复和毒抗，击杀时仍会少量回血。', effects: [{ stat: 'hpRegen', amount: 0.22 }, { stat: 'poisonDefense', amount: 1.1 }, { stat: 'maxHp', amount: 5 }] },
    { id: 'crit-lattice', name: '暴击晶格', slot: 'accessory', color: '#F15BB5', baseCost: 52, desc: '强化暴击率和暴击倍率。', effects: [{ stat: 'critChance', amount: 0.018 }, { stat: 'critDamage', amount: 0.08 }] },
    { id: 'execution-ring', name: '处决指环', slot: 'accessory', color: '#F59E0B', baseCost: 62, desc: '专门处理高血量 Boss 的致命首饰。', effects: [{ stat: 'lethalChance', amount: 0.005 }, { stat: 'lethalMaxHpPct', amount: 0.004 }, { stat: 'lethalDamage', amount: 0.08 }] },
    { id: 'shield-orb', name: '护盾宝珠', slot: 'accessory', color: '#22D3EE', baseCost: 50, desc: '增加护盾容量和回复。', effects: [{ stat: 'shieldMax', amount: 22 }, { stat: 'shieldRegen', amount: 0.45 }] },
    { id: 'salvage-charm', name: '拾荒护符', slot: 'accessory', color: '#F8961E', baseCost: 48, desc: '用少量攻击换取资源收益。', effects: [{ stat: 'resourceGain', amount: 0.035 }, { stat: 'luck', amount: 4 }, { stat: 'attackPower', amount: -1.5 }] },
    { id: 'learning-prism', name: '经验棱镜', slot: 'accessory', color: '#38BDF8', baseCost: 48, desc: '加快升级节奏，防御略低。', effects: [{ stat: 'xpGain', amount: 0.045 }, { stat: 'pickupRange', amount: 10 }, { stat: 'physicalDefense', amount: -1 }] },
    { id: 'drone-relay', name: '无人机中继', slot: 'accessory', color: '#90BE6D', baseCost: 54, desc: '强化无人机电击和索敌半径。', effects: [{ stat: 'dronePower', amount: 0.7 }, { stat: 'attackRange', amount: 18 }, { stat: 'magicDefense', amount: -1 }] },
    { id: 'element-signet', name: '元素徽记', slot: 'accessory', color: '#14B8A6', baseCost: 58, desc: '均衡四元素抗性和魔防。', effects: [{ stat: 'fireDefense', amount: 5 }, { stat: 'lightningDefense', amount: 5 }, { stat: 'poisonDefense', amount: 5 }, { stat: 'iceDefense', amount: 5 }, { stat: 'magicDefense', amount: 2 }] },
];

function scaleGearEffects(effects: StatEffect[], rarity: GearRarityDef): StatEffect[] {
    const rarityIndex = GEAR_RARITIES.indexOf(rarity);
    const hasTradeoff = effects.some((effect) => effect.amount < 0);
    return effects.map((effect) => {
        const scale = effect.amount < 0
            ? 0.5 + rarityIndex * 0.15
            : rarity.scale * (hasTradeoff ? 1.12 : 1);
        const amount = effect.amount * scale;
        return {
            stat: effect.stat,
            amount: Math.abs(amount) >= 3 ? Number(amount.toFixed(1)) : Number(amount.toFixed(3)),
        };
    });
}

function buildGearCatalog(): EquipmentDef[] {
    const gear: EquipmentDef[] = [];
    for (const blueprint of GEAR_BLUEPRINTS) {
        for (const rarity of GEAR_RARITIES) {
            const common = rarity.id === 'common';
            const id = common ? blueprint.id : `${blueprint.id}-${rarity.id}`;
            gear.push({
                id,
                name: `${rarity.prefix}${blueprint.name}`,
                kind: 'gear',
                gearSlot: blueprint.slot,
                rarity: rarity.name,
                color: blueprint.color,
                maxLevel: rarity.maxLevel,
                baseCost: Math.round(blueprint.baseCost * rarity.cost),
                desc: `${GEAR_SLOT_LABELS[blueprint.slot]}装备。${blueprint.desc}${rarity.name}品质。`,
                gearStats: scaleGearEffects(blueprint.effects, rarity),
            });
        }
    }
    return gear;
}

const WEAPON_CATALOG: EquipmentDef[] = buildWeaponCatalog();
const GEAR_CATALOG: EquipmentDef[] = buildGearCatalog();
const EQUIPMENT: EquipmentDef[] = [...WEAPON_CATALOG, ...GEAR_CATALOG];
const STARTER_EQUIPMENT_IDS = ['storm-rifle', 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil'];
const PLAYER_DIRECTIONS: PlayerDirection[] = ['south', 'south_east', 'east', 'north_east', 'north', 'north_west', 'west', 'south_west'];
const PLAYER_DIRECTION_ANGLE_OFFSET = Math.PI / 2;
const PLAYER_RUN_ANIMATION_META: Record<PlayerDirection, { frameName: string; frames: number; cellSize: number; fps: number }> = {
    south: { frameName: 'player_survivor_run_south', frames: 6, cellSize: 160, fps: 10 },
    south_east: { frameName: 'player_survivor_run_south_east', frames: 6, cellSize: 160, fps: 10 },
    east: { frameName: 'player_survivor_run_east', frames: 6, cellSize: 160, fps: 10 },
    north_east: { frameName: 'player_survivor_run_north_east', frames: 6, cellSize: 160, fps: 10 },
    north: { frameName: 'player_survivor_run_north', frames: 6, cellSize: 160, fps: 10 },
    north_west: { frameName: 'player_survivor_run_north_west', frames: 6, cellSize: 160, fps: 10 },
    west: { frameName: 'player_survivor_run_west', frames: 6, cellSize: 160, fps: 10 },
    south_west: { frameName: 'player_survivor_run_south_west', frames: 6, cellSize: 160, fps: 10 },
};
const PLAYER_IDLE_ANIMATION_META = { frameName: 'player_survivor_idle', frames: 6, cellSize: 160, fps: 8 };
const PLAYER_VISUAL_SIZE = 96;
const PLAYER_BODY_ANIMATION_DIRECTION: PlayerDirection = 'south';
const ENEMY_VISUAL_SIZE_MULTIPLIER: Record<string, number> = {
    mite: 6.4,
    runner: 6.3,
    brute: 5.2,
    splitter: 5.7,
    warden: 4.6,
    boss: 4.8,
};
const ENEMY_STRIP_META: Record<string, { frameName: string; frames: number; cellSize: number; fps: number }> = {
    mite: { frameName: 'enemy_mite_walk', frames: 6, cellSize: 128, fps: 8 },
    runner: { frameName: 'enemy_runner_walk', frames: 6, cellSize: 128, fps: 10 },
    brute: { frameName: 'enemy_brute_walk', frames: 4, cellSize: 160, fps: 6 },
    splitter: { frameName: 'enemy_splitter_idle', frames: 6, cellSize: 160, fps: 7 },
    warden: { frameName: 'enemy_warden_idle', frames: 6, cellSize: 192, fps: 8 },
    boss: { frameName: 'enemy_boss_idle', frames: 8, cellSize: 224, fps: 8 },
};
const BOSS_ENEMY_COUNT = 1;
const TOTAL_ENEMY_TYPES = ENEMY_SPECS.length + BOSS_ENEMY_COUNT;
const WEAPON_COUNT = WEAPON_CATALOG.length;
const GEAR_COUNT = GEAR_CATALOG.length;

const RUN_ITEMS: LevelUpgrade[] = buildRunItemCatalog();
const RUN_ITEM_COUNT = RUN_ITEMS.length;
const LEVEL_UPGRADES: LevelUpgrade[] = buildStatUpgradeCatalog();
const STAT_UPGRADE_COUNT = LEVEL_UPGRADES.length;

@ccclass('RogueShooterGame')
export class RogueShooterGame extends Component {
    private canvasNode: Node | null = null;
    private worldNode: Node | null = null;
    private playerNode: Node | null = null;
    private playerGfx: Graphics | null = null;
    private playerSprite: Sprite | null = null;
    private playerWeaponSprite: Sprite | null = null;
    private playerWeaponAimAngle = 0;
    private playerWeaponFrameName = '';
    private droneVisuals: DroneVisual[] = [];
    private droneHitPulse = 0;
    private joystickBase: Node | null = null;
    private joystickKnob: Node | null = null;
    private joystickBaseGfx: Graphics | null = null;
    private joystickKnobGfx: Graphics | null = null;

    private titleLabel: Label | null = null;
    private timerLabel: Label | null = null;
    private statLabel: Label | null = null;
    private equipmentLabel: Label | null = null;
    private debugLabel: Label | null = null;
    private toastLabel: Label | null = null;
    private hpBar: Graphics | null = null;
    private xpBar: Graphics | null = null;
    private menuPanel: Node | null = null;
    private menuPanelShadow: Node | null = null;
    private loadingPanel: Node | null = null;
    private loadingTitleLabel: Label | null = null;
    private loadingProgressLabel: Label | null = null;
    private pausePanel: Node | null = null;
    private pausePanelShadow: Node | null = null;
    private settingsPanel: Node | null = null;
    private settingsPanelShadow: Node | null = null;
    private settingsBodyLabel: Label | null = null;
    private bgmToggleButton: ButtonView | null = null;
    private sfxToggleButton: ButtonView | null = null;
    private infoPanel: Node | null = null;
    private infoPanelShadow: Node | null = null;
    private infoTitleLabel: Label | null = null;
    private infoBodyLabel: Label | null = null;
    private levelPanel: Node | null = null;
    private levelPanelShadow: Node | null = null;
    private levelTitleLabel: Label | null = null;
    private levelHintLabel: Label | null = null;
    private levelChoiceButtons: ButtonView[] = [];
    private levelBackButton: ButtonView | null = null;
    private levelRefreshButton: ButtonView | null = null;
    private shopPanel: Node | null = null;
    private shopPanelShadow: Node | null = null;
    private shopTitleLabel: Label | null = null;
    private shopTipLabel: Label | null = null;
    private shopButtons: ButtonView[] = [];
    private shopSlotRefreshButtons: ButtonView[] = [];
    private shopCloseButton: ButtonView | null = null;
    private hangarPanel: Node | null = null;
    private hangarPanelShadow: Node | null = null;
    private hangarTitleLabel: Label | null = null;
    private hangarStatsLabel: Label | null = null;
    private hangarTipLabel: Label | null = null;
    private lootButtons: ButtonView[] = [];
    private equipmentButtons: ButtonView[] = [];
    private equippedButtons: ButtonView[] = [];
    private switchWeaponButton: ButtonView | null = null;
    private shopButton: ButtonView | null = null;
    private extractButton: ButtonView | null = null;
    private pauseButton: ButtonView | null = null;
    private hangarBackButton: ButtonView | null = null;
    private prevEquipmentButton: ButtonView | null = null;
    private nextEquipmentButton: ButtonView | null = null;
    private equipActionButton: ButtonView | null = null;
    private upgradeActionButton: ButtonView | null = null;
    private visibleHangarEquipment: EquipmentDef[] = [];
    private equipmentDetailLabel: Label | null = null;
    private startButton: ButtonView | null = null;
    private artFrames = new Map<string, SpriteFrame>();
    private spriteStripCache = new Map<string, SpriteStripAnimation>();
    private sfxSource: AudioSource | null = null;
    private bgmSource: AudioSource | null = null;
    private sfxClips = new Map<string, AudioClip>();
    private bgmClips = new Map<string, AudioClip>();
    private sfxCooldowns: Record<string, number> = {};
    private audioReady = false;
    private audioUnlocked = false;
    private currentBgmName = '';
    private sfxVolume = 0.72;
    private bgmVolume = 0.34;
    private playerIdleAnimation: SpriteStripAnimation | null = null;
    private playerRunAnimations = new Map<PlayerDirection, SpriteStripAnimation>();
    private playerDirection: PlayerDirection = 'south';
    private playerMoving = false;
    private playerAnimationFrameIndex = -1;
    private playerAnimationKey = '';

    private phase: GamePhase = 'menu';
    private phaseBeforePause: GamePhase = 'menu';
    private battleIndex = 1;
    private battlesWon = 0;
    private alloy = 0;
    private cores = 0;
    private shards = 0;
    private biomass = 0;
    private circuits = 0;
    private crystals = 0;
    private equipmentLevels: Record<string, number> = {};
    private ownedEquipment: Set<string> = new Set();
    private equippedEquipment: string[] = [];
    private selectedEquipmentId = 'storm-rifle';
    private equipmentPage = 0;

    private playerX = 0;
    private playerY = -170;
    private cameraX = 0;
    private cameraY = 0;
    private playerHp = 180;
    private playerMaxHp = 180;
    private playerShield = 0;
    private playerShieldMax = 0;
    private shieldRechargeDelay = 0;
    private playerRadius = 18;
    private invulnerableTimer = 0;
    private shotTimer = 0;
    private droneTimer = 0;
    private regenTimer = 0;
    private shotCounter = 0;
    private activeWeaponIndex = 0;
    private weaponCooldowns: Record<string, number> = {};

    private combatTime = 0;
    private cycleTime = 0;
    private endlessCycle = 1;
    private waveIndex = 0;
    private waveElapsed = 0;
    private waveDuration = 55;
    private waveSpawnTimer = 0.2;
    private bossSpawned = false;
    private bossDefeatedThisWave = false;
    private bossKills = 0;
    private waveKillCount = 0;
    private waveChestDrops = 0;
    private currentWaveSpecs: EnemySpec[] = [];
    private nextEnemyId = 1;
    private enemies: Enemy[] = [];
    private bullets: Bullet[] = [];
    private bulletPool: Bullet[] = [];
    private enemyProjectiles: EnemyProjectile[] = [];
    private enemyProjectilePool: EnemyProjectile[] = [];
    private pickups: Pickup[] = [];
    private floatingTexts: FloatingText[] = [];
    private floatingTextPool: FloatingText[] = [];
    private debugHudEnabled = false;
    private killCount = 0;
    private battleAlloy = 0;
    private battleCores = 0;
    private battleShards = 0;
    private battleBiomass = 0;
    private battleCircuits = 0;
    private battleCrystals = 0;
    private level = 1;
    private xp = 0;
    private xpToNext = 65;
    private pendingLevelChoices: LevelUpgrade[] = [];
    private pendingItemChoices: LevelUpgrade[] = [];
    private currentItemChoiceQuality: ItemChoiceQuality = 'common';
    private pendingLootChoices: LootChoice[] = [];
    private runStats: CharacterStats = createEmptyCharacterStats();
    private acquiredRunItemIds: Set<string> = new Set();
    private acquiredStatUpgradeIds: Set<string> = new Set();
    private shopOffers: LevelUpgrade[] = [];

    private runDamageBonus = 0;
    private runFireRateBonus = 0;
    private runMoveSpeedBonus = 0;
    private runMaxHpBonus = 0;
    private runPickupBonus = 0;
    private runPierceBonus = 0;
    private runMultiShot = 0;
    private runRegen = 0;

    private pressedKeys = new Set<KeyCode>();
    private touchActive = false;
    private touchOrigin = new Vec2();
    private touchVector = new Vec2();
    private toastTimer = 0;

    start() {
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, 2);
        this.createCanvas();
        this.loadProgress();
        this.buildScene();
        this.initAudio();
        this.loadPlaceholderArt(() => this.openHome());
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    update(dt: number) {
        this.updateToast(dt);
        this.updateSfxCooldowns(dt);
        this.updateFloatingTexts(dt);
        if (this.phase === 'combat') {
            const combatDt = Math.min(dt, MAX_COMBAT_DT);
            this.combatTime += combatDt;
            this.invulnerableTimer = Math.max(0, this.invulnerableTimer - combatDt);
            this.updatePlayer(combatDt);
            this.updateDroneVisuals(combatDt);
            this.updateCamera(combatDt);
            this.updateSpawning(combatDt);
            this.updateWeapons(combatDt);
            this.updateBullets(combatDt);
            this.updateEnemyProjectiles(combatDt);
            this.updateEnemies(combatDt);
            this.resolvePlayerAfterEnemyMovement();
            this.updateDroneVisuals(0);
            this.updatePickups(combatDt);
            this.updateRegen(combatDt);
            this.updateShield(combatDt);
            if (this.playerHp <= 0) {
                this.finishBattle('death');
            }
        }
        this.refreshHud();
    }

    private createCanvas() {
        const cameraNode = new Node('UICamera');
        cameraNode.layer = Layers.Enum.UI_2D;
        this.node.addChild(cameraNode);
        cameraNode.setPosition(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 1000);
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = DESIGN_HEIGHT / 2;
        camera.visibility = Layers.Enum.UI_2D;

        const canvasNode = new Node('Canvas');
        canvasNode.layer = Layers.Enum.UI_2D;
        this.node.addChild(canvasNode);
        canvasNode.setPosition(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 0);
        const transform = canvasNode.addComponent(UITransform);
        transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        const canvas = canvasNode.addComponent(Canvas);
        canvas.cameraComponent = camera;
        canvas.alignCanvasWithScreen = true;
        this.canvasNode = canvasNode;
    }

    private buildScene() {
        const root = this.canvasNode!;
        this.drawArena(root);

        this.worldNode = new Node('World');
        this.worldNode.layer = Layers.Enum.UI_2D;
        root.addChild(this.worldNode);
        this.worldNode.setPosition(0, 0, 0);
        this.drawWorldArena(this.worldNode);

        this.buildHud(root);
        this.buildLevelPanel(root);
        this.buildShopPanel(root);
        this.buildHangarPanel(root);
        this.buildJoystick(root);
        this.buildMenuPanel(root);
        this.buildPausePanel(root);
        this.buildSettingsPanel(root);
        this.buildInfoPanel(root);
        this.buildLoadingPanel(root);
    }

    private loadPlaceholderArt(done: () => void) {
        this.setLoadingProgress('加载美术资源 0%');
        resources.loadDir(
            ART_DIR,
            SpriteFrame,
            (finished, total) => {
                const progress = total > 0 ? Math.round((finished / total) * 100) : 0;
                this.setLoadingProgress(`加载美术资源 ${progress}%`);
            },
            (error, frames) => {
                if (error) {
                    console.warn('Failed to load game art, falling back to Graphics', error);
                    this.setLoadingProgress('资源加载失败，使用基础图形继续');
                    done();
                    return;
                }

                for (const frame of frames) {
                    this.artFrames.set(frame.name, frame);
                }
                this.buildSpriteStripAnimations();
                this.setLoadingProgress('加载完成');
                done();
            },
        );
    }

    private initAudio() {
        this.sfxSource = this.node.addComponent(AudioSource);
        this.bgmSource = this.node.addComponent(AudioSource);
        this.bgmSource.loop = true;
        this.bgmSource.volume = this.bgmVolume;

        resources.loadDir(AUDIO_DIR, AudioClip, (error, clips) => {
            if (error) {
                console.warn('Failed to load audio assets; game will continue muted.', error);
                return;
            }

            for (const clip of clips) {
                if (clip.name.startsWith('bgm_')) {
                    this.bgmClips.set(clip.name, clip);
                } else if (clip.name.startsWith('sfx_')) {
                    this.sfxClips.set(clip.name, clip);
                }
            }
            this.audioReady = true;
            this.syncBgmForPhase();
        });
    }

    private unlockAudio() {
        if (this.audioUnlocked) return;
        this.audioUnlocked = true;
        this.syncBgmForPhase(true);
    }

    private updateSfxCooldowns(dt: number) {
        for (const name of Object.keys(this.sfxCooldowns)) {
            this.sfxCooldowns[name] -= dt;
            if (this.sfxCooldowns[name] <= 0) delete this.sfxCooldowns[name];
        }
    }

    private playSfx(name: string, volume = 1, cooldown = 0.035) {
        if (!this.audioReady || !this.audioUnlocked || !this.sfxSource) return;
        if (this.sfxCooldowns[name] && this.sfxCooldowns[name] > 0) return;
        const clip = this.sfxClips.get(name);
        if (!clip) return;
        this.sfxSource.playOneShot(clip, this.sfxVolume * volume);
        if (cooldown > 0) this.sfxCooldowns[name] = cooldown;
    }

    private playShootSfx(style: WeaponAttackStyle) {
        switch (style) {
            case 'shotgun':
                this.playSfx('sfx_shoot_shotgun', 0.78, 0.09);
                break;
            case 'rail':
                this.playSfx('sfx_shoot_rail', 0.78, 0.12);
                break;
            case 'laser':
            case 'pulse':
            case 'disc':
            case 'scythe':
                this.playSfx('sfx_shoot_laser', 0.68, 0.08);
                break;
            default:
                this.playSfx('sfx_shoot_rifle', 0.64, 0.055);
                break;
        }
    }

    private requestBgm(name: string) {
        this.currentBgmName = name;
        this.syncBgmForPhase();
    }

    private syncBgmForPhase(forceRestart = false) {
        if (!this.audioReady || !this.audioUnlocked || !this.bgmSource || !this.currentBgmName) return;
        const clip = this.bgmClips.get(this.currentBgmName);
        if (!clip) return;
        if (!forceRestart && this.bgmSource.clip === clip && this.bgmSource.playing) return;
        this.bgmSource.stop();
        this.bgmSource.clip = clip;
        this.bgmSource.loop = true;
        this.bgmSource.volume = this.bgmVolume;
        this.bgmSource.play();
    }

    private requestPhaseBgm() {
        if (this.phase === 'combat') {
            this.requestBgm(this.isBossWave() ? 'bgm_boss_loop' : 'bgm_combat_loop');
        } else {
            this.requestBgm('bgm_hangar');
        }
    }

    private buildSpriteStripAnimations() {
        this.spriteStripCache.clear();
        this.playerRunAnimations.clear();
        this.playerIdleAnimation = this.createSpriteStrip(
            PLAYER_IDLE_ANIMATION_META.frameName,
            PLAYER_IDLE_ANIMATION_META.frames,
            PLAYER_IDLE_ANIMATION_META.cellSize,
            PLAYER_IDLE_ANIMATION_META.fps,
        );

        for (const direction of PLAYER_DIRECTIONS) {
            const meta = PLAYER_RUN_ANIMATION_META[direction];
            const animation = this.createSpriteStrip(meta.frameName, meta.frames, meta.cellSize, meta.fps);
            if (animation) this.playerRunAnimations.set(direction, animation);
        }
    }

    private createSpriteStrip(frameName: string, frameCount: number, cellSize: number, fps: number): SpriteStripAnimation | null {
        const sourceFrame = this.artFrames.get(frameName);
        const texture = sourceFrame?.texture;
        if (!sourceFrame || !texture || frameCount <= 0) return null;

        const frames: SpriteFrame[] = [];
        for (let index = 0; index < frameCount; index++) {
            const subFrame = new SpriteFrame();
            subFrame.reset({
                texture,
                rect: new Rect(index * cellSize, 0, cellSize, cellSize),
                originalSize: new Size(cellSize, cellSize),
            });
            frames.push(subFrame);
        }

        const animation = { frames, fps, cellSize };
        this.spriteStripCache.set(frameName, animation);
        return animation;
    }

    private addSpriteChild(parent: Node, name: string, frameName: string, width: number, height: number): Sprite | null {
        const frame = this.artFrames.get(frameName);
        if (!frame) return null;

        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(0, 0, 0);
        node.addComponent(UITransform).setContentSize(width, height);

        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = frame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        return sprite;
    }

    private enemyArtName(spec: EnemySpec, boss: boolean) {
        return boss ? 'enemy_boss' : `enemy_${spec.artId}`;
    }

    private getEnemyAnimationFrameName(spec: EnemySpec, boss: boolean) {
        const meta = ENEMY_STRIP_META[boss ? 'boss' : spec.family];
        return meta?.frameName || this.enemyArtName(spec, boss);
    }

    private getEnemyAnimation(spec: EnemySpec, boss: boolean): SpriteStripAnimation | null {
        const meta = ENEMY_STRIP_META[boss ? 'boss' : spec.family];
        if (!meta) return null;
        return this.spriteStripCache.get(meta.frameName) || this.createSpriteStrip(meta.frameName, meta.frames, meta.cellSize, meta.fps);
    }

    private pickupArtName(type: PickupType) {
        if (this.isChestPickup(type)) return '';
        if (type === 'cores') return 'pickup_core';
        return `pickup_${type}`;
    }

    private isChestPickup(type: PickupType): type is ChestPickupType {
        return type === 'chest-common' || type === 'chest-rare';
    }

    private drawArena(root: Node) {
        this.rect(root, 'ArenaBase', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, '#0B1020');
        this.rect(root, 'DeepSpaceBandTop', 0, 0, DESIGN_WIDTH, 180, '#111827');
        this.rect(root, 'DeepSpaceBandBottom', 0, 1120, DESIGN_WIDTH, 160, '#111827');
    }

    private drawWorldArena(world: Node) {
        const floor = new Node('WorldFloor');
        floor.layer = Layers.Enum.UI_2D;
        world.addChild(floor);
        floor.setPosition(0, 0, -20);
        floor.addComponent(UITransform).setContentSize(WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM);
        const floorGfx = floor.addComponent(Graphics);
        floorGfx.fillColor = this.hex('#121827');
        floorGfx.roundRect(WORLD_LEFT, WORLD_BOTTOM, WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM, 52);
        floorGfx.fill();
        floorGfx.strokeColor = this.hex('#334155', 210);
        floorGfx.lineWidth = 8;
        floorGfx.roundRect(WORLD_LEFT, WORLD_BOTTOM, WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM, 52);
        floorGfx.stroke();

        const grid = new Node('ArenaGrid');
        grid.layer = Layers.Enum.UI_2D;
        world.addChild(grid);
        grid.setPosition(0, 0, -18);
        const gfx = grid.addComponent(Graphics);
        gfx.lineWidth = 2;
        gfx.strokeColor = this.hex('#243247', 170);
        for (let x = WORLD_LEFT; x <= WORLD_RIGHT; x += 160) {
            gfx.moveTo(x, WORLD_BOTTOM);
            gfx.lineTo(x, WORLD_TOP);
        }
        for (let y = WORLD_BOTTOM; y <= WORLD_TOP; y += 160) {
            gfx.moveTo(WORLD_LEFT, y);
            gfx.lineTo(WORLD_RIGHT, y);
        }
        gfx.stroke();

        gfx.lineWidth = 4;
        gfx.strokeColor = this.hex('#334155', 180);
        for (let x = WORLD_LEFT; x <= WORLD_RIGHT; x += 640) {
            gfx.moveTo(x, WORLD_BOTTOM);
            gfx.lineTo(x, WORLD_TOP);
        }
        for (let y = WORLD_BOTTOM; y <= WORLD_TOP; y += 640) {
            gfx.moveTo(WORLD_LEFT, y);
            gfx.lineTo(WORLD_RIGHT, y);
        }
        gfx.stroke();

        gfx.lineWidth = 4;
        gfx.strokeColor = this.hex('#4CC9F0', 95);
        gfx.roundRect(WORLD_LEFT + 42, WORLD_BOTTOM + 42, WORLD_RIGHT - WORLD_LEFT - 84, WORLD_TOP - WORLD_BOTTOM - 84, 42);
        gfx.stroke();

        gfx.fillColor = this.hex('#334155', 90);
        for (let i = 0; i < 76; i++) {
            const x = WORLD_LEFT + 240 + (i % 8) * 570 + ((i * 97) % 140);
            const y = WORLD_BOTTOM + 260 + Math.floor(i / 8) * 590 + ((i * 53) % 180);
            gfx.roundRect(x - 34, y - 8, 68, 16, 8);
            gfx.fill();
        }

        gfx.strokeColor = this.hex('#4CC9F0', 120);
        gfx.lineWidth = 3;
        for (let x = WORLD_LEFT + 640; x < WORLD_RIGHT; x += 640) {
            for (let y = WORLD_BOTTOM + 640; y < WORLD_TOP; y += 640) {
                gfx.moveTo(x - 34, y);
                gfx.lineTo(x + 34, y);
                gfx.moveTo(x, y - 34);
                gfx.lineTo(x, y + 34);
            }
        }
        gfx.stroke();
    }

    private buildHud(root: Node) {
        const top = UI_SAFE_TOP;
        this.rect(root, 'HudShadow', 28, top + 8, 664, 188, '#020617', 18);
        this.rect(root, 'HudPanel', 20, top, 664, 188, '#F8FAFC', 18, '#CBD5E1');
        this.rect(root, 'HudAccent', 42, top + 18, 8, 42, '#F94144', 4);
        this.titleLabel = this.label(root, 'Title', '星坠幸存者', 58, top + 10, 290, 48, 30, '#0F172A', Label.HorizontalAlign.LEFT);
        this.timerLabel = this.label(root, 'Timer', '', 440, top + 12, 210, 40, 28, '#0F172A', Label.HorizontalAlign.RIGHT);
        this.statLabel = this.label(root, 'Stats', '', 58, top + 62, 596, 28, 15, '#475569', Label.HorizontalAlign.LEFT);
        this.equipmentLabel = this.label(root, 'Equipment', '', 58, top + 92, 210, 28, 16, '#64748B', Label.HorizontalAlign.LEFT);
        this.switchWeaponButton = this.button(root, 'SwitchWeaponButton', 284, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#B5179E', '#94A3B8', () => this.switchActiveWeapon());
        this.switchWeaponButton.label.string = '切武器';
        this.shopButton = this.button(root, 'OpenShopButton', 378, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#4CC9F0', '#94A3B8', () => this.openShop());
        this.shopButton.label.string = '商店';
        this.extractButton = this.button(root, 'ExtractButton', 472, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#F8961E', '#94A3B8', () => this.extractBattle());
        this.extractButton.label.string = '撤离';
        this.pauseButton = this.button(root, 'PauseButton', 566, top + 82, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.pauseCombat());
        this.pauseButton.label.string = '暂停';

        const hpNode = this.rect(root, 'HpBar', 52, top + 144, 292, 18, '#1E293B', 9);
        this.hpBar = hpNode.getComponent(Graphics);
        const xpNode = this.rect(root, 'XpBar', 376, top + 144, 292, 18, '#1E293B', 9);
        this.xpBar = xpNode.getComponent(Graphics);
        this.label(root, 'HpLabel', 'HP', 18, top + 139, 34, 28, 15, '#CBD5E1');
        this.label(root, 'XpLabel', 'EXP', 344, top + 139, 38, 28, 15, '#CBD5E1');
        this.debugLabel = this.label(root, 'DebugHud', '', 54, top + 168, 612, 44, 13, '#94A3B8', Label.HorizontalAlign.LEFT);
        this.debugLabel.node.active = false;

        const toastTop = DESIGN_HEIGHT - UI_SAFE_BOTTOM - 76;
        this.rect(root, 'ToastPanelShadow', 46, toastTop + 10, 628, 54, '#020617', 14);
        this.rect(root, 'ToastPanel', 36, toastTop, 648, 58, '#F8FAFC', 14, '#CBD5E1');
        this.toastLabel = this.label(root, 'Toast', '', 54, toastTop + 6, 612, 46, 19, '#0F172A');
    }

    private buildLevelPanel(root: Node) {
        this.levelPanelShadow = this.rect(root, 'LevelPanelShadow', 48, 316, 624, 500, '#020617', 22);
        this.levelPanelShadow.active = false;
        const panel = this.rect(root, 'LevelPanel', 36, 302, 648, 500, '#F8FAFC', 22, '#CBD5E1');
        panel.active = false;
        this.levelPanel = panel;
        this.levelTitleLabel = this.label(panel, 'LevelTitle', '角色升级', 42, 30, 564, 52, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.levelBackButton = this.button(panel, 'LevelBack', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.choosePanelChoice(0), true);
        this.levelBackButton.label.string = '返回';
        this.levelHintLabel = this.label(panel, 'LevelHint', '选择一项自身属性成长，战斗会继续。', 42, 86, 564, 42, 20, '#475569', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LevelChoice_${i}`, 54, 148 + i * 84, 540, 68, '#4CC9F0', '#94A3B8', () => this.choosePanelChoice(i), true);
            this.levelChoiceButtons.push(button);
        }
        this.levelRefreshButton = this.button(panel, 'ChoiceRefresh', 204, 414, 240, 48, '#F8961E', '#94A3B8', () => this.refreshCurrentChoices(), true);
        this.levelRefreshButton.label.string = `刷新 -${LEVEL_REFRESH_COST}合金`;
    }

    private buildShopPanel(root: Node) {
        this.shopPanelShadow = this.rect(root, 'ShopPanelShadow', 36, 172, 648, 940, '#020617', 24);
        this.shopPanelShadow.active = false;
        const panel = this.rect(root, 'ShopPanel', 24, 160, 672, 940, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.shopPanel = panel;
        this.shopTitleLabel = this.label(panel, 'ShopTitle', '战场商店', 36, 24, 600, 48, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.shopTipLabel = this.label(panel, 'ShopTip', '随时打开。每格可购买或消耗少量合金刷新下一件。', 42, 72, 588, 42, 18, '#475569', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < SHOP_ITEM_COUNT; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const button = this.button(
                panel,
                `ShopOffer_${i}`,
                52 + col * 304,
                132 + row * 188,
                264,
                118,
                '#4CC9F0',
                '#94A3B8',
                () => this.buyShopItem(i),
                true,
            );
            button.label.fontSize = 15;
            button.label.lineHeight = 18;
            this.shopButtons.push(button);

            const refreshButton = this.button(
                panel,
                `ShopSlotRefresh_${i}`,
                52 + col * 304,
                256 + row * 188,
                264,
                40,
                '#F8961E',
                '#94A3B8',
                () => this.refreshShopSlot(i),
                true,
            );
            refreshButton.label.fontSize = 16;
            refreshButton.label.lineHeight = 18;
            this.shopSlotRefreshButtons.push(refreshButton);
        }

        this.shopCloseButton = this.button(panel, 'ShopClose', 204, 824, 264, 52, '#43AA8B', '#94A3B8', () => this.closeShop(), true);
        this.shopCloseButton.label.string = '继续战斗';
    }

    private buildHangarPanel(root: Node) {
        this.hangarPanelShadow = this.rect(root, 'HangarPanelShadow', 36, 196, 648, 936, '#020617', 24);
        this.hangarPanelShadow.active = false;
        const panel = this.rect(root, 'HangarPanel', 24, 184, 672, 936, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.hangarPanel = panel;

        this.hangarTitleLabel = this.label(panel, 'HangarTitle', '', 36, 24, 600, 52, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.hangarBackButton = this.button(panel, 'HangarBackHome', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.openMainMenu(), true);
        this.hangarBackButton.label.string = '首页';
        this.hangarStatsLabel = this.label(panel, 'HangarStats', '', 46, 78, 580, 98, 20, '#334155', Label.HorizontalAlign.CENTER, true);
        this.hangarTipLabel = this.label(panel, 'HangarTip', '', 46, 842, 580, 44, 18, '#64748B', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LootChoice_${i}`, 58, 208 + i * 92, 556, 76, '#F8961E', '#94A3B8', () => this.chooseLoot(i), true);
            this.lootButtons.push(button);
        }

        for (let i = 0; i < EQUIPPED_SLOT_COUNT; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const button = this.button(
                panel,
                `EquippedSlot_${i}`,
                46 + col * 198,
                190 + row * 58,
                184,
                48,
                '#1E293B',
                '#94A3B8',
                () => this.selectEquippedSlot(i),
                true,
            );
            this.equippedButtons.push(button);
        }

        this.equipmentDetailLabel = this.label(panel, 'EquipmentDetail', '', 46, 302, 580, 116, 16, '#0F172A', Label.HorizontalAlign.LEFT, true);

        for (let i = 0; i < HANGAR_EQUIPMENT_SLOTS; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const button = this.button(
                panel,
                `EquipmentSlot_${i}`,
                44 + col * 316,
                430 + row * 68,
                292,
                58,
                '#4CC9F0',
                '#94A3B8',
                () => this.selectVisibleEquipment(i),
                true,
            );
            this.equipmentButtons.push(button);
        }

        this.prevEquipmentButton = this.button(panel, 'EquipmentPrev', 46, 706, 104, 52, '#64748B', '#94A3B8', () => this.changeEquipmentPage(-1), true);
        this.equipActionButton = this.button(panel, 'EquipAction', 164, 706, 170, 52, '#4CC9F0', '#94A3B8', () => this.toggleSelectedEquipment(), true);
        this.upgradeActionButton = this.button(panel, 'UpgradeAction', 348, 706, 170, 52, '#F8961E', '#94A3B8', () => this.upgradeSelectedEquipment(), true);
        this.nextEquipmentButton = this.button(panel, 'EquipmentNext', 532, 706, 104, 52, '#64748B', '#94A3B8', () => this.changeEquipmentPage(1), true);

        this.startButton = this.button(panel, 'StartBattle', 174, 776, 324, 58, '#43AA8B', '#94A3B8', () => this.beginBattle(false), true);
    }

    private buildJoystick(root: Node) {
        this.joystickBase = new Node('JoystickBase');
        this.joystickBase.layer = Layers.Enum.UI_2D;
        root.addChild(this.joystickBase);
        this.joystickBase.addComponent(UITransform).setContentSize(148, 148);
        this.joystickBaseGfx = this.joystickBase.addComponent(Graphics);
        this.joystickBase.active = false;

        this.joystickKnob = new Node('JoystickKnob');
        this.joystickKnob.layer = Layers.Enum.UI_2D;
        root.addChild(this.joystickKnob);
        this.joystickKnob.addComponent(UITransform).setContentSize(72, 72);
        this.joystickKnobGfx = this.joystickKnob.addComponent(Graphics);
        this.joystickKnob.active = false;
        this.drawJoystick();
    }

    private buildLoadingPanel(root: Node) {
        const panel = this.rect(root, 'LoadingPanel', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, '#111827');
        panel.active = true;
        this.loadingPanel = panel;
        const gfx = panel.getComponent(Graphics);
        if (gfx) {
            gfx.fillColor = this.hex('#172554', 210);
            gfx.circle(560, 220, 260);
            gfx.fill();
            gfx.fillColor = this.hex('#F97316', 170);
            gfx.circle(108, 1080, 310);
            gfx.fill();
            gfx.strokeColor = this.hex('#FACC15', 125);
            gfx.lineWidth = 6;
            gfx.circle(360, 596, 160);
            gfx.stroke();
        }
        this.loadingTitleLabel = this.label(panel, 'LoadingTitle', '星坠幸存者', 70, 420, 580, 72, 54, '#FFF7ED', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LoadingSubTitle', '正在整备星舰与武器', 92, 506, 536, 40, 24, '#FDE68A', Label.HorizontalAlign.CENTER, true);
        this.loadingProgressLabel = this.label(panel, 'LoadingProgress', '加载中...', 92, 606, 536, 44, 22, '#E2E8F0', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LoadingHint', '提示：拾取经验升级，撑不住时可撤离带回资源', 76, 1040, 568, 58, 21, '#CBD5E1', Label.HorizontalAlign.CENTER, true);
    }

    private setLoadingProgress(message: string) {
        if (this.loadingProgressLabel) this.loadingProgressLabel.string = message;
    }

    private buildMenuPanel(root: Node) {
        this.menuPanelShadow = this.rect(root, 'MenuPanelShadow', 48, 220, 624, 790, '#020617', 28);
        this.menuPanelShadow.active = false;
        const panel = this.rect(root, 'MenuPanel', 36, 206, 648, 790, '#F8FAFC', 28, '#CBD5E1');
        panel.active = false;
        this.menuPanel = panel;
        this.label(panel, 'MenuTitle', '星坠幸存者', 50, 52, 548, 68, 46, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'MenuSubTitle', '卡通科幻肉鸽射击 · 自动开火 · 无尽撤离', 56, 126, 536, 38, 20, '#475569', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'AgeHint', '适龄提示：12+｜健康游戏，适度娱乐', 56, 176, 536, 32, 18, '#64748B', Label.HorizontalAlign.CENTER, true);

        const start = this.button(panel, 'MenuStart', 144, 246, 360, 62, '#43AA8B', '#94A3B8', () => this.openHangarFromMenu(), true);
        start.label.string = '进入机库';
        const quick = this.button(panel, 'MenuQuickStart', 144, 326, 360, 62, '#4CC9F0', '#94A3B8', () => this.beginBattle(false), true);
        quick.label.string = '快速出击';
        const settings = this.button(panel, 'MenuSettings', 144, 406, 360, 58, '#64748B', '#94A3B8', () => this.openSettingsPanel(), true);
        settings.label.string = '设置';
        const howto = this.button(panel, 'MenuHowTo', 144, 480, 360, 58, '#B5179E', '#94A3B8', () => this.openHowToPanel(), true);
        howto.label.string = '玩法说明';
        const privacy = this.button(panel, 'MenuPrivacy', 144, 554, 360, 58, '#F8961E', '#94A3B8', () => this.openPrivacyPanel(), true);
        privacy.label.string = '隐私与适龄';
        this.label(panel, 'MenuVersion', 'v0.2.0  审核前测试版', 56, 696, 536, 32, 17, '#94A3B8', Label.HorizontalAlign.CENTER, true);
    }

    private buildPausePanel(root: Node) {
        this.pausePanelShadow = this.rect(root, 'PausePanelShadow', 78, 372, 564, 520, '#020617', 24);
        this.pausePanelShadow.active = false;
        const panel = this.rect(root, 'PausePanel', 66, 360, 588, 520, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.pausePanel = panel;
        this.label(panel, 'PauseTitle', '暂停', 42, 38, 504, 58, 38, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'PauseHint', '战斗已暂停，可继续、调整声音或返回机库。', 50, 104, 488, 44, 20, '#475569', Label.HorizontalAlign.CENTER, true);
        const resume = this.button(panel, 'PauseResume', 124, 178, 340, 60, '#43AA8B', '#94A3B8', () => this.resumeFromPause(), true);
        resume.label.string = '继续游戏';
        const settings = this.button(panel, 'PauseSettings', 124, 254, 340, 58, '#64748B', '#94A3B8', () => this.openSettingsPanel(), true);
        settings.label.string = '设置';
        const hangar = this.button(panel, 'PauseHangar', 124, 328, 340, 58, '#F8961E', '#94A3B8', () => this.returnToHangarFromPause(), true);
        hangar.label.string = '返回机库';
        const help = this.button(panel, 'PauseHelp', 124, 402, 340, 58, '#B5179E', '#94A3B8', () => this.openHowToPanel(), true);
        help.label.string = '玩法说明';
    }

    private buildSettingsPanel(root: Node) {
        this.settingsPanelShadow = this.rect(root, 'SettingsPanelShadow', 86, 386, 548, 490, '#020617', 24);
        this.settingsPanelShadow.active = false;
        const panel = this.rect(root, 'SettingsPanel', 74, 374, 572, 490, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.settingsPanel = panel;
        this.label(panel, 'SettingsTitle', '设置', 44, 36, 484, 58, 36, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.settingsBodyLabel = this.label(panel, 'SettingsBody', '', 54, 104, 464, 80, 20, '#475569', Label.HorizontalAlign.CENTER, true);
        this.bgmToggleButton = this.button(panel, 'BgmToggle', 116, 204, 340, 58, '#4CC9F0', '#94A3B8', () => this.toggleBgm(), true);
        this.sfxToggleButton = this.button(panel, 'SfxToggle', 116, 278, 340, 58, '#B5179E', '#94A3B8', () => this.toggleSfx(), true);
        const close = this.button(panel, 'SettingsClose', 116, 366, 340, 58, '#43AA8B', '#94A3B8', () => this.closeSettingsPanel(), true);
        close.label.string = '返回';
        this.refreshSettingsPanel();
    }

    private buildInfoPanel(root: Node) {
        this.infoPanelShadow = this.rect(root, 'InfoPanelShadow', 64, 304, 592, 646, '#020617', 24);
        this.infoPanelShadow.active = false;
        const panel = this.rect(root, 'InfoPanel', 52, 292, 616, 646, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.infoPanel = panel;
        this.infoTitleLabel = this.label(panel, 'InfoTitle', '', 44, 34, 528, 58, 34, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.infoBodyLabel = this.label(panel, 'InfoBody', '', 54, 112, 508, 390, 20, '#334155', Label.HorizontalAlign.LEFT, true);
        const close = this.button(panel, 'InfoClose', 148, 532, 320, 58, '#43AA8B', '#94A3B8', () => this.closeInfoPanel(), true);
        close.label.string = '返回';
    }

    private openHome() {
        this.openMainMenu();
    }

    private openMainMenu() {
        this.clearWorld();
        this.phase = 'menu';
        this.requestBgm('bgm_hangar');
        this.setAllOverlayPanelsActive(false);
        if (this.loadingPanel) this.loadingPanel.active = false;
        if (this.menuPanel) this.menuPanel.active = true;
        if (this.menuPanelShadow) this.menuPanelShadow.active = true;
        this.setCombatHudControlsActive(false);
        this.showToast('');
    }

    private openHangarFromMenu() {
        this.setMenuPanelActive(false);
        this.showHangar('选择装备后开始出击。');
    }

    private setMenuPanelActive(active: boolean) {
        if (this.menuPanel) this.menuPanel.active = active;
        if (this.menuPanelShadow) this.menuPanelShadow.active = active;
    }

    private setAllOverlayPanelsActive(active: boolean) {
        this.setMenuPanelActive(active);
        if (this.pausePanel) this.pausePanel.active = active;
        if (this.pausePanelShadow) this.pausePanelShadow.active = active;
        if (this.settingsPanel) this.settingsPanel.active = active;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = active;
        if (this.infoPanel) this.infoPanel.active = active;
        if (this.infoPanelShadow) this.infoPanelShadow.active = active;
        if (this.levelPanel) this.levelPanel.active = active;
        if (this.levelPanelShadow) this.levelPanelShadow.active = active;
        this.setShopPanelActive(active);
        if (this.hangarPanel) this.hangarPanel.active = active;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = active;
    }

    private setCombatHudControlsActive(active: boolean) {
        if (this.switchWeaponButton) this.switchWeaponButton.node.active = active;
        if (this.shopButton) this.shopButton.node.active = active;
        if (this.extractButton) this.extractButton.node.active = active;
        if (this.pauseButton) this.pauseButton.node.active = active;
    }

    private beginBattle(initial: boolean) {
        if (this.getEquippedWeapons().length <= 0) {
            this.showToast('至少需要携带 1 把武器才能出战。');
            this.showHangar('先从仓库里选择一把武器加入出战。');
            return;
        }

        this.clearWorld();
        this.phase = 'combat';
        this.requestBgm('bgm_combat_loop');
        this.battleIndex = this.battlesWon + 1;
        this.combatTime = 0;
        this.cycleTime = 0;
        this.endlessCycle = 1;
        this.waveIndex = 0;
        this.waveElapsed = 0;
        this.waveDuration = 55;
        this.waveSpawnTimer = 0.15;
        this.bossSpawned = false;
        this.bossDefeatedThisWave = false;
        this.bossKills = 0;
        this.waveKillCount = 0;
        this.waveChestDrops = 0;
        this.currentWaveSpecs = [];
        this.killCount = 0;
        this.battleAlloy = 0;
        this.battleCores = 0;
        this.battleShards = 0;
        this.battleBiomass = 0;
        this.battleCircuits = 0;
        this.battleCrystals = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 65;
        this.runDamageBonus = 0;
        this.runFireRateBonus = 0;
        this.runMoveSpeedBonus = 0;
        this.runMaxHpBonus = 0;
        this.runPickupBonus = 0;
        this.runPierceBonus = 0;
        this.runMultiShot = 0;
        this.runRegen = 0;
        this.runStats = createEmptyCharacterStats();
        this.acquiredRunItemIds = new Set();
        this.acquiredStatUpgradeIds = new Set();
        this.pendingItemChoices = [];
        this.shopOffers = [];
        this.currentItemChoiceQuality = 'common';
        this.shotTimer = 0;
        this.droneTimer = 0.6;
        this.regenTimer = 0;
        this.shotCounter = 0;
        this.activeWeaponIndex = 0;
        this.weaponCooldowns = {};
        this.playerX = 0;
        this.playerY = -190;
        this.updateCamera(0, true);
        this.playerMaxHp = this.getMaxHp();
        this.playerHp = this.playerMaxHp;
        this.playerShieldMax = this.getShieldMax();
        this.playerShield = this.playerShieldMax;
        this.shieldRechargeDelay = 0;
        this.invulnerableTimer = 0;
        this.touchActive = false;
        this.touchVector.set(0, 0);

        this.setAllOverlayPanelsActive(false);
        if (this.joystickBase) this.joystickBase.active = false;
        if (this.joystickKnob) this.joystickKnob.active = false;
        this.setCombatHudControlsActive(true);

        this.createPlayer();
        this.refreshHud();
        this.showToast(initial ? '无尽出击开始：撑得越久，带回资源越多。' : `第 ${this.battleIndex} 次出击开始，Boss 阶段会循环增强。`);
    }

    private createPlayer() {
        const node = new Node('Player');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(this.playerX, this.playerY, 10);
        node.addComponent(UITransform).setContentSize(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
        this.playerNode = node;
        this.playerSprite = this.addSpriteChild(node, 'PlayerArt', 'player_survivor_idle', PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE) || this.addSpriteChild(node, 'PlayerArt', 'player_ship', 74, 74);
        this.playerWeaponSprite = this.createPlayerWeaponSprite(node);
        this.playerGfx = node.addComponent(Graphics);
        this.playerDirection = 'south';
        this.playerMoving = false;
        this.playerAnimationFrameIndex = -1;
        this.playerAnimationKey = '';
        this.playerWeaponAimAngle = -Math.PI / 2;
        this.playerWeaponFrameName = '';
        this.updatePlayerSpriteAnimation(0);
        this.updatePlayerWeaponVisual();
        this.drawPlayer();
    }

    private createPlayerWeaponSprite(parent: Node): Sprite | null {
        const frameName = this.getActiveWeaponIconFrameName();
        const sprite = this.addSpriteChild(parent, 'PlayerWeaponArt', frameName, 42, 42);
        if (sprite) {
            sprite.node.setPosition(16, -3, 2);
            sprite.node.angle = -8;
        }
        return sprite;
    }

    private getActiveWeaponIconFrameName() {
        const weapon = this.getActiveWeapon();
        return this.getWeaponIconFrameName(weapon?.id || 'storm-rifle');
    }

    private getWeaponIconFrameName(id: string) {
        const base = this.getWeaponFamilyId(id);
        return `weapon_${base.replace(/-/g, '_')}_icon`;
    }

    private getWeaponFamilyId(id: string) {
        for (const family of WEAPON_FAMILIES) {
            if (id === family.id || id.startsWith(`${family.id}-`)) return family.id;
        }
        return id;
    }

    private updatePlayer(dt: number) {
        const move = this.getMoveVector();
        const speed = this.getMoveSpeed();
        let nextX = this.clamp(this.playerX + move.x * speed * dt, WORLD_LEFT + 42, WORLD_RIGHT - 42);
        let nextY = this.clamp(this.playerY + move.y * speed * dt, WORLD_BOTTOM + 42, WORLD_TOP - 42);
        const resolved = this.resolvePlayerEnemyCollision(nextX, nextY);
        nextX = resolved.x;
        nextY = resolved.y;
        this.playerX = nextX;
        this.playerY = nextY;
        if (this.playerNode) {
            this.playerNode.setPosition(this.playerX, this.playerY, 10);
        }
        this.playerMoving = Math.abs(move.x) + Math.abs(move.y) > 0.01;
        if (this.playerMoving) this.playerDirection = this.getPlayerDirectionFromVector(move.x, move.y);
        this.updatePlayerSpriteAnimation(dt);
        this.updatePlayerWeaponVisual(move);
        this.drawPlayer();
        this.updateJoystickView();
    }

    private updatePlayerWeaponVisual(move?: Vec2) {
        if (!this.playerNode) return;
        if (!this.playerWeaponSprite) {
            this.playerWeaponSprite = this.createPlayerWeaponSprite(this.playerNode);
        }
        if (!this.playerWeaponSprite) return;

        const frameName = this.getActiveWeaponIconFrameName();
        const frame = this.artFrames.get(frameName) || this.artFrames.get('weapon_storm_rifle_icon');
        if (frame && frameName !== this.playerWeaponFrameName) {
            this.playerWeaponSprite.spriteFrame = frame;
            this.playerWeaponFrameName = frameName;
        }

        const target = this.phase === 'combat' ? this.findNearestEnemy(Math.min(this.getAttackRange(), 900)) : null;
        if (target) {
            this.playerWeaponAimAngle = Math.atan2(target.node.position.y - this.playerY, target.node.position.x - this.playerX);
        } else if (move && Math.abs(move.x) + Math.abs(move.y) > 0.01) {
            this.playerWeaponAimAngle = Math.atan2(move.y, move.x);
        }

        const angle = this.playerWeaponAimAngle;
        const frontLayer = Math.sin(angle) < 0.35;
        const distance = frontLayer ? 24 : 17;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance - 3;
        const scaleY = Math.cos(angle) < -0.05 ? -1 : 1;
        const size = this.getWeaponFamilyId(this.getActiveWeapon()?.id || 'storm-rifle') === 'orbital-drone' ? 34 : 42;
        this.playerWeaponSprite.node.setPosition(x, y, frontLayer ? 3 : -1);
        this.playerWeaponSprite.node.angle = angle * 180 / Math.PI;
        this.playerWeaponSprite.node.setScale(1, scaleY, 1);
        this.playerWeaponSprite.node.getComponent(UITransform)?.setContentSize(size, size);
        this.playerWeaponSprite.node.active = true;
    }

    private getPlayerDirectionFromVector(x: number, y: number): PlayerDirection {
        const angle = Math.atan2(y, x);
        const normalized = (PLAYER_DIRECTION_ANGLE_OFFSET - angle + Math.PI * 2) % (Math.PI * 2);
        const index = Math.round(normalized / (Math.PI / 4)) % PLAYER_DIRECTIONS.length;
        return PLAYER_DIRECTIONS[index];
    }

    private updatePlayerSpriteAnimation(dt: number) {
        if (!this.playerSprite) return;
        const bodyDirection = PLAYER_BODY_ANIMATION_DIRECTION;
        const animation = this.playerMoving
            ? this.playerRunAnimations.get(bodyDirection) || this.playerRunAnimations.get('south') || this.playerIdleAnimation
            : this.playerIdleAnimation || this.playerRunAnimations.get(bodyDirection) || this.playerRunAnimations.get('south');
        if (!animation || animation.frames.length <= 0) return;

        const animationKey = `${this.playerMoving ? 'run' : 'idle'}:${this.playerMoving ? bodyDirection : 'idle'}`;
        if (animationKey !== this.playerAnimationKey) {
            this.playerAnimationKey = animationKey;
            this.playerAnimationFrameIndex = -1;
        }

        const frameIndex = Math.floor(this.combatTime * animation.fps) % animation.frames.length;
        if (frameIndex !== this.playerAnimationFrameIndex) {
            this.playerAnimationFrameIndex = frameIndex;
            this.playerSprite.spriteFrame = animation.frames[frameIndex];
            this.playerSprite.node.getComponent(UITransform)?.setContentSize(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
        }
        this.playerSprite.node.setPosition(0, 0, 0);
        this.playerSprite.node.setScale(1, 1, 1);
    }

    private resolvePlayerEnemyCollision(x: number, y: number): Vec2 {
        let nextX = x;
        let nextY = y;
        for (let pass = 0; pass < 2; pass++) {
            for (const enemy of this.enemies) {
                const ex = enemy.node.position.x;
                const ey = enemy.node.position.y;
                const minDist = this.playerRadius + enemy.radius + ENEMY_PLAYER_PADDING;
                const dx = nextX - ex;
                const dy = nextY - ey;
                if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;
                const distSq = dx * dx + dy * dy;
                if (distSq >= minDist * minDist) continue;

                const dist = Math.sqrt(Math.max(0.001, distSq));
                const angle = (enemy.id * 7.17) % (Math.PI * 2);
                const nx = dist > 0.01 ? dx / dist : Math.cos(angle);
                const ny = dist > 0.01 ? dy / dist : Math.sin(angle);
                nextX = this.clamp(ex + nx * minDist, WORLD_LEFT + 42, WORLD_RIGHT - 42);
                nextY = this.clamp(ey + ny * minDist, WORLD_BOTTOM + 42, WORLD_TOP - 42);
            }
        }
        return new Vec2(nextX, nextY);
    }

    private resolvePlayerAfterEnemyMovement() {
        const resolved = this.resolvePlayerEnemyCollision(this.playerX, this.playerY);
        if (Math.abs(resolved.x - this.playerX) < 0.01 && Math.abs(resolved.y - this.playerY) < 0.01) return;
        this.playerX = resolved.x;
        this.playerY = resolved.y;
        if (this.playerNode) {
            this.playerNode.setPosition(this.playerX, this.playerY, 10);
        }
        this.drawPlayer();
    }

    private updateCamera(dt: number, snap = false) {
        if (!this.worldNode) return;
        const targetX = this.clamp(CAMERA_FOCUS_X - this.playerX, VIEW_RIGHT - WORLD_RIGHT, VIEW_LEFT - WORLD_LEFT);
        const targetY = this.clamp(CAMERA_FOCUS_Y - this.playerY, VIEW_TOP - WORLD_TOP, VIEW_BOTTOM - WORLD_BOTTOM);
        const follow = snap ? 1 : Math.min(1, dt * 8.5);
        this.cameraX += (targetX - this.cameraX) * follow;
        this.cameraY += (targetY - this.cameraY) * follow;
        this.worldNode.setPosition(this.cameraX, this.cameraY, 0);
    }

    private getMoveVector(): Vec2 {
        let x = 0;
        let y = 0;
        if (this.pressedKeys.has(KeyCode.KEY_A) || this.pressedKeys.has(KeyCode.ARROW_LEFT)) x -= 1;
        if (this.pressedKeys.has(KeyCode.KEY_D) || this.pressedKeys.has(KeyCode.ARROW_RIGHT)) x += 1;
        if (this.pressedKeys.has(KeyCode.KEY_W) || this.pressedKeys.has(KeyCode.ARROW_UP)) y += 1;
        if (this.pressedKeys.has(KeyCode.KEY_S) || this.pressedKeys.has(KeyCode.ARROW_DOWN)) y -= 1;
        if (this.touchActive) {
            x += this.touchVector.x;
            y += this.touchVector.y;
        }

        const len = Math.sqrt(x * x + y * y);
        if (len > 0.001) {
            x /= len;
            y /= len;
        }
        return new Vec2(x, y);
    }

    private updateSpawning(dt: number) {
        if (this.waveIndex <= 0) {
            this.startNextWave();
        }

        this.waveElapsed += dt;
        this.cycleTime = this.waveElapsed;
        this.waveSpawnTimer -= dt;
        while (this.waveSpawnTimer <= 0) {
            if (this.enemies.length < this.getEnemyCap()) {
                this.spawnCurrentWaveBatch();
            }
            this.waveSpawnTimer += this.getWaveSpawnInterval();
        }

        if (this.waveElapsed < this.waveDuration) return;
        if (this.isBossWave() && !this.bossDefeatedThisWave) {
            this.waveSpawnTimer = Math.min(this.waveSpawnTimer, 0.6);
            return;
        }
        this.startNextWave();
    }

    private updateWeapons(dt: number) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
            const target = this.findNearestEnemy(this.getAttackRange());
            if (target) {
                this.fireAt(target);
                this.shotTimer = this.getFireInterval();
            }
        }

        const dronePower = this.getCharacterStats().dronePower;
        if (dronePower > 0) {
            this.droneTimer -= dt;
            if (this.droneTimer <= 0) {
                const strikes = this.getDroneStrikeCount(dronePower);
                for (let i = 0; i < strikes; i++) {
                    const target = this.findNearestEnemy(this.getDroneRange(dronePower));
                    if (target) this.droneStrike(target, dronePower);
                }
                this.droneTimer = this.getDroneStrikeInterval(dronePower);
            }
        }
    }

    private getDroneStrikeCount(dronePower: number) {
        return Math.min(8, 1 + Math.floor(dronePower / 4));
    }

    private getDroneRange(dronePower: number) {
        return 320 + dronePower * 18;
    }

    private getDroneStrikeInterval(dronePower: number) {
        return Math.max(0.28, 1.18 - Math.min(0.78, dronePower * 0.035));
    }

    private fireAt(target: Enemy) {
        const dx = target.node.position.x - this.playerX;
        const dy = target.node.position.y - this.playerY;
        const baseAngle = Math.atan2(dy, dx);
        this.playerWeaponAimAngle = baseAngle;
        this.updatePlayerWeaponVisual();
        const damage = this.getBulletDamage();
        const activeWeapon = this.getActiveWeapon();
        const weaponStyle = activeWeapon?.attackStyle || 'rifle';
        const weaponColor = activeWeapon?.color || '#4CC9F0';
        const spreadPower = this.getCharacterStats().multiShot;
        const angles = [baseAngle];
        this.shotCounter += 1;

        const guaranteedExtra = Math.min(3, Math.floor(spreadPower / 2.2));
        if (guaranteedExtra > 0) {
            for (let i = 1; i <= guaranteedExtra; i++) {
                angles.push(baseAngle + i * 0.13, baseAngle - i * 0.13);
            }
        }
        if (spreadPower > 0 && this.shotCounter % Math.max(2, 6 - Math.floor(spreadPower / 1.7)) === 0) {
            angles.push(baseAngle + 0.24, baseAngle - 0.24);
            if (spreadPower >= 4) angles.push(baseAngle + 0.42, baseAngle - 0.42);
            if (spreadPower >= 9) angles.push(baseAngle + 0.6, baseAngle - 0.6);
        }

        for (const angle of angles) {
            this.createBullet(angle, damage, this.getBulletPierce(), weaponStyle, weaponColor);
        }
        this.playShootSfx(weaponStyle);
        this.spawnMuzzleFlash(baseAngle, weaponStyle, weaponColor, angles.length);
    }

    private getWeaponAccentColor(style: WeaponAttackStyle, fallback: string) {
        switch (style) {
            case 'shotgun': return '#FFE8A3';
            case 'rail': return '#A7F3D0';
            case 'laser': return '#D9FFF3';
            case 'chain': return '#FDE68A';
            case 'pulse': return '#FBCFE8';
            case 'drone': return '#ECFCCB';
            case 'disc': return '#FFF7AD';
            case 'spray': return '#BBF7D0';
            case 'meteor': return '#FED7AA';
            case 'ricochet': return '#BAE6FD';
            case 'scythe': return '#F5D0FE';
            case 'rifle':
            default:
                return fallback === '#4CC9F0' ? '#F8FAFC' : '#FFF7ED';
        }
    }

    private getWeaponBulletRadius(style: WeaponAttackStyle) {
        switch (style) {
            case 'shotgun': return 6;
            case 'rail': return 5;
            case 'laser': return 4;
            case 'pulse': return 9;
            case 'disc': return 10;
            case 'spray': return 5;
            case 'meteor': return 12;
            case 'scythe': return 11;
            default: return 7;
        }
    }

    private getWeaponBulletLife(style: WeaponAttackStyle) {
        switch (style) {
            case 'shotgun': return 0.9;
            case 'rail': return 1.72;
            case 'laser': return 1.24;
            case 'meteor': return 1.18;
            case 'spray': return 0.82;
            default: return 1.45;
        }
    }

    private spawnMuzzleFlash(angle: number, style: WeaponAttackStyle, color: string, shotCount: number) {
        if (!this.worldNode) return;
        const node = new Node('MuzzleFlash');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode.addChild(node);
        const distance = 38;
        node.setPosition(this.playerX + Math.cos(angle) * distance, this.playerY + Math.sin(angle) * distance, 12);
        node.angle = angle * 180 / Math.PI;
        const gfx = node.addComponent(Graphics);
        const length = style === 'rail' ? 58 : style === 'shotgun' ? 42 : style === 'meteor' ? 34 : 30;
        const width = style === 'shotgun' ? 16 + shotCount * 2 : style === 'rail' ? 8 : 12;
        gfx.fillColor = this.hex(color, 170);
        gfx.moveTo(-4, 0);
        gfx.lineTo(length, width * 0.5);
        gfx.lineTo(length * 0.68, 0);
        gfx.lineTo(length, -width * 0.5);
        gfx.close();
        gfx.fill();
        gfx.fillColor = this.hex(this.getWeaponAccentColor(style, color), 230);
        gfx.circle(0, 0, Math.max(7, width * 0.42));
        gfx.fill();
        this.scheduleOnce(() => node.destroy(), 0.075);
    }

    private spawnBulletHitSpark(x: number, y: number, style: WeaponAttackStyle, color: string, accent: string) {
        if (!this.worldNode) return;
        const node = new Node('BulletHitSpark');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode.addChild(node);
        node.setPosition(x, y, 13);
        const gfx = node.addComponent(Graphics);
        const radius = style === 'meteor' ? 24 : style === 'pulse' ? 20 : style === 'rail' ? 16 : 12;
        gfx.fillColor = this.hex(color, 70);
        gfx.circle(0, 0, radius);
        gfx.fill();
        gfx.strokeColor = this.hex(accent, 215);
        gfx.lineWidth = style === 'rail' ? 4 : 3;
        gfx.circle(0, 0, radius * 0.72);
        gfx.stroke();
        if (style === 'rail' || style === 'laser') {
            gfx.moveTo(-radius, 0);
            gfx.lineTo(radius, 0);
            gfx.moveTo(0, -radius * 0.55);
            gfx.lineTo(0, radius * 0.55);
            gfx.stroke();
        }
        this.scheduleOnce(() => node.destroy(), 0.11);
    }

    private createBullet(angle: number, damage: number, pierce: number, style: WeaponAttackStyle, color: string) {
        const speed = this.getBulletSpeed();
        const bullet = this.acquireBullet();
        bullet.x = this.playerX;
        bullet.y = this.playerY;
        bullet.vx = Math.cos(angle) * speed;
        bullet.vy = Math.sin(angle) * speed;
        bullet.damage = damage;
        bullet.style = style;
        bullet.color = color;
        bullet.accent = this.getWeaponAccentColor(style, color);
        bullet.radius = this.getWeaponBulletRadius(style);
        bullet.pierce = pierce;
        bullet.life = this.getWeaponBulletLife(style);
        bullet.maxLife = bullet.life;
        bullet.hitIds.clear();
        bullet.node.active = true;
        bullet.node.setPosition(bullet.x, bullet.y, 6);
        bullet.node.angle = angle * 180 / Math.PI;
        this.drawBullet(bullet);
        this.bullets.push(bullet);
    }

    private acquireBullet(): Bullet {
        const pooled = this.bulletPool.pop();
        if (pooled) return pooled;

        const node = new Node('Bullet');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(24, 24);
        const gfx = node.addComponent(Graphics);
        const sprite = this.addSpriteChild(node, 'BulletArt', 'bullet_plasma', 28, 28);
        return {
            node,
            gfx,
            sprite,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            damage: 0,
            radius: 7,
            pierce: 0,
            life: 0,
            maxLife: 0,
            color: '#4CC9F0',
            accent: '#F8FAFC',
            style: 'rifle',
            hitIds: new Set<number>(),
        };
    }

    private updateBullets(dt: number) {
        const removing: Bullet[] = [];
        const enemyGrid = this.buildEnemyGrid(BULLET_HIT_CELL);
        for (const bullet of this.bullets) {
            bullet.life -= dt;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            bullet.node.setPosition(bullet.x, bullet.y, 6);
            this.drawBullet(bullet);

            if (bullet.life <= 0 || bullet.x < WORLD_LEFT - 180 || bullet.x > WORLD_RIGHT + 180 || bullet.y < WORLD_BOTTOM - 180 || bullet.y > WORLD_TOP + 180) {
                removing.push(bullet);
                continue;
            }

            const cellX = Math.floor(bullet.x / BULLET_HIT_CELL);
            const cellY = Math.floor(bullet.y / BULLET_HIT_CELL);
            let bulletRemoved = false;
            for (let ox = -1; ox <= 1 && !bulletRemoved; ox++) {
                for (let oy = -1; oy <= 1 && !bulletRemoved; oy++) {
                    const bucket = enemyGrid.get(`${cellX + ox},${cellY + oy}`);
                    if (!bucket) continue;
                    for (const enemy of bucket) {
                        if (this.enemies.indexOf(enemy) < 0) continue;
                        if (bullet.hitIds.has(enemy.id)) continue;
                        const distSq = this.distanceSq(bullet.x, bullet.y, enemy.node.position.x, enemy.node.position.y);
                        const hitRadius = bullet.radius + enemy.radius;
                        if (distSq <= hitRadius * hitRadius) {
                            bullet.hitIds.add(enemy.id);
                            const roll = this.rollOutgoingDamage(enemy, bullet.damage);
                            this.damageEnemy(enemy, roll.amount, roll.color, roll.tag);
                            this.spawnBulletHitSpark(bullet.x, bullet.y, bullet.style, bullet.color, bullet.accent);
                            bullet.pierce -= 1;
                            if (bullet.pierce < 0) {
                                removing.push(bullet);
                                bulletRemoved = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
        for (const bullet of removing) {
            this.removeBullet(bullet);
        }
    }

    private enemyShoot(enemy: Enemy, dirX: number, dirY: number) {
        const type = enemy.damageType;
        const spread = enemy.boss ? 5 : enemy.elite ? 3 : enemy.spec.variantId === 'prime' ? 3 : 1;
        const baseAngle = Math.atan2(dirY, dirX);
        const start = -(spread - 1) / 2;
        for (let i = 0; i < spread; i++) {
            const angle = baseAngle + (start + i) * (enemy.boss ? 0.26 : 0.18);
            this.createEnemyProjectile(
                enemy.node.position.x,
                enemy.node.position.y,
                angle,
                enemy.damage * (enemy.boss ? 0.8 : 0.62),
                type,
                enemy.boss ? 290 : enemy.elite ? 260 : 230,
            );
        }
    }

    private createEnemyProjectile(x: number, y: number, angle: number, damage: number, damageType: DamageType, speed: number) {
        if (this.enemyProjectiles.length >= ENEMY_PROJECTILE_LIMIT) {
            const oldest = this.enemyProjectiles.shift();
            if (oldest) this.recycleEnemyProjectile(oldest, false);
        }

        const projectile = this.acquireEnemyProjectile();
        projectile.x = x;
        projectile.y = y;
        projectile.vx = Math.cos(angle) * speed;
        projectile.vy = Math.sin(angle) * speed;
        projectile.damage = damage;
        projectile.radius = damageType === 'fire' ? 10 : 8;
        projectile.life = 3.2;
        projectile.damageType = damageType;
        projectile.color = this.getDamageTypeColor(damageType);
        projectile.node.active = true;
        projectile.node.setPosition(projectile.x, projectile.y, 7);
        projectile.node.angle = angle * 180 / Math.PI;
        this.drawEnemyProjectile(projectile);
        this.enemyProjectiles.push(projectile);
    }

    private acquireEnemyProjectile(): EnemyProjectile {
        const pooled = this.enemyProjectilePool.pop();
        if (pooled) return pooled;

        const node = new Node('EnemyProjectile');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(28, 28);
        const gfx = node.addComponent(Graphics);
        return {
            node,
            gfx,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            damage: 0,
            radius: 8,
            life: 0,
            damageType: 'physical',
            color: this.getDamageTypeColor('physical'),
        };
    }

    private updateEnemyProjectiles(dt: number) {
        const removing: EnemyProjectile[] = [];
        for (const projectile of this.enemyProjectiles) {
            projectile.life -= dt;
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
            projectile.node.setPosition(projectile.x, projectile.y, 7);
            if (projectile.life <= 0 || projectile.x < WORLD_LEFT - 160 || projectile.x > WORLD_RIGHT + 160 || projectile.y < WORLD_BOTTOM - 160 || projectile.y > WORLD_TOP + 160) {
                removing.push(projectile);
                continue;
            }

            const hitRadius = projectile.radius + this.playerRadius;
            if (this.distanceSq(projectile.x, projectile.y, this.playerX, this.playerY) <= hitRadius * hitRadius) {
                if (this.invulnerableTimer <= 0) this.takeDamage(projectile.damage, projectile.damageType);
                removing.push(projectile);
            }
        }
        for (const projectile of removing) {
            this.removeEnemyProjectile(projectile);
        }
    }

    private drawEnemyProjectile(projectile: EnemyProjectile) {
        projectile.gfx.clear();
        projectile.gfx.fillColor = this.hex('#020617', 110);
        projectile.gfx.circle(2, -2, projectile.radius + 3);
        projectile.gfx.fill();
        projectile.gfx.fillColor = this.hex(projectile.color);
        projectile.gfx.circle(0, 0, projectile.radius);
        projectile.gfx.fill();
        projectile.gfx.strokeColor = this.hex('#F8FAFC', 150);
        projectile.gfx.lineWidth = 2;
        projectile.gfx.circle(0, 0, projectile.radius + 1);
        projectile.gfx.stroke();
    }

    private removeEnemyProjectile(projectile: EnemyProjectile) {
        this.recycleEnemyProjectile(projectile, true);
    }

    private recycleEnemyProjectile(projectile: EnemyProjectile, removeFromActive: boolean) {
        if (removeFromActive) {
            const index = this.enemyProjectiles.indexOf(projectile);
            if (index >= 0) this.enemyProjectiles.splice(index, 1);
        }
        projectile.gfx.clear();
        projectile.node.active = false;
        this.enemyProjectilePool.push(projectile);
    }

    private buildEnemyGrid(cellSize: number) {
        const grid = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            const cellX = Math.floor(enemy.node.position.x / cellSize);
            const cellY = Math.floor(enemy.node.position.y / cellSize);
            const key = `${cellX},${cellY}`;
            let bucket = grid.get(key);
            if (!bucket) {
                bucket = [];
                grid.set(key, bucket);
            }
            bucket.push(enemy);
        }
        return grid;
    }

    private updateEnemies(dt: number) {
        const px = this.playerX;
        const py = this.playerY;
        for (const enemy of [...this.enemies]) {
            if (this.enemies.indexOf(enemy) < 0) continue;
            const ex = enemy.node.position.x;
            const ey = enemy.node.position.y;
            const dx = px - ex;
            const dy = py - ey;
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            this.updateEnemySkill(enemy, dt, dist, dx / dist, dy / dist);
            const wobble = Math.sin(this.combatTime * 2.4 + enemy.id * 0.73) * 0.18;
            let vx = dx / dist + (-dy / dist) * wobble;
            let vy = dy / dist + (dx / dist) * wobble;
            let moveSpeed = enemy.speed;
            if (enemy.dashTimer > 0) {
                enemy.dashTimer = Math.max(0, enemy.dashTimer - dt);
                vx = enemy.dashVx;
                vy = enemy.dashVy;
                moveSpeed = enemy.speed * (enemy.boss ? 2.15 : 2.9);
            }
            let nextX = ex + vx * moveSpeed * dt;
            let nextY = ey + vy * moveSpeed * dt;
            const fromPlayerX = nextX - px;
            const fromPlayerY = nextY - py;
            const playerDist = Math.max(0.001, Math.sqrt(fromPlayerX * fromPlayerX + fromPlayerY * fromPlayerY));
            const collideRadius = enemy.radius + this.playerRadius;
            const attemptedContactDist = Math.min(dist, playerDist);
            if (attemptedContactDist <= collideRadius + 4 && this.invulnerableTimer <= 0) {
                this.takeDamage(enemy.damage, enemy.damageType);
            }

            const playerGap = enemy.radius + this.playerRadius + ENEMY_PLAYER_PADDING;
            if (playerDist < playerGap) {
                const angle = enemy.id * 2.39996;
                const nx = playerDist > 0.01 ? fromPlayerX / playerDist : Math.cos(angle);
                const ny = playerDist > 0.01 ? fromPlayerY / playerDist : Math.sin(angle);
                nextX = px + nx * playerGap;
                nextY = py + ny * playerGap;
            }
            nextX = this.clamp(nextX, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius);
            nextY = this.clamp(nextY, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius);
            enemy.node.setPosition(nextX, nextY, 4);
            this.updateEnemyVisual(enemy, dt, vx, vy, moveSpeed);
        }
        this.separateEnemies();
    }

    private updateEnemyVisual(enemy: Enemy, dt: number, vx: number, vy: number, moveSpeed: number) {
        const wasFlashing = enemy.hitFlash > 0;
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

        const statusKey = [
            enemy.armorTimer > 0 ? ENEMY_STATUS_KEY_ARMOR : '',
            enemy.dashTimer > 0 ? ENEMY_STATUS_KEY_DASH : '',
            enemy.hp < enemy.maxHp ? 'wounded' : '',
        ].filter(Boolean).join('|');
        const flashEnded = wasFlashing && enemy.hitFlash <= 0;
        if (statusKey !== enemy.visualStateKey || flashEnded) {
            enemy.visualStateKey = statusKey;
            this.drawEnemy(enemy);
        }

        const dashPulse = enemy.dashTimer > 0 ? 0.12 : 0;
        const hitPulse = enemy.hitFlash > 0 ? (enemy.hitFlash / ENEMY_HIT_FLASH_DURATION) * 0.18 : 0;
        const scaleX = 1 + dashPulse + hitPulse * 0.55;
        const scaleY = 1 - dashPulse * 0.28 + hitPulse;
        enemy.node.setScale(scaleX, Math.max(0.86, scaleY), 1);

        if (enemy.sprite) {
            if (enemy.animation && enemy.animation.frames.length > 0) {
                const frameIndex = Math.floor((this.combatTime + enemy.animSeed * 0.07) * enemy.animation.fps) % enemy.animation.frames.length;
                if (frameIndex !== enemy.animationFrameIndex) {
                    enemy.animationFrameIndex = frameIndex;
                    enemy.sprite.spriteFrame = enemy.animation.frames[frameIndex];
                }
            }
            const spriteNode = enemy.sprite.node;
            spriteNode.setPosition(0, 0, 0);
            spriteNode.angle = enemy.dashTimer > 0 ? this.clamp(vx, -1, 1) * -8 : 0;
            enemy.sprite.color = enemy.hitFlash > 0
                ? this.hex('#FFFFFF', 255)
                : this.getEnemyTint(enemy, enemy.elite ? 255 : 235);
        } else if (enemy.hitFlash > 0) {
            this.drawEnemy(enemy);
        }
    }

    private updateEnemySkill(enemy: Enemy, dt: number, dist: number, dirX: number, dirY: number) {
        enemy.skillTimer -= dt;
        enemy.armorTimer = Math.max(0, enemy.armorTimer - dt);
        if (enemy.spec.variantId === 'regen' && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * (enemy.elite ? 0.007 : 0.0035) * dt);
            if (Math.random() < dt * 0.8) this.drawEnemy(enemy);
        }
        if (enemy.skillTimer > 0) return;

        const nextDelay = this.getEnemySkillDelay(enemy);
        enemy.skillTimer = nextDelay;
        if (this.shouldEnemyDash(enemy, dist)) {
            enemy.dashTimer = enemy.boss ? 0.58 : 0.38;
            enemy.dashVx = dirX;
            enemy.dashVy = dirY;
            this.spawnFloatingText('冲刺', enemy.node.position.x, enemy.node.position.y + enemy.radius + 20, '#F59E0B', 18);
            return;
        }

        if (this.shouldEnemyShoot(enemy, dist)) {
            this.enemyShoot(enemy, dirX, dirY);
            return;
        }

        if (enemy.spec.variantId === 'armored' || enemy.spec.family === 'brute' || enemy.spec.family === 'warden') {
            enemy.armorTimer = enemy.elite || enemy.boss ? 2.4 : 1.45;
            this.spawnFloatingText('霸体', enemy.node.position.x, enemy.node.position.y + enemy.radius + 20, '#CBD5E1', 18);
            this.drawEnemy(enemy);
        }
    }

    private getEnemySkillDelay(enemy: Enemy) {
        const base = enemy.elite || enemy.boss ? 1.25 : 1.9;
        if (enemy.spec.family === 'runner' || enemy.spec.variantId === 'swift') return this.randomRange(1.1, base + 0.45);
        if (enemy.spec.family === 'warden' || enemy.spec.variantId === 'arc') return this.randomRange(1.45, base + 0.75);
        if (enemy.spec.variantId === 'rage' || enemy.spec.variantId === 'venom' || enemy.spec.variantId === 'crystal') return this.randomRange(1.55, base + 0.85);
        return this.randomRange(2.0, 3.4);
    }

    private shouldEnemyDash(enemy: Enemy, dist: number) {
        if (dist < enemy.radius + this.playerRadius + 12) return false;
        if (enemy.spec.family === 'runner' || enemy.spec.variantId === 'swift' || enemy.spec.variantId === 'rage') return true;
        return enemy.elite && Math.random() < 0.34;
    }

    private shouldEnemyShoot(enemy: Enemy, dist: number) {
        if (dist < 120 || dist > 760) return false;
        return enemy.boss
            || enemy.spec.family === 'warden'
            || enemy.spec.variantId === 'acid'
            || enemy.spec.variantId === 'arc'
            || enemy.spec.variantId === 'crystal'
            || enemy.spec.variantId === 'venom'
            || enemy.spec.variantId === 'shade'
            || enemy.spec.variantId === 'prime';
    }

    private separateEnemies() {
        const buckets = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            let ax = enemy.node.position.x;
            let ay = enemy.node.position.y;
            const cellX = Math.floor(ax / ENEMY_SEPARATION_CELL);
            const cellY = Math.floor(ay / ENEMY_SEPARATION_CELL);
            let checks = 0;

            for (let ox = -1; ox <= 1 && checks < ENEMY_SEPARATION_MAX_CHECKS; ox++) {
                for (let oy = -1; oy <= 1 && checks < ENEMY_SEPARATION_MAX_CHECKS; oy++) {
                    const bucket = buckets.get(`${cellX + ox},${cellY + oy}`);
                    if (!bucket) continue;
                    const start = Math.max(0, bucket.length - ENEMY_SEPARATION_BUCKET_SCAN);
                    for (let index = bucket.length - 1; index >= start && checks < ENEMY_SEPARATION_MAX_CHECKS; index--) {
                        checks += 1;
                        const other = bucket[index];
                        let bx = other.node.position.x;
                        let by = other.node.position.y;
                        const minDist = enemy.radius + other.radius + ENEMY_SEPARATION_PADDING;
                        const dx = bx - ax;
                        const dy = by - ay;
                        if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;
                        const distSq = dx * dx + dy * dy;
                        if (distSq >= minDist * minDist) continue;

                        const dist = Math.sqrt(Math.max(0.001, distSq));
                        const angle = (enemy.id * 13.37 + other.id * 3.11) % (Math.PI * 2);
                        const nx = dist > 0.01 ? dx / dist : Math.cos(angle);
                        const ny = dist > 0.01 ? dy / dist : Math.sin(angle);
                        const overlap = minDist - dist;
                        const push = Math.min(14, overlap * 0.42);
                        const enemyInertia = enemy.boss ? 3.2 : enemy.elite ? 1.8 : 1;
                        const otherInertia = other.boss ? 3.2 : other.elite ? 1.8 : 1;
                        const enemyPush = push * (otherInertia / (enemyInertia + otherInertia));
                        const otherPush = push * (enemyInertia / (enemyInertia + otherInertia));

                        ax = this.clamp(ax - nx * enemyPush, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius);
                        ay = this.clamp(ay - ny * enemyPush, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius);
                        bx = this.clamp(bx + nx * otherPush, WORLD_LEFT + other.radius, WORLD_RIGHT - other.radius);
                        by = this.clamp(by + ny * otherPush, WORLD_BOTTOM + other.radius, WORLD_TOP - other.radius);
                        other.node.setPosition(bx, by, 4);
                    }
                }
            }

            enemy.node.setPosition(ax, ay, 4);
            const finalCellX = Math.floor(ax / ENEMY_SEPARATION_CELL);
            const finalCellY = Math.floor(ay / ENEMY_SEPARATION_CELL);
            const key = `${finalCellX},${finalCellY}`;
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = [];
                buckets.set(key, bucket);
            }
            bucket.push(enemy);
        }
    }

    private updatePickups(dt: number) {
        if (this.pickups.length > PICKUP_HARD_CAP) {
            this.compactPickupOverflow();
        }
        const pickupRadius = this.getPickupRadius();
        const removing: Pickup[] = [];
        for (const pickup of this.pickups) {
            pickup.age += dt;
            const dx = this.playerX - pickup.x;
            const dy = this.playerY - pickup.y;
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            if (dist < pickupRadius) {
                const pull = (pickupRadius - dist) / pickupRadius;
                const speed = 180 + Math.max(0, pull) * 520;
                pickup.x += (dx / dist) * speed * dt;
                pickup.y += (dy / dist) * speed * dt;
                pickup.node.setPosition(pickup.x, pickup.y, 5);
            }
            if (dist < this.playerRadius + pickup.radius + 8) {
                this.collectPickup(pickup);
                removing.push(pickup);
                if (this.phase !== 'combat') break;
            }
        }
        for (const pickup of removing) {
            this.removePickup(pickup);
        }
    }

    private updateRegen(dt: number) {
        const regen = this.getCharacterStats().hpRegen;
        if (regen <= 0 || this.playerHp <= 0 || this.playerHp >= this.playerMaxHp) return;
        this.regenTimer += dt;
        if (this.regenTimer >= 1) {
            this.regenTimer = 0;
            this.healPlayer(regen);
        }
    }

    private updateShield(dt: number) {
        const stats = this.getCharacterStats();
        this.playerShieldMax = this.getShieldMax();
        if (this.playerShieldMax <= 0) {
            this.playerShield = 0;
            return;
        }
        this.shieldRechargeDelay = Math.max(0, this.shieldRechargeDelay - dt);
        if (this.shieldRechargeDelay > 0 || this.playerShield >= this.playerShieldMax) return;
        this.playerShield = Math.min(this.playerShieldMax, this.playerShield + stats.shieldRegen * dt);
    }

    private startNextWave() {
        if (this.phase === 'combat' && this.waveIndex > 0 && !this.isBossWave()) {
            this.grantWaveClearAlloy();
        }
        this.waveIndex += 1;
        this.endlessCycle = Math.floor((this.waveIndex - 1) / WAVES_PER_CYCLE) + 1;
        this.waveElapsed = 0;
        this.cycleTime = 0;
        this.waveDuration = this.randomRange(WAVE_MIN_DURATION, WAVE_MAX_DURATION);
        this.waveSpawnTimer = 0.15;
        this.bossDefeatedThisWave = false;
        this.waveKillCount = 0;
        this.waveChestDrops = 0;
        this.currentWaveSpecs = this.getWaveEnemySpecs(this.waveIndex);

        if (this.isBossWave()) {
            this.bossSpawned = true;
            this.requestBgm('bgm_boss_loop');
            this.playSfx('sfx_boss_warning', 0.9, 1.2);
            this.spawnBoss();
            this.showToast(`第 ${this.waveIndex} 波：Boss 出现，击杀后才能进入下一波。`);
            return;
        }

        this.bossSpawned = false;
        this.requestBgm('bgm_combat_loop');
        this.showToast(`第 ${this.waveIndex} 波开始，${Math.round(this.waveDuration)} 秒内怪潮会持续涌入。`);
    }

    private grantWaveClearAlloy() {
        const baseReward = 8 + this.waveIndex + (this.endlessCycle - 1) * 4;
        const pressureBonus = Math.min(8, Math.floor(this.waveKillCount / 80));
        const reward = Math.round(baseReward + pressureBonus);
        this.battleAlloy += reward;
        this.showToast(`第 ${this.waveIndex} 波清算：补给合金 +${reward}`);
    }

    private spawnCurrentWaveBatch() {
        const ring = this.isBossWave() || this.waveIndex % 3 === 0;
        const count = this.getWaveSpawnBatchCount();
        const fallback = this.isBossWave() ? ENEMY_SPECS : this.getUnlockedEnemySpecs();
        this.spawnPack(count, ring, this.currentWaveSpecs, fallback);
    }

    private getWaveSpawnInterval() {
        const slot = this.getWaveSlot();
        return Math.max(0.95, 1.55 - slot * 0.035 - (this.endlessCycle - 1) * 0.06 - Math.min(0.12, this.waveElapsed / 420));
    }

    private getWaveSpawnBatchCount() {
        const slot = this.getWaveSlot();
        const pressure = 2 + Math.floor(slot * 0.45) + this.endlessCycle + Math.floor(this.waveElapsed / 24);
        const bossBonus = this.isBossWave() ? 3 : 0;
        return Math.min(22, pressure + bossBonus + this.randomInt(0, 2));
    }

    private getEnemyCap() {
        return Math.min(420, 110 + this.battleIndex * 3 + this.endlessCycle * 24 + this.waveIndex * 6);
    }

    private getWaveSlot(wave = this.waveIndex) {
        if (wave <= 0) return 1;
        return ((wave - 1) % WAVES_PER_CYCLE) + 1;
    }

    private isBossWave(wave = this.waveIndex) {
        return wave > 0 && wave % WAVES_PER_CYCLE === 0;
    }

    private spawnPack(count: number, ring: boolean, preferredSpecs: EnemySpec[] | null = null, fallbackSpecs: EnemySpec[] | null = null) {
        const cap = this.getEnemyCap();
        const room = Math.max(0, cap - this.enemies.length);
        const guaranteed = preferredSpecs ? preferredSpecs.length : 0;
        const total = Math.min(Math.max(count, guaranteed), room);
        const waveSpecs = preferredSpecs && preferredSpecs.length > 0
            ? preferredSpecs
            : this.pickEnemyWaveSpecs(total, ring, fallbackSpecs);
        const pool = fallbackSpecs && fallbackSpecs.length > 0 ? fallbackSpecs : this.getUnlockedEnemySpecs();
        for (let i = 0; i < total; i++) {
            const spec = waveSpecs.length > 0 && (i < waveSpecs.length || Math.random() < 0.72)
                ? waveSpecs[i % waveSpecs.length]
                : this.pickWeightedEnemySpec(pool);
            const angle = ring ? (Math.PI * 2 * i) / Math.max(1, total) + Math.random() * 0.16 : Math.random() * Math.PI * 2;
            const radius = ring ? 720 : this.randomRange(640, 840);
            const point = this.getSpawnPointAroundPlayer(radius, angle);
            const eliteChance = Math.min(0.28, 0.025 + this.endlessCycle * 0.018 + this.waveIndex * 0.0035 + this.combatTime * 0.00045);
            this.createEnemy(spec, point.x, point.y, Math.random() < eliteChance, false);
        }
    }

    private spawnBoss() {
        const spec: EnemySpec = {
            id: 'boss',
            name: '星核巨像',
            family: 'boss',
            artId: 'boss',
            hp: 680,
            speed: 64,
            damage: 22,
            radius: 42,
            xp: 45,
            alloyChance: 1,
            color: '#F94144',
            accent: '#7F1D1D',
            spawnAfter: 0,
            weight: 1,
        };
        const point = this.getSpawnPointAroundPlayer(760, Math.random() * Math.PI * 2);
        this.createEnemy(spec, point.x, point.y, true, true);
    }

    private getSpawnPointAroundPlayer(radius: number, angle: number): Vec2 {
        const padding = 92;
        for (let attempt = 0; attempt < 10; attempt++) {
            const tryAngle = angle + attempt * 0.61;
            const x = this.playerX + Math.cos(tryAngle) * radius;
            const y = this.playerY + Math.sin(tryAngle) * radius;
            if (x > WORLD_LEFT + padding && x < WORLD_RIGHT - padding && y > WORLD_BOTTOM + padding && y < WORLD_TOP - padding) {
                return new Vec2(x, y);
            }
        }
        return new Vec2(
            this.clamp(this.playerX + Math.cos(angle) * radius, WORLD_LEFT + padding, WORLD_RIGHT - padding),
            this.clamp(this.playerY + Math.sin(angle) * radius, WORLD_BOTTOM + padding, WORLD_TOP - padding),
        );
    }

    private createEnemy(spec: EnemySpec, x: number, y: number, elite: boolean, boss: boolean) {
        const scale = 1 + this.battleIndex * 0.06 + (this.endlessCycle - 1) * 0.28 + this.waveIndex * 0.028 + this.combatTime * 0.0018;
        const eliteScale = boss ? 6.4 + this.endlessCycle * 0.58 : elite ? 2.65 : 1;
        const hp = Math.round(spec.hp * scale * eliteScale);
        const enemyRadius = Math.round(spec.radius * (boss ? 1.55 : elite ? 1.32 : 1.18));
        const node = new Node(`Enemy_${spec.id}_${this.nextEnemyId}`);
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(x, y, 4);
        const visualMultiplier = ENEMY_VISUAL_SIZE_MULTIPLIER[boss ? 'boss' : spec.family] || 4.35;
        const enemyVisualSize = enemyRadius * visualMultiplier;
        const enemyNodeSize = Math.max(enemyRadius * 3.5, enemyVisualSize);
        node.addComponent(UITransform).setContentSize(enemyNodeSize, enemyNodeSize);
        const gfx = node.addComponent(Graphics);
        const animation = this.getEnemyAnimation(spec, boss);
        const sprite = animation
            ? this.addSpriteChild(node, 'EnemyArt', this.getEnemyAnimationFrameName(spec, boss), enemyVisualSize, enemyVisualSize)
            : this.addSpriteChild(node, 'EnemyArt', this.enemyArtName(spec, boss), enemyVisualSize, enemyVisualSize);
        if (sprite && animation) {
            sprite.spriteFrame = animation.frames[0];
            sprite.node.getComponent(UITransform)?.setContentSize(enemyVisualSize, enemyVisualSize);
        }
        const enemy: Enemy = {
            id: this.nextEnemyId++,
            spec,
            node,
            gfx,
            sprite,
            hp,
            maxHp: hp,
            speed: Math.max(42, spec.speed * (boss ? 0.78 : elite ? 0.9 : 1) + this.endlessCycle * 5 + this.waveIndex * 0.8),
            damage: spec.damage * (boss ? 1.85 : elite ? 1.42 : 1.05) * (1 + (this.endlessCycle - 1) * 0.16 + this.waveIndex * 0.012 + this.combatTime * 0.0009),
            radius: enemyRadius,
            visualRadius: Math.max(enemyRadius + 12, enemyVisualSize * 0.42),
            elite,
            boss,
            damageType: this.getEnemyDamageType(spec, boss),
            skillTimer: this.randomRange(0.8, 2.6),
            dashTimer: 0,
            dashVx: 0,
            dashVy: 0,
            armorTimer: 0,
            animSeed: Math.random() * Math.PI * 2,
            hitFlash: 0,
            visualStateKey: '',
            animation,
            animationFrameIndex: animation ? 0 : -1,
        };
        this.drawEnemy(enemy);
        this.enemies.push(enemy);
    }

    private getEnemyDamageType(spec: EnemySpec, boss: boolean): DamageType {
        if (boss) return 'magic';
        if (spec.id.indexOf('venom') >= 0 || spec.id.indexOf('acid') >= 0) return 'poison';
        if (spec.id.indexOf('arc') >= 0 || spec.family === 'warden') return 'lightning';
        if (spec.id.indexOf('crystal') >= 0) return 'ice';
        if (spec.id.indexOf('rage') >= 0) return 'fire';
        if (spec.id.indexOf('shade') >= 0 || spec.id.indexOf('prime') >= 0) return 'magic';
        return 'physical';
    }

    private pickEnemySpec(): EnemySpec {
        const available = this.getAvailableEnemySpecs();
        const totalWeight = available.reduce((sum, spec) => sum + spec.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const spec of available) {
            roll -= spec.weight;
            if (roll <= 0) return spec;
        }
        return available[0];
    }

    private pickEnemyWaveSpecs(count: number, ring: boolean, pool: EnemySpec[] | null = null) {
        const available = pool && pool.length > 0 ? pool : this.getAvailableEnemySpecs();
        const waveSize = Math.min(8, Math.max(3, Math.ceil(count / (ring ? 5 : 7))));
        const specs: EnemySpec[] = [];
        const families = BASE_ENEMY_ARCHETYPES
            .map((base) => base.family)
            .filter((family) => available.some((spec) => spec.family === family));

        for (let i = 0; i < waveSize; i++) {
            const family = families.length > 0 ? families[(this.killCount + this.endlessCycle + i) % families.length] : '';
            const familySpecs = available.filter((spec) => !family || spec.family === family);
            specs.push(this.pickWeightedEnemySpec(familySpecs.length > 0 ? familySpecs : available));
        }
        return specs;
    }

    private pickWeightedEnemySpec(pool: EnemySpec[]) {
        const totalWeight = pool.reduce((sum, spec) => sum + spec.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const spec of pool) {
            roll -= spec.weight;
            if (roll <= 0) return spec;
        }
        return pool[0];
    }

    private getAvailableEnemySpecs() {
        return this.getUnlockedEnemySpecs();
    }

    private getUnlockedEnemySpecs() {
        const slot = this.getWaveSlot();
        const wave = this.clamp(slot >= WAVES_PER_CYCLE ? ORDINARY_WAVES_PER_CYCLE : slot, 1, ORDINARY_WAVES_PER_CYCLE);
        const end = Math.floor((wave * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        return ENEMY_SPECS.slice(0, Math.max(1, end));
    }

    private getWaveEnemySpecs(wave: number) {
        const slot = this.getWaveSlot(wave);
        const ordinaryWave = this.clamp(slot >= WAVES_PER_CYCLE ? ORDINARY_WAVES_PER_CYCLE : slot, 1, ORDINARY_WAVES_PER_CYCLE);
        const start = Math.floor(((ordinaryWave - 1) * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        const end = Math.floor((ordinaryWave * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        return ENEMY_SPECS.slice(start, Math.max(start + 1, end));
    }

    private damageEnemy(enemy: Enemy, amount: number, color = '#F8FAFC', tag = '') {
        const finalAmount = enemy.armorTimer > 0 ? amount * (enemy.boss ? 0.58 : 0.72) : amount;
        const finalTag = enemy.armorTimer > 0 ? `${tag}霸体 ` : tag;
        this.spawnFloatingText(
            `${finalTag}${Math.ceil(finalAmount)}`,
            enemy.node.position.x + this.randomRange(-12, 12),
            enemy.node.position.y + enemy.radius + this.randomRange(8, 20),
            enemy.armorTimer > 0 ? '#CBD5E1' : color,
            finalTag ? 23 : 21,
        );
        enemy.hitFlash = ENEMY_HIT_FLASH_DURATION;
        this.playSfx('sfx_hit_enemy', enemy.boss ? 0.46 : 0.32, 0.035);
        enemy.hp -= finalAmount;
        if (enemy.hp <= 0) {
            this.killEnemy(enemy);
        } else {
            this.drawEnemy(enemy);
        }
    }

    private rollOutgoingDamage(enemy: Enemy, baseDamage: number) {
        const stats = this.getCharacterStats();
        const lethalRoll = Math.random() < stats.lethalChance;
        if (lethalRoll) {
            const lethalDamage = Math.max(baseDamage * stats.lethalDamage, enemy.maxHp * stats.lethalMaxHpPct);
            return { amount: lethalDamage, color: '#F59E0B', tag: '致命 ' };
        }
        if (Math.random() < stats.critChance) {
            return { amount: baseDamage * stats.critDamage, color: '#F9C74F', tag: '暴击 ' };
        }
        return { amount: baseDamage, color: '#F8FAFC', tag: '' };
    }

    private droneStrike(enemy: Enemy, dronePower: number) {
        const damage = 12 + dronePower * 3.4 + this.getActiveEquipmentLevel('reactor-core') * 2;
        const roll = this.rollOutgoingDamage(enemy, damage);
        this.droneHitPulse = 0.22;
        this.damageEnemy(enemy, roll.amount, roll.tag ? roll.color : '#90BE6D', roll.tag ? `无人机 ${roll.tag}` : '无人机 ');
        const origin = this.getDroneZapOrigin();
        this.drawZap(origin.x, origin.y, enemy.node.position.x, enemy.node.position.y);
    }

    private killEnemy(enemy: Enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index >= 0) this.enemies.splice(index, 1);
        const x = enemy.node.position.x;
        const y = enemy.node.position.y;
        this.playSfx(enemy.boss ? 'sfx_boss_die' : 'sfx_enemy_die', enemy.boss ? 0.82 : 0.45, enemy.boss ? 1.0 : 0.045);
        this.drawEnemyDeathBurst(x, y, enemy.radius, enemy.spec.color, enemy.elite || enemy.boss);
        enemy.node.destroy();
        this.killCount += 1;
        this.waveKillCount += 1;

        const xpDropChance = enemy.boss ? 1 : enemy.elite ? ELITE_XP_DROP_CHANCE : NORMAL_XP_DROP_CHANCE;
        if (Math.random() < xpDropChance) {
            const xpMultiplier = enemy.boss ? 3 : enemy.elite ? 2.4 : 2.1;
            this.dropPickup('xp', Math.max(1, Math.round(enemy.spec.xp * xpMultiplier)), x, y);
        }

        const normalAlloyChance = Math.min(0.32, enemy.spec.alloyChance * NORMAL_ALLOY_DROP_MULTIPLIER + this.waveIndex * 0.004);
        if (enemy.elite || enemy.boss || Math.random() < normalAlloyChance) {
            const alloyAmount = enemy.boss
                ? 18 + this.endlessCycle * 3
                : enemy.elite
                    ? 6 + Math.floor(this.endlessCycle / 2)
                    : this.randomInt(1, 2) + Math.floor(this.waveIndex / 10);
            this.dropPickup('alloy', alloyAmount, x + this.randomRange(-20, 20), y + this.randomRange(-20, 20));
        }
        if (Math.random() < (enemy.elite ? ELITE_MATERIAL_DROP_CHANCE : NORMAL_MATERIAL_DROP_CHANCE)) {
            const material: ResourceType = enemy.spec.family === 'brute' || enemy.spec.family === 'warden' ? 'circuits' : enemy.spec.family === 'runner' ? 'shards' : 'biomass';
            this.dropPickup(material, enemy.elite ? this.randomInt(2, 4) : 1, x + this.randomRange(-18, 18), y + this.randomRange(-18, 18));
        }
        if (enemy.elite && Math.random() < 0.18) {
            this.dropPickup('cores', 1, x + this.randomRange(-16, 16), y + this.randomRange(-16, 16));
        }
        if (!enemy.boss && !this.isBossWave() && enemy.elite && Math.random() < 0.055) {
            const chestType: ChestPickupType = Math.random() < 0.14 ? 'chest-rare' : 'chest-common';
            this.tryDropChest(chestType, x + this.randomRange(-14, 14), y + this.randomRange(-14, 14));
        }
        if (enemy.boss) {
            this.dropPickup('cores', 1 + Math.floor(this.endlessCycle / 3), x, y);
            this.dropPickup('shards', 7 + this.endlessCycle * 2, x + 18, y + 8);
            this.dropPickup('crystals', 1 + Math.floor(this.endlessCycle / 2), x - 18, y + 8);
            this.dropPickup('alloy', 18 + this.endlessCycle * 4, x + 4, y + 36);
            this.tryDropChest('chest-rare', x, y + 32);
            this.bossKills += 1;
            this.bossDefeatedThisWave = true;
            this.bossSpawned = false;
            this.requestBgm('bgm_combat_loop');
            this.showToast(`第 ${this.waveIndex} 波 Boss 已击杀，撑到本波结束进入下一波。`);
        }
        if (this.shouldEnemyExplodeOnDeath(enemy)) {
            this.enemyExplode(x, y, enemy.radius * (enemy.boss ? 3.2 : enemy.elite ? 2.45 : 2.15), enemy.damage * (enemy.boss ? 1.5 : 1.05), enemy.damageType);
        }
        if (enemy.spec.family === 'splitter' && !enemy.elite && !enemy.boss) {
            const room = Math.max(0, this.getEnemyCap() - this.enemies.length);
            const children = Math.min(2, room);
            for (let i = 0; i < children; i++) {
                this.createEnemy(ENEMY_SPECS[0], x + this.randomRange(-34, 34), y + this.randomRange(-34, 34), false, false);
            }
        }

        const chip = this.getActiveEquipmentLevel('vampire-chip');
        if (chip > 0) {
            this.healPlayer(0.8 + chip * 0.35);
        }
    }

    private drawEnemyDeathBurst(x: number, y: number, radius: number, color: string, rare: boolean) {
        const rings = rare ? 3 : 2;
        for (let i = 0; i < rings; i++) {
            const ringRadius = radius * (1.15 + i * 0.45);
            this.scheduleOnce(() => this.drawAreaPulse(x, y, ringRadius, color), i * 0.035);
        }
    }

    private tryDropChest(type: ChestPickupType, x: number, y: number) {
        if (this.waveChestDrops >= MAX_CHESTS_PER_WAVE) return false;
        this.waveChestDrops += 1;
        this.dropPickup(type, 1, x, y);
        return true;
    }

    private shouldEnemyExplodeOnDeath(enemy: Enemy) {
        return enemy.boss
            || enemy.spec.family === 'splitter'
            || enemy.spec.variantId === 'rage'
            || enemy.spec.variantId === 'acid'
            || enemy.spec.variantId === 'venom'
            || enemy.spec.variantId === 'prime';
    }

    private enemyExplode(x: number, y: number, radius: number, damage: number, damageType: DamageType) {
        this.drawAreaPulse(x, y, radius, this.getDamageTypeColor(damageType));
        const distSq = this.distanceSq(x, y, this.playerX, this.playerY);
        const hitRadius = radius + this.playerRadius;
        if (distSq <= hitRadius * hitRadius && this.invulnerableTimer <= 0) {
            const dist = Math.sqrt(Math.max(0.001, distSq));
            const falloff = this.clamp(1 - dist / Math.max(1, hitRadius), 0.28, 1);
            this.takeDamage(damage * falloff, damageType);
        }
    }

    private drawAreaPulse(x: number, y: number, radius: number, color: string) {
        if (!this.worldNode) return;
        const node = new Node('EnemyAreaPulse');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode.addChild(node);
        node.setPosition(x, y, 8);
        const gfx = node.addComponent(Graphics);
        gfx.fillColor = this.hex(color, 35);
        gfx.circle(0, 0, radius);
        gfx.fill();
        gfx.strokeColor = this.hex(color, 210);
        gfx.lineWidth = 4;
        gfx.circle(0, 0, radius);
        gfx.stroke();
        this.scheduleOnce(() => node.destroy(), 0.16);
    }

    private takeDamage(amount: number, type: DamageType = 'physical') {
        const stats = this.getCharacterStats();
        if (Math.random() < stats.dodgeChance) {
            this.invulnerableTimer = 0.18;
            this.spawnFloatingText('闪避', this.playerX, this.playerY + this.playerRadius + 28, '#4CC9F0', 24);
            return;
        }

        const defense = this.getDefenseAgainst(type, stats);
        const defenseRatio = 100 / (100 + Math.max(-45, defense));
        let damage = Math.max(1, amount * defenseRatio * (1 - stats.damageReduction));
        const shieldDamage = Math.min(this.playerShield, damage);
        if (shieldDamage > 0) {
            this.playerShield -= shieldDamage;
            damage -= shieldDamage;
            this.spawnFloatingText(`护盾 -${Math.ceil(shieldDamage)}`, this.playerX, this.playerY + this.playerRadius + 42, '#4CC9F0', 20);
        }
        if (damage > 0) {
            this.playerHp = Math.max(0, this.playerHp - damage);
            this.playSfx('sfx_player_hit', 0.65, 0.28);
            this.spawnFloatingText(`-${Math.ceil(damage)}`, this.playerX, this.playerY + this.playerRadius + 28, '#F94144', 25);
            this.showToast(`受击 -${Math.ceil(damage)}，拉开距离。`);
        }
        this.invulnerableTimer = 0.42;
        this.shieldRechargeDelay = 1.6;
    }

    private getDefenseAgainst(type: DamageType, stats: CharacterStats) {
        switch (type) {
            case 'magic':
                return stats.magicDefense;
            case 'fire':
                return stats.magicDefense * 0.35 + stats.fireDefense;
            case 'lightning':
                return stats.magicDefense * 0.35 + stats.lightningDefense;
            case 'poison':
                return stats.magicDefense * 0.25 + stats.poisonDefense;
            case 'ice':
                return stats.magicDefense * 0.35 + stats.iceDefense;
            case 'physical':
            default:
                return stats.physicalDefense;
        }
    }

    private getDamageTypeColor(type: DamageType) {
        switch (type) {
            case 'magic': return '#B5179E';
            case 'fire': return '#F3722C';
            case 'lightning': return '#4CC9F0';
            case 'poison': return '#84CC16';
            case 'ice': return '#A7F3D0';
            case 'physical':
            default:
                return '#CBD5E1';
        }
    }

    private healPlayer(amount: number) {
        const before = this.playerHp;
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + amount);
        const healed = this.playerHp - before;
        if (healed > 0.05) {
            this.spawnFloatingText(`+${Math.ceil(healed)}`, this.playerX, this.playerY + this.playerRadius + 34, '#43AA8B', 23);
        }
    }

    private dropPickup(type: PickupType, amount: number, x: number, y: number) {
        const chest = this.isChestPickup(type);
        const pickupAmount = type === 'xp' || chest ? amount : this.scaleResourceAmount(amount);
        if (!chest) {
            const nearbyPickup = this.findMergeablePickup(type, x, y, PICKUP_MERGE_RADIUS);
            if (nearbyPickup) {
                this.addAmountToPickup(nearbyPickup, pickupAmount, x, y);
                return;
            }
            if (this.pickups.length >= PICKUP_SOFT_CAP) {
                this.compactPickupOverflow();
                const widerPickup = this.findMergeablePickup(type, x, y, PICKUP_COMPACT_RADIUS);
                if (widerPickup) {
                    this.addAmountToPickup(widerPickup, pickupAmount, x, y);
                    return;
                }
            }
        }

        const node = new Node(`Pickup_${type}`);
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(x, y, 5);
        node.addComponent(UITransform).setContentSize(chest ? 38 : 28, chest ? 34 : 28);
        const gfx = node.addComponent(Graphics);
        const sprite = this.addSpriteChild(node, 'PickupArt', this.pickupArtName(type), type === 'xp' ? 30 : 34, type === 'xp' ? 30 : 34);
        const pickup: Pickup = {
            node,
            gfx,
            sprite,
            type,
            amount: pickupAmount,
            x,
            y,
            radius: this.getPickupVisualRadius(type, pickupAmount),
            age: 0,
        };
        this.drawPickup(pickup);
        this.pickups.push(pickup);
        if (this.pickups.length > PICKUP_HARD_CAP) {
            this.compactPickupOverflow();
        }
    }

    private findMergeablePickup(type: PickupType, x: number, y: number, radius: number, exclude: Pickup | null = null) {
        if (this.isChestPickup(type)) return null;
        let bestPickup: Pickup | null = null;
        let bestDistSq = radius * radius;
        for (const pickup of this.pickups) {
            if (pickup === exclude || pickup.type !== type || this.isChestPickup(pickup.type)) continue;
            const dx = pickup.x - x;
            const dy = pickup.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= bestDistSq) {
                bestDistSq = distSq;
                bestPickup = pickup;
            }
        }
        return bestPickup;
    }

    private addAmountToPickup(pickup: Pickup, amount: number, x: number, y: number) {
        const nextAmount = pickup.amount + amount;
        const weight = this.clamp(amount / Math.max(1, nextAmount), 0.08, 0.42);
        pickup.x = pickup.x * (1 - weight) + x * weight;
        pickup.y = pickup.y * (1 - weight) + y * weight;
        pickup.amount = nextAmount;
        pickup.radius = this.getPickupVisualRadius(pickup.type, nextAmount);
        pickup.age = Math.min(pickup.age, 18);
        pickup.node.setPosition(pickup.x, pickup.y, 5);
        const transform = pickup.node.getComponent(UITransform);
        if (transform) {
            const size = pickup.radius * 2 + 16;
            transform.setContentSize(size, size);
        }
        this.drawPickup(pickup);
    }

    private absorbPickupInto(source: Pickup, target: Pickup) {
        if (source === target) return;
        this.addAmountToPickup(target, source.amount, source.x, source.y);
        const index = this.pickups.indexOf(source);
        if (index >= 0) this.pickups.splice(index, 1);
        source.node.destroy();
    }

    private compactPickupOverflow() {
        if (this.pickups.length <= PICKUP_SOFT_CAP) return;

        let overflow = this.pickups.length - PICKUP_SOFT_CAP;
        const ordinaryPickups = this.pickups
            .filter((pickup) => !this.isChestPickup(pickup.type))
            .sort((a, b) => b.age - a.age);

        for (const source of ordinaryPickups) {
            if (overflow <= 0) break;
            if (this.pickups.indexOf(source) < 0) continue;
            const target = this.findMergeablePickup(source.type, source.x, source.y, PICKUP_COMPACT_RADIUS, source);
            if (!target) continue;
            this.absorbPickupInto(source, target);
            overflow -= 1;
        }

        if (this.pickups.length <= PICKUP_HARD_CAP) return;

        const forcedPickups = this.pickups
            .filter((pickup) => !this.isChestPickup(pickup.type))
            .sort((a, b) => b.age - a.age);
        for (const source of forcedPickups) {
            if (this.pickups.length <= PICKUP_HARD_CAP) break;
            if (this.pickups.indexOf(source) < 0) continue;
            const target = this.findMergeablePickup(source.type, source.x, source.y, 99999, source);
            if (target) this.absorbPickupInto(source, target);
        }
    }

    private getPickupVisualRadius(type: PickupType, amount: number) {
        if (this.isChestPickup(type)) return 14;
        const stackBonus = Math.log2(Math.max(1, Math.abs(amount))) * (type === 'xp' ? 0.65 : 1);
        return type === 'xp'
            ? Math.min(16, 8 + stackBonus)
            : Math.min(20, 10 + stackBonus);
    }

    private collectPickup(pickup: Pickup) {
        if (pickup.type === 'xp') {
            this.playSfx('sfx_pickup', 0.22, 0.09);
            this.gainXp(pickup.amount);
        } else if (this.isChestPickup(pickup.type)) {
            if (this.phase !== 'combat') return;
            this.playSfx('sfx_chest_open', 0.7, 0.35);
            this.openItemChoices(pickup.type === 'chest-rare' ? 'rare' : 'common');
        } else {
            this.playSfx('sfx_pickup', pickup.type === 'cores' || pickup.type === 'crystals' ? 0.52 : 0.32, 0.08);
            this.addBattleResource(pickup.type, pickup.amount);
            if (pickup.type === 'cores' || pickup.type === 'crystals') {
                const resource = this.getResourceDef(pickup.type);
                this.showToast(`获得${resource.name}，撤离后可用于高阶升级。`);
            }
        }
    }

    private gainXp(amount: number) {
        this.xp += amount * (1 + this.getCharacterStats().xpGain);
        while (this.xp >= this.xpToNext && this.phase === 'combat') {
            this.xp -= this.xpToNext;
            this.level += 1;
            this.xpToNext = Math.round(this.xpToNext * 1.24 + 22 + this.level * 5);
            this.playSfx('sfx_level_up', 0.78, 0.45);
            this.openLevelChoices();
        }
    }

    private openLevelChoices() {
        this.phase = 'level-up';
        this.pendingLevelChoices = this.pickLevelChoices();
        this.renderChoicePanel(
            `角色 Lv.${this.level} 属性成长`,
            `选择 1 项自身属性成长。刷新消耗 ${LEVEL_REFRESH_COST} 合金。`,
            this.pendingLevelChoices,
            LEVEL_REFRESH_COST,
        );
    }

    private openItemChoices(quality: ItemChoiceQuality, refreshed = false) {
        this.phase = 'item-choice';
        this.currentItemChoiceQuality = quality;
        this.pendingItemChoices = this.pickItemChoices(quality);
        const title = quality === 'rare' ? '高级宝箱' : '普通宝箱';
        const hint = quality === 'rare'
            ? `选择 1 件高级本局道具。刷新消耗 ${CHEST_REFRESH_COST} 合金。`
            : `选择 1 件普通本局道具。刷新消耗 ${CHEST_REFRESH_COST} 合金。`;
        this.renderChoicePanel(title, hint, this.pendingItemChoices, CHEST_REFRESH_COST);
        if (!refreshed) this.showToast(`${title}开启，选择一件道具。`);
    }

    private renderChoicePanel(title: string, hint: string, choices: LevelUpgrade[], refreshCost: number) {
        if (this.levelPanel) this.levelPanel.active = true;
        if (this.levelPanelShadow) this.levelPanelShadow.active = true;
        if (this.levelTitleLabel) this.levelTitleLabel.string = title;
        if (this.levelHintLabel) this.levelHintLabel.string = hint;
        this.levelChoiceButtons.forEach((button, index) => {
            const choice = choices[index];
            button.node.active = !!choice;
            if (!choice) return;
            button.color = choice.color;
            button.label.string = `${choice.category}｜${choice.name}\n${choice.desc}`;
            this.drawButton(button, false);
        });
        if (this.levelRefreshButton) {
            this.levelRefreshButton.node.active = true;
            this.levelRefreshButton.label.string = `刷新 -${refreshCost}合金`;
            this.drawButton(this.levelRefreshButton, this.getSpendableAlloy() < refreshCost);
        }
    }

    private choosePanelChoice(index: number) {
        if (this.phase === 'level-up') {
            this.chooseLevelUpgrade(index);
        } else if (this.phase === 'item-choice') {
            this.chooseRunItem(index);
        }
    }

    private chooseLevelUpgrade(index: number) {
        if (this.phase !== 'level-up') return;
        const choice = this.pendingLevelChoices[index];
        if (!choice) return;
        this.applyLevelUpgrade(choice.id);
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        this.resumeCombatAfterChoice();
        this.showToast(`属性成长：${choice.name}`);
    }

    private chooseRunItem(index: number) {
        if (this.phase !== 'item-choice') return;
        const choice = this.pendingItemChoices[index];
        if (!choice) return;
        this.applyRunItem(choice.id);
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        this.resumeCombatAfterChoice();
        this.showToast(`获得本局道具：${choice.name}`);
    }

    private resumeCombatAfterChoice() {
        this.phase = 'combat';
        if (this.xp >= this.xpToNext) {
            this.openLevelChoices();
        }
    }

    private applyLevelUpgrade(id: string) {
        const upgrade = LEVEL_UPGRADES.find((item) => item.id === id);
        if (!upgrade) return;
        this.acquiredStatUpgradeIds.add(id);
        this.applyStatEffects(upgrade.effects);
    }

    private applyRunItem(id: string) {
        const item = RUN_ITEMS.find((upgrade) => upgrade.id === id);
        if (!item) return;
        this.acquiredRunItemIds.add(id);
        this.applyStatEffects(item.effects);
    }

    private refreshCurrentChoices() {
        if (this.phase === 'level-up') {
            if (!this.spendRunAlloy(LEVEL_REFRESH_COST)) {
                this.showToast(`合金不足，刷新需要 ${LEVEL_REFRESH_COST}。`);
                return;
            }
            this.pendingLevelChoices = this.pickLevelChoices();
            this.renderChoicePanel(
                `角色 Lv.${this.level} 属性成长`,
                `选择 1 项自身属性成长。刷新消耗 ${LEVEL_REFRESH_COST} 合金。`,
                this.pendingLevelChoices,
                LEVEL_REFRESH_COST,
            );
            this.showToast('属性成长选项已刷新。');
            return;
        }

        if (this.phase === 'item-choice') {
            if (!this.spendRunAlloy(CHEST_REFRESH_COST)) {
                this.showToast(`合金不足，刷新需要 ${CHEST_REFRESH_COST}。`);
                return;
            }
            this.openItemChoices(this.currentItemChoiceQuality, true);
            this.showToast('宝箱选项已刷新。');
        }
    }

    private applyStatEffects(effects: StatEffect[]) {
        const hpBefore = this.getMaxHp();
        const shieldBefore = this.getShieldMax();
        for (const effect of effects) {
            this.runStats[effect.stat] += effect.amount;
        }
        this.playerMaxHp = this.getMaxHp();
        this.playerShieldMax = this.getShieldMax();
        const hpDelta = this.playerMaxHp - hpBefore;
        const shieldDelta = this.playerShieldMax - shieldBefore;
        if (hpDelta > 0) this.playerHp += hpDelta * 0.65;
        if (shieldDelta > 0) this.playerShield += shieldDelta * 0.55;
        this.playerHp = this.clamp(this.playerHp, 1, this.playerMaxHp);
        this.playerShield = this.clamp(this.playerShield, 0, this.playerShieldMax);
    }

    private extractBattle() {
        if (this.phase !== 'combat') return;
        this.finishBattle('extract');
    }

    private finishBattle(reason: BattleEndReason) {
        if (this.phase !== 'combat') return;
        const reward = this.calculateEndlessReward(reason);
        this.battleAlloy = 0;
        this.addWalletToInventory(reward);
        this.battlesWon += 1;
        this.saveProgress();
        this.clearWorld();
        this.openSettlement(reason, reward);
    }

    private openSettlement(reason: BattleEndReason, reward: ResourceWallet) {
        this.phase = 'hangar';
        this.requestBgm('bgm_hangar');
        this.setCombatHudControlsActive(false);
        this.setMenuPanelActive(false);
        if (this.pausePanel) this.pausePanel.active = false;
        if (this.pausePanelShadow) this.pausePanelShadow.active = false;
        if (this.hangarPanel) this.hangarPanel.active = true;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = true;
        this.setShopPanelActive(false);
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        if (this.hangarTitleLabel) this.hangarTitleLabel.string = reason === 'extract' ? '撤离成功' : '机体损毁';
        if (this.hangarStatsLabel) {
            this.hangarStatsLabel.string = [
                `存活 ${this.formatTime(this.combatTime)}  Boss ${this.bossKills}  击杀 ${this.killCount}`,
                `本次带回：${this.formatWallet(reward)}`,
                `库存：${this.formatWallet(this.getInventoryWallet())}`,
            ].join('\n');
        }

        this.lootButtons.forEach((button) => button.node.active = false);
        this.setHangarControlsActive(true);
        if (this.startButton) this.startButton.node.active = true;
        if (this.hangarTipLabel) this.hangarTipLabel.string = reason === 'extract'
            ? '主动撤离保留全部结算奖励。调整装备后可继续无尽出击。'
            : '死亡会折损部分时间奖励。升级装备后再试一次。';
        this.refreshEquipmentButtons();
        this.refreshHud();
    }

    private openShop() {
        if (this.phase !== 'combat') return;
        this.phase = 'shop';
        this.touchActive = false;
        this.touchVector.set(0, 0);
        this.updateJoystickView();
        this.ensureShopOffers();
        this.setShopPanelActive(true);
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        this.renderShop();
        this.showToast('战场商店已打开，购买或刷新单个格子。');
    }

    private buyShopItem(index: number) {
        if (this.phase !== 'shop') return;
        const item = this.shopOffers[index];
        if (!item) return;
        const cost = this.getShopItemCost(item);
        if (!this.spendRunAlloy(cost)) {
            this.showToast(`合金不足，需要 ${cost}。`);
            return;
        }
        this.applyRunItem(item.id);
        this.shopOffers[index] = this.pickShopOfferForSlot(index);
        this.renderShop();
        this.showToast(`购买本局道具：${item.name}，该格已补货。`);
    }

    private refreshShopSlot(index: number) {
        if (this.phase !== 'shop') return;
        if (!this.spendRunAlloy(SHOP_REFRESH_COST)) {
            this.showToast(`合金不足，刷新需要 ${SHOP_REFRESH_COST}。`);
            return;
        }
        this.shopOffers[index] = this.pickShopOfferForSlot(index);
        this.renderShop();
        this.showToast('该格商品已刷新。');
    }

    private closeShop() {
        if (this.phase !== 'shop') return;
        this.setShopPanelActive(false);
        this.phase = 'combat';
        this.showToast('商店离开，战斗继续。');
    }

    private renderShop() {
        if (this.shopTitleLabel) this.shopTitleLabel.string = `战场商店  ${this.formatTime(this.combatTime)}`;
        if (this.shopTipLabel) {
            this.shopTipLabel.string = `可用合金 ${this.getSpendableAlloy()}。购买后自动补货；单格刷新 -${SHOP_REFRESH_COST} 合金。`;
        }
        this.shopButtons.forEach((button, index) => {
            const item = this.shopOffers[index];
            button.node.active = !!item;
            if (!item) return;
            const cost = this.getShopItemCost(item);
            button.color = item.color;
            button.label.string = `${item.category} T${item.tier}  合金${cost}\n${item.name}\n${item.desc}`;
            this.drawButton(button, this.getSpendableAlloy() < cost);
        });
        this.shopSlotRefreshButtons.forEach((button) => {
            button.label.string = `刷新此格 -${SHOP_REFRESH_COST}`;
            this.drawButton(button, this.getSpendableAlloy() < SHOP_REFRESH_COST);
        });
        if (this.shopCloseButton) {
            this.shopCloseButton.label.string = '继续战斗';
            this.drawButton(this.shopCloseButton, false);
        }
    }

    private setShopPanelActive(active: boolean) {
        if (this.shopPanel) this.shopPanel.active = active;
        if (this.shopPanelShadow) this.shopPanelShadow.active = active;
    }

    private pauseCombat() {
        if (this.phase !== 'combat') return;
        this.phaseBeforePause = this.phase;
        this.phase = 'paused';
        this.touchActive = false;
        this.touchVector.set(0, 0);
        this.updateJoystickView();
        if (this.pausePanel) this.pausePanel.active = true;
        if (this.pausePanelShadow) this.pausePanelShadow.active = true;
        this.showToast('');
    }

    private resumeFromPause() {
        if (this.phase !== 'paused') return;
        this.phase = this.phaseBeforePause === 'combat' ? 'combat' : 'combat';
        if (this.pausePanel) this.pausePanel.active = false;
        if (this.pausePanelShadow) this.pausePanelShadow.active = false;
        if (this.settingsPanel) this.settingsPanel.active = false;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = false;
        if (this.infoPanel) this.infoPanel.active = false;
        if (this.infoPanelShadow) this.infoPanelShadow.active = false;
        this.requestPhaseBgm();
        this.showToast('战斗继续。');
    }

    private returnToHangarFromPause() {
        if (this.phase !== 'paused') return;
        this.clearWorld();
        this.setAllOverlayPanelsActive(false);
        this.showHangar('已返回机库，可调整装备后重新出击。');
    }

    private openSettingsPanel() {
        if (this.phase === 'combat') this.pauseCombat();
        if (this.settingsPanel) this.settingsPanel.active = true;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = true;
        this.refreshSettingsPanel();
    }

    private closeSettingsPanel() {
        if (this.settingsPanel) this.settingsPanel.active = false;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = false;
    }

    private toggleBgm() {
        this.bgmVolume = this.bgmVolume > 0 ? 0 : 0.34;
        if (this.bgmSource) this.bgmSource.volume = this.bgmVolume;
        this.refreshSettingsPanel();
    }

    private toggleSfx() {
        this.sfxVolume = this.sfxVolume > 0 ? 0 : 0.72;
        this.refreshSettingsPanel();
    }

    private refreshSettingsPanel() {
        if (this.settingsBodyLabel) {
            this.settingsBodyLabel.string = `音乐：${this.bgmVolume > 0 ? '开启' : '关闭'}\n音效：${this.sfxVolume > 0 ? '开启' : '关闭'}`;
        }
        if (this.bgmToggleButton) {
            this.bgmToggleButton.label.string = this.bgmVolume > 0 ? '关闭音乐' : '开启音乐';
            this.drawButton(this.bgmToggleButton, false);
        }
        if (this.sfxToggleButton) {
            this.sfxToggleButton.label.string = this.sfxVolume > 0 ? '关闭音效' : '开启音效';
            this.drawButton(this.sfxToggleButton, false);
        }
    }

    private openHowToPanel() {
        this.openInfoPanel('玩法说明', [
            '左手滑动移动，武器会自动攻击最近敌人。',
            '拾取经验晶体升级，选择属性成长。',
            '击败精英和 Boss 可获得更多材料。',
            '撑不住时点击撤离，带回本局资源。',
            '机库可更换武器和装备，强化后再次出击。',
        ].join('\n'));
    }

    private openPrivacyPanel() {
        this.openInfoPanel('隐私与适龄', [
            '适龄提示：12+。',
            '本测试版仅使用本地存档，不采集通讯录、定位等敏感信息。',
            '后续接入排行榜、广告或防沉迷时，将补充正式隐私政策链接。',
            '健康游戏忠告：合理安排时间，享受健康生活。',
        ].join('\n'));
    }

    private openInfoPanel(title: string, body: string) {
        if (this.phase === 'combat') this.pauseCombat();
        if (this.infoTitleLabel) this.infoTitleLabel.string = title;
        if (this.infoBodyLabel) this.infoBodyLabel.string = body;
        if (this.infoPanel) this.infoPanel.active = true;
        if (this.infoPanelShadow) this.infoPanelShadow.active = true;
    }

    private closeInfoPanel() {
        if (this.infoPanel) this.infoPanel.active = false;
        if (this.infoPanelShadow) this.infoPanelShadow.active = false;
    }

    private calculateEndlessReward(reason: BattleEndReason): ResourceWallet {
        const reward = this.getBattleWallet();
        reward.alloy = 0;
        reward.shards += Math.floor(this.combatTime / 48 + this.killCount / 78 + this.bossKills * 5);
        reward.biomass += Math.floor(this.combatTime / 56 + this.killCount / 66 + this.bossKills * 2);
        reward.circuits += Math.floor(this.combatTime / 70 + this.killCount / 98 + this.bossKills * 3);
        reward.cores += this.bossKills;
        reward.crystals += Math.floor(this.bossKills / 2);

        const multiplier = this.getResourceMultiplier();
        for (const resource of RESOURCE_DEFS) {
            if (resource.id === 'alloy') continue;
            reward[resource.id] = Math.max(0, Math.floor(reward[resource.id] * multiplier));
        }

        if (reason === 'death') {
            for (const resource of RESOURCE_DEFS) {
                if (resource.id === 'alloy') continue;
                reward[resource.id] = Math.max(0, Math.floor(reward[resource.id] * 0.68));
            }
        }

        return reward;
    }

    private getResourceMultiplier() {
        return Math.max(0.25, 1 + this.getCharacterStats().resourceGain);
    }

    private scaleResourceAmount(amount: number) {
        const scaled = amount * this.getResourceMultiplier();
        const whole = Math.floor(scaled);
        return Math.max(1, whole + (Math.random() < scaled - whole ? 1 : 0));
    }

    private getSpendableAlloy() {
        return Math.max(0, this.battleAlloy);
    }

    private spendRunAlloy(cost: number) {
        const amount = Math.max(0, Math.floor(cost));
        if (this.getSpendableAlloy() < amount) return false;
        this.battleAlloy -= amount;
        this.refreshHud();
        return true;
    }

    private getBattleWallet(): ResourceWallet {
        return {
            alloy: this.battleAlloy,
            cores: this.battleCores,
            shards: this.battleShards,
            biomass: this.battleBiomass,
            circuits: this.battleCircuits,
            crystals: this.battleCrystals,
        };
    }

    private getInventoryWallet(): ResourceWallet {
        return {
            alloy: 0,
            cores: this.cores,
            shards: this.shards,
            biomass: this.biomass,
            circuits: this.circuits,
            crystals: this.crystals,
        };
    }

    private addBattleResource(type: ResourceType, amount: number) {
        const value = Math.max(0, Math.floor(amount));
        switch (type) {
            case 'alloy':
                this.battleAlloy += value;
                break;
            case 'cores':
                this.battleCores += value;
                break;
            case 'shards':
                this.battleShards += value;
                break;
            case 'biomass':
                this.battleBiomass += value;
                break;
            case 'circuits':
                this.battleCircuits += value;
                break;
            case 'crystals':
                this.battleCrystals += value;
                break;
            default:
                break;
        }
    }

    private addWalletToInventory(wallet: ResourceWallet) {
        this.cores += wallet.cores;
        this.shards += wallet.shards;
        this.biomass += wallet.biomass;
        this.circuits += wallet.circuits;
        this.crystals += wallet.crystals;
    }

    private getResourceDef(type: ResourceType) {
        for (const resource of RESOURCE_DEFS) {
            if (resource.id === type) return resource;
        }
        return RESOURCE_DEFS[0];
    }

    private formatWallet(wallet: ResourceWallet) {
        const parts = RESOURCE_DEFS
            .filter((resource) => wallet[resource.id] > 0)
            .map((resource) => `${resource.shortName} ${wallet[resource.id]}`);
        return parts.length > 0 ? parts.join('  ') : '无';
    }

    private formatTime(seconds: number) {
        const whole = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(whole / 60);
        const remain = whole % 60;
        return `${minutes}:${remain < 10 ? '0' : ''}${remain}`;
    }

    private chooseLoot(index: number) {
        if (this.phase !== 'loot') return;
        const choice = this.pendingLootChoices[index];
        if (!choice) return;
        choice.apply();
        this.saveProgress();
        this.showHangar(`战利品已获取：${choice.title}`);
    }

    private showHangar(message: string) {
        this.phase = 'hangar';
        this.requestBgm('bgm_hangar');
        this.setMenuPanelActive(false);
        if (this.pausePanel) this.pausePanel.active = false;
        if (this.pausePanelShadow) this.pausePanelShadow.active = false;
        if (this.settingsPanel) this.settingsPanel.active = false;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = false;
        if (this.infoPanel) this.infoPanel.active = false;
        if (this.infoPanelShadow) this.infoPanelShadow.active = false;
        if (this.hangarPanel) this.hangarPanel.active = true;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = true;
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        this.setShopPanelActive(false);
        this.setCombatHudControlsActive(false);
        this.lootButtons.forEach((button) => button.node.active = false);
        this.setHangarControlsActive(true);
        if (this.startButton) {
            this.startButton.node.active = true;
            this.startButton.label.string = `开始第 ${this.battlesWon + 1} 次出击`;
        }
        if (this.hangarTitleLabel) this.hangarTitleLabel.string = '机库整备';
        if (this.hangarTipLabel) this.hangarTipLabel.string = message;
        this.refreshEquipmentButtons();
        this.refreshHud();
    }

    private createLootChoices(): LootChoice[] {
        const choices: LootChoice[] = [];
        const locked = this.shuffle(EQUIPMENT.filter((equipment) => !this.ownedEquipment.has(equipment.id)));
        if (locked.length > 0) {
            const unlock = locked[0];
            choices.push({
                title: `新装备：${unlock.name}`,
                desc: unlock.desc,
                color: unlock.color,
                apply: () => {
                    this.ownedEquipment.add(unlock.id);
                    this.equipmentLevels[unlock.id] = Math.max(1, this.getEquipmentLevel(unlock.id));
                },
            });
        }

        const owned = this.shuffle(EQUIPMENT.filter((equipment) => this.ownedEquipment.has(equipment.id) && this.getEquipmentLevel(equipment.id) < equipment.maxLevel));
        for (const equipment of owned.slice(0, 2)) {
            choices.push({
                title: `强化：${equipment.name}`,
                desc: `免费升 1 级。${equipment.desc}`,
                color: equipment.color,
                apply: () => {
                    this.equipmentLevels[equipment.id] = Math.min(equipment.maxLevel, this.getEquipmentLevel(equipment.id) + 1);
                },
            });
        }

        choices.push({
            title: '资源箱',
            desc: '立刻获得装备碎片、生体样本、电路板和 1 核心。',
            color: '#43AA8B',
            apply: () => {
                this.shards += 8 + this.battleIndex * 2;
                this.biomass += 5 + this.battleIndex;
                this.circuits += 4 + Math.floor(this.battleIndex / 2);
                this.cores += 1;
            },
        });

        while (choices.length < 3) {
            const equipment = owned[choices.length % Math.max(1, owned.length)] || EQUIPMENT[0];
            choices.push({
                title: `校准：${equipment.name}`,
                desc: '免费升 1 级，若已满级则转化为装备碎片和核心。',
                color: equipment.color,
                apply: () => {
                    if (this.getEquipmentLevel(equipment.id) < equipment.maxLevel) {
                        this.equipmentLevels[equipment.id] = this.getEquipmentLevel(equipment.id) + 1;
                    } else {
                        this.shards += 10;
                        this.cores += 1;
                    }
                },
            });
        }

        return this.shuffle(choices).slice(0, 3);
    }

    private setHangarControlsActive(active: boolean) {
        this.equippedButtons.forEach((button) => button.node.active = active);
        this.equipmentButtons.forEach((button) => button.node.active = active);
        if (this.prevEquipmentButton) this.prevEquipmentButton.node.active = active;
        if (this.nextEquipmentButton) this.nextEquipmentButton.node.active = active;
        if (this.equipActionButton) this.equipActionButton.node.active = active;
        if (this.upgradeActionButton) this.upgradeActionButton.node.active = active;
        if (this.hangarBackButton) this.hangarBackButton.node.active = active;
        if (this.equipmentDetailLabel) this.equipmentDetailLabel.node.active = active;
    }

    private selectVisibleEquipment(index: number) {
        const equipment = this.visibleHangarEquipment[index];
        if (!equipment) return;
        this.selectedEquipmentId = equipment.id;
        this.refreshEquipmentButtons();
        this.refreshHud();
    }

    private selectEquippedSlot(index: number) {
        const equipment = this.getEquipmentForDisplaySlot(index);
        if (!equipment) return;
        this.selectedEquipmentId = equipment.id;
        this.refreshEquipmentButtons();
        this.refreshHud();
    }

    private changeEquipmentPage(delta: number) {
        const maxPage = this.getEquipmentPageCount() - 1;
        this.equipmentPage = this.clamp(this.equipmentPage + delta, 0, Math.max(0, maxPage));
        this.refreshEquipmentButtons();
    }

    private toggleSelectedEquipment() {
        if (this.phase !== 'hangar') return;
        const equipment = this.getSelectedEquipment();
        if (!equipment) return;
        if (!this.ownedEquipment.has(equipment.id)) {
            this.craftEquipment(equipment);
            return;
        }

        if (this.isEquipped(equipment.id)) {
            if (equipment.kind === 'weapon' && this.getEquippedWeapons().length <= 1) {
                this.showToast('至少保留 1 把出战武器。');
                return;
            }
            this.equippedEquipment = this.equippedEquipment.filter((id) => id !== equipment.id);
            this.showToast(`${equipment.name} 已卸下。`);
        } else {
            if (equipment.kind === 'weapon') {
                if (this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT) {
                    this.showToast(`出战槽已满，最多携带 ${EQUIPPED_SLOT_COUNT} 件装备。`);
                    return;
                }
                if (this.getEquippedWeapons().length >= MAX_EQUIPPED_WEAPONS) {
                    this.showToast(`武器最多携带 ${MAX_EQUIPPED_WEAPONS} 把。`);
                    return;
                }
            } else {
                if (!equipment.gearSlot) return;
                const sameSlot = this.getEquippedGearForSlot(equipment.gearSlot);
                if (sameSlot) {
                    this.equippedEquipment = this.equippedEquipment.filter((id) => id !== sameSlot.id);
                } else {
                    if (this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT) {
                        this.showToast(`出战槽已满，最多携带 ${EQUIPPED_SLOT_COUNT} 件装备。`);
                        return;
                    }
                    if (this.getEquippedGear().length >= MAX_EQUIPPED_GEAR) {
                        this.showToast(`装备最多携带 ${MAX_EQUIPPED_GEAR} 件。`);
                        return;
                    }
                }
            }
            this.equippedEquipment.push(equipment.id);
            this.showToast(`${equipment.name} 已加入出战。`);
        }

        this.normalizeEquippedEquipment();
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.refreshHud();
    }

    private upgradeSelectedEquipment() {
        const equipment = this.getSelectedEquipment();
        if (!equipment) return;
        this.upgradeEquipment(equipment);
    }

    private upgradeEquipment(equipment: EquipmentDef) {
        if (this.phase !== 'hangar') return;
        if (!this.ownedEquipment.has(equipment.id)) {
            this.craftEquipment(equipment);
            return;
        }
        const level = this.getEquipmentLevel(equipment.id);
        if (level >= equipment.maxLevel) {
            this.showToast(`${equipment.name} 已达到当前上限。`);
            return;
        }
        const cost = this.getUpgradeCost(equipment);
        if (!this.hasResources(cost)) {
            this.showToast(`资源不足：需要 ${this.formatCost(cost)}`);
            return;
        }
        this.spendResources(cost);
        this.equipmentLevels[equipment.id] = level + 1;
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.refreshHud();
        this.showToast(`${equipment.name} 升到 Lv.${level + 1}`);
    }

    private craftEquipment(equipment: EquipmentDef) {
        if (this.ownedEquipment.has(equipment.id)) return;
        const cost = this.getCraftCost(equipment);
        if (!this.hasResources(cost)) {
            this.showToast(`合成资源不足：需要 ${this.formatCost(cost)}`);
            return;
        }
        this.spendResources(cost);
        this.ownedEquipment.add(equipment.id);
        this.equipmentLevels[equipment.id] = 1;
        this.selectedEquipmentId = equipment.id;
        this.saveProgress();
        this.refreshEquipmentButtons();
        this.refreshHud();
        this.showToast(`合成新装备：${equipment.name}`);
    }

    private refreshEquipmentButtons() {
        this.normalizeEquippedEquipment();
        this.visibleHangarEquipment = this.getVisibleHangarEquipment();
        this.refreshEquippedButtons();
        this.equipmentButtons.forEach((button, index) => {
            const equipment = this.visibleHangarEquipment[index];
            if (!equipment) {
                button.node.active = false;
                return;
            }
            button.node.active = true;
            const selected = equipment.id === this.selectedEquipmentId;
            const equipped = this.isEquipped(equipment.id);
            const owned = this.ownedEquipment.has(equipment.id);
            const level = this.getEquipmentLevel(equipment.id);
            button.color = selected ? '#0F172A' : equipped ? '#2563EB' : owned ? equipment.color : '#64748B';
            if (!owned) {
                button.label.string = `${equipment.name}\n未获得`;
            } else {
                button.label.string = `${equipment.name} Lv.${level}\n${equipped ? '出战中' : '仓库中'}${selected ? '  选中' : ''}`;
            }
            this.drawButton(button, false);
        });
        this.refreshHangarActions();
        if (this.hangarStatsLabel && this.phase === 'hangar') {
            const gearSummary = GEAR_SLOT_ORDER
                .map((slot) => `${GEAR_SLOT_LABELS[slot]}${this.getEquippedGearForSlot(slot) ? '1' : '0'}/1`)
                .join('  ');
            this.hangarStatsLabel.string = [
                `已完成出击 ${this.battlesWon} 次  下一次 ${this.battlesWon + 1}`,
                `库存：${this.formatWallet(this.getInventoryWallet())}`,
                `出战：武器 ${this.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}（战斗中切换）  ${gearSummary}`,
                `仓库：武器 ${this.getOwnedWeaponCount()}/${WEAPON_COUNT}  装备 ${GEAR_COUNT}  道具 ${RUN_ITEM_COUNT}  成长 ${STAT_UPGRADE_COUNT}  图鉴 ${TOTAL_ENEMY_TYPES}`,
            ].join('\n');
        }
    }

    private refreshEquippedButtons() {
        this.equippedButtons.forEach((button, index) => {
            const equipment = this.getEquipmentForDisplaySlot(index);
            const slotName = this.getEquippedSlotName(index);
            if (!equipment) {
                button.color = '#1E293B';
                button.label.string = `${slotName}\n空`;
                this.drawButton(button, false);
                return;
            }
            const level = this.getEquipmentLevel(equipment.id);
            button.color = equipment.id === this.selectedEquipmentId ? '#0F172A' : equipment.color;
            button.label.string = `${slotName}\n${equipment.name} Lv.${level}`;
            this.drawButton(button, false);
        });
    }

    private getEquippedSlotName(index: number) {
        if (index < MAX_EQUIPPED_WEAPONS) return `武器槽 ${index + 1}`;
        const gearSlot = GEAR_SLOT_ORDER[index - MAX_EQUIPPED_WEAPONS];
        return gearSlot ? GEAR_SLOT_LABELS[gearSlot] : `装备槽 ${index - MAX_EQUIPPED_WEAPONS + 1}`;
    }

    private getEquipmentForDisplaySlot(index: number) {
        if (index < MAX_EQUIPPED_WEAPONS) {
            return this.getEquippedWeapons()[index] || null;
        }
        const gearSlot = GEAR_SLOT_ORDER[index - MAX_EQUIPPED_WEAPONS];
        return gearSlot ? this.getEquippedGearForSlot(gearSlot) : null;
    }

    private refreshHangarActions() {
        const selected = this.getSelectedEquipment();
        const pageCount = this.getEquipmentPageCount();
        if (this.prevEquipmentButton) {
            this.prevEquipmentButton.label.string = '上一页';
            this.drawButton(this.prevEquipmentButton, this.equipmentPage <= 0);
        }
        if (this.nextEquipmentButton) {
            this.nextEquipmentButton.label.string = '下一页';
            this.drawButton(this.nextEquipmentButton, this.equipmentPage >= pageCount - 1);
        }

        if (this.equipActionButton) {
            if (!selected || !this.ownedEquipment.has(selected.id)) {
                this.equipActionButton.label.string = selected ? '合成' : '未解锁';
                this.drawButton(this.equipActionButton, !selected || !this.hasResources(this.getCraftCost(selected)));
            } else {
                const replacingGear = selected.kind === 'gear'
                    && !!selected.gearSlot
                    && !!this.getEquippedGearForSlot(selected.gearSlot)
                    && !this.isEquipped(selected.id);
                this.equipActionButton.label.string = this.isEquipped(selected.id) ? '卸下' : replacingGear ? '替换' : '加入出战';
                this.drawButton(this.equipActionButton, false);
            }
        }

        if (this.upgradeActionButton) {
            if (!selected || !this.ownedEquipment.has(selected.id)) {
                this.upgradeActionButton.label.string = '升级';
                this.drawButton(this.upgradeActionButton, true);
            } else {
                const level = this.getEquipmentLevel(selected.id);
                const cost = this.getUpgradeCost(selected);
                const disabled = level >= selected.maxLevel || !this.hasResources(cost);
                this.upgradeActionButton.label.string = level >= selected.maxLevel
                    ? '已满级'
                    : `升级 ${this.formatCost(cost)}`;
                this.drawButton(this.upgradeActionButton, disabled);
            }
        }

        if (this.startButton) {
            const canStart = this.getEquippedWeapons().length > 0;
            this.startButton.label.string = `开始第 ${this.battlesWon + 1} 次出击`;
            this.drawButton(this.startButton, !canStart);
        }

        if (this.equipmentDetailLabel) {
            this.equipmentDetailLabel.string = selected ? this.formatEquipmentDetail(selected) : '仓库为空';
        }
    }

    private formatEquipmentDetail(equipment: EquipmentDef) {
        const owned = this.ownedEquipment.has(equipment.id);
        const equipped = this.isEquipped(equipment.id);
        const level = this.getEquipmentLevel(equipment.id);
        const detailLevel = owned ? level : 1;
        const activeWeapon = this.getActiveWeapon();
        const equippedState = equipment.kind === 'weapon'
            ? activeWeapon?.id === equipment.id ? '  当前武器' : equipped ? '  出战中-可切换' : ''
            : equipped ? '  出战中-被动生效' : '';
        const state = `${owned ? `Lv.${level}/${equipment.maxLevel}` : '未获得'}${equippedState}`;
        const slotName = equipment.kind === 'weapon' ? '武器' : equipment.gearSlot ? GEAR_SLOT_LABELS[equipment.gearSlot] : '装备';
        const rarity = equipment.rarity || '普通';
        const lines = [`${equipment.name}  [${rarity}] ${slotName}  ${state}`, equipment.desc];
        if (equipment.weaponStats) {
            if (equipment.attackStyle) {
                lines.push(`攻击风格：${getWeaponStyleName(equipment.attackStyle)}${equipment.kind === 'weapon' && equipped ? '；战斗中只有当前武器属性生效' : ''}`);
            }
            lines.push([
                `攻击力 +${this.formatStat(equipment.weaponStats.damage * detailLevel)}`,
                `攻击速度 +${this.formatStat(equipment.weaponStats.fireRate * detailLevel * 3.5)}%`,
                `穿透 +${this.formatStat(equipment.weaponStats.pierce * detailLevel)}`,
            ].join('  '));
            lines.push([
                `散射 +${this.formatStat(equipment.weaponStats.multiShot * detailLevel)}`,
                `无人机 +${this.formatStat(equipment.weaponStats.drone * detailLevel)}`,
                `弹速 +${this.formatStat(equipment.weaponStats.bulletSpeed * detailLevel)}`,
            ].join('  '));
        } else {
            lines.push(this.formatGearStats(equipment, detailLevel));
        }
        if (!owned) {
            lines.push(`合成消耗：${this.formatCost(this.getCraftCost(equipment))}`);
        } else if (level < equipment.maxLevel) {
            lines.push(`升级消耗：${this.formatCost(this.getUpgradeCost(equipment))}`);
        }
        return lines.join('\n');
    }

    private formatGearStats(equipment: EquipmentDef, level: number) {
        if (!equipment.gearStats || equipment.gearStats.length <= 0) return '暂无属性词条。';
        return equipment.gearStats
            .map((effect) => formatRunItemEffect({ stat: effect.stat, amount: effect.amount * level }))
            .join('  ');
    }

    private formatStat(value: number) {
        return Number(value.toFixed(1)).toString();
    }

    private refreshHud() {
        if (this.titleLabel) this.titleLabel.string = `星坠幸存者  出击 ${this.battlesWon + 1}`;
        const inRun = this.phase === 'combat' || this.phase === 'level-up' || this.phase === 'item-choice' || this.phase === 'shop';
        if (this.timerLabel) {
            const waveRemain = Math.max(0, Math.ceil(this.waveDuration - this.waveElapsed));
            const waveText = this.isBossWave()
                ? `第${Math.max(1, this.waveIndex)}波 Boss${this.bossDefeatedThisWave ? ` ${waveRemain}s` : ''}`
                : `第${Math.max(1, this.waveIndex || 1)}波 ${waveRemain}s`;
            this.timerLabel.string = inRun
                ? this.phase === 'shop'
                    ? '商店'
                    : waveText
                : '机库';
        }
        if (this.statLabel) {
            const stats = this.getCharacterStats();
            const enemyPoolCount = inRun ? this.getAvailableEnemySpecs().length + BOSS_ENEMY_COUNT : TOTAL_ENEMY_TYPES;
            const droneText = inRun && stats.dronePower > 0
                ? ` | 机${this.formatStat(stats.dronePower)}×${this.getDroneStrikeCount(stats.dronePower)}`
                : '';
            this.statLabel.string = inRun
                ? `存活 ${this.formatTime(this.combatTime)} | Lv.${this.level} | 合金 ${this.battleAlloy} | HP ${Math.ceil(this.playerHp)}/${Math.ceil(this.playerMaxHp)} 护${Math.ceil(this.playerShield)} | 攻${Math.ceil(stats.attackPower)} 暴${Math.round(stats.critChance * 100)}%${droneText} | 怪${this.enemies.length} 池${enemyPoolCount}/${TOTAL_ENEMY_TYPES}`
                : `永久资源：${this.formatWallet(this.getInventoryWallet())}`;
        }
        if (this.equipmentLabel) {
            const activeWeapon = this.getActiveWeapon();
            const stats = this.getCharacterStats();
            const weaponText = activeWeapon ? `${activeWeapon.name} Lv.${this.getEquipmentLevel(activeWeapon.id)}` : '无武器';
            const droneHint = inRun && stats.dronePower > 0
                ? `  无人机 ${this.formatStat(this.getDroneStrikeInterval(stats.dronePower))}s/轮`
                : '';
            this.equipmentLabel.string = inRun
                ? `当前 ${weaponText}${droneHint}  装备 ${this.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}  H调试`
                : `出战 ${this.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}武  装备 ${this.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}`;
        }
        if (this.switchWeaponButton) {
            const canSwitch = this.phase === 'combat' && this.getEquippedWeapons().length > 1;
            this.switchWeaponButton.node.active = inRun;
            this.switchWeaponButton.label.string = '切武器';
            this.drawButton(this.switchWeaponButton, !canSwitch);
        }
        if (this.shopButton) {
            this.shopButton.node.active = inRun;
            this.shopButton.label.string = '商店';
            this.drawButton(this.shopButton, this.phase !== 'combat');
        }
        if (this.extractButton) {
            this.extractButton.node.active = inRun;
            this.extractButton.label.string = '撤离';
            this.drawButton(this.extractButton, this.phase !== 'combat');
        }
        this.refreshDebugHud(inRun);
        this.drawBars();
    }

    private refreshDebugHud(inRun: boolean) {
        if (!this.debugLabel) return;
        this.debugLabel.node.active = inRun && this.debugHudEnabled;
        if (!inRun || !this.debugHudEnabled) {
            this.debugLabel.string = '';
            return;
        }
        const boss = this.enemies.find((enemy) => enemy.boss);
        const bossText = boss ? `Boss ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}` : 'Boss -';
        this.debugLabel.string = [
            `DBG ${this.phase} W${this.waveIndex} ${Math.round(this.waveElapsed)}/${Math.round(this.waveDuration)}s ${bossText}`,
            `E ${this.enemies.length}/${this.getEnemyCap()}  B ${this.bullets.length}  EP ${this.enemyProjectiles.length}/${ENEMY_PROJECTILE_LIMIT}  P ${this.pickups.length}  FT ${this.floatingTexts.length}`,
        ].join('  |  ');
    }

    private drawBars() {
        if (this.hpBar) {
            const ratio = this.playerMaxHp > 0 ? this.playerHp / this.playerMaxHp : 0;
            const shieldRatio = this.playerShieldMax > 0 ? this.playerShield / this.playerShieldMax : 0;
            this.hpBar.clear();
            this.hpBar.fillColor = this.hex('#1E293B');
            this.hpBar.roundRect(-146, -9, 292, 18, 9);
            this.hpBar.fill();
            if (shieldRatio > 0) {
                this.hpBar.fillColor = this.hex('#4CC9F0', 185);
                this.hpBar.roundRect(-146, -9, 292 * this.clamp(shieldRatio, 0, 1), 18, 9);
                this.hpBar.fill();
            }
            this.hpBar.fillColor = this.hex(ratio > 0.45 ? '#43AA8B' : '#F94144');
            this.hpBar.roundRect(-146, -6, 292 * this.clamp(ratio, 0, 1), 12, 6);
            this.hpBar.fill();
        }

        if (this.xpBar) {
            const ratio = this.xpToNext > 0 ? this.xp / this.xpToNext : 0;
            this.xpBar.clear();
            this.xpBar.fillColor = this.hex('#1E293B');
            this.xpBar.roundRect(-146, -9, 292, 18, 9);
            this.xpBar.fill();
            this.xpBar.fillColor = this.hex('#4CC9F0');
            this.xpBar.roundRect(-146, -9, 292 * this.clamp(ratio, 0, 1), 18, 9);
            this.xpBar.fill();
        }
    }

    private updateDroneVisuals(dt: number) {
        this.droneHitPulse = Math.max(0, this.droneHitPulse - dt);
        if (!this.worldNode || this.phase !== 'combat' || !this.playerNode) {
            this.clearDroneVisuals();
            return;
        }

        const dronePower = this.getCharacterStats().dronePower;
        const targetCount = dronePower > 0 ? this.clamp(Math.ceil(dronePower / 1.35), 1, 4) : 0;
        while (this.droneVisuals.length < targetCount) {
            this.droneVisuals.push(this.createDroneVisual(this.droneVisuals.length));
        }
        while (this.droneVisuals.length > targetCount) {
            const visual = this.droneVisuals.pop();
            if (visual) visual.node.destroy();
        }
        if (targetCount <= 0) return;

        const orbitRadius = 42 + Math.min(32, dronePower * 4.2);
        const orbitSpeed = 1.35 + Math.min(2.4, dronePower * 0.11);
        const pulse = this.droneHitPulse > 0 ? 1 + this.droneHitPulse * 3.8 : 1;
        for (let i = 0; i < this.droneVisuals.length; i++) {
            const visual = this.droneVisuals[i];
            const angle = this.combatTime * orbitSpeed + visual.phase;
            const x = this.playerX + Math.cos(angle) * orbitRadius;
            const y = this.playerY + Math.sin(angle) * orbitRadius * 0.74 + 8;
            visual.node.setPosition(x, y, 9);
            this.drawDroneVisual(visual, dronePower, pulse);
        }
    }

    private createDroneVisual(index: number): DroneVisual {
        const node = new Node('OrbitDrone');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(30, 30);
        const gfx = node.addComponent(Graphics);
        return {
            node,
            gfx,
            phase: index * Math.PI * 2 / 4,
        };
    }

    private drawDroneVisual(visual: DroneVisual, dronePower: number, pulse = 1) {
        const gfx = visual.gfx;
        const core = 5 + Math.min(4, dronePower * 0.35) + pulse * 1.4;
        gfx.clear();
        gfx.strokeColor = this.hex('#90BE6D', this.droneHitPulse > 0 ? 220 : 120);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, core + 7);
        gfx.stroke();
        gfx.fillColor = this.hex('#020617', 135);
        gfx.circle(2, -2, core + 4);
        gfx.fill();
        gfx.fillColor = this.hex('#90BE6D', this.droneHitPulse > 0 ? 255 : 220);
        gfx.circle(0, 0, core);
        gfx.fill();
        gfx.fillColor = this.hex('#F8FAFC', 230);
        gfx.circle(-2, 2, Math.max(2.2, core * 0.35));
        gfx.fill();
    }

    private getDroneZapOrigin() {
        if (this.droneVisuals.length > 0) {
            const index = Math.floor(Math.random() * this.droneVisuals.length);
            const position = this.droneVisuals[index].node.position;
            return { x: position.x, y: position.y };
        }
        return { x: this.playerX, y: this.playerY };
    }

    private clearDroneVisuals() {
        for (const visual of this.droneVisuals) {
            visual.node.destroy();
        }
        this.droneVisuals = [];
        this.droneHitPulse = 0;
    }

    private drawPlayer() {
        if (!this.playerGfx) return;
        const pulse = this.invulnerableTimer > 0 ? 120 : 255;
        this.playerGfx.clear();
        if (this.playerSprite) {
            this.playerSprite.color = this.hex('#FFFFFF', pulse);
            this.playerGfx.fillColor = this.hex('#020617', 95);
            this.playerGfx.circle(3, -6, 27);
            this.playerGfx.fill();
            this.playerGfx.strokeColor = this.hex(this.invulnerableTimer > 0 ? '#F8FAFC' : '#4CC9F0', pulse);
            this.playerGfx.lineWidth = 3;
            this.playerGfx.circle(0, 0, 29);
            this.playerGfx.stroke();
            return;
        }
        this.playerGfx.fillColor = this.hex('#020617', 110);
        this.playerGfx.circle(3, -5, 25);
        this.playerGfx.fill();
        this.playerGfx.fillColor = this.hex('#E2E8F0', pulse);
        this.playerGfx.circle(0, 0, 21);
        this.playerGfx.fill();
        this.playerGfx.fillColor = this.hex('#4CC9F0', pulse);
        this.playerGfx.moveTo(0, 24);
        this.playerGfx.lineTo(17, -12);
        this.playerGfx.lineTo(0, -4);
        this.playerGfx.lineTo(-17, -12);
        this.playerGfx.close();
        this.playerGfx.fill();
        this.playerGfx.strokeColor = this.hex('#0F172A', pulse);
        this.playerGfx.lineWidth = 3;
        this.playerGfx.circle(0, 0, 21);
        this.playerGfx.stroke();
    }

    private drawEnemy(enemy: Enemy) {
        enemy.gfx.clear();
        if (enemy.sprite) {
            const visualRadius = enemy.visualRadius || enemy.radius + 8;
            const tint = this.getEnemyTint(enemy, 255);
            enemy.sprite.color = enemy.hitFlash > 0
                ? this.hex('#FFFFFF', 255)
                : tint;
            enemy.gfx.fillColor = this.hex('#020617', 145);
            enemy.gfx.ellipse(4, -8, visualRadius + 8, visualRadius * 0.72 + 5);
            enemy.gfx.fill();
            enemy.gfx.fillColor = this.hex(enemy.spec.color, enemy.boss ? 72 : 58);
            enemy.gfx.circle(0, 0, visualRadius + (enemy.boss ? 12 : 7));
            enemy.gfx.fill();
            enemy.gfx.strokeColor = this.hex(enemy.hitFlash > 0 ? '#FFFFFF' : enemy.spec.accent, enemy.boss ? 245 : 225);
            enemy.gfx.lineWidth = enemy.boss ? 6 : enemy.elite ? 5 : 4;
            enemy.gfx.circle(0, 0, visualRadius + (enemy.boss ? 8 : 5));
            enemy.gfx.stroke();
            this.drawEnemyVariantMark(enemy);
            if (enemy.elite || enemy.boss) {
                enemy.gfx.strokeColor = this.hex(enemy.boss ? '#F94144' : '#F8FAFC', enemy.boss ? 245 : 215);
                enemy.gfx.lineWidth = enemy.boss ? 6 : 4;
                enemy.gfx.circle(0, 0, visualRadius + (enemy.boss ? 18 : 11));
                enemy.gfx.stroke();
            }
            if (enemy.armorTimer > 0 || enemy.dashTimer > 0) {
                enemy.gfx.strokeColor = this.hex(enemy.armorTimer > 0 ? '#CBD5E1' : '#F59E0B', 230);
                enemy.gfx.lineWidth = enemy.armorTimer > 0 ? 5 : 4;
                enemy.gfx.circle(0, 0, visualRadius + (enemy.armorTimer > 0 ? 15 : 10));
                enemy.gfx.stroke();
            }
            if (enemy.hp < enemy.maxHp) {
                const ratio = this.clamp(enemy.hp / enemy.maxHp, 0, 1);
                const barWidth = Math.max(enemy.radius * 2, visualRadius * 1.45);
                enemy.gfx.fillColor = this.hex('#0F172A');
                enemy.gfx.roundRect(-barWidth / 2, visualRadius + 10, barWidth, 7, 3);
                enemy.gfx.fill();
                enemy.gfx.fillColor = this.hex('#F94144');
                enemy.gfx.roundRect(-barWidth / 2, visualRadius + 10, barWidth * ratio, 7, 3);
                enemy.gfx.fill();
            }
            return;
        }
        enemy.gfx.fillColor = this.hex('#020617', 90);
        enemy.gfx.circle(3, -4, enemy.radius + 3);
        enemy.gfx.fill();
        enemy.gfx.fillColor = enemy.hitFlash > 0
            ? this.hex('#FFFFFF', 255)
            : this.getEnemyTint(enemy, enemy.elite ? 255 : 230);
        enemy.gfx.circle(0, 0, enemy.radius);
        enemy.gfx.fill();
        enemy.gfx.fillColor = this.hex(enemy.spec.accent, 210);
        enemy.gfx.circle(-enemy.radius * 0.3, enemy.radius * 0.12, enemy.radius * 0.35);
        enemy.gfx.fill();
        this.drawEnemyVariantMark(enemy);
        enemy.gfx.strokeColor = this.hex(enemy.elite ? '#F8FAFC' : '#0F172A', enemy.boss ? 255 : 190);
        enemy.gfx.lineWidth = enemy.boss ? 5 : enemy.elite ? 4 : 2;
        enemy.gfx.circle(0, 0, enemy.radius);
        enemy.gfx.stroke();
        if (enemy.armorTimer > 0 || enemy.dashTimer > 0) {
            enemy.gfx.strokeColor = this.hex(enemy.armorTimer > 0 ? '#CBD5E1' : '#F59E0B', 210);
            enemy.gfx.lineWidth = enemy.armorTimer > 0 ? 4 : 3;
            enemy.gfx.circle(0, 0, enemy.radius + (enemy.armorTimer > 0 ? 9 : 5));
            enemy.gfx.stroke();
        }

        if (enemy.hp < enemy.maxHp) {
            const ratio = this.clamp(enemy.hp / enemy.maxHp, 0, 1);
            enemy.gfx.fillColor = this.hex('#0F172A');
            enemy.gfx.roundRect(-enemy.radius, enemy.radius + 6, enemy.radius * 2, 5, 3);
            enemy.gfx.fill();
            enemy.gfx.fillColor = this.hex('#F94144');
            enemy.gfx.roundRect(-enemy.radius, enemy.radius + 6, enemy.radius * 2 * ratio, 5, 3);
            enemy.gfx.fill();
        }
    }

    private getEnemyTint(enemy: Enemy, alpha = 255) {
        if (enemy.boss) return this.hex(enemy.spec.color, alpha);
        const palette = [
            enemy.spec.color,
            '#9BE564',
            '#43AA8B',
            '#4CC9F0',
            '#577590',
            '#F9C74F',
            '#F3722C',
            '#B5179E',
            '#A7F3D0',
            '#90BE6D',
            '#F94144',
        ];
        const color = palette[(enemy.spec.variantIndex || 0) % palette.length] || enemy.spec.color;
        return this.hex(color, alpha);
    }

    private drawEnemyVariantMark(enemy: Enemy) {
        if (enemy.boss) return;
        const variantIndex = enemy.spec.variantIndex || 0;
        if (variantIndex <= 0) return;

        const markColor = this.getEnemyTint(enemy, 235);
        const accentColor = this.hex(enemy.spec.accent, 220);
        const r = enemy.radius;
        enemy.gfx.strokeColor = markColor;
        enemy.gfx.lineWidth = enemy.elite ? 4 : 3;

        switch (enemy.spec.variantId) {
            case 'acid':
                enemy.gfx.circle(-r * 0.36, -r * 0.16, Math.max(3, r * 0.16));
                enemy.gfx.stroke();
                enemy.gfx.circle(r * 0.28, r * 0.18, Math.max(3, r * 0.13));
                enemy.gfx.stroke();
                break;
            case 'crystal':
                enemy.gfx.moveTo(0, r * 0.72);
                enemy.gfx.lineTo(r * 0.28, 0);
                enemy.gfx.lineTo(0, -r * 0.72);
                enemy.gfx.lineTo(-r * 0.28, 0);
                enemy.gfx.close();
                enemy.gfx.stroke();
                break;
            case 'swift':
                enemy.gfx.moveTo(-r * 0.72, -r * 0.36);
                enemy.gfx.lineTo(r * 0.62, 0);
                enemy.gfx.lineTo(-r * 0.72, r * 0.36);
                enemy.gfx.stroke();
                break;
            case 'armored':
                enemy.gfx.roundRect(-r * 0.62, -r * 0.48, r * 1.24, r * 0.96, Math.max(4, r * 0.12));
                enemy.gfx.stroke();
                break;
            case 'rage':
                enemy.gfx.moveTo(-r * 0.42, r * 0.58);
                enemy.gfx.lineTo(-r * 0.16, r * 0.12);
                enemy.gfx.lineTo(0, r * 0.66);
                enemy.gfx.lineTo(r * 0.18, r * 0.12);
                enemy.gfx.lineTo(r * 0.44, r * 0.58);
                enemy.gfx.stroke();
                break;
            case 'shade':
                enemy.gfx.fillColor = this.hex('#020617', 90);
                enemy.gfx.circle(0, 0, r * 0.72);
                enemy.gfx.fill();
                enemy.gfx.strokeColor = markColor;
                enemy.gfx.circle(0, 0, r * 0.5);
                enemy.gfx.stroke();
                break;
            case 'arc':
                enemy.gfx.moveTo(-r * 0.32, r * 0.62);
                enemy.gfx.lineTo(r * 0.08, r * 0.08);
                enemy.gfx.lineTo(-r * 0.08, r * 0.08);
                enemy.gfx.lineTo(r * 0.36, -r * 0.62);
                enemy.gfx.stroke();
                break;
            case 'regen':
                enemy.gfx.moveTo(0, r * 0.58);
                enemy.gfx.lineTo(0, -r * 0.58);
                enemy.gfx.moveTo(-r * 0.58, 0);
                enemy.gfx.lineTo(r * 0.58, 0);
                enemy.gfx.stroke();
                break;
            case 'venom':
                enemy.gfx.fillColor = markColor;
                enemy.gfx.circle(0, -r * 0.12, Math.max(4, r * 0.2));
                enemy.gfx.fill();
                enemy.gfx.fillColor = accentColor;
                enemy.gfx.circle(0, -r * 0.12, Math.max(2, r * 0.08));
                enemy.gfx.fill();
                break;
            case 'prime':
                enemy.gfx.circle(0, 0, r * 0.78);
                enemy.gfx.stroke();
                enemy.gfx.circle(0, 0, r * 0.42);
                enemy.gfx.stroke();
                break;
            default:
                enemy.gfx.circle(0, 0, r * 0.62);
                enemy.gfx.stroke();
                break;
        }
    }

    private drawBullet(bullet: Bullet) {
        bullet.gfx.clear();
        if (bullet.sprite) {
            bullet.sprite.color = this.hex(bullet.accent, 235);
            bullet.sprite.node.getComponent(UITransform)?.setContentSize(bullet.radius * 3.2, bullet.radius * 3.2);
        }
        const lifeRatio = bullet.maxLife > 0 ? this.clamp(bullet.life / bullet.maxLife, 0, 1) : 1;
        const tailLength = bullet.style === 'rail' ? 34 : bullet.style === 'laser' ? 42 : bullet.style === 'shotgun' ? 16 : bullet.style === 'meteor' ? 12 : 22;
        const coreRadius = bullet.radius * (bullet.style === 'rail' ? 0.56 : bullet.style === 'laser' ? 0.45 : 0.72);
        bullet.gfx.fillColor = this.hex(bullet.color, Math.round(55 + 90 * lifeRatio));
        bullet.gfx.roundRect(-tailLength, -bullet.radius * 0.42, tailLength + bullet.radius, bullet.radius * 0.84, bullet.radius * 0.42);
        bullet.gfx.fill();
        bullet.gfx.fillColor = this.hex(bullet.accent, Math.round(185 + 60 * lifeRatio));
        if (bullet.style === 'disc') {
            bullet.gfx.circle(0, 0, bullet.radius);
            bullet.gfx.fill();
            bullet.gfx.fillColor = this.hex(bullet.color, 230);
            bullet.gfx.circle(0, 0, bullet.radius * 0.45);
            bullet.gfx.fill();
        } else if (bullet.style === 'scythe') {
            bullet.gfx.moveTo(-bullet.radius * 0.8, -bullet.radius * 0.3);
            bullet.gfx.quadraticCurveTo(bullet.radius * 0.45, -bullet.radius * 1.15, bullet.radius * 1.05, 0);
            bullet.gfx.quadraticCurveTo(bullet.radius * 0.45, bullet.radius * 1.15, -bullet.radius * 0.8, bullet.radius * 0.3);
            bullet.gfx.close();
            bullet.gfx.fill();
        } else if (bullet.style === 'rail' || bullet.style === 'laser') {
            bullet.gfx.roundRect(-bullet.radius * 0.3, -coreRadius, bullet.radius * 2.2, coreRadius * 2, coreRadius);
            bullet.gfx.fill();
        } else {
            bullet.gfx.circle(0, 0, coreRadius);
            bullet.gfx.fill();
        }
    }

    private drawPickup(pickup: Pickup) {
        const chest = this.isChestPickup(pickup.type);
        let color = '#4CC9F0';
        if (this.isChestPickup(pickup.type)) {
            color = pickup.type === 'chest-rare' ? '#F59E0B' : '#43AA8B';
        } else if (pickup.type !== 'xp') {
            color = this.getResourceDef(pickup.type).color;
        }
        pickup.gfx.clear();
        if (pickup.sprite) {
            pickup.gfx.fillColor = this.hex('#020617', 60);
            pickup.gfx.circle(2, -2, pickup.radius + 6);
            pickup.gfx.fill();
            pickup.gfx.strokeColor = this.hex(color, 170);
            pickup.gfx.lineWidth = 2;
            pickup.gfx.circle(0, 0, pickup.radius + 9);
            pickup.gfx.stroke();
            return;
        }
        pickup.gfx.fillColor = this.hex('#020617', 90);
        pickup.gfx.circle(2, -2, pickup.radius + 3);
        pickup.gfx.fill();
        pickup.gfx.fillColor = this.hex(color);
        if (pickup.type === 'xp') {
            pickup.gfx.circle(0, 0, pickup.radius);
        } else if (chest) {
            pickup.gfx.roundRect(-pickup.radius - 3, -pickup.radius + 2, pickup.radius * 2 + 6, pickup.radius * 1.55, 5);
            pickup.gfx.fill();
            pickup.gfx.fillColor = this.hex('#F8FAFC', 190);
            pickup.gfx.roundRect(-pickup.radius - 3, -pickup.radius + 1, pickup.radius * 2 + 6, 5, 3);
            pickup.gfx.fill();
            pickup.gfx.fillColor = this.hex(pickup.type === 'chest-rare' ? '#B5179E' : '#0F172A', 210);
            pickup.gfx.roundRect(-4, -pickup.radius + 4, 8, pickup.radius * 1.22, 3);
        } else {
            pickup.gfx.moveTo(0, pickup.radius + 2);
            pickup.gfx.lineTo(pickup.radius + 2, 0);
            pickup.gfx.lineTo(0, -pickup.radius - 2);
            pickup.gfx.lineTo(-pickup.radius - 2, 0);
            pickup.gfx.close();
        }
        pickup.gfx.fill();
        pickup.gfx.strokeColor = this.hex('#F8FAFC', 190);
        pickup.gfx.lineWidth = 2;
        pickup.gfx.circle(0, 0, pickup.radius + 1);
        pickup.gfx.stroke();
    }

    private drawZap(fromX: number, fromY: number, toX: number, toY: number) {
        const node = new Node('DroneZap');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(0, 0, 8);
        const gfx = node.addComponent(Graphics);
        gfx.lineWidth = 3;
        gfx.strokeColor = this.hex('#90BE6D', 210);
        gfx.moveTo(fromX, fromY);
        const midX = (fromX + toX) / 2 + this.randomRange(-16, 16);
        const midY = (fromY + toY) / 2 + this.randomRange(-16, 16);
        gfx.lineTo(midX, midY);
        gfx.lineTo(toX, toY);
        gfx.stroke();
        this.scheduleOnce(() => node.destroy(), 0.06);
    }

    private spawnFloatingText(text: string, x: number, y: number, color: string, fontSize: number) {
        if (!this.worldNode) return;
        if (this.floatingTexts.length >= FLOATING_TEXT_LIMIT) {
            const oldest = this.floatingTexts.shift();
            if (oldest) this.recycleFloatingText(oldest, false);
        }

        const floatingText = this.acquireFloatingText();
        floatingText.x = x;
        floatingText.y = y;
        floatingText.vy = 58 + Math.random() * 34;
        floatingText.life = 0.72;
        floatingText.maxLife = 0.72;
        floatingText.color = color;
        floatingText.node.active = true;
        floatingText.node.setPosition(x, y, 24);
        floatingText.label.string = text;
        floatingText.label.fontSize = fontSize;
        floatingText.label.lineHeight = Math.round(fontSize * 1.12);
        floatingText.label.color = this.hex(color);
        this.floatingTexts.push(floatingText);
    }

    private acquireFloatingText(): FloatingText {
        const pooled = this.floatingTextPool.pop();
        if (pooled) return pooled;

        const node = new Node('FloatingText');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(120, 34);
        const label = node.addComponent(Label);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = false;
        return {
            node,
            label,
            x: 0,
            y: 0,
            vy: 0,
            life: 0,
            maxLife: 0.72,
            color: '#F8FAFC',
        };
    }

    private updateFloatingTexts(dt: number) {
        if (this.floatingTexts.length <= 0) return;
        const removing: FloatingText[] = [];
        for (const floatingText of this.floatingTexts) {
            floatingText.life -= dt;
            floatingText.y += floatingText.vy * dt;
            floatingText.node.setPosition(floatingText.x, floatingText.y, 24);
            const alpha = Math.round(255 * this.clamp(floatingText.life / floatingText.maxLife, 0, 1));
            floatingText.label.color = this.hex(floatingText.color, alpha);
            if (floatingText.life <= 0) {
                removing.push(floatingText);
            }
        }
        for (const floatingText of removing) {
            this.recycleFloatingText(floatingText, true);
        }
    }

    private recycleFloatingText(floatingText: FloatingText, removeFromActive: boolean) {
        if (removeFromActive) {
            const index = this.floatingTexts.indexOf(floatingText);
            if (index >= 0) this.floatingTexts.splice(index, 1);
        }
        floatingText.label.string = '';
        floatingText.node.active = false;
        this.floatingTextPool.push(floatingText);
    }

    private drawJoystick() {
        if (!this.joystickBaseGfx || !this.joystickKnobGfx) return;
        this.joystickBaseGfx.clear();
        this.joystickBaseGfx.fillColor = this.hex('#F8FAFC', 52);
        this.joystickBaseGfx.circle(0, 0, 74);
        this.joystickBaseGfx.fill();
        this.joystickBaseGfx.strokeColor = this.hex('#CBD5E1', 120);
        this.joystickBaseGfx.lineWidth = 3;
        this.joystickBaseGfx.circle(0, 0, 74);
        this.joystickBaseGfx.stroke();

        this.joystickKnobGfx.clear();
        this.joystickKnobGfx.fillColor = this.hex('#4CC9F0', 150);
        this.joystickKnobGfx.circle(0, 0, 36);
        this.joystickKnobGfx.fill();
        this.joystickKnobGfx.strokeColor = this.hex('#F8FAFC', 160);
        this.joystickKnobGfx.lineWidth = 3;
        this.joystickKnobGfx.circle(0, 0, 36);
        this.joystickKnobGfx.stroke();
    }

    private updateJoystickView() {
        if (!this.joystickBase || !this.joystickKnob) return;
        if (!this.touchActive || this.phase !== 'combat') {
            this.joystickBase.active = false;
            this.joystickKnob.active = false;
            return;
        }
        const baseX = this.touchOrigin.x - DESIGN_WIDTH / 2;
        const baseY = this.touchOrigin.y - DESIGN_HEIGHT / 2;
        this.joystickBase.active = true;
        this.joystickKnob.active = true;
        this.joystickBase.setPosition(baseX, baseY, 20);
        this.joystickKnob.setPosition(baseX + this.touchVector.x * 52, baseY + this.touchVector.y * 52, 21);
    }

    private findNearestEnemy(range: number): Enemy | null {
        let best: Enemy | null = null;
        let bestDist = range * range;
        for (const enemy of this.enemies) {
            const dist = this.distanceSq(this.playerX, this.playerY, enemy.node.position.x, enemy.node.position.y);
            if (dist < bestDist) {
                best = enemy;
                bestDist = dist;
            }
        }
        return best;
    }

    private pickLevelChoices(): LevelUpgrade[] {
        const maxTier = this.level < 4 ? 2 : this.level < 8 ? 3 : this.level < 13 ? 4 : 5;
        const available = LEVEL_UPGRADES.filter((item) => item.tier <= maxTier && !this.acquiredStatUpgradeIds.has(item.id));
        const pool = this.shuffle(available.length >= 3 ? available : LEVEL_UPGRADES.filter((item) => item.tier <= maxTier));
        const picked: LevelUpgrade[] = [];
        const usedCategories = new Set<string>();
        for (const item of pool) {
            if (picked.length >= 3) break;
            if (usedCategories.has(item.category) && picked.length < 2) continue;
            picked.push(item);
            usedCategories.add(item.category);
        }
        while (picked.length < 3 && pool.length > 0) {
            const item = pool[picked.length % pool.length];
            if (picked.indexOf(item) < 0) picked.push(item);
        }
        return picked.slice(0, 3);
    }

    private pickItemChoices(quality: ItemChoiceQuality): LevelUpgrade[] {
        const maxTier = this.getRunItemTierLimit();
        const minTier = quality === 'rare' ? Math.max(3, Math.min(5, maxTier - 1)) : 1;
        const tierCeiling = quality === 'rare' ? Math.max(3, maxTier) : Math.min(3, maxTier);
        const available = RUN_ITEMS.filter((item) =>
            item.tier >= minTier
            && item.tier <= tierCeiling
            && !this.acquiredRunItemIds.has(item.id),
        );
        const fallback = RUN_ITEMS.filter((item) => item.tier >= minTier && item.tier <= tierCeiling);
        return this.pickDistinctItems(available.length >= 3 ? available : fallback, 3);
    }

    private pickShopOffers(): LevelUpgrade[] {
        const maxTier = this.getRunItemTierLimit();
        const available = RUN_ITEMS.filter((item) => item.tier <= maxTier && !this.acquiredRunItemIds.has(item.id));
        const fallback = RUN_ITEMS.filter((item) => item.tier <= maxTier);
        return this.pickDistinctItems(available.length >= SHOP_ITEM_COUNT ? available : fallback, SHOP_ITEM_COUNT);
    }

    private ensureShopOffers() {
        while (this.shopOffers.length < SHOP_ITEM_COUNT) {
            this.shopOffers.push(this.pickShopOfferForSlot(this.shopOffers.length));
        }
        for (let i = 0; i < SHOP_ITEM_COUNT; i++) {
            if (!this.shopOffers[i] || this.acquiredRunItemIds.has(this.shopOffers[i].id)) {
                this.shopOffers[i] = this.pickShopOfferForSlot(i);
            }
        }
        this.shopOffers = this.shopOffers.slice(0, SHOP_ITEM_COUNT);
    }

    private pickShopOfferForSlot(index: number) {
        const maxTier = this.getRunItemTierLimit();
        const excluded = new Set<string>();
        for (let i = 0; i < this.shopOffers.length; i++) {
            if (i !== index && this.shopOffers[i]) excluded.add(this.shopOffers[i].id);
        }
        for (const id of this.acquiredRunItemIds) excluded.add(id);

        const available = RUN_ITEMS.filter((item) => item.tier <= maxTier && !excluded.has(item.id));
        const fallback = RUN_ITEMS.filter((item) => item.tier <= maxTier && !this.acquiredRunItemIds.has(item.id));
        const pool = available.length > 0 ? available : fallback.length > 0 ? fallback : RUN_ITEMS.filter((item) => item.tier <= maxTier);
        return this.pickDistinctItems(pool, 1)[0] || RUN_ITEMS[0];
    }

    private pickDistinctItems(pool: LevelUpgrade[], count: number): LevelUpgrade[] {
        const picked: LevelUpgrade[] = [];
        const usedCategories = new Set<string>();
        const shuffled = this.shuffle(pool);
        for (const item of shuffled) {
            if (picked.length >= count) break;
            if (usedCategories.has(item.category) && picked.length < Math.ceil(count * 0.6)) continue;
            picked.push(item);
            usedCategories.add(item.category);
        }
        for (const item of shuffled) {
            if (picked.length >= count) break;
            if (picked.indexOf(item) < 0) picked.push(item);
        }
        return picked.slice(0, count);
    }

    private getRunItemTierLimit() {
        const minutes = Math.floor(this.combatTime / 150);
        return this.clamp(2 + Math.floor(this.endlessCycle / 2) + minutes, 2, 5);
    }

    private getShopItemCost(item: LevelUpgrade) {
        const waveFee = Math.floor(this.waveIndex / 4) * 5;
        const cycleFee = (this.endlessCycle - 1) * 10;
        const baseCost = 44 + item.tier * 18 + waveFee + cycleFee;
        return Math.max(46, Math.round(baseCost * this.getRunItemShopPriceMultiplier(item)));
    }

    private getRunItemShopPriceMultiplier(item: LevelUpgrade) {
        let multiplier = 1;
        let offense = 0;
        let defense = 0;
        let utility = 0;
        let drawback = 0;

        for (const effect of item.effects) {
            const amount = effect.amount;
            if (amount > 0) {
                switch (effect.stat) {
                    case 'attackPower':
                        offense += amount / 18;
                        break;
                    case 'attackSpeed':
                        offense += amount * 3.5;
                        break;
                    case 'pierce':
                        offense += amount * 0.55;
                        break;
                    case 'multiShot':
                        offense += amount * 0.5;
                        break;
                    case 'dronePower':
                        offense += amount * 0.26;
                        break;
                    case 'critChance':
                    case 'lethalChance':
                        offense += amount * 7.5;
                        break;
                    case 'critDamage':
                    case 'lethalDamage':
                        offense += amount * 0.28;
                        break;
                    case 'lethalMaxHpPct':
                        offense += amount * 8;
                        break;
                    case 'maxHp':
                    case 'shieldMax':
                    case 'physicalDefense':
                    case 'magicDefense':
                    case 'fireDefense':
                    case 'lightningDefense':
                    case 'poisonDefense':
                    case 'iceDefense':
                    case 'shieldRegen':
                    case 'hpRegen':
                    case 'damageReduction':
                    case 'dodgeChance':
                        defense += 1;
                        break;
                    case 'moveSpeed':
                    case 'pickupRange':
                    case 'luck':
                    case 'xpGain':
                    case 'resourceGain':
                    case 'attackRange':
                    case 'bulletSpeed':
                        utility += 1;
                        break;
                    default:
                        break;
                }
            } else {
                switch (effect.stat) {
                    case 'attackPower':
                        drawback += Math.abs(amount) / 14;
                        break;
                    case 'attackSpeed':
                    case 'damageReduction':
                        drawback += Math.abs(amount) * 4;
                        break;
                    case 'maxHp':
                    case 'shieldMax':
                        drawback += Math.abs(amount) / 80;
                        break;
                    case 'moveSpeed':
                    case 'physicalDefense':
                    case 'magicDefense':
                    case 'fireDefense':
                    case 'lightningDefense':
                    case 'poisonDefense':
                    case 'iceDefense':
                        drawback += Math.abs(amount) / 45;
                        break;
                    default:
                        drawback += 0.05;
                        break;
                }
            }
        }

        multiplier += Math.min(0.52, offense * 0.18);
        if (offense < 0.3 && defense > 0) multiplier -= 0.08;
        if (offense < 0.35 && utility > 0) multiplier -= 0.12;
        multiplier -= Math.min(0.14, drawback * 0.06);
        return this.clamp(multiplier, 0.72, 1.55);
    }

    private getBulletDamage() {
        return Math.max(2, this.getCharacterStats().attackPower);
    }

    private getFireInterval() {
        const attackSpeed = this.clamp(this.getCharacterStats().attackSpeed, -0.55, 4.5);
        return Math.max(0.07, 0.54 / (1 + attackSpeed));
    }

    private getBulletSpeed() {
        return Math.max(260, this.getCharacterStats().bulletSpeed);
    }

    private getBulletPierce() {
        const pierce = Math.max(0, this.getCharacterStats().pierce);
        const guaranteed = Math.floor(pierce);
        return guaranteed + (Math.random() < pierce - guaranteed ? 1 : 0);
    }

    private getOwnedWeapons() {
        return WEAPON_CATALOG.filter((equipment) => this.ownedEquipment.has(equipment.id));
    }

    private getOwnedWeaponCount() {
        return this.getOwnedWeapons().length;
    }

    private getEquippedEquipmentDefs() {
        const equipment: EquipmentDef[] = [];
        for (const id of this.equippedEquipment) {
            const found = this.findEquipment(id);
            if (found && this.ownedEquipment.has(found.id)) {
                equipment.push(found);
            }
        }
        return equipment;
    }

    private getEquippedWeapons() {
        return this.getEquippedEquipmentDefs().filter((equipment) => equipment.kind === 'weapon');
    }

    private getEquippedGear() {
        return this.getEquippedEquipmentDefs().filter((equipment) => equipment.kind === 'gear');
    }

    private getEquippedGearForSlot(slot: GearSlot) {
        return this.getEquippedGear().find((equipment) => equipment.gearSlot === slot) || null;
    }

    private getActiveWeapon() {
        const weapons = this.getEquippedWeapons();
        if (weapons.length <= 0) return null;
        this.activeWeaponIndex = this.clamp(this.activeWeaponIndex, 0, weapons.length - 1);
        return weapons[this.activeWeaponIndex] || weapons[0] || null;
    }

    private switchActiveWeapon() {
        if (this.phase !== 'combat') return;
        const weapons = this.getEquippedWeapons();
        if (weapons.length <= 1) {
            this.showToast('只携带 1 把武器，无法切换。');
            return;
        }
        const current = this.getActiveWeapon();
        if (current) this.weaponCooldowns[current.id] = Math.max(0, this.shotTimer);
        this.activeWeaponIndex = (this.activeWeaponIndex + 1) % weapons.length;
        const next = this.getActiveWeapon();
        this.shotTimer = next ? Math.min(this.weaponCooldowns[next.id] ?? 0.18, this.getFireInterval()) : 0.18;
        this.playerWeaponFrameName = '';
        this.updatePlayerWeaponVisual();
        this.playSfx('sfx_ui_click', 0.42, 0.08);
        this.showToast(next ? `切换武器：${next.name}` : '已切换武器。');
        this.refreshHud();
    }

    private getWeaponStat(stat: keyof WeaponStats) {
        const weapon = this.getActiveWeapon();
        return weapon ? (weapon.weaponStats?.[stat] || 0) * this.getEquipmentLevel(weapon.id) : 0;
    }

    private getVisibleHangarEquipment() {
        const list = this.getWarehouseEquipmentList();
        const maxPage = this.getEquipmentPageCount() - 1;
        this.equipmentPage = this.clamp(this.equipmentPage, 0, Math.max(0, maxPage));
        const start = this.equipmentPage * HANGAR_EQUIPMENT_SLOTS;
        return list.slice(start, start + HANGAR_EQUIPMENT_SLOTS);
    }

    private getWarehouseEquipmentList() {
        return [...EQUIPMENT].sort((a, b) => {
            const aScore = this.getWarehouseSortScore(a);
            const bScore = this.getWarehouseSortScore(b);
            if (aScore !== bScore) return aScore - bScore;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
    }

    private getWarehouseSortScore(equipment: EquipmentDef) {
        if (this.isEquipped(equipment.id)) return 0;
        if (this.ownedEquipment.has(equipment.id) && this.getEquipmentLevel(equipment.id) < equipment.maxLevel) return 1;
        if (this.ownedEquipment.has(equipment.id)) return 2;
        if (equipment.kind === 'weapon') return 3;
        return 4 + Math.max(0, GEAR_SLOT_ORDER.indexOf(equipment.gearSlot || 'accessory'));
    }

    private getEquipmentPageCount() {
        return Math.max(1, Math.ceil(this.getWarehouseEquipmentList().length / HANGAR_EQUIPMENT_SLOTS));
    }

    private getSelectedEquipment() {
        return this.findEquipment(this.selectedEquipmentId) || this.visibleHangarEquipment[0] || EQUIPMENT[0] || null;
    }

    private findEquipment(id: string | undefined) {
        if (!id) return null;
        for (const equipment of EQUIPMENT) {
            if (equipment.id === id) return equipment;
        }
        return null;
    }

    private isEquipped(id: string) {
        return this.equippedEquipment.indexOf(id) >= 0;
    }

    private getCharacterStats(): CharacterStats {
        const stats = createBaseCharacterStats();
        this.addCharacterStats(stats, this.runStats);

        stats.attackPower += this.getWeaponStat('damage');
        stats.attackSpeed += this.getWeaponStat('fireRate') * 0.035;
        stats.bulletSpeed += this.getWeaponStat('bulletSpeed') * 18;
        stats.pierce += Math.floor(Math.sqrt(Math.max(0, this.getWeaponStat('pierce'))) / 1.4);
        stats.multiShot += this.getWeaponStat('multiShot');
        stats.dronePower += this.getWeaponStat('drone');

        for (const gear of this.getEquippedGear()) {
            const level = this.getEquipmentLevel(gear.id);
            for (const effect of gear.gearStats || []) {
                stats[effect.stat] += effect.amount * level;
            }
        }

        stats.attackPower = Math.max(2, stats.attackPower);
        stats.attackSpeed = this.clamp(stats.attackSpeed, -0.55, 4.5);
        stats.attackRange = this.clamp(stats.attackRange, 180, 1500);
        stats.critChance = this.clamp(stats.critChance + stats.luck * 0.00045, 0, 0.86);
        stats.critDamage = Math.max(2, stats.critDamage);
        stats.lethalChance = this.clamp(stats.lethalChance + stats.luck * 0.00012, 0, 0.28);
        stats.lethalDamage = Math.max(2.5, stats.lethalDamage);
        stats.lethalMaxHpPct = this.clamp(stats.lethalMaxHpPct, 0.05, 0.16);
        stats.damageReduction = this.clamp(stats.damageReduction, -0.35, 0.72);
        stats.dodgeChance = this.clamp(stats.dodgeChance + stats.luck * 0.0002, 0, 0.72);
        stats.xpGain = this.clamp(stats.xpGain + stats.luck * 0.001, -0.5, 3);
        stats.resourceGain = this.clamp(stats.resourceGain + stats.luck * 0.0014, -0.6, 4);
        return stats;
    }

    private addCharacterStats(target: CharacterStats, source: CharacterStats) {
        for (const key of Object.keys(target) as StatKey[]) {
            target[key] += source[key];
        }
    }

    private getMoveSpeed() {
        return Math.max(96, this.getCharacterStats().moveSpeed);
    }

    private getPickupRadius() {
        return Math.max(42, this.getCharacterStats().pickupRange);
    }

    private getArmor() {
        const stats = this.getCharacterStats();
        return stats.physicalDefense + stats.magicDefense * 0.5;
    }

    private getMaxHp() {
        return Math.max(60, this.getCharacterStats().maxHp);
    }

    private getShieldMax() {
        return Math.max(0, this.getCharacterStats().shieldMax);
    }

    private getAttackRange() {
        return Math.max(220, this.getCharacterStats().attackRange);
    }

    private getEquipmentLevel(id: string) {
        if (!this.ownedEquipment.has(id)) return 0;
        return Math.max(1, Math.floor(this.equipmentLevels[id] || 1));
    }

    private getActiveEquipmentLevel(id: string) {
        if (!this.isEquipped(id)) return 0;
        return this.getEquipmentLevel(id);
    }

    private getUpgradeCost(equipment: EquipmentDef) {
        const level = this.getEquipmentLevel(equipment.id);
        const cost = this.createEmptyWallet();
        if (equipment.kind === 'weapon') {
            cost.shards = Math.ceil(level * 1.8 + equipment.baseCost / 38);
            cost.circuits = Math.ceil(level * 1.05 + equipment.baseCost / 70);
        } else {
            const slot = equipment.gearSlot || 'accessory';
            const base = Math.max(1, equipment.baseCost);
            if (slot === 'hat') {
                cost.circuits = Math.ceil(level * 1.25 + base / 58);
                cost.shards = Math.ceil(level * 1.1 + base / 64);
            } else if (slot === 'armor') {
                cost.biomass = Math.ceil(level * 1.65 + base / 46);
                cost.cores = Math.max(cost.cores, Math.floor(level / 4));
            } else if (slot === 'boots') {
                cost.biomass = Math.ceil(level * 1.15 + base / 60);
                cost.circuits = Math.ceil(level * 1.1 + base / 68);
            } else {
                cost.shards = Math.ceil(level * 1.45 + base / 48);
                cost.circuits = Math.ceil(level * 0.9 + base / 78);
            }
        }
        if (level >= 4) cost.cores = Math.ceil((level - 3) / 2);
        if (level >= 7) cost.crystals = Math.ceil((level - 6) / 2);
        return cost;
    }

    private getCraftCost(equipment: EquipmentDef) {
        const cost = this.createEmptyWallet();
        if (equipment.kind === 'weapon') {
            cost.shards = 18 + Math.ceil(equipment.baseCost / 14);
            cost.circuits = 6 + Math.ceil(equipment.baseCost / 26);
        } else {
            const slot = equipment.gearSlot || 'accessory';
            if (slot === 'hat') {
                cost.circuits = 6 + Math.ceil(equipment.baseCost / 28);
                cost.shards = 8 + Math.ceil(equipment.baseCost / 35);
            } else if (slot === 'armor') {
                cost.biomass = 10 + Math.ceil(equipment.baseCost / 24);
                cost.cores = equipment.baseCost >= 120 ? 2 : equipment.baseCost >= 70 ? 1 : 0;
            } else if (slot === 'boots') {
                cost.biomass = 8 + Math.ceil(equipment.baseCost / 32);
                cost.circuits = 5 + Math.ceil(equipment.baseCost / 40);
            } else {
                cost.shards = 12 + Math.ceil(equipment.baseCost / 24);
                cost.circuits = 4 + Math.ceil(equipment.baseCost / 52);
            }
        }
        if (equipment.baseCost >= 60) cost.crystals = 1;
        if (equipment.baseCost >= 160) cost.crystals += 1;
        return cost;
    }

    private createEmptyWallet(): ResourceWallet {
        return { ...RESOURCE_ZERO };
    }

    private hasResources(cost: ResourceWallet) {
        return this.cores >= cost.cores
            && this.shards >= cost.shards
            && this.biomass >= cost.biomass
            && this.circuits >= cost.circuits
            && this.crystals >= cost.crystals;
    }

    private spendResources(cost: ResourceWallet) {
        this.cores -= cost.cores;
        this.shards -= cost.shards;
        this.biomass -= cost.biomass;
        this.circuits -= cost.circuits;
        this.crystals -= cost.crystals;
    }

    private formatCost(cost: ResourceWallet) {
        return this.formatWallet(cost);
    }

    private loadProgress() {
        this.ownedEquipment = new Set(STARTER_EQUIPMENT_IDS);
        this.equippedEquipment = [...STARTER_EQUIPMENT_IDS];
        this.shards = 24;
        this.biomass = 12;
        this.circuits = 10;
        this.crystals = 0;
        this.equipmentLevels = {};
        for (const id of STARTER_EQUIPMENT_IDS) this.equipmentLevels[id] = 1;
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.battlesWon = Math.max(0, Number(data.battlesWon) || 0);
            this.alloy = 0;
            this.cores = Math.max(0, Number(data.cores) || 0);
            this.shards = Math.max(0, Number(data.shards) || this.shards);
            this.biomass = Math.max(0, Number(data.biomass) || this.biomass);
            this.circuits = Math.max(0, Number(data.circuits) || this.circuits);
            this.crystals = Math.max(0, Number(data.crystals) || 0);
            if (Array.isArray(data.ownedEquipment)) {
                this.ownedEquipment = new Set(data.ownedEquipment);
            }
            if (data.equipmentLevels && typeof data.equipmentLevels === 'object') {
                this.equipmentLevels = data.equipmentLevels;
            }
            if (Array.isArray(data.equippedEquipment)) {
                this.equippedEquipment = data.equippedEquipment.filter((id: string) => typeof id === 'string');
            }
            for (const id of STARTER_EQUIPMENT_IDS) {
                this.ownedEquipment.add(id);
                this.equipmentLevels[id] = Math.max(1, this.getEquipmentLevel(id));
            }
            this.normalizeEquippedEquipment();
        } catch (error) {
            console.warn('Failed to load rogue shooter progress', error);
        }
    }

    private normalizeEquippedEquipment() {
        const weapons: string[] = [];
        const gearBySlot: Partial<Record<GearSlot, string>> = {};
        for (const id of this.equippedEquipment) {
            if (weapons.indexOf(id) >= 0) continue;
            const equipment = this.findEquipment(id);
            if (!equipment || !this.ownedEquipment.has(equipment.id)) continue;
            if (equipment.kind === 'weapon') {
                if (weapons.length >= MAX_EQUIPPED_WEAPONS) continue;
                weapons.push(equipment.id);
                continue;
            }

            if (!equipment.gearSlot || gearBySlot[equipment.gearSlot]) continue;
            gearBySlot[equipment.gearSlot] = equipment.id;
        }

        if (weapons.length <= 0 && this.ownedEquipment.has('storm-rifle')) {
            weapons.unshift('storm-rifle');
        }

        this.equippedEquipment = [
            ...weapons,
            ...GEAR_SLOT_ORDER
                .map((slot) => gearBySlot[slot])
                .filter((id): id is string => !!id),
        ].slice(0, EQUIPPED_SLOT_COUNT);
        this.activeWeaponIndex = this.clamp(this.activeWeaponIndex, 0, Math.max(0, weapons.length - 1));
        if (!this.findEquipment(this.selectedEquipmentId)) {
            this.selectedEquipmentId = this.equippedEquipment[0] || 'storm-rifle';
        }
    }

    private saveProgress() {
        try {
            sys.localStorage.setItem(SAVE_KEY, JSON.stringify({
                battlesWon: this.battlesWon,
                cores: this.cores,
                shards: this.shards,
                biomass: this.biomass,
                circuits: this.circuits,
                crystals: this.crystals,
                ownedEquipment: [...this.ownedEquipment],
                equippedEquipment: this.equippedEquipment,
                equipmentLevels: this.equipmentLevels,
            }));
        } catch (error) {
            console.warn('Failed to save rogue shooter progress', error);
        }
    }

    private clearWorld() {
        for (const enemy of this.enemies) enemy.node.destroy();
        for (const bullet of [...this.bullets]) this.recycleBullet(bullet, true);
        for (const projectile of [...this.enemyProjectiles]) this.recycleEnemyProjectile(projectile, true);
        for (const pickup of this.pickups) pickup.node.destroy();
        for (const floatingText of [...this.floatingTexts]) this.recycleFloatingText(floatingText, true);
        this.clearDroneVisuals();
        if (this.playerNode) this.playerNode.destroy();
        this.enemies = [];
        this.bullets = [];
        this.enemyProjectiles = [];
        this.pickups = [];
        this.floatingTexts = [];
        this.playerNode = null;
        this.playerGfx = null;
        this.playerSprite = null;
        this.playerWeaponSprite = null;
        this.playerWeaponFrameName = '';
        this.cameraX = 0;
        this.cameraY = 0;
        if (this.worldNode) this.worldNode.setPosition(0, 0, 0);
    }

    private removeBullet(bullet: Bullet) {
        this.recycleBullet(bullet, true);
    }

    private recycleBullet(bullet: Bullet, removeFromActive: boolean) {
        if (removeFromActive) {
            const index = this.bullets.indexOf(bullet);
            if (index >= 0) this.bullets.splice(index, 1);
        }
        bullet.hitIds.clear();
        bullet.gfx.clear();
        bullet.node.active = false;
        this.bulletPool.push(bullet);
    }

    private removePickup(pickup: Pickup) {
        const index = this.pickups.indexOf(pickup);
        if (index >= 0) this.pickups.splice(index, 1);
        pickup.node.destroy();
    }

    private onKeyDown(event: EventKeyboard) {
        this.unlockAudio();
        this.pressedKeys.add(event.keyCode);
        if (event.keyCode === KeyCode.ESCAPE) {
            if (this.phase === 'combat') this.pauseCombat();
            else if (this.phase === 'paused') this.resumeFromPause();
            else if (this.phase === 'hangar') this.openMainMenu();
            return;
        }
        if (event.keyCode === KeyCode.KEY_Q || event.keyCode === KeyCode.KEY_E) {
            this.switchActiveWeapon();
        }
    }

    private toggleDebugHud() {
        this.debugHudEnabled = !this.debugHudEnabled;
        if (this.debugLabel && !this.debugHudEnabled) {
            this.debugLabel.node.active = false;
            this.debugLabel.string = '';
        }
        this.showToast(this.debugHudEnabled ? '调试 HUD 已开启。' : '调试 HUD 已关闭。');
    }

    private onKeyUp(event: EventKeyboard) {
        this.pressedKeys.delete(event.keyCode);
    }

    private onTouchStart(event: EventTouch) {
        this.unlockAudio();
        if (this.phase !== 'combat') return;
        const location = event.getUILocation();
        this.touchActive = true;
        this.touchOrigin.set(location.x, location.y);
        this.updateTouchVector(location);
    }

    private onTouchMove(event: EventTouch) {
        if (!this.touchActive || this.phase !== 'combat') return;
        this.updateTouchVector(event.getUILocation());
    }

    private onTouchEnd() {
        this.touchActive = false;
        this.touchVector.set(0, 0);
        this.updateJoystickView();
    }

    private updateTouchVector(location: Vec2) {
        const dx = location.x - this.touchOrigin.x;
        const dy = location.y - this.touchOrigin.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 8) {
            this.touchVector.set(0, 0);
            return;
        }
        const capped = Math.min(1, len / 64);
        this.touchVector.set((dx / len) * capped, (dy / len) * capped);
    }

    private updateToast(dt: number) {
        if (this.toastTimer <= 0) return;
        this.toastTimer -= dt;
        if (this.toastTimer <= 0 && this.toastLabel) {
            this.toastLabel.string = '';
        }
    }

    private showToast(message: string) {
        if (!this.toastLabel) return;
        this.toastLabel.string = message;
        this.toastTimer = 2.5;
    }

    private button(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
        disabledColor: string,
        onClick: () => void,
        local = false,
    ): ButtonView {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        if (local) {
            const parentTransform = parent.getComponent(UITransform);
            this.placeLocal(node, x + width / 2, y + height / 2, parentTransform?.width ?? width, parentTransform?.height ?? height);
        } else {
            this.place(node, x + width / 2, y + height / 2);
        }
        node.addComponent(UITransform).setContentSize(width, height);
        const gfx = node.addComponent(Graphics);
        const label = this.label(node, `${name}_Label`, '', 0, 0, width, height, 18, '#F8FAFC', Label.HorizontalAlign.CENTER, true);
        const view: ButtonView = { node, gfx, label, width, height, color, disabledColor, disabled: false };
        this.drawButton(view, false);

        node.on(Node.EventType.TOUCH_START, () => {
            if (!view.disabled) node.setScale(new Vec3(0.97, 0.97, 1));
        }, this);
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(Vec3.ONE), this);
        node.on(Node.EventType.TOUCH_END, () => {
            node.setScale(Vec3.ONE);
            if (!view.disabled) {
                this.unlockAudio();
                this.playSfx('sfx_ui_click', 0.55, 0.045);
                onClick();
            }
        }, this);

        return view;
    }

    private drawButton(button: ButtonView, disabled: boolean) {
        button.disabled = disabled;
        const mainColor = disabled ? button.disabledColor : button.color;
        button.gfx.clear();
        button.gfx.fillColor = this.hex('#020617', disabled ? 50 : 105);
        button.gfx.roundRect(-button.width / 2 + 6, -button.height / 2 + 7, button.width, button.height, 14);
        button.gfx.fill();
        button.gfx.fillColor = this.hex(mainColor, disabled ? 145 : 255);
        button.gfx.roundRect(-button.width / 2, -button.height / 2, button.width, button.height, 14);
        button.gfx.fill();
        button.gfx.fillColor = this.hex('#F8FAFC', disabled ? 24 : 62);
        button.gfx.roundRect(-button.width / 2 + 10, -button.height / 2 + 8, button.width - 20, 12, 6);
        button.gfx.fill();
        button.gfx.strokeColor = this.hex('#0F172A', disabled ? 90 : 185);
        button.gfx.lineWidth = 3;
        button.gfx.roundRect(-button.width / 2, -button.height / 2, button.width, button.height, 14);
        button.gfx.stroke();
        button.label.color = this.hex(disabled ? '#E2E8F0' : '#F8FAFC', disabled ? 185 : 255);
    }

    private rect(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
        radius = 0,
        strokeColor?: string,
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        this.place(node, x + width / 2, y + height / 2);
        node.addComponent(UITransform).setContentSize(width, height);
        const gfx = node.addComponent(Graphics);
        gfx.fillColor = this.hex(color);
        if (radius > 0) {
            gfx.roundRect(-width / 2, -height / 2, width, height, radius);
        } else {
            gfx.rect(-width / 2, -height / 2, width, height);
        }
        gfx.fill();
        if (strokeColor) {
            gfx.lineWidth = 3;
            gfx.strokeColor = this.hex(strokeColor);
            if (radius > 0) {
                gfx.roundRect(-width / 2, -height / 2, width, height, radius);
            } else {
                gfx.rect(-width / 2, -height / 2, width, height);
            }
            gfx.stroke();
        }
        return node;
    }

    private label(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
        color: string,
        align = Label.HorizontalAlign.CENTER,
        local = false,
    ): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        if (local) {
            const parentTransform = parent.getComponent(UITransform);
            this.placeLocal(node, x + width / 2, y + height / 2, parentTransform?.width ?? width, parentTransform?.height ?? height);
        } else {
            this.place(node, x + width / 2, y + height / 2);
        }
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.18);
        label.color = this.hex(color);
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = true;
        return label;
    }

    private place(node: Node, designX: number, designY: number) {
        node.setPosition(designX - DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - designY, 0);
    }

    private placeLocal(node: Node, localX: number, localY: number, parentWidth: number, parentHeight: number) {
        node.setPosition(localX - parentWidth / 2, parentHeight / 2 - localY, 0);
    }

    private hex(hex: string, alpha = 255): Color {
        const color = new Color();
        color.fromHEX(hex.startsWith('#') ? hex.slice(1) : hex);
        color.a = alpha;
        return color;
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }

    private distanceSq(ax: number, ay: number, bx: number, by: number) {
        const dx = ax - bx;
        const dy = ay - by;
        return dx * dx + dy * dy;
    }

    private randomRange(min: number, max: number) {
        return min + Math.random() * (max - min);
    }

    private randomInt(min: number, max: number) {
        return Math.floor(this.randomRange(min, max + 1));
    }

    private shuffle<T>(items: T[]): T[] {
        const array = [...items];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

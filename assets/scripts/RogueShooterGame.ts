import {
    _decorator,
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
    resources,
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
const ARENA_LEFT = -338;
const ARENA_RIGHT = 338;
const ARENA_BOTTOM = -516;
const ARENA_TOP = 482;
const PLACEHOLDER_ART_DIR = 'art/placeholder';
const HANGAR_EQUIPMENT_SLOTS = 8;
const EQUIPPED_SLOT_COUNT = 6;
const MAX_EQUIPPED_WEAPONS = 4;
const MAX_EQUIPPED_GEAR = 2;
const FLOATING_TEXT_LIMIT = 90;
const ENDLESS_CYCLE_DURATION = 82;
const BOSS_WARNING_TIME = 18;

type GamePhase = 'combat' | 'level-up' | 'loot' | 'hangar';
type BattleEndReason = 'death' | 'extract';
type ResourceType = 'alloy' | 'cores' | 'shards' | 'biomass' | 'circuits' | 'crystals';
type PickupType = 'xp' | ResourceType;
type EquipmentKind = 'weapon' | 'gear';

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
    elite: boolean;
    boss: boolean;
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

interface WeaponStats {
    damage: number;
    fireRate: number;
    pierce: number;
    multiShot: number;
    drone: number;
    bulletSpeed: number;
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
}

interface LevelUpgrade {
    id: string;
    name: string;
    desc: string;
    color: string;
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
        for (const variant of ENEMY_VARIANTS) {
            const suffix = variant.id ? `-${variant.id}` : '';
            enemies.push({
                ...base,
                id: `${base.id}${suffix}`,
                name: `${variant.prefix}${base.name}`,
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

function buildWeaponCatalog(): EquipmentDef[] {
    const weapons: EquipmentDef[] = [];
    for (const family of WEAPON_FAMILIES) {
        for (const variant of WEAPON_VARIANTS) {
            const legacyIds = ['storm-rifle', 'split-barrel', 'orbital-drone'];
            const legacyId = variant.id === '' && legacyIds.indexOf(family.id) >= 0;
            const id = legacyId ? family.id : `${family.id}${variant.id ? `-${variant.id}` : '-standard'}`;
            const name = `${variant.prefix}${family.name}`;
            weapons.push({
                id,
                name,
                kind: 'weapon',
                color: family.color,
                maxLevel: 6 + Math.ceil(variant.tier / 2),
                baseCost: Math.round(family.cost * variant.cost),
                desc: `${family.desc} T${variant.tier} 型。`,
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

const CORE_GEAR: EquipmentDef[] = [
    {
        id: 'magnet-coil',
        name: '磁吸线圈',
        kind: 'gear',
        color: '#577590',
        maxLevel: 8,
        baseCost: 34,
        desc: '扩大经验和资源拾取范围。',
    },
    {
        id: 'phase-armor',
        name: '相位护甲',
        kind: 'gear',
        color: '#F8961E',
        maxLevel: 8,
        baseCost: 46,
        desc: '增加生命和减伤。',
    },
    {
        id: 'kinetic-boots',
        name: '动能靴',
        kind: 'gear',
        color: '#43AA8B',
        maxLevel: 8,
        baseCost: 42,
        desc: '提升移动速度和闪避空间。',
    },
    {
        id: 'reactor-core',
        name: '反应堆芯',
        kind: 'gear',
        color: '#F94144',
        maxLevel: 6,
        baseCost: 68,
        desc: '提高弹速、伤害和后期上限。',
    },
    {
        id: 'vampire-chip',
        name: '汲能芯片',
        kind: 'gear',
        color: '#B5179E',
        maxLevel: 6,
        baseCost: 64,
        desc: '击杀时少量恢复生命。',
    },
];

const WEAPON_CATALOG: EquipmentDef[] = buildWeaponCatalog();
const EQUIPMENT: EquipmentDef[] = [...WEAPON_CATALOG, ...CORE_GEAR];
const BOSS_ENEMY_COUNT = 1;
const TOTAL_ENEMY_TYPES = ENEMY_SPECS.length + BOSS_ENEMY_COUNT;
const WEAPON_COUNT = WEAPON_CATALOG.length;

const LEVEL_UPGRADES: LevelUpgrade[] = [
    { id: 'damage', name: '高能弹头', desc: '本局武器伤害 +25%', color: '#F94144' },
    { id: 'fire-rate', name: '急速扳机', desc: '本局射击间隔缩短', color: '#4CC9F0' },
    { id: 'move', name: '滑步模组', desc: '本局移动速度 +32', color: '#43AA8B' },
    { id: 'hp', name: '应急护盾', desc: '本局最大生命 +28 并治疗', color: '#F8961E' },
    { id: 'magnet', name: '拾荒磁场', desc: '本局拾取范围 +42', color: '#577590' },
    { id: 'pierce', name: '穿甲线圈', desc: '子弹穿透 +1', color: '#F15BB5' },
    { id: 'multi', name: '双联开火', desc: '追加一枚并行弹道', color: '#F9C74F' },
    { id: 'regen', name: '纳米修复', desc: '每秒缓慢恢复生命', color: '#90BE6D' },
];

@ccclass('RogueShooterGame')
export class RogueShooterGame extends Component {
    private canvasNode: Node | null = null;
    private worldNode: Node | null = null;
    private playerNode: Node | null = null;
    private playerGfx: Graphics | null = null;
    private playerSprite: Sprite | null = null;
    private joystickBase: Node | null = null;
    private joystickKnob: Node | null = null;
    private joystickBaseGfx: Graphics | null = null;
    private joystickKnobGfx: Graphics | null = null;

    private titleLabel: Label | null = null;
    private timerLabel: Label | null = null;
    private statLabel: Label | null = null;
    private equipmentLabel: Label | null = null;
    private toastLabel: Label | null = null;
    private hpBar: Graphics | null = null;
    private xpBar: Graphics | null = null;
    private levelPanel: Node | null = null;
    private levelPanelShadow: Node | null = null;
    private levelTitleLabel: Label | null = null;
    private levelChoiceButtons: ButtonView[] = [];
    private hangarPanel: Node | null = null;
    private hangarPanelShadow: Node | null = null;
    private hangarTitleLabel: Label | null = null;
    private hangarStatsLabel: Label | null = null;
    private hangarTipLabel: Label | null = null;
    private lootButtons: ButtonView[] = [];
    private equipmentButtons: ButtonView[] = [];
    private equippedButtons: ButtonView[] = [];
    private extractButton: ButtonView | null = null;
    private prevEquipmentButton: ButtonView | null = null;
    private nextEquipmentButton: ButtonView | null = null;
    private equipActionButton: ButtonView | null = null;
    private upgradeActionButton: ButtonView | null = null;
    private visibleHangarEquipment: EquipmentDef[] = [];
    private equipmentDetailLabel: Label | null = null;
    private startButton: ButtonView | null = null;
    private artFrames = new Map<string, SpriteFrame>();

    private phase: GamePhase = 'hangar';
    private battleIndex = 1;
    private battlesWon = 0;
    private alloy = 72;
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
    private playerHp = 180;
    private playerMaxHp = 180;
    private playerRadius = 18;
    private invulnerableTimer = 0;
    private shotTimer = 0;
    private droneTimer = 0;
    private regenTimer = 0;
    private shotCounter = 0;

    private combatTime = 0;
    private cycleTime = 0;
    private endlessCycle = 1;
    private spawnTimer = 0.2;
    private surgeTimer = 7;
    private bossSpawned = false;
    private nextEnemyId = 1;
    private enemies: Enemy[] = [];
    private bullets: Bullet[] = [];
    private pickups: Pickup[] = [];
    private floatingTexts: FloatingText[] = [];
    private killCount = 0;
    private battleAlloy = 0;
    private battleCores = 0;
    private battleShards = 0;
    private battleBiomass = 0;
    private battleCircuits = 0;
    private battleCrystals = 0;
    private level = 1;
    private xp = 0;
    private xpToNext = 16;
    private pendingLevelChoices: LevelUpgrade[] = [];
    private pendingLootChoices: LootChoice[] = [];

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
        this.updateFloatingTexts(dt);
        if (this.phase === 'combat') {
            this.combatTime += dt;
            this.cycleTime += dt;
            this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
            this.updatePlayer(dt);
            this.updateSpawning(dt);
            this.updateWeapons(dt);
            this.updateBullets(dt);
            this.updateEnemies(dt);
            this.updatePickups(dt);
            this.updateRegen(dt);
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

        this.buildHud(root);
        this.buildLevelPanel(root);
        this.buildHangarPanel(root);
        this.buildJoystick(root);
    }

    private loadPlaceholderArt(done: () => void) {
        resources.loadDir(PLACEHOLDER_ART_DIR, SpriteFrame, (error, frames) => {
            if (error) {
                console.warn('Failed to load placeholder art, falling back to Graphics', error);
                done();
                return;
            }

            for (const frame of frames) {
                this.artFrames.set(frame.name, frame);
            }
            done();
        });
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

    private pickupArtName(type: PickupType) {
        if (type === 'cores') return 'pickup_core';
        return `pickup_${type}`;
    }

    private drawArena(root: Node) {
        this.rect(root, 'ArenaBase', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, '#0B1020');
        this.rect(root, 'ArenaFloor', 18, 176, 684, 1064, '#121827', 22, '#334155');
        this.rect(root, 'NorthGate', 116, 196, 488, 58, '#1E293B', 18, '#475569');
        this.rect(root, 'SouthGate', 116, 1156, 488, 58, '#1E293B', 18, '#475569');

        const grid = new Node('ArenaGrid');
        grid.layer = Layers.Enum.UI_2D;
        root.addChild(grid);
        grid.setPosition(0, 0, 0);
        const gfx = grid.addComponent(Graphics);
        gfx.lineWidth = 2;
        gfx.strokeColor = this.hex('#243247', 150);
        for (let x = -320; x <= 320; x += 80) {
            gfx.moveTo(x, ARENA_BOTTOM);
            gfx.lineTo(x, ARENA_TOP);
        }
        for (let y = -480; y <= 480; y += 80) {
            gfx.moveTo(ARENA_LEFT, y);
            gfx.lineTo(ARENA_RIGHT, y);
        }
        gfx.stroke();

        gfx.lineWidth = 4;
        gfx.strokeColor = this.hex('#4CC9F0', 120);
        gfx.roundRect(ARENA_LEFT, ARENA_BOTTOM, ARENA_RIGHT - ARENA_LEFT, ARENA_TOP - ARENA_BOTTOM, 28);
        gfx.stroke();

        gfx.fillColor = this.hex('#334155', 90);
        for (let i = 0; i < 12; i++) {
            const x = -290 + (i % 4) * 188;
            const y = -390 + Math.floor(i / 4) * 270;
            gfx.roundRect(x - 26, y - 7, 52, 14, 7);
            gfx.fill();
        }
    }

    private buildHud(root: Node) {
        this.rect(root, 'HudShadow', 28, 24, 664, 128, '#020617', 18);
        this.rect(root, 'HudPanel', 20, 16, 664, 128, '#F8FAFC', 18, '#CBD5E1');
        this.rect(root, 'HudAccent', 42, 34, 8, 42, '#F94144', 4);
        this.titleLabel = this.label(root, 'Title', '星坠幸存者', 58, 26, 290, 48, 30, '#0F172A', Label.HorizontalAlign.LEFT);
        this.timerLabel = this.label(root, 'Timer', '', 440, 28, 210, 40, 28, '#0F172A', Label.HorizontalAlign.RIGHT);
        this.statLabel = this.label(root, 'Stats', '', 58, 78, 596, 28, 18, '#475569', Label.HorizontalAlign.LEFT);
        this.equipmentLabel = this.label(root, 'Equipment', '', 58, 108, 486, 26, 17, '#64748B', Label.HorizontalAlign.LEFT);
        this.extractButton = this.button(root, 'ExtractButton', 560, 104, 104, 34, '#F8961E', '#94A3B8', () => this.extractBattle());
        this.extractButton.label.string = '撤离';

        const hpNode = this.rect(root, 'HpBar', 52, 154, 292, 18, '#1E293B', 9);
        this.hpBar = hpNode.getComponent(Graphics);
        const xpNode = this.rect(root, 'XpBar', 376, 154, 292, 18, '#1E293B', 9);
        this.xpBar = xpNode.getComponent(Graphics);
        this.label(root, 'HpLabel', 'HP', 18, 149, 34, 28, 15, '#CBD5E1');
        this.label(root, 'XpLabel', 'EXP', 344, 149, 38, 28, 15, '#CBD5E1');

        this.rect(root, 'ToastPanelShadow', 46, 1182, 628, 54, '#020617', 14);
        this.rect(root, 'ToastPanel', 36, 1172, 648, 58, '#F8FAFC', 14, '#CBD5E1');
        this.toastLabel = this.label(root, 'Toast', '', 54, 1178, 612, 46, 19, '#0F172A');
    }

    private buildLevelPanel(root: Node) {
        this.levelPanelShadow = this.rect(root, 'LevelPanelShadow', 48, 356, 624, 410, '#020617', 22);
        this.levelPanelShadow.active = false;
        const panel = this.rect(root, 'LevelPanel', 36, 342, 648, 410, '#F8FAFC', 22, '#CBD5E1');
        panel.active = false;
        this.levelPanel = panel;
        this.levelTitleLabel = this.label(panel, 'LevelTitle', '角色升级', 42, 30, 564, 52, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LevelHint', '选择一个本局强化，战斗会继续。', 42, 86, 564, 34, 20, '#475569', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LevelChoice_${i}`, 54, 142 + i * 82, 540, 66, '#4CC9F0', '#94A3B8', () => this.chooseLevelUpgrade(i), true);
            this.levelChoiceButtons.push(button);
        }
    }

    private buildHangarPanel(root: Node) {
        this.hangarPanelShadow = this.rect(root, 'HangarPanelShadow', 36, 196, 648, 936, '#020617', 24);
        this.hangarPanelShadow.active = false;
        const panel = this.rect(root, 'HangarPanel', 24, 184, 672, 936, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.hangarPanel = panel;

        this.hangarTitleLabel = this.label(panel, 'HangarTitle', '', 36, 24, 600, 52, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
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

    private openHome() {
        this.clearWorld();
        this.showHangar('出战槽会同时生效：最多 4 把武器 + 2 件装备。');
    }

    private beginBattle(initial: boolean) {
        if (this.getEquippedWeapons().length <= 0) {
            this.showToast('至少需要携带 1 把武器才能出战。');
            this.showHangar('先从仓库里选择一把武器加入出战。');
            return;
        }

        this.clearWorld();
        this.phase = 'combat';
        this.battleIndex = this.battlesWon + 1;
        this.combatTime = 0;
        this.cycleTime = 0;
        this.endlessCycle = 1;
        this.spawnTimer = 0.15;
        this.surgeTimer = 6.5;
        this.bossSpawned = false;
        this.killCount = 0;
        this.battleAlloy = 0;
        this.battleCores = 0;
        this.battleShards = 0;
        this.battleBiomass = 0;
        this.battleCircuits = 0;
        this.battleCrystals = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 16;
        this.runDamageBonus = 0;
        this.runFireRateBonus = 0;
        this.runMoveSpeedBonus = 0;
        this.runMaxHpBonus = 0;
        this.runPickupBonus = 0;
        this.runPierceBonus = 0;
        this.runMultiShot = 0;
        this.runRegen = 0;
        this.shotTimer = 0;
        this.droneTimer = 0.6;
        this.regenTimer = 0;
        this.shotCounter = 0;
        this.playerX = 0;
        this.playerY = -190;
        this.playerMaxHp = this.getMaxHp();
        this.playerHp = this.playerMaxHp;
        this.invulnerableTimer = 0;
        this.touchActive = false;
        this.touchVector.set(0, 0);

        if (this.hangarPanel) this.hangarPanel.active = false;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = false;
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        if (this.joystickBase) this.joystickBase.active = false;
        if (this.joystickKnob) this.joystickKnob.active = false;
        if (this.extractButton) this.extractButton.node.active = true;

        this.createPlayer();
        this.spawnPack(12 + Math.min(16, this.battleIndex * 2), false);
        this.refreshHud();
        this.showToast(initial ? '无尽出击开始：撑得越久，带回资源越多。' : `第 ${this.battleIndex} 次出击开始，Boss 阶段会循环增强。`);
    }

    private createPlayer() {
        const node = new Node('Player');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(this.playerX, this.playerY, 10);
        node.addComponent(UITransform).setContentSize(74, 74);
        this.playerNode = node;
        this.playerSprite = this.addSpriteChild(node, 'PlayerArt', 'player_ship', 74, 74);
        this.playerGfx = node.addComponent(Graphics);
        this.drawPlayer();
    }

    private updatePlayer(dt: number) {
        const move = this.getMoveVector();
        const speed = this.getMoveSpeed();
        this.playerX = this.clamp(this.playerX + move.x * speed * dt, ARENA_LEFT + 18, ARENA_RIGHT - 18);
        this.playerY = this.clamp(this.playerY + move.y * speed * dt, ARENA_BOTTOM + 18, ARENA_TOP - 18);
        if (this.playerNode) {
            this.playerNode.setPosition(this.playerX, this.playerY, 10);
        }
        this.drawPlayer();
        this.updateJoystickView();
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
        const enemyCap = Math.min(420, 78 + this.battleIndex * 10 + this.endlessCycle * 24 + Math.floor(this.combatTime * 1.05));
        if (this.enemies.length < enemyCap) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                const pressure = 1 + this.cycleTime / 22 + this.endlessCycle * 0.48 + this.combatTime / 95;
                const count = Math.min(58, 5 + Math.floor(pressure * 4.4) + this.randomInt(0, 5));
                this.spawnPack(count, false);
                this.spawnTimer = Math.max(0.13, 0.86 - this.cycleTime * 0.005 - this.endlessCycle * 0.035 - this.combatTime * 0.0015);
            }

            this.surgeTimer -= dt;
            if (this.surgeTimer <= 0) {
                const count = 24 + Math.min(56, Math.floor(this.cycleTime * 0.64)) + this.endlessCycle * 6;
                this.spawnPack(count, true);
                this.surgeTimer = Math.max(5.6, 13.2 - this.endlessCycle * 0.5);
                this.showToast('怪潮涌入，保持移动不要被围住。');
            }
        }

        if (!this.bossSpawned && this.cycleTime > ENDLESS_CYCLE_DURATION - BOSS_WARNING_TIME) {
            this.bossSpawned = true;
            this.spawnBoss();
            this.showToast(`第 ${this.endlessCycle} 轮首领出现，击杀后怪潮会继续增强。`);
        }
    }

    private updateWeapons(dt: number) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
            const target = this.findNearestEnemy(760);
            if (target) {
                this.fireAt(target);
                this.shotTimer = this.getFireInterval();
            }
        }

        const dronePower = this.getWeaponStat('drone');
        if (dronePower > 0) {
            this.droneTimer -= dt;
            if (this.droneTimer <= 0) {
                const strikes = Math.min(8, 1 + Math.floor(dronePower / 4));
                for (let i = 0; i < strikes; i++) {
                    const target = this.findNearestEnemy(320 + dronePower * 18);
                    if (target) this.droneStrike(target, dronePower);
                }
                this.droneTimer = Math.max(0.28, 1.18 - Math.min(0.78, dronePower * 0.035));
            }
        }
    }

    private fireAt(target: Enemy) {
        const dx = target.node.position.x - this.playerX;
        const dy = target.node.position.y - this.playerY;
        const baseAngle = Math.atan2(dy, dx);
        const damage = this.getBulletDamage();
        const spreadPower = this.getWeaponStat('multiShot');
        const angles = [baseAngle];
        this.shotCounter += 1;

        if (this.runMultiShot > 0) {
            for (let i = 1; i <= this.runMultiShot; i++) {
                angles.push(baseAngle + i * 0.13, baseAngle - i * 0.13);
            }
        }
        if (spreadPower > 0 && this.shotCounter % Math.max(2, 6 - Math.floor(spreadPower / 1.7)) === 0) {
            angles.push(baseAngle + 0.24, baseAngle - 0.24);
            if (spreadPower >= 4) angles.push(baseAngle + 0.42, baseAngle - 0.42);
            if (spreadPower >= 9) angles.push(baseAngle + 0.6, baseAngle - 0.6);
        }

        for (const angle of angles) {
            this.createBullet(angle, damage, this.getBulletPierce());
        }
    }

    private createBullet(angle: number, damage: number, pierce: number) {
        const speed = this.getBulletSpeed();
        const node = new Node('Bullet');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(24, 24);
        const gfx = node.addComponent(Graphics);
        const sprite = this.addSpriteChild(node, 'BulletArt', 'bullet_plasma', 28, 28);
        const bullet: Bullet = {
            node,
            gfx,
            sprite,
            x: this.playerX,
            y: this.playerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage,
            radius: 7,
            pierce,
            life: 1.45,
            hitIds: new Set<number>(),
        };
        node.setPosition(bullet.x, bullet.y, 6);
        node.angle = angle * 180 / Math.PI;
        this.drawBullet(bullet);
        this.bullets.push(bullet);
    }

    private updateBullets(dt: number) {
        const removing: Bullet[] = [];
        for (const bullet of this.bullets) {
            bullet.life -= dt;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            bullet.node.setPosition(bullet.x, bullet.y, 6);

            if (bullet.life <= 0 || bullet.x < ARENA_LEFT - 90 || bullet.x > ARENA_RIGHT + 90 || bullet.y < ARENA_BOTTOM - 90 || bullet.y > ARENA_TOP + 90) {
                removing.push(bullet);
                continue;
            }

            for (const enemy of this.enemies) {
                if (bullet.hitIds.has(enemy.id)) continue;
                const distSq = this.distanceSq(bullet.x, bullet.y, enemy.node.position.x, enemy.node.position.y);
                const hitRadius = bullet.radius + enemy.radius;
                if (distSq <= hitRadius * hitRadius) {
                    bullet.hitIds.add(enemy.id);
                    this.damageEnemy(enemy, bullet.damage);
                    bullet.pierce -= 1;
                    if (bullet.pierce < 0) {
                        removing.push(bullet);
                        break;
                    }
                }
            }
        }
        for (const bullet of removing) {
            this.removeBullet(bullet);
        }
    }

    private updateEnemies(dt: number) {
        const px = this.playerX;
        const py = this.playerY;
        for (const enemy of [...this.enemies]) {
            const ex = enemy.node.position.x;
            const ey = enemy.node.position.y;
            const dx = px - ex;
            const dy = py - ey;
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            const wobble = Math.sin(this.combatTime * 2.4 + enemy.id * 0.73) * 0.18;
            const vx = dx / dist + (-dy / dist) * wobble;
            const vy = dy / dist + (dx / dist) * wobble;
            enemy.node.setPosition(ex + vx * enemy.speed * dt, ey + vy * enemy.speed * dt, 4);

            const collideRadius = enemy.radius + this.playerRadius;
            if (dist <= collideRadius && this.invulnerableTimer <= 0) {
                this.takeDamage(enemy.damage);
                const push = 26;
                enemy.node.setPosition(ex - dx / dist * push, ey - dy / dist * push, 4);
            }
        }
    }

    private updatePickups(dt: number) {
        const pickupRadius = this.getPickupRadius();
        const removing: Pickup[] = [];
        for (const pickup of this.pickups) {
            const dx = this.playerX - pickup.x;
            const dy = this.playerY - pickup.y;
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            if (dist < pickupRadius) {
                const pull = (pickupRadius - dist) / pickupRadius;
                const speed = 180 + pull * 520;
                pickup.x += (dx / dist) * speed * dt;
                pickup.y += (dy / dist) * speed * dt;
                pickup.node.setPosition(pickup.x, pickup.y, 5);
            }
            if (dist < this.playerRadius + pickup.radius + 8) {
                this.collectPickup(pickup);
                removing.push(pickup);
            }
        }
        for (const pickup of removing) {
            this.removePickup(pickup);
        }
    }

    private updateRegen(dt: number) {
        const chip = this.getActiveEquipmentLevel('vampire-chip');
        const regen = this.runRegen + chip * 0.12;
        if (regen <= 0 || this.playerHp <= 0 || this.playerHp >= this.playerMaxHp) return;
        this.regenTimer += dt;
        if (this.regenTimer >= 1) {
            this.regenTimer = 0;
            this.healPlayer(regen);
        }
    }

    private spawnPack(count: number, ring: boolean) {
        const cap = Math.min(440, 92 + this.endlessCycle * 28 + Math.floor(this.combatTime * 1.12));
        const room = Math.max(0, cap - this.enemies.length);
        const total = Math.min(count, room);
        for (let i = 0; i < total; i++) {
            const spec = this.pickEnemySpec();
            const angle = ring ? (Math.PI * 2 * i) / Math.max(1, total) + Math.random() * 0.16 : Math.random() * Math.PI * 2;
            const radius = ring ? 560 : this.randomRange(480, 610);
            const x = this.clamp(this.playerX + Math.cos(angle) * radius, ARENA_LEFT - 86, ARENA_RIGHT + 86);
            const y = this.clamp(this.playerY + Math.sin(angle) * radius, ARENA_BOTTOM - 86, ARENA_TOP + 86);
            const eliteChance = Math.min(0.28, 0.025 + this.endlessCycle * 0.014 + this.combatTime * 0.0007);
            this.createEnemy(spec, x, y, Math.random() < eliteChance, false);
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
        this.createEnemy(spec, 0, ARENA_TOP + 58, true, true);
    }

    private createEnemy(spec: EnemySpec, x: number, y: number, elite: boolean, boss: boolean) {
        const scale = 1 + this.battleIndex * 0.08 + (this.endlessCycle - 1) * 0.28 + this.combatTime * 0.006;
        const eliteScale = boss ? 5.6 + this.endlessCycle * 0.42 : elite ? 2.35 : 1;
        const hp = Math.round(spec.hp * scale * eliteScale);
        const enemyRadius = spec.radius * (boss ? 1.35 : elite ? 1.18 : 1);
        const node = new Node(`Enemy_${spec.id}_${this.nextEnemyId}`);
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(x, y, 4);
        node.addComponent(UITransform).setContentSize(enemyRadius * 3.5, enemyRadius * 3.5);
        const gfx = node.addComponent(Graphics);
        const sprite = this.addSpriteChild(node, 'EnemyArt', this.enemyArtName(spec, boss), enemyRadius * 3.45, enemyRadius * 3.45);
        const enemy: Enemy = {
            id: this.nextEnemyId++,
            spec,
            node,
            gfx,
            sprite,
            hp,
            maxHp: hp,
            speed: Math.max(42, spec.speed * (boss ? 0.75 : elite ? 0.86 : 1) + this.endlessCycle * 3),
            damage: spec.damage * (boss ? 1.7 : elite ? 1.35 : 1) * (1 + (this.endlessCycle - 1) * 0.13 + this.combatTime * 0.0018),
            radius: enemyRadius,
            elite,
            boss,
        };
        this.drawEnemy(enemy);
        this.enemies.push(enemy);
    }

    private pickEnemySpec(): EnemySpec {
        const available = ENEMY_SPECS.filter((spec) => spec.spawnAfter <= this.cycleTime + (this.endlessCycle - 1) * 12);
        const totalWeight = available.reduce((sum, spec) => sum + spec.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const spec of available) {
            roll -= spec.weight;
            if (roll <= 0) return spec;
        }
        return available[0];
    }

    private damageEnemy(enemy: Enemy, amount: number, color = '#F8FAFC') {
        this.spawnFloatingText(
            `${Math.ceil(amount)}`,
            enemy.node.position.x + this.randomRange(-12, 12),
            enemy.node.position.y + enemy.radius + this.randomRange(8, 20),
            color,
            21,
        );
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            this.killEnemy(enemy);
        } else {
            this.drawEnemy(enemy);
        }
    }

    private droneStrike(enemy: Enemy, dronePower: number) {
        const damage = (12 + dronePower * 3.4 + this.getActiveEquipmentLevel('reactor-core') * 2) * (1 + this.runDamageBonus);
        this.damageEnemy(enemy, damage, '#90BE6D');
        this.drawZap(this.playerX, this.playerY, enemy.node.position.x, enemy.node.position.y);
    }

    private killEnemy(enemy: Enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index >= 0) this.enemies.splice(index, 1);
        const x = enemy.node.position.x;
        const y = enemy.node.position.y;
        enemy.node.destroy();
        this.killCount += 1;
        this.dropPickup('xp', enemy.spec.xp * (enemy.elite ? 2 : 1) * (enemy.boss ? 3 : 1), x, y);

        if (Math.random() < enemy.spec.alloyChance || enemy.elite || enemy.boss) {
            this.dropPickup('alloy', enemy.boss ? 22 : enemy.elite ? 9 : this.randomInt(2, 5), x + this.randomRange(-20, 20), y + this.randomRange(-20, 20));
        }
        if (Math.random() < (enemy.elite ? 0.36 : 0.08)) {
            const material: ResourceType = enemy.spec.family === 'brute' || enemy.spec.family === 'warden' ? 'circuits' : enemy.spec.family === 'runner' ? 'shards' : 'biomass';
            this.dropPickup(material, enemy.elite ? this.randomInt(2, 4) : 1, x + this.randomRange(-18, 18), y + this.randomRange(-18, 18));
        }
        if (enemy.elite && Math.random() < 0.18) {
            this.dropPickup('cores', 1, x + this.randomRange(-16, 16), y + this.randomRange(-16, 16));
        }
        if (enemy.boss) {
            this.dropPickup('cores', 1 + Math.floor(this.endlessCycle / 3), x, y);
            this.dropPickup('shards', 7 + this.endlessCycle * 2, x + 18, y + 8);
            this.dropPickup('crystals', 1 + Math.floor(this.endlessCycle / 2), x - 18, y + 8);
            this.advanceEndlessCycle();
        }
        if (enemy.spec.family === 'splitter' && !enemy.elite && !enemy.boss) {
            for (let i = 0; i < 2; i++) {
                this.createEnemy(ENEMY_SPECS[0], x + this.randomRange(-24, 24), y + this.randomRange(-24, 24), false, false);
            }
        }

        const chip = this.getActiveEquipmentLevel('vampire-chip');
        if (chip > 0) {
            this.healPlayer(0.8 + chip * 0.35);
        }
    }

    private advanceEndlessCycle() {
        this.endlessCycle += 1;
        this.cycleTime = 0;
        this.bossSpawned = false;
        this.spawnTimer = 0.12;
        this.surgeTimer = Math.max(4.2, 8.8 - this.endlessCycle * 0.25);
        this.showToast(`进入无尽第 ${this.endlessCycle} 轮，密度、血量和伤害提升。`);
        this.spawnPack(18 + this.endlessCycle * 3, true);
    }

    private takeDamage(amount: number) {
        const armor = this.getArmor();
        const damage = Math.max(2, amount - armor);
        this.playerHp = Math.max(0, this.playerHp - damage);
        this.invulnerableTimer = 0.42;
        this.spawnFloatingText(`-${Math.ceil(damage)}`, this.playerX, this.playerY + this.playerRadius + 28, '#F94144', 25);
        this.showToast(`受击 -${Math.ceil(damage)}，拉开距离。`);
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
        const node = new Node(`Pickup_${type}`);
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(x, y, 5);
        node.addComponent(UITransform).setContentSize(28, 28);
        const gfx = node.addComponent(Graphics);
        const sprite = this.addSpriteChild(node, 'PickupArt', this.pickupArtName(type), type === 'xp' ? 30 : 34, type === 'xp' ? 30 : 34);
        const pickup: Pickup = {
            node,
            gfx,
            sprite,
            type,
            amount,
            x,
            y,
            radius: type === 'xp' ? 8 : 10,
        };
        this.drawPickup(pickup);
        this.pickups.push(pickup);
    }

    private collectPickup(pickup: Pickup) {
        if (pickup.type === 'xp') {
            this.gainXp(pickup.amount);
        } else {
            this.addBattleResource(pickup.type, pickup.amount);
            if (pickup.type === 'cores' || pickup.type === 'crystals') {
                const resource = this.getResourceDef(pickup.type);
                this.showToast(`获得${resource.name}，撤离后可用于高阶升级。`);
            }
        }
    }

    private gainXp(amount: number) {
        this.xp += amount;
        while (this.xp >= this.xpToNext && this.phase === 'combat') {
            this.xp -= this.xpToNext;
            this.level += 1;
            this.xpToNext = Math.round(this.xpToNext * 1.22 + 7);
            this.openLevelChoices();
        }
    }

    private openLevelChoices() {
        this.phase = 'level-up';
        this.pendingLevelChoices = this.pickLevelChoices();
        if (this.levelPanel) this.levelPanel.active = true;
        if (this.levelPanelShadow) this.levelPanelShadow.active = true;
        if (this.levelTitleLabel) this.levelTitleLabel.string = `角色 Lv.${this.level}`;
        this.levelChoiceButtons.forEach((button, index) => {
            const choice = this.pendingLevelChoices[index];
            button.node.active = true;
            button.color = choice.color;
            button.label.string = `${choice.name}\n${choice.desc}`;
            this.drawButton(button, false);
        });
    }

    private chooseLevelUpgrade(index: number) {
        if (this.phase !== 'level-up') return;
        const choice = this.pendingLevelChoices[index];
        if (!choice) return;
        this.applyLevelUpgrade(choice.id);
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        this.phase = 'combat';
        this.showToast(`获得本局强化：${choice.name}`);
    }

    private applyLevelUpgrade(id: string) {
        switch (id) {
            case 'damage':
                this.runDamageBonus += 0.25;
                break;
            case 'fire-rate':
                this.runFireRateBonus += 0.055;
                break;
            case 'move':
                this.runMoveSpeedBonus += 32;
                break;
            case 'hp':
                this.runMaxHpBonus += 28;
                this.playerMaxHp += 28;
                this.healPlayer(42);
                break;
            case 'magnet':
                this.runPickupBonus += 42;
                break;
            case 'pierce':
                this.runPierceBonus += 1;
                break;
            case 'multi':
                this.runMultiShot = Math.min(2, this.runMultiShot + 1);
                break;
            case 'regen':
                this.runRegen += 1.1;
                break;
            default:
                break;
        }
    }

    private extractBattle() {
        if (this.phase !== 'combat') return;
        this.finishBattle('extract');
    }

    private finishBattle(reason: BattleEndReason) {
        if (this.phase !== 'combat') return;
        const reward = this.calculateEndlessReward(reason);
        this.addWalletToInventory(reward);
        this.battlesWon += 1;
        this.saveProgress();
        this.clearWorld();
        this.openSettlement(reason, reward);
    }

    private openSettlement(reason: BattleEndReason, reward: ResourceWallet) {
        this.phase = 'hangar';
        if (this.hangarPanel) this.hangarPanel.active = true;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = true;
        if (this.hangarTitleLabel) this.hangarTitleLabel.string = reason === 'extract' ? '撤离成功' : '机体损毁';
        if (this.hangarStatsLabel) {
            this.hangarStatsLabel.string = [
                `存活 ${this.formatTime(this.combatTime)}  Boss ${Math.max(0, this.endlessCycle - 1)}  击杀 ${this.killCount}`,
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

    private calculateEndlessReward(reason: BattleEndReason): ResourceWallet {
        const bossKills = Math.max(0, this.endlessCycle - 1);
        const reward = this.getBattleWallet();
        reward.alloy += Math.floor(18 + this.combatTime * 1.15 + this.killCount * 0.28 + bossKills * 44);
        reward.shards += Math.floor(this.combatTime / 52 + this.killCount / 90 + bossKills * 5);
        reward.biomass += Math.floor(this.combatTime / 60 + this.killCount / 72 + bossKills * 2);
        reward.circuits += Math.floor(this.combatTime / 75 + this.killCount / 110 + bossKills * 3);
        reward.cores += bossKills;
        reward.crystals += Math.floor(bossKills / 2);

        if (reason === 'death') {
            for (const resource of RESOURCE_DEFS) {
                reward[resource.id] = Math.max(0, Math.floor(reward[resource.id] * 0.68));
            }
        }

        return reward;
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
            alloy: this.alloy,
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
        this.alloy += wallet.alloy;
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
        if (this.hangarPanel) this.hangarPanel.active = true;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = true;
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
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
            desc: `立刻获得 ${52 + this.battleIndex * 8} 合金和 1 核心。`,
            color: '#43AA8B',
            apply: () => {
                this.alloy += 52 + this.battleIndex * 8;
                this.cores += 1;
            },
        });

        while (choices.length < 3) {
            const equipment = owned[choices.length % Math.max(1, owned.length)] || EQUIPMENT[0];
            choices.push({
                title: `校准：${equipment.name}`,
                desc: '免费升 1 级，若已满级则转化为 60 合金。',
                color: equipment.color,
                apply: () => {
                    if (this.getEquipmentLevel(equipment.id) < equipment.maxLevel) {
                        this.equipmentLevels[equipment.id] = this.getEquipmentLevel(equipment.id) + 1;
                    } else {
                        this.alloy += 60;
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
            if (this.equippedEquipment.length >= EQUIPPED_SLOT_COUNT) {
                this.showToast(`出战槽已满，最多携带 ${EQUIPPED_SLOT_COUNT} 件装备。`);
                return;
            }
            if (equipment.kind === 'weapon' && this.getEquippedWeapons().length >= MAX_EQUIPPED_WEAPONS) {
                this.showToast(`武器最多携带 ${MAX_EQUIPPED_WEAPONS} 把。`);
                return;
            }
            if (equipment.kind === 'gear' && this.getEquippedGear().length >= MAX_EQUIPPED_GEAR) {
                this.showToast(`通用装备最多携带 ${MAX_EQUIPPED_GEAR} 件。`);
                return;
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
            this.hangarStatsLabel.string = [
                `已完成出击 ${this.battlesWon} 次  下一次 ${this.battlesWon + 1}`,
                `库存：${this.formatWallet(this.getInventoryWallet())}`,
                `出战同时生效：武器 ${this.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}  装备 ${this.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}`,
                `仓库：武器 ${this.getOwnedWeaponCount()}/${WEAPON_COUNT}  图鉴 ${TOTAL_ENEMY_TYPES}`,
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
        return `装备槽 ${index - MAX_EQUIPPED_WEAPONS + 1}`;
    }

    private getEquipmentForDisplaySlot(index: number) {
        if (index < MAX_EQUIPPED_WEAPONS) {
            return this.getEquippedWeapons()[index] || null;
        }
        return this.getEquippedGear()[index - MAX_EQUIPPED_WEAPONS] || null;
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
                this.equipActionButton.label.string = this.isEquipped(selected.id) ? '卸下' : '加入出战';
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
        const state = `${owned ? `Lv.${level}/${equipment.maxLevel}` : '未获得'}${equipped ? '  出战中-战斗生效' : ''}`;
        const lines = [`${equipment.name}  ${state}`, equipment.desc];
        if (equipment.weaponStats) {
            lines.push([
                `伤害 +${this.formatStat(equipment.weaponStats.damage * detailLevel)}`,
                `射速 +${this.formatStat(equipment.weaponStats.fireRate * detailLevel)}`,
                `穿透 +${this.formatStat(equipment.weaponStats.pierce * detailLevel)}`,
            ].join('  '));
            lines.push([
                `散射 +${this.formatStat(equipment.weaponStats.multiShot * detailLevel)}`,
                `无人机 +${this.formatStat(equipment.weaponStats.drone * detailLevel)}`,
                `弹速 +${this.formatStat(equipment.weaponStats.bulletSpeed * detailLevel)}`,
            ].join('  '));
        } else {
            lines.push(this.formatGearStats(equipment.id, detailLevel));
        }
        if (!owned) {
            lines.push(`合成消耗：${this.formatCost(this.getCraftCost(equipment))}`);
        } else if (level < equipment.maxLevel) {
            lines.push(`升级消耗：${this.formatCost(this.getUpgradeCost(equipment))}`);
        }
        return lines.join('\n');
    }

    private formatGearStats(id: string, level: number) {
        switch (id) {
            case 'magnet-coil':
                return `拾取范围 +${level * 22}`;
            case 'phase-armor':
                return `生命 +${level * 20}  护甲 +${this.formatStat(level * 2.2)}`;
            case 'kinetic-boots':
                return `移动速度 +${level * 17}`;
            case 'reactor-core':
                return `伤害 +${this.formatStat(level * 3.4)}  弹速 +${level * 22}  生命 +${level * 9}`;
            case 'vampire-chip':
                return `击杀回血 +${this.formatStat(0.8 + level * 0.35)}  每秒恢复 +${this.formatStat(level * 0.12)}`;
            default:
                return '通用属性装备。';
        }
    }

    private formatStat(value: number) {
        return Number(value.toFixed(1)).toString();
    }

    private refreshHud() {
        if (this.titleLabel) this.titleLabel.string = `星坠幸存者  出击 ${this.battlesWon + 1}`;
        if (this.timerLabel) {
            const bossIn = Math.max(0, Math.ceil((ENDLESS_CYCLE_DURATION - BOSS_WARNING_TIME) - this.cycleTime));
            this.timerLabel.string = this.phase === 'combat' || this.phase === 'level-up'
                ? `轮${this.endlessCycle} ${bossIn > 0 && !this.bossSpawned ? `${bossIn}s` : 'Boss'}`
                : '机库';
        }
        if (this.statLabel) {
            this.statLabel.string = this.phase === 'combat' || this.phase === 'level-up'
                ? `存活 ${this.formatTime(this.combatTime)}  |  角色 Lv.${this.level}  |  击杀 ${this.killCount}  |  怪物 ${this.enemies.length}`
                : `永久资源：${this.formatWallet(this.getInventoryWallet())}`;
        }
        if (this.equipmentLabel) {
            const equipped = this.getEquippedEquipmentDefs()
                .slice(0, 2)
                .map((equipment) => `${equipment.name} Lv.${this.getEquipmentLevel(equipment.id)}`)
                .join(' / ');
            const catalog = `出战 ${this.getEquippedWeapons().length}武/${this.getEquippedGear().length}装  仓库武器 ${this.getOwnedWeaponCount()}/${WEAPON_COUNT}`;
            this.equipmentLabel.string = equipped ? `${catalog}  |  ${equipped}` : catalog;
        }
        if (this.extractButton) {
            this.extractButton.node.active = this.phase === 'combat' || this.phase === 'level-up';
            this.extractButton.label.string = '撤离';
            this.drawButton(this.extractButton, this.phase !== 'combat');
        }
        this.drawBars();
    }

    private drawBars() {
        if (this.hpBar) {
            const ratio = this.playerMaxHp > 0 ? this.playerHp / this.playerMaxHp : 0;
            this.hpBar.clear();
            this.hpBar.fillColor = this.hex('#1E293B');
            this.hpBar.roundRect(-146, -9, 292, 18, 9);
            this.hpBar.fill();
            this.hpBar.fillColor = this.hex(ratio > 0.45 ? '#43AA8B' : '#F94144');
            this.hpBar.roundRect(-146, -9, 292 * this.clamp(ratio, 0, 1), 18, 9);
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
            enemy.sprite.color = this.hex('#FFFFFF', enemy.elite ? 255 : 235);
            enemy.gfx.fillColor = this.hex('#020617', 85);
            enemy.gfx.circle(4, -5, enemy.radius + 5);
            enemy.gfx.fill();
            if (enemy.elite || enemy.boss) {
                enemy.gfx.strokeColor = this.hex(enemy.boss ? '#F94144' : '#F8FAFC', enemy.boss ? 235 : 190);
                enemy.gfx.lineWidth = enemy.boss ? 5 : 3;
                enemy.gfx.circle(0, 0, enemy.radius + (enemy.boss ? 13 : 7));
                enemy.gfx.stroke();
            }
            if (enemy.hp < enemy.maxHp) {
                const ratio = this.clamp(enemy.hp / enemy.maxHp, 0, 1);
                enemy.gfx.fillColor = this.hex('#0F172A');
                enemy.gfx.roundRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2, 6, 3);
                enemy.gfx.fill();
                enemy.gfx.fillColor = this.hex('#F94144');
                enemy.gfx.roundRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2 * ratio, 6, 3);
                enemy.gfx.fill();
            }
            return;
        }
        enemy.gfx.fillColor = this.hex('#020617', 90);
        enemy.gfx.circle(3, -4, enemy.radius + 3);
        enemy.gfx.fill();
        enemy.gfx.fillColor = this.hex(enemy.spec.color, enemy.elite ? 255 : 230);
        enemy.gfx.circle(0, 0, enemy.radius);
        enemy.gfx.fill();
        enemy.gfx.fillColor = this.hex(enemy.spec.accent, 210);
        enemy.gfx.circle(-enemy.radius * 0.3, enemy.radius * 0.12, enemy.radius * 0.35);
        enemy.gfx.fill();
        enemy.gfx.strokeColor = this.hex(enemy.elite ? '#F8FAFC' : '#0F172A', enemy.boss ? 255 : 190);
        enemy.gfx.lineWidth = enemy.boss ? 5 : enemy.elite ? 4 : 2;
        enemy.gfx.circle(0, 0, enemy.radius);
        enemy.gfx.stroke();

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

    private drawBullet(bullet: Bullet) {
        bullet.gfx.clear();
        if (bullet.sprite) return;
        bullet.gfx.fillColor = this.hex('#F8FAFC');
        bullet.gfx.circle(0, 0, bullet.radius);
        bullet.gfx.fill();
        bullet.gfx.fillColor = this.hex('#4CC9F0');
        bullet.gfx.circle(0, 0, bullet.radius * 0.55);
        bullet.gfx.fill();
    }

    private drawPickup(pickup: Pickup) {
        const color = pickup.type === 'xp' ? '#4CC9F0' : this.getResourceDef(pickup.type).color;
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
            if (oldest) oldest.node.destroy();
        }

        const node = new Node('FloatingText');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode.addChild(node);
        node.setPosition(x, y, 24);
        node.addComponent(UITransform).setContentSize(120, 34);

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.12);
        label.color = this.hex(color);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = false;

        this.floatingTexts.push({
            node,
            label,
            x,
            y,
            vy: 58 + Math.random() * 34,
            life: 0.72,
            maxLife: 0.72,
            color,
        });
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
            const index = this.floatingTexts.indexOf(floatingText);
            if (index >= 0) this.floatingTexts.splice(index, 1);
            floatingText.node.destroy();
        }
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
        const pool = this.shuffle([...LEVEL_UPGRADES]);
        return pool.slice(0, 3);
    }

    private getBulletDamage() {
        const reactor = this.getActiveEquipmentLevel('reactor-core');
        return (16 + this.getWeaponStat('damage') + reactor * 3.4) * (1 + this.runDamageBonus);
    }

    private getFireInterval() {
        const weaponFireRate = this.clamp(this.getWeaponStat('fireRate'), -8, 34);
        return Math.max(0.08, 0.54 - weaponFireRate * 0.012 - this.runFireRateBonus);
    }

    private getBulletSpeed() {
        const weaponSpeed = this.clamp(this.getWeaponStat('bulletSpeed') * 18, -140, 300);
        return 620 + weaponSpeed + this.getActiveEquipmentLevel('reactor-core') * 22;
    }

    private getBulletPierce() {
        const weaponPierce = Math.max(0, this.getWeaponStat('pierce'));
        return Math.floor(Math.sqrt(weaponPierce) / 1.4) + this.runPierceBonus;
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

    private getWeaponStat(stat: keyof WeaponStats) {
        let total = 0;
        for (const weapon of this.getEquippedWeapons()) {
            total += (weapon.weaponStats?.[stat] || 0) * this.getEquipmentLevel(weapon.id);
        }
        return total;
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
        return equipment.kind === 'weapon' ? 3 : 4;
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

    private getMoveSpeed() {
        return 238 + this.getActiveEquipmentLevel('kinetic-boots') * 17 + this.runMoveSpeedBonus;
    }

    private getPickupRadius() {
        return 82 + this.getActiveEquipmentLevel('magnet-coil') * 22 + this.runPickupBonus;
    }

    private getArmor() {
        return this.getActiveEquipmentLevel('phase-armor') * 2.2 + this.getActiveEquipmentLevel('reactor-core') * 0.7;
    }

    private getMaxHp() {
        return 180 + this.getActiveEquipmentLevel('phase-armor') * 20 + this.getActiveEquipmentLevel('reactor-core') * 9 + this.runMaxHpBonus;
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
        cost.alloy = Math.round(equipment.baseCost * (1 + level * 0.68) + this.battlesWon * 8);
        if (equipment.kind === 'weapon') {
            cost.shards = Math.ceil(level * 1.35);
            cost.circuits = Math.ceil(level * 0.9);
        } else {
            cost.biomass = Math.ceil(level * 1.45);
            if (equipment.id === 'reactor-core') cost.circuits = Math.ceil(level * 0.75);
        }
        if (level >= 4) cost.cores = Math.ceil((level - 3) / 2);
        if (level >= 7) cost.crystals = Math.ceil((level - 6) / 2);
        return cost;
    }

    private getCraftCost(equipment: EquipmentDef) {
        const cost = this.createEmptyWallet();
        cost.alloy = Math.round(equipment.baseCost * 1.25);
        cost.shards = equipment.kind === 'weapon' ? 18 : 10;
        if (equipment.kind === 'weapon') {
            cost.circuits = 6;
        } else {
            cost.biomass = 8;
        }
        if (equipment.baseCost >= 60) cost.crystals = 1;
        return cost;
    }

    private createEmptyWallet(): ResourceWallet {
        return { ...RESOURCE_ZERO };
    }

    private hasResources(cost: ResourceWallet) {
        return this.alloy >= cost.alloy
            && this.cores >= cost.cores
            && this.shards >= cost.shards
            && this.biomass >= cost.biomass
            && this.circuits >= cost.circuits
            && this.crystals >= cost.crystals;
    }

    private spendResources(cost: ResourceWallet) {
        this.alloy -= cost.alloy;
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
        this.ownedEquipment = new Set(['storm-rifle', 'magnet-coil']);
        this.equippedEquipment = ['storm-rifle', 'magnet-coil'];
        this.shards = 24;
        this.biomass = 12;
        this.circuits = 10;
        this.crystals = 0;
        this.equipmentLevels = {
            'storm-rifle': 1,
            'magnet-coil': 1,
        };
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.battlesWon = Math.max(0, Number(data.battlesWon) || 0);
            this.alloy = Math.max(0, Number(data.alloy) || this.alloy);
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
            this.ownedEquipment.add('storm-rifle');
            this.ownedEquipment.add('magnet-coil');
            this.equipmentLevels['storm-rifle'] = Math.max(1, this.getEquipmentLevel('storm-rifle'));
            this.equipmentLevels['magnet-coil'] = Math.max(1, this.getEquipmentLevel('magnet-coil'));
            this.normalizeEquippedEquipment();
        } catch (error) {
            console.warn('Failed to load rogue shooter progress', error);
        }
    }

    private normalizeEquippedEquipment() {
        const next: string[] = [];
        let weaponCount = 0;
        let gearCount = 0;
        for (const id of this.equippedEquipment) {
            if (next.length >= EQUIPPED_SLOT_COUNT || next.indexOf(id) >= 0) continue;
            const equipment = this.findEquipment(id);
            if (!equipment || !this.ownedEquipment.has(equipment.id)) continue;
            if (equipment.kind === 'weapon') {
                if (weaponCount >= MAX_EQUIPPED_WEAPONS) continue;
                weaponCount += 1;
            } else {
                if (gearCount >= MAX_EQUIPPED_GEAR) continue;
                gearCount += 1;
            }
            next.push(equipment.id);
        }

        if (weaponCount <= 0 && this.ownedEquipment.has('storm-rifle')) {
            next.unshift('storm-rifle');
            weaponCount += 1;
        }
        this.equippedEquipment = next.slice(0, EQUIPPED_SLOT_COUNT);
        if (!this.findEquipment(this.selectedEquipmentId)) {
            this.selectedEquipmentId = this.equippedEquipment[0] || 'storm-rifle';
        }
    }

    private saveProgress() {
        try {
            sys.localStorage.setItem(SAVE_KEY, JSON.stringify({
                battlesWon: this.battlesWon,
                alloy: this.alloy,
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
        for (const bullet of this.bullets) bullet.node.destroy();
        for (const pickup of this.pickups) pickup.node.destroy();
        for (const floatingText of this.floatingTexts) floatingText.node.destroy();
        if (this.playerNode) this.playerNode.destroy();
        this.enemies = [];
        this.bullets = [];
        this.pickups = [];
        this.floatingTexts = [];
        this.playerNode = null;
        this.playerGfx = null;
        this.playerSprite = null;
    }

    private removeBullet(bullet: Bullet) {
        const index = this.bullets.indexOf(bullet);
        if (index >= 0) this.bullets.splice(index, 1);
        bullet.node.destroy();
    }

    private removePickup(pickup: Pickup) {
        const index = this.pickups.indexOf(pickup);
        if (index >= 0) this.pickups.splice(index, 1);
        pickup.node.destroy();
    }

    private onKeyDown(event: EventKeyboard) {
        this.pressedKeys.add(event.keyCode);
    }

    private onKeyUp(event: EventKeyboard) {
        this.pressedKeys.delete(event.keyCode);
    }

    private onTouchStart(event: EventTouch) {
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
            if (!view.disabled) onClick();
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

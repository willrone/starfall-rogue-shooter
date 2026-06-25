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

import { PanelManager } from './ui/panels';

import {
    RESOURCE_DEFS,
    createEmptyWallet as createResourceWallet,
    formatWallet as formatResourceWallet,
    getResourceDef as getResourceDefinition,
    hasResources as walletHasResources,
    spendResources as spendWalletResources,
} from './core/resources';
import type {
    ResourceType,
    ResourceWallet,
    StatEffect,
    CharacterStats,
    StatKey,
    GamePhase,
    BattleEndReason,
    ChestPickupType,
    PickupType,
    DamageType,
    ItemChoiceQuality,
    WeaponAttackStyle,
    EquipmentRarity,
    WeaponRarity,
    EquipmentKind,
    GearSlot,
    PlayerDirection,
    EquipmentDef,
    LevelUpgrade,
    LootChoice,
    WeaponStats,
    EnemySpec,
} from './core/types';
import {
    STAT_META,
    createEmptyCharacterStats,
    createBaseCharacterStats,
    addCharacterStats as addStats,
    formatStat as formatStatByKey,
} from './core/stats';
import {
    RUN_ITEMS,
    RUN_ITEM_COUNT,
    LEVEL_UPGRADES,
    STAT_UPGRADE_COUNT,
    formatRunItemEffect,
    scaleRunItemEffect as catalogScaleRunItemEffect,
    scaleRunItemEffects as catalogScaleRunItemEffects,
    buildRunItemCatalog as catalogBuildRunItemCatalog,
    buildStatUpgradeCatalog as catalogBuildStatUpgradeCatalog,
    STAT_UPGRADE_BLUEPRINTS as catalogSTAT_UPGRADE_BLUEPRINTS,
    RUN_ITEM_BLUEPRINTS as catalogRUN_ITEM_BLUEPRINTS,
    ITEM_TIER_NAMES as catalogITEM_TIER_NAMES,
    TRADEOFF_POSITIVE_BONUS as catalogTRADEOFF_POSITIVE_BONUS,
    scaleStatUpgradeEffect as catalogScaleStatUpgradeEffect,
} from './catalogs/runItemCatalog';
import { WEAPON_FAMILIES, WEAPON_VARIANTS, WEAPON_CATALOG, WEAPON_COUNT, buildWeaponCatalog, getWeaponStyleName } from './catalogs/weaponCatalog';
import { EQUIPMENT, GEAR_BLUEPRINTS, GEAR_RARITIES, GEAR_CATALOG, GEAR_COUNT, STARTER_EQUIPMENT_IDS } from './catalogs/equipmentCatalog';
import { ENEMY_SPECS, BOSS_ENEMY_COUNT, TOTAL_ENEMY_TYPES, BASE_ENEMY_ARCHETYPES, ENEMY_VARIANTS, buildEnemyCatalog } from './catalogs/enemyCatalog';

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
const ART_DIRS = ['art/placeholder', 'art/characters', 'art/enemies', 'art/weapons'] as const;
const ART_LOAD_TIMEOUT_SECONDS = 4;
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
const ENEMY_SEP_INTERVAL = 0.045;
const ENEMY_SEP_PLAYER_DIST = 480;
const ENEMY_CROWD_MIN_COUNT = 18;
const ENEMY_CROWD_REPEL_RADIUS = 112;
const ENEMY_CROWD_MAX_NEIGHBORS = 12;
const ENEMY_CROWD_REPEL_WEIGHT = 1.45;
const ENEMY_CROWD_ORBIT_WEIGHT = 0.58;

interface SpriteStripAnimation {
    frames: SpriteFrame[];
    fps: number;
    cellSize: number;
}

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

const GEAR_SLOT_ORDER: GearSlot[] = ['hat', 'armor', 'boots', 'accessory'];
const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
    hat: '帽子',
    armor: '护甲',
    boots: '鞋子',
    accessory: '首饰',
};

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

    private visibleHangarEquipment: EquipmentDef[] = [];
    private panels = new PanelManager();
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
    private enemySet: Set<Enemy> = new Set();
    private enemySepTick = 999;
    private bullets: Bullet[] = [];
    private bulletPool: Bullet[] = [];
    private enemyProjectiles: EnemyProjectile[] = [];
    private enemyProjectilePool: EnemyProjectile[] = [];
    private pickups: Pickup[] = [];
    private floatingTexts: FloatingText[] = [];
    private floatingTextPool: FloatingText[] = [];
    private debugHudEnabled = false;
    private perfFrameMs = 0;
    private perfPreMs = 0;
    private perfPlayerMs = 0;
    private perfWeaponMs = 0;
    private perfBulletMs = 0;
    private perfEnemyProjectileMs = 0;
    private perfEnemyMs = 0;
    private perfSeparationMs = 0;
    private perfPickupMs = 0;
    private perfHudMs = 0;
    private perfDrawEnemy = 0;
    private perfDrawBullet = 0;
    private perfDrawDrone = 0;
    private perfCrowdSteerCalls = 0;
    private perfCrowdChecks = 0;
    private perfSepChecks = 0;
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
        const frameStart = this.perfNow();
        this.resetPerfCounters();

        let t = this.perfNow();
        this.updateToast(dt);
        this.updateSfxCooldowns(dt);
        this.updateFloatingTexts(dt);
        this.perfPreMs = this.perfNow() - t;

        if (this.phase === 'combat') {
            const combatDt = Math.min(dt, MAX_COMBAT_DT);
            this.combatTime += combatDt;
            this.invulnerableTimer = Math.max(0, this.invulnerableTimer - combatDt);

            t = this.perfNow();
            this.updatePlayer(combatDt);
            this.updateDroneVisuals(combatDt);
            this.updateCamera(combatDt);
            this.perfPlayerMs = this.perfNow() - t;

            t = this.perfNow();
            this.updateSpawning(combatDt);
            this.updateWeapons(combatDt);
            this.perfWeaponMs = this.perfNow() - t;

            t = this.perfNow();
            this.updateBullets(combatDt);
            this.perfBulletMs = this.perfNow() - t;

            t = this.perfNow();
            this.updateEnemyProjectiles(combatDt);
            this.perfEnemyProjectileMs = this.perfNow() - t;

            t = this.perfNow();
            this.updateEnemies(combatDt);
            this.resolvePlayerAfterEnemyMovement();
            this.updateDroneVisuals(0);
            this.perfEnemyMs = this.perfNow() - t;

            t = this.perfNow();
            this.updatePickups(combatDt);
            this.updateRegen(combatDt);
            this.updateShield(combatDt);
            this.perfPickupMs = this.perfNow() - t;

            if (this.playerHp <= 0) {
                this.finishBattle('death');
            }
        }

        t = this.perfNow();
        this.refreshHud();
        this.perfHudMs = this.perfNow() - t;
        this.perfFrameMs = this.perfNow() - frameStart;
    }

    private perfNow() {
        return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }

    private resetPerfCounters() {
        this.perfPreMs = 0;
        this.perfPlayerMs = 0;
        this.perfWeaponMs = 0;
        this.perfBulletMs = 0;
        this.perfEnemyProjectileMs = 0;
        this.perfEnemyMs = 0;
        this.perfSeparationMs = 0;
        this.perfPickupMs = 0;
        this.perfHudMs = 0;
        this.perfDrawEnemy = 0;
        this.perfDrawBullet = 0;
        this.perfDrawDrone = 0;
        this.perfCrowdSteerCalls = 0;
        this.perfCrowdChecks = 0;
        this.perfSepChecks = 0;
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
        this.panels.setLoadingProgress('加载美术资源 0%');

        let finishedDirs = 0;
        let totalProgress = 0;
        let entered = false;
        const finishOnce = (message: string) => {
            if (entered) return;
            entered = true;
            this.panels.setLoadingProgress(message);
            done();
        };

        this.scheduleOnce(() => {
            finishOnce('资源加载较慢，先进入游戏');
        }, ART_LOAD_TIMEOUT_SECONDS);

        const finishDir = () => {
            finishedDirs += 1;
            if (finishedDirs >= ART_DIRS.length) {
                this.buildSpriteStripAnimations();
                finishOnce('加载完成');
            }
        };

        for (const dir of ART_DIRS) {
            resources.loadDir(
                dir,
                SpriteFrame,
                (finished, total) => {
                    const dirProgress = total > 0 ? finished / total : 1;
                    totalProgress = Math.max(totalProgress, (finishedDirs + dirProgress) / ART_DIRS.length);
                    this.panels.setLoadingProgress(`加载美术资源 ${Math.round(totalProgress * 100)}%`);
                },
                (error, frames) => {
                    if (error) {
                        console.warn(`Failed to load art dir ${dir}; falling back for this dir.`, error);
                        finishDir();
                        return;
                    }

                    for (const frame of frames) {
                        this.artFrames.set(frame.name, frame);
                    }
                    finishDir();
                },
            );
        }
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
        this.rect(root, 'DeepSpaceBase', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, '#10294A');
        this.rect(root, 'NebulaBandTop', 0, 0, DESIGN_WIDTH, 250, '#1E3A5F');
        this.rect(root, 'NebulaBandBottom', 0, 1060, DESIGN_WIDTH, 220, '#2A1748');

        const sky = new Node('StaticStarSky');
        sky.layer = Layers.Enum.UI_2D;
        root.addChild(sky);
        sky.setPosition(0, 0, 1);
        sky.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        const gfx = sky.addComponent(Graphics);

        gfx.fillColor = this.hex('#4CC9F0', 75);
        for (let i = 0; i < 86; i++) {
            const x = 18 + ((i * 83) % (DESIGN_WIDTH - 36));
            const y = 18 + ((i * 137) % (DESIGN_HEIGHT - 36));
            const r = 1 + (i % 3) * 0.7;
            gfx.circle(x, y, r);
            gfx.fill();
        }

        gfx.fillColor = this.hex('#B5179E', 42);
        gfx.circle(610, 166, 82);
        gfx.fill();
        gfx.fillColor = this.hex('#F9C74F', 70);
        gfx.circle(616, 160, 38);
        gfx.fill();
        gfx.strokeColor = this.hex('#F8FAFC', 52);
        gfx.lineWidth = 3;
        gfx.moveTo(544, 180);
        gfx.lineTo(684, 142);
        gfx.stroke();
    }

    private drawWorldArena(world: Node) {
        const floor = new Node('PlanetBattlefield');
        floor.layer = Layers.Enum.UI_2D;
        world.addChild(floor);
        floor.setPosition(0, 0, 1);
        floor.addComponent(UITransform).setContentSize(WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM);
        const floorGfx = floor.addComponent(Graphics);

        floorGfx.fillColor = this.hex('#254A66');
        floorGfx.roundRect(WORLD_LEFT, WORLD_BOTTOM, WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM, 52);
        floorGfx.fill();
        floorGfx.fillColor = this.hex('#3B6D86', 210);
        floorGfx.roundRect(WORLD_LEFT + 120, WORLD_BOTTOM + 150, WORLD_RIGHT - WORLD_LEFT - 240, WORLD_TOP - WORLD_BOTTOM - 300, 180);
        floorGfx.fill();
        floorGfx.fillColor = this.hex('#2E4A63', 120);
        floorGfx.circle(-1260, -920, 1280);
        floorGfx.fill();
        floorGfx.fillColor = this.hex('#4CC9F0', 34);
        floorGfx.circle(-1260, -920, 1540);
        floorGfx.fill();
        floorGfx.fillColor = this.hex('#020617', 80);
        floorGfx.circle(1720, 1280, 1120);
        floorGfx.fill();

        floorGfx.strokeColor = this.hex('#4CC9F0', 115);
        floorGfx.lineWidth = 5;
        floorGfx.roundRect(WORLD_LEFT + 42, WORLD_BOTTOM + 42, WORLD_RIGHT - WORLD_LEFT - 84, WORLD_TOP - WORLD_BOTTOM - 84, 42);
        floorGfx.stroke();
        floorGfx.strokeColor = this.hex('#7DD3FC', 42);
        floorGfx.lineWidth = 2;
        for (let x = WORLD_LEFT; x <= WORLD_RIGHT; x += 320) {
            floorGfx.moveTo(x, WORLD_BOTTOM);
            floorGfx.lineTo(x + 220, WORLD_TOP);
        }
        for (let y = WORLD_BOTTOM; y <= WORLD_TOP; y += 320) {
            floorGfx.moveTo(WORLD_LEFT, y);
            floorGfx.lineTo(WORLD_RIGHT, y + 120);
        }
        floorGfx.stroke();

        floorGfx.strokeColor = this.hex('#F9C74F', 105);
        floorGfx.lineWidth = 7;
        for (let i = 0; i < 34; i++) {
            const x = WORLD_LEFT + 260 + (i % 7) * 690 + ((i * 47) % 120);
            const y = WORLD_BOTTOM + 300 + Math.floor(i / 7) * 760 + ((i * 91) % 170);
            floorGfx.moveTo(x - 78, y - 18);
            floorGfx.lineTo(x - 20, y + 14);
            floorGfx.lineTo(x + 34, y - 5);
            floorGfx.lineTo(x + 92, y + 28);
        }
        floorGfx.stroke();

        floorGfx.fillColor = this.hex('#07111F', 96);
        floorGfx.strokeColor = this.hex('#7DD3FC', 60);
        floorGfx.lineWidth = 3;
        for (let i = 0; i < 46; i++) {
            const x = WORLD_LEFT + 280 + (i % 9) * 560 + ((i * 71) % 130);
            const y = WORLD_BOTTOM + 220 + Math.floor(i / 9) * 760 + ((i * 37) % 210);
            const r = 26 + (i % 5) * 12;
            floorGfx.circle(x, y, r);
            floorGfx.fill();
            floorGfx.circle(x - r * 0.24, y + r * 0.2, r * 0.55);
            floorGfx.stroke();
        }

        floorGfx.fillColor = this.hex('#94A3B8', 92);
        for (let i = 0; i < 62; i++) {
            const x = WORLD_LEFT + 220 + (i % 10) * 500 + ((i * 97) % 155);
            const y = WORLD_BOTTOM + 260 + Math.floor(i / 10) * 690 + ((i * 53) % 190);
            floorGfx.roundRect(x - 36, y - 9, 72, 18, 8);
            floorGfx.fill();
        }

        floorGfx.strokeColor = this.hex('#F8FAFC', 80);
        floorGfx.lineWidth = 3;
        for (let x = WORLD_LEFT + 640; x < WORLD_RIGHT; x += 640) {
            for (let y = WORLD_BOTTOM + 640; y < WORLD_TOP; y += 640) {
                floorGfx.moveTo(x - 38, y);
                floorGfx.lineTo(x + 38, y);
                floorGfx.moveTo(x, y - 38);
                floorGfx.lineTo(x, y + 38);
            }
        }
        floorGfx.stroke();
    }

    private buildHud(root: Node) {
        const top = UI_SAFE_TOP;
        this.rect(root, 'HudShadow', 28, top + 8, 664, 188, '#020617', 18);
        this.rect(root, 'HudPanel', 20, top, 664, 188, '#F8FAFC', 18, '#CBD5E1');
        this.rect(root, 'HudAccent', 42, top + 18, 8, 42, '#F94144', 4);
        this.panels.titleLabel = this.label(root, 'Title', '星坠幸存者', 58, top + 10, 290, 48, 30, '#0F172A', Label.HorizontalAlign.LEFT);
        this.panels.timerLabel = this.label(root, 'Timer', '', 440, top + 12, 210, 40, 28, '#0F172A', Label.HorizontalAlign.RIGHT);
        this.panels.statLabel = this.label(root, 'Stats', '', 58, top + 62, 596, 28, 15, '#475569', Label.HorizontalAlign.LEFT);
        this.panels.equipmentLabel = this.label(root, 'Equipment', '', 58, top + 92, 210, 28, 16, '#64748B', Label.HorizontalAlign.LEFT);
        this.panels.switchWeaponButton = this.button(root, 'SwitchWeaponButton', 284, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#B5179E', '#94A3B8', () => this.switchActiveWeapon());
        this.panels.switchWeaponButton.label.string = '切武器';
        this.panels.shopButton = this.button(root, 'OpenShopButton', 378, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#4CC9F0', '#94A3B8', () => this.openShop());
        this.panels.shopButton.label.string = '商店';
        this.panels.extractButton = this.button(root, 'ExtractButton', 472, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#F8961E', '#94A3B8', () => this.extractBattle());
        this.panels.extractButton.label.string = '撤离';
        this.panels.pauseButton = this.button(root, 'PauseButton', 566, top + 82, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.pauseCombat());
        this.panels.pauseButton.label.string = '暂停';

        const hpNode = this.rect(root, 'HpBar', 52, top + 144, 292, 18, '#1E293B', 9);
        this.panels.hpBar = hpNode.getComponent(Graphics);
        const xpNode = this.rect(root, 'XpBar', 376, top + 144, 292, 18, '#1E293B', 9);
        this.panels.xpBar = xpNode.getComponent(Graphics);
        this.label(root, 'HpLabel', 'HP', 18, top + 139, 34, 28, 15, '#CBD5E1');
        this.label(root, 'XpLabel', 'EXP', 344, top + 139, 38, 28, 15, '#CBD5E1');
        this.panels.debugLabel = this.label(root, 'DebugHud', '', 54, top + 168, 612, 44, 13, '#94A3B8', Label.HorizontalAlign.LEFT);
        this.panels.debugLabel.node.active = false;

        const toastTop = DESIGN_HEIGHT - UI_SAFE_BOTTOM - 76;
        this.rect(root, 'ToastPanelShadow', 46, toastTop + 10, 628, 54, '#020617', 14);
        this.rect(root, 'ToastPanel', 36, toastTop, 648, 58, '#F8FAFC', 14, '#CBD5E1');
        this.panels.toastLabel = this.label(root, 'Toast', '', 54, toastTop + 6, 612, 46, 19, '#0F172A');
    }

    private buildLevelPanel(root: Node) {
        this.panels.levelPanelShadow = this.rect(root, 'LevelPanelShadow', 48, 316, 624, 500, '#020617', 22);
        this.panels.levelPanelShadow.active = false;
        const panel = this.rect(root, 'LevelPanel', 36, 302, 648, 500, '#F8FAFC', 22, '#CBD5E1');
        panel.active = false;
        this.panels.levelPanel = panel;
        this.panels.levelTitleLabel = this.label(panel, 'LevelTitle', '角色升级', 42, 30, 564, 52, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.panels.levelBackButton = this.button(panel, 'LevelBack', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.choosePanelChoice(0), true);
        this.panels.levelBackButton.label.string = '返回';
        this.panels.levelHintLabel = this.label(panel, 'LevelHint', '选择一项自身属性成长，战斗会继续。', 42, 86, 564, 42, 20, '#475569', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LevelChoice_${i}`, 54, 148 + i * 84, 540, 68, '#4CC9F0', '#94A3B8', () => this.choosePanelChoice(i), true);
            this.panels.levelChoiceButtons.push(button);
        }
        this.panels.levelRefreshButton = this.button(panel, 'ChoiceRefresh', 204, 414, 240, 48, '#F8961E', '#94A3B8', () => this.refreshCurrentChoices(), true);
        this.panels.levelRefreshButton.label.string = `刷新 -${LEVEL_REFRESH_COST}合金`;
    }

    private buildShopPanel(root: Node) {
        this.panels.shopPanelShadow = this.rect(root, 'ShopPanelShadow', 36, 172, 648, 940, '#020617', 24);
        this.panels.shopPanelShadow.active = false;
        const panel = this.rect(root, 'ShopPanel', 24, 160, 672, 940, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.panels.shopPanel = panel;
        this.panels.shopTitleLabel = this.label(panel, 'ShopTitle', '战场商店', 36, 24, 600, 48, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.panels.shopTipLabel = this.label(panel, 'ShopTip', '随时打开。每格可购买或消耗少量合金刷新下一件。', 42, 72, 588, 42, 18, '#475569', Label.HorizontalAlign.CENTER, true);

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
            this.panels.shopButtons.push(button);

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
            this.panels.shopSlotRefreshButtons.push(refreshButton);
        }

        this.panels.shopCloseButton = this.button(panel, 'ShopClose', 204, 824, 264, 52, '#43AA8B', '#94A3B8', () => this.closeShop(), true);
        this.panels.shopCloseButton.label.string = '继续战斗';
    }

    private buildHangarPanel(root: Node) {
        this.panels.hangarPanelShadow = this.rect(root, 'HangarPanelShadow', 36, 196, 648, 936, '#020617', 24);
        this.panels.hangarPanelShadow.active = false;
        const panel = this.rect(root, 'HangarPanel', 24, 184, 672, 936, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.panels.hangarPanel = panel;

        this.panels.hangarTitleLabel = this.label(panel, 'HangarTitle', '', 36, 24, 600, 52, 32, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.panels.hangarBackButton = this.button(panel, 'HangarBackHome', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.openMainMenu(), true);
        this.panels.hangarBackButton.label.string = '首页';
        this.panels.hangarStatsLabel = this.label(panel, 'HangarStats', '', 46, 78, 580, 98, 20, '#334155', Label.HorizontalAlign.CENTER, true);
        this.panels.hangarTipLabel = this.label(panel, 'HangarTip', '', 46, 842, 580, 44, 18, '#64748B', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LootChoice_${i}`, 58, 208 + i * 92, 556, 76, '#F8961E', '#94A3B8', () => this.chooseLoot(i), true);
            this.panels.lootButtons.push(button);
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
            this.panels.equippedButtons.push(button);
        }

        this.panels.equipmentDetailLabel = this.label(panel, 'EquipmentDetail', '', 46, 302, 580, 116, 16, '#0F172A', Label.HorizontalAlign.LEFT, true);

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
            this.panels.equipmentButtons.push(button);
        }

        this.panels.prevEquipmentButton = this.button(panel, 'EquipmentPrev', 46, 706, 104, 52, '#64748B', '#94A3B8', () => this.changeEquipmentPage(-1), true);
        this.panels.equipActionButton = this.button(panel, 'EquipAction', 164, 706, 170, 52, '#4CC9F0', '#94A3B8', () => this.toggleSelectedEquipment(), true);
        this.panels.upgradeActionButton = this.button(panel, 'UpgradeAction', 348, 706, 170, 52, '#F8961E', '#94A3B8', () => this.upgradeSelectedEquipment(), true);
        this.panels.nextEquipmentButton = this.button(panel, 'EquipmentNext', 532, 706, 104, 52, '#64748B', '#94A3B8', () => this.changeEquipmentPage(1), true);

        this.panels.startButton = this.button(panel, 'StartBattle', 174, 776, 324, 58, '#43AA8B', '#94A3B8', () => this.beginBattle(false), true);
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
        this.panels.loadingPanel = panel;
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
        this.panels.loadingTitleLabel = this.label(panel, 'LoadingTitle', '星坠幸存者', 70, 420, 580, 72, 54, '#FFF7ED', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LoadingSubTitle', '正在整备星舰与武器', 92, 506, 536, 40, 24, '#FDE68A', Label.HorizontalAlign.CENTER, true);
        this.panels.loadingProgressLabel = this.label(panel, 'LoadingProgress', '加载中...', 92, 606, 536, 44, 22, '#E2E8F0', Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LoadingHint', '提示：拾取经验升级，撑不住时可撤离带回资源', 76, 1040, 568, 58, 21, '#CBD5E1', Label.HorizontalAlign.CENTER, true);
    }

    private buildMenuPanel(root: Node) {
        this.panels.menuPanelShadow = this.rect(root, 'MenuPanelShadow', 48, 220, 624, 790, '#020617', 28);
        this.panels.menuPanelShadow.active = false;
        const panel = this.rect(root, 'MenuPanel', 36, 206, 648, 790, '#F8FAFC', 28, '#CBD5E1');
        panel.active = false;
        this.panels.menuPanel = panel;
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
        this.panels.pausePanelShadow = this.rect(root, 'PausePanelShadow', 78, 372, 564, 520, '#020617', 24);
        this.panels.pausePanelShadow.active = false;
        const panel = this.rect(root, 'PausePanel', 66, 360, 588, 520, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.panels.pausePanel = panel;
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
        this.panels.settingsPanelShadow = this.rect(root, 'SettingsPanelShadow', 86, 386, 548, 490, '#020617', 24);
        this.panels.settingsPanelShadow.active = false;
        const panel = this.rect(root, 'SettingsPanel', 74, 374, 572, 490, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.panels.settingsPanel = panel;
        this.label(panel, 'SettingsTitle', '设置', 44, 36, 484, 58, 36, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.panels.settingsBodyLabel = this.label(panel, 'SettingsBody', '', 54, 104, 464, 80, 20, '#475569', Label.HorizontalAlign.CENTER, true);
        this.panels.bgmToggleButton = this.button(panel, 'BgmToggle', 116, 204, 340, 58, '#4CC9F0', '#94A3B8', () => this.toggleBgm(), true);
        this.panels.sfxToggleButton = this.button(panel, 'SfxToggle', 116, 278, 340, 58, '#B5179E', '#94A3B8', () => this.toggleSfx(), true);
        const close = this.button(panel, 'SettingsClose', 116, 366, 340, 58, '#43AA8B', '#94A3B8', () => this.closeSettingsPanel(), true);
        close.label.string = '返回';
        this.refreshSettingsPanel();
    }

    private buildInfoPanel(root: Node) {
        this.panels.infoPanelShadow = this.rect(root, 'InfoPanelShadow', 64, 304, 592, 646, '#020617', 24);
        this.panels.infoPanelShadow.active = false;
        const panel = this.rect(root, 'InfoPanel', 52, 292, 616, 646, '#F8FAFC', 24, '#CBD5E1');
        panel.active = false;
        this.panels.infoPanel = panel;
        this.panels.infoTitleLabel = this.label(panel, 'InfoTitle', '', 44, 34, 528, 58, 34, '#0F172A', Label.HorizontalAlign.CENTER, true);
        this.panels.infoBodyLabel = this.label(panel, 'InfoBody', '', 54, 112, 508, 390, 20, '#334155', Label.HorizontalAlign.LEFT, true);
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
        this.panels.hideAllOverlays();
        if (this.panels.loadingPanel) this.panels.loadingPanel.active = false;
        if (this.panels.menuPanel) this.panels.menuPanel.active = true;
        if (this.panels.menuPanelShadow) this.panels.menuPanelShadow.active = true;
        this.panels.setCombatHudControlsActive(false);
        this.showToast('');
    }

    private openHangarFromMenu() {
        this.panels.setMenuPanelActive(false);
        this.showHangar('选择装备后开始出击。');
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

        this.panels.hideAllOverlays();
        if (this.joystickBase) this.joystickBase.active = false;
        if (this.joystickKnob) this.joystickKnob.active = false;
        this.panels.setCombatHudControlsActive(true);

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
                        if (!this.enemySet.has(enemy)) continue;
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
        this.enemySepTick += dt;
        const doSeparation = this.enemySepTick >= ENEMY_SEP_INTERVAL && this.enemies.length >= 6;
        if (doSeparation) this.enemySepTick = 0;
        const crowdGrid = this.enemies.length >= ENEMY_CROWD_MIN_COUNT ? this.buildEnemyGrid(ENEMY_SEPARATION_CELL) : null;

        for (const enemy of this.enemies) {
            if (!this.enemySet.has(enemy)) continue;
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
            } else if (crowdGrid) {
                const steer = this.getEnemyCrowdSteer(enemy, crowdGrid, ex, ey, dx / dist, dy / dist, dist);
                vx += steer.x;
                vy += steer.y;
                const vLen = Math.max(0.001, Math.sqrt(vx * vx + vy * vy));
                vx /= vLen;
                vy /= vLen;
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
        if (doSeparation) {
            const sepStart = this.perfNow();
            this.separateEnemies();
            this.perfSeparationMs = this.perfNow() - sepStart;
        }
    }

    private getEnemyCrowdSteer(enemy: Enemy, grid: Map<string, Enemy[]>, ex: number, ey: number, toPlayerX: number, toPlayerY: number, playerDist: number) {
        let sx = 0;
        let sy = 0;
        let checks = 0;
        const cellX = Math.floor(ex / ENEMY_SEPARATION_CELL);
        const cellY = Math.floor(ey / ENEMY_SEPARATION_CELL);
        for (let ox = -1; ox <= 1 && checks < ENEMY_CROWD_MAX_NEIGHBORS; ox++) {
            for (let oy = -1; oy <= 1 && checks < ENEMY_CROWD_MAX_NEIGHBORS; oy++) {
                const bucket = grid.get(`${cellX + ox},${cellY + oy}`);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length && checks < ENEMY_CROWD_MAX_NEIGHBORS; i++) {
                    const other = bucket[i];
                    if (other === enemy || !this.enemySet.has(other)) continue;
                    checks += 1;
                    const dx = ex - other.node.position.x;
                    const dy = ey - other.node.position.y;
                    const minDist = enemy.radius + other.radius + ENEMY_SEPARATION_PADDING;
                    const range = Math.max(ENEMY_CROWD_REPEL_RADIUS, minDist * 1.75);
                    if (Math.abs(dx) > range || Math.abs(dy) > range) continue;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= 0.001 || distSq > range * range) continue;
                    const dist = Math.sqrt(distSq);
                    const pressure = (range - dist) / range;
                    sx += (dx / dist) * pressure * ENEMY_CROWD_REPEL_WEIGHT;
                    sy += (dy / dist) * pressure * ENEMY_CROWD_REPEL_WEIGHT;
                }
            }
        }

        const preferredRing = this.playerRadius + enemy.radius + 42 + (enemy.id % 9) * 13;
        if (playerDist < preferredRing) {
            const outward = (preferredRing - playerDist) / preferredRing;
            sx -= toPlayerX * outward * 1.6;
            sy -= toPlayerY * outward * 1.6;
        }
        if (playerDist < preferredRing + 150) {
            const orbitSign = enemy.id % 2 === 0 ? 1 : -1;
            const orbit = this.clamp((preferredRing + 150 - playerDist) / 150, 0, 1) * ENEMY_CROWD_ORBIT_WEIGHT;
            sx += -toPlayerY * orbitSign * orbit;
            sy += toPlayerX * orbitSign * orbit;
        }

        this.perfCrowdSteerCalls += 1;
        this.perfCrowdChecks += checks;
        return { x: sx, y: sy };
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
        if (Math.abs(scaleX - (enemy['_lastScaleX'] || 0)) > 0.005 || Math.abs(scaleY - (enemy['_lastScaleY'] || 0)) > 0.005) {
            enemy.node.setScale(scaleX, Math.max(0.86, scaleY), 1);
            enemy['_lastScaleX'] = scaleX;
            enemy['_lastScaleY'] = scaleY;
        }

        if (enemy.sprite) {
            if (enemy.animation && enemy.animation.frames.length > 0) {
                const frameIndex = Math.floor((this.combatTime + enemy.animSeed * 0.07) * enemy.animation.fps) % enemy.animation.frames.length;
                if (frameIndex !== enemy.animationFrameIndex) {
                    enemy.animationFrameIndex = frameIndex;
                    enemy.sprite.spriteFrame = enemy.animation.frames[frameIndex];
                }
            }
            const spriteNode = enemy.sprite.node;
            const dashAngle = enemy.dashTimer > 0 ? this.clamp(vx, -1, 1) * -8 : 0;
            if (Math.abs(dashAngle - (enemy['_lastAngle'] || 0)) > 0.5) {
                spriteNode.angle = dashAngle;
                spriteNode.setPosition(0, 0, 0);
                enemy['_lastAngle'] = dashAngle;
            }
            const hitColor = enemy.hitFlash > 0;
            const wasHitColor = enemy['_wasHitColor'] || false;
            if (hitColor !== wasHitColor) {
                enemy.sprite.color = hitColor
                    ? this.hex('#FFFFFF', 255)
                    : this.getEnemyTint(enemy, enemy.elite ? 255 : 235);
                enemy['_wasHitColor'] = hitColor;
            }
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
        if (this.enemies.length < 6) return;
        const px = this.playerX;
        const py = this.playerY;
        const distSqThreshold = ENEMY_SEP_PLAYER_DIST * ENEMY_SEP_PLAYER_DIST;
        const buckets = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            let ax = enemy.node.position.x;
            let ay = enemy.node.position.y;
            if (!enemy.boss) {
                const edx = ax - px;
                const edy = ay - py;
                if (edx * edx + edy * edy > distSqThreshold) {
                    buckets.delete(`${Math.floor(ax / ENEMY_SEPARATION_CELL)},${Math.floor(ay / ENEMY_SEPARATION_CELL)}`);
                    continue;
                }
            }
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
                        if (Math.abs(bx - other.node.position.x) > 0.5 || Math.abs(by - other.node.position.y) > 0.5) {
                            other.node.setPosition(bx, by, 4);
                        }
                    }
                }
            }

            if (Math.abs(ax - enemy.node.position.x) > 0.5 || Math.abs(ay - enemy.node.position.y) > 0.5) {
                enemy.node.setPosition(ax, ay, 4);
            }
            this.perfSepChecks += checks;
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
        this.enemySet.add(enemy);
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
        this.enemySet.delete(enemy);
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
        if (this.panels.levelPanel) this.panels.levelPanel.active = true;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = true;
        if (this.panels.levelTitleLabel) this.panels.levelTitleLabel.string = title;
        if (this.panels.levelHintLabel) this.panels.levelHintLabel.string = hint;
        this.panels.levelChoiceButtons.forEach((button, index) => {
            const choice = choices[index];
            button.node.active = !!choice;
            if (!choice) return;
            button.color = choice.color;
            button.label.string = `${choice.category}｜${choice.name}\n${choice.desc}`;
            this.drawButton(button, false);
        });
        if (this.panels.levelRefreshButton) {
            this.panels.levelRefreshButton.node.active = true;
            this.panels.levelRefreshButton.label.string = `刷新 -${refreshCost}合金`;
            this.drawButton(this.panels.levelRefreshButton, this.getSpendableAlloy() < refreshCost);
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
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
        this.resumeCombatAfterChoice();
        this.showToast(`属性成长：${choice.name}`);
    }

    private chooseRunItem(index: number) {
        if (this.phase !== 'item-choice') return;
        const choice = this.pendingItemChoices[index];
        if (!choice) return;
        this.applyRunItem(choice.id);
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
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
        this.panels.setCombatHudControlsActive(false);
        this.panels.setMenuPanelActive(false);
        if (this.panels.pausePanel) this.panels.pausePanel.active = false;
        if (this.panels.pausePanelShadow) this.panels.pausePanelShadow.active = false;
        if (this.panels.hangarPanel) this.panels.hangarPanel.active = true;
        if (this.panels.hangarPanelShadow) this.panels.hangarPanelShadow.active = true;
        this.panels.setShopPanelActive(false);
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
        if (this.panels.hangarTitleLabel) this.panels.hangarTitleLabel.string = reason === 'extract' ? '撤离成功' : '机体损毁';
        if (this.panels.hangarStatsLabel) {
            this.panels.hangarStatsLabel.string = [
                `存活 ${this.formatTime(this.combatTime)}  Boss ${this.bossKills}  击杀 ${this.killCount}`,
                `本次带回：${this.formatWallet(reward)}`,
                `库存：${this.formatWallet(this.getInventoryWallet())}`,
            ].join('\n');
        }

        this.panels.lootButtons.forEach((button) => button.node.active = false);
        this.panels.setHangarControlsActive(true);
        if (this.panels.startButton) this.panels.startButton.node.active = true;
        if (this.panels.hangarTipLabel) this.panels.hangarTipLabel.string = reason === 'extract'
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
        this.panels.setShopPanelActive(true);
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
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
        this.panels.setShopPanelActive(false);
        this.phase = 'combat';
        this.showToast('商店离开，战斗继续。');
    }

    private renderShop() {
        if (this.panels.shopTitleLabel) this.panels.shopTitleLabel.string = `战场商店  ${this.formatTime(this.combatTime)}`;
        if (this.panels.shopTipLabel) {
            this.panels.shopTipLabel.string = `可用合金 ${this.getSpendableAlloy()}。购买后自动补货；单格刷新 -${SHOP_REFRESH_COST} 合金。`;
        }
        this.panels.shopButtons.forEach((button, index) => {
            const item = this.shopOffers[index];
            button.node.active = !!item;
            if (!item) return;
            const cost = this.getShopItemCost(item);
            button.color = item.color;
            button.label.string = `${item.category} T${item.tier}  合金${cost}\n${item.name}\n${item.desc}`;
            this.drawButton(button, this.getSpendableAlloy() < cost);
        });
        this.panels.shopSlotRefreshButtons.forEach((button) => {
            button.label.string = `刷新此格 -${SHOP_REFRESH_COST}`;
            this.drawButton(button, this.getSpendableAlloy() < SHOP_REFRESH_COST);
        });
        if (this.panels.shopCloseButton) {
            this.panels.shopCloseButton.label.string = '继续战斗';
            this.drawButton(this.panels.shopCloseButton, false);
        }
    }

    private pauseCombat() {
        if (this.phase !== 'combat') return;
        this.phaseBeforePause = this.phase;
        this.phase = 'paused';
        this.touchActive = false;
        this.touchVector.set(0, 0);
        this.updateJoystickView();
        if (this.panels.pausePanel) this.panels.pausePanel.active = true;
        if (this.panels.pausePanelShadow) this.panels.pausePanelShadow.active = true;
        this.showToast('');
    }

    private resumeFromPause() {
        if (this.phase !== 'paused') return;
        this.phase = this.phaseBeforePause === 'combat' ? 'combat' : 'combat';
        if (this.panels.pausePanel) this.panels.pausePanel.active = false;
        if (this.panels.pausePanelShadow) this.panels.pausePanelShadow.active = false;
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = false;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = false;
        if (this.panels.infoPanel) this.panels.infoPanel.active = false;
        if (this.panels.infoPanelShadow) this.panels.infoPanelShadow.active = false;
        this.requestPhaseBgm();
        this.showToast('战斗继续。');
    }

    private returnToHangarFromPause() {
        if (this.phase !== 'paused') return;
        this.clearWorld();
        this.panels.hideAllOverlays();
        this.showHangar('已返回机库，可调整装备后重新出击。');
    }

    private openSettingsPanel() {
        if (this.phase === 'combat') this.pauseCombat();
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = true;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = true;
        this.refreshSettingsPanel();
    }

    private closeSettingsPanel() {
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = false;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = false;
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
        if (this.panels.settingsBodyLabel) {
            this.panels.settingsBodyLabel.string = `音乐：${this.bgmVolume > 0 ? '开启' : '关闭'}\n音效：${this.sfxVolume > 0 ? '开启' : '关闭'}`;
        }
        if (this.panels.bgmToggleButton) {
            this.panels.bgmToggleButton.label.string = this.bgmVolume > 0 ? '关闭音乐' : '开启音乐';
            this.drawButton(this.panels.bgmToggleButton, false);
        }
        if (this.panels.sfxToggleButton) {
            this.panels.sfxToggleButton.label.string = this.sfxVolume > 0 ? '关闭音效' : '开启音效';
            this.drawButton(this.panels.sfxToggleButton, false);
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
        if (this.panels.infoTitleLabel) this.panels.infoTitleLabel.string = title;
        if (this.panels.infoBodyLabel) this.panels.infoBodyLabel.string = body;
        if (this.panels.infoPanel) this.panels.infoPanel.active = true;
        if (this.panels.infoPanelShadow) this.panels.infoPanelShadow.active = true;
    }

    private closeInfoPanel() {
        if (this.panels.infoPanel) this.panels.infoPanel.active = false;
        if (this.panels.infoPanelShadow) this.panels.infoPanelShadow.active = false;
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
        return getResourceDefinition(type);
    }

    private formatWallet(wallet: ResourceWallet) {
        return formatResourceWallet(wallet);
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
        this.panels.setMenuPanelActive(false);
        if (this.panels.pausePanel) this.panels.pausePanel.active = false;
        if (this.panels.pausePanelShadow) this.panels.pausePanelShadow.active = false;
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = false;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = false;
        if (this.panels.infoPanel) this.panels.infoPanel.active = false;
        if (this.panels.infoPanelShadow) this.panels.infoPanelShadow.active = false;
        if (this.panels.hangarPanel) this.panels.hangarPanel.active = true;
        if (this.panels.hangarPanelShadow) this.panels.hangarPanelShadow.active = true;
        if (this.panels.levelPanel) this.panels.levelPanel.active = false;
        if (this.panels.levelPanelShadow) this.panels.levelPanelShadow.active = false;
        this.panels.setShopPanelActive(false);
        this.panels.setCombatHudControlsActive(false);
        this.panels.lootButtons.forEach((button) => button.node.active = false);
        this.panels.setHangarControlsActive(true);
        if (this.panels.startButton) {
            this.panels.startButton.node.active = true;
            this.panels.startButton.label.string = `开始第 ${this.battlesWon + 1} 次出击`;
        }
        if (this.panels.hangarTitleLabel) this.panels.hangarTitleLabel.string = '机库整备';
        if (this.panels.hangarTipLabel) this.panels.hangarTipLabel.string = message;
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
        this.panels.equipmentButtons.forEach((button, index) => {
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
        if (this.panels.hangarStatsLabel && this.phase === 'hangar') {
            const gearSummary = GEAR_SLOT_ORDER
                .map((slot) => `${GEAR_SLOT_LABELS[slot]}${this.getEquippedGearForSlot(slot) ? '1' : '0'}/1`)
                .join('  ');
            this.panels.hangarStatsLabel.string = [
                `已完成出击 ${this.battlesWon} 次  下一次 ${this.battlesWon + 1}`,
                `库存：${this.formatWallet(this.getInventoryWallet())}`,
                `出战：武器 ${this.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}（战斗中切换）  ${gearSummary}`,
                `仓库：武器 ${this.getOwnedWeaponCount()}/${WEAPON_COUNT}  装备 ${GEAR_COUNT}  道具 ${RUN_ITEM_COUNT}  成长 ${STAT_UPGRADE_COUNT}  图鉴 ${TOTAL_ENEMY_TYPES}`,
            ].join('\n');
        }
    }

    private refreshEquippedButtons() {
        this.panels.equippedButtons.forEach((button, index) => {
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
        if (this.panels.prevEquipmentButton) {
            this.panels.prevEquipmentButton.label.string = '上一页';
            this.drawButton(this.panels.prevEquipmentButton, this.equipmentPage <= 0);
        }
        if (this.panels.nextEquipmentButton) {
            this.panels.nextEquipmentButton.label.string = '下一页';
            this.drawButton(this.panels.nextEquipmentButton, this.equipmentPage >= pageCount - 1);
        }

        if (this.panels.equipActionButton) {
            if (!selected || !this.ownedEquipment.has(selected.id)) {
                this.panels.equipActionButton.label.string = selected ? '合成' : '未解锁';
                this.drawButton(this.panels.equipActionButton, !selected || !this.hasResources(this.getCraftCost(selected)));
            } else {
                const replacingGear = selected.kind === 'gear'
                    && !!selected.gearSlot
                    && !!this.getEquippedGearForSlot(selected.gearSlot)
                    && !this.isEquipped(selected.id);
                this.panels.equipActionButton.label.string = this.isEquipped(selected.id) ? '卸下' : replacingGear ? '替换' : '加入出战';
                this.drawButton(this.panels.equipActionButton, false);
            }
        }

        if (this.panels.upgradeActionButton) {
            if (!selected || !this.ownedEquipment.has(selected.id)) {
                this.panels.upgradeActionButton.label.string = '升级';
                this.drawButton(this.panels.upgradeActionButton, true);
            } else {
                const level = this.getEquipmentLevel(selected.id);
                const cost = this.getUpgradeCost(selected);
                const disabled = level >= selected.maxLevel || !this.hasResources(cost);
                this.panels.upgradeActionButton.label.string = level >= selected.maxLevel
                    ? '已满级'
                    : `升级 ${this.formatCost(cost)}`;
                this.drawButton(this.panels.upgradeActionButton, disabled);
            }
        }

        if (this.panels.startButton) {
            const canStart = this.getEquippedWeapons().length > 0;
            this.panels.startButton.label.string = `开始第 ${this.battlesWon + 1} 次出击`;
            this.drawButton(this.panels.startButton, !canStart);
        }

        if (this.panels.equipmentDetailLabel) {
            this.panels.equipmentDetailLabel.string = selected ? this.formatEquipmentDetail(selected) : '仓库为空';
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
            const dmg = equipment.weaponStats.damage * detailLevel;
            const rate = equipment.weaponStats.fireRate * detailLevel;
            const pier = equipment.weaponStats.pierce * detailLevel;
            const multi = equipment.weaponStats.multiShot * detailLevel;
            lines.push(`伤害 ${this.formatStat(dmg)}  |  射速 ${this.formatStat(rate)}次/秒  |  穿透 ${this.formatStat(pier)}`);
            lines.push(`弹丸 +${this.formatStat(multi)}  |  弹速倍率 ${this.formatStat(equipment.weaponStats.bulletSpeed * detailLevel)}`);
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
        if (this.panels.titleLabel) this.panels.titleLabel.string = `星坠幸存者  出击 ${this.battlesWon + 1}`;
        const inRun = this.phase === 'combat' || this.phase === 'level-up' || this.phase === 'item-choice' || this.phase === 'shop';
        if (this.panels.timerLabel) {
            const waveRemain = Math.max(0, Math.ceil(this.waveDuration - this.waveElapsed));
            const waveText = this.isBossWave()
                ? `第${Math.max(1, this.waveIndex)}波 Boss${this.bossDefeatedThisWave ? ` ${waveRemain}s` : ''}`
                : `第${Math.max(1, this.waveIndex || 1)}波 ${waveRemain}s`;
            this.panels.timerLabel.string = inRun
                ? this.phase === 'shop'
                    ? '商店'
                    : waveText
                : '机库';
        }
        if (this.panels.statLabel) {
            const stats = this.getCharacterStats();
            const enemyPoolCount = inRun ? this.getAvailableEnemySpecs().length + BOSS_ENEMY_COUNT : TOTAL_ENEMY_TYPES;
            const droneText = inRun && stats.dronePower > 0
                ? ` | 机${this.formatStat(stats.dronePower)}×${this.getDroneStrikeCount(stats.dronePower)}`
                : '';
            this.panels.statLabel.string = inRun
                ? `存活 ${this.formatTime(this.combatTime)} | Lv.${this.level} | 合金 ${this.battleAlloy} | HP ${Math.ceil(this.playerHp)}/${Math.ceil(this.playerMaxHp)} 护${Math.ceil(this.playerShield)} | 暴${Math.round(stats.critChance * 100)}%${droneText} | 怪${this.enemies.length} 池${enemyPoolCount}/${TOTAL_ENEMY_TYPES}`
                : `永久资源：${this.formatWallet(this.getInventoryWallet())}`;
        }
        if (this.panels.equipmentLabel) {
            const activeWeapon = this.getActiveWeapon();
            const stats = this.getCharacterStats();
            const weaponText = activeWeapon ? `${activeWeapon.name} Lv.${this.getEquipmentLevel(activeWeapon.id)}` : '无武器';
            const droneHint = inRun && stats.dronePower > 0
                ? `  无人机 ${this.formatStat(this.getDroneStrikeInterval(stats.dronePower))}s/轮`
                : '';
            this.panels.equipmentLabel.string = inRun
                ? `当前 ${weaponText}${droneHint}  装备 ${this.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}  H调试`
                : `出战 ${this.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}武  装备 ${this.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}`;
        }
        if (this.panels.switchWeaponButton) {
            const canSwitch = this.phase === 'combat' && this.getEquippedWeapons().length > 1;
            this.panels.switchWeaponButton.node.active = inRun;
            this.panels.switchWeaponButton.label.string = '切武器';
            this.drawButton(this.panels.switchWeaponButton, !canSwitch);
        }
        if (this.panels.shopButton) {
            this.panels.shopButton.node.active = inRun;
            this.panels.shopButton.label.string = '商店';
            this.drawButton(this.panels.shopButton, this.phase !== 'combat');
        }
        if (this.panels.extractButton) {
            this.panels.extractButton.node.active = inRun;
            this.panels.extractButton.label.string = '撤离';
            this.drawButton(this.panels.extractButton, this.phase !== 'combat');
        }
        this.refreshDebugHud(inRun);
        this.drawBars();
    }

    private refreshDebugHud(inRun: boolean) {
        if (!this.panels.debugLabel) return;
        this.panels.debugLabel.node.active = inRun && this.debugHudEnabled;
        if (!inRun || !this.debugHudEnabled) {
            this.panels.debugLabel.string = '';
            return;
        }
        const boss = this.enemies.find((enemy) => enemy.boss);
        const bossText = boss ? `Boss ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}` : 'Boss -';
        this.panels.debugLabel.string = [
            `DBG ${this.phase} W${this.waveIndex} ${Math.round(this.waveElapsed)}/${Math.round(this.waveDuration)}s ${bossText}`,
            `E ${this.enemies.length}/${this.getEnemyCap()}  B ${this.bullets.length}  EP ${this.enemyProjectiles.length}/${ENEMY_PROJECTILE_LIMIT}  P ${this.pickups.length}  FT ${this.floatingTexts.length}`,
            `MS F${this.perfFrameMs.toFixed(1)} pre${this.perfPreMs.toFixed(1)} ply${this.perfPlayerMs.toFixed(1)} wep${this.perfWeaponMs.toFixed(1)} bul${this.perfBulletMs.toFixed(1)} ep${this.perfEnemyProjectileMs.toFixed(1)} ene${this.perfEnemyMs.toFixed(1)} sep${this.perfSeparationMs.toFixed(1)} pk${this.perfPickupMs.toFixed(1)} hud${this.perfHudMs.toFixed(1)}`,
            `DRAW enemy${this.perfDrawEnemy} bullet${this.perfDrawBullet} drone${this.perfDrawDrone}  STEER ${this.perfCrowdSteerCalls}/${this.perfCrowdChecks}  SEPCHK ${this.perfSepChecks}`,
        ].join('\n');
    }

    private drawBars() {
        if (this.panels.hpBar) {
            const ratio = this.playerMaxHp > 0 ? this.playerHp / this.playerMaxHp : 0;
            const shieldRatio = this.playerShieldMax > 0 ? this.playerShield / this.playerShieldMax : 0;
            this.panels.hpBar.clear();
            this.panels.hpBar.fillColor = this.hex('#1E293B');
            this.panels.hpBar.roundRect(-146, -9, 292, 18, 9);
            this.panels.hpBar.fill();
            if (shieldRatio > 0) {
                this.panels.hpBar.fillColor = this.hex('#4CC9F0', 185);
                this.panels.hpBar.roundRect(-146, -9, 292 * this.clamp(shieldRatio, 0, 1), 18, 9);
                this.panels.hpBar.fill();
            }
            this.panels.hpBar.fillColor = this.hex(ratio > 0.45 ? '#43AA8B' : '#F94144');
            this.panels.hpBar.roundRect(-146, -6, 292 * this.clamp(ratio, 0, 1), 12, 6);
            this.panels.hpBar.fill();
        }

        if (this.panels.xpBar) {
            const ratio = this.xpToNext > 0 ? this.xp / this.xpToNext : 0;
            this.panels.xpBar.clear();
            this.panels.xpBar.fillColor = this.hex('#1E293B');
            this.panels.xpBar.roundRect(-146, -9, 292, 18, 9);
            this.panels.xpBar.fill();
            this.panels.xpBar.fillColor = this.hex('#4CC9F0');
            this.panels.xpBar.roundRect(-146, -9, 292 * this.clamp(ratio, 0, 1), 18, 9);
            this.panels.xpBar.fill();
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
        this.perfDrawDrone += 1;
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
        this.perfDrawEnemy += 1;
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
        this.perfDrawBullet += 1;
        bullet.gfx.clear();
        if (bullet.sprite) {
            bullet.sprite.color = this.hex(bullet.accent, 235);
            bullet.sprite.node.getComponent(UITransform)?.setContentSize(bullet.radius * 3.2, bullet.radius * 3.2);
        }
        const tailLength = bullet.style === 'rail' ? 34 : bullet.style === 'laser' ? 42 : bullet.style === 'shotgun' ? 16 : bullet.style === 'meteor' ? 12 : 22;
        const coreRadius = bullet.radius * (bullet.style === 'rail' ? 0.56 : bullet.style === 'laser' ? 0.45 : 0.72);
        bullet.gfx.fillColor = this.hex(bullet.color, 145);
        bullet.gfx.roundRect(-tailLength, -bullet.radius * 0.42, tailLength + bullet.radius, bullet.radius * 0.84, bullet.radius * 0.42);
        bullet.gfx.fill();
        bullet.gfx.fillColor = this.hex(bullet.accent, 245);
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
        const weapon = this.getActiveWeapon();
        const weaponDamage = weapon ? weapon.weaponStats?.damage || 0 : 0;
        const level = weapon ? this.getEquipmentLevel(weapon.id) : 1;
        const base = weaponDamage * level;
        const baseAttackPower = createBaseCharacterStats().attackPower;
        const attackDelta = this.getCharacterStats().attackPower - baseAttackPower;
        return Math.max(2, base + baseAttackPower * 0.15 + attackDelta);
    }

    private getFireInterval() {
        const weapon = this.getActiveWeapon();
        const weaponFireRate = weapon ? weapon.weaponStats?.fireRate || 0 : 0;
        const level = weapon ? this.getEquipmentLevel(weapon.id) : 1;
        const baseRate = weaponFireRate * level;
        const attackSpeedBonus = this.getCharacterStats().attackSpeed;
        return Math.max(0.07, 1 / Math.max(0.15, baseRate + attackSpeedBonus * 0.45));
    }

    private getBulletSpeed() {
        const weapon = this.getActiveWeapon();
        const weaponSpeed = weapon?.weaponStats?.bulletSpeed || 0;
        const level = weapon ? this.getEquipmentLevel(weapon.id) : 1;
        const base = weaponSpeed * level;
        const bonus = this.getCharacterStats().bulletSpeed;
        return Math.max(260, 300 + base * 140 + bonus * 0.4);
    }

    private getBulletPierce() {
        const weapon = this.getActiveWeapon();
        const weaponPierce = weapon?.weaponStats?.pierce || 0;
        const level = weapon ? this.getEquipmentLevel(weapon.id) : 1;
        const base = weaponPierce * level;
        const bonus = this.getCharacterStats().pierce;
        const total = base + bonus * 0.3;
        const guaranteed = Math.floor(total);
        return guaranteed + (Math.random() < total - guaranteed ? 1 : 0);
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

        stats.attackSpeed += this.getWeaponStat('fireRate') * 0.18;
        stats.bulletSpeed += this.getWeaponStat('bulletSpeed') * 6;
        stats.pierce += this.getWeaponStat('pierce') * 0.18;
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
        const result = addStats(target, source);
        for (const key of Object.keys(target) as StatKey[]) {
            target[key] = result[key];
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
        return createResourceWallet();
    }

    private hasResources(cost: ResourceWallet) {
        return walletHasResources(this.getInventoryWallet(), cost);
    }

    private spendResources(cost: ResourceWallet) {
        const next = spendWalletResources(this.getInventoryWallet(), cost);
        if (!next) return;
        this.cores = next.cores;
        this.shards = next.shards;
        this.biomass = next.biomass;
        this.circuits = next.circuits;
        this.crystals = next.crystals;
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
        if (this.panels.debugLabel && !this.debugHudEnabled) {
            this.panels.debugLabel.node.active = false;
            this.panels.debugLabel.string = '';
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
        if (this.toastTimer <= 0 && this.panels.toastLabel) {
            this.panels.toastLabel.string = '';
        }
    }

    private showToast(message: string) {
        if (!this.panels.toastLabel) return;
        this.panels.toastLabel.string = message;
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

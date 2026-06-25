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
import { AudioManager, type AudioHostContext } from './audio/audioManager';

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
import { ENEMY_SPECS, BOSS_ENEMY_COUNT, TOTAL_ENEMY_TYPES, ENEMY_VARIANTS, buildEnemyCatalog } from './catalogs/enemyCatalog';
import { EnemyManager, ENEMY_PLAYER_PADDING, ENEMY_STRIP_META, MAX_CHESTS_PER_WAVE, type Enemy, type EnemyHostContext, type SpriteStripAnimation } from './enemy/enemyManager';
import { GameEventBus } from './core/gameContext';
import { CombatState, createCombatState, resetCombatSession } from './state/combatState';
import { ProjectileManager, BULLET_HIT_CELL, type Bullet, type EnemyProjectile, type ProjectileHostContext } from './projectile/projectileManager';
import { PickupManager, type Pickup, type PickupHostContext } from './pickup/pickupManager';
import { EquipmentManager, type ShopHostContext } from './shop/equipmentManager';

const ENEMY_PROJECTILE_LIMIT = 140;

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
const PLACEHOLDER_ART_DIR = 'art/placeholder';
const HANGAR_EQUIPMENT_SLOTS = 8;
const EQUIPPED_SLOT_COUNT = 6;
const MAX_EQUIPPED_WEAPONS = 2;
const MAX_EQUIPPED_GEAR = 4;
const MAX_COMBAT_DT = 1 / 30;

const SHOP_REFRESH_COST = 18;
const SHOP_ITEM_COUNT = 6;
const UI_SAFE_TOP = 56;
const UI_SAFE_BOTTOM = 32;
const MIN_TOUCH_BUTTON_HEIGHT = 48;


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

    private panels = new PanelManager();
    private artFrames = new Map<string, SpriteFrame>();
    private spriteStripCache = new Map<string, SpriteStripAnimation>();
    private audio = new AudioManager(this as unknown as AudioHostContext);
    private playerIdleAnimation: SpriteStripAnimation | null = null;
    private playerRunAnimations = new Map<PlayerDirection, SpriteStripAnimation>();
    private playerDirection: PlayerDirection = 'south';
    private playerMoving = false;
    private playerAnimationFrameIndex = -1;
    private playerAnimationKey = '';

    private cs: CombatState = createCombatState();

    private shop = new EquipmentManager(this as unknown as ShopHostContext);
    private weaponCooldowns: Record<string, number> = {};

    private enemyMgr = new EnemyManager(this as unknown as EnemyHostContext);
    private proj = new ProjectileManager(this as unknown as ProjectileHostContext);
    private pickupMgr = new PickupManager(this as unknown as PickupHostContext);
    private debugHudEnabled = false;
    private bus = new GameEventBus();
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
    private perfDrawDrone = 0;
    private perfCrowdSteerCalls = 0;
    private perfCrowdChecks = 0;
    private perfSepChecks = 0;


    private pressedKeys = new Set<KeyCode>();
    private touchActive = false;
    private touchOrigin = new Vec2();
    private touchVector = new Vec2();
    private toastTimer = 0;

    start() {
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, 2);
        this.createCanvas();
        this.shop.loadProgress();
        this.buildScene();
        this.audio.initAudio();
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
        this.audio.updateSfxCooldowns(dt);
        this.pickupMgr.updateFloatingTexts(dt);
        this.perfPreMs = this.perfNow() - t;

        if (this.cs.phase === 'combat') {
            const combatDt = Math.min(dt, MAX_COMBAT_DT);
            this.cs.combatTime += combatDt;
            this.cs.invulnerableTimer = Math.max(0, this.cs.invulnerableTimer - combatDt);

            t = this.perfNow();
            this.updatePlayer(combatDt);
            this.updateDroneVisuals(combatDt);
            this.updateCamera(combatDt);
            this.perfPlayerMs = this.perfNow() - t;

            t = this.perfNow();
            this.enemyMgr.updateSpawning(combatDt);
            this.updateWeapons(combatDt);
            this.perfWeaponMs = this.perfNow() - t;

            t = this.perfNow();
            this.proj.updateBullets(combatDt);
            this.perfBulletMs = this.perfNow() - t;

            t = this.perfNow();
            this.proj.updateEnemyProjectiles(combatDt);
            this.perfEnemyProjectileMs = this.perfNow() - t;

            t = this.perfNow();
            this.enemyMgr.updateEnemies(combatDt);
            this.resolvePlayerAfterEnemyMovement();
            this.updateDroneVisuals(0);
            this.perfEnemyMs = this.perfNow() - t;

            t = this.perfNow();
            this.pickupMgr.updatePickups(combatDt);
            this.updateRegen(combatDt);
            this.updateShield(combatDt);
            this.perfPickupMs = this.perfNow() - t;

            if (this.cs.playerHp <= 0) {
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
        this.proj.perfDrawBullet = 0;
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
        this.audio.initAudio();
    }

    private unlockAudio() {
        this.audio.unlockAudio();
    }

    private updateSfxCooldowns(dt: number) {
        this.audio.updateSfxCooldowns(dt);
    }

    private playSfx(name: string, volume = 1, cooldown = 0.035) {
        this.audio.playSfx(name, volume, cooldown);
    }

    private playShootSfx(style: WeaponAttackStyle) {
        this.audio.playShootSfx(style);
    }

    private requestBgm(name: string) {
        this.audio.requestBgm(name);
    }

    private syncBgmForPhase(forceRestart = false) {
        this.audio.syncBgmForPhase(forceRestart);
    }

    private requestPhaseBgm() {
        this.audio.requestPhaseBgm();
    }

    private refreshSettingsPanel() {
        if (this.panels.settingsBodyLabel) {
            this.panels.settingsBodyLabel.string = `音乐：${this.audio.bgmVolume > 0 ? '开启' : '关闭'}\n音效：${this.audio.sfxVolume > 0 ? '开启' : '关闭'}`;
        }
        if (this.panels.bgmToggleButton) {
            this.panels.bgmToggleButton.label.string = this.audio.bgmVolume > 0 ? '关闭音乐' : '开启音乐';
            this.drawButton(this.panels.bgmToggleButton, false);
        }
        if (this.panels.sfxToggleButton) {
            this.panels.sfxToggleButton.label.string = this.audio.sfxVolume > 0 ? '关闭音效' : '开启音效';
            this.drawButton(this.panels.sfxToggleButton, false);
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
        this.panels.shopButton = this.button(root, 'OpenShopButton', 378, top + 82, 86, MIN_TOUCH_BUTTON_HEIGHT, '#4CC9F0', '#94A3B8', () => this.shop.openShop());
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
        this.panels.levelBackButton = this.button(panel, 'LevelBack', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.pickupMgr.choosePanelChoice(0), true);
        this.panels.levelBackButton.label.string = '返回';
        this.panels.levelHintLabel = this.label(panel, 'LevelHint', '选择一项自身属性成长，战斗会继续。', 42, 86, 564, 42, 20, '#475569', Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LevelChoice_${i}`, 54, 148 + i * 84, 540, 68, '#4CC9F0', '#94A3B8', () => this.pickupMgr.choosePanelChoice(i), true);
            this.panels.levelChoiceButtons.push(button);
        }
        this.panels.levelRefreshButton = this.button(panel, 'ChoiceRefresh', 204, 414, 240, 48, '#F8961E', '#94A3B8', () => this.pickupMgr.refreshCurrentChoices(), true);
        this.panels.levelRefreshButton.label.string = '刷新 -28合金';
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
                () => this.shop.buyShopItem(i),
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
                () => this.shop.refreshShopSlot(i),
                true,
            );
            refreshButton.label.fontSize = 16;
            refreshButton.label.lineHeight = 18;
            this.panels.shopSlotRefreshButtons.push(refreshButton);
        }

        this.panels.shopCloseButton = this.button(panel, 'ShopClose', 204, 824, 264, 52, '#43AA8B', '#94A3B8', () => this.shop.closeShop(), true);
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
            const button = this.button(panel, `LootChoice_${i}`, 58, 208 + i * 92, 556, 76, '#F8961E', '#94A3B8', () => this.pickupMgr.chooseLoot(i), true);
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
                () => this.shop.selectEquippedSlot(i),
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
                () => this.shop.selectVisibleEquipment(i),
                true,
            );
            this.panels.equipmentButtons.push(button);
        }

        this.panels.prevEquipmentButton = this.button(panel, 'EquipmentPrev', 46, 706, 104, 52, '#64748B', '#94A3B8', () => this.shop.changeEquipmentPage(-1), true);
        this.panels.equipActionButton = this.button(panel, 'EquipAction', 164, 706, 170, 52, '#4CC9F0', '#94A3B8', () => this.shop.toggleSelectedEquipment(), true);
        this.panels.upgradeActionButton = this.button(panel, 'UpgradeAction', 348, 706, 170, 52, '#F8961E', '#94A3B8', () => this.shop.upgradeSelectedEquipment(), true);
        this.panels.nextEquipmentButton = this.button(panel, 'EquipmentNext', 532, 706, 104, 52, '#64748B', '#94A3B8', () => this.shop.changeEquipmentPage(1), true);

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
        this.panels.bgmToggleButton = this.button(panel, 'BgmToggle', 116, 204, 340, 58, '#4CC9F0', '#94A3B8', () => this.audio.toggleBgm(), true);
        this.panels.sfxToggleButton = this.button(panel, 'SfxToggle', 116, 278, 340, 58, '#B5179E', '#94A3B8', () => this.audio.toggleSfx(), true);
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
        this.cs.phase = 'menu';
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
        this.shop.showHangar('选择装备后开始出击。');
    }

    private beginBattle(initial: boolean) {
        if (this.shop.getEquippedWeapons().length <= 0) {
            this.showToast('至少需要携带 1 把武器才能出战。');
            this.shop.showHangar('先从仓库里选择一把武器加入出战。');
            return;
        }

        this.clearWorld();
        this.cs.phase = 'combat';
        this.requestBgm('bgm_combat_loop');
        this.cs.battleIndex = this.cs.battlesWon + 1;
        resetCombatSession(this.cs);
        this.enemyMgr.currentWaveSpecs = [];
        this.pickupMgr.resetRun();
        this.shop.shopOffers = [];
        this.weaponCooldowns = {};
        this.updateCamera(0, true);
        this.cs.playerMaxHp = this.getMaxHp();
        this.cs.playerHp = this.cs.playerMaxHp;
        this.cs.playerShieldMax = this.getShieldMax();
        this.cs.playerShield = this.cs.playerShieldMax;
        this.touchActive = false;
        this.touchVector.set(0, 0);

        this.panels.hideAllOverlays();
        if (this.joystickBase) this.joystickBase.active = false;
        if (this.joystickKnob) this.joystickKnob.active = false;
        this.panels.setCombatHudControlsActive(true);

        this.createPlayer();
        this.refreshHud();
        this.showToast(initial ? '无尽出击开始：撑得越久，带回资源越多。' : `第 ${this.cs.battleIndex} 次出击开始，Boss 阶段会循环增强。`);
    }

    private createPlayer() {
        const node = new Node('Player');
        node.layer = Layers.Enum.UI_2D;
        this.worldNode!.addChild(node);
        node.setPosition(this.cs.playerX, this.cs.playerY, 10);
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
        const weapon = this.shop.getActiveWeapon();
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
        let nextX = this.clamp(this.cs.playerX + move.x * speed * dt, WORLD_LEFT + 42, WORLD_RIGHT - 42);
        let nextY = this.clamp(this.cs.playerY + move.y * speed * dt, WORLD_BOTTOM + 42, WORLD_TOP - 42);
        const resolved = this.resolvePlayerEnemyCollision(nextX, nextY);
        nextX = resolved.x;
        nextY = resolved.y;
        this.cs.playerX = nextX;
        this.cs.playerY = nextY;
        if (this.playerNode) {
            this.playerNode.setPosition(this.cs.playerX, this.cs.playerY, 10);
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

        const target = this.cs.phase === 'combat' ? this.enemyMgr.findNearestEnemy(Math.min(this.getAttackRange(), 900)) : null;
        if (target) {
            this.playerWeaponAimAngle = Math.atan2(target.node.position.y - this.cs.playerY, target.node.position.x - this.cs.playerX);
        } else if (move && Math.abs(move.x) + Math.abs(move.y) > 0.01) {
            this.playerWeaponAimAngle = Math.atan2(move.y, move.x);
        }

        const angle = this.playerWeaponAimAngle;
        const frontLayer = Math.sin(angle) < 0.35;
        const distance = frontLayer ? 24 : 17;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance - 3;
        const scaleY = Math.cos(angle) < -0.05 ? -1 : 1;
        const size = this.getWeaponFamilyId(this.shop.getActiveWeapon()?.id || 'storm-rifle') === 'orbital-drone' ? 34 : 42;
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

        const frameIndex = Math.floor(this.cs.combatTime * animation.fps) % animation.frames.length;
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
            for (const enemy of this.enemyMgr.enemies) {
                const ex = enemy.node.position.x;
                const ey = enemy.node.position.y;
                const minDist = this.cs.playerRadius + enemy.radius + ENEMY_PLAYER_PADDING;
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
        const resolved = this.resolvePlayerEnemyCollision(this.cs.playerX, this.cs.playerY);
        if (Math.abs(resolved.x - this.cs.playerX) < 0.01 && Math.abs(resolved.y - this.cs.playerY) < 0.01) return;
        this.cs.playerX = resolved.x;
        this.cs.playerY = resolved.y;
        if (this.playerNode) {
            this.playerNode.setPosition(this.cs.playerX, this.cs.playerY, 10);
        }
        this.drawPlayer();
    }

    private updateCamera(dt: number, snap = false) {
        if (!this.worldNode) return;
        const targetX = this.clamp(CAMERA_FOCUS_X - this.cs.playerX, VIEW_RIGHT - WORLD_RIGHT, VIEW_LEFT - WORLD_LEFT);
        const targetY = this.clamp(CAMERA_FOCUS_Y - this.cs.playerY, VIEW_TOP - WORLD_TOP, VIEW_BOTTOM - WORLD_BOTTOM);
        const follow = snap ? 1 : Math.min(1, dt * 8.5);
        this.cs.cameraX += (targetX - this.cs.cameraX) * follow;
        this.cs.cameraY += (targetY - this.cs.cameraY) * follow;
        this.worldNode.setPosition(this.cs.cameraX, this.cs.cameraY, 0);
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


    private updateWeapons(dt: number) {
        this.cs.shotTimer -= dt;
        if (this.cs.shotTimer <= 0) {
            const target = this.enemyMgr.findNearestEnemy(this.getAttackRange());
            if (target) {
                this.fireAt(target);
                this.cs.shotTimer = this.proj.getFireInterval();
            }
        }

        const dronePower = this.getCharacterStats().dronePower;
        if (dronePower > 0) {
            this.cs.droneTimer -= dt;
            if (this.cs.droneTimer <= 0) {
                const strikes = this.getDroneStrikeCount(dronePower);
                for (let i = 0; i < strikes; i++) {
                    const target = this.enemyMgr.findNearestEnemy(this.getDroneRange(dronePower));
                    if (target) this.enemyMgr.droneStrike(target, dronePower);
                }
                this.cs.droneTimer = this.getDroneStrikeInterval(dronePower);
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
        const dx = target.node.position.x - this.cs.playerX;
        const dy = target.node.position.y - this.cs.playerY;
        const baseAngle = Math.atan2(dy, dx);
        this.playerWeaponAimAngle = baseAngle;
        this.updatePlayerWeaponVisual();
        const damage = this.proj.getBulletDamage();
        const activeWeapon = this.shop.getActiveWeapon();
        const weaponStyle = activeWeapon?.attackStyle || 'rifle';
        const weaponColor = activeWeapon?.color || '#4CC9F0';
        const spreadPower = this.getCharacterStats().multiShot;
        const angles = [baseAngle];
        this.cs.shotCounter += 1;

        const guaranteedExtra = Math.min(3, Math.floor(spreadPower / 2.2));
        if (guaranteedExtra > 0) {
            for (let i = 1; i <= guaranteedExtra; i++) {
                angles.push(baseAngle + i * 0.13, baseAngle - i * 0.13);
            }
        }
        if (spreadPower > 0 && this.cs.shotCounter % Math.max(2, 6 - Math.floor(spreadPower / 1.7)) === 0) {
            angles.push(baseAngle + 0.24, baseAngle - 0.24);
            if (spreadPower >= 4) angles.push(baseAngle + 0.42, baseAngle - 0.42);
            if (spreadPower >= 9) angles.push(baseAngle + 0.6, baseAngle - 0.6);
        }

        for (const angle of angles) {
            this.proj.createBullet(angle, damage, this.proj.getBulletPierce(), weaponStyle, weaponColor);
        }
        this.audio.playShootSfx(weaponStyle);
        this.proj.spawnMuzzleFlash(baseAngle, weaponStyle, weaponColor, angles.length);
    }

    private updateRegen(dt: number) {
        const regen = this.getCharacterStats().hpRegen;
        if (regen <= 0 || this.cs.playerHp <= 0 || this.cs.playerHp >= this.cs.playerMaxHp) return;
        this.cs.regenTimer += dt;
        if (this.cs.regenTimer >= 1) {
            this.cs.regenTimer = 0;
            this.healPlayer(regen);
        }
    }

    private updateShield(dt: number) {
        const stats = this.getCharacterStats();
        this.cs.playerShieldMax = this.getShieldMax();
        if (this.cs.playerShieldMax <= 0) {
            this.cs.playerShield = 0;
            return;
        }
        this.cs.shieldRechargeDelay = Math.max(0, this.cs.shieldRechargeDelay - dt);
        if (this.cs.shieldRechargeDelay > 0 || this.cs.playerShield >= this.cs.playerShieldMax) return;
        this.cs.playerShield = Math.min(this.cs.playerShieldMax, this.cs.playerShield + stats.shieldRegen * dt);
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
            this.cs.invulnerableTimer = 0.18;
            this.pickupMgr.spawnFloatingText('闪避', this.cs.playerX, this.cs.playerY + this.cs.playerRadius + 28, '#4CC9F0', 24);
            return;
        }

        const defense = this.getDefenseAgainst(type, stats);
        const defenseRatio = 100 / (100 + Math.max(-45, defense));
        let damage = Math.max(1, amount * defenseRatio * (1 - stats.damageReduction));
        const shieldDamage = Math.min(this.cs.playerShield, damage);
        if (shieldDamage > 0) {
            this.cs.playerShield -= shieldDamage;
            damage -= shieldDamage;
            this.pickupMgr.spawnFloatingText(`护盾 -${Math.ceil(shieldDamage)}`, this.cs.playerX, this.cs.playerY + this.cs.playerRadius + 42, '#4CC9F0', 20);
        }
        if (damage > 0) {
            this.cs.playerHp = Math.max(0, this.cs.playerHp - damage);
            this.bus.emit('player-hit', { damage, type });
            this.playSfx('sfx_player_hit', 0.65, 0.28);
            this.pickupMgr.spawnFloatingText(`-${Math.ceil(damage)}`, this.cs.playerX, this.cs.playerY + this.cs.playerRadius + 28, '#F94144', 25);
            this.showToast(`受击 -${Math.ceil(damage)}，拉开距离。`);
        }
        this.cs.invulnerableTimer = 0.42;
        this.cs.shieldRechargeDelay = 1.6;
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
        const before = this.cs.playerHp;
        this.cs.playerHp = Math.min(this.cs.playerMaxHp, this.cs.playerHp + amount);
        const healed = this.cs.playerHp - before;
        if (healed > 0.05) {
            this.bus.emit('player-heal', { amount: healed });
            this.pickupMgr.spawnFloatingText(`+${Math.ceil(healed)}`, this.cs.playerX, this.cs.playerY + this.cs.playerRadius + 34, '#43AA8B', 23);
        }
    }

    private extractBattle() {
        if (this.cs.phase !== 'combat') return;
        this.finishBattle('extract');
    }

    private finishBattle(reason: BattleEndReason) {
        if (this.cs.phase !== 'combat') return;
        this.bus.emit('battle-end', { reason });
        const reward = this.calculateEndlessReward(reason);
        this.cs.battleAlloy = 0;
        this.addWalletToInventory(reward);
        this.cs.battlesWon += 1;
        this.shop.saveProgress();
        this.clearWorld();
        this.openSettlement(reason, reward);
    }

    private openSettlement(reason: BattleEndReason, reward: ResourceWallet) {
        this.cs.phase = 'hangar';
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
                `存活 ${this.formatTime(this.cs.combatTime)}  Boss ${this.cs.bossKills}  击杀 ${this.cs.killCount}`,
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
        this.shop.refreshEquipmentButtons();
        this.refreshHud();
    }

    private pauseCombat() {
        if (this.cs.phase !== 'combat') return;
        this.cs.phaseBeforePause = this.cs.phase;
        this.cs.phase = 'paused';
        this.touchActive = false;
        this.touchVector.set(0, 0);
        this.updateJoystickView();
        if (this.panels.pausePanel) this.panels.pausePanel.active = true;
        if (this.panels.pausePanelShadow) this.panels.pausePanelShadow.active = true;
        this.showToast('');
    }

    private resumeFromPause() {
        if (this.cs.phase !== 'paused') return;
        this.cs.phase = this.cs.phaseBeforePause === 'combat' ? 'combat' : 'combat';
        if (this.panels.pausePanel) this.panels.pausePanel.active = false;
        if (this.panels.pausePanelShadow) this.panels.pausePanelShadow.active = false;
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = false;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = false;
        if (this.panels.infoPanel) this.panels.infoPanel.active = false;
        if (this.panels.infoPanelShadow) this.panels.infoPanelShadow.active = false;
        this.audio.requestPhaseBgm();
        this.showToast('战斗继续。');
    }

    private returnToHangarFromPause() {
        if (this.cs.phase !== 'paused') return;
        this.clearWorld();
        this.panels.hideAllOverlays();
        this.shop.showHangar('已返回机库，可调整装备后重新出击。');
    }

    private openSettingsPanel() {
        if (this.cs.phase === 'combat') this.pauseCombat();
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = true;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = true;
        this.refreshSettingsPanel();
    }

    private closeSettingsPanel() {
        if (this.panels.settingsPanel) this.panels.settingsPanel.active = false;
        if (this.panels.settingsPanelShadow) this.panels.settingsPanelShadow.active = false;
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
        if (this.cs.phase === 'combat') this.pauseCombat();
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
        reward.shards += Math.floor(this.cs.combatTime / 48 + this.cs.killCount / 78 + this.cs.bossKills * 5);
        reward.biomass += Math.floor(this.cs.combatTime / 56 + this.cs.killCount / 66 + this.cs.bossKills * 2);
        reward.circuits += Math.floor(this.cs.combatTime / 70 + this.cs.killCount / 98 + this.cs.bossKills * 3);
        reward.cores += this.cs.bossKills;
        reward.crystals += Math.floor(this.cs.bossKills / 2);

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
        return Math.max(0, this.cs.battleAlloy);
    }

    private spendRunAlloy(cost: number) {
        const amount = Math.max(0, Math.floor(cost));
        if (this.getSpendableAlloy() < amount) return false;
        this.cs.battleAlloy -= amount;
        this.refreshHud();
        return true;
    }

    private getBattleWallet(): ResourceWallet {
        return {
            alloy: this.cs.battleAlloy,
            cores: this.cs.battleCores,
            shards: this.cs.battleShards,
            biomass: this.cs.battleBiomass,
            circuits: this.cs.battleCircuits,
            crystals: this.cs.battleCrystals,
        };
    }

    private getInventoryWallet(): ResourceWallet {
        return {
            alloy: 0,
            cores: this.cs.cores,
            shards: this.cs.shards,
            biomass: this.cs.biomass,
            circuits: this.cs.circuits,
            crystals: this.cs.crystals,
        };
    }

    private addBattleResource(type: ResourceType, amount: number) {
        const value = Math.max(0, Math.floor(amount));
        switch (type) {
            case 'alloy':
                this.cs.battleAlloy += value;
                break;
            case 'cores':
                this.cs.battleCores += value;
                break;
            case 'shards':
                this.cs.battleShards += value;
                break;
            case 'biomass':
                this.cs.battleBiomass += value;
                break;
            case 'circuits':
                this.cs.battleCircuits += value;
                break;
            case 'crystals':
                this.cs.battleCrystals += value;
                break;
            default:
                break;
        }
    }

    private addWalletToInventory(wallet: ResourceWallet) {
        this.cs.cores += wallet.cores;
        this.cs.shards += wallet.shards;
        this.cs.biomass += wallet.biomass;
        this.cs.circuits += wallet.circuits;
        this.cs.crystals += wallet.crystals;
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

    private refreshEquippedButtons() {
        // Delegated to shop
    }

    private refreshHangarActions() {
        // Delegated to shop
    }

    private refreshHud() {
        if (this.panels.titleLabel) this.panels.titleLabel.string = `星坠幸存者  出击 ${this.cs.battlesWon + 1}`;
        const inRun = this.cs.phase === 'combat' || this.cs.phase === 'level-up' || this.cs.phase === 'item-choice' || this.cs.phase === 'shop';
        if (this.panels.timerLabel) {
            const waveRemain = Math.max(0, Math.ceil(this.cs.waveDuration - this.cs.waveElapsed));
            const waveText = this.enemyMgr.isBossWave()
                ? `第${Math.max(1, this.cs.waveIndex)}波 Boss${this.cs.bossDefeatedThisWave ? ` ${waveRemain}s` : ''}`
                : `第${Math.max(1, this.cs.waveIndex || 1)}波 ${waveRemain}s`;
            this.panels.timerLabel.string = inRun
                ? this.cs.phase === 'shop'
                    ? '商店'
                    : waveText
                : '机库';
        }
        if (this.panels.statLabel) {
            const stats = this.getCharacterStats();
            const enemyPoolCount = inRun ? this.enemyMgr.getAvailableEnemySpecs().length + BOSS_ENEMY_COUNT : TOTAL_ENEMY_TYPES;
            const droneText = inRun && stats.dronePower > 0
                ? ` | 机${this.shop.formatStat(stats.dronePower)}×${this.getDroneStrikeCount(stats.dronePower)}`
                : '';
            this.panels.statLabel.string = inRun
                ? `存活 ${this.formatTime(this.cs.combatTime)} | Lv.${this.cs.level} | 合金 ${this.cs.battleAlloy} | HP ${Math.ceil(this.cs.playerHp)}/${Math.ceil(this.cs.playerMaxHp)} 护${Math.ceil(this.cs.playerShield)} | 暴${Math.round(stats.critChance * 100)}%${droneText} | 怪${this.enemyMgr.enemies.length} 池${enemyPoolCount}/${TOTAL_ENEMY_TYPES}`
                : `永久资源：${this.formatWallet(this.getInventoryWallet())}`;
        }
        if (this.panels.equipmentLabel) {
            const activeWeapon = this.shop.getActiveWeapon();
            const stats = this.getCharacterStats();
            const weaponText = activeWeapon ? `${activeWeapon.name} Lv.${this.shop.getEquipmentLevel(activeWeapon.id)}` : '无武器';
            const droneHint = inRun && stats.dronePower > 0
                ? `  无人机 ${this.shop.formatStat(this.getDroneStrikeInterval(stats.dronePower))}s/轮`
                : '';
            this.panels.equipmentLabel.string = inRun
                ? `当前 ${weaponText}${droneHint}  装备 ${this.shop.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}  H调试`
                : `出战 ${this.shop.getEquippedWeapons().length}/${MAX_EQUIPPED_WEAPONS}武  装备 ${this.shop.getEquippedGear().length}/${MAX_EQUIPPED_GEAR}`;
        }
        if (this.panels.switchWeaponButton) {
            const canSwitch = this.cs.phase === 'combat' && this.shop.getEquippedWeapons().length > 1;
            this.panels.switchWeaponButton.node.active = inRun;
            this.panels.switchWeaponButton.label.string = '切武器';
            this.drawButton(this.panels.switchWeaponButton, !canSwitch);
        }
        if (this.panels.shopButton) {
            this.panels.shopButton.node.active = inRun;
            this.panels.shopButton.label.string = '商店';
            this.drawButton(this.panels.shopButton, this.cs.phase !== 'combat');
        }
        if (this.panels.extractButton) {
            this.panels.extractButton.node.active = inRun;
            this.panels.extractButton.label.string = '撤离';
            this.drawButton(this.panels.extractButton, this.cs.phase !== 'combat');
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
        const boss = this.enemyMgr.enemies.find((enemy) => enemy.boss);
        const bossText = boss ? `Boss ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}` : 'Boss -';
        this.panels.debugLabel.string = [
            `DBG ${this.cs.phase} W${this.cs.waveIndex} ${Math.round(this.cs.waveElapsed)}/${Math.round(this.cs.waveDuration)}s ${bossText}`,
            `E ${this.enemyMgr.enemies.length}/${this.enemyMgr.getEnemyCap()}  B ${this.proj.bullets.length}  EP ${this.proj.enemyProjectiles.length}/${ENEMY_PROJECTILE_LIMIT}  P ${this.pickupMgr.pickups.length}  FT ${this.pickupMgr.floatingTexts.length}`,
            `MS F${this.perfFrameMs.toFixed(1)} pre${this.perfPreMs.toFixed(1)} ply${this.perfPlayerMs.toFixed(1)} wep${this.perfWeaponMs.toFixed(1)} bul${this.perfBulletMs.toFixed(1)} ep${this.perfEnemyProjectileMs.toFixed(1)} ene${this.perfEnemyMs.toFixed(1)} sep${this.perfSeparationMs.toFixed(1)} pk${this.perfPickupMs.toFixed(1)} hud${this.perfHudMs.toFixed(1)}`,
            `DRAW enemy${this.perfDrawEnemy} bullet${this.proj.perfDrawBullet} drone${this.perfDrawDrone}  STEER ${this.perfCrowdSteerCalls}/${this.perfCrowdChecks}  SEPCHK ${this.perfSepChecks}`,
        ].join('\n');
    }

    private drawBars() {
        if (this.panels.hpBar) {
            const ratio = this.cs.playerMaxHp > 0 ? this.cs.playerHp / this.cs.playerMaxHp : 0;
            const shieldRatio = this.cs.playerShieldMax > 0 ? this.cs.playerShield / this.cs.playerShieldMax : 0;
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
            const ratio = this.cs.xpToNext > 0 ? this.cs.xp / this.cs.xpToNext : 0;
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
        if (!this.worldNode || this.cs.phase !== 'combat' || !this.playerNode) {
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
            const angle = this.cs.combatTime * orbitSpeed + visual.phase;
            const x = this.cs.playerX + Math.cos(angle) * orbitRadius;
            const y = this.cs.playerY + Math.sin(angle) * orbitRadius * 0.74 + 8;
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
        return { x: this.cs.playerX, y: this.cs.playerY };
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
        const pulse = this.cs.invulnerableTimer > 0 ? 120 : 255;
        this.playerGfx.clear();
        if (this.playerSprite) {
            this.playerSprite.color = this.hex('#FFFFFF', pulse);
            this.playerGfx.fillColor = this.hex('#020617', 95);
            this.playerGfx.circle(3, -6, 27);
            this.playerGfx.fill();
            this.playerGfx.strokeColor = this.hex(this.cs.invulnerableTimer > 0 ? '#F8FAFC' : '#4CC9F0', pulse);
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
        if (!this.touchActive || this.cs.phase !== 'combat') {
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


    private pickLevelChoices(): LevelUpgrade[] {
        const maxTier = this.cs.level < 4 ? 2 : this.cs.level < 8 ? 3 : this.cs.level < 13 ? 4 : 5;
        const available = LEVEL_UPGRADES.filter((item) => item.tier <= maxTier && !this.pickupMgr.acquiredStatUpgradeIds.has(item.id));
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
        const maxTier = this.shop.getRunItemTierLimit();
        const minTier = quality === 'rare' ? Math.max(3, Math.min(5, maxTier - 1)) : 1;
        const tierCeiling = quality === 'rare' ? Math.max(3, maxTier) : Math.min(3, maxTier);
        const available = RUN_ITEMS.filter((item) =>
            item.tier >= minTier
            && item.tier <= tierCeiling
            && !this.pickupMgr.acquiredRunItemIds.has(item.id),
        );
        const fallback = RUN_ITEMS.filter((item) => item.tier >= minTier && item.tier <= tierCeiling);
        return this.shop.pickDistinctItems(available.length >= 3 ? available : fallback, 3);
    }

    private pickShopOffers(): LevelUpgrade[] {
        const maxTier = this.shop.getRunItemTierLimit();
        const available = RUN_ITEMS.filter((item) => item.tier <= maxTier && !this.pickupMgr.acquiredRunItemIds.has(item.id));
        const fallback = RUN_ITEMS.filter((item) => item.tier <= maxTier);
        return this.shop.pickDistinctItems(available.length >= SHOP_ITEM_COUNT ? available : fallback, SHOP_ITEM_COUNT);
    }

    private switchActiveWeapon() {
        if (this.cs.phase !== 'combat') return;
        const weapons = this.shop.getEquippedWeapons();
        if (weapons.length <= 1) {
            this.showToast('只携带 1 把武器，无法切换。');
            return;
        }
        const current = this.shop.getActiveWeapon();
        if (current) this.weaponCooldowns[current.id] = Math.max(0, this.cs.shotTimer);
        this.cs.activeWeaponIndex = (this.cs.activeWeaponIndex + 1) % weapons.length;
        const next = this.shop.getActiveWeapon();
        this.cs.shotTimer = next ? Math.min(this.weaponCooldowns[next.id] ?? 0.18, this.proj.getFireInterval()) : 0.18;
        this.playerWeaponFrameName = '';
        this.updatePlayerWeaponVisual();
        this.playSfx('sfx_ui_click', 0.42, 0.08);
        this.showToast(next ? `切换武器：${next.name}` : '已切换武器。');
        this.refreshHud();
    }

    private getWeaponStat(stat: keyof WeaponStats) {
        const weapon = this.shop.getActiveWeapon();
        return weapon ? (weapon.weaponStats?.[stat] || 0) * this.shop.getEquipmentLevel(weapon.id) : 0;
    }

    private getCharacterStats(): CharacterStats {
        const stats = createBaseCharacterStats();
        this.addCharacterStats(stats, this.pickupMgr.runStats);

        stats.attackSpeed += this.getWeaponStat('fireRate') * 0.18;
        stats.bulletSpeed += this.getWeaponStat('bulletSpeed') * 6;
        stats.pierce += this.getWeaponStat('pierce') * 0.18;
        stats.multiShot += this.getWeaponStat('multiShot');
        stats.dronePower += this.getWeaponStat('drone');

        for (const gear of this.shop.getEquippedGear()) {
            const level = this.shop.getEquipmentLevel(gear.id);
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

    private createEmptyWallet(): ResourceWallet {
        return createResourceWallet();
    }

    private hasResources(cost: ResourceWallet) {
        return walletHasResources(this.getInventoryWallet(), cost);
    }

    private spendResources(cost: ResourceWallet) {
        const next = spendWalletResources(this.getInventoryWallet(), cost);
        if (!next) return;
        this.cs.cores = next.cores;
        this.cs.shards = next.shards;
        this.cs.biomass = next.biomass;
        this.cs.circuits = next.circuits;
        this.cs.crystals = next.crystals;
    }

    private formatCost(cost: ResourceWallet) {
        return this.formatWallet(cost);
    }

    private clearWorld() {
        for (const enemy of this.enemyMgr.enemies) enemy.node.destroy();
        for (const bullet of [...this.proj.bullets]) this.proj.recycleBullet(bullet, true);
        for (const projectile of [...this.proj.enemyProjectiles]) this.proj.recycleEnemyProjectile(projectile, true);
        this.pickupMgr.clearAll();
        this.clearDroneVisuals();
        if (this.playerNode) this.playerNode.destroy();
        this.enemyMgr.enemies = [];
        this.enemyMgr.enemySet.clear();
        this.enemyMgr.currentWaveSpecs = [];
        this.enemyMgr.enemySepTick = 999;

        this.playerNode = null;
        this.playerGfx = null;
        this.playerSprite = null;
        this.playerWeaponSprite = null;
        this.playerWeaponFrameName = '';
        this.cs.cameraX = 0;
        this.cs.cameraY = 0;
        if (this.worldNode) this.worldNode.setPosition(0, 0, 0);
    }

    private removePickup(pickup: Pickup) {
        const index = this.pickupMgr.pickups.indexOf(pickup);
        if (index >= 0) this.pickupMgr.pickups.splice(index, 1);
        pickup.node.destroy();
    }

    private onKeyDown(event: EventKeyboard) {
        this.unlockAudio();
        this.pressedKeys.add(event.keyCode);
        if (event.keyCode === KeyCode.ESCAPE) {
            if (this.cs.phase === 'combat') this.pauseCombat();
            else if (this.cs.phase === 'paused') this.resumeFromPause();
            else if (this.cs.phase === 'hangar') this.openMainMenu();
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
        if (this.cs.phase !== 'combat') return;
        const location = event.getUILocation();
        this.touchActive = true;
        this.touchOrigin.set(location.x, location.y);
        this.updateTouchVector(location);
    }

    private onTouchMove(event: EventTouch) {
        if (!this.touchActive || this.cs.phase !== 'combat') return;
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

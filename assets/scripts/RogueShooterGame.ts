// @ts-nocheck
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
import { AdManager } from './ad/AdManager';

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
    LEVEL_UP_BLUEPRINTS,
    formatRunItemEffect,
    scaleRunItemEffect as catalogScaleRunItemEffect,
    scaleRunItemEffects as catalogScaleRunItemEffects,
    buildRunItemCatalog as catalogBuildRunItemCatalog,
    RUN_ITEM_BLUEPRINTS as catalogRUN_ITEM_BLUEPRINTS,
    ITEM_TIER_NAMES as catalogITEM_TIER_NAMES,
    TRADEOFF_POSITIVE_BONUS as catalogTRADEOFF_POSITIVE_BONUS,
    rollStatUpgradeChoice as catalogRollStatUpgradeChoice,
} from './catalogs/runItemCatalog';
import { WEAPON_FAMILIES, WEAPON_VARIANTS, WEAPON_CATALOG, WEAPON_COUNT, buildWeaponCatalog, getWeaponStyleName } from './catalogs/weaponCatalog';
import { EQUIPMENT, GEAR_BLUEPRINTS, GEAR_RARITIES, GEAR_CATALOG, GEAR_COUNT, STARTER_EQUIPMENT_IDS } from './catalogs/equipmentCatalog';
import {
    canFinishBattle,
    getReviveDeclinePhase,
    getSettlementFlow,
    getSettlementTip,
    shouldShowExtractDouble,
} from './flow/battleFlow';
import { ENEMY_SPECS, TOTAL_ENEMY_TYPES, ENEMY_VARIANTS, buildEnemyCatalog } from './catalogs/enemyCatalog';
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
const WORLD_LEFT = -1400;
const WORLD_RIGHT = 1400;
const WORLD_BOTTOM = -1800;
const WORLD_TOP = 1800;
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
    // ── UI Theme: Dark Glass ──────────────────────────────────────
    private static readonly UI = {
        // Starship Arsenal theme — dark glass, neon cyan, warm alloy accents.
        // v2.0: Slimmer, card-based, round corners, better contrast
        panelBg: '#0A1628',
        panelBgDeep: '#060E1C',
        panelBgLift: '#12243D',
        panelBorder: '#1A3D5C',
        panelBorderHot: '#F59E0B',
        panelShadow: '#000000',
        panelAlpha: 235,
        glassHighlight: '#5EEAD4',
        glassLowlight: '#0A1628',
        sectionBg: '#0D1F33',
        cardBg: '#102840',
        cardBgHighlight: '#163A58',
        cardBorder: '#1F4A6F',
        // Text
        title: '#F1F5F9',
        body: '#B6C8D9',
        hint: '#6F879E',
        accent: '#E0F2FE',
        goldText: '#FDE68A',
        cyanText: '#A5F3FC',
        // HUD
        hudBg: '#050C14',
        hudBgAlpha: 210,
        hudBorder: '#1A3D5C',
        hudAccent: '#F97316',
        // Bars
        hpBarBg: '#1A2433',
        hpBarFill: '#F43F5E',
        shieldFill: '#60A5FA',
        xpBarBg: '#132337',
        xpBarFill: '#22D3EE',
        barLabel: '#94A3B8',
        // Button
        btnShadow: '#000000',
        btnBorder: '#1A3D5C',
        btnHighlight: '#E0F2FE',
        btnText: '#F1F5F9',
        btnDisabled: '#475569',
        btnDisabledAlpha: 120,
        btnShadowAlpha: 80,
        btnHighlightAlpha: 50,
        // Card presets
        cardRadius: 8,
        panelRadius: 12,
        // Signature accents
        neonCyan: '#22D3EE',
        neonBlue: '#38BDF8',
        neonGreen: '#34D399',
        neonPurple: '#C084FC',
        alloyOrange: '#F97316',
        alloyGold: '#F59E0B',
        dangerRed: '#F43F5E',
        // Loading
        loadingTitle: '#FDE68A',
        loadingSub: '#67E8F9',
        loadingProgress: '#E0F2FE',
        loadingHint: '#B6C8D9',
    } as const;
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
    private toastPanelNode: Node | null = null;
    private toastPanelShadowNode: Node | null = null;

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

    // ── Combat visual effects ─────────────────────────────────────
    private vfxOverlay: Graphics | null = null;
    private vfxLevelUpFlash = 0;
    private vfxBossWarning = 0;
    private vfxSlowMo = 0;
    private vfxWaveClearPulse = 0;
    private vfxRarePickupPulse = 0;
    private vfxPlayerHitOverlay = 0;

    // ── Bot test data ─────────────────────────────────────────────
    private botData: any[] = [];
    private botDataTimer = 0;
    private _botState: 'idle' | 'moving' | 'fighting' | 'fleeing' = 'idle';
    private _botTargetPos: Vec2 | null = null;
    private _botMoveTimer = 0;
    private _botStuckTimer = 0;
    private _botLastPlayerPos: Vec2 | null = null;
    private _botLastKillCount = 0;
    private _botPickupChaseTimer = 0;

 // ── Bot global hook (CDP access) ──────────────────────────────
    // Expose game instance and tick function on window so the external
    // Python bot can drive the game loop via CDP JavaScript evaluation.
    private static BOT_INSTANCE: RogueShooterGame | null = null;

    // ── UI texture references ────────────────────────────────────
    private uiPanelFrame: SpriteFrame | null = null;
    private uiBtnNormalFrame: SpriteFrame | null = null;
    private uiBtnPressedFrame: SpriteFrame | null = null;
    private uiTexturesReady = false;
    private revived = false; // prevent double revive
    // ── Icon cache ────────────────────────────────────────────────
    private iconCache: Record<string, SpriteFrame | null> = {};
    private _extractDoubled = false; // prevent double-extract ad loop

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
        // Expose game instance for bot/CDP access
        RogueShooterGame.BOT_INSTANCE = this;
        (globalThis as any).__starfallGame = this;
        (globalThis as any).__starfallTick = (dt = 1 / 60) => {
          const g = RogueShooterGame.BOT_INSTANCE || (globalThis as any).__starfallGame;
          if (g && g.cs.phase === 'combat') g.update(dt);
        };
        (globalThis as any).__starfallStartBattle = () => {
          const g = RogueShooterGame.BOT_INSTANCE || (globalThis as any).__starfallGame;
          if (g && g.cs.phase === 'hangar') g.beginBattle(false);
          else if (g && g.cs.phase === 'menu') { g.openHangarFromMenu(); setTimeout(() => g.beginBattle(false), 100); }
        };
        (globalThis as any).__starfallBulkTick = (frames: number) => {
          const g = RogueShooterGame.BOT_INSTANCE || (globalThis as any).__starfallGame;
          if (!g) return;
          for (let i = 0; i < frames; i++) {
            try {
              if (g.cs.phase === 'combat' || g.cs.phase === 'level-up') {
                (globalThis as any).__starfallTick(0.016);
              }
              if (g.cs.phase === 'level-up' && g.pickupMgr.choosePanelChoice) {
                g.pickupMgr.choosePanelChoice(0);
              }
              if (g.cs.phase !== 'combat' && g.cs.phase !== 'level-up') break;
            } catch (e) {
              // Ignore transient JS eval exceptions during bulk tick
            }
          }
        };
        (globalThis as any).__starfallPressKey = (key: string) => {
          const code = key.toUpperCase().charCodeAt(0);
          const KEY_MAP: Record<string, number> = {
            '1': 49, '2': 50, '3': 51, 'b': 66, 's': 83, 'r': 82, 't': 84, 'h': 72,
          };
          const kc = KEY_MAP[key.toLowerCase()] || code;
          const g = RogueShooterGame.BOT_INSTANCE || (globalThis as any).__starfallGame;
          if (g) g.onKeyDown({ keyCode: kc } as any);
        };
        (globalThis as any).__starfallNativeRandom = (globalThis as any).__starfallNativeRandom || Math.random;
        (globalThis as any).__starfallSetSeed = (seed = 1) => {
          let state = (Number(seed) >>> 0) || 0x6d2b79f5;
          Math.random = () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
          };
          (globalThis as any).__starfallSeed = seed;
          (globalThis as any).__starfallRandomState = () => state;
          return seed;
        };
        (globalThis as any).__starfallResetRandom = () => {
          Math.random = (globalThis as any).__starfallNativeRandom;
          (globalThis as any).__starfallSeed = undefined;
          return 'ok';
        };
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, 2);
        this.createCanvas();
        this.shop.loadProgress();
        this.buildScene();
        this.audio.initAudio();
        this.loadPlaceholderArt(() => {
            // Bot/CDP tests may start combat before async art loading finishes.
            // Do not let the loading callback reset an active run back to menu.
            if (this.cs.phase !== 'combat') this.openHome();
        });
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
        this.audio.updateBgmFade(dt);
        this.pickupMgr.updateFloatingTexts(dt);
        this.perfPreMs = this.perfNow() - t;

         if (this.cs.phase === 'combat') {
            let combatDt = Math.min(dt, MAX_COMBAT_DT);
            // Slow motion on boss death
            if (this.vfxSlowMo > 0) {
                this.vfxSlowMo -= combatDt;
                const factor = this.vfxSlowMo > 0.6 ? 0.25 : 0.25 + (0.6 - this.vfxSlowMo) / 0.6 * 0.75;
                combatDt *= factor;
            }
            this.cs.combatTime += combatDt;
            this.cs.invulnerableTimer = Math.max(0, this.cs.invulnerableTimer - combatDt);
            // Bot mode: decision tick (movement + upgrades)
            if ((globalThis as any).__starfallBotMode) {
                this.botAiTick(combatDt);
                this.botPickUpgrade();
            }

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

            this.proj.updateEffectPools(combatDt);
            this.enemyMgr.drawAllBars();
            this.enemyMgr.updateGroundMarks(combatDt);
            this.enemyMgr.updateDeathParticles(combatDt);
            this.updateVfx(combatDt);
            // Bot data: snapshot every 2s of combat time
            this.botDataTimer += combatDt;
            if (this.botDataTimer >= 2) {
                this.botDataTimer = 0;
                this.botData.push({
                    t: this.cs.combatTime,
                    lv: this.cs.level,
                    hp: Math.round(this.cs.playerHp),
                    maxHp: Math.round(this.cs.playerMaxHp),
                    shield: Math.round(this.cs.playerShield),
                    wave: this.cs.waveIndex,
                    kills: this.cs.killCount,
                    bossKills: this.cs.bossKills,
                    alloy: this.cs.battleAlloy,
                    enemyCount: this.enemyMgr.enemies.length,
                });
            }

            if (this.cs.playerHp <= 0) {
                this.showRevivePanel();
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
        this.preloadUiTextures();

        this.worldNode = new Node('World');
        this.worldNode.layer = Layers.Enum.UI_2D;
        root.addChild(this.worldNode);
        this.proj.initEffectPools(this.worldNode);
        this.enemyMgr.initBarLayer(this.worldNode);
        this.enemyMgr.initGroundMarkPool(this.worldNode);
        this.enemyMgr.initDeathParticlePool(this.worldNode);
        this.worldNode.setPosition(0, 0, 0);
        this.drawWorldArena(this.worldNode);

        this.buildHud(root);
        this.buildRevivePanel(root);
        this.buildVfxOverlay(root);
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

    private spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number) {
        this.pickupMgr.spawnFloatingText(text, x, y, color, fontSize);
    }

    private getActiveEquipmentLevel(id: string): number {
        return this.shop.getEquipmentLevel(id);
    }

    private getActiveWeapon(): EquipmentDef | null {
        return this.shop.getActiveWeapon();
    }

    private getActiveWeaponMechanic(): string | null {
        const weapon = this.getActiveWeapon();
        if (!weapon) return null;
        // weapon.id 形如 "storm-rifle" (legacy) 或 "split-barrel-standard" (变体)
        // 从 WEAPON_FAMILIES 找对应的 mechanic
        const familyId = weapon.id.replace(/-standard$/, '');
        for (const family of WEAPON_FAMILIES) {
            if (family.id === familyId || weapon.id.startsWith(family.id)) {
                return family.mechanic ?? null;
            }
        }
        return null;
    }

    private getEquipmentLevel(id: string): number {
        return this.shop.getEquipmentLevel(id);
    }

    private get ownedEquipment(): Set<string> {
        return this.shop.ownedEquipment;
    }

    private get equipmentLevels(): Record<string, number> {
        return this.shop.equipmentLevels;
    }

    private isEquipmentLootEligible(equipment: EquipmentDef, rare: boolean): boolean {
        return this.shop.isEquipmentLootEligible(equipment, rare);
    }

    private dropPickup(type: PickupType, amount: number, x: number, y: number) {
        this.pickupMgr.dropPickup(type, amount, x, y);
    }

    private tryDropChest(type: ChestPickupType, x: number, y: number): boolean {
        return this.pickupMgr.tryDropChest(type, x, y);
    }

    private tryDropEquipmentBlueprint(): void {
        this.shop.tryDropBossBlueprint();
    }

    private createEnemyProjectile(x: number, y: number, angle: number, damage: number, damageType: DamageType, speed: number) {
        this.proj.createEnemyProjectile(x, y, angle, damage, damageType, speed);
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
        const HUD_H = 68;
        // Top bar
        this.rect(root, 'HudShadow', 14, top + 6, 692, HUD_H, RogueShooterGame.UI.panelShadow, 12);
        this.rect(root, 'HudPanel', 10, top, 700, HUD_H, RogueShooterGame.UI.hudBg, RogueShooterGame.UI.cardRadius, RogueShooterGame.UI.hudBorder);
        this.rect(root, 'HudAccent', 14, top + 6, 4, HUD_H - 12, RogueShooterGame.UI.hudAccent, 2);
        this.panels.titleLabel = this.label(root, 'Title', '星坠幸存者', 26, top + 3, 280, 28, 18, RogueShooterGame.UI.title, Label.HorizontalAlign.LEFT);
        this.panels.timerLabel = this.label(root, 'Timer', '', 460, top + 4, 230, 26, 16, RogueShooterGame.UI.cyanText, Label.HorizontalAlign.RIGHT);
        // HP bar
        this.label(root, 'HpLabel', 'HP', 26, top + 30, 22, 18, 12, RogueShooterGame.UI.barLabel);
        const hpNode = this.rect(root, 'HpBar', 52, top + 32, 260, 8, RogueShooterGame.UI.hpBarBg, 4);
        this.panels.hpBar = hpNode.getComponent(Graphics);
        // Shield bar
        this.label(root, 'ShieldLabel', '盾', 316, top + 30, 20, 18, 12, RogueShooterGame.UI.barLabel);
        const shieldNode = this.rect(root, 'ShieldBar', 340, top + 32, 150, 8, RogueShooterGame.UI.hpBarBg, 4);
        this.panels.shieldBar = shieldNode.getComponent(Graphics);
        // XP bar
        this.label(root, 'XpLabel', 'EXP', 28, top + 43, 24, 14, 10, RogueShooterGame.UI.barLabel);
        const xpNode = this.rect(root, 'XpBar', 56, top + 44, 420, 4, RogueShooterGame.UI.xpBarBg, 2);
        this.panels.xpBar = xpNode.getComponent(Graphics);
        this.panels.debugLabel = this.label(root, 'DebugHud', '', 54, top + 52, 612, 16, 11, '#64748B', Label.HorizontalAlign.LEFT);
        this.panels.debugLabel.node.active = false;

        // Bottom bar
        const BOT_Y = DESIGN_HEIGHT - UI_SAFE_BOTTOM - 56;
        this.rect(root, 'BottomBarShadow', 14, BOT_Y + 4, 692, 52, RogueShooterGame.UI.panelShadow, 10);
        this.rect(root, 'BottomBar', 10, BOT_Y, 700, 52, RogueShooterGame.UI.hudBg, RogueShooterGame.UI.cardRadius, RogueShooterGame.UI.hudBorder);
        this.panels.equipmentLabel = this.label(root, 'EquipmentLabel', '', 18, BOT_Y + 2, 220, 22, 13, RogueShooterGame.UI.body, Label.HorizontalAlign.LEFT);
        this.panels.buffLabel = this.label(root, 'BuffLabel', '', 18, BOT_Y + 26, 260, 20, 12, '#F97316', Label.HorizontalAlign.LEFT);
        const BTN_W = 78;
        this.panels.switchWeaponButton = this.button(root, 'SwitchWeapon', 300, BOT_Y + 4, BTN_W, 44, '#B5179E', '#475569', () => this.switchActiveWeapon());
        this.panels.switchWeaponButton.label.string = '切';
        this.panels.shopButton = this.button(root, 'ShopBtn', 386, BOT_Y + 4, BTN_W, 44, '#22D3EE', '#475569', () => this.shop.openShop());
        this.panels.shopButton.label.string = '商店';
        this.panels.extractButton = this.button(root, 'ExtractBtn', 472, BOT_Y + 4, BTN_W, 44, '#F59E0B', '#475569', () => this.extractBattle());
        this.panels.extractButton.label.string = '撤离';
        this.panels.pauseButton = this.button(root, 'PauseBtn', 558, BOT_Y + 4, BTN_W, 44, '#475569', '#475569', () => this.pauseCombat());
        this.panels.pauseButton.label.string = '暂停';
        this.panels.statLabel = this.label(root, 'StatInfo', '', 18, BOT_Y + 2, 360, 48, 11, '#94A3B8', Label.HorizontalAlign.LEFT);

        // Toast
        const toastTop = BOT_Y - 70;
        this.toastPanelShadowNode = this.rect(root, 'ToastShadow', 46, toastTop + 6, 628, 48, RogueShooterGame.UI.panelShadow, 10);
        this.toastPanelNode = this.rect(root, 'ToastPanel', 36, toastTop, 648, 50, RogueShooterGame.UI.panelBg, 10, RogueShooterGame.UI.panelBorder);
        this.panels.toastLabel = this.label(root, 'Toast', '', 50, toastTop + 4, 620, 42, 17, RogueShooterGame.UI.title);
        this.toastPanelShadowNode.active = false;
        this.toastPanelNode.active = false;
        this.panels.toastLabel.node.active = false;
    }

    private buildLevelPanel(root: Node) {
        this.panels.levelPanelShadow = this.rect(root, 'LevelPanelShadow', 48, 316, 624, 500, RogueShooterGame.UI.panelShadow, 22);
        this.panels.levelPanelShadow.active = false;
        const panel = this.spritePanel(root, 'LevelPanel', 36, 302, 648, 500);
        panel.active = false;
        this.panels.levelPanel = panel;
        this.panels.levelTitleLabel = this.label(panel, 'LevelTitle', '角色升级', 42, 30, 564, 52, 32, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.levelBackButton = this.button(panel, 'LevelBack', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.pickupMgr.choosePanelChoice(0), true);
        this.panels.levelBackButton.label.string = '返回';
        this.panels.levelHintLabel = this.label(panel, 'LevelHint', '选择一项自身属性成长，战斗会继续。', 42, 86, 564, 42, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);

        for (let i = 0; i < 3; i++) {
            const button = this.button(panel, `LevelChoice_${i}`, 54, 148 + i * 84, 540, 68, '#4CC9F0', '#94A3B8', () => this.pickupMgr.choosePanelChoice(i), true);
            this.panels.levelChoiceButtons.push(button);
        }
        this.panels.levelRefreshButton = this.button(panel, 'ChoiceRefresh', 204, 414, 240, 48, '#F8961E', '#94A3B8', () => this.pickupMgr.refreshCurrentChoices(), true);
        this.panels.levelRefreshButton.label.string = '刷新 -28合金';
    }

    private buildShopPanel(root: Node) {
        this.panels.shopPanelShadow = this.rect(root, 'ShopPanelShadow', 36, 172, 648, 940, RogueShooterGame.UI.panelShadow, 24);
        this.panels.shopPanelShadow.active = false;
        const panel = this.spritePanel(root, 'ShopPanel', 24, 160, 672, 940);
        panel.active = false;
        this.panels.shopPanel = panel;
        this.panels.shopTitleLabel = this.label(panel, 'ShopTitle', '战场商店', 36, 24, 600, 48, 32, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.shopTipLabel = this.label(panel, 'ShopTip', '随时打开。每格可购买或消耗少量合金刷新下一件。', 42, 72, 588, 42, 18, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);

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
        this.panels.hangarPanelShadow = this.rect(root, 'HangarPanelShadow', 36, 196, 648, 936, RogueShooterGame.UI.panelShadow, 24);
        this.panels.hangarPanelShadow.active = false;
        const panel = this.spritePanel(root, 'HangarPanel', 24, 184, 672, 936);
        panel.active = false;
        this.panels.hangarPanel = panel;

        this.panels.hangarTitleLabel = this.label(panel, 'HangarTitle', '', 36, 24, 600, 52, 32, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.hangarBackButton = this.button(panel, 'HangarBackHome', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.openMainMenu(), true);
        this.panels.hangarBackButton.label.string = '首页';
        this.panels.hangarStatsLabel = this.label(panel, 'HangarStats', '', 46, 78, 580, 98, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.panels.hangarTipLabel = this.label(panel, 'HangarTip', '', 46, 842, 580, 44, 18, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);

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

        this.panels.equipmentDetailLabel = this.label(panel, 'EquipmentDetail', '', 46, 302, 580, 116, 16, RogueShooterGame.UI.body, Label.HorizontalAlign.LEFT, true);

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

        // ── Pre-battle buff button (below action buttons) ──
        this.panels.preBuffLabel = this.label(panel, 'PreBuffLabel', '', 46, 776, 580, 24, 16, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);
        this.panels.preBuffButton = this.button(panel, 'PreBuffButton', 174, 750, 324, 42, '#F8961E', '#94A3B8', () => this.requestPreBattleBuff(), true);
        this.panels.preBuffButton.label.string = '获取增益';

        this.panels.startButton = this.button(panel, 'StartBattle', 174, 826, 324, 58, '#43AA8B', '#94A3B8', () => this.beginBattle(false), true);

        // ── Extract reward double button (hidden by default) ──
        this.panels.extractDoubleButton = this.button(panel, 'ExtractDoubleButton', 174, 650, 324, 42, '#F9C74F', '#94A3B8', () => this.requestExtractDouble(), true);
        this.panels.extractDoubleButton.node.active = false;
        this.panels.extractDoubleButton.label.string = '看视频双倍领取';
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

    private buildVfxOverlay(root: Node) {
        const node = new Node('VfxOverlay');
        node.layer = Layers.Enum.UI_2D;
        root.addChild(node);
        node.setPosition(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 999);
        const trans = node.addComponent(UITransform);
        trans.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        this.vfxOverlay = node.addComponent(Graphics);
    }

    private buildRevivePanel(root: Node) {
        const shadow = this.rect(root, 'ReviveShadow', 60, 370, 600, 350, RogueShooterGame.UI.panelShadow, 20);
        shadow.active = false;
        this.panels.revivePanelShadow = shadow;
        const panel = this.rect(root, 'RevivePanel', 48, 358, 624, 350, RogueShooterGame.UI.panelBg, 20, RogueShooterGame.UI.panelBorder);
        panel.active = false;
        this.panels.revivePanel = panel;
        this.panels.reviveTitleLabel = this.label(panel, 'ReviveTitle', '机体损毁', 48, 36, 528, 56, 34, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'ReviveHint', '看视频立即复活，继续战斗！', 54, 100, 516, 42, 22, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.panels.reviveWatchButton = this.button(panel, 'ReviveWatch', 132, 168, 360, 56, '#F8961E', '#94A3B8', () => this.reviveFromAd(), true);
        this.panels.reviveDeclineButton = this.button(panel, 'ReviveDecline', 162, 242, 300, 50, '#64748B', '#94A3B8', () => this.declineRevive(), true);
    }

    private showRevivePanel(): void {
        if (this.revived) return;
        if (this.cs.phase !== 'combat') return;
        this.revived = true;
        this.cs.phase = 'paused';
        if (this.panels.revivePanelShadow) this.panels.revivePanelShadow.active = true;
        if (this.panels.revivePanel) this.panels.revivePanel.active = true;
        const remaining = AdManager.getReviveRemaining();
        if (this.panels.reviveWatchButton) {
            this.panels.reviveWatchButton.label.string = `看视频复活 (今日剩余${remaining}次)`;
        }
        if (this.panels.reviveTitleLabel) {
            this.panels.reviveTitleLabel.string = this.cs.bossKills > 0
                ? `机体损毁 · 已击败 ${this.cs.bossKills} Boss`
                : '机体损毁';
        }
        if (this.panels.reviveDeclineButton) {
            this.panels.reviveDeclineButton.label.string = '放弃';
        }
    }

    private reviveFromAd(): void {
        if (!AdManager.canReviveToday()) {
            this.showToast('今日复活次数已用完。');
            this.declineRevive();
            return;
        }
        if (this.panels.reviveWatchButton) {
            this.panels.reviveWatchButton.label.string = '广告加载中...';
            this.panels.reviveWatchButton.disabled = true;
        }
        this.panels.hideAllOverlays();
        AdManager.playRewardedAd((result) => {
            if (!result.success) {
                this.showToast(result.reason || '广告播放失败，请重试。');
                this.panels.hideAllOverlays();
                if (this.panels.revivePanelShadow) this.panels.revivePanelShadow.active = true;
                if (this.panels.revivePanel) this.panels.revivePanel.active = true;
                if (this.panels.reviveWatchButton) {
                    const remaining = AdManager.getReviveRemaining();
                    this.panels.reviveWatchButton.label.string = `看视频复活 (今日剩余${remaining}次)`;
                    this.panels.reviveWatchButton.disabled = false;
                }
                return;
            }
            AdManager.useDailyRevive();
            this.cs.playerHp = this.cs.playerMaxHp * 0.5;
            this.cs.playerShield = 0;
            this.cs.invulnerableTimer = 1.5;
            this.playSfx('sfx_revive', 0.7, 0.2);
            this.revived = false;
            this.cs.phase = 'combat';
            this.panels.hideAllOverlays();
            this.showToast('已复活！半血重返战场。');
        });
    }

    private declineRevive(): void {
        if (this.cs.phase !== 'paused' && this.cs.phase !== 'combat') return;
        this.revived = false;
        this.panels.hideAllOverlays();
        this.cs.phase = getReviveDeclinePhase(); // temporarily set to combat so finishBattle can proceed
        this.finishBattle('death');
    }

    private preloadUiTextures(): void {
        if (this.uiTexturesReady) return;
        resources.load('effects/ui_panel_bg/spriteFrame', SpriteFrame, (_e, sf) => {
            if (sf) this.uiPanelFrame = sf;
        });
        resources.load('effects/ui_btn_normal/spriteFrame', SpriteFrame, (_e, sf) => {
            if (sf) this.uiBtnNormalFrame = sf;
        });
        resources.load('effects/ui_btn_pressed/spriteFrame', SpriteFrame, (_e, sf) => {
            if (sf) this.uiBtnPressedFrame = sf;
            this.uiTexturesReady = true;
        });
        this.loadIcons();
    }

    private loadIcons(): void {
        const names = [
            'wpn_assault_rifle','wpn_shotgun','wpn_sniper','wpn_smg','wpn_rocket_launcher','wpn_laser_gun','wpn_plasma_gun','wpn_lightning_gun',
            'wpn_ice_gun','wpn_fire_wand','wpn_poison_sprayer','wpn_crossbow','wpn_dual_pistols','wpn_axe','wpn_throwing_knives','wpn_orbital_beam',
            'wpn_pulse_rifle','wpn_drone_spirit','wpn_chain_lightning','wpn_meteor','wpn_railgun','wpn_tesla',
            'stat_attack_power','stat_attack_speed','stat_crit_chance','stat_crit_damage',
            'stat_defense','stat_fire_def','stat_ice_def','stat_lightning_def','stat_lethal_chance','stat_lethal_damage',
            'slot_helmet','slot_armor','slot_boots','slot_accessory',
            'resource_alloy','resource_core','resource_shard','resource_biomass',
            'dmg_fire','dmg_ice','dmg_lightning','dmg_poison','dmg_physical','dmg_magic','stat_shield','stat_hp',
        ];
        for (const name of names) {
            const path = `effects/ui_icons/${name}/spriteFrame`;
            resources.load(path, SpriteFrame, (_e, sf) => {
                if (sf) this.iconCache[name] = sf;
            });
        }
    }

    public getIcon(name: string): SpriteFrame | null {
        return this.iconCache[name] || null;
    }

    private iconLabel(parent: Node, name: string, iconKey: string, x: number, y: number, text: string, w: number, h: number, fontSize: number, color: string, hAlign = Label.HorizontalAlign.LEFT, local = true): Label {
        const sf = this.getIcon(iconKey);
        const iconSize = Math.round(h * 0.8);
        if (sf) {
            const iconNode = new Node(`${name}_Icon`);
            iconNode.layer = Layers.Enum.UI_2D;
            parent.addChild(iconNode);
            if (local) {
                const pt = parent.getComponent(UITransform);
                this.placeLocal(iconNode, x + iconSize/2, y + h/2, pt?.width ?? w, pt?.height ?? h);
            } else {
                this.place(iconNode, x + iconSize/2, y + h/2);
            }
            const it = iconNode.addComponent(UITransform);
            it.setContentSize(iconSize, iconSize);
            const sp = iconNode.addComponent(Sprite);
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        return this.label(parent, name, text, x + (sf ? iconSize + 8 : 0), y, w - (sf ? iconSize + 8 : 0), h, fontSize, color, hAlign, local);
    }

    private spritePanel(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        this.place(node, x + width / 2, y + height / 2);
        const trans = node.addComponent(UITransform);
        trans.setContentSize(width, height);
        const gfx = node.addComponent(Graphics);
        this.drawPremiumPanel(gfx, width, height, 24, RogueShooterGame.UI.panelBorder, RogueShooterGame.UI.neonCyan);
        if (this.uiPanelFrame) {
            const sprite = node.addComponent(Sprite);
            sprite.spriteFrame = this.uiPanelFrame;
            sprite.type = Sprite.Type.SLICED;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            // Keep the procedural frame underneath as a guaranteed fallback and extra glow.
        }
        return node;
    }

    private drawPremiumPanel(gfx: Graphics, width: number, height: number, radius = 20, borderColor: string = RogueShooterGame.UI.panelBorder, accentColor: string = RogueShooterGame.UI.neonCyan): void {
        gfx.clear();
        // Deep body
        gfx.fillColor = this.hex(RogueShooterGame.UI.panelBgDeep, RogueShooterGame.UI.panelAlpha);
        gfx.roundRect(-width / 2, -height / 2, width, height, radius);
        gfx.fill();
        // Lifted inner surface
        gfx.fillColor = this.hex(RogueShooterGame.UI.panelBg, 238);
        gfx.roundRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, Math.max(10, radius - 6));
        gfx.fill();
        // Top glass sheen
        gfx.fillColor = this.hex(RogueShooterGame.UI.panelBgLift, 118);
        gfx.roundRect(-width / 2 + 10, height / 2 - Math.min(96, height * 0.26), width - 20, Math.min(80, height * 0.22), Math.max(8, radius - 10));
        gfx.fill();
        // Subtle bottom vignette for depth
        gfx.fillColor = this.hex(RogueShooterGame.UI.glassLowlight, 156);
        gfx.roundRect(-width / 2 + 10, -height / 2 + 10, width - 20, Math.min(110, height * 0.24), Math.max(8, radius - 10));
        gfx.fill();
        // Thin frame
        gfx.strokeColor = this.hex(borderColor, 190);
        gfx.lineWidth = 1.5;
        gfx.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius);
        gfx.stroke();
        gfx.strokeColor = this.hex(RogueShooterGame.UI.glassHighlight, 72);
        gfx.lineWidth = 1;
        gfx.roundRect(-width / 2 + 8, -height / 2 + 8, width - 16, height - 16, Math.max(8, radius - 8));
        gfx.stroke();
        // Starship corner brackets
        const corner = Math.min(46, Math.max(24, Math.min(width, height) * 0.12));
        const inset = 15;
        gfx.strokeColor = this.hex(accentColor, 210);
        gfx.lineWidth = 3;
        gfx.moveTo(-width / 2 + inset, height / 2 - inset - corner);
        gfx.lineTo(-width / 2 + inset, height / 2 - inset);
        gfx.lineTo(-width / 2 + inset + corner, height / 2 - inset);
        gfx.moveTo(width / 2 - inset - corner, height / 2 - inset);
        gfx.lineTo(width / 2 - inset, height / 2 - inset);
        gfx.lineTo(width / 2 - inset, height / 2 - inset - corner);
        gfx.moveTo(-width / 2 + inset, -height / 2 + inset + corner);
        gfx.lineTo(-width / 2 + inset, -height / 2 + inset);
        gfx.lineTo(-width / 2 + inset + corner, -height / 2 + inset);
        gfx.moveTo(width / 2 - inset - corner, -height / 2 + inset);
        gfx.lineTo(width / 2 - inset, -height / 2 + inset);
        gfx.lineTo(width / 2 - inset, -height / 2 + inset + corner);
        gfx.stroke();
    }

    private addLocalGraphic(parent: Node, name: string, x: number, y: number, width: number, height: number): Graphics {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        const parentTransform = parent.getComponent(UITransform);
        this.placeLocal(node, x + width / 2, y + height / 2, parentTransform?.width ?? width, parentTransform?.height ?? height);
        node.addComponent(UITransform).setContentSize(width, height);
        return node.addComponent(Graphics);
    }

    private addTechDivider(parent: Node, name: string, x: number, y: number, width: number, color: string = RogueShooterGame.UI.neonCyan): void {
        const gfx = this.addLocalGraphic(parent, name, x, y, width, 18);
        gfx.strokeColor = this.hex(color, 150);
        gfx.lineWidth = 2;
        gfx.moveTo(-width / 2, 0);
        gfx.lineTo(-width / 2 + width * 0.38, 0);
        gfx.moveTo(width / 2 - width * 0.38, 0);
        gfx.lineTo(width / 2, 0);
        gfx.stroke();
        gfx.fillColor = this.hex(color, 200);
        gfx.roundRect(-18, -3, 36, 6, 3);
        gfx.fill();
    }

    private drawMenuEmblem(parent: Node): void {
        const gfx = this.addLocalGraphic(parent, 'MenuCommandEmblem', 214, 168, 220, 132);
        gfx.strokeColor = this.hex(RogueShooterGame.UI.neonCyan, 82);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, 62);
        gfx.stroke();
        gfx.strokeColor = this.hex(RogueShooterGame.UI.alloyGold, 170);
        gfx.lineWidth = 4;
        gfx.arc(0, 0, 50, Math.PI * 0.08, Math.PI * 0.82, false);
        gfx.stroke();
        gfx.strokeColor = this.hex(RogueShooterGame.UI.neonCyan, 180);
        gfx.lineWidth = 3;
        gfx.arc(0, 0, 42, Math.PI * 1.05, Math.PI * 1.84, false);
        gfx.stroke();
        gfx.fillColor = this.hex(RogueShooterGame.UI.sectionBg, 235);
        gfx.circle(0, 0, 34);
        gfx.fill();
        gfx.strokeColor = this.hex(RogueShooterGame.UI.glassHighlight, 180);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, 34);
        gfx.stroke();
        gfx.fillColor = this.hex(RogueShooterGame.UI.alloyOrange, 230);
        gfx.moveTo(0, 26);
        gfx.lineTo(19, -22);
        gfx.lineTo(0, -12);
        gfx.lineTo(-19, -22);
        gfx.close();
        gfx.fill();
        gfx.fillColor = this.hex(RogueShooterGame.UI.neonCyan, 190);
        gfx.roundRect(-92, -4, 54, 8, 4);
        gfx.roundRect(38, -4, 54, 8, 4);
        gfx.fill();
    }

    private updateVfx(dt: number) {
        if (!this.vfxOverlay) return;
        this.vfxOverlay.clear();

        // Level-up white flash — fades fast
        if (this.vfxLevelUpFlash > 0) {
            this.vfxLevelUpFlash -= dt;
            const alpha = Math.min(255, this.vfxLevelUpFlash / 0.08 * 255);
            if (alpha > 5) {
                this.vfxOverlay.fillColor = this.hex('#FFFFFF', Math.round(alpha * 0.35));
                this.vfxOverlay.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
                this.vfxOverlay.fill();
            }
        }

        // Boss warning red tint — fades in then out
        if (this.vfxBossWarning > 0) {
            this.vfxBossWarning -= dt;
            const phase = this.vfxBossWarning;
            const maxAlpha = phase > 1.2 ? 40 : phase > 0.8 ? 70 : phase > 0.4 ? 50 : phase * 30;
            if (maxAlpha > 3) {
                this.vfxOverlay.fillColor = this.hex('#EF4444', Math.round(maxAlpha));
                this.vfxOverlay.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
                this.vfxOverlay.fill();
            }
        }

        // Player hit red flash
        if (this.vfxPlayerHitOverlay > 0) {
            this.vfxPlayerHitOverlay -= dt;
            const a = Math.round(this.vfxPlayerHitOverlay / 0.3 * 180);
            if (a > 5) {
                this.vfxOverlay.fillColor = this.hex('#EF4444', Math.min(a, 80));
                this.vfxOverlay.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
                this.vfxOverlay.fill();
            }
        }

        // Wave clear green pulse — expanding ring from player
        if (this.vfxWaveClearPulse > 0) {
            this.vfxWaveClearPulse -= dt;
            const p = this.vfxWaveClearPulse;
            const radius = 50 + (1 - p / 1.5) * 400;
            const a = Math.round(p / 1.5 * 180);
            if (a > 5) {
                this.vfxOverlay.strokeColor = this.hex('#22C55E', a);
                this.vfxOverlay.lineWidth = 6;
                this.vfxOverlay.circle(0, 0, radius);
                this.vfxOverlay.stroke();
                this.vfxOverlay.fillColor = this.hex('#22C55E', Math.round(a * 0.15));
                this.vfxOverlay.circle(0, 0, radius);
                this.vfxOverlay.fill();
            }
        }

        // Rare pickup gold pulse
        if (this.vfxRarePickupPulse > 0) {
            this.vfxRarePickupPulse -= dt;
            const p = this.vfxRarePickupPulse;
            const radius = 30 + (1 - p / 1.2) * 300;
            const a = Math.round(p / 1.2 * 200);
            if (a > 5) {
                this.vfxOverlay.strokeColor = this.hex('#F59E0B', a);
                this.vfxOverlay.lineWidth = 5;
                this.vfxOverlay.circle(0, 0, radius);
                this.vfxOverlay.stroke();
            }
        }
    }

    private buildLoadingPanel(root: Node) {
        const panel = this.rect(root, 'LoadingPanel', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, RogueShooterGame.UI.panelBgDeep);
        panel.active = true;
        this.panels.loadingPanel = panel;
        const gfx = panel.getComponent(Graphics);
        if (gfx) {
            // Deep-space gradient impression: layered nebula discs + tactical scan lines.
            gfx.fillColor = this.hex('#0B2A45', 205);
            gfx.circle(570, 206, 285);
            gfx.fill();
            gfx.fillColor = this.hex('#391B55', 150);
            gfx.circle(92, 1084, 340);
            gfx.fill();
            gfx.fillColor = this.hex(RogueShooterGame.UI.alloyOrange, 118);
            gfx.circle(604, 1058, 160);
            gfx.fill();
            gfx.strokeColor = this.hex(RogueShooterGame.UI.neonCyan, 72);
            gfx.lineWidth = 1;
            for (let y = 160; y < 1120; y += 84) {
                gfx.moveTo(72, y);
                gfx.lineTo(648, y + ((y / 84) % 2 === 0 ? 10 : -10));
            }
            gfx.stroke();
            gfx.strokeColor = this.hex(RogueShooterGame.UI.alloyGold, 145);
            gfx.lineWidth = 6;
            gfx.circle(360, 596, 158);
            gfx.stroke();
            gfx.strokeColor = this.hex(RogueShooterGame.UI.neonCyan, 150);
            gfx.lineWidth = 2;
            gfx.circle(360, 596, 204);
            gfx.stroke();
            gfx.fillColor = this.hex(RogueShooterGame.UI.panelBg, 185);
            gfx.roundRect(118, 522, 484, 172, 28);
            gfx.fill();
            gfx.strokeColor = this.hex(RogueShooterGame.UI.glassHighlight, 135);
            gfx.lineWidth = 2;
            gfx.roundRect(118, 522, 484, 172, 28);
            gfx.stroke();
        }
        this.panels.loadingTitleLabel = this.label(panel, 'LoadingTitle', '星坠幸存者', 70, 426, 580, 72, 56, RogueShooterGame.UI.loadingTitle, Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LoadingSubTitle', '星舰军械库正在点火', 92, 514, 536, 40, 24, RogueShooterGame.UI.loadingSub, Label.HorizontalAlign.CENTER, true);
        this.panels.loadingProgressLabel = this.label(panel, 'LoadingProgress', '加载中...', 92, 606, 536, 44, 22, RogueShooterGame.UI.loadingProgress, Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'LoadingHint', '提示：升级、买道具、撤离带回资源；撑到 Boss 就有大收益', 76, 1040, 568, 58, 21, RogueShooterGame.UI.loadingHint, Label.HorizontalAlign.CENTER, true);
    }

    private buildMenuPanel(root: Node) {
        this.panels.menuPanelShadow = this.rect(root, 'MenuPanelShadow', 48, 220, 624, 790, RogueShooterGame.UI.panelShadow, 28);
        this.panels.menuPanelShadow.active = false;
        const panel = this.spritePanel(root, 'MenuPanel', 36, 206, 648, 790);
        panel.active = false;
        this.panels.menuPanel = panel;

        this.label(panel, 'MenuKicker', 'STARFALL SURVIVOR', 58, 36, 532, 28, 16, RogueShooterGame.UI.cyanText, Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'MenuTitle', '星坠幸存者', 50, 64, 548, 72, 50, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.addTechDivider(panel, 'MenuTitleDivider', 96, 140, 456, RogueShooterGame.UI.alloyGold);
        this.label(panel, 'MenuSubTitle', '自动开火 · 肉鸽成长 · Boss 撤离 · 激爽割草', 56, 150, 536, 36, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.drawMenuEmblem(panel);
        this.label(panel, 'MenuHook', '整备武器，冲入星潮；扛不住就撤，够强就打穿下一波。', 74, 286, 500, 44, 19, RogueShooterGame.UI.goldText, Label.HorizontalAlign.CENTER, true);

        const start = this.button(panel, 'MenuStart', 118, 350, 412, 66, RogueShooterGame.UI.neonGreen, '#94A3B8', () => this.openHangarFromMenu(), true);
        start.label.string = '进入机库 · 整备出击';
        const quick = this.button(panel, 'MenuQuickStart', 118, 432, 412, 62, RogueShooterGame.UI.neonCyan, '#94A3B8', () => this.beginBattle(false), true);
        quick.label.string = '快速出击';
        const settings = this.button(panel, 'MenuSettings', 118, 510, 196, 56, '#64748B', '#94A3B8', () => this.openSettingsPanel(), true);
        settings.label.string = '设置';
        const howto = this.button(panel, 'MenuHowTo', 334, 510, 196, 56, RogueShooterGame.UI.neonPurple, '#94A3B8', () => this.openHowToPanel(), true);
        howto.label.string = '玩法说明';
        const privacy = this.button(panel, 'MenuPrivacy', 118, 584, 412, 56, RogueShooterGame.UI.alloyOrange, '#94A3B8', () => this.openPrivacyPanel(), true);
        privacy.label.string = '隐私与适龄';
        this.label(panel, 'AgeHint', '12+｜健康游戏，适度娱乐', 56, 660, 536, 30, 17, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'MenuVersion', 'v0.2.0  审核前测试版', 56, 704, 536, 32, 17, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);
    }

    private buildPausePanel(root: Node) {
        this.panels.pausePanelShadow = this.rect(root, 'PausePanelShadow', 78, 372, 564, 520, RogueShooterGame.UI.panelShadow, 24);
        this.panels.pausePanelShadow.active = false;
        const panel = this.spritePanel(root, 'PausePanel', 66, 360, 588, 520);
        panel.active = false;
        this.panels.pausePanel = panel;
        this.label(panel, 'PauseTitle', '暂停', 42, 38, 504, 58, 38, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.label(panel, 'PauseHint', '战斗已暂停，可继续、调整声音或返回机库。', 50, 104, 488, 44, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
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
        this.panels.settingsPanelShadow = this.rect(root, 'SettingsPanelShadow', 86, 386, 548, 490, RogueShooterGame.UI.panelShadow, 24);
        this.panels.settingsPanelShadow.active = false;
        const panel = this.spritePanel(root, 'SettingsPanel', 74, 374, 572, 490);
        panel.active = false;
        this.panels.settingsPanel = panel;
        this.label(panel, 'SettingsTitle', '设置', 44, 36, 484, 58, 36, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.settingsBodyLabel = this.label(panel, 'SettingsBody', '', 54, 104, 464, 80, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.panels.bgmToggleButton = this.button(panel, 'BgmToggle', 116, 204, 340, 58, '#4CC9F0', '#94A3B8', () => this.audio.toggleBgm(), true);
        this.panels.sfxToggleButton = this.button(panel, 'SfxToggle', 116, 278, 340, 58, '#B5179E', '#94A3B8', () => this.audio.toggleSfx(), true);
        const close = this.button(panel, 'SettingsClose', 116, 366, 340, 58, '#43AA8B', '#94A3B8', () => this.closeSettingsPanel(), true);
        close.label.string = '返回';
        this.refreshSettingsPanel();
    }

    private buildInfoPanel(root: Node) {
        this.panels.infoPanelShadow = this.rect(root, 'InfoPanelShadow', 64, 304, 592, 636, RogueShooterGame.UI.panelShadow, 24);
        this.panels.infoPanelShadow.active = false;
        const panel = this.spritePanel(root, 'InfoPanel', 52, 292, 616, 646);
        panel.active = false;
        this.panels.infoPanel = panel;
        this.panels.infoTitleLabel = this.label(panel, 'InfoTitle', '', 44, 34, 528, 58, 34, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.infoBodyLabel = this.label(panel, 'InfoBody', '', 54, 112, 508, 390, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.LEFT, true);
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
        // 高阶武器生存加成: boss_gate +20% HP, boss_clear +35% HP
        const weapon = this.getActiveWeapon();
        if (weapon) {
            const familyId = weapon.id.replace(/-standard$/, '');
            const bossGateIds = new Set(['ion-lance', 'thorn-crossbow', 'rail-cannon', 'void-needle']);
            const bossClearIds = new Set(['meteor-launcher', 'orbital-drone', 'gravity-hammer']);
            if (bossClearIds.has(familyId)) {
                this.cs.playerMaxHp = Math.round(this.cs.playerMaxHp * 1.35);
            } else if (bossGateIds.has(familyId)) {
                this.cs.playerMaxHp = Math.round(this.cs.playerMaxHp * 1.20);
            }
        }
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
        this.cs.playerMaxHp = this.getMaxHp();
        this.cs.playerHp = this.cs.playerMaxHp;
        this.refreshHud();
        this.showToast(initial ? '无尽出击开始：撑得越久，带回资源越多。' : `第 ${this.cs.battleIndex} 次出击开始，Boss 阶段会循环增强。`);
    }

    private randomPoint(radius: number) {
        const angle = Math.random() * Math.PI * 2;
        return new Vec2(
            this.cs.playerX + Math.cos(angle) * radius,
            this.cs.playerY + Math.sin(angle) * radius,
        );
    }

    private requestPreBattleBuff(): void {
        if (this.panels.preBuffButton) {
            this.panels.preBuffButton.label.string = '广告加载中...';
            this.panels.preBuffButton.disabled = true;
        }
        AdManager.playRewardedAd((result) => {
            if (!result.success) {
                this.showToast(result.reason || '广告播放失败，请重试。');
                if (this.panels.preBuffButton) {
                    this.panels.preBuffButton.label.string = '获取增益';
                    this.panels.preBuffButton.disabled = false;
                }
                return;
            }
            AdManager.drawRandomPreBuff();
            if (this.panels.preBuffLabel && AdManager.currentPreBuff) {
                this.panels.preBuffLabel.string = `当前增益：${AdManager.currentPreBuff.name} — ${AdManager.currentPreBuff.desc}`;
            }
            if (this.panels.preBuffButton) {
                this.panels.preBuffButton.label.string = `增益已激活：${AdManager.currentPreBuff!.name}`;
                this.panels.preBuffButton.disabled = true;
            }
            this.showToast(`战前增益已激活：${AdManager.currentPreBuff!.name} (${AdManager.currentPreBuff!.desc})`);
        });
    }

    private requestExtractDouble(): void {
        if (this._extractDoubled) return;
        if (this.panels.extractDoubleButton) {
            this.panels.extractDoubleButton.label.string = '广告加载中...';
            this.panels.extractDoubleButton.disabled = true;
        }
        AdManager.playRewardedAd((result) => {
            if (!result.success) {
                this.showToast(result.reason || '广告播放失败，请重试。');
                if (this.panels.extractDoubleButton) {
                    this.panels.extractDoubleButton.label.string = '看视频双倍领取';
                    this.panels.extractDoubleButton.disabled = false;
                }
                return;
            }
            this._extractDoubled = true;
            // Double the reward: add reward again to inventory
            const reward = this.calculateEndlessReward('extract');
            this.addWalletToInventory(reward);
            this.shop.saveProgress();
            if (this.panels.hangarStatsLabel) {
                this.panels.hangarStatsLabel.string = [
                    `存活 ${this.formatTime(this.cs.combatTime)}  Boss ${this.cs.bossKills}  击杀 ${this.cs.killCount}`,
                    `本次带回：${this.formatWallet(reward)}`,
                    `库存：${this.formatWallet(this.getInventoryWallet())}`,
                    '双倍领取成功！',
                ].join('\\n');
            }
            if (this.panels.extractDoubleButton) {
                this.panels.extractDoubleButton.label.string = '双倍已领取 ✓';
                this.panels.extractDoubleButton.disabled = true;
            }
            this.showToast('双倍领取成功！奖励已翻倍。');
        });
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
            const targetPos = this.enemyMgr.getEnemyPosition(target);
            this.playerWeaponAimAngle = Math.atan2(targetPos.y - this.cs.playerY, targetPos.x - this.cs.playerX);
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
                const { x: ex, y: ey } = this.enemyMgr.getEnemyPosition(enemy);
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
        // Decay shake
        if (this.cs.shakeIntensity > 0.01) {
            this.cs.shakeIntensity *= Math.max(0.85, 1 - dt * 7);
        } else {
            this.cs.shakeIntensity = 0;
        }
        const targetX = this.clamp(CAMERA_FOCUS_X - this.cs.playerX, VIEW_RIGHT - WORLD_RIGHT, VIEW_LEFT - WORLD_LEFT);
        const targetY = this.clamp(CAMERA_FOCUS_Y - this.cs.playerY, VIEW_TOP - WORLD_TOP, VIEW_BOTTOM - WORLD_BOTTOM);
        const follow = snap ? 1 : Math.min(1, dt * 8.5);
        this.cs.cameraX += (targetX - this.cs.cameraX) * follow;
        this.cs.cameraY += (targetY - this.cs.cameraY) * follow;
        // Apply shake offset
        if (this.cs.shakeIntensity > 0) {
            const sx = (Math.random() * 2 - 1) * this.cs.shakeIntensity;
            const sy = (Math.random() * 2 - 1) * this.cs.shakeIntensity;
            this.worldNode.setPosition(this.cs.cameraX + sx, this.cs.cameraY + sy, 0);
        } else {
            this.worldNode.setPosition(this.cs.cameraX, this.cs.cameraY, 0);
        }
    }

    private botAiTick(dt: number): void {
        this.touchActive = false;
        this.touchVector.set(0, 0);

        if (this.cs.killCount > this._botLastKillCount) {
            // Like a normal player: after a kill, briefly sweep nearby XP only
            // when the route is safe.  This changes behaviour, not XP numbers.
            this._botPickupChaseTimer = 5.5;
        }
        // Extend chase window when danger is low and XP is on ground nearby
        const xpPickups = (this.pickupMgr.pickups || []).filter((p: {type: string}) => p.type === 'xp');
        if (xpPickups.length > 0 && this._botPickupChaseTimer <= 1) {
            this._botPickupChaseTimer = Math.max(this._botPickupChaseTimer, 2);
        }
        this._botLastKillCount = this.cs.killCount;
        this._botPickupChaseTimer = Math.max(0, this._botPickupChaseTimer - dt);

        const px = this.cs.playerX;
        const py = this.cs.playerY;
        const stats = this.getCharacterStats();
        const hpRatio = this.cs.playerMaxHp > 0 ? this.cs.playerHp / this.cs.playerMaxHp : 1;
        const attackRange = this.getAttackRange();
        const speed = this.getMoveSpeed();
        const lookahead = this.clamp(speed > 0 ? 96 / speed : 0.34, 0.24, 0.48);

        if (this._botLastPlayerPos && this._botState !== 'idle') {
            const movedX = px - this._botLastPlayerPos.x;
            const movedY = py - this._botLastPlayerPos.y;
            const moved = Math.sqrt(movedX * movedX + movedY * movedY);
            const expectedStep = Math.max(1.2, speed * dt * 0.16);
            this._botStuckTimer = moved < expectedStep ? this._botStuckTimer + dt : 0;
        } else {
            this._botStuckTimer = 0;
        }
        this._botLastPlayerPos = new Vec2(px, py);

        if (this._botStuckTimer >= 1.05 && (!this._botTargetPos || this._botMoveTimer <= 0)) {
            const escape = this.botFindSafestEscapePoint(px, py, speed, lookahead, attackRange, hpRatio);
            this._botTargetPos = escape;
            this._botMoveTimer = 0.9;
        }

        let bestMoveX = 0;
        let bestMoveY = 0;
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestState: 'idle' | 'moving' | 'fighting' | 'fleeing' = 'idle';

        for (const dir of this.botCandidateDirections()) {
            const candidateX = this.clamp(px + dir.x * speed * lookahead, WORLD_LEFT + 42, WORLD_RIGHT - 42);
            const candidateY = this.clamp(py + dir.y * speed * lookahead, WORLD_BOTTOM + 42, WORLD_TOP - 42);
            const scored = this.botScoreMoveCandidate(candidateX, candidateY, dir.x, dir.y, attackRange, hpRatio);
            if (scored.score > bestScore) {
                bestScore = scored.score;
                bestMoveX = dir.x;
                bestMoveY = dir.y;
                bestState = scored.state;
            }
        }

        if (this._botTargetPos && this._botMoveTimer > 0) {
            this._botMoveTimer = Math.max(0, this._botMoveTimer - dt);
            if (this.distanceSq(px, py, this._botTargetPos.x, this._botTargetPos.y) < 70 * 70 || this._botMoveTimer <= 0) {
                this._botTargetPos = null;
                this._botStuckTimer = 0;
            }
        }

        this._botState = bestState;
        this.botSetMoveKeys(bestMoveX, bestMoveY);
    }

    private botCandidateDirections(): Vec2[] {
        const dirs: Vec2[] = [new Vec2(0, 0)];
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 * i) / 16;
            dirs.push(new Vec2(Math.cos(angle), Math.sin(angle)));
        }
        return dirs;
    }

    private botScoreMoveCandidate(
        candidateX: number,
        candidateY: number,
        dirX: number,
        dirY: number,
        attackRange: number,
        hpRatio: number,
    ): { score: number; state: 'idle' | 'moving' | 'fighting' | 'fleeing' } {
        const px = this.cs.playerX;
        const py = this.cs.playerY;
        const playerRadius = this.cs.playerRadius;
        const lowHpRiskMultiplier = hpRatio < 0.32 ? 2.2 : hpRatio < 0.52 ? 1.45 : 1;
        let score = 0;
        let dangerScore = 0;
        let nearestEnemyDist = Number.POSITIVE_INFINITY;
        let nearestEnemyInRange = false;

        for (const enemy of this.enemyMgr.enemies) {
            if (!this.enemyMgr.enemySet.has(enemy) || enemy.hp <= 0) continue;
            const pos = this.enemyMgr.getEnemyPosition(enemy);
            const dx = candidateX - pos.x;
            const dy = candidateY - pos.y;
            const dist = Math.sqrt(Math.max(0.001, dx * dx + dy * dy));
            nearestEnemyDist = Math.min(nearestEnemyDist, dist);
            if (dist <= attackRange) nearestEnemyInRange = true;

            const contactRadius = playerRadius + enemy.radius + 6;
            if (dist < contactRadius) {
                score -= 220000 + (contactRadius - dist) * 2600;
            }

            const threatRadius = Math.min(
                980,
                Math.max(280, enemy.radius + enemy.speed * 1.05 + (enemy.boss ? 250 : enemy.elite ? 190 : 145)),
            );
            if (dist < threatRadius) {
                const t = (threatRadius - dist) / threatRadius;
                const threatWeight = (enemy.boss ? 135 : enemy.elite ? 58 : 30) * (enemy.damage + 6) * lowHpRiskMultiplier;
                const penalty = t * t * threatWeight;
                score -= penalty;
                dangerScore += penalty;
            }

            // Do not kite directly into the closest monster's movement line.
            const fromPlayerToEnemyX = pos.x - px;
            const fromPlayerToEnemyY = pos.y - py;
            const playerEnemyLen = Math.sqrt(Math.max(0.001, fromPlayerToEnemyX * fromPlayerToEnemyX + fromPlayerToEnemyY * fromPlayerToEnemyY));
            const movingTowardEnemy = (dirX * fromPlayerToEnemyX + dirY * fromPlayerToEnemyY) / playerEnemyLen;
            if (movingTowardEnemy > 0.45 && playerEnemyLen < 420) {
                score -= movingTowardEnemy * 180 * lowHpRiskMultiplier;
            }
        }

        for (const projectile of this.proj.enemyProjectiles) {
            const futureX = projectile.x + projectile.vx * 0.38;
            const futureY = projectile.y + projectile.vy * 0.38;
            const nowDistSq = this.distanceSq(candidateX, candidateY, projectile.x, projectile.y);
            const futureDistSq = this.distanceSq(candidateX, candidateY, futureX, futureY);
            const dangerRadius = playerRadius + projectile.radius + 48;
            const dangerSq = dangerRadius * dangerRadius;
            if (nowDistSq < dangerSq || futureDistSq < dangerSq) {
                const d = Math.sqrt(Math.max(0.001, Math.min(nowDistSq, futureDistSq)));
                const t = (dangerRadius - d) / dangerRadius;
                const penalty = 4200 * t * t * lowHpRiskMultiplier;
                score -= penalty;
                dangerScore += penalty;
            }
        }

        if (Number.isFinite(nearestEnemyDist)) {
            const desiredDistance = this.clamp(attackRange * 0.64, 220, 480);
            if (nearestEnemyInRange) score += 430;
            score -= Math.abs(nearestEnemyDist - desiredDistance) * 0.34;
            if (nearestEnemyDist < desiredDistance * 0.68) {
                score -= (desiredDistance * 0.68 - nearestEnemyDist) * 1.3 * lowHpRiskMultiplier;
            }
            if (nearestEnemyDist > attackRange) {
                score -= Math.min(420, (nearestEnemyDist - attackRange) * 1.2);
            }
        }

        const pickupScore = this.botScorePickupRoute(candidateX, candidateY, dangerScore, hpRatio);
        score += pickupScore;

        const edgeMargin = 686;
        const leftEdge = candidateX - WORLD_LEFT;
        const rightEdge = WORLD_RIGHT - candidateX;
        const bottomEdge = candidateY - WORLD_BOTTOM;
        const topEdge = WORLD_TOP - candidateY;
        const currentEdgeMin = Math.min(px - WORLD_LEFT, WORLD_RIGHT - px, py - WORLD_BOTTOM, WORLD_TOP - py);
        const candidateEdgeMin = Math.min(leftEdge, rightEdge, bottomEdge, topEdge);
        for (const edgeDist of [leftEdge, rightEdge, bottomEdge, topEdge]) {
            if (edgeDist < edgeMargin) {
                const t = (edgeMargin - edgeDist) / edgeMargin;
                score -= t * t * 7600;
            }
            if (edgeDist < 266) score -= 90000;
        }
        if (currentEdgeMin < edgeMargin) {
            score += (candidateEdgeMin - currentEdgeMin) * 9.5;
        }

        // Ordinary players avoid getting boxed into arena corners even if the
        // immediate monster distance looks acceptable.  Keep the bot's patrol
        // path biased toward playable middle lanes rather than map extremes.
        const absX = Math.abs(candidateX);
        const absY = Math.abs(candidateY);
        if (absX > 1120) score -= (absX - 1120) * 7.2;
        if (absY > 1520) score -= (absY - 1520) * 7.2;
        if (absX > 1435 || absY > 1870) score -= 80000;
        score -= Math.sqrt(candidateX * candidateX + candidateY * candidateY) * 0.05;

        if (this._botTargetPos) {
            const currentTargetDist = Math.sqrt(this.distanceSq(px, py, this._botTargetPos.x, this._botTargetPos.y));
            const candidateTargetDist = Math.sqrt(this.distanceSq(candidateX, candidateY, this._botTargetPos.x, this._botTargetPos.y));
            score += (currentTargetDist - candidateTargetDist) * 3.2;
        }

        const standingStill = Math.abs(dirX) + Math.abs(dirY) <= 0.001;
        if (standingStill && dangerScore < 80 && nearestEnemyInRange) score += 120;
        if (standingStill && (dangerScore > 160 || hpRatio < 0.42)) score -= 260;

        let state: 'idle' | 'moving' | 'fighting' | 'fleeing' = 'idle';
        if (dangerScore > 180 || hpRatio < 0.34) state = 'fleeing';
        else if (pickupScore > 90) state = 'moving';
        else if (nearestEnemyInRange && standingStill) state = 'fighting';
        else if (Number.isFinite(nearestEnemyDist)) state = nearestEnemyInRange ? 'fighting' : 'moving';
        return { score, state };
    }

    private botScorePickupRoute(candidateX: number, candidateY: number, dangerScore: number, hpRatio: number): number {
        if (hpRatio < 0.32) return 0;
        const px = this.cs.playerX;
        const py = this.cs.playerY;
        let score = 0;
        const chaseWindow = this._botPickupChaseTimer > 0;
        const maxXpDistance = chaseWindow ? 2000 : 1100;
        for (const pickup of this.pickupMgr.pickups) {
            const isXp = pickup.type === 'xp';
            const isChest = pickup.type === 'chest-common' || pickup.type === 'chest-rare';
            if (!isXp && !isChest && pickup.type !== 'alloy') continue;
            const currentDist = Math.sqrt(this.distanceSq(px, py, pickup.x, pickup.y));
            const candidateDist = Math.sqrt(this.distanceSq(candidateX, candidateY, pickup.x, pickup.y));
            const maxDistance = isXp ? maxXpDistance : isChest ? 620 : 360;
            if (currentDist > maxDistance) continue;
            const value = isXp
                ? 700 + Math.min(360, pickup.amount * 20)
                : isChest
                    ? (pickup.type === 'chest-rare' ? 240 : 170)
                    : 44;
            // Gradual safety reduction instead of hard cutoff at dangerScore > 2000
            const safety = dangerScore > 800 ? 0.2 : dangerScore > 420 ? 0.5 : dangerScore > 120 ? 0.8 : 1;
            const progress = Math.max(-80, currentDist - candidateDist);
            const nearCollectBonus = isXp && candidateDist < 220 ? 520 : 0;
            score += ((1 - candidateDist / maxDistance) * value + progress * 6.2 + nearCollectBonus) * safety;
        }
        return score;
    }

    private botFindSafestEscapePoint(
        px: number,
        py: number,
        speed: number,
        lookahead: number,
        attackRange: number,
        hpRatio: number,
    ): Vec2 {
        let best = new Vec2(this.clamp(-px, -1, 1), this.clamp(-py, -1, 1));
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const dir of this.botCandidateDirections()) {
            if (Math.abs(dir.x) + Math.abs(dir.y) <= 0.001) continue;
            const candidateX = this.clamp(px + dir.x * speed * lookahead * 2.2, WORLD_LEFT + 80, WORLD_RIGHT - 80);
            const candidateY = this.clamp(py + dir.y * speed * lookahead * 2.2, WORLD_BOTTOM + 80, WORLD_TOP - 80);
            const score = this.botScoreMoveCandidate(candidateX, candidateY, dir.x, dir.y, attackRange, hpRatio).score;
            if (score > bestScore) {
                bestScore = score;
                best = new Vec2(candidateX, candidateY);
            }
        }
        return best;
    }

    private botSetMoveKeys(x: number, y: number): void {
        this.pressedKeys.delete(KeyCode.KEY_A);
        this.pressedKeys.delete(KeyCode.KEY_D);
        this.pressedKeys.delete(KeyCode.KEY_W);
        this.pressedKeys.delete(KeyCode.KEY_S);

        const len = Math.sqrt(x * x + y * y);
        if (len <= 0.001) return;

        const nx = x / len;
        const ny = y / len;
        const threshold = 0.25;
        if (nx < -threshold) this.pressedKeys.add(KeyCode.KEY_A);
        if (nx > threshold) this.pressedKeys.add(KeyCode.KEY_D);
        if (ny > threshold) this.pressedKeys.add(KeyCode.KEY_W);
        if (ny < -threshold) this.pressedKeys.add(KeyCode.KEY_S);
    }

    private botPickUpgrade(): void {
        const externalOptions = (this as unknown as { pendingUpgradeOptions?: LevelUpgrade[] }).pendingUpgradeOptions;
        const isLevelChoice = this.cs.phase === 'level-up';
        const isItemChoice = this.cs.phase === 'item-choice';
        if (!isLevelChoice && !isItemChoice) return;

        const options = isLevelChoice
            ? (externalOptions && externalOptions.length > 0 ? externalOptions : this.pickupMgr.pendingLevelChoices)
            : this.pickupMgr.pendingItemChoices;
        if (!options || options.length <= 0) return;

        const index = this.botChooseUpgradeIndex(options);
        if (isLevelChoice) this.pickupMgr.chooseLevelUpgrade(index);
        else this.pickupMgr.chooseRunItem(index);
    }

    private botChooseUpgradeIndex(options: LevelUpgrade[]): number {
        const stats = this.getCharacterStats();
        const statsAreHigh = stats.dronePower >= 12
            && stats.attackPower >= 72
            && stats.attackSpeed >= 0.9
            && stats.pierce >= 3
            && stats.critChance >= 0.2;
        if (statsAreHigh) return 0;

        const priority: Partial<Record<StatKey, number>> = {
            dronePower: 10000,
            attackPower: 8000,
            attackSpeed: 7000,
            pierce: 6000,
            critChance: 5000,
        };
        const weakness: Partial<Record<StatKey, boolean>> = {
            dronePower: stats.dronePower < 8,
            attackPower: stats.attackPower < 56,
            attackSpeed: stats.attackSpeed < 0.6,
            pierce: stats.pierce < 2,
            critChance: stats.critChance < 0.14,
        };

        let bestIndex = 0;
        let bestScore = Number.NEGATIVE_INFINITY;
        options.forEach((option, index) => {
            let score = option.tier * 20 - index;
            for (const effect of option.effects) {
                const base = priority[effect.stat] ?? 0;
                const normalizedAmount = (effect.stat === 'attackSpeed' || effect.stat === 'critChance')
                    ? effect.amount * 1000
                    : effect.amount * 10;
                score += base + normalizedAmount;
                if (weakness[effect.stat]) score += 4500;
            }
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });
        return bestIndex;
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
        const pos = target.node.position;
        const targetX = Number.isFinite(pos?.x) ? pos.x : target._botX ?? this.cs.playerX;
        const targetY = Number.isFinite(pos?.y) ? pos.y : target._botY ?? this.cs.playerY;
        const dx = targetX - this.cs.playerX;
        const dy = targetY - this.cs.playerY;
        const baseAngle = Math.atan2(dy, dx);
        this.playerWeaponAimAngle = baseAngle;
        this.updatePlayerWeaponVisual();
        const damage = this.proj.getBulletDamage();
        const activeWeapon = this.shop.getActiveWeapon();
        const weaponStyle = activeWeapon?.attackStyle || 'rifle';
        const weaponColor = activeWeapon?.color || '#4CC9F0';
        this.cs.shotCounter += 1;
        const shootMechanic = this.getActiveWeaponMechanic();
        let muzzleShotCount = 1;

        // 根据机械机制决定射击
        if (shootMechanic === 'multishot_3') {
            // 裂变枪管: 同时 3 颗扇形 0.18 rad 间距
            muzzleShotCount = 3;
            const spread = [-0.18, 0, 0.18];
            for (const offset of spread) {
                const angle = baseAngle + offset;
                this.proj.createBullet(angle, damage, this.proj.getBulletPierce(), weaponStyle, weaponColor, shootMechanic);
            }
        } else if (shootMechanic === 'radial_5') {
            // 镜像棱镜: 5 颗 360° 均匀分布
            muzzleShotCount = 5;
            for (let i = 0; i < 5; i++) {
                const angle = baseAngle + (Math.PI * 2 * i) / 5;
                this.proj.createBullet(angle, damage, this.proj.getBulletPierce(), weaponStyle, weaponColor, shootMechanic);
            }
        } else if (shootMechanic === 'poison') {
            // 瘟疫喷射器: 扇形毒雾, 不射子弹, 直接伤害锥形范围敌人
            const range = Math.min(this.getAttackRange(), 420);
            this.proj.spawnSprayCone(baseAngle, range, weaponColor);
            for (const enemy of this.enemyMgr.enemies) {
                if (!this.enemyMgr.enemySet.has(enemy)) continue;
                const pos = this.enemyMgr.getEnemyPosition(enemy);
                const dx = pos.x - this.cs.playerX;
                const dy = pos.y - this.cs.playerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > range || dist < 12) continue;
                // 锥形检测: 敌人方向与射击方向的夹角
                const enemyAngle = Math.atan2(dy, dx);
                let diff = enemyAngle - baseAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) > 0.55) continue;
                // 应用伤害+叠毒 (直接伤害, 不射子弹)
                const roll = this.enemyMgr.rollOutgoingDamage(enemy, damage);
                this.enemyMgr.damageEnemy(enemy, roll.amount, '#84CC16', roll.tag);
                enemy.poisonStacks = Math.min(5, (enemy.poisonStacks || 0) + 1);
                enemy.poisonTimer = 1.0;
                enemy.poisonDps = 0.5 + damage * 0.3;
                if (this.cs.shotCounter % 2 === 0) {
                    this.proj.spawnBulletHitSpark(pos.x, pos.y, weaponStyle, weaponColor, '#BBF7D0');
                }
            }
        } else {
            this.proj.createBullet(baseAngle, damage, this.proj.getBulletPierce(), weaponStyle, weaponColor, shootMechanic);
        }
        this.audio.playShootSfx(weaponStyle);
        this.proj.spawnMuzzleFlash(baseAngle, weaponStyle, weaponColor, muzzleShotCount);
    }

    private updateRegen(dt: number) {
        const regen = this.getCharacterStats().hpRegen;
        if (regen <= 0 || this.cs.playerHp <= 0 || this.cs.playerHp >= this.cs.playerMaxHp) return;
        this.cs.regenTimer += dt;
        // 机制词条: crit_stacks (风暴步枪) 暴击叠加 1% 射速/层, 上限 5 层, 3 秒不暴击衰减 1 层
        if (this.cs.critStacks > 0) {
            this.cs.attackSpeedBoostTimer -= dt;
            if (this.cs.attackSpeedBoostTimer <= 0) {
                this.cs.critStacks = Math.max(0, this.cs.critStacks - 1);
                this.cs.attackSpeedBoostTimer = 6.0;
            }
        }
        // 机制词条: pierce_stacks (回声弓) 暴击叠加穿透, 6 秒不暴击衰减 1 层
        if (this.cs.pierceStacks > 0) {
            this.cs.pierceStackTimer -= dt;
            if (this.cs.pierceStackTimer <= 0) {
                this.cs.pierceStacks = Math.max(0, this.cs.pierceStacks - 1);
                this.cs.pierceStackTimer = 6.0;
            }
        }
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
        const defenseRatio = 1 - this.clamp(defense / (defense + 80), 0, 0.7);
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
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 2);
            this.vfxPlayerHitOverlay = 0.3;
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

    // VFX bridge from sub-systems (enemyManager, pickupManager, etc.)
    private rumbleVfx(effect: string): void {
        switch (effect) {
            case 'bossWarning':
                this.vfxBossWarning = 1.8;
                break;
            case 'bossDeath':
                this.vfxSlowMo = 1.0;
                this.vfxWaveClearPulse = 1.5;
                break;
            case 'levelUp':
                this.vfxLevelUpFlash = 0.15;
                break;
            case 'waveClear':
                this.vfxWaveClearPulse = 1.5;
                break;
            case 'rarePickup':
                this.vfxRarePickupPulse = 1.2;
                break;
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
        if (!canFinishBattle(this.cs.phase)) return;
        // Consume pre-battle buff at end of battle
        AdManager.consumePreBuff();
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
        const settlementFlow = getSettlementFlow(reason, this.cs.bossKills);
        if (this.panels.hangarTitleLabel) this.panels.hangarTitleLabel.string = settlementFlow.title;
        if (this.panels.hangarStatsLabel) {
            this.panels.hangarStatsLabel.string = [
                `存活 ${this.formatTime(this.cs.combatTime)}  Boss ${this.cs.bossKills}  击杀 ${this.cs.killCount}`,
                `本次带回：${this.formatWallet(reward)}`,
                `库存：${this.formatWallet(this.getInventoryWallet())}`,
            ].join('\n');
        }

        this._extractDoubled = false;
        if (this.panels.preBuffButton) {
            this.panels.preBuffButton.label.string = '获取增益';
            this.panels.preBuffButton.disabled = false;
        }
        if (this.panels.preBuffLabel) {
            this.panels.preBuffLabel.string = '';
        }

        if (settlementFlow.phase === 'loot') {
            this.openSettlementLoot(reason);
        } else {
            this.openSettlementHangarActions(reason);
        }
        this.refreshHud();
    }

    private openSettlementHangarActions(reason: BattleEndReason): void {
        this.cs.phase = 'hangar';
        this.panels.lootButtons.forEach((button) => button.node.active = false);
        this.panels.setHangarControlsActive(true);
        if (this.panels.startButton) this.panels.startButton.node.active = true;
        if (this.panels.preBuffButton) this.panels.preBuffButton.node.active = true;
        if (this.panels.extractDoubleButton) {
            this.panels.extractDoubleButton.node.active = shouldShowExtractDouble(reason);
            this.panels.extractDoubleButton.label.string = '看视频双倍领取';
            this.panels.extractDoubleButton.disabled = false;
        }
        if (this.panels.hangarTipLabel) this.panels.hangarTipLabel.string = getSettlementTip(reason, 'hangar');
        this.shop.refreshEquipmentButtons();
    }

    private openSettlementLoot(reason: BattleEndReason): void {
        this.cs.phase = 'loot';
        this.pickupMgr.pendingLootChoices = this.pickupMgr.createLootChoices();
        this.panels.setHangarControlsActive(false);
        if (this.panels.startButton) this.panels.startButton.node.active = false;
        if (this.panels.preBuffButton) this.panels.preBuffButton.node.active = false;
        if (this.panels.extractDoubleButton) this.panels.extractDoubleButton.node.active = false;
        if (this.panels.hangarTitleLabel) this.panels.hangarTitleLabel.string = 'Boss 战利品';
        if (this.panels.hangarTipLabel) {
            const fallback = getSettlementTip(reason, 'loot');
            this.panels.hangarTipLabel.string = this.pickupMgr.pendingLootChoices.length > 0 ? '选择 1 项 Boss 战利品后返回机库。' : fallback;
        }
        this.panels.lootButtons.forEach((button, index) => {
            const choice = this.pickupMgr.pendingLootChoices[index];
            button.node.active = !!choice;
            if (!choice) return;
            button.color = choice.color;
            button.label.fontSize = 17;
            button.label.lineHeight = 19;
            button.label.string = `${choice.title}\n${choice.desc}`;
            this.drawButton(button, false);
        });
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
            const enemyPoolCount = inRun ? this.enemyMgr.getAvailableEnemySpecs().length + 5 : TOTAL_ENEMY_TYPES;
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

    private gainXp(amount: number): void {
        this.pickupMgr.gainXp(amount);
    }

    private pickLevelChoices(): LevelUpgrade[] {
        const maxTier = this.cs.level < 4 ? 2 : this.cs.level < 8 ? 3 : this.cs.level < 13 ? 4 : 5;
        const pool = this.shuffle([...LEVEL_UP_BLUEPRINTS]).filter(() => true);
        const picked: LevelUpgrade[] = [];
        const usedCategories = new Set<string>();
        for (const bp of pool) {
            if (picked.length >= 3) break;
            if (usedCategories.has(bp.category) && picked.length < 2) continue;
            const upgrade = catalogRollStatUpgradeChoice(bp);
            picked.push(upgrade);
            usedCategories.add(bp.category);
        }
        while (picked.length < 3 && pool.length > 0) {
            const bp = pool[picked.length % pool.length];
            const upgrade = catalogRollStatUpgradeChoice(bp);
            if (picked.indexOf(upgrade) < 0) picked.push(upgrade);
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
        const level = weapon ? this.shop.getEquipmentLevel(weapon.id) : 1;
        const base = weapon ? (weapon.weaponStats?.[stat] || 0) : 0;
        // 线性成长系数，与 projectileManager 对齐
        const growthRates: Partial<Record<keyof WeaponStats, number>> = {
            damage: 0.12,
            fireRate: 0.10,
            pierce: 0.10,
            bulletSpeed: 0.08,
            drone: 0.08,
        };
        const growth = growthRates[stat] ?? 0.10;
        return base * (1 + (level - 1) * growth);
    }

    private getCharacterStats(): CharacterStats {
        const stats = createBaseCharacterStats();
        this.addCharacterStats(stats, this.pickupMgr.runStats);

        stats.attackSpeed += this.getWeaponStat('fireRate') * 0.18;
        stats.bulletSpeed += this.getWeaponStat('bulletSpeed') * 6;
        stats.pierce += this.getWeaponStat('pierce') * 0.18;
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
        if (this.toastTimer <= 0) {
            if (this.panels.toastLabel) {
                this.panels.toastLabel.string = '';
                this.panels.toastLabel.node.active = false;
            }
            if (this.toastPanelNode) this.toastPanelNode.active = false;
            if (this.toastPanelShadowNode) this.toastPanelShadowNode.active = false;
        }
    }

    private showToast(message: string) {
        if (!this.panels.toastLabel) return;
        const visible = message.length > 0;
        this.panels.toastLabel.string = message;
        this.panels.toastLabel.node.active = visible;
        if (this.toastPanelNode) this.toastPanelNode.active = visible;
        if (this.toastPanelShadowNode) this.toastPanelShadowNode.active = visible;
        this.toastTimer = visible ? 2.5 : 0;
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
        const alpha = disabled ? RogueShooterGame.UI.btnDisabledAlpha : 255;
        const w = button.width;
        const h = button.height;
        const r = Math.min(18, Math.max(10, h * 0.24));
        button.gfx.clear();
        // Contact shadow
        button.gfx.fillColor = this.hex(RogueShooterGame.UI.btnShadow, disabled ? 48 : 92);
        button.gfx.roundRect(-w / 2 + 4, -h / 2 + 7, w, h, r);
        button.gfx.fill();
        // Dark bevel backing keeps saturated action colors premium instead of toy-flat.
        button.gfx.fillColor = this.hex(RogueShooterGame.UI.panelBgDeep, disabled ? 170 : 235);
        button.gfx.roundRect(-w / 2, -h / 2, w, h, r);
        button.gfx.fill();
        // Accent body
        button.gfx.fillColor = this.hex(mainColor, Math.round(alpha * (disabled ? 0.52 : 0.88)));
        button.gfx.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, Math.max(8, r - 3));
        button.gfx.fill();
        // Bottom depth layer
        button.gfx.fillColor = this.hex('#000000', disabled ? 54 : 76);
        button.gfx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, Math.max(12, h * 0.38), Math.max(7, r - 5));
        button.gfx.fill();
        // Glass highlight / clickable strip
        button.gfx.fillColor = this.hex(RogueShooterGame.UI.btnHighlight, disabled ? 18 : 54);
        button.gfx.roundRect(-w / 2 + 12, h / 2 - Math.max(18, h * 0.32), w - 24, Math.max(8, h * 0.14), 5);
        button.gfx.fill();
        // Left energy rail
        button.gfx.fillColor = this.hex(disabled ? RogueShooterGame.UI.hint : RogueShooterGame.UI.glassHighlight, disabled ? 46 : 150);
        button.gfx.roundRect(-w / 2 + 8, -h / 2 + 10, 5, h - 20, 3);
        button.gfx.fill();
        // Dual border
        button.gfx.strokeColor = this.hex(disabled ? RogueShooterGame.UI.btnBorder : RogueShooterGame.UI.glassHighlight, disabled ? 80 : 165);
        button.gfx.lineWidth = 1.4;
        button.gfx.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, r);
        button.gfx.stroke();
        button.gfx.strokeColor = this.hex(disabled ? RogueShooterGame.UI.btnBorder : mainColor, disabled ? 80 : 210);
        button.gfx.lineWidth = 2.2;
        button.gfx.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, Math.max(8, r - 4));
        button.gfx.stroke();
        button.label.color = this.hex(disabled ? RogueShooterGame.UI.btnDisabled : RogueShooterGame.UI.btnText, disabled ? 165 : 255);
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
        const isPanelLike = !!strokeColor && (color === RogueShooterGame.UI.panelBg || color === RogueShooterGame.UI.hudBg || color === RogueShooterGame.UI.panelBgDeep);
        if (isPanelLike) {
            this.drawPremiumPanel(
                gfx,
                width,
                height,
                radius || 18,
                strokeColor,
                color === RogueShooterGame.UI.hudBg ? RogueShooterGame.UI.hudAccent : RogueShooterGame.UI.neonCyan,
            );
        } else {
            gfx.fillColor = this.hex(color);
            if (radius > 0) {
                gfx.roundRect(-width / 2, -height / 2, width, height, radius);
            } else {
                gfx.rect(-width / 2, -height / 2, width, height);
            }
            gfx.fill();
            if (strokeColor) {
                gfx.lineWidth = 1.5;
                gfx.strokeColor = this.hex(strokeColor, 180);
                if (radius > 0) {
                    gfx.roundRect(-width / 2, -height / 2, width, height, radius);
                } else {
                    gfx.rect(-width / 2, -height / 2, width, height);
                }
                gfx.stroke();
            }
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

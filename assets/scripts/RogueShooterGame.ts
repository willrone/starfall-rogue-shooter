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
import { uiMgr } from './ui/UIManager';
import { SettlementPopup } from './ui/SettlementPopup';
import { RevivePopup } from './ui/RevivePopup';
import { makeLabel, makeRect, makeButton, drawButton as drawButtonGfx, updateButtonSkin, place, placeLocal, hex, clamp, loadSprite, applySlicedSprite } from './ui/UIHelpers';
import { BotAIController, type BotAIHost } from './ai/botAI';
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
import { ENEMY_SPECS, ENEMY_VARIANTS, buildEnemyCatalog } from './catalogs/enemyCatalog';
import { EnemyManager, ENEMY_PLAYER_PADDING, ENEMY_STRIP_META, MAX_CHESTS_PER_WAVE, type Enemy, type EnemyHostContext, type SpriteStripAnimation } from './enemy/enemyManager';
import { GameEventBus } from './core/gameContext';
import { MIRROR_PRISM_FOCUSED_DAMAGE_MULTIPLIER } from './core/weaponMechanics';
import { CombatState, createCombatState, resetCombatSession } from './state/combatState';
import { ProjectileManager, BULLET_HIT_CELL, type Bullet, type EnemyProjectile, type ProjectileHostContext } from './projectile/projectileManager';
import { PickupManager, type Pickup, type PickupHostContext } from './pickup/pickupManager';
import { EquipmentManager, type ShopHostContext } from './shop/equipmentManager';
import { OffhandManager, type OffhandHostContext } from './offhand/offhandManager';
import { OFFHAND_CATALOG, findOffhand } from './catalogs/offhandCatalog';

const ENEMY_PROJECTILE_LIMIT = 140;

const { ccclass } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const SAVE_KEY = 'starfall-rogue-shooter-progress-v1';
const VIEW_LEFT = -DESIGN_WIDTH / 2;
const VIEW_RIGHT = DESIGN_WIDTH / 2;
const VIEW_BOTTOM = -DESIGN_HEIGHT / 2;
const VIEW_TOP = DESIGN_HEIGHT / 2;
const WORLD_LEFT = -900;
const WORLD_RIGHT = 900;
const WORLD_BOTTOM = -1200;
const WORLD_TOP = 1200;
const CAMERA_FOCUS_X = 0;
const CAMERA_FOCUS_Y = -96;
const ART_DIRS = ['art/placeholder', 'art/characters', 'art/enemies', 'art/weapons'] as const;
const ART_LOAD_TIMEOUT_SECONDS = 4;
const PLACEHOLDER_ART_DIR = 'art/placeholder';
const HANGAR_EQUIPMENT_SLOTS = 9;
const EQUIPPED_SLOT_COUNT = 5;
const MAX_EQUIPPED_WEAPONS = 1;
const MAX_EQUIPPED_GEAR = 4;
const MAX_COMBAT_DT = 1 / 30;

const SHOP_REFRESH_COST = 18;
const SHOP_ITEM_COUNT = 6;
const UI_SAFE_TOP = 56;
const UI_SAFE_BOTTOM = 32;
const MIN_TOUCH_BUTTON_HEIGHT = 48;
const HUD_TEXT_REFRESH_INTERVAL = 0.1;
const AREA_PULSE_POOL_SIZE = 48;
const DRONE_ZAP_POOL_SIZE = 16;


interface ButtonView {
    node: Node;
    gfx: Graphics;
    label: Label;
    width: number;
    height: number;
    color: string;
    disabledColor: string;
    disabled: boolean;
    renderKey?: string;
}

function drawButtonView(button: ButtonView, disabled: boolean): void {
    const renderKey = `${disabled ? 1 : 0}:${button.color}:${button.disabledColor}`;
    if (button.renderKey === renderKey) return;
    button.renderKey = renderKey;
    button.disabled = disabled;
    drawButtonGfx(button.gfx, button.width, button.height, disabled ? button.disabledColor : button.color, disabled);
    updateButtonSkin(button, disabled);
}

interface TimedGraphicsEffect {
    node: Node;
    gfx: Graphics;
    remaining: number;
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
    private combatHudRoot: Node | null = null;
    private selectedOffhandId = OFFHAND_CATALOG[0]?.id || '';

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
    private worldVfxLayer: Node | null = null;
    private areaPulsePool: TimedGraphicsEffect[] = [];
    private droneZapPool: TimedGraphicsEffect[] = [];
    private areaPulsePoolCursor = 0;
    private droneZapPoolCursor = 0;

    // ── Bot test data ─────────────────────────────────────────────
    private botData: any[] = [];
    private botDataTimer = 0;

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
    // HUD sprite fill bars (replacing Graphics in drawBars)
    private _hpBarFill: Node | null = null;
    private _xpBarFill: Node | null = null;
    private _shieldBarFill: Node | null = null;
    private hudTextRefreshTimer = 0;
    private lastHudPhase: GamePhase | null = null;

    private shop = new EquipmentManager(this as unknown as ShopHostContext);
    private weaponCooldowns: Record<string, number> = {};

    private enemyMgr = new EnemyManager(this as unknown as EnemyHostContext);
    private proj = new ProjectileManager(this as unknown as ProjectileHostContext);
    private pickupMgr = new PickupManager(this as unknown as PickupHostContext);
    private offhandMgr = new OffhandManager(this as unknown as OffhandHostContext);
    private botAI = new BotAIController(this as unknown as BotAIHost);
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
        // Dynamic popups must live under Canvas; otherwise Cocos preview can
        // block input with the popup container while rendering no popup content.
        uiMgr.init(this.canvasNode || this.node);
        this.shop.loadProgress();
        this.buildScene();
        // Keep first paint deterministic in Cocos preview/mobile WebView: the
        // main menu must be visible before non-critical async systems (audio/art)
        // can stall or abort startup on preview/mobile runtimes.
        this.openHome();
        try {
            this.audio.initAudio();
        } catch (error) {
            console.warn('Audio init failed; continuing with muted startup.', error);
        }
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
        this.destroyTransientGraphicsPools();
    }

    update(dt: number) {
        const frameStart = this.perfNow();
        this.resetPerfCounters();

        let t = this.perfNow();
        this.updateToast(dt);
        this.audio.updateSfxCooldowns(dt);
        this.audio.updateBgmFade(dt);
        this.pickupMgr.updateFloatingTexts(dt);
        this.updateTransientGraphics(dt);
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
            if (this.botAIEnabled) {
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
            this.offhandMgr.tick(combatDt);
            this.resolvePlayerAfterEnemyMovement();
            this.perfEnemyMs = this.perfNow() - t;

            t = this.perfNow();
            this.pickupMgr.updatePickups(combatDt);
            this.updateRegen(combatDt);
            this.updateShield(combatDt);
            this.perfPickupMs = this.perfNow() - t;

            this.proj.updateEffectPools(combatDt);
            this.enemyMgr.drawAllBars(combatDt);
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

        this.keepWorldVfxLayerOnTop();
        t = this.perfNow();
        this.updateHud(dt);
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
        this.offhandMgr.init(this.worldNode);
        this.enemyMgr.initBarLayer(this.worldNode);
        this.enemyMgr.initGroundMarkPool(this.worldNode);
        this.enemyMgr.initDeathParticlePool(this.worldNode);
        this.worldNode.setPosition(0, 0, 0);
        this.drawWorldArena(this.worldNode);
        this.initTransientGraphicsPools();

        this.buildHud(root);
        this.buildVfxOverlay(root);
        this.buildHangarPanel(root);
        this.buildOffhandPanel(root);
        this.buildForgePanel(root);
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

    private saveProgress(): void {
        this.shop.saveProgress();
    }

    private showHangar(message: string): void {
        this.shop.showHangar(message);
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
            drawButtonView(this.panels.bgmToggleButton, false);
        }
        if (this.panels.sfxToggleButton) {
            this.panels.sfxToggleButton.label.string = this.audio.sfxVolume > 0 ? '关闭音效' : '开启音效';
            drawButtonView(this.panels.sfxToggleButton, false);
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
        makeRect(root, 'DeepSpaceBase', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, '#10294A');
        makeRect(root, 'NebulaBandTop', 0, 0, DESIGN_WIDTH, 250, '#1E3A5F');
        makeRect(root, 'NebulaBandBottom', 0, 1060, DESIGN_WIDTH, 220, '#2A1748');

        const sky = new Node('StaticStarSky');
        sky.layer = Layers.Enum.UI_2D;
        root.addChild(sky);
        sky.setPosition(0, 0, 1);
        sky.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        const gfx = sky.addComponent(Graphics);

        gfx.fillColor = hex('#4CC9F0', 75);
        for (let i = 0; i < 86; i++) {
            const x = 18 + ((i * 83) % (DESIGN_WIDTH - 36));
            const y = 18 + ((i * 137) % (DESIGN_HEIGHT - 36));
            const r = 1 + (i % 3) * 0.7;
            gfx.circle(x, y, r);
            gfx.fill();
        }

        gfx.fillColor = hex('#B5179E', 42);
        gfx.circle(610, 166, 82);
        gfx.fill();
        gfx.fillColor = hex('#F9C74F', 70);
        gfx.circle(616, 160, 38);
        gfx.fill();
        gfx.strokeColor = hex('#F8FAFC', 52);
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

        floorGfx.fillColor = hex('#254A66');
        floorGfx.roundRect(WORLD_LEFT, WORLD_BOTTOM, WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM, 52);
        floorGfx.fill();
        floorGfx.fillColor = hex('#3B6D86', 210);
        floorGfx.roundRect(WORLD_LEFT + 120, WORLD_BOTTOM + 150, WORLD_RIGHT - WORLD_LEFT - 240, WORLD_TOP - WORLD_BOTTOM - 300, 180);
        floorGfx.fill();
        floorGfx.fillColor = hex('#2E4A63', 120);
        floorGfx.circle(-1260, -920, 1280);
        floorGfx.fill();
        floorGfx.fillColor = hex('#4CC9F0', 34);
        floorGfx.circle(-1260, -920, 1540);
        floorGfx.fill();
        floorGfx.fillColor = hex('#020617', 80);
        floorGfx.circle(1720, 1280, 1120);
        floorGfx.fill();

        floorGfx.strokeColor = hex('#4CC9F0', 115);
        floorGfx.lineWidth = 5;
        floorGfx.roundRect(WORLD_LEFT + 42, WORLD_BOTTOM + 42, WORLD_RIGHT - WORLD_LEFT - 84, WORLD_TOP - WORLD_BOTTOM - 84, 42);
        floorGfx.stroke();
        floorGfx.strokeColor = hex('#7DD3FC', 42);
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

        floorGfx.strokeColor = hex('#F9C74F', 105);
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

        floorGfx.fillColor = hex('#07111F', 96);
        floorGfx.strokeColor = hex('#7DD3FC', 60);
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

        floorGfx.fillColor = hex('#94A3B8', 92);
        for (let i = 0; i < 62; i++) {
            const x = WORLD_LEFT + 220 + (i % 10) * 500 + ((i * 97) % 155);
            const y = WORLD_BOTTOM + 260 + Math.floor(i / 10) * 690 + ((i * 53) % 190);
            floorGfx.roundRect(x - 36, y - 9, 72, 18, 8);
            floorGfx.fill();
        }

        floorGfx.strokeColor = hex('#F8FAFC', 80);
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
        const hud = new Node('CombatHud');
        hud.layer = Layers.Enum.UI_2D;
        hud.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        root.addChild(hud);
        this.combatHudRoot = hud;

        const HUD_H = 112;
        const hudY = DESIGN_HEIGHT - UI_SAFE_TOP - HUD_H;
        const HP_BAR_H = 24;
        const HP_FILL_H = 20;
        const XP_BAR_H = 18;
        const XP_FILL_H = 14;

        // Top HUD — mobile readable at 720×1280.
        makeRect(hud, 'HudShadow', 14, hudY + 6, 692, HUD_H, RogueShooterGame.UI.panelShadow, 14);
        makeRect(hud, 'HudPanel', 10, hudY, 700, HUD_H, RogueShooterGame.UI.hudBg, 14, RogueShooterGame.UI.hudBorder);
        makeRect(hud, 'HudAccent', 14, hudY + 8, 4, HUD_H - 16, RogueShooterGame.UI.hudAccent, 2);
        this.panels.titleLabel = makeLabel(hud, 'Title', '星坠幸存者', 26, hudY + 76, 360, 30, 20, RogueShooterGame.UI.title, Label.HorizontalAlign.LEFT);
        this.panels.timerLabel = makeLabel(hud, 'Timer', '', 420, hudY + 76, 274, 30, 20, RogueShooterGame.UI.cyanText, Label.HorizontalAlign.RIGHT);

        const hpX = 26;
        const hpY = hudY + 46;
        const hpW = 668;
        makeRect(hud, 'HpBarBg', hpX, hpY, hpW, HP_BAR_H, RogueShooterGame.UI.hpBarBg, 12, '#334155');
        const hpFillNode = new Node('HpBarFill');
        hpFillNode.layer = Layers.Enum.UI_2D;
        hud.addChild(hpFillNode);
        place(hpFillNode, hpX + 2, hpY + HP_BAR_H / 2);
        const hpFillUt = hpFillNode.addComponent(UITransform);
        hpFillUt.setAnchorPoint(0, 0.5);
        hpFillUt.setContentSize(hpW - 4, HP_FILL_H);
        applySlicedSprite(hpFillNode, 'effects/hud_bar_hp/spriteFrame');
        this._hpBarFill = hpFillNode;
        makeLabel(hud, 'HpLabel', 'HP', hpX + 10, hpY, 54, HP_BAR_H, 18, '#FFFFFF', Label.HorizontalAlign.LEFT);

        const halfW = 326;
        const lowerY = hudY + 10;
        makeRect(hud, 'XpBarBg', 26, lowerY, halfW, XP_BAR_H, RogueShooterGame.UI.xpBarBg, 9, '#334155');
        const xpFillNode = new Node('XpBarFill');
        xpFillNode.layer = Layers.Enum.UI_2D;
        hud.addChild(xpFillNode);
        place(xpFillNode, 28, lowerY + XP_BAR_H / 2);
        const xpFillUt = xpFillNode.addComponent(UITransform);
        xpFillUt.setAnchorPoint(0, 0.5);
        xpFillUt.setContentSize(halfW - 4, XP_FILL_H);
        applySlicedSprite(xpFillNode, 'effects/hud_bar_xp/spriteFrame');
        this._xpBarFill = xpFillNode;
        makeLabel(hud, 'XpLabel', 'XP', 36, lowerY, 44, XP_BAR_H, 14, '#FFFFFF', Label.HorizontalAlign.LEFT);

        makeRect(hud, 'ShieldBarBg', 368, lowerY, halfW, XP_BAR_H, RogueShooterGame.UI.hpBarBg, 9, '#334155');
        const shieldFillNode = new Node('ShieldBarFill');
        shieldFillNode.layer = Layers.Enum.UI_2D;
        hud.addChild(shieldFillNode);
        place(shieldFillNode, 370, lowerY + XP_BAR_H / 2);
        const shieldFillUt = shieldFillNode.addComponent(UITransform);
        shieldFillUt.setAnchorPoint(0, 0.5);
        shieldFillUt.setContentSize(halfW - 4, XP_FILL_H);
        applySlicedSprite(shieldFillNode, 'effects/hud_bar_shield/spriteFrame');
        this._shieldBarFill = shieldFillNode;
        makeLabel(hud, 'ShieldLabel', '护盾', 378, lowerY, 58, XP_BAR_H, 14, '#FFFFFF', Label.HorizontalAlign.LEFT);
        this.panels.debugLabel = makeLabel(hud, 'DebugHud', '', 54, hudY - 24, 612, 16, 11, '#64748B', Label.HorizontalAlign.LEFT);
        this.panels.debugLabel.node.active = false;

        // Bottom HUD — 68px touch targets and three readable info rows.
        const BOT_H = 76;
        const BOT_Y = UI_SAFE_BOTTOM;
        makeRect(hud, 'BottomBarShadow', 14, BOT_Y + 4, 692, BOT_H, RogueShooterGame.UI.panelShadow, 14);
        makeRect(hud, 'BottomBar', 10, BOT_Y, 700, BOT_H, RogueShooterGame.UI.hudBg, 14, RogueShooterGame.UI.hudBorder);
        this.panels.equipmentLabel = makeLabel(hud, 'EquipmentLabel', '', 18, BOT_Y + 48, 406, 24, 18, RogueShooterGame.UI.title, Label.HorizontalAlign.LEFT);
        this.panels.statLabel = makeLabel(hud, 'StatInfo', '', 18, BOT_Y + 22, 406, 24, 19, RogueShooterGame.UI.alloyOrange, Label.HorizontalAlign.LEFT);
        this.panels.buffLabel = makeLabel(hud, 'BuffLabel', '', 18, BOT_Y + 4, 406, 16, 13, '#F97316', Label.HorizontalAlign.LEFT);

        const BTN_W = 82;
        const BTN_H = 68;
        const BTN_GAP = 6;
        const btnStartX = 720 - 20 - BTN_W * 3 - BTN_GAP * 2;
        this.panels.shopButton = makeButton(hud, 'ShopBtn', btnStartX, BOT_Y + 4, BTN_W, BTN_H, '#22D3EE', '#475569', () => this.shop.openShop());
        this.panels.shopButton.label.string = '商店';
        this.panels.extractButton = makeButton(hud, 'ExtractBtn', btnStartX + (BTN_W + BTN_GAP), BOT_Y + 4, BTN_W, BTN_H, '#F59E0B', '#475569', () => this.extractBattle());
        this.panels.extractButton.label.string = '撤离';
        this.panels.pauseButton = makeButton(hud, 'PauseBtn', btnStartX + (BTN_W + BTN_GAP) * 2, BOT_Y + 4, BTN_W, BTN_H, '#475569', '#475569', () => this.pauseCombat());
        this.panels.pauseButton.label.string = '暂停';
        this.panels.setCombatHudControlsActive(false);

        const toastTop = BOT_Y + BOT_H + 20;
        // Toasts remain above both the hangar and combat HUD so equipment,
        // synthesis, and battle actions all receive immediate feedback.
        this.toastPanelShadowNode = makeRect(root, 'ToastShadow', 46, toastTop + 6, 628, 54, RogueShooterGame.UI.panelShadow, 12);
        this.toastPanelNode = makeRect(root, 'ToastPanel', 36, toastTop, 648, 58, RogueShooterGame.UI.panelBg, 12, RogueShooterGame.UI.panelBorder);
        this.panels.toastLabel = makeLabel(root, 'Toast', '', 50, toastTop + 4, 620, 50, 20, RogueShooterGame.UI.title);
        this.toastPanelShadowNode.active = false;
        this.toastPanelNode.active = false;
        this.panels.toastLabel.node.active = false;
        hud.active = false;
    }

    // level panel → ChoicePopup
    // shop panel  → ShopPopup

    private buildHangarPanel(root: Node) {
        this.panels.hangarPanelShadow = makeRect(root, 'HangarPanelShadow', 36, 196, 648, 936, RogueShooterGame.UI.panelShadow, 24);
        this.panels.hangarPanelShadow.active = false;
        const panel = this.spritePanel(root, 'HangarPanel', 24, 184, 672, 936);
        panel.active = false;
        this.panels.hangarPanel = panel;

        this.panels.hangarTitleLabel = makeLabel(panel, 'HangarTitle', '', 124, 24, 424, 52, 30, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.hangarBackButton = makeButton(panel, 'HangarBackHome', 30, 28, 92, MIN_TOUCH_BUTTON_HEIGHT, '#64748B', '#94A3B8', () => this.openMainMenu(), true);
        this.panels.hangarBackButton.label.string = '首页';
        this.panels.hangarStatsLabel = makeLabel(panel, 'HangarStats', '', 46, 82, 580, 46, 17, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.panels.hangarTipLabel = makeLabel(panel, 'HangarTip', '', 46, 834, 580, 16, 14, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);

        // ── 配装区域：一把主武器与一把副武器同时生效 ──
        this.panels.loadoutWeaponButtons.push(makeButton(panel, 'LoadoutMainWeapon', 46, 146, 280, 76, '#22D3EE', '#1E293B', () => this.shop.selectEquippedSlot(0), true));
        this.panels.offhandLoadoutButton = makeButton(panel, 'LoadoutOffhand', 346, 146, 280, 76, '#F97316', '#1E293B', () => this.openOffhandPanel(), true);
        for (let i = 0; i < MAX_EQUIPPED_GEAR; i++) {
            const gx = 46 + i * 145;
            this.panels.gearLoadoutButtons.push(makeButton(panel, `LoadoutGear_${i}`, gx, 236, 130, 52, '#1E293B', '#0F172A', () => this.shop.selectEquippedSlot(1 + i), true));
        }

        // ── 标签栏 ──
        this.panels.hangarTabButtons.push(makeButton(panel, 'HangarTabWeapon', 46, 310, 128, 46, '#1E293B', '#0F172A', () => this.shop.changeHangarTab('weapon' as any), true));
        this.panels.hangarTabButtons[0].label.string = '武器';
        this.panels.hangarTabButtons.push(makeButton(panel, 'HangarTabOffhand', 186, 310, 128, 46, '#1E293B', '#0F172A', () => this.openOffhandPanel(), true));
        this.panels.hangarTabButtons[1].label.string = '副武器';
        this.panels.hangarTabButtons.push(makeButton(panel, 'HangarTabGear', 326, 310, 128, 46, '#1E293B', '#0F172A', () => this.shop.changeHangarTab('gear' as any), true));
        this.panels.hangarTabButtons[2].label.string = '装备';
        this.panels.hangarTabButtons.push(makeButton(panel, 'HangarTabForge', 466, 310, 160, 46, '#1E293B', '#0F172A', () => this.openForgePanel(), true));
        this.panels.hangarTabButtons[3].label.string = '传说熔炉';

        for (let i = 0; i < 3; i++) {
            const button = makeButton(panel, `LootChoice_${i}`, 58, 208 + i * 92, 556, 76, '#F8961E', '#94A3B8', () => this.pickupMgr.chooseLoot(i), true);
            this.panels.lootButtons.push(button);
        }

        this.panels.equipmentDetailLabel = makeLabel(panel, 'EquipmentDetail', '', 46, 366, 580, 88, 16, RogueShooterGame.UI.body, Label.HorizontalAlign.LEFT, true);

        for (let i = 0; i < HANGAR_EQUIPMENT_SLOTS; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const button = makeButton(
                panel,
                `EquipmentSlot_${i}`,
                46 + col * 198,
                468 + row * 78,
                184,
                68,
                '#4CC9F0',
                '#94A3B8',
                () => this.shop.selectVisibleEquipment(i),
                true,
            );
            this.panels.equipmentButtons.push(button);
        }

        this.panels.prevEquipmentButton = makeButton(panel, 'EquipmentPrev', 46, 700, 96, 54, '#64748B', '#94A3B8', () => this.shop.changeEquipmentPage(-1), true);
        this.panels.prevEquipmentButton.label.string = '上一页';
        this.panels.equipActionButton = makeButton(panel, 'EquipAction', 154, 700, 186, 54, '#4CC9F0', '#94A3B8', () => this.shop.toggleSelectedEquipment(), true);
        this.panels.upgradeActionButton = makeButton(panel, 'UpgradeAction', 352, 700, 186, 54, '#F8961E', '#94A3B8', () => this.shop.upgradeSelectedEquipment(), true);
        this.panels.nextEquipmentButton = makeButton(panel, 'EquipmentNext', 550, 700, 76, 54, '#64748B', '#94A3B8', () => this.shop.changeEquipmentPage(1), true);
        this.panels.nextEquipmentButton.label.string = '下一页';

        // ── Pre-battle buff button (below action buttons) ──
        this.panels.preBuffLabel = makeLabel(panel, 'PreBuffLabel', '', 46, 766, 580, 24, 16, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);
        this.panels.preBuffButton = makeButton(panel, 'PreBuffButton', 174, 790, 324, 44, '#F8961E', '#94A3B8', () => this.requestPreBattleBuff(), true);
        this.panels.preBuffButton.label.string = '获取增益';

        this.panels.startButton = makeButton(panel, 'StartBattle', 174, 850, 324, 58, '#43AA8B', '#94A3B8', () => this.beginBattle(false), true);

        // ── Extract reward double button (hidden by default) ──
        this.panels.extractDoubleButton = makeButton(panel, 'ExtractDoubleButton', 174, 650, 324, 42, '#F9C74F', '#94A3B8', () => this.requestExtractDouble(), true);
        this.panels.extractDoubleButton.node.active = false;
        this.panels.extractDoubleButton.label.string = '看视频双倍领取';
    }

    private buildOffhandPanel(root: Node) {
        const CARD_W = 184;
        const CARD_H = 78;
        this.panels.offhandPanelShadow = makeRect(root, 'OffhandPanelShadow', 36, 196, 648, 936, RogueShooterGame.UI.panelShadow, 24);
        this.panels.offhandPanelShadow.active = false;
        const panel = this.spritePanel(root, 'OffhandPanel', 24, 184, 672, 936);
        panel.active = false;
        this.panels.offhandPanel = panel;
        this.panels.offhandTitleLabel = makeLabel(panel, 'OffhandTitle', '副武器', 122, 24, 430, 48, 28, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.offhandResourceLabel = makeLabel(panel, 'OffhandResource', '', 48, 80, 576, 28, 16, RogueShooterGame.UI.goldText, Label.HorizontalAlign.CENTER, true);
        for (let i = 0; i < OFFHAND_CATALOG.length; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const button = makeButton(panel, `OffhandCard_${i}`, 46 + col * 198, 124 + row * 84, CARD_W, CARD_H, '#F97316', '#1E293B', () => this.selectOffhand(i), true);
            this.panels.offhandListButtons.push(button);
        }
        this.panels.offhandDetailLabel = makeLabel(panel, 'OffhandDetail', '', 46, 562, 580, 108, 17, RogueShooterGame.UI.body, Label.HorizontalAlign.LEFT, true);
        this.panels.offhandSynthesizeButton = makeButton(panel, 'OffhandSynthesize', 46, 688, 180, 54, '#F8961E', '#94A3B8', () => this.synthesizeSelectedOffhand(), true);
        this.panels.offhandEquipButton = makeButton(panel, 'OffhandEquip', 246, 688, 180, 54, '#22D3EE', '#94A3B8', () => this.toggleSelectedOffhandEquip(), true);
        this.panels.offhandUpgradeButton = makeButton(panel, 'OffhandUpgrade', 446, 688, 180, 54, '#B5179E', '#94A3B8', () => this.upgradeSelectedOffhand(), true);
        this.panels.offhandBackButton = makeButton(panel, 'OffhandBack', 174, 776, 324, 56, '#64748B', '#94A3B8', () => this.closeOffhandPanel(), true);
        this.panels.offhandBackButton.label.string = '返回机库';
    }

    private openOffhandPanel(): void {
        this.panels.hideAllOverlays();
        if (this.panels.offhandPanel) this.panels.offhandPanel.active = true;
        if (this.panels.offhandPanelShadow) this.panels.offhandPanelShadow.active = true;
        this.renderOffhandPanel();
    }

    private selectOffhand(index: number): void {
        const def = OFFHAND_CATALOG[index];
        if (!def) return;
        this.selectedOffhandId = def.id;
        this.renderOffhandPanel();
    }

    private renderOffhandPanel(): void {
        const selected = findOffhand(this.selectedOffhandId) || OFFHAND_CATALOG[0];
        if (!selected) return;
        this.selectedOffhandId = selected.id;
        const owned = this.shop.hasOffhand(selected.id);
        const equipped = this.shop.getEquippedOffhandId() === selected.id;
        const level = owned ? this.shop.getOffhandLevel(selected.id) : 0;

        if (this.panels.offhandResourceLabel) {
            const ownedCount = OFFHAND_CATALOG.filter((def) => this.shop.hasOffhand(def.id)).length;
            this.panels.offhandResourceLabel.string = `合金 ${this.cs.alloy}  ·  已解锁 ${ownedCount}/${OFFHAND_CATALOG.length}  ·  战斗内与主武器同时生效`;
        }
        this.panels.offhandListButtons.forEach((button, index) => {
            const def = OFFHAND_CATALOG[index];
            if (!def) {
                button.node.active = false;
                return;
            }
            const has = this.shop.hasOffhand(def.id);
            const isEquipped = this.shop.getEquippedOffhandId() === def.id;
            const isSelected = def.id === selected.id;
            button.node.active = true;
            button.color = isSelected ? def.color : has ? '#1E3A4E' : '#334155';
            button.label.string = `${def.name}\n${has ? `T${this.shop.getOffhandLevel(def.id)}${isEquipped ? ' · 已装备' : ' · 已拥有'}` : `合成 ${def.recipeAlloy} 合金`}`;
            drawButtonView(button, false);
            this.setButtonIcon(button, def.iconKey);
        });

        if (this.panels.offhandDetailLabel) {
            const upgrade = owned ? this.shop.getOffhandUpgradeCost(selected.id, level + 1) : null;
            const state = !owned
                ? `尚未合成 · 需要 ${selected.recipeAlloy} 合金`
                : level >= 5
                    ? '已达到 T5 满级'
                    : `下一阶 T${level + 1} · ${upgrade?.alloy ?? 0} 合金`;
            this.panels.offhandDetailLabel.string = `${selected.name}  ·  ${this.getOffhandCategoryLabel(selected.category)}\n${selected.desc}\n${state}`;
        }
        if (this.panels.offhandSynthesizeButton) {
            this.panels.offhandSynthesizeButton.label.string = owned ? '已合成' : `合成 ${selected.recipeAlloy}`;
            drawButtonView(this.panels.offhandSynthesizeButton, owned || this.cs.alloy < selected.recipeAlloy);
        }
        if (this.panels.offhandEquipButton) {
            this.panels.offhandEquipButton.label.string = equipped ? '卸下副武器' : '装备副武器';
            drawButtonView(this.panels.offhandEquipButton, !owned);
        }
        if (this.panels.offhandUpgradeButton) {
            const upgrade = owned ? this.shop.getOffhandUpgradeCost(selected.id, level + 1) : null;
            this.panels.offhandUpgradeButton.label.string = level >= 5 ? '已满级' : `升级 ${upgrade?.alloy ?? '--'}`;
            drawButtonView(this.panels.offhandUpgradeButton, !upgrade || this.cs.alloy < (upgrade?.alloy ?? 0));
        }
    }

    private synthesizeSelectedOffhand(): void {
        const selected = findOffhand(this.selectedOffhandId);
        if (!selected || this.shop.hasOffhand(selected.id)) return;
        if (!this.shop.synthesizeOffhand(selected.id)) {
            this.showToast(`合金不足，需要 ${selected.recipeAlloy}。`);
            return;
        }
        this.showToast(`副武器合成完成：${selected.name}`);
        this.shop.refreshEquipmentButtons();
        this.refreshHud();
        this.renderOffhandPanel();
    }

    private toggleSelectedOffhandEquip(): void {
        const selected = findOffhand(this.selectedOffhandId);
        if (!selected || !this.shop.hasOffhand(selected.id)) return;
        const next = this.shop.getEquippedOffhandId() === selected.id ? null : selected.id;
        this.shop.equipOffhand(next);
        this.showToast(next ? `已装备副武器：${selected.name}` : '已卸下副武器。');
        this.shop.refreshEquipmentButtons();
        this.refreshHud();
        this.renderOffhandPanel();
    }

    private upgradeSelectedOffhand(): void {
        const selected = findOffhand(this.selectedOffhandId);
        if (!selected || !this.shop.hasOffhand(selected.id)) return;
        if (!this.shop.upgradeOffhand(selected.id)) {
            this.showToast('材料或合金不足，暂时无法升级。');
            return;
        }
        this.showToast(`${selected.name} 升至 T${this.shop.getOffhandLevel(selected.id)}。`);
        this.shop.refreshEquipmentButtons();
        this.refreshHud();
        this.renderOffhandPanel();
    }

    private getOffhandCategoryLabel(category: string): string {
        const labels: Record<string, string> = { orbit: '环绕', summon: '召唤', control: '控场', burst: '爆发', support: '防御/辅助' };
        return labels[category] || '协同';
    }

    private closeOffhandPanel(): void {
        if (this.panels.offhandPanel) this.panels.offhandPanel.active = false;
        if (this.panels.offhandPanelShadow) this.panels.offhandPanelShadow.active = false;
        if (this.panels.hangarPanel) this.panels.hangarPanel.active = true;
        if (this.panels.hangarPanelShadow) this.panels.hangarPanelShadow.active = true;
        this.shop.refreshEquipmentButtons();
    }

    private buildForgePanel(root: Node) {
        this.panels.forgePanelShadow = makeRect(root, 'ForgePanelShadow', 36, 196, 648, 936, RogueShooterGame.UI.panelShadow, 24);
        this.panels.forgePanelShadow.active = false;
        const panel = this.spritePanel(root, 'ForgePanel', 24, 184, 672, 936);
        panel.active = false;
        this.panels.forgePanel = panel;
        this.panels.forgeTitleLabel = makeLabel(panel, 'ForgeTitle', '传说熔炉', 120, 24, 432, 48, 28, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.forgeResourceLabel = makeLabel(panel, 'ForgeResource', '', 46, 84, 580, 34, 16, RogueShooterGame.UI.goldText, Label.HorizontalAlign.CENTER, true);
        for (let i = 0; i < 3; i++) {
            const button = makeButton(panel, `ForgeRecipe_${i}`, 46, 138 + i * 174, 580, 156, '#B5179E', '#94A3B8', () => this.synthesizeLegendaryFromCard(i), true);
            this.panels.forgeRecipeButtons.push(button);
        }
        this.panels.forgeBackButton = makeButton(panel, 'ForgeBack', 174, 760, 324, 56, '#64748B', '#94A3B8', () => this.closeForgePanel(), true);
        this.panels.forgeBackButton.label.string = '返回机库';
    }

    private openForgePanel(): void {
        this.panels.hideAllOverlays();
        if (this.panels.forgePanel) this.panels.forgePanel.active = true;
        if (this.panels.forgePanelShadow) this.panels.forgePanelShadow.active = true;
        this.renderForgePanel();
    }

    private renderForgePanel(): void {
        const recipes = this.shop.getLegendaryRecipes();
        if (this.panels.forgeResourceLabel) {
            this.panels.forgeResourceLabel.string = `合金 ${this.cs.alloy}  ·  虚空碎片 ${this.cs.voidFragment}  ·  霜核 ${this.cs.frostCore}  ·  蜘蛛丝 ${this.cs.webSilk}`;
        }
        this.panels.forgeRecipeButtons.forEach((button, index) => {
            const recipe = recipes[index];
            if (!recipe) {
                button.node.active = false;
                return;
            }
            const available = (this.cs as unknown as Record<string, number>)[recipe.material] || 0;
            const affordable = !recipe.owned && available >= recipe.materialQty && this.cs.alloy >= recipe.alloy;
            const materialName = this.getForgeMaterialLabel(recipe.material);
            button.node.active = true;
            button.color = recipe.owned ? '#334155' : affordable ? '#B5179E' : '#5B244D';
            button.label.string = `${recipe.name}${recipe.owned ? ' · 已拥有' : ''}\n${recipe.desc}\n需要 ${recipe.materialQty} ${materialName} · ${recipe.alloy} 合金`;
            drawButtonView(button, recipe.owned || !affordable);
            this.setButtonIcon(button, `wpn_${recipe.id.replace(/-/g, '_')}`);
        });
    }

    private synthesizeLegendaryFromCard(index: number): void {
        const recipe = this.shop.getLegendaryRecipes()[index];
        if (!recipe || recipe.owned) return;
        if (!this.shop.synthesizeLegendary(recipe.id)) {
            this.showToast(`材料不足：需要 ${recipe.materialQty} ${this.getForgeMaterialLabel(recipe.material)} 和 ${recipe.alloy} 合金。`);
            return;
        }
        this.showToast(`传说武器合成完成：${recipe.name}`);
        this.shop.refreshEquipmentButtons();
        this.refreshHud();
        this.renderForgePanel();
    }

    private getForgeMaterialLabel(material: string): string {
        const labels: Record<string, string> = {
            voidFragment: '虚空碎片',
            frostCore: '霜核',
            webSilk: '蜘蛛丝',
            energyCore: '能量核心',
            infernoCore: '狱炎核心',
        };
        return labels[material] || material;
    }

    private closeForgePanel(): void {
        if (this.panels.forgePanel) this.panels.forgePanel.active = false;
        if (this.panels.forgePanelShadow) this.panels.forgePanelShadow.active = false;
        if (this.panels.hangarPanel) this.panels.hangarPanel.active = true;
        if (this.panels.hangarPanelShadow) this.panels.hangarPanelShadow.active = true;
        this.shop.refreshEquipmentButtons();
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

    private async showRevivePanel(): Promise<void> {
        if (this.revived) return;
        if (this.cs.phase !== 'combat') return;
        this.revived = true;
        this.cs.phase = 'paused';
        const result = await uiMgr.showDynamicPopupAsync(() => {
            const node = new Node('RevivePopup');
            node.addComponent(RevivePopup).setup({
                bossKills: this.cs.bossKills,
                remainingRevives: AdManager.getReviveRemaining(),
                onWatch: () => this.reviveFromAd().then((ok) => ok ? 'revived' : 'decline'),
                onDecline: () => 'decline',
            });
            return node;
        }, 'RevivePopup');
        if (result === 'decline') this.declineRevive();
    }

    private reviveFromAd(): Promise<boolean> {
        return new Promise((resolve) => {
            if (!AdManager.canReviveToday()) {
                this.showToast('今日复活次数已用完。');
                resolve(false);
                return;
            }
            AdManager.playRewardedAd((result) => {
                if (!result.success) {
                    this.showToast(result.reason || '广告播放失败，请重试。');
                    resolve(false);
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
                resolve(true);
            });
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
        // HUD bar textures
        resources.load('effects/hud_bar_hp/spriteFrame', SpriteFrame, () => {});
        resources.load('effects/hud_bar_hp_bg/spriteFrame', SpriteFrame, () => {});
        resources.load('effects/hud_bar_xp/spriteFrame', SpriteFrame, () => {});
        resources.load('effects/hud_bar_xp_bg/spriteFrame', SpriteFrame, () => {});
        resources.load('effects/hud_bar_shield/spriteFrame', SpriteFrame, () => {});
        resources.load('effects/hud_bar_shield_bg/spriteFrame', SpriteFrame, () => {});
        this.loadIcons();
    }

    private loadIcons(): void {
        const names = [
            'wpn_storm_rifle','wpn_plague_sprayer','wpn_frost_beam','wpn_echo_bow','wpn_split_barrel','wpn_mirror_prism','wpn_quantum_loom',
            'wpn_ion_lance','wpn_thorn_crossbow','wpn_rail_cannon','wpn_void_needle','wpn_meteor_launcher','wpn_orbital_drone','wpn_gravity_hammer',
            'wpn_void_tearer','wpn_icefire_judge',
            'stat_attack_power','stat_attack_speed','stat_crit_chance','stat_crit_damage',
            'stat_defense','stat_fire_def','stat_ice_def','stat_lightning_def','stat_lethal_chance','stat_lethal_damage',
            'slot_helmet','slot_armor','slot_boots','slot_accessory',
            'resource_alloy','resource_core','resource_shard','resource_biomass',
            'dmg_fire','dmg_ice','dmg_lightning','dmg_poison','dmg_physical','dmg_magic','stat_shield','stat_hp',
            'hud_icon_alloy','hud_icon_hp','hud_icon_xp','hud_icon_shield',
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

    private setButtonIcon(button: ButtonView, iconKey: string): void {
        const frame = this.getIcon(iconKey);
        const nodeName = `${button.node.name}_Icon`;
        let iconNode = button.node.getChildByName(nodeName);
        if (!frame) {
            if (iconNode) iconNode.active = false;
            return;
        }
        if (!iconNode) {
            iconNode = new Node(nodeName);
            iconNode.layer = Layers.Enum.UI_2D;
            iconNode.addComponent(UITransform).setContentSize(Math.min(30, button.height - 20), Math.min(30, button.height - 20));
            const sprite = iconNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            button.node.addChild(iconNode);
        }
        const sprite = iconNode.getComponent(Sprite);
        if (sprite) sprite.spriteFrame = frame;
        iconNode.setPosition(-button.width / 2 + 24, 0, 2);
        iconNode.active = true;
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
                placeLocal(iconNode, x + iconSize/2, y + h/2, pt?.width ?? w, pt?.height ?? h);
            } else {
                place(iconNode, x + iconSize/2, y + h/2);
            }
            const it = iconNode.addComponent(UITransform);
            it.setContentSize(iconSize, iconSize);
            const sp = iconNode.addComponent(Sprite);
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        return makeLabel(parent, name, text, x + (sf ? iconSize + 8 : 0), y, w - (sf ? iconSize + 8 : 0), h, fontSize, color, hAlign, local);
    }

    private spritePanel(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        place(node, x + width / 2, y + height / 2);
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
        gfx.fillColor = hex(RogueShooterGame.UI.panelBgDeep, RogueShooterGame.UI.panelAlpha);
        gfx.roundRect(-width / 2, -height / 2, width, height, radius);
        gfx.fill();
        // Lifted inner surface
        gfx.fillColor = hex(RogueShooterGame.UI.panelBg, 238);
        gfx.roundRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, Math.max(10, radius - 6));
        gfx.fill();
        // Top glass sheen
        gfx.fillColor = hex(RogueShooterGame.UI.panelBgLift, 118);
        gfx.roundRect(-width / 2 + 10, height / 2 - Math.min(96, height * 0.26), width - 20, Math.min(80, height * 0.22), Math.max(8, radius - 10));
        gfx.fill();
        // Subtle bottom vignette for depth
        gfx.fillColor = hex(RogueShooterGame.UI.glassLowlight, 156);
        gfx.roundRect(-width / 2 + 10, -height / 2 + 10, width - 20, Math.min(110, height * 0.24), Math.max(8, radius - 10));
        gfx.fill();
        // Thin frame
        gfx.strokeColor = hex(borderColor, 190);
        gfx.lineWidth = 1.5;
        gfx.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius);
        gfx.stroke();
        gfx.strokeColor = hex(RogueShooterGame.UI.glassHighlight, 72);
        gfx.lineWidth = 1;
        gfx.roundRect(-width / 2 + 8, -height / 2 + 8, width - 16, height - 16, Math.max(8, radius - 8));
        gfx.stroke();
        // Starship corner brackets
        const corner = Math.min(46, Math.max(24, Math.min(width, height) * 0.12));
        const inset = 15;
        gfx.strokeColor = hex(accentColor, 210);
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
        placeLocal(node, x + width / 2, y + height / 2, parentTransform?.width ?? width, parentTransform?.height ?? height);
        node.addComponent(UITransform).setContentSize(width, height);
        return node.addComponent(Graphics);
    }

    private addTechDivider(parent: Node, name: string, x: number, y: number, width: number, color: string = RogueShooterGame.UI.neonCyan): void {
        const gfx = this.addLocalGraphic(parent, name, x, y, width, 18);
        gfx.strokeColor = hex(color, 150);
        gfx.lineWidth = 2;
        gfx.moveTo(-width / 2, 0);
        gfx.lineTo(-width / 2 + width * 0.38, 0);
        gfx.moveTo(width / 2 - width * 0.38, 0);
        gfx.lineTo(width / 2, 0);
        gfx.stroke();
        gfx.fillColor = hex(color, 200);
        gfx.roundRect(-18, -3, 36, 6, 3);
        gfx.fill();
    }

    private drawMenuEmblem(parent: Node): void {
        const gfx = this.addLocalGraphic(parent, 'MenuCommandEmblem', 214, 168, 220, 132);
        gfx.strokeColor = hex(RogueShooterGame.UI.neonCyan, 82);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, 62);
        gfx.stroke();
        gfx.strokeColor = hex(RogueShooterGame.UI.alloyGold, 170);
        gfx.lineWidth = 4;
        gfx.arc(0, 0, 50, Math.PI * 0.08, Math.PI * 0.82, false);
        gfx.stroke();
        gfx.strokeColor = hex(RogueShooterGame.UI.neonCyan, 180);
        gfx.lineWidth = 3;
        gfx.arc(0, 0, 42, Math.PI * 1.05, Math.PI * 1.84, false);
        gfx.stroke();
        gfx.fillColor = hex(RogueShooterGame.UI.sectionBg, 235);
        gfx.circle(0, 0, 34);
        gfx.fill();
        gfx.strokeColor = hex(RogueShooterGame.UI.glassHighlight, 180);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, 34);
        gfx.stroke();
        gfx.fillColor = hex(RogueShooterGame.UI.alloyOrange, 230);
        gfx.moveTo(0, 26);
        gfx.lineTo(19, -22);
        gfx.lineTo(0, -12);
        gfx.lineTo(-19, -22);
        gfx.close();
        gfx.fill();
        gfx.fillColor = hex(RogueShooterGame.UI.neonCyan, 190);
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
                this.vfxOverlay.fillColor = hex('#FFFFFF', Math.round(alpha * 0.35));
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
                this.vfxOverlay.fillColor = hex('#EF4444', Math.round(maxAlpha));
                this.vfxOverlay.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
                this.vfxOverlay.fill();
            }
        }

        // Player hit red flash
        if (this.vfxPlayerHitOverlay > 0) {
            this.vfxPlayerHitOverlay -= dt;
            const a = Math.round(this.vfxPlayerHitOverlay / 0.3 * 180);
            if (a > 5) {
                this.vfxOverlay.fillColor = hex('#EF4444', Math.min(a, 80));
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
                this.vfxOverlay.strokeColor = hex('#22C55E', a);
                this.vfxOverlay.lineWidth = 6;
                this.vfxOverlay.circle(0, 0, radius);
                this.vfxOverlay.stroke();
                this.vfxOverlay.fillColor = hex('#22C55E', Math.round(a * 0.15));
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
                this.vfxOverlay.strokeColor = hex('#F59E0B', a);
                this.vfxOverlay.lineWidth = 5;
                this.vfxOverlay.circle(0, 0, radius);
                this.vfxOverlay.stroke();
            }
        }
    }

    private buildLoadingPanel(root: Node) {
        const panel = makeRect(root, 'LoadingPanel', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, RogueShooterGame.UI.panelBgDeep);
        panel.active = true;
        this.panels.loadingPanel = panel;
        const gfx = panel.getComponent(Graphics);
        if (gfx) {
            // Deep-space gradient impression: layered nebula discs + tactical scan lines.
            gfx.fillColor = hex('#0B2A45', 205);
            gfx.circle(570, 206, 285);
            gfx.fill();
            gfx.fillColor = hex('#391B55', 150);
            gfx.circle(92, 1084, 340);
            gfx.fill();
            gfx.fillColor = hex(RogueShooterGame.UI.alloyOrange, 118);
            gfx.circle(604, 1058, 160);
            gfx.fill();
            gfx.strokeColor = hex(RogueShooterGame.UI.neonCyan, 72);
            gfx.lineWidth = 1;
            for (let y = 160; y < 1120; y += 84) {
                gfx.moveTo(72, y);
                gfx.lineTo(648, y + ((y / 84) % 2 === 0 ? 10 : -10));
            }
            gfx.stroke();
            gfx.strokeColor = hex(RogueShooterGame.UI.alloyGold, 145);
            gfx.lineWidth = 6;
            gfx.circle(360, 596, 158);
            gfx.stroke();
            gfx.strokeColor = hex(RogueShooterGame.UI.neonCyan, 150);
            gfx.lineWidth = 2;
            gfx.circle(360, 596, 204);
            gfx.stroke();
            gfx.fillColor = hex(RogueShooterGame.UI.panelBg, 185);
            gfx.roundRect(118, 522, 484, 172, 28);
            gfx.fill();
            gfx.strokeColor = hex(RogueShooterGame.UI.glassHighlight, 135);
            gfx.lineWidth = 2;
            gfx.roundRect(118, 522, 484, 172, 28);
            gfx.stroke();
        }
        this.panels.loadingTitleLabel = makeLabel(panel, 'LoadingTitle', '星坠幸存者', 70, 426, 580, 72, 56, RogueShooterGame.UI.loadingTitle, Label.HorizontalAlign.CENTER, true);
        makeLabel(panel, 'LoadingSubTitle', '星舰军械库正在点火', 92, 514, 536, 40, 24, RogueShooterGame.UI.loadingSub, Label.HorizontalAlign.CENTER, true);
        this.panels.loadingProgressLabel = makeLabel(panel, 'LoadingProgress', '加载中...', 92, 606, 536, 44, 22, RogueShooterGame.UI.loadingProgress, Label.HorizontalAlign.CENTER, true);
        makeLabel(panel, 'LoadingHint', '提示：升级、买道具、撤离带回资源；撑到 Boss 就有大收益', 76, 1040, 568, 58, 21, RogueShooterGame.UI.loadingHint, Label.HorizontalAlign.CENTER, true);
    }

    private buildMenuPanel(root: Node) {
        this.panels.menuPanelShadow = makeRect(root, 'MenuPanelShadow', 48, 280, 624, 790, RogueShooterGame.UI.panelShadow, 28);
        this.panels.menuPanelShadow.active = false;
        const panel = this.spritePanel(root, 'MenuPanel', 36, 266, 648, 790);
        panel.active = false;
        this.panels.menuPanel = panel;

        makeLabel(panel, 'MenuKicker', 'STARFALL SURVIVOR', 58, 36, 532, 28, 16, RogueShooterGame.UI.cyanText, Label.HorizontalAlign.CENTER, true);
        makeLabel(panel, 'MenuTitle', '星坠幸存者', 50, 64, 548, 72, 50, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.addTechDivider(panel, 'MenuTitleDivider', 96, 140, 456, RogueShooterGame.UI.alloyGold);
        makeLabel(panel, 'MenuSubTitle', '自动开火 · 肉鸽成长 · Boss 撤离 · 激爽割草', 56, 150, 536, 36, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.drawMenuEmblem(panel);
        makeLabel(panel, 'MenuHook', '整备武器，冲入星潮；扛不住就撤，够强就打穿下一波。', 74, 286, 500, 44, 19, RogueShooterGame.UI.goldText, Label.HorizontalAlign.CENTER, true);

        const start = makeButton(panel, 'MenuStart', 118, 350, 412, 66, RogueShooterGame.UI.neonGreen, '#94A3B8', () => this.openHangarFromMenu(), true);
        start.label.string = '进入机库 · 整备出击';
        const quick = makeButton(panel, 'MenuQuickStart', 118, 432, 412, 62, RogueShooterGame.UI.neonCyan, '#94A3B8', () => this.beginBattle(false), true);
        quick.label.string = '快速出击';
        const settings = makeButton(panel, 'MenuSettings', 118, 510, 196, 56, '#64748B', '#94A3B8', () => this.openSettingsPanel(), true);
        settings.label.string = '设置';
        const howto = makeButton(panel, 'MenuHowTo', 334, 510, 196, 56, RogueShooterGame.UI.neonPurple, '#94A3B8', () => this.openHowToPanel(), true);
        howto.label.string = '玩法说明';
        const privacy = makeButton(panel, 'MenuPrivacy', 118, 584, 412, 56, RogueShooterGame.UI.alloyOrange, '#94A3B8', () => this.openPrivacyPanel(), true);
        privacy.label.string = '隐私与适龄';
        makeLabel(panel, 'AgeHint', '12+｜健康游戏，适度娱乐', 56, 660, 536, 30, 17, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);
        makeLabel(panel, 'MenuVersion', 'v0.2.0  审核前测试版', 56, 704, 536, 32, 17, RogueShooterGame.UI.hint, Label.HorizontalAlign.CENTER, true);
    }

    private buildPausePanel(root: Node) {
        this.panels.pausePanelShadow = makeRect(root, 'PausePanelShadow', 78, 372, 564, 520, RogueShooterGame.UI.panelShadow, 24);
        this.panels.pausePanelShadow.active = false;
        const panel = this.spritePanel(root, 'PausePanel', 66, 360, 588, 520);
        panel.active = false;
        this.panels.pausePanel = panel;
        makeLabel(panel, 'PauseTitle', '暂停', 42, 38, 504, 58, 38, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        makeLabel(panel, 'PauseHint', '战斗已暂停，可继续、调整声音或返回机库。', 50, 104, 488, 44, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        const resume = makeButton(panel, 'PauseResume', 124, 178, 340, 60, '#43AA8B', '#94A3B8', () => this.resumeFromPause(), true);
        resume.label.string = '继续游戏';
        const settings = makeButton(panel, 'PauseSettings', 124, 254, 340, 58, '#64748B', '#94A3B8', () => this.openSettingsPanel(), true);
        settings.label.string = '设置';
        const hangar = makeButton(panel, 'PauseHangar', 124, 328, 340, 58, '#F8961E', '#94A3B8', () => this.returnToHangarFromPause(), true);
        hangar.label.string = '返回机库';
        const help = makeButton(panel, 'PauseHelp', 124, 402, 340, 58, '#B5179E', '#94A3B8', () => this.openHowToPanel(), true);
        help.label.string = '玩法说明';
    }

    private buildSettingsPanel(root: Node) {
        this.panels.settingsPanelShadow = makeRect(root, 'SettingsPanelShadow', 86, 386, 548, 490, RogueShooterGame.UI.panelShadow, 24);
        this.panels.settingsPanelShadow.active = false;
        const panel = this.spritePanel(root, 'SettingsPanel', 74, 374, 572, 490);
        panel.active = false;
        this.panels.settingsPanel = panel;
        makeLabel(panel, 'SettingsTitle', '设置', 44, 36, 484, 58, 36, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.settingsBodyLabel = makeLabel(panel, 'SettingsBody', '', 54, 104, 464, 80, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.CENTER, true);
        this.panels.bgmToggleButton = makeButton(panel, 'BgmToggle', 116, 204, 340, 58, '#4CC9F0', '#94A3B8', () => this.audio.toggleBgm(), true);
        this.panels.sfxToggleButton = makeButton(panel, 'SfxToggle', 116, 278, 340, 58, '#B5179E', '#94A3B8', () => this.audio.toggleSfx(), true);
        const close = makeButton(panel, 'SettingsClose', 116, 366, 340, 58, '#43AA8B', '#94A3B8', () => this.closeSettingsPanel(), true);
        close.label.string = '返回';
        this.refreshSettingsPanel();
    }

    private buildInfoPanel(root: Node) {
        this.panels.infoPanelShadow = makeRect(root, 'InfoPanelShadow', 64, 304, 592, 636, RogueShooterGame.UI.panelShadow, 24);
        this.panels.infoPanelShadow.active = false;
        const panel = this.spritePanel(root, 'InfoPanel', 52, 292, 616, 646);
        panel.active = false;
        this.panels.infoPanel = panel;
        this.panels.infoTitleLabel = makeLabel(panel, 'InfoTitle', '', 44, 34, 528, 58, 34, RogueShooterGame.UI.title, Label.HorizontalAlign.CENTER, true);
        this.panels.infoBodyLabel = makeLabel(panel, 'InfoBody', '', 54, 112, 508, 390, 20, RogueShooterGame.UI.body, Label.HorizontalAlign.LEFT, true);
        const close = makeButton(panel, 'InfoClose', 148, 532, 320, 58, '#43AA8B', '#94A3B8', () => this.closeInfoPanel(), true);
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
        if (this.combatHudRoot) this.combatHudRoot.active = false;
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
        this.offhandMgr.clearBattleState();
        this.weaponCooldowns = {};
        this.updateCamera(0, true);
        this.cs.playerMaxHp = this.getMaxHp();
        const weapon = this.getActiveWeapon();
        // 副武器状态同步
        const equippedOffhandId = this.shop.getEquippedOffhandId();
        this.cs.equippedOffhandId = equippedOffhandId;
        this.cs.offhandLevel = equippedOffhandId ? this.shop.getOffhandLevel(equippedOffhandId) : 0;
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
        let nextX = clamp(this.cs.playerX + move.x * speed * dt, WORLD_LEFT + 42, WORLD_RIGHT - 42);
        let nextY = clamp(this.cs.playerY + move.y * speed * dt, WORLD_BOTTOM + 42, WORLD_TOP - 42);
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

        const target = this.cs.phase === 'combat'
            ? this.enemyMgr.findNearestEnemy(this.cs.playerX, this.cs.playerY, Math.min(this.getAttackRange(), 900))
            : null;
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
        // 玩家主动移动时不受碰撞推挤影响，确保操作感优先
        const move = this.getMoveVector();
        if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
            return new Vec2(x, y);
        }
        // 不动时才轻微推挤防止怪物堆叠
        const speed = this.getMoveSpeed();
        let pushX = 0;
        let pushY = 0;
        let pushCount = 0;
        for (const enemy of this.enemyMgr.enemies) {
            const { x: ex, y: ey } = this.enemyMgr.getEnemyPosition(enemy);
            const minDist = this.cs.playerRadius + enemy.radius + ENEMY_PLAYER_PADDING;
            const dx = x - ex;
            const dy = y - ey;
            if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;
            const distSq = dx * dx + dy * dy;
            if (distSq >= minDist * minDist) continue;
            const dist = Math.sqrt(Math.max(0.001, distSq));
            const nx = dist > 0.01 ? dx / dist : 0;
            const ny = dist > 0.01 ? dy / dist : 0;
            pushX += nx;
            pushY += ny;
            pushCount++;
        }
        if (pushCount > 0) {
            const rawDist = Math.sqrt(pushX * pushX + pushY * pushY);
            if (rawDist > 0.001) {
                pushX /= rawDist;
                pushY /= rawDist;
            }
            const maxPush = Math.max(1.5, speed * 0.016) * 0.7;
            x = clamp(x + pushX * maxPush, WORLD_LEFT + 42, WORLD_RIGHT - 42);
            y = clamp(y + pushY * maxPush, WORLD_BOTTOM + 42, WORLD_TOP - 42);
        }
        return new Vec2(x, y);
    }

    private resolvePlayerAfterEnemyMovement() {
        // 不在此额外推挤，玩家位置完全由 updatePlayer 控制
    }

    private updateCamera(dt: number, snap = false) {
        if (!this.worldNode) return;
        // Decay shake
        if (this.cs.shakeIntensity > 0.01) {
            this.cs.shakeIntensity *= Math.max(0.85, 1 - dt * 7);
        } else {
            this.cs.shakeIntensity = 0;
        }
        const targetX = clamp(CAMERA_FOCUS_X - this.cs.playerX, VIEW_RIGHT - WORLD_RIGHT, VIEW_LEFT - WORLD_LEFT);
        const targetY = clamp(CAMERA_FOCUS_Y - this.cs.playerY, VIEW_TOP - WORLD_TOP, VIEW_BOTTOM - WORLD_BOTTOM);
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
        this.botAI.tick(dt);
    }

    private botPickUpgrade(): void {
        this.botAI.pickUpgrade();
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
            const target = this.enemyMgr.findNearestEnemy(this.cs.playerX, this.cs.playerY, this.getAttackRange());
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
                    const target = this.enemyMgr.findNearestEnemy(this.cs.playerX, this.cs.playerY, this.getDroneRange(dronePower));
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
        if (shootMechanic === 'overheat') {
            this.cs.overheatStacks = Math.min(5, this.cs.overheatStacks + 1);
            this.cs.overheatTimer = 0;
        }
        let muzzleShotCount = 1;

        // 根据机械机制决定射击
        if (shootMechanic === 'multishot_3') {
            // 裂变枪管: 同时 3 颗窄扇形 0.16 rad 间距
            muzzleShotCount = 3;
            const spread = [-0.16, 0, 0.16];
            for (const offset of spread) {
                const angle = baseAngle + offset;
                this.proj.createBullet(angle, damage, this.proj.getBulletPierce(), weaponStyle, weaponColor, shootMechanic);
            }
        } else if (shootMechanic === 'radial_5') {
            // 镜像棱镜: 5 颗 360° 均匀分布
            muzzleShotCount = 5;
            for (let i = 0; i < 5; i++) {
                const angle = baseAngle + (Math.PI * 2 * i) / 5;
                const rayDamage = i === 0 ? damage * MIRROR_PRISM_FOCUSED_DAMAGE_MULTIPLIER : damage;
                this.proj.createBullet(angle, rayDamage, this.proj.getBulletPierce(), weaponStyle, weaponColor, shootMechanic);
            }
        } else if (shootMechanic === 'poison') {
            // 瘟疫喷射器：扇形持续喷雾。喷到敌人只叠中毒层数，不做每秒多次直伤；
            // 提升攻速 = 更快叠层，DoT 每层每秒结算。
            const range = Math.min(this.getAttackRange(), 450);
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
                const beforeStacks = enemy.poisonStacks || 0;
                const afterStacks = this.proj.applyPoisonStack(enemy, damage, 3);
                if (afterStacks > beforeStacks && this.cs.shotCounter % 2 === 0) {
                    this.proj.spawnBulletHitSpark(pos.x, pos.y, weaponStyle, weaponColor, '#BBF7D0');
                }
            }
        } else {
            const projectileMechanic = shootMechanic === 'icefire_judge'
                ? (this.cs.shotCounter % 2 === 0 ? 'icefire_fire' : 'icefire_ice')
                : shootMechanic;
            this.proj.createBullet(baseAngle, damage, this.proj.getBulletPierce(), weaponStyle, weaponColor, projectileMechanic);
        }
        this.audio.playShootSfx(weaponStyle);
        this.proj.spawnMuzzleFlash(baseAngle, weaponStyle, weaponColor, muzzleShotCount);
    }

    private updateRegen(dt: number) {
        // 机制词条衰减独立于回血，不能被 hpRegen early-return 跳过。
        if (this.cs.critStacks > 0) {
            this.cs.attackSpeedBoostTimer -= dt;
            if (this.cs.attackSpeedBoostTimer <= 0) {
                this.cs.critStacks = Math.max(0, this.cs.critStacks - 1);
                this.cs.attackSpeedBoostTimer = 6.0;
            }
        }
        if (this.cs.pierceStacks > 0) {
            this.cs.pierceStackTimer -= dt;
            if (this.cs.pierceStackTimer <= 0) {
                this.cs.pierceStacks = Math.max(0, this.cs.pierceStacks - 1);
                this.cs.pierceStackTimer = 6.0;
            }
        }
        if (this.cs.overheatStacks > 0) {
            this.cs.overheatTimer += dt;
            if (this.cs.overheatTimer >= 0.8) {
                this.cs.overheatStacks = Math.max(0, this.cs.overheatStacks - 1);
                this.cs.overheatTimer = 0;
            }
        }

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

    private initTransientGraphicsPools(): void {
        if (!this.worldNode) return;
        const layer = new Node('WorldVfxLayer');
        layer.layer = Layers.Enum.UI_2D;
        this.worldNode.addChild(layer);
        this.worldVfxLayer = layer;
        this.areaPulsePool = this.createTransientGraphicsPool(layer, 'EnemyAreaPulse', AREA_PULSE_POOL_SIZE);
        this.droneZapPool = this.createTransientGraphicsPool(layer, 'DroneZap', DRONE_ZAP_POOL_SIZE);
        this.areaPulsePoolCursor = 0;
        this.droneZapPoolCursor = 0;
    }

    private createTransientGraphicsPool(parent: Node, name: string, size: number): TimedGraphicsEffect[] {
        const pool: TimedGraphicsEffect[] = [];
        for (let i = 0; i < size; i++) {
            const node = new Node(`${name}_${i}`);
            node.layer = Layers.Enum.UI_2D;
            node.active = false;
            parent.addChild(node);
            pool.push({ node, gfx: node.addComponent(Graphics), remaining: 0 });
        }
        return pool;
    }

    private keepWorldVfxLayerOnTop(): void {
        const layer = this.worldVfxLayer;
        const parent = layer?.parent;
        if (!layer || !layer.isValid || !parent) return;
        const children = parent.children;
        if (children[children.length - 1] !== layer) {
            layer.setSiblingIndex(children.length - 1);
        }
    }

    private acquireTransientGraphicsEffect(pool: TimedGraphicsEffect[], cursor: number): number {
        if (pool.length <= 0) return -1;
        for (let offset = 0; offset < pool.length; offset++) {
            const index = (cursor + offset) % pool.length;
            if (!pool[index].node.active) return index;
        }
        return cursor % pool.length;
    }

    private updateTransientGraphics(dt: number): void {
        const elapsed = Math.max(0, dt);
        this.updateTransientGraphicsPool(this.areaPulsePool, elapsed);
        this.updateTransientGraphicsPool(this.droneZapPool, elapsed);
    }

    private updateTransientGraphicsPool(pool: TimedGraphicsEffect[], elapsed: number): void {
        for (const effect of pool) {
            if (!effect.node.active) continue;
            effect.remaining -= elapsed;
            if (effect.remaining > 0) continue;
            effect.remaining = 0;
            effect.gfx.clear();
            effect.node.active = false;
        }
    }

    private destroyTransientGraphicsPools(): void {
        if (this.worldVfxLayer?.isValid) {
            this.worldVfxLayer.destroy();
        } else {
            for (const effect of this.areaPulsePool) {
                if (effect.node.isValid) effect.node.destroy();
            }
            for (const effect of this.droneZapPool) {
                if (effect.node.isValid) effect.node.destroy();
            }
        }
        this.worldVfxLayer = null;
        this.areaPulsePool = [];
        this.droneZapPool = [];
        this.areaPulsePoolCursor = 0;
        this.droneZapPoolCursor = 0;
    }



    private drawAreaPulse(x: number, y: number, radius: number, color: string) {
        const index = this.acquireTransientGraphicsEffect(this.areaPulsePool, this.areaPulsePoolCursor);
        if (index < 0) return;
        this.areaPulsePoolCursor = (index + 1) % this.areaPulsePool.length;
        const effect = this.areaPulsePool[index];
        const { node, gfx } = effect;
        gfx.clear();
        node.active = true;
        node.setPosition(x, y, 8);
        effect.remaining = 0.16;
        gfx.fillColor = hex(color, 35);
        gfx.circle(0, 0, radius);
        gfx.fill();
        gfx.strokeColor = hex(color, 210);
        gfx.lineWidth = 4;
        gfx.circle(0, 0, radius);
        gfx.stroke();
    }

    private takeDamage(amount: number, type: DamageType = 'physical') {
        const stats = this.getCharacterStats();
        if (Math.random() < stats.dodgeChance) {
            this.cs.invulnerableTimer = 0.18;
            this.pickupMgr.spawnFloatingText('闪避', this.cs.playerX, this.cs.playerY + this.cs.playerRadius + 28, '#4CC9F0', 24);
            return;
        }

        const defense = this.getDefenseAgainst(type, stats);
        const defenseRatio = 1 - clamp(defense / (defense + 80), 0, 0.7);
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
        this.offhandMgr.onPlayerHit();
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

        const lootChoices = settlementFlow.phase === 'loot'
            ? this.pickupMgr.createLootChoices()
            : [];
        this.pickupMgr.pendingLootChoices = lootChoices;

        void uiMgr.showDynamicPopupAsync(() => {
            const node = new Node('SettlementPopup');
            node.addComponent(SettlementPopup).setup({
                reason,
                title: settlementFlow.title,
                combatTime: this.cs.combatTime,
                bossKills: this.cs.bossKills,
                killCount: this.cs.killCount,
                level: this.cs.level,
                reward,
                inventoryWallet: this.getInventoryWallet(),
                lootChoices: lootChoices.map((choice) => ({
                    title: choice.title,
                    desc: choice.desc,
                    color: choice.color,
                })),
                onLootChosen: (index: number) => {
                    const choice = this.pickupMgr.pendingLootChoices[index];
                    if (choice) choice.apply();
                    this.pickupMgr.pendingLootChoices = [];
                },
            });
            return node;
        }, 'SettlementPopup').then(() => {
            this.openSettlementHangarActions(reason);
            this.refreshHud();
        });
        this.refreshHud();
    }

    private openSettlementHangarActions(reason: BattleEndReason): void {
        this.cs.phase = 'hangar';
        if (this.panels.hangarTitleLabel) this.panels.hangarTitleLabel.string = '机库整备';
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
            drawButtonView(button, false);
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

    private updateHud(dt: number): void {
        const inRun = this.cs.phase === 'combat' || this.cs.phase === 'level-up' || this.cs.phase === 'item-choice' || this.cs.phase === 'shop';
        if (inRun) this.drawBars();
        this.hudTextRefreshTimer -= Math.max(0, dt);
        if (this.lastHudPhase === this.cs.phase && (!inRun || this.hudTextRefreshTimer > 0)) return;
        this.refreshHud(false);
    }

    private setLabelText(label: Label | null, text: string): void {
        if (label && label.string !== text) label.string = text;
    }

    private refreshHud(updateBars = true) {
        this.setLabelText(this.panels.titleLabel, `星坠幸存者  出击 ${this.cs.battlesWon + 1}`);
        const inRun = this.cs.phase === 'combat' || this.cs.phase === 'level-up' || this.cs.phase === 'item-choice' || this.cs.phase === 'shop';
        if (this.combatHudRoot && this.combatHudRoot.active !== inRun) this.combatHudRoot.active = inRun;
        if (this.panels.timerLabel) {
            const waveRemain = Math.max(0, Math.ceil(this.cs.waveDuration - this.cs.waveElapsed));
            const waveText = this.enemyMgr.isBossWave()
                ? `第${Math.max(1, this.cs.waveIndex)}波 Boss${this.cs.bossDefeatedThisWave ? ` ${waveRemain}s` : ''}`
                : `第${Math.max(1, this.cs.waveIndex || 1)}波 ${waveRemain}s`;
            const timerText = inRun
                ? this.cs.phase === 'shop'
                    ? '商店'
                    : waveText
                : '机库';
            this.setLabelText(this.panels.timerLabel, timerText);
        }
        if (this.panels.statLabel) {
            const stats = this.getCharacterStats();
            const statText = inRun
                ? `合金 ${this.cs.battleAlloy} · Lv.${this.cs.level} · 暴${Math.round(stats.critChance * 100)}%${stats.dronePower > 0 ? ` 机${this.shop.formatStat(stats.dronePower)}` : ''}`
                : `永久资源：${this.formatWallet(this.getInventoryWallet())}`;
            this.setLabelText(this.panels.statLabel, statText);
        }
        if (this.panels.equipmentLabel) {
            const activeWeapon = this.shop.getActiveWeapon();
            const weaponText = activeWeapon ? `${activeWeapon.name} Lv.${this.shop.getEquipmentLevel(activeWeapon.id)}` : '无武器';
            const offhand = this.cs.equippedOffhandId ? findOffhand(this.cs.equippedOffhandId) : null;
            const offhandText = offhand ? `${offhand.name} T${this.cs.offhandLevel}` : '未装备';
            const equipmentText = inRun
                ? `主 ${weaponText} · 副 ${offhandText}`
                : '';
            this.setLabelText(this.panels.equipmentLabel, equipmentText);
        }
        if (this.panels.shopButton) {
            if (this.panels.shopButton.node.active !== inRun) this.panels.shopButton.node.active = inRun;
            this.setLabelText(this.panels.shopButton.label, '商店');
            drawButtonView(this.panels.shopButton, this.cs.phase !== 'combat');
        }
        if (this.panels.extractButton) {
            if (this.panels.extractButton.node.active !== inRun) this.panels.extractButton.node.active = inRun;
            this.setLabelText(this.panels.extractButton.label, '撤离');
            drawButtonView(this.panels.extractButton, this.cs.phase !== 'combat');
        }
        this.refreshDebugHud(inRun);
        if (updateBars) this.drawBars();
        this.ensureMenuVisible();
        this.lastHudPhase = this.cs.phase;
        this.hudTextRefreshTimer = HUD_TEXT_REFRESH_INTERVAL;
    }

    private ensureMenuVisible(): void {
        if (this.cs.phase !== 'menu') return;
        const hasBlockingOverlay = !!(
            this.panels.loadingPanel?.active ||
            this.panels.hangarPanel?.active ||
            this.panels.offhandPanel?.active ||
            this.panels.forgePanel?.active ||
            this.panels.pausePanel?.active ||
            this.panels.settingsPanel?.active ||
            this.panels.infoPanel?.active ||
            this.panels.revivePanel?.active
        );
        if (hasBlockingOverlay) return;
        if (this.panels.menuPanel && !this.panels.menuPanel.active) {
            this.panels.menuPanel.active = true;
            if (this.panels.menuPanelShadow) this.panels.menuPanelShadow.active = true;
            this.panels.setCombatHudControlsActive(false);
        }
    }

    private refreshDebugHud(inRun: boolean) {
        if (!this.panels.debugLabel) return;
        const visible = inRun && this.debugHudEnabled;
        if (this.panels.debugLabel.node.active !== visible) this.panels.debugLabel.node.active = visible;
        if (!inRun || !this.debugHudEnabled) {
            this.setLabelText(this.panels.debugLabel, '');
            return;
        }
        const boss = this.enemyMgr.enemies.find((enemy) => enemy.boss);
        const bossText = boss ? `Boss ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}` : 'Boss -';
        this.setLabelText(this.panels.debugLabel, [
            `DBG ${this.cs.phase} W${this.cs.waveIndex} ${Math.round(this.cs.waveElapsed)}/${Math.round(this.cs.waveDuration)}s ${bossText}`,
            `E ${this.enemyMgr.enemies.length}/${this.enemyMgr.getEnemyCap()}  B ${this.proj.bullets.length}  EP ${this.proj.enemyProjectiles.length}/${ENEMY_PROJECTILE_LIMIT}  P ${this.pickupMgr.pickups.length}  FT ${this.pickupMgr.floatingTexts.length}`,
            `MS F${this.perfFrameMs.toFixed(1)} pre${this.perfPreMs.toFixed(1)} ply${this.perfPlayerMs.toFixed(1)} wep${this.perfWeaponMs.toFixed(1)} bul${this.perfBulletMs.toFixed(1)} ep${this.perfEnemyProjectileMs.toFixed(1)} ene${this.perfEnemyMs.toFixed(1)} sep${this.perfSeparationMs.toFixed(1)} pk${this.perfPickupMs.toFixed(1)} hud${this.perfHudMs.toFixed(1)}`,
            `DRAW enemy${this.perfDrawEnemy} bullet${this.proj.perfDrawBullet} drone${this.perfDrawDrone}  STEER ${this.perfCrowdSteerCalls}/${this.perfCrowdChecks}  SEPCHK ${this.perfSepChecks}`,
        ].join('\n'));
    }

    private drawBars() {
        // Fill nodes are checked every frame; unchanged widths do not dirty UI geometry.
        const hpRatio = this.cs.playerMaxHp > 0 ? this.cs.playerHp / this.cs.playerMaxHp : 0;
        const xpRatio = this.cs.xpToNext > 0 ? this.cs.xp / this.cs.xpToNext : 0;
        const shieldRatio = this.cs.playerShieldMax > 0 ? this.cs.playerShield / this.cs.playerShieldMax : 0;
        this.updateBarFill(this._hpBarFill, 664 * clamp(hpRatio, 0, 1), 20);
        this.updateBarFill(this._xpBarFill, 322 * clamp(xpRatio, 0, 1), 14);
        this.updateBarFill(this._shieldBarFill, 322 * clamp(shieldRatio, 0, 1), 14);
    }

    private updateBarFill(node: Node | null, width: number, height: number): void {
        const transform = node?.getComponent(UITransform);
        if (!transform) return;
        const size = transform.contentSize;
        if (Math.abs(size.width - width) < 0.05 && Math.abs(size.height - height) < 0.05) return;
        transform.setContentSize(width, height);
    }

    private updateDroneVisuals(dt: number) {
        this.droneHitPulse = Math.max(0, this.droneHitPulse - dt);
        if (!this.worldNode || this.cs.phase !== 'combat' || !this.playerNode) {
            this.clearDroneVisuals();
            return;
        }

        const dronePower = this.getCharacterStats().dronePower;
        const targetCount = dronePower > 0 ? clamp(Math.ceil(dronePower / 1.35), 1, 4) : 0;
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
        gfx.strokeColor = hex('#90BE6D', this.droneHitPulse > 0 ? 220 : 120);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, core + 7);
        gfx.stroke();
        gfx.fillColor = hex('#020617', 135);
        gfx.circle(2, -2, core + 4);
        gfx.fill();
        gfx.fillColor = hex('#90BE6D', this.droneHitPulse > 0 ? 255 : 220);
        gfx.circle(0, 0, core);
        gfx.fill();
        gfx.fillColor = hex('#F8FAFC', 230);
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
            this.playerSprite.color = hex('#FFFFFF', pulse);
            this.playerGfx.fillColor = hex('#020617', 95);
            this.playerGfx.circle(3, -6, 27);
            this.playerGfx.fill();
            this.playerGfx.strokeColor = hex(this.cs.invulnerableTimer > 0 ? '#F8FAFC' : '#4CC9F0', pulse);
            this.playerGfx.lineWidth = 3;
            this.playerGfx.circle(0, 0, 29);
            this.playerGfx.stroke();
            return;
        }
        this.playerGfx.fillColor = hex('#020617', 110);
        this.playerGfx.circle(3, -5, 25);
        this.playerGfx.fill();
        this.playerGfx.fillColor = hex('#E2E8F0', pulse);
        this.playerGfx.circle(0, 0, 21);
        this.playerGfx.fill();
        this.playerGfx.fillColor = hex('#4CC9F0', pulse);
        this.playerGfx.moveTo(0, 24);
        this.playerGfx.lineTo(17, -12);
        this.playerGfx.lineTo(0, -4);
        this.playerGfx.lineTo(-17, -12);
        this.playerGfx.close();
        this.playerGfx.fill();
        this.playerGfx.strokeColor = hex('#0F172A', pulse);
        this.playerGfx.lineWidth = 3;
        this.playerGfx.circle(0, 0, 21);
        this.playerGfx.stroke();
    }

    private drawZap(fromX: number, fromY: number, toX: number, toY: number) {
        const index = this.acquireTransientGraphicsEffect(this.droneZapPool, this.droneZapPoolCursor);
        if (index < 0) return;
        this.droneZapPoolCursor = (index + 1) % this.droneZapPool.length;
        const effect = this.droneZapPool[index];
        const { node, gfx } = effect;
        gfx.clear();
        node.active = true;
        node.setPosition(0, 0, 8);
        effect.remaining = 0.06;
        gfx.lineWidth = 3;
        gfx.strokeColor = hex('#90BE6D', 210);
        gfx.moveTo(fromX, fromY);
        const midX = (fromX + toX) / 2 + this.randomRange(-16, 16);
        const midY = (fromY + toY) / 2 + this.randomRange(-16, 16);
        gfx.lineTo(midX, midY);
        gfx.lineTo(toX, toY);
        gfx.stroke();
    }

    private drawJoystick() {
        if (!this.joystickBaseGfx || !this.joystickKnobGfx) return;
        this.joystickBaseGfx.clear();
        this.joystickBaseGfx.fillColor = hex('#F8FAFC', 52);
        this.joystickBaseGfx.circle(0, 0, 74);
        this.joystickBaseGfx.fill();
        this.joystickBaseGfx.strokeColor = hex('#CBD5E1', 120);
        this.joystickBaseGfx.lineWidth = 3;
        this.joystickBaseGfx.circle(0, 0, 74);
        this.joystickBaseGfx.stroke();

        this.joystickKnobGfx.clear();
        this.joystickKnobGfx.fillColor = hex('#4CC9F0', 150);
        this.joystickKnobGfx.circle(0, 0, 36);
        this.joystickKnobGfx.fill();
        this.joystickKnobGfx.strokeColor = hex('#F8FAFC', 160);
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
        if (this.cs.phase === 'combat') {
            this.showToast('主武器与副武器同时生效，无需切换。');
        }
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
        const baseAttackRange = stats.attackRange;
        this.addCharacterStats(stats, this.pickupMgr.runStats);

        stats.attackSpeed += this.getWeaponStat('fireRate') * 0.18;
        stats.bulletSpeed += this.getWeaponStat('bulletSpeed') * 6;
        stats.pierce += this.getWeaponStat('pierce') * 0.18;
        stats.dronePower += this.getWeaponStat('drone');
        const weaponAttackRange = this.shop.getActiveWeapon()?.weaponStats?.attackRange;
        if (typeof weaponAttackRange === 'number') {
            stats.attackRange += weaponAttackRange - baseAttackRange;
        }

        for (const gear of this.shop.getEquippedGear()) {
            const level = this.shop.getEquipmentLevel(gear.id);
            for (const effect of gear.gearStats || []) {
                stats[effect.stat] += effect.amount * level;
            }
        }

        stats.attackPower = Math.max(2, stats.attackPower);
        stats.attackSpeed = clamp(stats.attackSpeed, -0.55, 4.5);
        stats.attackRange = clamp(stats.attackRange, 180, 1500);
        stats.critChance = clamp(stats.critChance + stats.luck * 0.00045, 0, 0.86);
        stats.critDamage = Math.max(2, stats.critDamage);
        stats.lethalChance = clamp(stats.lethalChance + stats.luck * 0.00012, 0, 0.28);
        stats.lethalDamage = Math.max(2.5, stats.lethalDamage);
        stats.lethalMaxHpPct = clamp(stats.lethalMaxHpPct, 0.05, 0.16);
        stats.damageReduction = clamp(stats.damageReduction, -0.35, 0.72);
        stats.dodgeChance = clamp(stats.dodgeChance + stats.luck * 0.0002, 0, 0.72);
        stats.xpGain = clamp(stats.xpGain + stats.luck * 0.001, -0.5, 3);
        stats.resourceGain = clamp(stats.resourceGain + stats.luck * 0.0014, -0.6, 4);
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
        this.enemyMgr.resetBarLayer();

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
        if (visible) {
            const nodes = [this.toastPanelShadowNode, this.toastPanelNode, this.panels.toastLabel.node];
            for (const node of nodes) {
                if (node?.parent) node.setSiblingIndex(node.parent.children.length - 1);
            }
        }
        this.panels.toastLabel.string = message;
        this.panels.toastLabel.node.active = visible;
        if (this.toastPanelNode) this.toastPanelNode.active = visible;
        if (this.toastPanelShadowNode) this.toastPanelShadowNode.active = visible;
        this.toastTimer = visible ? 2.5 : 0;
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

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }

    private hex(color: string, alpha?: number): Color {
        return hex(color, alpha);
    }

    private drawButton(button: ButtonView, disabled: boolean): void {
        drawButtonView(button, disabled);
    }

    private formatStat(value: number): string {
        return Number(value.toFixed(1)).toString();
    }

    private getOwnedWeaponCount(): number {
        return this.shop.getOwnedWeaponCount();
    }

    private getWeaponAttackStyle(weapon: EquipmentDef): WeaponAttackStyle {
        return weapon.attackStyle || 'rifle';
    }

    private drawAreaCircle(x: number, y: number, radius: number, color: string, duration = 0.25): void {
        this.drawAreaPulse(x, y, radius, color);
    }

    private addShieldFragment(): void {
        this.cs.shieldFragments += 1;
    }

    private applyAttackSpeedMultiplier(multiplier: number, duration: number): void {
        this.cs.offhandAttackSpeedMultiplier = Math.max(1, multiplier);
        this.cs.offhandAttackSpeedTimer = Math.max(this.cs.offhandAttackSpeedTimer || 0, duration);
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

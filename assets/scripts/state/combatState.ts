import type { GamePhase } from '../core/types';

/**
 * Consolidated combat-session state.
 *
 * Fields are split into two categories:
 *  **Persistent** – survive across battles (battleIndex, battlesWon, alloy …)
 *  **Per-battle** – reset every time beginBattle() runs
 *
 * The state is a plain object – NOT a Cocos Component.
 */

export interface CombatState {
    // ── Game phase ──────────────────────────────────────────────
    phase: GamePhase;
    phaseBeforePause: GamePhase;

    // ── Persistent progress (not reset per battle) ──────────────
    battleIndex: number;
    battlesWon: number;
    alloy: number;
    cores: number;
    shards: number;
    biomass: number;
    circuits: number;
    crystals: number;
    voidFragment: number;
    energyCore: number;
    frostCore: number;
    infernoCore: number;
    webSilk: number;

    // ── Player combat state ─────────────────────────────────────
    playerX: number;
    playerY: number;
    cameraX: number;
    cameraY: number;
    playerHp: number;
    playerMaxHp: number;
    playerShield: number;
    playerShieldMax: number;
    shieldRechargeDelay: number;
    playerRadius: number;
    invulnerableTimer: number;
    shakeIntensity: number;
    shotTimer: number;
    droneTimer: number;
    regenTimer: number;
    shotCounter: number;
    activeWeaponIndex: number;
    // 冰霜减速状态
    slowTimer: number;
    slowFactor: number;

    // ── 机制词条状态 (Phase 2) ─────────────────────────────────────────
    critStacks: number;
    attackSpeedBoostTimer: number;
    pierceStacks: number;
    pierceStackTimer: number;
    droneCharge: number;
    overheatStacks: number;    // 冲锋枪: 连续射击层数 (0-5), +10%射速/层
    overheatTimer: number;     // 冲锋枪: 距上次射击时间, >0.8s 开始衰减
    offhandAttackSpeedMultiplier: number; // 副武器临时攻速倍率（如时间扭曲）
    offhandAttackSpeedTimer: number;      // 副武器临时攻速剩余时间

    // ── Wave state ──────────────────────────────────────────────
    combatTime: number;
    cycleTime: number;
    endlessCycle: number;
    waveIndex: number;
    waveElapsed: number;
    waveDuration: number;
    waveSpawnTimer: number;
    bossSpawned: boolean;
    bossDefeatedThisWave: boolean;
    bossKills: number;
    waveKillCount: number;
    waveChestDrops: number;

    // ── Battle resources ────────────────────────────────────────
    killCount: number;
    battleAlloy: number;
    battleCores: number;
    battleShards: number;
    battleBiomass: number;
    battleCircuits: number;
    battleCrystals: number;
    level: number;
    xp: number;
    xpToNext: number;

    // ── Per-battle shield fragments ──────────────────────────────
    shieldFragments: number;

    // ── Boss 机制区域 ───────────────────────────────────────────
    frostZones: { x: number; y: number; radius: number; damage: number; duration: number; }[];
    fireZones: { x: number; y: number; radius: number; damage: number; duration: number; }[];
    burrowedEnemyIds: number[];

    // ── 副武器 ─────────────────────────────────────────────────
    equippedOffhandId: string | null;   // 战斗中已装备的副武器 id
    offhandLevel: number;               // 副武器当前等级（T1=1, T5=5）
}

/**
 * Return a fresh CombatState with field-declaration defaults.
 */
export function createCombatState(): CombatState {
    return {
        // Game phase
        phase: 'menu',
        phaseBeforePause: 'menu',

        // Persistent progress
        battleIndex: 1,
        battlesWon: 0,
        alloy: 0,
        cores: 0,
        shards: 0,
        biomass: 0,
        circuits: 0,
        crystals: 0,
        voidFragment: 0,
        energyCore: 0,
        frostCore: 0,
        infernoCore: 0,
        webSilk: 0,

        // Player combat state
        playerX: 0,
        playerY: -170,
        cameraX: 0,
        cameraY: 0,
        playerHp: 50,
        playerMaxHp: 50,
        playerShield: 0,
        playerShieldMax: 0,
        shieldRechargeDelay: 0,
        playerRadius: 18,
        invulnerableTimer: 0,
        shakeIntensity: 0,
        shotTimer: 0,
        droneTimer: 0,
        regenTimer: 0,
        shotCounter: 0,
        activeWeaponIndex: 0,
        slowTimer: 0,
        slowFactor: 1,
        critStacks: 0,
        attackSpeedBoostTimer: 0,
        pierceStacks: 0,
        pierceStackTimer: 0,
        droneCharge: 0,
        overheatStacks: 0,
        overheatTimer: 0,
        offhandAttackSpeedMultiplier: 1,
        offhandAttackSpeedTimer: 0,

        // Wave state
        combatTime: 0,
        cycleTime: 0,
        endlessCycle: 1,
        waveIndex: 0,
        waveElapsed: 0,
        waveDuration: 55,
        waveSpawnTimer: 0.2,
        bossSpawned: false,
        bossDefeatedThisWave: false,
        bossKills: 0,
        waveKillCount: 0,
        waveChestDrops: 0,

        // Battle resources
        killCount: 0,
        battleAlloy: 0,
        battleCores: 0,
        battleShards: 0,
        battleBiomass: 0,
        battleCircuits: 0,
        battleCrystals: 0,
        level: 1,
        xp: 0,
        xpToNext: 65,
        shieldFragments: 0,

        // Boss 机制区域
        frostZones: [],
        fireZones: [],
        burrowedEnemyIds: [],

        // 副武器（空场不装备，进入战斗再装）
        equippedOffhandId: null,
        offhandLevel: 0,
    };
}

/**
 * Reset all per-battle fields to their beginBattle() defaults.
 *
 * Persistent fields (battleIndex, battlesWon, alloy, cores, shards,
 * biomass, circuits, crystals) are intentionally left untouched.
 *
 * Dynamic fields that depend on computed stats (playerMaxHp, playerHp,
 * playerShieldMax, playerShield) are NOT set here – the caller
 * recalculates them immediately after this call.
 */
export function resetCombatSession(state: CombatState): void {
    // Wave state
    state.combatTime = 0;
    state.cycleTime = 0;
    state.endlessCycle = 1;
    state.waveIndex = 0;
    state.waveElapsed = 0;
    state.waveDuration = 55;
    state.waveSpawnTimer = 0.15;
    state.bossSpawned = false;
    state.bossDefeatedThisWave = false;
    state.bossKills = 0;
    state.waveKillCount = 0;
    state.waveChestDrops = 0;

    // Battle resources
    state.killCount = 0;
    state.battleAlloy = 0;
    state.battleCores = 0;
    state.battleShards = 0;
    state.battleBiomass = 0;
    state.battleCircuits = 0;
    state.battleCrystals = 0;

    // Level / XP
    state.level = 1;
    state.xp = 0;
    state.xpToNext = 65;
    state.shieldFragments = 0;

    // Player combat state
    state.shotTimer = 0;
    state.droneTimer = 0.6;
    state.regenTimer = 0;
    state.shotCounter = 0;
    state.activeWeaponIndex = 0;
    state.slowTimer = 0;
    state.slowFactor = 1;
    state.playerX = 0;
    state.playerY = -190;
    state.shieldRechargeDelay = 0;
    state.invulnerableTimer = 0;
    state.overheatStacks = 0;
    state.overheatTimer = 0;
    state.offhandAttackSpeedMultiplier = 1;
    state.offhandAttackSpeedTimer = 0;

    // Boss 机制区域
    state.frostZones = [];
    state.fireZones = [];
    state.burrowedEnemyIds = [];
}

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

    // ── 机制词条状态 (Phase 2) ─────────────────────────────────────────
    critStacks: number;
    attackSpeedBoostTimer: number;
    pierceStacks: number;
    pierceStackTimer: number;
    droneCharge: number;

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

        // Player combat state
        playerX: 0,
        playerY: -170,
        cameraX: 0,
        cameraY: 0,
        playerHp: 180,
        playerMaxHp: 180,
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
        critStacks: 0,
        attackSpeedBoostTimer: 0,
        pierceStacks: 0,
        pierceStackTimer: 0,
        droneCharge: 0,

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
    state.playerX = 0;
    state.playerY = -190;
    state.shieldRechargeDelay = 0;
    state.invulnerableTimer = 0;
}

import type { EnemySpec } from '../core/types';

export interface WaveSpawnProfile {
    wave: number;
    intervalStart: number;
    intervalEnd: number;
    batchMin: number;
    batchMax: number;
    enemyCap: number;
    hpProgressFactor: number;
    damageProgressFactor: number;
}

export interface BossAddProfile {
    interval: number;
    batchMin: number;
    batchMax: number;
    aliveCap: number;
}

export type BossWavePhase = 'intro' | 'combat' | 'overtime' | 'victory';

export interface BossSpawnStateInput {
    previousWaveElapsed: number;
    waveElapsed: number;
    bossDefeated: boolean;
    spawnTimer: number;
    overtimeActive: boolean;
}

export interface BossSpawnStateStep {
    phase: BossWavePhase;
    spawnTimer: number;
    batchesDue: number;
    enteredOvertime: boolean;
}

export interface BossVictoryTimerStep {
    remaining: number;
    advanceWave: boolean;
}

export const BOSS_INTRO_DURATION = 3;
export const BOSS_OVERTIME_START = 60;
export const BOSS_VICTORY_DELAY = 2.5;
export const BOSS_OVERTIME_SPEED_MULTIPLIER = 1.15;
export const BOSS_OVERTIME_DAMAGE_MULTIPLIER = 1.2;
export const BOSS_OVERTIME_SKILL_COOLDOWN_MULTIPLIER = 0.85;
export const MINI_BOSS_START_WAVE = 14;
export const MINI_BOSS_WAVE_CHANCE = 0.35;
export const MINI_BOSS_SPAWN_MIN_TIME = 20;
export const MINI_BOSS_SPAWN_MAX_TIME = 35;

export const BOSS_ADD_PROFILE: BossAddProfile = {
    interval: 5,
    batchMin: 3,
    batchMax: 4,
    aliveCap: 24,
};

export const BOSS_OVERTIME_PROFILE: BossAddProfile = {
    interval: 10,
    batchMin: 4,
    batchMax: 4,
    aliveCap: 16,
};

/**
 * First-cycle pressure table.  Waves 1-6 remove the old wave 3-4 density dip;
 * waves 7-9 remain close to the verified late-first-cycle pressure baseline.
 */
export const EARLY_WAVE_PROFILES: readonly WaveSpawnProfile[] = [
    { wave: 1, intervalStart: 2.20, intervalEnd: 2.05, batchMin: 2, batchMax: 3, enemyCap: 35, hpProgressFactor: 0.28, damageProgressFactor: 0.75 },
    { wave: 2, intervalStart: 2.05, intervalEnd: 1.90, batchMin: 2, batchMax: 3, enemyCap: 45, hpProgressFactor: 0.32, damageProgressFactor: 0.76 },
    { wave: 3, intervalStart: 1.85, intervalEnd: 1.70, batchMin: 3, batchMax: 5, enemyCap: 75, hpProgressFactor: 0.38, damageProgressFactor: 0.78 },
    { wave: 4, intervalStart: 1.70, intervalEnd: 1.55, batchMin: 3, batchMax: 5, enemyCap: 95, hpProgressFactor: 0.44, damageProgressFactor: 0.80 },
    { wave: 5, intervalStart: 1.48, intervalEnd: 1.33, batchMin: 4, batchMax: 5, enemyCap: 130, hpProgressFactor: 0.55, damageProgressFactor: 0.84 },
    { wave: 6, intervalStart: 1.33, intervalEnd: 1.17, batchMin: 4, batchMax: 5, enemyCap: 170, hpProgressFactor: 0.64, damageProgressFactor: 0.87 },
    { wave: 7, intervalStart: 1.54, intervalEnd: 1.39, batchMin: 5, batchMax: 7, enemyCap: 200, hpProgressFactor: 0.74, damageProgressFactor: 0.92 },
    { wave: 8, intervalStart: 1.44, intervalEnd: 1.29, batchMin: 5, batchMax: 7, enemyCap: 240, hpProgressFactor: 0.84, damageProgressFactor: 0.95 },
    { wave: 9, intervalStart: 1.40, intervalEnd: 1.25, batchMin: 6, batchMax: 7, enemyCap: 240, hpProgressFactor: 0.92, damageProgressFactor: 0.98 },
] as const;

export function getWaveSpawnProfile(wave: number): WaveSpawnProfile {
    const normalized = Math.max(1, Math.floor(wave || 1));
    const profile = EARLY_WAVE_PROFILES[Math.min(normalized, EARLY_WAVE_PROFILES.length) - 1];
    if (normalized <= EARLY_WAVE_PROFILES.length) return profile;
    return {
        ...profile,
        wave: normalized,
        hpProgressFactor: 1,
        damageProgressFactor: 1,
    };
}

export function getWaveProgressFactors(wave: number): Pick<WaveSpawnProfile, 'hpProgressFactor' | 'damageProgressFactor'> {
    const normalized = Math.max(1, Math.floor(wave || 1));
    if (normalized > EARLY_WAVE_PROFILES.length) {
        return { hpProgressFactor: 1, damageProgressFactor: 1 };
    }
    const profile = EARLY_WAVE_PROFILES[normalized - 1];
    return {
        hpProgressFactor: profile.hpProgressFactor,
        damageProgressFactor: profile.damageProgressFactor,
    };
}

export function getWaveSpawnInterval(wave: number, waveElapsed: number, waveDuration: number): number {
    const profile = getWaveSpawnProfile(wave);
    const progress = Math.max(0, Math.min(1, waveElapsed / Math.max(0.001, waveDuration)));
    return profile.intervalStart + (profile.intervalEnd - profile.intervalStart) * progress;
}

export function getUnlockedEnemySpecsForWave(specs: readonly EnemySpec[], wave: number): EnemySpec[] {
    const normalized = Math.max(1, Math.floor(wave || 1));
    return specs.filter(spec => spec.unlockWave <= normalized);
}

/** Split one batch budget across formation groups without creating extra enemies. */
export function allocateSpawnBudget(totalBudget: number, groups: number): number[] {
    const safeBudget = Math.max(0, Math.floor(totalBudget));
    const safeGroups = Math.max(1, Math.floor(groups));
    const base = Math.floor(safeBudget / safeGroups);
    const remainder = safeBudget % safeGroups;
    return Array.from({ length: safeGroups }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function getBossWavePhase(waveElapsed: number, _waveDuration: number, bossDefeated: boolean): BossWavePhase {
    if (bossDefeated) return 'victory';
    if (waveElapsed < BOSS_INTRO_DURATION) return 'intro';
    if (waveElapsed >= BOSS_OVERTIME_START) return 'overtime';
    return 'combat';
}

function consumeBossSpawnTimer(spawnTimer: number, activeSeconds: number, interval: number): { spawnTimer: number; batchesDue: number } {
    let nextTimer = Number.isFinite(spawnTimer) ? spawnTimer : interval;
    nextTimer -= Math.max(0, activeSeconds);
    let batchesDue = 0;
    while (nextTimer <= 1e-9) {
        batchesDue += 1;
        nextTimer += interval;
    }
    return { spawnTimer: nextTimer, batchesDue };
}

/**
 * Advance the independent Boss reinforcement clock. Intro time is excluded,
 * and crossing into overtime discards the old combat clock before any old
 * combat batch can execute.
 */
export function advanceBossSpawnState(input: BossSpawnStateInput): BossSpawnStateStep {
    const waveElapsed = Math.max(0, input.waveElapsed);
    const previousWaveElapsed = Math.max(0, Math.min(waveElapsed, input.previousWaveElapsed));
    const phase = getBossWavePhase(waveElapsed, BOSS_OVERTIME_START, input.bossDefeated);
    if (phase === 'intro' || phase === 'victory') {
        return {
            phase,
            spawnTimer: input.spawnTimer,
            batchesDue: 0,
            enteredOvertime: false,
        };
    }

    if (phase === 'overtime') {
        const enteredOvertime = !input.overtimeActive;
        const timer = enteredOvertime ? BOSS_OVERTIME_PROFILE.interval : input.spawnTimer;
        const activeSeconds = waveElapsed - Math.max(previousWaveElapsed, BOSS_OVERTIME_START);
        const consumed = consumeBossSpawnTimer(timer, activeSeconds, BOSS_OVERTIME_PROFILE.interval);
        return { phase, ...consumed, enteredOvertime };
    }

    const activeSeconds = waveElapsed - Math.max(previousWaveElapsed, BOSS_INTRO_DURATION);
    const consumed = consumeBossSpawnTimer(input.spawnTimer, activeSeconds, BOSS_ADD_PROFILE.interval);
    return { phase, ...consumed, enteredOvertime: false };
}

export function advanceBossVictoryTimer(currentTimer: number, dt: number): BossVictoryTimerStep {
    const armedTimer = currentTimer < 0 ? BOSS_VICTORY_DELAY : currentTimer;
    const remaining = Math.max(0, armedTimer - Math.max(0, dt));
    return { remaining, advanceWave: remaining <= 1e-9 };
}

export function getBossAddSpawnBudget(profile: BossAddProfile, ordinaryAlive: number, rolledBatch: number): number {
    const room = Math.max(0, profile.aliveCap - Math.max(0, Math.floor(ordinaryAlive)));
    return Math.min(room, Math.max(0, Math.floor(rolledBatch)));
}

export function scaleBossSkillCooldown(delay: number, overtimeActive: boolean): number {
    return delay * (overtimeActive ? BOSS_OVERTIME_SKILL_COOLDOWN_MULTIPLIER : 1);
}

export function shouldScheduleMiniBoss(wave: number, bossWave: boolean, roll: number): boolean {
    return wave >= MINI_BOSS_START_WAVE && !bossWave && roll < MINI_BOSS_WAVE_CHANCE;
}

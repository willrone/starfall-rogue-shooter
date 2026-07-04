/**
 * Enemy module constants — world boundaries, wave config, crowd AI, hit flash, drop rates.
 */

// ── World boundaries ──────────────────────────────────────────────
export const WORLD_LEFT = -1400;
export const WORLD_RIGHT = 1400;
export const WORLD_BOTTOM = -1800;
export const WORLD_TOP = 1800;
export const WAVES_PER_CYCLE = 10;
export const ORDINARY_WAVES_PER_CYCLE = WAVES_PER_CYCLE - 1;
export const WAVE_MIN_DURATION = 50;
export const WAVE_MAX_DURATION = 60;
export const ENEMY_PLAYER_PADDING = 3;
export const ENEMY_SEPARATION_PADDING = 8;
export const ENEMY_SEPARATION_CELL = 86;
export const ENEMY_SEPARATION_BUCKET_SCAN = 6;
export const ENEMY_SEPARATION_MAX_CHECKS = 18;
export const ENEMY_PROJECTILE_LIMIT = 140;
export const MAX_CHESTS_PER_WAVE = 2;
export const ENEMY_HIT_FLASH_DURATION = 0.14;

// ── Difficulty scaling ────────────────────────────────────────────
export const ENEMY_HP_PROGRESS_SCALE = 2.5;
export const ENEMY_DAMAGE_PROGRESS_SCALE = 1.3;
/** 11 波后的无尽模式：每波指数增长 5% */
export const ENDLESS_SCALE_RATE = 0.05;
export const ENDLESS_START_WAVE = 11;
export const ENEMY_STATUS_KEY_ARMOR = 'armor';
export const ENEMY_STATUS_KEY_DASH = 'dash';
export const ENEMY_SEP_INTERVAL = 0.25;
export const ENEMY_SEP_PLAYER_DIST = 360;
export const ENEMY_CROWD_MIN_COUNT = 18;
export const ENEMY_CROWD_REPEL_RADIUS = 96;
export const ENEMY_CROWD_MAX_NEIGHBORS = 8;
export const ENEMY_CROWD_REPEL_WEIGHT = 1.45;
export const ENEMY_CROWD_ORBIT_WEIGHT = 0.35;
export const FAR_CULL_DIST_SQ = 3240000; // 1800²: enemies farther than this get simplified movement

// ── Drop rates ────────────────────────────────────────────────────
export const NORMAL_ALLOY_DROP_MULTIPLIER = 0.75;
export const NORMAL_MATERIAL_DROP_CHANCE = 0.045;
export const ELITE_MATERIAL_DROP_CHANCE = 0.3;

// ── Visual scaling ────────────────────────────────────────────────
export const ENEMY_VISUAL_SIZE_MULTIPLIER: Record<string, number> = {
    mite: 6.4,
    runner: 6.3,
    brute: 5.2,
    splitter: 5.7,
    warden: 4.6,
    boss: 4.8,
};

export const ENEMY_STRIP_META: Record<string, { frameName: string; frames: number; cellSize: number; fps: number }> = {
    mite: { frameName: 'enemy_mite_walk', frames: 6, cellSize: 64, fps: 8 },
    bomber: { frameName: 'enemy_bomber_walk', frames: 6, cellSize: 64, fps: 8 },
    swarm: { frameName: 'enemy_swarm_walk', frames: 6, cellSize: 64, fps: 8 },
    runner: { frameName: 'enemy_runner_walk', frames: 6, cellSize: 80, fps: 10 },
    brute: { frameName: 'enemy_brute_walk', frames: 6, cellSize: 80, fps: 6 },
    splitter: { frameName: 'enemy_splitter_idle', frames: 6, cellSize: 80, fps: 7 },
    seeker: { frameName: 'enemy_seeker_walk', frames: 6, cellSize: 80, fps: 8 },
    aura: { frameName: 'enemy_aura_idle', frames: 6, cellSize: 80, fps: 8 },
    warden: { frameName: 'enemy_warden_idle', frames: 6, cellSize: 96, fps: 8 },
    beacon: { frameName: 'enemy_beacon_idle', frames: 6, cellSize: 96, fps: 6 },
    boss: { frameName: 'enemy_boss_idle', frames: 8, cellSize: 224, fps: 8 },
    'void-colossus': { frameName: 'enemy_void_colossus_idle', frames: 6, cellSize: 128, fps: 8 },
};

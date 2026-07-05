/**
 * Enemy movement direction helpers.
 *
 * Decoupled from EnemyManager so movement types can be added without
 * touching the 2100-line main file.
 *
 * Movement types:
 *   - follow: always chase the player (default)
 *   - periodic-follow: chase for N sec, pause for M sec, repeat
 */

/** Movement behavioral type for an enemy */
export type MovementType = 'follow' | 'periodic-follow';

/** Configuration for periodic-follow movement */
export interface PeriodicFollowConfig {
    followDuration: number;  // seconds to chase before pause
    pauseDuration: number;   // seconds to stand still
    shootDuringPause: boolean;  // whether the enemy can shoot while paused
}

/** Result of movement direction computation */
export interface MoveDirResult {
    vx: number;        // normalized direction X
    vy: number;        // normalized direction Y
    speedMult: number; // speed multiplier (0 = paused)
}

/**
 * Compute the base direction from (ex, ey) toward (px, py).
 */
export function dirToward(ex: number, ey: number, px: number, py: number): { vx: number; vy: number; dist: number } {
    const dx = px - ex;
    const dy = py - ey;
    const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    return { vx: dx / dist, vy: dy / dist, dist };
}

/**
 * Compute a wobble offset using pre-computed sin/cos values.
 * Based on Sin(a+b) = Sin(a)Cos(b) + Cos(a)Sin(b) — no per-enemy trig.
 */
export function wobbleOffset(wobbleBase: number, cosBase: number, wobbleSin: number, wobbleCos: number): number {
    return (wobbleBase * wobbleCos + cosBase * wobbleSin) * 0.18;
}

/**
 * Get orbital spread tangential component to prevent clumping.
 * Diminishes as enemy gets close to player.
 */
export function orbitSpread(dirX: number, dirY: number, dist: number, enemyId: number): { ox: number; oy: number } {
    const orbitDistanceWeight = Math.min(0.7, Math.max(0, (dist - 180) / 500));
    if (orbitDistanceWeight <= 0.01) return { ox: 0, oy: 0 };
    const sign = enemyId % 2 === 0 ? 1 : -1;
    const w = orbitDistanceWeight * 0.45;
    return { ox: (-dirY) * sign * w, oy: (dirX) * sign * w };
}

/**
 * Determine if an enemy is in "moving" or "paused" phase for periodic-follow.
 *
 * @param timer  accumulated timer (seconds), managed externally
 * @param config periodic-follow config
 * @returns { isMoving: boolean, nextTimer: number } — nextTimer is the new timer value
 *   after possibly wrapping around.
 */
export function periodicFollowPhase(
    dt: number,
    timer: number,
    config: PeriodicFollowConfig,
): { isMoving: boolean; nextTimer: number; newCycle: boolean } {
    const totalCycle = config.followDuration + config.pauseDuration;
    let newTimer = timer + dt;
    let newCycle = false;
    if (newTimer >= totalCycle) {
        newTimer -= totalCycle;
        newCycle = true;
    }
    const isMoving = newTimer < config.followDuration;
    return { isMoving, nextTimer: newTimer, newCycle };
}

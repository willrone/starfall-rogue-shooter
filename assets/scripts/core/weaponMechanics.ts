export const RAIL_BULLET_RADIUS = 7;
export const MIRROR_PRISM_FOCUSED_DAMAGE_MULTIPLIER = 1.65;

export const RICOCHET_MAX_BOUNCES = 2;
export const RICOCHET_ENEMY_RANGE = 420;
export const RICOCHET_DAMAGE_MULTIPLIER = 1.15;

export const METEOR_BURN_RADIUS = 72;
export const METEOR_BURN_TICK_INTERVAL = 0.5;
export const METEOR_BURN_DAMAGE_PER_SECOND = 0.16;
export const METEOR_BURN_SLOW_DURATION = 0.35;
export const METEOR_BURN_SLOW_FACTOR = 0.78;
export const METEOR_IMPACT_AOE_RADIUS = 110;
export const METEOR_IMPACT_AOE_DAMAGE_MULTIPLIER = 0.40;

export const DRONE_CHARGE_PER_KILL = 34;

export const FROST_SLOW_DURATION = 0.6;
export const GRAVITY_BULLET_LIFE = 1.50;
export const GRAVITY_KNOCKBACK_FORCE = 115;
export const GRAVITY_KNOCKBACK_FORCE_CRIT = GRAVITY_KNOCKBACK_FORCE * 2;
export const GRAVITY_IMPACT_RADIUS = 120;
export const GRAVITY_IMPACT_DAMAGE_MULTIPLIER = 0.40;
export const GRAVITY_IMPACT_STUN_DURATION = 0.45;

export const VOID_NEEDLE_CRIT_SPLASH_RADIUS = 75;
export const VOID_NEEDLE_CRIT_SPLASH_DAMAGE_MULTIPLIER = 0.30;

export const QUANTUM_SPLIT_DELAY = 0.42;
export const QUANTUM_SPLIT_ANGLE = 0.30;

export const ICEFIRE_BULLET_LIFE = 1.55;
export const ICEFIRE_SLOW_DURATION = 1.0;
export const ICEFIRE_FROZEN_FIRE_MULTIPLIER = 2.0;
export const ICEFIRE_KILL_AOE_RADIUS = 115;
export const ICEFIRE_KILL_AOE_DAMAGE_MULTIPLIER = 0.45;
export const ICEFIRE_ON_HIT_AOE_RADIUS = 80;
export const ICEFIRE_ON_HIT_AOE_DAMAGE_MULTIPLIER = 0.25;

export interface PeriodicTickConsumption {
    ticks: number;
    remainder: number;
}

export function consumePeriodicTicks(accumulated: number, interval: number, remainingTicks: number): PeriodicTickConsumption {
    if (interval <= 0 || remainingTicks <= 0) return { ticks: 0, remainder: Math.max(0, accumulated) };
    const safeAccumulated = Math.max(0, accumulated);
    const ticks = Math.min(remainingTicks, Math.floor((safeAccumulated + 1e-9) / interval));
    return {
        ticks,
        remainder: Number((safeAccumulated - ticks * interval).toFixed(9)),
    };
}

export function resolveIcefirePrimaryDamageMultiplier(mechanic: string | null, targetIsFrozen: boolean): number {
    return mechanic === 'icefire_fire' && targetIsFrozen ? ICEFIRE_FROZEN_FIRE_MULTIPLIER : 1.0;
}

export function resolvePierceRetention(mechanic: string | null, configuredRetention: number): number {
    return mechanic === 'straight' || mechanic === 'ricochet' ? 1.0 : configuredRetention;
}

export interface MechanicPoint {
    x: number;
    y: number;
}

/**
 * Find the closest active target that this projectile has not already hit.
 * Kept engine-agnostic so the ricochet target selection is deterministic and testable.
 */
export function findNearestRicochetTarget<T extends { id: number }>(
    candidates: readonly T[],
    originX: number,
    originY: number,
    maxRange: number,
    hitIds: ReadonlySet<number>,
    isActive: (candidate: T) => boolean,
    getPosition: (candidate: T) => MechanicPoint,
): T | null {
    let best: T | null = null;
    let bestDistanceSq = maxRange * maxRange;
    for (const candidate of candidates) {
        if (!isActive(candidate) || hitIds.has(candidate.id)) continue;
        const position = getPosition(candidate);
        const dx = position.x - originX;
        const dy = position.y - originY;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > bestDistanceSq) continue;
        best = candidate;
        bestDistanceSq = distanceSq;
    }
    return best;
}

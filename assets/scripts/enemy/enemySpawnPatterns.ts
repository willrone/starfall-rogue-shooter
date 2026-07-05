/**
 * Specialized spawn patterns — reusable spawn formations for enemy waves and boss phases.
 *
 * All methods emit enemies into the EnemyManager's createEnemy pipeline,
 * using EnemySpec data from the catalogs.
 */
import type { EnemySpec } from '../core/types';
import type { EnemyManager } from './enemyManager';
import type { Vec2 } from 'cc';
import { WORLD_LEFT, WORLD_RIGHT, WORLD_BOTTOM, WORLD_TOP } from './enemyConstants';

/** Spawn formation type for debug / tooltip */
export type SpawnFormation = 'random' | 'ring' | 'charge' | 'cross' | 'pincer';

/**
 * Spawn `count` enemies of `spec` evenly around the player in a ring at `radius`.
 * Perfect for boss phase transitions — "surrounded!" moments.
 */
export function spawnCircle(
    mgr: EnemyManager,
    spec: EnemySpec,
    count: number,
    radius: number,
    eliteChance: number = 0,
): void {
    const cap = mgr.getEnemyCap();
    const room = Math.max(0, cap - mgr.enemies.length);
    const total = Math.min(count, room);
    if (total <= 0) return;

    for (let i = 0; i < total; i++) {
        const angle = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.2;
        const r = radius + mgr['ctx'].randomRange(-40, 40);
        const point = mgr.getSpawnPointAroundPlayer(r, angle);
        const elite = Math.random() < eliteChance;
        mgr.createEnemy(spec, point.x, point.y, elite, false);
    }
}

/**
 * Spawn `count` enemies in a charge line coming from one direction.
 * Enemies are placed in a line perpendicular to `angle`, at the edge of the world.
 * They charge straight across with high speed — no tracking.
 *
 * @param angle  direction enemies charge (radians, 0 = right, π/2 = up)
 * @param spread  width of the line formation
 * @param speedMult  speed multiplier (charge enemies move faster than normal)
 */
export function spawnChargeWave(
    mgr: EnemyManager,
    spec: EnemySpec,
    count: number,
    angle: number,
    spread: number = 300,
    speedOverride: number = 0,
): void {
    const cap = mgr.getEnemyCap();
    const room = Math.max(0, cap - mgr.enemies.length);
    const total = Math.min(count, room);
    if (total <= 0) return;

    // Compute spawn origin: on the world edge in the opposite direction of the charge
    const spawnDist = Math.max(WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM) * 0.65;
    const px = mgr['ctx'].playerX;
    const py = mgr['ctx'].playerY;
    const originX = px + Math.cos(angle + Math.PI) * spawnDist;
    const originY = py + Math.sin(angle + Math.PI) * spawnDist;

    // Line direction (perpendicular to charge direction)
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    const padding = 40;
    for (let i = 0; i < total; i++) {
        const offset = (i / Math.max(1, total - 1) - 0.5) * spread + (Math.random() - 0.5) * 30;
        const x = mgr['ctx'].clamp(originX + perpX * offset, WORLD_LEFT + padding, WORLD_RIGHT - padding);
        const y = mgr['ctx'].clamp(originY + perpY * offset, WORLD_BOTTOM + padding, WORLD_TOP - padding);
        mgr.createEnemy(
            { ...spec, speed: speedOverride > 0 ? speedOverride : spec.speed * 2.2 },
            x, y, false, false,
        );
    }
}

/**
 * Spawn enemies in a cross pattern (4 directions, tight clusters).
 * Good for "get out of the way" area-denial.
 */
export function spawnCross(
    mgr: EnemyManager,
    spec: EnemySpec,
    countPerArm: number,
    radius: number,
): void {
    const total = countPerArm * 4;
    const cap = mgr.getEnemyCap();
    const room = Math.max(0, cap - mgr.enemies.length);
    if (total > room) return;

    for (let arm = 0; arm < 4; arm++) {
        const baseAngle = (Math.PI / 2) * arm;
        for (let j = 0; j < countPerArm; j++) {
            const angle = baseAngle + (Math.random() - 0.5) * 0.3;
            const r = radius + mgr['ctx'].randomRange(-30, 80);
            const point = mgr.getSpawnPointAroundPlayer(r, angle);
            mgr.createEnemy(spec, point.x, point.y, false, false);
        }
    }
}

/**
 * Spawn Pincer (双向夹击) — two charge waves from opposite directions,
 * creating a "surrounded! get out of the pocket" moment.
 * Enemies charge from angle and angle+π simultaneously.
 */
export function spawnPincer(
    mgr: EnemyManager,
    spec: EnemySpec,
    countPerWave: number,
    angle: number,
    spread: number = 300,
    speedOverride: number = 0,
): void {
    const cap = mgr.getEnemyCap();
    const room = Math.max(0, cap - mgr.enemies.length);
    const total = Math.min(countPerWave * 2, room);
    const perWave = Math.max(1, Math.floor(total / 2));
    if (perWave <= 0) return;

    const spawnDist = Math.max(WORLD_RIGHT - WORLD_LEFT, WORLD_TOP - WORLD_BOTTOM) * 0.65;
    const px = mgr['ctx'].playerX;
    const py = mgr['ctx'].playerY;
    const padding = 40;

    for (let side = 0; side < 2; side++) {
        const sideAngle = angle + Math.PI * side;
        const originX = px + Math.cos(sideAngle) * spawnDist;
        const originY = py + Math.sin(sideAngle) * spawnDist;

        const perpX = -Math.sin(sideAngle);
        const perpY = Math.cos(sideAngle);

        for (let i = 0; i < perWave; i++) {
            const offset = (i / Math.max(1, perWave - 1) - 0.5) * spread + (Math.random() - 0.5) * 30;
            const x = mgr['ctx'].clamp(originX + perpX * offset, WORLD_LEFT + padding, WORLD_RIGHT - padding);
            const y = mgr['ctx'].clamp(originY + perpY * offset, WORLD_BOTTOM + padding, WORLD_TOP - padding);
            mgr.createEnemy(
                { ...spec, speed: speedOverride > 0 ? speedOverride : spec.speed * 2.2 },
                x, y, false, false,
            );
        }
    }
}

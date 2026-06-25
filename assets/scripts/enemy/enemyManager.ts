import { Color, Graphics, Layers, Node, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import type { CharacterStats, ChestPickupType, DamageType, EnemySpec, PickupType, ResourceType } from '../core/types';
import type { GameEventBus } from '../core/gameContext';
import {
    WORLD_LEFT, WORLD_RIGHT, WORLD_BOTTOM, WORLD_TOP,
    WAVES_PER_CYCLE, ORDINARY_WAVES_PER_CYCLE, WAVE_MIN_DURATION, WAVE_MAX_DURATION,
    ENEMY_PLAYER_PADDING, ENEMY_SEPARATION_PADDING, ENEMY_SEPARATION_CELL,
    ENEMY_SEPARATION_BUCKET_SCAN, ENEMY_SEPARATION_MAX_CHECKS,
    ENEMY_PROJECTILE_LIMIT, MAX_CHESTS_PER_WAVE,
    ENEMY_HIT_FLASH_DURATION, ENEMY_STATUS_KEY_ARMOR, ENEMY_STATUS_KEY_DASH,
    ENEMY_SEP_INTERVAL, ENEMY_SEP_PLAYER_DIST,
    ENEMY_CROWD_MIN_COUNT, ENEMY_CROWD_REPEL_RADIUS, ENEMY_CROWD_MAX_NEIGHBORS,
    ENEMY_CROWD_REPEL_WEIGHT, ENEMY_CROWD_ORBIT_WEIGHT,
    NORMAL_XP_DROP_CHANCE, ELITE_XP_DROP_CHANCE,
    NORMAL_ALLOY_DROP_MULTIPLIER, NORMAL_MATERIAL_DROP_CHANCE, ELITE_MATERIAL_DROP_CHANCE,
    ENEMY_VISUAL_SIZE_MULTIPLIER, ENEMY_STRIP_META,
} from "./enemyConstants";

import { BASE_ENEMY_ARCHETYPES, ENEMY_SPECS } from '../catalogs/enemyCatalog';

import * as EnemyConst from "./enemyConstants";
export * from "./enemyConstants";
import type { SpriteStripAnimation, Enemy } from "./enemyTypes";
export type { SpriteStripAnimation, Enemy } from "./enemyTypes";


export interface EnemyHostContext {
    phase: string;
    bus: GameEventBus;
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
    battleIndex: number;
    killCount: number;
    battleAlloy: number;
    droneHitPulse: number;
    perfSeparationMs: number;
    perfCrowdSteerCalls: number;
    perfCrowdChecks: number;
    perfSepChecks: number;
    perfDrawEnemy: number;

    playerX: number;
    playerY: number;
    playerRadius: number;
    invulnerableTimer: number;
    worldNode: Node | null;

    takeDamage(amount: number, type?: DamageType): void;
    playSfx(name: string, volume?: number, cooldown?: number): void;
    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;
    drawAreaPulse(x: number, y: number, radius: number, color: string): void;
    addSpriteChild(parent: Node, name: string, frameName: string, width: number, height: number): Sprite | null;
    getActiveEquipmentLevel(id: string): number;
    healPlayer(amount: number): void;
    showToast(message: string): void;
    requestBgm(name: string): void;
    dropPickup(type: PickupType, amount: number, x: number, y: number): void;
    scaleResourceAmount(amount: number): number;
    getCharacterStats(): CharacterStats;
    hex(color: string, alpha?: number): Color;
    clamp(v: number, min: number, max: number): number;
    distanceSq(x1: number, y1: number, x2: number, y2: number): number;
    randomRange(min: number, max: number): number;
    randomInt(min: number, max: number): number;
    perfNow(): number;
    scheduleOnce(fn: () => void, delay: number): void;
    createEnemyProjectile(x: number, y: number, angle: number, damage: number, damageType: DamageType, speed: number): void;
    getDamageTypeColor(type: DamageType): string;
    getDroneZapOrigin(): { x: number; y: number };
    drawZap(fromX: number, fromY: number, toX: number, toY: number): void;
    tryDropChest(type: ChestPickupType, x: number, y: number): boolean;
    getEnemyAnimation(spec: EnemySpec, boss: boolean): SpriteStripAnimation | null;
    getEnemyAnimationFrameName(spec: EnemySpec, boss: boolean): string;
    enemyArtName(spec: EnemySpec, boss: boolean): string;
}

export class EnemyManager {
    public nextEnemyId = 1;
    public enemies: Enemy[] = [];
    public enemySet: Set<Enemy> = new Set();
    public enemySepTick = 999;
    public currentWaveSpecs: EnemySpec[] = [];

    constructor(public ctx: EnemyHostContext) {}

    private get cs(): EnemyHostContext {
        return this.ctx;
    }

    public updateSpawning(dt: number) {
        if (this.cs.waveIndex <= 0) {
            this.startNextWave();
        }

        this.cs.waveElapsed += dt;
        this.cs.cycleTime = this.cs.waveElapsed;
        this.cs.waveSpawnTimer -= dt;
        while (this.cs.waveSpawnTimer <= 0) {
            if (this.enemies.length < this.getEnemyCap()) {
                this.spawnCurrentWaveBatch();
            }
            this.cs.waveSpawnTimer += this.getWaveSpawnInterval();
        }

        if (this.cs.waveElapsed < this.cs.waveDuration) return;
        if (this.isBossWave() && !this.cs.bossDefeatedThisWave) {
            this.cs.waveSpawnTimer = Math.min(this.cs.waveSpawnTimer, 0.6);
            return;
        }
        this.startNextWave();
    }
    public enemyShoot(enemy: Enemy, dirX: number, dirY: number) {
        const type = enemy.damageType;
        const spread = enemy.boss ? 5 : enemy.elite ? 3 : enemy.spec.variantId === 'prime' ? 3 : 1;
        const baseAngle = Math.atan2(dirY, dirX);
        const start = -(spread - 1) / 2;
        for (let i = 0; i < spread; i++) {
            const angle = baseAngle + (start + i) * (enemy.boss ? 0.26 : 0.18);
            this.ctx.createEnemyProjectile(
                enemy.node.position.x,
                enemy.node.position.y,
                angle,
                enemy.damage * (enemy.boss ? 0.8 : 0.62),
                type,
                enemy.boss ? 290 : enemy.elite ? 260 : 230,
            );
        }
    }
    public buildEnemyGrid(cellSize: number) {
        const grid = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            const cellX = Math.floor(enemy.node.position.x / cellSize);
            const cellY = Math.floor(enemy.node.position.y / cellSize);
            const key = `${cellX},${cellY}`;
            let bucket = grid.get(key);
            if (!bucket) {
                bucket = [];
                grid.set(key, bucket);
            }
            bucket.push(enemy);
        }
        return grid;
    }
    public updateEnemies(dt: number) {
        const px = this.cs.playerX;
        const py = this.cs.playerY;
        this.enemySepTick += dt;
        const doSeparation = this.enemySepTick >= ENEMY_SEP_INTERVAL && this.enemies.length >= 6;
        if (doSeparation) this.enemySepTick = 0;
        const crowdGrid = this.enemies.length >= ENEMY_CROWD_MIN_COUNT ? this.buildEnemyGrid(ENEMY_SEPARATION_CELL) : null;

        for (const enemy of this.enemies) {
            if (!this.enemySet.has(enemy)) continue;
            const ex = enemy.node.position.x;
            const ey = enemy.node.position.y;
            const dx = px - ex;
            const dy = py - ey;
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            this.updateEnemySkill(enemy, dt, dist, dx / dist, dy / dist);
            const wobble = Math.sin(this.cs.combatTime * 2.4 + enemy.id * 0.73) * 0.18;
            let vx = dx / dist + (-dy / dist) * wobble;
            let vy = dy / dist + (dx / dist) * wobble;
            let moveSpeed = enemy.speed;
            if (enemy.dashTimer > 0) {
                enemy.dashTimer = Math.max(0, enemy.dashTimer - dt);
                vx = enemy.dashVx;
                vy = enemy.dashVy;
                moveSpeed = enemy.speed * (enemy.boss ? 2.15 : 2.9);
            } else if (crowdGrid) {
                const steer = this.getEnemyCrowdSteer(enemy, crowdGrid, ex, ey, dx / dist, dy / dist, dist);
                vx += steer.x;
                vy += steer.y;
                const vLen = Math.max(0.001, Math.sqrt(vx * vx + vy * vy));
                vx /= vLen;
                vy /= vLen;
            }
            let nextX = ex + vx * moveSpeed * dt;
            let nextY = ey + vy * moveSpeed * dt;
            const fromPlayerX = nextX - px;
            const fromPlayerY = nextY - py;
            const playerDist = Math.max(0.001, Math.sqrt(fromPlayerX * fromPlayerX + fromPlayerY * fromPlayerY));
            const collideRadius = enemy.radius + this.cs.playerRadius;
            const attemptedContactDist = Math.min(dist, playerDist);
            if (attemptedContactDist <= collideRadius + 4 && this.cs.invulnerableTimer <= 0) {
                this.ctx.takeDamage(enemy.damage, enemy.damageType);
            }

            const playerGap = enemy.radius + this.cs.playerRadius + ENEMY_PLAYER_PADDING;
            if (playerDist < playerGap) {
                const angle = enemy.id * 2.39996;
                const nx = playerDist > 0.01 ? fromPlayerX / playerDist : Math.cos(angle);
                const ny = playerDist > 0.01 ? fromPlayerY / playerDist : Math.sin(angle);
                nextX = px + nx * playerGap;
                nextY = py + ny * playerGap;
            }
            nextX = this.ctx.clamp(nextX, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius);
            nextY = this.ctx.clamp(nextY, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius);
            enemy.node.setPosition(nextX, nextY, 4);
            // 分帧视觉更新：每 3 帧才更新一次视觉
            enemy.visualSkip = ((enemy.visualSkip || 0) + 1) % 3;
            if (enemy.visualSkip === 0) {
                this.updateEnemyVisual(enemy, dt, vx, vy, moveSpeed);
            }
        }
        if (doSeparation) {
            const sepStart = this.ctx.perfNow();
            this.separateEnemies();
            this.ctx.perfSeparationMs = this.ctx.perfNow() - sepStart;
        }
    }
    public getEnemyCrowdSteer(enemy: Enemy, grid: Map<string, Enemy[]>, ex: number, ey: number, toPlayerX: number, toPlayerY: number, playerDist: number) {
        let sx = 0;
        let sy = 0;
        let checks = 0;
        const cellX = Math.floor(ex / ENEMY_SEPARATION_CELL);
        const cellY = Math.floor(ey / ENEMY_SEPARATION_CELL);
        for (let ox = -1; ox <= 1 && checks < ENEMY_CROWD_MAX_NEIGHBORS; ox++) {
            for (let oy = -1; oy <= 1 && checks < ENEMY_CROWD_MAX_NEIGHBORS; oy++) {
                const bucket = grid.get(`${cellX + ox},${cellY + oy}`);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length && checks < ENEMY_CROWD_MAX_NEIGHBORS; i++) {
                    const other = bucket[i];
                    if (other === enemy || !this.enemySet.has(other)) continue;
                    checks += 1;
                    const dx = ex - other.node.position.x;
                    const dy = ey - other.node.position.y;
                    const minDist = enemy.radius + other.radius + ENEMY_SEPARATION_PADDING;
                    const range = Math.max(ENEMY_CROWD_REPEL_RADIUS, minDist * 1.75);
                    if (Math.abs(dx) > range || Math.abs(dy) > range) continue;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= 0.001 || distSq > range * range) continue;
                    const dist = Math.sqrt(distSq);
                    const pressure = (range - dist) / range;
                    sx += (dx / dist) * pressure * ENEMY_CROWD_REPEL_WEIGHT;
                    sy += (dy / dist) * pressure * ENEMY_CROWD_REPEL_WEIGHT;
                }
            }
        }

        const preferredRing = this.cs.playerRadius + enemy.radius + 42 + (enemy.id % 9) * 13;
        if (playerDist < preferredRing) {
            const outward = (preferredRing - playerDist) / preferredRing;
            sx -= toPlayerX * outward * 1.6;
            sy -= toPlayerY * outward * 1.6;
        }
        if (playerDist < preferredRing + 150) {
            const orbitSign = enemy.id % 2 === 0 ? 1 : -1;
            const orbit = this.ctx.clamp((preferredRing + 150 - playerDist) / 150, 0, 1) * ENEMY_CROWD_ORBIT_WEIGHT;
            sx += -toPlayerY * orbitSign * orbit;
            sy += toPlayerX * orbitSign * orbit;
        }

        this.ctx.perfCrowdSteerCalls += 1;
        this.ctx.perfCrowdChecks += checks;
        return { x: sx, y: sy };
    }
    public updateEnemyVisual(enemy: Enemy, dt: number, vx: number, vy: number, moveSpeed: number) {
        const wasFlashing = enemy.hitFlash > 0;
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

        const statusKey = [
            enemy.armorTimer > 0 ? ENEMY_STATUS_KEY_ARMOR : '',
            enemy.dashTimer > 0 ? ENEMY_STATUS_KEY_DASH : '',
            enemy.hp < enemy.maxHp ? 'wounded' : '',
        ].filter(Boolean).join('|');
        const flashEnded = wasFlashing && enemy.hitFlash <= 0;
        if (statusKey !== enemy.visualStateKey || flashEnded) {
            enemy.visualStateKey = statusKey;
            this.drawEnemy(enemy);
        }

        const dashPulse = enemy.dashTimer > 0 ? 0.12 : 0;
        const hitPulse = enemy.hitFlash > 0 ? (enemy.hitFlash / ENEMY_HIT_FLASH_DURATION) * 0.18 : 0;
        const scaleX = 1 + dashPulse + hitPulse * 0.55;
        const scaleY = 1 - dashPulse * 0.28 + hitPulse;
        if (Math.abs(scaleX - (enemy['_lastScaleX'] || 0)) > 0.005 || Math.abs(scaleY - (enemy['_lastScaleY'] || 0)) > 0.005) {
            enemy.node.setScale(scaleX, Math.max(0.86, scaleY), 1);
            enemy['_lastScaleX'] = scaleX;
            enemy['_lastScaleY'] = scaleY;
        }

        if (enemy.sprite) {
            if (enemy.animation && enemy.animation.frames.length > 0) {
                const frameIndex = Math.floor((this.cs.combatTime + enemy.animSeed * 0.07) * enemy.animation.fps) % enemy.animation.frames.length;
                if (frameIndex !== enemy.animationFrameIndex) {
                    enemy.animationFrameIndex = frameIndex;
                    enemy.sprite.spriteFrame = enemy.animation.frames[frameIndex];
                }
            }
            const spriteNode = enemy.sprite.node;
            const dashAngle = enemy.dashTimer > 0 ? this.ctx.clamp(vx, -1, 1) * -8 : 0;
            if (Math.abs(dashAngle - (enemy['_lastAngle'] || 0)) > 0.5) {
                spriteNode.angle = dashAngle;
                spriteNode.setPosition(0, 0, 0);
                enemy['_lastAngle'] = dashAngle;
            }
            const hitColor = enemy.hitFlash > 0;
            const wasHitColor = enemy['_wasHitColor'] || false;
            if (hitColor !== wasHitColor) {
                enemy.sprite.color = hitColor
                    ? this.ctx.hex('#FFFFFF', 255)
                    : this.getEnemyTint(enemy, enemy.elite ? 255 : 235);
                enemy['_wasHitColor'] = hitColor;
            }
        } else if (enemy.hitFlash > 0) {
            this.drawEnemy(enemy);
        }
    }
    public updateEnemySkill(enemy: Enemy, dt: number, dist: number, dirX: number, dirY: number) {
        enemy.skillTimer -= dt;
        enemy.armorTimer = Math.max(0, enemy.armorTimer - dt);
        if (enemy.spec.variantId === 'regen' && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * (enemy.elite ? 0.007 : 0.0035) * dt);
            if (Math.random() < dt * 0.8) this.drawEnemy(enemy);
        }
        if (enemy.skillTimer > 0) return;

        const nextDelay = this.getEnemySkillDelay(enemy);
        enemy.skillTimer = nextDelay;
        if (this.shouldEnemyDash(enemy, dist)) {
            enemy.dashTimer = enemy.boss ? 0.58 : 0.38;
            enemy.dashVx = dirX;
            enemy.dashVy = dirY;
            this.ctx.spawnFloatingText('冲刺', enemy.node.position.x, enemy.node.position.y + enemy.radius + 20, '#F59E0B', 18);
            return;
        }

        if (this.shouldEnemyShoot(enemy, dist)) {
            this.enemyShoot(enemy, dirX, dirY);
            return;
        }

        if (enemy.spec.variantId === 'armored' || enemy.spec.family === 'brute' || enemy.spec.family === 'warden') {
            enemy.armorTimer = enemy.elite || enemy.boss ? 2.4 : 1.45;
            this.ctx.spawnFloatingText('霸体', enemy.node.position.x, enemy.node.position.y + enemy.radius + 20, '#CBD5E1', 18);
            this.drawEnemy(enemy);
        }
    }
    public getEnemySkillDelay(enemy: Enemy) {
        const base = enemy.elite || enemy.boss ? 1.25 : 1.9;
        if (enemy.spec.family === 'runner' || enemy.spec.variantId === 'swift') return this.ctx.randomRange(1.1, base + 0.45);
        if (enemy.spec.family === 'warden' || enemy.spec.variantId === 'arc') return this.ctx.randomRange(1.45, base + 0.75);
        if (enemy.spec.variantId === 'rage' || enemy.spec.variantId === 'venom' || enemy.spec.variantId === 'crystal') return this.ctx.randomRange(1.55, base + 0.85);
        return this.ctx.randomRange(2.0, 3.4);
    }
    public shouldEnemyDash(enemy: Enemy, dist: number) {
        if (dist < enemy.radius + this.cs.playerRadius + 12) return false;
        if (enemy.spec.family === 'runner' || enemy.spec.variantId === 'swift' || enemy.spec.variantId === 'rage') return true;
        return enemy.elite && Math.random() < 0.34;
    }
    public shouldEnemyShoot(enemy: Enemy, dist: number) {
        if (dist < 120 || dist > 760) return false;
        return enemy.boss
            || enemy.spec.family === 'warden'
            || enemy.spec.variantId === 'acid'
            || enemy.spec.variantId === 'arc'
            || enemy.spec.variantId === 'crystal'
            || enemy.spec.variantId === 'venom'
            || enemy.spec.variantId === 'shade'
            || enemy.spec.variantId === 'prime';
    }
    public separateEnemies() {
        if (this.enemies.length < 6) return;
        const px = this.cs.playerX;
        const py = this.cs.playerY;
        const distSqThreshold = ENEMY_SEP_PLAYER_DIST * ENEMY_SEP_PLAYER_DIST;
        const buckets = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            let ax = enemy.node.position.x;
            let ay = enemy.node.position.y;
            if (!enemy.boss) {
                const edx = ax - px;
                const edy = ay - py;
                if (edx * edx + edy * edy > distSqThreshold) {
                    buckets.delete(`${Math.floor(ax / ENEMY_SEPARATION_CELL)},${Math.floor(ay / ENEMY_SEPARATION_CELL)}`);
                    continue;
                }
            }
            const cellX = Math.floor(ax / ENEMY_SEPARATION_CELL);
            const cellY = Math.floor(ay / ENEMY_SEPARATION_CELL);
            let checks = 0;

            for (let ox = -1; ox <= 1 && checks < ENEMY_SEPARATION_MAX_CHECKS; ox++) {
                for (let oy = -1; oy <= 1 && checks < ENEMY_SEPARATION_MAX_CHECKS; oy++) {
                    const bucket = buckets.get(`${cellX + ox},${cellY + oy}`);
                    if (!bucket) continue;
                    const start = Math.max(0, bucket.length - ENEMY_SEPARATION_BUCKET_SCAN);
                    for (let index = bucket.length - 1; index >= start && checks < ENEMY_SEPARATION_MAX_CHECKS; index--) {
                        checks += 1;
                        const other = bucket[index];
                        let bx = other.node.position.x;
                        let by = other.node.position.y;
                        const minDist = enemy.radius + other.radius + ENEMY_SEPARATION_PADDING;
                        const dx = bx - ax;
                        const dy = by - ay;
                        if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;
                        const distSq = dx * dx + dy * dy;
                        if (distSq >= minDist * minDist) continue;

                        const dist = Math.sqrt(Math.max(0.001, distSq));
                        const angle = (enemy.id * 13.37 + other.id * 3.11) % (Math.PI * 2);
                        const nx = dist > 0.01 ? dx / dist : Math.cos(angle);
                        const ny = dist > 0.01 ? dy / dist : Math.sin(angle);
                        const overlap = minDist - dist;
                        const push = Math.min(14, overlap * 0.42);
                        const enemyInertia = enemy.boss ? 3.2 : enemy.elite ? 1.8 : 1;
                        const otherInertia = other.boss ? 3.2 : other.elite ? 1.8 : 1;
                        const enemyPush = push * (otherInertia / (enemyInertia + otherInertia));
                        const otherPush = push * (enemyInertia / (enemyInertia + otherInertia));

                        ax = this.ctx.clamp(ax - nx * enemyPush, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius);
                        ay = this.ctx.clamp(ay - ny * enemyPush, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius);
                        bx = this.ctx.clamp(bx + nx * otherPush, WORLD_LEFT + other.radius, WORLD_RIGHT - other.radius);
                        by = this.ctx.clamp(by + ny * otherPush, WORLD_BOTTOM + other.radius, WORLD_TOP - other.radius);
                        if (Math.abs(bx - other.node.position.x) > 0.5 || Math.abs(by - other.node.position.y) > 0.5) {
                            other.node.setPosition(bx, by, 4);
                        }
                    }
                }
            }

            if (Math.abs(ax - enemy.node.position.x) > 0.5 || Math.abs(ay - enemy.node.position.y) > 0.5) {
                enemy.node.setPosition(ax, ay, 4);
            }
            this.ctx.perfSepChecks += checks;
            const finalCellX = Math.floor(ax / ENEMY_SEPARATION_CELL);
            const finalCellY = Math.floor(ay / ENEMY_SEPARATION_CELL);
            const key = `${finalCellX},${finalCellY}`;
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = [];
                buckets.set(key, bucket);
            }
            bucket.push(enemy);
        }
    }
    public startNextWave() {
        if (this.cs.phase === 'combat' && this.cs.waveIndex > 0 && !this.isBossWave()) {
            this.grantWaveClearAlloy();
        }
        this.cs.waveIndex += 1;
        this.cs.endlessCycle = Math.floor((this.cs.waveIndex - 1) / WAVES_PER_CYCLE) + 1;
        this.cs.waveElapsed = 0;
        this.cs.cycleTime = 0;
        this.cs.waveDuration = this.ctx.randomRange(WAVE_MIN_DURATION, WAVE_MAX_DURATION);
        this.cs.waveSpawnTimer = 0.15;
        this.cs.bossDefeatedThisWave = false;
        this.cs.waveKillCount = 0;
        this.cs.waveChestDrops = 0;
        this.currentWaveSpecs = this.getWaveEnemySpecs(this.cs.waveIndex);

        if (this.isBossWave()) {
            this.cs.bossSpawned = true;
            this.ctx.requestBgm('bgm_boss_loop');
            this.ctx.playSfx('sfx_boss_warning', 0.9, 1.2);
            this.spawnBoss();
            this.ctx.showToast(`第 ${this.cs.waveIndex} 波：Boss 出现，击杀后才能进入下一波。`);
            return;
        }

        this.cs.bossSpawned = false;
        this.ctx.requestBgm('bgm_combat_loop');
        this.ctx.bus.emit('wave-start', { wave: this.cs.waveIndex, isBoss: this.isBossWave() });
        this.ctx.showToast(`第 ${this.cs.waveIndex} 波开始，${Math.round(this.cs.waveDuration)} 秒内怪潮会持续涌入。`);
    }
    public grantWaveClearAlloy() {
        const baseReward = 8 + this.cs.waveIndex + (this.cs.endlessCycle - 1) * 4;
        const pressureBonus = Math.min(8, Math.floor(this.cs.waveKillCount / 80));
        const reward = Math.round(baseReward + pressureBonus);
        this.cs.battleAlloy += reward;
        this.ctx.showToast(`第 ${this.cs.waveIndex} 波清算：补给合金 +${reward}`);
    }
    public spawnCurrentWaveBatch() {
        const ring = this.isBossWave() || this.cs.waveIndex % 3 === 0;
        const count = this.getWaveSpawnBatchCount();
        const fallback = this.isBossWave() ? ENEMY_SPECS : this.getUnlockedEnemySpecs();
        this.spawnPack(count, ring, this.currentWaveSpecs, fallback);
    }
    public getWaveSpawnInterval() {
        const slot = this.getWaveSlot();
        return Math.max(0.95, 1.55 - slot * 0.035 - (this.cs.endlessCycle - 1) * 0.06 - Math.min(0.12, this.cs.waveElapsed / 420));
    }
    public getWaveSpawnBatchCount() {
        const slot = this.getWaveSlot();
        const pressure = 2 + Math.floor(slot * 0.45) + this.cs.endlessCycle + Math.floor(this.cs.waveElapsed / 24);
        const bossBonus = this.isBossWave() ? 3 : 0;
        return Math.min(22, pressure + bossBonus + this.ctx.randomInt(0, 2));
    }
    public getEnemyCap() {
        return Math.min(420, 110 + this.cs.battleIndex * 3 + this.cs.endlessCycle * 24 + this.cs.waveIndex * 6);
    }
    public getWaveSlot(wave = this.cs.waveIndex) {
        if (wave <= 0) return 1;
        return ((wave - 1) % WAVES_PER_CYCLE) + 1;
    }
    public isBossWave(wave = this.cs.waveIndex) {
        return wave > 0 && wave % WAVES_PER_CYCLE === 0;
    }
    public spawnPack(count: number, ring: boolean, preferredSpecs: EnemySpec[] | null = null, fallbackSpecs: EnemySpec[] | null = null) {
        const cap = this.getEnemyCap();
        const room = Math.max(0, cap - this.enemies.length);
        const guaranteed = preferredSpecs ? preferredSpecs.length : 0;
        const total = Math.min(Math.max(count, guaranteed), room);
        const waveSpecs = preferredSpecs && preferredSpecs.length > 0
            ? preferredSpecs
            : this.pickEnemyWaveSpecs(total, ring, fallbackSpecs);
        const pool = fallbackSpecs && fallbackSpecs.length > 0 ? fallbackSpecs : this.getUnlockedEnemySpecs();
        for (let i = 0; i < total; i++) {
            const spec = waveSpecs.length > 0 && (i < waveSpecs.length || Math.random() < 0.72)
                ? waveSpecs[i % waveSpecs.length]
                : this.pickWeightedEnemySpec(pool);
            const angle = ring ? (Math.PI * 2 * i) / Math.max(1, total) + Math.random() * 0.16 : Math.random() * Math.PI * 2;
            const radius = ring ? 720 : this.ctx.randomRange(640, 840);
            const point = this.getSpawnPointAroundPlayer(radius, angle);
            const eliteChance = Math.min(0.28, 0.025 + this.cs.endlessCycle * 0.018 + this.cs.waveIndex * 0.0035 + this.cs.combatTime * 0.00045);
            this.createEnemy(spec, point.x, point.y, Math.random() < eliteChance, false);
        }
    }
    public spawnBoss() {
        const spec: EnemySpec = {
            id: 'boss',
            name: '星核巨像',
            family: 'boss',
            artId: 'boss',
            hp: 680,
            speed: 64,
            damage: 22,
            radius: 42,
            xp: 45,
            alloyChance: 1,
            color: '#F94144',
            accent: '#7F1D1D',
            spawnAfter: 0,
            weight: 1,
        };
        const point = this.getSpawnPointAroundPlayer(760, Math.random() * Math.PI * 2);
        this.createEnemy(spec, point.x, point.y, true, true);
    }
    public getSpawnPointAroundPlayer(radius: number, angle: number): Vec2 {
        const padding = 92;
        for (let attempt = 0; attempt < 10; attempt++) {
            const tryAngle = angle + attempt * 0.61;
            const x = this.cs.playerX + Math.cos(tryAngle) * radius;
            const y = this.cs.playerY + Math.sin(tryAngle) * radius;
            if (x > WORLD_LEFT + padding && x < WORLD_RIGHT - padding && y > WORLD_BOTTOM + padding && y < WORLD_TOP - padding) {
                return new Vec2(x, y);
            }
        }
        return new Vec2(
            this.ctx.clamp(this.cs.playerX + Math.cos(angle) * radius, WORLD_LEFT + padding, WORLD_RIGHT - padding),
            this.ctx.clamp(this.cs.playerY + Math.sin(angle) * radius, WORLD_BOTTOM + padding, WORLD_TOP - padding),
        );
    }
    public createEnemy(spec: EnemySpec, x: number, y: number, elite: boolean, boss: boolean) {
        const scale = 1 + this.cs.battleIndex * 0.06 + (this.cs.endlessCycle - 1) * 0.28 + this.cs.waveIndex * 0.028 + this.cs.combatTime * 0.0018;
        const eliteScale = boss ? 6.4 + this.cs.endlessCycle * 0.58 : elite ? 2.65 : 1;
        const hp = Math.round(spec.hp * scale * eliteScale);
        const enemyRadius = Math.round(spec.radius * (boss ? 1.55 : elite ? 1.32 : 1.18));
        const node = new Node(`Enemy_${spec.id}_${this.nextEnemyId}`);
        node.layer = Layers.Enum.UI_2D;
        this.ctx.worldNode!.addChild(node);
        node.setPosition(x, y, 4);
        const visualMultiplier = ENEMY_VISUAL_SIZE_MULTIPLIER[boss ? 'boss' : spec.family] || 4.35;
        const enemyVisualSize = enemyRadius * visualMultiplier;
        const enemyNodeSize = Math.max(enemyRadius * 3.5, enemyVisualSize);
        node.addComponent(UITransform).setContentSize(enemyNodeSize, enemyNodeSize);
        const gfx = node.addComponent(Graphics);
        const animation = this.ctx.getEnemyAnimation(spec, boss);
        const sprite = animation
            ? this.ctx.addSpriteChild(node, 'EnemyArt', this.ctx.getEnemyAnimationFrameName(spec, boss), enemyVisualSize, enemyVisualSize)
            : this.ctx.addSpriteChild(node, 'EnemyArt', this.ctx.enemyArtName(spec, boss), enemyVisualSize, enemyVisualSize);
        if (sprite && animation) {
            sprite.spriteFrame = animation.frames[0];
            sprite.node.getComponent(UITransform)?.setContentSize(enemyVisualSize, enemyVisualSize);
        }
        const enemy: Enemy = {
            id: this.nextEnemyId++,
            spec,
            node,
            gfx,
            sprite,
            hp,
            maxHp: hp,
            speed: Math.max(42, spec.speed * (boss ? 0.78 : elite ? 0.9 : 1) + this.cs.endlessCycle * 5 + this.cs.waveIndex * 0.8),
            damage: spec.damage * (boss ? 1.85 : elite ? 1.42 : 1.05) * (1 + (this.cs.endlessCycle - 1) * 0.16 + this.cs.waveIndex * 0.012 + this.cs.combatTime * 0.0009),
            radius: enemyRadius,
            visualRadius: Math.max(enemyRadius + 12, enemyVisualSize * 0.42),
            elite,
            boss,
            damageType: this.getEnemyDamageType(spec, boss),
            skillTimer: this.ctx.randomRange(0.8, 2.6),
            dashTimer: 0,
            dashVx: 0,
            dashVy: 0,
            armorTimer: 0,
            animSeed: Math.random() * Math.PI * 2,
            hitFlash: 0,
            visualStateKey: '',
            animation,
            animationFrameIndex: animation ? 0 : -1,
        };
        this.drawEnemy(enemy);
        this.enemies.push(enemy);
        this.enemySet.add(enemy);
    }
    public getEnemyDamageType(spec: EnemySpec, boss: boolean): DamageType {
        if (boss) return 'magic';
        if (spec.id.indexOf('venom') >= 0 || spec.id.indexOf('acid') >= 0) return 'poison';
        if (spec.id.indexOf('arc') >= 0 || spec.family === 'warden') return 'lightning';
        if (spec.id.indexOf('crystal') >= 0) return 'ice';
        if (spec.id.indexOf('rage') >= 0) return 'fire';
        if (spec.id.indexOf('shade') >= 0 || spec.id.indexOf('prime') >= 0) return 'magic';
        return 'physical';
    }
    public pickEnemySpec(): EnemySpec {
        const available = this.getAvailableEnemySpecs();
        const totalWeight = available.reduce((sum, spec) => sum + spec.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const spec of available) {
            roll -= spec.weight;
            if (roll <= 0) return spec;
        }
        return available[0];
    }
    public pickEnemyWaveSpecs(count: number, ring: boolean, pool: EnemySpec[] | null = null) {
        const available = pool && pool.length > 0 ? pool : this.getAvailableEnemySpecs();
        const waveSize = Math.min(8, Math.max(3, Math.ceil(count / (ring ? 5 : 7))));
        const specs: EnemySpec[] = [];
        const families = BASE_ENEMY_ARCHETYPES
            .map((base) => base.family)
            .filter((family) => available.some((spec) => spec.family === family));

        for (let i = 0; i < waveSize; i++) {
            const family = families.length > 0 ? families[(this.cs.killCount + this.cs.endlessCycle + i) % families.length] : '';
            const familySpecs = available.filter((spec) => !family || spec.family === family);
            specs.push(this.pickWeightedEnemySpec(familySpecs.length > 0 ? familySpecs : available));
        }
        return specs;
    }
    public pickWeightedEnemySpec(pool: EnemySpec[]) {
        const totalWeight = pool.reduce((sum, spec) => sum + spec.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const spec of pool) {
            roll -= spec.weight;
            if (roll <= 0) return spec;
        }
        return pool[0];
    }
    public getAvailableEnemySpecs() {
        return this.getUnlockedEnemySpecs();
    }
    public getUnlockedEnemySpecs() {
        const slot = this.getWaveSlot();
        const wave = this.ctx.clamp(slot >= WAVES_PER_CYCLE ? ORDINARY_WAVES_PER_CYCLE : slot, 1, ORDINARY_WAVES_PER_CYCLE);
        const end = Math.floor((wave * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        return ENEMY_SPECS.slice(0, Math.max(1, end));
    }
    public getWaveEnemySpecs(wave: number) {
        const slot = this.getWaveSlot(wave);
        const ordinaryWave = this.ctx.clamp(slot >= WAVES_PER_CYCLE ? ORDINARY_WAVES_PER_CYCLE : slot, 1, ORDINARY_WAVES_PER_CYCLE);
        const start = Math.floor(((ordinaryWave - 1) * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        const end = Math.floor((ordinaryWave * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        return ENEMY_SPECS.slice(start, Math.max(start + 1, end));
    }
    public damageEnemy(enemy: Enemy, amount: number, color = '#F8FAFC', tag = '') {
        const finalAmount = enemy.armorTimer > 0 ? amount * (enemy.boss ? 0.58 : 0.72) : amount;
        const finalTag = enemy.armorTimer > 0 ? `${tag}霸体 ` : tag;
        this.ctx.spawnFloatingText(
            `${finalTag}${Math.ceil(finalAmount)}`,
            enemy.node.position.x + this.ctx.randomRange(-12, 12),
            enemy.node.position.y + enemy.radius + this.ctx.randomRange(8, 20),
            enemy.armorTimer > 0 ? '#CBD5E1' : color,
            finalTag ? 23 : 21,
        );
        enemy.hitFlash = ENEMY_HIT_FLASH_DURATION;
        this.ctx.playSfx('sfx_hit_enemy', enemy.boss ? 0.46 : 0.32, 0.035);
        enemy.hp -= finalAmount;
        if (enemy.hp <= 0) {
            this.killEnemy(enemy);
        } else {
            this.drawEnemy(enemy);
        }
    }
    public rollOutgoingDamage(enemy: Enemy, baseDamage: number) {
        const stats = this.ctx.getCharacterStats();
        const lethalRoll = Math.random() < stats.lethalChance;
        if (lethalRoll) {
            const lethalDamage = Math.max(baseDamage * stats.lethalDamage, enemy.maxHp * stats.lethalMaxHpPct);
            return { amount: lethalDamage, color: '#F59E0B', tag: '致命 ' };
        }
        if (Math.random() < stats.critChance) {
            return { amount: baseDamage * stats.critDamage, color: '#F9C74F', tag: '暴击 ' };
        }
        return { amount: baseDamage, color: '#F8FAFC', tag: '' };
    }
    public droneStrike(enemy: Enemy, dronePower: number) {
        const damage = 12 + dronePower * 3.4 + this.ctx.getActiveEquipmentLevel('reactor-core') * 2;
        const roll = this.rollOutgoingDamage(enemy, damage);
        this.ctx.droneHitPulse = 0.22;
        this.damageEnemy(enemy, roll.amount, roll.tag ? roll.color : '#90BE6D', roll.tag ? `无人机 ${roll.tag}` : '无人机 ');
        const origin = this.ctx.getDroneZapOrigin();
        this.ctx.drawZap(origin.x, origin.y, enemy.node.position.x, enemy.node.position.y);
    }
    public killEnemy(enemy: Enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index >= 0) this.enemies.splice(index, 1);
        this.enemySet.delete(enemy);
        const x = enemy.node.position.x;
        const y = enemy.node.position.y;
        this.ctx.bus.emit('enemy-killed', { x, y, drops: true, isBoss: enemy.boss, isSplitter: enemy.spec.family === 'splitter', damageType: enemy.damageType });
        if (enemy.boss) this.ctx.bus.emit('boss-defeated', {});
        this.ctx.playSfx(enemy.boss ? 'sfx_boss_die' : 'sfx_enemy_die', enemy.boss ? 0.82 : 0.45, enemy.boss ? 1.0 : 0.045);
        this.drawEnemyDeathBurst(x, y, enemy.radius, enemy.spec.color, enemy.elite || enemy.boss);
        enemy.node.destroy();
        this.cs.killCount += 1;
        this.cs.waveKillCount += 1;

        const xpDropChance = enemy.boss ? 1 : enemy.elite ? ELITE_XP_DROP_CHANCE : NORMAL_XP_DROP_CHANCE;
        if (Math.random() < xpDropChance) {
            const xpMultiplier = enemy.boss ? 3 : enemy.elite ? 2.4 : 2.1;
            this.ctx.dropPickup('xp', Math.max(1, Math.round(enemy.spec.xp * xpMultiplier)), x, y);
        }

        const normalAlloyChance = Math.min(0.32, enemy.spec.alloyChance * NORMAL_ALLOY_DROP_MULTIPLIER + this.cs.waveIndex * 0.004);
        if (enemy.elite || enemy.boss || Math.random() < normalAlloyChance) {
            const alloyAmount = enemy.boss
                ? 18 + this.cs.endlessCycle * 3
                : enemy.elite
                    ? 6 + Math.floor(this.cs.endlessCycle / 2)
                    : this.ctx.randomInt(1, 2) + Math.floor(this.cs.waveIndex / 10);
            this.ctx.dropPickup('alloy', alloyAmount, x + this.ctx.randomRange(-20, 20), y + this.ctx.randomRange(-20, 20));
        }
        if (Math.random() < (enemy.elite ? ELITE_MATERIAL_DROP_CHANCE : NORMAL_MATERIAL_DROP_CHANCE)) {
            const material: ResourceType = enemy.spec.family === 'brute' || enemy.spec.family === 'warden' ? 'circuits' : enemy.spec.family === 'runner' ? 'shards' : 'biomass';
            this.ctx.dropPickup(material, enemy.elite ? this.ctx.randomInt(2, 4) : 1, x + this.ctx.randomRange(-18, 18), y + this.ctx.randomRange(-18, 18));
        }
        if (enemy.elite && Math.random() < 0.18) {
            this.ctx.dropPickup('cores', 1, x + this.ctx.randomRange(-16, 16), y + this.ctx.randomRange(-16, 16));
        }
        if (!enemy.boss && !this.isBossWave() && enemy.elite && Math.random() < 0.055) {
            const chestType: ChestPickupType = Math.random() < 0.14 ? 'chest-rare' : 'chest-common';
            this.ctx.tryDropChest(chestType, x + this.ctx.randomRange(-14, 14), y + this.ctx.randomRange(-14, 14));
        }
        if (enemy.boss) {
            this.ctx.dropPickup('cores', 1 + Math.floor(this.cs.endlessCycle / 3), x, y);
            this.ctx.dropPickup('shards', 7 + this.cs.endlessCycle * 2, x + 18, y + 8);
            this.ctx.dropPickup('crystals', 1 + Math.floor(this.cs.endlessCycle / 2), x - 18, y + 8);
            this.ctx.dropPickup('alloy', 18 + this.cs.endlessCycle * 4, x + 4, y + 36);
            this.ctx.tryDropChest('chest-rare', x, y + 32);
            this.cs.bossKills += 1;
            this.cs.bossDefeatedThisWave = true;
            this.cs.bossSpawned = false;
            this.ctx.requestBgm('bgm_combat_loop');
            this.ctx.showToast(`第 ${this.cs.waveIndex} 波 Boss 已击杀，撑到本波结束进入下一波。`);
        }
        if (this.shouldEnemyExplodeOnDeath(enemy)) {
            this.enemyExplode(x, y, enemy.radius * (enemy.boss ? 3.2 : enemy.elite ? 2.45 : 2.15), enemy.damage * (enemy.boss ? 1.5 : 1.05), enemy.damageType);
        }
        if (enemy.spec.family === 'splitter' && !enemy.elite && !enemy.boss) {
            const room = Math.max(0, this.getEnemyCap() - this.enemies.length);
            const children = Math.min(2, room);
            for (let i = 0; i < children; i++) {
                this.createEnemy(ENEMY_SPECS[0], x + this.ctx.randomRange(-34, 34), y + this.ctx.randomRange(-34, 34), false, false);
            }
        }

        const chip = this.ctx.getActiveEquipmentLevel('vampire-chip');
        if (chip > 0) {
            this.ctx.healPlayer(0.8 + chip * 0.35);
        }
    }
    public drawEnemyDeathBurst(x: number, y: number, radius: number, color: string, rare: boolean) {
        const rings = rare ? 3 : 2;
        for (let i = 0; i < rings; i++) {
            const ringRadius = radius * (1.15 + i * 0.45);
            this.ctx.scheduleOnce(() => this.ctx.drawAreaPulse(x, y, ringRadius, color), i * 0.035);
        }
    }
    public shouldEnemyExplodeOnDeath(enemy: Enemy) {
        return enemy.boss
            || enemy.spec.family === 'splitter'
            || enemy.spec.variantId === 'rage'
            || enemy.spec.variantId === 'acid'
            || enemy.spec.variantId === 'venom'
            || enemy.spec.variantId === 'prime';
    }
    public enemyExplode(x: number, y: number, radius: number, damage: number, damageType: DamageType) {
        this.ctx.drawAreaPulse(x, y, radius, this.ctx.getDamageTypeColor(damageType));
        const distSq = this.ctx.distanceSq(x, y, this.cs.playerX, this.cs.playerY);
        const hitRadius = radius + this.cs.playerRadius;
        if (distSq <= hitRadius * hitRadius && this.cs.invulnerableTimer <= 0) {
            const dist = Math.sqrt(Math.max(0.001, distSq));
            const falloff = this.ctx.clamp(1 - dist / Math.max(1, hitRadius), 0.28, 1);
            this.ctx.takeDamage(damage * falloff, damageType);
        }
    }
    public drawEnemy(enemy: Enemy) {
        this.ctx.perfDrawEnemy += 1;
        enemy.gfx.clear();
        if (enemy.sprite) {
            const visualRadius = enemy.visualRadius || enemy.radius + 8;
            const tint = this.getEnemyTint(enemy, 255);
            enemy.sprite.color = enemy.hitFlash > 0
                ? this.ctx.hex('#FFFFFF', 255)
                : tint;
            enemy.gfx.fillColor = this.ctx.hex('#020617', 145);
            enemy.gfx.ellipse(4, -8, visualRadius + 8, visualRadius * 0.72 + 5);
            enemy.gfx.fill();
            enemy.gfx.fillColor = this.ctx.hex(enemy.spec.color, enemy.boss ? 72 : 58);
            enemy.gfx.circle(0, 0, visualRadius + (enemy.boss ? 12 : 7));
            enemy.gfx.fill();
            enemy.gfx.strokeColor = this.ctx.hex(enemy.hitFlash > 0 ? '#FFFFFF' : enemy.spec.accent, enemy.boss ? 245 : 225);
            enemy.gfx.lineWidth = enemy.boss ? 6 : enemy.elite ? 5 : 4;
            enemy.gfx.circle(0, 0, visualRadius + (enemy.boss ? 8 : 5));
            enemy.gfx.stroke();
            this.drawEnemyVariantMark(enemy);
            if (enemy.elite || enemy.boss) {
                enemy.gfx.strokeColor = this.ctx.hex(enemy.boss ? '#F94144' : '#F8FAFC', enemy.boss ? 245 : 215);
                enemy.gfx.lineWidth = enemy.boss ? 6 : 4;
                enemy.gfx.circle(0, 0, visualRadius + (enemy.boss ? 18 : 11));
                enemy.gfx.stroke();
            }
            if (enemy.armorTimer > 0 || enemy.dashTimer > 0) {
                enemy.gfx.strokeColor = this.ctx.hex(enemy.armorTimer > 0 ? '#CBD5E1' : '#F59E0B', 230);
                enemy.gfx.lineWidth = enemy.armorTimer > 0 ? 5 : 4;
                enemy.gfx.circle(0, 0, visualRadius + (enemy.armorTimer > 0 ? 15 : 10));
                enemy.gfx.stroke();
            }
            if (enemy.hp < enemy.maxHp) {
                const ratio = this.ctx.clamp(enemy.hp / enemy.maxHp, 0, 1);
                const barWidth = Math.max(enemy.radius * 2, visualRadius * 1.45);
                enemy.gfx.fillColor = this.ctx.hex('#0F172A');
                enemy.gfx.roundRect(-barWidth / 2, visualRadius + 10, barWidth, 7, 3);
                enemy.gfx.fill();
                enemy.gfx.fillColor = this.ctx.hex('#F94144');
                enemy.gfx.roundRect(-barWidth / 2, visualRadius + 10, barWidth * ratio, 7, 3);
                enemy.gfx.fill();
            }
            return;
        }
        enemy.gfx.fillColor = this.ctx.hex('#020617', 90);
        enemy.gfx.circle(3, -4, enemy.radius + 3);
        enemy.gfx.fill();
        enemy.gfx.fillColor = enemy.hitFlash > 0
            ? this.ctx.hex('#FFFFFF', 255)
            : this.getEnemyTint(enemy, enemy.elite ? 255 : 230);
        enemy.gfx.circle(0, 0, enemy.radius);
        enemy.gfx.fill();
        enemy.gfx.fillColor = this.ctx.hex(enemy.spec.accent, 210);
        enemy.gfx.circle(-enemy.radius * 0.3, enemy.radius * 0.12, enemy.radius * 0.35);
        enemy.gfx.fill();
        this.drawEnemyVariantMark(enemy);
        enemy.gfx.strokeColor = this.ctx.hex(enemy.elite ? '#F8FAFC' : '#0F172A', enemy.boss ? 255 : 190);
        enemy.gfx.lineWidth = enemy.boss ? 5 : enemy.elite ? 4 : 2;
        enemy.gfx.circle(0, 0, enemy.radius);
        enemy.gfx.stroke();
        if (enemy.armorTimer > 0 || enemy.dashTimer > 0) {
            enemy.gfx.strokeColor = this.ctx.hex(enemy.armorTimer > 0 ? '#CBD5E1' : '#F59E0B', 210);
            enemy.gfx.lineWidth = enemy.armorTimer > 0 ? 4 : 3;
            enemy.gfx.circle(0, 0, enemy.radius + (enemy.armorTimer > 0 ? 9 : 5));
            enemy.gfx.stroke();
        }

        if (enemy.hp < enemy.maxHp) {
            const ratio = this.ctx.clamp(enemy.hp / enemy.maxHp, 0, 1);
            enemy.gfx.fillColor = this.ctx.hex('#0F172A');
            enemy.gfx.roundRect(-enemy.radius, enemy.radius + 6, enemy.radius * 2, 5, 3);
            enemy.gfx.fill();
            enemy.gfx.fillColor = this.ctx.hex('#F94144');
            enemy.gfx.roundRect(-enemy.radius, enemy.radius + 6, enemy.radius * 2 * ratio, 5, 3);
            enemy.gfx.fill();
        }
    }
    public getEnemyTint(enemy: Enemy, alpha = 255) {
        if (enemy.boss) return this.ctx.hex(enemy.spec.color, alpha);
        const palette = [
            enemy.spec.color,
            '#9BE564',
            '#43AA8B',
            '#4CC9F0',
            '#577590',
            '#F9C74F',
            '#F3722C',
            '#B5179E',
            '#A7F3D0',
            '#90BE6D',
            '#F94144',
        ];
        const color = palette[(enemy.spec.variantIndex || 0) % palette.length] || enemy.spec.color;
        return this.ctx.hex(color, alpha);
    }
    public drawEnemyVariantMark(enemy: Enemy) {
        if (enemy.boss) return;
        const variantIndex = enemy.spec.variantIndex || 0;
        if (variantIndex <= 0) return;

        const markColor = this.getEnemyTint(enemy, 235);
        const accentColor = this.ctx.hex(enemy.spec.accent, 220);
        const r = enemy.radius;
        enemy.gfx.strokeColor = markColor;
        enemy.gfx.lineWidth = enemy.elite ? 4 : 3;

        switch (enemy.spec.variantId) {
            case 'acid':
                enemy.gfx.circle(-r * 0.36, -r * 0.16, Math.max(3, r * 0.16));
                enemy.gfx.stroke();
                enemy.gfx.circle(r * 0.28, r * 0.18, Math.max(3, r * 0.13));
                enemy.gfx.stroke();
                break;
            case 'crystal':
                enemy.gfx.moveTo(0, r * 0.72);
                enemy.gfx.lineTo(r * 0.28, 0);
                enemy.gfx.lineTo(0, -r * 0.72);
                enemy.gfx.lineTo(-r * 0.28, 0);
                enemy.gfx.close();
                enemy.gfx.stroke();
                break;
            case 'swift':
                enemy.gfx.moveTo(-r * 0.72, -r * 0.36);
                enemy.gfx.lineTo(r * 0.62, 0);
                enemy.gfx.lineTo(-r * 0.72, r * 0.36);
                enemy.gfx.stroke();
                break;
            case 'armored':
                enemy.gfx.roundRect(-r * 0.62, -r * 0.48, r * 1.24, r * 0.96, Math.max(4, r * 0.12));
                enemy.gfx.stroke();
                break;
            case 'rage':
                enemy.gfx.moveTo(-r * 0.42, r * 0.58);
                enemy.gfx.lineTo(-r * 0.16, r * 0.12);
                enemy.gfx.lineTo(0, r * 0.66);
                enemy.gfx.lineTo(r * 0.18, r * 0.12);
                enemy.gfx.lineTo(r * 0.44, r * 0.58);
                enemy.gfx.stroke();
                break;
            case 'shade':
                enemy.gfx.fillColor = this.ctx.hex('#020617', 90);
                enemy.gfx.circle(0, 0, r * 0.72);
                enemy.gfx.fill();
                enemy.gfx.strokeColor = markColor;
                enemy.gfx.circle(0, 0, r * 0.5);
                enemy.gfx.stroke();
                break;
            case 'arc':
                enemy.gfx.moveTo(-r * 0.32, r * 0.62);
                enemy.gfx.lineTo(r * 0.08, r * 0.08);
                enemy.gfx.lineTo(-r * 0.08, r * 0.08);
                enemy.gfx.lineTo(r * 0.36, -r * 0.62);
                enemy.gfx.stroke();
                break;
            case 'regen':
                enemy.gfx.moveTo(0, r * 0.58);
                enemy.gfx.lineTo(0, -r * 0.58);
                enemy.gfx.moveTo(-r * 0.58, 0);
                enemy.gfx.lineTo(r * 0.58, 0);
                enemy.gfx.stroke();
                break;
            case 'venom':
                enemy.gfx.fillColor = markColor;
                enemy.gfx.circle(0, -r * 0.12, Math.max(4, r * 0.2));
                enemy.gfx.fill();
                enemy.gfx.fillColor = accentColor;
                enemy.gfx.circle(0, -r * 0.12, Math.max(2, r * 0.08));
                enemy.gfx.fill();
                break;
            case 'prime':
                enemy.gfx.circle(0, 0, r * 0.78);
                enemy.gfx.stroke();
                enemy.gfx.circle(0, 0, r * 0.42);
                enemy.gfx.stroke();
                break;
            default:
                enemy.gfx.circle(0, 0, r * 0.62);
                enemy.gfx.stroke();
                break;
        }
    }
    public findNearestEnemy(range: number): Enemy | null {
        let best: Enemy | null = null;
        let bestDist = range * range;
        for (const enemy of this.enemies) {
            const dist = this.ctx.distanceSq(this.cs.playerX, this.cs.playerY, enemy.node.position.x, enemy.node.position.y);
            if (dist < bestDist) {
                best = enemy;
                bestDist = dist;
            }
        }
        return best;
    }
}

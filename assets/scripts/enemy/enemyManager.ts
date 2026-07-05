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
    ENEMY_HP_PROGRESS_SCALE, ENEMY_DAMAGE_PROGRESS_SCALE,
    ENDLESS_SCALE_RATE, ENDLESS_START_WAVE,
    ENEMY_SEP_INTERVAL, ENEMY_SEP_PLAYER_DIST,
    ENEMY_CROWD_MIN_COUNT, ENEMY_CROWD_REPEL_RADIUS, ENEMY_CROWD_MAX_NEIGHBORS,
    ENEMY_CROWD_REPEL_WEIGHT, ENEMY_CROWD_ORBIT_WEIGHT,
    FAR_CULL_DIST_SQ,
    NORMAL_ALLOY_DROP_MULTIPLIER, NORMAL_MATERIAL_DROP_CHANCE, ELITE_MATERIAL_DROP_CHANCE,
    ENEMY_VISUAL_SIZE_MULTIPLIER, ENEMY_STRIP_META,
} from "./enemyConstants";

import { BASE_ENEMY_ARCHETYPES, ENEMY_SPECS, BOSS_SPECS, MINI_BOSS_SPECS } from '../catalogs/enemyCatalog';
import type { CombatState } from '../state/combatState';

import { periodicFollowPhase } from './enemyMovement';
import { spawnCircle, spawnChargeWave, spawnCross, spawnPincer } from './enemySpawnPatterns';
import { POISON_TICK_INTERVAL } from '../core/combatFormulas';

import * as EnemyConst from "./enemyConstants";
export * from "./enemyConstants";
import type { SpriteStripAnimation, Enemy } from "./enemyTypes";
export type { SpriteStripAnimation, Enemy } from "./enemyTypes";

/** 同场次已选过的大 Boss（防止同一波刷出两个不同 Boss） */
let _poolBossThisBattle: EnemySpec[] | null = null;

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function resetBossPool(): void {
    _poolBossThisBattle = shuffleArray(BOSS_SPECS);
}

export interface EnemyHostContext {
    cs: CombatState;
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

    shakeIntensity: number;

    playerX: number;
    playerY: number;
    playerRadius: number;
    invulnerableTimer: number;
    worldNode: Node | null;

    takeDamage(amount: number, type?: DamageType): void;
    playSfx(name: string, volume?: number, cooldown?: number): void;
    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;
    drawAreaPulse(x: number, y: number, radius: number, color: string): void;
    drawAreaCircle(x: number, y: number, radius: number, color: string, duration?: number): void;
    addSpriteChild(parent: Node, name: string, frameName: string, width: number, height: number): Sprite | null;
    getActiveEquipmentLevel(id: string): number;
    healPlayer(amount: number): void;
    addShieldFragment(): void;
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
    rumbleVfx(effect: string): void;
    getDroneZapOrigin(): { x: number; y: number };
    drawZap(fromX: number, fromY: number, toX: number, toY: number): void;
    tryDropChest(type: ChestPickupType, x: number, y: number): boolean;
    tryDropEquipmentBlueprint?(): void;
    gainXp(amount: number): void;
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

    // ── Shared health bar layer ────────────────────────────────────
    private barLayer: Node | null = null;
    private barGfx: Graphics | null = null;

    // ── Ground mark pool ──────────────────────────────────────────
    private groundMarkNodes: Node[] = [];
    private groundMarkGfx: Graphics[] = [];
    private groundMarkTimers: number[] = [];
    private groundMarkNode: Node | null = null;
    private static readonly GROUND_MARK_POOL = 20;
    // Damage type → sprite frame mapping (loaded from AI-generated textures)
    private groundMarkFrames: Record<string, SpriteFrame | null> = {};

    // ── Death particle pool ───────────────────────────────────────
    private deathPartNodes: Node[] = [];
    private deathPartGfx: Graphics[] = [];
    private deathPartLife: number[] = [];
    private deathPartVx: number[] = [];
    private deathPartVy: number[] = [];
    private deathPartColor: string[] = [];
    private deathPartRadius: number[] = [];
    private deathPartNode: Node | null = null;
    private static readonly DEATH_PART_POOL = 40;

    constructor(public ctx: EnemyHostContext) {}

    public loadGroundMarkTextures(): void {
    }

    public initBarLayer(worldNode: Node): void {
        this.barLayer = new Node('BarLayer');
        worldNode.addChild(this.barLayer);
        this.barGfx = this.barLayer.addComponent(Graphics);
        // 批量敌人绘制层
        this._batchGfx = worldNode.addComponent(Graphics);
        // 设ZOrder在敌人节点之上
    }

    public initGroundMarkPool(worldNode: Node): void {
        this.groundMarkNode = new Node('GroundMarks');
        worldNode.addChild(this.groundMarkNode);
        for (let i = 0; i < EnemyManager.GROUND_MARK_POOL; i++) {
            const n = new Node(`GroundMark${i}`);
            this.groundMarkNode.addChild(n);
            n.active = false;
            this.groundMarkNodes.push(n);
            this.groundMarkGfx.push(n.addComponent(Graphics));
            this.groundMarkTimers.push(-1);
        }
    }

    public updateGroundMarks(dt: number): void {
        for (let i = 0; i < this.groundMarkNodes.length; i++) {
            if (this.groundMarkTimers[i] > 0) {
                this.groundMarkTimers[i] -= dt;
                if (this.groundMarkTimers[i] <= 0) {
                    this.groundMarkNodes[i].active = false;
                    this.groundMarkGfx[i].clear();
                }
            }
        }
    }

    public initDeathParticlePool(worldNode: Node): void {
        this.deathPartNode = new Node('DeathParticles');
        worldNode.addChild(this.deathPartNode);
        for (let i = 0; i < EnemyManager.DEATH_PART_POOL; i++) {
            const n = new Node(`DeathPart${i}`);
            this.deathPartNode.addChild(n);
            n.active = false;
            this.deathPartNodes.push(n);
            this.deathPartGfx.push(n.addComponent(Graphics));
            this.deathPartLife.push(-1);
            this.deathPartVx.push(0);
            this.deathPartVy.push(0);
            this.deathPartColor.push('#FFFFFF');
            this.deathPartRadius.push(0);
        }
    }

    public updateDeathParticles(dt: number): void {
        for (let i = 0; i < this.deathPartNodes.length; i++) {
            if (this.deathPartLife[i] > 0) {
                this.deathPartLife[i] -= dt;
                const node = this.deathPartNodes[i];
                const x = node.position.x + this.deathPartVx[i] * dt;
                const y = node.position.y + this.deathPartVy[i] * dt;
                node.setPosition(x, y, 3);
                this.deathPartVy[i] -= 200 * dt; // gravity
                if (this.deathPartLife[i] <= 0) {
                    node.active = false;
                    this.deathPartGfx[i].clear();
                } else {
                    const gfx = this.deathPartGfx[i];
                    gfx.clear();
                    const a = Math.round((this.deathPartLife[i] / 0.6) * 200);
                    const sz = this.deathPartRadius[i] * (0.3 + this.deathPartLife[i] / 0.6 * 0.7);
                    gfx.fillColor = this.ctx.hex(this.deathPartColor[i], a);
                    gfx.circle(0, 0, Math.max(1, sz));
                    gfx.fill();
                }
            }
        }
    }

    private spawnDeathParticles(x: number, y: number, color: string, count: number, baseRadius: number): void {
        for (let p = 0; p < count; p++) {
            let idx = -1;
            for (let i = 0; i < this.deathPartNodes.length; i++) {
                if (this.deathPartLife[i] < 0) { idx = i; break; }
            }
            if (idx < 0) return;
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 280;
            this.deathPartNodes[idx].setPosition(x, y, 3);
            this.deathPartNodes[idx].active = true;
            this.deathPartVx[idx] = Math.cos(angle) * speed;
            this.deathPartVy[idx] = Math.sin(angle) * speed;
            this.deathPartLife[idx] = 0.4 + Math.random() * 0.3;
            this.deathPartColor[idx] = color;
            this.deathPartRadius[idx] = baseRadius * (0.4 + Math.random() * 0.6);
        }
    }

    public drawAllBars(): void {
        if (!this.barGfx) return;
        this.barGfx.clear();
        const now = this.cs.combatTime;
        const totalEnemies = this.enemies.length;
        // 移动端性能保护：怪数>150时只画血量<80%的怪（跳过满血怪的HP条绘制）
        const renderThreshold = totalEnemies > 150 ? 0.5 : 1.0;
        // Boss HP bar — drawn in screen-space (top center)
        const bossEnemy = this.enemies.find((e) => e.boss && e.hp < e.maxHp);
        if (bossEnemy && this.enemySet.has(bossEnemy)) {
            const ratio = this.ctx.clamp(bossEnemy.hp / bossEnemy.maxHp, 0, 1);
            // Bar is drawn at (200, 1236) = roughly center top of 720x1280 canvas
            const barW = 320;
            const barH = 12;
            const barX = 200;
            const barY = 1236;
            this.barGfx.fillColor = this.ctx.hex('#0F172A', 200);
            this.barGfx.roundRect(barX, barY, barW, barH, 6);
            this.barGfx.fill();
            const phaseColor = ratio <= 0.5 ? '#F59E0B' : '#EF4444';
            this.barGfx.fillColor = this.ctx.hex(phaseColor);
            this.barGfx.roundRect(barX, barY, barW * ratio, barH, 6);
            this.barGfx.fill();
            // Boss name
            this.barGfx.strokeColor = this.ctx.hex('#F8FAFC', 150);
            this.barGfx.lineWidth = 1.5;
            this.barGfx.roundRect(barX, barY - 22, barW, 20, 4);
            this.barGfx.stroke();
            this.barGfx.fillColor = this.ctx.hex('#0F172A', 200);
            this.barGfx.roundRect(barX, barY - 22, barW, 20, 4);
            this.barGfx.fill();
        }
        // Normal enemies
        // 性能优化：limit drawn bar count; 怪多时降级为分组采样
        const maxBars = totalEnemies > 200 ? 60 : (totalEnemies > 100 ? 120 : 999);
        let barCount = 0;
        for (const enemy of this.enemies) {
            if (!this.enemySet.has(enemy)) continue;
            if (enemy.hp >= enemy.maxHp) continue;
            const ratio = enemy.hp / enemy.maxHp;
            if (ratio >= renderThreshold) continue;  // 满血怪跳过
            if (now - enemy.lastBarDrawTime < 0.15) continue;
            if (barCount >= maxBars) break;  // 限制单帧绘制数
            enemy.lastBarDrawTime = now;
            const pos = this.getEnemyPosition(enemy);
            const r = enemy.radius || 14;
            if (enemy.boss) continue; // handled above
            barCount++;
            const barW = r * 2;
            const barH = 5;
            const barY = pos.y + r + 8;
            this.barGfx.fillColor = this.ctx.hex('#0F172A');
            this.barGfx.roundRect(pos.x - barW / 2, barY, barW, barH, 3);
            this.barGfx.fill();
            this.barGfx.fillColor = this.ctx.hex('#F94144');
            this.barGfx.roundRect(pos.x - barW / 2, barY, barW * ratio, barH, 3);
            this.barGfx.fill();
        }
    }

    private get cs(): CombatState {
        return this.ctx.cs;
    }

    public getEnemyPosition(enemy: Enemy): { x: number; y: number } {
        const pos = enemy.node.position;
        const px = pos?.x;
        const py = pos?.y;
        if (Number.isFinite(px) && Number.isFinite(py)) {
            enemy._botX = px;
            enemy._botY = py;
            return { x: px, y: py };
        }
        return { x: enemy._botX ?? 0, y: enemy._botY ?? 0 };
    }

    private setEnemyPosition(enemy: Enemy, x: number, y: number, z = 4): void {
        enemy._botX = x;
        enemy._botY = y;
        enemy.node.setPosition(x, y, z);
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
        // Boss 波：超时后停止刷怪，让玩家专心打 Boss
        if (this.isBossWave() && !this.cs.bossDefeatedThisWave) {
            // 不减 spawnTimer → 不会触发 while 循环内的 spawnCurrentWaveBatch
            return;
        }
        this.startNextWave();
    }
    public enemyShoot(enemy: Enemy, dirX: number, dirY: number) {
        const type = enemy.damageType;
        // 虚空巨像: 阶段越高散射越密
        let spread = enemy.boss ? 5 : enemy.elite ? 3 : enemy.spec.variantId === 'prime' ? 3 : 1;
        if (enemy.boss && enemy.spec.family === 'void-colossus') {
            const phase = enemy.spec.variantIndex || 0;
            if (phase >= 3) spread = 10;
            else if (phase >= 2) spread = 8;
            else spread = 5;
        }
        const baseAngle = Math.atan2(dirY, dirX);
        const start = -(spread - 1) / 2;
        for (let i = 0; i < spread; i++) {
            const angle = baseAngle + (start + i) * (enemy.boss ? 0.26 : 0.18);
            const pos = this.getEnemyPosition(enemy);
            this.ctx.createEnemyProjectile(
                pos.x,
                pos.y,
                angle,
                enemy.damage * (enemy.boss ? 0.8 : 0.62),
                type,
                enemy.boss ? 290 : enemy.elite ? 260 : 230,
            );
        }
    }
    /** 往指定方向射击一发（单发版本，供 Boss 扇形攻击用） */
    public enemyShootAt(enemy: Enemy, dirX: number, dirY: number) {
        const d = Math.max(0.001, Math.sqrt(dirX * dirX + dirY * dirY));
        const type = enemy.damageType;
        const pos = this.getEnemyPosition(enemy);
        this.ctx.createEnemyProjectile(pos.x, pos.y, Math.atan2(dirY, dirX), enemy.damage * 0.72, type, enemy.boss ? 295 : 245);
    }
    public buildEnemyGrid(cellSize: number) {
        const grid = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            const pos = this.getEnemyPosition(enemy);
            const cellX = Math.floor(pos.x / cellSize);
            const cellY = Math.floor(pos.y / cellSize);
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
        // Pre-compute wobble base once per frame (sin addition formula)
        const wobbleTime = this.cs.combatTime * 2.4;
        const wobbleBase = Math.sin(wobbleTime);
        const cosBase = Math.cos(wobbleTime);
        // 帧计数器：远怪隔N帧更新一次以节省CPU
        this._updateFrameCounter = (this._updateFrameCounter || 0) + 1;

        for (const enemy of this.enemies) {
            if (!this.enemySet.has(enemy)) continue;
            const { x: ex, y: ey } = this.getEnemyPosition(enemy);
            const dx = px - ex;
            const dy = py - ey;
            const distSq = dx * dx + dy * dy;

            // ── 状态效果（毒/减速等）必须在所有优化分支前处理，确保远处/降频敌人也能 tick DoT ─────
            this.updateEnemyStatusEffects(enemy, dt);

            // Distance culling: enemies far from screen get simplified movement
            if (distSq > FAR_CULL_DIST_SQ) {
                const dist = Math.max(0.001, Math.sqrt(distSq));
                let mvx = dx / dist;
                let mvy = dy / dist;
                if (enemy.dashTimer > 0) {
                    enemy.dashTimer = Math.max(0, enemy.dashTimer - dt);
                    mvx = enemy.dashVx;
                    mvy = enemy.dashVy;
                }
                this.setEnemyPosition(
                    enemy,
                    this.ctx.clamp(ex + mvx * enemy.speed * dt, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius),
                    this.ctx.clamp(ey + mvy * enemy.speed * dt, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius),
                );
                continue;
            }

            // ── 远怪降频优化：距离>600的怪不每帧跑完整AI/碰撞 ─────
            const frame = this._updateFrameCounter;
            const shouldSkipFullUpdate = !enemy.boss && !enemy.elite && (
                (distSq > 1200 * 1200 && frame % 5 !== 0)
                || (distSq > 600 * 600 && frame % 3 !== 0)
            );
            if (shouldSkipFullUpdate) {
                // 简化移动：直接朝玩家方向走
                const dist = Math.max(0.001, Math.sqrt(distSq));
                const dirX = dx / dist;
                const dirY = dy / dist;
                let speed = enemy.speed;
                if (enemy.slowTimer > 0) {
                    speed *= enemy.slowFactor;
                    enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
                }
                this.setEnemyPosition(
                    enemy,
                    this.ctx.clamp(ex + dirX * speed * dt, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius),
                    this.ctx.clamp(ey + dirY * speed * dt, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius),
                );
                continue;
            }

            const dist = Math.max(0.001, Math.sqrt(distSq));
            const dirX = dx / dist;
            const dirY = dy / dist;
            this.updateEnemySkill(enemy, dt, dist, dirX, dirY);
            // Wobble: sin(a+b) = sin(a)cos(b) + cos(a)sin(b) — no per-enemy trig call
            const wobble = (wobbleBase * enemy.wobbleCos + cosBase * enemy.wobbleSin) * 0.18;
            let vx = dirX + (-dirY) * wobble;
            let vy = dirY + (dirX) * wobble;
            // Orbit spread: enemies far from the player add a tangential component so
            // they approach in a curve rather than a straight line, spreading out along
            // the circumference instead of clumping into a single ball.
            // Effect diminishes as they get close (within ~150 units they converge directly).
            const orbitDistanceWeight = Math.min(0.7, Math.max(0, (dist - 180) / 500));
            if (orbitDistanceWeight > 0.01) {
                const orbitSign = enemy.id % 2 === 0 ? 1 : -1;
                vx += (-dirY) * orbitSign * orbitDistanceWeight * 0.45;
                vy += (dirX) * orbitSign * orbitDistanceWeight * 0.45;
            }
            let moveSpeed = enemy.speed;
            // ── 远程怪"追→停→射"节奏 ──
            // seeker / aura 等远程怪：追一阵→停住射击→再追
            if (enemy.movementType === 'periodic-follow') {
                const { isMoving, nextTimer } = periodicFollowPhase(dt, enemy.periodicFollowTimer, {
                    followDuration: 2.0,
                    pauseDuration: 1.5,
                    shootDuringPause: true,
                });
                enemy.periodicFollowTimer = nextTimer;
                if (!isMoving) {
                    // Paused: 不移动, 但技能(射击)在 updateEnemySkill 中已触发
                    moveSpeed = 0;
                }
            }
            if (enemy.dashTimer > 0) {
                enemy.dashTimer = Math.max(0, enemy.dashTimer - dt);
                vx = enemy.dashVx;
                vy = enemy.dashVy;
                moveSpeed = enemy.speed * (enemy.boss ? 2.15 : 2.9);
                moveSpeed = Math.max(0, moveSpeed);
            } else if (crowdGrid) {
                // ── 机制词条: 减速 (霜束) ───────────────────────────
                if (enemy.slowTimer > 0) {
                    enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
                    moveSpeed *= enemy.slowFactor;
                }
                // ── 机制词条: 击退 (重力锤) ───────────────────────────
                if (enemy.knockbackVx !== 0 || enemy.knockbackVy !== 0) {
                    const knockDecay = Math.max(0, 1 - dt * 6);
                    const kbx = enemy.knockbackVx * knockDecay * dt;
                    const kby = enemy.knockbackVy * knockDecay * dt;
                    this.setEnemyPosition(enemy, ex + kbx, ey + kby);
                    if (Math.abs(enemy.knockbackVx) < 5) enemy.knockbackVx = 0;
                    else enemy.knockbackVx *= knockDecay;
                    if (Math.abs(enemy.knockbackVy) < 5) enemy.knockbackVy = 0;
                    else enemy.knockbackVy *= knockDecay;
                }
                const steer = this.getEnemyCrowdSteer(enemy, crowdGrid, ex, ey, dirX, dirY, dist);
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
            const playerDistSq = fromPlayerX * fromPlayerX + fromPlayerY * fromPlayerY;
            const collideRadius = enemy.radius + this.cs.playerRadius;
            const collideThreshold = collideRadius + 4;
            if (playerDistSq <= collideThreshold * collideThreshold && this.cs.invulnerableTimer <= 0) {
                this.ctx.takeDamage(enemy.damage, enemy.damageType);
            }

            const playerGap = enemy.radius + this.cs.playerRadius + ENEMY_PLAYER_PADDING;
            const gapSq = playerGap * playerGap;
            if (playerDistSq < gapSq) {
                const playerDist = Math.max(0.001, Math.sqrt(playerDistSq));
                const angle = enemy.id * 2.39996;
                const nx = fromPlayerX / playerDist;
                const ny = fromPlayerY / playerDist;
                nextX = px + nx * playerGap;
                nextY = py + ny * playerGap;
            }
            nextX = this.ctx.clamp(nextX, WORLD_LEFT + enemy.radius, WORLD_RIGHT - enemy.radius);
            nextY = this.ctx.clamp(nextY, WORLD_BOTTOM + enemy.radius, WORLD_TOP - enemy.radius);
            this.setEnemyPosition(enemy, nextX, nextY);
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

    public updateEnemyStatusEffects(enemy: Enemy, dt: number) {
        // ── 机制词条: 毒 (瘟疫) ───────────────────────────────
        // 必须在远怪降频优化之前调用，确保即使远处的敌人也能正常 tick DoT
        if (enemy.poisonStacks > 0) {
            enemy.poisonDuration = Math.max(0, (enemy.poisonDuration || 0) - dt);
            if (enemy.poisonDuration <= 0) {
                enemy.poisonStacks = 0;
                enemy.poisonDps = 0;
                enemy.poisonTimer = 0;
            } else {
                enemy.poisonTimer -= dt;
                if (enemy.poisonTimer <= 0) {
                    // tick: 每层每秒固定伤害；喷雾本身只叠层，不做多次直伤。
                    const dot = (enemy.poisonDps || 2) * enemy.poisonStacks * POISON_TICK_INTERVAL;
                    enemy.hp -= dot;
                    if (enemy.hp <= 0) {
                        this.killEnemy(enemy);
                    } else {
                        const p = this.getEnemyPosition(enemy);
                        this.ctx.spawnFloatingText(`毒${enemy.poisonStacks} ${Math.ceil(dot)}`, p.x, p.y + enemy.radius + 8, '#84CC16', 18);
                    }
                    enemy.poisonTimer += POISON_TICK_INTERVAL;
                    if (enemy.poisonTimer <= 0) enemy.poisonTimer = POISON_TICK_INTERVAL;
                }
            }
        }
    }

    public updateEnemySkill(enemy: Enemy, dt: number, dist: number, dirX: number, dirY: number) {
        enemy.skillTimer -= dt;
        enemy.armorTimer = Math.max(0, enemy.armorTimer - dt);
        if (enemy.spec.variantId === 'regen' && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * (enemy.elite ? 0.007 : 0.0035) * dt);
            if (Math.random() < dt * 0.8) this.drawEnemy(enemy);
        }
        // 灵能体 (aura): 光环 buff 附近友军
        if (enemy.spec.family === 'aura' && enemy.hp > 0) {
            const pos = this.getEnemyPosition(enemy);
            this.ctx.drawAreaPulse(pos.x, pos.y, 80, '#38BDF8');
            for (const other of this.enemies) {
                if (other === enemy || !this.enemySet.has(other)) continue;
                const oPos = this.getEnemyPosition(other);
                const dx = pos.x - oPos.x;
                const dy = pos.y - oPos.y;
                if (dx * dx + dy * dy <= 80 * 80) {
                    // 施加标记: 伤害+30%, 速度+20% (通过变体标记实现)
                    // 实际用 enemy.dashTimer 作为"受buff"标记
                    other.dashVx = 1; // 标记已受buff (非0 = buffed)
                }
            }
        }
        // 蜂群 (swarm): 组群移动, 接近玩家时分散环绕
        if (enemy.spec.family === 'swarm') {
            if (dist < 200) {
                // 分散环绕: 给横向速度分量
                const orbitSign = (enemy.id % 2 === 0) ? 1 : -1;
                const orbitForce = (200 - dist) / 200 * 1.5;
                enemy.dashVx += Math.cos(Math.atan2(dirY, dirX) + Math.PI/2 * orbitSign) * orbitForce * dt * 60;
                enemy.dashVy += Math.sin(Math.atan2(dirY, dirX) + Math.PI/2 * orbitSign) * orbitForce * dt * 60;
            }
        }

        if (enemy.skillTimer > 0) return;

        const nextDelay = this.getEnemySkillDelay(enemy);
        enemy.skillTimer = nextDelay;
        if (this.shouldEnemyDash(enemy, dist)) {
            enemy.dashTimer = enemy.boss ? 0.58 : 0.38;
            enemy.dashVx = dirX;
            enemy.dashVy = dirY;
            const pos = this.getEnemyPosition(enemy);
            this.ctx.spawnFloatingText('冲刺', pos.x, pos.y + enemy.radius + 20, '#F59E0B', 18);
            return;
        }

        // 追踪眼 (seeker): 保持距离射击
        if (enemy.spec.family === 'seeker') {
            if (dist < 200) {
                // 后退
                enemy.dashTimer = 0.3;
                enemy.dashVx = -dirX;
                enemy.dashVy = -dirY;
            }
        }

        if (this.shouldEnemyShoot(enemy, dist)) {
            this.enemyShoot(enemy, dirX, dirY);
            return;
        }

        // 信标 (beacon): 召唤怪
        if (enemy.spec.family === 'beacon') {
            const pos = this.getEnemyPosition(enemy);
            this.ctx.spawnFloatingText('召唤', pos.x, pos.y + enemy.radius + 20, '#FCD34D', 18);
            this.spawnPack(2, false, null, null);
            return;
        }

        // 虚空巨像 Phase 3: 全屏脉冲
        if (enemy.boss && enemy.spec.family === 'void-colossus' && (enemy.spec.variantIndex || 0) >= 3) {
            enemy.skillTimer -= dt;
            if (enemy.skillTimer <= 0) {
                enemy.skillTimer = 3.0;
                const pos = this.getEnemyPosition(enemy);
                this.ctx.drawAreaPulse(pos.x, pos.y, 400, '#22D3EE');
                // 对其它怪物造成伤害
                for (const other of this.enemies) {
                    if (!this.enemySet.has(other)) continue;
                    const oPos = this.getEnemyPosition(other);
                    const dx = pos.x - oPos.x;
                    const dy = pos.y - oPos.y;
                    if (dx * dx + dy * dy <= 400 * 400) {
                        this.damageEnemy(other, enemy.damage * 0.6, '#22D3EE', '脉冲 ');
                    }
                }
                // 对玩家造成范围伤害
                const pdx = pos.x - this.cs.playerX;
                const pdy = pos.y - this.cs.playerY;
                if (pdx * pdx + pdy * pdy <= 400 * 400) {
                    this.ctx.takeDamage(enemy.damage * 0.4, enemy.damageType);
                }
            }
        }

        if (enemy.spec.variantId === 'armored' || enemy.spec.family === 'brute' || enemy.spec.family === 'warden') {
            enemy.armorTimer = enemy.elite || enemy.boss ? 2.4 : 1.45;
            const pos = this.getEnemyPosition(enemy);
            this.ctx.spawnFloatingText('霸体', pos.x, pos.y + enemy.radius + 20, '#CBD5E1', 18);
            this.drawEnemy(enemy);
        }

        // ── 小 Boss AI ───────────────────────────────────────────────────────

        // 狂暴重甲块 (brute-prime): 霸体+高接触伤+缓慢
        if (enemy.spec.family === 'brute-prime') {
            // 被动光环: 减速附近玩家
            const pos = this.getEnemyPosition(enemy);
            if (this.cs.slowTimer <= 0) {
                this.ctx.spawnFloatingText('重压', pos.x, pos.y - enemy.radius - 20, '#78350F', 16);
                this.cs.slowTimer = 0.5;
                this.cs.slowFactor = 0.72;
            }
        }

        // 电弧灵能体 (aura-arc): 连锁闪电
        if (enemy.spec.family === 'aura-arc' && enemy.skillTimer <= 0) {
            const pos = this.getEnemyPosition(enemy);
            // 对玩家直接射击
            const dx = this.cs.playerX - pos.x;
            const dy = this.cs.playerY - pos.y;
            const d = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            this.enemyShoot(enemy, dx / d, dy / d);
            // 连锁闪电: 弹射最多3个其他敌人
            const chainTargets: Enemy[] = [];
            for (const other of this.enemies) {
                if (other === enemy || !this.enemySet.has(other)) continue;
                const oPos = this.getEnemyPosition(other);
                const odx = oPos.x - pos.x;
                const ody = oPos.y - pos.y;
                if (odx * odx + ody * ody <= 180 * 180) {
                    chainTargets.push(other);
                    if (chainTargets.length >= 3) break;
                }
            }
            for (const target of chainTargets) {
                const oPos2 = this.getEnemyPosition(target);
                this.ctx.drawAreaPulse(oPos2.x, oPos2.y, 12, '#60A5FA');
                this.damageEnemy(target, enemy.damage * 0.55, '#60A5FA', '闪电 ');
            }
            this.ctx.playSfx('sfx_boss_warning', 0.4, 0.5);
            enemy.skillTimer = this.ctx.randomRange(1.6, 2.8);
        }

        // 自爆母体 (bomber-mother): 附近有敌人时开始倒计时 → 爆炸
        if (enemy.spec.family === 'bomber-mother') {
            // 检查附近是否有其他敌人
            const pos = this.getEnemyPosition(enemy);
            let nearbyCount = 0;
            for (const other of this.enemies) {
                if (other === enemy || !this.enemySet.has(other)) continue;
                const oPos = this.getEnemyPosition(other);
                const dx = oPos.x - pos.x;
                const dy = oPos.y - pos.y;
                if (dx * dx + dy * dy <= 200 * 200) nearbyCount++;
            }
            if (nearbyCount >= 2 && enemy.explodeTimer <= 0 && !(enemy as any)._minibossExploded) {
                // 开始倒计时
                enemy.explodeTimer = 2.5;
                this.ctx.spawnFloatingText('自爆!', pos.x, pos.y + enemy.radius + 20, '#EF4444', 22);
                this.ctx.playSfx('sfx_boss_warning', 0.8, 0.3);
            }
            if (enemy.explodeTimer > 0) {
                enemy.explodeTimer -= dt;
                // 闪烁效果: 每0.5s变色
                const flash = Math.sin(this.cs.combatTime * 20) > 0;
                enemy.hitFlash = flash ? 0.15 : 0;
                this.drawEnemy(enemy);
                if (enemy.explodeTimer <= 0 && !(enemy as any)._minibossExploded) {
                    // 爆炸! 对范围内所有敌人和玩家造成伤害
                    (enemy as any)._minibossExploded = true;
                    this.ctx.drawAreaPulse(pos.x, pos.y, 220, '#FCA5A5');
                    this.ctx.shakeIntensity = Math.max(this.ctx.shakeIntensity, 3);
                    this.ctx.playSfx('sfx_boss_warning', 1.0, 0.2);
                    // 对其他敌人
                    for (const other of this.enemies) {
                        if (other === enemy || !this.enemySet.has(other)) continue;
                        const oPos2 = this.getEnemyPosition(other);
                        const dx = oPos2.x - pos.x;
                        const dy = oPos2.y - pos.y;
                        if (dx * dx + dy * dy <= 220 * 220) {
                            this.damageEnemy(other, enemy.damage * 0.8, '#FCA5A5', '自爆 ');
                        }
                    }
                    // 对玩家
                    const pdx = pos.x - this.cs.playerX;
                    const pdy = pos.y - this.cs.playerY;
                    if (pdx * pdx + pdy * pdy <= 220 * 220) {
                        this.ctx.takeDamage(enemy.damage * 0.9, enemy.damageType);
                    }
                    // 母体自杀
                    this.damageEnemy(enemy, enemy.hp, '#FCA5A5', '自爆 ');
                }
            }
        }

        // 迅捷分裂体 (splitter-swift): 高速+击杀时分裂成2个小体
        // 分裂逻辑在 killEnemy 里处理，这里仅确保高速追击

        // 再生巨兽 (warden-regen): 每秒回复 2% maxHp
        if (enemy.spec.family === 'warden-regen') {
            if (enemy.hp < enemy.maxHp) {
                const regen = enemy.maxHp * 0.02 * dt;
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + regen);
                // 每2秒显示一次回复
                if (enemy.skillTimer <= 0 && enemy.hp < enemy.maxHp) {
                    const pos = this.getEnemyPosition(enemy);
                    this.ctx.spawnFloatingText('回复', pos.x, pos.y - enemy.radius - 20, '#34D399', 16);
                    enemy.skillTimer = 2.0;
                }
            }
        }

        // ── 大 Boss 持续行为 ───────────────────────────────────────────

        // 噬能蠕虫: 钻地消失 → 消失计时 → 冲锋硬直 → 重新出现
        if (enemy.spec.family === 'energy-worm' && enemy.boss) {
            if (enemy.burrowedTimer > 0) {
                // 钻地中: 隐藏视觉，缓慢恢复HP
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.008 * dt);
                if (enemy.burrowedTimer <= 0) {
                    // 破土出现
                    const pos = this.getEnemyPosition(enemy);
                    this.ctx.drawAreaPulse(pos.x, pos.y, 80, '#A3E635');
                    this.ctx.spawnFloatingText('破土!', pos.x, pos.y, '#A3E635', 20);
                    this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 2);
                }
                return; // 钻地时不执行其他行为
            }
            if (enemy.stunTimer > 0) {
                // 硬直中: 不动
                return;
            }
            // 正常移动，每4-6秒钻地消失
            if (enemy.skillTimer <= 0) {
                enemy.burrowedTimer = 1.8;
                enemy.stunTimer = 0;
                const pos = this.getEnemyPosition(enemy);
                this.ctx.spawnFloatingText('钻地!', pos.x, pos.y, '#A3E635', 20);
                this.ctx.playSfx('sfx_boss_warning', 0.6, 0.4);
                enemy.skillTimer = this.ctx.randomRange(4.5, 6.5);
                return;
            }
            // 钻地计时
            if (enemy.burrowedTimer > 0) {
                enemy.burrowedTimer -= dt;
                if (enemy.burrowedTimer <= 0) {
                    // 破土后立即冲向玩家方向
                    enemy.burrowedTimer = 0;
                    enemy.stunTimer = 0.9;
                    const px = this.cs.playerX;
                    const py = this.cs.playerY;
                    const pos = this.getEnemyPosition(enemy);
                    const dx = px - pos.x;
                    const dy = py - pos.y;
                    const d = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
                    enemy.dashTimer = 0.55;
                    enemy.dashVx = dx / d * 3.2;
                    enemy.dashVy = dy / d * 3.2;
                    this.ctx.spawnFloatingText('冲锋!', pos.x, pos.y, '#A3E635', 22);
                    this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3);
                    return;
                }
            }
        }

        // 冰霜女皇: 冰霜光环减速 + 扇形冰刺(Phase1)
        if (enemy.spec.family === 'frost-queen' && enemy.boss) {
            const pos = this.getEnemyPosition(enemy);
            // 被动光环: 玩家减速
            if (this.cs.slowTimer <= 0) {
                this.cs.slowTimer = 0.4;
                this.cs.slowFactor = enemy.spec.variantIndex >= 1 ? 0.55 : 0.78;
            }
            // Phase 1+: 扇形冰刺
            if (enemy.spec.variantIndex >= 1 && enemy.skillTimer <= 0) {
                const pdx = this.cs.playerX - pos.x;
                const pdy = this.cs.playerY - pos.y;
                const baseAngle = Math.atan2(pdy, pdx);
                const coneCount = 5;
                const coneSpread = Math.PI * 0.35;
                for (let i = 0; i < coneCount; i++) {
                    const angle = baseAngle - coneSpread / 2 + (coneSpread / (coneCount - 1)) * i;
                    this.enemyShootAt(enemy, Math.cos(angle), Math.sin(angle));
                }
                this.ctx.drawAreaPulse(pos.x, pos.y, 120, '#93C5FD');
                this.ctx.spawnFloatingText('冰刺!', pos.x, pos.y + enemy.radius + 20, '#93C5FD', 20);
                this.ctx.playSfx('sfx_boss_warning', 0.6, 0.35);
                enemy.skillTimer = this.ctx.randomRange(2.5, 4.0);
            }
        }

        // 狱炎领主: 扇形旋转火焰(Phase1)
        if (enemy.spec.family === 'inferno-lord' && enemy.boss) {
            if (enemy.spec.variantIndex >= 1) {
                enemy.rotationTimer = (enemy.rotationTimer || 0) + dt;
                // 旋转火球: 每0.4秒从4个方向射出
                if (enemy.skillTimer <= 0) {
                    const pos = this.getEnemyPosition(enemy);
                    const baseAngle = enemy.rotationTimer * 1.8;
                    for (let i = 0; i < 4; i++) {
                        const angle = baseAngle + (Math.PI / 2) * i;
                        this.enemyShootAt(enemy, Math.cos(angle), Math.sin(angle));
                    }
                    this.ctx.drawAreaPulse(pos.x, pos.y, 60, '#EF4444');
                    enemy.skillTimer = 0.4;
                }
                // 场地持续火焰: 每3秒放一个火圈
                if (enemy.skillTimer <= 0 && Math.floor((enemy.rotationTimer) * 10) % 30 === 0) {
                    const pos = this.getEnemyPosition(enemy);
                    this.ctx.drawAreaPulse(pos.x, pos.y, 180, '#F97316');
                }
            }
        }

        // 虚空织网者: 护盾 + 召唤小蜘蛛
        if (enemy.spec.family === 'void-weaver' && enemy.boss) {
            // 初始化护盾
            if (enemy.shieldMaxHp <= 0) {
                enemy.shieldMaxHp = Math.round(enemy.maxHp * 0.5);
                enemy.shieldHp = enemy.shieldMaxHp;
                enemy.spiderCount = 0;
            }
            // 护盾持续回复(阶段0)
            if (enemy.spec.variantIndex === 0 && enemy.shieldHp < enemy.shieldMaxHp) {
                enemy.shieldHp = Math.min(enemy.shieldMaxHp, enemy.shieldHp + enemy.shieldMaxHp * 0.003 * dt);
            }
            // Phase 0: 定期召唤小蜘蛛
            if (enemy.spec.variantIndex === 0 && enemy.skillTimer <= 0) {
                const pos = this.getEnemyPosition(enemy);
                for (let i = 0; i < 2; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const offset = enemy.radius + 30;
                    const sx = this.ctx.clamp(pos.x + Math.cos(angle) * offset, WORLD_LEFT + 60, WORLD_RIGHT - 60);
                    const sy = this.ctx.clamp(pos.y + Math.sin(angle) * offset, WORLD_BOTTOM + 60, WORLD_TOP - 60);
                    const scale = this.getEndlessScale();
                    this.createEnemy({
                        id: 'spider-minion',
                        name: '蛛网幼虫',
                        family: 'swarm',
                        artId: 'swarm',
                        hp: Math.round(80 * scale),
                        speed: 130,
                        damage: enemy.damage * 0.25,
                        radius: 12,
                        xp: 0,
                        alloyChance: 0,
                        color: '#4C1D95',
                        accent: '#C4B5FD',
                        spawnAfter: 50,
                        weight: 0,
                    }, sx, sy, false, false);
                    enemy.spiderCount++;
                }
                this.ctx.spawnFloatingText('召唤!', pos.x, pos.y + enemy.radius + 20, '#C4B5FD', 20);
                enemy.skillTimer = this.ctx.randomRange(3.5, 5.5);
            }
            // Phase 1+: 更频繁召唤
            if (enemy.spec.variantIndex >= 1 && enemy.skillTimer <= 0) {
                const pos = this.getEnemyPosition(enemy);
                for (let i = 0; i < 4; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const offset = enemy.radius + 30;
                    const sx = this.ctx.clamp(pos.x + Math.cos(angle) * offset, WORLD_LEFT + 60, WORLD_RIGHT - 60);
                    const sy = this.ctx.clamp(pos.y + Math.sin(angle) * offset, WORLD_BOTTOM + 60, WORLD_TOP - 60);
                    const scale = this.getEndlessScale();
                    this.createEnemy({
                        id: 'spider-minion',
                        name: '蛛网幼虫',
                        family: 'swarm',
                        artId: 'swarm',
                        hp: Math.round(80 * scale),
                        speed: 150,
                        damage: enemy.damage * 0.3,
                        radius: 12,
                        xp: 0,
                        alloyChance: 0,
                        color: '#4C1D95',
                        accent: '#C4B5FD',
                        spawnAfter: 50,
                        weight: 0,
                    }, sx, sy, false, false);
                    enemy.spiderCount++;
                }
                this.ctx.spawnFloatingText('蛛群!', pos.x, pos.y + enemy.radius + 20, '#C4B5FD', 22);
                this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 2);
                enemy.skillTimer = this.ctx.randomRange(2.0, 3.5);
            }
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
            || enemy.spec.family === 'seeker'
            || enemy.spec.variantId === 'acid'
            || enemy.spec.variantId === 'arc'
            || enemy.spec.family === 'aura-arc'        // 电弧灵能体 (小Boss)
            || enemy.spec.variantId === 'crystal'
            || enemy.spec.variantId === 'venom'
            || enemy.spec.variantId === 'shade'
            || enemy.spec.family === 'brute-prime'      // 狂暴重甲块 (小Boss);
    }
    public separateEnemies() {
        if (this.enemies.length < 6) return;
        const px = this.cs.playerX;
        const py = this.cs.playerY;
        const distSqThreshold = 480 * 480; // 只处理480单位内的敌人（性能优化）
        const buckets = new Map<string, Enemy[]>();
        for (const enemy of this.enemies) {
            const enemyStart = this.getEnemyPosition(enemy);
            let ax = enemyStart.x;
            let ay = enemyStart.y;
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
                        const otherStart = this.getEnemyPosition(other);
                        let bx = otherStart.x;
                        let by = otherStart.y;
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
                        if (Math.abs(bx - otherStart.x) > 0.5 || Math.abs(by - otherStart.y) > 0.5) {
                            this.setEnemyPosition(other, bx, by);
                        }
                    }
                }
            }

            if (Math.abs(ax - enemyStart.x) > 0.5 || Math.abs(ay - enemyStart.y) > 0.5) {
                this.setEnemyPosition(enemy, ax, ay);
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
            if (this.ctx.rumbleVfx) this.ctx.rumbleVfx('waveClear');
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
            if (this.ctx.rumbleVfx) this.ctx.rumbleVfx('bossWarning');
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3.5);
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
        const spec = this.pickWeightedEnemySpec(this.currentWaveSpecs.length > 0 ? this.currentWaveSpecs : fallback);

        // ── 出怪模式选择（概率随波次递增）────────────────────────
        if (!this.isBossWave() && spec) {
            const wave = this.cs.waveIndex;

            // 十字阵：波 8+，6% 概率，4 方向各出 2-3 只
            if (wave >= 8 && Math.random() < 0.06 && count >= 5) {
                const armCount = Math.min(3, Math.max(2, Math.floor(count / 3)));
                spawnCross(this, spec, armCount, 400);
                const extra = Math.max(1, count - armCount * 2);
                this.spawnPack(extra, ring, this.currentWaveSpecs, fallback);
                this.maybeSpawnMiniBoss();
                return;
            }

            // 夹击波（pincer）：波 10+，8% 概率，双向高速冲锋
            if (wave >= 10 && Math.random() < 0.08 && count >= 4) {
                const perWave = Math.min(5, Math.max(2, Math.floor(count / 2)));
                const angle = Math.random() * Math.PI * 2;
                spawnPincer(this, spec, perWave, angle, 260, 0);
                const extra = Math.max(1, count - perWave * 2);
                this.spawnPack(extra, ring, this.currentWaveSpecs, fallback);
                this.maybeSpawnMiniBoss();
                return;
            }

            // 冲锋波：波 6+，概率从 12% 递增到 25%
            const chargeChance = Math.min(0.25, 0.12 + (wave - 6) * 0.015);
            if (wave >= 6 && Math.random() < chargeChance && count >= 3) {
                const angle = Math.random() * Math.PI * 2;
                spawnChargeWave(this, spec, Math.min(count + 2, 8), angle, 240, 0);
                const extra = Math.max(1, count - 3);
                this.spawnPack(extra, ring, this.currentWaveSpecs, fallback);
                this.maybeSpawnMiniBoss();
                return;
            }
        }
        this.spawnPack(count, ring, this.currentWaveSpecs, fallback);
        // 无尽模式（波13+）有 30% 概率穿插小 Boss（不挡进度）
        this.maybeSpawnMiniBoss();
    }

    /** 小 Boss 穿插：无尽模式波13+，30%概率出现1只 */
    private maybeSpawnMiniBoss(): void {
        if (this.cs.waveIndex < 13) return;
        if (this.isBossWave()) return;
        if (Math.random() > 0.30) return;
        // 场上已存在小 Boss 则不刷
        const hasMini = this.enemies.some(e => e.boss === false && e.elite && MINI_BOSS_SPECS.some(s => s.family === e.spec.family));
        if (hasMini) return;
        const spec = MINI_BOSS_SPECS[Math.floor(Math.random() * MINI_BOSS_SPECS.length)];
        const cycle = this.cs.endlessCycle || 1;
        const scaledHp = Math.round(spec.hp * this.getEndlessScale() * (1 + (cycle - 1) * 0.2));
        const point = this.getSpawnPointAroundPlayer(720, Math.random() * Math.PI * 2);
        this.createEnemy({
            ...spec,
            id: spec.id,
            name: `${spec.name} Lv.${cycle}`,
            hp: scaledHp,
            damage: Math.round(spec.damage * this.getEndlessScale() * (1 + (cycle - 1) * 0.15)),
        }, point.x, point.y, true, false);
    }
    public getWaveSpawnInterval() {
        const slot = this.getWaveSlot();
        const base = 1.62 - slot * 0.035 - (this.cs.endlessCycle - 1) * 0.06 - Math.min(0.12, this.cs.waveElapsed / 420);
        // 11 波后：间隔指数缩短（5% compound），波11略慢给喘口气
        if (this.cs.waveIndex >= ENDLESS_START_WAVE) {
            const endlessFactor = this.getEndlessScale();
            const breather = this.cs.waveIndex === ENDLESS_START_WAVE ? 0.08 : 0;
            return Math.max(0.45, (base + breather) / endlessFactor);
        }
        // Early waves are where new players learn the loop.  Keep pressure lower
        // so starter weapons can actually kill, collect XP, and reach upgrades
        // before the real squeeze begins around waves 5-6.
        // 爽感模式: 减少 earlyRelief 让前期怪潮更密，玩家有更多东西可杀
        const earlyRelief = this.cs.endlessCycle === 1
            ? this.cs.waveIndex <= 1 ? 0.6
                : this.cs.waveIndex === 2 ? 0.5
                    : this.cs.waveIndex === 3 ? 0.4
                        : this.cs.waveIndex === 4 ? 0.3
                            : this.cs.waveIndex === 5 ? 0.2
                                : this.cs.waveIndex === 6 ? 0.15
                                    : this.cs.waveIndex === 7 ? 0.15
                                        : this.cs.waveIndex === 8 ? 0.15
                                            : this.cs.waveIndex === 9 ? 0.10
                                                : 0
            : 0;
        return Math.max(this.cs.waveIndex <= 1 ? 1.5 : this.cs.waveIndex === 2 ? 1.4 : this.cs.waveIndex === 3 ? 1.3 : this.cs.waveIndex === 4 ? 1.2 : this.cs.waveIndex === 5 ? 1.1 : this.cs.waveIndex === 6 ? 1.0 : this.cs.waveIndex <= 8 ? 0.95 : 0.95, base + earlyRelief);
    }
    public getWaveSpawnBatchCount() {
        const slot = this.getWaveSlot();
        // 11 波后：每批数量指数增长（5% compound）
        if (this.cs.waveIndex >= ENDLESS_START_WAVE) {
            const baseCount = 3 + Math.floor(slot * 0.38) + this.cs.endlessCycle;
            const bossBonus = this.isBossWave() ? 5 : 0;
            const endlessFactor = this.getEndlessScale();
            return Math.min(60, Math.round((baseCount + bossBonus) * endlessFactor));
        }
        if (this.cs.endlessCycle === 1 && this.cs.waveIndex <= 8) {
            const earlyBase = this.cs.waveIndex <= 2
                ? 2
                : this.cs.waveIndex <= 4
                    ? 3
                    : this.cs.waveIndex <= 6
                        ? 4
                        : 5;
            const earlyRandom = this.cs.waveIndex <= 2 ? 1 : this.ctx.randomInt(0, this.cs.waveIndex >= 7 ? 2 : 1);
            return earlyBase + earlyRandom;
        }
        const earlyWave = this.cs.endlessCycle === 1 && this.cs.waveIndex <= 6;
        const elapsedPressure = Math.floor(this.cs.waveElapsed / (earlyWave ? 42 : 24));
        const pressure = 1 + Math.floor(slot * 0.38) + this.cs.endlessCycle + elapsedPressure;
        const bossBonus = this.isBossWave() ? 3 : 0;
        const randomBonus = earlyWave
            ? this.cs.waveIndex <= 2 ? 0 : this.ctx.randomInt(0, 1)
            : this.ctx.randomInt(0, 2);
        return Math.min(22, Math.max(2, pressure + bossBonus + randomBonus));
    }
    public getEnemyCap() {
        // Boss 波：场上限砍到 60，给玩家空间打 Boss
        if (this.isBossWave()) {
            return 60 + this.cs.endlessCycle * 10;
        }
        // 11 波后：上限指数增长
        if (this.cs.waveIndex >= ENDLESS_START_WAVE) {
            const endlessFactor = this.getEndlessScale();
            return Math.min(600, Math.max(240, Math.round(200 * endlessFactor)));
        }
        if (this.cs.endlessCycle === 1) {
            const earlyCaps: Record<number, number> = { 1: 40, 2: 55, 3: 75, 4: 95, 5: 130, 6: 170, 7: 200, 8: 240, 9: 240 };
            const cap = earlyCaps[this.cs.waveIndex];
            if (cap) return cap + this.cs.battleIndex * 2;
        }
        return Math.min(280, 90 + this.cs.battleIndex * 3 + this.cs.endlessCycle * 24 + this.cs.waveIndex * 6);
    }
    private getEarlyProgressFactor(): number {
        if (this.cs.waveIndex >= ENDLESS_START_WAVE) return 1;
        if (this.cs.endlessCycle !== 1) return 1;
        if (this.cs.waveIndex <= 2) return 0.3;
        if (this.cs.waveIndex <= 4) return 0.4;
        if (this.cs.waveIndex <= 6) return 0.55;
        if (this.cs.waveIndex <= 8) return 0.78;
        return 1;
    }
    public getWaveSlot(wave = this.cs.waveIndex) {
        if (wave <= 0) return 1;
        // 11 波起不再循环 1-10 波，全程使用最高压力基数
        if (wave >= ENDLESS_START_WAVE) return 10;
        return ((wave - 1) % WAVES_PER_CYCLE) + 1;
    }
    /** 无尽模式指数缩放系数：11 波起每波 +5% */
    public getEndlessScale(wave = this.cs.waveIndex): number {
        if (wave < ENDLESS_START_WAVE) return 1;
        return Math.pow(1 + ENDLESS_SCALE_RATE, wave - (ENDLESS_START_WAVE - 1));
    }
    public isBossWave(wave = this.cs.waveIndex) {
        // 波 10: 第一个 Boss 波
        if (wave === 10) return true;
        // 波 10 之后: 每 3 波一个 Boss (13, 16, 19, 22, ...)
        if (wave > 10) return (wave - 10) % 3 === 0;
        return false;
    }
    public spawnPack(count: number, ring: boolean, preferredSpecs: EnemySpec[] | null = null, fallbackSpecs: EnemySpec[] | null = null) {
        const cap = this.getEnemyCap();
        const room = Math.max(0, cap - this.enemies.length);
        const total = Math.min(Math.max(0, count), room);
        const waveSpecs = preferredSpecs && preferredSpecs.length > 0
            ? preferredSpecs
            : this.pickEnemyWaveSpecs(total, ring, fallbackSpecs);
        const pool = fallbackSpecs && fallbackSpecs.length > 0 ? fallbackSpecs : this.getUnlockedEnemySpecs();
        for (let i = 0; i < total; i++) {
            const spec = waveSpecs.length > 0
                ? (waveSpecs.length <= total && i < waveSpecs.length
                    ? waveSpecs[i]
                    : this.pickWeightedEnemySpec(waveSpecs))
                : this.pickWeightedEnemySpec(pool);
            const angle = ring ? (Math.PI * 2 * i) / Math.max(1, total) + Math.random() * 0.16 : Math.random() * Math.PI * 2;
            // Spread spawn radius per enemy so they approach from different distances,
            // preventing the "all enemies converge as a single ball" problem.
            const radiusVariation = this.ctx.randomRange(-120, 120);
            const radius = ring ? 720 + radiusVariation : this.ctx.randomRange(580, 900);
            const point = this.getSpawnPointAroundPlayer(radius, angle);
            const eliteChance = Math.min(0.28, 0.025 + this.cs.endlessCycle * 0.018 + this.cs.waveIndex * 0.0035 + this.cs.combatTime * 0.00045);
            this.createEnemy(spec, point.x, point.y, Math.random() < eliteChance, false);
        }
    }
    /** 随机 Boss 池，同一场战斗波次间不重复 */
    public initBossPool(): void {
        resetBossPool();
    }

    public spawnBoss() {
        const cycle = this.cs.endlessCycle || 1;

        // 从 shuffled 池 pop 一个 Boss（保证同 Boss 波不重复）
        if (!_poolBossThisBattle || _poolBossThisBattle.length === 0) {
            resetBossPool();
        }
        const bossSpec = _poolBossThisBattle!.pop()!;

        const scaledHp = Math.round(bossSpec.hp * (1 + (cycle - 1) * 0.25));
        const point = this.getSpawnPointAroundPlayer(700, Math.random() * Math.PI * 2);
        this.createEnemy({
            ...bossSpec,
            id: bossSpec.id,
            name: `${bossSpec.name} Lv.${cycle}`,
            hp: scaledHp,
            speed: bossSpec.speed,
            damage: bossSpec.damage + (cycle - 1) * 5,
            radius: bossSpec.radius,
            xp: bossSpec.xp * cycle,
            bossMaterial: bossSpec.bossMaterial,
        }, point.x, point.y, true, true);
    }

    public updateBossPhase(enemy: Enemy, hpRatio: number): void {
        if (!enemy.boss) return;

        // 虚空巨像 3 阶段
        if (enemy.spec.family === 'void-colossus') {
            const currentPhase = enemy.spec.variantIndex || 0;
            let newPhase = currentPhase;

            if (hpRatio <= 0.33 && currentPhase < 3) {
                newPhase = 3;
            } else if (hpRatio <= 0.66 && currentPhase < 2) {
                newPhase = 2;
            }

            if (newPhase !== currentPhase) {
                this.ctx.rumbleVfx('bossWarning');
                this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 4);

                if (newPhase === 2) {
                    // Phase 2: 加速 + 召唤追踪眼
                    enemy.speed *= 1.30;
                    enemy.damage *= 1.25;
                    this.ctx.showToast('虚空巨像进入阶段二：召唤！');
                    this.ctx.playSfx('sfx_boss_warning', 0.7, 0.3);
                    // 召唤 2 只追踪眼
                    const seekerSpec = ENEMY_SPECS.find(s => s.family === 'seeker');
                    if (seekerSpec) {
                        for (let i = 0; i < 2; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const sp = this.getSpawnPointAroundPlayer(500, angle);
                            this.createEnemy(seekerSpec, sp.x, sp.y, false, false);
                        }
                    }
                } else if (newPhase === 3) {
                    // Phase 3: 狂暴 — 速度大幅提升, 伤害翻倍
                    enemy.speed *= 1.50;
                    enemy.damage *= 1.60;
                    this.ctx.showToast('虚空巨像进入阶段三：狂暴！');
                    this.ctx.shakeIntensity = Math.max(this.ctx.shakeIntensity, 6);
                    this.ctx.playSfx('sfx_boss_warning', 0.9, 0.2);
                    // 环形召唤蜂群包围玩家
                    const swarmSpec = ENEMY_SPECS.find(s => s.family === 'swarm');
                    if (swarmSpec) {
                        spawnCircle(this, swarmSpec, 12, 450, 0.08);
                    }
                }
                // 更新 phase
                enemy.spec = { ...enemy.spec, variantIndex: newPhase };
            }

            // Phase 3: 全屏脉冲 (在 updateEnemySkill 里处理)
            return;
        }

        // 旧 Boss (星核巨像) 原有阶段逻辑
        if (hpRatio <= 0.5 && enemy.speed < 130) {
            enemy.speed *= 1.45;
            enemy.damage *= 1.35;
            this.ctx.showToast('星核巨像进入狂暴状态！');
            this.ctx.playSfx('sfx_boss_warning', 0.7, 0.3);
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 2);
        }

        // ── 大 Boss 阶段触发 ───────────────────────────────────────────

        // 噬能蠕虫: 3阶段(burrowed=0→charging=1→stunned=2→burrowed...)
        if (enemy.spec.family === 'energy-worm') {
            const phase = enemy.spec.variantIndex || 0;
            // Phase 1: HP ≤ 66% → 加速
            if (hpRatio <= 0.66 && phase < 1) {
                enemy.spec = { ...enemy.spec, variantIndex: 1 };
                enemy.speed *= 1.4;
                enemy.damage *= 1.2;
                this.ctx.showToast('噬能蠕虫进入狂暴形态！');
                this.ctx.playSfx('sfx_boss_warning', 0.8, 0.3);
            }
            // Phase 2: HP ≤ 33% → 极快
            if (hpRatio <= 0.33 && phase < 2) {
                enemy.spec = { ...enemy.spec, variantIndex: 2 };
                enemy.speed *= 1.6;
                enemy.damage *= 1.4;
                this.ctx.showToast('噬能蠕虫进入极限形态！');
                this.ctx.playSfx('sfx_boss_warning', 0.9, 0.2);
                this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3);
            }
            return;
        }

        // 冰霜女皇: 阶段=HP≤50%
        if (enemy.spec.family === 'frost-queen') {
            const phase = enemy.spec.variantIndex || 0;
            if (hpRatio <= 0.5 && phase < 1) {
                enemy.spec = { ...enemy.spec, variantIndex: 1 };
                enemy.speed *= 1.35;
                enemy.damage *= 1.25;
                this.ctx.showToast('冰霜女皇进入冰封领域！');
                this.ctx.playSfx('sfx_boss_warning', 0.8, 0.3);
                this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 2);
                // 瞬间放一圈冰霜 + 召唤追踪眼
                const pos = this.getEnemyPosition(enemy);
                this.ctx.drawAreaPulse(pos.x, pos.y, 200, '#93C5FD');
                const seekerSpec = ENEMY_SPECS.find(s => s.family === 'seeker');
                if (seekerSpec) {
                    spawnCircle(this, seekerSpec, 6, 480, 0);
                }
            }
            return;
        }

        // 狱炎领主: 阶段=HP≤66%
        if (enemy.spec.family === 'inferno-lord') {
            const phase = enemy.spec.variantIndex || 0;
            if (hpRatio <= 0.66 && phase < 1) {
                enemy.spec = { ...enemy.spec, variantIndex: 1 };
                enemy.speed *= 1.3;
                enemy.damage *= 1.2;
                enemy.rotationTimer = 0;
                this.ctx.showToast('狱炎领主进入火焰风暴！');
                this.ctx.playSfx('sfx_boss_warning', 0.8, 0.3);
                this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3);
            }
            return;
        }

        // 虚空织网者: 阶段=护盾耗尽
        if (enemy.spec.family === 'void-weaver') {
            const phase = enemy.spec.variantIndex || 0;
            if (enemy.shieldHp <= 0 && phase < 1) {
                // 护盾被打破 → 进入下一阶段
                enemy.spec = { ...enemy.spec, variantIndex: 1 };
                enemy.speed *= 1.5;
                enemy.damage *= 1.3;
                this.ctx.showToast('虚空织网者护盾破碎！');
                this.ctx.playSfx('sfx_boss_warning', 0.8, 0.3);
                this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3);
            }
            return;
        }
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
        const earlyProgressFactor = this.getEarlyProgressFactor();
        const earlyDamageFactor = this.cs.endlessCycle === 1
            ? this.cs.waveIndex <= 2 ? 0.82
                : this.cs.waveIndex <= 4 ? 0.75
                    : this.cs.waveIndex <= 6 ? 0.85
                        : this.cs.waveIndex <= 8 ? 0.95
                            : 1
            : 1;
        const endlessScale = this.getEndlessScale();
        const scale = (1 + this.cs.battleIndex * 0.06 + (this.cs.endlessCycle - 1) * 0.28 + (this.cs.waveIndex * 0.028 + this.cs.combatTime * 0.0018) * ENEMY_HP_PROGRESS_SCALE * earlyProgressFactor) * endlessScale;
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
            damage: spec.damage * (boss ? 1.85 : elite ? 1.42 : 1.05) * (1 + (this.cs.endlessCycle - 1) * 0.16 + (this.cs.waveIndex * 0.012 + this.cs.combatTime * 0.0009) * ENEMY_DAMAGE_PROGRESS_SCALE * earlyProgressFactor) * earlyDamageFactor * endlessScale,
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
            // ── 移动策略 ─────────────────────────────────────────────
            movementType: (spec.family === 'seeker' || spec.family === 'aura') ? 'periodic-follow' : 'follow',
            periodicFollowTimer: 0,
            // ── 机制词条状态字段 (Phase 2) ─────────────────────────────────
            slowTimer: 0,
            slowFactor: 0,
            poisonStacks: 0,
            poisonTimer: 0,
            poisonDuration: 0,
            poisonDps: 0,
            knockbackVx: 0,
            knockbackVy: 0,
            burrowedTimer: 0,
            stunTimer: 0,
            rotationTimer: 0,
            shieldHp: 0,
            shieldMaxHp: 0,
            spiderCount: 0,
            explodeTimer: 0,
            animSeed: Math.random() * Math.PI * 2,
            hitFlash: 0,
            visualStateKey: '',
            animation,
            animationFrameIndex: animation ? 0 : -1,
            wobbleSin: Math.sin(this.nextEnemyId * 0.73),
            wobbleCos: Math.cos(this.nextEnemyId * 0.73),
            _botX: x,
            _botY: y,
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
        // 11 波后：所有种类全部解锁
        if (this.cs.waveIndex >= ENDLESS_START_WAVE) return ENEMY_SPECS;
        const slot = this.getWaveSlot();
        if (this.cs.endlessCycle === 1) {
            const families = slot <= 2
                ? ['mite']
                : slot <= 4
                    ? ['mite', 'runner']
                    : slot <= 6
                        ? ['mite', 'runner', 'brute']
                        : slot <= 8
                            ? ['mite', 'runner', 'brute', 'splitter']
                            : BASE_ENEMY_ARCHETYPES.map((base) => base.family);
            const maxVariantIndex = slot <= 2 ? 0 : slot <= 4 ? 2 : slot <= 6 ? 4 : slot <= 8 ? 6 : 10;
            const earlyPool = ENEMY_SPECS.filter((spec) =>
                families.indexOf(spec.family) >= 0 && (spec.variantIndex ?? 0) <= maxVariantIndex,
            );
            if (earlyPool.length > 0) return earlyPool;
        }
        const wave = this.ctx.clamp(slot >= WAVES_PER_CYCLE ? ORDINARY_WAVES_PER_CYCLE : slot, 1, ORDINARY_WAVES_PER_CYCLE);
        const end = Math.floor((wave * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        return ENEMY_SPECS.slice(0, Math.max(1, end));
    }
    public getWaveEnemySpecs(wave: number) {
        // 11 波后：全部种类
        if (wave >= ENDLESS_START_WAVE) return ENEMY_SPECS;
        const slot = this.getWaveSlot(wave);
        if (this.cs.endlessCycle === 1 && slot <= 8) return this.getUnlockedEnemySpecs();
        const ordinaryWave = this.ctx.clamp(slot >= WAVES_PER_CYCLE ? ORDINARY_WAVES_PER_CYCLE : slot, 1, ORDINARY_WAVES_PER_CYCLE);
        const start = Math.floor(((ordinaryWave - 1) * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        const end = Math.floor((ordinaryWave * ENEMY_SPECS.length) / ORDINARY_WAVES_PER_CYCLE);
        return ENEMY_SPECS.slice(start, Math.max(start + 1, end));
    }
    public damageEnemy(enemy: Enemy, amount: number, color = '#F8FAFC', tag = '') {
        const finalAmount = enemy.armorTimer > 0 ? amount * (enemy.boss ? 0.58 : 0.72) : amount;
        const finalTag = enemy.armorTimer > 0 ? `${tag}霸体 ` : tag;
        const isCrit = tag.indexOf('暴击') >= 0;
        const isLethal = tag.indexOf('致命') >= 0;
        const fontSize = isLethal ? 30 : isCrit ? 26 : finalTag ? 23 : 21;
        // Boss phase check on hit
        if (enemy.boss) {
            const hpRatio = (enemy.hp - finalAmount) / enemy.maxHp;
            this.updateBossPhase(enemy, hpRatio);
        }
        // HP auto-growth every 3 levels — also apply healing from level up
        const pos = this.getEnemyPosition(enemy);
        this.ctx.spawnFloatingText(
            `${finalTag}${Math.ceil(finalAmount)}`,
            pos.x + this.ctx.randomRange(-12, 12),
            pos.y + enemy.radius + this.ctx.randomRange(8, 20),
            enemy.armorTimer > 0 ? '#CBD5E1' : color,
            fontSize,
        );
        // Screen shake for crit/lethal
        if (isLethal) {
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3);
            this.ctx.playSfx('sfx_crit_hit', 0.55, 0.08);
        } else if (isCrit) {
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 1.5);
        }
        // 虚空织网者: 护盾先扣，护盾归零触发阶段切换
        if (enemy.spec.family === 'void-weaver' && enemy.boss && enemy.shieldMaxHp > 0 && enemy.shieldHp > 0) {
            if (enemy.shieldHp > 0) {
                enemy.shieldHp = Math.max(0, enemy.shieldHp - finalAmount);
                const pos2 = this.getEnemyPosition(enemy);
                this.ctx.spawnFloatingText(`盾${Math.ceil(finalAmount)}`, pos2.x + this.ctx.randomRange(-8, 8), pos2.y - enemy.radius - 10, '#C4B5FD', 18);
                enemy.hitFlash = ENEMY_HIT_FLASH_DURATION;
                if (enemy.shieldHp <= 0) {
                    // 护盾破碎 → updateBossPhase 会在这里检测到 shieldHp<=0 并触发阶段切换
                    const pos3 = this.getEnemyPosition(enemy);
                    this.ctx.drawAreaPulse(pos3.x, pos3.y, enemy.radius * 2, '#C4B5FD');
                    this.ctx.spawnFloatingText('护盾破碎!', pos3.x, pos3.y + enemy.radius + 20, '#C4B5FD', 24);
                    this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 3);
                    this.ctx.playSfx('sfx_boss_warning', 0.9, 0.25);
                }
                return; // 护盾期间不扣HP
            }
        }
        enemy.hitFlash = ENEMY_HIT_FLASH_DURATION;
        this.ctx.playSfx('sfx_hit_enemy', enemy.boss ? 0.55 : 0.38, 0.03);
        enemy.hp -= finalAmount;
        if (enemy.hp <= 0) {
            // 自爆虫 (bomber): 死亡时爆炸
            if (enemy.spec.family === 'bomber') {
                const pos = this.getEnemyPosition(enemy);
                const explosionDmg = enemy.spec.damage * 2;
                const explosionRadius = enemy.radius * 2.5;
                for (const other of this.enemies) {
                    if (other === enemy || !this.enemySet.has(other)) continue;
                    const otherPos = this.getEnemyPosition(other);
                    const dx = pos.x - otherPos.x;
                    const dy = pos.y - otherPos.y;
                    if (dx * dx + dy * dy <= explosionRadius * explosionRadius) {
                        this.damageEnemy(other, explosionDmg * 0.5, '#EF4444', '爆炸 ');
                    }
                }
                this.ctx.drawAreaPulse(pos.x, pos.y, explosionRadius, '#EF4444');
            }
            this.killEnemy(enemy);
        } else {
            this.drawEnemy(enemy);
        }
    }
    public rollOutgoingDamage(enemy: Enemy, baseDamage: number, critChanceBonus = 0, critDamageBonus = 0): { amount: number; color: string; tag: string } {
        const stats = this.ctx.getCharacterStats();
        const lethalRoll = Math.random() < stats.lethalChance;
        if (lethalRoll) {
            const lethalDamage = Math.max(baseDamage * stats.lethalDamage, enemy.maxHp * stats.lethalMaxHpPct);
            return { amount: lethalDamage, color: '#F59E0B', tag: '致命 ' };
        }
        const critChance = stats.critChance + critChanceBonus;
        const critDamage = stats.critDamage + critDamageBonus;
        if (Math.random() < critChance) {
            return { amount: baseDamage * critDamage, color: '#F9C74F', tag: '暴击 ' };
        }
        return { amount: baseDamage, color: '#F8FAFC', tag: '' };
    }
    public droneStrike(enemy: Enemy, dronePower: number) {
        const damage = 12 + dronePower * 3.4 + this.ctx.getActiveEquipmentLevel('reactor-core') * 2;
        const roll = this.rollOutgoingDamage(enemy, damage);
        this.ctx.droneHitPulse = 0.22;
        this.damageEnemy(enemy, roll.amount, roll.tag ? roll.color : '#90BE6D', roll.tag ? `无人机 ${roll.tag}` : '无人机 ');
        const origin = this.ctx.getDroneZapOrigin();
        const pos = this.getEnemyPosition(enemy);
        this.ctx.drawZap(origin.x, origin.y, pos.x, pos.y);
    }
    public killEnemy(enemy: Enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index >= 0) this.enemies.splice(index, 1);
        this.enemySet.delete(enemy);
        const { x, y } = this.getEnemyPosition(enemy);
        this.ctx.bus.emit('enemy-killed', { x, y, drops: true, isBoss: enemy.boss, isSplitter: enemy.spec.family === 'splitter' || enemy.spec.family === 'splitter-swift', damageType: enemy.damageType });

        // 迅捷分裂体死亡时分裂成2个小体（子体不再分裂）
        if ((enemy.spec.family === 'splitter' || enemy.spec.family === 'splitter-swift') && !enemy.boss && !enemy.spec.id.endsWith('-child')) {
            const scale = this.getEndlessScale();
            const childHp = Math.round(enemy.maxHp * 0.45 * scale);
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                const offset = 45;
                const cx = this.ctx.clamp(x + Math.cos(angle) * offset, WORLD_LEFT + 60, WORLD_RIGHT - 60);
                const cy = this.ctx.clamp(y + Math.sin(angle) * offset, WORLD_BOTTOM + 60, WORLD_TOP - 60);
                this.createEnemy({
                    ...enemy.spec,
                    id: `${enemy.spec.id}-child`,
                    name: `${enemy.spec.name}-幼体`,
                    hp: childHp,
                    damage: enemy.damage * 0.5,
                    speed: enemy.speed * 1.2,
                    radius: Math.round(enemy.radius * 0.6),
                    xp: 0,
                    alloyChance: 0,
                }, cx, cy, false, false);
            }
            this.ctx.drawAreaPulse(x, y, 60, '#C4B5FD');
        }
        if (enemy.boss) {
            this.ctx.bus.emit('boss-defeated', {});
            if (this.ctx.rumbleVfx) this.ctx.rumbleVfx('bossDeath');
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 4);
        } else if (enemy.elite) {
            this.cs.shakeIntensity = Math.max(this.cs.shakeIntensity, 1.2);
        }
        this.ctx.playSfx(enemy.boss ? 'sfx_boss_die' : 'sfx_enemy_die', enemy.boss ? 0.82 : 0.45, enemy.boss ? 1.0 : 0.045);
        this.drawEnemyDeathBurst(x, y, enemy.radius, enemy.spec.color, enemy.elite || enemy.boss);
        enemy.node.destroy();
        this.cs.killCount += 1;
        this.cs.waveKillCount += 1;

        // XP — always given directly, no orbs to pick up
        {
            const xpMultiplier = enemy.boss ? 3 : enemy.elite ? 2.4 : 2.6;
            const xpAmount = Math.max(1, Math.round(enemy.spec.xp * xpMultiplier));
            this.ctx.gainXp(xpAmount);
        }

        const normalAlloyChance = Math.min(0.32, enemy.spec.alloyChance * NORMAL_ALLOY_DROP_MULTIPLIER + this.cs.waveIndex * 0.004);
        if (enemy.elite || enemy.boss || Math.random() < normalAlloyChance) {
            const alloyAmount = enemy.boss
                ? 18 + this.cs.endlessCycle * 3
                : enemy.elite
                    ? 6 + Math.floor(this.cs.endlessCycle / 2)
                    : this.ctx.randomInt(2, 4) + Math.floor(this.cs.waveIndex / 8);
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
        // Shield fragment drop (20% chance per kill)
        if (Math.random() < 0.2 && this.ctx.addShieldFragment) {
            this.ctx.addShieldFragment();
        }
        if (enemy.boss) {
            // Boss 奖励随波次递增：波10base，波13↑，波16↑↑...
            this.ctx.dropPickup('cores', 1 + Math.floor(this.cs.waveIndex / 6), x, y);
            this.ctx.dropPickup('shards', 4 + this.cs.waveIndex * 1, x + 18, y + 8);
            this.ctx.dropPickup('crystals', 1 + Math.floor(this.cs.waveIndex / 5), x - 18, y + 8);
            this.ctx.dropPickup('alloy', 12 + this.cs.waveIndex * 2, x + 4, y + 36);
            this.ctx.tryDropChest('chest-rare', x, y + 32);
            // 大 Boss 掉落专属材料（1~3个）
            const mat = enemy.spec.bossMaterial;
            if (mat) {
                const count = this.ctx.randomInt(1, 3);
                const matName: Record<string, string> = {
                    voidFragment: '虚空碎片', energyCore: '噬能核心',
                    frostCore: '永冻结晶', infernoCore: '狱炎之核', webSilk: '织网丝线',
                };
                this.ctx.dropPickup(mat, count, x + this.ctx.randomRange(-20, 20), y + this.ctx.randomRange(-20, 20));
                this.ctx.showToast(`获得 ${matName[mat] || mat} ×${count}！`);
            }
            this.cs.bossKills += 1;
            if (this.ctx.tryDropEquipmentBlueprint) this.ctx.tryDropEquipmentBlueprint();
            this.cs.bossDefeatedThisWave = true;
            this.cs.bossSpawned = false;
            this.ctx.requestBgm('bgm_combat_loop');
            this.ctx.showToast(`第 ${this.cs.waveIndex} 波 Boss 已击杀，撑到本波结束进入下一波。`);
        }
        if (this.shouldEnemyExplodeOnDeath(enemy)) {
            this.enemyExplode(x, y, enemy.radius * (enemy.boss ? 3.2 : enemy.elite ? 2.45 : 2.15), enemy.damage * (enemy.boss ? 1.5 : 1.05), enemy.damageType);
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
        // Extra strong death burst for bosses (rare=true + boss=large radius)
        if (rare && radius > 50) {
            // Big outer ring
            this.ctx.scheduleOnce(() => {
                this.ctx.drawAreaPulse(x, y, radius * 2.8, '#F8FAFC');
            }, 0.07);
            this.ctx.scheduleOnce(() => {
                this.ctx.drawAreaPulse(x, y, radius * 4.2, '#F94144');
            }, 0.14);
            // Extra particles
            this.spawnDeathParticles(x, y, '#F94144', 16, radius * 0.15);
            this.spawnDeathParticles(x, y, '#F59E0B', 8, radius * 0.1);
        }
        // Colored death particles
        const partCount = rare ? 12 : 6;
        this.spawnDeathParticles(x, y, color, partCount, Math.max(3, radius * 0.2));
        // Additional accent particles for elite/boss
        if (rare) {
            this.spawnDeathParticles(x, y, '#F8FAFC', 6, Math.max(2, radius * 0.12));
        }
        // Ground scorch mark on death (boss/elite only) — internal pool
        if (rare && this.groundMarkNodes) {
            this.ctx.scheduleOnce(() => {
                let idx = -1;
                for (let i = 0; i < this.groundMarkNodes.length; i++) {
                    if (this.groundMarkTimers[i] < 0) { idx = i; break; }
                }
                if (idx < 0) return;
                const mark = this.groundMarkNodes[idx];
                mark.setPosition(x, y, 2);
                const s = 0.6 + Math.random() * 0.8;
                mark.setScale(s, s);
                mark.angle = Math.random() * 360;
                mark.active = true;
                this.groundMarkTimers[idx] = 3 + Math.random() * 2;
                const gfx = this.groundMarkGfx[idx];
                gfx.clear();
                gfx.fillColor = this.ctx.hex(color, rare ? 45 : 28);
                gfx.circle(0, 0, radius * (rare ? 1.8 : 1.4));
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(color, rare ? 32 : 16);
                gfx.lineWidth = 2;
                gfx.circle(0, 0, radius * (rare ? 1.3 : 1.1));
                gfx.stroke();
            }, 0.08);
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
        // ── Batch drawing: draw to the shared batchGfx instead of per-enemy gfx ──
        // Per-enemy gfx is kept for backward compat but left clear.
        // The actual rendering is done once per frame in drawAllEnemiesBatch().
        // We still need to update sprite state for sprite-based enemies.
        if (enemy.sprite) {
            const tint = this.getEnemyTint(enemy, 255);
            enemy.sprite.color = enemy.hitFlash > 0
                ? this.ctx.hex('#FFFFFF', 255)
                : tint;
        }
    }

    /** 批量绘制所有敌人——单Graphics组件, 1个draw call渲染全屏200+怪 */
    private _batchGfx: Graphics | null = null;
    /** 帧计数器（远怪降频用） */
    private _updateFrameCounter = 0;
    public drawAllEnemiesBatch(): void {
        if (!this._batchGfx) return;
        const gfx = this._batchGfx;
        gfx.clear();
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        const VIEW_HALF_W = 560;   // 720/2 + margin
        const VIEW_HALF_H = 840;   // 1280/2 + margin
        for (const enemy of this.enemies) {
            if (!this.enemySet.has(enemy)) continue;
            const pos = this.getEnemyPosition(enemy);
            const dx = pos.x - px;
            const dy = pos.y - py;
            // 屏幕外裁剪：超出视角范围+200像素的怪不画
            if (Math.abs(dx) > VIEW_HALF_W + 200 || Math.abs(dy) > VIEW_HALF_H + 200) continue;
            const r = enemy.radius;
            // 主体
            gfx.fillColor = enemy.hitFlash > 0
                ? this.ctx.hex('#FFFFFF', 255)
                : this.getEnemyTint(enemy, enemy.elite ? 255 : 230);
            gfx.circle(pos.x, pos.y, r);
            gfx.fill();
            // 边框
            gfx.strokeColor = this.ctx.hex(enemy.spec.accent, enemy.boss ? 140 : 120);
            gfx.lineWidth = enemy.boss ? 2 : 1.5;
            gfx.circle(pos.x, pos.y, r + 2);
            gfx.stroke();
            // 精英/闪避/护甲标记
            if (enemy.armorTimer > 0 || enemy.dashTimer > 0) {
                gfx.strokeColor = this.ctx.hex(enemy.armorTimer > 0 ? '#CBD5E1' : '#F59E0B', 160);
                gfx.lineWidth = enemy.armorTimer > 0 ? 2 : 2;
                gfx.circle(pos.x, pos.y, r + (enemy.armorTimer > 0 ? 6 : 4));
                gfx.stroke();
            }
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
        const enemies = this.enemies;
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!this.enemySet.has(enemy)) continue;
            const { x: ex, y: ey } = this.getEnemyPosition(enemy);
            const dist = this.ctx.distanceSq(this.cs.playerX, this.cs.playerY, ex, ey);
            if (dist < bestDist) {
                best = enemy;
                bestDist = dist;
            }
        }
        return best;
    }
}

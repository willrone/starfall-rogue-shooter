/**
 * OffhandManager — 副武器运行时逻辑
 *
 * 15 把副武器的战斗内行为全部在此实现。
 * 每秒每帧由 RogueShooterGame.ts 调用 tick(dt)。
 *
 * 设计基线：docs/offhand_weapon_design.md
 * 副武器数据：catalogs/offhandCatalog.ts
 */
import { Color, Graphics, Layers, Node, Sprite, Vec2 } from 'cc';
import type { Enemy } from '../enemy/enemyTypes';
import { findOffhand, getOffhandStats } from '../catalogs/offhandCatalog';
import type { OffhandDef, OffhandStats } from '../core/types';

// ── 副武器可视化实体 ──────────────────────────────────────────
export interface OffhandEntity {
    node: Node;
    gfx: Graphics;
    /** 0=none, 1=blade, 2=star, 3=trail, 4=clone, 5=bird, 6=bee */
    kind: number;
    state: Record<string, number>;
}

interface BurnTrailPoint {
    x: number;
    y: number;
    t: number;
}

type ContinuousEffectKey = 'orbit_blade' | 'orbit_burn' | 'control_field';

export const OFFHAND_CONTINUOUS_TICK_INTERVAL = 0.1;
export const OFFHAND_CONTINUOUS_BASELINE_FPS = 60;
const CONTINUOUS_TICK_EPSILON = 1e-8;

export function getOffhandSweepHitProgress(
    targetX = 0,
    targetY = 0,
    startAngle = 0,
    sweepAngle = 0,
    orbitRadius = 0,
    hitRadius = 0,
) {
    const targetRadius = Math.sqrt(targetX * targetX + targetY * targetY);
    if (Math.abs(targetRadius - orbitRadius) > hitRadius) return -1;

    const fullTurn = Math.PI * 2;
    const sweep = Math.abs(sweepAngle);
    if (sweep >= fullTurn - CONTINUOUS_TICK_EPSILON) return 0;

    const targetAngle = Math.atan2(targetY, targetX);
    const angularPadding = targetRadius <= hitRadius
        ? Math.PI
        : Math.asin(Math.min(1, hitRadius / targetRadius));
    const normalize = (angle = 0) => {
        const value = angle % fullTurn;
        return value < 0 ? value + fullTurn : value;
    };
    let directedDelta = sweepAngle >= 0
        ? normalize(targetAngle - startAngle)
        : normalize(startAngle - targetAngle);
    if (fullTurn - directedDelta <= angularPadding) directedDelta = 0;
    if (directedDelta > sweep + angularPadding) return -1;
    if (sweep <= CONTINUOUS_TICK_EPSILON) return 0;
    return Math.min(1, Math.max(0, (directedDelta - angularPadding) / sweep));
}

export function getOffhandSweepContactFraction(
    targetX = 0,
    targetY = 0,
    startAngle = 0,
    sweepAngle = 0,
    orbitRadius = 0,
    hitRadius = 0,
) {
    const targetRadius = Math.sqrt(targetX * targetX + targetY * targetY);
    if (Math.abs(targetRadius - orbitRadius) > hitRadius) return 0;

    const sweep = Math.abs(sweepAngle);
    if (sweep <= CONTINUOUS_TICK_EPSILON) return 1;
    if (targetRadius <= hitRadius) return 1;

    const fullTurn = Math.PI * 2;
    const angularPadding = Math.asin(Math.min(1, hitRadius / targetRadius));
    if (sweep >= fullTurn - CONTINUOUS_TICK_EPSILON) {
        return Math.min(1, (angularPadding * 2) / fullTurn);
    }

    const targetAngle = Math.atan2(targetY, targetX);
    const normalize = (angle = 0) => {
        const value = angle % fullTurn;
        return value < 0 ? value + fullTurn : value;
    };
    const directedDelta = sweepAngle >= 0
        ? normalize(targetAngle - startAngle)
        : normalize(startAngle - targetAngle);
    let overlap = 0;
    for (const center of [directedDelta - fullTurn, directedDelta, directedDelta + fullTurn]) {
        const overlapStart = Math.max(0, center - angularPadding);
        const overlapEnd = Math.min(sweep, center + angularPadding);
        overlap = Math.max(overlap, overlapEnd - overlapStart);
    }
    return Math.min(1, Math.max(0, overlap / sweep));
}

export function interpolateOffhandTickPosition(start = 0, end = 0, tickOffset = 0, dt = 0) {
    if (dt <= 0) return end;
    const alpha = Math.min(1, Math.max(0, tickOffset / dt));
    return start + (end - start) * alpha;
}

// ── Host Context ───────────────────────────────────────────────
export interface OffhandHostContext {
    cs: {
        playerX: number;
        playerY: number;
        combatTime: number;
        equippedOffhandId: string | null;
        offhandLevel: number;
        overheatStacks: number;
        invulnerableTimer: number;
        playerHp: number;
        playerMaxHp: number;
    };
    worldNode: Node | null;
    enemyMgr: {
        enemies: Enemy[];
        enemySet: Set<Enemy>;
        getEnemyPosition(enemy: Enemy): { x: number; y: number };
        damageEnemy(enemy: Enemy, amount: number, color?: string, tag?: string): void;
        findNearestEnemy(x: number, y: number, radius: number): Enemy | null;
    };
    hex(color: string, alpha?: number): Color;
    clamp(value: number, min: number, max: number): number;
    randomRange(min: number, max: number): number;
    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;
    playSfx(name: string, volume?: number, cooldown?: number): void;
    healPlayer(amount: number): void;
    applyAttackSpeedMultiplier(multiplier: number, duration: number): void;
    drawAreaPulse(x: number, y: number, radius: number, color: string): void;
    addSpriteChild(parent: Node, name: string, frameName: string, width: number, height: number): Sprite | null;
}

// ── OffhandManager ─────────────────────────────────────────────
export class OffhandManager {
    private ctx: OffhandHostContext;
    private entities: OffhandEntity[] = [];
    private entityNode: Node | null = null;
    private equippedVisualNode: Node | null = null;
    private equippedVisualId = '';

    // Cooldown tracking (seconds remaining)
    private _cooldowns: Record<string, number> = {};

    // Shield hit counter (铜墙护盾)
    private shieldHitCount = 0;

    // 烈焰漩涡 trail nodes
    private burnTrail: BurnTrailPoint[] = [];
    private static readonly MAX_TRAIL = 20;
    private burnFrameX = 0;
    private burnFrameY = 0;
    private burnFrameInitialized = false;
    private burnTickX = 0;
    private burnTickY = 0;
    private burnTickInitialized = false;
    private burnTrailTargetCounts: Map<Enemy, number> = new Map();
    private controlFieldTargets: Set<Enemy> = new Set();

    private continuousEffectTime: Record<ContinuousEffectKey, number> = {
        orbit_blade: 0,
        orbit_burn: 0,
        control_field: 0,
    };

    constructor(public context: OffhandHostContext) {
        this.ctx = context;
    }

    /** 初始化可视化层 */
    public init(worldNode: Node): void {
        this.entityNode = new Node('OffhandEntities');
        worldNode.addChild(this.entityNode);
    }

    /** 清空所有实体（战前/战后） */
    public clearBattleState(): void {
        for (const e of this.entities) {
            if (e.node && e.node.parent) e.node.removeFromParent();
            e.gfx?.clear();
        }
        this.entities = [];
        if (this.equippedVisualNode?.parent) this.equippedVisualNode.removeFromParent();
        this.equippedVisualNode = null;
        this.equippedVisualId = '';
        this.burnTrail = [];
        this.burnFrameX = 0;
        this.burnFrameY = 0;
        this.burnFrameInitialized = false;
        this.burnTickX = 0;
        this.burnTickY = 0;
        this.burnTickInitialized = false;
        this.burnTrailTargetCounts.clear();
        this.controlFieldTargets.clear();
        this._cooldowns = {};
        this.continuousEffectTime.orbit_blade = 0;
        this.continuousEffectTime.orbit_burn = 0;
        this.continuousEffectTime.control_field = 0;
        this.shieldHitCount = 0;
    }

    /** 主 tick：每帧调用 */
    public tick(dt: number): void {
        const offhandId = this.ctx.cs.equippedOffhandId;
        if (!offhandId) return;

        const def = findOffhand(offhandId);
        if (!def) return;
        this.updateEquippedVisual(def);

        const level = this.ctx.cs.offhandLevel || 1;
        const stats = getOffhandStats(def, level);

        switch (def.mechanic) {
            case 'orbit_blade': this.tickOrbitBlade(dt, stats); break;
            case 'orbit_block': this.tickOrbitBlock(dt, stats); break;
            case 'orbit_burn': this.tickOrbitBurn(dt, stats); break;
            case 'summon_blade': this.tickSummonBlade(dt, stats); break;
            case 'summon_bee': this.tickSummonBee(dt, stats); break;
            case 'summon_clone': this.tickSummonClone(dt, stats); break;
            case 'summon_bird': this.tickSummonBird(dt, stats); break;
            case 'control_mine': this.tickControlMine(dt, stats); break;
            case 'control_field': this.tickControlField(dt, stats); break;
            case 'control_seal': this.tickControlSeal(dt, stats); break;
            case 'burst_rift': this.tickBurstRift(dt, stats); break;
            case 'burst_eye': this.tickBurstEye(dt, stats); break;
            case 'burst_time': this.tickBurstTime(dt, stats); break;
            case 'support_nano': this.tickSupportNano(dt, stats); break;
            case 'support_shield': this.tickSupportShield(dt, stats); break;
        }
    }

    /** 当玩家受到伤害时调用（用于铜墙护盾） */
    public onPlayerHit(): void {
        const offhandId = this.ctx.cs.equippedOffhandId;
        if (!offhandId) return;
        const def = findOffhand(offhandId);
        if (!def || def.mechanic !== 'support_shield') return;

        const level = this.ctx.cs.offhandLevel || 1;
        const stats = getOffhandStats(def, level);
        this.shieldHitCount++;
        if (this.shieldHitCount >= stats.shieldAmount) {
            this.shieldHitCount = 0;
            this.ctx.cs.invulnerableTimer += 0.3; // 短时间无敌
            this.ctx.drawAreaPulse(this.ctx.cs.playerX, this.ctx.cs.playerY, 80, '#F9C74F');
            this.ctx.spawnFloatingText('免伤!', this.ctx.cs.playerX, this.ctx.cs.playerY + 30, '#F9C74F', 18);
            if (stats.healPct > 0) {
                this.ctx.healPlayer(Math.round(this.ctx.cs.playerMaxHp * stats.healPct / 100));
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // 🔵 环绕型
    // ════════════════════════════════════════════════════════════

    private consumeContinuousEffectTicks(key: ContinuousEffectKey, dt: number): number {
        const accumulated = this.continuousEffectTime[key] + Math.max(0, dt);
        const ticks = Math.floor((accumulated + CONTINUOUS_TICK_EPSILON) / OFFHAND_CONTINUOUS_TICK_INTERVAL);
        const remainder = accumulated - ticks * OFFHAND_CONTINUOUS_TICK_INTERVAL;
        this.continuousEffectTime[key] = remainder > CONTINUOUS_TICK_EPSILON ? remainder : 0;
        return ticks;
    }

    private tickOrbitBlade(dt: number, stats: OffhandStats): void {
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        const count = stats.count;
        const speed = stats.speed; // 圈/秒
        const baseAngle = this.ctx.cs.combatTime * speed * Math.PI * 2;
        const radius = stats.radius;

        const damageTicks = this.consumeContinuousEffectTicks('orbit_blade', dt);
        if (damageTicks > 0) {
            const remainder = this.continuousEffectTime.orbit_blade;
            const damagePerTick = stats.damage
                * OFFHAND_CONTINUOUS_TICK_INTERVAL
                * OFFHAND_CONTINUOUS_BASELINE_FPS;
            for (let tick = 0; tick < damageTicks; tick++) {
                const ticksAfter = damageTicks - tick - 1;
                const tickTime = this.ctx.cs.combatTime
                    - remainder
                    - ticksAfter * OFFHAND_CONTINUOUS_TICK_INTERVAL;
                const endAngle = tickTime * speed * Math.PI * 2;
                const sweepAngle = speed * Math.PI * 2 * OFFHAND_CONTINUOUS_TICK_INTERVAL;
                this.applyOrbitBladeDamage(
                    px,
                    py,
                    count,
                    radius,
                    endAngle - sweepAngle,
                    sweepAngle,
                    damagePerTick,
                );
            }
        }
        // 画 blades — 用 entities 缓存
        this.syncOrbitEntities(count, 'orbit', baseAngle, radius, '#F97316');
    }

    private applyOrbitBladeDamage(
        px: number,
        py: number,
        count: number,
        radius: number,
        startAngle: number,
        sweepAngle: number,
        damage: number,
    ): void {
        for (let i = 0; i < count; i++) {
            const bladeStartAngle = startAngle + (Math.PI * 2 * i) / count;
            for (const enemy of this.ctx.enemyMgr.enemies) {
                if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                const contactFraction = getOffhandSweepContactFraction(
                    pos.x - px,
                    pos.y - py,
                    bladeStartAngle,
                    sweepAngle,
                    radius,
                    enemy.radius + 20,
                );
                if (contactFraction <= 0) continue;
                this.ctx.enemyMgr.damageEnemy(
                    enemy,
                    damage * contactFraction,
                    '#F97316',
                    '回旋',
                );
            }
        }
    }

    private tickOrbitBlock(dt: number, stats: OffhandStats): void {
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        const count = stats.count;
        const radius = stats.radius;
        const angleOffset = this.ctx.cs.combatTime * 0.5;
        // 星点围绕，格挡逻辑由 projectileManager 遍历本 entities 完成
        this.syncOrbitEntities(count, 'block', angleOffset, radius, '#4CC9F0');
    }

    private tickOrbitBurn(dt: number, stats: OffhandStats): void {
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        const frameStartX = this.burnFrameInitialized ? this.burnFrameX : px;
        const frameStartY = this.burnFrameInitialized ? this.burnFrameY : py;
        if (!this.burnTickInitialized) {
            this.burnTickX = frameStartX;
            this.burnTickY = frameStartY;
            this.burnTickInitialized = true;
        }
        const accumulatedBefore = this.continuousEffectTime.orbit_burn;
        const damageTicks = this.consumeContinuousEffectTicks('orbit_burn', dt);
        for (let tick = 0; tick < damageTicks; tick++) {
            const tickOffset = OFFHAND_CONTINUOUS_TICK_INTERVAL - accumulatedBefore
                + tick * OFFHAND_CONTINUOUS_TICK_INTERVAL;
            const tickX = interpolateOffhandTickPosition(frameStartX, px, tickOffset, dt);
            const tickY = interpolateOffhandTickPosition(frameStartY, py, tickOffset, dt);
            this.advanceBurnTrailGeometry(stats, this.burnTickX, this.burnTickY, tickX, tickY);
            this.burnTickX = tickX;
            this.burnTickY = tickY;
            if (tick < damageTicks - 1) {
                this.applyStoredBurnTrailTick(stats);
            } else {
                this.applyCurrentBurnTrailTick(stats);
            }
        }
        this.burnFrameX = px;
        this.burnFrameY = py;
        this.burnFrameInitialized = true;
        // 画火环 — 简单画在玩家脚下
        this.ensureEntity(0, 'burn').gfx.clear();
        const gfx = this.entities[0].gfx;
        gfx.fillColor = this.ctx.hex('#EF4444', 80);
        gfx.circle(0, 0, stats.radius);
        gfx.fill();
    }

    private advanceBurnTrailGeometry(
        stats: OffhandStats,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
    ): void {
        for (let i = this.burnTrail.length - 1; i >= 0; i--) {
            this.burnTrail[i].t -= OFFHAND_CONTINUOUS_TICK_INTERVAL;
            if (this.burnTrail[i].t <= 0) this.burnTrail.splice(i, 1);
        }
        const samples = Math.round(OFFHAND_CONTINUOUS_BASELINE_FPS * OFFHAND_CONTINUOUS_TICK_INTERVAL);
        for (let sample = 1; sample <= samples; sample++) {
            const alpha = sample / samples;
            this.burnTrail.push({
                x: startX + (endX - startX) * alpha,
                y: startY + (endY - startY) * alpha,
                t: stats.duration,
            });
            if (this.burnTrail.length > OffhandManager.MAX_TRAIL) this.burnTrail.shift();
        }
    }

    private applyCurrentBurnTrailTick(stats: OffhandStats): void {
        const damage = stats.damage * OFFHAND_CONTINUOUS_TICK_INTERVAL * 2;
        const rangeSq = stats.radius * stats.radius;
        this.burnTrailTargetCounts.clear();
        for (const trail of this.burnTrail) {
            for (const enemy of this.ctx.enemyMgr.enemies) {
                if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                const dx = trail.x - pos.x;
                const dy = trail.y - pos.y;
                if (dx * dx + dy * dy < rangeSq) {
                    this.burnTrailTargetCounts.set(enemy, (this.burnTrailTargetCounts.get(enemy) || 0) + 1);
                }
            }
        }
        this.applyBurnTrailTargetCounts(damage);
    }

    private applyStoredBurnTrailTick(stats: OffhandStats): void {
        const damage = stats.damage * OFFHAND_CONTINUOUS_TICK_INTERVAL * 2;
        this.applyBurnTrailTargetCounts(damage);
    }

    private applyBurnTrailTargetCounts(damage: number): void {
        for (const [enemy, count] of this.burnTrailTargetCounts) {
            if (this.ctx.enemyMgr.enemySet.has(enemy)) {
                this.ctx.enemyMgr.damageEnemy(enemy, damage * count, '#EF4444', '灼烧');
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // 🟢 召唤型
    // ════════════════════════════════════════════════════════════

    private get cd(): Record<string, number> { return this._cooldowns; }

    private tickSummonBlade(dt: number, stats: OffhandStats): void {
        const key = 'summon_blade';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        const nearest = this.ctx.enemyMgr.findNearestEnemy(this.ctx.cs.playerX, this.ctx.cs.playerY, stats.radius);
        if (!nearest) return;
        const pos = this.ctx.enemyMgr.getEnemyPosition(nearest);
        this.ctx.enemyMgr.damageEnemy(nearest, stats.damage, '#B5179E', '影刃');
        this.ctx.spawnFloatingText('刃!', pos.x, pos.y, '#B5179E', 14);
    }

    private tickSummonBee(dt: number, stats: OffhandStats): void {
        const key = 'summon_bee';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        // 找最近的敌人放闪电
        const nearest = this.ctx.enemyMgr.findNearestEnemy(this.ctx.cs.playerX, this.ctx.cs.playerY, stats.radius);
        if (!nearest) return;
        const pos = this.ctx.enemyMgr.getEnemyPosition(nearest);
        this.ctx.enemyMgr.damageEnemy(nearest, stats.damage, '#FACC15', '蜂群');
        this.ctx.drawAreaPulse(pos.x, pos.y, 14, '#FACC15');

        // 弹射
        let chainTarget = nearest;
        for (let i = 0; i < stats.pierce; i++) {
            const next = this.findClosestEnemyExcluding(chainTarget, 200);
            if (!next) break;
            const nPos = this.ctx.enemyMgr.getEnemyPosition(next);
            this.ctx.enemyMgr.damageEnemy(next, stats.damage * 0.6, '#EAB308', '弹射');
            this.ctx.drawAreaPulse(nPos.x, nPos.y, 10, '#EAB308');
            chainTarget = next;
        }
    }

    private tickSummonClone(dt: number, stats: OffhandStats): void {
        // 分身存在时自动复制主武器伤害 — 由 projectileManager 在处理子弹时读取 offhand stats
        // 此处仅维持可视化
        this.ensureEntity(0, 'clone');
        const gfx = this.entities[0].gfx;
        gfx.clear();
        gfx.fillColor = this.ctx.hex('#8B5CF6', 100);
        gfx.circle(this.ctx.cs.playerX + 50, this.ctx.cs.playerY, 18);
        gfx.fill();
    }

    private tickSummonBird(dt: number, stats: OffhandStats): void {
        const key = 'summon_bird';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        // 回血
        if (stats.healPct > 0) {
            const heal = Math.round(this.ctx.cs.playerMaxHp * stats.healPct / 100);
            this.ctx.healPlayer(heal);
            this.ctx.spawnFloatingText(`+${heal}`, this.ctx.cs.playerX, this.ctx.cs.playerY + 40, '#34D399', 16);
        }
    }

    // ════════════════════════════════════════════════════════════
    // 🟡 控场型
    // ════════════════════════════════════════════════════════════

    private tickControlMine(dt: number, stats: OffhandStats): void {
        const key = 'control_mine';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        for (let i = 0; i < stats.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 40;
            const mx = px + Math.cos(angle) * dist;
            const my = py + Math.sin(angle) * dist;
            this.ctx.drawAreaPulse(mx, my, stats.radius, '#A7F3D0');
            // 地雷激活：范围内的敌人减速
            for (const enemy of this.ctx.enemyMgr.enemies) {
                if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                const dx = mx - pos.x;
                const dy = my - pos.y;
                if (dx * dx + dy * dy < stats.radius * stats.radius) {
                    enemy.slowTimer = stats.slowDuration;
                    enemy.slowFactor = 1 - stats.slowFactor;
                    this.ctx.spawnFloatingText('冰!', pos.x, pos.y, '#A7F3D0', 14);
                }
            }
        }
    }

    private tickControlField(dt: number, stats: OffhandStats): void {
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        const radius = stats.radius;
        const damageTicks = this.consumeContinuousEffectTicks('control_field', dt);
        for (let tick = 0; tick < damageTicks; tick++) {
            if (tick < damageTicks - 1) {
                this.applyStoredControlFieldTick(stats);
            } else {
                this.applyCurrentControlFieldTick(px, py, radius, stats);
            }
        }
        // 画电场
        this.ensureEntity(0, 'field').gfx.clear();
        const gfx = this.entities[0].gfx;
        gfx.fillColor = this.ctx.hex('#60A5FA', 40);
        gfx.circle(0, 0, radius);
        gfx.fill();
    }

    private applyCurrentControlFieldTick(
        px: number,
        py: number,
        radius: number,
        stats: OffhandStats,
    ): void {
        const radiusSq = radius * radius;
        this.controlFieldTargets.clear();
        for (const enemy of this.ctx.enemyMgr.enemies) {
            if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
            const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
            const dx = px - pos.x;
            const dy = py - pos.y;
            if (dx * dx + dy * dy < radiusSq) {
                this.controlFieldTargets.add(enemy);
                this.applyControlFieldTargetTick(enemy, stats);
            }
        }
    }

    private applyStoredControlFieldTick(stats: OffhandStats): void {
        for (const enemy of this.controlFieldTargets) {
            if (this.ctx.enemyMgr.enemySet.has(enemy)) this.applyControlFieldTargetTick(enemy, stats);
        }
    }

    private applyControlFieldTargetTick(enemy: Enemy, stats: OffhandStats): void {
        enemy.slowTimer = 0.3;
        enemy.slowFactor = 1 - stats.slowFactor;
        const damage = stats.damage * OFFHAND_CONTINUOUS_TICK_INTERVAL;
        this.ctx.enemyMgr.damageEnemy(enemy, damage, '#60A5FA', '电场');
    }

    private tickControlSeal(dt: number, stats: OffhandStats): void {
        const key = 'control_seal';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        // 冻结随机敌人
        const alive = this.ctx.enemyMgr.enemies.filter(e => this.ctx.enemyMgr.enemySet.has(e));
        for (let i = 0; i < stats.count && alive.length > 0; i++) {
            const idx = Math.floor(Math.random() * alive.length);
            const target = alive[idx];
            const pos = this.ctx.enemyMgr.getEnemyPosition(target);
            target.slowTimer = stats.duration;
            target.slowFactor = 1; // 完全冻结
            this.ctx.drawAreaPulse(pos.x, pos.y, 24, '#CBD5E1');
            this.ctx.spawnFloatingText('封印!', pos.x, pos.y, '#CBD5E1', 16);
            alive.splice(idx, 1);
        }
    }

    // ════════════════════════════════════════════════════════════
    // 🟣 爆发型
    // ════════════════════════════════════════════════════════════

    private tickBurstRift(dt: number, stats: OffhandStats): void {
        const key = 'burst_rift';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        const nearest = this.ctx.enemyMgr.findNearestEnemy(this.ctx.cs.playerX, this.ctx.cs.playerY, 600);
        if (!nearest) return;
        const pos = this.ctx.enemyMgr.getEnemyPosition(nearest);
        for (let i = 0; i < stats.count; i++) {
            this.ctx.enemyMgr.damageEnemy(nearest, stats.damage, '#22D3EE', '虚空');
        }
        this.ctx.drawAreaPulse(pos.x, pos.y, 40, '#22D3EE');
        this.ctx.playSfx('sfx_boss_warning', 0.3, 0);
    }

    private tickBurstEye(dt: number, stats: OffhandStats): void {
        const key = 'burst_eye';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        for (const enemy of this.ctx.enemyMgr.enemies) {
            if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
            const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
            const dx = px - pos.x;
            const dy = py - pos.y;
            if (dx * dx + dy * dy > stats.radius * stats.radius) continue;
            const pctDmg = Math.max(1, Math.round(enemy.maxHp * stats.damagePct));
            this.ctx.enemyMgr.damageEnemy(enemy, pctDmg, '#CBD5E1', '暴风');
        }
        this.ctx.drawAreaPulse(px, py, stats.radius, '#CBD5E1');
        this.ctx.playSfx('sfx_boss_warning', 0.4, 0);
    }

    private tickBurstTime(dt: number, stats: OffhandStats): void {
        const key = 'burst_time';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;
        this.cd[key] = stats.cooldown;

        // 激活攻速爆发
        this.ctx.applyAttackSpeedMultiplier(stats.attackSpeedMultiplier, stats.burstDuration);
        this.ctx.spawnFloatingText(
            `加速 x${stats.attackSpeedMultiplier}!`,
            this.ctx.cs.playerX, this.ctx.cs.playerY - 30, '#E879F9', 20,
        );
        this.ctx.playSfx('sfx_boss_warning', 0.5, 0);
    }

    // ════════════════════════════════════════════════════════════
    // 🔴 防御/辅助型
    // ════════════════════════════════════════════════════════════

    private tickSupportNano(dt: number, stats: OffhandStats): void {
        const key = 'support_nano';
        this.cd[key] = (this.cd[key] || 0) - dt;
        if (this.cd[key] > 0) return;

        const hpRatio = this.ctx.cs.playerHp / this.ctx.cs.playerMaxHp;
        if (hpRatio > stats.triggerHpPct) return;

        const heal = Math.round(this.ctx.cs.playerMaxHp * stats.healPct / 100);
        this.ctx.healPlayer(heal);
        this.cd[key] = stats.cooldown;
        this.ctx.drawAreaPulse(this.ctx.cs.playerX, this.ctx.cs.playerY, 60, '#34D399');
        this.ctx.spawnFloatingText(`纳米修复 +${heal}`, this.ctx.cs.playerX, this.ctx.cs.playerY + 50, '#34D399', 18);
    }

    private tickSupportShield(_dt: number, _stats: OffhandStats): void {
        // 被动：由 onPlayerHit 触发
    }

    // ════════════════════════════════════════════════════════════
    // 通用工具
    // ════════════════════════════════════════════════════════════

    private ensureEntity(index: number, kind: string): OffhandEntity {
        while (this.entities.length <= index) {
            const node = new Node(`Offhand_${index}`);
            if (this.entityNode) this.entityNode.addChild(node);
            const gfx = node.addComponent(Graphics);
            this.entities.push({ node, gfx, kind: 0, state: {} });
        }
        return this.entities[index];
    }

    private syncOrbitEntities(count: number, kind: string, baseAngle: number, radius: number, color: string): void {
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        for (let i = 0; i < count; i++) {
            const e = this.ensureEntity(i, kind);
            const angle = baseAngle + (Math.PI * 2 * i) / count;
            e.node.setPosition(
                this.ctx.clamp(px + Math.cos(angle) * radius, -2000, 2000),
                this.ctx.clamp(py + Math.sin(angle) * radius, -2000, 2000),
                3,
            );
            e.gfx.clear();
            e.gfx.fillColor = this.ctx.hex(color, 180);
            e.gfx.circle(0, 0, 8);
            e.gfx.fill();
        }
        // 多余的隐藏
        for (let i = count; i < this.entities.length; i++) {
            if (this.entities[i].node.active) this.entities[i].node.active = false;
        }
    }

    private updateEquippedVisual(def: OffhandDef): void {
        if (!this.equippedVisualNode || this.equippedVisualId !== def.id) {
            if (this.equippedVisualNode?.parent) this.equippedVisualNode.removeFromParent();
            const node = new Node('EquippedOffhandArt');
            if (this.entityNode) this.entityNode.addChild(node);
            const sprite = this.ctx.addSpriteChild(
                node,
                'OffhandSprite',
                `offhand_${def.id.replace(/-/g, '_')}`,
                38,
                38,
            );
            const fallback = node.addComponent(Graphics);
            if (!sprite) {
                fallback.fillColor = this.ctx.hex(def.color, 220);
                fallback.circle(0, 0, 13);
                fallback.fill();
                fallback.strokeColor = this.ctx.hex('#F8FAFC', 220);
                fallback.lineWidth = 2;
                fallback.circle(0, 0, 13);
                fallback.stroke();
            }
            this.equippedVisualNode = node;
            this.equippedVisualId = def.id;
        }
        this.equippedVisualNode.setPosition(
            this.ctx.cs.playerX - 42,
            this.ctx.cs.playerY + 32,
            8,
        );
    }

    private findClosestEnemyExcluding(exclude: Enemy, maxDist: number): Enemy | null {
        let best: Enemy | null = null;
        let bestDistSq = maxDist * maxDist;
        const excludePos = this.ctx.enemyMgr.getEnemyPosition(exclude);
        for (const enemy of this.ctx.enemyMgr.enemies) {
            if (enemy === exclude || !this.ctx.enemyMgr.enemySet.has(enemy)) continue;
            const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
            const dx = pos.x - excludePos.x;
            const dy = pos.y - excludePos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                best = enemy;
            }
        }
        return best;
    }
}

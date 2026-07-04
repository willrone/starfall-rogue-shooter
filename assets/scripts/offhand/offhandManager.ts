/**
 * OffhandManager — 副武器运行时逻辑
 *
 * 15 把副武器的战斗内行为全部在此实现。
 * 每秒每帧由 RogueShooterGame.ts 调用 tick(dt)。
 *
 * 设计基线：docs/offhand_weapon_design.md
 * 副武器数据：catalogs/offhandCatalog.ts
 */
import { Color, Graphics, Layers, Node, Vec2 } from 'cc';
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
}

// ── OffhandManager ─────────────────────────────────────────────
export class OffhandManager {
    private ctx: OffhandHostContext;
    private entities: OffhandEntity[] = [];
    private entityNode: Node | null = null;

    // Cooldown tracking (seconds remaining)
    private _cooldowns: Record<string, number> = {};

    // Shield hit counter (铜墙护盾)
    private shieldHitCount = 0;

    // 烈焰漩涡 trail nodes
    private burnTrail: { x: number; y: number; t: number }[] = [];
    private static readonly MAX_TRAIL = 20;

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
        this.burnTrail = [];
        this._cooldowns = {};
        this.shieldHitCount = 0;
    }

    /** 主 tick：每帧调用 */
    public tick(dt: number): void {
        const offhandId = this.ctx.cs.equippedOffhandId;
        if (!offhandId) return;

        const def = findOffhand(offhandId);
        if (!def) return;

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

    private tickOrbitBlade(dt: number, stats: OffhandStats): void {
        const px = this.ctx.cs.playerX;
        const py = this.ctx.cs.playerY;
        const count = stats.count;
        const speed = stats.speed; // 圈/秒
        const baseAngle = this.ctx.cs.combatTime * speed * Math.PI * 2;
        const radius = stats.radius;

        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (Math.PI * 2 * i) / count;
            const bx = px + Math.cos(angle) * radius;
            const by = py + Math.sin(angle) * radius;
            // 碰触伤害
            for (const enemy of this.ctx.enemyMgr.enemies) {
                if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                const dx = bx - pos.x;
                const dy = by - pos.y;
                if (dx * dx + dy * dy < (enemy.radius + 20) * (enemy.radius + 20)) {
                    this.ctx.enemyMgr.damageEnemy(enemy, stats.damage, '#F97316', '回旋');
                    break; // 每帧只伤一个
                }
            }
        }
        // 画 blades — 用 entities 缓存
        this.syncOrbitEntities(count, 'orbit', baseAngle, radius, '#F97316');
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
        // 记录路径
        this.burnTrail.push({ x: px, y: py, t: stats.duration });
        if (this.burnTrail.length > OffhandManager.MAX_TRAIL) {
            this.burnTrail.shift();
        }
        // 更新 trail 计时器 + 伤害
        for (let i = this.burnTrail.length - 1; i >= 0; i--) {
            this.burnTrail[i].t -= dt;
            if (this.burnTrail[i].t <= 0) {
                this.burnTrail.splice(i, 1);
                continue;
            }
            // 每 0.5 秒造成一次范围伤害
            const trail = this.burnTrail[i];
            for (const enemy of this.ctx.enemyMgr.enemies) {
                if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                const dx = trail.x - pos.x;
                const dy = trail.y - pos.y;
                const range = stats.radius;
                if (dx * dx + dy * dy < range * range) {
                    this.ctx.enemyMgr.damageEnemy(enemy, stats.damage * dt * 2, '#EF4444', '灼烧');
                }
            }
        }
        // 画火环 — 简单画在玩家脚下
        this.ensureEntity(0, 'burn').gfx.clear();
        const gfx = this.entities[0].gfx;
        gfx.fillColor = this.ctx.hex('#EF4444', 80);
        gfx.circle(0, 0, stats.radius);
        gfx.fill();
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
        // 场内敌人减速+伤害
        for (const enemy of this.ctx.enemyMgr.enemies) {
            if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
            const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
            const dx = px - pos.x;
            const dy = py - pos.y;
            if (dx * dx + dy * dy < radius * radius) {
                enemy.slowTimer = 0.3;
                enemy.slowFactor = 1 - stats.slowFactor;
                this.ctx.enemyMgr.damageEnemy(enemy, stats.damage * dt, '#60A5FA', '电场');
            }
        }
        // 画电场
        this.ensureEntity(0, 'field').gfx.clear();
        const gfx = this.entities[0].gfx;
        gfx.fillColor = this.ctx.hex('#60A5FA', 40);
        gfx.circle(0, 0, radius);
        gfx.fill();
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

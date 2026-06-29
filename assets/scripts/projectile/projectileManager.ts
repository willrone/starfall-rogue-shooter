import { Color, Graphics, Layers, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import type {
    CharacterStats,
    DamageType,
    EquipmentDef,
    WeaponAttackStyle,
} from '../core/types';
import { createBaseCharacterStats } from '../core/stats';
import {
    weaponDamageAtLevel,
    weaponFireRateAtLevel,
    weaponPierceAtLevel,
    weaponBulletSpeedAtLevel,
} from '../core/combatFormulas';
import {
    WORLD_LEFT,
    WORLD_RIGHT,
    WORLD_BOTTOM,
    WORLD_TOP,
    ENEMY_PROJECTILE_LIMIT,
} from '../enemy/enemyManager';
import type { Enemy } from '../enemy/enemyManager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BULLET_HIT_CELL = 160;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface EnemyProjectile {
    node: Node;
    gfx: Graphics;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    radius: number;
    life: number;
    damageType: DamageType;
    color: string;
}

export interface Bullet {
    node: Node;
    gfx: Graphics;
    sprite: Sprite | null;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    radius: number;
    pierce: number;
    pierceDamageRetention: number;
    mechanic: string | null;
    mechData: Record<string, number> | null;
    life: number;
    maxLife: number;
    color: string;
    accent: string;
    style: WeaponAttackStyle;
    hitIds: Set<number>;
}

// ---------------------------------------------------------------------------
// Host Context
// ---------------------------------------------------------------------------

export interface ProjectileHostContext {
    cs: {
        playerX: number;
        playerY: number;
        combatTime: number;
        activeWeaponIndex: number;
        playerRadius: number;
        invulnerableTimer: number;
        critStacks: number;
        attackSpeedBoostTimer: number;
        pierceStacks: number;
        pierceStackTimer: number;
        droneCharge: number;
    };
    worldNode: Node | null;
    enemyMgr: {
        enemies: Enemy[];
        enemySet: Set<Enemy>;
        buildEnemyGrid(cellSize: number): Map<string, Enemy[]>;
        getEnemyPosition(enemy: Enemy): { x: number; y: number };
        findNearestEnemy(x: number, y: number, radius: number): Enemy | null;
        damageEnemy(enemy: Enemy, amount: number, color?: string, tag?: string): void;
        rollOutgoingDamage(enemy: Enemy, baseDamage: number, critChanceBonus?: number, critDamageBonus?: number): { amount: number; color: string; tag: string };
    };
    getCharacterStats(): CharacterStats;
    getActiveWeapon(): EquipmentDef | null;
    getWeaponAttackStyle(weapon: EquipmentDef): WeaponAttackStyle;
    getEquipmentLevel(id: string): number;
    hex(color: string, alpha?: number): Color;
    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;
    scheduleOnce(fn: () => void, delay: number): void;
    playSfx(name: string, volume?: number): void;
    perfNow(): number;
    addSpriteChild(parent: Node, name: string, frameName: string, width: number, height: number): Sprite | null;
    takeDamage(amount: number, type?: DamageType): void;
    drawAreaPulse(x: number, y: number, radius: number, color: string): void;
}

// ---------------------------------------------------------------------------
// ProjectileManager
// ---------------------------------------------------------------------------

export class ProjectileManager {
    public bullets: Bullet[] = [];
    public bulletPool: Bullet[] = [];
    public enemyProjectiles: EnemyProjectile[] = [];
    public enemyProjectilePool: EnemyProjectile[] = [];
    public perfDrawBullet = 0;

    // ── Hit spark / muzzle flash object pools ──────────────────────
    private sparkNodes: Node[] = [];
    private sparkGfx: Graphics[] = [];
    private sparkTimer: number[] = [];
    private sparkActive = 0;
    private flashNodes: Node[] = [];
    private flashGfx: Graphics[] = [];
    private flashTimer: number[] = [];
    private flashActive = 0;
    private sparkLayer: Node | null = null;
    private flashLayer: Node | null = null;
    private static readonly SPARK_POOL_SIZE = 40;
    private static readonly FLASH_POOL_SIZE = 20;
    private static readonly SPARK_LIFE = 0.12;
    private static readonly FLASH_LIFE = 0.08;

    constructor(public ctx: ProjectileHostContext) {}

    // ── Pool initialization (call once after worldNode is ready) ─────
    // ── Bullet sprite cache ─────────────────────────────────────────
    private bulletSpriteFrames: Record<string, SpriteFrame | null> = {};
    private static readonly BULLET_STYLES: Record<string, string> = {
        rifle: 'bullet_default', shotgun: 'bullet_shotgun', rail: 'bullet_rail',
        laser: 'bullet_rail', meteor: 'bullet_meteor', pulse: 'bullet_pulse',
        scythe: 'bullet_disc', disc: 'bullet_disc',
    };

    initEffectPools(worldNode: Node): void {
        this.sparkLayer = new Node('SparkLayer');
        worldNode.addChild(this.sparkLayer);
        // Preload bullet sprites
        for (const key of Object.keys(ProjectileManager.BULLET_STYLES)) {
            const file = ProjectileManager.BULLET_STYLES[key];
            const path = `effects/${file}/spriteFrame`;
            resources.load(path, SpriteFrame, (_e, sf) => {
                if (sf) this.bulletSpriteFrames[file] = sf;
            });
        }
        this.flashLayer = new Node('FlashLayer');
        worldNode.addChild(this.flashLayer);
        for (let i = 0; i < ProjectileManager.SPARK_POOL_SIZE; i++) {
            const n = new Node(`Spark${i}`);
            n.layer = Layers.Enum.UI_2D;
            n.setPosition(0, 0, 13);
            this.sparkLayer.addChild(n);
            const g = n.addComponent(Graphics);
            this.sparkNodes.push(n);
            this.sparkGfx.push(g);
            this.sparkTimer.push(-1);
        }
        for (let i = 0; i < ProjectileManager.FLASH_POOL_SIZE; i++) {
            const n = new Node(`Flash${i}`);
            n.layer = Layers.Enum.UI_2D;
            this.flashLayer.addChild(n);
            const g = n.addComponent(Graphics);
            this.flashNodes.push(n);
            this.flashGfx.push(g);
            this.flashTimer.push(-1);
        }
    }

    private acquireSpark(): number {
        for (let i = 0; i < ProjectileManager.SPARK_POOL_SIZE; i++) {
            if (this.sparkTimer[i] < 0) return i;
        }
        return -1; // pool exhausted, skip effect
    }
    private acquireFlash(): number {
        for (let i = 0; i < ProjectileManager.FLASH_POOL_SIZE; i++) {
            if (this.flashTimer[i] < 0) return i;
        }
        return -1;
    }

    public updateEffectPools(dt: number): void {
        for (let i = 0; i < ProjectileManager.SPARK_POOL_SIZE; i++) {
            if (this.sparkTimer[i] > 0) {
                this.sparkTimer[i] -= dt;
                if (this.sparkTimer[i] <= 0) {
                    this.sparkNodes[i].active = false;
                    this.sparkGfx[i].clear();
                    this.sparkActive--;
                }
            }
        }
        for (let i = 0; i < ProjectileManager.FLASH_POOL_SIZE; i++) {
            if (this.flashTimer[i] > 0) {
                this.flashTimer[i] -= dt;
                if (this.flashTimer[i] <= 0) {
                    this.flashNodes[i].active = false;
                    this.flashGfx[i].clear();
                    this.flashActive--;
                }
            }
        }
    }

    // ── Helper utilities ──────────────────────────────────────────────────

    private distanceSq(ax: number, ay: number, bx: number, by: number): number {
        const dx = ax - bx;
        const dy = ay - by;
        return dx * dx + dy * dy;
    }

    private getDamageTypeColor(type: DamageType): string {
        switch (type) {
            case 'magic': return '#B5179E';
            case 'fire': return '#F3722C';
            case 'lightning': return '#4CC9F0';
            case 'poison': return '#84CC16';
            case 'ice': return '#A7F3D0';
            case 'physical':
            default:
                return '#CBD5E1';
        }
    }

    private getWeaponAccentColor(style: WeaponAttackStyle, fallback: string): string {
        switch (style) {
            case 'shotgun': return '#FFE8A3';
            case 'rail': return '#A7F3D0';
            case 'laser': return '#D9FFF3';
            case 'chain': return '#FDE68A';
            case 'pulse': return '#FBCFE8';
            case 'drone': return '#ECFCCB';
            case 'disc': return '#FFF7AD';
            case 'spray': return '#BBF7D0';
            case 'meteor': return '#FED7AA';
            case 'ricochet': return '#BAE6FD';
            case 'scythe': return '#F5D0FE';
            case 'rifle':
            default:
                return fallback === '#4CC9F0' ? '#F8FAFC' : '#FFF7ED';
        }
    }

    private getWeaponBulletRadius(style: WeaponAttackStyle): number {
        switch (style) {
            case 'shotgun': return 6;
            case 'rail': return 5;
            case 'laser': return 4;
            case 'pulse': return 9;
            case 'disc': return 10;
            case 'spray': return 5;
            case 'meteor': return 12;
            case 'scythe': return 11;
            default: return 7;
        }
    }

    private getWeaponBulletLife(style: WeaponAttackStyle): number {
        switch (style) {
            case 'shotgun': return 0.9;
            case 'rail': return 1.72;
            case 'laser': return 1.24;
            case 'meteor': return 1.18;
            case 'spray': return 0.82;
            default: return 1.45;
        }
    }

    // ── Weapon stat getters ───────────────────────────────────────────────
    // 每级成长率: 伤害+12%, 射速+10%, 穿透+10%, 弹速+8% (公式在 combatFormulas.ts)

    getBulletDamage(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponDamage = weapon ? weapon.weaponStats?.damage || 0 : 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const stats = this.ctx.getCharacterStats();
        const base = weaponDamageAtLevel(weaponDamage, level) * Math.max(0.1, 1 + stats.weaponDamagePct);
        const baseAttackPower = createBaseCharacterStats().attackPower;
        const attackDelta = stats.attackPower - baseAttackPower;
        return Math.max(2, base + baseAttackPower * 0.15 + attackDelta);
    }

    getFireInterval(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponFireRate = weapon ? weapon.weaponStats?.fireRate || 0 : 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const stats = this.ctx.getCharacterStats();
        // 机制词条: crit_stacks (风暴步枪) 暴击叠加 1% 射速/层, 上限 5 层
        const critBoost = (this.ctx.cs.critStacks || 0) * 0.01;
        const baseRate = weaponFireRateAtLevel(weaponFireRate, level) * Math.max(0.1, 1 + stats.weaponFireRatePct + critBoost);
        return Math.max(0.07, 1 / Math.max(0.15, baseRate + stats.attackSpeed * 0.45));
    }

    getBulletSpeed(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponSpeed = weapon?.weaponStats?.bulletSpeed || 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const base = weaponBulletSpeedAtLevel(weaponSpeed, level);
        const bonus = this.ctx.getCharacterStats().bulletSpeed;
        return Math.max(260, 300 + base * 140 + bonus * 0.4);
    }

    getBulletPierce(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponPierce = weapon?.weaponStats?.pierce || 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const base = weaponPierceAtLevel(weaponPierce, level);
        const bonus = this.ctx.getCharacterStats().pierce;
        // 机制: pierce_stacks (回声弓) — 暴击叠加穿透
        const extra = this.ctx.cs.pierceStacks || 0;
        const total = base + bonus + extra;
        const guaranteed = Math.floor(total);
        return guaranteed + (Math.random() < total - guaranteed ? 1 : 0);
    }

    getPierceDamageRetention(): number {
        const bonus = this.ctx.getCharacterStats().pierceDamagePct;
        // 默认每穿透一层保留 50% 伤害；升级道具提高保留比例，上限 90%。
        return Math.min(0.9, Math.max(0.35, 0.5 + bonus));
    }

    // ── 机制词条 (Phase 2) ─────────────────────────────────────────────
    // 在每次子弹命中后调用。14 个机制中, 4 个是命中型 (hit-time),
    // 其余是飞行/状态/生成型, 会写在其他地方。
    private applyMechanicOnHit(bullet: Bullet, enemy: Enemy, roll: { tag: string; color: string }): void {
        if (!bullet.mechanic) return;
        switch (bullet.mechanic) {
            case 'crit_stacks':
                this.onCritStacks(bullet, roll);
                break;
            case 'slow':
                this.onSlowHit(bullet, enemy);
                break;
            case 'poison':
                this.onPoisonHit(bullet, enemy);
                break;
            case 'knockback':
                this.onKnockbackHit(bullet, enemy, roll);
                break;
            case 'pierce_stacks':
                this.onPierceStacksHit(bullet, roll);
                break;
            case 'pierce_bonus':
                // 在命中循环内处理, 不在这里
                break;
            case 'crit_master':
                // rollOutgoingDamage 处理
                break;
            case 'straight':
                // 穿透衰减在命中循环覆盖
                break;
            case 'ricochet':
                // 反弹在 updateBullets 处理
                break;
            case 'aoe_burn':
                this.onAoeBurnHit(bullet, enemy);
                break;
        }
    }

    // ── 机制 1: crit_stacks (风暴步枪) ─────────────────────────────────
    // 暴击时叠加 fireRate, 最多 5 层, 每秒衰减 1 层
    private onCritStacks(bullet: Bullet, roll: { tag: string }): void {
        if (roll.tag.indexOf('暴击') < 0) return;
        const stats = this.ctx.getCharacterStats();
        const cur = stats.attackSpeed;
        const next = Math.min(stats.attackSpeed + 0.04, 4.5);
        if (next > cur + 0.001) {
            // 通过临时修改 combatState 字段
            this.ctx.cs.attackSpeedBoostTimer = 3.0; // 3 秒后开始衰减
            // 直接增加 attackSpeed (简化处理: 用全局战斗状态)
            const base = createBaseCharacterStats();
            const weaponFireRate = (this.ctx.getActiveWeapon()?.weaponStats?.fireRate || 0) * this.ctx.getEquipmentLevel(this.ctx.getActiveWeapon()?.id || '');
            // 不直接改 stats, 而是给 ctx.cs 加一个临时 boost
            if (!this.ctx.cs.critStacks) this.ctx.cs.critStacks = 0;
            this.ctx.cs.critStacks = Math.min(5, this.ctx.cs.critStacks + 1);
        }
    }

    // ── 机制 2: slow (霜束发射器) ────────────────────────────────────
    // 命中减速目标 0.4 秒, 减速 40%
    private onSlowHit(bullet: Bullet, enemy: Enemy): void {
        if (enemy.boss) return; // Boss 不吃减速
        enemy.slowTimer = 0.6;
        enemy.slowFactor = 0.5; // 移动速度 × 0.5
    }

    // ── 机制 3: poison (瘟疫喷射器) ──────────────────────────────────
    // 命中叠 1 层毒 (上限 5), 每秒扣 maxHp × stacks × 0.02
    private onPoisonHit(bullet: Bullet, enemy: Enemy): void {
        if (enemy.boss) return;
        enemy.poisonStacks = Math.min(5, enemy.poisonStacks + 1);
        enemy.poisonTimer = 1.0; // 1 秒后第一次 tick
    }

    // ── 机制 4: knockback (重力锤) ───────────────────────────────────
    // 命中击退 60 像素, 暴击 2 倍
    private onKnockbackHit(bullet: Bullet, enemy: Enemy, roll: { tag: string }): void {
        if (enemy.boss) return; // Boss 不击退
        const isCrit = roll.tag.indexOf('暴击') >= 0;
        const dist = this.distance(enemy.node.position.x - this.ctx.cs.playerX, enemy.node.position.y - this.ctx.cs.playerY);
        if (dist < 0.001) return;
        const nx = (enemy.node.position.x - this.ctx.cs.playerX) / dist;
        const ny = (enemy.node.position.y - this.ctx.cs.playerY) / dist;
        const force = isCrit ? 180 : 100;
        enemy.knockbackVx = nx * force;
        enemy.knockbackVy = ny * force;
    }

    private distance(dx: number, dy: number): number {
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ── 无人机爆炸 (drone_charge 充能满后触发) ───────────────────────────
    private spawnDroneExplosion(x: number, y: number, damage: number): void {
        // 对爆炸范围内所有敌人造成伤害
        for (const enemy of this.ctx.enemyMgr.enemies) {
            if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
            const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
            const dx = x - pos.x;
            const dy = y - pos.y;
            if (dx * dx + dy * dy <= 80 * 80) {
                this.ctx.enemyMgr.damageEnemy(enemy, damage * 5, '#F9C74F', '无人机爆炸 ');
            }
        }
        this.ctx.drawAreaPulse(x, y, 80, '#F9C74F');
    }

    // ── 机制 5: pierce_stacks (回声弓) ───────────────────────────────
    // 暴击时穿透+1, 3 层封顶, 6 秒不暴击衰减 1 层
    private onPierceStacksHit(bullet: Bullet, roll: { tag: string }): void {
        if (roll.tag.indexOf('暴击') < 0) return;
        this.ctx.cs.pierceStacks = Math.min(3, (this.ctx.cs.pierceStacks || 0) + 1);
        this.ctx.cs.pierceStackTimer = 6.0;
    }

    // ── 机制 8: aoe_burn (流星发射器) ───────────────────────────────
    // 命中留下 3 秒燃烧区, 每秒 12% 攻击力的伤害
    private onAoeBurnHit(bullet: Bullet, enemy: Enemy): void {
        const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
        const burnDmg = 0.12 * bullet.damage;
        // 创建燃烧区 ID
        const zoneId = `burn_${bullet.node.uuid}_${Date.now()}`;
        const burnZones = (this as any)._burnZones || [];
        burnZones.push({
            id: zoneId,
            x: bullet.x,
            y: bullet.y,
            radius: 60,
            lifetime: 3.0,
            tickTimer: 0,
            tickInterval: 1.0,
            damagePerTick: burnDmg,
            color: '#EF4444',
            hitSet: new Set<number>(),
        });
        (this as any)._burnZones = burnZones;
        // 火焰视觉效果: 绘制一个圆环
        this.ctx.drawAreaPulse(bullet.x, bullet.y, 60, '#EF4444');
    }

    // ── Bullet creation / pooling ─────────────────────────────────────────

    createBullet(angle: number, damage: number, pierce: number, style: WeaponAttackStyle, color: string, mechanic: string | null = null): void {
        const speed = this.getBulletSpeed();
        const bullet = this.acquireBullet();
        bullet.x = this.ctx.cs.playerX;
        bullet.y = this.ctx.cs.playerY;
        bullet.vx = Math.cos(angle) * speed;
        bullet.vy = Math.sin(angle) * speed;
        bullet.damage = damage;
        bullet.style = style;
        bullet.color = color;
        bullet.accent = this.getWeaponAccentColor(style, color);
        bullet.radius = this.getWeaponBulletRadius(style);
        bullet.pierce = pierce;
        bullet.pierceDamageRetention = this.getPierceDamageRetention();
        bullet.mechanic = mechanic;
        bullet.mechData = mechanic ? {} : null;
        bullet.life = this.getWeaponBulletLife(style);
        bullet.maxLife = bullet.life;
        bullet.hitIds.clear();
        bullet.node.active = true;
        bullet.node.setPosition(bullet.x, bullet.y, 6);
        bullet.node.angle = angle * 180 / Math.PI;
        // Assign style-specific sprite
        if (bullet.sprite) {
            const sf = this.bulletSpriteFrames[ProjectileManager.BULLET_STYLES[style] || 'bullet_default'];
            if (sf) {
                bullet.sprite.spriteFrame = sf;
                bullet.sprite.node.active = true;
            } else if (bullet.gfx) {
                bullet.sprite.node.active = false;
            }
        }
        this.drawBullet(bullet);
        this.bullets.push(bullet);
    }

    acquireBullet(): Bullet {
        const pooled = this.bulletPool.pop();
        if (pooled) return pooled;

        const node = new Node('Bullet');
        node.layer = Layers.Enum.UI_2D;
        this.ctx.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(24, 24);
        const gfx = node.addComponent(Graphics);
        const sprite = this.ctx.addSpriteChild(node, 'BulletArt', 'bullet_plasma', 28, 28);
        if (sprite) sprite.node.active = false; // hide until style is set in createBullet
        return {
            node,
            gfx,
            sprite,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            damage: 0,
            radius: 7,
            pierce: 0,
            pierceDamageRetention: 0.5,
            mechanic: null,
            mechData: null,
            life: 0,
            maxLife: 0,
            color: '#4CC9F0',
            accent: '#F8FAFC',
            style: 'rifle',
            hitIds: new Set<number>(),
        };
    }

    drawBullet(bullet: Bullet): void {
        this.perfDrawBullet += 1;
        bullet.gfx.clear();
        if (bullet.sprite) {
            bullet.sprite.color = this.ctx.hex(bullet.accent, 235);
            bullet.sprite.node.getComponent(UITransform)?.setContentSize(bullet.radius * 3.2, bullet.radius * 3.2);
        }
        const tailLength = bullet.style === 'rail' ? 34 : bullet.style === 'laser' ? 42 : bullet.style === 'shotgun' ? 16 : bullet.style === 'meteor' ? 12 : 22;
        const coreRadius = bullet.radius * (bullet.style === 'rail' ? 0.56 : bullet.style === 'laser' ? 0.45 : 0.72);
        bullet.gfx.fillColor = this.ctx.hex(bullet.color, 145);
        bullet.gfx.roundRect(-tailLength, -bullet.radius * 0.42, tailLength + bullet.radius, bullet.radius * 0.84, bullet.radius * 0.42);
        bullet.gfx.fill();
        bullet.gfx.fillColor = this.ctx.hex(bullet.accent, 245);
        if (bullet.style === 'disc') {
            bullet.gfx.circle(0, 0, bullet.radius);
            bullet.gfx.fill();
            bullet.gfx.fillColor = this.ctx.hex(bullet.color, 230);
            bullet.gfx.circle(0, 0, bullet.radius * 0.45);
            bullet.gfx.fill();
        } else if (bullet.style === 'scythe') {
            bullet.gfx.moveTo(-bullet.radius * 0.8, -bullet.radius * 0.3);
            bullet.gfx.quadraticCurveTo(bullet.radius * 0.45, -bullet.radius * 1.15, bullet.radius * 1.05, 0);
            bullet.gfx.quadraticCurveTo(bullet.radius * 0.45, bullet.radius * 1.15, -bullet.radius * 0.8, bullet.radius * 0.3);
            bullet.gfx.close();
            bullet.gfx.fill();
        } else if (bullet.style === 'rail' || bullet.style === 'laser') {
            bullet.gfx.roundRect(-bullet.radius * 0.3, -coreRadius, bullet.radius * 2.2, coreRadius * 2, coreRadius);
            bullet.gfx.fill();
        } else {
            bullet.gfx.circle(0, 0, coreRadius);
            bullet.gfx.fill();
        }
    }

    removeBullet(bullet: Bullet): void {
        this.recycleBullet(bullet, true);
    }

    recycleBullet(bullet: Bullet, removeFromActive: boolean): void {
        if (removeFromActive) {
            const index = this.bullets.indexOf(bullet);
            if (index >= 0) this.bullets.splice(index, 1);
        }
        bullet.hitIds.clear();
        bullet.gfx.clear();
        bullet.node.active = false;
        this.bulletPool.push(bullet);
    }

    updateBullets(dt: number): void {
        const removing: Bullet[] = [];
        const enemyGrid = this.ctx.enemyMgr.buildEnemyGrid(BULLET_HIT_CELL);
        for (const bullet of this.bullets) {
            bullet.life -= dt;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            bullet.node.setPosition(bullet.x, bullet.y, 6);

            if (bullet.life <= 0 || bullet.x < WORLD_LEFT - 180 || bullet.x > WORLD_RIGHT + 180 || bullet.y < WORLD_BOTTOM - 180 || bullet.y > WORLD_TOP + 180) {
                // 机制: ricochet (荆棘连弩) — 撞墙反弹, 最多 2 次, 每次 +15% 伤害
                if (bullet.mechanic === 'ricochet' && bullet.life > 0) {
                    const curBounces = (bullet.mechData && bullet.mechData.bounces) || 0;
                    if (curBounces < 2) {
                        if (!bullet.mechData) bullet.mechData = {};
                        bullet.mechData.bounces = curBounces + 1;
                        bullet.damage *= 1.15;
                        // 反射方向
                        if (bullet.x < WORLD_LEFT - 180 || bullet.x > WORLD_RIGHT + 180) bullet.vx = -bullet.vx;
                        if (bullet.y < WORLD_BOTTOM - 180 || bullet.y > WORLD_TOP + 180) bullet.vy = -bullet.vy;
                        // 弹回场内
                        bullet.x = Math.max(WORLD_LEFT, Math.min(WORLD_RIGHT, bullet.x));
                        bullet.y = Math.max(WORLD_BOTTOM, Math.min(WORLD_TOP, bullet.y));
                        bullet.node.setPosition(bullet.x, bullet.y, 6);
                        continue;
                    }
                }
                removing.push(bullet);
                continue;
            }

            // 机制: split (量子织机) — 飞行 0.5 秒后分裂 2 颗
            if (bullet.mechanic === 'split' && (bullet.mechData?.splitDone || 0) === 0 && bullet.life <= bullet.maxLife - 0.5) {
                if (!bullet.mechData) bullet.mechData = {};
                (bullet.mechData as Record<string, number>).splitDone = 1;
                for (const offset of [-0.35, 0.35]) {
                    const a = Math.atan2(bullet.vy, bullet.vx) + offset;
                    const s = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
                    const splitBullet = this.acquireBullet();
                    splitBullet.x = bullet.x;
                    splitBullet.y = bullet.y;
                    splitBullet.vx = Math.cos(a) * s;
                    splitBullet.vy = Math.sin(a) * s;
                    splitBullet.damage = bullet.damage * 0.7;
                    splitBullet.style = bullet.style;
                    splitBullet.color = bullet.color;
                    splitBullet.accent = bullet.accent;
                    splitBullet.radius = bullet.radius;
                    splitBullet.pierce = bullet.pierce;
                    splitBullet.pierceDamageRetention = bullet.pierceDamageRetention;
                    splitBullet.mechanic = null;
                    splitBullet.mechData = null;
                    splitBullet.life = bullet.maxLife - 0.5;
                    splitBullet.maxLife = splitBullet.life;
                    splitBullet.hitIds.clear();
                    splitBullet.node.active = true;
                    splitBullet.node.setPosition(splitBullet.x, splitBullet.y, 6);
                    splitBullet.node.angle = a * 180 / Math.PI;
                    this.drawBullet(splitBullet);
                    this.bullets.push(splitBullet);
                }
                // 原弹消失
                removing.push(bullet);
                continue;
            }

            const cellX = Math.floor(bullet.x / BULLET_HIT_CELL);
            const cellY = Math.floor(bullet.y / BULLET_HIT_CELL);
            let bulletRemoved = false;
            for (let ox = -1; ox <= 1 && !bulletRemoved; ox++) {
                for (let oy = -1; oy <= 1 && !bulletRemoved; oy++) {
                    const bucket = enemyGrid.get(`${cellX + ox},${cellY + oy}`);
                    if (!bucket) continue;
                    for (const enemy of bucket) {
                        if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                        if (bullet.hitIds.has(enemy.id)) continue;
                        const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                        const distSq = this.distanceSq(bullet.x, bullet.y, pos.x, pos.y);
                        const hitRadius = bullet.radius + enemy.radius;
                        if (distSq <= hitRadius * hitRadius) {
                            bullet.hitIds.add(enemy.id);
                            const pierceDepth = Math.max(0, bullet.hitIds.size - 1);
                            // 机制: straight (离子长枪) — 穿透不衰减
                            const pierceRetention = bullet.mechanic === 'straight' ? 1.0 : bullet.pierceDamageRetention;
                            // 机制: pierce_bonus (磁轨炮) — 每次穿透 +8% 伤害
                            if (bullet.mechanic === 'pierce_bonus') {
                                if (!bullet.mechData) bullet.mechData = {};
                                bullet.mechData.pierceCount = (bullet.mechData.pierceCount || 0) + 1;
                            }
                            const pierceBonus = (bullet.mechanic === 'pierce_bonus' && bullet.mechData?.pierceCount)
                                ? 1 + (bullet.mechData.pierceCount - 1) * 0.15 : 1.0;
                            const retainedDamage = bullet.damage * Math.pow(pierceRetention, pierceDepth) * pierceBonus;
                            const critMastery = bullet.mechanic === 'crit_master';
                            const roll = this.ctx.enemyMgr.rollOutgoingDamage(enemy, retainedDamage, critMastery ? 0.15 : 0, critMastery ? 0.30 : 0);
                            this.ctx.enemyMgr.damageEnemy(enemy, roll.amount, roll.color, roll.tag);
                            // 机制词条: drone_charge (轨道无人机) — 击杀充能
                            if (bullet.mechanic === 'drone_charge') {
                                const isDead = !this.ctx.enemyMgr.enemySet.has(enemy);
                                if (isDead) {
                                    if (!this.ctx.cs.droneCharge) this.ctx.cs.droneCharge = 0;
                                    this.ctx.cs.droneCharge += 20; // 每击杀一个怪 +20%, 5 杀 1 爆
                                    if (this.ctx.cs.droneCharge >= 100) {
                                        this.ctx.cs.droneCharge = 0;
                                        this.spawnDroneExplosion(bullet.x, bullet.y, bullet.damage);
                                    }
                                }
                            }
                            // 机制词条调度 (Phase 2)
                            this.applyMechanicOnHit(bullet, enemy, roll);
                            // 限制火花频率：每3次命中才画1次，减少渲染节点 churn
                            if (Math.random() < 0.33) {
                                this.spawnBulletHitSpark(bullet.x, bullet.y, bullet.style, bullet.color, bullet.accent);
                            }
                            bullet.pierce -= 1;
                            if (bullet.pierce < 0) {
                                removing.push(bullet);
                                bulletRemoved = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
        // 机制: 燃烧区 tick (aoe_burn)
        this.tickBurnZones(dt);
        for (const bullet of removing) {
            this.removeBullet(bullet);
        }
    }

    private tickBurnZones(dt: number): void {
        const zones: any[] = (this as any)._burnZones;
        if (!zones || zones.length === 0) return;
        const toRemove: number[] = [];
        for (let i = 0; i < zones.length; i++) {
            const zone = zones[i];
            zone.lifetime -= dt;
            if (zone.lifetime <= 0) { toRemove.push(i); continue; }
            zone.tickTimer += dt;
            if (zone.tickTimer >= zone.tickInterval) {
                zone.tickTimer = 0;
                // 对区域内所有怪造成伤害
                for (const enemy of this.ctx.enemyMgr.enemies) {
                    if (!this.ctx.enemyMgr.enemySet.has(enemy)) continue;
                    if (zone.hitSet.has(enemy.id)) continue;
                    const pos = this.ctx.enemyMgr.getEnemyPosition(enemy);
                    const dx = zone.x - pos.x;
                    const dy = zone.y - pos.y;
                    if (dx * dx + dy * dy <= zone.radius * zone.radius) {
                        zone.hitSet.add(enemy.id);
                        this.ctx.enemyMgr.damageEnemy(enemy, zone.damagePerTick, zone.color, '燃烧 ');
                    }
                }
            }
        }
        // 移除过期 zone
        for (const idx of toRemove.sort((a, b) => b - a)) {
            zones.splice(idx, 1);
        }
        (this as any)._burnZones = zones;
    }

    // ── Muzzle flash / hit spark ──────────────────────────────────────────

    spawnMuzzleFlash(angle: number, style: WeaponAttackStyle, color: string, shotCount: number): void {
        const idx = this.acquireFlash();
        if (idx < 0) return;
        const node = this.flashNodes[idx];
        const gfx = this.flashGfx[idx];
        node.setPosition(this.ctx.cs.playerX + Math.cos(angle) * 38, this.ctx.cs.playerY + Math.sin(angle) * 38, 12);
        node.angle = angle * 180 / Math.PI;
        node.active = true;
        const length = style === 'rail' ? 58 : style === 'shotgun' ? 42 : style === 'meteor' ? 34 : 30;
        const width = style === 'shotgun' ? 16 + shotCount * 2 : style === 'rail' ? 8 : 12;
        gfx.clear();
        gfx.fillColor = this.ctx.hex(color, 170);
        gfx.moveTo(-4, 0);
        gfx.lineTo(length, width * 0.5);
        gfx.lineTo(length * 0.68, 0);
        gfx.lineTo(length, -width * 0.5);
        gfx.close();
        gfx.fill();
        gfx.fillColor = this.ctx.hex(this.getWeaponAccentColor(style, color), 230);
        gfx.circle(0, 0, Math.max(7, width * 0.42));
        gfx.fill();
        this.flashTimer[idx] = ProjectileManager.FLASH_LIFE;
        this.flashActive++;
    }

    spawnBulletHitSpark(x: number, y: number, style: WeaponAttackStyle, color: string, accent: string): void {
        const idx = this.acquireSpark();
        if (idx < 0) return;
        const node = this.sparkNodes[idx];
        const gfx = this.sparkGfx[idx];
        node.setPosition(x, y, 13);
        node.active = true;
        const radius = style === 'meteor' ? 24 : style === 'pulse' ? 20 : style === 'rail' ? 16 : 12;
        gfx.clear();
        gfx.fillColor = this.ctx.hex(color, 70);
        gfx.circle(0, 0, radius);
        gfx.fill();
        gfx.strokeColor = this.ctx.hex(accent, 215);
        gfx.lineWidth = style === 'rail' ? 4 : 3;
        gfx.circle(0, 0, radius * 0.72);
        gfx.stroke();
        if (style === 'rail' || style === 'laser') {
            gfx.moveTo(-radius, 0);
            gfx.lineTo(radius, 0);
            gfx.moveTo(0, -radius * 0.55);
            gfx.lineTo(0, radius * 0.55);
            gfx.stroke();
        }
        this.sparkTimer[idx] = ProjectileManager.SPARK_LIFE;
        this.sparkActive++;
    }

    // ── Enemy projectile pooling / lifecycle ──────────────────────────────

    createEnemyProjectile(x: number, y: number, angle: number, damage: number, damageType: DamageType, speed: number): void {
        if (this.enemyProjectiles.length >= ENEMY_PROJECTILE_LIMIT) {
            const oldest = this.enemyProjectiles.shift();
            if (oldest) this.recycleEnemyProjectile(oldest, false);
        }

        const projectile = this.acquireEnemyProjectile();
        projectile.x = x;
        projectile.y = y;
        projectile.vx = Math.cos(angle) * speed;
        projectile.vy = Math.sin(angle) * speed;
        projectile.damage = damage;
        projectile.radius = damageType === 'fire' ? 10 : 8;
        projectile.life = 3.2;
        projectile.damageType = damageType;
        projectile.color = this.getDamageTypeColor(damageType);
        projectile.node.active = true;
        projectile.node.setPosition(projectile.x, projectile.y, 7);
        projectile.node.angle = angle * 180 / Math.PI;
        this.drawEnemyProjectile(projectile);
        this.enemyProjectiles.push(projectile);
    }

    acquireEnemyProjectile(): EnemyProjectile {
        const pooled = this.enemyProjectilePool.pop();
        if (pooled) return pooled;

        const node = new Node('EnemyProjectile');
        node.layer = Layers.Enum.UI_2D;
        this.ctx.worldNode!.addChild(node);
        node.addComponent(UITransform).setContentSize(28, 28);
        const gfx = node.addComponent(Graphics);
        return {
            node,
            gfx,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            damage: 0,
            radius: 8,
            life: 0,
            damageType: 'physical',
            color: this.getDamageTypeColor('physical'),
        };
    }

    drawEnemyProjectile(projectile: EnemyProjectile): void {
        projectile.gfx.clear();
        projectile.gfx.fillColor = this.ctx.hex('#020617', 110);
        projectile.gfx.circle(2, -2, projectile.radius + 3);
        projectile.gfx.fill();
        projectile.gfx.fillColor = this.ctx.hex(projectile.color);
        projectile.gfx.circle(0, 0, projectile.radius);
        projectile.gfx.fill();
        projectile.gfx.strokeColor = this.ctx.hex('#F8FAFC', 150);
        projectile.gfx.lineWidth = 2;
        projectile.gfx.circle(0, 0, projectile.radius + 1);
        projectile.gfx.stroke();
    }

    removeEnemyProjectile(projectile: EnemyProjectile): void {
        this.recycleEnemyProjectile(projectile, true);
    }

    recycleEnemyProjectile(projectile: EnemyProjectile, removeFromActive: boolean): void {
        if (removeFromActive) {
            const index = this.enemyProjectiles.indexOf(projectile);
            if (index >= 0) this.enemyProjectiles.splice(index, 1);
        }
        projectile.gfx.clear();
        projectile.node.active = false;
        this.enemyProjectilePool.push(projectile);
    }

    updateEnemyProjectiles(dt: number): void {
        const removing: EnemyProjectile[] = [];
        for (const projectile of this.enemyProjectiles) {
            projectile.life -= dt;
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
            projectile.node.setPosition(projectile.x, projectile.y, 7);
            if (projectile.life <= 0 || projectile.x < WORLD_LEFT - 160 || projectile.x > WORLD_RIGHT + 160 || projectile.y < WORLD_BOTTOM - 160 || projectile.y > WORLD_TOP + 160) {
                removing.push(projectile);
                continue;
            }

            const hitRadius = projectile.radius + this.ctx.cs.playerRadius;
            if (this.distanceSq(projectile.x, projectile.y, this.ctx.cs.playerX, this.ctx.cs.playerY) <= hitRadius * hitRadius) {
                if (this.ctx.cs.invulnerableTimer <= 0) {
                    this.ctx.takeDamage(projectile.damage, projectile.damageType);
                }
                removing.push(projectile);
            }
        }
        for (const projectile of removing) {
            this.removeEnemyProjectile(projectile);
        }
    }
}

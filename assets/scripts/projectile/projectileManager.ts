import { Color, Graphics, Layers, Node, Sprite, UITransform } from 'cc';
import type {
    CharacterStats,
    DamageType,
    EquipmentDef,
    WeaponAttackStyle,
} from '../core/types';
import { createBaseCharacterStats } from '../core/stats';
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
    };
    worldNode: Node | null;
    enemyMgr: {
        enemies: Enemy[];
        enemySet: Set<Enemy>;
        buildEnemyGrid(cellSize: number): Map<string, Enemy[]>;
        findNearestEnemy(x: number, y: number, radius: number): Enemy | null;
        damageEnemy(enemy: Enemy, amount: number, color?: string, tag?: string): void;
        rollOutgoingDamage(enemy: Enemy, baseDamage: number): { amount: number; color: string; tag: string };
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
    initEffectPools(worldNode: Node): void {
        this.sparkLayer = new Node('SparkLayer');
        worldNode.addChild(this.sparkLayer);
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

    getBulletDamage(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponDamage = weapon ? weapon.weaponStats?.damage || 0 : 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const base = weaponDamage * level;
        const baseAttackPower = createBaseCharacterStats().attackPower;
        const attackDelta = this.ctx.getCharacterStats().attackPower - baseAttackPower;
        return Math.max(2, base + baseAttackPower * 0.15 + attackDelta);
    }

    getFireInterval(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponFireRate = weapon ? weapon.weaponStats?.fireRate || 0 : 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const baseRate = weaponFireRate * level;
        const attackSpeedBonus = this.ctx.getCharacterStats().attackSpeed;
        return Math.max(0.07, 1 / Math.max(0.15, baseRate + attackSpeedBonus * 0.45));
    }

    getBulletSpeed(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponSpeed = weapon?.weaponStats?.bulletSpeed || 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const base = weaponSpeed * level;
        const bonus = this.ctx.getCharacterStats().bulletSpeed;
        return Math.max(260, 300 + base * 140 + bonus * 0.4);
    }

    getBulletPierce(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponPierce = weapon?.weaponStats?.pierce || 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const base = weaponPierce * level;
        const bonus = this.ctx.getCharacterStats().pierce;
        const total = base + bonus * 0.3;
        const guaranteed = Math.floor(total);
        return guaranteed + (Math.random() < total - guaranteed ? 1 : 0);
    }

    // ── Bullet creation / pooling ─────────────────────────────────────────

    createBullet(angle: number, damage: number, pierce: number, style: WeaponAttackStyle, color: string): void {
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
        bullet.life = this.getWeaponBulletLife(style);
        bullet.maxLife = bullet.life;
        bullet.hitIds.clear();
        bullet.node.active = true;
        bullet.node.setPosition(bullet.x, bullet.y, 6);
        bullet.node.angle = angle * 180 / Math.PI;
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
                        const distSq = this.distanceSq(bullet.x, bullet.y, enemy.node.position.x, enemy.node.position.y);
                        const hitRadius = bullet.radius + enemy.radius;
                        if (distSq <= hitRadius * hitRadius) {
                            bullet.hitIds.add(enemy.id);
                            const roll = this.ctx.enemyMgr.rollOutgoingDamage(enemy, bullet.damage);
                            this.ctx.enemyMgr.damageEnemy(enemy, roll.amount, roll.color, roll.tag);
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
        for (const bullet of removing) {
            this.removeBullet(bullet);
        }
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

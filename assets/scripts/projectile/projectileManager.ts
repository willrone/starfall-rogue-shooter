import { Color, Graphics, Layers, Node, resources, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
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
    trail: { x: number; y: number }[];   // 弹道拖尾位置历史
}

interface SprayConeVfx {
    x: number;
    y: number;
    angle: number;
    range: number;
    color: string;
    timer: number;
    seed: number;
}

interface SprayMistVfx {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    angularVelocity: number;
    baseScale: number;
    timer: number;
    maxTimer: number;
    color: string;
    alpha: number;
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
        overheatStacks: number;
        shakeIntensity: number;
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
    healPlayer(amount: number): void;
    spawnFloatingText(text: string, x: number, y: number, color: string, fontSize?: number): void;
    getEquipmentLevel(id: string): number;
    hex(color: string, alpha?: number): Color;
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
    private sprayNodes: Node[] = [];
    private sprayGfx: Graphics[] = [];
    private sprayTimer: number[] = [];
    private sprayCones: SprayConeVfx[] = [];
    private sprayMistNodes: Node[] = [];
    private sprayMistSprites: Sprite[] = [];
    private sprayMistOpacity: UIOpacity[] = [];
    private sprayMistState: (SprayMistVfx | null)[] = [];
    private sprayMistFrame: SpriteFrame | null = null;
    private sprayOverlayGfx: Graphics | null = null;
    private sprayOverlayShared = false;
    private sparkLayer: Node | null = null;
    private flashLayer: Node | null = null;
    private sprayLayer: Node | null = null;
    private static readonly SPARK_POOL_SIZE = 40;
    private static readonly FLASH_POOL_SIZE = 20;
    private static readonly SPRAY_POOL_SIZE = 16;
    private static readonly SPRAY_MIST_POOL_SIZE = 72;
    private static readonly SPARK_LIFE = 0.12;
    private static readonly FLASH_LIFE = 0.08;
    private static readonly SPRAY_LIFE = 0.34;
    private static readonly SPRAY_MIST_LIFE = 0.42;

    constructor(public ctx: ProjectileHostContext) {
        // Per-battle pools — must be cleared on battle reset to prevent memory leaks
        (this as any)._burnZones = [];
    }

    /** Clear all per-battle state. Call from beginBattle / resetCombatSession. */
    public clearBattleState(): void {
        (this as any)._burnZones = [];
        this.sprayCones = [];
        if (this.sprayOverlayGfx && !this.sprayOverlayShared) this.sprayOverlayGfx.clear();
        for (let i = 0; i < this.sprayTimer.length; i++) {
            this.sprayTimer[i] = -1;
            if (this.sprayNodes[i]) this.sprayNodes[i].active = false;
            if (this.sprayGfx[i]) this.sprayGfx[i].clear();
        }
        for (let i = 0; i < this.sprayMistState.length; i++) {
            this.sprayMistState[i] = null;
            if (this.sprayMistNodes[i]) this.sprayMistNodes[i].active = false;
            if (this.sprayMistOpacity[i]) this.sprayMistOpacity[i].opacity = 0;
        }
    }

    // ── Pool initialization (call once after worldNode is ready) ─────
    // ── Bullet sprite cache ─────────────────────────────────────────
    private bulletSpriteFrames: Record<string, SpriteFrame | null> = {};
    private static readonly BULLET_STYLES: Record<string, string> = {
        rifle: 'bullet_default',
        smg: 'bullet_default',
        spray: 'bullet_pulse',
        frost: 'bullet_rail',
        echo: 'bullet_default',
        scatter: 'bullet_shotgun',
        prism: 'bullet_pulse',
        quantum: 'bullet_pulse',
        ion: 'bullet_rail',
        thorn: 'bullet_disc',
        rail: 'bullet_rail',
        void_needle: 'bullet_rail',
        meteor: 'bullet_meteor',
        drone: 'bullet_disc',
        gravity: 'bullet_meteor',
        void_tear: 'bullet_disc',
        icefire: 'bullet_pulse',
        web: 'bullet_disc',
        // Legacy aliases
        shotgun: 'bullet_shotgun',
        laser: 'bullet_rail',
        pulse: 'bullet_pulse',
        scythe: 'bullet_disc',
        disc: 'bullet_disc',
        chain: 'bullet_disc',
        ricochet: 'bullet_default',
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
        resources.load('effects/poison_mist_particle/spriteFrame', SpriteFrame, (_e, sf) => {
            if (!sf) return;
            this.sprayMistFrame = sf;
            for (const sprite of this.sprayMistSprites) sprite.spriteFrame = sf;
        });
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
        this.sprayLayer = new Node('SprayLayer');
        this.sprayLayer.layer = Layers.Enum.UI_2D;
        worldNode.addChild(this.sprayLayer);
        for (let i = 0; i < ProjectileManager.SPRAY_POOL_SIZE; i++) {
            const n = new Node(`PoisonSpray${i}`);
            n.layer = Layers.Enum.UI_2D;
            n.setPosition(0, 0, 30);
            n.active = false;
            // Add spray nodes directly to worldNode like bullets/enemy projectiles.
            // A nested default-layer parent can be culled differently on mini-game runtimes.
            worldNode.addChild(n);
            n.addComponent(UITransform).setContentSize(960, 560);
            const g = n.addComponent(Graphics);
            this.sprayNodes.push(n);
            this.sprayGfx.push(g);
            this.sprayTimer.push(-1);
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
    private acquireSpray(): number {
        for (let i = 0; i < ProjectileManager.SPRAY_POOL_SIZE; i++) {
            if (this.sprayTimer[i] < 0) return i;
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
        for (let i = 0; i < ProjectileManager.SPRAY_POOL_SIZE; i++) {
            if (this.sprayTimer[i] > 0) {
                this.sprayTimer[i] -= dt;
                if (this.sprayTimer[i] <= 0) {
                    this.sprayNodes[i].active = false;
                    this.sprayGfx[i].clear();
                    this.sprayTimer[i] = -1;
                }
            }
        }
        if (this.sprayCones.length > 0) {
            for (let i = this.sprayCones.length - 1; i >= 0; i--) {
                this.sprayCones[i].timer -= dt;
                if (this.sprayCones[i].timer <= 0) this.sprayCones.splice(i, 1);
            }
            this.renderSprayOverlay();
        } else if (this.sprayOverlayGfx && !this.sprayOverlayShared) {
            this.sprayOverlayGfx.clear();
        }
        this.updateSprayMistParticles(dt);
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
            case 'smg': return '#FED7AA';
            case 'frost': return '#E0F2FE';
            case 'echo': return '#E0F7FF';
            case 'scatter': return '#FFE8A3';
            case 'prism': return '#F0ABFC';
            case 'quantum': return '#99F6E4';
            case 'ion': return '#A7F3D0';
            case 'thorn': return '#D9F99D';
            case 'void_needle': return '#F0ABFC';
            case 'gravity': return '#CBD5E1';
            case 'void_tear': return '#CFFAFE';
            case 'icefire': return '#FDBA74';
            case 'web': return '#FEF3C7';
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
            case 'smg': return 5;
            case 'frost': return 6;
            case 'echo': return 7;
            case 'scatter': return 6;
            case 'prism': return 9;
            case 'quantum': return 10;
            case 'ion': return 6;
            case 'thorn': return 7;
            case 'void_needle': return 5;
            case 'drone': return 9;
            case 'gravity': return 13;
            case 'void_tear': return 11;
            case 'icefire': return 10;
            case 'web': return 8;
            case 'shotgun': return 6;
            case 'rail': return 5;
            case 'laser': return 4;
            case 'pulse': return 9;
            case 'disc': return 10;
            case 'spray': return 9;
            case 'meteor': return 12;
            case 'scythe': return 11;
            default: return 7;
        }
    }

    private getWeaponBulletLife(style: WeaponAttackStyle): number {
        switch (style) {
            case 'smg': return 1.05;
            case 'frost': return 1.32;
            case 'echo': return 1.55;
            case 'scatter': return 0.88;
            case 'prism': return 1.15;
            case 'quantum': return 1.55;
            case 'ion': return 1.85;
            case 'thorn': return 1.65;
            case 'void_needle': return 1.72;
            case 'drone': return 1.28;
            case 'gravity': return 1.0;
            case 'void_tear': return 1.42;
            case 'icefire': return 1.26;
            case 'web': return 1.35;
            case 'shotgun': return 0.9;
            case 'rail': return 1.72;
            case 'laser': return 1.24;
            case 'meteor': return 1.18;
            case 'spray': return 0.5;
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
        const levelScale = 1 + (level - 1) * 0.12;
        const base = Math.max(0.1, weaponDamage * (levelScale + (stats.weaponDamagePct || 0)));
        const baseAttackPower = createBaseCharacterStats().attackPower;
        const attackDelta = stats.attackPower - baseAttackPower;
        return Math.max(2, base + baseAttackPower * 0.15 + attackDelta);
    }

    getFireInterval(): number {
        const weapon = this.ctx.getActiveWeapon();
        const weaponFireRate = weapon ? weapon.weaponStats?.fireRate || 0 : 0;
        const level = weapon ? this.ctx.getEquipmentLevel(weapon.id) : 1;
        const stats = this.ctx.getCharacterStats();
        // 机制词条: overheat (冲锋枪) 每层 +10% 射速, 上限 5 层
        const levelScale = 1 + (level - 1) * 0.10;
        const overheatBoost = this.ctx.cs.overheatStacks * 0.10;
        const baseRate = Math.max(0.1, weaponFireRate * (levelScale + (stats.weaponFireRatePct || 0) + overheatBoost));
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

    // ── 机制词条状态 (Phase 2) ─────────────────────────────────────────────
    // 在每次子弹命中后调用。14 个机制中, 4 个是命中型 (hit-time),
    // 其余是飞行/状态/生成型, 会写在其他地方。
    private applyMechanicOnHit(bullet: Bullet, enemy: Enemy, roll: { tag: string; color: string }): void {
        if (!bullet.mechanic) return;
        switch (bullet.mechanic) {
            case 'overheat':
                // 过热由 updateWeapons 管理，命中不处理
                break;
            case 'slow':
            case 'icefire_judge': // 冰狱审判的冰弹复用 slow 逻辑
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
            case 'void_tearer': // 虚空撕裂者扩展 pierce_bonus
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
            case 'icefire_judge': // 冰狱审判的火弹复用 aoe_burn 逻辑
                this.onAoeBurnHit(bullet, enemy);
                break;
            case 'webmaster_lifesteal':
                // 在命中循环内处理
                break;
        }
    }

    // ── 机制 2: slow (霜束发射器) ────────────────────────────────────
    // 命中减速目标 0.4 秒, 减速 40%
    private onSlowHit(bullet: Bullet, enemy: Enemy): void {
        if (enemy.boss || enemy.elite) return; // Boss 和精英不吃减速
        enemy.slowTimer = 0.6;
        enemy.slowFactor = 0.5; // 移动速度 × 0.5
    }

    // ── 机制 3: poison (瘟疫喷射器) ──────────────────────────────────
    // 命中叠 1 层毒 (上限 5), 每秒扣固定伤害 × stacks
    private onPoisonHit(bullet: Bullet, enemy: Enemy): void {
        if (enemy.boss) return;
        enemy.poisonStacks = Math.min(5, enemy.poisonStacks + 1);
        enemy.poisonTimer = 1.0;
        // 基于当前子弹伤害计算每层每秒 DOT（使 DOT 随 baseDamage/升级成长）
        enemy.poisonDps = 0.5 + bullet.damage * 0.3;
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
        // 子弹池上限保护：超过400颗子弹时回收最旧的
        if (this.bullets.length >= 400) {
            const oldest = this.bullets.shift();
            if (oldest) this.recycleBullet(oldest, false);
        }
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
            trail: [],
        };
    }

    private drawBulletTrail(gfx: Graphics, trail: { x: number; y: number }[], style: WeaponAttackStyle, color: string, accent: string, r: number): void {
        const t = trail;
        const n = t.length;

        switch (style) {
            // 冲锋枪：细长曳光线条，快速渐变淡出
            case 'smg': {
                gfx.strokeColor = this.ctx.hex(color, 120);
                gfx.lineWidth = r * 0.4;
                gfx.moveTo(t[n - 2].x, t[n - 2].y);
                gfx.lineTo(t[n - 1].x, t[n - 1].y);
                gfx.stroke();
                break;
            }

            // 霜束：宽阔冰蓝渐变光束
            case 'frost': {
                for (let i = 0; i < n - 1; i++) {
                    const alpha = 20 + 60 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, alpha);
                    gfx.lineWidth = r * 0.6 * (i / n);
                    gfx.moveTo(t[i].x, t[i].y);
                    gfx.lineTo(t[i + 1].x, t[i + 1].y);
                    gfx.stroke();
                }
                break;
            }

            // 回声弓：涟漪环
            case 'echo': {
                for (let i = 0; i < n; i += 2) {
                    const alpha = 20 + 40 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, alpha);
                    gfx.lineWidth = 1.2;
                    gfx.circle(t[i].x, t[i].y, r * (0.8 + 0.4 * (i / n)));
                    gfx.stroke();
                }
                break;
            }

            // 裂变枪管：三条短迹
            case 'scatter': {
                const offsets = [-0.6, 0, 0.6];
                for (const ox of offsets) {
                    gfx.strokeColor = this.ctx.hex(color, 60);
                    gfx.lineWidth = r * 0.3;
                    gfx.moveTo(t[n - 2].x + ox * r, t[n - 2].y);
                    gfx.lineTo(t[n - 1].x + ox * r, t[n - 1].y);
                    gfx.stroke();
                }
                break;
            }

            // 镜像棱镜：扩散光针
            case 'prism': {
                for (let i = 0; i < n; i++) {
                    const a = 15 + 50 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, a);
                    gfx.lineWidth = 1;
                    gfx.moveTo(t[i].x - r * 0.6, t[i].y);
                    gfx.lineTo(t[i].x + r * 0.6, t[i].y);
                    gfx.stroke();
                }
                break;
            }

            // 量子织机：双卫星轨迹
            case 'quantum': {
                for (let i = 0; i < n - 1; i++) {
                    const a = 15 + 50 * (i / n);
                    gfx.strokeColor = this.ctx.hex(accent, a);
                    gfx.lineWidth = 1;
                    for (const sx of [-1.35, 1.35]) {
                        gfx.moveTo(t[i].x + sx * r, t[i].y);
                        gfx.lineTo(t[i + 1].x + sx * r, t[i + 1].y);
                    }
                    gfx.stroke();
                }
                break;
            }

            // 离子长枪：笔直长束淡出
            case 'ion': {
                for (let i = 0; i < n - 1; i++) {
                    const a = 15 + 70 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, a);
                    gfx.lineWidth = r * 0.5;
                    gfx.moveTo(t[i].x, t[i].y);
                    gfx.lineTo(t[i + 1].x, t[i + 1].y);
                    gfx.stroke();
                }
                break;
            }

            // 荆棘连弩：带刺轨迹
            case 'thorn': {
                gfx.strokeColor = this.ctx.hex(color, 60);
                gfx.lineWidth = 1.2;
                for (let i = 0; i < n - 1; i++) {
                    gfx.moveTo(t[i].x, t[i].y);
                    gfx.lineTo(t[i + 1].x, t[i + 1].y);
                }
                gfx.stroke();
                for (let i = 1; i < n - 1; i += 2) {
                    gfx.fillColor = this.ctx.hex(accent, 40);
                    gfx.circle(t[i].x, t[i].y, r * 0.3);
                    gfx.fill();
                }
                break;
            }

            // 虚空针：细暗紫痕
            case 'void_needle': {
                for (let i = 0; i < n - 1; i++) {
                    const a = 10 + 50 * (i / n);
                    gfx.strokeColor = this.ctx.hex('#9333EA', a);
                    gfx.lineWidth = 1.5;
                    gfx.moveTo(t[i].x, t[i].y);
                    gfx.lineTo(t[i + 1].x, t[i + 1].y);
                    gfx.stroke();
                }
                break;
            }

            // 磁轨炮：细亮白线
            case 'rail': {
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 70);
                gfx.lineWidth = r * 0.3;
                gfx.moveTo(t[n - 2].x, t[n - 2].y);
                gfx.lineTo(t[n - 1].x, t[n - 1].y);
                gfx.stroke();
                break;
            }

            // 流星发射器：火焰拖尾
            case 'meteor': {
                for (let i = 0; i < n; i++) {
                    const a = 15 + 60 * (i / n);
                    const rad = r * (0.3 + 0.7 * (i / n));
                    gfx.fillColor = this.ctx.hex(color, a);
                    gfx.circle(t[i].x, t[i].y, rad);
                    gfx.fill();
                }
                break;
            }

            // 重力锤：暗物质震波环
            case 'gravity': {
                for (let i = 0; i < n; i += 2) {
                    const a = 20 + 40 * (i / n);
                    gfx.strokeColor = this.ctx.hex('#64748B', a);
                    gfx.lineWidth = 1.5;
                    gfx.circle(t[i].x, t[i].y, r * (0.8 + 0.3 * (i / n)));
                    gfx.stroke();
                }
                break;
            }

            // 轨道无人机：电弧点迹
            case 'drone': {
                for (let i = 0; i < n; i += 2) {
                    const a = 15 + 50 * (i / n);
                    gfx.fillColor = this.ctx.hex(color, a);
                    gfx.circle(t[i].x, t[i].y, r * 0.3);
                    gfx.fill();
                }
                break;
            }

            // 虚空撕裂者：青色裂隙痕迹
            case 'void_tear': {
                for (let i = 0; i < n - 1; i++) {
                    const a = 15 + 60 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, a);
                    gfx.lineWidth = r * 0.4;
                    gfx.moveTo(t[i].x - r * 0.2, t[i].y);
                    gfx.lineTo(t[i + 1].x + r * 0.2, t[i + 1].y);
                    gfx.stroke();
                }
                break;
            }

            // 冰狱审判：冰蓝橙双色交替
            case 'icefire': {
                for (let i = 0; i < n - 1; i++) {
                    const clr = i % 2 === 0 ? '#7DD3FC' : '#FB923C';
                    const a = 15 + 50 * (i / n);
                    gfx.fillColor = this.ctx.hex(clr, a);
                    gfx.circle(t[i].x, t[i].y, r * 0.25);
                    gfx.fill();
                }
                break;
            }

            // 织网支配者：金色链网
            case 'web': {
                for (let i = 0; i < n - 1; i++) {
                    const a = 15 + 50 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, a);
                    gfx.lineWidth = 1.2;
                    gfx.moveTo(t[i].x, t[i].y);
                    gfx.lineTo(t[i + 1].x, t[i + 1].y);
                    if (i % 2 === 0 && i + 2 < n) {
                        gfx.moveTo(t[i].x, t[i].y);
                        gfx.lineTo(t[i + 2].x, t[i + 2].y);
                    }
                    gfx.stroke();
                }
                break;
            }

            // 默认：简单线性淡出
            default: {
                for (let i = 0; i < n - 1; i++) {
                    const a = 10 + 40 * (i / n);
                    gfx.strokeColor = this.ctx.hex(color, a);
                    gfx.lineWidth = 1;
                    gfx.moveTo(t[i].x, t[i].y);
                    gfx.lineTo(t[i + 1].x, t[i + 1].y);
                    gfx.stroke();
                }
                break;
            }
        }
    }

    drawBullet(bullet: Bullet): void {
        this.perfDrawBullet += 1;
        const gfx = bullet.gfx;
        gfx.clear();
        if (bullet.sprite) {
            bullet.sprite.color = this.ctx.hex(bullet.accent, 235);
            bullet.sprite.node.getComponent(UITransform)?.setContentSize(bullet.radius * 3.2, bullet.radius * 3.2);
        }
        const c = bullet.color;
        const a = bullet.accent;
        const r = bullet.radius;

        // ── 弹道拖尾（每种武器不同） ─────────────────────────────────
        const trail = bullet.trail;
        if (trail.length >= 2) {
            this.drawBulletTrail(gfx, trail, bullet.style, c, a, r);
        }

        switch (bullet.style) {
            // ── 冲锋枪：短小高速曳光弹，连续射击像“哒哒哒” ──
            case 'smg': {
                const len = r * 3.0;
                gfx.fillColor = this.ctx.hex(c, 28);
                gfx.roundRect(-len * 1.1, -r * 0.9, len * 1.7, r * 1.8, r * 0.8);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 175);
                gfx.roundRect(-len * 0.78, -r * 0.32, len * 1.15, r * 0.64, r * 0.32);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 230);
                gfx.roundRect(-len * 1.08, -r * 0.18, len * 0.62, r * 0.36, r * 0.2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#FFFFFF', 230);
                gfx.circle(len * 0.28, 0, r * 0.26);
                gfx.fill();
                break;
            }

            // ── 霜束：冰晶长束 + 两侧冰棱 ──
            case 'frost': {
                const beamLen = r * 6.3;
                gfx.fillColor = this.ctx.hex('#E0F2FE', 24);
                gfx.roundRect(-beamLen * 0.55, -r * 2.4, beamLen, r * 4.8, r);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 130);
                gfx.roundRect(-beamLen * 0.5, -r * 0.55, beamLen * 0.92, r * 1.1, r * 0.45);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 185);
                gfx.lineWidth = 1.8;
                for (const offset of [-0.28, 0.05, 0.38]) {
                    const x = beamLen * offset;
                    gfx.moveTo(x, -r * 0.95);
                    gfx.lineTo(x + r * 0.55, 0);
                    gfx.lineTo(x, r * 0.95);
                }
                gfx.stroke();
                gfx.fillColor = this.ctx.hex('#FFFFFF', 245);
                gfx.circle(beamLen * 0.36, 0, r * 0.32);
                gfx.fill();
                break;
            }

            // ── 回声弓：箭矢 + 两层残响环 ──
            case 'echo': {
                const shaftLen = r * 3.2;
                gfx.strokeColor = this.ctx.hex(c, 45);
                gfx.lineWidth = r * 0.35;
                gfx.circle(-r * 1.7, 0, r * 0.75);
                gfx.circle(-r * 2.45, 0, r * 1.05);
                gfx.stroke();
                gfx.fillColor = this.ctx.hex(c, 160);
                gfx.roundRect(-shaftLen * 0.85, -r * 0.22, shaftLen * 0.9, r * 0.44, r * 0.2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 225);
                gfx.moveTo(r * 0.85, 0);
                gfx.lineTo(-r * 0.15, -r * 0.62);
                gfx.lineTo(-r * 0.02, 0);
                gfx.lineTo(-r * 0.15, r * 0.62);
                gfx.close();
                gfx.fill();
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 160);
                gfx.lineWidth = 1.4;
                gfx.moveTo(-shaftLen * 0.8, 0);
                gfx.lineTo(-shaftLen * 1.1, -r * 0.55);
                gfx.moveTo(-shaftLen * 0.8, 0);
                gfx.lineTo(-shaftLen * 1.1, r * 0.55);
                gfx.stroke();
                break;
            }

            // ── 裂变枪管：三枚热粉霰弹丸，一眼能看出三连 ──
            case 'scatter': {
                gfx.fillColor = this.ctx.hex('#FFFFFF', 42);
                gfx.circle(0, 0, r * 2.7);
                gfx.fill();
                for (const [px, py, scale] of [[0.35, 0, 0.82], [-0.45, -0.58, 0.62], [-0.45, 0.58, 0.62]] as const) {
                    gfx.fillColor = this.ctx.hex(c, 170);
                    gfx.circle(r * px, r * py, r * scale);
                    gfx.fill();
                    gfx.fillColor = this.ctx.hex(a, 235);
                    gfx.circle(r * px, r * py, r * scale * 0.42);
                    gfx.fill();
                }
                break;
            }

            // ── 镜像棱镜：菱形核心 + 五向折射光针 ──
            case 'prism': {
                gfx.fillColor = this.ctx.hex(c, 28);
                gfx.circle(0, 0, r * 2.7);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(a, 165);
                gfx.lineWidth = 2.2;
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 * i) / 5;
                    gfx.moveTo(Math.cos(angle) * r * 0.55, Math.sin(angle) * r * 0.55);
                    gfx.lineTo(Math.cos(angle) * r * 1.85, Math.sin(angle) * r * 1.85);
                }
                gfx.stroke();
                gfx.fillColor = this.ctx.hex(c, 145);
                gfx.moveTo(0, -r);
                gfx.lineTo(r * 0.95, 0);
                gfx.lineTo(0, r);
                gfx.lineTo(-r * 0.95, 0);
                gfx.close();
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#FFFFFF', 225);
                gfx.moveTo(0, -r * 0.48);
                gfx.lineTo(r * 0.46, 0);
                gfx.lineTo(0, r * 0.48);
                gfx.lineTo(-r * 0.46, 0);
                gfx.close();
                gfx.fill();
                break;
            }

            // ── 量子织机：分裂前的青绿色量子核 + 双卫星 ──
            case 'quantum': {
                gfx.fillColor = this.ctx.hex(c, 30);
                gfx.circle(0, 0, r * 2.6);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(a, 170);
                gfx.lineWidth = 2;
                gfx.circle(0, 0, r * 1.15);
                gfx.moveTo(-r * 1.35, 0);
                gfx.lineTo(r * 1.35, 0);
                gfx.stroke();
                gfx.fillColor = this.ctx.hex(c, 165);
                gfx.circle(0, 0, r * 0.82);
                gfx.fill();
                for (const sx of [-1.35, 1.35]) {
                    gfx.fillColor = this.ctx.hex(a, 220);
                    gfx.circle(r * sx, 0, r * 0.36);
                    gfx.fill();
                }
                gfx.fillColor = this.ctx.hex('#FFFFFF', 230);
                gfx.circle(0, 0, r * 0.25);
                gfx.fill();
                break;
            }

            // ── 离子长枪：绿色长矛光束，和磁轨炮区分为“枪尖” ──
            case 'ion': {
                const len = r * 7.2;
                gfx.fillColor = this.ctx.hex(c, 26);
                gfx.roundRect(-len * 0.55, -r * 1.8, len, r * 3.6, r * 0.8);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 135);
                gfx.roundRect(-len * 0.48, -r * 0.42, len * 0.76, r * 0.84, r * 0.28);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 235);
                gfx.moveTo(len * 0.46, 0);
                gfx.lineTo(len * 0.18, -r * 0.98);
                gfx.lineTo(len * 0.05, 0);
                gfx.lineTo(len * 0.18, r * 0.98);
                gfx.close();
                gfx.fill();
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 170);
                gfx.lineWidth = 1.5;
                gfx.moveTo(-len * 0.35, 0);
                gfx.lineTo(len * 0.28, 0);
                gfx.stroke();
                break;
            }

            // ── 荆棘连弩：倒刺弩矢，反弹武器要有“扎人”的轮廓 ──
            case 'thorn': {
                const len = r * 3.4;
                gfx.fillColor = this.ctx.hex(c, 28);
                gfx.circle(0, 0, r * 2.2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 155);
                gfx.roundRect(-len * 0.75, -r * 0.22, len, r * 0.44, r * 0.2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 225);
                gfx.moveTo(len * 0.38, 0);
                gfx.lineTo(-r * 0.1, -r * 0.58);
                gfx.lineTo(-r * 0.1, r * 0.58);
                gfx.close();
                gfx.fill();
                gfx.strokeColor = this.ctx.hex('#D9F99D', 190);
                gfx.lineWidth = 1.6;
                for (const x of [-0.62, -0.22, 0.16]) {
                    gfx.moveTo(r * x, 0);
                    gfx.lineTo(r * (x - 0.35), -r * 0.55);
                    gfx.moveTo(r * x, 0);
                    gfx.lineTo(r * (x - 0.35), r * 0.55);
                }
                gfx.stroke();
                break;
            }

            // ── 虚空针：暗紫细针 + 黑洞边缘，强调暴击刺穿 ──
            case 'void_needle': {
                const len = r * 7.0;
                gfx.fillColor = this.ctx.hex('#020617', 85);
                gfx.circle(0, 0, r * 2.4);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(c, 165);
                gfx.lineWidth = r * 0.48;
                gfx.moveTo(-len * 0.52, 0);
                gfx.lineTo(len * 0.46, 0);
                gfx.stroke();
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 215);
                gfx.lineWidth = r * 0.16;
                gfx.moveTo(-len * 0.35, 0);
                gfx.lineTo(len * 0.36, 0);
                gfx.stroke();
                gfx.fillColor = this.ctx.hex(a, 235);
                gfx.circle(len * 0.42, 0, r * 0.36);
                gfx.fill();
                break;
            }

            // ── 轨道无人机：电弧球 + 小翼片，和普通子弹区分 ──
            case 'drone': {
                gfx.fillColor = this.ctx.hex(c, 28);
                gfx.circle(0, 0, r * 2.4);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(a, 190);
                gfx.lineWidth = 2;
                gfx.circle(0, 0, r * 1.0);
                gfx.moveTo(-r * 1.4, -r * 0.6);
                gfx.lineTo(-r * 0.65, 0);
                gfx.lineTo(-r * 1.4, r * 0.6);
                gfx.moveTo(r * 1.4, -r * 0.6);
                gfx.lineTo(r * 0.65, 0);
                gfx.lineTo(r * 1.4, r * 0.6);
                gfx.stroke();
                gfx.fillColor = this.ctx.hex(c, 170);
                gfx.circle(0, 0, r * 0.62);
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#FFFFFF', 225);
                gfx.circle(r * 0.18, -r * 0.12, r * 0.22);
                gfx.fill();
                break;
            }

            // ── 重力锤：暗物质核心 + 冲击环 ──
            case 'gravity': {
                gfx.fillColor = this.ctx.hex('#020617', 110);
                gfx.circle(0, 0, r * 2.4);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(c, 120);
                gfx.lineWidth = 3;
                gfx.circle(0, 0, r * 1.75);
                gfx.stroke();
                gfx.fillColor = this.ctx.hex(c, 165);
                gfx.circle(0, 0, r * 0.92);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 225);
                gfx.circle(-r * 0.18, -r * 0.18, r * 0.42);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 130);
                gfx.lineWidth = 1.4;
                gfx.moveTo(-r * 2.1, 0);
                gfx.lineTo(r * 2.1, 0);
                gfx.moveTo(0, -r * 1.35);
                gfx.lineTo(0, r * 1.35);
                gfx.stroke();
                break;
            }

            // ── 虚空撕裂者：青色裂隙镰刃 ──
            case 'void_tear': {
                gfx.fillColor = this.ctx.hex('#020617', 80);
                gfx.circle(0, 0, r * 2.7);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 155);
                gfx.moveTo(-r * 0.95, -r * 0.2);
                gfx.quadraticCurveTo(r * 0.2, -r * 1.55, r * 1.2, -r * 0.15);
                gfx.quadraticCurveTo(r * 0.35, r * 0.15, -r * 0.82, r * 0.78);
                gfx.quadraticCurveTo(-r * 0.45, r * 0.22, -r * 0.95, -r * 0.2);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(a, 230);
                gfx.lineWidth = 2.2;
                gfx.moveTo(-r * 0.65, 0);
                gfx.quadraticCurveTo(r * 0.35, -r * 0.95, r * 1.0, -r * 0.05);
                gfx.stroke();
                break;
            }

            // ── 冰狱审判：冰火双色弹，半蓝半橙 ──
            case 'icefire': {
                gfx.fillColor = this.ctx.hex('#7DD3FC', 28);
                gfx.circle(-r * 0.25, 0, r * 2.2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#FB923C', 28);
                gfx.circle(r * 0.25, 0, r * 2.2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#7DD3FC', 165);
                gfx.moveTo(0, -r);
                gfx.quadraticCurveTo(-r * 1.05, -r * 0.45, -r * 0.55, r * 0.95);
                gfx.quadraticCurveTo(-r * 0.1, r * 0.35, 0, -r);
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#FB923C', 175);
                gfx.moveTo(0, -r);
                gfx.quadraticCurveTo(r * 1.1, -r * 0.25, r * 0.58, r * 0.98);
                gfx.quadraticCurveTo(r * 0.08, r * 0.35, 0, -r);
                gfx.fill();
                gfx.fillColor = this.ctx.hex('#FFFFFF', 235);
                gfx.circle(0, 0, r * 0.28);
                gfx.fill();
                break;
            }

            // ── 织网支配者：蛛网式金色链束 ──
            case 'web': {
                gfx.fillColor = this.ctx.hex(c, 28);
                gfx.circle(0, 0, r * 2.5);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(c, 220);
                gfx.lineWidth = 2.4;
                gfx.moveTo(-r * 1.6, 0);
                gfx.lineTo(-r * 0.65, -r * 0.65);
                gfx.lineTo(r * 0.15, 0);
                gfx.lineTo(r * 0.9, -r * 0.55);
                gfx.lineTo(r * 1.55, 0);
                gfx.stroke();
                gfx.strokeColor = this.ctx.hex(a, 155);
                gfx.lineWidth = 1.4;
                for (const x of [-0.6, 0.2, 0.95]) {
                    gfx.moveTo(r * x, 0);
                    gfx.lineTo(r * (x - 0.32), r * 0.72);
                    gfx.moveTo(r * x, 0);
                    gfx.lineTo(r * (x + 0.32), r * 0.72);
                }
                gfx.stroke();
                gfx.fillColor = this.ctx.hex('#FFFFFF', 215);
                gfx.circle(r * 1.55, 0, r * 0.35);
                gfx.fill();
                break;
            }

            // ── 步枪弹：尖头流线型弹头 ──
            case 'rifle': {
                // 外层辉光
                gfx.fillColor = this.ctx.hex(c, 30);
                gfx.circle(0, 0, r * 2.5);
                gfx.fill();
                // 弹头主体 — 泪滴形
                const len = r * 1.8;
                gfx.fillColor = this.ctx.hex(c, 160);
                gfx.moveTo(-len, 0);
                gfx.quadraticCurveTo(r * 0.4, -r * 0.7, r * 0.8, 0);
                gfx.quadraticCurveTo(r * 0.4, r * 0.7, -len, 0);
                gfx.close();
                gfx.fill();
                // 尾部尖刺
                gfx.fillColor = this.ctx.hex(a, 200);
                gfx.circle(-len * 0.6, 0, r * 0.35);
                gfx.fill();
                // 核心亮点
                gfx.fillColor = this.ctx.hex('#FFFFFF', 230);
                gfx.circle(r * 0.1, 0, r * 0.3);
                gfx.fill();
                break;
            }

            // ── 霰弹：短粗小弹丸 ──
            case 'shotgun': {
                gfx.fillColor = this.ctx.hex('#FFFFFF', 60);
                gfx.circle(0, 0, r * 2.5);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 180);
                gfx.circle(0, 0, r * 0.8);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 255);
                gfx.circle(0, 0, r * 0.4);
                gfx.fill();
                break;
            }

            // ── 磁轨炮：笔直细长穿透光束 + 发光核心 ──
            case 'rail': {
                const beamLen = r * 6;
                const beamW = r * 0.5;
                // 外层辉光
                gfx.fillColor = this.ctx.hex(a, 25);
                gfx.roundRect(-beamLen * 0.5, -beamW * 3, beamLen, beamW * 6, beamW);
                gfx.fill();
                // 光束主体
                gfx.fillColor = this.ctx.hex(c, 140);
                gfx.roundRect(-beamLen * 0.5, -beamW * 1.2, beamLen, beamW * 2.4, beamW);
                gfx.fill();
                // 内层亮核
                gfx.fillColor = this.ctx.hex('#FFFFFF', 200);
                gfx.roundRect(-beamLen * 0.3, -beamW * 0.5, beamLen * 0.6, beamW, beamW * 0.5);
                gfx.fill();
                // 头部亮点
                gfx.fillColor = this.ctx.hex('#FFFFFF', 255);
                gfx.circle(beamLen * 0.4, 0, beamW * 1.2);
                gfx.fill();
                break;
            }

            // ── 激光：粗光束 + 脉冲纹 ──
            case 'laser': {
                const lLen = r * 5;
                gfx.fillColor = this.ctx.hex(c, 30);
                gfx.roundRect(-lLen * 0.4, -r * 3, lLen, r * 6, r);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 100);
                gfx.roundRect(-lLen * 0.4, -r * 1.2, lLen, r * 2.4, r * 0.6);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 200);
                gfx.roundRect(-lLen * 0.2, -r * 0.6, lLen * 0.6, r * 1.2, r * 0.4);
                gfx.fill();
                break;
            }

            // ── 流星/重炮：大火球 + 尾焰 ──
            case 'meteor': {
                // 大范围辉光
                gfx.fillColor = this.ctx.hex('#FED7AA', 25);
                gfx.circle(0, 0, r * 3.5);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 50);
                gfx.circle(0, 0, r * 2.2);
                gfx.fill();
                // 火球主体
                gfx.fillColor = this.ctx.hex(c, 170);
                gfx.circle(0, 0, r * 0.9);
                gfx.fill();
                // 橘色内核
                gfx.fillColor = this.ctx.hex(a, 220);
                gfx.circle(-r * 0.1, -r * 0.1, r * 0.55);
                gfx.fill();
                // 白色核心
                gfx.fillColor = this.ctx.hex('#FFFFFF', 250);
                gfx.circle(r * 0.1, -r * 0.1, r * 0.25);
                gfx.fill();
                break;
            }

            // ── 脉冲：不断扩张的环形波 ──
            case 'pulse': {
                const pulsePhase = (bullet.life / bullet.maxLife) * Math.PI * 6;
                const pulseR = r * (0.6 + 0.4 * Math.sin(pulsePhase));
                gfx.fillColor = this.ctx.hex(c, 30);
                gfx.circle(0, 0, r * 2.8);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(c, 120 + 80 * Math.sin(pulsePhase));
                gfx.lineWidth = r * 0.4;
                gfx.circle(0, 0, pulseR);
                gfx.stroke();
                // 中心亮点
                gfx.fillColor = this.ctx.hex('#FFFFFF', 200);
                gfx.circle(0, 0, r * 0.2);
                gfx.fill();
                break;
            }

            // ── 飞盘/旋转刃：高速旋转双环 ──
            case 'disc': {
                const spinAngle = bullet.life * 20;
                gfx.fillColor = this.ctx.hex(c, 40);
                gfx.circle(0, 0, r * 2.0);
                gfx.fill();
                // 外环
                gfx.strokeColor = this.ctx.hex(c, 180);
                gfx.lineWidth = r * 0.3;
                gfx.circle(0, 0, r * 0.8);
                gfx.stroke();
                // 内环（反向旋转视觉）
                gfx.strokeColor = this.ctx.hex(a, 220);
                gfx.lineWidth = r * 0.2;
                gfx.circle(0, 0, r * 0.45);
                gfx.stroke();
                // 十字标记
                gfx.strokeColor = this.ctx.hex('#FFFFFF', 180);
                gfx.lineWidth = 1.5;
                const cross = r * 0.6;
                gfx.moveTo(-cross, 0);
                gfx.lineTo(cross, 0);
                gfx.moveTo(0, -cross);
                gfx.lineTo(0, cross);
                gfx.stroke();
                break;
            }

            // ── 镰刃：弧形回旋镖 ──
            case 'scythe': {
                gfx.fillColor = this.ctx.hex(c, 35);
                gfx.circle(0, 0, r * 2.5);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 150);
                gfx.moveTo(-r * 0.8, -r * 0.3);
                gfx.quadraticCurveTo(r * 0.45, -r * 1.15, r * 1.05, 0);
                gfx.quadraticCurveTo(r * 0.45, r * 1.15, -r * 0.8, r * 0.3);
                gfx.close();
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 230);
                gfx.circle(r * 0.4, 0, r * 0.35);
                gfx.fill();
                break;
            }

            // ── 弹射箭/弩矢：细长箭头 ──
            case 'ricochet': {
                gfx.fillColor = this.ctx.hex(c, 30);
                gfx.circle(0, 0, r * 2.2);
                gfx.fill();
                // 箭身
                const shaftLen = r * 2.0;
                gfx.fillColor = this.ctx.hex(c, 150);
                gfx.roundRect(-shaftLen, -r * 0.25, shaftLen + r * 0.3, r * 0.5, r * 0.2);
                gfx.fill();
                // 箭头三角形
                gfx.fillColor = this.ctx.hex(a, 220);
                gfx.moveTo(r * 0.5, 0);
                gfx.lineTo(-r * 0.2, -r * 0.5);
                gfx.lineTo(-r * 0.2, r * 0.5);
                gfx.close();
                gfx.fill();
                // 箭尾
                gfx.fillColor = this.ctx.hex(c, 100);
                gfx.moveTo(-shaftLen, 0);
                gfx.lineTo(-shaftLen - r * 0.5, -r * 0.6);
                gfx.lineTo(-shaftLen - r * 0.5, r * 0.6);
                gfx.close();
                gfx.fill();
                break;
            }

            // ── 链式闪电：锯齿状闪电 ──
            case 'chain': {
                gfx.fillColor = this.ctx.hex(c, 30);
                gfx.circle(0, 0, r * 2.5);
                gfx.fill();
                gfx.strokeColor = this.ctx.hex(c, 220);
                gfx.lineWidth = r * 0.4;
                // 锯齿路径
                const segs = 5;
                const stepX = r * 3.0 / segs;
                let zy = 0;
                gfx.moveTo(-r * 1.5, 0);
                for (let i = 0; i < segs; i++) {
                    const nx = -r * 1.5 + (i + 1) * stepX;
                    const ny = (i % 2 === 0 ? -r * 0.8 : r * 0.8) + (Math.random() - 0.5) * r * 0.2;
                    gfx.lineTo(nx, ny);
                    zy = ny;
                }
                gfx.stroke();
                // 末端辉光
                gfx.fillColor = this.ctx.hex(a, 220);
                gfx.circle(r * 1.5, zy, r * 0.5);
                gfx.fill();
                break;
            }

            // ── 喷雾：微小粒子云 (基础版本用简单光晕) ──
            case 'spray': {
                gfx.fillColor = this.ctx.hex(c, 20);
                gfx.circle(0, 0, r * 4);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 60);
                gfx.circle(0, 0, r * 2);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 180);
                gfx.circle(0, 0, r * 0.7);
                gfx.fill();
                break;
            }

            // ── 默认 ──
            default: {
                gfx.fillColor = this.ctx.hex(c, 35);
                gfx.circle(0, 0, r * 2.5);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(c, 145);
                gfx.roundRect(-r * 1.5, -r * 0.4, r * 2.2, r * 0.8, r * 0.3);
                gfx.fill();
                gfx.fillColor = this.ctx.hex(a, 245);
                gfx.circle(r * 0.2, 0, r * 0.45);
                gfx.fill();
                break;
            }
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
        bullet.trail.length = 0;
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

            // 弹道拖尾：每帧记录位置，保持最多 10 个点
            bullet.trail.push({ x: bullet.x, y: bullet.y });
            if (bullet.trail.length > 10) bullet.trail.shift();

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
                            // 虚空撕裂者: 穿透叠加虚空撕裂层数
                            if (bullet.mechanic === 'pierce_bonus' || bullet.mechanic === 'void_tearer') {
                                if (!bullet.mechData) bullet.mechData = {};
                                bullet.mechData.pierceCount = (bullet.mechData.pierceCount || 0) + 1;
                            }
                            const pierceBonus = (bullet.mechanic === 'pierce_bonus' || bullet.mechanic === 'void_tearer' && bullet.mechData?.pierceCount)
                                ? 1 + (bullet.mechData.pierceCount - 1) * (bullet.mechanic === 'void_tearer' ? 0.18 : 0.15) : 1.0;
                            const retainedDamage = bullet.damage * Math.pow(pierceRetention, pierceDepth) * pierceBonus;
                            const critMastery = bullet.mechanic === 'crit_master';
                            const roll = this.ctx.enemyMgr.rollOutgoingDamage(enemy, retainedDamage, critMastery ? 0.15 : 0, critMastery ? 0.30 : 0);
                            const beforeCount = this.ctx.enemyMgr.enemies.length;
                            this.ctx.enemyMgr.damageEnemy(enemy, roll.amount, roll.color, roll.tag);
                            // 分裂怪/自爆母体: 击杀后可能产生新子体，检查新敌人是否在子弹路径上
                            if (!bulletRemoved && this.ctx.enemyMgr.enemies.length > beforeCount) {
                                for (let i = beforeCount; i < this.ctx.enemyMgr.enemies.length; i++) {
                                    const child = this.ctx.enemyMgr.enemies[i];
                                    if (!this.ctx.enemyMgr.enemySet.has(child)) continue;
                                    if (bullet.hitIds.has(child.id)) continue;
                                    const cpos = this.ctx.enemyMgr.getEnemyPosition(child);
                                    const cdistSq = this.distanceSq(bullet.x, bullet.y, cpos.x, cpos.y);
                                    const cHitRadius = bullet.radius + child.radius;
                                    if (cdistSq <= cHitRadius * cHitRadius) {
                                        bullet.hitIds.add(child.id);
                                        const childRoll = this.ctx.enemyMgr.rollOutgoingDamage(child, bullet.damage * 0.7, 0, 0);
                                        this.ctx.enemyMgr.damageEnemy(child, childRoll.amount, childRoll.color, '分裂 ');
                                    }
                                }
                            }
                            // 机制词条: drone_charge (轨道无人机) — 击杀充能
                            // webmaster (织网支配者): 击杀回复生命值
                            if (bullet.mechanic === 'drone_charge' || bullet.mechanic === 'webmaster_lifesteal') {
                                const isDead = !this.ctx.enemyMgr.enemySet.has(enemy);
                                if (isDead) {
                                    if (!this.ctx.cs.droneCharge) this.ctx.cs.droneCharge = 0;
                                    this.ctx.cs.droneCharge += 20;
                                    if (this.ctx.cs.droneCharge >= 100) {
                                        this.ctx.cs.droneCharge = 0;
                                        this.spawnDroneExplosion(bullet.x, bullet.y, bullet.damage);
                                    }
                                    // 织网支配者: 击杀回血
                                    if (bullet.mechanic === 'webmaster_lifesteal' && this.ctx.healPlayer) {
                                        this.ctx.healPlayer(bullet.damage * 0.15);
                                        this.ctx.spawnFloatingText?.('吸血 ' + Math.ceil(bullet.damage * 0.15), bullet.x, bullet.y - 20, '#FACC15', 18);
                                    }
                                }
                            }
                            // 冰狱审判: 击杀触发爆炸 (icefire_judge)
                            if (bullet.mechanic === 'icefire_judge') {
                                const isDead = !this.ctx.enemyMgr.enemySet.has(enemy);
                                if (isDead) {
                                    // 对周围敌人造成爆炸伤害
                                    for (const other of this.ctx.enemyMgr.enemies) {
                                        if (!this.ctx.enemyMgr.enemySet.has(other)) continue;
                                        const oPos = this.ctx.enemyMgr.getEnemyPosition(other);
                                        const dx = oPos.x - bullet.x;
                                        const dy = oPos.y - bullet.y;
                                        if (dx * dx + dy * dy <= 90 * 90) {
                                            this.ctx.enemyMgr.damageEnemy(other, bullet.damage * 0.4, '#FB923C', '冰火爆炸 ');
                                        }
                                    }
                                    this.ctx.drawAreaPulse(bullet.x, bullet.y, 90, '#FB923C');
                                }
                            }
                            // 机制词条调度 (Phase 2)
                            this.applyMechanicOnHit(bullet, enemy, roll);
                            // 限制火花频率：每3次命中才画1次，减少渲染节点 churn
                            if (Math.random() < 0.33) {
                                this.spawnBulletHitSpark(bullet.x, bullet.y, bullet.style, bullet.color, bullet.accent);
                            }
                            // 重武器命中屏幕震动+音效
                            if (bullet.style === 'meteor' || bullet.style === 'gravity' || bullet.style === 'pulse'
                                || bullet.style === 'prism' || bullet.style === 'quantum' || bullet.style === 'icefire'
                                || bullet.style === 'void_tear' || bullet.style === 'scatter' || bullet.style === 'shotgun') {
                                this.ctx.cs.shakeIntensity = Math.max(this.ctx.cs.shakeIntensity, 1.5 + Math.random());
                            } else if (bullet.style === 'rail' || bullet.style === 'ion' || bullet.style === 'void_needle') {
                                this.ctx.cs.shakeIntensity = Math.max(this.ctx.cs.shakeIntensity, 2 + Math.random());
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
        // 大号武器加长闪光
        const isRailLike = style === 'rail' || style === 'ion' || style === 'void_needle' || style === 'frost';
        const isScatterLike = style === 'scatter' || style === 'shotgun';
        const isHeavyLike = style === 'meteor' || style === 'gravity';
        const isPulseLike = style === 'pulse' || style === 'prism' || style === 'quantum' || style === 'icefire' || style === 'web' || style === 'drone' || style === 'void_tear';
        const length = style === 'spray' ? 82 : isRailLike ? 72 : isScatterLike ? 52 + shotCount * 5 : isHeavyLike ? 54 : isPulseLike ? 46 : style === 'smg' ? 38 : 36;
        const width = style === 'spray' ? 42 : isScatterLike ? 24 + shotCount * 2 : isRailLike ? 14 : isHeavyLike ? 18 : isPulseLike ? 20 : 14;
        // 外圈辉光
        gfx.clear();
        gfx.fillColor = this.ctx.hex('#FFFFFF', 30);
        gfx.moveTo(-8, 0);
        gfx.lineTo(length * 1.5, width * 0.7);
        gfx.lineTo(length * 0.9, 0);
        gfx.lineTo(length * 1.5, -width * 0.7);
        gfx.close();
        gfx.fill();
        // 主体闪光
        gfx.fillColor = this.ctx.hex(color, 140);
        gfx.moveTo(-6, 0);
        gfx.lineTo(length, width * 0.52);
        gfx.lineTo(length * 0.64, 0);
        gfx.lineTo(length, -width * 0.52);
        gfx.close();
        gfx.fill();
        // 核心亮点
        gfx.fillColor = this.ctx.hex('#FFFFFF', 255);
        gfx.circle(0, 0, Math.max(7, width * 0.38));
        gfx.fill();
        gfx.fillColor = this.ctx.hex(this.getWeaponAccentColor(style, color), 230);
        gfx.circle(0, 0, Math.max(4, width * 0.25));
        gfx.fill();
        // 喷雾额外扩散雾效果
        if (style === 'spray') {
            gfx.fillColor = this.ctx.hex('#84CC16', 18);
            gfx.circle(length * 0.3, 0, width * 1.2);
            gfx.fill();
            gfx.fillColor = this.ctx.hex('#A3E635', 10);
            gfx.circle(length * 0.55, 0, width * 0.9);
            gfx.fill();
        }
        if (style === 'prism' || style === 'quantum' || style === 'drone' || style === 'web' || style === 'icefire' || style === 'gravity' || style === 'void_tear') {
            gfx.strokeColor = this.ctx.hex(this.getWeaponAccentColor(style, color), 130);
            gfx.lineWidth = 2;
            gfx.circle(0, 0, width * 0.92);
            gfx.stroke();
        }
        if (style === 'smg') {
            gfx.fillColor = this.ctx.hex('#FFFFFF', 150);
            gfx.roundRect(length * 0.3, -width * 0.12, length * 0.58, width * 0.24, width * 0.12);
            gfx.fill();
        }
        this.flashTimer[idx] = ProjectileManager.FLASH_LIFE * (style === 'spray' ? 3.0 : 1.8);
        this.flashActive++;
    }

    private transformSprayPoint(cone: SprayConeVfx, x: number, y: number): { x: number; y: number } {
        const cos = Math.cos(cone.angle);
        const sin = Math.sin(cone.angle);
        const cameraX = this.ctx.worldNode?.position?.x || 0;
        const cameraY = this.ctx.worldNode?.position?.y || 0;
        return {
            x: cameraX + cone.x + x * cos - y * sin,
            y: cameraY + cone.y + x * sin + y * cos,
        };
    }

    private worldToSprayScreenPoint(x: number, y: number): { x: number; y: number } {
        const cameraX = this.ctx.worldNode?.position?.x || 0;
        const cameraY = this.ctx.worldNode?.position?.y || 0;
        return { x: cameraX + x, y: cameraY + y };
    }

    private sprayRand(seed: number, salt: number): number {
        const n = Math.sin((seed + 1) * 12.9898 + (salt + 3) * 78.233) * 43758.5453123;
        return n - Math.floor(n);
    }

    private ensureSprayMistPool(): boolean {
        this.ensureSprayOverlayGfx();
        if (!this.sprayLayer) return false;
        if (this.sprayMistNodes.length > 0) return true;
        for (let i = 0; i < ProjectileManager.SPRAY_MIST_POOL_SIZE; i++) {
            const node = new Node(`PoisonMistParticle${i}`);
            node.layer = Layers.Enum.UI_2D;
            node.active = false;
            node.addComponent(UITransform).setContentSize(96, 96);
            const sprite = node.addComponent(Sprite);
            sprite.spriteFrame = this.sprayMistFrame;
            sprite.color = this.ctx.hex('#D9F99D', 255);
            const opacity = node.addComponent(UIOpacity);
            opacity.opacity = 0;
            this.sprayLayer.addChild(node);
            this.sprayMistNodes.push(node);
            this.sprayMistSprites.push(sprite);
            this.sprayMistOpacity.push(opacity);
            this.sprayMistState.push(null);
        }
        return true;
    }

    private acquireSprayMist(): number {
        for (let i = 0; i < ProjectileManager.SPRAY_MIST_POOL_SIZE; i++) {
            if (!this.sprayMistState[i]) return i;
        }
        let oldest = 0;
        let lowestTimer = Number.POSITIVE_INFINITY;
        for (let i = 0; i < ProjectileManager.SPRAY_MIST_POOL_SIZE; i++) {
            const state = this.sprayMistState[i];
            if (state && state.timer < lowestTimer) {
                lowestTimer = state.timer;
                oldest = i;
            }
        }
        return oldest;
    }

    private spawnSprayMistParticles(cone: SprayConeVfx): void {
        if (!this.ensureSprayMistPool()) return;
        const length = Math.max(200, Math.min(cone.range, 480));
        const halfWidth = Math.max(96, Math.min(220, length * 0.50));
        const cos = Math.cos(cone.angle);
        const sin = Math.sin(cone.angle);
        const colors = ['#D9F99D', '#BBF7D0', '#86EFAC', '#A3E635', '#22C55E'];
        const count = 20;
        for (let i = 0; i < count; i++) {
            const idx = this.acquireSprayMist();
            const r0 = this.sprayRand(cone.seed, i * 5 + 0);
            const r1 = this.sprayRand(cone.seed, i * 5 + 1);
            const r2 = this.sprayRand(cone.seed, i * 5 + 2);
            const r3 = this.sprayRand(cone.seed, i * 5 + 3);
            const t = 0.10 + r0 * 0.82;
            const localX = 22 + length * t;
            const lane = (r1 - 0.5) * 2;
            const localY = lane * halfWidth * (0.10 + t * 0.62) + Math.sin((i + cone.seed) * 1.73) * 8;
            const wx = cone.x + localX * cos - localY * sin;
            const wy = cone.y + localX * sin + localY * cos;
            const forwardSpeed = 28 + r2 * 95;
            const lateralSpeed = lane * (24 + r3 * 70);
            const life = ProjectileManager.SPRAY_MIST_LIFE * (0.70 + r1 * 0.42);
            const state: SprayMistVfx = {
                x: wx,
                y: wy,
                vx: cos * forwardSpeed - sin * lateralSpeed,
                vy: sin * forwardSpeed + cos * lateralSpeed,
                angle: cone.angle * 180 / Math.PI + (r0 - 0.5) * 60,
                angularVelocity: (r1 - 0.5) * 150,
                baseScale: 0.34 + r2 * 0.62 + t * 0.34,
                timer: life,
                maxTimer: life,
                color: colors[(i + cone.seed) % colors.length],
                alpha: 70 + r3 * 78,
            };
            const node = this.sprayMistNodes[idx];
            const sprite = this.sprayMistSprites[idx];
            const opacity = this.sprayMistOpacity[idx];
            this.sprayMistState[idx] = state;
            node.active = true;
            sprite.spriteFrame = this.sprayMistFrame;
            sprite.color = this.ctx.hex(state.color, 255);
            opacity.opacity = 0;
            const pos = this.worldToSprayScreenPoint(state.x, state.y);
            node.setPosition(pos.x, pos.y, 4);
            node.angle = state.angle;
            node.setScale(state.baseScale * 1.25, state.baseScale * 0.72, 1);
        }
    }

    private updateSprayMistParticles(dt: number): void {
        if (this.sprayMistState.length === 0) return;
        const damping = Math.max(0.82, 1 - dt * 1.65);
        for (let i = 0; i < this.sprayMistState.length; i++) {
            const state = this.sprayMistState[i];
            if (!state) continue;
            state.timer -= dt;
            if (state.timer <= 0) {
                this.sprayMistState[i] = null;
                this.sprayMistNodes[i].active = false;
                this.sprayMistOpacity[i].opacity = 0;
                continue;
            }
            state.x += state.vx * dt;
            state.y += state.vy * dt;
            state.vx *= damping;
            state.vy *= damping;
            const progress = 1 - state.timer / state.maxTimer;
            const fadeIn = Math.min(1, progress / 0.16);
            const fadeOut = Math.pow(Math.max(0, state.timer / state.maxTimer), 1.35);
            const opacity = Math.round(state.alpha * fadeIn * fadeOut);
            const scale = state.baseScale * (0.72 + progress * 1.25);
            const pos = this.worldToSprayScreenPoint(state.x, state.y);
            const node = this.sprayMistNodes[i];
            node.setPosition(pos.x, pos.y, 4);
            node.angle = state.angle + progress * state.angularVelocity;
            node.setScale(scale * 1.32, scale * 0.76, 1);
            this.sprayMistOpacity[i].opacity = opacity;
        }
    }

    private ensureSprayOverlayGfx(): Graphics | null {
        if (this.sprayOverlayGfx) return this.sprayOverlayGfx;
        // Runtime finding: pooled child Graphics under World and Graphics attached directly
        // to World can be active but hidden behind world children / mini-game sorting. UI panels
        // render reliably, so poison spray is drawn on a Canvas-level overlay in screen space.
        const parent = this.ctx.worldNode?.parent || this.ctx.worldNode;
        if (!parent) return null;
        this.sprayLayer = new Node('PoisonSprayScreenOverlay');
        this.sprayLayer.layer = Layers.Enum.UI_2D;
        parent.addChild(this.sprayLayer);
        this.sprayLayer.setPosition(0, 0, 80);
        this.sprayLayer.addComponent(UITransform).setContentSize(720, 1280);
        this.sprayOverlayGfx = this.sprayLayer.addComponent(Graphics);
        this.sprayOverlayShared = false;
        return this.sprayOverlayGfx;
    }

    private renderSprayOverlay(): void {
        const gfx = this.ensureSprayOverlayGfx();
        if (!gfx) return;
        gfx.clear();
        for (const cone of this.sprayCones) {
            this.drawSprayConeOnOverlay(gfx, cone);
        }
    }

    private drawSprayConeOnOverlay(gfx: Graphics, cone: SprayConeVfx): void {
        const length = Math.max(200, Math.min(cone.range, 440));
        const halfWidth = Math.max(88, Math.min(190, length * 0.46));
        const lifeRatio = Math.max(0, Math.min(1, cone.timer / ProjectileManager.SPRAY_LIFE));
        const alphaMul = Math.pow(lifeRatio, 0.82);
        const p = (x: number, y: number) => this.transformSprayPoint(cone, x, y);
        const moveTo = (x: number, y: number) => { const q = p(x, y); gfx.moveTo(q.x, q.y); };
        const lineTo = (x: number, y: number) => { const q = p(x, y); gfx.lineTo(q.x, q.y); };
        const circle = (x: number, y: number, r: number) => { const q = p(x, y); gfx.circle(q.x, q.y, r); };
        const strokePath = (lane: number, color: string, alpha: number, width: number, wiggle: number) => {
            gfx.strokeColor = this.ctx.hex(color, Math.round(alpha * alphaMul));
            gfx.lineWidth = width;
            for (let s = 0; s <= 9; s++) {
                const t = s / 9;
                const x = 18 + length * (0.05 + t * 0.82);
                const spread = halfWidth * (0.10 + t * 0.50);
                const y = lane * spread + Math.sin((t * 5.4 + cone.seed * 0.19 + lane) * Math.PI) * wiggle * (0.35 + t);
                if (s === 0) moveTo(x, y); else lineTo(x, y);
            }
            gfx.stroke();
        };

        // Cocos 官方推荐攻击/自然特效优先用“粒子纹理 + 发射器 + 生命周期”，
        // 这里用单 Graphics 只画低透明导向气流，真正体积感交给 pooled mist sprites。
        // 禁止再画整块高亮实心扇形，否则会像荧光油漆刷。
        gfx.fillColor = this.ctx.hex('#14532D', Math.round(26 * alphaMul));
        moveTo(12, -12);
        lineTo(length * 0.34, -halfWidth * 0.42);
        lineTo(length * 0.88, -halfWidth * 0.26);
        lineTo(length * 0.96, 0);
        lineTo(length * 0.88, halfWidth * 0.26);
        lineTo(length * 0.34, halfWidth * 0.42);
        lineTo(12, 12);
        gfx.close();
        gfx.fill();

        // Thin turbulent streams — readable direction, but not a solid beam.
        strokePath(0.00, '#D9F99D', 128, 7, 12);
        strokePath(-0.48, '#86EFAC', 92, 5, 15);
        strokePath(0.48, '#A3E635', 92, 5, 15);
        strokePath(-0.20, '#22C55E', 62, 3, 18);
        strokePath(0.22, '#22C55E', 62, 3, 18);

        // Small muzzle cloud, replacing the previous huge neon origin blob.
        gfx.fillColor = this.ctx.hex('#D9F99D', Math.round(76 * alphaMul));
        circle(20, 0, 16);
        gfx.fill();
        gfx.fillColor = this.ctx.hex('#22C55E', Math.round(46 * alphaMul));
        circle(42, -10, 22);
        gfx.fill();
        circle(48, 12, 18);
        gfx.fill();

        // A few hard droplets on top of the soft sprite mist, so the weapon still reads as spray.
        for (let i = 0; i < 9; i++) {
            const r0 = this.sprayRand(cone.seed, 100 + i * 3);
            const r1 = this.sprayRand(cone.seed, 101 + i * 3);
            const t = 0.18 + r0 * 0.68;
            const x = length * t;
            const y = (r1 - 0.5) * halfWidth * (0.20 + t * 0.58);
            const r = 3.2 + this.sprayRand(cone.seed, 102 + i * 3) * 4.8;
            gfx.fillColor = this.ctx.hex(i % 3 === 0 ? '#F7FEE7' : '#BEF264', Math.round((i % 3 === 0 ? 82 : 64) * alphaMul));
            circle(x, y, r);
            gfx.fill();
        }
    }

    spawnSprayCone(angle: number, range: number, color: string): void {
        // 粒子化毒雾喷射：瘟疫喷射器不发子弹，所以这里负责主视觉反馈。
        // 设计原则：Canvas-level overlay 保证可见；soft sprite mist 负责体积，Graphics 只画细气流。
        // Do not return just because the legacy child-node pool is exhausted/invisible.
        const cone: SprayConeVfx = {
            x: this.ctx.cs.playerX,
            y: this.ctx.cs.playerY,
            angle,
            range,
            color,
            timer: ProjectileManager.SPRAY_LIFE,
            seed: (Math.floor(this.ctx.cs.combatTime * 60) + this.sprayCones.length) % 97,
        };
        this.sprayCones.push(cone);
        while (this.sprayCones.length > ProjectileManager.SPRAY_POOL_SIZE) this.sprayCones.shift();

        // Keep the old PoisonSpray pool active as debug/compat state, but the visible render path
        // is the worldNode-level sprayOverlayGfx above (child Graphics were proven invisible in runtime).
        const idx = this.acquireSpray();
        if (idx >= 0) {
            const node = this.sprayNodes[idx];
            const gfx = this.sprayGfx[idx];
            node.setPosition(cone.x, cone.y, 30);
            node.angle = angle * 180 / Math.PI;
            node.active = true;
            gfx.clear();
            this.sprayTimer[idx] = ProjectileManager.SPRAY_LIFE;
        }

        this.spawnSprayMistParticles(cone);
        this.renderSprayOverlay();
    }

    spawnBulletHitSpark(x: number, y: number, style: WeaponAttackStyle, color: string, accent: string): void {
        const idx = this.acquireSpark();
        if (idx < 0) return;
        const node = this.sparkNodes[idx];
        const gfx = this.sparkGfx[idx];
        node.setPosition(x, y, 13);
        node.active = true;
        // 大型武器火花更大更亮
        const isBig = style === 'meteor' || style === 'gravity' || style === 'rail' || style === 'ion' || style === 'void_needle'
            || style === 'scatter' || style === 'shotgun' || style === 'pulse' || style === 'prism' || style === 'quantum' || style === 'icefire' || style === 'void_tear';
        const radius = style === 'meteor' || style === 'gravity' ? 32
            : style === 'pulse' || style === 'prism' || style === 'quantum' || style === 'icefire' || style === 'void_tear' ? 28
            : style === 'rail' || style === 'ion' || style === 'void_needle' ? 24
            : style === 'scatter' || style === 'shotgun' ? 22
            : style === 'web' || style === 'drone' ? 20
            : 16;
        // 外圈辉光
        gfx.fillColor = this.ctx.hex(accent, 40);
        gfx.circle(0, 0, radius * 1.3);
        gfx.fill();
        // 主体光晕
        gfx.fillColor = this.ctx.hex(color, 80);
        gfx.circle(0, 0, radius);
        gfx.fill();
        // 核心亮环
        gfx.strokeColor = this.ctx.hex(accent, 255);
        gfx.lineWidth = isBig ? 5 : 3;
        gfx.circle(0, 0, radius * 0.68);
        gfx.stroke();
        // 十字星（重型武器加十字光）
        if (isBig) {
            gfx.strokeColor = this.ctx.hex('#FFFFFF', 200);
            gfx.lineWidth = 2.5;
            gfx.moveTo(-radius * 1.1, 0);
            gfx.lineTo(radius * 1.1, 0);
            gfx.moveTo(0, -radius * 0.7);
            gfx.lineTo(0, radius * 0.7);
            gfx.stroke();
        } else {
            gfx.moveTo(-radius * 0.7, 0);
            gfx.lineTo(radius * 0.7, 0);
            gfx.moveTo(0, -radius * 0.45);
            gfx.lineTo(0, radius * 0.45);
            gfx.stroke();
        }
        this.sparkTimer[idx] = ProjectileManager.SPARK_LIFE * (isBig ? 2.2 : 1.5);
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

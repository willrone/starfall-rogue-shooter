/**
 * Enemy module type definitions — SpriteStripAnimation, Enemy.
 */
import type { SpriteFrame, Node, Graphics, Sprite } from 'cc';
import type { DamageType, EnemySpec } from '../core/types';
import type { MovementType } from './enemyMovement';

export interface SpriteStripAnimation {
    frames: SpriteFrame[];
    fps: number;
    cellSize: number;
}

export interface Enemy {
    id: number;
    spec: EnemySpec;
    node: Node;
    gfx: Graphics;
    sprite: Sprite | null;
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    radius: number;
    visualRadius: number;
    elite: boolean;
    boss: boolean;
    damageType: DamageType;
    skillTimer: number;
    dashTimer: number;
    dashVx: number;
    dashVy: number;
    armorTimer: number;
    auraBuffTimer: number;   // 灵能体: 友军标记逻辑的低频 tick 计时器
    auraPulseTimer: number;  // 灵能体: 光环视觉的独立低频 tick 计时器
    // ── 移动策略 (Phase 2) ─────────────────────────────────────────
    movementType: MovementType;       // 'follow' | 'periodic-follow'
    periodicFollowTimer: number;      // accumulated time within current follow/pause cycle
    // ── 机制词条状态字段 (Phase 2) ─────────────────────────────────
    slowTimer: number;      // 霜束发射器: 减速剩余时间 (秒)
    slowFactor: number;     // 霜束发射器: 减速系数, 0.4 = 60% 减速
    poisonStacks: number;   // 瘟疫喷射器: 毒层数 (上限 15)
    poisonTimer: number;    // 瘟疫喷射器: 毒 tick 计时器
    poisonDuration: number; // 瘟疫喷射器: 未继续喷到时的层数保留时间
    poisonDps: number;      // 瘟疫喷射器: 每层每秒固定伤害（由武器伤害计算）
    poisonBurstDmg: number; // 瘟疫喷射器: 毒爆伤害（由武器伤害计算，满层触发）
    poisonBurstRange: number; // 瘟疫喷射器: 毒爆范围（受爆炸范围加成）
    knockbackVx: number;    // 重力锤: 击退速度 X
    knockbackVy: number;    // 重力锤: 击退速度 Y
    // ── Boss 技能状态字段 ───────────────────────────────────────────
    burrowedTimer: number; // 噬能蠕虫: 钻地消失计时 (0 = 地上)
    stunTimer: number;     // 噬能蠕虫: 冲锋后硬直计时
    rotationTimer: number;  // 狱炎领主: 扇形旋转计时
    shieldHp: number;      // 虚空织网者: 护盾值
    shieldMaxHp: number;    // 虚空织网者: 护盾上限
    spiderCount: number;   // 虚空织网者: 当前存活小蜘蛛数
    explodeTimer: number;  // 自爆母体: 爆炸倒计时 (0=未激活)
    _minibossExploded?: boolean; // 自爆母体: 已爆炸标记，防止重复触发
    // ── 视觉/动画 ─────────────────────────────────────────────────
    animSeed: number;
    hitFlash: number;
    visualStateKey: number;
    animation: SpriteStripAnimation | null;
    animationFrameIndex: number;
    _lastScaleX?: number;
    _lastScaleY?: number;
    _lastAngle?: number;
    _wasHitColor?: boolean;
    visualSkip?: number;
    lastBarDrawTime?: number;
    wobbleSin: number;
    wobbleCos: number;
    _botX?: number;
    _botY?: number;
}

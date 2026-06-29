/**
 * Enemy module type definitions — SpriteStripAnimation, Enemy.
 */
import type { SpriteFrame, Node, Graphics, Sprite } from 'cc';
import type { DamageType, EnemySpec } from '../core/types';

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
    // ── 机制词条状态字段 (Phase 2) ─────────────────────────────────
    slowTimer: number;      // 霜束发射器: 减速剩余时间 (秒)
    slowFactor: number;     // 霜束发射器: 减速系数, 0.4 = 60% 减速
    poisonStacks: number;   // 瘟疫喷射器: 毒层数 (上限 5)
    poisonTimer: number;    // 瘟疫喷射器: 毒 tick 计时器
    knockbackVx: number;    // 重力锤: 击退速度 X
    knockbackVy: number;    // 重力锤: 击退速度 Y
    // ── 视觉/动画 ─────────────────────────────────────────────────
    animSeed: number;
    hitFlash: number;
    visualStateKey: string;
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

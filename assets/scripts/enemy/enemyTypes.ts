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
}

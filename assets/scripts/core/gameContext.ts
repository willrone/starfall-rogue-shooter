/**
 * GameContext — 统一模块通信接口
 * 所有模块通过 emit/on 事件通信，不再直接调用对方方法。
 * 随着模块增多，只需新增事件类型，不改已有代码。
 */
import type { GamePhase, BattleEndReason, DamageType, ChestPickupType } from './types';
import type { CombatState } from '../state/combatState';

export interface GameEvents {
    /** 敌人死亡，附带掉落坐标和类型 */
    'enemy-killed': { x: number; y: number; drops: boolean; isBoss: boolean; isSplitter: boolean; damageType: DamageType };
    /** Boss 被击败 */
    'boss-defeated': {};
    /** 拾取物被收集 */
    'pickup-collected': { type: string; amount: number };
    /** 等级提升 */
    'level-up': { level: number };
    /** 宝箱开启 */
    'chest-opened': { type: ChestPickupType; x: number; y: number };
    /** 波次开始 */
    'wave-start': { wave: number; isBoss: boolean };
    /** 波次清算 */
    'wave-clear': { wave: number; reward: number };
    /** 战斗结束 */
    'battle-end': { reason: BattleEndReason };
    /** 玩家受伤 */
    'player-hit': { damage: number; type: DamageType };
    /** 玩家治疗 */
    'player-heal': { amount: number };
    /** 装备变化 */
    'equipment-changed': {};
    /** 商店操作 */
    'shop-changed': {};
}

export type EventHandler<T = any> = (data: T) => void;

export class GameEventBus {
    private handlers = new Map<string, Set<EventHandler>>();

    on<K extends keyof GameEvents>(event: K, handler: EventHandler<GameEvents[K]>): void {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set());
        this.handlers.get(event)!.add(handler);
    }

    off<K extends keyof GameEvents>(event: K, handler: EventHandler<GameEvents[K]>): void {
        this.handlers.get(event)?.delete(handler);
    }

    emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
        this.handlers.get(event)?.forEach((h) => {
            try { h(data); } catch (e) { console.error(`[EventBus] Error in ${event}:`, e); }
        });
    }

    /** 批量注册，方便模块初始化 */
    onAll(handlers: Record<string, EventHandler | undefined>): void {
        const keys = Object.keys(handlers);
        for (let i = 0; i < keys.length; i++) {
            const event = keys[i];
            const handler = handlers[event];
            if (handler) this.on(event as keyof GameEvents, handler as EventHandler);
        }
    }

    clear(): void {
        this.handlers.clear();
    }
}

/** 创建全局唯一的游戏上下文 */
export function createGameContext(cs: CombatState): GameContext {
    const bus = new GameEventBus();
    return { cs, bus };
}

export interface GameContext {
    cs: CombatState;
    bus: GameEventBus;
}

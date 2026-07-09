/**
 * EventManager — 全局事件管理器
 * 
 * 与 gameContext.ts 的 GameEventBus 互补：
 * - GameEventBus：强类型游戏事件（enemy-killed, boss-defeated 等）
 * - EventManager：通用任意事件（UI 事件、系统事件等），支持 once、target 自动清理
 * 
 * 用法：
 *   eventMgr.on('OpenShop', this.onOpenShop, this);
 *   eventMgr.emit('OpenShop', { tab: 'weapons' });
 *   eventMgr.off('OpenShop', this.onOpenShop, this);
 */

interface EventEntry {
    target: any;
    callback: Function;
    once: boolean;
}

export class EventManager {
    private _entries = new Map<string, EventEntry[]>();

    /**
     * 注册事件监听
     */
    on(eventName: string, callback: Function, target: any): void {
        this._add(eventName, callback, target, false);
    }

    /**
     * 注册一次性事件监听
     */
    once(eventName: string, callback: Function, target: any): void {
        this._add(eventName, callback, target, true);
    }

    private _add(eventName: string, callback: Function, target: any, once: boolean): void {
        let list = this._entries.get(eventName);
        if (!list) {
            list = [];
            this._entries.set(eventName, list);
        }
        // 防止重复注册
        const existing = list.findIndex(e => e.target === target && e.callback === callback);
        if (existing === -1) {
            list.push({ target, callback, once });
        }
    }

    /**
     * 移除事件监听
     * 传全参数：移除 specific (eventName, callback, target)
     * 传 eventName + target：移除该 target 在该事件上的所有回调
     * 传 eventName only：移除该事件所有回调
     */
    off(eventName: string, callback?: Function, target?: any): void {
        const list = this._entries.get(eventName);
        if (!list) return;

        if (callback && target) {
            // 移除特定回调
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].callback === callback && list[i].target === target) {
                    list.splice(i, 1);
                }
            }
        } else if (target) {
            // 移除 target 的所有回调
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].target === target) {
                    list.splice(i, 1);
                }
            }
        } else {
            // 移除整个事件
            this._entries.delete(eventName);
        }
    }

    /**
     * 移除指定 target 上的所有事件监听（组件销毁时调用）
     */
    offTarget(target: any): void {
        this._entries.forEach((list, eventName) => {
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].target === target) {
                    list.splice(i, 1);
                }
            }
            if (list.length === 0) {
                this._entries.delete(eventName);
            }
        });
    }

    /**
     * 派发事件
     */
    emit(eventName: string, ...args: any[]): void {
        const list = this._entries.get(eventName);
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            const entry = list[i];
            try {
                entry.callback.apply(entry.target, args);
            } catch (e) {
                console.error(`[EventManager] Error in "${eventName}":`, e);
            }
            if (entry.once) {
                list.splice(i, 1);
            }
        }
        if (list.length === 0) {
            this._entries.delete(eventName);
        }
    }

    /**
     * 清空所有事件
     */
    clear(): void {
        this._entries.clear();
    }
}

/** 全局单例 */
export const eventMgr = new EventManager();

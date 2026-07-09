/**
 * AsyncHelper — 异步工具集
 * 提供游戏开发中常用的异步操作：等待、Tween、资源加载、分帧执行。
 * 
 * 来自 cocos-creator-async3，适配 Cocos Creator 3.8。
 */
import { Asset, Component, Tween, assetManager, tween } from 'cc';

export default class AsyncHelper {
    /**
     * 异步等待指定时间
     * ```typescript
     * await AsyncHelper.sleepAsync(1);  // 等 1 秒
     * ```
     */
    static sleepAsync(t: number, target?: Component): Promise<void> {
        return new Promise((resolve) => {
            if (!target) {
                target = this._getScheduler();
            }
            if (target) {
                target.scheduleOnce(() => resolve(), t);
            } else {
                // fallback
                setTimeout(() => resolve(), t * 1000);
            }
        });
    }

    /**
     * 异步 Tween 动画，完成后 resolve
     * ```typescript
     * await AsyncHelper.tweenAsync(node, tween(node).to(1, { x: 100 }));
     * ```
     */
    static tweenAsync<T extends object>(target: T, twn: Tween<T>): Promise<void> {
        return new Promise<any>((resolve) => {
            tween(target).then(twn).call(resolve).start();
        });
    }

    /**
     * 异步加载 Bundle
     */
    static loadBundleAsync(bundleName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err: Error | null, bundle: any) => {
                if (err) reject(err);
                else resolve(bundle);
            });
        });
    }

    /**
     * 异步加载单个资源
     */
    static loadAsync<T extends Asset>(
        bundle: any,
        path: string,
        type: typeof Asset,
        onProgress?: (cur: number, total: number) => void,
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            bundle.load(path, type, (cur: number, total: number) => {
                if (onProgress) onProgress(cur, total);
            }, (err: Error | null, asset: T) => {
                if (err) reject(err);
                else resolve(asset);
            });
        });
    }

    /**
     * 异步预加载
     */
    static preloadAsync(
        bundle: any,
        path: string,
        type: typeof Asset,
        onProgress?: (cur: number, total: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            bundle.preload(path, type, (cur: number, total: number) => {
                if (onProgress) onProgress(cur, total);
            }, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * 异步分帧执行 — 将耗时逻辑分散到多帧
     * ```typescript
     * await AsyncHelper.execPerFrameAsync(genItems(500), 5);
     * function* genItems(total: number) {
     *     for (let i = 0; i < total; i++) {
     *         yield addItem(i);
     *     }
     * }
     * ```
     * @param logicGen 生成器函数
     * @param t 每帧最大执行时间（毫秒）
     */
    static execPerFrameAsync(logicGen: Generator, t: number, target?: Component): Promise<void> {
        if (!target) {
            target = this._getScheduler();
        }
        return new Promise<void>((resolve) => {
            const exec = () => {
                const startTime = Date.now();
                for (let iter = logicGen.next(); !iter.done; iter = logicGen.next()) {
                    if (Date.now() - startTime > t) {
                        if (target) {
                            target.scheduleOnce(() => exec());
                        } else {
                            setTimeout(() => exec(), 0);
                        }
                        return;
                    }
                }
                resolve();
            };
            exec();
        });
    }

    private static _getScheduler(): Component | null {
        // 尝试获取场景中任意活跃的 Component 用于 scheduleOnce
        const scene = typeof cc !== 'undefined' ? (cc as any).director?.getScene() : null;
        if (scene) {
            const canvas: any = scene.getChildByName('Canvas');
            if (canvas) {
                const comps: Component[] = canvas.getComponents(Component);
                if (comps.length > 0) return comps[0];
                return canvas.addComponent(Component);
            }
        }
        return null;
    }
}

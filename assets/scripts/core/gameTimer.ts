/**
 * 周期计时器 - 替代散落的 `timer += dt; if (timer >= cd) { timer = 0; ... }` 模式
 *
 * 用法：
 *   const timer = new GameTimer(0.5);  // 500ms 周期
 *   // 每帧：
 *   timer.gameTick(deltaTime);
 *   if (timer.tryFinishPeriod()) { fire(); }
 */
export class GameTimer {
    private elapsed = 0;

    /**
     * @param periodSec 触发周期（秒）。<= 0 表示每帧触发
     */
    constructor(private periodSec: number) {}

    /** 每帧调用，累加时间 */
    public gameTick(deltaTime: number): void {
        this.elapsed += deltaTime;
    }

    /**
     * 检查是否经过了一个或多个周期。
     * 消耗一个周期并返回 true，否则 false。
     * 不会"多退少补"——如果积累了 2.5 个周期，一次只会消耗 1 个。
     */
    public tryFinishPeriod(): boolean {
        if (this.periodSec <= 0) return true;
        if (this.elapsed < this.periodSec) return false;
        this.elapsed -= this.periodSec;
        return true;
    }

    /** 重置为 0 */
    public reset(): void {
        this.elapsed = 0;
    }

    /** 强制设定已消耗时间 */
    public setElapsed(value: number): void {
        this.elapsed = value;
    }

    /** 当前周期进度 [0, 1) */
    public get progress(): number {
        if (this.periodSec <= 0) return 0;
        return Math.min(this.elapsed / this.periodSec, 0.999);
    }

    /** 当前积累秒数（只读） */
    public get current(): number {
        return this.elapsed;
    }
}

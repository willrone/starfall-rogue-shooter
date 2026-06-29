/**
 * AdManager — Ad reward system with TT SDK stub.
 *
 * In development this file simulates ad callbacks.
 * On release uncomment the `tt` SDK calls and fill in your ad unit IDs.
 */

import { sys } from 'cc';

export interface AdRewardResult {
    success: boolean;
    reason?: string;
}

export class AdManager {
    // ── Daily limits ────────────────────────────────────────────────
    private static readonly MAX_DAILY_REVIVE = 3;
    private static readonly DAILY_REVIVE_KEY = 'ad_daily_revive';

    // ── Reward placement IDs (fill in before release) ───────────────
    private static readonly AD_UNITS = {
        revive: '',         // 死亡复活
        extractDouble: '',  // 撤离加成×2
        preBuff: '',        // 战前BUFF
        shopRefresh: '',    // 商店免费刷新
        levelRefresh: '',   // 升级选项刷新
    };

    // ── Pre-battle buff ─────────────────────────────────────────────
    static readonly PRE_BUFFS = [
        { id: 'attackPower', name: '攻击强化', desc: '攻击力 +30%', color: '#F3722C', apply: (stats: any) => { stats.attackPower *= 1.3; } },
        { id: 'attackSpeed', name: '神经加速', desc: '攻速 +25%', color: '#4CC9F0', apply: (stats: any) => { stats.attackSpeed += 0.45; } },
        { id: 'critChance', name: '暴击直觉', desc: '暴击率 +10%', color: '#F9C74F', apply: (stats: any) => { stats.critChance += 0.1; } },
        { id: 'maxHp', name: '生命强化', desc: '最大HP +40%', color: '#43AA8B', apply: (stats: any) => { stats.maxHp *= 1.4; } },
        { id: 'dronePower', name: '无人机增幅', desc: '无人机能力 +50%', color: '#B5179E', apply: (stats: any) => { stats.dronePower += 4.2; } },
    ] as const;
    static currentPreBuff: typeof AdManager.PRE_BUFFS[number] | null = null;

    // ── Stub: simulate watching a rewarded video (0.5s delay) ───────
    static playRewardedAd(callback: (result: AdRewardResult) => void): void {
        // In production, replace with:
        // const videoAd = tt.createRewardedVideoAd({ adUnitId: AdManager.AD_UNITS.xxx });
        // videoAd.onLoad(() => videoAd.show());
        // videoAd.onClose((res) => {
        //     if (res.isEnded) callback({ success: true });
        //     else callback({ success: false, reason: 'not_fully_watched' });
        // });
        // videoAd.onError((err) => callback({ success: false, reason: err.errMsg }));

        // Stub: simulate 0.5s ad
        setTimeout(() => {
            // 80% chance of success for testing
            const success = Math.random() < 0.8;
            callback({ success, reason: success ? undefined : '模拟广告失败' });
        }, 500);
    }

    // ── Pre-battle buff ─────────────────────────────────────────────
    static drawRandomPreBuff(): void {
        const buffs = AdManager.PRE_BUFFS;
        AdManager.currentPreBuff = buffs[Math.floor(Math.random() * buffs.length)];
    }

    static consumePreBuff(): void {
        AdManager.currentPreBuff = null;
    }

    // ── Daily revive count ──────────────────────────────────────────
    static getDailyReviveCount(): number {
        const raw = sys.localStorage.getItem(AdManager.DAILY_REVIVE_KEY);
        return raw ? parseInt(raw, 10) : 0;
    }

    static useDailyRevive(): boolean {
        const count = AdManager.getDailyReviveCount();
        if (count >= AdManager.MAX_DAILY_REVIVE) return false;
        sys.localStorage.setItem(AdManager.DAILY_REVIVE_KEY, String(count + 1));
        return true;
    }

    static resetDailyRevive(): void {
        sys.localStorage.setItem(AdManager.DAILY_REVIVE_KEY, '0');
    }

    static canReviveToday(): boolean {
        return AdManager.getDailyReviveCount() < AdManager.MAX_DAILY_REVIVE;
    }

    static getReviveRemaining(): number {
        return Math.max(0, AdManager.MAX_DAILY_REVIVE - AdManager.getDailyReviveCount());
    }
}

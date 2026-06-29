import type { BattleEndReason, GamePhase } from '../core/types';
import { shouldOfferEquipmentLoot } from '../catalogs/equipmentLootChoices';

export interface SettlementFlow {
    phase: Extract<GamePhase, 'hangar' | 'loot'>;
    title: string;
}

export function canFinishBattle(phase: GamePhase): boolean {
    return phase === 'combat';
}

export function getReviveDeclinePhase(): Extract<GamePhase, 'combat'> {
    return 'combat';
}

export function getSettlementFlow(reason: BattleEndReason, bossKills: number): SettlementFlow {
    if (shouldOfferEquipmentLoot(bossKills)) {
        return { phase: 'loot', title: 'Boss 战利品' };
    }
    return {
        phase: 'hangar',
        title: reason === 'extract' ? '撤离成功' : '机体损毁',
    };
}

export function getSettlementTip(reason: BattleEndReason, phase: SettlementFlow['phase']): string {
    if (phase === 'loot') {
        return reason === 'extract'
            ? '撤离成功，先选择 1 项 Boss 战利品。'
            : '机体损毁，但已击败 Boss，选择 1 项回收战利品。';
    }
    return reason === 'extract'
        ? '主动撤离保留全部结算奖励。调整装备后可继续无尽出击。'
        : '死亡会折损部分时间奖励。升级装备后再试一次。';
}

export function shouldShowExtractDouble(reason: BattleEndReason): boolean {
    return reason === 'extract';
}

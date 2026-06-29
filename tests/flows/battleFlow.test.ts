import assert from 'node:assert/strict';
import {
    canFinishBattle,
    getReviveDeclinePhase,
    getSettlementFlow,
    getSettlementTip,
    shouldShowExtractDouble,
} from '../../assets/scripts/flow/battleFlow';

function testSettlementLootGate() {
    assert.deepEqual(getSettlementFlow('extract', 0), { phase: 'hangar', title: '撤离成功' });
    assert.deepEqual(getSettlementFlow('death', 0), { phase: 'hangar', title: '机体损毁' });
    assert.deepEqual(getSettlementFlow('extract', 1), { phase: 'loot', title: 'Boss 战利品' });
    assert.deepEqual(getSettlementFlow('death', 2), { phase: 'loot', title: 'Boss 战利品' });
}

function testSettlementTips() {
    assert.equal(getSettlementTip('extract', 'hangar'), '主动撤离保留全部结算奖励。调整装备后可继续无尽出击。');
    assert.equal(getSettlementTip('death', 'hangar'), '死亡会折损部分时间奖励。升级装备后再试一次。');
    assert.equal(getSettlementTip('extract', 'loot'), '撤离成功，先选择 1 项 Boss 战利品。');
    assert.equal(getSettlementTip('death', 'loot'), '机体损毁，但已击败 Boss，选择 1 项回收战利品。');
}

function testReviveAndFinishBattleGuards() {
    assert.equal(canFinishBattle('combat'), true);
    assert.equal(canFinishBattle('paused'), false);
    assert.equal(getReviveDeclinePhase(), 'combat');
}

function testExtractDoubleGate() {
    assert.equal(shouldShowExtractDouble('extract'), true);
    assert.equal(shouldShowExtractDouble('death'), false);
}

testSettlementLootGate();
testSettlementTips();
testReviveAndFinishBattleGuards();
testExtractDoubleGate();

console.log('battleFlow tests passed.');

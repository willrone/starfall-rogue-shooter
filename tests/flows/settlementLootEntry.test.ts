import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = readFileSync(join(root, 'assets/scripts/RogueShooterGame.ts'), 'utf8');

// Settlement flow gating
assert(
    source.includes('const settlementFlow = getSettlementFlow(reason, this.cs.bossKills)')
        && source.includes("settlementFlow.phase === 'loot'"),
    'settlement flow should gate Boss loot from bossKills via getSettlementFlow',
);

// Uses SettlementPopup
assert(
    source.includes('SettlementPopup'),
    'settlement should use SettlementPopup component',
);
assert(
    source.includes('uiMgr.showDynamicPopupAsync'),
    'settlement should use UIManager dynamic popup',
);

// Creates loot choices via pickup manager
assert(
    source.includes('this.pickupMgr.createLootChoices()'),
    'settlement should create loot choices via pickupManager.createLootChoices()',
);

// Apply uses choice.apply() closure
assert(
    source.includes('choice.apply()'),
    'settlement should apply loot choice via closure',
);

// After settlement, transitions to hangar
assert(
    source.includes("this.cs.phase = 'hangar'"),
    'settlement should transition to hangar phase after popup closes',
);

// SettlementPopup data object includes all needed fields
assert(
    source.includes('lootChoices:') && source.includes('onLootChosen:'),
    'settlement popup should receive lootChoices and callback',
);

console.log('settlementLootEntry tests passed.');

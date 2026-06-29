import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rogueShooterGame = readFileSync(join(root, 'assets/scripts/RogueShooterGame.ts'), 'utf8');

assert(
    rogueShooterGame.includes('const settlementFlow = getSettlementFlow(reason, this.cs.bossKills)')
        && rogueShooterGame.includes("if (settlementFlow.phase === 'loot')"),
    'settlement flow should gate Boss loot from bossKills via getSettlementFlow',
);
assert(
    rogueShooterGame.includes('private openSettlementLoot(reason: BattleEndReason): void'),
    'settlement flow should have an explicit loot entry method',
);
assert(
    rogueShooterGame.includes("this.cs.phase = 'loot'"),
    'settlement loot entry should switch to loot phase so chooseLoot can run',
);
assert(
    rogueShooterGame.includes('this.pickupMgr.pendingLootChoices = this.pickupMgr.createLootChoices()'),
    'settlement loot entry should populate pendingLootChoices before showing loot buttons',
);

console.log('settlementLootEntry tests passed.');

#!/usr/bin/env python3
from pathlib import Path

p = Path('/Users/ronghui/Documents/game_dev_cocos/assets/scripts/RogueShooterGame.ts')
lines = p.read_text().splitlines()

# Add import
import_line = "import { BotAIController, type BotAIHost } from './ai/botAI';"
if not any("./ai/botAI" in l for l in lines):
    for i, l in enumerate(lines):
        if "import { makeLabel, makeRect, makeButton" in l:
            lines.insert(i + 1, import_line)
            break

# Add botAI field after pickupMgr
if not any('private botAI = new BotAIController' in l for l in lines):
    for i, l in enumerate(lines):
        if 'private pickupMgr = new PickupManager' in l:
            lines.insert(i + 1, '    private botAI = new BotAIController(this as unknown as BotAIHost);')
            break

# Remove old Bot state fields
remove_markers = [
    "private _botState:",
    "private _botTargetPos",
    "private _botMoveTimer",
    "private _botStuckTimer",
    "private _botLastPlayerPos",
    "private _botLastKillCount",
    "private _botPickupChaseTimer",
]
lines = [l for l in lines if not any(m in l for m in remove_markers)]

# Replace botAiTick..before getMoveVector with delegates
start = next(i for i,l in enumerate(lines) if '    private botAiTick(dt: number): void {' in l)
end = next(i for i,l in enumerate(lines) if i > start and '    private getMoveVector(): Vec2 {' in l)
replacement = [
    '    private botAiTick(dt: number): void {',
    '        this.botAI.tick(dt);',
    '    }',
    '',
    '    private botPickUpgrade(): void {',
    '        this.botAI.pickUpgrade();',
    '    }',
    '',
]
lines = lines[:start] + replacement + lines[end:]

p.write_text('\n'.join(lines) + '\n')
print(f'RogueShooterGame.ts lines: {len(lines)}')

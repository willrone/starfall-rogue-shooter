#!/usr/bin/env python3
from pathlib import Path
p = Path('/Users/ronghui/Documents/game_dev_cocos/assets/scripts/RogueShooterGame.ts')
lines = p.read_text().splitlines()

# imports
if not any("RevivePopup" in l and "./ui/RevivePopup" in l for l in lines):
    for i,l in enumerate(lines):
        if "SettlementPopup" in l and "./ui/SettlementPopup" in l:
            lines.insert(i+1, "import { RevivePopup } from './ui/RevivePopup';")
            break

# remove buildRevivePanel call
lines = [l for l in lines if 'this.buildRevivePanel(root);' not in l]

# remove buildRevivePanel method
try:
    s = next(i for i,l in enumerate(lines) if '    private buildRevivePanel(root: Node)' in l)
    e = next(i for i,l in enumerate(lines) if i > s and '    private showRevivePanel' in l)
    del lines[s:e]
except StopIteration:
    pass

# replace showRevivePanel + reviveFromAd, keep declineRevive and after
try:
    s = next(i for i,l in enumerate(lines) if '    private showRevivePanel()' in l)
    e = next(i for i,l in enumerate(lines) if i > s and '    private declineRevive()' in l)
    repl = '''    private async showRevivePanel(): Promise<void> {
        if (this.revived) return;
        if (this.cs.phase !== 'combat') return;
        this.revived = true;
        this.cs.phase = 'paused';
        const result = await uiMgr.showDynamicPopupAsync(() => {
            const node = new Node('RevivePopup');
            node.addComponent(RevivePopup).setup({
                bossKills: this.cs.bossKills,
                remainingRevives: AdManager.getReviveRemaining(),
                onWatch: () => this.reviveFromAd().then((ok) => ok ? 'revived' : 'decline'),
                onDecline: () => 'decline',
            });
            return node;
        }, 'RevivePopup');
        if (result === 'decline') this.declineRevive();
    }

    private reviveFromAd(): Promise<boolean> {
        return new Promise((resolve) => {
            if (!AdManager.canReviveToday()) {
                this.showToast('今日复活次数已用完。');
                resolve(false);
                return;
            }
            AdManager.playRewardedAd((result) => {
                if (!result.success) {
                    this.showToast(result.reason || '广告播放失败，请重试。');
                    resolve(false);
                    return;
                }
                AdManager.useDailyRevive();
                this.cs.playerHp = this.cs.playerMaxHp * 0.5;
                this.cs.playerShield = 0;
                this.cs.invulnerableTimer = 1.5;
                this.playSfx('sfx_revive', 0.7, 0.2);
                this.revived = false;
                this.cs.phase = 'combat';
                this.panels.hideAllOverlays();
                this.showToast('已复活！半血重返战场。');
                resolve(true);
            });
        });
    }

'''.splitlines()
    lines = lines[:s] + repl + lines[e:]
except StopIteration:
    raise SystemExit('show/revive markers not found')

p.write_text('\n'.join(lines) + '\n')
print('patched revive popup wiring')
print('lines', len(lines))

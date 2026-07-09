/**
 * SettlementPopup — 战斗结算弹窗
 * 
 * 战斗结束后弹出，显示战果概要。
 * 如果击败了 Boss，额外展示 3 个战利品选项供玩家选择。
 * 使用 PopupBase 的自动遮罩、动画、异步返回值。
 * 
 * 用法：
 *   const result = await uiMgr.showDynamicPopupAsync(() => {
 *       const node = new Node('SettlementPopup');
 *       node.addComponent(SettlementPopup).setup(data);
 *       return node;
 *   });
 *   // result === { choice?: EquipmentLootChoiceSpec, action: 'continue' | 'loot-selected' }
 */
import {
    _decorator, Node, Label, Color, Graphics, UITransform, Sprite,
} from 'cc';
import { PopupBase } from './PopupBase';
import { loadSprite } from './UIHelpers';
import type { BattleEndReason, ResourceWallet } from '../core/types';
import { formatWallet } from '../core/resources';
const { ccclass, property } = _decorator;

const W = 672;   // panel width
const H = 960;   // panel height
const X = -W / 2;
const Y = -H / 2;
const PAD = 36;  // horizontal padding

interface LootChoiceDisplay {
    title: string;
    desc: string;
    color: string;
}

interface SettlementData {
    reason: BattleEndReason;
    title: string;
    combatTime: number;
    bossKills: number;
    killCount: number;
    level: number;
    reward: ResourceWallet;
    inventoryWallet: ResourceWallet;
    lootChoices: LootChoiceDisplay[];
    onLootChosen: (index: number) => void;
}

export interface SettlementResult {
    action: 'continue' | 'loot-selected';
    choiceIndex?: number;
}

@ccclass('SettlementPopup')
export class SettlementPopup extends PopupBase {
    private data: SettlementData | null = null;
    private _locked = false;

    setup(data: SettlementData): void {
        this.data = data;
        this.buildUI(data);
    }

    private buildUI(data: SettlementData): void {
        // ── 面板背景 (Graphics 底色 + Sprite.SLICED 九宫格) ──
        const bg = this._makeRect(W, H, '#0F172A', 6);
        const sf = loadSprite('ui/panels/panel_bg_dark/spriteFrame');
        if (sf) { const sp = bg.addComponent(Sprite); sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; sp.sizeMode = Sprite.SizeMode.CUSTOM; }
        bg.setPosition(X, Y, 0);
        this.node.addChild(bg);

        // ── 标题 ──
        this._label(data.title.toUpperCase(), 28, '#F1F5F9', W, 50, Label.HorizontalAlign.CENTER)
            .setPosition(0, H / 2 - 64, 0);

        // ── 分隔线 ──
        this._hline(H / 2 - 90, W - 80);

        // ── 战斗统计 ──
        const stats = [
            `存活时间    ${this._fmtTime(data.combatTime)}`,
            `击败 Boss   ${data.bossKills}`,
            `击杀怪物    ${data.killCount}`,
            `角色等级    ${data.level}`,
        ];
        const statLabels: Node[] = [];
        stats.forEach((text, i) => {
            const label = this._label(text, 18, '#94A3B8', W - PAD * 2, 28, Label.HorizontalAlign.LEFT);
            label.setPosition(-(W / 2 - PAD), H / 2 - 130 - i * 32, 0);
            statLabels.push(label);
        });

        // ── 资源获得 ──
        const rewardText = `本次带回  ${formatWallet(data.reward)}`;
        this._label(rewardText, 18, '#F9C74F', W - PAD * 2, 28, Label.HorizontalAlign.LEFT)
            .setPosition(-(W / 2 - PAD), H / 2 - 270, 0);

        const inventoryText = `库存  ${formatWallet(data.inventoryWallet)}`;
        this._label(inventoryText, 16, '#6F879E', W - PAD * 2, 24, Label.HorizontalAlign.LEFT)
            .setPosition(-(W / 2 - PAD), H / 2 - 298, 0);

        // ── Boss 战利品区 ──
        let currentY = H / 2 - 370;

        if (data.lootChoices.length > 0) {
            this._label('— Boss 战利品 —', 22, '#F8961E', W, 36, Label.HorizontalAlign.CENTER)
                .setPosition(0, currentY, 0);
            currentY -= 52;

            data.lootChoices.forEach((choice, i) => {
                const btnH = 110;
                const btnY = currentY - i * (btnH + 14);
                const btn = this._choiceBtn(i, choice, btnH, data.lootChoices.length);
                btn.setPosition(0, btnY, 0);
                currentY = btnY - btnH - 14;
            });
            currentY -= 20;
        }

        // ── 底部按钮 ──
        const continueY = Math.max(-H / 2 + 60, currentY);
        this._continueBtn(continueY);
    }

    private _choiceBtn(index: number, choice: LootChoiceDisplay, h: number, total: number): Node {
        const btnNode = new Node('LootChoice_' + index);
        const w = W - PAD * 2;
        const g = btnNode.addComponent(Graphics);
        const c = new Color().fromHEX(choice.color);
        g.fillColor = c;
        g.roundRect(-w / 2, -h / 2, w, h, 8);
        g.fill();
        const sf = loadSprite('ui/buttons/btn_neon/spriteFrame');
        if (sf) { const sp = btnNode.addComponent(Sprite); sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; sp.sizeMode = Sprite.SizeMode.CUSTOM; }

        // Title
        const titleLbl = btnNode.addComponent(Label);
        titleLbl.string = choice.title;
        titleLbl.fontSize = 20;
        titleLbl.lineHeight = 26;
        titleLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLbl.verticalAlign = Label.VerticalAlign.TOP;
        titleLbl.overflow = Label.Overflow.SHRINK;
        titleLbl.color = new Color().fromHEX('#FFFFFF');
        const ut = btnNode.addComponent(UITransform);
        ut.setContentSize(w + 20, h + 20);

        // Desc
        const descNode = new Node('Desc');
        const descLbl = descNode.addComponent(Label);
        descLbl.string = choice.desc;
        descLbl.fontSize = 14;
        descLbl.lineHeight = 18;
        descLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLbl.verticalAlign = Label.VerticalAlign.BOTTOM;
        descLbl.overflow = Label.Overflow.SHRINK;
        descLbl.color = new Color().fromHEX('#F8FAFC');
        descNode.setPosition(0, -h / 2 + 22, 0);
        btnNode.addChild(descNode);

        btnNode.on(Node.EventType.TOUCH_END, () => {
            if (!this._locked && this.data) {
                this._locked = true;
                this.data.onLootChosen(index);
                this.ret = { action: 'loot-selected', choiceIndex: index } as SettlementResult;
                this.close();
            }
        });
        this.node.addChild(btnNode);
        return btnNode;
    }

    private _continueBtn(y: number): void {
        const btnW = 240;
        const btnH = 52;
        const btnX = -btnW / 2;
        const node = new Node('ContinueBtn');
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#10B981');
        g.roundRect(0, 0, btnW, btnH, 8);
        g.fill();
        const sf = loadSprite('ui/buttons/btn_green/spriteFrame');
        if (sf) { const sp = node.addComponent(Sprite); sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; sp.sizeMode = Sprite.SizeMode.CUSTOM; }

        const label = node.addComponent(Label);
        label.string = '返回机库';
        label.fontSize = 20;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');

        const ut = node.addComponent(UITransform);
        ut.setContentSize(btnW + 20, btnH + 20);

        node.setPosition(0, y, 0);
        node.on(Node.EventType.TOUCH_END, () => {
            if (!this._locked) {
                this._locked = true;
                this.ret = { action: 'continue' } as SettlementResult;
                this.close();
            }
        });
        this.node.addChild(node);
    }

    private _label(text: string, fontSize: number, color: string, w: number, h: number, hAlign: number, vAlign?: number): Node {
        const node = new Node();
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = h;
        label.horizontalAlign = hAlign;
        if (vAlign !== undefined) label.verticalAlign = vAlign;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX(color);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        this.node.addChild(node);
        return node;
    }

    private _makeRect(w: number, h: number, color: string, r = 0): Node {
        const node = new Node();
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX(color);
        if (r > 0) g.roundRect(0, 0, w, h, r);
        else g.rect(0, 0, w, h);
        g.fill();
        return node;
    }

    private _hline(y: number, w: number): void {
        const line = new Node();
        const g = line.addComponent(Graphics);
        g.strokeColor = new Color().fromHEX('#334155');
        g.lineWidth = 1;
        g.moveTo(-w / 2, 0);
        g.lineTo(w / 2, 0);
        g.stroke();
        line.setPosition(0, y, 0);
        this.node.addChild(line);
    }

    private _fmtTime(seconds: number): string {
        const whole = Math.max(0, Math.floor(seconds));
        const m = Math.floor(whole / 60);
        const s = whole % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}

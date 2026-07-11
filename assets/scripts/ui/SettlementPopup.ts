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
    _decorator, Node, Label, Color, Graphics,
} from 'cc';
import { PopupBase } from './PopupBase';
import { ensureUITransform, applySlicedSprite } from './UIHelpers';
import type { BattleEndReason, ResourceWallet } from '../core/types';
import { formatWallet } from '../core/resources';
const { ccclass, property } = _decorator;

const W = 672;   // panel width
const H = 960;   // panel height
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
        ensureUITransform(this.node, W, H);
        this.node.setPosition(0, 0, 0);
        this.buildUI(data);
    }

    private buildUI(data: SettlementData): void {
        // ── 面板背景 (Graphics 底色 + Sprite.SLICED 九宫格) ──
        const bg = this._makeRect(W, H, '#0F172A', 18);
        applySlicedSprite(bg, 'ui/panels/panel_bg_dark/spriteFrame');
        bg.setPosition(0, 0, -1);
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
            label.setPosition(0, H / 2 - 130 - i * 32, 0);
            statLabels.push(label);
        });

        // ── 资源获得 ──
        const rewardText = `本次带回  ${formatWallet(data.reward)}`;
        this._label(rewardText, 18, '#F9C74F', W - PAD * 2, 28, Label.HorizontalAlign.LEFT)
            .setPosition(0, H / 2 - 270, 0);

        const inventoryText = `库存  ${formatWallet(data.inventoryWallet)}`;
        this._label(inventoryText, 16, '#6F879E', W - PAD * 2, 24, Label.HorizontalAlign.LEFT)
            .setPosition(0, H / 2 - 298, 0);

        // ── Boss 战利品区 ──
        if (data.lootChoices.length > 0) {
            const lootHeaderY = H / 2 - 370;
            this._label('— Boss 战利品 —', 22, '#F8961E', W, 36, Label.HorizontalAlign.CENTER)
                .setPosition(0, lootHeaderY, 0);

            data.lootChoices.forEach((choice, i) => {
                const btnH = 110;
                const btnY = lootHeaderY - 58 - i * (btnH + 14);
                const btn = this._choiceBtn(i, choice, btnH);
                btn.setPosition(0, btnY, 0);
            });
            this._continueBtn(-H / 2 + 54);
            return;
        }

        this._continueBtn(-H / 2 + 70);
    }

    private _choiceBtn(index: number, choice: LootChoiceDisplay, h: number): Node {
        const btnNode = new Node('LootChoice_' + index);
        const w = W - PAD * 2;
        ensureUITransform(btnNode, w, h);
        const g = btnNode.addComponent(Graphics);
        const c = new Color().fromHEX(choice.color);
        g.fillColor = c;
        g.roundRect(-w / 2, -h / 2, w, h, 8);
        g.fill();
        applySlicedSprite(btnNode, 'ui/buttons/btn_neon/spriteFrame');

        // Title
        const titleNode = new Node('Title');
        ensureUITransform(titleNode, w - 32, 36);
        const titleLbl = titleNode.addComponent(Label);
        titleLbl.string = choice.title;
        titleLbl.fontSize = 20;
        titleLbl.lineHeight = 26;
        titleLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLbl.verticalAlign = Label.VerticalAlign.CENTER;
        titleLbl.overflow = Label.Overflow.SHRINK;
        titleLbl.color = new Color().fromHEX('#FFFFFF');
        titleNode.setPosition(0, 24, 1);
        btnNode.addChild(titleNode);
        // Desc
        const descNode = new Node('Desc');
        ensureUITransform(descNode, w - 32, 44);
        const descLbl = descNode.addComponent(Label);
        descLbl.string = choice.desc;
        descLbl.fontSize = 14;
        descLbl.lineHeight = 18;
        descLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLbl.verticalAlign = Label.VerticalAlign.CENTER;
        descLbl.overflow = Label.Overflow.SHRINK;
        descLbl.color = new Color().fromHEX('#F8FAFC');
        descNode.setPosition(0, -22, 1);
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
        const node = new Node('ContinueBtn');
        ensureUITransform(node, btnW, btnH);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#10B981');
        g.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        g.fill();
        applySlicedSprite(node, 'ui/buttons/btn_green/spriteFrame');

        const labelNode = new Node('Label');
        ensureUITransform(labelNode, btnW - 24, btnH);
        const label = labelNode.addComponent(Label);
        label.string = '返回机库';
        label.fontSize = 20;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
        node.addChild(labelNode);

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
        ensureUITransform(node, w, h);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(fontSize + 3, Math.min(h, Math.round(fontSize * 1.35)));
        label.horizontalAlign = hAlign;
        label.verticalAlign = vAlign ?? Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX(color);
        this.node.addChild(node);
        return node;
    }

    private _makeRect(w: number, h: number, color: string, r = 0): Node {
        const node = new Node();
        ensureUITransform(node, w, h);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX(color);
        if (r > 0) g.roundRect(-w / 2, -h / 2, w, h, r);
        else g.rect(-w / 2, -h / 2, w, h);
        g.fill();
        return node;
    }

    private _hline(y: number, w: number): void {
        const line = new Node();
        ensureUITransform(line, w, 2);
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

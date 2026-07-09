/**
 * ShopPopup — 战斗内商店弹窗 (Sprite 九宫格版)
 * 
 * 6 格道具商店（3行×2列），每格有购买和刷新操作。
 * 背景/按钮使用九宫格 Sprite，替代旧版 Graphics 绘制。
 */
import {
    _decorator, Node, Label, Color, Graphics, UITransform, Sprite,
} from 'cc';
import { PopupBase } from './PopupBase';
import { loadSprite } from './UIHelpers';
import type { LevelUpgrade } from '../core/types';
const { ccclass, property } = _decorator;

const W = 672;
const H = 940;
const PAD = 36;
const COL_W = 304;
const ROW_H = 188;
const BTN_H = 118;
const REFRESH_H = 40;
const COL_GAP = 20;
const ROW_GAP = 16;
const START_X = PAD;
const SLOT_W = (W - PAD * 2 - COL_GAP) / 2; // 300

interface ShopSlotDisplay {
    item: LevelUpgrade | null;
    cost: number;
    canAfford: boolean;
}

export interface ShopPopupOptions {
    combatTime: number;
    spendableAlloy: number;
    slots: ShopSlotDisplay[];
    onBuy: (index: number) => Promise<{ success: boolean; message?: string }>;
    onRefresh: (index: number) => Promise<{ success: boolean; message?: string }>;
    onClose: () => void;
}

@ccclass('ShopPopup')
export class ShopPopup extends PopupBase {
    private opts: ShopPopupOptions | null = null;
    private slotNodes: { buy: Node; refresh: Node }[] = [];
    private titleLabel: Label | null = null;
    private tipLabel: Label | null = null;
    private _locked = false;

    setup(opts: ShopPopupOptions): void {
        this.opts = opts;
        this.render();
    }

    render(): void {
        for (const s of this.slotNodes) {
            s.buy.removeFromParent();
            s.refresh.removeFromParent();
        }
        this.slotNodes = [];
        const toRemove: Node[] = [];
        for (let i = this.node.children.length - 1; i >= 0; i--) {
            const child = this.node.children[i];
            if (child.name !== 'Bg') toRemove.push(child);
        }
        for (const n of toRemove) n.removeFromParent();
        this._buildUI();
    }

    /** Add Sprite.SLICED overlay to a Graphics-bg node */
    private _skin(node: Node, skinPath: string): void {
        const sf = loadSprite(skinPath);
        if (sf) { const sp = node.addComponent(Sprite); sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; sp.sizeMode = Sprite.SizeMode.CUSTOM; }
    }

    private _buildUI(): void {
        const opts = this.opts;
        if (!opts) return;

        // ── Background (Graphics + Sprite.SLICED 九宫格) ──
        const bg = new Node('Bg');
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#0F172A');
        g.roundRect(0, 0, W, H, 10);
        g.fill();
        this._skin(bg, 'ui/panels/panel_bg_dark/spriteFrame');
        bg.setPosition(-W / 2, -H / 2, -1);
        this.node.addChild(bg);

        const minutes = Math.floor(opts.combatTime / 60);
        const seconds = Math.floor(opts.combatTime % 60);
        const titleStr = `战场商店  ${minutes}:${seconds < 10 ? '0' + seconds : String(seconds)}`;
        const titleNode = this._label(titleStr, 32, '#F1F5F9', W, 48, Label.HorizontalAlign.CENTER);
        this.titleLabel = titleNode.getComponent(Label)!;
        titleNode.setPosition(0, H / 2 - 40, 0);

        const tipStr = `可用合金 ${opts.spendableAlloy}。购买后自动补货；单格刷新 -18 合金。`;
        const tipNode = this._label(tipStr, 16, '#94A3B8', W - PAD * 2, 36, Label.HorizontalAlign.CENTER);
        this.tipLabel = tipNode.getComponent(Label)!;
        tipNode.setPosition(0, H / 2 - 90, 0);

        const slotStartY = H / 2 - 150;
        for (let i = 0; i < 6; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const bx = -W / 2 + PAD + col * (SLOT_W + COL_GAP);
            const by = slotStartY - row * (BTN_H + REFRESH_H + ROW_GAP);
            const buyNode = this._createBuyBtn(i, bx, by);
            const refreshNode = this._createRefreshBtn(i, bx, by - BTN_H - 4);
            this.slotNodes.push({ buy: buyNode, refresh: refreshNode });
        }

        this._createCloseBtn();
    }

    private _createBuyBtn(index: number, x: number, y: number): Node {
        const node = new Node('Buy_' + index);
        const slot = this.opts!.slots[index];
        const item = slot?.item;
        const w = SLOT_W;
        const h = BTN_H;

        if (!item) { node.active = false; this.node.addChild(node); return node; }

        const g = node.addComponent(Graphics);
        const color = slot.canAfford ? item.color : '#475569';
        g.fillColor = new Color().fromHEX(color);
        g.roundRect(0, 0, w, h, 8);
        g.fill();
        this._skin(node, 'ui/buttons/btn_neon/spriteFrame');

        const label = node.addComponent(Label);
        label.fontSize = 15;
        label.lineHeight = 18;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
        label.string = `${item.category} T${item.tier}  合金${slot.cost}\n${item.name}\n${item.desc}`;

        const ut = node.addComponent(UITransform);
        ut.setContentSize(w + 10, h + 10);
        node.setPosition(x, y, 0);
        node.on(Node.EventType.TOUCH_END, async () => {
            if (this._locked) return;
            this._locked = true;
            if (this.opts) {
                const result = await this.opts.onBuy(index);
                if (result.message) this._showResult(result.message);
            }
            this._locked = false;
        });
        this.node.addChild(node);
        return node;
    }

    private _createRefreshBtn(index: number, x: number, y: number): Node {
        const node = new Node('Refresh_' + index);
        const w = SLOT_W;
        const h = REFRESH_H;

        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#F8961E');
        g.roundRect(0, 0, w, h, 6);
        g.fill();
        this._skin(node, 'ui/buttons/btn_alloy/spriteFrame');

        const label = node.addComponent(Label);
        label.fontSize = 16;
        label.lineHeight = 18;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
        label.string = `刷新此格 -18`;
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w + 10, h + 10);
        node.setPosition(x, y, 0);
        node.on(Node.EventType.TOUCH_END, async () => {
            if (this._locked) return;
            this._locked = true;
            if (this.opts) {
                const result = await this.opts.onRefresh(index);
                if (result.message) this._showResult(result.message);
            }
            this._locked = false;
        });
        this.node.addChild(node);
        return node;
    }

    private _createCloseBtn(): void {
        const btnW = 264;
        const btnH = 52;
        const node = new Node('CloseBtn');
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#43AA8B');
        g.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        g.fill();
        this._skin(node, 'ui/buttons/btn_green/spriteFrame');

        const label = node.addComponent(Label);
        label.string = '继续战斗';
        label.fontSize = 20;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
        const ut = node.addComponent(UITransform);
        ut.setContentSize(btnW + 20, btnH + 20);
        node.setPosition(0, -H / 2 + 60, 0);
        node.on(Node.EventType.TOUCH_END, () => {
            if (this._locked) return;
            this._locked = true;
            this.opts?.onClose();
            this.ret = { action: 'close' };
            this.close();
        });
        this.node.addChild(node);
    }

    private _showResult(message: string): void {
        if (this.tipLabel) {
            this.tipLabel.string = message;
            this.scheduleOnce(() => {
                if (this.tipLabel && this.opts) {
                    this.tipLabel.string = `可用合金 ${this.opts.spendableAlloy}。购买后自动补货；单格刷新 -18 合金。`;
                }
            }, 2);
        }
    }

    private _label(text: string, fontSize: number, color: string, w: number, h: number, hAlign: number): Node {
        const node = new Node();
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = h;
        label.horizontalAlign = hAlign;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX(color);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        this.node.addChild(node);
        return node;
    }

    private _fmtTime(seconds: number): string {
        const whole = Math.max(0, Math.floor(seconds));
        const m = Math.floor(whole / 60);
        const s = whole % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}

/**
 * ShopPopup — 战斗内商店弹窗
 *
 * 6 格道具商店（3 行 × 2 列）。商品卡把分类、Tier、名称、效果、价格
 * 分层展示，避免整卡文字被 Label.SHRINK 压成不可读小字。
 */
import {
    _decorator, Node, Label, Color, Graphics,
} from 'cc';
import { PopupBase } from './PopupBase';
import { applySlicedSprite, ensureUITransform } from './UIHelpers';
import type { LevelUpgrade } from '../core/types';
const { ccclass } = _decorator;

const W = 672;
const H = 940;
const PAD = 26;
const COL_GAP = 18;
const SLOT_W = (W - PAD * 2 - COL_GAP) / 2; // 301
const BTN_H = 126;
const REFRESH_H = 42;
const ROW_PITCH = 184;
const SHOP_REFRESH_COST = 18;

interface ShopSlotDisplay {
    item: LevelUpgrade | null;
    cost: number;
    canAfford: boolean;
}

export interface ShopPopupState {
    spendableAlloy: number;
    slots: ShopSlotDisplay[];
}

export interface ShopPopupOptions extends ShopPopupState {
    combatTime: number;
    onBuy: (index: number) => Promise<{ success: boolean; message?: string }>;
    onRefresh: (index: number) => Promise<{ success: boolean; message?: string }>;
    onClose: () => void;
}

export type ShopPopupConfig = ShopPopupOptions & { getState: () => ShopPopupState };
@ccclass('ShopPopup')
export class ShopPopup extends PopupBase {
    private opts: ShopPopupOptions | null = null;
    private _getState: (() => ShopPopupState) | null = null;
    private tipLabel: Label | null = null;
    private _locked = false;

    setup(opts: ShopPopupOptions): void {
        const config = opts as ShopPopupConfig;
        this.opts = opts;
        this._getState = config.getState || null;
        ensureUITransform(this.node, W, H);
        this.node.setPosition(0, 0, 0);
        this.render();
    }

    render(): void {
        const children = this.node.children.slice();
        for (const child of children) {
            child.removeFromParent();
            child.destroy();
        }
        this.tipLabel = null;
        this._buildUI();
        this._applyUiLayerDeep(this.node);
    }

    private _buildUI(): void {
        const opts = this.opts;
        if (!opts) return;

        this._createPanelBackground();

        const minutes = Math.floor(opts.combatTime / 60);
        const seconds = Math.floor(opts.combatTime % 60);
        this._label(
            this.node, 'ShopTitle',
            `战场商店  ${minutes}:${seconds < 10 ? '0' + seconds : String(seconds)}`,
            30, '#F1F5F9', W - 48, 46, 0, H / 2 - 40,
        );

        const tipNode = this._label(
            this.node, 'ShopTip',
            `可用合金 ${opts.spendableAlloy}  ·  购买后自动补货  ·  单格刷新 -${SHOP_REFRESH_COST}`,
            17, '#CBD5E1', W - 56, 34, 0, H / 2 - 84,
        );
        this.tipLabel = tipNode.getComponent(Label)!;

        const leftX = -SLOT_W / 2 - COL_GAP / 2;
        const rightX = SLOT_W / 2 + COL_GAP / 2;
        const firstCardY = H / 2 - 178;
        for (let i = 0; i < 6; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = col === 0 ? leftX : rightX;
            const cardY = firstCardY - row * ROW_PITCH;
            this._createBuyCard(i, cx, cardY);
            this._createRefreshButton(i, cx, cardY - BTN_H / 2 - REFRESH_H / 2 - 4);
        }

        this._createCloseButton();
    }

    private _createPanelBackground(): void {
        const bg = new Node('Bg');
        ensureUITransform(bg, W, H);
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#07111F');
        g.roundRect(-W / 2, -H / 2, W, H, 22);
        g.fill();
        g.strokeColor = new Color().fromHEX('#38BDF8');
        g.lineWidth = 2;
        g.roundRect(-W / 2 + 5, -H / 2 + 5, W - 10, H - 10, 18);
        g.stroke();
        applySlicedSprite(bg, 'ui/panels/panel_bg_dark/spriteFrame');
        bg.setPosition(0, 0, -1);
        this.node.addChild(bg);
    }

    private _createBuyCard(index: number, cx: number, cy: number): Node {
        const node = new Node('Buy_' + index);
        ensureUITransform(node, SLOT_W, BTN_H);
        const slot = this.opts!.slots[index];
        const item = slot?.item;
        if (!item) {
            node.active = false;
            this.node.addChild(node);
            return node;
        }

        const itemColor = new Color().fromHEX(slot.canAfford ? item.color : '#64748B');
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#0B1324');
        g.roundRect(-SLOT_W / 2, -BTN_H / 2, SLOT_W, BTN_H, 14);
        g.fill();
        itemColor.a = slot.canAfford ? 78 : 42;
        g.fillColor = itemColor;
        g.roundRect(-SLOT_W / 2 + 3, -BTN_H / 2 + 3, SLOT_W - 6, BTN_H - 6, 12);
        g.fill();
        itemColor.a = slot.canAfford ? 230 : 120;
        g.strokeColor = itemColor;
        g.lineWidth = 2;
        g.roundRect(-SLOT_W / 2 + 2, -BTN_H / 2 + 2, SLOT_W - 4, BTN_H - 4, 12);
        g.stroke();
        applySlicedSprite(node, 'ui/buttons/btn_neon/spriteFrame');

        this._label(node, 'ItemMeta_' + index, `${item.category} · T${item.tier}`, 15, '#CBD5E1', SLOT_W - 124, 24, -48, 44, Label.HorizontalAlign.LEFT);
        this._label(
            node, 'ItemPrice_' + index,
            slot.canAfford ? `购买 ${slot.cost}` : `差 ${Math.max(0, slot.cost - this.opts!.spendableAlloy)}`,
            16, slot.canAfford ? '#FDE68A' : '#FDA4AF', 104, 26, SLOT_W / 2 - 60, 44,
        );
        this._label(node, 'ItemName_' + index, item.name, 21, '#FFFFFF', SLOT_W - 28, 30, 0, 12);
        this._label(node, 'ItemDesc_' + index, item.desc, 16, '#E2E8F0', SLOT_W - 28, 42, 0, -30);

        node.setPosition(cx, cy, 0);
        node.on(Node.EventType.TOUCH_END, async () => {
            if (this._locked || !this.opts) return;
            this._locked = true;
            const result = await this.opts.onBuy(index);
            this._locked = false;
            this._syncFromSource(result.message);
        });
        this.node.addChild(node);
        return node;
    }

    private _createRefreshButton(index: number, cx: number, cy: number): Node {
        const node = new Node('Refresh_' + index);
        ensureUITransform(node, SLOT_W, REFRESH_H);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#5B3412');
        g.roundRect(-SLOT_W / 2, -REFRESH_H / 2, SLOT_W, REFRESH_H, 9);
        g.fill();
        g.strokeColor = new Color().fromHEX('#F59E0B');
        g.lineWidth = 1.5;
        g.roundRect(-SLOT_W / 2 + 2, -REFRESH_H / 2 + 2, SLOT_W - 4, REFRESH_H - 4, 8);
        g.stroke();
        applySlicedSprite(node, 'ui/buttons/btn_alloy/spriteFrame');
        this._label(node, 'RefreshLabel_' + index, `刷新此格  -${SHOP_REFRESH_COST} 合金`, 17, '#FFF7ED', SLOT_W - 20, REFRESH_H, 0, 0);

        node.setPosition(cx, cy, 0);
        node.on(Node.EventType.TOUCH_END, async () => {
            if (this._locked || !this.opts) return;
            this._locked = true;
            const result = await this.opts.onRefresh(index);
            this._locked = false;
            this._syncFromSource(result.message);
        });
        this.node.addChild(node);
        return node;
    }

    private _createCloseButton(): void {
        const btnW = 284;
        const btnH = 58;
        const node = new Node('CloseBtn');
        ensureUITransform(node, btnW, btnH);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#064E3B');
        g.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
        g.fill();
        g.strokeColor = new Color().fromHEX('#34D399');
        g.lineWidth = 2;
        g.roundRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW - 4, btnH - 4, 10);
        g.stroke();
        applySlicedSprite(node, 'ui/buttons/btn_green/spriteFrame');
        this._label(node, 'CloseLabel', '继续战斗', 21, '#FFFFFF', btnW - 20, btnH, 0, 0);

        node.setPosition(0, -H / 2 + 50, 0);
        node.on(Node.EventType.TOUCH_END, () => {
            if (this._locked) return;
            this._locked = true;
            this.opts?.onClose();
            this.ret = { action: 'close' };
            this.close();
        });
        this.node.addChild(node);
    }

    private _syncFromSource(message?: string): void {
        if (!this.opts) return;
        const state = this._getState ? this._getState() : this.opts;
        this.opts.spendableAlloy = state.spendableAlloy;
        this.opts.slots = state.slots;
        this.render();
        if (message) this._showResult(message);
    }

    private _showResult(message: string): void {
        if (!this.tipLabel || !this.opts) return;
        this.tipLabel.string = message;
        this.scheduleOnce(() => {
            if (this.tipLabel && this.opts) {
                this.tipLabel.string = `可用合金 ${this.opts.spendableAlloy}  ·  购买后自动补货  ·  单格刷新 -${SHOP_REFRESH_COST}`;
            }
        }, 2);
    }

    private _applyUiLayerDeep(node: Node): void {
        node.layer = this.node.layer;
        for (const child of node.children) this._applyUiLayerDeep(child);
    }

    private _label(
        parent: Node,
        name: string,
        text: string,
        fontSize: number,
        color: string,
        w: number,
        h: number,
        x: number,
        y: number,
        hAlign = Label.HorizontalAlign.CENTER,
    ): Node {
        const node = new Node(name);
        ensureUITransform(node, w, h);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(fontSize + 3, Math.min(h, fontSize + 6));
        label.horizontalAlign = hAlign;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX(color);
        node.setPosition(x, y, 1);
        parent.addChild(node);
        return node;
    }
}

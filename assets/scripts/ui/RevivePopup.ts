/**
 * RevivePopup — 复活弹窗 (Sprite 九宫格版)
 *
 * HP ≤ 0 时弹出，提供"看视频复活"和"放弃"两个选项。
 * 背景/按钮使用九宫格 Sprite，替代旧版 Graphics 绘制。
 */
import {
    _decorator, Node, Label, Color, Graphics,
} from 'cc';
import { PopupBase } from './PopupBase';
import { applySlicedSprite, ensureUITransform } from './UIHelpers';
const { ccclass, property } = _decorator;

const PANEL_W = 624;
const PANEL_H = 350;

interface RevivePopupOptions {
    bossKills: number;
    remainingRevives: number;
    onWatch: () => Promise<string> | string;
    onDecline: () => string;
}

@ccclass('RevivePopup')
export class RevivePopup extends PopupBase {
    private opts: RevivePopupOptions | null = null;
    private watchLabel: Label | null = null;
    private declineLabel: Label | null = null;
    private watchBtn: Node | null = null;
    private declineBtn: Node | null = null;
    private watchDisabled = false;

    setup(opts: RevivePopupOptions): void {
        this.opts = opts;
        ensureUITransform(this.node, PANEL_W, PANEL_H);
        this.buildUI(opts);
    }

    private _skin(node: Node, skinPath: string): void {
        applySlicedSprite(node, skinPath);
    }

    private buildUI(opts: RevivePopupOptions): void {
        const w = PANEL_W;
        const h = PANEL_H;
        // 阴影
        const shadow = this._makeRect(w + 12, h + 12, '#00000040');
        shadow.setPosition(0, -6, -10);
        this.node.addChild(shadow);

        // 面板背景 (Graphics 底色 + Sprite.SLICED 九宫格)
        const bg = this._makeRect(w, h, '#1E293B');
        this._skin(bg, 'ui/panels/panel_bg_dark/spriteFrame');
        bg.setPosition(0, 0, 0);
        this.node.addChild(bg);

        // 边框 (Graphics outline)
        const border = this._makeRect(w, h, '#334155', true);
        border.setPosition(0, 0, 1);
        this.node.addChild(border);

        // 标题
        const title = opts.bossKills > 0
            ? `机体损毁 · 已击败 ${opts.bossKills} Boss`
            : '机体损毁';
        this._label(title, 34, '#F1F5F9', w, 56, Label.HorizontalAlign.CENTER)
            .setPosition(0, h / 2 - 56, 0);

        this._label('看视频立即复活，继续战斗！', 22, '#94A3B8', w - 24, 42, Label.HorizontalAlign.CENTER)
            .setPosition(0, h / 2 - 120, 0);

        this.watchBtn = this._btn('看视频复活 (今日剩余' + opts.remainingRevives + '次)', 0, h / 2 - 200, 360, 56, '#F8961E', 'ui/buttons/btn_gold/spriteFrame', () => this._onWatch());
        this.declineBtn = this._btn('放弃', 0, h / 2 - 270, 300, 50, '#64748B', 'ui/buttons/btn_disabled/spriteFrame', () => this._onDecline());
    }

    private _onWatch(): void {
        if (this.watchDisabled || !this.opts) return;
        this.watchDisabled = true;
        this._setBtnLabel(this.watchBtn!, '广告加载中...');
        const result = this.opts.onWatch();
        Promise.resolve(result).then((val) => {
            this.ret = val;
            this.close();
        }).catch(() => {
            this.watchDisabled = false;
            const remaining = this.opts?.remainingRevives ?? 0;
            this._setBtnLabel(this.watchBtn!, `看视频复活 (今日剩余${remaining}次)`);
        });
    }

    private _onDecline(): void {
        if (!this.opts) return;
        this.ret = this.opts.onDecline();
        this.close();
    }

    private _makeRect(w: number, h: number, color: string, stroke = false): Node {
        const node = new Node();
        ensureUITransform(node, w, h);
        const g = node.addComponent(Graphics);
        const c = new Color().fromHEX(color);
        if (stroke) {
            g.strokeColor = c; g.lineWidth = 1; g.roundRect(-w / 2, -h / 2, w, h, 8); g.stroke();
        } else {
            g.fillColor = c; g.roundRect(-w / 2, -h / 2, w, h, 8); g.fill();
        }
        return node;
    }

    private _label(text: string, fontSize: number, color: string, w: number, h: number, hAlign: number): Node {
        const node = new Node();
        ensureUITransform(node, w, h);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(fontSize + 3, Math.min(h, Math.round(fontSize * 1.35)));
        label.horizontalAlign = hAlign;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = 2;
        label.color = new Color().fromHEX(color);
        this.node.addChild(node);
        return node;
    }

    private _btn(text: string, cx: number, cy: number, w: number, h: number, color: string, skinPath: string, onClick: () => void): Node {
        const node = new Node();
        ensureUITransform(node, w, h);
        const g = node.addComponent(Graphics);
        const c = new Color().fromHEX(color);
        g.fillColor = c;
        g.roundRect(-w / 2, -h / 2, w, h, 10);
        g.fill();
        this._skin(node, skinPath);

        const labelNode = new Node('Label');
        ensureUITransform(labelNode, w - 20, h);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 20;
        label.lineHeight = 24;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
        node.addChild(labelNode);

        node.setPosition(cx, cy, 0);
        node.on(Node.EventType.TOUCH_END, () => {
            if (!this.watchDisabled || node === this.declineBtn) onClick();
        });
        this.node.addChild(node);
        return node;
    }

    private _setBtnLabel(btn: Node, text: string): void {
        const label = btn.getChildByName('Label')?.getComponent(Label);
        if (label) label.string = text;
    }
}

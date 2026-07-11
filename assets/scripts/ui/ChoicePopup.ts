/**
 * ChoicePopup — 通用选择弹窗
 * 
 * 用于：升级 3 选 1、宝箱道具选择、丢弃选择。
 * 支持：图标显示、刷新按钮（合金/广告）。
 */
import {
    _decorator, Node, Label, Color, Graphics, Sprite, SpriteFrame, UITransform,
} from 'cc';
import { PopupBase } from './PopupBase';
import { applySlicedSprite, ensureUITransform } from './UIHelpers';
const { ccclass } = _decorator;

const W = 648;
const H = 640;
const PAD = 32;

export interface ChoiceDisplayItem {
    id: string;
    title: string;
    desc: string;
    color: string;
}

interface ChoiceOptions {
    title: string;
    hint: string;
    choices: ChoiceDisplayItem[];
    refreshCost: number;
    onRefresh: () => Promise<ChoiceDisplayItem[] | null>;
    getIcon?: (id: string) => SpriteFrame | null;
}

export interface ChoiceResult {
    action: 'chosen' | 'refresh-closed';
    index?: number;
}

@ccclass('ChoicePopup')
export class ChoicePopup extends PopupBase {
    private opts: ChoiceOptions | null = null;
    private choiceNodes: Node[] = [];
    private refreshBtn: Node | null = null;
    private refreshLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private _locked = false;

    setup(opts: ChoiceOptions): void {
        this.opts = opts;
        ensureUITransform(this.node, W, H);
        this.node.setPosition(0, 0, 0);
        this._buildUI(opts);
    }

    updateChoices(choices: ChoiceDisplayItem[]): void {
        if (!this.opts) return;
        this.opts.choices = choices;
        for (let i = 0; i < this.choiceNodes.length; i++) {
            const node = this.choiceNodes[i];
            const choice = choices[i];
            node.active = !!choice;
            if (!choice) continue;
            this._updateChoiceBtn(node, choice, i);
        }
        this._locked = false;
    }

    updateHint(hint: string): void {
        if (this.hintLabel) this.hintLabel.string = hint;
    }

    updateRefreshLabel(text: string): void {
        if (this.refreshLabel) this.refreshLabel.string = text;
    }

    private _buildUI(opts: ChoiceOptions): void {
        const centerX = 0;

        this._createPanelBg();

        let cy = H / 2 - 48;

        // ── Title ──
        this._label(opts.title, 24, '#F1F5F9', W, 40, Label.HorizontalAlign.CENTER)
            .setPosition(0, cy, 0);
        cy -= 50;

        // ── Hint ──
        const hintNode = this._label(opts.hint, 16, '#94A3B8', W - PAD * 2, 36, Label.HorizontalAlign.CENTER);
        this.hintLabel = hintNode.getComponent(Label)!;
        hintNode.setPosition(centerX, cy, 0);
        cy -= 68;

        // ── 3 Choice buttons ──
        const btnH = 108;
        const btnGap = 14;
        for (let i = 0; i < 3; i++) {
            const btnNode = this._createChoiceBtn(i, opts.choices[i], btnH);
            btnNode.setPosition(centerX, cy, 0);
            this.choiceNodes.push(btnNode);
            cy -= (btnH + btnGap);
        }
        cy -= 12;

        // ── Refresh button ──
        if (opts.refreshCost > 0) {
            const refreshBtn = this._createRefreshBtn(opts.refreshCost);
            refreshBtn.setPosition(centerX, cy, 0);
            this.refreshBtn = refreshBtn;
            cy -= 58;
        }
    }

    private _createPanelBg(): void {
        const bgNode = new Node('PanelBg');
        ensureUITransform(bgNode, W, H);
        const gfx = bgNode.addComponent(Graphics);
        gfx.fillColor = new Color(0, 0, 0, 140);
        gfx.roundRect(-W / 2 + 8, -H / 2 + 10, W - 16, H - 16, 20);
        gfx.fill();
        gfx.fillColor = new Color().fromHEX('#020617');
        gfx.roundRect(-W / 2, -H / 2, W, H, 18);
        gfx.fill();
        gfx.fillColor = new Color(15, 23, 42, 246);
        gfx.roundRect(-W / 2 + 4, -H / 2 + 4, W - 8, H - 8, 16);
        gfx.fill();
        gfx.strokeColor = new Color().fromHEX('#38BDF8');
        gfx.lineWidth = 2;
        gfx.roundRect(-W / 2 + 7, -H / 2 + 7, W - 14, H - 14, 14);
        gfx.stroke();
        applySlicedSprite(bgNode, 'ui/panels/panel_bg_dark/spriteFrame');
        bgNode.setPosition(0, 0, -1);
        this.node.addChild(bgNode);
    }

    private _createChoiceBtn(index: number, choice: ChoiceDisplayItem | undefined, h: number): Node {
        const node = new Node('Choice_' + index);
        const w = W - PAD * 2;

        // Touch listener (Cocos 3.8.8 touch dispatch requires UITransform on the node
        // to be sized BEFORE the click target; we add UT first, then optional sprite/label)
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);

        const gfx = node.addComponent(Graphics);
        this._drawChoiceButton(gfx, w, h, choice?.color || '#334155', !choice);
        const skin = applySlicedSprite(node, 'ui/buttons/btn_neon/spriteFrame');
        skin.color = new Color(255, 255, 255, 132);

        const icon = choice ? this.opts?.getIcon?.(choice.id) || null : null;
        const textCenter = icon ? 40 : 0;
        const textWidth = icon ? w - 142 : w - 32;

        if (icon) {
            const iconNode = new Node('Icon');
            ensureUITransform(iconNode, 58, 58);
            const sprite = iconNode.addComponent(Sprite);
            sprite.spriteFrame = icon;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            iconNode.setPosition(-w / 2 + 56, 0, 1);
            node.addChild(iconNode);
        }

        // Title label
        const titleNode = new Node('Title');
        ensureUITransform(titleNode, textWidth, 36);
        const titleLbl = titleNode.addComponent(Label);
        titleLbl.fontSize = 20;
        titleLbl.lineHeight = 28;
        titleLbl.horizontalAlign = icon ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
        titleLbl.verticalAlign = Label.VerticalAlign.CENTER;
        titleLbl.overflow = Label.Overflow.SHRINK;
        titleLbl.color = new Color().fromHEX('#FFFFFF');
        titleNode.setPosition(textCenter, 21, 1);
        node.addChild(titleNode);

        // Desc label (child)
        const descNode = new Node('Desc');
        ensureUITransform(descNode, textWidth, 38);
        const descLbl = descNode.addComponent(Label);
        descLbl.fontSize = 14;
        descLbl.lineHeight = 18;
        descLbl.horizontalAlign = icon ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
        descLbl.verticalAlign = Label.VerticalAlign.CENTER;
        descLbl.overflow = Label.Overflow.SHRINK;
        descLbl.color = new Color().fromHEX('#CBD5E1');
        descNode.setPosition(textCenter, -23, 1);
        node.addChild(descNode);

        if (choice) {
            titleLbl.string = choice.title;
            descLbl.string = choice.desc;
        }

        // Touch handler
        node.on(Node.EventType.TOUCH_END, () => {
            if (!this._locked && this.opts && this.opts.choices[index]) {
                this._locked = true;
                this.ret = { action: 'chosen', index } as ChoiceResult;
                this.close();
            }
        });

        this.node.addChild(node);
        return node;
    }

    private _updateChoiceBtn(node: Node, choice: ChoiceDisplayItem, index: number): void {
        const gfx = node.getComponent(Graphics);
        if (gfx) this._drawChoiceButton(gfx, W - PAD * 2, 108, choice.color, false);
        const iconNode = node.getChildByName('Icon');
        const icon = this.opts?.getIcon?.(choice.id) || null;
        if (iconNode) {
            const sprite = iconNode.getComponent(Sprite);
            if (sprite) sprite.spriteFrame = icon;
            iconNode.active = !!icon;
        }
        const titleNode = node.getChildByName('Title');
        const titleLbl = titleNode?.getComponent(Label);
        if (titleLbl) titleLbl.string = choice.title;
        const descNode = node.getChildByName('Desc');
        if (descNode) {
            const dl = descNode.getComponent(Label);
            if (dl) dl.string = choice.desc;
        }
    }

    private _createRefreshBtn(cost: number): Node {
        const btnW = 240;
        const btnH = 44;
        const node = new Node('RefreshBtn');

        node.addComponent(UITransform).setContentSize(btnW, btnH);
        const gfx = node.addComponent(Graphics);
        this._drawChoiceButton(gfx, btnW, btnH, '#F8961E', false, 10);
        const skin = applySlicedSprite(node, 'ui/buttons/btn_alloy/spriteFrame');
        skin.color = new Color(255, 255, 255, 156);

        const labelNode = new Node('Label');
        ensureUITransform(labelNode, btnW - 20, btnH);
        const label = labelNode.addComponent(Label);
        label.string = `刷新 -${cost}合金`;
        label.fontSize = 18;
        label.lineHeight = 24;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
        node.addChild(labelNode);
        this.refreshLabel = label;

        node.on(Node.EventType.TOUCH_END, async () => {
            if (this._locked || !this.opts) return;
            this._locked = true;
            this.refreshLabel!.string = '刷新中...';
            try {
                const newChoices = await this.opts.onRefresh();
                if (newChoices && newChoices.length > 0) {
                    this.updateChoices(newChoices);
                    this.refreshLabel!.string = `刷新 -${cost}合金`;
                }
            } catch {
                this.refreshLabel!.string = '刷新失败';
            }
            this._locked = false;
        });

        this.node.addChild(node);
        return node;
    }

    private _drawChoiceButton(gfx: Graphics, w: number, h: number, color: string, disabled: boolean, radius = 14): void {
        gfx.clear();
        const main = new Color().fromHEX(disabled ? '#334155' : color);
        const bg = new Color().fromHEX(disabled ? '#111827' : '#0F172A');
        gfx.fillColor = new Color(0, 0, 0, disabled ? 70 : 120);
        gfx.roundRect(-w / 2 + 4, -h / 2 + 5, w - 8, h - 8, radius + 2);
        gfx.fill();
        gfx.fillColor = bg;
        gfx.roundRect(-w / 2, -h / 2, w, h, radius);
        gfx.fill();
        main.a = disabled ? 60 : 110;
        gfx.fillColor = main;
        gfx.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, Math.max(6, radius - 2));
        gfx.fill();
        gfx.fillColor = new Color(255, 255, 255, disabled ? 10 : 20);
        gfx.roundRect(-w / 2 + 8, -h / 2 + 6, w - 16, Math.max(6, h * 0.18), Math.max(4, radius - 6));
        gfx.fill();
        main.a = disabled ? 95 : 220;
        gfx.strokeColor = main;
        gfx.lineWidth = 1.6;
        gfx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.max(5, radius - 2));
        gfx.stroke();
    }

    private _label(text: string, fontSize: number, color: string, w: number, h: number, hAlign: number): Node {
        const node = new Node();
        ensureUITransform(node, w, h);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(fontSize + 3, Math.min(h, Math.round(fontSize * 1.35)));
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.horizontalAlign = hAlign;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX(color);
        this.node.addChild(node);
        return node;
    }
}

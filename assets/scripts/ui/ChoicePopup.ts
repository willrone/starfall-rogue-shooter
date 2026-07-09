/**
 * ChoicePopup — 通用选择弹窗 (Sprite 九宫格版)
 * 
 * 用于：升级 3 选 1、宝箱道具选择、丢弃选择。
 * 支持：图标显示、刷新按钮（合金/广告）。
 * 背景/按钮使用九宫格 Sprite，替代旧版 Graphics 绘制。
 */
import {
    _decorator, Node, Label, Color, Sprite, SpriteFrame, UITransform, resources, v3, Size,
} from 'cc';
import { PopupBase } from './PopupBase';
const { ccclass } = _decorator;

const W = 648;
const H = 520;
const PAD = 36;

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

/** UI 主题色：按钮和面板按武器 tier 映射 */
const BTN_SKINS: Record<string, string> = {
    'novice': 'ui/buttons/btn_cyan',
    'standard': 'ui/buttons/btn_blue',
    'boss_gate': 'ui/buttons/btn_purple',
    'boss_clear': 'ui/buttons/btn_gold',
    'legendary': 'ui/buttons/btn_red',
};

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

    private _loadSprite(path: string): SpriteFrame | null {
        const sf = resources.get(path, SpriteFrame);
        return sf || null;
    }

    private _buildUI(opts: ChoiceOptions): void {
        const centerX = 0;

        // ── Panel background (九宫格 Sprite) ──
        const panelSkin = this._loadSprite('ui/panels/panel_bg_dark/spriteFrame');
        if (panelSkin) {
            const bgNode = new Node('PanelBg');
            const sp = bgNode.addComponent(Sprite);
            sp.spriteFrame = panelSkin;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const ut = bgNode.addComponent(UITransform);
            ut.setContentSize(W + 20, H + 20);
            bgNode.setPosition(centerX, 0, -1);
            this.node.addChild(bgNode);
        }

        let cy = H / 2 - 30;

        // ── Title ──
        this._label(opts.title, 24, '#F1F5F9', W, 40, Label.HorizontalAlign.CENTER)
            .setPosition(0, cy, 0);
        cy -= 48;

        // ── Hint ──
        const hintNode = this._label(opts.hint, 16, '#94A3B8', W - PAD * 2, 36, Label.HorizontalAlign.CENTER);
        this.hintLabel = hintNode.getComponent(Label)!;
        hintNode.setPosition(centerX, cy, 0);
        cy -= 48;

        // ── 3 Choice buttons (Sprite 九宫格按钮) ──
        const btnH = 90;
        const btnGap = 14;
        for (let i = 0; i < 3; i++) {
            const btnNode = this._createChoiceBtn(i, opts.choices[i], btnH);
            btnNode.setPosition(centerX, cy, 0);
            this.choiceNodes.push(btnNode);
            cy -= (btnH + btnGap);
        }
        cy -= 16;

        // ── Refresh button ──
        if (opts.refreshCost > 0) {
            const refreshBtn = this._createRefreshBtn(opts.refreshCost);
            refreshBtn.setPosition(centerX, cy, 0);
            this.refreshBtn = refreshBtn;
            cy -= 58;
        }
    }

    private _createChoiceBtn(index: number, choice: ChoiceDisplayItem | undefined, h: number): Node {
        const node = new Node('Choice_' + index);
        const w = W - PAD * 2;

        // Button skin
        const btnPath = choice ? (BTN_SKINS[choice.id] || 'ui/buttons/btn_blue') : 'ui/buttons/btn_disabled';
        const sf = this._loadSprite(btnPath + '/spriteFrame');
        if (sf) {
            const sp = node.addComponent(Sprite);
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const ut = node.addComponent(UITransform);
            ut.setContentSize(w, h);
            // Scale sprite to fit
            const s = node.addComponent(UITransform);
            s.setContentSize(w, h);
        } else {
            // Fallback: simple colored square
            const g = node.addComponent(Sprite);
            // empty fallback
            const ut = node.addComponent(UITransform);
            ut.setContentSize(w + 20, h + 20);
        }

        // Title label
        const titleLbl = node.addComponent(Label);
        titleLbl.fontSize = 20;
        titleLbl.lineHeight = 26;
        titleLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLbl.verticalAlign = Label.VerticalAlign.TOP;
        titleLbl.overflow = Label.Overflow.SHRINK;
        titleLbl.color = new Color().fromHEX('#FFFFFF');

        // Desc label (child)
        const descNode = new Node('Desc');
        const descLbl = descNode.addComponent(Label);
        descLbl.fontSize = 14;
        descLbl.lineHeight = 18;
        descLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLbl.verticalAlign = Label.VerticalAlign.BOTTOM;
        descLbl.overflow = Label.Overflow.SHRINK;
        descLbl.color = new Color().fromHEX('#CBD5E1');
        descNode.setPosition(0, -h / 2 + 20, 0);
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
        const sp = node.getComponent(Sprite);
        if (sp) {
            const btnPath = BTN_SKINS[choice.id] || 'ui/buttons/btn_blue';
            const sf = this._loadSprite(btnPath + '/spriteFrame');
            if (sf) sp.spriteFrame = sf;
        }
        const labels = node.getComponents(Label);
        if (labels.length > 0) labels[0].string = choice.title;
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

        const sf = this._loadSprite('ui/buttons/btn_alloy/spriteFrame');
        if (sf) {
            const sp = node.addComponent(Sprite);
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const ut = node.addComponent(UITransform);
            ut.setContentSize(btnW, btnH);
        }

        const label = node.addComponent(Label);
        label.string = `刷新 -${cost}合金`;
        label.fontSize = 18;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX('#FFFFFF');
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

    private _label(text: string, fontSize: number, color: string, w: number, h: number, hAlign: number): Node {
        const node = new Node();
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = h;
        label.horizontalAlign = hAlign;
        label.overflow = Label.Overflow.SHRINK;
        label.color = new Color().fromHEX(color);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(w, h);
        this.node.addChild(node);
        return node;
    }
}
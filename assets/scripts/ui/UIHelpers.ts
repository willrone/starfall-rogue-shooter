/**
 * UIHelpers — 纯 UI 辅助函数
 * 
 * 从 RogueShooterGame.ts 提取的 label/rect/button/place/hex/clamp/distanceSq。
 * 不依赖游戏实例状态，只操作 CC 组件。
 */
import {
    Node, Label, Graphics, Color, UITransform, Layers, tween, Vec3, Sprite, SpriteFrame, resources,
} from 'cc';
import type { ButtonView } from './panels';

export function makeLabel(
    parent: Node, name: string, text: string,
    x: number, y: number, w: number, h: number,
    fontSize: number, color: string,
    hAlign = Label.HorizontalAlign.LEFT,
    local = false,
): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    if (local) {
        const pt = parent.getComponent(UITransform);
        placeLocal(node, x + w / 2, y + h / 2, pt?.width ?? w, pt?.height ?? h);
    } else {
        place(node, x + w / 2, y + h / 2);
    }
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = h;
    label.horizontalAlign = hAlign;
    label.overflow = Label.Overflow.SHRINK;
    label.color = new Color().fromHEX(color);
    const ut = node.addComponent(UITransform);
    ut.setContentSize(w, h);
    return label;
}

export function makeRect(
    parent: Node, name: string,
    x: number, y: number, w: number, h: number,
    color: string, r = 0, borderColor?: string,
): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    place(node, x + w / 2, y + h / 2);
    node.addComponent(UITransform).setContentSize(w, h);
    const gfx = node.addComponent(Graphics);
    gfx.fillColor = hex(color);
    if (r > 0) gfx.roundRect(-w / 2, -h / 2, w, h, r);
    else gfx.rect(-w / 2, -h / 2, w, h);
    gfx.fill();
    if (borderColor) {
        gfx.strokeColor = hex(borderColor);
        gfx.lineWidth = 1.5;
        gfx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.max(2, r - 2));
        gfx.stroke();
    }
    return node;
}

export function makeButton(
    parent: Node, name: string,
    x: number, y: number, w: number, h: number,
    color: string, disabledColor: string,
    onClick: () => void,
    local = false,
): ButtonView {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    if (local) {
        const pt = parent.getComponent(UITransform);
        placeLocal(node, x + w / 2, y + h / 2, pt?.width ?? w, pt?.height ?? h);
    } else {
        place(node, x + w / 2, y + h / 2);
    }
    node.addComponent(UITransform).setContentSize(w, h);
    const gfx = node.addComponent(Graphics);
    const fs = h >= 60 ? 16 : h >= 44 ? 14 : 12;
    const label = makeLabel(node, `${name}_Label`, '', 0, 0, w, h, fs, '#F8FAFC', Label.HorizontalAlign.CENTER, true);
    const view: ButtonView = { node, gfx, label, width: w, height: h, color, disabledColor, disabled: false };
    drawButton(gfx, w, h, color, false);

    node.on(Node.EventType.TOUCH_START, () => {
        if (!view.disabled) tween(node).to(0.08, { scale: new Vec3(0.97, 0.97, 1) }, { easing: 'sineOut' }).start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => { tween(node).stop(); node.setScale(Vec3.ONE); });
    node.on(Node.EventType.TOUCH_END, () => {
        tween(node).stop(); node.setScale(Vec3.ONE);
        if (!view.disabled) onClick();
    });
    return view;
}

export function drawButton(gfx: Graphics, w: number, h: number, mainColor: string, disabled: boolean): void {
    const r = Math.min(18, Math.max(10, h * 0.24));
    gfx.clear();
    if (!disabled) {
        gfx.fillColor = hex(mainColor, 28);
        gfx.roundRect(-w / 2 + 6, -h / 2 + 8, w - 12, h - 12, r + 4); gfx.fill();
        gfx.fillColor = hex(mainColor, 14);
        gfx.roundRect(-w / 2 + 10, -h / 2 + 12, w - 20, h - 20, r + 6); gfx.fill();
    }
    gfx.fillColor = hex('#000000', disabled ? 48 : 80);
    gfx.roundRect(-w / 2 + 3, -h / 2 + 5, w - 6, h - 6, r); gfx.fill();
    gfx.fillColor = hex('#080E1A', 245);
    gfx.roundRect(-w / 2, -h / 2, w, h, r); gfx.fill();
    gfx.fillColor = hex(mainColor, disabled ? 40 : 80);
    gfx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.max(6, r - 2)); gfx.fill();
    const hl = Math.min(16, Math.floor(h * 0.15));
    gfx.fillColor = hex('#FFFFFF', disabled ? 8 : 18);
    gfx.roundRect(-w / 2 + 6, -h / 2 + 4, w - 12, hl, Math.max(4, r - 6)); gfx.fill();
    gfx.strokeColor = hex(mainColor, disabled ? 100 : 200);
    gfx.lineWidth = 1.5;
    gfx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.max(4, r - 2)); gfx.stroke();
}

export function place(node: Node, designX: number, designY: number): void {
    node.setPosition(designX - 360, designY - 640, node.position.z);
}

export function placeLocal(node: Node, localX: number, localY: number, pw: number, ph: number): void {
    node.setPosition(localX - pw / 2, localY - ph / 2, node.position.z);
}

export function hex(hexStr: string, alpha = 255): Color {
    const c = new Color().fromHEX(hexStr);
    c.a = Math.min(255, Math.max(0, alpha));
    return c;
}

export function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
}

const _sfCache: Record<string, SpriteFrame | null> = {};
export function loadSprite(path: string): SpriteFrame | null {
    if (path in _sfCache) return _sfCache[path];
    const sf = resources.get(path, SpriteFrame);
    _sfCache[path] = sf || null;
    return sf;
}

/**
 * 创建九宫格 Sprite 面板（Graphics 颜色填充 + Sprite.SLICED 纹理叠加）。
 * ChoicePopup 使用了同样的模式：先填色，再贴 Sprite。
 */
export function makePanelBg(
    parent: Node, name: string,
    x: number, y: number, w: number, h: number,
    fillColor: string, r = 20,
    skinPath = 'ui/panels/panel_bg_dark/spriteFrame',
): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    place(node, x + w / 2, y + h / 2);
    node.addComponent(UITransform).setContentSize(w, h);

    // Graphics 底色（暗色填充保证不透明）
    const gfx = node.addComponent(Graphics);
    gfx.fillColor = hex(fillColor);
    gfx.roundRect(-w / 2, -h / 2, w, h, r);
    gfx.fill();

    // Sprite 九宫格纹理贴面
    const sf = loadSprite(skinPath);
    if (sf) {
        const sp = node.addComponent(Sprite);
        sp.spriteFrame = sf;
        sp.type = Sprite.Type.SLICED;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
    }
    return node;
}

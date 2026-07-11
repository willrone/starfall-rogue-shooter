/**
 * PopupBase — 弹窗基类
 * 自动管理：半透明遮罩、出入场动画、异步关闭返回、点击外部关闭。
 * 
 * 用法：
 *   class ShopPopup extends PopupBase {
 *       onLoad() {
 *           this.enableClickBlankToClose();
 *       }
 *       close() {
 *           this.ret = { confirmed: true, itemId: 5 };
 *           super.close();
 *       }
 *   }
 *   // 调用方：
 *   let ret = await uiMgr.showPopupAsync(ShopConf, { gold: 100 });
 *   // ret === { confirmed: true, itemId: 5 }
 */
import {
    _decorator, Node, UIOpacity, EventTouch, UITransform, Widget, Graphics, Color, BlockInputEvents,
} from 'cc';
import { UIBase } from './UIBase';
import { ensureUITransform } from './UIHelpers';
const { ccclass, property } = _decorator;

@ccclass('PopupBase')
export class PopupBase extends UIBase {
    /**
     * 关闭弹窗时返回的数据（由子类赋值，外部通过 showPopupAsync 的 Promise 获取）
     */
    ret?: any;

    /**
     * 关闭回调（由 UIManager 内部设置，外部不要调用）
     */
    onDestroyCall: (value?: any) => void = () => {};

    onDestroy() {
        this.onDestroyCall(this.ret);
        super.onDestroy();
    }

    /**
     * 关闭弹窗。子类覆盖时在赋值 ret 后调用 super.close()
     */
    close() {
        this.closeAnim();
    }

    /**
     * 入场动画。子类可覆盖自定义
     * 默认实现：直接显示（子类可用 schedule/tween 自定义动画）
     */
    showAnim() {
        const widget = this.node.getComponent(Widget);
        if (widget) widget.updateAlignment();
    }

    /**
     * 出场动画。子类可覆盖，但最后必须调用 this.node.destroy()
     */
    closeAnim() {
        this.node.destroy();
    }

    /**
     * 设置遮罩透明度（默认 180）
     */
    setDarkBgOpacity(opacity: number) {
        const dark = this.node.parent?.getChildByName('_dark');
        if (dark) {
            const uiOpacity = dark.getComponent(UIOpacity);
            if (uiOpacity) uiOpacity.opacity = opacity;
        }
    }

    /**
     * 启用点击空白区域关闭弹窗。
     * 不传参数则默认使用第一个子节点作为"非空白区域"。
     * Button/Toggle 等交互控件优先级更高，无需加入排除数组。
     */
    enableClickBlankToClose(nds?: Node[]) {
        if ((!nds || nds.length === 0) && this.node.children.length > 0) {
            nds = [this.node.children[0]];
        }
        this.node.on(Node.EventType.TOUCH_END, (evt: EventTouch) => {
            const startPos = evt.getUIStartLocation();
            const endPos = evt.getUILocation();
            const subPos = endPos.clone().subtract(startPos);
            if (Math.abs(subPos.x) < 15 && Math.abs(subPos.y) < 15) {
                let needClose = true;
                if (nds) {
                    for (let i = 0; i < nds.length; i++) {
                        const bounds = nds[i].getComponent(UITransform)?.getBoundingBoxToWorld();
                        if (bounds && bounds.contains(startPos)) {
                            needClose = false;
                            break;
                        }
                    }
                }
                if (needClose) this.close();
            }
        }, this);
    }

    /**
     * 创建全屏遮挡层节点，阻止触摸穿透
     */
    static createOverlay(): Node {
        const overlay = new Node('_overlay');
        ensureUITransform(overlay, 2000, 2000);
        overlay.addComponent(BlockInputEvents);
        return overlay;
    }

    /**
     * 创建半透明遮罩节点
     */
    static createDarkBg(opacity = 180): Node {
        const dark = new Node('_dark');
        ensureUITransform(dark, 2000, 2000);
        const gfx = dark.addComponent(Graphics);
        gfx.fillColor = new Color(0, 0, 0, 255);
        gfx.rect(-1000, -1000, 2000, 2000);
        gfx.fill();
        dark.addComponent(UIOpacity).opacity = opacity;
        return dark;
    }
}

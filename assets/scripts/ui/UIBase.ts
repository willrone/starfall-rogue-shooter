/**
 * UIBase — UI 组件基类
 * 提供资源引用管理、数据传递、子节点检索等通用能力。
 * 所有 Layer/Popup/Panel/Widget 脚本应继承此类。
 * 
 * 来自 cocos-creator-async3，适配本项目的 UI 体系。
 */
import { _decorator, Component, Asset, Event, Node, warn } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UIBase')
export class UIBase extends Component {
    /**
     * 动态加载的资源列表，节点销毁时自动 decRef 释放
     */
    refAssets: Asset[] = [];

    /**
     * 从外部传入的数据（异步打开时传递）
     */
    recvData?: any;

    /**
     * 按钮点击回调路由
     * 由子类覆盖，处理按钮点击事件
     */
    onBtnClick(evt: Event, name: string) {
        // 子类覆盖
    }

    onDestroy() {
        // 自动释放引用的资源
        if (this.refAssets) {
            for (let i = 0; i < this.refAssets.length; i++) {
                const asset = this.refAssets[i];
                if (asset) asset.decRef();
            }
            this.refAssets = [];
        }
    }

    /**
     * 按路径检索子节点或组件。
     * 用法：
     *   this.getObj('bg.txt')
     *   this.getObj('bg.btn.txt', Label)
     *   this.getObj(parentNode, 'icon.name', Label)
     */
    getObj<T = Node>(pathStr: string, type?: { prototype: T }): T;
    getObj<T = Node>(parentNode: Node, pathStr: string, type?: { prototype: T }): T;
    getObj<T = Node>(param1: any, param2?: any, param3?: any): T | null {
        let p: Node;
        let pathStr: string;
        let typ: any;
        if (typeof param1 === 'string') {
            p = this.node;
            pathStr = param1;
            typ = param2;
        } else {
            p = param1;
            pathStr = param2;
            typ = param3;
        }
        const segments = pathStr.split('.');
        for (let i = 0; i < segments.length; i++) {
            const child = p.getChildByName(segments[i]);
            if (!child) {
                if (segments.length > 1) warn(`UIBase.getObj: child "${segments[i]}" not found`);
                return null;
            }
            p = child;
        }
        if (typ) return p.getComponent(typ) as T;
        return p as unknown as T;
    }
}

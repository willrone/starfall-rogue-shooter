/**
 * UIManager — UI 管理器
 * 
 * 管理 Layer（主界面切换）、Popup（弹窗栈）、Panel（面板）、Widget（控件）的
 * 生命周期：创建、显示、隐藏、销毁、资源释放。
 * 
 * 集成方式：
 * 1. 在场景根节点挂一个空节点作为 UI root
 * 2. 在游戏入口脚本中调用 uiMgr.init(root)
 * 3. 为每个界面定义 IUIConfig 配置
 * 4. 使用 goLayerAsync / showPopupAsync 等 API
 * 
 * 与现有 PanelManager 共存：UIManager 管理界面生命周期，
 * PanelManager 管理具体的节点引用和按钮布局。
 */

import { Prefab, Node, BlockInputEvents, instantiate, UITransform, Layers } from 'cc';
import { IUIConfig, UICacheMode, LAYER_PATH, POPUP_PATH, PANEL_PATH, WIDGET_PATH, ensureBundle } from './UIConfig';
import { UIBase } from './UIBase';
import { PopupBase } from './PopupBase';

export class UIManager {
    // ── 当前 Layer ─────────────────────────────────────────────
    private _curLayerConf: IUIConfig | null = null;
    private _root: Node | null = null;

    /**
     * 初始化，绑定 UI 根节点
     */
    init(root: Node): void {
        this._root = root;
    }

    /** 获取 UI 根节点 */
    root(): Node | null {
        return this._root;
    }

    /** 获取当前 Layer 配置 */
    getCurLayerConf(): IUIConfig | null {
        return this._curLayerConf;
    }

    /** 获取当前 Layer 节点 */
    getCurLayer(): Node | null {
        if (!this._root || !this._curLayerConf) return null;
        return this._root.getChildByName(this._curLayerConf.name);
    }

    // ── Layer 管理 ─────────────────────────────────────────────

    /**
     * 切换 Layer（主界面切换）
     * @param newConf 目标 Layer 配置
     * @param data 传递给 Layer 的数据
     */
    async goLayerAsync(newConf: IUIConfig, data?: any): Promise<void> {
        const preConf = this._curLayerConf;
        if (preConf && preConf.name === newConf.name) {
            // 相同 Layer → 刷新
            await this._resetCurLayerAsync(data);
            return;
        }

        this._curLayerConf = newConf;

        // 如果是 Stay 模式且有缓存，直接激活
        if (newConf.cacheMode === UICacheMode.Stay && this._root) {
            const existing = this._root.getChildByName(newConf.name);
            if (existing) {
                existing.active = true;
                const scpt = existing.getComponent(newConf.script || newConf.name) as any;
                if (scpt && scpt.refresh) {
                    scpt.recvData = data;
                    scpt.refresh();
                }
                this._clearLayer(preConf);
                return;
            }
        }

        // 创建新 Layer
        if (!this._root) return;
        const layer = await this._genUIAsync(newConf, LAYER_PATH, data);
        this._root.addChild(layer);
        this._clearLayer(preConf);
    }

    /**
     * 刷新当前 Layer
     */
    private async _resetCurLayerAsync(data?: any): Promise<void> {
        const conf = this._curLayerConf;
        if (!conf) return;

        if (conf.cacheMode === UICacheMode.Stay && this._root) {
            const layer = this._root.getChildByName(conf.name);
            if (layer) {
                const scpt = layer.getComponent(conf.script || conf.name) as any;
                if (scpt) {
                    scpt.recvData = data;
                    if (scpt.refresh) scpt.refresh();
                }
                return;
            }
        }

        // NoCache → 重建
        if (!this._root) return;
        const delLayer = this._root.getChildByName(conf.name);
        if (delLayer) {
            delLayer.name = '_removed';
            const layer = await this._genUIAsync(conf, LAYER_PATH, data);
            this._root.addChild(layer);
            delLayer.destroy();
        }
    }

    /**
     * 清除旧 Layer
     */
    private _clearLayer(preConf: IUIConfig | null): void {
        if (!preConf || !this._root) return;
        const layer = this._root.getChildByName(preConf.name);
        if (!layer) return;
        if (preConf.cacheMode === UICacheMode.Stay) {
            layer.active = false;
        } else {
            layer.destroy();
        }
    }

    // ── Popup 管理 ─────────────────────────────────────────────

    /**
     * 显示弹窗，返回 Promise 在关闭时 resolve
     * @param conf 弹窗配置
     * @param data 传递给弹窗的数据
     * @returns 弹窗关闭时返回的数据（由弹窗脚本的 ret 属性决定）
     */
    async showPopupAsync(conf: IUIConfig, data?: any): Promise<any> {
        const curLayer = this.getCurLayer() || this._root;
        if (!curLayer) {
            console.warn('[UIManager] No root node to show popup on');
            return;
        }

        // 弹窗容器（必须带 UITransform，否则 Cocos 3.8.8 preview 输入派发栈会在
        // _sortPointerEventProcessorList 里抛 "null.cameraPriority"）
        const container = new Node('_popup_' + conf.name);
        const containerTrans = container.addComponent(UITransform);
        containerTrans.setContentSize(720, 1280);
        container.layer = Layers.Enum.UI_2D;
        curLayer.addChild(container);
        container.addComponent(BlockInputEvents);

        // 半透明遮罩
        const darkBg = PopupBase.createDarkBg(180);
        container.addChild(darkBg);

        // 弹窗内容
        const popupNode = await this._genUIAsync(conf, POPUP_PATH, data);
        const scpt = popupNode.getComponent(conf.script || conf.name) as PopupBase;
        popupNode.parent = container;

        if (scpt && scpt.showAnim) {
            scpt.showAnim();
        }

        // 返回 Promise，关闭时 resolve
        return new Promise<any>((resolve) => {
            if (scpt) {
                scpt.onDestroyCall = resolve;
            }
        });
    }

    /**
     * 获取已显示的弹窗节点
     */
    getPopup(popupConf: IUIConfig, layerConf?: IUIConfig): Node | null {
        const conf = layerConf || this._curLayerConf;
        if (!conf || !this._root) return null;
        const layer = this._root.getChildByName(conf.name);
        if (!layer) return null;
        return layer.getChildByName('_popup_' + popupConf.name);
    }

    /**
     * 关闭所有弹窗
     */
    closeAllPopup(): void {
        const layer = this.getCurLayer();
        if (!layer) return;
        const children = layer.children.slice();
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.name.startsWith('_popup_')) {
                child.destroy();
            }
        }
    }

    // ── Panel / Widget ─────────────────────────────────────────

    /**
     * 创建面板（需手动设置 parent 才能显示）
     */
    async createPanelAsync(conf: IUIConfig, data?: any): Promise<Node> {
        return await this._genUIAsync(conf, PANEL_PATH, data);
    }

    /**
     * 创建控件（需手动设置 parent 才能显示）
     */
    async createWidgetAsync(conf: IUIConfig, data?: any): Promise<Node> {
        return await this._genUIAsync(conf, WIDGET_PATH, data);
    }

    // ── 动态弹窗（无需 Prefab） ────────────────────────────────────

    /**
     * 显示动态生成节点的弹窗（无需 Prefab，适合程序化 UI）
     * @param buildNode 返回弹窗内容节点的工厂函数
     * @param data 传给弹窗的数据
     * @returns 弹窗关闭时返回的数据
     */
    async showDynamicPopupAsync(
        buildNode: () => Node,
        popupName = 'DynamicPopup',
        data?: any,
    ): Promise<any> {
        const curLayer = this.getCurLayer() || this._root;
        if (!curLayer) {
            console.warn('[UIManager] No root node to show popup on');
            return;
        }

        // 弹窗容器（必须带 UITransform，否则 Cocos 3.8.8 preview 输入派发栈会在
        // _sortPointerEventProcessorList 里抛 "null.cameraPriority"）
        const container = new Node('_popup_' + popupName);
        const containerTrans = container.addComponent(UITransform);
        containerTrans.setContentSize(720, 1280);
        container.layer = Layers.Enum.UI_2D;
        curLayer.addChild(container);
        container.addComponent(BlockInputEvents);

        // 半透明遮罩
        const darkBg = PopupBase.createDarkBg(180);
        container.addChild(darkBg);

        // 弹窗内容
        const popupNode = buildNode();
        const scpt = popupNode.getComponent(PopupBase) as PopupBase;
        if (scpt) {
            scpt.recvData = data;
        }
        popupNode.parent = container;

        if (scpt && scpt.showAnim) {
            scpt.showAnim();
        }

        return new Promise<any>((resolve) => {
            if (scpt) {
                scpt.onDestroyCall = resolve;
            } else {
                // 没有脚本则容器销毁时 resolve
                const checkDestroy = () => {
                    if (!container.isValid) resolve(undefined);
                    else requestAnimationFrame(() => checkDestroy());
                };
                checkDestroy();
            }
        });
    }

    // ── 通用 ──────────────────────────────────────────────────

    /**
     * 生成 UI 节点：加载 Prefab → 实例化 → 附加脚本
     */
    private async _genUIAsync(conf: IUIConfig, prefixPath: string, data?: any): Promise<Node> {
        const bundle = await ensureBundle(conf.bundle);
        const prefab = await new Promise<Prefab>((resolve, reject) => {
            bundle.load(prefixPath + conf.name, Prefab, (err: Error | null, asset: Prefab) => {
                if (err) reject(err);
                else resolve(asset);
            });
        });

        const node = instantiate(prefab);
        const scptName = conf.script || conf.name;
        let scpt = node.getComponent(scptName) as UIBase;
        if (!scpt) {
            scpt = node.addComponent(UIBase) as UIBase;
        }
        scpt.recvData = data;

        // 资源引用管理
        if (conf.cacheMode !== UICacheMode.Cache) {
            prefab.addRef();
            scpt.refAssets.push(prefab);
        } else {
            if (prefab.refCount === 0) prefab.addRef();
        }

        return node;
    }

    // ── 触摸屏蔽 ───────────────────────────────────────────────

    /**
     * 屏蔽 UI 触摸
     */
    banTouch(): void {
        if (!this._root) return;
        const existing = this._root.getChildByName('_ban');
        if (existing) return;
        const ban = new Node('_ban');
        // 加 UITransform 否则 Cocos 3.8.8 preview 输入派发会抛 null.cameraPriority
        const banTrans = ban.addComponent(UITransform);
        banTrans.setContentSize(720, 1280);
        ban.layer = Layers.Enum.UI_2D;
        ban.addComponent(BlockInputEvents);
        this._root.addChild(ban);
    }

    /**
     * 恢复 UI 触摸
     */
    unbanTouch(): void {
        if (!this._root) return;
        const ban = this._root.getChildByName('_ban');
        if (ban) ban.destroy();
    }
}

/** 全局单例 */
export const uiMgr = new UIManager();

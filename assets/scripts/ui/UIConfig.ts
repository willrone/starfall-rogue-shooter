/**
 * UIConfig — UI 资源配置类型定义
 * 
 * 来自 cocos-creator-async3，适配本项目的 UI 分层体系。
 * 
 * # Cocos Creator 编辑器预制体集成指南
 * 
 * 本 UI 框架支持两种模式：
 * 
 * ## 模式 A：程序化 UI（当前项目默认）
 * 直接在代码中用 Node/Graphics/Label 构建 UI。
 * 无需编辑器操作，适合纯代码工作流。
 * 示例：`RevivePopup`、`SettlementPopup`、`ChoicePopup`、`ShopPopup`
 * 
 * ## 模式 B：编辑器预制体（适用于复杂 UI）
 * 在 Cocos Creator 编辑器中创建 `.prefab` 文件，
 * 通过 `uiMgr.showPopupAsync(conf)` 加载。
 * 
 * ### 步骤（一次设置，后续扩展）：
 * 
 * 1. **在编辑器中创建预制体目录**
 *    ```
 *    assets/
 *      Prefabs/
 *        Popup/       ← Popup 弹窗
 *        Panel/       ← 面板
 *        Widget/      ← 控件
 *        Layer/       ← 主界面
 *    ```
 * 
 * 2. **创建弹窗 Prefab**
 *    - 右键 `assets/Prefabs/Popup/` → Create → Prefab
 *    - 命名为 `ShopPopup`
 *    - 在 Prefab 上创建 UI 节点树
 *    - 添加脚本组件（比如 `ShopPopup.ts` 继承 PopupBase）
 *    - 编辑器设置脚本参数
 * 
 * 3. **代码中加载**
 *    ```
 *    import { uiMgr } from './ui/UIManager';
 *    // ...
 *    const result = await uiMgr.showPopupAsync({
 *        bundle: 'resources',        // 默认 bundle
 *        name: 'ShopPopup',          // prefab 文件名
 *        script: 'ShopPopup',        // 脚本组件名（可选）
 *        cacheMode: UICacheMode.NoCache,
 *    }, { data: 'hello' });
 *    // result === scpt.ret
 *    ```
 * 
 * ### 注意事项
 * - Prefab 中的脚本必须继承 `PopupBase`（或 `UIBase`）
 * - 缓存在 `recvData` 中获取传递的数据
 * - `PopupBase` 会自动管理遮罩和动画
 * - `cacheMode.Stay` 适合常驻 Layer（主界面切换不销毁）
 * 
 * ## 4 种 UI 类型
 * - Layer:   主界面切换（战斗/大厅）
 * - Popup:   弹窗（背包/熔炉/结算），自带遮罩+动画
 * - Panel:   面板（可嵌入 Layer 或 Popup）
 * - Widget:  控件（Toast/HUD 组件）
 */
import { assetManager } from 'cc';

/** 缓存模式 */
export const enum UICacheMode {
    /** 不缓存，销毁即释放 */
    NoCache = 0,
    /** 缓存资源，销毁不释放 */
    Cache,
    /** 常驻节点（仅 Layer 用），不销毁不释放 */
    Stay,
}

export interface IUIConfig {
    /** Bundle 包名（默认 'resources'） */
    bundle: string;
    /** Prefab 资源名（与文件名一致） */
    name: string;
    /** 挂载的脚本名，可选。缺省表示脚本名和 prefab 资源名一致 */
    script?: string;
    /** 缓存模式，默认 NoCache */
    cacheMode?: UICacheMode;
}

/** Prefab 各类型路径配置 */
const PRE_PATH = 'Prefabs/';
export const LAYER_PATH = PRE_PATH + 'Layer/';
export const POPUP_PATH = PRE_PATH + 'Popup/';
export const PANEL_PATH = PRE_PATH + 'Panel/';
export const WIDGET_PATH = PRE_PATH + 'Widget/';

/**
 * 获取 bundle，必要时自动加载
 */
export async function ensureBundle(bundleName: string): Promise<any> {
    let bundle = assetManager.getBundle(bundleName);
    if (!bundle) {
        bundle = await new Promise<any>((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err: Error | null, b: any) => {
                if (err) reject(err);
                else resolve(b);
            });
        });
    }
    return bundle;
}

# 星坠幸存者 UI 系统基线

> 基线日期：2026-07-11
>
> 设计分辨率：720×1280，竖屏
>
> 本文定义 UI 的代码边界、布局坐标、皮肤和图标加载合同。美术资源的完整替换流程见 [ART_REPLACEMENT_GUIDE.md](./ART_REPLACEMENT_GUIDE.md)。

## 1. UI 系统目标

UI 必须服务高频战斗和机库配装，不是营销页面。基线要求：

- 战斗信息可在竖屏上快速扫描。
- 触控目标稳定，不因文字或动态数值改变尺寸。
- 主菜单、机库、副武器、锻造、商店、升级、复活和结算使用一致的视觉语言。
- 皮肤异步加载失败时仍有 Graphics 兜底，不阻塞游戏。
- 所有节点通过 TypeScript 创建，不手工修改场景 JSON。
- 战斗配装语义固定为 1 把主武器 + 1 把副武器；UI 不提供主武器切换入口。

## 2. 代码职责

| 文件 | 职责 |
|---|---|
| `assets/scripts/RogueShooterGame.ts` | 设计尺寸、主界面、机库、副武器、锻造、战斗 HUD、全局图标预加载 |
| `assets/scripts/ui/UIHelpers.ts` | Label、Rect、Button、九宫格 Sprite、坐标转换和异步 SpriteFrame 加载 |
| `assets/scripts/ui/panels.ts` | 面板节点和 ButtonView 引用容器、显示/隐藏协调 |
| `assets/scripts/ui/UIManager.ts` | 动态弹窗生命周期和异步结果返回 |
| `assets/scripts/ui/ChoicePopup.ts` | 升级 3 选 1 和刷新 |
| `assets/scripts/ui/ShopPopup.ts` | 战斗商店 6 格和刷新/购买 |
| `assets/scripts/ui/RevivePopup.ts` | 激励视频复活和放弃 |
| `assets/scripts/ui/SettlementPopup.ts` | 死亡/撤离结算和返回机库 |
| `assets/scripts/shop/equipmentManager.ts` | 机库装备列表、装配状态、图标 key 推导和商店数据绑定 |
| `assets/scripts/pickup/pickupManager.ts` | 升级选项图标映射和 ChoicePopup 调用 |
| `assets/scripts/catalogs/offhandCatalog.ts` | 15 把副武器的 UI `iconKey` |

UI 架构是“代码生成节点 + Graphics 基础形状 + 可替换 Sprite 皮肤”。替换 PNG 不会改变节点位置、文本、交互或业务逻辑。

## 3. 设计尺寸和坐标

### 3.1 全局坐标

设计画布固定为：

```ts
DESIGN_WIDTH = 720
DESIGN_HEIGHT = 1280
```

`UIHelpers.place(node, designX, designY)` 接收以画布左上为原点的设计坐标，再转换为 Cocos 居中坐标：

```ts
node.setPosition(designX - 360, designY - 640)
```

### 3.2 面板局部坐标

`placeLocal(node, localX, localY, panelWidth, panelHeight)` 也使用面板左上为原点，但 Cocos 局部 Y 轴向上，因此转换为：

```ts
x = localX - panelWidth / 2
y = panelHeight / 2 - localY
```

新增或修改面板时不能把局部 Y 当成向上增长，否则控件会整体镜像或跑出面板。

### 3.3 安全区和触控

当前主界面约束：

```text
UI_SAFE_TOP = 56
UI_SAFE_BOTTOM = 32
MIN_TOUCH_BUTTON_HEIGHT = 48
```

- 战斗 HUD 顶栏必须位于顶部安全区之下。
- 战斗操作栏必须位于底部安全区之上。
- 主要触控按钮高度不得小于 48px。
- 固定格式的按钮、卡片、格子和 HUD 条必须显式设置宽高，动态文本不能推动布局。
- 最长中文文本必须在 720px 宽度内验证，不能靠缩放整个画布掩盖溢出。

## 4. UI 视觉层级

UI 控件通常包含以下层：

1. `Graphics` 深色底和描边：保证资源未加载时仍可见。
2. `__sliced_skin` 子节点：九宫格 Sprite 皮肤。
3. 图标 Sprite：按需显示在按钮左侧或卡片内。
4. Label：标题、正文、价格和状态。
5. 交互状态：disabled、pressed/touch scale、active tab。

`applySlicedSprite()` 在目标已有 Graphics 或 Label 时创建 `__sliced_skin` 子节点，并把它放到第 0 层，避免皮肤盖住文字。异步回调应用 SpriteFrame 时会恢复宿主节点原定宽高。

## 5. 按钮系统

### 5.1 标准皮肤

目录：`assets/resources/ui/buttons/`

| 文件 | 建议语义 | 当前调用方式 |
|---|---|---|
| `btn_blue.png` | 默认命令 | 颜色未命中特殊映射时使用 |
| `btn_green.png` | 确认、领取、开始 | 绿色语义色自动映射，部分弹窗显式使用 |
| `btn_cyan.png` | 信息、导航、商店 | 青色语义色自动映射 |
| `btn_neon.png` | 高亮选择卡/主操作 | Choice、Shop、Settlement 显式使用 |
| `btn_gold.png` | 激励视频或高级操作 | Revive 显式使用 |
| `btn_alloy.png` | 合金消费、刷新 | 橙/金色自动映射，弹窗刷新显式使用 |
| `btn_purple.png` | 稀有/副武器类操作 | 紫色自动映射 |
| `btn_red.png` | 危险/破坏性操作 | 红色自动映射 |
| `btn_disabled.png` | 禁用和空槽 | disabled 或灰色自动映射 |

所有标准按钮 PNG 均为 128×128 RGBA，`.meta` 中四边九宫格 border 均为 18px。

### 5.2 颜色到皮肤的映射

`UIHelpers.getButtonSkin()` 当前规则：

| 颜色 | 皮肤 |
|---|---|
| `#43AA8B`、`#22C55E`、`#34D399` | `btn_green` |
| `#F8961E`、`#F59E0B`、`#F97316`、`#F9C74F` | `btn_alloy` |
| `#B5179E`、`#8B5CF6` | `btn_purple` |
| `#EF4444`、`#F43F5E` | `btn_red` |
| `#64748B`、`#475569`、`#1E293B` | `btn_disabled` |
| `#22D3EE`、`#4CC9F0`、`#38BDF8` | `btn_cyan` |
| 其他颜色 | `btn_blue` |

禁用状态始终切到 `btn_disabled`。改变业务按钮颜色可能同时改变皮肤类别，不能只把 `button.color` 当成纯 tint。

### 5.3 按钮替换规则

- 保持 128×128 尺寸和四边 18px border。
- 四角、外框和高光必须位于 18px 固定区内。
- 中心 92×92 区域要能任意拉伸。
- 皮肤本身不带文字或具体图标。
- 同一状态组的外轮廓、内边距和明暗方向必须一致。
- 禁用皮肤仍需满足最低文字对比度，不能只降低到不可读。

## 6. 面板系统

目录：`assets/resources/ui/panels/`

| 文件 | 状态 | 用途 |
|---|---|---|
| `panel_bg_dark.png` | 活跃 | Choice、Shop、Revive、Settlement 等弹窗 |
| `panel_bg_lift.png` | 休眠 | 当前无源码引用 |
| `panel_bg_legendary.png` | 休眠 | 当前无源码引用 |

三张面板均为 256×256 RGBA，四边九宫格 border 为 28px。`effects/ui_panel_bg.png` 也是 256×256 / border 28 的旧面板叠层；源码存在 loader 和 `spritePanel()` 条件分支，但面板构建通常早于异步回调完成，因此 Graphics 才是该路径的可靠兜底，不能把旧叠层视为稳定主皮肤。

面板替换规则：

- 保持 256×256 和 28px 固定边。
- 中心区域不得有会随拉伸变形的噪点、徽章或方向性纹理。
- 不在面板图上烘焙标题分隔线；标题位置由代码布局。
- 透明外发光要控制在图片边界内，避免被裁切。
- `panel_bg_lift/legendary` 在代码接线前只能作为候选资源，不能视为已启用主题。

## 7. 图标系统

### 7.1 资源入口

图标目录为 `assets/resources/effects/ui_icons/`。运行时不会扫描目录自动注册，而是由 `RogueShooterGame.loadIcons()` 的硬编码 `names` 数组逐个加载：

```ts
const path = `effects/ui_icons/${name}/spriteFrame`;
```

加载成功后写入 `iconCache`，消费者通过 `getIcon(name)` 读取。

### 7.2 当前图标组

武器图标：

```text
wpn_storm_rifle        wpn_plague_sprayer     wpn_frost_beam
wpn_echo_bow           wpn_split_barrel       wpn_mirror_prism
wpn_quantum_loom       wpn_ion_lance          wpn_thorn_crossbow
wpn_rail_cannon        wpn_void_needle        wpn_meteor_launcher
wpn_orbital_drone      wpn_gravity_hammer     wpn_void_tearer
wpn_icefire_judge
```

属性图标：

```text
stat_attack_power      stat_attack_speed      stat_crit_chance
stat_crit_damage       stat_defense           stat_fire_def
stat_ice_def           stat_lightning_def     stat_lethal_chance
stat_lethal_damage     stat_shield            stat_hp
```

槽位图标：

```text
slot_helmet  slot_armor  slot_boots  slot_accessory
```

资源图标：

```text
resource_alloy  resource_core  resource_shard  resource_biomass
```

伤害类型图标：

```text
dmg_fire  dmg_ice  dmg_lightning  dmg_poison  dmg_physical  dmg_magic
```

HUD 图标：

```text
hud_icon_alloy  hud_icon_hp  hud_icon_xp  hud_icon_shield
```

普通图标为 128×128 RGBA。HUD 图标是 16×16 或 20×20，不应直接拿普通图标缩成小 HUD 图标而不做像素级重绘。

### 7.3 业务映射

主武器列表由 `equipmentManager.ts::equipIconKey()` 从 family ID 推导：

```text
family `storm-rifle` -> icon key `wpn_storm_rifle`
```

升级 3 选 1 在 `pickupManager.ts` 中显式映射，例如：

```text
power-attack       -> stat_attack_power
agility-speed      -> slot_boots
physique-hp        -> stat_hp
technique-drone    -> wpn_orbital_drone
```

副武器直接使用 `offhandCatalog.ts::iconKey`，当前大量复用通用图标。完整复用表见 [ART_REPLACEMENT_GUIDE.md](./ART_REPLACEMENT_GUIDE.md)。

### 7.4 新增图标 key 的完整步骤

1. 确定稳定 key；使用小写字母、数字和下划线，不包含空格。
2. 导出 128×128 RGBA PNG 到 `assets/resources/effects/ui_icons/<key>.png`。
3. 由 Cocos Creator 生成唯一 `.meta`，不得复制其他图标的 meta。
4. 把 `<key>` 加入 `RogueShooterGame.loadIcons()`。
5. 在 catalog 或业务映射中引用 `<key>`。
6. 资源异步加载后刷新界面；加载失败时图标节点应隐藏，文字不能因此错位。
7. 在目标界面的正常、选中、禁用和分页状态中检查。
8. 重新构建并验证包体。

当前 `frost-beamer` 和 `webmaster` 图标合同未闭合：前者存在 `wpn_frost_beam`/`wpn_frost_beamer` 命名冲突，后者缺少 `wpn_webmaster` 和 loader 项。详见 [BASELINE_GAPS.md](./BASELINE_GAPS.md)。

## 8. HUD 皮肤

当前 HUD 可替换填充条：

| 文件 | 原图尺寸 | 当前用途 |
|---|---:|---|
| `effects/hud_bar_hp.png` | 668×6 | 顶部生命填充 |
| `effects/hud_bar_xp.png` | 334×6 | 顶部经验填充 |
| `effects/hud_bar_shield.png` | 334×6 | 顶部护盾填充 |

运行节点使用自定义宽高和左侧锚点，Sprite 类型为 SLICED。三个填充图 `.meta` 当前记录的 `top/bottom/left/right` 为 `6/0/6/6`；这个配置对 6px 高图片非常敏感。修改图片或 meta 后必须检查 0%、1%、50%、99%、100% 五种宽度，防止短条时反转或圆角挤压。

`hud_bar_hp_bg/xp_bg/shield_bg` 虽被预加载，但当前可见背景主要由 Graphics 创建。只替换 `_bg` PNG 不保证画面改变。

## 9. 界面组成

### 9.1 主菜单和机库

主菜单、机库、副武器、锻造面板由 `RogueShooterGame.ts` 构建。机库固定包含：

- 1 个主武器出战槽
- 1 个副武器出战槽
- 帽子、护甲、鞋子、首饰 4 个装备槽
- 3×3 装备浏览格
- 武器、装备、全部等分类标签和详情/操作区

当前唯一主武器不能卸到 0 把；选择其他已拥有主武器时执行替换，不通过“先卸下再装备”的流程。

### 9.2 战斗 HUD

战斗 HUD 分为两条独立区域：

- 顶部：标题/波次时间、HP、XP、护盾
- 底部：主武器/副武器信息、本局数值、商店、撤离、暂停

HUD 只在战斗阶段显示，不能泄露到主菜单、机库或结算界面。新增 HUD 控件必须避免覆盖世界触控区和底部安全区。

### 9.3 动态弹窗

- `ChoicePopup`：3 个成长选项、图标、描述和合金刷新
- `ShopPopup`：6 个商品槽、单格购买/刷新和离开
- `RevivePopup`：看视频复活或放弃
- `SettlementPopup`：统计、奖励、双倍领取和返回机库

弹窗通过 `UIManager.showDynamicPopupAsync()` 管理，关闭时返回结构化结果。不能绕过 UIManager 直接遗留全屏遮罩或未解析 Promise。

## 10. 文本与排版

`UIHelpers.makeLabel()` 统一设置：

- 以 fontSize 约 1.35 倍作为默认行高
- 垂直居中
- 开启换行时按节点宽度排版

排版规则：

- 面板内标题使用紧凑字号，不使用主菜单级超大字。
- 按钮文字不得依赖负 letter-spacing 或随视口宽度缩放。
- 多行详情先压缩信息层级，再增加容器高度；不能把字体缩到不可读。
- 图标存在时要为文字预留固定左内边距；图标异步缺失时文字起点保持稳定。
- 动态价格、等级和数量要在最大位数下验证。

## 11. 活跃与休眠 UI 资源

### 11.1 活跃

- `ui/buttons/btn_blue`
- `ui/buttons/btn_green`
- `ui/buttons/btn_cyan`
- `ui/buttons/btn_neon`
- `ui/buttons/btn_gold`
- `ui/buttons/btn_alloy`
- `ui/buttons/btn_purple`
- `ui/buttons/btn_red`
- `ui/buttons/btn_disabled`
- `ui/panels/panel_bg_dark`
- `effects/ui_icons/*` 中 `loadIcons()` 列出的 46 个可寻址 key；其中 4 个 `hud_icon_*` 当前只加载、未放入 HUD
- `effects/hud_bar_hp/xp/shield`

### 11.2 休眠或未接线

- `ui/panels/panel_bg_lift`
- `ui/panels/panel_bg_legendary`
- `effects/ui_btn_normal`
- `effects/ui_btn_pressed`
- `effects/ui_panel_bg` 的可靠可见层；当前只存在异步时序依赖的旧条件分支
- `effects/hud_bar_hp_bg/xp_bg/shield_bg` 的可见 Sprite 层
- 空目录 `ui/materials/`、`ui/tabs/`

休眠资源在有明确调用点和测试前不能写入“已启用 UI 主题”清单。

## 12. 九宫格 `.meta` 和 UUID

UI 皮肤的 `.meta` 不只是导入缓存，它保存 SpriteFrame UUID 和九宫格边界。

同名换皮规则：

1. 覆盖 PNG，保留原 `.meta`。
2. 不复制其他按钮/面板的 meta。
3. 按钮保持 128×128 / border 18。
4. 面板保持 256×256 / border 28。
5. 通过 Cocos Creator 3.8.8 重新导入。
6. 在拉长、压扁和最小尺寸下检查四角。

如果必须改尺寸，使用 Cocos Sprite Editor 重新设置 border 并让编辑器更新 meta；不要只手改 JSON 中的 width、UV 或 vertices。重复 UUID 会导致错误资源被加载，甚至构建时出现不稳定结果。

## 13. UI 换肤流程

1. 在 `assets/art_source/` 制作按钮、面板或图标候选，不直接覆盖 runtime。
2. 用 720×1280 界面截图做合成预览，确认文字对比度、层级和图标识别度。
3. 按本文件尺寸导出 RGBA PNG。
4. 同名覆盖现有资源并保留 `.meta`。
5. 新 key 按第 7.4 节完成 loader 和业务映射。
6. 重新导入、构建和刷新运行页面。
7. 逐屏验证全部阶段，不只看主菜单。
8. 检查长文本、禁用态、空槽、锁定态、资源不足和最高等级状态。
9. 执行类型检查、测试、web-mobile 构建和包体检查。

## 14. UI 验证矩阵

| 界面 | 必测状态 | 主要资源 | 失败判定 |
|---|---|---|---|
| 主菜单 | 首次加载、资源慢加载、设置开关 | 按钮、旧面板叠层 | HUD 泄露、按钮无皮肤、标题遮挡 |
| 机库 | 1 主武器、满 4 装备、空槽、分页、替换主武器 | 按钮、武器/槽位图标 | 装备死锁、图标缺失、详情溢出 |
| 副武器 | 15 张卡、未合成、已装备、T1-T5 | 按钮、复用图标 | 空白面板、状态色错误、文字过小 |
| 锻造 | 资源不足、可合成、合成完成 | 资源图标、按钮 | 材料 key 直出英文、价格溢出 |
| 战斗 HUD | HP/XP/盾 0-100%、长时间、Boss 波 | HUD 条、按钮 | 顶底重叠、短条变形、菜单残留 |
| 商店 | 6 格、售罄/资源不足、刷新 | panel_bg_dark、neon/alloy/green | 卡片越界、价格遮挡、弹窗未暂停 |
| 升级 | 12 类成长、刷新、最长描述 | 图标、neon/alloy | 图标错配、三卡高度变化、描述截断 |
| 复活 | 有次数、无次数、广告失败 | dark/gold/disabled | 面板偏移、按钮不可点、遮罩残留 |
| 结算 | 死亡、撤离、长统计、双倍领取 | dark/neon/green | 第三列/奖励跑出面板、返回状态错误 |

自动验证：

```bash
npm run typecheck
npm test
python3 tools/bot/build_web_mobile_for_bot.py
npm run balance:e2e:smoke
npm run size:bytedance
```

其中 `tests/ui/uiLayoutIntegrity.test.ts` 只验证关键布局和资源调用合同，不能替代运行截图。最终视觉验收必须使用 720×1280 web-mobile 或抖音开发者工具画面。

## 15. 当前基线缺口

UI 与美术相关的未闭合项：

- 运行代码需要的 `player_survivor_*.png` 缺失，仅有 orphan `.meta`。
- 17 把主武器的场上挂载图只完整命中 5 把。
- `frost-beamer` UI key 与现有 `wpn_frost_beam` 命名不一致。
- `webmaster` 缺少 UI 图标和 loader key。
- 副武器没有专属战斗 PNG 加载合同。
- 大 Boss 当前共用通用动画，专属 Boss 资源未接线。

这些问题的负责人、影响和验收条件统一见 [BASELINE_GAPS.md](./BASELINE_GAPS.md)。修复任一缺口后，必须同步更新本文、[ART_REPLACEMENT_GUIDE.md](./ART_REPLACEMENT_GUIDE.md) 和对应测试。

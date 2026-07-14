# 星坠幸存者美术资源替换指南

> 基线日期：2026-07-13
>
> 适用工程：Cocos Creator 3.8.8 / TypeScript / 抖音小游戏 / 720×1280 竖屏
>
> 本文说明当前仓库中“文件放在哪里、代码按什么 key 加载、怎样替换才会生效”。玩法和数值以 `AGENTS.md` 及对应源码为准。

## 1. 基线原则

1. `assets/resources/` 是运行时资源区。这里的文件会进入 Cocos `resources` 资源体系，并占用包体和运行内存。
2. `assets/art_source/` 是源文件、候选图、原始生图、拆帧和预览区。只替换这里的文件不会改变游戏画面。
3. `assets/app_store/` 和 `submission/` 是上架、分享和审核素材，不是游戏内资源。
4. 同名替换优先：保持运行时文件名、尺寸和 `.meta` 不变，只替换 PNG 或 MP3 内容。
5. 新增资源不等于自动生效。还必须把新 key 接到加载表、catalog 或运行时映射中。
6. 不手工编辑 `assets/scene/Main.scene`。本项目 UI、角色、怪物、子弹和特效节点主要由代码创建。
7. 抖音小游戏包体必须小于 20MB；工程守门脚本使用 19MB 作为安全线。

当前已知的资源合同缺口统一记录在 [BASELINE_GAPS.md](./BASELINE_GAPS.md)。本文会在对应章节再次标明，但不把缺口描述成已完成能力。

## 2. 资源区总览

2026-07-11 的物理资源盘点如下：

| 目录 | 数量 | 用途 | 加载方式 |
|---|---:|---|---|
| `assets/resources/art/characters/` | 11 PNG | 玩家身体动画条带 | `resources.loadDir('art/characters')` |
| `assets/resources/art/enemies/` | 21 PNG | 普通怪、小 Boss、大 Boss 动画条带 | `resources.loadDir('art/enemies')` |
| `assets/resources/art/weapons/` | 19 PNG | 17 个主武器 family 挂载图及兼容资源 | `resources.loadDir('art/weapons')` |
| `assets/resources/art/offhand/` | 15 PNG | 15 把副武器的战斗 Sprite | `resources.loadDir('art/offhand')` |
| `assets/resources/art/pickups/` | 13 PNG | 11 类可拾取资源与 2 类宝箱 | `resources.loadDir('art/pickups')` |
| `assets/resources/art/placeholder/` | 9 PNG | 资源缺失时的静态兜底 | `resources.loadDir('art/placeholder')` |
| `assets/resources/effects/` | 56 PNG | 子弹、HUD 条、毒雾及候选特效 | 按路径单独加载 |
| `assets/resources/effects/ui_icons/` | 46 PNG | 武器、属性、槽位、资源和 HUD 图标 | `loadIcons()` 硬编码加载 |
| `assets/resources/ui/buttons/` | 9 PNG | 九宫格按钮皮肤 | `UIHelpers` 按皮肤 key 加载 |
| `assets/resources/ui/panels/` | 3 PNG | 九宫格面板皮肤 | 弹窗或 `UIHelpers` 按路径加载 |
| `assets/resources/audio/bgm/` | 3 MP3 | 机库、战斗、Boss BGM | `resources.loadDir('audio')` |
| `assets/resources/audio/sfx/` | 36 MP3 | 通用反馈和主武器射击音效 | `resources.loadDir('audio')` |

`RogueShooterGame.ts` 会整目录加载 `art/placeholder`、`art/characters`、`art/enemies`、`art/weapons`、`art/offhand` 和 `art/pickups`，`AudioManager` 会整目录加载 `audio`。不要把未采用候选图或临时音频放进这些目录。

2026-07-12 卡通 v2 批次使用 `assets/art_source/monster_prompts_cartoon_v2.json` 从零生成，统一采用鲜明平涂卡通轮廓；该批次不以旧 PNG 作为参考输入。

美术加载允许在启动超时后继续进入菜单。当前异步补图链尚未闭合：`EnemyManager.refreshEnemyArt()` 不能为原本没有 Sprite 的敌人补建组件，玩家身体、拾取物、副武器徽章和已打开 UI 也没有完整刷新。资源延迟超过 4 秒时可能长期保留 fallback，见 `GAP-ART-007`。

`art/characters` 和 `art/enemies` 中现存的同名 `.json` 是生成记录，不是 Cocos AnimationClip，也不会被 `SpriteFrame` 的 `loadDir` 调用读取。新增生成记录应归档到 `assets/art_source/`，不要继续把源侧 sidecar 扩散到 runtime 目录。

战场地表使用 `assets/resources/art/world/battlefield_tile.png`。`generate_ui_world_art.py` 先把生成候选缩放为 512×512，再通过四象限镜像合成为 1024×1024 周期贴图；成品左右边和上下边逐像素闭合。运行时以 600×600 普通重复 Sprite 覆盖 1800×2400 战场，加载失败时保留程序化地表作为降级路径。生成脚本不得创建或改写 `.meta`；新增资源由 Cocos AssetDB 导入并分配 UUID。

## 3. 通用图片规范

### 3.1 文件格式

- 游戏内角色、怪物、武器、UI 图标和 VFX 使用 8-bit RGBA PNG。
- 必须有真实透明通道，不能把灰白棋盘格、纯色底、阴影地面或生图网格烘焙进图片。
- 图标和 VFX 四边保留透明安全边距，主体不能贴边。
- 不在图片中烘焙会随语言变化的文字。
- 不提交 PSD、Aseprite 工程、GIF、原始大图到 `assets/resources/`。
- 缩放后的最终尺寸以运行时合同为准，不用超大图依赖 Cocos 缩小显示。

### 3.2 命名和资源 key

Cocos `resources` 路径不带扩展名；图片以 SpriteFrame 加载时要加 `/spriteFrame`：

```ts
resources.load('effects/ui_icons/stat_hp/spriteFrame', SpriteFrame, callback);
resources.load('ui/buttons/btn_green/spriteFrame', SpriteFrame, callback);
```

文件名中的连字符和下划线不能混用。catalog ID 通常使用连字符，资源文件通常使用下划线；转换规则必须由代码明确实现。

### 3.3 透明边缘检查

正式替换前至少检查：

```bash
file assets/resources/effects/ui_icons/stat_hp.png
file assets/resources/effects/vfx_bullet_smg.png
```

输出应包含 `RGBA`。还需要在深色和浅色背景上各看一次，确认没有白边、黑边或残留棋盘格。

## 4. UI 按钮和面板

UI 资源合同的完整说明见 [UI_SYSTEM.md](./UI_SYSTEM.md)。美术侧必须遵守以下尺寸：

| 类型 | 目录 | 尺寸 | 九宫格边界 |
|---|---|---:|---:|
| 按钮皮肤 | `assets/resources/ui/buttons/*.png` | 128×128 | 上下左右各 18px |
| 面板皮肤 | `assets/resources/ui/panels/*.png` | 256×256 | 上下左右各 28px |
| 旧面板叠层 | `assets/resources/effects/ui_panel_bg.png` | 256×256 | 上下左右各 28px |

四角、描边、铆钉等不可拉伸内容必须完全位于固定边界内。中心区必须可以水平和垂直拉伸，不能放文字、徽章、斜线或固定比例纹样。

当前按钮皮肤：

```text
btn_blue       btn_green      btn_cyan
btn_neon       btn_gold       btn_alloy
btn_purple     btn_red        btn_disabled
```

当前面板皮肤：

```text
panel_bg_dark  panel_bg_lift  panel_bg_legendary
```

其中 `panel_bg_dark` 已被弹窗使用；`panel_bg_lift` 和 `panel_bg_legendary` 当前没有源码引用，替换后不会自动出现在现有界面。

## 5. UI 图标

### 5.1 目录与尺寸

- 目录：`assets/resources/effects/ui_icons/`
- 普通图标：128×128 RGBA
- HUD 小图标：`hud_icon_hp/xp/shield` 为 16×16，`hud_icon_alloy` 为 20×20
- 运行时 key：文件名去掉 `.png`
- 完整加载路径：`effects/ui_icons/<key>/spriteFrame`

图标分组：

| 前缀 | 数量 | 示例 |
|---|---:|---|
| `wpn_` | 16 | `wpn_storm_rifle` |
| `stat_` | 12 | `stat_attack_power` |
| `dmg_` | 6 | `dmg_fire` |
| `resource_` | 4 | `resource_alloy` |
| `slot_` | 4 | `slot_armor` |
| `hud_icon_` | 4 | `hud_icon_hp` |

### 5.2 新增图标 key

新增图标不能只放文件，必须完成以下步骤：

1. 把 128×128 RGBA PNG 放入 `assets/resources/effects/ui_icons/`。
2. 通过 Cocos Creator 3.8.8 导入，或为新文件生成合法且唯一的 `.meta`。
3. 把 key 加入 `RogueShooterGame.ts::loadIcons()` 的 `names` 数组。
4. 在实际消费者中引用该 key，例如 `offhandCatalog.ts::iconKey`、`equipmentManager.ts::equipIconKey()` 或 `pickupManager.ts` 的升级图标映射。
5. 确认 `getIcon(key)` 返回非空，并在资源异步加载完成后刷新对应界面。
6. 重新构建 web-mobile，不能只依赖旧 `library/` 缓存。

当前缺口：`frost-beamer` 推导出的正式 key 与现有 `wpn_frost_beam` 不一致；`webmaster` 缺少 `wpn_webmaster`，且未加入加载表。详见 [BASELINE_GAPS.md](./BASELINE_GAPS.md)。

## 6. 玩家角色美术

### 6.1 当前物理资源

仓库中实际存在的方向动画是：

```text
player_idle.png
player_run_south.png
player_run_south_east.png
player_run_east.png
player_run_north_east.png
player_run_north.png
player_run_north_west.png
player_run_west.png
player_run_south_west.png
```

每张均为 `480×80 RGBA`，横向 6 帧，每帧 `80×80`。另有：

```text
player_body_no_weapon_idle.png
player_body_no_weapon_run_south.png
```

这两张也是 `480×80`、6 帧、单帧 80×80。

### 6.2 当前运行时合同

运行代码当前使用三条正面身体动画：

```text
player_body_no_weapon_idle       6×80×80
player_body_no_weapon_run_south  6×80×80
player_run_east                  6×80×80
```

角色始终保持正面。上下移动使用同步正面跑步，向右移动使用正面横向重心动画，向左移动镜像同一条带，从而保持角色身份一致并区分左右方向。

角色替换直接覆盖上述三个文件即可生效；同名 `.meta` 必须保留。

### 6.3 角色制作要求

- 身体图不包含主武器、副武器、枪口火焰或地面阴影。
- 六帧角色身份、比例、护甲颜色和轮廓必须一致。
- 每格脚底基线一致，避免跑动时上下跳动。
- 四肢不能跨出当前格，也不能串入相邻帧。
- 默认面向 south 的构图必须在 96px 左右运行时显示尺寸下清楚可读。
- 武器由独立节点旋转叠加，身体手部应留出持枪空间。

运行时只切换正面上下跑步和正面横向跑步，并以镜像区分左右；武器仍由独立节点旋转叠加。

## 7. 怪物动画条带

动画合同定义在 `assets/scripts/enemy/enemyConstants.ts::ENEMY_STRIP_META`。

| 家族/资源 | 运行文件 | 帧数 | 单帧 | 条带尺寸 | FPS |
|---|---|---:|---:|---:|---:|
| 碎壳虫 | `enemy_mite_walk.png` | 6 | 64×64 | 384×64 | 8 |
| 自爆虫 | `enemy_bomber_walk.png` | 6 | 64×64 | 384×64 | 8 |
| 蜂群 | `enemy_swarm_walk.png` | 6 | 64×64 | 384×64 | 8 |
| 疾行体 | `enemy_runner_walk.png` | 6 | 80×80 | 480×80 | 10 |
| 重甲块 | `enemy_brute_walk.png` | 6 | 80×80 | 480×80 | 6 |
| 裂变囊 | `enemy_splitter_idle.png` | 6 | 80×80 | 480×80 | 7 |
| 追踪眼 | `enemy_seeker_walk.png` | 6 | 80×80 | 480×80 | 8 |
| 灵能体 | `enemy_aura_idle.png` | 6 | 80×80 | 480×80 | 8 |
| 磁暴卫士 | `enemy_warden_idle.png` | 6 | 96×96 | 576×96 | 8 |
| 信标 | `enemy_beacon_idle.png` | 6 | 96×96 | 576×96 | 6 |
| 通用大 Boss | `enemy_boss_idle.png` | 8 | 224×224 | 1792×224 | 8 |
| 狂暴重甲块 | `enemy_brute_prime_idle.png` | 6 | 128×128 | 768×128 | 6 |
| 电弧灵能体 | `enemy_aura_arc_idle.png` | 6 | 128×128 | 768×128 | 8 |
| 自爆母体 | `enemy_bomber_mother_idle.png` | 6 | 128×128 | 768×128 | 7 |
| 迅捷分裂体 | `enemy_splitter_swift_idle.png` | 6 | 128×128 | 768×128 | 10 |
| 再生巨兽 | `enemy_warden_regen_idle.png` | 6 | 128×128 | 768×128 | 6 |
| 虚空巨像 | `enemy_void_colossus_idle.png` | 8 | 224×224 | 1792×224 | 8 |
| 噬能蠕虫 | `enemy_energy_worm_idle.png` | 8 | 224×224 | 1792×224 | 10 |
| 冰霜女皇 | `enemy_frost_queen_idle.png` | 8 | 224×224 | 1792×224 | 8 |
| 狱炎领主 | `enemy_inferno_lord_idle.png` | 8 | 224×224 | 1792×224 | 7 |
| 虚空织网者 | `enemy_void_weaver_idle.png` | 8 | 224×224 | 1792×224 | 8 |

制作和替换规则：

1. 图片宽度必须严格等于 `帧数 × 单帧宽度`，高度必须等于单帧高度。
2. 条带中不能有间隔、描边分隔、标签或帧号。
3. 可见主体在每格内保持统一占比和中心，不因动作切换突然放大缩小。
4. 碰撞半径由代码和 catalog 决定，替换图片不会自动改变碰撞体。
5. 精英和词缀怪通常复用基础家族图，颜色、标记和数值由代码处理。
6. 当前 5 个大 Boss 与 5 个小 Boss 均按 `spec.family` 优先命中专属条带；通用 `enemy_boss_idle.png` 只保留为未知 Boss family 的回退。
7. 普通怪的 11 档变体复用家族主体条带，运行时通过原色主体外的彩色环和索引冠点保持可辨识，不再用乘色覆盖 PNG。
8. 生图条带必须先经过 `monster_sprite_pipeline.py` 的背景连通域清理与投影谷值切帧；找不到干净帧间空隙时工具会直接失败，不得发布被等宽切断的条带。
9. 基础怪统一使用朝屏幕下方的正面动画；左右轮廓保持平衡，动画只做同步压缩、开合、悬浮或中心脉冲，不使用侧身、三分之四侧向、单侧倾斜或改变朝向的帧。
10. Sprite 怪物常态使用白色乘色以保留 PNG 原始色板；变体、精英和状态颜色只进入外圈/标记层。命中反馈使用短暂暖白色与缩放脉冲，不得用常态 tint 覆盖原画颜色。

要增加专属 Boss 图，必须同时扩展 Boss ID/family 到动画 meta 的映射，不能只新增 PNG。

## 8. 主武器的四套资源

每个主武器至少涉及四个相互独立的表现层：

1. 机库和列表图标：`effects/ui_icons/wpn_<family>.png`
2. 玩家身边挂载图：`art/weapons/weapon_<family>_icon.png`
3. 子弹贴图 primitive：`effects/vfx_bullet_<attackStyle>.png`
4. 射击音效：`audio/sfx/sfx_shoot_<style>.mp3`

| 主武器 family | UI key | 场上挂载文件 | VFX | SFX |
|---|---|---|---|---|
| `storm-rifle` | `wpn_storm_rifle` | `weapon_storm_rifle_icon.png` | `vfx_bullet_smg.png` | `sfx_shoot_smg.mp3` |
| `plague-sprayer` | `wpn_plague_sprayer` | `weapon_plague_sprayer_icon.png` | `vfx_bullet_spray.png` | `sfx_shoot_spray.mp3` |
| `frost-beamer` | `wpn_frost_beamer` | `weapon_frost_beamer_icon.png` | `vfx_bullet_frost.png` | `sfx_shoot_frost.mp3` |
| `echo-bow` | `wpn_echo_bow` | `weapon_echo_bow_icon.png` | `vfx_bullet_echo.png` | `sfx_shoot_echo.mp3` |
| `split-barrel` | `wpn_split_barrel` | `weapon_split_barrel_icon.png` | `vfx_bullet_scatter.png` | `sfx_shoot_scatter.mp3` |
| `mirror-prism` | `wpn_mirror_prism` | `weapon_mirror_prism_icon.png` | `vfx_bullet_prism.png` | `sfx_shoot_prism.mp3` |
| `quantum-loom` | `wpn_quantum_loom` | `weapon_quantum_loom_icon.png` | `vfx_bullet_quantum.png` | `sfx_shoot_quantum.mp3` |
| `ion-lance` | `wpn_ion_lance` | `weapon_ion_lance_icon.png` | `vfx_bullet_ion.png` | `sfx_shoot_ion.mp3` |
| `thorn-crossbow` | `wpn_thorn_crossbow` | `weapon_thorn_crossbow_icon.png` | `vfx_bullet_thorn.png` | `sfx_shoot_thorn.mp3` |
| `rail-cannon` | `wpn_rail_cannon` | `weapon_rail_cannon_icon.png` | `vfx_bullet_rail.png` | `sfx_shoot_rail_cannon.mp3` |
| `void-needle` | `wpn_void_needle` | `weapon_void_needle_icon.png` | `vfx_bullet_void_needle.png` | `sfx_shoot_void_needle.mp3` |
| `meteor-launcher` | `wpn_meteor_launcher` | `weapon_meteor_launcher_icon.png` | `vfx_bullet_meteor.png` | `sfx_shoot_meteor_launcher.mp3` |
| `orbital-drone` | `wpn_orbital_drone` | `weapon_orbital_drone_icon.png` | `vfx_bullet_drone.png` | `sfx_shoot_orbital_drone.mp3` |
| `gravity-hammer` | `wpn_gravity_hammer` | `weapon_gravity_hammer_icon.png` | `vfx_bullet_gravity.png` | `sfx_shoot_gravity_hammer.mp3` |
| `void-tearer` | `wpn_void_tearer` | `weapon_void_tearer_icon.png` | `vfx_bullet_void_tear.png` | `sfx_shoot_void_tear.mp3` |
| `icefire-judge` | `wpn_icefire_judge` | `weapon_icefire_judge_icon.png` | `vfx_bullet_icefire.png` | `sfx_shoot_icefire.mp3` |
| `webmaster` | `wpn_webmaster` | `weapon_webmaster_icon.png` | `vfx_bullet_web.png` | `sfx_shoot_web.mp3` |

17 个 family 当前均具有推导 key 对应的 UI 图标和场上挂载 PNG；`wpn_frost_beam` 仅作为旧 key 兼容保留。资源合同由 `tests/visual/itemArtWiring.test.ts` 全量检查。

挂载图建议使用 128×128 RGBA，枪口指向图片本地 +X（右侧），握把靠近中心，四边保留透明区。代码会围绕玩家旋转节点并在左右方向翻转 Y 轴。

瘟疫喷射器主要通过扇形毒雾和 `poison_mist_particle.png` 表现，不走普通实体子弹路径；替换 `vfx_bullet_spray.png` 不能代表完整喷雾效果已经替换。

主武器 VFX 的机制、Graphics 叠层和音效细节以 [weapon_attack_effects.md](./weapon_attack_effects.md) 为准。

## 9. 副武器美术合同

15 把副武器各自使用 `offhand_<id>` key。UI PNG 位于 `effects/ui_icons/`，战斗 Sprite 位于 `art/offhand/`；`offhandCatalog.ts::iconKey` 和 `loadIcons()` 使用同一组 catalog key。`OffhandManager` 在玩家身边创建当前装备副武器的识别 Sprite，资源尚未导入或缺失时绘制 Graphics 标记作为降级路径；原机制 Graphics/VFX 继续独立运行。该接线不改变 15 种机制身份、数值或判定。

新增或替换副武器图片时必须保持两处同名 PNG，并让 Cocos AssetDB 生成或更新 `.meta`。战斗图建议为 128×128 RGBA，主体在 34px 运行尺寸下仍需可辨识。

## 9.1 装备、本局道具与拾取物

- 44 个 gear blueprint 使用 `gear_<blueprint_id>`，五个品质实例共享 blueprint 图标。
- 65 个 RUN_ITEM blueprint 使用 `run_<blueprint_id>`，T1-T5 实例共享 blueprint 图标；运行时通过数字 tier 后缀反解 key。
- 11 类资源与普通/稀有宝箱使用 `art/pickups/pickup_<type>.png`。XP 由击杀直接结算，不存在 `pickup_xp.png`。
- `tools/generate_item_art.py` 只安装 PNG，不创建 `.meta` 或 UUID；新增资源元数据必须由 Cocos AssetDB 生成。

## 10. 子弹、VFX 与休眠资源

### 10.1 当前活跃资源

- `effects/vfx_bullet_*.png`：18 张 128×128 RGBA 子弹 primitive
- `effects/poison_mist_particle.png`：96×96 RGBA 毒雾粒子
- `effects/hud_bar_hp.png`
- `effects/hud_bar_xp.png`
- `effects/hud_bar_shield.png`
- `effects/ui_icons/*.png`
- `ui/buttons/*.png`
- `ui/panels/panel_bg_dark.png`

子弹节点会按飞行角度旋转，所以 primitive 的前进方向应朝图片右侧。主体居中、透明边缘充足，不要画满 128px。对应 SpriteFrame 成功加载后，弹丸节点会清空并关闭自身的 `Graphics` fallback，只渲染 Sprite；资源尚未加载或缺失时才恢复程序化弹丸。枪口和命中反馈仍由独立 VFX 池绘制，因此替换 PNG 后必须同时检查弹体可读性、枪口和命中效果。

### 10.2 当前休眠或未接线资源

以下资源存在，但当前不能保证替换后在现有画面出现：

| 资源 | 原因 |
|---|---|
| `effects/bullet_default/disc/meteor/pulse/rail/shotgun.png` | 已由 `vfx_bullet_*` 新映射替代 |
| `effects/ground_mark_*.png` | `EnemyManager.loadGroundMarkTextures()` 当前为空 |
| `effects/vfx_exp_*` | 当前没有资源加载引用 |
| `effects/vfx_burn_ground.png` | 当前没有资源加载引用 |
| `effects/ui_btn_normal/pressed.png` | 仅预加载字段，现有按钮使用 `ui/buttons/*` |
| `effects/ui_panel_bg.png` | 有旧 loader 和 `spritePanel()` 条件分支，但面板构建早于异步回调完成，不能作为可靠主皮肤替换点 |
| `effects/hud_bar_*_bg.png` | 当前 HUD 背景主要由 Graphics 绘制 |
| `ui/panels/panel_bg_lift/legendary.png` | 当前无源码引用 |
| `ui/materials/`、`ui/tabs/` | 目录为空 |

休眠资源要启用时，先新增明确的 loader、使用点和测试，再更新本文的状态。

## 11. 音频替换

### 11.1 运行合同

- 目录：`assets/resources/audio/bgm/`、`assets/resources/audio/sfx/`
- 代码按文件 basename 建 Map；扩展名不属于播放 key。
- BGM 以 `bgm_` 开头，SFX 以 `sfx_` 开头。
- 不同子目录中也不能出现相同 basename，否则加载 Map 会发生覆盖。
- `assets/resources/audio/` 下已有文件名属于硬编码合同，不能随意改名。

当前音频均为 MP3、44.1kHz、单声道。BGM 当前长度：机库 24 秒，战斗和 Boss 各 32 秒；码率约 64kbps。SFX 当前约 0.07-0.9 秒，主要为 56-80kbps。

### 11.2 替换要求

- BGM 建议 20-40 秒、64-96kbps、无爆点的无缝循环。
- 高频射击音效必须短，尾音不能长期叠加。
- 保持原文件名和 `.meta`，避免修改 `WEAPON_SHOOT_SFX`。
- 替换后要在首次用户触摸之后验证 BGM 解锁。
- 连续射击至少听 30 秒，确认没有削波、爆音、相位抵消或音量失控。
- `sfx_shoot_spray` 需要连续湿喷感，不能退化成短点击声。

`tools/generate_audio_assets.py` 生成的是程序化占位音。它会覆盖同名运行文件，只能在明确需要恢复占位音时使用。

## 12. `.meta`、UUID 与 Cocos 导入

### 12.1 同名替换

同名、同尺寸替换的标准做法：

1. 只覆盖 PNG 或 MP3 内容。
2. 保留旁边原有 `.meta`。
3. 不修改 `.meta` 中的根 UUID。
4. 不复制另一资源的 `.meta`。
5. 让 Cocos Creator 3.8.8 重新导入，再构建验证。

图片 meta 中包含根 UUID，以及通常名为 `@6c48a` 的 texture 子资源和 `@f9941` 的 SpriteFrame 子资源。代码加载 `/spriteFrame`，因此 importer 类型、SpriteFrame 子资源和 `userData.type='sprite-frame'` 必须有效。

### 12.2 尺寸变化

如果改变图片尺寸：

- 必须重新导入，让 Cocos 更新 width、height、trim、UV 和 vertices。
- 九宫格图还要重新确认 border 数值。
- 不手工只改 meta 中的 `rawWidth/rawHeight`。
- 动画条带还必须同步代码中的 frames、cellSize 和 fps 合同。

### 12.3 新增资源

- 优先在 Cocos Creator 资产面板中导入，让编辑器生成唯一 UUID。
- `python3 tools/generate_cocos_art_meta.py` 只适用于 `art/characters`、`art/enemies`、`art/weapons` 中缺失 `.meta` 的新 PNG。
- 该脚本不会更新已有 meta，也不会配置 UI 九宫格。
- 不把另一个文件的 `.meta` 复制后改名，因为那会产生重复 UUID。

当前存在 `player_survivor_*.png.meta` 对应源 PNG 缺失，以及 `assets/resources/ui/icons.meta` 对应目录缺失。它们属于基线卫生缺口，不应作为新增资源模板。

## 13. 源素材和工具链

### 13.1 可用工具

| 工具 | 状态 | 用法说明 |
|---|---|---|
| `tools/monster_sprite_pipeline.py` | 可用但会写运行资源 | 按 `monster_prompts.json` 生成/切片怪物、角色或武器；先审 GIF 和拆帧 |
| `tools/generate_cocos_art_meta.py` | 可用 | 只补 art 目录中缺失的 PNG meta |
| `tools/cleanup_ui_icon_alpha.py` | 可用 | 先用 `--preview-dir` 审结果，再决定是否 `--write` |
| `tools/optimize_runtime_assets.py` | 可用 | 对角色、怪物、武器 PNG 做无损重编码 |
| `tools/generate_visual_upgrade_candidates.py` | 可用、非破坏式 | 输出到 `assets/art_source/visual_upgrade_candidates/` |
| `tools/generate_audio_assets.py` | 有条件使用 | 会重生成占位音频并覆盖同名资源 |

`monster_sprite_pipeline.py` 虽然名称是 monster，但会读取 `monster_prompts.json` 的 `output_dir`，因此也能处理 `characters` 和 `weapons` 条目。它会直接写入 `assets/resources/art/<output_dir>/`，不能跳过人工审核。

### 13.2 当前失效或过期工具

以下入口与当前物理资源合同不一致，修复前不得作为基线命令：

| 工具/文档 | 问题 |
|---|---|
| `assets/resources/art/characters/README.md` | 仍声明 160px `player_survivor_*`，与现有 80px 条带冲突 |
| `tools/normalize_sprite_sheets.py` | 绑定缺失的 160px 角色文件和旧敌人尺寸 |
| `tools/clean_embedded_grid_background.py` | 绑定缺失的 160px 角色文件和旧敌人帧数/尺寸 |
| `tools/generate_ui_assets.py` | 读取缺失的 `player_survivor_*`，Boss cell 还按 192 而不是 224 |
| `tools/player_sprite_pipeline.py` | 输出 `player_body_no_weapon_*`，当前运行代码不加载这些 key |
| `tools/generate_placeholder_art.py` | 会生成当前未接线的额外 placeholder 资源 |
| `tools/batch_generate_sprites.py` | 硬编码本机路径、批量覆盖运行资源，不适合作为常规入口 |
| 所有文件名带 ` 2`/` 3` 的副本 | macOS 冲突副本，不是权威脚本 |

## 14. 标准替换流程

### 14.1 只替换现有资源

1. 在 `assets/art_source/` 保存源文件和候选版本。
2. 按运行时尺寸导出 RGBA PNG 或符合音频规范的 MP3。
3. 备查文件名、尺寸、透明通道和对应 loader key。
4. 覆盖 `assets/resources/` 中的同名文件，不覆盖 `.meta`。
5. 用 Cocos Creator 3.8.8 重新导入。
6. 执行类型检查、测试和 web-mobile 构建。
7. 在 720×1280 运行画面验证实际生效，而不是只看文件浏览器。
8. 检查抖音包体。
9. 运行资源与 `.meta` 同组提交；源素材和上架素材分组提交。

### 14.2 新增资源或 key

1. 先定义唯一文件名和运行 key。
2. 把资源放入正确 runtime 目录并生成唯一 `.meta`。
3. 更新加载表：`loadIcons()`、`ENEMY_STRIP_META`、`BULLET_STYLES`、音效表或新增的专用 loader。
4. 更新 catalog 对资源 key 的引用。
5. 添加缺失资源、alpha、唯一映射或尺寸合同测试。
6. 完整构建并做运行截图验证。
7. 更新本文的活跃资源表和 [BASELINE_GAPS.md](./BASELINE_GAPS.md)。

## 15. 验证矩阵

| 改动类型 | 静态检查 | 自动测试 | 运行时检查 | 包体检查 |
|---|---|---|---|---|
| UI 按钮/面板 | PNG 尺寸、RGBA、九宫格 border | `npm test` | 全部弹窗、长短按钮、禁用态 | `npm run size:bytedance` |
| UI 图标 | 128×128、alpha、key 在 `loadIcons` | `npm test` | 机库、升级、商店、副武器、锻造 | 同上 |
| 玩家条带 | `width=frames×cell`、脚底稳定 | `npm test` | 静止、移动、武器前后层和翻转 | 同上 |
| 怪物条带 | 尺寸表、alpha、meta | `npm test` | 普通、精英、小 Boss、大 Boss | 同上 |
| 主武器挂载图 | 文件名与 family 一致 | `npm test` | 17 把逐一装备观察 | 同上 |
| 子弹 VFX | 128×128 RGBA、`hasAlpha=true` | `npx --yes tsx tests/visual/weaponAttackPresentation.test.ts` | 17 把逐一射击、命中、穿透 | 同上 |
| 毒雾 | RGBA、软边 | `npx --yes tsx tests/visual/poisonSprayVfx.test.ts` | 连续喷射、遮挡和性能 | 同上 |
| 音频 | basename、格式、时长 | `npm test` | 首次触摸解锁、连续射击、BGM 循环 | 同上 |

标准命令：

```bash
npm run typecheck
npm test
npx --yes tsx tests/visual/weaponAttackPresentation.test.ts
npx --yes tsx tests/visual/poisonSprayVfx.test.ts
python3 tools/bot/build_web_mobile_for_bot.py
npm run balance:e2e:smoke
npm run size:bytedance
```

web-mobile 产物还要确认 `build/web-mobile/assets/main/index.js` 大于 100KB，并包含 `__starfallGame` 和 `__starfallBulkTick`。如果源码或资源修改后构建异常快且产物没变化，按 `AGENTS.md` 的缓存处理流程清理 `temp/` 后重建；不要删除整个 `library/`。

## 16. 常见失败模式

- 只替换 `assets/art_source`，运行画面不变。
- 新增 PNG 但没有加入 loader 或 catalog，运行时永远拿不到。
- 把 `frost-beamer` 写成 `frost_beam` 或混用连字符和下划线。
- 复制其他资源 `.meta`，造成 UUID 重复。
- 改了九宫格 PNG 却丢失 border，按钮拉伸后四角变形。
- 动画条带宽度不是 `frames×cellSize`，后几帧被切空或串帧。
- 角色身体内画了武器，与运行时挂载图重叠。
- 子弹贴图方向不是向右，旋转后视觉方向错误。
- 替换通用副武器 iconKey，意外改变多个系统的图标。
- 把候选大图放进 `assets/resources`，包体和纹理内存无故增加。
- 使用带 ` 2`、` 3` 的冲突副本，Cocos 导入出多个同名脚本或资源。
- 只看旧 Cocos 缓存判断替换成功，没有重建和运行时截图。

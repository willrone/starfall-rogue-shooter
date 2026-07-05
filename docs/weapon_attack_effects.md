# Weapon Attack Effects · 主武器攻击视觉/音效 v1.4

> Last updated: 2026-07-05  
> Source of truth: `assets/scripts/catalogs/weaponCatalog.ts` + `assets/scripts/projectile/projectileManager.ts` + `assets/scripts/audio/audioManager.ts`

## 目标

17 把主武器必须做到两件事：

1. **专属攻击视觉**：每个 weapon family 都有独立 `WeaponAttackStyle`，不是只换颜色。
2. **专属射击音效**：每个 weapon family 都映射到独立 `sfx_shoot_*` 音频文件，不再多把武器共用同一个射击声。

约束：

- 抖音小游戏包体紧张，所以攻击视觉优先用 `Graphics` 程序化 VFX + 小型透明 sprite primitive，不新增大贴图。
- 200+ 怪移动端场景下不能制造节点风暴：继续复用 bullet / muzzle flash / hit spark / poison spray 对象池。
- 视觉和音效都要服务机制：形状、轮廓、命中反馈、声音质感要和 weapon mechanic 对上。

## 17 把主武器视觉 + 音效映射

| Weapon | Mechanic | AttackStyle | 专属射击 SFX | 核心效果 |
|---|---|---|---|---|
| 冲锋枪 `storm-rifle` | `overheat` | `smg` | `sfx_shoot_smg` | 短小橙色高速曳光弹；短促高频“哒哒哒” |
| 瘟疫喷射器 `plague-sprayer` | `poison` | `spray` | `sfx_shoot_spray` | 扇形绿色毒雾；不发实体多弹，直接范围检测；持续喷雾嘶声 |
| 霜束发射器 `frost-beamer` | `slow` | `frost` | `sfx_shoot_frost` | 冰晶长束、两侧冰棱；晶体冷冻音 |
| 回声弓 `echo-bow` | `pierce_stacks` | `echo` | `sfx_shoot_echo` | 箭矢 + 两层回声残响环；带二段回响的弓弦声 |
| 裂变枪管 `split-barrel` | `multishot_3` | `scatter` | `sfx_shoot_scatter` | 三枚热粉霰弹丸；粗短散射爆响 |
| 镜像棱镜 `mirror-prism` | `radial_5` | `prism` | `sfx_shoot_prism` | 菱形核心 + 五向折射光针；亮晶体分光声 |
| 量子织机 `quantum-loom` | `split` | `quantum` | `sfx_shoot_quantum` | 青色量子核 + 双卫星；上扬量子啁啾 |
| 离子长枪 `ion-lance` | `straight` | `ion` | `sfx_shoot_ion` | 绿色长枪光矛；电离长枪释放声 |
| 荆棘连弩 `thorn-crossbow` | `ricochet` | `thorn` | `sfx_shoot_thorn` | 带倒刺弩矢；弩弦+倒刺弹出声 |
| 磁轨炮 `rail-cannon` | `pierce_bonus` | `rail` | `sfx_shoot_rail_cannon` | 细长磁轨光束 + 白色内核；重磁轨裂空声 |
| 虚空针 `void-needle` | `crit_master` | `void_needle` | `sfx_shoot_void_needle` | 暗紫细针 + 黑洞边缘；尖锐虚空刺音 |
| 流星发射器 `meteor-launcher` | `aoe_burn` | `meteor` | `sfx_shoot_meteor_launcher` | 大火球 + 尾焰；低频火球爆发声 |
| 轨道无人机 `orbital-drone` | `drone_charge` | `drone` | `sfx_shoot_orbital_drone` | 电弧球 + 小翼片；无人机电子啁啾 |
| 重力锤 `gravity-hammer` | `knockback` | `gravity` | `sfx_shoot_gravity_hammer` | 暗物质核心 + 冲击环；低频重锤冲击 |
| 虚空撕裂者 `void-tearer` | `void_tearer` | `void_tear` | `sfx_shoot_void_tear` | 青色虚空裂刃；空间撕裂滑音 |
| 冰狱审判 `icefire-judge` | `icefire_judge` | `icefire` | `sfx_shoot_icefire` | 半蓝半橙双色弹；冰晶+火焰双层声 |
| 织网支配者 `webmaster` | `webmaster_lifesteal` | `web` | `sfx_shoot_web` | 金色蛛网链束；黏性蛛丝弹射声 |

## 实现位置

| 内容 | 文件 |
|---|---|
| `WeaponAttackStyle` 类型扩展 | `assets/scripts/core/types.ts` |
| `familyId → attackStyle` 映射 | `assets/scripts/catalogs/weaponCatalog.ts` |
| 子弹贴图 primitive 映射 | `projectileManager.ts::BULLET_STYLES` → `assets/resources/effects/vfx_bullet_*.png` |
| 子弹轮廓绘制 | `assets/scripts/projectile/projectileManager.ts::drawBullet()` |
| 子弹半径 / 生命周期 / accent 色 | `projectileManager.ts::getWeaponBulletRadius()` / `getWeaponBulletLife()` / `getWeaponAccentColor()` |
| 贴图尺寸差异 | `projectileManager.ts::getBulletSpriteSizeMultiplier()` |
| 瘟疫喷射器非子弹路径 | `RogueShooterGame.ts::fireAt()` → `projectileManager.ts::spawnSprayCone()` |
| 瘟疫毒雾实际渲染层 | `projectileManager.ts::PoisonSprayScreenOverlay`（Canvas-level overlay；不依赖 World 子节点 Graphics） |
| 枪口闪光 | `projectileManager.ts::spawnMuzzleFlash()` + `drawMuzzleSignature()` |
| 命中火花和屏幕震动 | `projectileManager.ts::spawnBulletHitSpark()` + `drawHitSparkSignature()` / `updateBullets()` |
| 射击音效总表 | `assets/scripts/audio/audioManager.ts::WEAPON_SHOOT_SFX` |
| 程序化音频生成 | `tools/generate_audio_assets.py` |
| 音频资产 | `assets/resources/audio/sfx/sfx_shoot_*.mp3` |
| 回归测试 | `tests/catalogs/weaponCatalog.test.ts` + `tests/visual/weaponAttackPresentation.test.ts` |

## 验证规则

- `tests/catalogs/weaponCatalog.test.ts`：17 个 weapon family 必须映射到 17 个不同 attack style。
- `tests/visual/weaponAttackPresentation.test.ts`：
  - 每把主武器不能掉到 fallback `rifle`。
  - 每个 style 必须有 `drawBullet()` case。
  - 每个 style 必须映射到 `vfx_bullet_*` 透明 PNG，PNG 和 `.meta` 都存在且 `hasAlpha=true`。
  - 17 把主武器的 `vfx_bullet_*` 资源必须一武器一张，不能复用。
  - 必须保留 `drawMuzzleSignature()` / `drawHitSparkSignature()`，保证不仅弹体，开火和命中也有每把武器自己的反馈。
  - `BulletArt` 必须直接创建空 Sprite 节点，不能再依赖 `art/placeholder/bullet_plasma`；替换 `assets/resources/effects/vfx_bullet_*.png` 后预览才会真实生效。
  - 瘟疫喷射器必须走 `spawnSprayCone()`，因为它不创建子弹。
  - 17 把主武器必须映射到 17 个不同 `sfx_shoot_*` 文件。
  - 每个专属音效文件和 `.meta` 都必须存在。

## v1.2 运行时资源路径修复（2026-07-05）

这次修的是「换了武器攻击效果资源，但 Cocos 预览看起来没生效」的根因：

1. 旧 `BulletArt` 是通过 `ctx.addSpriteChild(..., 'bullet_plasma')` 创建的，依赖 `art/placeholder` 预加载。如果 placeholder 没准备好，`bullet.sprite` 会是 `null`，后续 `resources/effects/bullet_*.png` 即使加载成功也没有 Sprite 节点可显示。
2. 旧 sprite 每帧被 `bullet.accent` 单色 tint，导致替换 PNG 后颜色/细节被抹平，看起来像没变。
3. 旧 `BULLET_STYLES` 多个 style 共用 `bullet_default|bullet_rail|bullet_disc...`，资源层区分度太低，真正差异主要来自 `Graphics`。

改后：

- `acquireBullet()` 直接创建空 `BulletArt` Sprite 节点，不再依赖 `bullet_plasma`。
- `BULLET_STYLES` 指向 18 张透明 primitive：`vfx_bullet_smg/frost/echo/scatter/prism/.../web.png`。
- `drawBullet()` 对 sprite 使用白色 tint（保留 PNG 自带颜色/alpha），让替换资源能肉眼生效。
- `split` 机制生成的子弹也调用 `applyBulletSpriteFrame()`，避免分裂弹沿用池里旧 spriteFrame。

## v1.3 全武器完成版（2026-07-05）

按「小型透明 primitive + 程序化 Graphics」思路把 17 把主武器全部补齐：

- 18 张 `vfx_bullet_*.png` 从 96×96 升级为 128×128 RGBA，轮廓覆盖：冲锋枪曳光、毒雾粒、冰束冰棱、回声箭环、三发霰弹、棱镜折射、量子双卫星、离子枪尖、荆棘弩矢、磁轨双轨、虚空针、流星火球、无人机电弧、重力黑核、虚空裂刃、冰火双色、蛛网链束。
- `getBulletSpriteSizeMultiplier()` 按武器调 sprite 尺寸：轨道/离子/虚空针更长，流星/重力/虚空撕裂更大，SMG 更紧凑。
- `drawMuzzleSignature()` 给每把武器补开火瞬间特征：冰棱、回声环、霰弹三向喷口、棱镜星芒、量子环、离子枪尖、荆棘倒刺、磁轨双轨、流星火舌、重力环、虚空裂缝、冰火双 flare、蛛网分叉。
- `drawHitSparkSignature()` 给命中瞬间补特征：霜花、回声扩环、三点霰弹、棱镜五芒、量子环、轨道穿透线、荆棘刺、流星爆点、重力冲击环、虚空撕裂、冰火双爆、蛛网六向结。
- 生成对照图：`data/visual_checks/weapon_vfx_primitive_contact_sheet_v2.png`。

## v1.4 瘟疫喷射器修正（2026-07-05）

用户实测指出：瘟疫喷射枪除了 spray 外还有几根折线，且音效不对。根因：

1. `drawSprayConeOnOverlay()` 里旧的多段线本来想做“导向气流”，但运行时看起来像几根硬折线/闪电，不像毒雾。
2. `sfx_shoot_spray.mp3` 旧生成式只有约 0.205s，听起来像短促噪声/点击，不像持续喷射。

修复：

- 删除毒雾 overlay 的硬折线气流，改为低透明雾底 + `mistBlob()` 软雾团 + pooled `poison_mist_particle`。
- 新增测试禁止 `strokePath(` 回到毒雾路径。
- `tools/generate_audio_assets.py` 新增 `spray_hiss_sfx()`，重新生成 `sfx_shoot_spray.mp3` 为 0.42s 连续湿喷/嘶嘶声。
- `audioManager.ts` 中 spray profile 调整为 `volume=0.70, cooldown=0.115`，避免旧短音效高频重叠成点击感。
- 运行时验证截图：`data/visual_checks/poison_spray_no_polyline_on.png` / `poison_spray_no_polyline_hidden.png` / `poison_spray_no_polyline_diff.png`。

## 本次验证记录（2026-07-05）

- v1.4 poison fix：`strokePath` 从 web-mobile bundle 消失，`mistBlob` / `PoisonSprayScreenOverlay` 存在；runtime probe 得到 `sfx_shoot_spray volume=0.7 cooldown=0.115`、`sprayCones=1`、`mistActive=20`。
- `sfx_shoot_spray.mp3` 重新生成为 0.420s / 5008 bytes（旧版约 0.205s / 2657 bytes）。
- 截图差分：`changed_px=5163`、`strong_px=589`、`bbox=(227,206,746,565)`，证明真实 web-mobile 里毒雾仍可见但不再依赖硬折线。
- v1.3 asset audit：18 张 `vfx_bullet_*.png` 均为 128×128 RGBA，alpha 有透明区，`.meta` 存在；primitive pairwise 最小差异 `2646 changed px`（closest: rifle/smg），说明资源层不是只换色。
- `npx --yes -p typescript@5.9.3 tsc -p tsconfig.json` ✅
- `npx --yes tsx tests/visual/weaponAttackPresentation.test.ts` ✅
- `npm test` ✅，包含新增「17 个主武器 VFX 资源不可复用」「muzzle/hit signature 必须存在」断言。

### v1.2 验证记录

- `npx --yes -p typescript@5.9.3 tsc -p tsconfig.json` ✅（Cocos build 生成 `temp/declarations/cc.d.ts` 后通过）
- `npm test` ✅，包含 `poisonSprayVfx tests passed.` / `weaponAttackPresentation tests passed.`；新增断言覆盖 `vfx_bullet_*` PNG、`.meta`、alpha、`BulletArt` 创建路径。
- `python3 tools/bot/build_web_mobile_for_bot.py` ✅，`build/web-mobile/assets/main/index.js` 708898 bytes，包含 `vfx_bullet_smg` / `vfx_bullet_rail` / `new Node('BulletArt')` / `applyBulletSpriteFrame`。
- 浏览器 runtime 抽检：`bulletSpriteFrames` 成功加载 18 个 `vfx_bullet_*` SpriteFrame；手动生成 16 种 style 子弹后，16/16 `BulletArt` active，frame 分别为 `vfx_bullet_smg/frost/.../web`。
- 截图像素验证：`data/visual_checks/weapon_vfx_primitives_sprite_on.png` vs `weapon_vfx_primitives_sprite_off.png`，关闭 Sprite 层后差异 `changed_px=1349`、`strong_px=722`、`bbox=(234,448,782,565)`，证明新 PNG 资源层在真实 web-mobile 运行时可见。

## 上一轮验证记录（2026-07-04）

- `npx --yes -p typescript@5.9.3 tsc -p tsconfig.json` ✅
- `npm test` ✅，新增 `poisonSprayVfx tests passed.` / `weaponAttackPresentation tests passed.`
- `npm run balance:build-web` ✅，`assets/main/index.js` 672552 bytes，包含 `PoisonSprayScreenOverlay` / `sprayOverlayGfx` / `renderSprayOverlay` / `WEAPON_SHOOT_SFX` / `spawnSprayCone`
- CDP runtime 抽检：瘟疫 `fireAt()` 后 `enemyHp 999→990.6`、`poison=1`、`sprayLayer=PoisonSprayScreenOverlay`、`overlay=true`、`shared=false`。
- CDP 截图像素验证：`data/visual_checks/poison_cdp_after_screen_overlay.png`，中央战斗区 `changed_green_px=62302`、`bright_green_px=61336`，判定 `PASS_VISIBLE`。
- 视觉模型复核：截图中能明显看到从玩家附近向右侧喷出的绿色/黄绿色扇形喷流。

## 注意

- 生图模型可以后续用于正式贴图/图标，但当前攻击效果用程序化 `Graphics` + 小型透明 primitive，包体和性能更可控。
- `tools/weapon_effects_*.png`、`tools/weapons_batch*.png` 只是参考/概念图，不在 Cocos `resources` 目录内，预览和构建都不会自动加载；把这些图换掉不会改变战斗里的攻击效果。
- 当前运行时加载 `assets/resources/effects/vfx_bullet_*.png` 作为子弹 Sprite 纹理层，同时保留 `projectileManager.ts::drawBullet()` 的 Graphics fallback。若要替换真实攻击资源，直接替换对应 `vfx_bullet_<style>.png`（必须 RGBA/透明），保留/更新 `.meta`，然后在 Cocos Creator 里开发者→编译（Cmd+Shift+B）或重新跑 web-mobile 构建。
- 新增武器时必须同时补：`WeaponAttackStyle`、`getWeaponAttackStyle()`、`BULLET_STYLES` 的 `vfx_bullet_*` 资源、`drawBullet()`、`WEAPON_SHOOT_SFX`、音频文件、测试。

# Weapon Attack Effects · 主武器攻击视觉/音效 v1.1

> Last updated: 2026-07-04  
> Source of truth: `assets/scripts/catalogs/weaponCatalog.ts` + `assets/scripts/projectile/projectileManager.ts` + `assets/scripts/audio/audioManager.ts`

## 目标

17 把主武器必须做到两件事：

1. **专属攻击视觉**：每个 weapon family 都有独立 `WeaponAttackStyle`，不是只换颜色。
2. **专属射击音效**：每个 weapon family 都映射到独立 `sfx_shoot_*` 音频文件，不再多把武器共用同一个射击声。

约束：

- 抖音小游戏包体紧张，所以攻击视觉优先用 `Graphics` 程序化 VFX，不新增大贴图。
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
| 子弹轮廓绘制 | `assets/scripts/projectile/projectileManager.ts::drawBullet()` |
| 子弹半径 / 生命周期 / accent 色 | `projectileManager.ts::getWeaponBulletRadius()` / `getWeaponBulletLife()` / `getWeaponAccentColor()` |
| 瘟疫喷射器非子弹路径 | `RogueShooterGame.ts::fireAt()` → `projectileManager.ts::spawnSprayCone()` |
| 瘟疫毒雾实际渲染层 | `projectileManager.ts::PoisonSprayScreenOverlay`（Canvas-level overlay；不依赖 World 子节点 Graphics） |
| 枪口闪光 | `projectileManager.ts::spawnMuzzleFlash()` |
| 命中火花和屏幕震动 | `projectileManager.ts::spawnBulletHitSpark()` / `updateBullets()` |
| 射击音效总表 | `assets/scripts/audio/audioManager.ts::WEAPON_SHOOT_SFX` |
| 程序化音频生成 | `tools/generate_audio_assets.py` |
| 音频资产 | `assets/resources/audio/sfx/sfx_shoot_*.mp3` |
| 回归测试 | `tests/catalogs/weaponCatalog.test.ts` + `tests/visual/weaponAttackPresentation.test.ts` |

## 验证规则

- `tests/catalogs/weaponCatalog.test.ts`：17 个 weapon family 必须映射到 17 个不同 attack style。
- `tests/visual/weaponAttackPresentation.test.ts`：
  - 每把主武器不能掉到 fallback `rifle`。
  - 每个 style 必须有 `drawBullet()` case。
  - 瘟疫喷射器必须走 `spawnSprayCone()`，因为它不创建子弹。
  - 17 把主武器必须映射到 17 个不同 `sfx_shoot_*` 文件。
  - 每个专属音效文件和 `.meta` 都必须存在。

## 本次验证记录（2026-07-04）

- `npx --yes -p typescript@5.9.3 tsc -p tsconfig.json` ✅
- `npm test` ✅，新增 `poisonSprayVfx tests passed.` / `weaponAttackPresentation tests passed.`
- `npm run balance:build-web` ✅，`assets/main/index.js` 672552 bytes，包含 `PoisonSprayScreenOverlay` / `sprayOverlayGfx` / `renderSprayOverlay` / `WEAPON_SHOOT_SFX` / `spawnSprayCone`
- CDP runtime 抽检：瘟疫 `fireAt()` 后 `enemyHp 999→990.6`、`poison=1`、`sprayLayer=PoisonSprayScreenOverlay`、`overlay=true`、`shared=false`。
- CDP 截图像素验证：`data/visual_checks/poison_cdp_after_screen_overlay.png`，中央战斗区 `changed_green_px=62302`、`bright_green_px=61336`，判定 `PASS_VISIBLE`。
- 视觉模型复核：截图中能明显看到从玩家附近向右侧喷出的绿色/黄绿色扇形喷流。

## 注意

- 生图模型可以后续用于正式贴图/图标，但当前攻击效果用程序化 `Graphics`，包体和性能更可控。
- 新增武器时必须同时补：`WeaponAttackStyle`、`getWeaponAttackStyle()`、`drawBullet()`、`WEAPON_SHOOT_SFX`、音频文件、测试。

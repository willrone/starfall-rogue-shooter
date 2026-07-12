# 存档与抖音平台接入基线

基线日期：2026-07-11

当前平台绑定（更新于 2026-07-12）：

```text
项目名：异星战斗
AppID：tt646d12d0fa08833b02
```

本文记录当前存档事实、迁移约束、广告状态和抖音开发者工具导入流程。平台政策、资质和审核要求可能变化，提审时必须以抖音开放平台控制台的实时要求为准。

## 1. 当前存档实现

永久进度由 `assets/scripts/shop/equipmentManager.ts` 直接读写 `cc.sys.localStorage`。

主存档 key：

```text
starfall-rogue-shooter-progress-v1
```

存档字段：

```text
battlesWon
alloy, cores, shards, biomass, circuits, crystals
voidFragment, energyCore, frostCore, infernoCore, webSilk
ownedEquipment[]
equippedEquipment[]
equipmentLevels{}
equipmentBlueprints{}
equippedOffhandId
offhandLevels{}
```

`battlesWon` 当前实际表示“已结束出击次数”，死亡和撤离都会增加。字段不能直接重命名，否则会破坏旧存档读取。

## 2. 初始化与容错

没有存档时：

- 强制拥有并装备 `STARTER_EQUIPMENT_IDS`。
- Starter 等级至少为 1。
- 初始资源为 shards 24、biomass 12、circuits 10，其余按代码默认值。

读取时对数字做非负归一化；JSON 解析异常只记录警告并保留默认状态。当前没有显式 `schemaVersion`、迁移器、云存档或校验和。

## 3. 存档修改规则

新增或改变永久字段时必须：

1. 不覆盖现有 key 含义。
2. 为缺失字段提供安全默认值。
3. 对旧数组、对象和非法数字做类型校验。
4. 在 `saveProgress()` 与 `loadProgress()` 双向接线。
5. 增加“旧 JSON → 加载 → 修改 → 保存 → 重载”测试。
6. 更新本文和 `GAMEPLAY_MECHANICS.md`。

存在破坏性变化时优先在同一 key 中增加 `schemaVersion` 和渐进迁移；只有无法兼容时才升级到 `...-v2`，并明确是否迁移 `v1`。

## 4. 当前保存时机

装备合成、强化、装配、副武器合成/升级等机库动作会主动保存；战斗结束进入结算前也会保存。

已知缺口：新 `SettlementPopup` 选择 Boss 战利品后没有立即再次保存。关闭前必须补选择后重载测试，详见 [`BASELINE_GAPS.md`](./BASELINE_GAPS.md)。

## 5. 广告状态

`assets/scripts/ad/AdManager.ts` 当前仍是开发 Stub：

- 广告位 ID 全为空。
- `playRewardedAd()` 用 0.5 秒延迟和 80% 随机成功模拟结果。
- 生产 `tt.createRewardedVideoAd` 代码只有注释，没有正式接线。
- 复活计数 key 为 `ad_daily_revive`，上限 3。
- 当前只保存累计次数，没有日期字段，不会自然日自动重置。

在接入真实广告前不得把激励广告写成已上线能力。接入时需要分别配置复活、撤离双倍、战前增益、商店刷新和升级刷新广告位，并处理 load/show/close/error、重复监听、前后台切换和未完整观看。

## 6. 抖音构建产物

```bash
npm run build:bytedance
```

输出目录：

```text
build/bytedance-mini-game
```

这是导入抖音开发者工具的项目目录，不是仓库根目录，也不是 `build/web-mobile`。

项目级平台身份位于：

```text
config/bytedance-project.json
```

`tools/cocos_build_guard.py` 会在 Cocos 构建后把该文件中的正式 AppID 和项目名写入生成的 `project.config.json`。这样后续构建不会重新退回 Cocos 模板的 `testappId`。AppID 是项目标识，不是广告位 ID；广告位仍在 `AdManager.ts` 中单独配置。

导入前执行：

```bash
npm run build:check
npm run size:bytedance
```

当前工程守门线为 19 MiB。

## 7. 抖音开发者工具导入

1. 打开“抖音开发者工具”。
2. 使用拥有目标小游戏权限的账号登录。
3. 选择导入项目/小游戏项目。
4. 项目目录选择绝对路径 `.../game_dev_cocos/build/bytedance-mini-game`。
5. AppID 选择或填写控制台已经创建、且属于当前账号的小游戏 AppID。
6. 项目名称使用 `config/bytedance-project.json` 中的平台名称；当前为“异星战斗”。本地平台项目名称不改变游戏内部品牌文案。
7. 完成导入后确认 `project.config.json`、启动场景和竖屏方向被识别。
8. 首次编译后检查控制台错误、网络请求、音频解锁、触控、安全区和资源加载。

AppID 不应硬编码到 TypeScript 源码。它属于 `config/bytedance-project.json` 和生成产物的项目配置；开发者工具更新生成的 `project.config.json` 后，下次正式构建仍以项目级配置为准。

## 8. 导入后的最低验收

- 主菜单能打开，HUD 不泄露。
- 机库显示 1 把主武器、4 个装备槽和独立副武器槽。
- 主武器可以原位替换，不出现“槽已满/至少保留一把”的死锁。
- 开始战斗后移动、自动射击、怪物、XP、拾取和暂停正常。
- 升级、商店、撤离、复活、结算弹窗不越界。
- 关闭并重新打开项目后永久进度可读取。
- 无缺失 SpriteFrame、音频、脚本或分包错误。
- 720×1280 与至少一台长屏真机安全区正常。

## 9. 上传、预览和提审边界

“导入开发者工具”只建立本地平台项目；“预览/真机调试”“上传版本”和“提交审核”是后续不同动作。

上传前必须完成 [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)，特别是：

- 替换广告 Stub 和空广告位。
- 处理所有 P0 发布阻塞项。
- 准备真实图标、启动图、截图、隐私与资质材料。
- 在实时控制台核对最新平台政策。

未经明确发布验收，不把能在开发者工具运行等同于可提审版本。

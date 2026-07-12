# 星坠幸存者：基线差异与阻塞项

> 审计日期：2026-07-11
>
> 对照范围：当前工作区源码、`AGENTS.md`、`docs/` 现有机制文档
>
> 本文件是差异清单，不是目标数值表。未关闭的 P0/P1 项不得在其他文档中写成“完整实现”。

## 1. 严重度定义

| 级别 | 定义 |
|---|---|
| P0 | 核心循环、资源闭环、可获得性或主要机制被阻断；冻结正式机制基线前必须处理 |
| P1 | 功能可运行但与设计承诺明显不同，或存在高概率错误/数据丢失 |
| P2 | 文档、命名、测试镜像、显示或低影响状态不一致，容易误导后续开发 |

状态统一使用：`OPEN`、`DECISION`、`FIXED`、`ACCEPTED`。`DECISION` 表示必须先决定以设计还是当前实现为准。

## 2. P0 阻塞项

### GAP-ECON-001：永久合金与 Boss 材料没有完整入库

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P0 / OPEN |
| 设计期望 | 战斗中取得的合金和 Boss 专属材料支撑副武器、传说武器及长期养成闭环 |
| 当前实现 | `calculateEndlessReward()` 强制 `reward.alloy = 0`；`RogueShooterGame.addWalletToInventory()` 不增加合金和五种 Boss 材料；`addBattleResource()` 也不处理五种 Boss 材料。Boss 掉落提示可以出现，但材料不会进入可持久消费的钱包 |
| 证据 | `RogueShooterGame.ts:2667-2689, 2714-2768`；`enemyManager.ts:1949-1965` |
| 下一步 | 明确合金是本局专用还是同时存在永久合金；为 Boss 材料增加 battle 字段或直接安全入永久钱包；补“击杀→拾取→结算→存档→消费”集成测试 |

### GAP-OFFHAND-001：副武器材料系统没有消费闭环

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P0 / OPEN |
| 设计期望 | 合成消耗净化结晶/虚空碎片/时间晶格，升级消耗通用金粉和合金 |
| 当前实现 | `recipeMaterial` 只存在于 catalog；`synthesizeOffhand()` 只扣永久合金。升级成本会返回“通用金粉”文字，但 `upgradeOffhand()` 仍只扣合金；上述四种副武器材料也不在 `ResourceType` 中 |
| 证据 | `offhandCatalog.ts`；`equipmentManager.ts:350-392`；`core/types.ts:1,178-190` |
| 下一步 | 决定新增四种正式资源，还是删除独立材料设计；同步资源类型、状态、存档、掉落、UI、合成校验和测试 |

### GAP-OFFHAND-002：T1-T5 数据被当作增量累加，结果远超设计表

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P0 / DECISION |
| 设计期望 | `offhand_weapon_design.md` 的 Lv5 数值是最终目标，例如回旋利刃 T5 为 6 片、1.8 圈/秒 |
| 当前实现 | `getOffhandStats()` 使用 `baseStats + sum(levelUpgrades)`；但各段配置看起来是每一阶目标值。回旋利刃 T5 会累计为 23 片而非 6 片，其他半径、伤害、减速、冷却也同样失真 |
| 证据 | `offhandCatalog.ts:26-280`；`offhand_weapon_design.md:17-57` |
| 下一步 | 选择“每阶绝对值覆盖”或把 catalog 全部改成真实增量；为 15 把副武器逐阶快照增加数据测试 |

## 3. P1 机制差异

### GAP-OFFHAND-003：多种副武器行为未完整接线

| 设计期望 | 当前实现 | 下一步 |
|---|---|---|
| 守护星环格挡敌方弹幕 | 只创建环绕视觉，没有与敌方弹丸碰撞/回收接线 | 在 projectile 层提供只读拦截接口并测试每秒格挡上限 |
| 幽影分身复制主武器伤害 | 只绘制分身，projectile 层没有读取该副武器 | 明确复制弹丸还是复制最终伤害，接入并防止递归触发 |
| 影刃猎手按 `count` 生成多只 | 每个 cooldown 只伤害一个最近目标，忽略 `count` | 实现多实体/多目标或调整 catalog 与描述 |
| 静电蜂群按 `count` 表现蜂群 | `count` 未参与攻击，只使用 `pierce` 做弹射 | 接入数量或删除无效字段 |
| 治愈蜂鸟附带微伤诅咒 | 当前只有回血 | 实现诅咒或修正文案 |
| 黑曜石封印对精英/Boss 效果减半 | 当前对所有目标设置完全冻结 | 加目标类型折减与免疫规则 |
| 暴风之眼对精英减半 | 当前对精英和 Boss 都造成完整最大生命百分比伤害 | 加精英/Boss 系数和上限 |
| 铜墙护盾格挡第 N 次攻击 | 回调发生在本次伤害结算之后，只给后续 0.3 秒无敌 | 改为伤害前判定并返回是否拦截 |

权威证据：`assets/scripts/offhand/offhandManager.ts`。

### GAP-MECH-005：冲锋枪过热层数运行逻辑（已关闭）

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / FIXED（2026-07-11） |
| 设计期望 | 连续射击累计 5 层，每层 +10% 武器射速，停火后衰减 |
| 当前实现 | 每次实际开火增加1层、5层封顶；停火0.8秒后逐层冷却；`getFireInterval()`按每层10%计入射速 |
| 证据 | `RogueShooterGame.ts` 的开火与 `updateRegen()`路径；`projectileManager.ts` 的 `getFireInterval()` |
| 验证 | `tests/flows/weaponMechanicsWiring.test.ts` 覆盖增长与衰减接线 |

### GAP-MECH-006：主武器描述与实际机制数值不一致

2026-07-11 已统一霜束、磁轨炮、量子织机、流星发射器、冰狱审判与织网支配者描述。剩余缺口：

| 武器 | 设计/文档期望 | 当前实现 | 下一步 |
|---|---|---|---|
| 虚空撕裂者 | catalog 写穿透减防 | 代码为每层穿透 +18% 伤害，没有减防状态 | 决定机制定位后修代码或文案 |

### GAP-STAT-001：武器家族攻击距离字段没有进入战斗属性（已关闭）

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / FIXED（2026-07-11） |
| 设计期望 | 17 个家族的 `attackRange` 决定各自基础索敌范围，再叠加装备/升级 |
| 当前实现 | `WeaponStats.attackRange` 由 family 写入生成武器；运行时用家族范围替换角色基础420，再叠加 run/gear 范围并供 `findNearestEnemy()` 使用 |
| 证据 | `core/types.ts`；`weaponCatalog.ts:buildWeaponCatalog()`；`RogueShooterGame.ts:getCharacterStats()/getAttackRange()` |
| 验证 | `weaponCatalog.test.ts` 与 `weaponMechanicsWiring.test.ts` 覆盖 catalog 和运行时接线 |

### GAP-GROWTH-001：每 3 级自动生命成长会被三选一重算覆盖

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | Lv.3、6、9……永久增加本局最大生命 20，并立即治疗 20 |
| 当前实现 | `gainXp()` 先直接修改 `playerMaxHp/playerHp`，随后 `applyLevelUpgrade()` 用 `getMaxHp()` 重算最大生命；等级成长不在 `CharacterStats` 或独立累计字段中，因而会丢失 |
| 证据 | `pickupManager.ts:372-384,705-719` |
| 下一步 | 增加明确的本局等级生命累计字段并纳入属性汇总，或删除此自动成长规则；补 Lv.3 选择后的断言 |

### GAP-SHOP-001：商店刷新显示 18，实际扣除 22

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | 显示价格与实际扣款完全一致 |
| 当前实现 | `equipmentManager.ts` 的逻辑常量为 22；`ShopPopup.ts` 和 `RogueShooterGame.ts` 的显示常量为 18 |
| 证据 | `equipmentManager.ts:45,1037-1043`；`ShopPopup.ts:23,87,183`；`RogueShooterGame.ts:135` |
| 下一步 | 导出单一共享常量，UI 不再复制价格；补扣款前后余额测试 |

### GAP-SETTLE-001：新 Boss 战利品选择后没有立即持久化

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | 玩家点击 Boss 战利品后，装备/等级/资源立即写入存档 |
| 当前实现 | `finishBattle()` 在显示结算前保存；`SettlementPopup.onLootChosen` 之后只应用选择并清空列表，没有再次 `saveProgress()`。旧 `chooseLoot()` 路径会保存，但新弹窗不走该路径 |
| 证据 | `RogueShooterGame.ts:2471-2546`；`pickupManager.ts:870-877` |
| 下一步 | 选择成功后立即保存，再关闭弹窗；补“选择后重载存档”测试 |

### GAP-AD-001：“每日复活”不会按日期自动重置

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | 每自然日最多 3 次，次日自动恢复 |
| 当前实现 | localStorage 只保存累计数字；`resetDailyRevive()` 没有调用点，也没有日期 key |
| 证据 | `ad/AdManager.ts:16-18,68-90` |
| 下一步 | 存储日期和计数，读取时按本地日历或服务器日切换；补跨日测试 |

### GAP-EQUIP-001：传说武器存在两套不同合成成本

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / DECISION |
| 设计期望 | 同一武器只有一套清晰且可追踪的合成配方 |
| 当前实现 | 锻造面板的 `LEGENDARY_RECIPES` 使用单种 Boss 材料 + 200 合金；通用 `getCraftCost()` 又为同一武器配置两种 Boss 材料和通用资源，要求不一致 |
| 证据 | `equipmentManager.ts:395-435,679-729` |
| 下一步 | 指定唯一入口；另一入口复用同一个配方函数，不再复制材料表 |

### GAP-WAVE-002：`spawnAfter` 与实际怪池解锁不是同一规则

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / DECISION |
| 设计期望 | catalog 的 `spawnAfter` 是每个基础怪/变体的明确解锁条件 |
| 当前实现 | `getUnlockedEnemySpecs()` 主要按 wave slot、family 和 `variantIndex` 过滤；`getWaveEnemySpecs()` 在 9-10 波又按数组分片；没有统一按 `spawnAfter` 过滤 |
| 证据 | `enemyCatalog.ts:371-397`；`enemyManager.ts:1745-1780` |
| 下一步 | 选择一种解锁模型并删除另一套隐式规则；为每波候选 family/variant 建快照测试 |

### GAP-ART-001：运行时玩家动画合同缺少对应 PNG

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | 角色能按 8 方向使用无武器身体条带，主武器作为独立挂载层显示 |
| 当前实现 | 代码加载 `player_survivor_idle` 和 8 张 `player_survivor_run_*`，规格为 6 帧 × 160px；仓库只有这些文件的孤立 `.meta`，没有对应 960×160 PNG。现有 `player_*` 为 6×80 条带，`player_body_no_weapon_*` 也未接入当前 loader，干净导入会回退 placeholder |
| 证据 | `RogueShooterGame.ts` 角色资源加载；`assets/resources/art/characters/`；`ART_REPLACEMENT_GUIDE.md` 第 6 节 |
| 下一步 | 选择补齐 9 张 960×160 资源，或正式把 loader、帧尺寸和方向状态迁移到 80px 合同；增加缺图与条带尺寸测试，并在干净 AssetDB 运行验证 |

### GAP-ART-002：17 把主武器的场上挂载图未闭合

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | 每个主武器 family 都有可辨识的角色手持/场上挂载图 |
| 当前实现 | 运行时按 `art/weapons/weapon_<family>_icon` 推导资源；当前仅 5/17 个 family 能命中同名文件，其余回退通用或无专属表现 |
| 证据 | `RogueShooterGame.ts` 武器外观加载；`assets/resources/art/weapons/`；`ART_REPLACEMENT_GUIDE.md` 第 8 节 |
| 下一步 | 为 17 个 family 建唯一 key 和尺寸合同，补齐缺失 PNG/meta、资源映射测试及逐武器运行截图 |

### GAP-ART-003：霜束与织网武器 UI 图标 key 不完整

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P1 / OPEN |
| 设计期望 | 17 个主武器 family 都能在机库、掉落和详情界面显示唯一图标 |
| 当前实现 | `frost-beamer` 通过通用推导得到 `wpn_frost_beamer`，现有文件/loader 使用 `wpn_frost_beam`；`webmaster` 缺少 `wpn_webmaster` 文件和 `loadIcons()` 项 |
| 证据 | `equipmentManager.ts::equipIconKey()`；`RogueShooterGame.ts::loadIcons()`；`assets/resources/effects/ui_icons/` |
| 下一步 | 建立显式 family→icon 映射或统一命名；补 17/17 映射测试，并验证异步加载后的机库刷新 |

## 4. P2 架构、状态与显示差异

### GAP-ART-004：大 Boss 专属动画未被运行时使用

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P2 / OPEN |
| 设计期望 | 5 个大 Boss 具有可辨识的专属轮廓与动画 |
| 当前实现 | Boss 路径会强制选择通用 `boss` 条带；已有个别专属资源也无法从当前分支到达，5 个 Boss 主要共享同一视觉 |
| 证据 | `enemyManager.ts` 的 strip 选择；`assets/resources/art/enemies/` |
| 下一步 | 以 boss ID 建立专属 strip meta 与 fallback，补 5 个 Boss 资源和选择测试 |

### GAP-ART-005：副武器没有专属战斗 Sprite 合同

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P2 / DECISION |
| 设计期望 | 15 把副武器有稳定、可替换且互相可辨识的战斗美术 |
| 当前实现 | `offhandManager.ts` 主要用 Graphics/Node 绘制机制表现，catalog 的 `iconKey` 大量复用通用 UI 图标；没有独立 PNG loader、尺寸或命名合同 |
| 证据 | `offhandCatalog.ts`；`offhand/offhandManager.ts`；`ART_REPLACEMENT_GUIDE.md` 第 9 节 |
| 下一步 | 决定保留程序化表现还是新增专属 Sprite 层；若新增，先定义不改变 15 种机制身份的资源表、回退和对象池规则 |

### GAP-ARCH-001：战斗公式存在运行时与测试镜像双源

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P2 / OPEN |
| 设计期望 | `combatFormulas.ts` 与游戏运行时共享同一组纯函数 |
| 当前实现 | projectile runtime 重复实现伤害/射速；纯函数射速使用 `critStacks×1%`，runtime 使用 `overheatStacks×10% + offhandBoost`。波次纯函数也没有被 `enemyManager` 调用，间隔、批量、HP 估算与当前 runtime 不同；平衡单测主要验证镜像而非真实行为 |
| 证据 | `core/combatFormulas.ts`；`projectileManager.ts:517-567`；`enemyManager.ts:1310-1407,1616-1656`；`tests/balance/` |
| 下一步 | 让 runtime 调用纯函数，或删除不再可信的镜像；测试必须加入 runtime 参数一致性契约 |

### GAP-STATE-001：护盾碎片只有计数，没有机制消费者

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P2 / OPEN |
| 设计期望 | 20% 击杀掉落应有可见收益或明确用途 |
| 当前实现 | `shieldFragments` 只会增加、重置，没有消费、属性转换或 UI 反馈 |
| 证据 | `combatState.ts:92-94,184,235`；`enemyManager.ts:1945-1947`；`RogueShooterGame.ts:3362-3364` |
| 下一步 | 接入明确机制，或移除掉落和状态字段，避免无效随机逻辑 |

### GAP-NAME-001：`battlesWon` 实际统计所有已结束出击

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P2 / ACCEPTED（待命名迁移） |
| 设计期望 | 名称表达真实含义，解锁条件可读 |
| 当前实现 | 无论死亡还是撤离，`finishBattle()` 都执行 `battlesWon += 1`；装备发现系统把它当“完成出击次数” |
| 证据 | `RogueShooterGame.ts:2471-2480`；`equipmentProgression.ts` |
| 下一步 | 短期文档统一称“已完成出击次数”；若重命名需做存档迁移，不能直接改字段 |

### GAP-RUNITEM-001：tier 上限函数允许 10，但 catalog 只有 T1-T5

| 项 | 内容 |
|---|---|
| 严重度 / 状态 | P2 / OPEN |
| 设计期望 | 商店 tier 上限与可生成内容一致 |
| 当前实现 | `getRunItemTierLimit()` 在无尽模式可返回 10，`RUN_ITEMS` 只有 5 tier；实际过滤只能得到 T1-T5 |
| 证据 | `runItemCatalog.ts:28,106-126`；`equipmentManager.ts:835-843` |
| 下一步 | 上限 clamp 到 5，或正式设计并生成 T6-T10 |

## 5. 旧 `AGENTS.md` 的迁移核对

以下是本次基线审计发现并用于重写 `AGENTS.md` 的旧描述。当前 `AGENTS.md` 已改为链接机制基线；本表保留用于防止历史说法回流。若源码再次变化，应更新当前机制文档，而不是照抄本表。

| 严重度 | 旧 `AGENTS.md` 描述 | 2026-07-11 源码事实 | 迁移结果 |
|---|---|---|---|
| P1 | XP 掉率 56%，掉落量 ×2.6 | 所有击杀直接给 XP；普通×2.6、精英×2.4、Boss×3 | 已更新 XP 章节 |
| P1 | HP/伤害进度常量 2.5/1.3 | 当前为 1.8/1.0 | 已更新怪物公式 |
| P1 | 早期 interval/batch/cap 使用旧表 | runtime 已有另一组 early relief、批量和 Boss cap | 已改为引用 runtime，避免手抄 |
| P1 | 22 blueprint ×5=110 本局道具 | 65 个单属性 blueprint ×5=325 | 已更新数量与单属性设计 |
| P1 | 移速 +18~42、射程 +55~120 | 当前 +8~18、+20~50 | 已更新升级表 |
| P1 | `attackSpeed` 只由升级提供 | 当前单属性 RUN_ITEM 不再直接加 `attackSpeed`，但 gear 仍可能提供 | 已删除“升级专属”断言 |
| P1 | 装备战斗内固定 level=1 | gear 效果乘持久装备等级 | 已更新属性来源 |
| P1 | 无人机伤害约 `dronePower×8` | `12 + dronePower×3.4 + reactorLevel×2` | 已更新无人机公式 |
| FIXED | 冲锋枪 `overheat` | 已接入每次开火叠层与停火 0.8 秒逐层冷却 | 已补机制接线测试 |
| P1 | 回声弓 `pierce_stacks` | 当前为 `echo_chain` | 已更新机制表 |
| FIXED | 织网击杀回血 | 统一为子弹伤害 5% | `AGENTS.md`、catalog、机制基线已同步 |
| P2 | 战术目镜攻击范围 +36 | catalog 为 +18 | 已更新 Starter 说明 |
| P2 | 角色属性只列武器 fireRate/pierce 贡献 | 当前还包括 bulletSpeed×6 和 drone | 已补全属性来源 |

## 6. 文档迁移状态

| 文档 | 状态 | 2026-07-11 处理结果 |
|---|---|---|
| `GDD.md` | FIXED | 已重写为产品目标文档，易变公式和数量改为引用机制基线 |
| `offhand_weapon_design.md` | FIXED（文档） | 已明确其为设计目标并链接 offhand gaps；运行实现差异仍保持 OPEN/DECISION |
| `weapon_attack_effects.md` | FIXED | 回声弓已改为 `echo_chain`，表现资源链接美术替换指南 |
| `PROJECT_ARCHITECTURE.md` | FIXED | 已按当前真实目录、双 UI、HostContext 和单状态对象重写 |
| `ENGINEERING_STATUS.md` | FIXED | 已记录本次构建、包体、AppID 导入和发布阻塞 |
| `playtest/PLAYTEST_TEMPLATE.md` | FIXED | 已覆盖 Boss、撤离、复活、副武器、宝箱、存档、UI 与平台 |
| `upgrade_thresholds.md` | ARCHIVED | 已加历史警告，不再作为当前平衡表 |
| `BP1_BALANCE_PROGRESS_2026-06-28.md` | ARCHIVED | 已加历史警告，不再作为当前平衡结论 |
| `p0-balance-plan-2026-07-10.md` | EXCLUDED | 当前为未跟踪计划快照；文档索引明确不作为基线 |
| 文件名带 ` 2`、` 3` 的副本 | EXCLUDED | 视为冲突副本，不纳入正式入口；未擅自删除用户文件 |

## 7. 关闭流程

每个 gap 关闭时必须：

1. 修改实现或明确接受当前行为。
2. 增加能失败于旧行为的测试。
3. 更新 `GAMEPLAY_MECHANICS.md` 和所有受影响的权威文档。
4. 在本文件把状态改为 `FIXED` 或 `ACCEPTED`，注明日期和验证命令。
5. 数值、波次、掉落、武器或副武器改动必须执行真实 Cocos/CDP 验证，不能只依赖 `core/combatFormulas.ts` 的镜像测试。

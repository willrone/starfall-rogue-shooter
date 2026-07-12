# 玩家角色运行资源

> 基线复核：2026-07-11
>
> 本目录位于 `assets/resources/`，属于 runtime 区。源图、拆帧和预览应放在 `assets/art_source/`。完整替换流程见 [美术资源替换指南](../../../../docs/ART_REPLACEMENT_GUIDE.md)，当前阻塞项见 [基线差异清单](../../../../docs/BASELINE_GAPS.md)。

## 当前代码期待的资源

`RogueShooterGame.ts` 当前仍声明以下 SpriteFrame key：

```text
player_survivor_idle
player_survivor_run_south
player_survivor_run_south_east
player_survivor_run_east
player_survivor_run_north_east
player_survivor_run_north
player_survivor_run_north_west
player_survivor_run_west
player_survivor_run_south_west
```

代码合同是每张横向 6 帧、每帧 `160×160`，即 PNG 应为 `960×160 RGBA`。

**这些 `player_survivor_*.png` 当前全部缺失，只剩对应 `.meta`。** 干净 AssetDB 下角色会回退到 `art/placeholder/player_ship.png`；旧 Cocos `library/` 缓存可能暂时掩盖问题。该缺口未关闭前，不能把这个 160px 清单描述为已存在资源。

## 当前物理存在但未接线的资源

仓库实际存在下列 `480×80 RGBA` 条带，每张为 6 帧、单帧 `80×80`：

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

还存在两张 body-only 候选：

```text
player_body_no_weapon_idle.png
player_body_no_weapon_run_south.png
```

它们同样为 `480×80`、6 帧、单帧 80px。当前运行代码没有加载 `player_idle/player_run_*` 或 `player_body_no_weapon_*` 这些 key，因此只替换这些文件不能保证游戏角色发生变化。

角色资源合同必须先做一次明确决策：

- 补齐代码当前需要的 9 张 `960×160 player_survivor_*`；或
- 把运行代码、README、生成工具和测试统一迁移到现有 `6×80 player_*`。

决策和验收状态以 [基线差异清单](../../../../docs/BASELINE_GAPS.md) 为准。

## 分层制作要求

- 角色身体条带不包含主武器、副武器、枪口火焰或地面阴影。
- 主武器挂载图位于 `assets/resources/art/weapons/`，由独立子节点旋转和前后换层。
- 六帧必须保持身份、比例、色彩和脚底基线稳定。
- 每格内容不能越过 cell 边界或串入相邻帧。
- 透明背景必须是真实 alpha，不能烘焙棋盘格。
- 当前 `PLAYER_BODY_ANIMATION_DIRECTION` 固定为 south；八方向条带尚未真正按移动方向切换。

替换或迁移后按 [美术资源替换指南](../../../../docs/ART_REPLACEMENT_GUIDE.md) 的角色验证矩阵执行静态尺寸检查、重新构建和 720×1280 运行时验收。

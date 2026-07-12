# 星坠幸存者

`星坠幸存者（Starfall Survivor）` 是一款使用 Cocos Creator 3.8.8 和 TypeScript 开发的竖屏自动射击生存肉鸽，目标平台为抖音小游戏，设计分辨率 720×1280。

当前开发基线：`SF-2026-07-11`。

## 当前玩法

- 玩家控制移动，主武器自动索敌射击。
- 出战配置固定为 1 把主武器、4 个固定部位装备和 1 把独立副武器。
- 击杀直接获得 XP；升级时从 3 个随机属性成长中选择 1 个。
- 合金、材料和宝箱走战场拾取；6 格商店出售本局道具。
- 波次持续推进并穿插小 Boss 与大 Boss；死亡或主动撤离后结算。
- 机库负责主武器替换、装备强化、蓝图解锁和副武器合成/升级。

当前内容规模包括 17 个主武器家族、15 把副武器、44 个装备蓝图、65 个单属性本局道具蓝图、10 个基础怪家族、5 个小 Boss 和 5 个大 Boss。详细运行事实见 [`docs/GAMEPLAY_MECHANICS.md`](docs/GAMEPLAY_MECHANICS.md)。

## 开始开发

```bash
npm install
npm run typecheck
npm test
```

使用 Cocos Creator 3.8.8 打开仓库根目录。唯一场景是 `assets/scene/Main.scene`，但 Canvas、战斗世界和 UI 都由代码创建；不要手工编辑场景 JSON。

Web/Cocos 烟测：

```bash
npm run balance:e2e:smoke
```

抖音小游戏正式构建：

```bash
npm run build:bytedance
```

输出目录为 `build/bytedance-mini-game`，当前包体守门线为 19 MiB。

## 文档入口

开始修改前先读：

1. [`AGENTS.md`](AGENTS.md)：项目权威约束和禁止项。
2. [`docs/BASELINE.md`](docs/BASELINE.md)：当前基线与权威顺序。
3. [`docs/README.md`](docs/README.md)：框架、开发、机制、UI、美术、测试和平台文档索引。
4. [`docs/BASELINE_GAPS.md`](docs/BASELINE_GAPS.md)：尚未闭合的实现差异和发布阻塞。

UI、图标、角色、怪物、主副武器、VFX 和音频的替换合同见 [`docs/ART_REPLACEMENT_GUIDE.md`](docs/ART_REPLACEMENT_GUIDE.md)。

## 重要现状

项目可以编译、测试和构建，但基线明确保留若干未闭合项，包括永久材料闭环、副武器材料/数值、部分副武器机制、真实广告接入和部分角色/武器美术加载。不得把这些能力写成已完成；以 [`docs/BASELINE_GAPS.md`](docs/BASELINE_GAPS.md) 为准。

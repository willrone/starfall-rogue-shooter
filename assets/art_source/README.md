# 美术源文件与生成管线

> 基线复核：2026-07-11
>
> 本目录是 source 区，不是 runtime 区。完整运行时文件名、尺寸、`.meta` 和验证规则见 [美术资源替换指南](../../docs/ART_REPLACEMENT_GUIDE.md)；当前未闭合的角色、武器和 Boss 资源合同见 [基线差异清单](../../docs/BASELINE_GAPS.md)。

## 目录边界

`assets/art_source/` 保存可追溯的美术生产资料：

```text
generated/                  原始生成结果
frames/<asset-key>/         拆出的单帧 PNG
previews/                   GIF、接触表和人工评审预览
visual_upgrade_candidates/  尚未采用的候选图
monster_prompts.json        怪物、角色和部分武器的生成规格
```

这些文件不会因为位于 `art_source` 就自动出现在游戏中。Cocos 运行时只读取 `assets/resources/` 下已接线的资源；正式采用时必须按 [美术资源替换指南](../../docs/ART_REPLACEMENT_GUIDE.md) 导出到正确 runtime 目录，并保留或生成合法 `.meta`。

不要把 PSD、原始大图、候选版本、GIF、评审接触表或生图响应直接放进 `assets/resources/`。反过来，也不要把 `art_source` 当成最终运行资源备份后删除 `resources` 中的正式文件。

## 当前生成流程

`tools/monster_sprite_pipeline.py` 读取 `monster_prompts.json`。虽然脚本名包含 monster，但规格中的 `output_dir` 也可指向 `characters` 或 `weapons`。

处理流程：

1. 原始输出写入 `assets/art_source/generated/`。
2. 尝试把平色或色键背景转换为透明通道。
3. 按规格等宽切帧并归一化到固定 cell。
4. 单帧写入 `assets/art_source/frames/<asset-key>/`。
5. GIF 预览写入 `assets/art_source/previews/`。
6. 横向条带会直接写入 `assets/resources/art/<output_dir>/`。

第 6 步会修改 runtime 文件，不能跳过人工审核。先检查拆帧、透明边缘、主体比例、脚底/中心锚点和动画连贯性，再接受运行资源。

## 命令

```bash
# 调用图像服务并处理为条带、拆帧和 GIF。
python3 tools/monster_sprite_pipeline.py enemy_mite_walk --generate --process

# 只重新处理已有原图。
python3 tools/monster_sprite_pipeline.py enemy_mite_walk --process \
  --raw assets/art_source/generated/enemy_mite_walk_raw.png
```

脚本从环境变量读取 `YUZ_API_KEY`，不得把密钥写入参数、日志、JSON 或仓库。网络端点和模型可通过脚本参数覆盖；它们不是工程运行时依赖。

## 规格字段

`monster_prompts.json` 的条目支持：

```json
{
  "model": "gpt-image-2",
  "size": "1536x1024",
  "frames": 6,
  "cell_size": 80,
  "fps": 8,
  "output_dir": "enemies",
  "prompt": "..."
}
```

- `frames × cell_size` 决定最终横条宽度。
- `output_dir` 只能在确认 loader 合同后指向 `characters`、`enemies` 或 `weapons`。
- 伴随 JSON 是生成记录，不是 Cocos AnimationClip；新生成记录应留在 source 区。

## 当前限制

- 角色生成规格与运行代码仍有 `6×80` 对 `6×160` 的合同冲突。
- 部分主武器只有 UI/VFX，没有对应场上挂载图。
- 专属 Boss 和副武器战斗 PNG 尚未形成完整 loader 合同。
- `normalize_sprite_sheets.py`、`clean_embedded_grid_background.py`、`generate_ui_assets.py` 等旧入口仍引用过期尺寸或缺失文件。

以上问题未关闭前，以 [基线差异清单](../../docs/BASELINE_GAPS.md) 的状态为准，不根据旧预览或旧 `library/` 缓存推断“已接入”。

# 运行时音频资源

> 基线复核：2026-07-11
>
> 本目录属于 runtime 区。音频文件名、替换步骤和验证矩阵见 [美术资源替换指南](../../../docs/ART_REPLACEMENT_GUIDE.md)；机制或接线差异见 [基线差异清单](../../../docs/BASELINE_GAPS.md)。

## 加载合同

`assets/scripts/audio/audioManager.ts` 使用：

```ts
resources.loadDir('audio', AudioClip, callback)
```

加载后只按 `AudioClip.name`，也就是文件 basename 建立 Map：

- `bgm_` 开头的 basename 进入 BGM Map。
- `sfx_` 开头的 basename 进入 SFX Map。
- 播放 key 不包含目录和扩展名，例如 `sfx_level_up.mp3` 的 key 是 `sfx_level_up`。
- `bgm/` 与 `sfx/` 下也不能出现相同 basename，否则后加载资源会覆盖前一个 Map 项。

`assets/resources/audio/` 下的现有文件名已被代码和测试硬编码引用，属于不可随意改名的运行合同。同名替换应保留原 `.meta`；需要重命名时必须同步所有播放点、`WEAPON_SHOOT_SFX` 和测试。

## 当前目录

```text
audio/
├── bgm/
│   ├── bgm_hangar.mp3
│   ├── bgm_combat_loop.mp3
│   └── bgm_boss_loop.mp3
└── sfx/
    ├── 通用反馈：sfx_hit_enemy / sfx_enemy_die / sfx_player_hit
    │              sfx_pickup / sfx_level_up / sfx_chest_open
    │              sfx_boss_warning / sfx_boss_die / sfx_crit_hit
    │              sfx_revive / sfx_ui_click
    ├── 旧样式兜底：sfx_shoot_default / rifle / shotgun / rail
    │                laser / pulse / disc / meteor
    └── 17 把主武器专属射击音效：
        sfx_shoot_smg
        sfx_shoot_spray
        sfx_shoot_frost
        sfx_shoot_echo
        sfx_shoot_scatter
        sfx_shoot_prism
        sfx_shoot_quantum
        sfx_shoot_ion
        sfx_shoot_thorn
        sfx_shoot_rail_cannon
        sfx_shoot_void_needle
        sfx_shoot_meteor_launcher
        sfx_shoot_orbital_drone
        sfx_shoot_gravity_hammer
        sfx_shoot_void_tear
        sfx_shoot_icefire
        sfx_shoot_web
```

`WEAPON_SHOOT_SFX` 是 17 把主武器的专属音效总表，记录 clip basename、音量和高频播放 cooldown。表现映射见 [主武器攻击视觉/音效](../../../docs/weapon_attack_effects.md)。

## 占位/stub 状态

当前 MP3 主要由 `tools/generate_audio_assets.py` 程序化生成，用于跑通 Cocos 和抖音小游戏音频链路，应视为可替换的占位/stub 音频，不代表最终混音验收。

```bash
python3 tools/generate_audio_assets.py
```

该命令会重生成并覆盖同名 runtime 音频。正式录音、授权音乐或最终混音进入工程后，不得把它作为常规构建步骤。脚本会优先调用 `ffmpeg` 输出 MP3；没有 `ffmpeg` 时退回 WAV，并只为缺少 meta 的新文件创建 `audio-clip` meta。

`sfx_ui_click` 当前资源存在且会被整目录加载，但源码没有稳定的全局按钮点击播放接线；不能仅凭文件存在宣称所有 UI 都有点击音。

## 正式替换要求

- 保持 basename 和 `.meta` 不变。
- 当前文件为 44.1kHz 单声道 MP3；替换时优先保持相同采样率和声道，避免解码与包体波动。
- BGM 建议控制在 64-96kbps、20-40 秒，并制作无爆点循环。
- 高频射击 SFX 必须短，尾音不能长期堆叠；连续射击至少试听 30 秒。
- `sfx_shoot_spray` 需要连续喷雾感，不能退化为短点击。
- 首次用户触摸前浏览器/小游戏可能禁止自动播放；真机必须验证首次触摸后 BGM 解锁。
- 替换后执行 `npm test`、web-mobile 构建、17 武器试听和 `npm run size:bytedance`。

当前音频链路的未闭合项或机制差异以 [基线差异清单](../../../docs/BASELINE_GAPS.md) 为准，不能用占位音效的存在替代运行行为验证。

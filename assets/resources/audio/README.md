# Audio Assets

占位音频由 `tools/generate_audio_assets.py` 程序化生成，风格为轻量卡通科幻/街机电子，方便在 Cocos 和抖音小游戏里先跑通完整音频链路。

## 目录

```text
audio/
├── bgm/
│   ├── bgm_hangar.mp3
│   ├── bgm_combat_loop.mp3
│   └── bgm_boss_loop.mp3
└── sfx/
    ├── sfx_ui_click.mp3
    ├── sfx_shoot_rifle.mp3
    ├── sfx_shoot_shotgun.mp3
    ├── sfx_shoot_rail.mp3
    ├── sfx_shoot_laser.mp3
    ├── sfx_hit_enemy.mp3
    ├── sfx_enemy_die.mp3
    ├── sfx_player_hit.mp3
    ├── sfx_pickup.mp3
    ├── sfx_level_up.mp3
    ├── sfx_chest_open.mp3
    ├── sfx_boss_warning.mp3
    └── sfx_boss_die.mp3
```

## 重新生成

```bash
python3 tools/generate_audio_assets.py
```

脚本会优先调用 `ffmpeg` 输出 mp3；如果没有 ffmpeg，会退回 wav。

## 替换正式资源的要求

- 文件名保持不变，代码无需改。
- BGM 尽量控制在 64-96kbps、20-40 秒循环，避免包体变大。
- 抖音小游戏真机上必须确认：首次触摸/点击后 BGM 能启动，射击高频音效不会爆音。

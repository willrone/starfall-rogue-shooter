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
    ├── 通用反馈：sfx_ui_click / sfx_hit_enemy / sfx_enemy_die / sfx_player_hit / sfx_pickup / sfx_level_up / sfx_chest_open / sfx_boss_warning / sfx_boss_die
    ├── 旧样式兜底：sfx_shoot_default / sfx_shoot_rifle / sfx_shoot_shotgun / sfx_shoot_rail / sfx_shoot_laser / sfx_shoot_pulse / sfx_shoot_disc / sfx_shoot_meteor
    └── 17 把主武器专属射击音效：
        ├── sfx_shoot_smg.mp3                 # 冲锋枪
        ├── sfx_shoot_spray.mp3               # 瘟疫喷射器
        ├── sfx_shoot_frost.mp3               # 霜束发射器
        ├── sfx_shoot_echo.mp3                # 回声弓
        ├── sfx_shoot_scatter.mp3             # 裂变枪管
        ├── sfx_shoot_prism.mp3               # 镜像棱镜
        ├── sfx_shoot_quantum.mp3             # 量子织机
        ├── sfx_shoot_ion.mp3                 # 离子长枪
        ├── sfx_shoot_thorn.mp3               # 荆棘连弩
        ├── sfx_shoot_rail_cannon.mp3         # 磁轨炮
        ├── sfx_shoot_void_needle.mp3         # 虚空针
        ├── sfx_shoot_meteor_launcher.mp3     # 流星发射器
        ├── sfx_shoot_orbital_drone.mp3       # 轨道无人机
        ├── sfx_shoot_gravity_hammer.mp3      # 重力锤
        ├── sfx_shoot_void_tear.mp3           # 虚空撕裂者
        ├── sfx_shoot_icefire.mp3             # 冰狱审判
        └── sfx_shoot_web.mp3                 # 织网支配者
```

## 重新生成

```bash
python3 tools/generate_audio_assets.py
```

脚本会优先调用 `ffmpeg` 输出 mp3；如果没有 ffmpeg，会退回 wav。新生成的音频如果没有 `.meta`，脚本会自动创建 Cocos `audio-clip` meta；已有 `.meta` 不会被覆盖。

## 武器音效规则

- `assets/scripts/audio/audioManager.ts` 的 `WEAPON_SHOOT_SFX` 是主武器音效总表。
- 17 把主武器的 `WeaponAttackStyle` 必须各自映射到不同的 `sfx_shoot_*` 文件。
- `tests/visual/weaponAttackPresentation.test.ts` 会检查：每把主武器 VFX style 唯一、`drawBullet()` 有对应 case、音效文件和 `.meta` 都存在。

## 替换正式资源的要求

- 文件名保持不变，代码无需改。
- BGM 尽量控制在 64-96kbps、20-40 秒循环，避免包体变大。
- 抖音小游戏真机上必须确认：首次触摸/点击后 BGM 能启动，射击高频音效不会爆音。

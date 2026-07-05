import { AudioClip, AudioSource, Node, resources } from 'cc';
import type { WeaponAttackStyle } from '../core/types';

export const AUDIO_DIR = 'audio';

export interface AudioHostContext {
    node: Node;
    cs: {
        phase: string;
    };
    enemyMgr: {
        isBossWave(): boolean;
    };
    refreshSettingsPanel(): void;
}

export interface ShootSfxProfile {
    clip: string;
    volume: number;
    cooldown: number;
}

// 17 把主武器必须一把一套独立射击音效。legacy aliases 只给旧存档/旧测试兜底。
export const WEAPON_SHOOT_SFX: Record<WeaponAttackStyle, ShootSfxProfile> = {
    smg: { clip: 'sfx_shoot_smg', volume: 0.56, cooldown: 0.026 },
    spray: { clip: 'sfx_shoot_spray', volume: 0.70, cooldown: 0.115 },
    frost: { clip: 'sfx_shoot_frost', volume: 0.64, cooldown: 0.070 },
    echo: { clip: 'sfx_shoot_echo', volume: 0.66, cooldown: 0.085 },
    scatter: { clip: 'sfx_shoot_scatter', volume: 0.78, cooldown: 0.090 },
    prism: { clip: 'sfx_shoot_prism', volume: 0.66, cooldown: 0.082 },
    quantum: { clip: 'sfx_shoot_quantum', volume: 0.66, cooldown: 0.080 },
    ion: { clip: 'sfx_shoot_ion', volume: 0.76, cooldown: 0.110 },
    thorn: { clip: 'sfx_shoot_thorn', volume: 0.66, cooldown: 0.075 },
    rail: { clip: 'sfx_shoot_rail_cannon', volume: 0.82, cooldown: 0.135 },
    void_needle: { clip: 'sfx_shoot_void_needle', volume: 0.70, cooldown: 0.095 },
    meteor: { clip: 'sfx_shoot_meteor_launcher', volume: 0.74, cooldown: 0.150 },
    drone: { clip: 'sfx_shoot_orbital_drone', volume: 0.62, cooldown: 0.075 },
    gravity: { clip: 'sfx_shoot_gravity_hammer', volume: 0.78, cooldown: 0.170 },
    void_tear: { clip: 'sfx_shoot_void_tear', volume: 0.72, cooldown: 0.088 },
    icefire: { clip: 'sfx_shoot_icefire', volume: 0.72, cooldown: 0.105 },
    web: { clip: 'sfx_shoot_web', volume: 0.66, cooldown: 0.082 },

    // Legacy style aliases kept for older code paths. New weapon families above must not share clips.
    rifle: { clip: 'sfx_shoot_default', volume: 0.64, cooldown: 0.055 },
    shotgun: { clip: 'sfx_shoot_shotgun', volume: 0.78, cooldown: 0.090 },
    laser: { clip: 'sfx_shoot_laser', volume: 0.68, cooldown: 0.080 },
    chain: { clip: 'sfx_shoot_pulse', volume: 0.62, cooldown: 0.075 },
    pulse: { clip: 'sfx_shoot_pulse', volume: 0.62, cooldown: 0.075 },
    disc: { clip: 'sfx_shoot_disc', volume: 0.68, cooldown: 0.100 },
    ricochet: { clip: 'sfx_shoot_rifle', volume: 0.66, cooldown: 0.070 },
    scythe: { clip: 'sfx_shoot_disc', volume: 0.68, cooldown: 0.100 },
};

export class AudioManager {
    sfxSource: AudioSource | null = null;
    bgmSource: AudioSource | null = null;
    sfxClips = new Map<string, AudioClip>();
    bgmClips = new Map<string, AudioClip>();
    sfxCooldowns: Record<string, number> = {};
    audioReady = false;
    audioUnlocked = false;
    currentBgmName = '';
    sfxVolume = 0.72;
    bgmVolume = 0.34;
    bgmFadeTimer = 0;
    bgmFadeOutName = '';
    bgmPendingName = '';

    constructor(public ctx: AudioHostContext) {}

    initAudio(): void {
        this.sfxSource = this.ctx.node.addComponent(AudioSource);
        this.bgmSource = this.ctx.node.addComponent(AudioSource);
        this.bgmSource.loop = true;
        this.bgmSource.volume = this.bgmVolume;

        resources.loadDir(AUDIO_DIR, AudioClip, (error, clips) => {
            if (error) {
                console.warn('Failed to load audio assets; game will continue muted.', error);
                return;
            }

            for (const clip of clips) {
                if (clip.name.startsWith('bgm_')) {
                    this.bgmClips.set(clip.name, clip);
                } else if (clip.name.startsWith('sfx_')) {
                    this.sfxClips.set(clip.name, clip);
                }
            }
            this.audioReady = true;
            this.syncBgmForPhase();
        });
    }

    unlockAudio(): void {
        if (this.audioUnlocked) return;
        this.audioUnlocked = true;
        this.syncBgmForPhase(true);
    }

    updateSfxCooldowns(dt: number): void {
        for (const name of Object.keys(this.sfxCooldowns)) {
            this.sfxCooldowns[name] -= dt;
            if (this.sfxCooldowns[name] <= 0) delete this.sfxCooldowns[name];
        }
    }

    playSfx(name: string, volume = 1, cooldown = 0.035): void {
        if (!this.audioReady || !this.audioUnlocked || !this.sfxSource) return;
        if (this.sfxCooldowns[name] && this.sfxCooldowns[name] > 0) return;
        const clip = this.sfxClips.get(name);
        if (!clip) return;
        this.sfxSource.playOneShot(clip, this.sfxVolume * volume);
        if (cooldown > 0) this.sfxCooldowns[name] = cooldown;
    }

    playShootSfx(style: WeaponAttackStyle): void {
        const profile = WEAPON_SHOOT_SFX[style] || WEAPON_SHOOT_SFX.rifle;
        this.playSfx(profile.clip, profile.volume, profile.cooldown);
    }

    requestBgm(name: string): void {
        this.currentBgmName = name;
        this.syncBgmForPhase();
    }

    syncBgmForPhase(forceRestart = false): void {
        if (!this.audioReady || !this.audioUnlocked || !this.bgmSource || !this.currentBgmName) return;
        const clip = this.bgmClips.get(this.currentBgmName);
        if (!clip) return;
        if (!forceRestart && this.bgmSource.clip === clip && this.bgmSource.playing) return;
        // Crossfade: fade out current, then play new
        if (this.bgmSource.playing && this.bgmSource.clip) {
            this.bgmFadeOutName = this.currentBgmName;
            this.bgmFadeTimer = 0.4;
            this.bgmPendingName = this.currentBgmName;
            this.bgmPendingClip = clip;
        } else {
            this.bgmSource.stop();
            this.bgmSource.clip = clip;
            this.bgmSource.loop = true;
            this.bgmSource.volume = this.bgmVolume;
            this.bgmSource.play();
        }
    }

    updateBgmFade(dt: number): void {
        if (this.bgmFadeTimer <= 0 || !this.bgmSource) return;
        this.bgmFadeTimer -= dt;
        const progress = 1 - Math.max(0, this.bgmFadeTimer / 0.4);
        if (progress < 0.6) {
            // Fade out
            this.bgmSource.volume = this.bgmVolume * (1 - progress / 0.6);
        } else if (progress < 0.65) {
            // Swap clip at ~60% through
            this.bgmSource.stop();
            const pending = this.bgmPendingClip;
            if (pending) {
                this.bgmSource.clip = pending;
                this.bgmSource.loop = true;
                this.bgmSource.volume = 0;
                this.bgmSource.play();
            }
        } else {
            // Fade in
            const fadeIn = (progress - 0.65) / 0.35;
            this.bgmSource.volume = this.bgmVolume * fadeIn;
            if (progress >= 1) {
                this.bgmFadeTimer = 0;
                this.bgmSource.volume = this.bgmVolume;
            }
        }
    }
    private bgmPendingClip: AudioClip | null = null;

    requestPhaseBgm(): void {
        if (this.ctx.cs.phase === 'combat') {
            this.requestBgm(this.ctx.enemyMgr.isBossWave() ? 'bgm_boss_loop' : 'bgm_combat_loop');
        } else {
            this.requestBgm('bgm_hangar');
        }
    }

    toggleBgm(): void {
        this.bgmVolume = this.bgmVolume > 0 ? 0 : 0.34;
        if (this.bgmSource) this.bgmSource.volume = this.bgmVolume;
        this.ctx.refreshSettingsPanel();
    }

    toggleSfx(): void {
        this.sfxVolume = this.sfxVolume > 0 ? 0 : 0.72;
        this.ctx.refreshSettingsPanel();
    }
}

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
        switch (style) {
            case 'shotgun':
                this.playSfx('sfx_shoot_shotgun', 0.78, 0.09);
                break;
            case 'rail':
                this.playSfx('sfx_shoot_rail', 0.78, 0.12);
                break;
            case 'laser':
            case 'pulse':
                this.playSfx('sfx_shoot_laser', 0.68, 0.08);
                break;
            case 'meteor':
                this.playSfx('sfx_shoot_meteor', 0.72, 0.14);
                break;
            case 'disc':
            case 'scythe':
                this.playSfx('sfx_shoot_disc', 0.68, 0.1);
                break;
            default:
                this.playSfx('sfx_shoot_default', 0.64, 0.055);
                break;
        }
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

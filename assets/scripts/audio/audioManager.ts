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
            case 'disc':
            case 'scythe':
                this.playSfx('sfx_shoot_laser', 0.68, 0.08);
                break;
            default:
                this.playSfx('sfx_shoot_rifle', 0.64, 0.055);
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
        this.bgmSource.stop();
        this.bgmSource.clip = clip;
        this.bgmSource.loop = true;
        this.bgmSource.volume = this.bgmVolume;
        this.bgmSource.play();
    }

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

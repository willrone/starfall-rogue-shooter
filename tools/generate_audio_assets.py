#!/usr/bin/env python3
"""Generate lightweight placeholder SFX/BGM for the Cocos rogue shooter.

The sounds are intentionally synthetic and arcade-like so they are safe to
replace later with polished assets while keeping the runtime integration stable.
"""
from __future__ import annotations

import math
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Callable, Iterable

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "assets" / "resources" / "audio"
SFX_DIR = AUDIO_DIR / "sfx"
BGM_DIR = AUDIO_DIR / "bgm"
SAMPLE_RATE = 44_100

SampleFn = Callable[[float], float]


def clamp(v: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def sine(freq: float, t: float) -> float:
    return math.sin(math.tau * freq * t)


def square(freq: float, t: float) -> float:
    return 1.0 if sine(freq, t) >= 0 else -1.0


def tri(freq: float, t: float) -> float:
    phase = (t * freq) % 1.0
    return 4 * abs(phase - 0.5) - 1


def noise(_: float) -> float:
    return random.uniform(-1.0, 1.0)


def env_decay(t: float, duration: float, attack: float = 0.005, decay_power: float = 2.0) -> float:
    if t < attack:
        return t / max(attack, 1e-6)
    x = max(0.0, 1.0 - (t - attack) / max(duration - attack, 1e-6))
    return x ** decay_power


def write_wav(path: Path, samples: Iterable[float], sample_rate: int = SAMPLE_RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for s in samples:
            frames.extend(struct.pack("<h", int(clamp(s) * 32767)))
        wf.writeframes(frames)


def render(duration: float, fn: SampleFn, volume: float = 0.65) -> list[float]:
    total = int(SAMPLE_RATE * duration)
    return [clamp(fn(i / SAMPLE_RATE) * volume) for i in range(total)]


def export_mp3(name: str, samples: list[float], out_dir: Path, bitrate: str = "80k") -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        write_wav(out_dir / f"{name}.wav", samples)
        return
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / f"{name}.wav"
        write_wav(wav_path, samples)
        out_path = out_dir / f"{name}.mp3"
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_path), "-ac", "1", "-b:a", bitrate, str(out_path)],
            check=True,
        )


def sweep(start: float, end: float, t: float, duration: float) -> float:
    return start + (end - start) * min(1.0, max(0.0, t / duration))


def make_sfx() -> dict[str, list[float]]:
    random.seed(42)
    return {
        "sfx_ui_click": render(0.085, lambda t: env_decay(t, 0.085, 0.002, 3.5) * (0.65 * square(1050, t) + 0.35 * sine(2100, t)), 0.35),
        "sfx_shoot_rifle": render(0.115, lambda t: env_decay(t, 0.115, 0.003, 2.2) * (0.75 * square(sweep(620, 240, t, 0.115), t) + 0.25 * noise(t)), 0.42),
        "sfx_shoot_shotgun": render(0.18, lambda t: env_decay(t, 0.18, 0.004, 1.7) * (0.55 * noise(t) + 0.45 * square(sweep(220, 85, t, 0.18), t)), 0.55),
        "sfx_shoot_rail": render(0.22, lambda t: env_decay(t, 0.22, 0.002, 1.2) * (0.72 * sine(sweep(1800, 720, t, 0.22), t) + 0.28 * square(3600, t)), 0.44),
        "sfx_shoot_laser": render(0.16, lambda t: env_decay(t, 0.16, 0.002, 1.4) * (0.85 * sine(sweep(1450, 1850, t, 0.16), t) + 0.15 * sine(2900, t)), 0.38),
        "sfx_hit_enemy": render(0.105, lambda t: env_decay(t, 0.105, 0.002, 2.8) * (0.45 * noise(t) + 0.55 * tri(sweep(320, 170, t, 0.105), t)), 0.42),
        "sfx_enemy_die": render(0.36, lambda t: env_decay(t, 0.36, 0.006, 1.35) * (0.48 * noise(t) + 0.52 * square(sweep(165, 55, t, 0.36), t)), 0.5),
        "sfx_player_hit": render(0.22, lambda t: env_decay(t, 0.22, 0.002, 1.7) * (0.5 * noise(t) + 0.5 * sine(sweep(180, 95, t, 0.22), t)), 0.48),
        "sfx_pickup": render(0.18, lambda t: env_decay(t, 0.18, 0.004, 2.4) * (0.55 * sine(880 + 520 * t / 0.18, t) + 0.45 * sine(1320 + 350 * t / 0.18, t)), 0.35),
        "sfx_level_up": render(0.52, lambda t: env_decay(t, 0.52, 0.01, 1.8) * sum(sine(f, t) for f in (523, 659, 784, 1046)) / 4, 0.42),
        "sfx_chest_open": render(0.42, lambda t: env_decay(t, 0.42, 0.008, 1.6) * (0.35 * noise(t) + 0.65 * sine(440 + 440 * min(1, t / 0.42), t)), 0.42),
        "sfx_boss_warning": render(0.74, lambda t: (0.55 + 0.45 * sine(5, t)) * env_decay(t, 0.74, 0.02, 0.7) * (0.6 * sine(155, t) + 0.4 * sine(310, t)), 0.44),
        "sfx_boss_die": render(0.9, lambda t: env_decay(t, 0.9, 0.015, 1.15) * (0.55 * noise(t) + 0.45 * square(sweep(120, 35, t, 0.9), t)), 0.52),
    }


def note_freq(root: float, semitone: int) -> float:
    return root * (2 ** (semitone / 12))


def make_bgm(duration: float, bpm: int, root: float, mood: str) -> list[float]:
    beat = 60 / bpm
    scale = [0, 3, 5, 7, 10, 12, 15, 17]
    chord_prog = [0, 3, 5, 4] if mood != "boss" else [0, -2, -5, -1]
    samples: list[float] = []
    total = int(SAMPLE_RATE * duration)
    for i in range(total):
        t = i / SAMPLE_RATE
        bar = int(t / (beat * 4))
        beat_pos = (t % beat) / beat
        chord = chord_prog[bar % len(chord_prog)]
        step = int((t / (beat / 2)) % len(scale))
        arp_note = scale[(step + bar) % len(scale)] + chord
        bass_note = chord - 12
        pad_note = chord

        kick = 0.0
        local_beat = t % beat
        if local_beat < 0.07:
            kick = env_decay(local_beat, 0.07, 0.001, 2.0) * sine(sweep(95, 45, local_beat, 0.07), local_beat)

        snare = 0.0
        if int(t / beat) % 4 in (1, 3) and local_beat < 0.055:
            snare = env_decay(local_beat, 0.055, 0.001, 2.2) * noise(t)

        hat = 0.0
        eighth = t % (beat / 2)
        if eighth < 0.025:
            hat = env_decay(eighth, 0.025, 0.001, 3.5) * noise(t)

        arp_env = 1 - beat_pos
        arp = tri(note_freq(root, arp_note + 12), t) * (0.16 + 0.1 * arp_env)
        bass = square(note_freq(root, bass_note), t) * 0.16
        pad = (sine(note_freq(root, pad_note), t) + sine(note_freq(root, pad_note + 7), t)) * 0.075
        groove = kick * 0.38 + snare * 0.12 + hat * 0.055 + arp + bass + pad

        if mood == "hangar":
            groove *= 0.78
            groove += sine(note_freq(root, 12 + scale[(bar + 2) % len(scale)]), t) * 0.055
        elif mood == "boss":
            groove += square(note_freq(root, chord - 24), t) * 0.08
            groove += sine(note_freq(root, arp_note + 24), t) * 0.05

        # Tiny fade in/out prevents clicks; loops are still beat-aligned.
        fade = min(1.0, t / 0.04, (duration - t) / 0.04)
        samples.append(clamp(groove * fade * 0.72))
    return samples


def main() -> None:
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    BGM_DIR.mkdir(parents=True, exist_ok=True)

    for name, samples in make_sfx().items():
        export_mp3(name, samples, SFX_DIR, "80k")

    bgms = {
        "bgm_hangar": make_bgm(24.0, 104, 196.00, "hangar"),
        "bgm_combat_loop": make_bgm(32.0, 124, 220.00, "combat"),
        "bgm_boss_loop": make_bgm(32.0, 132, 174.61, "boss"),
    }
    for name, samples in bgms.items():
        export_mp3(name, samples, BGM_DIR, "72k")

    print(f"Generated {len(make_sfx())} SFX and {len(bgms)} BGM loops under {AUDIO_DIR}")


if __name__ == "__main__":
    main()

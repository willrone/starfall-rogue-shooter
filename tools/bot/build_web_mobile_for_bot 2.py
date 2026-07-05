#!/usr/bin/env python3
"""Build web-mobile for CDP bot tests and reject Cocos empty-main bundles.

Cocos Creator 3.8 CLI can intermittently refresh library/.assets-data.json with
an empty Main.scene value, then still print Finished while producing a 609-byte
assets/main/index.js.  This wrapper validates the artifact and seeds AssetDB with
a known-good scene/script graph before building, then retries once if needed.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COCOS = Path('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator')
CONFIG = ROOT / 'tools/bot/web-mobile-build-config.json'
ASSETS_DATA = ROOT / 'library/.assets-data.json'
ASSETS_DATA_SEED = ROOT / 'tools/bot/assets-data-web-mobile-seed.json'
MAIN_INDEX = ROOT / 'build/web-mobile/assets/main/index.js'
SCENE_UUID = '7a62e49e-945d-49e8-896b-52446b570cc8'
SCRIPT_UUID = '859c9b29-eae6-4b85-8d05-0e2317fe0345'
CONFLICT_COPY_RE = re.compile(r'^(?P<stem>.+) \d+(?P<suffix>(?:\.[^./]+)?)$')
SCENE_VALUE = {
    'depends': ['8bd6ffa0-bf49-45a9-bcc3-690a8d0331bc', '04c9b6a5-7756-4a2b-8cbb-80bbebdedbf1'],
    'dependScripts': [SCRIPT_UUID],
}


def find_macos_conflict_copies(root: Path) -> list[Path]:
    if not root.exists():
        return []
    conflicts: list[Path] = []
    for path in root.rglob('*'):
        if not (path.is_file() or path.is_dir()):
            continue
        match = CONFLICT_COPY_RE.fullmatch(path.name)
        if not match:
            continue
        canonical = path.with_name(match.group('stem') + match.group('suffix'))
        if canonical.exists():
            conflicts.append(path)
    return sorted(conflicts, key=lambda p: len(p.parts), reverse=True)


def clean_macos_conflict_copies() -> None:
    # iCloud/macOS can leave dataless duplicate files such as
    # "RogueShooterGame 2.ts". Cocos imports those as extra scripts, then the
    # build flips between scenes=0/scripts=0 and copyfile -11 failures.
    for root in [ROOT / 'assets', ROOT / 'build/web-mobile']:
        for path in find_macos_conflict_copies(root):
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            print(f'[bot-build] removed macOS conflict copy {path.relative_to(ROOT)}')


def run_build(label: str, *, clean_editor_cache: bool) -> int:
    paths_to_remove = ['build/web-mobile']
    if clean_editor_cache:
        paths_to_remove.append('temp/programming/packer-driver/targets/editor')
    for rel in paths_to_remove:
        path = ROOT / rel
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    log = ROOT / f'temp/builder/log/bot-web-mobile-{label}.log'
    log.parent.mkdir(parents=True, exist_ok=True)
    cmd = [str(COCOS), '--project', str(ROOT), '--build', f'configPath={CONFIG.relative_to(ROOT)}']
    proc = subprocess.run(cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
    log.write_text(proc.stdout)
    scenes = last_log_int(proc.stdout, r'Number of all scenes: (\d+)')
    scripts = last_log_int(proc.stdout, r'Number of all scripts: (\d+)')
    print(f'[bot-build] {label}: exit={proc.returncode} scenes={scenes} scripts={scripts} clean_editor_cache={clean_editor_cache}')
    if '当前初始场景不存在' in proc.stdout:
        print(f'[bot-build] {label}: Cocos reported missing/bundled start scene')
    print(proc.stdout[-2400:])
    return proc.returncode


def last_log_int(text: str, pattern: str) -> int | None:
    matches = re.findall(pattern, text)
    return int(matches[-1]) if matches else None


def artifact_ok() -> bool:
    if not MAIN_INDEX.exists():
        return False
    text = MAIN_INDEX.read_text(errors='ignore')
    return MAIN_INDEX.stat().st_size > 100_000 and 'RogueShooterGame' in text and '__starfallTick' in text


def seed_assets_data() -> None:
    """Restore a known-good AssetDB graph for Main.scene before Cocos CLI build.

    A minimal repair of only the Main.scene row is not enough once Cocos has
    rewritten the database to an empty graph; the builder also needs the script
    and asset rows from a healthy import.  The seed is only used for the bot
    web-mobile test build and never committed back into source assets.
    """
    if ASSETS_DATA_SEED.exists():
        ASSETS_DATA.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ASSETS_DATA_SEED, ASSETS_DATA)
        print(f'[bot-build] seeded {ASSETS_DATA.relative_to(ROOT)} from {ASSETS_DATA_SEED.relative_to(ROOT)}')
        return
    repair_assets_data()


def repair_assets_data() -> None:
    data = {}
    if ASSETS_DATA.exists():
        try:
            data = json.loads(ASSETS_DATA.read_text())
        except Exception:
            data = {}
    data[SCENE_UUID] = {
        'url': 'db://assets/scene/Main.scene',
        'value': SCENE_VALUE,
        'versionCode': max(2, int((data.get(SCENE_UUID) or {}).get('versionCode') or 0)),
    }
    data.setdefault(SCRIPT_UUID, {
        'url': 'db://assets/scripts/RogueShooterGame.ts',
        'value': {},
        'versionCode': 1,
    })
    ASSETS_DATA.parent.mkdir(parents=True, exist_ok=True)
    ASSETS_DATA.write_text(json.dumps(data, ensure_ascii=False))
    print('[bot-build] repaired library/.assets-data.json Main.scene dependency entry')


def main() -> int:
    if not COCOS.exists():
        print(f'Cocos Creator not found: {COCOS}', file=sys.stderr)
        return 2
    if not CONFIG.exists():
        print(f'Missing build config: {CONFIG}', file=sys.stderr)
        return 2

    clean_macos_conflict_copies()

    attempts = [
        ('first', True),
        ('retry-seeded', False),
        ('retry-seeded-2', False),
    ]
    last_code = 36
    for label, clean_editor_cache in attempts:
        seed_assets_data()
        last_code = run_build(label, clean_editor_cache=clean_editor_cache)
        if artifact_ok():
            print(f'[bot-build] web-mobile artifact valid after {label}')
            return 0
        print(f'[bot-build] {label} produced empty/invalid main bundle; will retry if attempts remain')

    size = MAIN_INDEX.stat().st_size if MAIN_INDEX.exists() else None
    print(f'[bot-build] invalid artifact after all retries; main index size={size}', file=sys.stderr)
    return last_code if last_code not in (0, 36) else 2


if __name__ == '__main__':
    raise SystemExit(main())

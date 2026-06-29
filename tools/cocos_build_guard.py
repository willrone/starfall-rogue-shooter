#!/usr/bin/env python3
"""
Guarded Cocos Creator bytedance-mini-game build for Starfall Survivor.

Why this exists:
- Cocos Creator 3.8.8 CLI can return a non-zero macOS code even when the build is usable.
- Worse, bad scene/startScene parameters can still print "Finished" while producing an empty
  main bundle (assets/main/index.js around 609 bytes, scenes=0, scripts=0).
- This script treats the build artifact and build log as the source of truth, not the CLI exit code.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

PROJECT = Path(__file__).resolve().parents[1]
COCOS = Path('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator')
OUTPUT = PROJECT / 'build/bytedance-mini-game'
SLIM2 = PROJECT / 'build/bytedance-mini-game-release-slim2'
BACKUP_ROOT = PROJECT / 'build/.guard-backups'
MAIN_INDEX = OUTPUT / 'assets/main/index.js'
SETTINGS = OUTPUT / 'src/settings.json'
MANIFEST = OUTPUT / 'build-manifest.json'
SIZE_REPORT = OUTPUT / 'size-report.json'
SCENE_META = PROJECT / 'assets/scene/Main.scene.meta'
SCENE_FILE = PROJECT / 'assets/scene/Main.scene'
ASSETS_DATA = PROJECT / 'library/.assets-data.json'
ASSETS_DATA_SEED = PROJECT / 'tools/bot/assets-data-web-mobile-seed.json'
BUILD_CONFIG = PROJECT / 'tools/bytedance-build-config.json'
RUNTIME_BUILD_CONFIG = PROJECT / 'temp/build-guard/bytedance-build-config.runtime.json'
LOG_DIR = PROJECT / 'temp/builder/log'
SCENE_UUID = '7a62e49e-945d-49e8-896b-52446b570cc8'
MIN_MAIN_INDEX_BYTES = 100_000
MAX_BYTEDANCE_PROJECT_BYTES = 12 * 1024 * 1024
MACOS_CONFLICT_COPY_RE = re.compile(r'^(?P<stem>.+) \d+(?P<suffix>(?:\.[^./]+)?)$')
KNOWN_GOOD_SCENE_DIR_META = {
    'ver': '0.0.1',
    'importer': '*',
    'imported': True,
    'uuid': 'cfec0a24-c0f1-4f30-aac7-9e54edc44eb3',
    'files': [],
    'subMetas': {},
    'userData': {},
}
KNOWN_GOOD_MAIN_SCENE_META = {
    'ver': '0.0.1',
    'importer': '*',
    'imported': True,
    'uuid': SCENE_UUID,
    'files': ['.scene'],
    'subMetas': {},
    'userData': {},
}


def info(msg: str) -> None:
    print(f'[build-guard] {msg}', flush=True)


def fail(msg: str, code: int = 1) -> None:
    print(f'[build-guard] ERROR: {msg}', file=sys.stderr, flush=True)
    raise SystemExit(code)


def run(cmd: list[str], *, timeout: int = 900) -> subprocess.CompletedProcess[str]:
    info('$ ' + ' '.join(cmd))
    return subprocess.run(
        cmd,
        cwd=PROJECT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
    )


def git_output(args: list[str]) -> str | None:
    try:
        result = subprocess.run(['git', *args], cwd=PROJECT, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
        if result.returncode != 0:
            return None
        return result.stdout.strip()
    except Exception:
        return None


def git_info() -> dict[str, object]:
    status = git_output(['status', '--short']) or ''
    return {
        'commit': git_output(['rev-parse', 'HEAD']),
        'short_commit': git_output(['rev-parse', '--short', 'HEAD']),
        'branch': git_output(['rev-parse', '--abbrev-ref', 'HEAD']),
        'dirty': bool(status),
        'dirty_entries': len([line for line in status.splitlines() if line.strip()]),
    }


def rel(path: Path) -> str:
    return str(path.relative_to(PROJECT))


def find_macos_conflict_copies(root: Path) -> list[Path]:
    """Find generated "name 2.ext" conflict copies in build output.

    These show up when macOS/iCloud leaves dataless duplicate placeholders in
    generated folders.  Python's shutil.copytree/copy2 then fails with
    OSError(11, "Resource deadlock avoided") while backing up the build.
    They are never part of a valid Cocos/Douyin package, so builds should clean
    them and validation should reject them if they remain.
    """
    if not root.exists():
        return []
    return sorted(
        (
            p for p in root.rglob('*')
            if (p.is_file() or p.is_dir())
            and (match := MACOS_CONFLICT_COPY_RE.fullmatch(p.name))
            and p.with_name(match.group('stem') + match.group('suffix')).exists()
        ),
        key=lambda p: len(p.parts),
        reverse=True,
    )


def clean_macos_conflict_copies(root: Path) -> None:
    conflicts = find_macos_conflict_copies(root)
    for path in conflicts:
        try:
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            info(f'removed macOS conflict copy {rel(path)}')
        except OSError as exc:
            fail(f'cannot remove macOS conflict copy {rel(path)}: {exc}')


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def collect_size_report() -> dict[str, object]:
    files = [p for p in OUTPUT.rglob('*') if p.is_file()] if OUTPUT.exists() else []
    total = sum(p.stat().st_size for p in files)
    by_top: dict[str, int] = {}
    by_ext: dict[str, int] = {}
    for p in files:
        relative = p.relative_to(OUTPUT)
        top = relative.parts[0] if relative.parts else '.'
        by_top[top] = by_top.get(top, 0) + p.stat().st_size
        ext = p.suffix.lower() or '<none>'
        by_ext[ext] = by_ext.get(ext, 0) + p.stat().st_size
    top_files = [
        {'path': str(p.relative_to(OUTPUT)), 'bytes': p.stat().st_size, 'mib': round(p.stat().st_size / 1024 / 1024, 3)}
        for p in sorted(files, key=lambda item: item.stat().st_size, reverse=True)[:30]
    ]
    return {
        'output': rel(OUTPUT),
        'total_bytes': total,
        'total_mib': round(total / 1024 / 1024, 3),
        'limit_bytes': MAX_BYTEDANCE_PROJECT_BYTES,
        'limit_mib': round(MAX_BYTEDANCE_PROJECT_BYTES / 1024 / 1024, 3),
        'by_top_level': dict(sorted(by_top.items(), key=lambda item: item[1], reverse=True)),
        'by_extension': dict(sorted(by_ext.items(), key=lambda item: item[1], reverse=True)),
        'top_files': top_files,
    }


def write_json(path: Path, data: dict[str, object]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def write_reports(markers: Iterable[str], *, debug: bool, log_info: dict[str, object] | None = None) -> dict[str, object]:
    size_report = collect_size_report()
    manifest = {
        'generated_at': utc_now_iso(),
        'project': 'starfall-rogue-shooter',
        'platform': 'bytedance-mini-game',
        'output': rel(OUTPUT),
        'debug': debug,
        'git': git_info(),
        'markers': list(markers),
        'main_index_bytes': MAIN_INDEX.stat().st_size if MAIN_INDEX.exists() else None,
        'settings_script_packages': read_settings_script_packages(),
        'size': size_report,
        'log': log_info,
        'douyin_devtools_entry': rel(OUTPUT),
    }
    if OUTPUT.exists():
        write_json(SIZE_REPORT, size_report)
        write_json(MANIFEST, manifest)
        info(f'wrote {rel(MANIFEST)} and {rel(SIZE_REPORT)}')
    return manifest


def print_size_report() -> None:
    report = collect_size_report()
    print(json.dumps(report, ensure_ascii=False, indent=2))


def preflight() -> None:
    if not COCOS.exists():
        fail(f'Cocos Creator not found: {COCOS}')
    if not SCENE_FILE.exists():
        fail(f'Main scene missing: {SCENE_FILE}')
    if not SCENE_META.exists():
        fail(f'Main scene meta missing: {SCENE_META}')

    meta = json.loads(SCENE_META.read_text())
    if meta.get('uuid') != SCENE_UUID:
        fail(f'Main.scene uuid changed: {meta.get("uuid")} != {SCENE_UUID}')
    user_data = meta.get('userData') or {}
    if user_data.get('isBundle') or user_data.get('bundleName'):
        fail(f'Main.scene is marked as bundle asset in meta userData: {user_data}')

    if ASSETS_DATA.exists():
        data = json.loads(ASSETS_DATA.read_text())
        entry = data.get(SCENE_UUID)
        if not entry:
            fail(f'AssetDB does not know Main.scene uuid {SCENE_UUID}; open Cocos once to reimport assets')
        if entry.get('url') != 'db://assets/scene/Main.scene':
            fail(f'AssetDB scene URL mismatch: {entry.get("url")}')
        deps = ((entry.get('value') or {}).get('dependScripts') or [])
        if not deps:
            fail('AssetDB Main.scene has no dependScripts; scene may not be bound to RogueShooterGame')
    else:
        info('library/.assets-data.json not found; skipping AssetDB dependency check')

    info('preflight ok')


def write_json_if_changed(path: Path, data: dict[str, object]) -> None:
    desired = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    current = path.read_text() if path.exists() else ''
    if current != desired:
        path.write_text(desired)
        info(f'normalized {path.relative_to(PROJECT)}')


def normalize_scene_meta() -> None:
    # Cocos may rewrite these meta files during CLI builds to importer="scene" / files=[".json"].
    # For this project, the tracked wildcard meta shape is the most stable CLI input.
    write_json_if_changed(PROJECT / 'assets/scene.meta', KNOWN_GOOD_SCENE_DIR_META)
    write_json_if_changed(SCENE_META, KNOWN_GOOD_MAIN_SCENE_META)


def assetdb_scene_deps_ok() -> bool:
    if not ASSETS_DATA.exists():
        return False
    try:
        data = json.loads(ASSETS_DATA.read_text())
    except Exception:
        return False
    entry = data.get(SCENE_UUID) or {}
    value = entry.get('value') or {}
    return bool(value.get('dependScripts')) and entry.get('url') == 'db://assets/scene/Main.scene'


def seed_assetdb_if_needed() -> None:
    # Web-mobile and bytedance builds share library/.assets-data.json. Cocos may
    # "resume" AssetDB after a build with Main.scene value={}, which makes the
    # next CLI build validate startScene(undefined) or produce an empty bundle.
    if assetdb_scene_deps_ok():
        return
    if ASSETS_DATA_SEED.exists():
        ASSETS_DATA.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ASSETS_DATA_SEED, ASSETS_DATA)
        info(f'seeded {rel(ASSETS_DATA)} from {rel(ASSETS_DATA_SEED)}')
        return
    fail(f'AssetDB Main.scene has no dependScripts and seed file is missing: {rel(ASSETS_DATA_SEED)}')


def write_runtime_build_config(*, debug: bool) -> Path:
    """Write a guard-owned Cocos configPath file for bytedance builds.

    Passing only semicolon args lets Cocos 3.8 recover a stale/empty AssetDB
    state and intermittently validate startScene(undefined). A full configPath
    pins startScene + scenes exactly like the editor-completed options and is
    the stable CLI input for this project.
    """
    if not BUILD_CONFIG.exists():
        fail(f'bytedance build config missing: {rel(BUILD_CONFIG)}')
    config = json.loads(BUILD_CONFIG.read_text())
    config['debug'] = debug
    config['platform'] = 'bytedance-mini-game'
    config['outputName'] = 'bytedance-mini-game'
    config['taskName'] = 'bytedance-mini-game'
    config['startScene'] = SCENE_UUID
    config['scenes'] = [{'url': 'db://assets/scene/Main.scene', 'uuid': SCENE_UUID}]
    packages = config.setdefault('packages', {})
    bytedance = packages.setdefault('bytedance-mini-game', {})
    bytedance['orientation'] = 'portrait'
    RUNTIME_BUILD_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    write_json(RUNTIME_BUILD_CONFIG, config)
    info(f'wrote runtime build config {rel(RUNTIME_BUILD_CONFIG)}')
    return RUNTIME_BUILD_CONFIG


def latest_build_log(start_time: float | None = None) -> Path | None:
    if not LOG_DIR.exists():
        return None
    logs = list(LOG_DIR.glob('bytedance-mini-game*.log'))
    if start_time is not None:
        fresh = [p for p in logs if p.stat().st_mtime >= start_time - 2]
        if fresh:
            logs = fresh
    if not logs:
        return None
    return max(logs, key=lambda p: p.stat().st_mtime)


def parse_log(log_path: Path | None) -> dict[str, object]:
    if not log_path or not log_path.exists():
        return {'path': None, 'finished': False, 'scenes': None, 'scripts': None, 'empty_main_symptoms': False}
    text = log_path.read_text(errors='ignore')

    def last_int(pattern: str) -> int | None:
        matches = re.findall(pattern, text)
        return int(matches[-1]) if matches else None

    scenes = last_int(r'Number of all scenes: (\d+)')
    scripts = last_int(r'Number of all scripts: (\d+)')
    return {
        'path': str(log_path.relative_to(PROJECT)),
        'finished': 'build Task (bytedance-mini-game) Finished' in text,
        'scenes': scenes,
        'scripts': scripts,
        'start_scene_error': '当前初始场景不存在' in text or 'startScene' in text and '校验失败' in text,
        'empty_main_symptoms': scenes == 0 or scripts == 0,
    }


def read_settings_script_packages() -> list[str]:
    if not SETTINGS.exists():
        return []
    try:
        settings = json.loads(SETTINGS.read_text())
    except Exception:
        return []
    return list(((settings.get('scripting') or {}).get('scriptPackages') or []))


def validate_bytedance_project() -> list[str]:
    errors: list[str] = []
    conflict_copies = find_macos_conflict_copies(OUTPUT)
    if conflict_copies:
        preview = ', '.join(rel(p) for p in conflict_copies[:8])
        suffix = '' if len(conflict_copies) <= 8 else f', ... +{len(conflict_copies) - 8} more'
        errors.append(f'unexpected macOS conflict-copy files in build output: {preview}{suffix}')

    required = [
        'project.config.json',
        'game.json',
        'game.js',
        'src/settings.json',
        'assets/main/index.js',
        'engine-adapter.js',
        'web-adapter.js',
    ]
    for required_rel in required:
        if not (OUTPUT / required_rel).exists():
            errors.append(f'missing bytedance project file: {required_rel}')

    try:
        project_config = json.loads((OUTPUT / 'project.config.json').read_text())
        if project_config.get('projectname') != 'starfall-rogue-shooter':
            errors.append(f'unexpected project.config.json projectname: {project_config.get("projectname")}')
    except Exception as exc:
        errors.append(f'project.config.json is not valid JSON: {exc}')

    try:
        game_json = json.loads((OUTPUT / 'game.json').read_text())
        if game_json.get('deviceOrientation') != 'portrait':
            errors.append(f'game.json deviceOrientation is not portrait: {game_json.get("deviceOrientation")}')
    except Exception as exc:
        errors.append(f'game.json is not valid JSON: {exc}')

    total_bytes = sum(p.stat().st_size for p in OUTPUT.rglob('*') if p.is_file()) if OUTPUT.exists() else 0
    if total_bytes > MAX_BYTEDANCE_PROJECT_BYTES:
        errors.append(
            f'bytedance project too large: {total_bytes / 1024 / 1024:.2f} MiB '
            f'> {MAX_BYTEDANCE_PROJECT_BYTES / 1024 / 1024:.2f} MiB'
        )
    return errors


def validate_artifact(markers: Iterable[str], *, require_log: bool, start_time: float | None = None) -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not MAIN_INDEX.exists():
        errors.append(f'missing {MAIN_INDEX.relative_to(PROJECT)}')
        return False, errors

    size = MAIN_INDEX.stat().st_size
    if size < MIN_MAIN_INDEX_BYTES:
        errors.append(f'main index too small: {size} bytes < {MIN_MAIN_INDEX_BYTES}; likely empty main bundle')

    text = MAIN_INDEX.read_text(errors='ignore')
    if 'RogueShooterGame' not in text:
        errors.append('main index does not contain RogueShooterGame')
    for marker in markers:
        if marker and marker not in text:
            errors.append(f'main index missing marker: {marker}')

    script_packages = read_settings_script_packages()
    if not script_packages:
        errors.append('settings.json has empty scripting.scriptPackages')
    errors.extend(validate_bytedance_project())

    if require_log:
        log_info = parse_log(latest_build_log(start_time))
        info(f'latest log: {log_info}')
        if not log_info['finished']:
            errors.append('latest bytedance build log has no Finished marker')
        if log_info['empty_main_symptoms']:
            errors.append(f'latest bytedance build log has scenes={log_info["scenes"]}, scripts={log_info["scripts"]}')
        if log_info.get('start_scene_error'):
            errors.append('latest bytedance build log contains startScene validation error')

    return len(errors) == 0, errors


def backup_current() -> Path | None:
    if not OUTPUT.exists():
        return None
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    dst = BACKUP_ROOT / f'bytedance-mini-game-{stamp}'
    shutil.copytree(OUTPUT, dst)
    info(f'backed up current build to {dst.relative_to(PROJECT)}')
    return dst


def restore_backup(backup: Path | None) -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    if backup and backup.exists():
        shutil.copytree(backup, OUTPUT)
        info(f'restored previous build from {backup.relative_to(PROJECT)}')


def sync_slim2() -> None:
    if SLIM2.exists():
        shutil.rmtree(SLIM2)
    shutil.copytree(OUTPUT, SLIM2)
    info(f'synced valid build to {SLIM2.relative_to(PROJECT)}')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--marker', action='append', default=[], help='string that must appear in assets/main/index.js')
    parser.add_argument('positional_markers', nargs='*', help='marker strings passed through npm scripts')
    parser.add_argument('--skip-typecheck', action='store_true')
    parser.add_argument('--skip-tests', action='store_true')
    parser.add_argument('--skip-sim', action='store_true')
    parser.add_argument('--validate-existing', action='store_true', help='do not build; validate current build folder')
    parser.add_argument('--preflight-only', action='store_true')
    parser.add_argument('--sync-slim2', action='store_true', help='copy valid build to release-slim2')
    parser.add_argument('--debug', action='store_true', help='build debug=true; default is release/debug=false for Douyin devtools package size')
    parser.add_argument('--size-report', action='store_true', help='validate current bytedance build and print size report JSON')
    args = parser.parse_args()
    args.marker = [*args.marker, *args.positional_markers]

    if not args.validate_existing and not args.preflight_only:
        clean_macos_conflict_copies(PROJECT / 'assets')
        normalize_scene_meta()
        seed_assetdb_if_needed()
    preflight()
    if args.preflight_only:
        return

    if args.size_report:
        ok, errors = validate_artifact(args.marker, require_log=False)
        print_size_report()
        if not ok:
            fail('current bytedance build invalid:\n  - ' + '\n  - '.join(errors))
        return

    if args.validate_existing:
        ok, errors = validate_artifact(args.marker, require_log=False)
        if not ok:
            fail('existing build invalid:\n  - ' + '\n  - '.join(errors))
        info('existing build valid')
        if args.sync_slim2:
            sync_slim2()
        return

    if not args.skip_typecheck:
        res = run(['npm', 'run', 'typecheck'], timeout=300)
        print(res.stdout)
        if res.returncode != 0:
            fail(f'typecheck failed with code {res.returncode}')
    if not args.skip_tests:
        res = run(['npm', 'test'], timeout=300)
        print(res.stdout)
        if res.returncode != 0:
            fail(f'tests failed with code {res.returncode}')
    if not args.skip_sim:
        res = run(['npm', 'run', 'balance:cdp'], timeout=900)
        print(res.stdout)
        if res.returncode != 0:
            fail(f'CDP balance run failed with code {res.returncode}. Start the headed Cocos web build in Chrome with --remote-debugging-port=9222, or pass --skip-sim for build-only validation.')

    clean_macos_conflict_copies(PROJECT / 'assets')
    clean_macos_conflict_copies(OUTPUT)  # macOS conflicts cause shutil.copytree to fail in backup_current()
    backup = backup_current()

    # Retry loop — Cocos CLI bytedance builds can intermittently produce an empty
    # main bundle (scenes=0/scripts=0, 590-byte index.js). Web-mobile builder
    # handles this with retry + AssetDB re-seed; do the same here.
    max_attempts = 3
    attempt = 0
    ok = False
    errors = []
    last_log_info = None
    start = time.time()
    res = None
    while attempt < max_attempts:
        attempt += 1
        info(f'build attempt {attempt}/{max_attempts}')

        # Before each attempt: refresh all known failure mitigations.
        clean_macos_conflict_copies(PROJECT / 'assets')  # macOS conflicts cause scene import issues
        seed_assetdb_if_needed()                          # Cocos may corrupt AssetDB after failed build
        clean_macos_conflict_copies(OUTPUT)               # stale conflict copies from prior attempt

        editor_cache = PROJECT / 'temp/programming/packer-driver/targets/editor'
        if editor_cache.exists():
            shutil.rmtree(editor_cache)

        # Cocos 3.8.8 configPath=... approach silently produces scenes=0/scripts=0
        # for bytedance-mini-game builds. Semicolon-level CLI syntax is reliable.
        cli_args = 'platform=bytedance-mini-game;debug={}'.format(str(args.debug).lower())
        attempt_start = time.time()
        res = run([str(COCOS), '--project', str(PROJECT), '--build', cli_args], timeout=900)
        print(res.stdout)
        attempt_dur = time.time() - attempt_start

        normalize_scene_meta()
        clean_macos_conflict_copies(OUTPUT)
        last_log_info = parse_log(latest_build_log(attempt_start))
        ok, errors = validate_artifact(args.marker, require_log=True, start_time=attempt_start)

        if ok:
            info(f'build artifact valid on attempt {attempt} ({attempt_dur:.0f}s)')
            break

        info(f'build attempt {attempt} produced invalid artifact ({attempt_dur:.0f}s):')
        for e in errors:
            info(f'  - {e}')

        if attempt < max_attempts:
            # Clean output directory so next attempt starts fresh
            if OUTPUT.exists():
                shutil.rmtree(str(OUTPUT))
            info('will retry with fresh AssetDB seed and clean editor cache')

    if not ok:
        restore_backup(backup)
        normalize_scene_meta()
        fail(
            f'build artifact invalid after {max_attempts} Cocos attempts ({time.time() - start:.0f}s):\n'
            + '  - ' + '\n  - '.join(errors),
            code=2,
        )

    log_info = last_log_info
    write_reports(args.marker, debug=args.debug, log_info=log_info)

    # Cocos on macOS commonly exits 36 even for valid builds. Treat artifact validation as final.
    if res.returncode not in (0, 36):
        info(f'Cocos exited {res.returncode}, but artifact validation passed; keeping build')
    else:
        info(f'Cocos exited {res.returncode}; artifact validation passed')

    if args.sync_slim2:
        sync_slim2()


if __name__ == '__main__':
    main()

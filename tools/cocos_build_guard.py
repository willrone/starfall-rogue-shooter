#!/usr/bin/env python3
"""
cocos_build_guard.py — 抖音小游戏构建包装器。

流程: typecheck → test → Cocos build → 产物校验
不依赖构建日志解析、备份/恢复、macOS 冲突副本清除、AssetDB 种子预设。
"""
import argparse, json, subprocess, sys, time
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
COCOS = Path('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator')
OUTPUT = PROJECT / 'build/bytedance-mini-game'
MAIN_INDEX = OUTPUT / 'assets/main/index.js'
MIN_MAIN_INDEX = 100_000
MAX_TOTAL = 19 * 1024 * 1024

def run(cmd, timeout=600):
    print(f'$ {" ".join(cmd)}', flush=True)
    return subprocess.run(cmd, cwd=PROJECT, text=True, stdout=subprocess.PIPE, timeout=timeout)

def validate():
    errors = []
    if not MAIN_INDEX.exists():
        errors.append(f'missing {MAIN_INDEX.relative_to(PROJECT)}')
    elif MAIN_INDEX.stat().st_size < MIN_MAIN_INDEX:
        errors.append(f'{MAIN_INDEX.relative_to(PROJECT)} size {MAIN_INDEX.stat().st_size} < {MIN_MAIN_INDEX}')
    for f in ['project.config.json', 'game.json', 'game.js', 'src/settings.json', 'engine-adapter.js']:
        if not (OUTPUT / f).exists(): errors.append(f'missing {f}')
    total = sum(p.stat().st_size for p in OUTPUT.rglob('*') if p.is_file())
    if total > MAX_TOTAL:
        errors.append(f'build too large: {total/1024/1024:.1f}MiB > {MAX_TOTAL/1024/1024:.0f}MiB')
    return errors

def print_size_report():
    if not OUTPUT.exists(): return
    files = [(p, p.stat().st_size) for p in OUTPUT.rglob('*') if p.is_file()]
    total = sum(s for _, s in files)
    by_ext = {}
    for p, s in files:
        ext = p.suffix or '<none>'
        by_ext[ext] = by_ext.get(ext, 0) + s
    top = sorted(files, key=lambda x: -x[1])[:10]
    print('=== Size Report ===')
    print(f'Total: {total/1024/1024:.2f} MiB')
    print(f'Limit: {MAX_TOTAL/1024/1024:.0f} MiB')
    print('By extension:', {k: f'{v/1024/1024:.1f}MiB' for k, v in sorted(by_ext.items(), key=lambda x: -x[1])})
    print('Top files:', [{'path': str(p.relative_to(OUTPUT)), 'size': f'{s/1024/1024:.2f}MiB'} for p, s in top])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-typecheck', action='store_true')
    parser.add_argument('--skip-tests', action='store_true')
    parser.add_argument('--skip-build', action='store_true', help='validate existing build only')
    parser.add_argument('--size-report', action='store_true')
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()

    if args.size_report:
        print_size_report()
        return

    if not args.skip_typecheck:
        r = run(['npm', 'run', 'typecheck'], timeout=120)
        print(r.stdout)
        if r.returncode != 0: sys.exit(f'typecheck failed ({r.returncode})')

    if not args.skip_tests:
        r = run(['npm', 'test'], timeout=300)
        print(r.stdout)
        if r.returncode != 0: sys.exit(f'tests failed ({r.returncode})')

    if args.skip_build:
        errors = validate()
        print_size_report()
        if errors:
            sys.exit('Existing build invalid:\n  - ' + '\n  - '.join(errors))
        print('Existing build valid')
        return

    r = run([str(COCOS), '--project', str(PROJECT), '--build', 'platform=bytedance-mini-game;debug={}'.format(str(args.debug).lower())], timeout=900)
    print(r.stdout)
    errors = validate()
    if errors and r.returncode == 0:
        errors.append('Cocos exited 0 but artifact is invalid')

    if errors:
        sys.exit('Build invalid:\n  - ' + '\n  - '.join(errors))
    print('Build valid')
    print_size_report()
    if r.returncode not in (0, 36):
        print(f'Cocos exited {r.returncode} but artifact OK')

if __name__ == '__main__':
    main()

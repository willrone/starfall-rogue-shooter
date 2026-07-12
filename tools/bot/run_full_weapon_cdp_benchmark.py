#!/usr/bin/env python3
"""
Full-weapon CDP benchmark runner for Starfall Rogue Shooter.

每把武器 fresh Chrome CDP 独立 profile 开局 → 运行 max_seconds → 输出 runs.csv。

Usage:
    python3 scripts/run_full_weapon_cdp_benchmark.py

Environment variables:
    STARFALL_MAX_SECONDS  (default: 600)
    STARFALL_STEP_SECONDS (default: 5)
    STARFALL_RUNS         (default: 1)
    STARFALL_SEED         (default: 42)
    STARFALL_OUT          (output directory, auto-generated if unset)

Output: runs.csv + summary.json + partial.json (continuous).
"""
import csv, json, os, shutil, signal, subprocess, sys, time, urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT = Path(os.environ.get('PROJECT_DIR', '/Users/ronghui/Documents/game_dev_cocos'))
sys.path.insert(0, str(PROJECT))
os.chdir(PROJECT)

from tools.bot.cdp_client import CDPClient
from tools.bot.run_balance_cdp import (
    RunResult, advance_elapsed, chase_boss, derive_run_seed, ensure_game_ready, handle_modal_choices,
    read_state, select_requested_weapons, start_real_run, summarize, tick_real_game, trigger_shop, weapon_catalog,
)

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
BASE_PORT = int(os.environ.get('STARFALL_BASE_PORT', '9330'))
MAX_SECONDS = int(os.environ.get('STARFALL_MAX_SECONDS', '600'))
STEP_SECONDS = int(os.environ.get('STARFALL_STEP_SECONDS', '5'))
RUNS = int(os.environ.get('STARFALL_RUNS', '1'))
SEED = int(os.environ.get('STARFALL_SEED', '42'))
WITH_OFFHAND = os.environ.get('STARFALL_WITH_OFFHAND', '0').lower() in {'1', 'true', 'yes'}
WITH_SHOP = os.environ.get('STARFALL_WITH_SHOP', '0').lower() in {'1', 'true', 'yes'}
CANONICAL = os.environ.get('STARFALL_CANONICAL', '0').lower() in {'1', 'true', 'yes'}
WEAPON_FILTER = {
    value.strip() for value in os.environ.get('STARFALL_WEAPONS', '').split(',') if value.strip()
}
OUT = Path(os.environ.get('STARFALL_OUT') or (PROJECT / 'data' / ('cdp_bench_' + time.strftime('%Y%m%d_%H%M%S'))))
OUT.mkdir(parents=True, exist_ok=True)


def log(msg: str) -> None:
    print(time.strftime('[%H:%M:%S]'), msg, flush=True)


def _wait_json(port: int, timeout_s: int = 45) -> List[Dict[str, Any]]:
    for _ in range(timeout_s):
        try:
            with urllib.request.urlopen(f'http://localhost:{port}/json', timeout=1) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception:
            time.sleep(1)
    raise RuntimeError(f'Chrome CDP /json not ready on {port}')


def _start_chrome(port: int, tag: str) -> subprocess.Popen:
    profile = Path(f'/tmp/starfall-cdp-bench-{port}')
    shutil.rmtree(profile, ignore_errors=True)
    url = f'http://localhost:7457/?bench={tag}_{int(time.time())}'
    args = [
        CHROME, f'--remote-debugging-port={port}', '--remote-allow-origins=*',
        f'--user-data-dir={profile}', '--no-first-run', '--disable-default-apps',
        '--disable-extensions', '--new-window', url,
    ]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _wait_json(port)
    return proc


def _stop_chrome(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        proc.terminate(); proc.wait(timeout=5)
    except Exception:
        try: proc.kill()
        except Exception: pass


def _connect(port: int) -> CDPClient:
    cdp = CDPClient(port=port)
    for _ in range(30):
        try:
            if cdp.connect(target_url_filter='localhost:7457'):
                ensure_game_ready(cdp)
                return cdp
        except Exception:
            time.sleep(1)
    raise RuntimeError(f'Game hooks not ready on {port}')


def validate_benchmark_configuration(
    weapons: List[Dict[str, Any]],
    *,
    runs: int,
    max_seconds: int,
    step_seconds: int,
    canonical: bool = False,
) -> None:
    if runs <= 0:
        raise ValueError(f'RUNS must be positive, got {runs}')
    if max_seconds <= 0:
        raise ValueError(f'MAX_SECONDS must be positive, got {max_seconds}')
    if step_seconds <= 0:
        raise ValueError(f'STEP_SECONDS must be positive, got {step_seconds}')
    if not weapons:
        raise ValueError('No weapons selected for benchmark')
    ids = [str(w.get('id')) for w in weapons]
    if len(set(ids)) != len(ids):
        raise ValueError(f'Duplicate weapon ids selected: {ids}')
    if canonical and (len(ids) != 17 or runs != 1):
        raise ValueError(f'Canonical benchmark requires exactly 17 weapons and 1 run each, got weapons={len(ids)} runs={runs}')


def _run_one(cdp: CDPClient, weapon: Dict[str, Any], run_idx: int, seed: int) -> RunResult:
    start_real_run(cdp, weapon['id'], seed, with_offhand=WITH_OFFHAND)
    final_state, elapsed, shop_interval, next_shop_at = {}, 0.0, 28, 28
    iterations = 0
    max_iterations = max(100, int(MAX_SECONDS) * max(20, int(60 / max(1, STEP_SECONDS))))
    while elapsed < MAX_SECONDS and iterations < max_iterations:
        iterations += 1
        requested_seconds = min(STEP_SECONDS, MAX_SECONDS - elapsed)
        frames = max(1, int(requested_seconds * 60))
        ran_frames = tick_real_game(cdp, frames)
        state = read_state(cdp)
        previous_elapsed = elapsed
        elapsed = advance_elapsed(elapsed, state, ran_frames)
        if elapsed <= previous_elapsed and ran_frames <= 0:
            raise RuntimeError(f'insufficient combat-time progress: elapsed={elapsed:.2f}s ran_frames={ran_frames}')
        final_state = state
        handle_modal_choices(cdp, state)
        phase = state.get('phase')
        if WITH_SHOP and phase == 'combat' and elapsed >= next_shop_at and elapsed < MAX_SECONDS - 10:
            next_shop_at += shop_interval
            trigger_shop(cdp)
        if phase == 'combat':
            try: chase_boss(cdp)
            except Exception: pass
        hp = float(state.get('hp') or 0)
        if elapsed % 60 == 0 or hp <= 0 or phase in {'settlement', 'hangar', 'menu'}:
            log(f"  {weapon.get('name', weapon['id'])}: t={state.get('combatTime')} wave={state.get('wave')} kills={state.get('kills')} lv={state.get('level')} hp={state.get('hp')} phase={phase}")
        if hp <= 0 or phase in {'settlement', 'hangar', 'menu'}:
            break
    if iterations >= max_iterations and elapsed < MAX_SECONDS:
        raise RuntimeError(f'insufficient combat-time progress: elapsed={elapsed:.2f}s iterations={iterations}')
    wave = int(final_state.get('wave') or 0); hp = float(final_state.get('hp') or 0)
    tier = weapon.get('tier', 'standard')
    return RunResult(weapon_id=weapon['id'], weapon_name=weapon.get('name', weapon['id']),
        tier=tier, target_profile=tier, run=run_idx, seed=seed, final_wave=wave,
        combat_time=float(final_state.get('combatTime') or 0), kills=int(final_state.get('kills') or 0),
        level=int(final_state.get('level') or 0), alloy=int(final_state.get('alloy') or 0),
        items=int(final_state.get('items') or 0), phase=str(final_state.get('phase') or 'unknown'),
        hp=hp, died=hp <= 0)


def _weapons(cdp: CDPClient) -> List[Dict[str, Any]]:
    from tools.bot.run_balance_cdp import WEAPON_TIER_MAP
    ws = weapon_catalog(cdp)
    legacy = {'storm-rifle', 'split-barrel', 'orbital-drone'}
    ws = [w for w in ws if w.get('id') and (w.get('base_family') or str(w['id']).endswith('-standard') or w['id'] in legacy)]
    ws = select_requested_weapons(ws, sorted(WEAPON_FILTER) if WEAPON_FILTER else None)
    for w in ws:
        fam = w.get('family', w['id'])
        w['tier'] = WEAPON_TIER_MAP.get(fam, WEAPON_TIER_MAP.get(str(w['id']).replace('-standard', ''), 'standard'))
    return ws


def benchmark_failed_ids(results: List[Dict[str, Any]], summary_error: str = '') -> List[str]:
    failed = [
        str(row.get('weapon_id'))
        for row in results
        if row.get('phase') == 'error' or int(row.get('runtime_errors') or 0) > 0
    ]
    if summary_error:
        failed.append('summary')
    return failed


def main() -> int:
    log(f'OUT={OUT}')
    log(f'MAX_SECONDS={MAX_SECONDS}')
    log(f'WITH_OFFHAND={WITH_OFFHAND} WITH_SHOP={WITH_SHOP}')
    # bootstrap catalog
    proc = _start_chrome(BASE_PORT, 'catalog')
    try: weapons = _weapons(_connect(BASE_PORT))
    finally: _stop_chrome(proc)
    log(f'WEAPONS={len(weapons)}')
    validate_benchmark_configuration(
        weapons,
        runs=RUNS,
        max_seconds=MAX_SECONDS,
        step_seconds=STEP_SECONDS,
        canonical=CANONICAL,
    )

    results, fields = [], list(RunResult.__dataclass_fields__.keys()) + ['runtime_errors', 'cdp_error']
    runs_csv = OUT / 'runs.csv'
    with runs_csv.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
        writer.writeheader(); f.flush()
        for wi, weapon in enumerate(weapons):
            for ri in range(RUNS):
                port = BASE_PORT + 1 + wi * RUNS + ri
                u_seed = derive_run_seed(SEED, str(weapon['id']), wi, ri + 1, per_weapon_seed=False)
                log(f"== {wi+1}/{len(weapons)} run {ri+1}/{RUNS}: {weapon.get('name', weapon['id'])} ({weapon['id']}) port={port} seed={u_seed} ==")
                row, cdp_err, rt_errs = None, '', 0
                p = _start_chrome(port, f"{wi}_{weapon['id']}")
                try:
                    cdp = _connect(port)
                    result = _run_one(cdp, weapon, ri + 1, u_seed)
                    row = asdict(result)
                    cdp.close()
                except Exception as e:
                    cdp_err = repr(e); log(f"  ERROR {weapon['id']}: {cdp_err}")
                    row = asdict(RunResult(weapon_id=weapon['id'], weapon_name=weapon.get('name', weapon['id']),
                        tier=weapon.get('tier', 'standard'), target_profile=weapon.get('tier', 'standard'),
                        run=ri+1, seed=u_seed, final_wave=0, combat_time=0.0, kills=0, level=0, alloy=0, items=0,
                        phase='error', hp=0.0, died=True, error=cdp_err))
                    rt_errs = 1
                finally: _stop_chrome(p)
                row['runtime_errors'] = rt_errs; row['cdp_error'] = cdp_err
                writer.writerow(row); f.flush(); results.append(row)
                (OUT / 'partial.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
                log(f"  DONE {weapon['id']}: wave={row.get('final_wave')} kills={row.get('kills')} t={row.get('combat_time')} lv={row.get('level')}")

    run_results = [RunResult(**{k: r.get(k) for k in RunResult.__dataclass_fields__.keys()}) for r in results]
    summary_error = ''
    try:
        summary = summarize(run_results)
    except Exception as e:
        summary_error = repr(e)
        summary = [{'error': summary_error}]
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    sample_counts = {wid: sum(1 for row in results if row.get('weapon_id') == wid) for wid in {str(row.get('weapon_id')) for row in results}}
    bundle = PROJECT / 'build' / 'web-mobile' / 'assets' / 'main' / 'index.js'
    metadata = {
        'report_type': 'canonical_full_weapon_baseline' if CANONICAL else 'full_weapon_benchmark',
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'build_bundle_bytes': bundle.stat().st_size if bundle.exists() else 0,
        'weapon_count': len(weapons),
        'runs_per_weapon': RUNS,
        'base_seed': SEED,
        'run_seeds': [SEED + i for i in range(1, RUNS + 1)],
        'per_weapon_seed': False,
        'max_combat_seconds': MAX_SECONDS,
        'step_seconds': STEP_SECONDS,
        'with_offhand': WITH_OFFHAND,
        'fixed_offhand': 'orbit-blade' if WITH_OFFHAND else None,
        'with_shop': WITH_SHOP,
        'canonical_mode': CANONICAL,
        'sample_counts': sample_counts,
        'runtime_errors': sum(int(row.get('runtime_errors') or 0) for row in results),
        'cdp_errors': sum(1 for row in results if row.get('cdp_error')),
    }
    (OUT / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    log(f'FINAL_OUT={OUT}')
    failed = benchmark_failed_ids(results, summary_error)
    log(f'FAILED={failed}')
    return 0 if not failed else 1


if __name__ == '__main__':
    raise SystemExit(main())

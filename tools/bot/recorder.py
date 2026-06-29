"""
recorder.py — Read bot data from the game and save to CSV.

Uses engine.read_bot_data() which reads via CDP.
"""

import csv
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional


def read_bot_data_from_page() -> Optional[List[Dict]]:
    """
    Read __starfallBotData from the game window via CDP.

    Delegates to engine.read_bot_data() for the CDP call.
    """
    from engine import read_bot_data as _engine_read

    return _engine_read()


def save_run(run_data: List[Dict], run_number: int, out_dir: str = "data") -> str:
    """Save one run's snapshots to a JSON file. Returns file path."""
    path = Path(out_dir)
    path.mkdir(parents=True, exist_ok=True)
    file = path / f"run_{run_number:04d}.json"
    with open(file, 'w') as f:
        json.dump(run_data, f, indent=2)
    return str(file)


def save_summary(summaries: List[Dict], out_dir: str = "data") -> str:
    """Save run summaries as CSV. Returns file path."""
    path = Path(out_dir)
    path.mkdir(parents=True, exist_ok=True)
    file = path / "summary.csv"
    if not summaries:
        return str(file)
    fieldnames = summaries[0].keys()
    with open(file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(summaries)
    return str(file)


def make_summary_from_bot_data(data: List[Dict]) -> Dict:
    """Compute a run summary from per-run snapshot data."""
    if not data:
        return {}
    last = data[-1]
    total_kills = last.get('kills', 0)
    total_time = last.get('t', 0)
    return {
        'duration': round(total_time, 1),
        'level': last.get('lv', 1),
        'wave': last.get('wave', 0),
        'kills': total_kills,
        'boss_kills': last.get('bossKills', 0),
        'alloy': last.get('alloy', 0),
        'avg_hp': round(sum(d.get('hp', 0) for d in data) / max(len(data), 1)),
        'max_enemies': max(d.get('enemyCount', 0) for d in data),
    }

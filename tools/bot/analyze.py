"""
analyze.py — Read CSV summaries and produce charts/reports.
"""

import csv
from pathlib import Path
from typing import List, Dict

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MPL = True
except ImportError:
    HAS_MPL = False
    plt = None


def read_summary(csv_path: str) -> List[Dict]:
    """Read summary CSV into a list of dicts."""
    rows = []
    with open(csv_path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def print_report(rows: List[Dict]):
    """Print a text report of run statistics."""
    if not rows:
        print("No data to report.")
        return
    
    durations = [float(r.get('duration', 0)) for r in rows]
    levels = [int(r.get('level', 0)) for r in rows]
    waves = [int(r.get('wave', 0)) for r in rows]
    kills = [int(r.get('kills', 0)) for r in rows]
    boss_kills = [int(r.get('boss_kills', 0)) for r in rows]
    avg_hp = [float(r.get('avg_hp', 0)) for r in rows]
    
    print(f"\n{'='*60}")
    print(f"  Balance Report — {len(rows)} runs")
    print(f"{'='*60}")
    print(f"  Duration:    avg {_mean(durations):.0f}s  min {min(durations):.0f}s  max {max(durations):.0f}s")
    print(f"  Level:       avg {_mean(levels):.0f}  max {max(levels)}")
    print(f"  Wave:        avg {_mean(waves):.0f}  max {max(waves)}")
    print(f"  Kills:       avg {_mean(kills):.0f}  max {max(kills)}")
    print(f"  Boss Kills:  avg {_mean(boss_kills):.1f}  max {max(boss_kills)}")
    print(f"  Avg HP:      avg {_mean(avg_hp):.0f}")
    print(f"{'='*60}\n")


def plot_duration_histogram(rows: List[Dict], out_path: str = "data/histogram.png"):
    """Plot a histogram of run durations."""
    if not HAS_MPL or not rows:
        print("Skipping chart (matplotlib not available or no data).")
        return
    durations = [float(r.get('duration', 0)) for r in rows]
    plt.figure(figsize=(10, 5))
    plt.hist(durations, bins=20, color='#4CC9F0', edgecolor='#0F172A')
    plt.title('Run Duration Distribution')
    plt.xlabel('Duration (seconds)')
    plt.ylabel('Run Count')
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path)
    print(f"Saved chart: {out_path}")


def _mean(nums):
    return sum(nums) / max(len(nums), 1)

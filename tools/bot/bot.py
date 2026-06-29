#!/usr/bin/env python3
"""
bot.py — Main entry point for Starfall Bot.

Launches Chrome (or connects to existing), and runs N game iterations
using CDP to read game state and press keys.

Usage:
    python3 bot.py --runs 3
    python3 tools/bot/bot.py --runs 1
"""

import argparse
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add tools/bot to path
sys.path.insert(0, str(Path(__file__).parent))

from engine import (
    ensure_chrome_with_debugging,
    open_chrome_preview,
    press,
    read_bot_data,
    read_game_state,
    wait_for_phase_change,
)
from recorder import save_run, save_summary, make_summary_from_bot_data
from analyze import print_report, plot_duration_histogram

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("bot")


def parse_args():
    parser = argparse.ArgumentParser(description="Starfall Bot — automated playtester")
    parser.add_argument(
        "--runs", type=int, default=3, help="Number of runs (default: 3)"
    )
    parser.add_argument("--out", default="data", help="Output directory (default: data/)")
    parser.add_argument(
        "--no-launch",
        action="store_true",
        help="Skip launching Cocos/Chrome (connect to existing)",
    )
    parser.add_argument(
        "--url", default="http://localhost:7456", help="Game preview URL"
    )
    parser.add_argument(
        "--debug", action="store_true", help="Enable debug logging"
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Per-run state
# ---------------------------------------------------------------------------


class RunState:
    """Tracks per-run mutable state like shop usage and bot data snapshots."""

    def __init__(self):
        self.shop_used_this_run = False
        self.bot_data_snapshots: List[Dict[str, Any]] = []
        self.last_kills = 0
        self.last_wave = 0
        self.wave_shop_done = set()  # track which waves we've shopped at


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def run_one(run_number: int, url: str) -> List[Dict[str, Any]]:
    """
    Run one full game loop: hangar -> battle -> death -> back to hangar.

    Returns the list of bot data snapshots collected for this run.
    Returns empty list if CDP is not available (fallback stub mode).
    """
    print(f"\n{'=' * 50}")
    print(f"  Run {run_number}")
    print(f"{'=' * 50}")

    state = RunState()

    # Quick check: if CDP isn't available, run stub mode and return
    gs = read_game_state()
    if gs is None:
        logger.info("No CDP connection — stub mode: simulating one run")
        press("b")
        time.sleep(2)
        press("t")
        time.sleep(2)
        return []

    phase = gs.get("phase", "unknown")

    # ------------------------------------------------------------------
    # Phase 1: Wait for hangar/menu, then press B to start
    # ------------------------------------------------------------------
    logger.info("Waiting for hangar or menu phase...")
    for _ in range(120):  # up to 60s
        gs = read_game_state()
        if gs is not None:
            phase = gs.get("phase", "")
            if phase in ("hangar", "menu"):
                break
        time.sleep(0.5)
    else:
        logger.warning("Never saw hangar/menu phase — pressing B anyway")
        press("b")
        time.sleep(3)
        phase = "combat"

    if phase in ("hangar", "menu"):
        logger.info("Phase is '%s' — pressing B to start run", phase)
        press("b")
        time.sleep(2)
        # Wait for phase to change to combat
        new_phase = wait_for_phase_change(phase, timeout=30)
        if new_phase == "unknown":
            logger.warning("Phase didn't change after pressing B")
        phase = new_phase

    # ------------------------------------------------------------------
    # Phase 2: Combat loop
    # ------------------------------------------------------------------
    logger.info("Entering combat loop")
    last_phase = "combat"
    combat_start = time.time()
    combat_timeout = 600  # 10 minutes max per run

    while time.time() - combat_start < combat_timeout:
        gs = read_game_state()
        if gs is None:
            logger.warning("Lost game state — ending run")
            break

        phase = gs.get("phase", "combat")
        hp = gs.get("hp", 100)
        max_hp = gs.get("maxHp", 100)
        hp_ratio = hp / max(max_hp, 1)
        wave = gs.get("wave", 0)
        level = gs.get("level", 1)
        xp = gs.get("xp", 0)
        xp_to_next = gs.get("xpToNext", 999)
        kills = gs.get("kills", 0)

        # Collect bot data snapshot if available
        bot_data = read_bot_data()
        if bot_data:
            state.bot_data_snapshots = bot_data

        # --- Handle phase transitions ---

        # Death / revive panel
        if phase == "paused":
            is_revive = gs.get("revivePanel", False) or gs.get("isDead", False)
            if is_revive or last_phase == "combat":
                logger.info("Death detected (phase=paused) — pressing T to decline revive")
                press("t")
                time.sleep(2)
                last_phase = phase
                continue

        # Return to hangar — run is over
        if phase == "hangar":
            logger.info("Back in hangar — run complete")
            break

        # Still in combat — play
        if phase == "combat" or phase == "playing":
            last_phase = phase

            # 2a. Check for level-up panel — press 1
            if xp_to_next > 0 and xp >= xp_to_next:
                logger.info("Level up (xp=%d >= xpToNext=%d) — pressing 1", xp, xp_to_next)
                press("1")
                time.sleep(0.3)
                bd = read_bot_data()
                if bd:
                    state.bot_data_snapshots = bd

            # 2b. Open/buy/close shop at wave 3+
            if wave >= 3 and wave not in state.wave_shop_done:
                logger.info("Wave %d — opening shop (s 1 s)", wave)
                press("s")
                time.sleep(0.4)
                press("1")
                time.sleep(0.3)
                press("s")
                time.sleep(0.3)
                state.wave_shop_done.add(wave)

            # 2c. Emergency extract if HP < 30%
            if hp_ratio < 0.3:
                logger.info("HP at %.0f%% — pressing R to extract", hp_ratio * 100)
                press("r")
                time.sleep(2)
                new_phase = wait_for_phase_change(phase, timeout=15)
                if new_phase == "hangar":
                    break
                last_phase = new_phase
                continue

        time.sleep(0.2)

    # End of run
    final_data = read_bot_data()
    if final_data:
        state.bot_data_snapshots = final_data

    elapsed = time.time() - combat_start
    logger.info("Run %d ended after %.0fs with %d snapshots", run_number, elapsed,
                len(state.bot_data_snapshots))

    return state.bot_data_snapshots


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    args = parse_args()
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # Ensure Chrome is running with remote debugging
    if not args.no_launch:
        chrome_ok = ensure_chrome_with_debugging()
        if not chrome_ok:
            logger.warning(
                "Could not launch/connect Chrome. "
                "Make sure Chrome is running with --remote-debugging-port=9222"
            )
        else:
            open_chrome_preview(url=args.url)
    else:
        logger.info("Skipping Chrome launch (--no-launch)")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    summaries = []
    for i in range(1, args.runs + 1):
        data = run_one(i, args.url)
        if data:
            save_run(data, i, str(out_dir))
            summary = make_summary_from_bot_data(data)
            summaries.append(summary)
            print(f"  Run {i}: wave={summary.get('wave', '?')}  "
                  f"kills={summary.get('kills', '?')}  "
                  f"duration={summary.get('duration', '?'):.0f}s")
        else:
            print(f"  Run {i}: no data collected.")

    if summaries:
        csv_path = save_summary(summaries, str(out_dir))
        print(f"\nSummary saved: {csv_path}")
        print_report(summaries)
        plot_duration_histogram(summaries, str(out_dir / "histogram.png"))
    else:
        print("\nNo data collected. Run with actual Cocos preview + Chrome CDP to capture data.")

    print("\nDone.")


if __name__ == "__main__":
    main()

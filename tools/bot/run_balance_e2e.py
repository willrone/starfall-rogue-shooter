#!/usr/bin/env python3
"""One-command Starfall real-runtime balance smoke.

Builds the web-mobile Cocos artifact, serves it locally, launches an isolated
Chrome with CDP enabled, waits for the bot hooks, runs run_balance_cdp.py, then
cleans up processes it started.  This replaces the brittle manual sequence:

  build web-mobile -> python http.server -> Chrome --remote-debugging-port -> CDP bot
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
BOT_DIR = ROOT / "tools" / "bot"
DEFAULT_CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

sys.path.insert(0, str(BOT_DIR))
from cdp_client import CDPClient  # noqa: E402


def info(message: str) -> None:
    print(f"[balance-e2e] {message}", flush=True)


def run(cmd: list[str], *, timeout: int | None = None) -> None:
    info("$ " + " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True, timeout=timeout)


def port_is_free(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((host, port)) != 0


def choose_port(preferred: int, host: str = "127.0.0.1") -> int:
    if port_is_free(preferred, host):
        return preferred
    for port in range(preferred + 1, preferred + 80):
        if port_is_free(port, host):
            info(f"port {preferred} is busy; using {port}")
            return port
    raise RuntimeError(f"No free port near {preferred}")


def wait_url(url: str, *, timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if response.status < 500:
                    return
        except Exception as exc:  # noqa: BLE001 - report final error below
            last_error = exc
        time.sleep(0.25)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


def wait_cdp(port: int, *, timeout: float = 30.0) -> None:
    wait_url(f"http://127.0.0.1:{port}/json", timeout=timeout)


def wait_game_hooks(cdp_port: int, target_filter: str, *, timeout: float = 120.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        cdp = CDPClient(host="127.0.0.1", port=cdp_port)
        try:
            if cdp.connect(target_url_filter=target_filter):
                ready = cdp.evaluate(
                    "(function(){return !!(window.__starfallGame && window.__starfallTick && window.__starfallBulkTick && window.__starfallSetSeed);})()",
                    timeout=3,
                )
                if ready:
                    cdp.close()
                    return
        except Exception as exc:  # noqa: BLE001 - Cocos may still be loading
            last_error = exc
        finally:
            cdp.close()
        time.sleep(0.5)
    raise RuntimeError(f"Timed out waiting for Starfall bot hooks in Chrome target {target_filter}: {last_error}")


def start_server(port: int) -> subprocess.Popen:
    cmd = [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", "build/web-mobile"]
    info("$ " + " ".join(cmd))
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    wait_url(f"http://127.0.0.1:{port}/", timeout=15)
    return proc


def start_chrome(chrome: Path, cdp_port: int, url: str) -> tuple[subprocess.Popen, Path]:
    if not chrome.exists():
        raise RuntimeError(f"Chrome not found: {chrome}")
    profile = Path(tempfile.mkdtemp(prefix=f"starfall-cdp-{cdp_port}-"))
    cmd = [
        str(chrome),
        f"--user-data-dir={profile}",
        f"--remote-debugging-port={cdp_port}",
        "--remote-debugging-address=127.0.0.1",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        url,
    ]
    info("$ " + " ".join(cmd))
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    wait_cdp(cdp_port, timeout=25)
    return proc, profile


def terminate_process(proc: subprocess.Popen | None, name: str) -> None:
    if not proc or proc.poll() is not None:
        return
    info(f"stopping {name} pid={proc.pid}")
    proc.terminate()
    try:
        proc.wait(timeout=6)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=6)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build, serve, launch Chrome, and run the real Cocos/CDP balance bot")
    parser.add_argument("--skip-build", action="store_true", help="reuse existing build/web-mobile")
    parser.add_argument("--http-port", type=int, default=7457)
    parser.add_argument("--cdp-port", type=int, default=9222)
    parser.add_argument("--chrome", type=Path, default=DEFAULT_CHROME)
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--weapon", action="append", default=[])
    parser.add_argument("--weapon-level", type=int, default=1)
    parser.add_argument("--max-seconds", type=int, default=600)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default="data/balance_e2e_smoke")
    parser.add_argument("--allow-balance-fail", action="store_true")
    parser.add_argument("--keep-open", action="store_true", help="leave Chrome/server/profile running for manual inspection")
    args = parser.parse_args(list(argv) if argv is not None else None)

    server: subprocess.Popen | None = None
    chrome_proc: subprocess.Popen | None = None
    chrome_profile: Path | None = None
    try:
        if not args.skip_build:
            run([sys.executable, "tools/bot/build_web_mobile_for_bot.py"], timeout=900)

        http_port = choose_port(args.http_port)
        cdp_port = choose_port(args.cdp_port)
        server = start_server(http_port)
        url = f"http://localhost:{http_port}"
        chrome_proc, chrome_profile = start_chrome(args.chrome, cdp_port, url)
        target_filter = f"localhost:{http_port}"
        wait_game_hooks(cdp_port, target_filter)

        cmd = [
            sys.executable,
            "tools/bot/run_balance_cdp.py",
            "--runs", str(args.runs),
            "--max-seconds", str(args.max_seconds),
            "--seed", str(args.seed),
            "--weapon-level", str(args.weapon_level),
            "--target-filter", target_filter,
            "--cdp-host", "127.0.0.1",
            "--cdp-port", str(cdp_port),
            "--out", args.out,
        ]
        for weapon in args.weapon:
            cmd.extend(["--weapon", weapon])
        if args.allow_balance_fail:
            cmd.append("--allow-balance-fail")
        result = subprocess.run(cmd, cwd=ROOT)
        return result.returncode
    finally:
        if args.keep_open:
            info("--keep-open set; leaving Chrome/server running")
            if chrome_profile:
                info(f"Chrome profile: {chrome_profile}")
        else:
            terminate_process(chrome_proc, "Chrome")
            terminate_process(server, "http.server")
            if chrome_profile and chrome_profile.exists():
                shutil.rmtree(chrome_profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())

"""
engine.py — Browser / CDP engine for Starfall Bot.

Uses Selenium + Chrome DevTools Protocol (CDP) via websocket-client to
control the game. Falls back to local keyboard simulation when
Chrome/Selenium is not available.

Keyboard fallback priority:
  1. pynput.keyboard.Controller (if Quartz bindings available)
  2. pyautogui (if pyobjc available)
  3. osascript / AppleScript via subprocess (always works on macOS)
"""

import logging
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CDP client (lazy load so missing deps still allow keyboard fallback)
# ---------------------------------------------------------------------------
_CDP_CLIENT = None  # singleton
_CDP_TRIED = False  # flag so we only attempt connection once


def _get_cdp() -> Optional[Any]:
    global _CDP_CLIENT, _CDP_TRIED
    if _CDP_CLIENT is not None:
        return _CDP_CLIENT
    if _CDP_TRIED:
        return None  # already tried and failed

    _CDP_TRIED = True

    try:
        from cdp_client import CDPClient

        client = CDPClient(host="localhost", port=9222)
        if client.connect(target_url_filter="localhost:7456"):
            _CDP_CLIENT = client
            logger.info("CDP client connected")
            return client
    except Exception as exc:
        logger.debug("CDP connection failed: %s", exc)

    # Try connecting without URL filter
    try:
        from cdp_client import CDPClient

        client = CDPClient(host="localhost", port=9222)
        if client.connect():
            _CDP_CLIENT = client
            logger.info("CDP client connected (any page)")
            return client
    except Exception as exc:
        logger.debug("CDP connection (unfiltered) failed: %s", exc)

    # Chrome not running via CDP — try to launch it
    logger.info("CDP not available — attempting to launch Chrome...")
    try:
        # Open Chrome to the game URL
        subprocess.run(
            ["open", "-a", "/Applications/Google Chrome.app", "http://localhost:7456"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
        logger.info("Launched Chrome via 'open'. Waiting 5s for it to start...")
        time.sleep(5)

        # Retry CDP connection
        try:
            client = CDPClient(host="localhost", port=9222)
            if client.connect(target_url_filter="localhost:7456"):
                _CDP_CLIENT = client
                _CDP_TRIED = True
                logger.info("CDP client connected (after Chrome launch)")
                return client
        except Exception as exc:
            logger.debug("CDP connection after launch failed: %s", exc)

        logger.warning(
            "Chrome was launched but CDP connection still failed.\n"
            "  To use CDP (recommended for playtesting), restart Chrome with:\n"
            "    /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n"
            "      --remote-debugging-port=9222 \\\n"
            "      --user-data-dir=/tmp/chrome_bot_profile \\\n"
            "      http://localhost:7456\n"
            "  Falling back to keyboard simulation."
        )
    except Exception as exc:
        logger.debug("Chrome launch attempt failed: %s", exc)
        logger.info("CDP not available — will use keyboard simulation fallback")

    return None


# ---------------------------------------------------------------------------
# Keyboard simulation helpers (macOS)
# ---------------------------------------------------------------------------

def _press_via_osascript(key: str) -> bool:
    """Press a key via AppleScript's System Events (works without pyobjc)."""
    try:
        # Map some special keys
        key_map = {
            "enter": "return",
            "tab": "tab",
            "escape": "escape",
            "backspace": "delete",
            "delete": "forward delete",
            "space": "space",
            "up": "up",
            "down": "down",
            "left": "left",
            "right": "right",
            "home": "home",
            "end": "end",
            "pageup": "page up",
            "pagedown": "page down",
        }
        apple_key = key_map.get(key.lower(), key)
        # Only keystroke single characters; use key code for specials
        if len(apple_key) == 1:
            script = (
                f'tell application "System Events" to keystroke "{apple_key}"'
            )
        else:
            script = (
                f'tell application "System Events" to key code {_key_code(apple_key)}'
            )
        subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            timeout=5,
        )
        return True
    except Exception as exc:
        logger.debug("osascript key press failed: %s", exc)
        return False


def _key_code(name: str) -> int:
    """Map common macOS key names to CG key codes."""
    mapping = {
        "return": 36, "tab": 48, "space": 49, "delete": 51,
        "escape": 53, "forward delete": 117,
        "up": 126, "down": 125, "left": 123, "right": 124,
        "home": 115, "end": 119, "page up": 116, "page down": 121,
    }
    return mapping.get(name, 0)


# ---------------------------------------------------------------------------
# Try pynput first, then pyautogui, then osascript
# ---------------------------------------------------------------------------

_HAS_PYNPUT = False
_HAS_PYAUTOGUI = False
_pynput_keyboard = None
_pyautogui = None

# Try pynput
try:
    from pynput.keyboard import Key, Controller as KeyboardController
    _pynput_keyboard = KeyboardController()
    _HAS_PYNPUT = True
    logger.info("Using pynput for keyboard simulation")
except ImportError:
    logger.debug("pynput not available")
except Exception as exc:
    logger.debug("pynput init failed: %s", exc)

# Fallback: try pyautogui
if not _HAS_PYNPUT:
    try:
        import pyautogui as _pyautogui_mod
        _pyautogui_mod.FAILSAFE = True
        _pyautogui_mod.PAUSE = 0.04
        _pyautogui = _pyautogui_mod
        _HAS_PYAUTOGUI = True
        logger.info("Using pyautogui for keyboard simulation")
    except ImportError:
        logger.debug("pyautogui not available (need pyobjc)")
    except Exception as exc:
        logger.debug("pyautogui init failed: %s", exc)

if not _HAS_PYNPUT and not _HAS_PYAUTOGUI:
    logger.info("Using osascript (AppleScript) for keyboard simulation")


def _press_keyboard_lib(key: str):
    """Try pynput, then pyautogui, then osascript."""
    if _HAS_PYNPUT and _pynput_keyboard is not None:
        try:
            # Map common keys
            key_map = {
                "enter": Key.enter,
                "tab": Key.tab,
                "escape": Key.esc,
                "backspace": Key.backspace,
                "delete": Key.delete,
                "space": Key.space,
                "up": Key.up,
                "down": Key.down,
                "left": Key.left,
                "right": Key.right,
                "home": Key.home,
                "end": Key.end,
                "pageup": Key.page_up,
                "pagedown": Key.page_down,
            }
            if len(key) == 1:
                _pynput_keyboard.press(key)
                _pynput_keyboard.release(key)
            else:
                k = key_map.get(key.lower())
                if k:
                    _pynput_keyboard.press(k)
                    _pynput_keyboard.release(k)
                else:
                    # Fall through to next method
                    raise ValueError(f"Unknown pynput key: {key}")
            return
        except Exception as exc:
            logger.debug("pynput press failed (%s) — trying next method", exc)

    if _HAS_PYAUTOGUI and _pyautogui is not None:
        try:
            _pyautogui.press(key)
            return
        except Exception as exc:
            logger.debug("pyautogui press failed (%s) — trying osascript", exc)

    # Last resort: osascript
    _press_via_osascript(key)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def ensure_chrome_with_debugging(port: int = 9222) -> bool:
    """Launch Chrome with remote debugging enabled if not already running."""
    import urllib.request

    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

    # Check if already listening on the debugging port
    try:
        urllib.request.urlopen(f"http://localhost:{port}/json/version", timeout=3)
        logger.info("Chrome DevTools already running on port %d", port)
        return True
    except Exception:
        pass

    # Check if Chrome binary exists
    chrome_bin = chrome_path if Path(chrome_path).exists() else None
    if not chrome_bin:
        # Try alternative paths
        alt_paths = [
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
        ]
        for p in alt_paths:
            if Path(p).exists():
                chrome_bin = p
                break

    if not chrome_bin:
        logger.warning(
            "Chrome not found at %s. Please install Chrome or launch it manually:\n"
            "  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n"
            "    --remote-debugging-port=%d \\\n"
            "    --user-data-dir=/tmp/chrome_bot_profile \\\n"
            "    http://localhost:7456",
            chrome_path, port,
        )
        return False

    url = "http://localhost:7456"
    user_data_dir = "/tmp/chrome_bot_profile"

    logger.info(
        "Launching Chrome: %s --remote-debugging-port=%d --user-data-dir=%s %s",
        chrome_bin, port, user_data_dir, url,
    )
    subprocess.Popen(
        [
            chrome_bin,
            f"--remote-debugging-port={port}",
            "--remote-allow-origins=*",
            f"--user-data-dir={user_data_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for Chrome to start (up to 30s)
    for i in range(30):
        try:
            urllib.request.urlopen(
                f"http://localhost:{port}/json/version", timeout=3
            )
            logger.info("Chrome started and listening on port %d (took ~%ds)", port, i + 1)
            return True
        except Exception:
            time.sleep(1)

    logger.warning(
        "Chrome launched but didn't become ready on port %d within 30s.\n"
        "  Check that another Chrome instance isn't blocking the port.\n"
        "  You can manually start:\n"
        "    %s --remote-debugging-port=%d --user-data-dir=%s %s",
        port, chrome_bin, port, user_data_dir, url,
    )
    return False


def open_chrome_preview(url: str = "http://localhost:7456"):
    """
    Open the game preview in Chrome.
    Called before the bot loop starts.
    """
    import webbrowser

    webbrowser.open(url)
    time.sleep(3)

    cdp = _get_cdp()
    if cdp is not None:
        try:
            cdp.navigate(url)
            time.sleep(2)
            logger.info("Navigated CDP to %s", url)
        except Exception as exc:
            logger.warning("CDP navigate failed (%s) — page may already be there", exc)
    else:
        logger.info("No CDP — game preview opened in browser (click to focus)")


def call_game_method(method_name: str, *args: Any) -> Any:
    """
    Call a RogueShooterGame component method via CDP JavaScript evaluation.

    Supports dotted method paths such as ``pickupMgr.choosePanelChoice`` and
    ``shop.openShop``. For compatibility with older bot call sites, a single
    list/tuple argument is treated as the method argument list, so both
    ``call_game_method('beginBattle', False)`` and
    ``call_game_method('beginBattle', [False])`` work.
    """
    cdp = _get_cdp()
    if cdp is None:
        logger.debug("call_game_method(%s) skipped: CDP unavailable", method_name)
        return None

    call_args = args
    if len(args) == 1 and isinstance(args[0], (list, tuple)):
        call_args = tuple(args[0])

    try:
        return cdp.call_game_method(method_name, *call_args)
    except Exception as exc:
        logger.warning("CDP game method call failed for %s(%s): %s", method_name, call_args, exc)
        _reconnect_cdp()
        return None


def _press_via_game_method(cdp: Any, key: str) -> bool:
    """Map bot hotkeys to direct RogueShooterGame method calls."""
    key_lower = key.lower()

    try:
        if key_lower == 'b':
            cdp.call_game_method('beginBattle', False)
            return True

        if key_lower in {'1', '2', '3'}:
            idx = int(key_lower) - 1
            # Preserve the original game's key-handler behavior while avoiding
            # synthetic keyboard events in Cocos Creator preview mode.
            state = read_game_state() or {}
            phase = state.get('phase')
            if phase in {'level-up', 'item-choice'}:
                cdp.call_game_method('pickupMgr.choosePanelChoice', idx)
            elif phase == 'shop':
                cdp.call_game_method('shop.chooseShopItemByIndex', idx)
            elif phase == 'hangar':
                cdp.call_game_method('pickupMgr.chooseLoot', idx)
            else:
                cdp.call_game_method('pickupMgr.choosePanelChoice', idx)
            return True

        if key_lower == 't':
            cdp.call_game_method('declineRevive')
            return True

        if key_lower == 's':
            state = read_game_state() or {}
            if state.get('phase') == 'shop':
                cdp.call_game_method('shop.closeShop')
            else:
                cdp.call_game_method('shop.openShop')
            return True

        if key_lower == 'r':
            cdp.call_game_method('extractBattle')
            return True

    except Exception as exc:
        logger.warning("CDP direct game-method press failed for key %r (%s) — falling back", key, exc)
        return False

    return False


def press(key: str):
    """Press a single key, using direct Cocos method calls in CDP mode."""
    cdp = _get_cdp()
    if cdp is not None:
        if _press_via_game_method(cdp, key):
            return
        try:
            cdp.press_key(key)
            return
        except Exception as exc:
            logger.warning("CDP key press failed (%s) — trying keyboard lib", exc)
            _reconnect_cdp()
    _press_keyboard_lib(key)


def _reconnect_cdp():
    """Try to reconnect the CDP client."""
    global _CDP_CLIENT, _CDP_TRIED
    if _CDP_CLIENT:
        try:
            _CDP_CLIENT.close()
        except Exception:
            pass
        _CDP_CLIENT = None
    _CDP_TRIED = False  # allow retry on next call


def read_game_state() -> Optional[Dict[str, Any]]:
    """
    Read window.__starfallCombatState from the game via CDP.

    Returns a dict with keys like: phase, hp, maxHp, wave, level, kills,
    enemyCount, xp, xpToNext, alloy, etc.
    Returns None if CDP is unavailable or eval fails.
    """
    cdp = _get_cdp()
    if cdp is None:
        return None
    try:
        raw = cdp.evaluate(
            "JSON.parse(JSON.stringify(window.__starfallCombatState || {}))",
            return_by_value=True,
            timeout=3,
        )
        if isinstance(raw, dict):
            return raw
        return None
    except Exception as exc:
        logger.warning("read_game_state failed: %s", exc)
        return None


def read_bot_data() -> Optional[List[Dict[str, Any]]]:
    """
    Read window.__starfallBotData from the game via CDP.

    Returns a list of snapshot dicts, or None if unavailable.
    """
    cdp = _get_cdp()
    if cdp is None:
        return None
    try:
        raw = cdp.evaluate(
            "JSON.parse(JSON.stringify(window.__starfallBotData || []))",
            return_by_value=True,
            timeout=3,
        )
        if isinstance(raw, list):
            return raw
        return None
    except Exception as exc:
        logger.warning("read_bot_data failed: %s", exc)
        return None


def wait_for_phase_change(
    current_phase: str,
    timeout: float = 120,
    poll_interval: float = 0.5,
) -> str:
    """
    Block until the game phase changes from `current_phase`.

    Polls via CDP every `poll_interval` seconds.
    Returns the new phase string, or 'unknown' on timeout.

    If CDP is not available, falls back to a sleep-based stub.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = read_game_state()
        if state is None:
            time.sleep(min(timeout, 5))
            return "unknown"

        phase = state.get("phase", "")
        if phase and phase != current_phase:
            logger.info("Phase changed: %s → %s", current_phase, phase)
            return phase

        time.sleep(poll_interval)

    logger.warning(
        "Phase did not change from '%s' within %.0fs", current_phase, timeout
    )
    return "unknown"

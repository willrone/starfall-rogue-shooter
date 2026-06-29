"""
cdp_client.py — Chrome DevTools Protocol client for Starfall Bot.

Connects to Chrome via WebSocket on the remote debugging port,
evaluates JavaScript in the game context, and dispatches keyboard events.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import websocket

logger = logging.getLogger(__name__)


class CDPClient:
    """Encapsulates a WebSocket connection to Chrome's DevTools Protocol."""

    def __init__(self, host: str = "localhost", port: int = 9222):
        self.host = host
        self.port = port
        self.ws: Optional[websocket.WebSocket] = None
        self.target_id: Optional[str] = None
        self._msg_id = 0

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def connect(self, target_url_filter: Optional[str] = None) -> bool:
        """
        Connect to an already-running Chrome DevTools instance.

        1. Fetch /json/version or /json to get the WebSocket URL.
        2. If a filter is given, look for a page whose URL contains it.
        3. Fall back to the first available page.
        """
        try:
            import urllib.request

            resp = urllib.request.urlopen(
                f"http://{self.host}:{self.port}/json", timeout=5
            )
            targets: List[Dict] = json.loads(resp.read().decode())
        except Exception as exc:
            logger.debug("Cannot reach Chrome DevTools: %s", exc)
            return False

        # Filter by URL if requested
        chosen = None
        if target_url_filter:
            for t in targets:
                url = t.get("url", "")
                if target_url_filter in url:
                    chosen = t
                    break

        if not chosen:
            # Pick the first page that has a webSocketDebuggerUrl
            for t in targets:
                if t.get("webSocketDebuggerUrl"):
                    chosen = t
                    break

        if not chosen:
            logger.warning("No debuggable page found in Chrome targets")
            return False

        ws_url = chosen["webSocketDebuggerUrl"]
        self.target_id = chosen.get("id")
        logger.info("Connecting to CDP: %s", ws_url)

        self.ws = websocket.create_connection(ws_url, timeout=10)
        logger.info("CDP WebSocket connected")
        return True

    def close(self):
        """Close the WebSocket connection."""
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None

    def is_connected(self) -> bool:
        return self.ws is not None

    # ------------------------------------------------------------------
    # Low-level CDP message helpers
    # ------------------------------------------------------------------

    def _send(self, method: str, params: Optional[Dict] = None) -> int:
        """Send a CDP command and return the message id."""
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(msg))
        return self._msg_id

    def _recv(self, timeout: float = 5.0) -> Dict:
        """Receive one message from the WebSocket."""
        self.ws.settimeout(timeout)
        raw = self.ws.recv()
        return json.loads(raw)

    def _send_sync(self, method: str, params: Optional[Dict] = None,
                   timeout: float = 5.0) -> Dict:
        """Send a CDP command and wait for its result."""
        msg_id = self._send(method, params)
        while True:
            resp = self._recv(timeout)
            if resp.get("id") == msg_id:
                return resp.get("result", {})
            # Ignore events

    # ------------------------------------------------------------------
    # JavaScript evaluation
    # ------------------------------------------------------------------

    def evaluate(self, expression: str,
                 return_by_value: bool = True,
                 timeout: float = 5.0) -> Any:
        """
        Evaluate JavaScript in the page context and return the result.

        Uses Runtime.evaluate CDP method.
        """
        result = self._send_sync(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": return_by_value,
                "awaitPromise": False,
            },
            timeout=timeout,
        )
        if "exceptionDetails" in result:
            exc = result["exceptionDetails"]
            logger.warning("JS eval exception: %s", exc.get("text", exc))
            return None
        if "result" not in result:
            return None
        val = result["result"]
        if "value" in val:
            return val["value"]
        # Handle unserializable values (e.g. strings too large)
        if val.get("type") == "string" and "unserializableValue" in val:
            return val["unserializableValue"]
        return None

    def call_game_method(self, method_name: str, *args: Any,
                         timeout: float = 5.0) -> Any:
        """
        Call a method on the RogueShooterGame Cocos component via JS eval.

        `method_name` may be a direct method (e.g. ``beginBattle``) or a dotted
        path through component fields exposed at runtime (e.g.
        ``pickupMgr.choosePanelChoice`` or ``shop.openShop``).

        The wrapper scans GameRoot's Cocos components for RogueShooterGame and
        returns the called method's JSON-serializable result. Void/undefined JS
        results are returned as None. If the game component or method is not
        ready/found, RuntimeError is raised so callers can fall back to keyboard
        simulation.
        """
        method_json = json.dumps(method_name)
        args_json = json.dumps(args)
        expression = f"""
(function(){{
    function sanitize(value) {{
        if (value === undefined || value === null) return null;
        var t = typeof value;
        if (t === 'string' || t === 'number' || t === 'boolean') return value;
        try {{ return JSON.parse(JSON.stringify(value)); }}
        catch (e) {{
            try {{ return String(value); }}
            catch (_) {{ return '[unserializable result]'; }}
        }}
    }}

    function fail(message) {{
        return {{ ok: false, error: message }};
    }}

    try {{
        if (typeof cc === 'undefined' || !cc.director) {{
            return fail('Cocos cc/director is not ready');
        }}
        var scene = cc.director.getScene && cc.director.getScene();
        if (!scene) return fail('Cocos scene is not ready');

        function findNodeByName(node, name) {{
            if (!node) return null;
            if (node.name === name) return node;
            var children = node.children || [];
            for (var i = 0; i < children.length; i++) {{
                var found = findNodeByName(children[i], name);
                if (found) return found;
            }}
            return null;
        }}

        var root = (scene.getChildByName && scene.getChildByName('GameRoot')) || findNodeByName(scene, 'GameRoot');
        if (!root) return fail('GameRoot node is not ready');

        function getComponents(node) {{
            if (!node || !node.getComponents) return [];
            try {{ return node.getComponents(cc.Component) || []; }}
            catch (_) {{
                try {{ return node.components || []; }}
                catch (__) {{ return []; }}
            }}
        }}

        function looksLikeGameComponent(c) {{
            if (!c) return false;
            var ctorName = (c.constructor && c.constructor.name) || '';
            var className = c.__classname__ || c.__className__ || '';
            return ctorName === 'RogueShooterGame' ||
                   className.indexOf('RogueShooterGame') >= 0 ||
                   typeof c.beginBattle === 'function' ||
                   !!(c.pickupMgr && c.shop && c.panels);
        }}

        var comps = getComponents(root);
        var game = null;
        for (var i = 0; i < comps.length; i++) {{
            if (looksLikeGameComponent(comps[i])) {{ game = comps[i]; break; }}
        }}
        if (!game) return fail('RogueShooterGame component is not ready on GameRoot');

        var methodName = {method_json};
        var callArgs = {args_json};
        var parts = methodName.split('.');
        var target = game;
        for (var j = 0; j < parts.length - 1; j++) {{
            if (target == null || target[parts[j]] == null) {{
                return fail('Method path not found: ' + parts.slice(0, j + 1).join('.'));
            }}
            target = target[parts[j]];
        }}

        var fnName = parts[parts.length - 1];
        var fn = target && target[fnName];
        if (typeof fn !== 'function') {{
            return fail('Game method not found: ' + methodName);
        }}

        var result = fn.apply(target, callArgs);
        return {{ ok: true, result: sanitize(result) }};
    }} catch (e) {{
        return fail((e && (e.stack || e.message)) ? (e.stack || e.message) : String(e));
    }}
}})()
"""

        raw = self.evaluate(expression, return_by_value=True, timeout=timeout)
        if not isinstance(raw, dict):
            raise RuntimeError(f"CDP game method call returned no result for {method_name!r}")
        if not raw.get("ok"):
            raise RuntimeError(raw.get("error") or f"CDP game method call failed: {method_name}")
        return raw.get("result")

    # ------------------------------------------------------------------
    # Keyboard input via CDP Input.dispatchKeyEvent
    # ------------------------------------------------------------------

    def press_key(self, key: str):
        key_lower = key.lower()
        # Map char to keyCode
        if len(key) == 1 and '0' <= key <= '9':
            key_code = ord(key)
            key_text = key
            code = f"Digit{key}"
        elif len(key) == 1 and 'a' <= key <= 'z':
            key_code = ord(key.upper())
            key_text = key
            code = f"Key{key.upper()}"
        elif len(key) == 1:
            key_code = ord(key)
            key_text = key
            code = key
        else:
            special = {"enter": 13, "tab": 9, "escape": 27, "backspace": 8, "space": 32, "delete": 46}
            key_code = special.get(key_lower, 0)
            key_text = key_lower[0] if key else ' '
            code = key_lower
        
        # CDP dispatchKeyEvent — this is what Cocos EventKeyboard receives
        self._send_sync("Input.dispatchKeyEvent", {
            "type": "keyDown",
            "windowsVirtualKeyCode": key_code,
            "nativeVirtualKeyCode": key_code,
            "text": key_text,
            "unmodifiedText": key_text,
            "key": key_text,
            "code": code,
        }, timeout=2)
        self._send_sync("Input.dispatchKeyEvent", {
            "type": "char",
            "text": key_text,
            "unmodifiedText": key_text,
            "key": key_text,
            "code": code,
        }, timeout=2)
        self._send_sync("Input.dispatchKeyEvent", {
            "type": "keyUp",
            "windowsVirtualKeyCode": key_code,
            "nativeVirtualKeyCode": key_code,
            "key": key_text,
            "code": code,
        }, timeout=2)
        
        return True

    def type_text(self, text: str):
        """Type a string by dispatching key events for each char."""
        for ch in text:
            self.press_key(ch)
            time.sleep(0.02)

    # ------------------------------------------------------------------
    # Navigation
    # ------------------------------------------------------------------

    def navigate(self, url: str) -> bool:
        """Navigate the current page to a URL."""
        result = self._send_sync("Page.navigate", {"url": url})
        if "errorText" in result:
            logger.warning("Navigate error: %s", result["errorText"])
            return False
        return True

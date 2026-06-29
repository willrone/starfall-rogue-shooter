#!/usr/bin/env python3
"""
Run Starfall balance checks entirely in-browser via Hermes browser_console.

This replaces the broken CDP approach on macOS. Python calls Hermes's
browser_console tool to evaluate JS in the game context — no Chrome CDP needed.
"""

import json
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]

TARGETS = {
    "novice": (5, 6, 7),
    "standard": (8, 9, 10),
    "boss_gate": (10, 10, 10),
    "boss_clear": (10, 11, 12),
}

BOT_JS = r"""
(function() {
// ── Bot JS injected into the game page ─────────────────────────
window.__starfallBotResults = [];
window.__starfallBotDone = false;
window.__starfallBotError = null;

var tierForCost = function(cost) {
  if (cost <= 42) return "novice";
  if (cost <= 56) return "standard";
  if (cost <= 64) return "boss_gate";
  return "boss_goss_clear";  // typo fix below
};

var g = window.__starfallGame;

// Read weapon catalog
function getWeaponCatalog() {
  try {
    var cats = g.shop.weaponCatalog || [];
    return cats.map(function(w) {
      return {
        id: w.id || "",
        name: w.name || w.id,
        cost: w.baseCost || w.cost || 0,
        kind: w.kind || "weapon",
        rarity: w.rarity || "common",
        family: (w.id || "").split("-standard")[0]
      };
    });
  } catch(e) { return []; }
}

function selectWeapon(weaponId) {
  try {
    window.__starfallBotMode = true;
    var s = g.shop;
    if (s.ownedEquipment && s.ownedEquipment.add) {
      s.ownedEquipment.add(weaponId);
    }
    // equippedEquipment is a Set — add each item
    s.equippedEquipment.clear && s.equippedEquipment.clear();
    var items = [weaponId, 'tactical-visor', 'phase-armor', 'kinetic-boots', 'magnet-coil'];
    for (var i = 0; i < items.length; i++) {
      if (s.equippedEquipment.add) s.equippedEquipment.add(items[i]);
    }
    return true;
  } catch(e) { window.__starfallBotError = "select:" + e.message; return false; }
}

function clearCombatState() {
  try {
    if (g.enemyMgr && g.enemyMgr.enemies) {
      for (var i = 0; i < g.enemyMgr.enemies.length; i++) {
        try { g.enemyMgr.enemies[i].node.destroy(); } catch(e2) {}
      }
      g.enemyMgr.enemies.length = 0;
      if (g.enemyMgr.enemySet) g.enemyMgr.enemySet.clear();
    }
    if (g.pickupMgr && g.pickupMgr.pickups) g.pickupMgr.pickups.length = 0;
    return true;
  } catch(e) { window.__starfallBotError = "clear:" + e.message; return false; }
}

function runSingleBattle(weaponId) {
  try {
    clearCombatState();
    g.cs.phase = 'hangar';
    selectWeapon(weaponId);
    g.beginBattle(false);

    var t0 = Date.now();
    var result = {
      weapon_id: weaponId,
      wave: 0,
      combat_time: 0,
      kills: 0,
      level: 0,
      hp: 0,
      boss_kills: 0,
      phase: g.cs.phase,
      died: false,
      error: null
    };

    for (var frame = 0; frame < 7200; frame++) {
      window.__starfallTick(1/60);
      var cs = g.cs, hp = +(cs.playerHp || 0);
      var phase = cs.phase;

      // Handle modals
      if (phase === 'level-up' || phase === 'item-choice') {
        try { g.pickupMgr.choosePanelChoice(0); } catch(e) {}
      } else if (phase === 'shop') {
        try {
          var s = g.shop;
          if (s.chooseShopItemByIndex) s.chooseShopItemByIndex(0);
          if (s.closeShop) s.closeShop();
        } catch(e) {}
      } else if (phase === 'paused' && hp <= 0) {
        try { g.declineRevive(); } catch(e) {}
      }

      if (hp <= 0 || phase === 'settlement' || phase === 'hangar' || phase === 'menu') {
        result.wave = cs.waveIndex || 0;
        result.combat_time = +(cs.combatTime || 0);
        result.kills = cs.killCount || 0;
        result.level = cs.level || 0;
        result.hp = +(cs.playerHp || 0);
        result.boss_kills = cs.bossKills || 0;
        result.phase = phase;
        result.died = hp <= 0;
        return result;
      }
    }

    // Timeout
    result.wave = g.cs.waveIndex || 0;
    result.combat_time = +(g.cs.combatTime || 0);
    result.kills = g.cs.killCount || 0;
    result.level = g.cs.level || 0;
    result.hp = +(g.cs.playerHp || 0);
    result.boss_kills = g.cs.bossKills || 0;
    result.phase = "timeout";
    result.error = "reached max frames (7200)";
    return result;
  } catch(e) {
    return { weapon_id: weaponId, error: e.message, phase: g.cs.phase };
  }
}

function runWeaponSuite(weaponIds, runsPer) {
  window.__starfallBotResults = [];
  window.__starfallBotError = null;

  for (var wi = 0; wi < weaponIds.length; wi++) {
    var wid = weaponIds[wi];
    for (var r = 0; r < runsPer; r++) {
      var res = runSingleBattle(wid);
      window.__starfallBotResults.push(res);
    }
  }

  window.__starfallBotDone = true;
  return window.__starfallBotResults;
}

// Expose
window.__starfallBotRun = function(weaponIds, runsPer) {
  return runWeaponSuite(weaponIds, runsPer || 3);
};

window.__starfallBotCatalog = getWeaponCatalog;
})()
"""

def get_browser_console_tool():
    """Reference the browser_console tool for JS execution."""
    return "browser_console"


def inject_bot_js():
    """Inject the bot JavaScript into the game page."""
    # This is handled via browser_console evaluates
    pass


def percentile(sorted_values, p):
    if not sorted_values:
        return 0
    idx = min(len(sorted_values) - 1, max(0, int(len(sorted_values) * p)))
    return sorted_values[idx]


if __name__ == "__main__":
    print("Bot JS ready. Use browser_console to execute:")
    print("1. Inject: evaluate the BOT_JS string to load __starfallBotRun")
    print("2. Catalog: __starfallBotCatalog() to see weapons")
    print("3. Run: __starfallBotRun(['storm-rifle'], 3) to test")
    print("4. Results: window.__starfallBotResults")
    print("5. Done: window.__starfallBotDone")

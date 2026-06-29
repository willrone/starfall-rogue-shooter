"""
strategy.py — Decision logic for bot: upgrade selection, shop buys, etc.
"""

from typing import Any, List


def choose_upgrade(choices: List[Any], state: Any) -> int:
    """Pick which upgrade option to take (index 0/1/2).
    
    Strategy: prefer attackPower, then attackSpeed, then anything else.
    """
    best_idx = 0
    best_score = -999
    for i, c in enumerate(choices):
        score = _upgrade_score(c)
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def choose_shop_item(offers: List[Any], spendable_alloy: int) -> int:
    """Pick which shop slot to buy (index 0-5), or -1 to skip.
    
    Strategy: buy the cheapest item we can afford.
    """
    # Placeholder — real cost is computed in-game.
    # Always buy slot 0 for now.
    return 0 if offers else -1


def should_extract(state: Any) -> bool:
    """Return True when bot should press R to extract.
    
    Strategy: extract when HP < 30% to reduce deaths.
    """
    if not hasattr(state, 'hp') or not hasattr(state, 'maxHp'):
        return False
    ratio = state.hp / max(state.maxHp, 1)
    return ratio < 0.3


def should_use_shop(state: Any) -> bool:
    """Return True when bot should open shop.
    
    Strategy: open shop at least once per battle when wave > 3.
    """
    return getattr(state, 'wave', 0) >= 3 and not getattr(state, '_shop_done_this_run', False)


def _upgrade_score(c: Any) -> float:
    """Score an upgrade option. Higher = better."""
    name = getattr(c, 'id', '') or getattr(c, 'name', '')
    effects = getattr(c, 'effects', []) or []
    score = 0.0
    for eff in effects:
        stat = getattr(eff, 'stat', '') or ''
        amt = getattr(eff, 'amount', 0) or 0
        if 'attackPower' in stat:
            score += amt * 1.5
        elif 'attackSpeed' in stat or 'fireRate' in stat:
            score += amt * 8
        elif 'critChance' in stat:
            score += amt * 120
        elif 'critDamage' in stat:
            score += amt * 12
        elif 'multiShot' in stat:
            score += amt * 10
        elif 'pierce' in stat:
            score += amt * 4
        elif 'dronePower' in stat:
            score += amt * 6
        elif 'lethal' in stat.lower():
            score += amt * 15
        elif 'maxHp' in stat:
            score += amt * 0.5
        elif 'shield' in stat.lower():
            score += amt * 0.3
        elif 'defense' in stat.lower() or 'def' in stat:
            score += amt * 0.4
        else:
            score += amt * 0.1
    return score

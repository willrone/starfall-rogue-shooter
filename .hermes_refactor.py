#!/usr/bin/env python3
"""Refactor RogueShooterGame.ts to use PickupManager."""

import re

path = "/Users/ronghui/Documents/game_dev_cocos/assets/scripts/RogueShooterGame.ts"
with open(path) as f:
    text = f.read()

# 1. Replace method calls: this.xxx(...) -> this.pickupMgr.xxx(...)
# Do NOT replace methods that are still part of RogueShooterGame (like those in the main class)
# We need to be careful about this - only replace calls inside OTHER methods

# List of methods that moved to PickupManager
moved_methods = [
    "updatePickups",
    "dropPickup",
    "collectPickup",
    "gainXp",
    "compactPickupOverflow",
    "findMergeablePickup",
    "addAmountToPickup",
    "absorbPickupInto",
    "drawPickup",
    "removePickup",
    "getPickupVisualRadius",
    "isChestPickup",
    "tryDropChest",
    "openLevelChoices",
    "openItemChoices",
    "renderChoicePanel",
    "choosePanelChoice",
    "chooseLevelUpgrade",
    "chooseRunItem",
    "resumeCombatAfterChoice",
    "applyLevelUpgrade",
    "applyRunItem",
    "refreshCurrentChoices",
    "applyStatEffects",
    "createLootChoices",
    "chooseLoot",
    "pickupArtName",
    "getPickupRadius",
    "spawnFloatingText",
    "updateFloatingTexts",
    "recycleFloatingText",
]

# We need to replace calls INSIDE method bodies but not the declarations themselves
# The pattern: this.methodName( but NOT after private 
for m in moved_methods:
    # Replace `this.methodName( with `this.pickupMgr.methodName(`
    # but NOT the declaration `private methodName(`
    # Use a negative lookbehind for 'private '
    text = re.sub(r'(?<!private )this\.' + m + r'\s*\(', 'this.pickupMgr.' + m + '(', text)

# 2. Replace field references
moved_fields = [
    "pickups",
    "floatingTexts",
    "floatingTextPool",
    "pendingLevelChoices",
    "pendingItemChoices",
    "currentItemChoiceQuality",
    "pendingLootChoices",
    "runStats",
    "acquiredRunItemIds",
    "acquiredStatUpgradeIds",
]
for f in moved_fields:
    # this.xxx -> this.pickupMgr.xxx
    text = re.sub(r'(?<!this\.pickupMgr\.)this\.' + f + r'\b', 'this.pickupMgr.' + f, text)

# 3. Fix the debug HUD line that references pickups/floatingTexts lengths
# this.pickupMgr.pickups.length (should already be correct from the loop above)

# 4. Fix beginBattle reset section
# The old code had:
# this.pickupMgr.runStats = ...
# We need to replace with: this.pickupMgr.resetRun()

# Find the reset block in beginBattle
old_reset = """        this.pickupMgr.runStats = createEmptyCharacterStats();
        this.pickupMgr.acquiredRunItemIds = new Set();
        this.pickupMgr.acquiredStatUpgradeIds = new Set();
        this.pickupMgr.pendingItemChoices = [];
        this.shopOffers = [];
        this.pickupMgr.currentItemChoiceQuality = 'common';"""

new_reset = """        this.pickupMgr.resetRun();
        this.shopOffers = [];"""

text = text.replace(old_reset, new_reset)

# 5. Fix clearWorld cleanup
old_clear = """        for (const pickup of this.pickupMgr.pickups) pickup.node.destroy();
        for (const floatingText of [...this.pickupMgr.floatingTexts]) this.pickupMgr.recycleFloatingText(floatingText, true);"""

# After the regex substitution, it should already be this.pickupMgr.pickups
# Let me replace the clear block  
old_clear2 = """        for (const pickup of this.pickupMgr.pickups) pickup.node.destroy();
        for (const floatingText of [...this.pickupMgr.floatingTexts]) this.pickupMgr.recycleFloatingText(floatingText, true);"""

new_clear = """        this.pickupMgr.clearAll();"""

text = text.replace(old_clear2, new_clear)

# Also fix:
# this.pickupMgr.pickups = [];
# this.pickupMgr.floatingTexts = [];
old_clear_end = """        this.pickupMgr.pickups = [];
        this.pickupMgr.floatingTexts = [];"""
# These are inside clearWorld, we already replaced them via clearAll() above
# But the lines might still be there. Let's see what it looks like and remove them.
text = text.replace("""        this.pickupMgr.pickups = [];
        this.pickupMgr.floatingTexts = [];""", "")

# 6. Fix the shopOffers reference in ensureShopOffers/pickShopOffers
# shopOffers was not in the moved fields list (it was mentioned as remaining)
# Let me check - the task says to move `acquiredRunItemIds`, `acquiredStatUpgradeIds`
# But NOT shopOffers. So shopOffers stays in RogueShooterGame.

# Actually, let me verify - shopOffers was removed from the field declarations earlier.
# Let me check... No, shopOffers was part of the block I removed.
# I removed the block that included shopOffers. Let me add it back.

# Add shopOffers back:
text = text.replace("""    private perfSepChecks = 0;""",
                     """    private perfSepChecks = 0;
    private shopOffers: LevelUpgrade[] = [];""")

# 7. Remove the old method implementations from the file
# The methods are now on PickupManager but their old implementations still exist as private methods
# of RogueShooterGame. We need to remove these blocks.

# The methods to remove (with their full bodies):
# We can find them by looking for "private XXX(" and then matching braces

# Let me define the method signatures to remove
methods_to_remove = [
    "private pickupArtName",
    "private isChestPickup",
    "private updatePickups",
    "private tryDropChest",
    "private dropPickup",
    "private findMergeablePickup",
    "private addAmountToPickup",
    "private absorbPickupInto",
    "private compactPickupOverflow",
    "private getPickupVisualRadius",
    "private collectPickup",
    "private gainXp",
    "private openLevelChoices",
    "private openItemChoices",
    "private renderChoicePanel",
    "private choosePanelChoice",
    "private chooseLevelUpgrade",
    "private chooseRunItem",
    "private resumeCombatAfterChoice",
    "private applyLevelUpgrade",
    "private applyRunItem",
    "private refreshCurrentChoices",
    "private applyStatEffects",
    "private chooseLoot",
    "private createLootChoices",
    "private drawPickup",
    "private spawnFloatingText",
    "private acquireFloatingText",
    "private updateFloatingTexts",
    "private recycleFloatingText",
    "private getPickupRadius",
]

# Remove method blocks by finding start and end
def remove_method(text, method_signature_start):
    """Remove a method block by its signature start pattern."""
    pattern = re.escape(method_signature_start) + r'\s*\([^)]*\)\s*\{'
    match = re.search(pattern, text)
    if not match:
        # Try without private (already substituted)
        return text
    
    start = match.start()
    # Find the matching closing brace
    brace_depth = 0
    i = match.end() - 1  # start at the {
    while i < len(text):
        if text[i] == '{':
            brace_depth += 1
        elif text[i] == '}':
            brace_depth -= 1
            if brace_depth == 0:
                end = i + 1
                # Remove the method block (including any leading blank lines)
                # Look back for preceding empty lines/newlines
                pre_start = start
                while pre_start > 0 and text[pre_start-1] in '\n\r ':
                    pre_start -= 1
                # Remove up to pre_start
                text = text[:pre_start] + text[end:]
                return text
        i += 1
    return text

for sig in methods_to_remove:
    text = remove_method(text, sig)

with open(path, 'w') as f:
    f.write(text)

print("Done. Wrote file.")

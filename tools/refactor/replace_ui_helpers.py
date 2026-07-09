#!/usr/bin/env python3
"""Replace inline UI helper calls with UIHelpers imports and remove old private methods."""
import re

path = '/Users/ronghui/Documents/game_dev_cocos/assets/scripts/RogueShooterGame.ts'
with open(path) as f:
    src = f.read()

# 1. Add import for UIHelpers after existing ui imports
old_import = "import { PanelManager } from './ui/panels';"
new_import = old_import + "\nimport { makeLabel, makeRect, makeButton, drawButton, place, placeLocal, hex, clamp } from './ui/UIHelpers';"
src = src.replace(old_import, new_import)

# 2. Replace all calls: this.label( -> makeLabel(  etc
# Order matters: longer match first (placeLocal before place)
replacements = [
    ('this.placeLocal(', 'placeLocal('),
    ('this.place(', 'place('),
    ('this.makeLabel(', 'makeLabel('),  # safety
    ('this.label(', 'makeLabel('),
    ('this.rect(', 'makeRect('),
    ('this.button(', 'makeButton('),
    ('this.drawButton(', 'drawButton('),
    ('this.hex(', 'hex('),
    ('this.clamp(', 'clamp('),
]

for old, new in replacements:
    src = src.replace(old, new)

# 3. Remove the old private method definitions
# Mark the area from `private button(` through `private distanceSq(`
# We need to remove these private methods:
# - private button(...)
# - private drawButton(...)
# - private rect(...)
# - private label(...)
# - private place(...)
# - private placeLocal(...)
# - private hex(...)
# - private clamp(...)
# - private distanceSq(...)

# Remove from "# private button" to before "private randomRange"
# Use regex to match multi-line method definitions
# Each method starts with `  private xxx(` and ends at the next method or private field

patterns = [
    r'\n  private button\([^)]+\):[^;]+ButtonView \{[^}]*?\n  \}\n',
    r'\n  private drawButton\([^)]+\): void \{[^}]*?\n  \}\n',
    r'\n  private rect\([^)]+\): Node \{[^}]*?\n  \}\n',
    r'\n  private label\([^)]+\): Label \{[^}]*?\n  \}\n',
    r'\n  private place\(node: Node, designX: number, designY: number\): void \{[^}]*?\n  \}\n',
    r'\n  private placeLocal\([^)]+\): void \{[^}]*?\n  \}\n',
    r'\n  private hex\([^)]+\): Color \{[^}]*?\n  \}\n',
    r'\n  private clamp\([^)]+\) \{[^}]*?\n  \}\n',
]

for p in patterns:
    src = re.sub(p, '\n', src, count=1)

# Remove the specific methods more carefully by line range
# The methods are in the range from `private button(` to `private randomRange(`
# Let's find exact line numbers
lines = src.split('\n')

# Find start/end of methods to delete
start_markers = [
    '  private button(',
    '  private drawButton(',
    '  private rect(',
    '  private label(',
    '  private place(node: Node, designX',
    '  private placeLocal(',
    '  private hex(hex',
    '  private clamp(value',
]
end_marker = '  private randomRange('

# Find line indices
start_indices = []
for i, line in enumerate(lines):
    for m in start_markers:
        if m in line:
            start_indices.append(i)
            break

end_idx = -1
for i, line in enumerate(lines):
    if end_marker in line:
        end_idx = i
        break

if start_indices and end_idx > 0:
    first = min(start_indices)
    last = max(start_indices)
    # Find the actual end of the last method (the next `private` after last start)
    next_private = -1
    for i in range(last + 1, min(last + 300, len(lines))):
        if lines[i].strip().startswith('private ') and i > last:
            next_private = i
            break
    if next_private > 0:
        # Remove from first to next_private
        del lines[first:next_private]
    else:
        # Fallback: remove from first to end_marker
        del lines[first:end_idx]

src = '\n'.join(lines)

with open(path, 'w') as f:
    f.write(src)

# Count remaining
remaining = src.count('\n') + 1
print(f'Done. File now ~{remaining} lines')
print(f'makeLabel calls: {src.count("makeLabel(")}')
print(f'makeRect calls: {src.count("makeRect(")}')
print(f'makeButton calls: {src.count("makeButton(")}')
print(f'drawButton calls: {src.count("drawButton(")}')
print(f'place calls: {src.count(", place(")}')
print(f'hex calls: {src.count("hex(")}')
print(f'clamp calls: {src.count("clamp(")}')

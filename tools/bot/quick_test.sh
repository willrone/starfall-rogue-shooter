#!/bin/bash
# Quick test: just check if CDP is accessible and game state can be read
set -e

echo "=== Checking Chrome DevTools ==="
curl -s http://localhost:9222/json | python3 -c "
import json,sys
data = json.load(sys.stdin)
for p in data:
    print(f'  Page: {p.get(\"title\",\"?\")[:50]} @ {p.get(\"webSocketDebuggerUrl\",\"\")}')
"

echo ""
echo "=== Starting bot (1 run, 60s timeout) ==="
cd /Users/ronghui/Documents/game_dev_cocos
python3 tools/bot/bot.py --runs 1 --no-launch --out data/bot_results &
BOT_PID=$!

# Loop: wait up to 60s, print output
for i in $(seq 1 60); do
    sleep 1
    if ls data/bot_results/*.csv data/bot_results/*.json 2>/dev/null; then
        echo ""
        echo "=== Data collected! ==="
        cat data/bot_results/summary.csv 2>/dev/null || echo "(no summary)"
        break
    fi
done

# Kill bot if still running
kill $BOT_PID 2>/dev/null || true
wait $BOT_PID 2>/dev/null || true

echo ""
echo "=== Done ==="

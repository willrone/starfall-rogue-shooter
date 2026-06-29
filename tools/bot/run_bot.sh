#!/bin/bash
set -e

# Kill any old Chrome bot profile
pkill -f "chrome_bot_profile" 2>/dev/null || true
sleep 1

# Start Cocos Creator preview
echo "Starting Cocos Creator preview..."
'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator' \
  --project /Users/ronghui/Documents/game_dev_cocos \
  --preview 2>/dev/null &
COCOS_PID=$!
echo "Cocos PID: $COCOS_PID"

# Wait for preview server
echo "Waiting 30s for preview to start..."
sleep 30

# Launch Chrome with debug port
echo "Launching Chrome with remote debugging..."
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome_bot_profile \
  --no-first-run \
  --no-default-browser-check \
  http://localhost:7456 &
CHROME_PID=$!
echo "Chrome PID: $CHROME_PID"

# Wait for Chrome to be ready
sleep 5

# Run the bot
echo "Starting bot..."
cd /Users/ronghui/Documents/game_dev_cocos
python3 tools/bot/bot.py --runs 5 --out data/bot_results 2>&1

# Cleanup
echo "Cleaning up..."
kill $CHROME_PID 2>/dev/null || true
kill $COCOS_PID 2>/dev/null || true
echo "Done."

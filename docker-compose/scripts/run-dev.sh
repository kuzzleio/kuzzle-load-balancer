#!/bin/sh

echo "[$(date --rfc-3339 seconds)] - Installing Kuzzle Proxy dependencies..."

npm install
npm run plugins

sleep 1

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle Proxy..."

pm2 start --silent /config/pm2.json
pm2 sendSignal -s SIGUSR1 KuzzleProxy
nohup node-inspector --web-port=8080 --debug-port=7003 > /dev/null 2>&1&
pm2 logs --lines 0 --raw

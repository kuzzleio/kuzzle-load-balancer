#!/bin/sh

echo "" > /opt/node-v$NODE_VERSION-linux-x64/lib/node_modules/pm2/lib/keymetrics
echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle Proxy..."

npm install
npm run plugins

sleep 1

pm2 start --silent /config/pm2.json
pm2 sendSignal -s SIGUSR1 KuzzleLB
nohup node-inspector --web-port=8080 --debug-port=7003 > /dev/null 2>&1&
pm2 logs --lines 0 --raw

#!/bin/sh

echo "[$(date --rfc-3339 seconds)] - Installing Kuzzle Proxy dependencies..."

npm install

sleep 1

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle Proxy..."

pm2 start --silent /config/pm2.json
pm2 logs --lines 0 --raw

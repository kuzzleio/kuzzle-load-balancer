#!/bin/sh

echo "[$(date --rfc-3339 seconds)] - Installing Kuzzle Proxy dependencies..."

npm install --unsafe

sleep 1

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle Proxy..."

npm start

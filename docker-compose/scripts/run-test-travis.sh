#!/bin/sh

set -e

APP_DIRECTORY=$(dirname $(dirname $0))
cd $APP_DIRECTORY

echo "[$(date --rfc-3339 seconds)] - Installing Kuzzle Proxy dependencies..."

npm install
npm run plugins

sleep 1

echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle Proxy tests..."

npm test
npm run codecov

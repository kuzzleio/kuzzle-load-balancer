#!/bin/sh

set -e

APP_DIRECTORY=$(dirname $(dirname $0))
cd $APP_DIRECTORY

echo "" > /opt/node-v$NODE_VERSION-linux-x64/lib/node_modules/pm2/lib/keymetrics
echo "[$(date --rfc-3339 seconds)] - Starting Kuzzle Proxy..."

npm install
npm run plugins

sleep 1

npm test
npm run codecov

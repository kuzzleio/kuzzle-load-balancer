#!/bin/sh

echo "Starting Kuzzle Load balancer..."
npm install

npm run plugins

sleep 1

pm2 start /config/pm2.json --silent

pm2 sendSignal -s USR1 KuzzleLB

pm2 logs

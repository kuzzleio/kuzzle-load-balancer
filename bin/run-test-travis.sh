#!/bin/sh

set -e

APP_DIRECTORY=$(dirname $(dirname $0))

cd $APP_DIRECTORY

npm install

sleep 5

npm test

npm run codecov

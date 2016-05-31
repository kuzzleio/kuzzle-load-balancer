#!/bin/sh

set -e

APP_DIRECTORY=$(dirname $(dirname $0))

cd $APP_DIRECTORY

npm install

npm test

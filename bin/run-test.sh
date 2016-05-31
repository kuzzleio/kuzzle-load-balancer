#!/bin/sh

APP_DIRECTORY=$(dirname $(dirname $0))

cd $APP_DIRECTORY

npm test
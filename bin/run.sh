#! /bin/bash

set -e

CURRENT_SCRIPT=$0
LOAD_BALANCER_ROOT_PATH=$(dirname $(dirname "$CURRENT_SCRIPT"))

cd ${LOAD_BALANCER_ROOT_PATH}
node bin/load-balancer.js
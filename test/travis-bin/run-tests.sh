#!/bin/bash

set -e

sudo sysctl -w vm.max_map_count=262144

docker run -v $(pwd):/var/app \
-e TRAVIS=$TRAVIS \
-e TRAVIS_COMMIT=$TRAVIS_COMMIT \
-e TRAVIS_JOB_NUMBER=$TRAVIS_JOB_NUMBER \
-e TRAVIS_BRANCH=$TRAVIS_BRANCH \
-e TRAVIS_JOB_ID=$TRAVIS_JOB_ID \
-e TRAVIS_PULL_REQUEST=$TRAVIS_PULL_REQUEST \
-e TRAVIS_REPO_SLUG=$TRAVIS_REPO_SLUG \
-e NODE_LTS=6 \
kuzzleio/core-dev /bin/sh /var/app/docker-compose/scripts/run-test.sh

docker run -v $(pwd):/var/app \
-e TRAVIS=$TRAVIS \
-e TRAVIS_COMMIT=$TRAVIS_COMMIT \
-e TRAVIS_JOB_NUMBER=$TRAVIS_JOB_NUMBER \
-e TRAVIS_BRANCH=$TRAVIS_BRANCH \
-e TRAVIS_JOB_ID=$TRAVIS_JOB_ID \
-e TRAVIS_PULL_REQUEST=$TRAVIS_PULL_REQUEST \
-e TRAVIS_REPO_SLUG=$TRAVIS_REPO_SLUG \
-e NODE_LTS=8 \
kuzzleio/core-dev /bin/sh /var/app/docker-compose/scripts/run-test.sh

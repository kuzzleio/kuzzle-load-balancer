#!/bin/bash

print_something() {
  something=$1

  echo "##############################################################"
  echo ""
  echo $something
  echo ""
  echo "##############################################################"
}

docker_build() {
  image=$1
  tag=$2
  build_arg=$3

  print_something "Build image kuzzleio/$image:$tag from kuzzle-proxy/Dockerfile"

  docker build -t kuzzleio/$image:$tag -f Dockerfile --build-arg $build_arg .
}

docker_tag() {
  image=$1
  tag=$2

  print_something "Tag image kuzzleio/$image with $tag"

  docker tag kuzzleio/$image kuzzleio/$image:$tag
}

docker_push() {
  image=$1
  tag=$2

  print_something "Push image kuzzleio/$image:$tag to Dockerhub"

  docker push kuzzleio/$image:$tag
}

if [ -z "$TRAVIS_BRANCH" ]; then
  echo "TRAVIS_BRANCH not found"
  exit 1
fi

if [ "$TRAVIS_BRANCH" == "1.x" ]; then
  tag="develop"

  docker_build 'proxy' $tag proxy_branch=$TRAVIS_BRANCH

  docker_push 'proxy' $tag
elif [ "$TRAVIS_BRANCH" == "master" ]; then
  tag=$TRAVIS_TAG

  # Build and push only if we had a tag (it may be a hotfix merge).
  if [ ! -z "$tag" ]; then
    docker_build 'proxy' $tag proxy_branch=$TRAVIS_BRANCH

    docker_tag "proxy:$tag" latest

    docker_push 'proxy' $tag

    docker_push 'proxy' 'latest'
  fi

  rm -rf kuzzle-containers
fi

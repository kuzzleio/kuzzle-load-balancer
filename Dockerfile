FROM kuzzleio/lb-base:alpine
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/

RUN npm install

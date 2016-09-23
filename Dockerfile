FROM kuzzleio/proxy-base:alpine
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/

RUN set -ex && \
    apk add \
      build-base && \
    npm install && \
    echo "" > /var/app/node_modules/pm2/lib/keymetrics && \
    apk del --purge \
      build-base

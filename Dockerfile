FROM kuzzleio/proxy-base:alpine
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/

RUN set -ex && \
    apk add \
      build-base && \
    npm install && \
    apk del --purge \
      build-base

################################################################################
## Builder image for proxy                                                    ##
################################################################################
FROM debian:stretch-slim as proxy-builder

ENV NODE_VERSION=8.9.0
ENV PATH=/opt/node-v$NODE_VERSION-linux-x64/bin:$PATH

ARG proxy_branch=master

ADD https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz /tmp/

RUN  set -x \
  \
  && apt-get update && apt-get install -y \
       bash-completion \
       build-essential \
       curl \
       g++ \
       gdb \
       git \
       python \
       libfontconfig \
       wget \
  && tar xf /tmp/node-v$NODE_VERSION-linux-x64.tar.gz -C /opt/ \
  && rm /tmp/node-v$NODE_VERSION-linux-x64.tar.gz \
  && mkdir -p /var/app \
  && npm install -g npm \
  && npm set progress=false \
  && npm install -g \
    pm2 \
  && echo "" > /opt/node-v$NODE_VERSION-linux-x64/lib/node_modules/pm2/lib/keymetrics \
  && rm -rf /var/lib/apt/lists/* \
  && echo "alias ll=\"ls -lahF --color\"" >> ~/.bashrc

COPY ./ /var/app/

WORKDIR /var/app

RUN  npm install --unsafe \
  && npm rebuild all --unsafe \
  && sh /var/app/docker-compose/scripts/install-plugins.sh

################################################################################
## Proxy image                                                                ##
################################################################################
FROM debian:stretch-slim as proxy

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="[Deprecated] Proxy and multiplexer for Kuzzle"

ENV NODE_VERSION=8.9.0
ENV NODE_ENV=production
ENV PATH=/opt/node-v$NODE_VERSION-linux-x64/bin:$PATH

COPY --from=proxy-builder /var/app /var/app
COPY --from=proxy-builder /opt/node-v$NODE_VERSION-linux-x64 /opt/node-v$NODE_VERSION-linux-x64
COPY ./docker-compose/scripts/run.sh /run.sh

RUN chmod +x /run.sh

WORKDIR /var/app

CMD ["/run.sh"]

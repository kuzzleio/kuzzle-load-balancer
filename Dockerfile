FROM kuzzleio/base
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/
ADD ./docker-compose/scripts/run.sh /run.sh
ADD ./docker-compose/config/pm2.json /config/pm2.json

RUN apt-get update && apt-get install -y \
      build-essential \
      git \
      g++ \
      python && \
    npm install && \
    npm run plugins && \
    apt-get clean && \
    apt-get remove -y \
      build-essential \
      g++ \
      python && \
    apt-get autoremove -y && \
    chmod 755 /run.sh

/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  _protocol = 'websocket',
  debug = require('debug')('kuzzle-proxy:websocket-protocol'),
  WebSocketServer = require('ws').Server,
  ClientConnection = require('../../core/clientConnection'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors;

/**
 * @class Websocket
 */
class Websocket {
  constructor() {
    this.channels = {};
    this.connectionPool = {};
    this.server = null;
  }

  init(proxy) {
    debug('initializing WebSocket Server with config:\n%O', proxy.config.websocket);

    if (!proxy.config.websocket.enabled) {
      return;
    }

    this.proxy = proxy;

    this.server = new WebSocketServer({server: proxy.httpProxy.server}, {perMessageDeflate: false});

    this.server.on('connection', this.onConnection.bind(this));
    this.server.on('error', this.onServerError.bind(this));

    this.proxy.protocolStore.add(_protocol, this);
  }

  onServerError(error) {
    this.proxy.log.error('[websocket] An error has occured:\n' + error.stack);
  }

  onConnection(clientSocket) {
    let ips = [clientSocket.upgradeReq.connection.remoteAddress];
    if (clientSocket.upgradeReq.headers['x-forwarded-for']) {
      ips = clientSocket.upgradeReq.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection(_protocol, ips, clientSocket.upgradeReq.headers);
    debug('[%s] creating Websocket connection', connection.id);

    try {
      this.proxy.router.newConnection(connection);
    }
    catch (err) {
      this.proxy.log.error('[websocket] Unable to register connection to the proxy\n%s', err.stack);
      // Using the 4xxx code range, as the current implementation of
      // the "ws" library does not support the 1013 (Try Again Later)
      // error event
      return clientSocket.close(4000 + err.status, err.message);
    }

    this.connectionPool[connection.id] = {
      alive: true,
      socket: clientSocket,
      channels: []
    };

    clientSocket.on('close', () => {
      debug('[%s] receiving a `close` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    clientSocket.on('error', () => {
      debug('[%s] receiving a `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    clientSocket.on('message', data => {
      debug('[%s] receiving a `message` event', connection.id);
      this.onClientMessage(connection.id, data);
    });
  }

  onClientDisconnection(clientId) {
    debug('[%s] onClientDisconnection', clientId);

    if (this.connectionPool[clientId]) {
      this.connectionPool[clientId].alive = false;
      this.proxy.router.removeConnection(clientId);

      this.connectionPool[clientId].channels.forEach(channel => {
        if (this.channels[channel] && this.channels[channel].count > 1) {
          delete this.channels[channel][clientId];
          this.channels[channel].count--;
        }
        else {
          delete this.channels[channel];
        }
      });

      delete this.connectionPool[clientId];
    }
  }

  onClientMessage(clientId, data) {
    if (data && this.connectionPool[clientId]) {
      let parsed;

      if (data.length > this.proxy.httpProxy.maxRequestSize) {
        this.proxy.log.error(`[websocket] Input message length(${data.length}) exceed maxRequestSize: ${this.proxy.httpProxy.maxRequestSize}`);
        return send(this.connectionPool, clientId, JSON.stringify(new SizeLimitError('Error: maximum input request size exceeded')));
      }

      debug('[%s] onClientMessage:\n%O', clientId, data);

      try {
        parsed = JSON.parse(data);
      }
      catch (e) {
        /*
         we cannot add a "room" information since we need to extract
         a request ID from the incoming data, which is apparently
         not a valid JSON
         So... the error is forwarded to the client, hoping he know
         what to do with it.
         */
        return send(this.connectionPool, clientId, JSON.stringify(new BadRequestError(e.message)));
      }

      let request;

      try {
        request = new Request(parsed, {
          connectionId: clientId,
          protocol: _protocol
        });
      }
      catch (e) {
        const errobj = {
          room: parsed.requestId,
          status: 400,
          error: {
            message: e.message
          }
        };

        return send(this.connectionPool, clientId, JSON.stringify(errobj));
      }

      this.proxy.router.execute(request, response => {
        if (response.content && typeof response.content === 'object') {
          response.content.room = response.requestId;
        }
        send(this.connectionPool, clientId, JSON.stringify(response.content));
      });
    }
  }

  broadcast(data) {
    /*
     Avoids stringifying the payload multiple times just to update the room:
     - we start deleting the last character, which is the closing JSON bracket ('}')
     - we then only have to inject the following string to each channel:
     ,"room":"<roomID>"}

     So, instead of stringifying the payload for each channel, we only concat
     a new substring to the original payload.
     */
    const payload = JSON.stringify(data.payload).slice(0, -1) + ',"room":"';

    debug('broadcast:\n%O', data);

    data.channels.forEach(channel => {
      if (this.channels[channel]) {
        const channelPayload = payload + channel + '"}';

        Object.keys(this.channels[channel]).forEach(connectionId => {
          send(this.connectionPool, connectionId, channelPayload);
        });
      }
    });
  }

  notify(data) {
    const payload = data.payload;

    debug('notify:\n%O', data);

    data.channels.forEach(channel => {
      payload.room = channel;
      send(this.connectionPool, data.connectionId, JSON.stringify(payload));
    });
  }

  joinChannel(data) {
    debug('joinChannel:\n%O', data);

    if (this.connectionPool[data.connectionId] && this.connectionPool[data.connectionId].alive) {
      if (!this.channels[data.channel]) {
        this.channels[data.channel] = {
          count: 0
        };
      }

      this.channels[data.channel][data.connectionId] = true;
      this.channels[data.channel].count++;
      this.connectionPool[data.connectionId].channels.push(data.channel);
    }
  }

  leaveChannel(data) {
    debug('leaveChannel:\n%O', data);

    if (this.connectionPool[data.connectionId] && this.connectionPool[data.connectionId].alive && this.channels[data.channel] && this.channels[data.channel][data.connectionId]) {
      if (this.channels[data.channel].count > 1) {
        delete this.channels[data.channel][data.connectionId];
        this.channels[data.channel].count--;
      }
      else {
        delete this.channels[data.channel];
      }

      const index = this.connectionPool[data.connectionId].channels.indexOf(data.channel);

      if (index !== -1) {
        this.connectionPool[data.connectionId].channels.splice(index, 1);
      }
    }
  }

  disconnect(clientId) {
    debug('[%s]disconnect', clientId);

    if (this.connectionPool[clientId]) {
      this.connectionPool[clientId].socket.close('CLOSEDONREQUEST', 'Connection closed by remote host');
    }
  }
}

function send(pool, id, data) {
  debug('[%s]send:\n%O', id, data);

  if (pool[id] && pool[id].alive && pool[id].socket.readyState === pool[id].socket.OPEN) {
    pool[id].socket.send(data);
  }
}

module.exports = Websocket;

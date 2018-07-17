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
  _protocol = 'socketio',
  debug = require('../../kuzzleDebug')('kuzzle-proxy:socketio-protocol'),
  ClientConnection = require('../../core/clientConnection');

/**
 * @CLASS SocketIo
 */
class SocketIo {
  constructor() {
    this.sockets = {};
    this.io = null;
  }
  init(proxy) {
    debug('initializing socketIo Server with config: %a', proxy.config.socketio);

    if (!proxy.config.socketio.enabled) {
      return;
    }

    this.proxy = proxy;

    // SocketIo server listens by default to "/socket.io" path
    // (see (http://socket.io/docs/server-api/#server#path(v:string):server))
    this.io = require('socket.io')(proxy.httpProxy.server);

    this.io.set('origins', proxy.config.socketio.origins);

    this.io.on('connection', this.onConnection.bind(this));
    this.io.on('error', this.onServerError.bind(this));

    this.proxy.protocolStore.add(_protocol, this);
  }

  onServerError(error) {
    this.proxy.log.error('[socketio] An error has occured:\n' + error.stack);
  }

  onConnection(socket) {
    let ips = [socket.handshake.address];

    if (socket.handshake.headers['x-forwarded-for']) {
      ips = socket.handshake.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection(_protocol, ips, socket.handshake.headers);
    debug('[%s] creating SocketIO connection on socket %s', connection.id, socket.id);

    try {
      this.proxy.router.newConnection(connection);
    }
    catch (err) {
      this.proxy.log.warn('[socketio] Client connection refused with message "%s": initialization still underway', err.message);

      socket.disconnect();

      return false;
    }

    this.sockets[connection.id] = socket;

    socket.on('disconnect', () => {
      debug('[%s] receiving a `disconnect` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('error', () => {
      debug('[%s] receiving a `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('kuzzle', data => {
      debug('[%s] receiving a `kuzzle` event', connection.id);
      this.onClientMessage(socket, connection, data);
    });

    return true;
  }

  onClientDisconnection(clientId) {
    debug('[%s] onClientDisconnection', clientId);

    if (this.sockets[clientId]) {
      delete this.sockets[clientId];
      this.proxy.router.removeConnection(clientId);
    }
  }

  onClientMessage(socket, connection, data) {
    if (data && this.sockets[connection.id]) {
      if (data.toString().length > this.proxy.httpProxy.maxRequestSize) {
        this.proxy.log.error(`[socketio] Input message length(${data.length}) exceed maxRequestSize: ${this.proxy.httpProxy.maxRequestSize}`);
        return this.io.to(socket.id).emit(data.requestId, {
          status: 413,
          error: {message: 'Error: maximum input request size exceeded'}
        });
      }

      debug('[%s] onClientMessage: %a', connection.id, data);

      try {
        this.proxy.router.execute(data, connection, response => {
          this.io.to(socket.id).emit(response.requestId, response.content);
        });
      }
      catch (e) {
        return this.io.to(socket.id).emit(data.requestId, {
          status: 400,
          error: {
            message: e.message
          }
        });
      }
    }
  }

  broadcast(data) {
    debug('broadcast: %a', data);

    data.channels.forEach(channel => {
      this.io.to(channel).emit(channel, data.payload);
    });
  }

  notify(data) {
    debug('notify: %a', data);

    if (this.sockets[data.connectionId]) {
      data.channels.forEach(channel => {
        this.sockets[data.connectionId].emit(channel, data.payload);
      });
    }
  }

  joinChannel(data) {
    debug('joinChannel: %a', data);

    if (this.sockets[data.connectionId]) {
      this.sockets[data.connectionId].join(data.channel);
    }
  }

  leaveChannel(data) {
    debug('leaveChannel: %a', data);

    if (this.sockets[data.connectionId]) {
      this.sockets[data.connectionId].leave(data.channel);
    }
  }

  disconnect(connectionId) {
    debug('[%s] disconnect', connectionId);

    if (this.sockets[connectionId]) {
      this.sockets[connectionId].disconnect();
    }
  }
}

module.exports = SocketIo;

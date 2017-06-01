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
  debug = require('../kuzzleDebug')('kuzzle-proxy:broker'),
  fs = require('fs'),
  http = require('http'),
  net = require('net'),
  WebSocketServer = require('ws').Server,
  Backend = require('./Backend'),
  async = require('async'),
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

/**
 * Broker constructor
 *
 * @class Broker
 */
class Broker {
  constructor() {
    this.config = null;
    this.socketOptions = null;
    this.backendHandler = null;
  }

  /**
   * Initializes the Broker
   *
   * @param {KuzzleProxy} proxy
   * @param {Object} config
   */
  init(proxy, config) {
    this.proxy = proxy;

    debug('initializing proxy broker with config: %a', config);

    this.config = config;

    this.initiateServer();
  }

  /**
   * Initializes the server socket
   */
  initiateServer() {
    let broker;
    const
      server = http.createServer(),
      initCB = () => {
        broker = new WebSocketServer({server}, {perMessageDeflate: false});

        broker.on('connection', this.onConnection.bind(this));
        broker.on('error', this.onError.bind(this));
      };

    if (this.config.socket) {
      server.on('error', error => {
        if (error.code !== 'EADDRINUSE') {
          debug('broker server received an error: %a', error);

          throw error;
        }

        net.connect(this.config.socket, () => {
          // really in use, re-throw
          throw error;
        })
          .on('error', e => {
            if (e.code !== 'ECONNREFUSED') {
              debug('broker server can\'t open requested socket, seem to be already used by another process');

              throw e;
            }

            debug('broker server can\'t open requested socket, seem to be unused, trying to recreate it');

            fs.unlinkSync(this.config.socket);
            if (broker) {
              broker.close(() => {
                server.listen(this.config.socket);
              });
            } else {
              server.listen(this.config.socket);
            }
          });
      });

      debug('initialize broker server through socket "%s"', this.config.socket);

      server.listen(this.config.socket, initCB);
    }
    else if (this.config.port) {
      if (this.config.host) {
        debug('initialize broker server through net port "%s" on host "%s"', this.config.port, this.config.host);

        server.listen(this.config.port, this.config.host, initCB);
      }
      else {
        debug('initialize broker server through net port "%s"', this.config.port);

        server.listen(this.config.port, initCB);
      }
    }
    else {
      this.proxy.log.error('Invalid configuration provided. Either "socket" or "port" must be provided.');
      process.exit(1);
    }
  }

  /**
   * Triggered when a connection is made on the brokerSocket
   *
   * @param {WebSocket} backendSocket
   */
  onConnection(backendSocket) {
    const
      backend = new Backend(backendSocket, this.proxy, this.config.timeout),
      clientConnections = this.proxy.clientConnectionStore.getAll();

    debug('[%s] broker server received a connection', backendSocket.upgradeReq && backendSocket.upgradeReq.headers ? backendSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier');

    if (this.config.socket) {
      this.proxy.log.info('Connection established with a new backend');
    }
    else {
      this.proxy.log.info(`A connection has been established with backend ${backendSocket.upgradeReq.connection.remoteAddress}.`);
    }

    async.each(
      clientConnections,
      (clientConnection, callback) => backend.sendRaw('connection', clientConnection, callback),
      error => this.handleBackendRegistration(error, backend)
    );
  }

  /**
   * Handles registration of backend, post-pone registration if http port is not received yet
   *
   * @param {Backend} backend
   * @param {Error|undefined} error
   */
  handleBackendRegistration(error, backend) {
    debug('broker server handle backend registration of backend: %a', backend);

    if (error) {
      // We presume the error comes from the socket connection and close it
      debug('broker server handle backend registration error: %a', error);

      let backendIdentifier;

      if (this.config.socket) {
        backendIdentifier = this.config.socket;
      }
      else {
        backendIdentifier = `${this.config.host || '0.0.0.0'}:${this.config.port}`;
      }

      this.proxy.log.error('Failed to init connection with backend %s:\n%s', backendIdentifier, error.stack);
      backend.socket.close();
    }
    else {
      this.proxy.backendHandler.addBackend(backend);
    }
  }

  /**
   * Triggered when the brokerSocket is in error
   *
   * @param {Error} error
   */
  onError(error) {
    this.proxy.log.error('An error occurred with the broker socket, shutting down; Reason:\n%s', error.stack);
    process.exit(1);
  }

  /**
   * Sends the client's message to one of the backends
   *
   * @param {string} room - target Kuzzle server room
   * @param {string} id - request id
   * @param {string} connectionId - connection id
   * @param {Object} data - request data to deliver to Kuzzle
   * @param {Function} callback - Client's callback to resolve
   */
  brokerCallback(room, id, connectionId, data, callback) {
    const backend = this.proxy.backendHandler.getBackend();

    if (!backend) {
      const error = new ServiceUnavailableError('Client connection refused: no Kuzzle instance found');

      if (process.env.NODE_ENV !== 'development') {
        delete error.stack;
      }

      callback(error);
    }
    else {
      backend.send(room, id, data, (error, result) => {
        this.proxy.logAccess(connectionId, data, error, result);
        callback(error, result);
      });
    }
  }

  /**
   * Adds a client connection and spreads the word to all backends
   *
   * @param {ClientConnection} connection
   */
  addClientConnection(connection) {
    debug('broker server add client connection\n%O', connection);

    const context = new RequestContext({
      connectionId: connection.id,
      protocol: connection.protocol
    });
    this.broadcastMessage('connection', context);
    this.proxy.clientConnectionStore.add(connection);
  }

  /**
   * Removes a client connection and spreads the word to all backends
   *
   * @param {ClientConnection} connection
   */
  removeClientConnection(connection) {
    debug('broker server remove client connection: %a', connection);

    const context = new RequestContext({
      connectionId: connection.id,
      protocol: connection.protocol
    });
    this.broadcastMessage('disconnect', context);
    this.proxy.clientConnectionStore.remove(connection.id);
  }

  /**
   * Broadcasts the message to all connected backends
   *
   * @param {string} room
   * @param {object} data
   */
  broadcastMessage(room, data) {
    debug('broker server broadcasting message on room "%s": %a', room, data);

    this.proxy.backendHandler.getAllBackends().forEach(backend => backend.sendRaw(room, data));
  }
}

module.exports = Broker;

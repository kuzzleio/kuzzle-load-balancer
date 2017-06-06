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
  async = require('async'),
  debug = require('../kuzzleDebug')('kuzzle-proxy:backend'),
  PendingRequest = require('../store/PendingRequest'),
  util = require('util'),
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError;

/**
 * Backend constructor
 *
 * @class Backend
 * @param {WebSocket} backendSocket
 * @param {http.IncomingMessage} req  // the http upgrade Request
 * @param {KuzzleProxy} proxy
 * @param {Number} backendTimeout
 */
class Backend {
  constructor(backendSocket, req, proxy) {
    this.proxy = proxy;
    this.active = false;

    /** @type {PendingRequest} */
    this.backendRequestStore = new PendingRequest(this.proxy.config.backend.timeout);

    /** @type {WebSocket} */
    this.socket = backendSocket;

    /** @type {String} */
    this.socketIp = req.connection.remoteAddress;

    this.socket.on('close', () => this.onConnectionClose());
    this.socket.on('error', error => this.onConnectionError(error));
    this.socket.on('message', data => this.onMessage(data));

    this.onMessageRooms = this.initializeMessageRooms();
  }

  /**
   * Triggered when a message is received
   *
   * @param {String} payload
   */
  onMessage(payload) {
    let message;

    debug('[%s] receiving message from backend: %a', this.socketIp, payload);

    try {
      message = JSON.parse(payload);
    }
    catch (error) {
      return this.proxy.log.error(`Bad message received from the backend: ${payload}; Reason: ${error}`);
    }

    if (!message.room) {
      return this.proxy.log.error(`Room is not specified in message: ${payload}`);
    }

    if (!this.onMessageRooms[message.room]) {
      return this.proxy.log.error(`Unknown message type ${message.room}`);
    }
    this.onMessageRooms[message.room](message.data);
  }

  initializeMessageRooms() {
    return {
      ready: () => {
        debug('[%s] backend "%s" is ready', this.socketIp);

        const clientConnections = this.proxy.clientConnectionStore.getAll();

        async.each(
          clientConnections,
          (clientConnection, callback) => this.sendRaw('connection', {
            connectionId: clientConnection.id,
            protocol: clientConnection.protocol
          }, callback),
          error => {
            if (error) {
              this.proxy.log.error(`error on sending client connections to backend ${this.socketIp}`);
              return this.onConnectionClose();
            }

            this.active = true;
            this.proxy.backendHandler.activateBackend();
          }
        );
      },
      response: data => {
        debug('[%s] resolving backend response for request id "%s": %a', this.socketIp, data.requestId, data);

        const cleanData = cleanStackFromError(data);
        this.backendRequestStore.resolve(cleanData.requestId, null, cleanData);
      },
      httpResponse: data => {
        debug('[%s] resolving backend HTTP response for request id "%s": %a', this.socketIp, data.requestId, data);

        const cleanData = cleanStackFromError(data);
        this.backendRequestStore.resolve(cleanData.requestId, null, cleanData);
      },
      joinChannel: data => {
        const client = this.proxy.clientConnectionStore.get(data.connectionId);

        debug('[%s] joining channel for client with connection id "%s": %a', this.socketIp, data.connectionId, data);

        if (client && client.protocol) {
          try {
            this.proxy.protocolStore.get(client.protocol).joinChannel(data);
          }
          catch (e) {
            this.proxy.log.error(`[Join Channel] Protocol ${client.protocol} failed: ${e.message}`);
          }
        }
      },
      leaveChannel: data => {
        const client = this.proxy.clientConnectionStore.get(data.connectionId);

        debug('[%s] leaving channel for client with connection id "%s": %a', this.socketIp, data.connectionId, data);

        if (client && client.protocol) {
          try {
            this.proxy.protocolStore.get(client.protocol).leaveChannel(data);
          }
          catch (e) {
            this.proxy.log.error(`[Leave Channel] Protocol ${client.type} failed: ${e.message}`);
          }
        }
      },
      notify: data => {
        const client = this.proxy.clientConnectionStore.get(data.connectionId);

        debug('[%s] sending notification to client with connection id "%s": %a', this.socketIp, data.connectionId, data);

        const cleanData = cleanStackFromError(data);

        if (client && client.protocol) {
          try {
            this.proxy.protocolStore.get(client.protocol).notify(cleanData);
          }
          catch (e) {
            this.proxy.log.error(`[Notify] Protocol ${client.protocol} failed: ${e.message}\nNotification data:\n%s`, util.inspect(cleanData, {depth: null}));
          }
        }
      },
      broadcast: data => {
        debug('[%s] broadcasting data through all protocols: %a', this.socketIp, data);

        const cleanData = cleanStackFromError(data);

        Object.keys(this.proxy.protocolStore.protocols).forEach(protocol => {
          debug('[%s] broadcasting through protocol "%s"', this.socketIp, protocol);

          try {
            this.proxy.protocolStore.protocols[protocol].broadcast(cleanData);
          }
          catch (e) {
            this.proxy.log.error(`[Broadcast] Protocol ${protocol} failed: ${e.message}\nNotification data:\n%s`, util.inspect(cleanData, {depth: null}));
          }
        });
      },
      shutdown: () => {
        if (this.active) {
          this.active = false;
          debug('[%s] kuzzle node shutting down', this.socketIp);
          this.proxy.backendHandler.removeBackend(this);
        }
      }
    };
  }

  /**
   * Triggered when the connection is closed
   */
  onConnectionClose() {
    debug('[%s] connection with backend closed', this.socketIp);

    this.proxy.log.warn(`Connection with backend ${this.socketIp} closed.`);

    if (this.active) {
      this.proxy.backendHandler.removeBackend(this);
    }
    
    this.backendRequestStore.abortAll(new KuzzleInternalError(`Connection with backend ${this.socketIp} closed.`));

    // We ensure the socket is closed to avoid weird side effects
    this.socket.close();

    if (this.proxy.backendHandler.getBackend() === null) {
      const clientConnections = this.proxy.clientConnectionStore.getAll();

      debug('no backend left, disconnecting clients');

      for (const connection of clientConnections) {
        const protocol = this.proxy.protocolStore.get(connection.protocol);
        if (protocol) {
          protocol.disconnect(connection.id);
        }
      }
    }
  }

  /**
   * Triggered when an error raises
   *
   * @param {Error} error
   */
  onConnectionError(error) {
    debug('[%s] connection with backend errored:\n%O', this.socketIp, error);

    this.proxy.log.error(`Connection error with backend ${this.socketIp}; Reason: ${error}`);

    if (this.active) {
      this.proxy.backendHandler.removeBackend(this);
    }

    this.backendRequestStore.abortAll(new KuzzleInternalError(`Connection error with backend ${this.socketIp}; Reason: ${error}`));
  }

  /**
   * Uses the backend socket to send the message
   *
   * @param {string} id - request unique identifier
   * @param {string} room - target Kuzzle server room
   * @param {Object} data - request data to deliver to Kuzzle
   * @param {Function} callback - Client's callback to resolve
   */
  send(room, id, data, callback) {
    debug('[%s] sending message to backend in room "%s" with identifier "%s": %a', this.socketIp, room, id, data);

    this.backendRequestStore.add(id, data, callback);
    this.socket.send(JSON.stringify({room, data}));
  }

  /**
   * Sends a direct message and bypasses the pending request management
   *
   * @param {string} room - target Kuzzle server room
   * @param {Object} data - request data to deliver to Kuzzle
   * @param {Function} callback
   */
  sendRaw(room, data, callback) {
    debug('[%s] sending raw message to backend in room "%s":\n%O', this.socketIp, room, data);

    this.socket.send(JSON.stringify({room, data}), callback);
  }
}

function cleanStackFromError(data) {
  if (process.env.NODE_ENV !== 'development' && data && data.content && data.content.error) {
    delete data.content.error.stack;
  }

  return data;
}

module.exports = Backend;

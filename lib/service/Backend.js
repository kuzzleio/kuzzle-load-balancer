'use strict';

const
  debug = require('debug')('kuzzle-proxy:backend'),
  PendingRequest = require('../store/PendingRequest'),
  util = require('util'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

let _proxy;

/**
 * Backend constructor
 *
 * @param {WebSocket} backendSocket
 * @param {KuzzleProxy} proxy
 * @param {Number} backendTimeout
 * @constructor
 */
function Backend (backendSocket, proxy, backendTimeout) {
  _proxy = proxy;

  /** @type {PendingRequest} */
  this.backendRequestStore = new PendingRequest(backendTimeout);

  /** @type {WebSocket} */
  this.socket = backendSocket;

  /** @type {String} */
  this.socketIp = backendSocket.upgradeReq.connection.remoteAddress;

  this.socket.on('close', this.onConnectionClose.bind(this));
  this.socket.on('error', this.onConnectionError.bind(this));
  this.socket.on('message', this.onMessage.bind(this));

  this.onMessageRooms = this.initializeMessageRooms();
}

/**
 * Triggered when a message is received
 *
 * @param {String} payload
 */
Backend.prototype.onMessage = function (payload) {
  let message;

  debug('[%s] receiving message from backend:\n%O', this.socketIp, payload);

  try {
    message = JSON.parse(payload);
  }
  catch (error) {
    return _proxy.log.error(`Bad message received from the backend: ${payload}; Reason: ${error}`);
  }

  if (!message.room) {
    return _proxy.log.error(`Room is not specified in message: ${payload}`);
  }

  if (!this.onMessageRooms[message.room]) {
    return _proxy.log.error(`Unknown message type ${message.room}`);
  }

  this.onMessageRooms[message.room](message.data);
};

Backend.prototype.initializeMessageRooms = function () {
  return {
    response: (data) => {
      debug('[%s] resolving backend response for request id "%s":\n%O' , this.socketIp, data.requestId, client);

      this.backendRequestStore.resolve(data.requestId, null, data);
    },
    httpResponse: (data) => {
      debug('[%s] resolving backend HTTP response for request id "%s":\n%O' , this.socketIp, data.requestId, client);

      this.backendRequestStore.resolve(data.requestId, null, data);
    },
    joinChannel: (data) => {
      let client = _proxy.clientConnectionStore.get(data.connectionId);

      debug('[%s] joining channel for client with connection id "%s":\n%O' , this.socketIp, data.connectionId, client);

      if (client && client.protocol) {
        try {
          _proxy.pluginStore.getByProtocol(client.protocol).joinChannel(data);
        }
        catch (e) {
          _proxy.log.error(`[Join Channel] Plugin ${client.protocol} failed: ${e.message}`);
        }
      }
    },
    leaveChannel: (data) => {
      let client = _proxy.clientConnectionStore.get(data.connectionId);

      debug('[%s] leaving channel for client with connection id "%s":\n%O' , this.socketIp, data.connectionId, client);

      if (client && client.protocol) {
        try {
          _proxy.pluginStore.getByProtocol(client.protocol).leaveChannel(data);
        }
        catch (e) {
          _proxy.log.error(`[Leave Channel] Plugin ${client.type} failed: ${e.message}`);
        }
      }
    },
    notify: (data) => {
      let client = _proxy.clientConnectionStore.get(data.connectionId);

      debug('[%s] sending notification to client with connection id "%s":\n%O', this.socketIp, data.connectionId, client);

      if (client && client.protocol) {
        try {
          _proxy.pluginStore.getByProtocol(client.protocol).notify(data);
        }
        catch (e) {
          _proxy.log.error(`[Notify] Plugin ${client.protocol} failed: ${e.message}\nNotification data:\n%s`, util.inspect(data, {depth: null}));
        }
      }
    },
    broadcast: (data) => {
      debug('[%s] broadcasting data through all protocols:\n%O', this.socketIp, data);

      Object.keys(_proxy.pluginStore.plugins).forEach(plugin => {
        debug('[%s] broadcasting through protocol "%s"', this.socketIp, plugin);

        try {
          _proxy.pluginStore.plugins[plugin].broadcast(data);
        }
        catch (e) {
          _proxy.log.error(`[Broadcast] Plugin ${_proxy.pluginStore.plugins[plugin].protocol} failed: ${e.message}\nNotification data:\n%s`, util.inspect(data, {depth: null}));
        }
      });
    }
  };
};

/**
 * Triggered when the connection is closed
 */
Backend.prototype.onConnectionClose = function () {
  debug('[%s] connection with backend closed', this.socketIp);

  _proxy.log.warn(`Connection with backend ${this.socketIp} closed.`);
  _proxy.backendHandler.removeBackend(this);
  this.backendRequestStore.abortAll(new InternalError(`Connection with backend ${this.socketIp} closed.`));

  // We ensure the socket is closed to avoid weird side effects
  this.socket.close();
};

/**
 * Triggered when an error raises
 *
 * @param {Error} error
 */
Backend.prototype.onConnectionError = function(error) {
  debug('[%s] connection with backend errored:\n%O', this.socketIp, error);

  _proxy.log.error(`Connection error with backend ${this.socketIp}; Reason: ${error}`);
  _proxy.backendHandler.removeBackend(this);
  this.backendRequestStore.abortAll(new InternalError(`Connection error with backend ${this.socketIp}; Reason: ${error}`));
};

/**
 * Uses the backend socket to send the message
 *
 * @param {string} id - request unique identifier
 * @param {string} room - target Kuzzle server room
 * @param {Object} data - request data to deliver to Kuzzle
 * @param {Function} callback - Client's callback to resolve
 */
Backend.prototype.send = function(room, id, data, callback) {
  debug('[%s] sending message to backend in room "%s" with identifier "%s":\n%O', this.socketIp, room, id, data);

  this.backendRequestStore.add(id, data, callback);
  this.socket.send(JSON.stringify({room, data}));
};

/**
 * Sends a direct message and bypasses the pending request management
 *
 * @param {string} room - target Kuzzle server room
 * @param {Object} data - request data to deliver to Kuzzle
 * @param {Function} callback
 */
Backend.prototype.sendRaw = function(room, data, callback) {
  debug('[%s] sending raw message to backend in room "%s":\n%O', this.socketIp, room, data);

  this.socket.send(JSON.stringify({room, data}), callback);
};

module.exports = Backend;

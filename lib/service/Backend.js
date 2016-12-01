'use strict';

const
  PendingRequest = require('../store/PendingRequest'),
  util = require('util'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

/**
 * Backend constructor
 *
 * @param {WebSocket} backendSocket
 * @param {Context} context
 * @param {Number} backendTimeout
 * @constructor
 */
function Backend (backendSocket, context, backendTimeout) {
  /** @type {PendingRequest} */
  this.backendRequestStore = new PendingRequest(backendTimeout);

  /** @type {WebSocket} */
  this.socket = backendSocket;

  /** @type {Context} */
  this.context = context;

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

  try {
    message = JSON.parse(payload);
  }
  catch (error) {
    return console.error(`Bad message received from the backend : ${payload}; Reason : ${error}`);
  }

  if (!message.room) {
    return console.error(`Room is not specified in message: ${payload}`);
  }

  if (!this.onMessageRooms[message.room]) {
    return console.error(`Unknown message type ${message.room}`);
  }

  this.onMessageRooms[message.room](message.data);
};

Backend.prototype.initializeMessageRooms = function () {
  return {
    response: (data) => {
      this.backendRequestStore.resolve(data.requestId, null, data);
    },
    httpResponse: (data) => {
      this.backendRequestStore.resolve(data.requestId, null, data);
    },
    joinChannel: (data) => {
      let client = this.context.clientConnectionStore.getByConnectionId(data.connectionId);

      if (client && client.protocol) {
        try {
          this.context.pluginStore.getByProtocol(client.protocol).joinChannel(data);
        }
        catch (e) {
          console.error(`[Join Channel] Plugin ${client.protocol} failed: ${e.message}`);
        }
      }
    },
    leaveChannel: (data) => {
      let client = this.context.clientConnectionStore.getByConnectionId(data.connectionId);

      if (client && client.protocol) {
        try {
          this.context.pluginStore.getByProtocol(client.protocol).leaveChannel(data);
        }
        catch (e) {
          console.error(`[Leave Channel] Plugin ${client.type} failed: ${e.message}`);
        }
      }
    },
    notify: (data) => {
      let client = this.context.clientConnectionStore.getByConnectionId(data.connectionId);

      if (client && client.protocol) {
        try {
          this.context.pluginStore.getByProtocol(client.protocol).notify(data);
        }
        catch (e) {
          console.error(`[Notify] Plugin ${client.protocol} failed: ${e.message}\nNotification data:\n`, util.inspect(data, {depth: null}));
        }
      }
    },
    broadcast: (data) => {
      Object.keys(this.context.pluginStore.plugins).forEach(plugin => {
        try {
          this.context.pluginStore.plugins[plugin].broadcast(data);
        }
        catch (e) {
          console.error(`[Broadcast] Plugin ${this.context.pluginStore.plugins[plugin].protocol} failed: ${e.message}\nNotification data:\n`, util.inspect(data, {depth: null}));
        }
      });
    }
  };
};

/**
 * Triggered when the connection is closed
 */
Backend.prototype.onConnectionClose = function () {
  console.log(`Connection with backend ${this.socketIp} closed.`);
  this.context.backendHandler.removeBackend(this);
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
  console.error(`Connection error with backend ${this.socketIp}; Reason :`, error);
  this.context.backendHandler.removeBackend(this);
  this.backendRequestStore.abortAll(new InternalError(`Connection error with backend ${this.socketIp}; Reason : ${error}`));
};

/**
 * Uses the backend socket to send the message
 *
 * @param {string} room - target Kuzzle server room
 * @param {Object} data - request data to deliver to Kuzzle
 * @param {Function} callback - Client's callback to resolve
 */
Backend.prototype.send = function(room, data, callback) {
  this.backendRequestStore.add(data, callback);
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
  this.socket.send(JSON.stringify({room: data}), callback);
};

module.exports = Backend;

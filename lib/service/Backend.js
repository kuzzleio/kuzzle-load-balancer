var
  PendingRequest = require('../store/PendingRequest'),
  q = require('q'),
  _ = require('lodash'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * Backend constructor
 *
 * @param {WebSocket} backendSocket
 * @param {Context} globalContext
 * @param {Number} backendTimeout
 * @constructor
 */
function Backend (backendSocket, globalContext, backendTimeout) {
  /** @type {PendingRequest} */
  this.backendRequestStore = new PendingRequest(backendTimeout);

  /** @type {WebSocket} */
  this.socket = backendSocket;

  /** @type {Context} */
  this.context = globalContext;

  /** @type {String} */
  this.socketIp = backendSocket.upgradeReq.connection.remoteAddress;

  /** @type {Number} */
  this.httpPort = null;

  this.socket.on('close', this.onConnectionClose.bind(this));
  this.socket.on('error', this.onConnectionError.bind(this));
  this.socket.on('message', this.onMessage.bind(this));
}

/**
 * Triggered when a message is received
 *
 * @param {String} data
 */
Backend.prototype.onMessage = function (data) {
  var
    message = JSON.parse(data),
    client;

  switch (message.room) {
    case 'response':
      if (this.backendRequestStore.existsByRequestId(message.data.requestId)) {
        this.backendRequestStore.getByRequestId(message.data.requestId).promise.resolve(message.data.response);
        this.backendRequestStore.removeByRequestId(message.data.requestId);
      }
      // else we discard the message as the recipient is unknown and we can't do anything about it
      break;
    case 'joinChannel':
      client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        this.context.pluginStore.getByProtocol(client.type).joinChannel(message.data);
      }

      break;
    case 'leaveChannel':
      client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        this.context.pluginStore.getByProtocol(client.type).leaveChannel(message.data);
      }

      break;
    case 'notify':
      client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        this.context.pluginStore.getByProtocol(client.type).notify(message.data);
      }

      break;
    case 'broadcast':
      _.each(this.context.pluginStore.plugins, plugin => {
        plugin.broadcast(message.data);
      });
      break;
    case 'httpPortInitialization':
      this.httpPort = message.data.httpPort;
      break;
    default:
      console.error(`Unknown message type ${message.room}`);
      break;
  }
};

/**
 * Triggered when the connection is closed
 */
Backend.prototype.onConnectionClose = function () {
  var pendingRequests = this.backendRequestStore.getAll();
  console.log(`Connection with backend ${this.socketIp} closed.`);
  this.context.backendConnectionStore.remove(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].promise.reject(new InternalError(`Connection with backend ${this.socketIp} closed.`));
    this.backendRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Triggered when an error raises
 *
 * @param {Error} error
 */
Backend.prototype.onConnectionError = function(error) {
  var pendingRequests = this.backendRequestStore.getAll();
  console.error(`Connection with backend ${this.socketIp} was in error; Reason :`, error);
  this.context.backendRequestStore.remove(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].promise.reject(new InternalError(`Connection with backend ${this.socketIp} was in error; Reason : ${error}`));
    this.backendRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Uses the backend socket to send the message
 *
 * @param {{message: Object, promise: *}} pendingItem
 */
Backend.prototype.send = function(pendingItem) {
  this.backendRequestStore.add(pendingItem);
  this.socket.send(JSON.stringify(pendingItem.message));
};

/**
 * Sends a direct message and bypasses the pending request management
 *
 * @param {String} message
 */
Backend.prototype.sendRaw = function(message) {
  return q.ninvoke(this.socket, 'send', message);
};

module.exports = Backend;
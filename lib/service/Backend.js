var
  PendingRequest = require('../store/PendingRequest'),
  _ = require('lodash'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * Backend constructor
 *
 * @param {WebSocket} backendSocket
 * @param {Context} context
 * @param {Number} backendTimeout
 * @constructor
 */
function Backend (backendSocket, context, backendTimeout) {
//** debug Starting
this.debugnow = Date.now();
// debug end***

  /** @type {PendingRequest} */
  this.backendRequestStore = new PendingRequest(backendTimeout);

  /** @type {WebSocket} */
  this.socket = backendSocket;

  /** @type {Context} */
  this.context = context;

  /** @type {String} */
  this.socketIp = backendSocket.upgradeReq.connection.remoteAddress;

  /** @type {Number} */
  this.httpPort = null;

  /** @type {Function|null} */
  this.httpPortCallback = null;

  this.socket.on('close', this.onConnectionClose.bind(this));
  this.socket.on('error', this.onConnectionError.bind(this));
  this.socket.on('message', this.onMessage.bind(this));

  this.onMessageRooms = this.initializeMessageRooms();
}

/**
 * Triggered when a message is received
 *
 * @param {String} data
 */
Backend.prototype.onMessage = function (data) {
  var message;

  try {
    message = JSON.parse(data);
  }
  catch (error) {
    return console.error(`Bad message received from the backend : ${data}; Reason : ${error}`);
  }

  if (!message.room) {
    return console.error(`Room is not specified in message: ${data}`);
  }

  if (!this.onMessageRooms[message.room]) {
    return console.error(`Unknown message type ${message.room}`);
  }

  this.onMessageRooms[message.room](message);
};

Backend.prototype.initializeMessageRooms = function () {
  return {
    response: (message) => {
      if (this.backendRequestStore.existsByRequestId(message.data.requestId)) {
        this.backendRequestStore.getByRequestId(message.data.requestId).callback(null, message.data.response);
        this.backendRequestStore.removeByRequestId(message.data.requestId);
    var now = Date.now();
    if (now - this.debugnow > 1000) {
      this.debugnow = now;
      console.log('MESSAGES LEFT: ', Object.keys(this.backendRequestStore.pending).length);
    }
      }
    },
    joinChannel: (message) => {
      var client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        this.context.pluginStore.getByProtocol(client.type).joinChannel(message.data);
      }
    },
    leaveChannel: (message) => {
      var client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        this.context.pluginStore.getByProtocol(client.type).leaveChannel(message.data);
      }
    },
    notify: (message) => {
      var client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        this.context.pluginStore.getByProtocol(client.type).notify(message.data);
      }
    },
    broadcast: (message) => {
      Object.keys(this.context.pluginStore.plugins).forEach(plugin => {
        this.context.pluginStore.plugins[plugin].broadcast(message.data);
      });
    },
    httpPortInitialization: (message) => {
      this.httpPort = message.data.httpPort;
      console.log(`Backend HTTP port of ${this.socketIp} received : ${this.httpPort}`);
      if (this.httpPortCallback) {
        this.httpPortCallback();
        this.httpPortCallback = null;
      }
    }
  };
};

/**
 * Triggered when the connection is closed
 */
Backend.prototype.onConnectionClose = function () {
  var pendingRequests = this.backendRequestStore.getAll();
  console.log(`Connection with backend ${this.socketIp} closed.`);
  this.context.backendHandler.removeBackend(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].callback(new InternalError(`Connection with backend ${this.socketIp} closed.`));
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
  this.context.backendHandler.removeBackend(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].callback(new InternalError(`Connection with backend ${this.socketIp} was in error; Reason : ${error}`));
    this.backendRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Uses the backend socket to send the message
 *
 * @param {{message: Object, callback: *}} pendingItem
 */
Backend.prototype.send = function(pendingItem) {
  this.backendRequestStore.add(pendingItem);
  this.socket.send(JSON.stringify(pendingItem.message));
};

/**
 * Sends a direct message and bypasses the pending request management
 *
 * @param {String} message
 * @param {Function} callback
 */
Backend.prototype.sendRaw = function(message, callback) {
  this.socket.send(message, callback);
};

module.exports = Backend;

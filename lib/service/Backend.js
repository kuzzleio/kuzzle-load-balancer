var
  PendingRequest = require('../store/PendingRequest'),
  util = require('util'),
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
      }
    },
    joinChannel: (message) => {
      var client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        try {
          this.context.pluginStore.getByProtocol(client.type).joinChannel(message.data);
        }
        catch (e) {
          console.error(`[Join Channel] Plugin ${client.type} failed: ${e.message}`);
        }
      }
    },
    leaveChannel: (message) => {
      var client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        try {
          this.context.pluginStore.getByProtocol(client.type).leaveChannel(message.data);
        }
        catch (e) {
          console.error(`[Leave Channel] Plugin ${client.type} failed: ${e.message}`);
        }
      }
    },
    notify: (message) => {
      var client = this.context.clientConnectionStore.getByConnectionId(message.data.id);

      if (client && client.type) {
        try {
          this.context.pluginStore.getByProtocol(client.type).notify(message.data);
        }
        catch (e) {
          console.error(`[Notify] Plugin ${client.type} failed: ${e.message}\nNotification data:\n`, util.inspect(message.data, {depth: null}));
        }
      }
    },
    broadcast: (message) => {
      Object.keys(this.context.pluginStore.plugins).forEach(plugin => {
        try {
          this.context.pluginStore.plugins[plugin].broadcast(message.data);
        }
        catch (e) {
          console.error(`[Broadcast] Plugin ${this.context.pluginStore.plugins[plugin].type} failed: ${e.message}\nNotification data:\n`, util.inspect(message.data, {depth: null}));
        }
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
  // We ensure the socket is closed to avoid weird side effects
  this.socket.close();

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

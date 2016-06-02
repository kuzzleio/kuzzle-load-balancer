var
  PendingRequest = require('../store/PendingRequest'),
  q = require('q'),
  _ = require('lodash'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * Server constructor
 *
 * @param {WebSocket} serverSocket
 * @param {Context} globalContext
 * @param {Number} serverTimeout
 * @constructor
 */
function Server (serverSocket, globalContext, serverTimeout) {
  /** @type {PendingRequest} */
  this.serverRequestStore = new PendingRequest();

  /** @type {WebSocket} */
  this.socket = serverSocket;

  /** @type {Context} */
  this.context = globalContext;

  /** @type {String} */
  this.socketIp = serverSocket.upgradeReq.connection.remoteAddress;

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
Server.prototype.onMessage = function (data) {
  var
    message = JSON.parse(data),
    clientProtocol;

  switch (message.room) {
    case 'response':
      if (this.serverRequestStore.existsByRequestId(message.data.requestId)) {
        this.serverRequestStore.getByRequestId(message.data.requestId).promise.resolve(message.data.response);
        this.serverRequestStore.removeByRequestId(message.data.requestId);
      }
      // else we discard the message as the recipient is unknown and we can't do anything about it
      break;
    case 'joinChannel':
      /** TODO: test type */
      clientProtocol = this.context.clientConnectionStore.getByConnectionId(message.data.id).type;
      this.context.pluginStore.getByProtocol(clientProtocol).joinChannel(message.data);
      break;
    case 'leaveChannel':
      clientProtocol = this.context.clientConnectionStore.getByConnectionId(message.data.id).type;
      this.context.pluginStore.getByProtocol(clientProtocol).leaveChannel(message.data);
      break;
    case 'notify':
      clientProtocol = this.context.clientConnectionStore.getByConnectionId(message.data.id).type;
      this.context.pluginStore.getByProtocol(clientProtocol).notify(message.data);
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
Server.prototype.onConnectionClose = function () {
  var pendingRequests = this.serverRequestStore.getAll();
  console.log(`Connection with server ${this.socketIp} closed.`);
  this.context.serverConnectionStore.remove(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].promise.reject(new InternalError(`Connection with server ${this.socketIp} closed.`));
    this.serverRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Triggered when an error raises
 *
 * @param {Error} error
 */
Server.prototype.onConnectionError = function(error) {
  var pendingRequests = this.serverRequestStore.getAll();
  console.error(`Connection with server ${this.socketIp} was in error; Reason :`, error);
  this.context.serverConnectionStore.remove(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].promise.reject(new InternalError(`Connection with server ${this.socketIp} was in error; Reason : ${error}`));
    this.serverRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Uses the server socket to send the message
 *
 * @param {{message: Object, promise: *}} pendingItem
 */
Server.prototype.send = function(pendingItem) {
  this.serverRequestStore.add(pendingItem);
  this.socket.send(JSON.stringify(pendingItem.message));
};

/**
 * Sends a direct message and bypasses the pending request management
 *
 * @param {String} message
 */
Server.prototype.sendRaw = function(message) {
  return q.ninvoke(this.socket, 'send', message);
};

module.exports = Server;
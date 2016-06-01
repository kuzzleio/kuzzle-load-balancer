var
  PendingRequest = require('../store/PendingRequest'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  q = require('q');

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
  this.pendingRequestStore = new PendingRequest(serverTimeout);

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
    dataObject = JSON.parse(data),
    responseObjectWrapper,
    clientProtocol;

  switch (dataObject.webSocketMessageType) {
    case 'message':
      if (this.pendingRequestStore.existsByRequestId(dataObject.requestId)) {
        responseObjectWrapper = new this.context.ResponseObject(dataObject.message);
        this.pendingRequestStore.getByRequestId(dataObject.requestId).promise.resolve(responseObjectWrapper);
        this.pendingRequestStore.removeByRequestId(dataObject.requestId);
      }
      // else we discard the message as the recipient is unknown and we can't do anything about it
      break;
    case 'notify':
      clientProtocol = this.context.clientConnectionStore.getBySocketId(dataObject.webSocketId).protocol;
      this.context.pluginStore.getByProtocol(clientProtocol).notify(dataObject.message);
      break;
    case 'broadcast':
      clientProtocol = this.context.clientConnectionStore.getBySocketId(dataObject.webSocketId).protocol;
      dataObject.message.id = dataObject.webSocketId;
      this.context.pluginStore.getByProtocol(clientProtocol).notify(dataObject.message);
      break;
    case 'httpPortInitialization':
      this.httpPort = dataObject.message.httpPort;
      break;
    default:
      console.error(`plugin-websocket-demultiplexer: Unknown message type ${dataObject.webSocketMessageType}`);
      break;
  }
};

/**
 * Triggered when the connection is closed
 */
Server.prototype.onConnectionClose = function () {
  var pendingRequests = this.pendingRequestStore.getAll();
  console.log(`Connection with server ${this.socketIp} closed.`);
  this.context.serverConnectionStore.remove(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].promise.reject(new InternalError(`Connection with server ${this.socketIp} closed.`));
    this.pendingRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Triggered when an error raises
 *
 * @param {Error} error
 */
Server.prototype.onConnectionError = function(error) {
  var pendingRequests = this.pendingRequestStore.getAll();
  console.error(`Connection with server ${this.socketIp} was in error; Reason :`, error);
  this.context.serverConnectionStore.remove(this);

  Object.keys(pendingRequests).forEach((requestId) => {
    pendingRequests[requestId].promise.reject(new InternalError(`Connection with server ${this.socketIp} was in error; Reason : ${error}`));
    this.pendingRequestStore.removeByRequestId(requestId);
  });
};

/**
 * Uses the server socket to send the message
 *
 * @param {{connection: *, request: Object, promise: *}} pendingItem
 */
Server.prototype.send = function(pendingItem) {
  this.pendingRequestStore.add(pendingItem);

  this.socket.send(JSON.stringify(pendingItem.request));
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
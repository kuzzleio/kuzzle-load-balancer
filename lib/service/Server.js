var
  PendingRequest = require('../store/PendingRequest'),
  q = require('q');

/**
 * Server constructor
 *
 * @param {WebSocket} serverSocket
 * @param {Context} globalContext
 * @constructor
 */
function Server (serverSocket, globalContext) {
  /** @type {PendingRequest} */
  this.pendingRequestStore = new PendingRequest();

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
      this.httpPort = dataObject.httpPort;
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
  console.log(`Connection with server ${this.socket.upgradeReq.connection.remoteAddress} closed.`);
  this.context.broker.serverConnectionStore.remove(this);
  this.context.broker.resendPending(this.pendingRequestStore.getAll());
  this.pendingRequestStore.clear();
};

/**
 * Triggered when an error raises
 *
 * @param {Error} error
 */
Server.prototype.onConnectionError = function(error) {
  console.error(`Connection with server ${this.socket.upgradeReq.connection.remoteAddress} was in error; Reason :`, error);
  this.context.serverConnectionStore.remove(this);
  this.context.broker.resendPending(this.pendingRequestStore.getAll());
  this.pendingRequestStore.clear();
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
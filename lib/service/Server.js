var
  ResponseObjectWrapper = require('../model/ResponseObjectWrapper'),
  PendingRequest = require('../store/PendingRequest');

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

  this.socket.on('close', this.connectionClose);
  this.socket.on('error', this.connectionError);
  this.socket.on('message', this.onMessage);
}

/**
 * Triggered when a message is received
 *
 * @param {String} data
 */
Server.prototype.onMessage = data => {
  var
    dataObject = JSON.parse(data),
    responseObjectWrapper,
    clientProtocol;

  if (dataObject.requestId && this.pending.existsByRequestId(dataObject.requestId)) {
    responseObjectWrapper = new ResponseObjectWrapper(dataObject);
    this.pendingRequestStore.getByRequestId(dataObject.requestId).promise.resolve(responseObjectWrapper);
    this.pendingRequestStore.removeByRequestId(dataObject.requestId);
  } else if (dataObject.webSocketId && this.context.clientConnectionStore.getBySocketId(dataObject.webSocketId)) {
    clientProtocol = this.context.clientConnectionStore.getBySocketId(dataObject.webSocketId).protocol;
    dataObject.id = dataObject.webSocketId;
    this.context.pluginStore.get(clientProtocol).notify(dataObject);
  } else {
    // We discard the message as the recipient is unknown and we can't do anything about it
  }
};

/**
 * Triggered when the connection is closed
 */
Server.prototype.connectionClose = () => {
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
Server.prototype.connectionError = error => {
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
Server.prototype.send = pendingItem => {
  this.pendingRequestStore.add(pendingItem);

  this.socket.send(JSON.stringify(pendingItem.request));
};

/**
 * Sends a direct message and bypasses the pending request management
 *
 * @param {String} message
 */
Server.prototype.sendRaw = message => {
  this.socket.send(message);
};

module.exports = Server;
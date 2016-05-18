var
  ResponseObjectWrapper = require('../model/ResponseObjectWrapper');

/**
 * Server constructor
 *
 * @param {WebSocket} serverSocket
 * @param {Context} globalContext
 * @constructor
 */
function Server (serverSocket, globalContext) {
  /** @type {Object[]} */
  this.pending = {};

  this.socket = serverSocket;

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

  if (dataObject.requestId && this.pending[dataObject.requestId]) {
    responseObjectWrapper = new ResponseObjectWrapper(dataObject);
    this.pending[dataObject.requestId].promise.resolve(responseObjectWrapper);
    delete this.pending[dataObject.requestId];
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
  this.context.resendPending(this.pending);
};

/**
 * Triggered when an error raises
 *
 * @param {Error} error
 */
Server.prototype.connectionError = error => {
  console.error(`Connection with server ${this.socket.upgradeReq.connection.remoteAddress} was in error; Reason :`, error);
  this.context.serverConnectionStore.remove(this);
  this.context.resendPending(this.pending);
};

// TODO
Server.prototype.send = () => {

};

// TODO
Server.prototype.sendBatch = () => {

};

module.exports = Server;
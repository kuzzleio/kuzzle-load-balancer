var
  WebSocketServer = require('ws').Server,
  Server = require('./Server'),
  q = require('q'),
  async = require('async'),
  ServerConnectionStore = require('../store/ServerConnection'),
  PendingRequest = require('../store/PendingRequest');

/**
 * Broker constructor
 *
 * @constructor
 */
function Broker () {
  this.context = null;
  this.serverConnectionStore = new ServerConnectionStore();
  this.pendingRequestStore = new PendingRequest();
  this.socketOptions = null;
}

/**
 * Initializes the Broker
 *
 * @param {Context} context
 * @param {String} mode
 * @param {Object} webSocketOptions
 */
Broker.prototype.init = function (context, mode, webSocketOptions) {
  this.context = context;
  this.socketOptions = webSocketOptions;

  if (['failover', 'roundrobin', undefined].indexOf(mode) === -1) {
    q.reject(new Error(`Server mode option must be either set to "failover" or "round-robin"; "${mode}" given`));
  }

  this.serverMode = mode || 'failover';

  this.initiateServer(this.socketOptions);
};

/**
 * Initializes the server socket
 *
 * @param {Object} webSocketOptions
 */
Broker.prototype.initiateServer = function (webSocketOptions) {
  var brokerSocket;

  console.log(`Waiting for connections on port ${webSocketOptions.port}`);

  brokerSocket = new WebSocketServer({port: webSocketOptions.port});

  brokerSocket.on('connection', this.onConnection.bind(this));
  brokerSocket.on('error', this.onError.bind(this));
};

/**
 * Triggered when a connection is made on the brokerSocket
 *
 * @param serverSocket
 */
Broker.prototype.onConnection = function (serverSocket) {
  var
    deferred = q.defer(),
    server = new Server(serverSocket, this.context),
    clientConnections = this.context.clientConnectionStore.getAll();

  console.log(`A connection has been established with server ${serverSocket.upgradeReq.connection.remoteAddress}`);

  async.forEachOf(clientConnections, (clientConnection, requestId, callback) => {
    server.sendRaw(JSON.stringify(this.addMeta({}, clientConnection, 'connection')));

    callback();
  }, () => {
    return deferred.resolve({});
  });

  deferred.promise.then(() => {
    this.serverConnectionStore.add(server);

    if (this.serverConnectionStore.count() === 1) {
      this.resendPending();
    }
  });
};

/**
 * Triggered when the brokerSocket is in error
 *
 * @param {Error} error
 */
Broker.prototype.onError = function (error) {
  console.error('An error occured with the broker socket, we shutdown; Reason :', error);
  process.exit(1);
};

/**
 * Forwards the broker pending to the server pendings when a server connects or when a server dies
 */
Broker.prototype.resendPending = function(pendingBatch) {
  if (!pendingBatch) {
    pendingBatch = this.pendingRequestStore.getAll();
    this.pendingRequestStore.clear();
  }

  Object.keys(pendingBatch).forEach(requestId => {
    this.brokerCallback(pendingBatch[requestId].connection, pendingBatch[requestId].request, pendingBatch[requestId].promise);
  });
};

/**
 * Sends the client's message to one of the servers
 *
 * @param {{socketId: String, protocol: String}} connection Client connection descriptor
 * @param {Object} message Client message
 * @param {*} promise Client promise to resolve
 */
Broker.prototype.brokerCallback = function (connection, message, promise) {
  var
    server = this.getOneServer(),
    pendingItem = {
      connection,
      request: message,
      promise
    };

  if (typeof message !== 'object' || !message.requestId && message.webSocketMessageType === 'message') {
    promise.reject(new Error(`Bad message : ${message}`));
  } else if (!server) {
    this.pendingRequestStore.add(pendingItem);
  } else {
    // The broker delegates the pending to the server
    this.pendingRequestStore.remove(pendingItem);
    server.send(pendingItem);
  }
};

/**
 * Adds a client connection and spreads the word to all servers
 *
 * @param connection
 */
Broker.prototype.addClientConnection = function (connection) {
  this.broadcastMessage(this.addMeta({}, connection, 'connection'));
  this.context.clientConnectionStore.add(connection);
};

/**
 * Removes a client connection and spreads the word to all servers
 *
 * @param connection
 */
Broker.prototype.removeClientConnection = function (connection) {
  this.broadcastMessage(this.addMeta({}, connection, 'disconnect'));
  this.context.clientConnectionStore.remove(connection);
};

/**
 * Broadcasts the message to all connected servers
 *
 * @param messageObject
 */
Broker.prototype.broadcastMessage = function (messageObject) {
  var
    servers = this.getAllServers(),
    message = JSON.stringify(messageObject);

  servers.forEach(server => {
    server.sendRaw(message);
  });
};

/**
 * Adds specific Websocket meta data to the dataObject
 *
 * @param {Object} dataObject
 * @param {Object} connection
 * @param {String} messageType
 * @returns {Object}
 */
Broker.prototype.addMeta = function (dataObject, connection, messageType) {
  dataObject.webSocketId = connection.socketId;
  dataObject.webSocketMessageType = messageType;

  return dataObject;
};

/**
 * Allows the selection of a server depending on the serverMode
 *
 * @returns {Server}
 */
Broker.prototype.getOneServer = function () {
  switch (this.serverMode) {
    case 'failover':
      if (this.serverConnectionStore.getCurrent()) {
        return this.serverConnectionStore.getCurrent();
      }
      return this.serverConnectionStore.getNext();
    case 'round-robin':
      return this.serverConnectionStore.getNext();
    case 'default':
      throw new Error(`Unknown server mode ${this.serverMode}`);
  }
};

/**
 * Get all servers (typically to perform a broadcast)
 *
 * @returns {Server[]}
 */
Broker.prototype.getAllServers = function () {
  return this.serverConnectionStore.getArray();
};

module.exports = Broker;
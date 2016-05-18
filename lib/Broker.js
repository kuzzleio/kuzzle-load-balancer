var
  WebSocketServer = require('ws').Server,
  Server = require('service/Server'),
  q = require('q'),
  async = require('async'),
  ServerConnectionStore = require('./store/ServerConnection'),
  serverMode,
  socketOptions,
  globalContext,
  pending = {};

function Broker () {
  this.serverConnectionStore = new ServerConnectionStore();
}

/**
 * Initializes the Broker
 *
 * @param {Context} context
 * @param {String} mode
 * @param {Object} webSocketOptions
 */
Broker.prototype.init = function (context, mode, webSocketOptions) {
  globalContext = context;
  socketOptions = webSocketOptions || {reconnectionAttempts: 3};

  if (['failover', 'roundrobin'].indexOf(mode) === -1) {
    q.reject(new Error(`Server mode option must be either set to "failover" or "roundrobin"; "${mode}" given`));
  }

  serverMode = mode;

  this.initiateServer(socketOptions);
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

  brokerSocket.on('connection', this.onConnection);
  brokerSocket.on('error', this.onError);
};

/**
 * Triggered when a connection is made on the brokerSocket
 *
 * @param serverSocket
 */
Broker.prototype.onConnection = function(serverSocket) {
  var deferred = q.defer();
  // TODO initialize all client connections, don't add the server in the system before it is fully initialized
  console.log(`A connection has been established with server ${serverSocket.upgradeReq.connection.remoteAddress}`);

  // TODO
  async.forEach();

  deferred.promise.then(() => {
    var server = new Server(serverSocket, globalContext);

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
Broker.prototype.onError = function(error) {
  console.error('An error occured with the broker socket, we shutdown; Reason :', error);
  process.exit(1);
};

/**
 * Forwards the broker pending to the server pendings when a server connects
 */
Broker.prototype.resendPending = function () {
  Object.keys(pending).forEach(requestId => {
    this.brokerCallback(pending[requestId].connection, pending[requestId].request, pending[requestId].promise);
  });
};

/**
 * Sends the client's message to one of the servers
 *
 * @param {{socketId: String, protocol: String}} connection Client connection descriptor
 * @param {Object} message Client message
 * @param {Promise} promise Client promise to resolve
 */
Broker.prototype.brokerCallback = function (connection, message, promise) {
  var serverSocket = this.getOneServer();
  if (!serverSocket) {
    pending[message.requestId] = {
      connection,
      request: message,
      promise
    };
  } else if (typeof message === 'object' && (message.requestId || message.webSocketMessageType !== 'message')) {
    pending[message.requestId] = {
      connection,
      request: message,
      promise
    };

    serverSocket.send(JSON.stringify(message));
  } else {
    console.error(`Bad message : ${message}`);
  }
};

/**
 * Adds a client connection and spreads the word to all servers
 *
 * @param connection
 */
Broker.prototype.addClientConnection = function (connection) {
  this.broadcastMessage(this.addMeta({}, connection, 'connection'));
  globalContext.clientConnectionStore.add(connection);
};

/**
 * Removes a client connection and spreads the word to all servers
 *
 * @param connection
 */
Broker.prototype.removeClientConnection = function (connection) {
  this.broadcastMessage(this.addMeta({}, connection, 'disconnect'));
  globalContext.clientConnectionStore.remove(connection);
};

/**
 * Broadcasts the message to all connected servers
 *
 * @param messageObject
 */
Broker.prototype.broadcastMessage = function(messageObject) {
  var
    servers = this.getAllServers(),
    message = JSON.stringify(messageObject);

  servers.forEach((serverSocket) => {
    serverSocket.send(message);
  });
};

/**
 * Return a structured connection
 *
 * @param {String} socketId
 * @param {String} protocol
 * @returns {{socketId: String, protocol: String}}
 */
Broker.prototype.getConnection = function(socketId, protocol) {
  return {
    socketId,
    protocol
  };
};

/**
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
 */
Broker.prototype.getOneServer = function () {
  switch (serverMode) {
    case 'failover':
      if (this.serverConnectionStore.getCurrent()) {
        return this.serverConnectionStore.getCurrent();
      }
      return this.serverConnectionStore.getNext();
    case 'roundrobin':
      return this.serverConnectionStore.getNext();
  }
};

/**
 * Get all servers (typically to perform a broadcast)
 */
Broker.prototype.getAllServers = function () {
  return this.serverConnectionStore.getArray();
};

module.exports = Broker;
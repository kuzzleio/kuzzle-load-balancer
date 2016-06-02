var
  WebSocketServer = require('ws').Server,
  Server = require('./Server'),
  q = require('q'),
  async = require('async'),
  PendingRequest = require('../store/PendingRequest');

/**
 * Broker constructor
 *
 * @constructor
 */
function Broker () {
  this.context = null;
  this.brokerRequestStore = null;
  this.socketOptions = null;
  this.serverMode = null;
}

/**
 * Initializes the Broker
 *
 * @param {String} serverMode
 * @param {Context} context
 * @param {Object} webSocketOptions
 * @param {Number} serverTimeout
 */
Broker.prototype.init = function (serverMode, context, webSocketOptions, serverTimeout) {
  this.context = context;
  this.socketOptions = webSocketOptions;
  this.serverMode = serverMode;
  this.serverTimeout = serverTimeout;
  this.brokerRequestStore = new PendingRequest(this.serverTimeout);

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
    server = new Server(serverSocket, this.context, this.serverTimeout),
    clientConnections = this.context.clientConnectionStore.getAll();

  console.log(`A connection has been established with server ${serverSocket.upgradeReq.connection.remoteAddress}`);

  async.forEachOf(clientConnections, (clientConnection, requestId, callback) => {
    server.sendRaw(JSON.stringify(this.addEnvelope({}, clientConnection, 'connection')))
      .then(() => callback())
      .catch((error) => callback(error));
  }, () => {
    /** TODO: Manage error */
    this.context.serverConnectionStore.add(server);

    if (this.context.serverConnectionStore.count() === 1) {
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
  console.error('An error occurred with the broker socket, shutting down; Reason :', error);
  process.exit(1);
};

/**
 * Forwards the broker pending to the server pendings when a server connects or when a server dies
 */
Broker.prototype.resendPending = function(pendingBatch) {
  if (!pendingBatch) {
    pendingBatch = this.brokerRequestStore.getAll();
    this.brokerRequestStore.clear();
  }

  Object.keys(pendingBatch).forEach(requestId => {
    // We don't add the envelope again it is already there
    this.brokerCallback(pendingBatch[requestId].message, pendingBatch[requestId].promise);
  });
};

/**
 * Sends the client's message to one of the servers
 *
 * @param {Object} message
 * @param {*} promise Client promise to resolve
 */
Broker.prototype.brokerCallback = function (message, promise) {
  var
    server = this.context.serverConnectionStore.getOneServer(this.serverMode),
    pendingItem = {
      message,
      promise
    };

  if (!message.data.request.requestId && message.room === 'request') {
    promise.reject(new Error(`Bad message : ${message}`));
  }
  else if (!server) {
    this.brokerRequestStore.add(pendingItem);
  }
  else {
    // The broker delegates the pending to the server
    this.brokerRequestStore.remove(pendingItem);
    util = require('util');
    console.log(util.inspect(pendingItem.message, {showHidden: false, depth: null}));
    server.send(pendingItem);
  }
};

/**
 * Adds a client connection and spreads the word to all servers
 *
 * @param connection
 */
Broker.prototype.addClientConnection = function (connection) {
  this.broadcastMessage(this.addEnvelope({}, connection, 'connection'));
  this.context.clientConnectionStore.add(connection);
};

/**
 * Removes a client connection and spreads the word to all servers
 *
 * @param connection
 */
Broker.prototype.removeClientConnection = function (connection) {
  this.broadcastMessage(this.addEnvelope({}, connection, 'disconnect'));
  this.context.clientConnectionStore.remove(connection);
};

/**
 * Broadcasts the message to all connected servers
 *
 * @param messageObject
 */
Broker.prototype.broadcastMessage = function (messageObject) {
  var
    servers = this.context.serverConnectionStore.getAllServers(),
    message = JSON.stringify(messageObject),
    deferred = q.defer();

  async.forEach(servers, (server, callback) => {
    server.sendRaw(message)
      .then(() => callback())
      .catch((error) => callback(error));
  }, (error) => {
    if (error) {
      return deferred.reject(error);
    }

    return deferred.resolve();
  });

  return deferred.promise;
};

/**
 * Adds specific Websocket meta data to the dataObject
 *
 * @param {Object} request
 * @param {Object} connection
 * @param {String} room
 * @returns {Object}
 */
Broker.prototype.addEnvelope = function (request, connection, room) {
  return {
    data: {
      request,
      context: {
        connection
      }
    },
    room
  };
};

module.exports = Broker;
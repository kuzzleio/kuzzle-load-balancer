var
  WebSocketServer = require('ws').Server,
  Backend = require('./Backend'),
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
  this.backendHandler = null;
}

/**
 * Initializes the Broker
 *
 * @param {Context} context
 * @param {Object} webSocketOptions
 * @param {Number} backendTimeout
 */
Broker.prototype.init = function (context, webSocketOptions, backendTimeout) {
  this.context = context;
  this.socketOptions = webSocketOptions;
  this.backendTimeout = backendTimeout;
  this.brokerRequestStore = new PendingRequest(this.backendTimeout);

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
 * @param {WebSocket} backendSocket
 */
Broker.prototype.onConnection = function (backendSocket) {
  var
    backend = new Backend(backendSocket, this.context, this.backendTimeout),
    clientConnections = this.context.clientConnectionStore.getAll();

  console.log(`A connection has been established with backend ${backendSocket.upgradeReq.connection.remoteAddress}.`);

  async.forEachOf(clientConnections, (clientConnection, requestId, callback) => {
    backend.sendRaw(JSON.stringify(this.addEnvelope({}, clientConnection, 'connection')))
      .then(() => callback())
      .catch((error) => callback(error));
  }, (error) => {
    this.handleBackendRegistration(backend, error);
  });
};

/**
 * Handles registration of backend, post-pone registration if http port is not received yet
 *
 * @param {Backend} backend
 * @param {Error|undefined} error
 */
Broker.prototype.handleBackendRegistration = function (backend, error) {
  if (error) {
    // We presume the error comes from the socket connection and close it
    console.error(`Initialization of the connection with backend ${backend.socket.upgradeReq.connection.remoteAddress} failed.`);
    backend.socket.close();
  }
  else if (backend.httpPort) {
    this.context.backendHandler.addBackend(backend);
    this.resendPending();
  }
  else {
    // Backend is added when the http port is set
    backend.httpPortCallback = () => {
      this.context.backendHandler.addBackend(backend);
      this.resendPending();
    };
  }
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
 * Forwards the broker pending to the backend pendings when a backend connects or dies
 */
Broker.prototype.resendPending = function() {
  var pendingBatch = this.brokerRequestStore.getAll();
  this.brokerRequestStore.clear();

  Object.keys(pendingBatch).forEach(requestId => {
    // We don't add the envelope again it is already there
    this.brokerCallback(pendingBatch[requestId].message, pendingBatch[requestId].promise);
  });
};

/**
 * Sends the client's message to one of the backends
 *
 * @param {Object} message
 * @param {*} promise Client promise to resolve
 */
Broker.prototype.brokerCallback = function (message, promise) {
  var
    backend = this.context.backendHandler.getBackend(),
    pendingItem = {
      message,
      promise
    };

  if (!message.data || !message.data.request) {
    promise.reject(new Error(`Bad format : ${message}`));
  }
  else if (!message.data.request.requestId && message.room === 'request') {
    promise.reject(new Error(`Bad message : ${message}`));
  }
  else if (!backend) {
    this.brokerRequestStore.add(pendingItem);
  }
  else {
    // The broker delegates the pending to the backend
    // TODO: Check if the remove is necessary, in any case shouldn't
    this.brokerRequestStore.remove(pendingItem);
    backend.send(pendingItem);
  }
};

/**
 * Adds a client connection and spreads the word to all backends
 *
 * @param connection
 */
Broker.prototype.addClientConnection = function (connection) {
  this.broadcastMessage(this.addEnvelope({}, connection, 'connection'));
  this.context.clientConnectionStore.add(connection);
};

/**
 * Removes a client connection and spreads the word to all backends
 *
 * @param connection
 */
Broker.prototype.removeClientConnection = function (connection) {
  this.broadcastMessage(this.addEnvelope({}, connection, 'disconnect'));
  this.context.clientConnectionStore.remove(connection);
};

/**
 * Broadcasts the message to all connected backends
 *
 * @param messageObject
 */
Broker.prototype.broadcastMessage = function (messageObject) {
  var
    backends = this.context.backendHandler.getAllBackends(),
    message = JSON.stringify(messageObject),
    deferred = q.defer();

  async.forEach(backends, (backend, callback) => {
    backend.sendRaw(message)
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
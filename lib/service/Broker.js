var
  WebSocketServer = require('ws').Server,
  Backend = require('./Backend'),
  Promise = require('bluebird'),
  async = require('async'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  ServiceUnavailableError = require('kuzzle-common-objects').Errors.serviceUnavailableError;

/**
 * Broker constructor
 *
 * @constructor
 */
function Broker () {
  this.context = null;
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

  brokerSocket = new WebSocketServer({port: webSocketOptions.port}, {perMessageDeflate: false});

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

  async.eachOf(clientConnections, (clientConnection, requestId, callback) => {
    backend.sendRaw(JSON.stringify(this.addEnvelope({}, clientConnection, 'connection')), callback);
  }, (error) => this.handleBackendRegistration(backend, error));
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
    console.error(`Initialization of the connection with backend ${backend.socket.upgradeReq.connection.remoteAddress} failed; Reason: ${error.message}`);
    backend.socket.close();
  }
  else {
    this.context.backendHandler.addBackend(backend);
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
 * Sends the client's message to one of the backends
 *
 * @param {Object} message
 * @param {Function} callback Client callback to resolve
 */
Broker.prototype.brokerCallback = function (message, callback) {
  var
    backend = this.context.backendHandler.getBackend(),
    pendingItem = {
      message,
      callback
    };

  if (!message.data || !message.data.request) {
    callback(new BadRequestError(`Bad format : ${message}`));
  }
  else if (!message.data.request.requestId && message.room === 'request') {
    callback(new BadRequestError(`Bad message : ${message}`));
  }
  else if (!backend) {
    callback(new ServiceUnavailableError('No Kuzzle instance found'));
  }
  else {
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
    message = JSON.stringify(messageObject);

  return new Promise((resolve, reject) => {
    async.forEach(backends, (backend, callback) => {
      backend.sendRaw(message, callback);
    }, (error) => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
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

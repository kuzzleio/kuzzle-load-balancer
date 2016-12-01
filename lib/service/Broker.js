'use strict';

let
  fs = require('fs'),
  http = require('http'),
  net = require('net'),
  WebSocketServer = require('ws').Server,
  Backend = require('./Backend'),
  async = require('async'),
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

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
 * @param {Object} config
 */
Broker.prototype.init = function (context, config) {
  this.context = context;
  this.config = config;

  this.initiateServer();
};

/**
 * Initializes the server socket
 */
Broker.prototype.initiateServer = function () {
  let
    broker,
    server = http.createServer(),
    initCB = () => {
      broker = new WebSocketServer({ server }, {perMessageDeflate: false});

      broker.on('connection', this.onConnection.bind(this));
      broker.on('error', this.onError.bind(this));
    };

  if (this.config.socket) {
    server.on('error', error => {
      if (error.code !== 'EADDRINUSE') {
        throw error;
      }

      net.connect(this.config.socket, () => {
        // really in use, re-throw
        throw error;
      })
        .on('error', e => {
          if (e.code !== 'ECONNREFUSED') {
            throw e;
          }
          fs.unlinkSync(this.config.socket);
          if (broker) {
            broker.close(() => {
              server.listen(this.config.socket);
            });
          } else {
            server.listen(this.config.socket);
          }
        });
    });
    server.listen(this.config.socket, initCB);
  }
  else if (this.config.port) {
    if (this.config.host) {
      server.listen(this.config.port, this.config.host, initCB);
    }
    else {
      server.listen(this.config.port, initCB);
    }
  }
  else {
    console.error('Invalid configuration provided. Either "socket" or "port" must be provided.');
    process.exit(1);
  }
};

/**
 * Triggered when a connection is made on the brokerSocket
 *
 * @param {WebSocket} backendSocket
 */
Broker.prototype.onConnection = function (backendSocket) {
  let
    backend = new Backend(backendSocket, this.context, this.config.timeout),
    clientConnections = this.context.clientConnectionStore.getAll();

  if (this.config.socket) {
    console.log('Connection established with a new backend');
  }
  else {
    console.log(`A connection has been established with backend ${backendSocket.upgradeReq.connection.remoteAddress}.`);
  }

  async.each(
    clientConnections,
    (clientConnection, callback) => backend.sendRaw('connection', clientConnection, callback),
    error => this.handleBackendRegistration(backend, error)
  );
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
 * @param {string} room - target Kuzzle server room
 * @param {Object} data - request data to deliver to Kuzzle
 * @param {Function} callback - Client's callback to resolve
 */
Broker.prototype.brokerCallback = function (room, data, callback) {
  let backend = this.context.backendHandler.getBackend();

  if (!backend) {
    callback(new ServiceUnavailableError('No Kuzzle instance found'));
  }
  else {
    backend.send(room, data, callback);
  }
};

/**
 * Adds a client connection and spreads the word to all backends
 *
 * @param {RequestContext} context
 */
Broker.prototype.addClientConnection = function (context) {
  this.broadcastMessage('connection', context);
  this.context.clientConnectionStore.add(context);
};

/**
 * Removes a client connection and spreads the word to all backends
 *
 * @param {RequestContext} context
 */
Broker.prototype.removeClientConnection = function (context) {
  this.broadcastMessage('disconnect', context);
  this.context.clientConnectionStore.remove(context);
};

/**
 * Broadcasts the message to all connected backends
 *
 * @param {string} room
 * @param {object} data
 */
Broker.prototype.broadcastMessage = function (room, data) {
  this.context.backendHandler.getAllBackends().forEach(backend => backend.sendRaw(room, data));
};

module.exports = Broker;

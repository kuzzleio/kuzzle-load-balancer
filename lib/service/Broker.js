'use strict';

let
  debug = require('../debug')('kuzzle-proxy:broker'),
  fs = require('fs'),
  http = require('http'),
  net = require('net'),
  WebSocketServer = require('ws').Server,
  Backend = require('./Backend'),
  async = require('async'),
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

let
  _proxy;


/**
 * Broker constructor
 *
 * @constructor
 */
function Broker () {
  this.config = null;
  this.socketOptions = null;
  this.backendHandler = null;
}

/**
 * Initializes the Broker
 *
 * @param {KuzzleProxy} proxy
 * @param {Object} config
 */
Broker.prototype.init = function (proxy, config) {
  _proxy = proxy;

  debug('initializing proxy broker with config: %a', config);

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
        debug('broker server received an error: %a', error);

        throw error;
      }

      net.connect(this.config.socket, () => {
        // really in use, re-throw
        throw error;
      })
        .on('error', e => {
          if (e.code !== 'ECONNREFUSED') {
            debug('broker server can\'t open requested socket, seem to be already used by another process');

            throw e;
          }

          debug('broker server can\'t open requested socket, seem to be unused, trying to recreate it');

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

    debug('initialize broker server through socket "%s"', this.config.socket);

    server.listen(this.config.socket, initCB);
  }
  else if (this.config.port) {
    if (this.config.host) {
      debug('initialize broker server through net port "%s" on host "%s"', this.config.port, this.config.host);

      server.listen(this.config.port, this.config.host, initCB);
    }
    else {
      debug('initialize broker server through net port "%s"', this.config.port);

      server.listen(this.config.port, initCB);
    }
  }
  else {
    _proxy.log.error('Invalid configuration provided. Either "socket" or "port" must be provided.');
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
    backend = new Backend(backendSocket, _proxy, this.config.timeout),
    clientConnections = _proxy.clientConnectionStore.getAll();

  debug('[%s] broker server received a connection', backendSocket.upgradeReq && backendSocket.upgradeReq.headers ? backendSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier');

  if (this.config.socket) {
    _proxy.log.info('Connection established with a new backend');
  }
  else {
    _proxy.log.info(`A connection has been established with backend ${backendSocket.upgradeReq.connection.remoteAddress}.`);
  }

  async.each(
    clientConnections,
    (clientConnection, callback) => backend.sendRaw('connection', clientConnection, callback),
    error => this.handleBackendRegistration(error, backend)
  );
};

/**
 * Handles registration of backend, post-pone registration if http port is not received yet
 *
 * @param {Backend} backend
 * @param {Error|undefined} error
 */
Broker.prototype.handleBackendRegistration = function (error, backend) {
  debug('broker server handle backend registration of backend: %a', backend);

  if (error) {
    // We presume the error comes from the socket connection and close it
    debug('broker server handle backend registration error: %a', error);

    let backendIdentifier;

    if (this.config.socket) {
      backendIdentifier = this.config.socket;
    }
    else {
      if (this.config.host) {
        backendIdentifier = this.config.host + ':';
      }
      else {
        backendIdentifier = '0.0.0.0:';
      }
      backendIdentifier += this.config.port;
    }

    _proxy.log.error('Failed to init connection with backend %s:\n%s', backendIdentifier, error.stack);
    backend.socket.close();
  }
  else {
    _proxy.backendHandler.addBackend(backend);
  }
};

/**
 * Triggered when the brokerSocket is in error
 *
 * @param {Error} error
 */
Broker.prototype.onError = function (error) {
  _proxy.log.error('An error occurred with the broker socket, shutting down; Reason:\n%s', error.stack);
  process.exit(1);
};

/**
 * Sends the client's message to one of the backends
 *
 * @param {string} room - target Kuzzle server room
 * @param {string} id - request id
 * @param {string} connectionId - connection id
 * @param {Object} data - request data to deliver to Kuzzle
 * @param {Function} callback - Client's callback to resolve
 */
Broker.prototype.brokerCallback = function (room, id, connectionId, data, callback) {
  const backend = _proxy.backendHandler.getBackend();

  if (!backend) {
    let error = new ServiceUnavailableError('No Kuzzle instance found');

    if (process.env.NODE_ENV !== 'development') {
      delete error.stack;
    }

    callback(error);
  }
  else {
    backend.send(room, id, data, (error, result) => {
      _proxy.logAccess(connectionId, data, error, result);
      callback(error, result);
    });
  }
};

/**
 * Adds a client connection and spreads the word to all backends
 *
 * @param {ClientConnection} connection
 */
Broker.prototype.addClientConnection = function (connection) {
  debug('broker server add client connection %a', connection);

  const context = new RequestContext({
    connectionId: connection.id,
    protocol: connection.protocol
  });
  this.broadcastMessage('connection', context);
  _proxy.clientConnectionStore.add(connection);
};

/**
 * Removes a client connection and spreads the word to all backends
 *
 * @param {ClientConnection} connection
 */
Broker.prototype.removeClientConnection = function (connection) {
  debug('broker server remove client connection %a', connection);

  const context = new RequestContext({
    connectionId: connection.id,
    protocol: connection.protocol
  });
  this.broadcastMessage('disconnect', context);
  _proxy.clientConnectionStore.remove(connection.id);
};

/**
 * Broadcasts the message to all connected backends
 *
 * @param {string} room
 * @param {object} data
 */
Broker.prototype.broadcastMessage = function (room, data) {
  debug('broker server broadcasting message on room "%s": %a', room, data);

  _proxy.backendHandler.getAllBackends().forEach(backend => backend.sendRaw(room, data));
};

module.exports = Broker;

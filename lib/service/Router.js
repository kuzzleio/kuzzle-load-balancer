'use strict';

const
  Promise = require('bluebird'),
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

/**
 * Router constructor
 *
 * @param {Context} context
 * @constructor
 */
function Router (context) {
  this.context = context;
}

/**
 * Triggered when a plugin gets a new connection
 *
 * @param {string} protocol
 * @param {string} connectionId
 * @returns {Promise}
 */
Router.prototype.newConnection = function (protocol, connectionId) {
  let
    context = new RequestContext({protocol, connectionId}),
    currentConnection;

  // Reject the connection if no backend is available
  if (!this.context.backendHandler.getBackend()) {
    return Promise.reject(new ServiceUnavailableError('No Kuzzle instance found'));
  }

  currentConnection = this.context.clientConnectionStore.get(context);
  if (!currentConnection || context.protocol !== currentConnection.protocol) {
    this.context.broker.addClientConnection(context);
  }

  return Promise.resolve(context);
};

/**
 * Triggered when a plugin receives a message
 *
 * @param {Request} request
 * @param {Function} callback
 */
Router.prototype.execute = function (request, callback) {
  this.context.broker.brokerCallback('request', request.id, request.serialize(), (error, result) => {
    if (error) {
      request.setError(error);
      return callback(null, request.response);
    }

    callback(null, result);
  });
};

/**
 * Triggered when a plugin connection is closed
 *
 * @param {RequestContext} connection
 */
Router.prototype.removeConnection = function (connection) {
  if (this.context.clientConnectionStore.get(connection)) {
    this.context.broker.removeClientConnection(connection);
  }
};

module.exports = Router;

'use strict';

const
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

let _proxy;

/**
 * Router constructor
 *
 * @param {KuzzleProxy} proxy
 * @constructor
 */
function Router (proxy) {
  _proxy = proxy;
}

/**
 * Triggered when a plugin gets a new connection
 *
 * @param {ClientConnection} connection
 */
Router.prototype.newConnection = function (connection) {
  // Reject the connection if no backend is available
  if (!_proxy.backendHandler.getBackend()) {
    throw new ServiceUnavailableError('No Kuzzle instance found');
  }

  _proxy.broker.addClientConnection(connection);
};

/**
 * Triggered when a plugin receives a message
 *
 * @param {Request} request
 * @param {Function} callback
 */
Router.prototype.execute = function (request, callback) {
  _proxy.broker.brokerCallback('request', request.id, request.context.connectionId, request.serialize(), (error, result) => {
    if (error) {
      request.setError(error);
      return callback(request.response);
    }

    callback(result);
  });
};

/**
 * Triggered when a plugin connection is closed
 *
 * @param {string} connectionId
 */
Router.prototype.removeConnection = function (connectionId) {
  const connection = _proxy.clientConnectionStore.get(connectionId);

  if (connection) {
    _proxy.broker.removeClientConnection(connection);
  }
};

module.exports = Router;

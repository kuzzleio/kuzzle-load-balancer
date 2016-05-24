var q = require('q');

/**
 * Router contructor
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
 * @param {String} protocol
 * @param {String} socketId
 * @returns {*}
 */
Router.prototype.newConnection = function (protocol, socketId) {
  var connectionAttempt = {
    socketId,
    protocol
  };

  var currentConnection = this.context.clientConnectionStore.get(connectionAttempt);
  if (!currentConnection || connectionAttempt.protocol !== currentConnection.protocol) {
    this.context.broker.addClientConnection(connectionAttempt);
  }

  return q(connectionAttempt);
};

/**
 * Triggered when a plugin receives a message
 *
 * @param {Object} requestObject
 * @param {{socketId: String, protocol: String}} connection
 * @param {Function} callback
 * @returns {Promise.<*>}
 */
Router.prototype.execute = function (requestObject, connection, callback) {
  var deferred = q.defer();

  this.context.broker.brokerCallback(connection, this.context.broker.addEnvelope(requestObject, connection, 'message'), deferred);

  return deferred.promise
    .then(responseObject => callback(null, responseObject))
    .catch(error => callback(error));
};

/**
 * Triggered when a plugin connection is closed
 *
 * @param {{socketId: String, protocol: String}} connection
 */
Router.prototype.removeConnection = function (connection) {
  if (connection.socketId && this.context.clientConnectionStore.get(connection)) {
    this.context.broker.removeClientConnection(connection);
  }
};

module.exports = Router;
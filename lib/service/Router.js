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
    id: socketId,
    type: protocol
  };

  var currentConnection = this.context.clientConnectionStore.get(connectionAttempt);
  if (!currentConnection || connectionAttempt.type !== currentConnection.type) {
    this.context.broker.addClientConnection(connectionAttempt);
  }

  return q(connectionAttempt);
};

/**
 * Triggered when a plugin receives a message
 *
 * @param {Object} requestObject
 * @param {{id: String, type: String}} connection
 * @param {Function} callback
 * @returns {Promise.<*>}
 */
Router.prototype.execute = function (requestObject, connection, callback) {
  var deferred = q.defer();

  this.context.broker.brokerCallback(connection, this.context.broker.addEnvelope(requestObject, connection, 'request'), deferred);

  return deferred.promise
    .then(responseObject => callback(null, responseObject))
    .catch(error => callback(error));
};

/**
 * Triggered when a plugin connection is closed
 *
 * @param {{id: String, type: String}} connection
 */
Router.prototype.removeConnection = function (connection) {
  if (connection.id && this.context.clientConnectionStore.get(connection)) {
    this.context.broker.removeClientConnection(connection);
  }
};

module.exports = Router;
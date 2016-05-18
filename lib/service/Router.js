var q = require('q');

/**
 * Router contructor
 *
 * @param broker
 * @constructor
 */
function Router (broker) {
  this.broker = broker;
}

/**
 * Triggered when a plugin gets a new connection
 *
 * @param {String} protocol
 * @param {String} socketId
 * @returns {*}
 */
Router.prototype.newConnection = (protocol, socketId) => {
  var connectionAttempt = {
    socketId,
    protocol
  };

  var currentConnection = this.clientConnectionStore.get(connectionAttempt);
  if (!currentConnection || connectionAttempt.protocol !== currentConnection.protocol) {
    this.broker.addClientConnection(connectionAttempt);
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
Router.prototype.execute = (requestObject, connection, callback) => {
  var deferred = q.defer();
  requestObject.webSocketId = connection.socketId;
  requestObject.webSocketMessageType = 'message';

  this.broker.brokerCallback(connection, requestObject, deferred);

  return deferred.promise
    .then(responseObject => callback(null, responseObject))
    .catch(error => callback(error));
};

/**
 * Triggered when a plugin connection is closed
 *
 * @param {{socketId: String, protocol: String}} connection
 */
Router.prototype.removeConnection = connection => {
  if (connection.socketId && this.clientConnectionStore.get(connection)) {
    this.broker.removeClientConnection(connection);
  }
};

module.exports = Router;
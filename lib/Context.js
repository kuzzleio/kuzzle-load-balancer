var
  q = require('q'),
  ClientConnectionStore = require('./store/ClientConnection'),
  PluginStore = require('./store/Plugin');

/**
 * Context constructor
 * @constructor
 */
function Context () {
  /**
   * @type {Broker}
   */
  this.broker = null;
  /**
   * @type {ClientConnection}
   */
  this.clientConnectionStore = new ClientConnectionStore();
  /**
   * @type {Plugin}
   */
  this.pluginStore = new PluginStore();
}

/**
 * Mocks a Kuzzle RequestObject used by the plugins
 *
 * @param object
 */
Context.prototype.RequestObject = object => object;

/**
 * Dependency injection of the broker
 *
 * @param {Broker} broker
 */
Context.prototype.setBroker = function (broker) {
  this.broker = broker;
};

/**
 * Return the router used by the plugins
 *
 * @returns {{newConnection: (function()), execute: (function()), removeConnection: (function())}}
 */
Context.prototype.getRouter = function () {
  return {
    /**
     * Triggered when a plugin gets a new connection
     *
     * @param {String} protocol
     * @param {String} socketId
     * @returns {*}
     */
    newConnection: (protocol, socketId) => {
      var connectionAttempt = {
        socketId,
        protocol
      };

      var currentConnection = this.clientConnectionStore.get(connectionAttempt);
      if (!currentConnection || connectionAttempt.protocol !== currentConnection.protocol) {
        this.broker.addClientConnection(connectionAttempt);
      }

      return q(connectionAttempt);
    },

    /**
     * Triggered when a plugin receives a message
     *
     * @param {Object} requestObject
     * @param {{socketId: String, protocol: String}} connection
     * @param {Function} callback
     * @returns {Promise.<*>}
     */
    execute: (requestObject, connection, callback) => {
      var deferred = q.defer();
      requestObject.webSocketId = connection.socketId;
      requestObject.webSocketMessageType = 'message';

      this.broker.brokerCallback(connection, requestObject, deferred);

      return deferred.promise
        .then(responseObject => callback(null, responseObject))
        .catch(error => callback(error));
    },

    /**
     * Triggered when a plugin connection is closed
     * 
     * @param {{socketId: String, protocol: String}} connection
     */
    removeConnection: connection => {
      if (connection.socketId && this.clientConnectionStore.get(connection)) {
        this.broker.removeClientConnection(connection);
      }
    }
  };
};

module.exports = Context;
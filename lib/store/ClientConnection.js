/**
 * ClientConnection constructor
 *
 * @constructor
 */
function ClientConnection () {
  /** @type {RequestContext[]} */
  this.clientConnections = {};
}

/**
 * Adds a connection to the store
 *
 * @param {RequestContext} connection
 */
ClientConnection.prototype.add = function (connection) {
  if (connection.connectionId) {
    this.clientConnections[connection.connectionId] = connection;
  }
};

/**
 * Removes a connection from the store
 *
 * @param {RequestContext} connection
 */
ClientConnection.prototype.remove = function (connection) {
  if (connection.connectionId && this.clientConnections[connection.connectionId]) {
    delete this.clientConnections[connection.connectionId];
  }
};

/**
 * Gets a connection from the store
 *
 * @param {RequestContext} connection
 * @returns {RequestContext}
 */
ClientConnection.prototype.get = function (connection) {
  if (connection.connectionId) {
    return this.clientConnections[connection.connectionId];
  }

  return undefined;
};

/**
 * Gets a connection from the store by connectionId
 *
 * @param {String} id
 * @returns {RequestContext}
 */
ClientConnection.prototype.getByConnectionId = function (id) {
  return this.clientConnections[id];
};

/**
 * Retuns all client connections from the store
 *
 * @returns {RequestContext[]}
 */
ClientConnection.prototype.getAll = function () {
  return this.clientConnections;
};

module.exports = ClientConnection;

/**
 * ClientConnection constructor
 *
 * @constructor
 */
function ClientConnection () {
  /** @type {ClientConnection[]} */
  this.clientConnections = {};
}

/**
 * Adds a connection to the store
 *
 * @param {ClientConnection} connection
 */
ClientConnection.prototype.add = function (connection) {
  this.clientConnections[connection.id] = connection;
};

/**
 * Removes a connection from the store
 *
 * @param {string} connectionId
 */
ClientConnection.prototype.remove = function (connectionId) {
  if (this.clientConnections[connectionId]) {
    delete this.clientConnections[connectionId];
  }
};

/**
 * Gets a connection from the store by connectionId
 *
 * @param {String} id
 * @returns {ClientConnection}
 */
ClientConnection.prototype.get = function (id) {
  return this.clientConnections[id];
};

/**
 * Returns all client connections from the store as an Array
 *
 * @returns {ClientConnection[]}
 */
ClientConnection.prototype.getAll = function () {
  return Object.keys(this.clientConnections)
    .map(id => this.clientConnections[id]);
};

module.exports = ClientConnection;

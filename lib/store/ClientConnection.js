/**
 * ClientConnection constructor
 *
 * @constructor
 */
function ClientConnection () {
  /** @type {{id: String, type: String}[]} */
  this.clientConnections = {};
}

/**
 * Adds a connection to the store
 *
 * @param {{id: String, type: String}} connection
 */
ClientConnection.prototype.add = function (connection) {
  this.clientConnections[connection.id] = connection;
};

/**
 * Removes a connection from the store
 *
 * @param {{id: String, type: String}} connection
 */
ClientConnection.prototype.remove = function (connection) {
  if (this.clientConnections[connection.socketId]) {
    delete this.clientConnections[connection.socketId];
  }
};

/**
 * Gets a connection from the store
 *
 * @param {{id: String, type: String}} connection
 * @returns {{id: String, type: String}}
 */
ClientConnection.prototype.get = function (connection) {
  return this.clientConnections[connection.id];
};

/**
 * Gets a connection from the store by connectionId
 *
 * @param {String} id
 * @returns {{id: String, type: String}}
 */
ClientConnection.prototype.getByConnectionId = function (id) {
  return this.clientConnections[id];
};

/**
 * Retuns all client connections from the store
 *
 * @returns {{id: String, type: String}[]}
 */
ClientConnection.prototype.getAll = function () {
  return this.clientConnections;
};

module.exports = ClientConnection;

/**
 * ClientConnection constructor
 *
 * @constructor
 */
function ClientConnection () {
  /** @type {{socketId: String, protocol: String}[]} */
  this.clientConnections = {};
}

/**
 * Adds a connection to the store
 *
 * @param {{socketId: String, protocol: String}} connection
 */
ClientConnection.prototype.add = function (connection) {
  this.clientConnections[connection.socketId] = connection;
};

/**
 * Removes a connection from the store
 *
 * @param {{socketId: String, protocol: String}} connection
 */
ClientConnection.prototype.remove = function (connection) {
  if (this.clientConnections[connection.socketId]) {
    delete this.clientConnections[connection.socketId];
  }
};

/**
 * Gets a connection from the store
 *
 * @param {{socketId: String, protocol: String}} connection
 * @returns {{socketId: String, protocol: String}}
 */
ClientConnection.prototype.get = function (connection) {
  return this.clientConnections[connection.socketId];
};

/**
 * Gets a connection from the store by socketId
 *
 * @param {String} socketId
 * @returns {{socketId: String, protocol: String}}
 */
ClientConnection.prototype.getBySocketId = function (socketId) {
  return this.clientConnections[socketId];
};

/**
 * Retuns all client connections from the store
 *
 * @returns {{socketId: String, protocol: String}[]}
 */
ClientConnection.prototype.getAll = function () {
  return this.clientConnections;
};

module.exports = ClientConnection;

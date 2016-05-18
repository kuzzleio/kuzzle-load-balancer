/**
 * @type {{socketId: String, protocol: String}[]}
 */
var clientConnections = {};

function ClientConnection () {
}

/**
 * Adds a connection to the store
 *
 * @param {{socketId: String, protocol: String}} connection
 */
ClientConnection.prototype.add = connection => {
  clientConnections[connection.socketId] = connection;
};

/**
 * Removes a connection from the store
 * @param {{socketId: String, protocol: String}} connection
 */
ClientConnection.prototype.remove = connection => {
  if (clientConnections[connection.socketId]) {
    delete clientConnections[connection.socketId];
  }
};

/**
 * Gets a connection from the store
 * @param {{socketId: String, protocol: String}} connection
 * @returns {{socketId: String, protocol: String}}
 */
ClientConnection.prototype.get = connection => {
  return clientConnections[connection.socketId];
};

/**
 * Gets a connection from the store by socketId
 *
 * @param {String} socketId
 * @returns {{socketId: String, protocol: String}}
 */
ClientConnection.prototype.getBySocketId = socketId => {
  return clientConnections[socketId];
};

/**
 * Triggers the callback for each connection in the store
 *
 * @param {Function} callback
 */
ClientConnection.prototype.forEach = (callback) => {
  Object.keys(clientConnections).forEach((socketId) => {
    callback(clientConnections[socketId]);
  });
};

module.exports = ClientConnection;
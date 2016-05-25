var CircularList = require('easy-circular-list');

/**
 * ServerConnection constructor
 *
 * @constructor
 */
function ServerConnection() {
  this.serverConnections = new CircularList();
}

/**
 * Adds a server to the store
 *
 * @param {Server} server
 */
ServerConnection.prototype.add = function (server) {
  this.serverConnections.add(server);
};

/**
 * Removes a server from the store
 *
 * @param {Server} server
 */
ServerConnection.prototype.remove = function (server) {
  this.serverConnections.remove(server);
};

/**
 * Returns a count of all servers in the store
 *
 * @returns {Number}
 */
ServerConnection.prototype.count = function () {
  return this.serverConnections.getSize();
};

/**
 * Allows the selection of a server depending on the serverMode
 *
 * @returns {Server}
 */
ServerConnection.prototype.getOneServer = function (serverMode) {
  switch (serverMode) {
    case 'failover':
      if (this.serverConnections.getCurrent()) {
        return this.serverConnections.getCurrent();
      }
      return this.serverConnections.getNext();
    case 'round-robin':
      return this.serverConnections.getNext();
    default:
      throw new Error(`Unknown server mode ${serverMode}`);
  }
};

/**
 * Get all servers (typically to perform a broadcast)
 *
 * @returns {Server[]}
 */
ServerConnection.prototype.getAllServers = function () {
  return this.serverConnections.getArray();
};

module.exports = ServerConnection;
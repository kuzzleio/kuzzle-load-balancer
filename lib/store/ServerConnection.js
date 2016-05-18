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
ServerConnection.prototype.add = server => {
  this.serverConnections.add(server);
};

/**
 * Removes a server from the store
 *
 * @param {Server} server
 */
ServerConnection.prototype.remove = server => {
  this.serverConnections.remove(server);
};

/**
 * Returns a count of all servers in the store
 *
 * @returns {Number}
 */
ServerConnection.prototype.count = () => {
  return this.serverConnections.getSize();
};

/**
 * Returns an array of all Servers in the store
 *
 * @returns {Server[]}
 */
ServerConnection.prototype.getArray = () => {
  return this.serverConnections.getArray();
};

/**
 * Returns next Server in the store
 *
 * @returns {Server}
 */
ServerConnection.prototype.getNext = () => {
  return this.serverConnections.getNext();
};

/**
 * Returns current Server in the store
 *
 * @returns {Server}
 */
ServerConnection.prototype.getCurrent = () => {
  return this.serverConnections.getCurrent();
};

module.exports = ServerConnection;
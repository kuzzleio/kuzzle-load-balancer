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
  console.log("add", this.serverConnections);
  this.serverConnections.add(server);
};

/**
 * Removes a server from the store
 *
 * @param {Server} server
 */
ServerConnection.prototype.remove = function (server) {
  console.log("remove", this.serverConnections);
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
 * Returns an array of all Servers in the store
 *
 * @returns {Server[]}
 */
ServerConnection.prototype.getArray = function () {
  return this.serverConnections.getArray();
};

/**
 * Returns next Server in the store
 *
 * @returns {Server}
 */
ServerConnection.prototype.getNext = function () {
  console.log("getNext", this.serverConnections.getNext());
  return this.serverConnections.getNext();
};

/**
 * Returns current Server in the store
 *
 * @returns {Server}
 */
ServerConnection.prototype.getCurrent = function () {
  console.log("getCurrent", this.serverConnections.getCurrent());
  return this.serverConnections.getCurrent();
};

module.exports = ServerConnection;
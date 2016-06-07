var CircularList = require('easy-circular-list');

/**
 * BackendConnection constructor
 *
 * @constructor
 */
function BackendConnection() {
  this.backendConnections = new CircularList();
}

/**
 * Adds a backend to the store
 *
 * @param {Backend} backend
 */
BackendConnection.prototype.add = function (backend) {
  this.backendConnections.add(backend);
};

/**
 * Removes a backend from the store
 *
 * @param {Backend} backend
 */
BackendConnection.prototype.remove = function (backend) {
  this.backendConnections.remove(backend);
};

/**
 * Returns a count of all backends in the store
 *
 * @returns {Number}
 */
BackendConnection.prototype.count = function () {
  return this.backendConnections.getSize();
};

/**
 * Allows the selection of a backend depending on the backendMode
 *
 * @returns {Backend}
 */
BackendConnection.prototype.getOneBackend = function (backendMode) {
  switch (backendMode) {
    case 'failover':
      if (this.backendConnections.getCurrent()) {
        return this.backendConnections.getCurrent();
      }
      return this.backendConnections.getNext();
    case 'round-robin':
      return this.backendConnections.getNext();
    default:
      throw new Error(`Unknown backend mode ${backendMode}`);
  }
};

/**
 * Get all backends (typically to perform a broadcast)
 *
 * @returns {Backend[]}
 */
BackendConnection.prototype.getAllBackends = function () {
  return this.backendConnections.getArray();
};

module.exports = BackendConnection;
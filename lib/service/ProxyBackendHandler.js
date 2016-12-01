'use strict';

/**
 * @param {string} backendMode
 * @constructor
 */
function ProxyBackendHandler (backendMode) {
  if (backendMode !== 'standard') {
    throw new Error(`Backend mode option must be set to "standard"; "${backendMode}" given`);
  }

  /** @type {String} */
  this.backendMode = backendMode;

  /** @type {Backend} */
  this.currentBackend = null;
}

/**
 * Handles a new backend connection
 *
 * @param {Backend} newBackend
 */
ProxyBackendHandler.prototype.addBackend = function (newBackend) {
  if (this.currentBackend) {
    this.currentBackend.onConnectionClose();
  }

  this.currentBackend = newBackend;
};

/**
 * Handles a backend closing connection
 *
 * @param {Backend} backend
 */
ProxyBackendHandler.prototype.removeBackend = function (backend) {
  if (this.currentBackend && this.currentBackend === backend) {
    this.currentBackend = null;
  }
};

/**
 * Returns the backend
 *
 * @returns {Backend|null}
 */
ProxyBackendHandler.prototype.getBackend = function () {
  return this.currentBackend;
};

/**
 * Returns all backends
 *
 * @returns {Backend[]|[]}
 */
ProxyBackendHandler.prototype.getAllBackends = function () {
  if (this.currentBackend) {
    return [this.currentBackend];
  }

  return [];
};


module.exports = ProxyBackendHandler;
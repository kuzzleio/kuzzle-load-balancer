var
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * PendingRequest constructor
 * @param {Number} serverTimeout
 * @constructor
 */
function PendingRequest (serverTimeout) {
  /** @type {{connection: Object, request: Object, promise: *, timeout: *}[]} pending */
  this.pending = {};
  this.serverTimeout = serverTimeout;
}

/**
 * Adds a pending request
 *
 * @param {{connection: Object, request: Object, promise: *, timeout: *}} pendingItem
 */
PendingRequest.prototype.add = function (pendingItem) {
  if (pendingItem.request && pendingItem.request.requestId) {
    pendingItem.timeout = setTimeout(() => {
      pendingItem.promise.reject(new InternalError('Kuzzle was too long to respond'));
    }, this.serverTimeout);

    this.pending[pendingItem.message.data.request.requestId] = pendingItem;
  }
};

/**
 * Returns the pending request by requestId
 *
 * @param {String} requestId
 * @returns {{connection: Object, request: Object, promise: *}}
 */
PendingRequest.prototype.getByRequestId = function (requestId) {
  return this.pending[requestId];
};

/**
 * Returns true if the pending item exists by requestId
 *
 * @param {String} requestId
 * @returns {Boolean}
 */
PendingRequest.prototype.existsByRequestId = function (requestId) {
  return Boolean(this.pending[requestId]);
};

/**
 * Removes a pending request by requestId
 *
 * @param {String} requestId
 */
PendingRequest.prototype.removeByRequestId = function (requestId) {
  if (this.pending[requestId]) {
    clearTimeout(this.pending[requestId].timeout);
    delete this.pending[requestId];
  }
};

/**
 * Removes a pending request by value
 *
 * @param {{connection: Object, request: Object, promise: *}} pendingItem
 */
PendingRequest.prototype.remove = function (pendingItem) {
  if (this.pending[pendingItem.message.data.request.requestId]) {
    clearTimeout(this.pending[pendingItem.message.data.request.requestId].timeout);
    delete this.pending[pendingItem.message.data.request.requestId];
  }
};

/**
 * Clear the list of all pending request
 */
PendingRequest.prototype.clear = function () {
  Object.keys(this.pending).forEach((pendingItem) => {
    clearTimeout(this.pending[pendingItem.message.data.request.requestId].timeout);
  });

  this.pending = {};
};

/**
 * Get all pending requests
 *
 * @returns {{connection: Object, request: Object, promise: *}[]}
 */
PendingRequest.prototype.getAll = function () {
  return this.pending;
};

module.exports = PendingRequest;
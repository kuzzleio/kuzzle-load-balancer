var
  configuration = require('rc')('lb'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * PendingRequest constructor
 * @constructor
 */
function PendingRequest () {
  /** @type {{connection: Object, request: Object, promise: *}[]} pending */
  this.pending = {};
}

/**
 * Adds a pending request
 *
 * @param {{connection: Object, request: Object, promise: *}} pendingItem
 */
PendingRequest.prototype.add = function (pendingItem) {
  pendingItem.timeout = setTimeout(() => {
    pendingItem.promise.reject(new InternalError(`Kuzzle was too long to respond`))
  }, configuration.serverTimeout);

  this.pending[pendingItem.request.requestId] = pendingItem;
};

/**
 * Returns the pending request by requestId
 *
 * @param {String} requestId
 */
PendingRequest.prototype.getByRequestId = function (requestId) {
  return this.pending[requestId];
};

/**
 * Returns true if the pending item exists by requestId
 *
 * @param {String} requestId
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
  if (this.pending[pendingItem.request.requestId]) {
    clearTimeout(this.pending[pendingItem.request.requestId].timeout);
    delete this.pending[pendingItem.request.requestId];
  }
};

/**
 * Clear the list of all pending request
 */
PendingRequest.prototype.clear = function () {
  Object.keys(this.pending).forEach((pendingItem) => {
    clearTimeout(this.pending[pendingItem.request.requestId].timeout);
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
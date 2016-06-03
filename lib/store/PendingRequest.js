var
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * PendingRequest constructor
 * @param {Number} backendTimeout
 * @constructor
 */
function PendingRequest (backendTimeout) {
  this.pending = {};
  this.backendTimeout = backendTimeout || 10000;
}

/**
 * Adds a pending request
 *
 * @param {{message: Object, promise: *}} pendingItem
 */
PendingRequest.prototype.add = function (pendingItem) {
  if (!pendingItemIsCorrect(pendingItem)) {
    return false;
  }

  pendingItem.timeout = setTimeout(() => {
    pendingItem.promise.reject(new InternalError('Kuzzle was too long to respond'));
  }, this.backendTimeout);

  this.pending[pendingItem.message.data.request.requestId] = pendingItem;
};

/**
 * Returns the pending request by requestId
 *
 * @param {String} requestId
 * @returns {{message: Object, promise: *}}
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
 * @param {{message: Object, promise: *}} pendingItem
 */
PendingRequest.prototype.remove = function (pendingItem) {
  if (!pendingItemIsCorrect(pendingItem) || !this.pending[pendingItem.message.data.request.requestId]) {
    return false;
  }

  clearTimeout(this.pending[pendingItem.message.data.request.requestId].timeout);
  delete this.pending[pendingItem.message.data.request.requestId];
};

/**
 * Clear the list of all pending request
 */
PendingRequest.prototype.clear = function () {
  Object.keys(this.pending).forEach((requestId) => {
    clearTimeout(this.pending[requestId].timeout);
  });

  this.pending = {};
};

/**
 * Get all pending requests
 *
 * @returns {{message: Object, promise: *}[]}
 */
PendingRequest.prototype.getAll = function () {
  return this.pending;
};

function pendingItemIsCorrect (pendingItem) {
  return (
      pendingItem &&
      pendingItem.message &&
      pendingItem.message.data &&
      pendingItem.message.data.request &&
      pendingItem.message.data.request.requestId
  );
}


module.exports = PendingRequest;
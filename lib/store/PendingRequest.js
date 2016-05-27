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
  this.pending[pendingItem.message.data.request.requestId] = pendingItem;
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
    delete this.pending[pendingItem.message.data.request.requestId];
  }
};

/**
 * Clear the list of all pending request
 */
PendingRequest.prototype.clear = function () {
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
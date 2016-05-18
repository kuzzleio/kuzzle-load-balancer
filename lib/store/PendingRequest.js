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
PendingRequest.prototype.add = pendingItem => {
  this.pending[pendingItem.request.requestId] = pendingItem;
};

/**
 * Returns the pending request by requestId
 *
 * @param {String} requestId
 */
PendingRequest.prototype.getByRequestId = requestId => {
  return this.pending[requestId];
};

/**
 * Returns true if the pending item exists by requestId
 *
 * @param {String} requestId
 */
PendingRequest.prototype.existsByRequestId = requestId => {
  return Boolean(this.pending[requestId]);
};

/**
 * Removes a pending request by requestId
 *
 * @param {String} requestId
 */
PendingRequest.prototype.removeByRequestId = requestId => {
  if (this.pending[requestId]) {
    delete this.pending[requestId];
  }
};

/**
 * Removes a pending request by value
 *
 * @param {{connection: Object, request: Object, promise: *}} pendingItem
 */
PendingRequest.prototype.remove = pendingItem => {
  if (this.pending[pendingItem.request.requestId]) {
    delete this.pending[pendingItem.request.requestId];
  }
};

/**
 * Clear the list of all pending request
 */
PendingRequest.prototype.clear = () => {
  this.pending = {};
};

/**
 * Get all pending requests
 *
 * @returns {{connection: Object, request: Object, promise: *}[]}
 */
PendingRequest.prototype.getAll = () => {
  return this.pending;
};

module.exports = PendingRequest;
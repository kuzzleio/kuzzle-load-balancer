'use strict';

const
  PendingItem = require('./PendingItem'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

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
 * @param {string} id - request unique identifier
 * @param {Object} data - request data to deliver to Kuzzle
 * @param {Function} callback - Client's callback to resolve
 */
PendingRequest.prototype.add = function (id, data, callback) {
  let timeout = setTimeout(() => {
    callback(new InternalError(`Kuzzle was too long to respond. Discarded request:\n${data}`));
    delete this.pending[id];
  }, this.backendTimeout);

  this.pending[id] = new PendingItem(timeout, callback);
};

/**
 * Resolves a pending item and removes it from the store
 *
 * @param {string} requestId - pending item identifier
 * @param {object} error value
 * @param {object} result value
 */
PendingRequest.prototype.resolve = function (requestId, error, result) {
  let item = this.pending[requestId];

  if (item) {
    clearTimeout(item.timeout);
    item.callback(error, result);
    delete this.pending[requestId];
  }
};

/**
 * Aborts all pending items with an error message
 */
PendingRequest.prototype.abortAll = function (error) {
  Object.keys(this.pending).forEach((requestId) => {
    clearTimeout(this.pending[requestId].timeout);
    this.pending[requestId].callback(error);
  });

  this.pending = {};
};

module.exports = PendingRequest;

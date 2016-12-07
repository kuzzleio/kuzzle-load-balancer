'use strict';

/**
 * @param timeout
 * @param callback
 * @returns {PendingItem}
 * @constructor
 */
function PendingItem (timeout, callback) {
  this.timeout = timeout;
  this.callback = callback;
  return this;
}

/**
 * @type {PendingItem}
 */
module.exports = PendingItem;

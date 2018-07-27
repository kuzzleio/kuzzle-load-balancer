/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  PendingItem = require('./PendingItem'),
  GatewayTimeoutError = require('kuzzle-common-objects').errors.GatewayTimeoutError;

/**
 * PendingRequest constructor
 * @class PendingRequest
 * @param {Number} backendTimeout
 */
class PendingRequest {
  constructor(backendTimeout) {
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
  add(id, data, callback) {
    const timeout = setTimeout(() => {
      callback(new GatewayTimeoutError(`Kuzzle was too long to respond. Discarded request:\n${data}`));
      delete this.pending[id];
    }, this.backendTimeout);

    this.pending[id] = new PendingItem(timeout, callback);
  }

  /**
   * Resolves a pending item and removes it from the store
   *
   * @param {string} requestId - pending item identifier
   * @param {object} error value
   * @param {object} result value
   */
  resolve(requestId, error, result) {
    const item = this.pending[requestId];

    if (item) {
      clearTimeout(item.timeout);
      item.callback(error, result);
      delete this.pending[requestId];
    }
  }

  /**
   * Aborts all pending items with an error message
   */
  abortAll(error) {
    Object.keys(this.pending).forEach(requestId => {
      clearTimeout(this.pending[requestId].timeout);
      this.pending[requestId].callback(error);
    });

    this.pending = {};
  }
}

module.exports = PendingRequest;

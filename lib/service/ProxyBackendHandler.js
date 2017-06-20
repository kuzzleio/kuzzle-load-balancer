/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  debug = require('../kuzzleDebug')('kuzzle-proxy:backend:handler'),
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError;


/**
 * @class ProxyBackendHandler
 * @param {string} backendMode
 */
class ProxyBackendHandler {
  constructor(backendMode) {
    if (backendMode !== 'standard') {
      throw new Error(`Backend mode option must be set to "standard"; "${backendMode}" given`);
    }

    /** @type {String} */
    this.backendMode = backendMode;

    /** @type {Backend} */
    this.currentBackend = null;
    this.pendingBackend = null;
  }

  /**
   * Handles a new backend connection
   *
   * @param {Backend} newBackend
   */
  addBackend(newBackend) {
    debug('[%s] new pending backend connection', newBackend.socketIp);

    this.pendingBackend = newBackend;
  }

  activateBackend(backend = this.pendingBackend) {
    debug('[%s] activate backend connection', backend.socketIp);

    if (this.currentBackend) {
      throw new KuzzleInternalError(`Failed to activate connection with backend ${backend.socketIp}: a backend is already active.`);
    }

    this.currentBackend = backend;
  }

  /**
   * Handles a backend closing connection
   *
   * @param {Backend} backend
   */
  removeBackend(backend) {
    debug('[%s] remove backend connection', backend.socketIp);

    if (this.currentBackend && this.currentBackend === backend) {
      this.currentBackend = null;
    }
  }

  /**
   * Returns the backend
   *
   * @returns {Backend|null}
   */
  getBackend() {
    return this.currentBackend;
  }

  /**
   * Returns all backends
   *
   * @returns {Backend[]|[]}
   */
  getAllBackends() {
    if (this.currentBackend) {
      return [this.currentBackend];
    }

    return [];
  }

  removeClient() {
    // used by cluster mode only - do nothing here
  }
}

module.exports = ProxyBackendHandler;

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
    this.pendingBackend = newBackend;
  }

  activateBackend(backend = this.pendingBackend) {
    if (this.currentBackend) {
      this.currentBackend.onConnectionClose();
    }

    this.currentBackend = backend;
  }

  /**
   * Handles a backend closing connection
   *
   * @param {Backend} backend
   */
  removeBackend(backend) {
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
}

module.exports = ProxyBackendHandler;

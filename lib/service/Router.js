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
  Request = require('kuzzle-common-objects').Request,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

/**
 * Router constructor
 *
 * @class Router
 * @param {KuzzleProxy} proxy
 */
class Router {
  constructor(proxy) {
    this.proxy = proxy;
  }

  /**
   * Triggered when a protocol gets a new connection
   *
   * @param {ClientConnection} connection
   */
  newConnection(connection) {
    // Reject the connection if no backend is available
    const backend = this.proxy.backendHandler.getBackend(connection.id);
    if (!backend || !backend.active) {
      throw new ServiceUnavailableError('No Kuzzle instance found');
    }

    this.proxy.broker.addClientConnection(connection);
  }

  /**
   * Triggered when a protocol receives a message
   *
   * @param {Object} data with following format: {payload, connectionId, protocol, headers}
   * @param {Function} callback
   */
  execute(data, callback) {
    const request = new Request(data.payload, {
      connectionId: data.connectionId,
      protocol: data.protocol
    });
    request.input.headers = data.headers;

    this.proxy.broker.brokerCallback('request', request.id, request.context.connectionId, request.serialize(), (error, result) => {
      if (error) {
        request.setError(error);
        if (typeof request.response.toJSON === 'function') {
          return callback(request.response.toJSON());
        }
        return callback(request.response);
      }

      callback(result);
    });
  }

  /**
   * Triggered when a protocol connection is closed
   *
   * @param {string} connectionId
   */
  removeConnection(connectionId) {
    const connection = this.proxy.clientConnectionStore.get(connectionId);

    if (connection) {
      this.proxy.broker.removeClientConnection(connection);
    }
  }
}

module.exports = Router;

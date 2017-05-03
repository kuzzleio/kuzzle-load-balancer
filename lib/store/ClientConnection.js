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


/**
 * ClientConnection constructor
 *
 * @class ClientConnection
 */
class ClientConnection {
  constructor() {
    /** @type {ClientConnection[]} */
    this.clientConnections = {};
  }

  /**
   * Adds a connection to the store
   *
   * @param {ClientConnection} connection
   */
  add(connection) {
    this.clientConnections[connection.id] = connection;
  }

  /**
   * Removes a connection from the store
   *
   * @param {string} connectionId
   */
  remove(connectionId) {
    if (this.clientConnections[connectionId]) {
      delete this.clientConnections[connectionId];
    }
  }

  /**
   * Gets a connection from the store by connectionId
   *
   * @param {String} id
   * @returns {ClientConnection}
   */
  get(id) {
    return this.clientConnections[id];
  }

  /**
   * Returns all client connections from the store as an Array
   *
   * @returns {ClientConnection[]}
   */
  getAll() {
    return Object.keys(this.clientConnections)
      .map(id => this.clientConnections[id]);
  }
}

module.exports = ClientConnection;

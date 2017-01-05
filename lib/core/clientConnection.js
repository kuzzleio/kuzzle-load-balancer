'use strict';

const
  uuid = require('uuid');

class ClientConnection {

  /**
   * @constructor
   * @param {string} protocol - The protocol used (http, websocket, socketio, mqtt etc)
   * @param {Array.<string>} ips - The list of forwarded ips (= X-Forwarded-For http header + the final ip, i.e. client, proxy1, proxy2, etc.)
   * @param {object} [headers] - Optional extra key-value object. I.e., for http, will receive the request headers
   */
  constructor (protocol, ips, headers) {
    this.id = uuid.v4();
    this.protocol = protocol;
    this.headers = {};

    if (!Array.isArray(ips)) {
      throw new TypeError('Expected ips to be an Array, got ' + typeof ips);
    }
    this.ips = ips;

    if (headers && typeof headers === 'object') {
      this.headers = headers;
    }
  }

}

module.exports = ClientConnection;

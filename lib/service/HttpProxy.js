'use strict';

let
  http = require('http'),
  bytes = require('bytes'),
  uuid = require('uuid'),
  url = require('url'),
  ClientConnection = require('../core/clientConnection'),
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  KuzzleRoom = 'httpRequest';

let _proxy = {};

/**
 * @returns {HttpProxy}
 * @constructor
 */
function HttpProxy () {
  this.maxRequestSize = null;
  this.server = null;
  return this;
}

/**
 * Initializes the HTTP server
 *
 * @param {KuzzleProxy} proxy
 */
HttpProxy.prototype.init = function (proxy) {
  this.maxRequestSize = bytes.parse(proxy.config.http.maxRequestSize);

  _proxy = proxy;

  if (this.maxRequestSize === null || isNaN(this.maxRequestSize)) {
    throw new Error('Invalid HTTP "maxRequestSize" parameter');
  }

  if (!proxy.config.http.port) {
    throw new Error('No HTTP port configured.');
  }

  this.server = http.createServer((request, response) => {
    let
      payload = {
        requestId: uuid.v4(),
        url: request.url,
        method: request.method,
        headers: request.headers,
        content: ''
      };

    let ips = [request.socket.remoteAddress];
    if (request.headers['x-forwarded-for']) {
      ips = request.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection('HTTP/' + request.httpVersion, ips, request.headers);
    _proxy.clientConnectionStore.add(connection);

    if (request.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      return replyWithError(connection.id, payload, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
    }

    request.on('data', chunk => {
      payload.content += chunk.toString();

      /*
       * The content-length header can be bypassed and
       * is not reliable enough. We have to enforce the HTTP
       * max size limit while reading the stream too
       */
      if (payload.content.length > this.maxRequestSize) {
        request
          .removeAllListeners('data')
          .removeAllListeners('end')
          .resume();
        return replyWithError(connection.id, payload, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }
    });

    request.on('end', () => {
      sendRequest(connection.id, response, payload);
    });
  });

  this.server.listen(proxy.config.http.port, proxy.config.http.host);
};

/**
 * Sends a request to Kuzzle and forwards the response back to the client
 *
 * @param {connectionId} connectionId - connection Id
 * @param {ServerResponse} response
 * @param {Object} payload
 */
function sendRequest (connectionId, response, payload) {
  _proxy.broker.brokerCallback(KuzzleRoom, payload.requestId, connectionId, payload, (error, result) => {
    if (result) {
      _proxy.clientConnectionStore.remove(connectionId);

      let indent = 0;
      const parsedUrl = url.parse(payload.url, true);

      if (parsedUrl.query && parsedUrl.query.pretty !== undefined) {
        indent = 2;
      }

      if (result.headers) {
        Object.keys(result.headers)
          .forEach(header => {
            response.setHeader(header, result.headers[header]);
          });
      }

      response.writeHead(result.status);

      if (result.raw) {
        // binary data are sent as-is
        if (result.content instanceof Buffer) {
          return response.end(result.content);
        }

        // all JS objects are serialized, including arrays
        if (typeof result.content === 'object') {
          return response.end(JSON.stringify(result.content));
        }

        // scalars are sent as-is
        return response.end(result.content);
      }

      response.end(JSON.stringify(result.content, undefined, indent));
    }
    else {
      replyWithError(connectionId, payload, response, error);
    }
  });
}

/**
 * Forward an error response to the client
 *
 * @param {string} connectionId
 * @param {Object} payload
 * @param {Object} response
 * @param {Object} error
 */
function replyWithError(connectionId, payload, response, error) {
  const result = {
    raw: true,
    content: JSON.stringify(error)
  };

  _proxy.logAccess(connectionId, payload, error, result);

  response.writeHead(error.status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
  });

  response.end(result.content);
}

module.exports = HttpProxy;

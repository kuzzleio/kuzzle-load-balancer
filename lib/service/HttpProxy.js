'use strict';

const
  http = require('http'),
  bytes = require('bytes'),
  uuid = require('uuid'),
  url = require('url'),
  ClientConnection = require('../core/clientConnection'),
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  KuzzleRoom = 'httpRequest';

const _proxy = {};

/**
 * @returns {HttpProxy}
 * @constructor
 */
function HttpProxy () {
  this.maxRequestSize = null;
  this.accessControlAllowOrigin = null;
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
  this.accessControlAllowOrigin = proxy.config.http.accessControlAllowOrigin;

  Object.assign(_proxy, proxy);

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

    const connection = new ClientConnection('http', ips, request.headers);
    _proxy.clientConnectionStore.add(connection);

    if (request.method.toUpperCase() === 'OPTIONS') {
      response.writeHead(200, {
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': this.accessControlAllowOrigin,
        'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
      });

      response.end();

      return;
    }

    if (request.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      return replyWithError(this.accessControlAllowOrigin, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
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
        return replyWithError(this.accessControlAllowOrigin, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }
    });

    request.on('end', () => {
      sendRequest(this.accessControlAllowOrigin, connection.id, response, payload);
    });
  });

  this.server.listen(proxy.config.http.port, proxy.config.http.host);
};

/**
 * Sends a request to Kuzzle and forwards the response back to the client
 *
 * @param {string} allowOrigin - CORS header value
 * @param {connectionId} connectionId - connection Id
 * @param {ServerResponse} response
 * @param {Object} payload
 */
function sendRequest (allowOrigin, connectionId, response, payload) {
  _proxy.broker.brokerCallback(KuzzleRoom, payload.requestId, connectionId, payload, (error, result) => {
    if (result) {
      _proxy.clientConnectionStore.remove(connectionId);

      let indent = 0;
      const parsedUrl = url.parse(payload.url, true);

      if (parsedUrl.query && parsedUrl.query.pretty !== undefined) {
        indent = 2;
      }

      response.setHeader('Content-Type', result.type);
      response.setHeader('Access-Control-Allow-Origin', allowOrigin);
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

      if (result.response.headers) {
        Object.keys(result.response.headers)
          .forEach(header => {
            response.setHeader(header, result.response.headers[header]);
          });

        delete result.response.headers;
      }

      response.writeHead(result.status);
      if (typeof result.response === 'string' || result.response instanceof Buffer) {
        response.end(result.response);
      }
      else {
        response.end(JSON.stringify(result.response, undefined, indent));
      }
    }
    else {
      replyWithError(allowOrigin, response, error);
    }
  });
}

/**
 * Forward an error response to the client
 *
 * @param {string} allowOrigin - CORS header value
 * @param {Object} response
 * @param {Object} error
 */
function replyWithError(allowOrigin, response, error) {
  response.writeHead(error.status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
  });

  response.end(JSON.stringify(error));
}

module.exports = HttpProxy;

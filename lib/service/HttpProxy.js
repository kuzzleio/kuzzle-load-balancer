'use strict';

const
  http = require('http'),
  bytes = require('bytes'),
  uuid = require('uuid'),
  url = require('url'),
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  KuzzleRoom = 'httpRequest';

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
 * @param context
 * @param config
 */
HttpProxy.prototype.init = function (context, config) {
  this.maxRequestSize = bytes.parse(config.http.maxRequestSize);
  this.accessControlAllowOrigin = config.http.accessControlAllowOrigin;

  if (this.maxRequestSize === null || isNaN(this.maxRequestSize)) {
    throw new Error('Invalid HTTP "maxRequestSize" parameter');
  }

  if (!config.http.port) {
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
      sendRequest(context, this.accessControlAllowOrigin, response, payload);
    });
  });

  this.server.listen(config.http.port, config.http.host);
};

/**
 * Sends a request to Kuzzle and forwards the response back to the client
 *
 * @param {Context} context
 * @param {string} allowOrigin - CORS header value
 * @param {http.ServerResponse} response
 * @param {Object} payload
 */
function sendRequest (context, allowOrigin, response, payload) {
  context.broker.brokerCallback(KuzzleRoom, payload.requestId, payload, (error, result) => {
    if (result) {
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

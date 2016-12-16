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

    if (request.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      return replyWithError(response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
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
        return replyWithError(response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }
    });

    request.on('end', () => {
      sendRequest(context, response, payload);
    });
  });

  this.server.listen(config.http.port, config.http.host);
};

/**
 * Sends a request to Kuzzle and forwards the response back to the client
 *
 * @param {Context} context
 * @param {http.ServerResponse} response
 * @param {Object} payload
 */
function sendRequest (context, response, payload) {
  context.broker.brokerCallback(KuzzleRoom, payload.requestId, payload, (error, result) => {
    if (result) {
      let indent = 0;
      const parsedUrl = url.parse(payload.url, true);

      if (parsedUrl.query && parsedUrl.query.pretty !== undefined) {
        indent = 2;
      }

      if (result.response.headers) {
        Object.keys(result.response.headers)
          .forEach(header => {
            response.setHeader(header, result.response.headers[header]);
          });

        delete result.response.headers;
      }
      else {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
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
      replyWithError(response, error);
    }
  });
}

/**
 * Forward an error response to the client
 *
 * @param {Object} response
 * @param {Object} error
 */
function replyWithError(response, error) {
  response.writeHead(error.status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
  });

  response.end(JSON.stringify(error));
}

module.exports = HttpProxy;

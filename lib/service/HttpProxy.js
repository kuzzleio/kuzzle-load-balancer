'use strict';

var
  http = require('http'),
  bytes = require('bytes'),
  uuid = require('uuid'),
  SizeLimitError = require('kuzzle-common-objects').Errors.sizeLimitError;

function HttpProxy () {
  this.maxRequestSize = null;
  this.accessControlAllowOrigin = null;
  this.server = null;
  return this;
}

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
      message = {
        data: {
          request: {
            requestId: uuid.v4(),
            url: request.url,
            method: request.method,
            headers: request.headers,
            content: ''
          }
        },
        room: 'httpRequest'
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
      message.data.request.content += chunk.toString();

      /*
       * The content-length header can be bypassed and
       * is not reliable enough. We have to enforce the HTTP
       * max size limit while reading the stream too
       */
      if (message.data.request.content.length > this.maxRequestSize) {
        request
          .removeAllListeners('data')
          .removeAllListeners('end')
          .resume();
        return replyWithError(this.accessControlAllowOrigin, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }
    });

    request.on('end', () => {
      sendRequest(context, this.accessControlAllowOrigin, response, message);
    });
  });

  this.server.listen(config.http.port, config.http.host);
};

/**
 * Sends a request to Kuzzle and forwards the response back to the client
 *
 * @param {Context} context
 * @param {string} allowOrigin - CORS header value
 * @param {Object} response
 * @param {Object} message
 */
function sendRequest (context, allowOrigin, response, message) {
  context.broker.brokerCallback(message, (error, result) => {
    if (result) {
      response.writeHead(result.status, {
        'Content-Type': result.type,
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
      });

      response.end(result.response);
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

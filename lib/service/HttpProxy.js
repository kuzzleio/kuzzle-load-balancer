'use strict';

const
  http = require('http'),
  bytes = require('bytes'),
  uuid = require('uuid'),
  url = require('url'),
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  Writable = require('stream').Writable,
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
      stream = new Writable({
        write(chunk, encoding, callback) {
          payload.content += chunk.toString();
          callback();
        }
      }),
      stream_length = 0,
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
      stream_length += chunk.length;

      /*
       * The content-length header can be bypassed and
       * is not reliable enough. We have to enforce the HTTP
       * max size limit while reading the stream too
       */
      if (stream_length > this.maxRequestSize) {
        request
          .removeAllListeners('data')
          .removeAllListeners('end')
          .resume();
        return replyWithError(response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }
      stream.write(chunk);
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
      }

      response.writeHead(result.status);

      if (result.response.raw || result.response instanceof Buffer) {
        if (typeof result.response.content === 'object') {
          response.end(JSON.stringify(result.response.content));
        }
        else {
          response.end(Buffer.from(result.response.content));
        }
      }
      else {
        response.end(JSON.stringify(result.response.content, undefined, indent));
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

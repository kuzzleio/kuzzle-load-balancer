'use strict';

let
  http = require('http'),
  bytes = require('bytes'),
  uuid = require('uuid'),
  url = require('url'),
  ClientConnection = require('../core/clientConnection'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  Writable = require('stream').Writable,
  HttpFormDataStream = require('./HttpFormDataStream'),
  KuzzleRoom = 'httpRequest';

let _proxy = {};

/**
 * @returns {HttpProxy}
 * @constructor
 */
function HttpProxy () {
  this.maxRequestSize = null;
  this.maxFileSize = null;
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
  this.maxFileSize = bytes.parse(proxy.config.http.maxFileSize);

  _proxy = proxy;

  if (this.maxRequestSize === null || isNaN(this.maxRequestSize)) {
    throw new Error('Invalid HTTP "maxRequestSize" parameter');
  }

  if (this.maxFileSize === null || isNaN(this.maxFileSize)) {
    throw new Error('Invalid HTTP "maxFileSize" parameter');
  }

  if (!proxy.config.http.port) {
    throw new Error('No HTTP port configured.');
  }

  if (proxy.config.http.enabled) {
    this.server = http.createServer((request, response) => {
      let
        stream,
        streamLength = 0,
        payload = {
          requestId: uuid.v4(),
          url: request.url,
          method: request.method,
          headers: request.headers,
          content: ''
        },
        ips = [request.socket.remoteAddress];

      if (request.headers['x-forwarded-for']) {
        ips = request.headers['x-forwarded-for']
          .split(',')
          .map(s => s.trim())
          .concat(ips);
      }

      const connection = new ClientConnection('HTTP/' + request.httpVersion, ips, request.headers);
      _proxy.clientConnectionStore.add(connection);

      if (request.headers['content-length'] > this.maxRequestSize) {
        request
          .removeAllListeners()
          .resume();
        return replyWithError(connection.id, payload, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }

      if (!request.headers['content-type'] || request.headers['content-type'].startsWith('application/json')) {
        stream = new Writable({
          write(chunk, encoding, callback) {
            payload.content += chunk.toString();
            callback();
          }
        });

        stream.on('error', err => {
          stream.end();
          request
            .removeAllListeners('data')
            .removeAllListeners('end')
            .resume();
          return replyWithError(connection.id, payload, response, err);
        });
      } else {
        try {
          stream = new HttpFormDataStream({headers: request.headers, limits: {fileSize: this.maxFileSize}}, payload);
        } catch (error) {
          request.resume();
          return replyWithError(connection.id, payload, response, new BadRequestError(error.message));
        }

        stream.on('error', err => {
          /*
          * Force Dicer parser to finish prematurely
          * without throwing an 'Unexpected end of multipart data' error :
          */
          stream._parser.parser._finished = true;
          stream.end();

          request
            .removeAllListeners('data')
            .removeAllListeners('end')
            .resume();
          return replyWithError(connection.id, payload, response, err);
        });
      }

      request.on('data', chunk => {
        streamLength += chunk.length;

        /*
         * The content-length header can be bypassed and
         * is not reliable enough. We have to enforce the HTTP
         * max size limit while reading the stream too
         */
        if (streamLength > this.maxRequestSize) {
          return stream.emit('error', new SizeLimitError('Error: maximum HTTP request size exceeded'));
        }
        stream.write(chunk);
      });

      request.on('end', () => {
        stream.end(() => {
          payload.headers['content-type'] = 'application/json';
          sendRequest(connection.id, response, payload);
        });
      });
    });
  } else {
    this.server = http.createServer();
  }

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
  if (payload.json) {
    payload.content = JSON.stringify(payload.json);
    delete payload.json;
  }

  _proxy.broker.brokerCallback(KuzzleRoom, payload.requestId, connectionId, payload, (error, result) => {
    if (result) {
      _proxy.clientConnectionStore.remove(connectionId);

      if (result.headers) {
        Object.keys(result.headers)
          .forEach(header => {
            response.setHeader(header, result.headers[header]);
          });
      }

      response.writeHead(result.status);
      response.end(contentToPayload(result, payload.url));
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

/**
 * Converts a Kuzzle query result into an appropriate payload format
 * to send back to the client
 *
 * @param {Object} result
 * @param {String} invokedUrl - invoked URL. Used to check if the ?pretty
 *                              argument was passed by the client, changing
 *                              the payload format
 * @return {String|Buffer}
 */
function contentToPayload(result, invokedUrl) {
  let data;

  if (result.raw) {
    if (typeof result.content === 'object') {
      /*
       This object can be either a Buffer object, a stringified Buffer object,
       or anything else.
       In the former two cases, we create a new Buffer object, and in the latter,
       we stringify the content.
       */
      if (result.content instanceof Buffer || (result.content.type === 'Buffer' && Array.isArray(result.content.data))) {
        data = Buffer.from(result.content);
      }
      else {
        data = JSON.stringify(result.content);
      }
    }
    else {
      // scalars are sent as-is
      data = result.content;
    }
  }
  else {
    let indent = 0;
    const parsedUrl = url.parse(invokedUrl, true);

    if (parsedUrl.query && parsedUrl.query.pretty !== undefined) {
      indent = 2;
    }

    data = JSON.stringify(result.content, undefined, indent);
  }

  return data;
}

module.exports = HttpProxy;

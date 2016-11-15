'use strict';

var
  http = require('http'),
  bytes = require('bytes'),
  SizeLimitError = require('kuzzle-common-objects').Errors.sizeLimitError;

function HttpProxy () {
  this.maxRequestSize = null;
  return this;
}

HttpProxy.prototype.init = function (context, config) {
  this.maxRequestSize = bytes.parse(config.http.maxRequestSize);

  if (isNaN(this.maxRequestSize)) {
    throw new Error('Invalid HTTP "maxRequestSize" parameter');
  }

  let server = http.createServer((request, response) => {
    let
      rqo = new context.constructors.RequestObject({
        body: {
          url: request.url,
          method: request.method,
          headers: request.headers,
          content: ''
        }
      }),
      message = {
        data: {
          request: rqo
        },
        room: 'httpRequest'
      };

    if (request.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      return replyWithError(response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
    }

    request.on('data', chunk => {
      rqo.data.body.content += chunk.toString();

      /*
       * The content-length header can be bypassed and
       * is not reliable enough. We have to enforce the HTTP
       * max size limit while reading the stream too
       */
      if (rqo.data.body.content.length > this.maxRequestSize) {
        request
          .removeAllListeners('data')
          .removeAllListeners('end')
          .resume();
        return replyWithError(response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }
    });

    request.on('end', () => {
      sendRequest(context, response, message);
    });
  });

  server.listen(config.http.port);
};

function sendRequest (context, response, message) {
  context.broker.brokerCallback(message, (error, result) => {
    if (result) {
      response.writeHead(result.status, {
        'Content-Type': result.type,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
      });

      response.end(result.response);
    }
    else {
      replyWithError(response, error);
    }
  });
}

function replyWithError(response, error) {
  response.writeHead(error.status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-Requested-With'
  });

  response.end(JSON.stringify(error));
}

module.exports = HttpProxy;

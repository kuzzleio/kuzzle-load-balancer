'use strict';

var
  should = require('should'),
  bytes = require('bytes'),
  proxyquire = require('proxyquire'),
  EventEmitter = require('events'),
  sinon = require('sinon'),
  Context = require.main.require('lib/core/Context');

describe('Test: service/HttpProxy', function () {
  let
    HttpProxy,
    httpProxy,
    messageHandler,
    httpServerStub,
    requestStub,
    responseStub,
    message,
    context = new Context(sinon.stub(), 'mode'),
    config;

  beforeEach(() => {
    // Config stub
    config = {
      http: {
        port: 17511,
        maxRequestSize: '1MB',
        accessControlAllowOrigin: '*'
      }
    };

    // Response stub
    responseStub = {
      writeHead: sinon.stub(),
      end: sinon.stub()
    };

    // Request stub
    requestStub = new EventEmitter();
    Object.assign(requestStub, {
      resume: sinon.stub(),
      url: 'url',
      method: 'method',
      headers: { some: 'headers' }
    });
    sinon.spy(requestStub, 'removeAllListeners');

    // Message sent to Kuzzle
    message = {
      data: {
        request: {
          url: requestStub.url,
          method: requestStub.method,
          headers: requestStub.headers,
          content: ''
        }
      },
      room: 'httpRequest'
    };


    // HTTP server stub
    httpServerStub = { listen: sinon.stub() };
    HttpProxy = proxyquire('../../lib/service/HttpProxy', {
      'http': {
        createServer: function (handler) {
          messageHandler = handler;
          return httpServerStub;
        }
      }
    });

    httpProxy = new HttpProxy();
  });

  describe('#init', () => {
    it('should throw if the maxRequestSize parameter is undefined', () => {
      should(function () { httpProxy.init(context, {http: {port: 17511}}); }).throw();
    });

    it('should throw if the maxRequestSize parameter does not represent a size', () => {
      should(function () { httpProxy.init(context, {http: {port: 17511, maxRequestSize: 'foobar'}}); }).throw();
    });

    it('should throw an error if there is no HTTP port configured', () => {
      should(function () { httpProxy.init(context, {http: {maxRequestSize: '1MB'}}); }).throw();
    });

    it('should start a HTTP server', () => {
      httpProxy.init(context, config);

      should(httpProxy.maxRequestSize).be.eql(bytes.parse('1MB'));
      should(httpProxy.server).be.eql(httpServerStub);
      should(httpServerStub.listen.calledWith(17511)).be.true();
    });
  });

  describe('#request handling', () => {
    beforeEach(() => {
      httpProxy.init(context, config);
    });

    it('should transmit a request to Kuzzle and its response back to the client', () => {
      context.broker = {
        brokerCallback: sinon.stub().yields(null, {
          status: 1234,
          type: 'type',
          response: 'response'
        })
      };

      messageHandler(requestStub, responseStub);
      requestStub.emit('end');


      should(context.broker.brokerCallback.calledWith(sinon.match(message), sinon.match.func)).be.true();

      should(responseStub.writeHead.calledWithMatch(1234, {
        'Content-Type': 'type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
      })).be.true();

      should(responseStub.end.calledWith('response')).be.true();
    });

    it('should forward a Kuzzle error to a client', () => {
      let error = {status: 1324, message: 'error'};

      context.broker = {
        brokerCallback: sinon.stub().yields(error)
      };

      messageHandler(requestStub, responseStub);
      requestStub.emit('end');

      should(context.broker.brokerCallback.calledWith(sinon.match(message), sinon.match.func)).be.true();

      should(responseStub.writeHead.calledWithMatch(error.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
      })).be.true();

      should(responseStub.end.calledWith(JSON.stringify(error))).be.true();
    });

    it('should respond with an error if the content length is too large', () => {
      requestStub.headers['content-length'] = bytes.parse('2MB');
      messageHandler(requestStub, responseStub);

      should(responseStub.writeHead.calledWithMatch(413, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
      })).be.true();

      should(requestStub.resume.calledOnce).be.true();
      should(responseStub.end.firstCall.args[0]).startWith('{"status":413,"message":"Error: maximum HTTP request size exceeded","stack":');
    });

    it('should forward to Kuzzle the request content if there is one', () => {
      context.broker = {
        brokerCallback: sinon.stub().yields(null, {
          status: 1234,
          type: 'type',
          response: 'response'
        })
      };

      message.data.request.content = 'foobarbaz';

      messageHandler(requestStub, responseStub);
      requestStub.emit('data', 'foo');
      requestStub.emit('data', 'bar');
      requestStub.emit('data', 'baz');
      requestStub.emit('end');

      should(context.broker.brokerCallback.calledWith(sinon.match(message), sinon.match.func)).be.true();

      should(responseStub.writeHead.calledWithMatch(1234, {
        'Content-Type': 'type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
      })).be.true();

      should(responseStub.end.calledWith('response')).be.true();
    });

    it('should respond with an error if the content size is too large', () => {
      context.broker = {
        brokerCallback: sinon.stub().yields(null, {
          status: 1234,
          type: 'type',
          response: 'response'
        })
      };

      httpProxy.maxRequestSize = 3;

      message.data.request.content = 'foobarbaz';

      messageHandler(requestStub, responseStub);
      requestStub.emit('data', 'foo');
      requestStub.emit('data', 'bar');
      requestStub.emit('data', 'baz');
      requestStub.emit('end');

      should(context.broker.brokerCallback.called).be.false();
      should(requestStub.removeAllListeners.calledWith('data')).be.true();
      should(requestStub.removeAllListeners.calledWith('end')).be.true();
      should(requestStub.resume.called).be.true();

      should(responseStub.writeHead.calledWithMatch(413, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
      })).be.true();

      should(responseStub.end.firstCall.args[0]).startWith('{"status":413,"message":"Error: maximum HTTP request size exceeded","stack":');

    });
  });
});

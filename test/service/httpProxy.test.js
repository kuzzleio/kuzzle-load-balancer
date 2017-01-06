'use strict';

const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  HttpProxy = rewire('../../lib/service/HttpProxy');

describe('/service/httpProxy', () => {
  let
    proxy,
    reset,
    httpProxy;

  beforeEach(() => {
    proxy = {
      broker: {
        brokerCallback: sinon.spy()
      },
      clientConnectionStore: {
        add: sinon.spy(),
        remove: sinon.spy()
      },
      config: {
        http: {
          maxRequestSize: '100k',
          port: 1234,
          host: 'host'
        }
      },
      logAccess: sinon.spy()
    };

    reset = HttpProxy.__set__({
      http: {
        createServer: sinon.stub().returns({
          listen: sinon.spy()
        })
      }
    });

    httpProxy = new HttpProxy();
    httpProxy.init(proxy);
  });

  afterEach(() => {
    reset();
  });

  describe('#init', () => {
    const
      sandbox = sinon.sandbox.create(),
      request = {
        url: 'url',
        method: 'method',
        httpVersion: '1.1',
        socket: {
          remoteAddress: '1.1.1.1'
        }
      },
      response = {
        writeHead: sandbox.spy()
      };

    beforeEach(() => {
      request.headers = {
        'x-forwarded-for': '2.2.2.2',
        'x-foo': 'bar'
      };
      request.on = sandbox.spy();
      request.resume = sandbox.spy();
      request.removeAllListeners = sandbox.stub().returnsThis();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should throw if an invalid maxRequestSize is given', () => {
      proxy.config.http.maxRequestSize = 'invalid';

      return should(() => httpProxy.init(proxy))
        .throw('Invalid HTTP "maxRequestSize" parameter');
    });

    it('should throw if no port is given', () => {
      delete proxy.config.http.port;

      return should(() => httpProxy.init(proxy))
        .throw('No HTTP port configured.');
    });

    it('should init the http server', () => {
      should(httpProxy.server.listen)
        .be.calledOnce()
        .be.calledWith(proxy.config.http.port, proxy.config.http.host);
    });

    it('should respond with error if the request is too big', () => {
      HttpProxy.__with__({
        replyWithError: sandbox.spy()
      })(() => {
        let cb = HttpProxy.__get__('http').createServer.firstCall.args[0];

        request.headers['content-length'] = 9999999999;

        cb(request, response);

        should(proxy.clientConnectionStore.add)
          .be.calledOnce()
          .be.calledWithMatch({
            protocol: 'HTTP/1.1',
            ips: ['2.2.2.2', '1.1.1.1'],
            headers: {
              'x-forwarded-for': '2.2.2.2',
              'x-foo': 'bar'
            }
          });
        should(request.resume)
          .be.calledOnce();
        should(HttpProxy.__get__('replyWithError'))
          .be.calledOnce()
          .be.calledWithMatch(/^[0-9a-w-]+$/, {url: request.url, method: request.method}, response, {message: 'Error: maximum HTTP request size exceeded'});
      });
    });

    it('should reply with error if the actual data sent exceeds the maxRequestSize', () => {
      HttpProxy.__with__({
        replyWithError: sandbox.spy()
      })(() => {
        let cb = HttpProxy.__get__('http').createServer.firstCall.args[0];

        httpProxy.maxRequestSize = 2;
        cb(request, response);

        let dataCB = request.on.firstCall.args[1];

        dataCB('a slightly too big chunk');
        should(request.removeAllListeners)
          .be.calledTwice();

        should(HttpProxy.__get__('replyWithError'))
          .be.calledWithMatch(/^[0-9a-z-]+$/, {url: request.url, method: request.method}, response, {message: 'Error: maximum HTTP request size exceeded'});
      });
    });

    it('should handle valid JSON request', (done) => {
      const resetSendRequest = HttpProxy.__set__('sendRequest', (connId, res, pload) => {
        resetSendRequest();
        should(pload.content).be.exactly('chunk1chunk2chunk3');
        done();
      });

      let cb = HttpProxy.__get__('http').createServer.firstCall.args[0];

      cb(request, response);

      let dataCB = request.on.firstCall.args[1];
      dataCB('chunk1');
      dataCB('chunk2');
      dataCB('chunk3');

      let endCB = request.on.lastCall.args[1];
      endCB();
    });
  });

  describe('#sendRequest', () => {
    const sendRequest = HttpProxy.__get__('sendRequest');

    let
      payload,
      res,
      response;

    beforeEach(() => {
      payload = {
        requestId: 'requestId',
        url: 'url?pretty'
      };
      response = {
        end: sinon.spy(),
        setHeader: sinon.spy(),
        writeHead: sinon.spy()
      };

      res = HttpProxy.__set__({
        replyWithError: sinon.spy()
      });
    });

    afterEach(() => {
      res();
    });

    it('should reply with error if one is received from Kuzzle', () => {
      const error = new Error('error');

      sendRequest('connectionId', response, payload);

      should(proxy.broker.brokerCallback)
        .be.calledOnce()
        .be.calledWith('httpRequest', payload.requestId, 'connectionId', payload);

      const brokerCb = proxy.broker.brokerCallback.firstCall.args[4];

      brokerCb(error);

      should(HttpProxy.__get__('replyWithError'))
        .be.calledOnce()
        .be.calledWith('connectionId', payload, response, error);
    });

    it('should output the result', () => {
      const result = {
        headers: {
          'x-foo': 'bar'
        },
        status: 'status',
        content: 'content'
      };

      sendRequest('connectionId', response, payload);
      const cb = proxy.broker.brokerCallback.firstCall.args[4];

      cb(undefined, result);

      should(response.setHeader)
        .be.calledOnce()
        .be.calledWith('x-foo', 'bar');

      should(response.writeHead)
        .be.calledOnce()
        .be.calledWith('status');

      should(response.end)
        .be.calledOnce()
        .be.calledWith(JSON.stringify(result.content, undefined, 2));
    });

    it('should output buffer raw result', () => {
      const result = {
        raw: true,
        status: 'status',
        content: new Buffer('test')
      };

      sendRequest('connectionId', response, payload);
      const cb = proxy.broker.brokerCallback.firstCall.args[4];

      cb(undefined, result);

      should(response.end)
        .be.calledOnce()
        .be.calledWith(result.content);
    });

    it('should output serialized JS objects marked as raw', () => {
      const result = {
        raw: true,
        status: 'status',
        content: [{foo: 'bar'}]
      };

      sendRequest('connectionId', response, payload);
      const cb = proxy.broker.brokerCallback.firstCall.args[4];

      cb(undefined, result);

      should(response.end)
        .be.calledWith(JSON.stringify(result.content));
    });

    it('should output scalar content as-is if marked as raw', () => {
      const result = {
        raw: true,
        status: 'status',
        content: 'content'
      };

      sendRequest('connectionId', response, payload);
      const cb = proxy.broker.brokerCallback.firstCall.args[4];

      cb(undefined, result);

      should(response.end)
        .be.calledOnce()
        .be.calledWithExactly(result.content);
    });
  });

  describe('#replyWithError', () => {
    let
      replyWithError,
      response;

    beforeEach(() => {
      replyWithError = HttpProxy.__get__('replyWithError');
      response = {
        end: sinon.spy(),
        writeHead: sinon.spy()
      };
    });

    it('should log the access and reply with error', () => {
      const error = new Error('test');
      error.status = 'status';

      replyWithError('connectionId', 'payload', response, error);

      should(proxy.logAccess)
        .be.calledOnce()
        .be.calledWithMatch('connectionId', 'payload', error, {
          raw: true,
          content: JSON.stringify(error)
        });

      should(response.writeHead)
        .be.calledOnce()
        .be.calledWith('status', {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        });
    });
  });

});


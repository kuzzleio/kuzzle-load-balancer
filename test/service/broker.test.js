'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Broker = rewire('../../lib/service/Broker'),
  EventEmitter = require('events'),
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

describe('service/broker', () => {
  let
    broker,
    proxy,
    reset;

  beforeEach(() => {
    proxy = {
      backendHandler: {
        addBackend: sinon.spy(),
        getAllBackends: sinon.stub(),
        getBackend: sinon.stub()
      },
      clientConnectionStore: {
        add: sinon.spy(),
        getAll: sinon.stub(),
        remove: sinon.spy()
      },
      log: {
        error: sinon.spy(),
        info: sinon.spy()
      },
      logAccess: sinon.spy()
    };

    reset = Broker.__set__({
      Backend: sinon.spy(function () {
        this.sendRaw = sinon.stub().yields();   // eslint-disable-line no-invalid-this
      }),
      fs: {
        unlinkSync: sinon.spy()
      },
      http: {
        createServer: sinon.stub().returns({
          listen: sinon.spy(),
          on: sinon.spy()
        })
      },
      net: {
        connect: sinon.stub().returns({
          on: sinon.spy()
        })
      },
      WebSocketServer: sinon.spy(function () {
        this.close = sinon.stub().yields();   // eslint-disable-line no-invalid-this
        this.on = sinon.spy();                // eslint-disable-line no-invalid-this
      })
    });
    broker = new Broker();
    broker.init(proxy, {
      socket: 'socket'
    });
  });

  afterEach(() => {
    reset();
  });

  describe('#initiateServer', () => {
    it('should exit with error if no connection configuration is given', () => {
      return Broker.__with__({
        process: {
          exit: sinon.spy()
        }
      })(() => {
        broker.config = {};

        broker.initiateServer();
        should(proxy.log.error)
          .be.calledOnce()
          .be.calledWith('Invalid configuration provided. Either "socket" or "port" must be provided.');

        should(Broker.__get__('process').exit)
          .be.calledOnce()
          .be.calledWith(1);
      });
    });

    it('should setup a websocket server over TCP', () => {
      broker.config = {
        port: 1234
      };

      broker.initiateServer();

      const listen = Broker.__get__('http').createServer.firstCall.returnValue.listen;

      should(listen)
        .be.calledTwice()   /// first call is done by beforeEach
        .be.calledWith(1234);

      const initCB = listen.firstCall.args[1];

      initCB();
      should(Broker.__get__('WebSocketServer'))
        .be.calledOnce();

      let b = Broker.__get__('WebSocketServer').firstCall.returnValue;
      should(b.on)
        .be.calledTwice()
        .be.calledWith('connection')
        .be.calledWith('error');
    });

    it('should bind to the given host if any', () => {
      broker.config = {
        port: 1234,
        host: 'host'
      };
      broker.initiateServer();

      const listen = Broker.__get__('http').createServer.firstCall.returnValue.listen;

      should(listen)
        .be.calledTwice()   /// first call is done by beforeEach
        .be.calledWith(1234, 'host');
    });

    it('should handle "socket in use" error', () => {
      const
        serverError = Broker.__get__('http').createServer.firstCall.returnValue.on.firstCall.args[1];

      // if not EADDRINUSE, rethrow
      should(() => serverError({code: 'somethingelse', message: 'not EADDRINUSE'}))
        .throw('not EADDRINUSE');

      // if we can connect, the socket is actually in use => rethrow
      serverError({
        code: 'EADDRINUSE',
        message: 'test'
      });
      should(Broker.__get__('net').connect)
        .be.calledOnce()
        .be.calledWith(broker.config.socket);

      const onNetConnect = Broker.__get__('net').connect.firstCall.args[1];
      should(() => onNetConnect())
        .throw('test');

      // got error on net connect.
      // case 1: not ECONNREFUSED > We do not know what is going on (i.e. permissions issue) => rethrow
      const onNetError = Broker.__get__('net').connect.firstCall.returnValue.on.firstCall.args[1];
      should(() => onNetError({code: 'foo'}))
        .throw();
      // case 2: ECONNREFUSED error > try to delete the socket file and try again
      onNetError({
        code: 'ECONNREFUSED'
      });
      should(Broker.__get__('fs').unlinkSync)
        .be.calledOnce()
        .be.calledWith(broker.config.socket);

      // same case but if the broker exists, we close it first
      Broker.__get__('http').createServer.firstCall.returnValue.listen.firstCall.args[1]();
      onNetError({
        code: 'ECONNREFUSED'
      });

    });
  });

  describe('#onConnection', () => {
    it('should register the backend and send it the active connections', (done) => {
      proxy.clientConnectionStore.getAll.returns([
        'foo',
        'bar'
      ]);
      broker.handleBackendRegistration = done;

      broker.onConnection('socket');

      const backend = Broker.__get__('Backend').firstCall.returnValue;

      should(backend.sendRaw)
        .be.calledWith('connection', 'foo')
        .be.calledWith('connection', 'bar');
    });
  });

  describe('#handleBackendRegistration', () => {
    it('should close the backend and log in case of error', () => {
      const
        backend = {
          socket: {
            close: sinon.spy()
          }
        },
        error = new Error('test');

      broker.handleBackendRegistration(error, backend);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('Failed to init connection with backend %s:\n%s', 'socket', error.stack);
      should(backend.socket.close)
        .be.calledOnce();
    });

    it('should register the backend', () => {
      const
        backend = {};

      broker.handleBackendRegistration(undefined, backend);
      should(proxy.backendHandler.addBackend)
        .be.calledOnce()
        .be.calledWith(backend);
    });
  });

  describe('#onError', () => {
    it('should log & exit', () => {
      return Broker.__with__({
        process: {
          exit: sinon.spy()
        }
      })(() => {
        const error = new Error('test');

        broker.onError(error);
        should(proxy.log.error)
          .be.calledOnce()
          .be.calledWith('An error occurred with the broker socket, shutting down; Reason:\n%s', error.stack);

        should(Broker.__get__('process').exit)
          .be.calledOnce()
          .be.calledWith(1);
      });
    });
  });

  describe('#brokerCallback', () => {
    it('should throw an error if no backend is available', (done) => {
      const cb = error => {
        should(error)
          .be.an.instanceOf(ServiceUnavailableError);
        done();
      };
      proxy.backendHandler.getBackend.returns(undefined);
      broker.brokerCallback('room', 'id', 'connectionId', 'data', cb);
    });

    it('should send the request to the backend', () => {
      const
        backend = {
          send: sinon.stub().yields()
        },
        cb = sinon.spy();
      proxy.backendHandler.getBackend.returns(backend);

      broker.brokerCallback('room', 'id', 'connectionId', 'data', cb);

      should(backend.send)
        .be.calledOnce()
        .be.calledWith('room', 'id', 'data');

      should(proxy.logAccess)
        .be.calledOnce()
        .be.calledWith('connectionId', 'data');

      should(cb)
        .be.calledOnce();
    });
  });

  describe('#addClientConnection', () => {
    it('should broadcast the connection to all backends', () => {
      broker.broadcastMessage = sinon.spy();

      broker.addClientConnection({
        id: 'connectionId',
        protocol: 'protocol'
      });

      should(broker.broadcastMessage)
        .be.calledOnce()
        .be.calledWith('connection');

      should(proxy.clientConnectionStore.add)
        .be.calledWithMatch({
          id: 'connectionId',
          protocol: 'protocol'
        });
    });
  });

  describe('#removeClientConnection', () => {
    it('should broadcast a disconnect event and remove the connection', () => {
      broker.broadcastMessage = sinon.spy();

      broker.removeClientConnection({
        id: 'connectionId',
        protocol: 'protocol'
      });

      should(broker.broadcastMessage)
        .be.calledOnce()
        .be.calledWith('disconnect');

      should(proxy.clientConnectionStore.remove)
        .be.calledOnce()
        .be.calledWith('connectionId');

    });
  });

  describe('#broadcastMessage', () => {
    it('should send data to all backends', () => {
      const
        backend1 = {sendRaw: sinon.spy()},
        backend2 = {sendRaw: sinon.spy()};
      proxy.backendHandler.getAllBackends.returns([
        backend1,
        backend2
      ]);

      broker.broadcastMessage('room', 'data');
      should(backend1.sendRaw)
        .be.calledOnce()
        .be.calledWith('room', 'data');
      should(backend2.sendRaw)
        .be.calledOnce()
        .be.calledWith('room', 'data');
    });
  });


});

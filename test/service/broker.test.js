// This a test file template
var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Broker = rewire('../../lib/service/Broker'),
  EventEmitter = require('events'),
  ServiceUnavailableError = require('kuzzle-common-objects').Errors.serviceUnavailableError;

describe('Test: service/Broker', function () {
  var
    sandbox = sinon.sandbox.create(),
    serverSocket,
    spyConsoleError,
    spyConsoleLog,
    dummyAddress = 'an Address',
    rawError,
    dummyError = new Error('an Error'),
    webSocketConstructorSpy,
    processMock,
    serverMock,
    sendRawSpy,
    BackendConstructorSpy,
    reset;

  beforeEach(() => {
    webSocketConstructorSpy = sandbox.spy(function () {
      serverSocket = new EventEmitter();
      serverSocket.close = sandbox.stub().yields();
      return serverSocket;
    });

    processMock = {
      exit: sandbox.spy()
    };

    serverMock = {
      on: sinon.spy(),
      listen: sinon.stub().yields()
    };

    sendRawSpy = sandbox.spy(function (dummy, callback) {
      if (rawError) {
        return callback(dummyError);
      }

      callback(null, {});
    });

    BackendConstructorSpy = sandbox.spy(function () {
      return {sendRaw: sendRawSpy};
    });

    reset = Broker.__set__({
      fs: {
        unlinkSync: sinon.spy()
      },
      WebSocketServer: webSocketConstructorSpy,
      Backend: BackendConstructorSpy,
      process: processMock,
      http: {
        createServer: sinon.stub().returns(serverMock)
      },
      net: {
        connect: sinon.stub().returns({
          on: sinon.spy()
        })
      }
    });

    rawError = false;
    spyConsoleError = sandbox.spy();
    spyConsoleLog = sandbox.spy();
    Broker.__set__('console', {log: spyConsoleLog, error: spyConsoleError});
  });

  afterEach(() => {
    reset();
    sandbox.restore();
  });

  it('method Constructor define object properties', () => {
    var broker = new Broker();

    should(broker.context).be.eql(null);
    should(broker.socketOptions).be.eql(null);
    should(broker.backendHandler).be.eql(null);
  });

  it('method init initializes the object properties and the broker socket', () => {
    var
      broker = new Broker(),
      serverStub = sandbox.stub(Broker.prototype, 'initiateServer'),
      dummyContext = {dummy: 'context'},
      config = {foo: 'bar'};

    broker.init(dummyContext, config);

    should(serverStub.calledOnce).be.eql(true);
    should(broker.context).be.eql(dummyContext);
    should(broker.config).be.exactly(config);
  });

  describe('#initiateServer', () => {
    var
      broker;

    beforeEach(() => {
      broker = new Broker();
      sandbox.stub(Broker.prototype, 'onConnection');
      sandbox.stub(Broker.prototype, 'onError');
    });

    it('should create a tcp websocket server', () => {
      broker.config = {
        port: 1234
      };

      broker.initiateServer();

      should(serverMock.listen)
        .be.calledOnce()
        .be.calledWith(broker.config.port);

      should(webSocketConstructorSpy)
        .be.calledOnce();
    });

    it('should create a tcp websocket server bound to the give host', () => {
      broker.config = {
        port: 1234,
        host: 'host'
      };

      broker.initiateServer();

      should(serverMock.listen)
        .be.calledOnce()
        .be.calledWith(broker.config.port, broker.config.host);
    });

    it('should fail if not valid connection is given', () => {
      broker.config = {};

      broker.initiateServer();

      should(spyConsoleError)
        .be.calledOnce()
        .be.calledWith('Invalid configuration provided. Either "socket" or "port" must be provided.');
      should(processMock.exit)
        .be.calledOnce()
        .be.calledWith(1);
    });

    it('should create a unix socket websocket server and handle EADDRINUSE errors', () => {
      var
        serverErrorCB,
        netConnectCB,
        netErrorCB;

      broker.config = {
        socket: '/socket'
      };

      broker.initiateServer();

      should(serverMock.on)
        .be.calledOnce()
        .be.calledWith('error');

      serverErrorCB = serverMock.on.firstCall.args[1];

      should(() => {
        serverErrorCB(new Error('test'));
      }).throw('test');

      serverErrorCB({code: 'EADDRINUSE', message: 'test'});

      should(Broker.__get__('net.connect'))
        .be.calledOnce()
        .be.calledWith(broker.config.socket);

      netConnectCB = Broker.__get__('net.connect').firstCall.args[1];

      should(() => {
        netConnectCB();
      }).throw('test');

      netErrorCB = Broker.__get__('net.connect').firstCall.returnValue.on.firstCall.args[1];

      should(() => {
        netErrorCB(new Error('test'));
      }).throw('test');

      should(serverMock.listen)
        .be.calledOnce();

      netErrorCB({code: 'ECONNREFUSED'});

      should(Broker.__get__('fs.unlinkSync'))
        .be.calledOnce()
        .be.calledWith(broker.config.socket);

      should(Broker.__get__('WebSocketServer').firstCall.returnValue.close)
        .be.calledOnce();

      should(serverMock.listen)
        .be.calledTwice();

    });
  });

  describe('#onConnection', () => {
    it('method onConnection plays client connections properly', (done) => {
      var
        broker = new Broker(),
        dummySocket = {dummy: 'socket', upgradeReq: {connection: {remoteAddress: dummyAddress}}},
        getAllSpy = sandbox
          .stub()
          .returns({aRequestId: 'aConnection', anotherRequestId: 'anotherConnection'}),
        dummyContext = {dummy: 'context', clientConnectionStore: {getAll: getAllSpy}},
        dummyTimeout = 1234,
        addEnvelopeStub = sandbox
          .stub(Broker.prototype, 'addEnvelope')
          .returnsArg(1),
        handleBackendRegistrationStub = sandbox.stub(Broker.prototype, 'handleBackendRegistration');

      broker.context = dummyContext;
      broker.config = {
        timeout: dummyTimeout
      };

      broker.onConnection(dummySocket);

      should(BackendConstructorSpy)
        .be.calledOnce()
        .be.calledWith(dummySocket, dummyContext, broker.config.timeout);
      should(getAllSpy)
        .be.calledOnce();
      should(sendRawSpy)
        .be.calledTwice();
      should(addEnvelopeStub.getCall(0).calledWith({}, 'aConnection', 'connection')).be.true();
      should(addEnvelopeStub.getCall(1).calledWith({}, 'anotherConnection', 'connection')).be.true();
      should(sendRawSpy.getCall(0).calledWith(JSON.stringify('aConnection'))).be.true();
      should(sendRawSpy.getCall(1).calledWith(JSON.stringify('anotherConnection'))).be.true();
      setTimeout(() => {
        should(handleBackendRegistrationStub.calledOnce).be.true();
        should(handleBackendRegistrationStub.getCall(0).args[1]).be.eql(null);

        done();
      }, 20);
    });

    it('method onConnection must catch an error when it happens', (done) => {
      var
        broker = new Broker(),
        dummySocket = {dummy: 'socket', upgradeReq: {connection: {remoteAddress: dummyAddress}}},
        getAllSpy = sandbox
          .stub()
          .returns({aRequestId: 'aConnection', anotherRequestId: 'anotherConnection'}),
        dummyContext = {dummy: 'context', clientConnectionStore: {getAll: getAllSpy}},
        dummyTimeout = 1234,
        addEnvelopeStub = sandbox.stub(Broker.prototype, 'addEnvelope'),
        handleBackendRegistrationStub = sandbox.stub(Broker.prototype, 'handleBackendRegistration');

      BackendConstructorSpy.reset();
      sendRawSpy.reset();
      rawError = true;
      broker.context = dummyContext;
      broker.config = {
        timeout: dummyTimeout
      };

      broker.onConnection(dummySocket);

      should(BackendConstructorSpy.calledOnce).be.true();
      should(BackendConstructorSpy.calledWith(dummySocket, dummyContext, dummyTimeout)).be.true();
      should(getAllSpy.calledOnce).be.true();
      should(sendRawSpy.calledOnce).be.true();
      should(addEnvelopeStub.getCall(0).calledWith({}, 'aConnection', 'connection')).be.true();
      setTimeout(() => {
        should(handleBackendRegistrationStub.calledOnce).be.true();
        should(handleBackendRegistrationStub.getCall(0).args[1]).be.deepEqual(dummyError);
        done();
      }, 20);
    });

    it('should log new connections', () => {
      var
        broker = new Broker();

      broker.config = {
        socket: 'socket'
      };
      broker.context = {
        clientConnectionStore: {
          getAll: sinon.spy()
        }
      };

      broker.onConnection();

      should(spyConsoleLog)
        .be.calledOnce()
        .be.calledWith('Connection established with a new backend');
    });
  });

  it('method handleBackendRegistration must console error when an error has occured and close the socket', () => {
    var
      broker = new Broker(),
      dummyBackend = {
        socket: {
          close: sandbox.spy(),
          upgradeReq: {
            connection: {
              remoteAddress: dummyAddress
            }
          }
        }
      };

    spyConsoleError.reset();

    broker.handleBackendRegistration(dummyBackend, dummyError);

    should(spyConsoleError.calledOnce).be.true();
    should(spyConsoleError.calledWith(`Initialization of the connection with backend ${dummyAddress} failed; Reason: an Error`)).be.true();
    should(dummyBackend.socket.close.calledOnce).be.true();
  });

  it('method handleBackendRegistration should register a backend if its HTTP port is available', () => {
    var
      dummyContext = {
        backendHandler: {addBackend: sinon.stub()}
      },
      dummyBackend = {
        httpPort: true
      },
      broker = new Broker();

    broker.context = dummyContext;
    broker.handleBackendRegistration(dummyBackend);

    should(dummyContext.backendHandler.addBackend.calledWith(dummyBackend)).be.true();
  });

  it('method handleBackendRegistration should postpone registration of a backend if its HTTP port is unavailable', () => {
    var
      dummyContext = {
        backendHandler: {addBackend: sinon.stub()}
      },
      dummyBackend = {
        httpPort: false
      },
      broker = new Broker();

    broker.context = dummyContext;
    broker.handleBackendRegistration(dummyBackend);

    should(dummyContext.backendHandler.addBackend.called).be.false();
    should(dummyBackend.httpPortCallback).be.a.Function();

    dummyBackend.httpPortCallback();
    should(dummyContext.backendHandler.addBackend.calledWith(dummyBackend)).be.true();
  });

  it('method onError write a console error and ends the process', () => {
    var broker = new Broker();

    spyConsoleError.reset();
    processMock.exit.reset();

    broker.onError(dummyError);

    should(spyConsoleError.calledOnce).be.true();
    should(spyConsoleError.calledWith('An error occurred with the broker socket, shutting down; Reason :', dummyError)).be.true();
    should(processMock.exit.calledOnce).be.true();
    should(processMock.exit.calledWith(1)).be.true();
  });

  it('method brokerCallback rejects the callback if a message has a bad format', () => {
    var
      broker = new Broker(),
      dummyCallback = sandbox.spy(),
      dummyMessage = {data: {not: 'a proper message'}},
      dummyContext = {backendHandler: {getBackend : sandbox.spy()}};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyCallback);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(dummyCallback.calledOnce).be.true();
    should(dummyCallback.calledWithMatch({message: `Bad format : ${dummyMessage}`, status: 400})).be.true();
  });

  it('method brokerCallback rejects the callback if a message has a bad structure', () => {
    var
      broker = new Broker(),
      dummyCallback = sandbox.spy(),
      dummyMessage = {room: 'request', data: {request: {not: 'a proper message'}}},
      dummyContext = {backendHandler: {getBackend : sandbox.spy()}};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyCallback);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(dummyCallback.calledOnce).be.true();
    should(dummyCallback.calledWithMatch({message: `Bad message : ${dummyMessage}`, status: 400})).be.true();
  });

  it('method brokerCallback rejects requests if no backend is available', () => {
    var
      broker = new Broker(),
      dummyCallback = sandbox.spy(),
      dummyMessage = {room: 'request', data: {request: {requestId: 'a proper message'}}},
      dummyContext = {backendHandler: {getBackend: sandbox.stub().returns(null)}};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyCallback);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(dummyCallback.calledOnce).be.true();
    should(dummyCallback.calledWithMatch(sinon.match.instanceOf(ServiceUnavailableError))).be.true();
  });

  it('method brokerCallback adds a request to the store if no backend', () => {
    var
      broker = new Broker(),
      dummyCallback = sandbox.spy(),
      dummyMessage = {room: 'request', data: {request: {requestId: 'a proper message'}}},
      backendSendSpy = sandbox.spy(),
      dummyContext = {backendHandler: {getBackend : sandbox.stub().returns({send: backendSendSpy})}};

    broker.brokerRequestStore = {remove: sandbox.stub()};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyCallback);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(backendSendSpy.calledOnce).be.true();
    should(backendSendSpy.calledWith({message: dummyMessage, callback: dummyCallback})).be.true();
  });

  it('method addClientConnection adds the client to the store and broadcasts the intel to all backends', () => {
    var
      broker = new Broker(),
      addEnvelopeStub = sandbox
        .stub(Broker.prototype, 'addEnvelope')
        .returnsArg(1),
      dummyConnection = 'a connection',
      broadcastSpy = sandbox.stub(Broker.prototype, 'broadcastMessage'),
      dummyContext = {clientConnectionStore: {add: sandbox.spy()}};

    broker.context = dummyContext;
    broker.addClientConnection(dummyConnection);

    should(addEnvelopeStub.calledOnce).be.true();
    should(addEnvelopeStub.calledWith({}, dummyConnection, 'connection')).be.true();
    should(broadcastSpy.calledOnce).be.true();
    should(broadcastSpy.calledWith(dummyConnection)).be.true();
    should(dummyContext.clientConnectionStore.add.calledOnce).be.true();
    should(dummyContext.clientConnectionStore.add.calledWith(dummyConnection)).be.true();
  });

  it('method removeClientConnection removes the client from the store and broadcasts the intel to all backends', () => {
    var
      broker = new Broker(),
      addEnvelopeStub = sandbox
        .stub(Broker.prototype, 'addEnvelope')
        .returnsArg(1),
      dummyConnection = 'a connection',
      broadcastSpy = sandbox.stub(Broker.prototype, 'broadcastMessage'),
      dummyContext = {clientConnectionStore: {remove: sandbox.spy()}};

    broker.context = dummyContext;
    broker.removeClientConnection(dummyConnection);

    should(addEnvelopeStub.calledOnce).be.true();
    should(addEnvelopeStub.calledWith({}, dummyConnection, 'disconnect')).be.true();
    should(broadcastSpy.calledOnce).be.true();
    should(broadcastSpy.calledWith(dummyConnection)).be.true();
    should(dummyContext.clientConnectionStore.remove.calledOnce).be.true();
    should(dummyContext.clientConnectionStore.remove.calledWith(dummyConnection)).be.true();
  });


  it('method broadcastMessage resolve the promise if sendRaw issues no error', (done) => {
    var
      broker = new Broker(),
      getAllStub = sandbox.stub().returns([new BackendConstructorSpy()]),
      dummyMessage = {dummy: 'message'};

    BackendConstructorSpy.reset();
    sendRawSpy.reset();
    rawError = false;

    broker.context = {backendHandler: {getAllBackends: getAllStub}};

    broker.broadcastMessage(dummyMessage)
      .then(() => {
        should(sendRawSpy.calledOnce).be.true();
        should(sendRawSpy.calledWith(JSON.stringify(dummyMessage))).be.true();

        done();
      })
      .catch(() => {
        // Should never be called
        should(false).be.true();
        done(false);
      });

    should(getAllStub.calledOnce).be.true();
  });

  it('method broadcastMessage rejects the promise if sendRaw issues an error', (done) => {
    var
      broker = new Broker(),
      getAllStub = sandbox.stub().returns([new BackendConstructorSpy()]),
      dummyMessage = {dummy: 'message'};

    BackendConstructorSpy.reset();
    sendRawSpy.reset();
    rawError = true;

    broker.context = {backendHandler: {getAllBackends: getAllStub}};

    broker.broadcastMessage(dummyMessage)
      .then(() => {
        // Should never be called
        should(false).be.true();
        done(false);
      })
      .catch((error) => {
        should(sendRawSpy.calledOnce).be.true();
        should(sendRawSpy.calledWith(JSON.stringify(dummyMessage))).be.true();

        should(error).be.deepEqual(dummyError);
        done();
      });

    should(getAllStub.calledOnce).be.true();
  });

  it('method addEnvelope returns the proper envelope form', () => {
    var
      broker = new Broker(),
      dummyRequest = 'a request',
      dummyConnection = 'a connection',
      dummyRoom = 'a room',
      expectedResult = {data: {request: dummyRequest, context: {connection: dummyConnection}}, room : dummyRoom};

    should(broker.addEnvelope(dummyRequest, dummyConnection, dummyRoom)).be.deepEqual(expectedResult);
  });
});

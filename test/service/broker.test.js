// This a test file template
var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Broker = rewire('../../lib/service/Broker'),
  EventEmitter = require('events'),
  PendingRequest = require.main.require('lib/store/PendingRequest'),
  q = require('q');

describe('Test: service/Broker', function () {
  var
    sandbox = sinon.sandbox.create(),
    serverSocket,
    spyConsoleError,
    spyConsoleLog,
    dummyAddress = 'an Address',
    rawError,
    dummyError = new Error('an Error'),
    webSocketConstructorSpy = sandbox.spy(function (port) {
      serverSocket = new EventEmitter();
      return serverSocket;
    }),
    sendRawSpy = sandbox.spy(function () {
      if (rawError) {
        return q.reject(dummyError);
      }

      return q({});
    }),
    backendConstructorSpy = sandbox.spy(function () {
      return {sendRaw: sendRawSpy};
    }),
    processMock = {
      exit: sandbox.spy()
    };

  before(() => {
    Broker.__set__('WebSocketServer', webSocketConstructorSpy);
    Broker.__set__('Backend', backendConstructorSpy);
    Broker.__set__('process', processMock);
  });

  beforeEach(() => {
    rawError = false;
    spyConsoleError = sandbox.spy();
    spyConsoleLog = sandbox.spy();
    Broker.__set__('console', {log: spyConsoleLog, error: spyConsoleError});
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('method Constructor define object properties', () => {
    var broker = new Broker();

    should(broker.context).be.eql(null);
    should(broker.brokerRequestStore).be.eql(null);
    should(broker.socketOptions).be.eql(null);
    should(broker.backendHandler).be.eql(null);
  });

  it('method init initializes the object properties and the broker socket', () => {
    var
      broker = new Broker(),
      serverStub = sandbox.stub(Broker.prototype, 'initiateServer'),
      dummyContext = {dummy: 'context'},
      dummySocketOption = { dummy: 'socketOptions'},
      dummyBackendTimeout = 1234;

    broker.init(dummyContext, dummySocketOption, dummyBackendTimeout);

    should(serverStub.calledOnce).be.eql(true);
    should(broker.context).be.eql(dummyContext);
    should(broker.socketOptions).be.eql(dummySocketOption);
    should(broker.backendTimeout).be.eql(dummyBackendTimeout);
    should(broker.brokerRequestStore).be.instanceOf(PendingRequest);
  });

  it('method initiateServer plugs good listeners to events', () => {
    var broker = new Broker(),
      dummySocketOption = {port: 1234},
      connectionStub = sandbox.stub(Broker.prototype, 'onConnection'),
      errorStub = sandbox.stub(Broker.prototype, 'onError');

    broker.initiateServer(dummySocketOption);

    serverSocket.emit('connection');
    serverSocket.emit('error');

    should(connectionStub.calledOnce).be.eql(true);
    should(errorStub.calledOnce).be.eql(true);
    should(webSocketConstructorSpy.calledWith({port: dummySocketOption.port})).be.true();
    should(spyConsoleLog.calledOnce).be.eql(true);
    should(spyConsoleLog.calledWith(`Waiting for connections on port ${dummySocketOption.port}`)).be.eql(true);
  });

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
    broker.backendTimeout = dummyTimeout;

    broker.onConnection(dummySocket);

    should(backendConstructorSpy.calledOnce).be.true();
    should(backendConstructorSpy.calledWith(dummySocket, dummyContext, dummyTimeout)).be.true();
    should(getAllSpy.calledOnce).be.true();
    should(sendRawSpy.calledTwice).be.true();
    should(addEnvelopeStub.getCall(0).calledWith({}, 'aConnection', 'connection')).be.true();
    should(addEnvelopeStub.getCall(1).calledWith({}, 'anotherConnection', 'connection')).be.true();
    should(sendRawSpy.getCall(0).calledWith(JSON.stringify('aConnection'))).be.true();
    should(sendRawSpy.getCall(1).calledWith(JSON.stringify('anotherConnection'))).be.true();
    process.nextTick(() => {
      should(handleBackendRegistrationStub.calledOnce).be.true();
      should(handleBackendRegistrationStub.getCall(0).args[1]).be.eql(null);

      done();
    });
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

    backendConstructorSpy.reset();
    sendRawSpy.reset();
    rawError = true;
    broker.context = dummyContext;
    broker.backendTimeout = dummyTimeout;

    broker.onConnection(dummySocket);

    should(backendConstructorSpy.calledOnce).be.true();
    should(backendConstructorSpy.calledWith(dummySocket, dummyContext, dummyTimeout)).be.true();
    should(getAllSpy.calledOnce).be.true();
    should(sendRawSpy.calledTwice).be.true();
    should(addEnvelopeStub.getCall(0).calledWith({}, 'aConnection', 'connection')).be.true();
    should(addEnvelopeStub.getCall(1).calledWith({}, 'anotherConnection', 'connection')).be.true();
    process.nextTick(() => {
      should(handleBackendRegistrationStub.calledOnce).be.true();
      should(handleBackendRegistrationStub.getCall(0).args[1]).be.deepEqual(dummyError);
      done();
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
    should(spyConsoleError.calledWith(`Initialization of the connection with backend ${dummyAddress} failed.`)).be.true();
    should(dummyBackend.socket.close.calledOnce).be.true();
  });

  it('method handleBackendRegistration must initialize the resend process if httpPort of backend is set', () => {
    var
      broker = new Broker(),
      dummyBackend = {
        httpPort: 1234
      },
      dummyContext = {
        backendHandler: {
          addBackend: sandbox.spy()
        }
      },
      resendPendingStub = sandbox.stub(Broker.prototype, 'resendPending');

    broker.context = dummyContext;
    broker.handleBackendRegistration(dummyBackend, null);

    should(resendPendingStub.calledOnce).be.true();
    should(dummyContext.backendHandler.addBackend.calledOnce).be.true();
    should(dummyContext.backendHandler.addBackend.calledWith(dummyBackend)).be.true();
  });

  it('method handleBackendRegistration must stand-by the resend process as a callable function set in the backend', () => {
    var
      broker = new Broker(),
      dummyBackend = {
        httpPortCallback: null
      },
      dummyContext = {
        backendHandler: {
          addBackend: sandbox.spy()
        }
      },
      resendPendingStub = sandbox.stub(Broker.prototype, 'resendPending');

    broker.context = dummyContext;
    broker.handleBackendRegistration(dummyBackend, null);

    should(dummyBackend.httpPortCallback).be.instanceOf(Function);

    should(resendPendingStub.callCount).be.eql(0);
    should(dummyContext.backendHandler.addBackend.callCount).be.eql(0);

    dummyBackend.httpPortCallback();

    should(resendPendingStub.calledOnce).be.true();
    should(dummyContext.backendHandler.addBackend.calledOnce).be.true();
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


  it('method resendPending re-sends the current broker pending requests', () => {
    var
      broker = new Broker(),
      brokerCallbackStub;

    broker.brokerRequestStore = {
      getAll: sandbox.stub().returns({
        aRequestId: {message: 'a message', promise: 'a promise'},
        anotherRequestId: {message: 'another message', promise: 'another promise'}
      }),
      clear: sandbox.spy()
    };

    brokerCallbackStub = sandbox.stub(Broker.prototype, 'brokerCallback');

    broker.resendPending();

    should(broker.brokerRequestStore.getAll.calledOnce).be.true();
    should(broker.brokerRequestStore.clear.calledOnce).be.true();
    should(brokerCallbackStub.calledTwice).be.true();
    should(brokerCallbackStub.getCall(0).calledWith('a message', 'a promise')).be.true();
    should(brokerCallbackStub.getCall(1).calledWith('another message', 'another promise')).be.true();
  });

  it('method brokerCallback rejects the promise if a message has a bad format', () => {
    var
      broker = new Broker(),
      dummyPromise = {reject: sandbox.spy()},
      dummyMessage = {data: {not: 'a proper message'}},
      dummyContext = {backendHandler: {getBackend : sandbox.spy()}};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyPromise);
    
    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(dummyPromise.reject.calledOnce).be.true();
    should(dummyPromise.reject.calledWith(new Error(`Bad format : ${dummyMessage}`))).be.true();
  });

  it('method brokerCallback rejects the promise if a message has a bad structure', () => {
    var
      broker = new Broker(),
      dummyPromise = {reject: sandbox.spy()},
      dummyMessage = {room: 'request', data: {request: {not: 'a proper message'}}},
      dummyContext = {backendHandler: {getBackend : sandbox.spy()}};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyPromise);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(dummyPromise.reject.calledOnce).be.true();
    should(dummyPromise.reject.calledWith(new Error(`Bad message : ${dummyMessage}`))).be.true();
  });

  it('method brokerCallback adds a request to the store if no backend', () => {
    var
      broker = new Broker(),
      dummyPromise = {reject: sandbox.spy()},
      dummyMessage = {room: 'request', data: {request: {requestId: 'a proper message'}}},
      dummyContext = {backendHandler: {getBackend: sandbox.stub().returns(null)}};

    broker.brokerRequestStore = {add: sandbox.stub()};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyPromise);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(broker.brokerRequestStore.add.calledOnce).be.true();
    should(broker.brokerRequestStore.add.calledWith({message: dummyMessage, promise: dummyPromise})).be.true();
  });

  it('method brokerCallback adds a request to the store if no backend', () => {
    var
      broker = new Broker(),
      dummyPromise = {reject: sandbox.spy()},
      dummyMessage = {room: 'request', data: {request: {requestId: 'a proper message'}}},
      backendSendSpy = sandbox.spy(),
      dummyContext = {backendHandler: {getBackend : sandbox.stub().returns({send: backendSendSpy})}};

    broker.brokerRequestStore = {remove: sandbox.stub()};

    broker.context = dummyContext;
    broker.brokerCallback(dummyMessage, dummyPromise);

    should(dummyContext.backendHandler.getBackend.calledOnce).be.true();
    should(broker.brokerRequestStore.remove.calledOnce).be.true();
    should(backendSendSpy.calledOnce).be.true();
    should(backendSendSpy.calledWith({message: dummyMessage, promise: dummyPromise})).be.true();
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
      getAllStub = sandbox.stub().returns([new backendConstructorSpy()]),
      dummyMessage = {dummy: 'message'};

    backendConstructorSpy.reset();
    sendRawSpy.reset();
    rawError = false;

    broker.context = {backendHandler: {getAllBackends: getAllStub}};

    broker.broadcastMessage(dummyMessage)
      .then(() => {
        should(sendRawSpy.calledOnce).be.true();
        should(sendRawSpy.calledWith(JSON.stringify(dummyMessage))).be.true();

        done();
      })
      .catch((error) => {

        // Should never be called
        should(false).be.true();
        done(false);
      });

    should(getAllStub.calledOnce).be.true();
  });

  it('method broadcastMessage rejects the promise if sendRaw issues an error', (done) => {
    var
      broker = new Broker(),
      getAllStub = sandbox.stub().returns([new backendConstructorSpy()]),
      dummyMessage = {dummy: 'message'};

    backendConstructorSpy.reset();
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

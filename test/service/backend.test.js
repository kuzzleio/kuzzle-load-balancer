var
  should = require('should'),
  EventEmitter = require('events'),
  rewire = require('rewire'),
  Backend = rewire('../../lib/service/Backend'),
  sinon = require('sinon'),
  PendingRequest = require.main.require('lib/store/PendingRequest');

describe('Test: service/Backend', function () {
  var
    sandbox,
    dummyContext = {
      dummy: 'context',
      clientConnectionStore: {getByConnectionId: () => {}},
      pluginStore: {getByProtocol: () => {}},
      backendHandler: {removeBackend: () => {}}
    },
    dummyTimeout = 1234,
    dummyAddress = 'aDummyAddress',
    spyConsoleError,
    spyConsoleLog,
    spyPromisify,
    spySocketClose;

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
    spySocketClose = sandbox.spy();
    spyConsoleError = sandbox.spy();
    spyConsoleLog = sandbox.spy();
    spyPromisify = sandbox.stub().returns(() => {});
    Backend.__set__('console', {log: spyConsoleLog, error: spyConsoleError});
    Backend.__set__('Promise', {promisify: spyPromisify});
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('method Constructor must initiate properly and plug good listeners to events', () => {
    var
      backend,
      dummySocket = new EventEmitter(),
      onConnectionCloseStub = sandbox.stub(Backend.prototype, 'onConnectionClose'),
      onConnectionErrorStub = sandbox.stub(Backend.prototype, 'onConnectionError'),
      onMessageStub = sandbox.stub(Backend.prototype, 'onMessage'),
      messageRoomsStub = sandbox
        .stub(Backend.prototype, 'initializeMessageRooms')
        .returns({});

    dummySocket.upgradeReq = {connection: {remoteAddress: dummyAddress}};

    backend = new Backend(dummySocket, dummyContext, dummyTimeout);

    backend.socket.emit('close');
    backend.socket.emit('error');
    backend.socket.emit('message');

    should(onConnectionCloseStub.calledOnce).be.true();
    should(onConnectionErrorStub.calledOnce).be.true();
    should(messageRoomsStub.calledOnce).be.true();
    should(onMessageStub.calledOnce).be.true();
    should(backend.backendRequestStore).be.instanceOf(PendingRequest);
    should(backend.httpPort).be.eql(null);
    should(backend.httpPortCallback).be.eql(null);
    should(backend.onMessageRooms).be.an.Object();
  });

  describe('method onMessage', () => {
    it('onMessage must write a console error if the message contains no room', () => {
      var
        backend = initBackend(dummyContext),
        badMessage = {no: 'room'},
        badMessageString = JSON.stringify(badMessage);

      backend.onMessage(badMessageString);

      should(spyConsoleError.calledWith(`Room is not specified in message: ${badMessageString}`)).be.true();
    });

    it('onMessage must write a console error if JSON.parse does not do what is expected', () => {
      var
        backend = initBackend(dummyContext),
        badMessage = 'unexpected',
        error = 'SyntaxError: Unexpected token u';

      backend.onMessage(badMessage);

      should(spyConsoleError.calledWith(`Bad message received from the backend : ${badMessage}; Reason : ${error}`)).be.true();
    });

    it('message room "response" must call the promise resolution if message is ok', () => {
      var
        backend = initBackend(dummyContext),
        goodResponse = {room: 'response', data: {requestId: 'aRequestId', response: 'aResponse'}},
        goodResponseMessage = JSON.stringify(goodResponse),
        requestExistsStub,
        requestGetStub,
        requestRemoveStub,
        resolveSpy;

      resolveSpy = sandbox.spy();
      requestRemoveStub = sandbox.stub(backend.backendRequestStore, 'removeByRequestId');
      requestExistsStub = sandbox
        .stub(backend.backendRequestStore, 'existsByRequestId')
        .returns(true);
      requestGetStub = sandbox
        .stub(backend.backendRequestStore, 'getByRequestId')
        .returns({promise: {resolve: resolveSpy}});

      backend.onMessage(goodResponseMessage);

      should(requestExistsStub.calledOnce).be.true();
      should(requestExistsStub.calledWith('aRequestId')).be.true();
      should(resolveSpy.calledOnce).be.true();
      should(requestGetStub.calledOnce).be.true();
      should(requestGetStub.calledWith('aRequestId')).be.true();
      should(requestRemoveStub.calledOnce).be.true();
      should(requestRemoveStub.calledWith('aRequestId')).be.true();
    });

    it('message room "response" should do nothing if request is unknown', () => {
      var
        backend = initBackend(dummyContext),
        unexistingResponse = {room: 'response', data: {requestId: 'aRequestId', response: 'aResponse'}},
        unexistingResponseMessage = JSON.stringify(unexistingResponse),
        requestExistsStub,
        requestGetStub,
        requestRemoveStub;

      requestExistsStub = sandbox
        .stub(backend.backendRequestStore, 'existsByRequestId')
        .returns(false);
      requestGetStub = sandbox.stub(backend.backendRequestStore, 'getByRequestId');
      requestRemoveStub = sandbox.stub(backend.backendRequestStore, 'removeByRequestId');

      backend.onMessage(unexistingResponseMessage);

      should(requestExistsStub.calledOnce).be.true();
      should(requestExistsStub.calledWith('aRequestId')).be.true();
      should(requestGetStub.callCount).be.eql(0);
      should(requestRemoveStub.callCount).be.eql(0);
    });

    it('message room "joinChannel" must call joinChannel if everything is ok', () => {
      var
        backend = initBackend(dummyContext),
        join = {room: 'joinChannel', data: {id: 'anId', some: 'data'}},
        joinMessage = JSON.stringify(join),
        connectionGetStub,
        pluginGetStub,
        joinChannelSpy;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({type: 'aType'});

      joinChannelSpy = sandbox.spy();

      pluginGetStub = sandbox
        .stub(backend.context.pluginStore, 'getByProtocol')
        .returns({joinChannel: joinChannelSpy});

      backend.onMessage(joinMessage);

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.calledOnce).be.true();
      should(pluginGetStub.calledWith('aType')).be.true();
      should(joinChannelSpy.calledOnce).be.true();
      should(joinChannelSpy.calledWith(join.data)).be.true();
    });

    it('message room "joinChannel" must do nothing if client type can not be determined', () => {
      var
        backend = initBackend(dummyContext),
        join = {room: 'joinChannel', data: {id: 'anId', some: 'data'}},
        joinMessage = JSON.stringify(join),
        connectionGetStub,
        pluginGetStub;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({});
      pluginGetStub = sandbox.stub(backend.context.pluginStore, 'getByProtocol');

      backend.onMessage(joinMessage);

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.callCount).be.eql(0);
    });

    it('message room "leaveChannel" must call leaveChannel if everything is ok', () => {
      var
        backend = initBackend(dummyContext),
        leave = {room: 'leaveChannel', data: {id: 'anId', some: 'data'}},
        leaveMessage = JSON.stringify(leave),
        connectionGetStub,
        pluginGetStub,
        leaveChannelSpy;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({type: 'aType'});

      leaveChannelSpy = sandbox.spy();

      pluginGetStub = sandbox
        .stub(backend.context.pluginStore, 'getByProtocol')
        .returns({leaveChannel: leaveChannelSpy});

      backend.onMessage(leaveMessage);

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.calledOnce).be.true();
      should(pluginGetStub.calledWith('aType')).be.true();
      should(leaveChannelSpy.calledOnce).be.true();
      should(leaveChannelSpy.calledWith(leave.data)).be.true();
    });

    it('message room "leaveChannel" must do nothing if client type can not be determined', () => {
      var
        backend = initBackend(dummyContext),
        leave = {room: 'leaveChannel', data: {id: 'anId', some: 'data'}},
        leaveMessage = JSON.stringify(leave),
        connectionGetStub,
        pluginGetStub;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({});
      pluginGetStub = sandbox.stub(backend.context.pluginStore, 'getByProtocol');

      backend.onMessage(leaveMessage);

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.callCount).be.eql(0);
    });

    it('message room "notify" must call notify if everything is ok', () => {
      var
        backend = initBackend(dummyContext),
        notify = {room: 'notify', data: {id: 'anId', some: 'data'}},
        notifyMessage = JSON.stringify(notify),
        connectionGetStub,
        pluginGetStub,
        notifySpy;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({type: 'aType'});

      notifySpy = sandbox.spy();

      pluginGetStub = sandbox
        .stub(backend.context.pluginStore, 'getByProtocol')
        .returns({notify: notifySpy});

      backend.onMessage(notifyMessage);

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.calledOnce).be.true();
      should(pluginGetStub.calledWith('aType')).be.true();
      should(notifySpy.calledOnce).be.true();
      should(notifySpy.calledWith(notify.data)).be.true();
    });

    it('message room "notify" must do nothing if client type can not be determined', () => {
      var
        backend = initBackend(dummyContext),
        notify = {room: 'notify', data: {id: 'anId', some: 'data'}},
        notifyMessage = JSON.stringify(notify),
        connectionGetStub,
        pluginGetStub;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({});
      pluginGetStub = sandbox.stub(backend.context.pluginStore, 'getByProtocol');

      backend.onMessage(notifyMessage);

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.callCount).be.eql(0);
    });

    it('message room broadcast must broadcast message to all plugins', () => {
      var
        spyPluginBroadcast = sandbox.spy(),
        pluginContext = {pluginStore: {plugins: {aPlugin: {broadcast: spyPluginBroadcast}}}},
        backend = initBackend(pluginContext),
        broadcast = {room: 'broadcast', data: {some: 'data'}},
        broadcastMessage = JSON.stringify(broadcast);

      backend.onMessage(broadcastMessage);

      should(spyPluginBroadcast.calledOnce).be.true();
      should(spyPluginBroadcast.calledWith(broadcast.data)).be.true();
    });

    it('message room httpPortInitialization must set the httpPort', () => {
      var
        backend = initBackend(dummyContext),
        httpPort = {room: 'httpPortInitialization', data: {httpPort: 1234}},
        httpPortMessage = JSON.stringify(httpPort);

      backend.onMessage(httpPortMessage);

      should(spyConsoleLog.calledOnce).be.true();
      should(spyConsoleLog.calledWith(`Backend HTTP port of ${dummyAddress} received : 1234`)).be.true();
      should(backend.httpPort).be.eql(1234);
    });

    it('message room httpPortInitialization must set the httpPort and call callback if set and unset it', () => {
      var
        backend = initBackend(dummyContext),
        httpPort = {room: 'httpPortInitialization', data: {httpPort: 1234}},
        httpPortMessage = JSON.stringify(httpPort),
        httpPortCallback = sandbox.spy();

      backend.httpPortCallback = httpPortCallback;

      backend.onMessage(httpPortMessage);

      should(spyConsoleLog.calledOnce).be.true();
      should(spyConsoleLog.calledWith(`Backend HTTP port of ${dummyAddress} received : 1234`)).be.true();
      should(backend.httpPort).be.eql(1234);
      should(backend.httpPortCallback).be.eql(null);
      should(httpPortCallback.calledOnce).be.true();
    });

    it('unexpected message room should write a message in console error', () => {
      var
        backend = initBackend(dummyContext),
        unexpected = {room: 'unexpected'},
        unexpectedMessage = JSON.stringify(unexpected);

      backend.onMessage(unexpectedMessage);

      should(spyConsoleError.calledWith('Unknown message type unexpected')).be.true();
    });
  });

  it('method onConnectionClose', () => {
    var
      backend = initBackend(dummyContext),
      getAllStub,
      removeBackendStub,
      removeRequestStub,
      spyPromiseReject = sandbox.spy();

    getAllStub = sandbox
      .stub(backend.backendRequestStore, 'getAll')
      .returns({aRequestId: {promise: {reject: spyPromiseReject}}, anotherRequestId: {promise: {reject: spyPromiseReject}}});

    removeBackendStub = sandbox.stub(backend.context.backendHandler, 'removeBackend');
    removeRequestStub = sandbox.stub(backend.backendRequestStore, 'removeByRequestId');

    backend.onConnectionClose();

    should(spyConsoleLog.calledOnce).be.true();
    should(spyConsoleLog.calledWith(`Connection with backend ${dummyAddress} closed.`)).be.true();
    should(spySocketClose.calledOnce).be.true();
    should(getAllStub.calledOnce).be.true();
    should(removeBackendStub.calledOnce).be.true();
    should(removeBackendStub.calledWith(backend)).be.true();
    should(spyPromiseReject.calledTwice).be.true();
    should(removeRequestStub.calledTwice).be.true();
    should(removeRequestStub.calledWith('aRequestId')).be.true();
    should(removeRequestStub.calledWith('anotherRequestId')).be.true();
  });

  it('method onConnectionError', () => {
    var
      backend = initBackend(dummyContext),
      getAllStub,
      removeBackendStub,
      removeRequestStub,
      spyPromiseReject = sandbox.spy(),
      error = new Error('an Error');

    getAllStub = sandbox
      .stub(backend.backendRequestStore, 'getAll')
      .returns({aRequestId: {promise: {reject: spyPromiseReject}}, anotherRequestId: {promise: {reject: spyPromiseReject}}});

    removeBackendStub = sandbox.stub(backend.context.backendHandler, 'removeBackend');
    removeRequestStub = sandbox.stub(backend.backendRequestStore, 'removeByRequestId');

    backend.onConnectionError(error);

    should(spyConsoleError.calledOnce).be.true();
    should(spyConsoleError.calledWith(`Connection with backend ${dummyAddress} was in error; Reason :`, error)).be.true();
    should(getAllStub.calledOnce).be.true();
    should(removeBackendStub.calledOnce).be.true();
    should(removeBackendStub.calledWith(backend)).be.true();
    should(spyPromiseReject.calledTwice).be.true();
    should(removeRequestStub.calledTwice).be.true();
    should(removeRequestStub.calledWith('aRequestId')).be.true();
    should(removeRequestStub.calledWith('anotherRequestId')).be.true();
  });


  it('method send', () => {
    var
      backend = initBackend(dummyContext),
      addStub,
      pendingItem = {message: 'a message'};

    addStub = sandbox.stub(backend.backendRequestStore, 'add');
    backend.socket.send = sandbox.spy();

    backend.send(pendingItem);

    should(addStub.calledOnce).be.true();
    should(addStub.calledWith(pendingItem)).be.true();
    should(backend.socket.send.calledOnce).be.true();
    should(backend.socket.send.calledWith(JSON.stringify(pendingItem.message))).be.true();
  });

  it('method sendRaw', () => {
    var backend = initBackend(dummyContext);
    backend.socket = {send: () => {}};

    backend.sendRaw('a message');

    console.log(spyPromisify.args);
    should(spyPromisify.calledOnce).be.true();
    should(spyPromisify.firstCall.args[0]).be.Function();
  });

  function initBackend (context) {
    var dummySocket = new EventEmitter();

    dummySocket.close = spySocketClose;
    dummySocket.upgradeReq = {connection: {remoteAddress: dummyAddress}};

    return new Backend(dummySocket, context, dummyTimeout);
  }
});
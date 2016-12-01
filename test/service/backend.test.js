var
  should = require('should'),
  EventEmitter = require('events'),
  rewire = require('rewire'),
  Backend = rewire('../../lib/service/Backend'),
  sinon = require('sinon'),
  PendingRequest = require.main.require('lib/store/PendingRequest'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

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
    spySocketClose;

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
    spySocketClose = sandbox.spy();
    spyConsoleError = sandbox.spy();
    spyConsoleLog = sandbox.spy();
    Backend.__set__('console', {log: spyConsoleLog, error: spyConsoleError});
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
    should(backend.onMessageRooms).be.an.Object();
  });

  describe('#onMessage', () => {
    it('must write a console error if the message contains no room', () => {
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
        badMessage = 'unexpected';

      backend.onMessage(badMessage);

      should(spyConsoleError)
        .be.calledOnce()
        .be.calledWith('Bad message received from the backend : unexpected; Reason : SyntaxError: Unexpected token u');
    });

    it('message room "response" must call the promise resolution if message is ok', () => {
      var
        backend = initBackend(dummyContext),
        goodResponse = {room: 'response', data: {requestId: 'aRequestId', foo: 'aResponse'}},
        goodResponseMessage = JSON.stringify(goodResponse),
        resolveStub = sandbox.stub(backend.backendRequestStore, 'resolve');

      backend.onMessage(goodResponseMessage);

      should(resolveStub.calledOnce).be.true();
      should(resolveStub.calledWith('aRequestId', null, goodResponse.data)).be.true();
    });

    it('message room "httpResponse" must call the promise resolution if message is ok', () => {
      var
        backend = initBackend(dummyContext),
        goodResponse = {
          room: 'httpResponse',
          data: {
            requestId: 'aRequestId',
            response: 'aResponse',
            type: 'aType',
            status: 'httpStatus'
          }
        },
        goodResponseMessage = JSON.stringify(goodResponse),
        resolveStub = sandbox.stub(backend.backendRequestStore, 'resolve');

      backend.onMessage(goodResponseMessage);

      should(resolveStub.calledOnce).be.true();
      should(resolveStub.calledWithMatch('aRequestId', null, goodResponse.data)).be.true();
    });

    it('message room "joinChannel" must call joinChannel if everything is ok', () => {
      var
        backend = initBackend(dummyContext),
        join = {room: 'joinChannel', data: {connectionId: 'anId', some: 'data'}},
        joinMessage = JSON.stringify(join),
        connectionGetStub,
        pluginGetStub,
        joinChannelSpy;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({protocol: 'aType'});

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
        join = {room: 'joinChannel', data: {connectionId: 'anId', some: 'data'}},
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

    it('message room "joinChannel" should recover from a plugin crash', () => {
      var
        backend = initBackend(dummyContext),
        join = {room: 'joinChannel', data: {connectionId: 'anId', some: 'data'}},
        joinMessage = JSON.stringify(join),
        connectionGetStub,
        pluginGetStub,
        joinChannelStub;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({protocol: 'aType'});

      joinChannelStub = sandbox.stub();
      joinChannelStub.throws(new Error('OH NOES!!1!'));

      pluginGetStub = sandbox
        .stub(backend.context.pluginStore, 'getByProtocol')
        .returns({joinChannel: joinChannelStub});

      should.doesNotThrow(() => { backend.onMessage(joinMessage); });

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.calledOnce).be.true();
      should(pluginGetStub.calledWith('aType')).be.true();
      should(joinChannelStub.calledOnce).be.true();
      should(joinChannelStub.calledWith(join.data)).be.true();
    });

    it('message room "leaveChannel" must call leaveChannel if everything is ok', () => {
      var
        backend = initBackend(dummyContext),
        leave = {room: 'leaveChannel', data: {connectionId: 'anId', some: 'data'}},
        leaveMessage = JSON.stringify(leave),
        connectionGetStub,
        pluginGetStub,
        leaveChannelSpy;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({protocol: 'aType'});

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
        leave = {room: 'leaveChannel', data: {connectionId: 'anId', some: 'data'}},
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

    it('message room "leaveChannel" should recover from a plugin crash', () => {
      var
        backend = initBackend(dummyContext),
        leave = {room: 'leaveChannel', data: {connectionId: 'anId', some: 'data'}},
        leaveMessage = JSON.stringify(leave),
        connectionGetStub,
        pluginGetStub,
        leaveChannelStub;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({protocol: 'aType'});

      leaveChannelStub = sandbox.stub();
      leaveChannelStub.throws(new Error('OH NOES!!1!'));

      pluginGetStub = sandbox
        .stub(backend.context.pluginStore, 'getByProtocol')
        .returns({leaveChannel: leaveChannelStub});

      should.doesNotThrow(() => { backend.onMessage(leaveMessage); });

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.calledOnce).be.true();
      should(pluginGetStub.calledWith('aType')).be.true();
      should(leaveChannelStub.calledOnce).be.true();
      should(leaveChannelStub.calledWith(leave.data)).be.true();
    });

    it('message room "notify" must call notify if everything is ok', () => {
      var
        backend = initBackend(dummyContext),
        notify = {room: 'notify', data: {connectionId: 'anId', some: 'data'}},
        notifyMessage = JSON.stringify(notify),
        connectionGetStub,
        pluginGetStub,
        notifySpy;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({protocol: 'aType'});

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
        notify = {room: 'notify', data: {connectionId: 'anId', some: 'data'}},
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

    it('message room "notify" must recover from a plugin crash', () => {
      var
        backend = initBackend(dummyContext),
        notify = {room: 'notify', data: {connectionId: 'anId', some: 'data'}},
        notifyMessage = JSON.stringify(notify),
        connectionGetStub,
        pluginGetStub,
        notifyStub;

      connectionGetStub = sandbox
        .stub(backend.context.clientConnectionStore, 'getByConnectionId')
        .returns({protocol: 'aType'});

      notifyStub = sandbox.stub();
      notifyStub.throws(new Error('OH NOES!!1!'));

      pluginGetStub = sandbox
        .stub(backend.context.pluginStore, 'getByProtocol')
        .returns({notify: notifyStub});

      should.doesNotThrow(() => { backend.onMessage(notifyMessage); });

      should(connectionGetStub.calledOnce).be.true();
      should(connectionGetStub.calledWith('anId')).be.true();
      should(pluginGetStub.calledOnce).be.true();
      should(pluginGetStub.calledWith('aType')).be.true();
      should(notifyStub.calledOnce).be.true();
      should(notifyStub.calledWith(notify.data)).be.true();
    });

    it('message room "broadcast" must broadcast message to all plugins', () => {
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

    it('message room "broadcast" must recover from a plugin crash', () => {
      var
        stubPluginBroadcast = sandbox.stub(),
        pluginContext = {pluginStore: {plugins: {aPlugin: {broadcast: stubPluginBroadcast}}}},
        backend = initBackend(pluginContext),
        broadcast = {room: 'broadcast', data: {some: 'data'}},
        broadcastMessage = JSON.stringify(broadcast);

      stubPluginBroadcast.throws(new Error('OH NOES!!1!'));

      should.doesNotThrow(() => {backend.onMessage(broadcastMessage); });

      should(stubPluginBroadcast.calledOnce).be.true();
      should(stubPluginBroadcast.calledWith(broadcast.data)).be.true();
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

  it('#onConnectionClose', () => {
    var
      backend = initBackend(dummyContext),
      abortAllStub = sandbox.stub(backend.backendRequestStore, 'abortAll'),
      removeBackendStub = sandbox.stub(backend.context.backendHandler, 'removeBackend');

    backend.onConnectionClose();

    should(spyConsoleLog.calledOnce).be.true();
    should(spyConsoleLog.calledWith(`Connection with backend ${dummyAddress} closed.`)).be.true();
    should(spySocketClose.calledOnce).be.true();
    should(abortAllStub.calledOnce).be.true();
    should(abortAllStub.calledWithMatch(InternalError));
    should(removeBackendStub.calledOnce).be.true();
    should(removeBackendStub.calledWith(backend)).be.true();
  });

  it('#onConnectionError', () => {
    var
      backend = initBackend(dummyContext),
      abortAllStub = sandbox.stub(backend.backendRequestStore, 'abortAll'),
      removeBackendStub,
      error = new Error('an Error');

    removeBackendStub = sandbox.stub(backend.context.backendHandler, 'removeBackend');

    backend.onConnectionError(error);

    should(spyConsoleError.calledOnce).be.true();
    should(spyConsoleError.calledWith(`Connection error with backend ${dummyAddress}; Reason :`, error)).be.true();
    should(abortAllStub.calledOnce).be.true();
    should(abortAllStub.calledWithMatch(InternalError));
    should(removeBackendStub.calledOnce).be.true();
    should(removeBackendStub.calledWith(backend)).be.true();
  });


  it('#send', () => {
    var
      backend = initBackend(dummyContext),
      addStub = sandbox.stub(backend.backendRequestStore, 'add'),
      data = {message: 'a message'},
      cb = function () {},
      room = 'room';

    backend.socket.send = sandbox.stub();

    backend.send(room, data, cb);

    should(addStub.calledOnce).be.true();
    should(addStub.calledWith(data, cb)).be.true();
    should(backend.socket.send.calledOnce).be.true();
    should(backend.socket.send.calledWith(JSON.stringify({room, data}))).be.true();
  });

  function initBackend (context) {
    var dummySocket = new EventEmitter();

    dummySocket.close = spySocketClose;
    dummySocket.upgradeReq = {connection: {remoteAddress: dummyAddress}};

    return new Backend(dummySocket, context, dummyTimeout);
  }

  it('#sendRaw', () => {
    var
      backend = initBackend(dummyContext),
      cb = () => {},
      message = 'foobar';

    backend.socket.send = sandbox.spy();

    backend.sendRaw(message, cb);

    should(backend.socket.send.calledOnce).be.true();
    should(backend.socket.send.calledWith(message, cb));
  });
});

'use strict';

const
  proxyquire = require('proxyquire'),
  should = require('should'),
  sinon = require('sinon'),
  EventEmitter = require('events'),
  fakeRequest = {id: 'requestId', aRequest: 'Object'},
  requestStub = sinon.stub().returns({id: 'requestId', aRequest: 'Object'}),
  clientConnectionStub = function(protocol, ips, headers) {
    return {protocol: protocol, id: 'connectionId', headers: headers};
  },
  SocketIoProxy = proxyquire('../../lib/service/SocketIoProxy', {
    '../core/clientConnection': clientConnectionStub,
    'kuzzle-common-objects': {Request: requestStub},
    'socket.io': () => {
      const emitter = new EventEmitter();

      emitter.id = 'connectionId';
      emitter.set = () => {};
      emitter.to = sinon.stub().returns({
        emit: sinon.spy()
      });

      emitter.sockets = { connected: {} };
      emitter.sockets.connected.connectionId = {
        join: sinon.spy(),
        leave: sinon.spy(),
        emit: sinon.spy()
      };

      return emitter;
    }
  });

describe('/service/socketIoProxy', function () {
  let
    proxy,
    socketIoProxy,
    onClientSpy = sinon.stub(),
    clientSocketMock = {
      id: 'socketId',
      on: onClientSpy,
      close: sinon.stub(),
      emit: sinon.stub(),
      join: sinon.stub(),
      leave: sinon.stub(),
      handshake: {
        address: 'ip',
        headers: {
          'X-Foo': 'bar',
          'x-forwarded-for': '1.1.1.1,2.2.2.2'
        }
      }
    };

  beforeEach(() => {
    proxy = {
      broker: {
        brokerCallback: sinon.spy()
      },
      clientConnectionStore: {
        add: sinon.spy(),
        remove: sinon.spy()
      },
      httpProxy: {
        server: {
          once: sinon.spy(),
          on: sinon.spy(),
          listen: sinon.spy()
        }
      },
      protocolStore: {
        get: sinon.stub().returns({
          joinChannel: sinon.spy(),
          leaveChannel: sinon.spy(),
          notify: sinon.spy()
        }),
        add: sinon.spy()
      },
      router: {
        newConnection: sinon.spy(),
        removeConnection: sinon.stub().returns(Promise.resolve({a: 'connection'})),
        execute: sinon.stub().yields({requestId: 'foo', content: {requestId: 'foo'}})
      },
      config: {},
      log: {
        error: sinon.spy()
      },
      logAccess: sinon.spy()
    };

    socketIoProxy = new SocketIoProxy();
  });

  afterEach(() => {
    requestStub.reset();
    onClientSpy.reset();
    clientSocketMock.close.reset();
  });

  describe('#init', function () {
    it('should setup a socketIo server and add it into the protocol Store', function () {
      let ret = socketIoProxy.init(proxy);

      should(ret).be.eql(socketIoProxy);
      should(ret.io).be.an.instanceOf(EventEmitter);
      should(proxy.protocolStore.add).be.calledOnce();
      should(proxy.protocolStore.add).be.calledWith('socketio', socketIoProxy);
    });
  });

  describe('#onConnection', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
    });

    it('should bind proper listeners', () => {
      let
        clientDisconnectionStub = sinon.stub(socketIoProxy, 'onClientDisconnection'),
        clientMessageStub = sinon.stub(socketIoProxy, 'onClientMessage');

      socketIoProxy.onConnection(clientSocketMock);

      should(onClientSpy.callCount).be.eql(3);
      should(onClientSpy.firstCall.args[0]).be.eql('disconnect');
      should(onClientSpy.firstCall.args[1]).be.Function();
      should(onClientSpy.secondCall.args[0]).be.eql('error');
      should(onClientSpy.secondCall.args[1]).be.Function();
      should(onClientSpy.thirdCall.args[0]).be.eql('kuzzle');
      should(onClientSpy.thirdCall.args[1]).be.Function();

      should(clientDisconnectionStub.callCount).be.eql(0);
      should(clientMessageStub.callCount).be.eql(0);
      onClientSpy.firstCall.args[1]();
      should(clientDisconnectionStub.callCount).be.eql(1);
      should(clientMessageStub.callCount).be.eql(0);
      onClientSpy.secondCall.args[1]();
      should(clientDisconnectionStub.callCount).be.eql(2);
      should(clientMessageStub.callCount).be.eql(0);
      onClientSpy.thirdCall.args[1]();
      should(clientDisconnectionStub.callCount).be.eql(2);
      should(clientMessageStub.callCount).be.eql(1);

      clientDisconnectionStub.reset();
      clientMessageStub.reset();
      should(Object.keys(socketIoProxy.sockets).length).be.eql(1);
      should(socketIoProxy.sockets.connectionId)
        .match(clientSocketMock);

      should(Object.keys(socketIoProxy.socketIdToConnectionId).length).be.eql(1);
      should(socketIoProxy.socketIdToConnectionId.socketId).be.eql('connectionId');
    });

    it('should reject and close the socket if creating a connection fails', () => {
      const
        error = new Error('test');

      proxy.router.newConnection = sinon.stub().throws(error);

      socketIoProxy.onConnection(clientSocketMock);

      should(proxy.log.error)
        .be.calledWith('[socketio] Unable to register connection to the proxy\n%s', error.stack);

      should(onClientSpy.callCount).be.eql(0);
      should(clientSocketMock.close.called).be.true();

    });
  });

  describe('#broadcast', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
    });

    it('should broadcast a message correctly', function () {
      const
        channel = 'foobar',
        payload = {foo: 'bar'};

      socketIoProxy.broadcast({channels: [channel],payload});

      should(socketIoProxy.io.to)
        .be.calledOnce()
        .be.calledWith(channel);

      should(socketIoProxy.io.to.firstCall.returnValue.emit)
        .be.calledOnce()
        .be.calledWith(channel, payload);
    });
  });

  describe('#notify', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
    });

    it('should notify a client correctly', function () {
      const payload = {foo: 'bar'};

      socketIoProxy.sockets.connectionId = clientSocketMock;

      socketIoProxy.notify({
        connectionId: 'connectionId',
        channels: ['foobar'],
        payload
      });

      should(clientSocketMock.emit)
        .be.calledOnce()
        .be.calledWith('foobar', payload);
    });
  });

  describe('#joinChannel', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
      socketIoProxy.sockets.connectionId = clientSocketMock;
      clientSocketMock.join.reset();
    });

    it('should link an id with a channel', function () {
      socketIoProxy.joinChannel({connectionId: 'connectionId', channel: 'foo'});
      should(clientSocketMock.join)
        .be.calledOnce()
        .be.calledWith('foo');
    });

    it('should do nothing if the id is unknown', function () {
      socketIoProxy.joinChannel({connectionId: 'some other id', channel: 'foo'});
      should(clientSocketMock.join).have.callCount(0);
    });
  });

  describe('#leaveChannel', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
      socketIoProxy.sockets.connectionId = clientSocketMock;
    });

    it('should do nothing if id does not exist', function () {
      socketIoProxy.leaveChannel({connectionId: 'some other id', channel: 'foo'});
      should(clientSocketMock.leave).have.callCount(0);
    });

    it('should remove id from channel if conditions are met', function () {
      socketIoProxy.leaveChannel({connectionId: 'connectionId', channel: 'foo'});

      should(clientSocketMock.leave)
        .be.calledOnce()
        .be.calledWith('foo');
    });
  });

  describe('#onMessage', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
      socketIoProxy.sockets.connectionId = clientSocketMock;
      socketIoProxy.socketIdToConnectionId.socketId = 'connectionId';
      proxy.router.execute.reset();
    });

    it('should do nothing if the data is undefined', function () {
      socketIoProxy.onClientMessage('socketId', undefined);
      should(proxy.router.execute.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      socketIoProxy.onClientMessage('badSocketId', JSON.stringify('aPayload'));
      should(proxy.router.execute.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should execute the request if client and packet are ok', function () {
      socketIoProxy.onClientMessage('socketId', 'aPayload');

      should(requestStub)
        .be.calledOnce()
        .be.calledWith('aPayload', {
          connectionId: 'connectionId',
          protocol: 'socketio'
        });

      should(proxy.router.execute)
        .be.calledOnce()
        .be.calledWith(fakeRequest);

      should(socketIoProxy.io.to)
        .be.calledOnce()
        .be.calledWith(clientSocketMock.id);
      should(socketIoProxy.io.to.firstCall.returnValue.emit)
        .be.calledOnce()
        .be.calledWith('requestId', {requestId: 'foo'});
    });
  });

  describe('#onServerError', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
    });

    it('should log the error', () => {
      const error = new Error('test');

      socketIoProxy.onServerError(error);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[socketio] An error has occured:\n' + error.stack);
    });
  });

  describe('#onClientDisconnection', function () {
    beforeEach(() => {
      socketIoProxy.init(proxy);
      socketIoProxy.sockets.connectionId = clientSocketMock;
      socketIoProxy.socketIdToConnectionId.socketId = 'connectionId';
      proxy.router.removeConnection.reset();
    });

    it('should do nothing if the client is unknown', function () {
      socketIoProxy.onClientDisconnection('badSocketId');
      should(proxy.router.removeConnection.callCount).be.eql(0);
      should(socketIoProxy.sockets.connectionId).be.eql(clientSocketMock);
      should(socketIoProxy.socketIdToConnectionId.socketId).be.eql('connectionId');
    });

    it('should remove the client connection if it exists', function () {
      socketIoProxy.onClientDisconnection('socketId');
      should(proxy.router.removeConnection.callCount).be.eql(1);
      should(socketIoProxy.sockets.connectionId).be.undefined();
      should(socketIoProxy.socketIdToConnectionId.socketId).be.undefined();
    });
  });

  describe('#disconnect', () => {
    beforeEach(() => {
      socketIoProxy.init(proxy);
    });

    it('should close the client socket', () => {
      socketIoProxy.sockets.connectionId = {
        disconnect: sinon.spy()
      };

      socketIoProxy.disconnect('connectionId');

      should(socketIoProxy.sockets.connectionId.disconnect)
        .be.calledOnce();
    });

  });
});

'use strict';

const
  proxyquire = require('proxyquire'),
  should = require('should'),
  sinon = require('sinon'),
  EventEmitter = require('events');

describe('/service/protocol/SocketIo', function () {
  const
    connection = {id: 'connectionId', protocol: 'socketio', headers: {foo: 'bar'}},
    emitStub = sinon.stub(),
    clientConnectionStub = function() {
      return connection;
    },
    SocketIo = proxyquire('../../../lib/service/protocol/SocketIo', {
      '../../core/clientConnection': clientConnectionStub,
      'socket.io': () => {
        const emitter = new EventEmitter();

        emitter.id = 'connectionId';
        emitter.set = () => {};
        emitter.to = sinon.stub().returns({
          emit: emitStub
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
  let
    proxy,
    io,
    onClientSpy = sinon.stub(),
    clientSocketMock = {
      id: 'socketId',
      on: onClientSpy,
      disconnect: sinon.stub(),
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
        maxRequestSize: '1MB',
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
        removeConnection: sinon.stub().resolves({a: 'connection'}),
        execute: sinon.stub().yields({requestId: 'foo', content: {requestId: 'foo'}})
      },
      config: {
        socketio: {
          enabled: true
        }
      },
      log: {
        error: sinon.spy(),
        warn: sinon.spy()
      },
      logAccess: sinon.spy()
    };

    io = new SocketIo();
  });

  afterEach(() => {
    onClientSpy.resetHistory();
    clientSocketMock.emit.resetHistory();
    clientSocketMock.disconnect.resetHistory();
  });

  describe('#init', function () {
    it('should setup a socketIo server and add it into the protocol Store', function () {
      io.init(proxy);

      should(proxy.protocolStore.add).be.calledOnce();
      should(proxy.protocolStore.add).be.calledWith('socketio', io);
    });
  });

  describe('#onConnection', function () {
    beforeEach(() => {
      io.init(proxy);
    });

    it('should bind proper listeners', () => {
      let
        clientDisconnectionStub = sinon.stub(io, 'onClientDisconnection'),
        clientMessageStub = sinon.stub(io, 'onClientMessage');

      io.onConnection(clientSocketMock);

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

      clientDisconnectionStub.resetHistory();
      clientMessageStub.resetHistory();
      should(Object.keys(io.sockets).length).be.eql(1);
      should(io.sockets.connectionId).match(clientSocketMock);
    });

    it('should reject and close the socket if creating a connection fails', () => {
      const
        error = new Error('test');

      proxy.router.newConnection = sinon.stub().throws(error);

      io.onConnection(clientSocketMock);

      should(onClientSpy.callCount).be.eql(0);

      should(clientSocketMock.disconnect)
        .be.calledOnce();
    });
  });

  describe('#broadcast', function () {
    beforeEach(() => {
      io.init(proxy);
    });

    it('should broadcast a message correctly', function () {
      const
        channel = 'foobar',
        payload = {foo: 'bar'};

      io.broadcast({channels: [channel],payload});

      should(io.io.to)
        .be.calledOnce()
        .be.calledWith(channel);

      should(io.io.to.firstCall.returnValue.emit)
        .be.calledOnce()
        .be.calledWith(channel, payload);
    });
  });

  describe('#notify', function () {
    beforeEach(() => {
      io.init(proxy);
    });

    it('should notify a client correctly', function () {
      const payload = {foo: 'bar'};

      io.sockets.connectionId = clientSocketMock;

      io.notify({
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
      io.init(proxy);
      io.sockets.connectionId = clientSocketMock;
      clientSocketMock.join.resetHistory();
    });

    it('should link an id with a channel', function () {
      io.joinChannel({connectionId: 'connectionId', channel: 'foo'});
      should(clientSocketMock.join)
        .be.calledOnce()
        .be.calledWith('foo');
    });

    it('should do nothing if the id is unknown', function () {
      io.joinChannel({connectionId: 'some other id', channel: 'foo'});
      should(clientSocketMock.join).have.callCount(0);
    });
  });

  describe('#leaveChannel', function () {
    beforeEach(() => {
      io.init(proxy);
      io.sockets.connectionId = clientSocketMock;
    });

    it('should do nothing if id does not exist', function () {
      io.leaveChannel({connectionId: 'some other id', channel: 'foo'});
      should(clientSocketMock.leave).have.callCount(0);
    });

    it('should remove id from channel if conditions are met', function () {
      io.leaveChannel({connectionId: 'connectionId', channel: 'foo'});

      should(clientSocketMock.leave)
        .be.calledOnce()
        .be.calledWith('foo');
    });
  });

  describe('#onMessage', function () {
    const badConnection = {id: 'badConnectionId'};

    beforeEach(() => {
      io.init(proxy);
      io.sockets.connectionId = clientSocketMock;
      emitStub.resetHistory();
    });

    it('should do nothing if the data is undefined', function () {
      io.onClientMessage(clientSocketMock, connection, undefined);
      should(proxy.router.execute.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      io.onClientMessage(clientSocketMock, badConnection, 'aPayload');
      should(proxy.router.execute.callCount).be.eql(0);
    });

    it('should reply with error if the actual data sent exceeds the maxRequestSize', () => {
      proxy.httpProxy.maxRequestSize = 2;

      io.onClientMessage(clientSocketMock, connection, {requestId: 1234, payload: 'aPayload'});

      should(io.io.to)
        .be.calledOnce()
        .be.calledWith(clientSocketMock.id);
      should(io.io.to.firstCall.returnValue.emit)
        .be.calledOnce()
        .be.calledWithMatch(1234, {status: 413});
    });

    it('should execute the request if client and packet are ok', function () {
      const payload = {aRequest: 'Object'};
      io.onClientMessage(clientSocketMock, connection, payload);

      should(proxy.router.execute)
        .be.calledOnce()
        .be.calledWith(payload, connection);

      should(io.io.to)
        .be.calledOnce()
        .be.calledWith(clientSocketMock.id);

      should(io.io.to.firstCall.returnValue.emit)
        .be.calledOnce()
        .be.calledWith('foo', {requestId: 'foo'});
    });

    it('should forward an error message to the client if a request cannot be instantiated', () => {
      proxy.router.execute = sinon.stub().throws({message: 'error'});
      io.onClientMessage(clientSocketMock, connection, {requestId: 'foobar', index: 'foo', controller: 'bar', body: ['this causes an error']});
      should(proxy.router.execute).be.calledOnce();
      should(emitStub).be.calledOnce();
      should(emitStub.firstCall.args[1]).match({
        status: 400,
        error: {
          message: 'error'
        }
      });
    });
  });

  describe('#onServerError', function () {
    beforeEach(() => {
      io.init(proxy);
    });

    it('should log the error', () => {
      const error = new Error('test');

      io.onServerError(error);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[socketio] An error has occured:\n' + error.stack);
    });
  });

  describe('#onClientDisconnection', function () {
    beforeEach(() => {
      io.init(proxy);
      io.sockets.connectionId = clientSocketMock;
      proxy.router.removeConnection.reset();
    });

    it('should do nothing if the client is unknown', function () {
      io.onClientDisconnection('badConnectionId');
      should(proxy.router.removeConnection.callCount).be.eql(0);
      should(io.sockets.connectionId).be.eql(clientSocketMock);
    });

    it('should remove the client connection if it exists', function () {
      io.onClientDisconnection('connectionId');
      should(proxy.router.removeConnection.callCount).be.eql(1);
      should(io.sockets.connectionId).be.undefined();
    });
  });

  describe('#disconnect', () => {
    beforeEach(() => {
      io.init(proxy);
    });

    it('should send close notification to client and close his socket', () => {
      io.sockets.connectionId = {
        disconnect: sinon.spy()
      };

      io.disconnect('connectionId', 'nope');

      should(io.sockets.connectionId.disconnect)
        .be.calledOnce();
    });

  });
});

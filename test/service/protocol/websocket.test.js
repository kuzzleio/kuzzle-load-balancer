'use strict';

const
  proxyquire = require('proxyquire'),
  should = require('should'),
  sinon = require('sinon'),
  fakeRequest = {aRequest: 'Object', input: {headers: {foo: 'bar'}}},
  requestStub = sinon.stub().returns({aRequest: 'Object', input: {}}),
  clientConnectionStub = function(protocol, ips, headers) {
    return {protocol: protocol, id: 'id', headers: headers};
  },
  Websocket = proxyquire('../../../lib/service/protocol/Websocket', {
    '../../core/clientConnection': clientConnectionStub,
    'kuzzle-common-objects': {Request: requestStub}
  });

describe('/service/protocol/Websocket', function () {
  let
    proxy,
    ws,
    sendSpy = sinon.spy(),
    badId = 'aBadId',
    goodId = 'aGoodId',
    goodChannel = 'aGoodChannel',
    badChannel = 'aBadChannel';

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
        removeConnection: sinon.stub().returns(Promise.resolve({a: 'connection'})),
        execute: sinon.stub().yields({requestId: 'foo', content: {requestId: 'foo'}})
      },
      config: {
        websocket: {
          enabled: true
        }
      },
      log: {
        error: sinon.spy()
      },
      logAccess: sinon.spy()
    };

    ws = new Websocket();
  });

  afterEach(() => {
    sendSpy.reset();
    requestStub.reset();
  });

  describe('#init', function () {
    it('should setup a websocket server and add it into the protocol Store', function () {
      ws.init(proxy);

      should(proxy.protocolStore.add).be.calledOnce();
      should(proxy.protocolStore.add).be.calledWith('websocket', ws);
    });
  });

  describe('#onConnection', function () {
    let
      onClientSpy = sinon.stub(),
      clientSocketMock = {
        on: onClientSpy,
        close: sinon.stub(),
        upgradeReq: {
          connection: {
            remoteAddress: 'ip'
          },
          url: '/',
          headers: {
            'X-Foo': 'bar',
            'x-forwarded-for': '1.1.1.1,2.2.2.2'
          }
        }
      };

    beforeEach(() => {
      ws.init(proxy);
      onClientSpy.reset();
      clientSocketMock.close.reset();
    });

    it('should bind proper listeners', () => {
      let
        clientDisconnectionStub = sinon.stub(ws, 'onClientDisconnection'),
        clientMessageStub = sinon.stub(ws, 'onClientMessage');

      ws.onConnection(clientSocketMock);

      should(onClientSpy.callCount).be.eql(3);
      should(onClientSpy.firstCall.args[0]).be.eql('close');
      should(onClientSpy.firstCall.args[1]).be.Function();
      should(onClientSpy.secondCall.args[0]).be.eql('error');
      should(onClientSpy.secondCall.args[1]).be.Function();
      should(onClientSpy.thirdCall.args[0]).be.eql('message');
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
      should(Object.keys(ws.connectionPool).length).be.eql(1);

      should(ws.connectionPool.id)
        .match({
          alive: true,
          socket: clientSocketMock,
          channels: []
        });

    });

    it('should reject and close the socket if creating a connection fails', () => {
      const
        error = new Error('test');

      proxy.router.newConnection = sinon.stub().throws(error);

      ws.onConnection(clientSocketMock);

      should(onClientSpy.callCount).be.eql(0);
      should(clientSocketMock.close.called).be.true();
      should(clientSocketMock.close.calledWith(4503, 'foobar'));

    });

    it('should do nothing if message is for socket.io', () => {
      clientSocketMock.upgradeReq.url = '/socket.io/roomid';

      should(ws.onConnection(clientSocketMock))
        .be.false();

    });
  });

  describe('#broadcast', function () {
    beforeEach(() => {
      ws.init(proxy);
    });

    it('should do nothing if channel does not exist', function () {
      ws.broadcast({
        channels: [badChannel],
        payload: {}
      });
      should(sendSpy.callCount).be.eql(0);
    });


    it('should call send if all conditions are met', function () {
      ws.channels = {
        [goodChannel]: {
          [goodId]: true
        }
      };
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          }
        }
      };

      ws.broadcast({
        channels: [goodChannel],
        payload: {some: 'data'}
      });
      should(sendSpy.callCount).be.eql(1);
      should(sendSpy.firstCall.args[0]).be.eql(JSON.stringify({some: 'data', room: goodChannel}));
    });
  });

  describe('#notify', function () {
    beforeEach(() => {
      ws.init(proxy);
    });

    it('should do nothing if id does not exist', function () {
      ws.notify({
        id: badId,
        payload: {},
        channels: [goodChannel]
      });
      should(sendSpy.callCount).be.eql(0);
    });

    it('should call send if all conditions are met', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          }
        }
      };

      ws.notify({
        connectionId: goodId,
        channels: [goodChannel],
        payload: {some: 'data'}
      });
      should(sendSpy.callCount).be.eql(1);
      should(sendSpy.firstCall.args[0]).be.eql(JSON.stringify({some: 'data', room: goodChannel}));
    });
  });

  describe('#joinChannel', function () {
    beforeEach(() => {
      ws.init(proxy);
    });

    it('should do nothing if id does not exist', function () {
      ws.joinChannel({
        connectionId: badId
      });
      should(ws.channels).be.deepEqual({});
    });

    it('should add clientId to the channel if conditions are met', function () {
      ws.channels = {
        [goodChannel]: { count: 0 }
      };
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      ws.joinChannel({
        connectionId: goodId,
        channel: goodChannel
      });

      should(ws.channels).be.deepEqual({
        [goodChannel]: { [goodId]: true, count: 1 }
      });
    });

    it('should create the channel entry add clientId to the channel if conditions are met and channel did not exist before', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      ws.joinChannel({
        connectionId: goodId,
        channel: goodChannel
      });
      should(ws.channels).be.deepEqual({
        [goodChannel]: { [goodId]: true, count: 1 }
      });
    });
  });

  describe('#leaveChannel', function () {
    beforeEach(() => {
      ws.init(proxy);
    });

    it('should do nothing if id does not exist', function () {
      ws.leaveChannel({
        id: badId
      });
      should(ws.channels).be.deepEqual({});
    });

    it('should do nothing if channel does not exist', function () {
      ws.connectionPool = {
        [goodId]:  {
          alive: true
        }
      };
      ws.leaveChannel({
        connectionId: goodId
      });
      should(ws.channels).be.deepEqual({});
    });

    it('should do nothing if id is not in channel', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      ws.channels = {
        [goodChannel]: {[badId]: true }
      };
      ws.leaveChannel({
        connectionId: goodId,
        channel: goodChannel
      });
      should(ws.channels).be.deepEqual({
        [goodChannel]: {[badId]: true}
      });
    });

    it('should remove id from channel if conditions are met', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };
      ws.channels = {
        [goodChannel]: {[goodId]: true, [badId]: true, count: 2}
      };
      ws.leaveChannel({
        connectionId: goodId,
        channel: goodChannel
      });

      should(ws.channels).be.deepEqual({
        [goodChannel]: {[badId]: true, count: 1}
      });
      should(ws.connectionPool[goodId].channels.length).be.eql(0);
    });

    it('should remove id from channel if conditions are met and remove channel if it is empty', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      ws.channels = {
        [goodChannel]: {[goodId]: true}
      };
      ws.leaveChannel({
        connectionId: goodId,
        channel: goodChannel
      });
      should(ws.channels).be.deepEqual({});
    });
  });

  describe('#onMessage', function () {
    const
      goodConnection = {
        id: goodId,
        headers: {foo: 'bar'}
      },
      badConnection = {id: badId};

    beforeEach(() => {
      ws.init(proxy);
      proxy.router.execute.reset();
    });

    it('should do nothing if the data is undefined', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      ws.onClientMessage(badConnection, undefined);
      should(proxy.router.execute.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      ws.onClientMessage(badConnection, JSON.stringify('aPayload'));
      should(proxy.router.execute.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should reply with error if the actual data sent exceeds the maxRequestSize', () => {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          connection: goodConnection,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      proxy.httpProxy.maxRequestSize = 2;

      ws.onClientMessage(goodConnection, JSON.stringify('aPayload'));

      should(sendSpy)
        .be.calledOnce()
        .be.calledWithMatch('"status":413');
    });

    it('should execute the request if client and packet are ok', function () {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          connection: goodConnection,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      ws.onClientMessage(goodConnection, JSON.stringify('aPayload'));

      should(requestStub)
        .be.calledOnce()
        .be.calledWith('aPayload', {
          connectionId: 'aGoodId',
          protocol: 'websocket'
        });

      should(proxy.router.execute)
        .be.calledOnce()
        .be.calledWith(fakeRequest);

      should(sendSpy)
        .be.calledOnce()
        .be.calledWith(JSON.stringify({
          requestId: 'foo',
          room: 'foo'
        }));
    });

    it('should forward an exception to the client if the incoming message is not in JSON format', () => {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          connection: goodConnection,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      ws.onClientMessage(goodConnection, 'foobar');
      should(requestStub.called).be.false();
      should(proxy.router.execute.called).be.false();
      should(sendSpy).be.calledOnce();
      should(JSON.parse(sendSpy.firstCall.args[0]).status).be.equal(400);
    });

    it('should forward an error message to the client if a request cannot be instantiated', () => {
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          connection: goodConnection,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      requestStub.throws({message: 'error'});
      ws.onClientMessage(goodConnection, JSON.stringify({requestId: 'foobar', index: 'foo', controller: 'bar', body: ['this causes an error']}));
      should(requestStub.called).be.true();
      should(proxy.router.execute.called).be.false();
      should(sendSpy.calledOnce).be.true();
      should(JSON.parse(sendSpy.firstCall.args[0])).match({
        status: 400,
        error: {
          message: 'error'
        },
        room: 'foobar'
      });
    });
  });

  describe('#onServerError', function () {
    beforeEach(() => {
      ws.init(proxy);
    });

    it('should log the error', () => {
      const error = new Error('test');

      ws.onServerError(error);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[websocket] An error has occured:\n' + error.stack);
    });
  });

  describe('#onClientDisconnection', function () {
    beforeEach(() => {
      ws.init(proxy);
      proxy.router.removeConnection.reset();
    });

    it('should do nothing if the client is unknown', function () {
      ws.channels = {
        [goodChannel]: []
      };
      ws.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      ws.socketPool = {
        [goodId]: true
      };
      ws.onClientDisconnection(badId);
      should(proxy.router.removeConnection.callCount).be.eql(0);
      should(ws.connectionPool[goodId].alive).be.true();
      should(ws.socketPool[goodId]).be.true();
    });

    it('should remove the client connection if it exists', function () {
      ws.channels = {
        [goodChannel]: {[goodId]: true, 'foobar': true, count: 2}
      };
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };

      ws.onClientDisconnection(goodId);
      should(proxy.router.removeConnection.callCount).be.eql(1);
      should(ws.connectionPool).be.deepEqual({});
      should(ws.channels).be.deepEqual({[goodChannel]: {foobar: true, count: 1}});
    });

    it('should remove a channel entirely if the last connection leaves', function () {
      ws.channels = {
        [goodChannel]: {[goodId]: true}
      };
      ws.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };

      ws.onClientDisconnection(goodId);
      should(proxy.router.removeConnection.callCount).be.eql(1);
      should(ws.connectionPool).be.deepEqual({});
      should(ws.channels).be.deepEqual({});
    });
  });

  describe('#disconnect', () => {
    beforeEach(() => {
      ws.init(proxy);
    });

    it('should close the client connection', () => {
      ws.connectionPool.id = {
        socket: {
          close: sinon.spy()
        }
      };

      ws.disconnect('id', 'nope');

      should(ws.connectionPool.id.socket.close)
        .be.calledOnce()
        .be.calledWith(1011, 'nope');
    });

  });
});

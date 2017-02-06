'use strict';

const
  proxyquire = require('proxyquire'),
  should = require('should'),
  sinon = require('sinon'),
  WebSocketServer = require('ws').Server,
  fakeRequest = {aRequest: 'Object'},
  requestStub = sinon.stub().returns({aRequest: 'Object'}),
  clientConnectionStub = function(protocol, ips, headers) {
    return {protocol: protocol, id: 'id', headers: headers};
  },
  WsProxy = proxyquire('../../lib/service/WsProxy', {
    '../core/clientConnection': clientConnectionStub,
    'kuzzle-common-objects': {Request: requestStub}
  });

describe('/service/wsProxy', function () {
  let
    proxy,
    wsProxy,
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

    wsProxy = new WsProxy();
  });

  afterEach(() => {
    sendSpy.reset();
    requestStub.reset();
  });

  describe('#init', function () {
    it('should setup a websocket server and add it into the protocol Store', function () {
      let ret = wsProxy.init(proxy);

      should(ret).be.eql(wsProxy);
      should(ret.server).be.an.instanceOf(WebSocketServer);
      should(proxy.protocolStore.add).be.calledOnce();
      should(proxy.protocolStore.add).be.calledWith('websocket', wsProxy);
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
          headers: {
            'X-Foo': 'bar',
            'x-forwarded-for': '1.1.1.1,2.2.2.2'
          }
        }
      };

    beforeEach(() => {
      wsProxy.init(proxy);
      onClientSpy.reset();
      clientSocketMock.close.reset();
    });

    it('should bind proper listeners', () => {
      let
        clientDisconnectionStub = sinon.stub(wsProxy, 'onClientDisconnection'),
        clientMessageStub = sinon.stub(wsProxy, 'onClientMessage');

      wsProxy.onConnection(clientSocketMock);

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
      should(Object.keys(wsProxy.connectionPool).length).be.eql(1);

      should(wsProxy.connectionPool.id)
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

      wsProxy.onConnection(clientSocketMock);

      should(proxy.log.error)
        .be.calledWith('[websocket] Unable to register connection to the proxy\n%s', error.stack);

      should(onClientSpy.callCount).be.eql(0);
      should(clientSocketMock.close.called).be.true();
      should(clientSocketMock.close.calledWith(4503, 'foobar'));

    });
  });

  describe('#broadcast', function () {
    beforeEach(() => {
      wsProxy.init(proxy);
    });

    it('should do nothing if channel does not exist', function () {
      wsProxy.broadcast({
        channels: [badChannel],
        payload: {}
      });
      should(sendSpy.callCount).be.eql(0);
    });


    it('should call send if all conditions are met', function () {
      wsProxy.channels = {
        [goodChannel]: {
          [goodId]: true
        }
      };
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          }
        }
      };

      wsProxy.broadcast({
        channels: [goodChannel],
        payload: {some: 'data'}
      });
      should(sendSpy.callCount).be.eql(1);
      should(sendSpy.firstCall.args[0]).be.eql(JSON.stringify({some: 'data', room: goodChannel}));
    });
  });

  describe('#notify', function () {
    beforeEach(() => {
      wsProxy.init(proxy);
    });

    it('should do nothing if id does not exist', function () {
      wsProxy.notify({
        id: badId,
        payload: {},
        channels: [goodChannel]
      });
      should(sendSpy.callCount).be.eql(0);
    });

    it('should call send if all conditions are met', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          }
        }
      };

      wsProxy.notify({
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
      wsProxy.init(proxy);
    });

    it('should do nothing if id does not exist', function () {
      wsProxy.joinChannel({
        connectionId: badId
      });
      should(wsProxy.channels).be.deepEqual({});
    });

    it('should add clientId to the channel if conditions are met', function () {
      wsProxy.channels = {
        [goodChannel]: { count: 0 }
      };
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      wsProxy.joinChannel({
        connectionId: goodId,
        channel: goodChannel
      });

      should(wsProxy.channels).be.deepEqual({
        [goodChannel]: { [goodId]: true, count: 1 }
      });
    });

    it('should create the channel entry add clientId to the channel if conditions are met and channel did not exist before', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      wsProxy.joinChannel({
        connectionId: goodId,
        channel: goodChannel
      });
      should(wsProxy.channels).be.deepEqual({
        [goodChannel]: { [goodId]: true, count: 1 }
      });
    });
  });

  describe('#leaveChannel', function () {
    beforeEach(() => {
      wsProxy.init(proxy);
    });

    it('should do nothing if id does not exist', function () {
      wsProxy.leaveChannel({
        id: badId
      });
      should(wsProxy.channels).be.deepEqual({});
    });

    it('should do nothing if channel does not exist', function () {
      wsProxy.connectionPool = {
        [goodId]:  {
          alive: true
        }
      };
      wsProxy.leaveChannel({
        connectionId: goodId
      });
      should(wsProxy.channels).be.deepEqual({});
    });

    it('should do nothing if id is not in channel', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      wsProxy.channels = {
        [goodChannel]: {[badId]: true }
      };
      wsProxy.leaveChannel({
        connectionId: goodId,
        channel: goodChannel
      });
      should(wsProxy.channels).be.deepEqual({
        [goodChannel]: {[badId]: true}
      });
    });

    it('should remove id from channel if conditions are met', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };
      wsProxy.channels = {
        [goodChannel]: {[goodId]: true, [badId]: true, count: 2}
      };
      wsProxy.leaveChannel({
        connectionId: goodId,
        channel: goodChannel
      });

      should(wsProxy.channels).be.deepEqual({
        [goodChannel]: {[badId]: true, count: 1}
      });
      should(wsProxy.connectionPool[goodId].channels.length).be.eql(0);
    });

    it('should remove id from channel if conditions are met and remove channel if it is empty', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };
      wsProxy.channels = {
        [goodChannel]: {[goodId]: true}
      };
      wsProxy.leaveChannel({
        connectionId: goodId,
        channel: goodChannel
      });
      should(wsProxy.channels).be.deepEqual({});
    });
  });

  describe('#onMessage', function () {
    beforeEach(() => {
      wsProxy.init(proxy);
      proxy.router.execute.reset();
    });

    it('should do nothing if the data is undefined', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      wsProxy.onClientMessage(badId, undefined);
      should(proxy.router.execute.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      wsProxy.onClientMessage(badId, JSON.stringify('aPayload'));
      should(proxy.router.execute.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should execute the request if client and packet are ok', function () {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      wsProxy.onClientMessage(goodId, JSON.stringify('aPayload'));

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
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      wsProxy.onClientMessage(goodId, 'foobar');
      should(requestStub.called).be.false();
      should(proxy.router.execute.called).be.false();
      should(sendSpy).be.calledOnce();
      should(JSON.parse(sendSpy.firstCall.args[0]).status).be.equal(400);
    });

    it('should forward an error message to the client if a request cannot be instantiated', () => {
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: []
        }
      };

      requestStub.throws({message: 'error'});
      wsProxy.onClientMessage(goodId, JSON.stringify({requestId: 'foobar', index: 'foo', controller: 'bar', body: ['this causes an error']}));
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
      wsProxy.init(proxy);
    });

    it('should log the error', () => {
      const error = new Error('test');

      wsProxy.onServerError(error);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[websocket] An error has occured:\n' + error.stack);
    });
  });

  describe('#onClientDisconnection', function () {
    beforeEach(() => {
      wsProxy.init(proxy);
      proxy.router.removeConnection.reset();
    });

    it('should do nothing if the client is unknown', function () {
      wsProxy.channels = {
        [goodChannel]: []
      };
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true
        }
      };
      wsProxy.socketPool = {
        [goodId]: true
      };
      wsProxy.onClientDisconnection(badId);
      should(proxy.router.removeConnection.callCount).be.eql(0);
      should(wsProxy.connectionPool[goodId].alive).be.true();
      should(wsProxy.socketPool[goodId]).be.true();
    });

    it('should remove the client connection if it exists', function () {
      wsProxy.channels = {
        [goodChannel]: {[goodId]: true, 'foobar': true, count: 2}
      };
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };

      wsProxy.onClientDisconnection(goodId);
      should(proxy.router.removeConnection.callCount).be.eql(1);
      should(wsProxy.connectionPool).be.deepEqual({});
      should(wsProxy.channels).be.deepEqual({[goodChannel]: {foobar: true, count: 1}});
    });

    it('should remove a channel entirely if the last connection leaves', function () {
      wsProxy.channels = {
        [goodChannel]: {[goodId]: true}
      };
      wsProxy.connectionPool = {
        [goodId]: {
          alive: true,
          connection: 'aConnection',
          socket: {
            send: sendSpy
          },
          channels: [goodChannel]
        }
      };

      wsProxy.onClientDisconnection(goodId);
      should(proxy.router.removeConnection.callCount).be.eql(1);
      should(wsProxy.connectionPool).be.deepEqual({});
      should(wsProxy.channels).be.deepEqual({});
    });
  });

  describe('#disconnect', () => {
    beforeEach(() => {
      wsProxy.init(proxy);
    });

    it('should close the client connection', () => {
      wsProxy.connectionPool.id = {
        socket: {
          close: sinon.spy()
        }
      };

      wsProxy.disconnect('id');

      should(wsProxy.connectionPool.id.socket.close)
        .be.calledOnce()
        .be.calledWith('CLOSEDONREQUEST', 'Connection closed by remote host');
    });

  });
});

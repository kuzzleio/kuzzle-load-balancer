'use strict';

const
  should = require('should'),
  rewire = require('rewire'),
  Backend = rewire('../../lib/service/Backend'),
  sinon = require('sinon'),
  PendingRequest = require.main.require('lib/store/PendingRequest');

describe('service/Backend', () => {
  let
    backend,
    proxy,
    socket;

  beforeEach(() => {
    proxy = {
      backendHandler: {
        removeBackend: sinon.spy()
      },
      clientConnectionStore: {
        get: sinon.stub()
      },
      log: {
        error: sinon.spy(),
        warn: sinon.spy()
      },
      pluginStore: {
        getByProtocol: sinon.stub().returns({
          joinChannel: sinon.spy(),
          leaveChannel: sinon.spy(),
          notify: sinon.spy()
        })
      }
    };

    socket = {
      close: sinon.spy(),
      on: sinon.spy(),
      send: sinon.spy(),
      upgradeReq: {
        connection: {
          remoteAddress: 'ip'
        }
      }
    };

    backend = new Backend(socket, proxy, 'timeout');
  });

  afterEach(() => {
  });


  describe('#constructor', () => {
    it('should init the request queue and attach events', () => {
      should(backend.backendRequestStore)
        .be.an.instanceOf(PendingRequest);

      should(socket.on)
        .be.calledThrice()
        .be.calledWith('close')
        .be.calledWith('error')
        .be.calledWith('message');
    });
  });

  describe('#onMessage', () => {
    it('should log an error if the message cannot be parsed', () => {
      backend.onMessage('invalid json');

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWithMatch(/^Bad message received from the backend: invalid json/);
    });

    it('should log an error if no room is given', () => {
      backend.onMessage('{}');

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('Room is not specified in message: {}');
    });

    it('should log an error if the room is unknonwn', () => {
      backend.onMessage(JSON.stringify({
        room: 'idontexist'
      }));

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('Unknown message type idontexist');
    });

    it('should call the proper action', () => {
      backend.onMessageRooms.foo = sinon.spy();

      backend.onMessage(JSON.stringify({
        room: 'foo',
        data: 'bar'
      }));

      should(backend.onMessageRooms.foo)
        .be.calledOnce()
        .be.calledWith('bar');
    });
  });

  describe('#onConnectionClose', () => {
    it('should remove the backend and abort all pending requests', () => {
      backend.backendRequestStore.abortAll = sinon.spy();

      backend.onConnectionClose();

      should(proxy.backendHandler.removeBackend)
        .be.calledOnce()
        .be.calledWith(backend);

      should(backend.backendRequestStore.abortAll)
        .be.calledOnce();

      should(socket.close)
        .be.calledOnce();
    });
  });

  describe('#onConnectionError', () => {
    it('should remove the backend and abort all pending requests', () => {
      const error = new Error('test');

      backend.backendRequestStore.abortAll = sinon.spy();

      backend.onConnectionError(error);

      should(proxy.backendHandler.removeBackend)
        .be.calledOnce()
        .be.calledWith(backend);

      should(backend.backendRequestStore.abortAll)
        .be.calledOnce();
    });
  });

  describe('#send', () => {
    it('should register the cb and call the backend', () => {
      backend.backendRequestStore.add = sinon.spy();

      backend.send('room', 'id', 'data', 'callback');

      should(backend.backendRequestStore.add)
        .be.calledOnce()
        .be.calledWith('id', 'data', 'callback');

      should(socket.send)
        .be.calledOnce()
        .be.calledWith(JSON.stringify({room: 'room', data: 'data'}));
    });
  });

  describe('#sendRaw', () => {
    it('should forward the request to the backend socket', () => {
      backend.sendRaw('room', 'data', 'callback');

      should(socket.send)
        .be.calledOnce()
        .be.calledWith(JSON.stringify({room: 'room', data: 'data'}), 'callback');
    });
  });

  describe('#room actions', () => {
    beforeEach(() => {
      backend.backendRequestStore.resolve = sinon.spy();
    });

    it('#response', () => {
      const data = {
        requestId: 'requestId'
      };

      backend.onMessageRooms.response(data);
      should(backend.backendRequestStore.resolve)
        .be.calledOnce()
        .be.calledWith('requestId', null, data);
    });

    it('httpResponse', () => {
      const data = {
        requestId: 'requestId'
      };

      backend.onMessageRooms.httpResponse(data);

      should(backend.backendRequestStore.resolve)
        .be.calledOnce()
        .be.calledWith('requestId', null, data);
    });

    it('#joinChannel should handle errors', () => {
      const
        data = {
          connectionId: 'id'
        },
        error = new Error('test');

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });
      proxy.pluginStore.getByProtocol.returns({
        joinChannel: sinon.stub().throws(error)
      });

      backend.onMessageRooms.joinChannel(data);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[Join Channel] Plugin protocol failed: test');
    });

    it('#joinChannel', () => {
      const data = {
        connectionId: 'id'
      };

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });
      backend.onMessageRooms.joinChannel(data);

      should(proxy.pluginStore.getByProtocol)
        .be.calledOnce()
        .be.calledWith('protocol');

      should(proxy.pluginStore.getByProtocol.firstCall.returnValue.joinChannel)
        .be.calledOnce()
        .be.calledWith(data);

    });

    it('#leaveChannel should log errors', () => {
      const
        data = {
          connectionId: 'id'
        },
        error = new Error('test');

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });
      proxy.pluginStore.getByProtocol.throws(error);

      backend.onMessageRooms.leaveChannel(data);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[Leave Channel] Plugin undefined failed: test');
    });

    it('#leaveChannel', () => {
      const data = {
        connectionId: 'id'
      };

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });

      backend.onMessageRooms.leaveChannel(data);

      should(proxy.pluginStore.getByProtocol.firstCall.returnValue.leaveChannel)
        .be.calledOnce()
        .be.calledWith(data);
    });

    it('#notify should log errors', () => {
      const
        data = {
          connectionId: 'id'
        },
        error = new Error('test');

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });
      proxy.pluginStore.getByProtocol.throws(error);

      backend.onMessageRooms.notify(data);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[Notify] Plugin protocol failed: test\nNotification data:\n%s');
    });

    it('#notify', () => {
      const data = {
        connectionId: 'id'
      };

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });

      backend.onMessageRooms.notify(data);

      should(proxy.pluginStore.getByProtocol.firstCall.returnValue.notify)
        .be.calledOnce()
        .be.calledWith(data);
    });

    it('#broadcast should handle errors', () => {
      const
        data = {
          connectionId: 'id'
        },
        error = new Error('test');

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });
      proxy.pluginStore.plugins = {
        foo: {
          broadcast: sinon.spy()
        },
        bar: {
          broadcast: sinon.stub().throws(error)
        }
      };

      backend.onMessageRooms.broadcast(data);

      should(proxy.log.error)
        .be.calledOnce()
        .be.calledWith('[Broadcast] Plugin undefined failed: test\nNotification data:\n%s');
    });

    it('#broadcast', () => {
      const data = {
        connectionId: 'id'
      };

      proxy.clientConnectionStore.get.returns({
        protocol: 'protocol'
      });
      proxy.pluginStore.plugins = {
        foo: {
          broadcast: sinon.spy()
        },
        bar: {
          broadcast: sinon.spy()
        }
      };

      backend.onMessageRooms.broadcast(data);

      should(proxy.pluginStore.plugins.foo.broadcast)
        .be.calledOnce()
        .be.calledWith(data);
      should(proxy.pluginStore.plugins.bar.broadcast)
        .be.calledOnce()
        .be.calledWith(data);
    });
  });

});



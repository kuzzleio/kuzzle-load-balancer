'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Router = rewire('../../lib/service/Router'),
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

describe('#Test: service/Router', function () {
  let
    sandbox,
    proxy,
    router;

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
    proxy = {
      backendHandler: {
        getBackend: sinon.stub().returns({})
      },
      broker: {
        addClientConnection: sinon.spy(),
        brokerCallback: sinon.spy(),
        removeClientConnection: sinon.spy()
      },
      clientConnectionStore: {
        get: sinon.stub()
      }
    };

    router = new Router(proxy);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('method constructor initializes the object properly', () => {
      should(Router.__get__('_proxy'))
        .be.exactly(proxy);
    });
  });

  describe('#newConnection', () => {
    it('should throw if no backend is available', () => {
      proxy.backendHandler.getBackend.returns(undefined);

      return should(() => router.newConnection({}))
        .throw(ServiceUnavailableError, {message: 'No Kuzzle instance found'});
    });

    it('should add the connection to the backend', () => {
      router.newConnection('connection');

      should(proxy.broker.addClientConnection)
        .be.calledOnce()
        .be.calledWith('connection');
    });

  });

  describe('#execute', () => {
    let
      request;

    beforeEach(() => {
      request = {
        id: 'requestId',
        context: {
          connectionId: 'connectionId'
        },
        response: 'response',
        serialize: sinon.stub().returns('serializedRequest'),
        setError: sinon.spy()
      };
    });

    it('should call the broker callback with a cb that properly handles errors back from Kuzzle', () => {
      const
        cb = sinon.spy(),
        error = new Error('test');

      router.execute(request, cb);

      should(proxy.broker.brokerCallback)
        .be.calledOnce()
        .be.calledWith('request', request.id, request.context.connectionId, 'serializedRequest');

      const brokerCb = proxy.broker.brokerCallback.firstCall.args[4];

      brokerCb(error);

      should(request.setError)
        .be.calledOnce()
        .be.calledWith(error);

      should(cb)
        .be.calledOnce()
        .be.calledWith('response');
    });

    it('should call the broker callback with a cb that handles success', () => {
      const
        cb = sinon.spy();

      router.execute(request, cb);

      const brokerCb = proxy.broker.brokerCallback.firstCall.args[4];

      brokerCb(undefined, 'result');

      should(cb)
        .be.calledOnce()
        .be.calledWith('result');
    });
  });

  describe('#removeConnection', () => {
    it('should remove the conection from the broker', () => {
      const connection = {foo: 'bar'};

      proxy.clientConnectionStore.get.returns(connection);

      router.removeConnection('id');

      should(proxy.broker.removeClientConnection)
        .be.calledOnce()
        .be.calledWith(connection);
    });

  });
});

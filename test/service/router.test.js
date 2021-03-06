'use strict';

const
  proxyquire = require('proxyquire'),
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  {
    InternalError: KuzzleInternalError,
    ServiceUnavailableError
  } = require('kuzzle-common-objects').errors;

describe('#Test: service/Router', function () {
  const
    requestStub = sinon.spy(() => new Request(
      {requestId: 'requestId', foo: 'bar'},
      {connection: {id: 'connectionId', protocol: 'protocol'}}
    )),
    Router = proxyquire('../../lib/service/Router', {
      'kuzzle-common-objects': {Request: requestStub}
    });
  let
    proxy,
    router;

  beforeEach(() => {
    proxy = {
      backendHandler: {
        getBackend: sinon.stub().returns({active: true})
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
    requestStub.resetHistory();
  });

  describe('#constructor', () => {
    it('method constructor initializes the object properly', () => {
      should(router.proxy).be.exactly(proxy);
    });
  });

  describe('#newConnection', () => {
    it('should throw if no backend is available', () => {
      proxy.backendHandler.getBackend.returns(undefined);

      return should(() => router.newConnection({}))
        .throw(ServiceUnavailableError, {message: 'No Kuzzle instance found'});
    });

    it('should throw if no backend is active', () => {
      proxy.backendHandler.getBackend.returns({active: false});

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
    const
      payload = {requestId: 'requestId', foo: 'bar'},
      connection = {
        id: 'connectionId',
        protocol: 'protocol',
        ips: ['foo']
      };

    it('should call the broker callback with a cb that properly handles errors back from Kuzzle', () => {
      const
        cb = sinon.spy(),
        error = new KuzzleInternalError('test');

      router.execute(payload, connection, cb);
      should(requestStub).be.calledOnce();
      should(requestStub).be.calledWith(payload, {connection});

      should(proxy.broker.brokerCallback)
        .be.calledOnce()
        .be.calledWithMatch('request', 'requestId', connection.id, {data: payload});

      const brokerCb = proxy.broker.brokerCallback.firstCall.args[4];

      brokerCb(error);

      should(cb)
        .be.calledOnce()
        .be.calledWithMatch({status: 500, requestId: 'requestId', content: {error: error}});
    });

    it('should call the broker callback with a cb that handles success', () => {
      const
        cb = sinon.spy();

      router.execute(payload, connection, cb);
      should(requestStub).be.calledOnce();
      should(requestStub).be.calledWith(payload, {connection});

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

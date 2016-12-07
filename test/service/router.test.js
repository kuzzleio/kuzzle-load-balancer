'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Router = rewire('../../lib/service/Router'),
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  Request = require('kuzzle-common-objects').Request,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

describe('#Test: service/Router', function () {
  let
    sandbox,
    dummyProtocol = 'a protocol',
    dummySocketId = 'a socket id';

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('method constructor initializes the object properly', () => {
    let
      dummyContext = {dummy: 'context'},
      router = new Router(dummyContext);

    should(router.context).be.deepEqual(dummyContext);
  });

  it('method newConnection must add an unknown client', (done) => {
    let
      dummyContext = {
        clientConnectionStore: {get: sandbox.stub().returns({type: 'another protocol'})},
        broker: {addClientConnection: sandbox.stub()},
        backendHandler: {getBackend: sandbox.stub().returns('foobar')}
      },
      router = new Router(dummyContext),
      expectedConnection = new RequestContext({connectionId: dummySocketId, protocol: dummyProtocol});

    router.newConnection(dummyProtocol, dummySocketId)
      .then((connection) => {
        should(dummyContext.clientConnectionStore.get.calledOnce).be.true();
        should(dummyContext.clientConnectionStore.get.calledWithMatch(expectedConnection)).be.true();
        should(dummyContext.broker.addClientConnection.calledOnce).be.true();
        should(dummyContext.broker.addClientConnection.calledWithMatch(expectedConnection)).be.true();
        should(connection).be.deepEqual(expectedConnection);
        done();
      })
      .catch(e => done(e));
  });

  it('method newConnection must not add a known client', (done) => {
    let
      dummyContext = {
        clientConnectionStore: {get: sandbox.stub().returns({protocol: dummyProtocol})},
        broker: {addClientConnection: sandbox.stub()},
        backendHandler: {getBackend: sandbox.stub().returns('foobar')}
      },
      router = new Router(dummyContext),
      expectedConnection = new RequestContext({connectionId: dummySocketId, protocol: dummyProtocol});

    router.newConnection(dummyProtocol, dummySocketId)
      .then((connection) => {
        should(dummyContext.clientConnectionStore.get.calledOnce).be.true();
        should(dummyContext.clientConnectionStore.get.calledWith(expectedConnection)).be.true();
        should(dummyContext.broker.addClientConnection.callCount).be.eql(0);
        should(connection).be.deepEqual(expectedConnection);
        done();
      })
      .catch(e => done(e));
  });

  it('method newConnection should reject the promise if no backend is available', () => {
    let
      dummyContext = {
        backendHandler: {getBackend: sandbox.stub().returns(null)}
      },
      router = new Router(dummyContext);

    return should(router.newConnection(dummyProtocol, dummySocketId)).be.rejectedWith(ServiceUnavailableError);
  });

  it('method execute calls the broker properly and resolves to the response', (done) => {
    let
      dummyContext = {
        broker: {
          brokerCallback: sandbox.spy((room, id, message, callback) => callback(null, message))
        }
      },
      router = new Router(dummyContext),
      dummyRequest = new Request({}),
      callbackSpy = sandbox.spy(response => {
        should(callbackSpy.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.args[0][0]).be.eql('request');
        should(dummyContext.broker.brokerCallback.args[0][1]).be.eql(dummyRequest.id);
        should(dummyContext.broker.brokerCallback.args[0][2]).be.eql(dummyRequest.serialize());
        should(response).be.eql(dummyRequest.serialize());

        done();
      });

    router.execute(dummyRequest, callbackSpy);
  });

  it('method execute calls the broker properly and if an error occurs, resolves to an error response', (done) => {
    let
      dummyError = new Error('an Error'),
      dummyContext = {
        broker: {
          brokerCallback: sandbox.spy((room, id, message, callback) => callback(dummyError))
        }
      },
      router = new Router(dummyContext),
      dummyRequest = new Request({}),
      callbackSpy = sandbox.spy(response => {
        should(callbackSpy.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.args[0][0]).be.eql('request');
        should(dummyContext.broker.brokerCallback.args[0][1]).be.eql(dummyRequest.id);
        should(dummyContext.broker.brokerCallback.args[0][2]).match(dummyError);
        should(response.error).be.instanceOf(InternalError);
        should(response.error.message).be.eql(dummyError.message);
        should(response.status).be.eql(500);
        should(response.result).be.null();

        done();
      });

    router.execute(dummyRequest, callbackSpy);
  });

  it('method removeConnection removes a client connection if it is present', () => {
    let
      dummyContext = {
        broker: {removeClientConnection: sandbox.spy()},
        clientConnectionStore: {get: sandbox.stub().returns(true)}
      },
      router = new Router(dummyContext),
      dummyConnection = {id: 'dummy'};

    router.removeConnection(dummyConnection);

    should(dummyContext.clientConnectionStore.get.calledOnce).be.true();
    should(dummyContext.clientConnectionStore.get.calledWith(dummyConnection)).be.true();
    should(dummyContext.broker.removeClientConnection.calledOnce).be.true();
    should(dummyContext.broker.removeClientConnection.calledWith(dummyConnection)).be.true();
  });

  it('method removeConnection removes a client connection if it is present', () => {
    let
      dummyContext = {
        broker: {removeClientConnection: sandbox.spy()},
        clientConnectionStore: {get: sandbox.stub().returns(false)}
      },
      router = new Router(dummyContext),
      dummyConnection = {id: 'dummy'};

    router.removeConnection(dummyConnection);

    should(dummyContext.clientConnectionStore.get.calledOnce).be.true();
    should(dummyContext.clientConnectionStore.get.calledWith(dummyConnection)).be.true();
    should(dummyContext.broker.removeClientConnection.callCount).be.eql(0);
  });
});

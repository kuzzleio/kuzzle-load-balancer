var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Router = rewire('../../lib/service/Router');

describe('#Test: service/Router', function () {
  var
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
    var
      dummyContext = {dummy: 'context'},
      router = new Router(dummyContext);

    should(router.context).be.deepEqual(dummyContext);
  });

  it('method newConnection must add an unknown client', (done) => {
    var
      dummyContext = {
        clientConnectionStore: {get: sandbox.stub().returns({type: 'another protocol'})},
        broker: {addClientConnection: sandbox.spy()}
      },
      router = new Router(dummyContext),
      expectedConnection = {id: dummySocketId, type: dummyProtocol};

    router.newConnection(dummyProtocol, dummySocketId)
      .then((connection) => {
        should(dummyContext.clientConnectionStore.get.calledOnce).be.true();
        should(dummyContext.clientConnectionStore.get.calledWith(expectedConnection)).be.true();
        should(dummyContext.broker.addClientConnection.calledOnce).be.true();
        should(dummyContext.broker.addClientConnection.calledWith(expectedConnection)).be.true();
        should(connection).be.deepEqual(expectedConnection);
        done();
      })
      .catch((error) => {
        // Should never be called
        should(false).be.true();
        done(false);
      });
  });

  it('method newConnection must not add a known client', (done) => {
    var
      dummyContext = {
        clientConnectionStore: {get: sandbox.stub().returns({type: dummyProtocol})},
        broker: {addClientConnection: sandbox.spy()}
      },
      router = new Router(dummyContext),
      expectedConnection = {id: dummySocketId, type: dummyProtocol};

    router.newConnection(dummyProtocol, dummySocketId)
      .then((connection) => {
        should(dummyContext.clientConnectionStore.get.calledOnce).be.true();
        should(dummyContext.clientConnectionStore.get.calledWith(expectedConnection)).be.true();
        should(dummyContext.broker.addClientConnection.callCount).be.eql(0);
        should(connection).be.deepEqual(expectedConnection);
        done();
      })
      .catch((error) => {
        // Should never be called
        should(false).be.true();
        done(false);
      });
  });

  it('method execute calls the broker properly and resolves to the response', (done) => {
    var
      dummyContext = {
        broker: {
          brokerCallback: sandbox.spy((message, deferred) => deferred.resolve(message)),
          addEnvelope: sandbox.stub().returnsArg(0)
        }
      },
      router = new Router(dummyContext),
      dummyRequest = 'a request',
      dummyConnection = 'a connection',
      callbackSpy = sandbox.spy((error, response) => {
        if (error) {
          // Should never be in error
          should(false).be.true();
          done();
        }

        should(callbackSpy.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.args[0][0]).be.eql(dummyRequest);
        should(dummyContext.broker.addEnvelope.calledOnce).be.true();
        should(dummyContext.broker.addEnvelope.calledWith(dummyRequest, dummyConnection, 'request')).be.true();
        should(response).be.eql(dummyRequest);

        done();
      });

    router.execute(dummyRequest, dummyConnection, callbackSpy);
  });

  it('method execute calls the broker properly and if an error occures, resolves to an error response', (done) => {
    var
      dummyError = new Error('an Error'),
      dummyContext = {
        broker: {
          brokerCallback: sandbox.spy((message, deferred) => deferred.reject(dummyError)),
          addEnvelope: sandbox.stub().returnsArg(0)
        },
        ResponseObject: sandbox.stub().returnsArg(1)
      },
      router = new Router(dummyContext),
      dummyRequest = 'a request',
      dummyConnection = 'a connection',
      callbackSpy = sandbox.spy((error, response) => {
        if (error) {
          // Should never be in error
          should(false).be.true();
          done();
        }

        should(callbackSpy.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.calledOnce).be.true();
        should(dummyContext.broker.brokerCallback.args[0][0]).be.eql(dummyRequest);
        should(dummyContext.broker.addEnvelope.calledOnce).be.true();
        should(dummyContext.broker.addEnvelope.calledWith(dummyRequest, dummyConnection, 'request')).be.true();
        should(dummyContext.ResponseObject.calledWithNew()).be.true();
        should(dummyContext.ResponseObject.args[0][0]).be.eql(dummyRequest);
        should(dummyContext.ResponseObject.args[0][1]).be.eql(dummyError);
        should(response).be.eql(dummyError);

        done();
      });

    router.execute(dummyRequest, dummyConnection, callbackSpy);
  });

  it('method removeConnection removes a client connection if it is present', () => {
    var
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
    var
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

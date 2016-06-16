var
  should = require('should'),
  Context = require.main.require('lib/core/Context'),
  ClientConnectionStore = require.main.require('lib/store/ClientConnection'),
  PluginStore = require.main.require('lib/store/Plugin'),
  sinon = require('sinon'),
  Router = require.main.require('lib/service/Router');

describe('Test: core/Context', function () {
  var
    dummyBroker = {dummy: 'broker'},
    backendMode = 'aMode',
    BackendHandler,
    sandbox;

  before(() => {
    sandbox = sinon.sandbox.create();
    BackendHandler = sandbox.spy(function (mode) {
      should(mode).be.eql(backendMode);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('constructor must initialize internal members', () => {
    var context = new Context(BackendHandler, backendMode);

    should(context.broker).be.eql(null);
    should(context.clientConnectionStore).be.instanceOf(ClientConnectionStore);
    should(BackendHandler.calledWithNew()).be.true();
    should(BackendHandler.calledWith(backendMode)).be.true();
    should(context.pluginStore).be.instanceOf(PluginStore);
    should(context.router).be.instanceOf(Router);
  });

  it('method setBroker must set broker accordingly', () => {
    var context = new Context(BackendHandler, backendMode);

    context.setBroker(dummyBroker);

    should(context.broker).be.deepEqual(dummyBroker);
  });

  it('method getRouter must return the router', () => {
    var context = new Context(BackendHandler, backendMode);

    should(context.accessors.router).be.deepEqual(context.router);
  });
});

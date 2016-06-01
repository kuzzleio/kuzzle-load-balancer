var
  should = require('should'),
  Context = require.main.require('lib/core/Context'),
  ClientConnectionStore = require.main.require('lib/store/ClientConnection'),
  ServerConnectionStore = require.main.require('lib/store/ServerConnection'),
  PluginStore = require.main.require('lib/store/Plugin'),
  Router = require.main.require('lib/service/Router');

describe('Test: core/Context', function () {
  var
    dummyBroker = {
      dummy: 'broker'
    };

  it('constructor must initialize internal members', () => {
    var context = new Context();

    should(context.broker).be.null();
    should(context.clientConnectionStore).be.instanceOf(ClientConnectionStore);
    should(context.serverConnectionStore).be.instanceOf(ServerConnectionStore);
    should(context.pluginStore).be.instanceOf(PluginStore);
    should(context.router).be.instanceOf(Router);
  });

  it('method setBroker must set broker accordingly', () => {
    var context = new Context();

    context.setBroker(dummyBroker);

    should(context.broker).be.deepEqual(dummyBroker);
  });

  it('method getRouter must return the router', () => {
    var context = new Context();

    should(context.getRouter()).be.deepEqual(context.router);
  });
});
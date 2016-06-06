var
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  path = require('path'),
  KuzzleProxy = rewire('../../lib/core/KuzzleProxy'),
  Broker = require.main.require('lib/service/Broker'),
  HttpProxy = require.main.require('lib/service/HttpProxy'),
  Context = require.main.require('lib/core/Context');

describe('Test: core/KuzzleProxy', function () {
  var
    sandbox,
    requireStub,
    protocolPlugins,
    backendTimeout = 10000,
    aPluginName = 'a-plugin-name',
    anotherPluginName = 'another-plugin-name',
    backendMode,
    fs,
    dummyActivatedPlugin = {
      [aPluginName]: {
        activated: true,
        plugin: 'configuration'
      },
      [anotherPluginName]: {
        activated: true,
        plugin: 'configuration'
      }
    },
    dummyMixedPlugin = {
      [aPluginName]: {
        activated: true,
        plugin: 'configuration'
      },
      [anotherPluginName]: {
        activated: false,
        plugin: 'configuration'
      }
    },
    dummyPluginConstructor = function (pluginName) {
      return function() {
        return {
          pluginName,
          protocol: pluginName,
          init: function () {
          }
        };
      };
    };

  before(() => {
    KuzzleProxy.__set__('console', {log: () => {}, error: () => {}});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    backendMode = 'failover';
    protocolPlugins = {};

    sandbox.stub(KuzzleProxy.prototype, 'getRCConfig', () => {
      return {backendMode, protocolPlugins, backendTimeout};
    });

    requireStub = sinon.spy(function(requireArgument) {
      if (requireArgument.match(/.*dummy.*/)) {
        return {};
      }

      return require(requireArgument);
    });

    KuzzleProxy.__set__('require', requireStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('constructor must initialize internal members', () => {
    var proxy;

    proxy = new KuzzleProxy();

    should(proxy.context).be.instanceOf(Context);
    should(proxy.broker).be.instanceOf(Broker);
    should(proxy.httpProxy).be.instanceOf(HttpProxy);
    should(proxy.isDummy).be.false();
    should(proxy.config).be.an.Object();
  });

  it('constructor must throw an error if backendMode is bad', () => {
    backendMode = 'unknown';

    (function() {
      new KuzzleProxy();
    }).should.throw('Backend mode option must be either set to "failover" or "round-robin"; "unknown" given');
  });

  it('method getRCConfig must return an object', () => {
    var proxy;

    sandbox.restore();

    proxy = new KuzzleProxy();

    should(proxy.getRCConfig()).be.an.Object();
  });

  it('method initPlugins must initialize plugins when activated', () => {
    var
      proxy,
      pluginStoreAddStub;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns(dummyActivatedPlugin);
    sandbox
      .stub(KuzzleProxy.prototype, 'requirePluginPackage')
      .withArgs(aPluginName).returns(dummyPluginConstructor(aPluginName))
      .withArgs(anotherPluginName).returns(dummyPluginConstructor(anotherPluginName));

    proxy = new KuzzleProxy();

    pluginStoreAddStub = sandbox.stub(proxy.context.pluginStore, 'add');
    sandbox.stub(proxy.context.pluginStore, 'count').returns(2);

    proxy.initPlugins();

    should(pluginStoreAddStub.getCall(0).args[0].pluginName).be.eql(aPluginName);
    should(pluginStoreAddStub.getCall(1).args[0].pluginName).be.eql(anotherPluginName);
    should(pluginStoreAddStub.callCount).be.eql(2);
  });

  it('method initPlugins must initialize plugins when activated', () => {
    var proxy;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns(dummyMixedPlugin);
    sandbox.stub(KuzzleProxy.prototype, 'requirePluginPackage').returns(dummyPluginConstructor(aPluginName));

    proxy = new KuzzleProxy();

    proxy.initPlugins();

    should(proxy.context.pluginStore.count()).be.eql(1);
  });

  it('method initPlugins must throw an error if no plugin is initialized', () => {
    var proxy;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns({});

    proxy = new KuzzleProxy();

    proxy.initPlugins.bind(proxy).should.throw('No plugin has been initialized properly. Shutting down.');
  });

  it('method initPlugins must recover on an error if plugin does not initialize properly', () => {
    var
      proxy,
      pluginStoreAddStub;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns(dummyActivatedPlugin);
    sandbox
      .stub(KuzzleProxy.prototype, 'requirePluginPackage')
      .withArgs(anotherPluginName).returns(dummyPluginConstructor(anotherPluginName))
      .withArgs(aPluginName).throws(Error);

    proxy = new KuzzleProxy();
    pluginStoreAddStub = sandbox.stub(proxy.context.pluginStore, 'add');
    sandbox.stub(proxy.context.pluginStore, 'count').returns(1);

    proxy.initPlugins();

    should(pluginStoreAddStub.getCall(0).args[0].pluginName).be.eql(anotherPluginName);
    should(pluginStoreAddStub.callCount).be.eql(1);
  });

  it('method initBroker initializes the broker', () => {
    var proxy = new KuzzleProxy();
    var initBrokerStub = sandbox.stub(proxy.broker, 'init');

    proxy.initBroker();

    should(initBrokerStub.calledWith(proxy.config.backendMode, proxy.context, proxy.config.backendOptions, proxy.config.backendTimeout)).be.true();
    should(proxy.context.broker).be.eql(proxy.broker);
  });

  it('method initHttpProxy initializes the httpProxy', () => {
    var proxy = new KuzzleProxy();
    var iniProxyStub = sandbox.stub(proxy.httpProxy, 'init');

    proxy.initHttpProxy();
    should(iniProxyStub.calledWith(proxy.config.backendMode, proxy.context, proxy.config.httpPort)).be.true();
  });


  it('method readPluginsConfiguration must return the configuration of the plugins', () => {
    var
      proxy,
      currentConfig = {},
      readOnePluginConfigurationStub,
      loadCurrentConfigStub;

    protocolPlugins = {
      aPluginName,
      anotherPluginName
    };

    proxy = new KuzzleProxy();

    readOnePluginConfigurationStub = sandbox.stub(KuzzleProxy.prototype, 'readOnePluginConfiguration');
    loadCurrentConfigStub = sandbox.stub(KuzzleProxy.prototype, 'loadCurrentConfig');

    readOnePluginConfigurationStub.returns({activated: true});
    loadCurrentConfigStub.returns(currentConfig);

    should(Object.keys(proxy.readPluginsConfiguration()).length).be.eql(2);
    should(readOnePluginConfigurationStub.calledTwice).be.true();
  });

  it('method readPluginsConfiguration throw an error if no plugin is activated', () => {
    var
      proxy,
      currentConfig = {},
      readOnePluginConfigurationStub,
      loadCurrentConfigStub;

    proxy = new KuzzleProxy();

    readOnePluginConfigurationStub = sandbox.stub(KuzzleProxy.prototype, 'readOnePluginConfiguration');
    loadCurrentConfigStub = sandbox.stub(KuzzleProxy.prototype, 'loadCurrentConfig');

    readOnePluginConfigurationStub.returns({activated: false});
    loadCurrentConfigStub.returns(currentConfig);

    proxy.config.protocolPlugins = {
      aPluginName,
      anotherPluginName
    };

    proxy.readPluginsConfiguration.bind(proxy).should.throw('No plugin has been activated in configuration. Shutting down.');
  });

  it('method readPluginsConfiguration throws an Error if no plugin configuration is provided', () => {
    var proxy;

    proxy = new KuzzleProxy();

    proxy.readPluginsConfiguration.bind(proxy).should.throw('No plugin configuration provided. Shutting down.');
  });

  it('method requirePluginPackage must return required item', () => {
    var proxy = new KuzzleProxy();
    var getPathPluginStub = sandbox.stub(KuzzleProxy.prototype, 'getPathPlugin').returns('dummy');

    proxy.requirePluginPackage('dummy');

    should(getPathPluginStub.calledWith('dummy')).be.true();
    should(requireStub.calledWith('dummy')).be.true();
  });

  it('method requirePluginConfig must return required item', () => {
    var proxy = new KuzzleProxy();
    var getPathPluginStub = sandbox.stub(KuzzleProxy.prototype, 'getPathPlugin').returns('dummy');

    proxy.requirePluginConfig('dummy');

    should(getPathPluginStub.calledWith('dummy')).be.true();
    should(requireStub.calledWith(path.join('dummy', 'package.json'))).be.true();
  });

  it('method getPathPlugin must return a path from path property if it exists', () => {
    var proxy;
    protocolPlugins = {
      dummy: {
        path: 'a-path'
      }
    };

    proxy = new KuzzleProxy();

    should(proxy.getPathPlugin('dummy')).be.eql('a-path');
  });

  it('method getPathPlugin must return a path from node_module if no path defined in configuration', () => {
    var proxy;
    protocolPlugins = {
      dummy: {}
    };

    proxy = new KuzzleProxy();

    should(proxy.getPathPlugin('dummy')).be.eql(path.join(__dirname, '..', '..', 'node_modules', 'dummy'));
  });

  it('method loadCurrentConfig must return the configuration', () => {
    var
      proxy,
      jsonString = '{"dummy": "config"}',
      existsSyncStub,
      readFileSyncStub,
      jsonPluginsConfigPath;

    fs = KuzzleProxy.__get__('fs');
    jsonPluginsConfigPath = KuzzleProxy.__get__('jsonPluginsConfigPath');
    existsSyncStub = sinon.stub(fs, 'existsSync').returns(true);
    readFileSyncStub = sinon.stub(fs, 'readFileSync').returns(jsonString);

    proxy = new KuzzleProxy();

    should(proxy.loadCurrentConfig()).be.deepEqual(JSON.parse(jsonString));
    should(existsSyncStub.calledWith(jsonPluginsConfigPath)).be.true();
    should(readFileSyncStub.calledWith(jsonPluginsConfigPath)).be.true();

    existsSyncStub.restore();
    readFileSyncStub.restore();
  });

  it('method loadCurrentConfig must return an empty object if configuration does not exist', () => {
    var
      proxy,
      existsSyncStub,
      jsonPluginsConfigPath;

    fs = KuzzleProxy.__get__('fs');
    jsonPluginsConfigPath = KuzzleProxy.__get__('jsonPluginsConfigPath');
    existsSyncStub = sinon.stub(fs, 'existsSync').returns(false);

    proxy = new KuzzleProxy();

    should(proxy.loadCurrentConfig()).be.deepEqual({});
    should(existsSyncStub.calledWith(jsonPluginsConfigPath)).be.true();

    existsSyncStub.restore();
  });
});
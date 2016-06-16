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
    dummyRootFolder = 'folder',
    backendMode,
    fs,
    dummyActivatedPlugin = {
      [aPluginName]: {activated: true, plugin: 'configuration'},
      [anotherPluginName]: {activated: true, plugin: 'configuration'}
    },
    dummyMixedPlugin = {
      [aPluginName]: {activated: true, plugin: 'configuration'},
      [anotherPluginName]: {activated: false, plugin: 'configuration'}
    },
    dummyActivatedPluginConfig = {[aPluginName]: {activated: true, dummy: 'configuration'}},
    dummyDeactivatedPluginConfig = {[aPluginName]: {activated: false, dummy: 'configuration'}},
    dummyUndefinedActivationPluginConfig = {[aPluginName]: {dummy: 'configuration'}},
    BackendHandler,
    dummyPluginConstructor = function (pluginName) {
      return function() {
        return {pluginName, protocol: pluginName, init: () => {}};
      };
    },
    spyConsoleError;

  before(() => {
    sandbox = sinon.sandbox.create();
    BackendHandler = sandbox.spy(function (mode) {
      should(mode).be.eql(backendMode);
    });
  });

  beforeEach(() => {
    backendMode = 'standard';
    protocolPlugins = {};
    spyConsoleError = sandbox.spy();
    KuzzleProxy.__set__('console', {log: () => {}, error: spyConsoleError});

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

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    should(proxy.context).be.instanceOf(Context);
    should(proxy.broker).be.instanceOf(Broker);
    should(proxy.httpProxy).be.instanceOf(HttpProxy);
    should(proxy.isDummy).be.false();
    should(proxy.config).be.an.Object();
  });

  it('method getRCConfig must return an object', () => {
    var proxy;

    sandbox.restore();

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    should(proxy.getRCConfig()).be.an.Object();
  });

  it('method initPlugins must initialize plugins when activated', () => {
    var
      proxy,
      pluginStoreAddStub;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns(dummyActivatedPlugin);
    sandbox
      .stub(KuzzleProxy.prototype, 'requirePluginPackage')
      .withArgs(dummyRootFolder, aPluginName).returns(dummyPluginConstructor(aPluginName))
      .withArgs(dummyRootFolder, anotherPluginName).returns(dummyPluginConstructor(anotherPluginName));

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    pluginStoreAddStub = sandbox.stub(proxy.context.pluginStore, 'add');
    sandbox.stub(proxy.context.pluginStore, 'count').returns(2);

    proxy.initPlugins(dummyRootFolder);

    should(pluginStoreAddStub.getCall(0).args[0].pluginName).be.eql(aPluginName);
    should(pluginStoreAddStub.getCall(1).args[0].pluginName).be.eql(anotherPluginName);
    should(pluginStoreAddStub.callCount).be.eql(2);
  });

  it('method initPlugins must have the proper effect on plugin store', () => {
    var proxy;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns(dummyMixedPlugin);
    sandbox.stub(KuzzleProxy.prototype, 'requirePluginPackage').returns(dummyPluginConstructor(aPluginName));

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    proxy.initPlugins(dummyRootFolder);

    should(proxy.context.pluginStore.count()).be.eql(1);
  });

  it('method initPlugins must throw an error if no plugin is initialized', () => {
    var proxy;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns({});

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    proxy.initPlugins.bind(proxy).should.throw('No plugin has been initialized properly. Shutting down.');
  });

  it('method initPlugins must recover on an error if plugin does not initialize properly', () => {
    var
      proxy,
      pluginStoreAddStub;

    sandbox.stub(KuzzleProxy.prototype, 'readPluginsConfiguration').returns(dummyActivatedPlugin);
    sandbox
      .stub(KuzzleProxy.prototype, 'requirePluginPackage')
      .withArgs(dummyRootFolder, anotherPluginName).returns(dummyPluginConstructor(anotherPluginName))
      .withArgs(dummyRootFolder, aPluginName).throws(Error);

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);
    pluginStoreAddStub = sandbox.stub(proxy.context.pluginStore, 'add');
    sandbox.stub(proxy.context.pluginStore, 'count').returns(1);

    proxy.initPlugins(dummyRootFolder);

    should(pluginStoreAddStub.getCall(0).args[0].pluginName).be.eql(anotherPluginName);
    should(pluginStoreAddStub.callCount).be.eql(1);
  });

  it('method initBroker initializes the broker', () => {
    var proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);
    var initBrokerStub = sandbox.stub(proxy.broker, 'init');

    proxy.initBroker();

    should(initBrokerStub.calledWith(proxy.context, proxy.config.backendOptions, proxy.config.backendTimeout)).be.true();
    should(proxy.context.broker).be.eql(proxy.broker);
  });

  it('method initHttpProxy initializes the httpProxy', () => {
    var proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);
    var iniProxyStub = sandbox.stub(proxy.httpProxy, 'init');

    proxy.initHttpProxy();
    should(iniProxyStub.calledWith(proxy.context, proxy.config.httpPort)).be.true();
  });

  it('method readPluginsConfiguration must return the configuration of the plugins', () => {
    var
      proxy,
      currentConfig = {},
      readOnePluginConfigurationStub,
      loadCurrentConfigStub;

    protocolPlugins = {aPluginName, anotherPluginName};

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    readOnePluginConfigurationStub = sandbox.stub(KuzzleProxy.prototype, 'readOnePluginConfiguration');
    loadCurrentConfigStub = sandbox.stub(KuzzleProxy.prototype, 'loadCurrentConfig');

    readOnePluginConfigurationStub.returns({activated: true});
    loadCurrentConfigStub.returns(currentConfig);

    should(Object.keys(proxy.readPluginsConfiguration(dummyRootFolder)).length).be.eql(2);
    should(readOnePluginConfigurationStub.calledTwice).be.true();
  });


  it('method readPluginsConfiguration must throw an error if loadCurrentConfig throws an error', () => {
    var
      proxy,
      loadCurrentConfigStub,
      anError = new Error('This is an error');

    protocolPlugins = {aPluginName, anotherPluginName};

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    loadCurrentConfigStub = sandbox.stub(KuzzleProxy.prototype, 'loadCurrentConfig');

    loadCurrentConfigStub.throws(anError);

    proxy.readPluginsConfiguration.bind(proxy, dummyRootFolder).should.throw(anError);
  });

  it('method readPluginsConfiguration throw an error if no plugin is activated', () => {
    var
      proxy,
      currentConfig = {},
      readOnePluginConfigurationStub,
      loadCurrentConfigStub;

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    readOnePluginConfigurationStub = sandbox.stub(KuzzleProxy.prototype, 'readOnePluginConfiguration');
    loadCurrentConfigStub = sandbox.stub(KuzzleProxy.prototype, 'loadCurrentConfig');

    readOnePluginConfigurationStub.returns({activated: false});
    loadCurrentConfigStub.returns(currentConfig);

    proxy.config.protocolPlugins = {aPluginName, anotherPluginName};

    proxy.readPluginsConfiguration.bind(proxy, dummyRootFolder).should.throw('No plugin has been activated in configuration. Shutting down.');
  });

  it('method readPluginsConfiguration throws an Error if no plugin configuration is provided', () => {
    var proxy;

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    proxy.readPluginsConfiguration.bind(proxy, dummyRootFolder).should.throw('No plugin configuration provided. Shutting down.');
  });

  it('method requirePluginPackage must return required item', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      getPathPluginStub = sandbox.stub(KuzzleProxy.prototype, 'getPathPlugin').returns('dummy');

    proxy.requirePluginPackage('dummy');

    should(getPathPluginStub.calledWith('dummy')).be.true();
    should(requireStub.calledWith('dummy')).be.true();
  });

  it('method requirePluginConfig must return required item', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      getPathPluginStub = sandbox.stub(KuzzleProxy.prototype, 'getPathPlugin').returns('dummy');

    proxy.requirePluginConfig('dummy');

    should(getPathPluginStub.calledWith('dummy')).be.true();
    should(requireStub.calledWith(path.join('dummy', 'package.json'))).be.true();
  });

  it('method readOnePluginConfiguration must return plugin config with unaltered activation if activated is true', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox.stub(KuzzleProxy.prototype, 'requirePluginConfig').returns({}),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, dummyActivatedPluginConfig, aPluginName);

    should(readConfig).be.deepEqual(dummyActivatedPluginConfig[aPluginName]);
    should(requirePluginConfigStub.calledOnce).be.true();
  });

  it('method readOnePluginConfiguration must return plugin config with unaltered activation if activated is false', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox.stub(KuzzleProxy.prototype, 'requirePluginConfig').returns({}),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, dummyDeactivatedPluginConfig, aPluginName);

    should(readConfig).be.deepEqual(dummyDeactivatedPluginConfig[aPluginName]);
    should(requirePluginConfigStub.calledOnce).be.true();
  });

  it('method readOnePluginConfiguration must return plugin config with altered activation if not provided', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox.stub(KuzzleProxy.prototype, 'requirePluginConfig').returns({}),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, dummyUndefinedActivationPluginConfig, aPluginName),
      expectedConfig = dummyUndefinedActivationPluginConfig[aPluginName];

    expectedConfig.activated = true;

    should(readConfig).be.deepEqual(expectedConfig);
    should(requirePluginConfigStub.calledOnce).be.true();
  });

  it('method readOnePluginConfiguration must merge plugin default config with provided one', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox
        .stub(KuzzleProxy.prototype, 'requirePluginConfig')
        .returns({pluginInfo: {defaultConfig: {default: 'config'}}}),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, dummyActivatedPluginConfig, aPluginName),
      expectedConfig = dummyActivatedPluginConfig[aPluginName];

    expectedConfig.default = 'config';

    should(readConfig).be.deepEqual(expectedConfig);
    should(requirePluginConfigStub.calledOnce).be.true();
  });

  it('method readOnePluginConfiguration must merge plugin default config with provided one without overwritting it', () => {
    var proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox
        .stub(KuzzleProxy.prototype, 'requirePluginConfig')
        .returns({pluginInfo: {defaultConfig: {dummy: 'Another configuration'}}}),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, dummyActivatedPluginConfig, aPluginName);

    should(readConfig).be.deepEqual(dummyActivatedPluginConfig[aPluginName]);
    should(requirePluginConfigStub.calledOnce).be.true();
  });

  it('method readOnePluginConfiguration must catch an error if requirePluginConfig throws an error', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox
        .stub(KuzzleProxy.prototype, 'requirePluginConfig')
        .throws(new Error('an Error')),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, dummyUndefinedActivationPluginConfig, aPluginName),
      expectedConfig = dummyUndefinedActivationPluginConfig[aPluginName];

    expectedConfig.activated = true;

    should(readConfig).be.deepEqual(expectedConfig);
    should(requirePluginConfigStub.calledOnce).be.true();
    should(spyConsoleError.calledOnce).be.true();
  });

  it('method readOnePluginConfiguration must default pluginConfig with an empty object if not provided', () => {
    var
      proxy = new KuzzleProxy(BackendHandler, dummyRootFolder),
      requirePluginConfigStub = sandbox
        .stub(KuzzleProxy.prototype, 'requirePluginConfig')
        .returns({}),
      readConfig = proxy.readOnePluginConfiguration(dummyRootFolder, {}, aPluginName),
      expectedConfig = {activated: true};

    should(readConfig).be.deepEqual(expectedConfig);
    should(requirePluginConfigStub.calledOnce).be.true();
  });

  it('method getPathPlugin must return a path from path property if it exists', () => {
    var proxy;

    protocolPlugins = {dummy: {path: 'a-path'}};
    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    should(proxy.getPathPlugin(dummyRootFolder, 'dummy')).be.eql('a-path');
  });

  it('method getPathPlugin must return a path from node_module if no path defined in configuration', () => {
    var proxy;

    protocolPlugins = {dummy: {}};
    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    should(proxy.getPathPlugin(dummyRootFolder, 'dummy')).be.eql(path.join(dummyRootFolder, 'node_modules', 'dummy'));
  });

  it('method loadCurrentConfig must return the configuration', () => {
    var
      proxy,
      jsonString = '{"dummy": "config"}',
      existsSyncStub,
      readFileSyncStub;

    fs = KuzzleProxy.__get__('fs');
    existsSyncStub = sinon.stub(fs, 'existsSync').returns(true);
    readFileSyncStub = sinon.stub(fs, 'readFileSync').returns(jsonString);

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    should(proxy.loadCurrentConfig(dummyRootFolder)).be.deepEqual(JSON.parse(jsonString));
    should(existsSyncStub.calledWith(path.join(dummyRootFolder, 'pluginsConfig.json'))).be.true();
    should(readFileSyncStub.calledWith(path.join(dummyRootFolder, 'pluginsConfig.json'))).be.true();

    existsSyncStub.restore();
    readFileSyncStub.restore();
  });

  it('method loadCurrentConfig must return an empty object if configuration does not exist', () => {
    var
      proxy,
      existsSyncStub;

    fs = KuzzleProxy.__get__('fs');
    existsSyncStub = sinon.stub(fs, 'existsSync').returns(false);

    proxy = new KuzzleProxy(BackendHandler, dummyRootFolder);

    should(proxy.loadCurrentConfig(dummyRootFolder)).be.deepEqual({});
    should(existsSyncStub.calledWith(path.join(dummyRootFolder, 'pluginsConfig.json'))).be.true();

    existsSyncStub.restore();
  });
});
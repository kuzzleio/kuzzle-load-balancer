var
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  path = require('path'),
  LoadBalancer = rewire('../../lib/core/LoadBalancer'),
  Broker = require.main.require('lib/service/Broker'),
  HttpProxy = require.main.require('lib/service/HttpProxy'),
  Context = require.main.require('lib/core/Context');

describe('Test: core/LoadBalancer', function () {
  var
    sandbox,
    requireStub,
    protocolPlugins,
    serverTimeout = 10000,
    aPluginName = 'a-plugin-name',
    anotherPluginName = 'another-plugin-name',
    serverMode,
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
    LoadBalancer.__set__('console', {log: () => {}, error: () => {}});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverMode = 'failover';
    protocolPlugins = {};

    sandbox.stub(LoadBalancer.prototype, 'getRCConfig', () => {
      return {serverMode, protocolPlugins, serverTimeout};
    });

    requireStub = sinon.spy(function(requireArgument) {
      if (requireArgument.match(/.*dummy.*/)) {
        return {};
      }

      return require(requireArgument);
    });

    LoadBalancer.__set__('require', requireStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('constructor must initialize internal members', () => {
    var loadBalancer;

    loadBalancer = new LoadBalancer();

    should(loadBalancer.context).be.instanceOf(Context);
    should(loadBalancer.broker).be.instanceOf(Broker);
    should(loadBalancer.httpProxy).be.instanceOf(HttpProxy);
    should(loadBalancer.isDummy).be.false();
    should(loadBalancer.config).be.an.Object();
  });

  it('constructor must throw an error if serverMode is bad', () => {
    serverMode = 'unknown';

    try {
      new LoadBalancer();
    }
    catch (error) {
      should(error).be.deepEqual(new Error('Server mode option must be either set to "failover" or "round-robin"; "unknown" given'));
    }
  });

  it('method getRCConfig must return an object', () => {
    var loadBalancer = new LoadBalancer();

    should(loadBalancer.getRCConfig()).be.an.Object();
  });

  it('method initPlugins must initialize plugins when activated', () => {
    var loadBalancer;

    sandbox.stub(LoadBalancer.prototype, 'readPluginsConfiguration').returns(dummyActivatedPlugin);
    sandbox
      .stub(LoadBalancer.prototype, 'requirePluginPackage')
      .withArgs(anotherPluginName).returns(dummyPluginConstructor(anotherPluginName))
      .withArgs(aPluginName).returns(dummyPluginConstructor(aPluginName));

    loadBalancer = new LoadBalancer();

    loadBalancer.initPlugins();

    should(loadBalancer.context.pluginStore.getByProtocol(aPluginName)).be.deepEqual(dummyPluginConstructor(aPluginName)());
    should(loadBalancer.context.pluginStore.count()).be.eql(2);
  });

  it('method initPlugins must initialize plugins when activated', () => {
    var loadBalancer;

    sandbox.stub(LoadBalancer.prototype, 'readPluginsConfiguration').returns(dummyMixedPlugin);
    sandbox.stub(LoadBalancer.prototype, 'requirePluginPackage').returns(dummyPluginConstructor(aPluginName));

    loadBalancer = new LoadBalancer();

    loadBalancer.initPlugins();

    should(loadBalancer.context.pluginStore.count()).be.eql(1);
  });

  it('method initPlugins must throw an error if no plugin is initialized', () => {
    var loadBalancer;

    sandbox.stub(LoadBalancer.prototype, 'readPluginsConfiguration').returns({});

    loadBalancer = new LoadBalancer();

    try {
      loadBalancer.initPlugins();
    }
    catch (error) {
      should(error).be.deepEqual(new Error('No plugin has been initialized properly. We shutdown.'));
    }
  });

  it('method initPlugins must recover on an error if plugin does not initialize properly', () => {
    var loadBalancer;

    sandbox.stub(LoadBalancer.prototype, 'readPluginsConfiguration').returns(dummyActivatedPlugin);
    sandbox
      .stub(LoadBalancer.prototype, 'requirePluginPackage')
      .withArgs(anotherPluginName).returns(dummyPluginConstructor(anotherPluginName))
      .withArgs(aPluginName).throws(Error);

    loadBalancer = new LoadBalancer();

    loadBalancer.initPlugins();

    should(loadBalancer.context.pluginStore.count()).be.eql(1);
  });

  it('method initBroker initializes the broker', () => {
    var loadBalancer = new LoadBalancer();
    var initBrokerStub = sandbox.stub(loadBalancer.broker, 'init');

    loadBalancer.initBroker();

    should(initBrokerStub.calledWith(loadBalancer.config.serverMode, loadBalancer.context, loadBalancer.config.serverOptions, loadBalancer.config.serverTimeout)).be.true();
    should(loadBalancer.context.broker).be.eql(loadBalancer.broker);
  });

  it('method initHttpProxy initializes the httpProxy', () => {
    var loadBalancer = new LoadBalancer();
    var iniProxyStub = sandbox.stub(loadBalancer.httpProxy, 'init');

    loadBalancer.initHttpProxy();
    should(iniProxyStub.calledWith(loadBalancer.config.serverMode, loadBalancer.context, loadBalancer.config.httpPort)).be.true();
  });


  it('method readPluginsConfiguration must return the configuration of the plugins', () => {
    var
      loadBalancer,
      currentConfig = {},
      readOnePluginConfigurationStub,
      loadCurrentConfigStub;

    protocolPlugins = {
      aPluginName,
      anotherPluginName
    };

    loadBalancer = new LoadBalancer();

    readOnePluginConfigurationStub = sandbox.stub(LoadBalancer.prototype, 'readOnePluginConfiguration');
    loadCurrentConfigStub = sandbox.stub(LoadBalancer.prototype, 'loadCurrentConfig');

    readOnePluginConfigurationStub.returns({activated: true});
    loadCurrentConfigStub.returns(currentConfig);

    should(Object.keys(loadBalancer.readPluginsConfiguration()).length).be.eql(2);
    should(readOnePluginConfigurationStub.calledTwice).be.true();
  });

  it('method readPluginsConfiguration must return the configuration of the plugins', () => {
    var
      loadBalancer,
      currentConfig = {},
      readOnePluginConfigurationStub,
      loadCurrentConfigStub;

    protocolPlugins = {
      aPluginName,
      anotherPluginName
    };

    loadBalancer = new LoadBalancer();

    readOnePluginConfigurationStub = sandbox.stub(LoadBalancer.prototype, 'readOnePluginConfiguration');
    loadCurrentConfigStub = sandbox.stub(LoadBalancer.prototype, 'loadCurrentConfig');

    readOnePluginConfigurationStub.returns({activated: false});
    loadCurrentConfigStub.returns(currentConfig);

    try {
      loadBalancer.readPluginsConfiguration();
    }
    catch (error) {
      should(error).be.deepEqual(new Error('No plugin has been activated in configuration. Shutting down.'));
    }
  });


  it('method readPluginsConfiguration throws an Error if no plugin configuration is provided', () => {
    var loadBalancer;

    loadBalancer = new LoadBalancer();

    console.log(loadBalancer.config.protocolPlugins);

    try {
      loadBalancer.readPluginsConfiguration();
    }
    catch (error) {
      should(error).be.deepEqual(new Error('No plugin configuration provided. Shutting down.'));
    }
  });


  it('method readPluginsConfiguration throws an Error if no plugin configuration is provided', () => {
    var loadBalancer;

    loadBalancer = new LoadBalancer();

    sandbox.stub(LoadBalancer.prototype, 'requirePluginConfig').returns({
      pluginInfo: {
        defaultConfig: {}
      }
    });

    // TODO : Finish this test
  });







  it('method requirePluginPackage must return required item', () => {
    var loadBalancer = new LoadBalancer();
    var getPathPluginStub = sandbox.stub(LoadBalancer.prototype, 'getPathPlugin').returns('dummy');

    loadBalancer.requirePluginPackage('dummy');

    should(getPathPluginStub.calledWith('dummy')).be.true();
    should(requireStub.calledWith('dummy')).be.true();
  });

  it('method requirePluginConfig must return required item', () => {
    var loadBalancer = new LoadBalancer();
    var getPathPluginStub = sandbox.stub(LoadBalancer.prototype, 'getPathPlugin').returns('dummy');

    loadBalancer.requirePluginConfig('dummy');

    should(getPathPluginStub.calledWith('dummy')).be.true();
    should(requireStub.calledWith(path.join('dummy', 'package.json'))).be.true();
  });

  it('method getPathPlugin must return a path from path property if it exists', () => {
    var loadBalancer;
    protocolPlugins = {
      dummy: {
        path: 'a-path'
      }
    };

    loadBalancer = new LoadBalancer();

    should(loadBalancer.getPathPlugin('dummy')).be.eql('a-path');
  });

  it('method getPathPlugin must return a path from node_module if no path defined in configuration', () => {
    var loadBalancer;
    protocolPlugins = {
      dummy: {}
    };

    loadBalancer = new LoadBalancer();

    should(loadBalancer.getPathPlugin('dummy')).be.eql(path.join(__dirname, '..', '..', 'node_modules', 'dummy'));
  });

  it('method loadCurrentConfig must return the configuration', () => {
    var
      loadBalancer,
      jsonString = '{"dummy": "config"}',
      existsSyncStub,
      readFileSyncStub,
      jsonPluginsConfigPath;

    fs = LoadBalancer.__get__('fs');
    jsonPluginsConfigPath = LoadBalancer.__get__('jsonPluginsConfigPath');
    existsSyncStub = sinon.stub(fs, 'existsSync').returns(true);
    readFileSyncStub = sinon.stub(fs, 'readFileSync').returns(jsonString);

    loadBalancer = new LoadBalancer();

    should(loadBalancer.loadCurrentConfig()).be.deepEqual(JSON.parse(jsonString));
    should(existsSyncStub.calledWith(jsonPluginsConfigPath)).be.true();
    should(readFileSyncStub.calledWith(jsonPluginsConfigPath)).be.true();

    existsSyncStub.restore();
    readFileSyncStub.restore();
  });

  it('method loadCurrentConfig must return an empty object if configuration does not exist', () => {
    var
      loadBalancer,
      existsSyncStub,
      jsonPluginsConfigPath;

    fs = LoadBalancer.__get__('fs');
    jsonPluginsConfigPath = LoadBalancer.__get__('jsonPluginsConfigPath');
    existsSyncStub = sinon.stub(fs, 'existsSync').returns(false);

    loadBalancer = new LoadBalancer();

    should(loadBalancer.loadCurrentConfig()).be.deepEqual({});
    should(existsSyncStub.calledWith(jsonPluginsConfigPath)).be.true();

    existsSyncStub.restore();
  });
});
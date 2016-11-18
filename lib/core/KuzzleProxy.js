var
  Broker = require('../service/Broker'),
  Context = require('./Context'),
  HttpProxy = require('../service/HttpProxy'),
  PluginPackage = require('../plugins/package'),
  config = require('./config');

/**
 * KuzzleProxy constructor
 *
 * @param {ProxyBackendHandler} BackendHandler
 */
function KuzzleProxy (BackendHandler) {
  /** @type {Object} */
  this.config = config;

  /** @type {Context} */
  this.context = new Context(BackendHandler, this.config.backend.mode);

  /** @type {Broker} */
  this.broker = new Broker();

  /** @type {HttpProxy} */
  this.httpProxy = new HttpProxy();
}

KuzzleProxy.prototype.start = function () {
  return this.installPluginsIfNeeded()
    .then(() => {
      this.initPlugins();
      this.initBroker();
      this.initHttpProxy();
    });
};

KuzzleProxy.prototype.installPluginsIfNeeded = function () {
  var promises = [];

  Object.keys(this.config.protocolPlugins).forEach(pluginName => {
    var pluginPackage = new PluginPackage(pluginName, this.config.protocolPlugins[pluginName]);
    if (pluginPackage.needsInstall()) {
      promises.push(pluginPackage.install());
    }
  });

  return Promise.all(promises);
};

/**
 * Reads configuration files and initializes plugins
 */
KuzzleProxy.prototype.initPlugins = function () {
  Object.keys(this.config.protocolPlugins).forEach(pluginName => {
    var
      plugin,
      pluginDefinition = this.config.protocolPlugins[pluginName];

    if (!pluginDefinition.activated) {
      return;
    }

    console.log(`Initializing protocol plugin ${pluginName}`);
    try {
      plugin = new (require(pluginName))();
      plugin.init(pluginDefinition.config, this.context);

      this.context.pluginStore.add(plugin);
    } catch (error) {
      console.error(`Initialization of plugin ${pluginName} has failed; Reason: `, error);
    }
  });

  if (this.context.pluginStore.count() === 0) {
    throw new Error('No plugin has been initialized properly. Shutting down.');
  }
};

/**
 * Intializes the broker
 */
KuzzleProxy.prototype.initBroker = function () {
  this.context.setBroker(this.broker);
  this.broker.init(this.context, this.config.backend);
};

/**
 * Initializes the httpProxy
 */
KuzzleProxy.prototype.initHttpProxy = function () {
  this.httpProxy.init(this.context, this.config);
};

module.exports = KuzzleProxy;

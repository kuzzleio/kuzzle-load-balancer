var
  Broker = require('../service/Broker'),
  HttpProxy = require('../service/HttpProxy'),
  Context = require('../core/Context'),
  fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  jsonPluginsConfigPath = path.join(__dirname, '..', '..', 'pluginsConfig.json');

/**
 * LoadBalancer constructor
 *
 * @constructor
 */
function LoadBalancer () {
  /** @type {Object} */
  this.config = this.getRCConfig();

  if (['failover', 'round-robin'].indexOf(this.config.serverMode) === -1) {
    throw new Error(`Server mode option must be either set to "failover" or "round-robin"; "${this.config.serverMode}" given`);
  }

  /** @type {Context} */
  this.context = new Context();

  /** @type {Broker} */
  this.broker = new Broker();

  /** @type {HttpProxy} */
  this.httpProxy = new HttpProxy();

  /** @type {Boolean} */
  this.isDummy = false;
}

/**
 * Returns RC configuration
 *
 * @returns {Object}
 */
LoadBalancer.prototype.getRCConfig = function () {
  return require('rc')('lb', {
    protocolPlugins: {},
    serverMode: 'failover',
    serverOptions: {},
    httpPort: 7511,
    serverTimeout: 10000
  });
};

/**
 * Reads configuration files and initializes plugins
 */
LoadBalancer.prototype.initPlugins = function () {
  var pluginsConfiguration = this.readPluginsConfiguration();

  _.forEach(pluginsConfiguration, (pluginConfiguration, pluginName) => {
    var
      plugin;

    if (pluginConfiguration.activated) {
      console.log(`Initializing plugin protocol ${pluginName}`);
      try {
        plugin = new (this.requirePluginPackage(pluginName))();
        plugin.init(pluginConfiguration, this.context, this.isDummy);

        this.context.pluginStore.add(plugin);
      } catch (error) {
        console.error(`Initialization of plugin ${pluginName} has failed; Reason :`, error);
      }
    }
  });

  if (this.context.pluginStore.count() === 0) {
    throw new Error('No plugin has been initialized properly. We shutdown.');
  }
};

/**
 * Intializes the broker
 */
LoadBalancer.prototype.initBroker = function () {
  this.context.setBroker(this.broker);
  this.broker.init(this.config.serverMode, this.context, this.config.serverOptions, this.config.serverTimeout);
};

/**
 * Initializes the httpProxy
 */
LoadBalancer.prototype.initHttpProxy = function () {
  this.httpProxy.init(this.config.serverMode, this.context, this.config.httpPort);
};

/**
 * Updates plugins configuration in Kuzzle database
 *
 * @returns {Object}
 */
LoadBalancer.prototype.readPluginsConfiguration = function () {
  var
    pluginsConfiguration = {},
    currentConfig,
    plugins = this.config.protocolPlugins,
    activatedPlugins;

  try {
    currentConfig = this.loadCurrentConfig();
  }
  catch (error) {
    throw error;
  }

  if (Object.keys(plugins).length === 0) {
    throw new Error('No plugin configuration provided. Shutting down.');
  }

  Object.keys(plugins).forEach((pluginName) => {
    pluginsConfiguration[pluginName] = this.readOnePluginConfiguration(currentConfig, pluginName);
  });

  activatedPlugins = Object
    .keys(pluginsConfiguration)
    .map(pluginName => pluginsConfiguration[pluginName])
    .filter(pluginConfig => pluginConfig.activated);

  if (activatedPlugins.length === 0) {
    throw new Error('No plugin has been activated in configuration. Shutting down.');
  }

  return pluginsConfiguration;
};

LoadBalancer.prototype.readOnePluginConfiguration = function (currentConfig, pluginName) {
  var
    pluginPackage,
    pluginConfiguration = currentConfig[pluginName] || {};

  try {
    pluginPackage = this.requirePluginConfig(pluginName);
  } catch (error) {
    console.error(`There is a problem with plugin ${pluginName}; Reason : ${error}`);
  }

  if (pluginPackage.pluginInfo && pluginPackage.pluginInfo.defaultConfig) {
    pluginConfiguration = _.extend(pluginConfiguration, pluginPackage.pluginInfo.defaultConfig);
  }

  if (typeof pluginConfiguration.activated === 'undefined') {
    pluginConfiguration.activated = true;
  }

  return pluginConfiguration;
};

/**
 * Requires the npm package of the plugin
 *
 * @param name
 */
LoadBalancer.prototype.requirePluginPackage = function (name) {
  return require(this.getPathPlugin(name));
};

/**
 * Requires the npm package.json file of the plugin
 *
 * @param {String} pluginName
 * @returns {Object}
 */
LoadBalancer.prototype.requirePluginConfig = function (pluginName) {
  return require(path.join(this.getPathPlugin(pluginName), 'package.json'));
};

/**
 * Return the real plugin path
 *
 * @param pluginName
 * @returns {String}
 */
LoadBalancer.prototype.getPathPlugin = function (pluginName) {
  var pluginConfig = this.config.protocolPlugins[pluginName];

  if (pluginConfig.path) {
    return pluginConfig.path;
  }

  return path.join(__dirname, '..', '..', 'node_modules', pluginName);
};

/**
 * Loads current plugin config
 *
 * @returns {Object}
 */
LoadBalancer.prototype.loadCurrentConfig = function () {
  if (fs.existsSync(jsonPluginsConfigPath)) {
    return JSON.parse(fs.readFileSync(jsonPluginsConfigPath));
  }

  return {};
};

module.exports = LoadBalancer;

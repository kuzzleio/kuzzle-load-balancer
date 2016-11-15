var
  Broker = require('../service/Broker'),
  HttpProxy = require('../service/HttpProxy'),
  Context = require('../core/Context'),
  fs = require('fs'),
  path = require('path'),
  _ = require('lodash');

/**
 * KuzzleProxy constructor
 *
 * @param {ProxyBackendHandler} BackendHandler
 * @param {String} applicationName
 * @constructor
 */
function KuzzleProxy (BackendHandler, applicationName) {
  /** @type {Object} */
  this.config = this.getRCConfig(applicationName);

  /** @type {Context} */
  this.context = new Context(BackendHandler, this.config.backendMode);

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
KuzzleProxy.prototype.getRCConfig = function (applicationName) {
  if (applicationName === undefined) {
    applicationName = 'proxy';
  }

  return require('rc')(applicationName, {
    protocolPlugins: {},
    backendOptions: {},
    backendMode: 'standard',
    http: {
      port: 7511,
      maxRequestSize: '1MB'
    },
    backendTimeout: 10000
  });
};

/**
 * @param {String} rootFolder
 * Reads configuration files and initializes plugins
 */
KuzzleProxy.prototype.initPlugins = function (rootFolder) {
  var pluginsConfiguration = this.readPluginsConfiguration(rootFolder);

  _.forEach(pluginsConfiguration, (pluginConfiguration, pluginName) => {
    var
      plugin;

    if (pluginConfiguration.activated) {
      console.log(`Initializing plugin protocol ${pluginName}`);
      try {
        plugin = new (this.requirePluginPackage(rootFolder, pluginName))();
        plugin.init(pluginConfiguration, this.context, this.isDummy);

        this.context.pluginStore.add(plugin);
      } catch (error) {
        console.error(`Initialization of plugin ${pluginName} has failed; Reason :`, error);
      }
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
  this.broker.init(this.context, this.config.backendOptions, this.config.backendTimeout);
};

/**
 * Initializes the httpProxy
 */
KuzzleProxy.prototype.initHttpProxy = function () {
  this.httpProxy.init(this.context, this.config);
};

/**
 * Updates plugins configuration in Kuzzle database
 *
 * @param {String} rootFolder
 * @returns {Object}
 */
KuzzleProxy.prototype.readPluginsConfiguration = function (rootFolder) {
  var
    pluginsConfiguration = {},
    currentConfig,
    plugins = this.config.protocolPlugins,
    activatedPlugins;

  try {
    currentConfig = this.loadCurrentConfig(rootFolder);
  }
  catch (error) {
    throw error;
  }

  if (Object.keys(plugins).length === 0) {
    throw new Error('No plugin configuration provided. Shutting down.');
  }

  Object.keys(plugins).forEach((pluginName) => {
    pluginsConfiguration[pluginName] = this.readOnePluginConfiguration(rootFolder, currentConfig, pluginName);
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

/**
 * Interprets the package.json file of a plugin package to extract the configuration
 *
 * @param {String} rootFolder
 * @param currentConfig
 * @param pluginName
 * @returns {*}
 */
KuzzleProxy.prototype.readOnePluginConfiguration = function (rootFolder, currentConfig, pluginName) {
  var
    pluginPackage,
    pluginConfiguration = currentConfig[pluginName] || {};

  try {
    pluginPackage = this.requirePluginConfig(rootFolder, pluginName);

    if (pluginPackage.pluginInfo && pluginPackage.pluginInfo.defaultConfig) {
      pluginConfiguration = _.extend(pluginPackage.pluginInfo.defaultConfig, pluginConfiguration);
    }
  } catch (error) {
    console.error(`There is a problem with plugin ${pluginName}; Reason : ${error}`);
  }

  if (typeof pluginConfiguration.activated === 'undefined') {
    pluginConfiguration.activated = true;
  }

  return pluginConfiguration;
};

/**
 * Requires the npm package of the plugin
 *
 * @param {String} rootFolder
 * @param name
 */
KuzzleProxy.prototype.requirePluginPackage = function (rootFolder, name) {
  return require(this.getPathPlugin(rootFolder, name));
};

/**
 * Requires the npm package.json file of the plugin
 *
 * @param {String} rootFolder
 * @param {String} pluginName
 * @returns {{pluginInfo: {defaultConfig: *}}}
 */
KuzzleProxy.prototype.requirePluginConfig = function (rootFolder, pluginName) {
  return require(path.join(this.getPathPlugin(rootFolder, pluginName), 'package.json'));
};

/**
 * Return the real plugin path
 *
 * @param {String} rootFolder
 * @param pluginName
 * @returns {String}
 */
KuzzleProxy.prototype.getPathPlugin = function (rootFolder, pluginName) {
  var pluginConfig = this.config.protocolPlugins[pluginName];

  if (pluginConfig.path) {
    return pluginConfig.path;
  }

  return path.join(rootFolder, 'node_modules', pluginName);
};

/**
 * Loads current plugin config
 *
 * @param {String} rootFolder
 * @returns {Object}
 */
KuzzleProxy.prototype.loadCurrentConfig = function (rootFolder) {
  var jsonPluginsConfigPath = path.join(rootFolder, 'pluginsConfig.json');

  if (fs.existsSync(jsonPluginsConfigPath)) {
    return JSON.parse(fs.readFileSync(jsonPluginsConfigPath));
  }

  return {};
};

module.exports = KuzzleProxy;

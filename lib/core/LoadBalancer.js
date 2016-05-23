var
  Broker = require('../service/Broker'),
  HttpProxy = require('../service/HttpProxy'),
  Context = require('../core/Context'),
  fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  jsonPluginsConfigPath = path.join(__dirname, '..', '..', 'pluginsConfig.json');

function LoadBalancer () {
  this.context = new Context();
  this.broker = new Broker();
  this.httpProxy = new HttpProxy();
  this.isDummy = false;
  this.config = require('rc')('lb', {
    protocolPlugins: {},
    serverMode: 'failover',
    serverOptions: {},
    httpPort: 7511
  });

  if (['failover', 'roundrobin'].indexOf(this.config.serverMode) === -1) {
    throw new Error(`Server mode option must be either set to "failover" or "round-robin"; "${this.config.serverMode}" given`);
  }
}

LoadBalancer.prototype.initPlugins = function () {
  var
    protocolPlugins = this.config.protocolPlugins,
    activatedPlugins,
    pluginsConfiguration;

  if (Object.keys(protocolPlugins).length > 0) {
    pluginsConfiguration = getPluginsConfiguration(protocolPlugins);
    activatedPlugins = Object
      .keys(protocolPlugins)
      .map(pluginName => protocolPlugins[pluginName])
      .filter(pluginConfig => pluginConfig.activated);

    if (activatedPlugins.length > 0) {
      _.forEach(protocolPlugins, (pluginConfig, pluginName) => {
        var
          plugin;

        if (pluginConfig.activated) {
          console.log(`Initializing plugin protocol ${pluginName}`);
          try {
            plugin = new (require(pluginName))();
            plugin.init(pluginsConfiguration[pluginName], this.context, this.isDummy);

            this.context.pluginStore.add(plugin);
          } catch (error) {
            console.error(`Initialization of plugin ${pluginName} has failed; Reason :`, error);
          }
        }
      });

      if (this.context.pluginStore.count() === 0) {
        console.error('No plugin has been initialized properly. We shutdown.');
        process.exit(1);
      }
    } else {
      console.error('No plugin has been activated in configuration. We shutdown.');
      process.exit(1);
    }
  } else {
    console.error('No plugin configuration provided. We shutdown.');
    process.exit(1);
  }
};

LoadBalancer.prototype.initBroker = function () {
  this.context.setBroker(this.broker);
  this.broker.init(this.config.serverMode, this.context, this.config.serverOptions);
};

LoadBalancer.prototype.initHttpProxy = function () {
  this.httpProxy.init(this.config.serverMode, this.context, this.config.httpPort);
};

/**
 * Updates plugins configuration in Kuzzle database
 *
 * @param plugins list
 * @returns {Object}
 */
function getPluginsConfiguration(plugins) {
  var
    pluginsConfiguration = {},
    currentConfig = loadCurrentConfig();

  _.forEach(plugins, (plugin, name) => {
    var
      pluginPackage,
      pluginConfiguration = currentConfig[name] || {};

    try {
      pluginPackage = require(path.join(getPathPlugin(plugin, name), 'package.json'));
    } catch (e) {
      console.error('There is a problem with plugin ' + name + '. Check the plugin installation directory');
      process.exit(1);
    }

    if (pluginPackage.pluginInfo && pluginPackage.pluginInfo.defaultConfig) {
      pluginConfiguration = _.extend(pluginConfiguration, pluginPackage.pluginInfo.defaultConfig);
    }

    pluginsConfiguration[name] = pluginConfiguration;
  });

  return pluginsConfiguration;
}

/**
 * Return the real plugin path
 * /!\ Copy of bin/plugins.js
 *
 * @param plugin
 * @param name
 * @returns {String}
 */
function getPathPlugin (plugin, name) {
  if (plugin.path) {
    return plugin.path;
  }
  return path.join(__dirname, '..', '..', 'node_modules', name);
}

/**
 * Loads current plugin config
 *
 * @returns {Object}
 */
function loadCurrentConfig() {
  if (fs.existsSync(jsonPluginsConfigPath)) {
    return JSON.parse(fs.readFileSync(jsonPluginsConfigPath));
  }

  return {};
}

module.exports = LoadBalancer;

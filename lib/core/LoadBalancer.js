var
  Broker = require('../service/Broker'),
  Context = require('../core/Context.js');

function LoadBalancer () {
  this.context = new Context();
  this.broker = new Broker();
  this.isDummy = false;
  this.config = require('rc')('lb', {
    protocolPlugins: {},
    serverMode: 'failover',
    serverOptions: {}
  });
}

LoadBalancer.prototype.initPlugins = function () {
  var
    protocolPlugins = this.config.protocolPlugins,
    activatedPlugins;

  if (Object.keys(protocolPlugins).length > 0) {
    activatedPlugins = Object
      .keys(protocolPlugins)
      .map(pluginName => protocolPlugins[pluginName])
      .filter(pluginConfig => pluginConfig.activated);

    if (activatedPlugins.length > 0) {
      Object.keys(protocolPlugins).forEach((pluginName) => {
        var
          plugin,
          pluginConfig = protocolPlugins[pluginName];

        if (pluginConfig.activated) {
          console.log(`Initializing plugin protocol ${pluginName}`);
          try {
            plugin = new (require(pluginName))();
            plugin.init(pluginConfig.config, this.context, this.isDummy);

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
  this.broker.init(this.context, this.config.serverMode, this.config.serverOptions);
};

module.exports = LoadBalancer;

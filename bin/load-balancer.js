var
  Broker = require('../lib/Broker.js'),
  config = require('rc')('lb', {
    protocolPlugins: {},
    serverMode: 'failover',
    serverOptions: {}
  }),
  isDummy = false,
  Context = require('../lib/Context.js'),
  context,
  broker,
  activatedPlugins,
  protocolPlugins = config.protocolPlugins;

context = new Context();
broker = new Broker();

context.setBroker(broker);

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
          plugin.init(pluginConfig.config, context, isDummy);

          context.pluginStore.add(plugin);
        } catch (error) {
          console.error(`Initialization of plugin ${pluginName} has failed; Reason :`, error);
        }
      }
    });

    if (context.pluginStore.count()) {
      console.error('No plugin has been initialized properly. We shutdown.');
      process.exit(1);
    }
  } else {
    console.error('No plugin has been activated in configuration. We shutdown.');
    process.exit(1);
  }

  broker.init(context, config.serverMode, config.serverOptions);
} else {
  console.error('No plugin configuration provided. We shutdown.');
  process.exit(1);
}

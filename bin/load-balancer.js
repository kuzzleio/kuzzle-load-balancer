var
  broker = new (require('../lib/Broker.js'))(),
  config = require('rc')('lb', {}),
  isDummy = false,
  context = new (require('../lib/Context.js'))(broker),
  plugins = {};

if (Object.keys(config.protocolPlugins).length > 0) {
  Object.keys(config.protocolPlugins).forEach((pluginName) => {
    var
      pluginObject,
      pluginConfig = config.protocolPlugins[pluginName];
    if (pluginConfig.activated) {
      console.log(`Initializing plugin protocol ${pluginName}`);
      pluginObject = new (require(pluginName))();
      plugins[pluginObject.protocol] = pluginObject.init(pluginConfig.config, context, isDummy);
    }
  });

  broker.initializeBroker(config.serverMode, config.serverOptions, plugins);
} else {
  console.error('No plugin configuration provided');
  process.exit(1);
}

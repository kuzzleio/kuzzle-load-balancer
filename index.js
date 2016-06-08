var
  KuzzleProxy = require('./lib/core/KuzzleProxy'),
  proxy = new KuzzleProxy();

try {
  proxy.initPlugins();
  proxy.initBroker();
  proxy.initHttpProxy();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

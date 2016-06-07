var
  KuzzleProxy = require('./lib/core/KuzzleProxy'),
  BackendHandler = require('./lib/service/ProxyBackendHandler'),
  proxy;

console.log('Starting proxy instance');

try {
  proxy = new KuzzleProxy(BackendHandler);

  proxy.initPlugins();
  proxy.initBroker();
  proxy.initHttpProxy();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

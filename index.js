var
  KuzzleProxy = require('./lib/core/KuzzleProxy'),
  BackendHandler = require('./lib/service/ProxyBackendHandler'),
  proxy,
  applicationName = 'proxy';

console.log('Starting proxy instance');

try {
  proxy = new KuzzleProxy(BackendHandler, applicationName);

  proxy.initPlugins();
  proxy.initBroker();
  proxy.initHttpProxy();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

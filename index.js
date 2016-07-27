var
  KuzzleProxy = require('./lib/core/KuzzleProxy'),
  BackendHandler = require('./lib/service/ProxyBackendHandler'),
  proxy,
  applicationName = 'proxy';

try {
  proxy = new KuzzleProxy(BackendHandler, applicationName);

  proxy.initPlugins(__dirname);
  proxy.initBroker();
  proxy.initHttpProxy();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

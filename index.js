var
  KuzzleProxy = require('./lib/core/KuzzleProxy'),
  BackendHandler = require('./lib/service/ProxyBackendHandler'),
  proxy;

console.log('Starting proxy instance');

try {
  proxy = new KuzzleProxy(BackendHandler);
  proxy.start();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

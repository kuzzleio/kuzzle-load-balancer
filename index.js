var
  Proxy = require('./lib/core/Proxy'),
  proxy = new Proxy();

try {
  proxy.initPlugins();
  proxy.initBroker();
  proxy.initHttpProxy();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

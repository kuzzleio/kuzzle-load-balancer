var
  KuzzleProxy = require('./lib/core/KuzzleProxy'),
  BackendHandler = require('./lib/service/ProxyBackendHandler'),
  proxy,
  applicationName = 'proxy';
/*
var pmx=  require('pmx').init({
    http          : true, // HTTP routes logging (default: true)
    ignore_routes : [/notFound/], // Ignore http routes with this pattern (Default: [])
    errors        : true, // Exceptions loggin (default: true)
    custom_probes : true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
    network       : true, // Network monitoring at the application level
    ports         : true,  // Shows which ports your app is listening on (default: false)
    profiling : true
  });
*/
console.log('==========================');

console.log('Starting proxy instance');

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

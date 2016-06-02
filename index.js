var
  LoadBalancer = require('./lib/core/LoadBalancer'),
  loadBalancer = new LoadBalancer();

try {
  loadBalancer.initPlugins();
  loadBalancer.initBroker();
  loadBalancer.initHttpProxy();
}
catch (error) {
  console.error(error);
  process.exit(1);
}

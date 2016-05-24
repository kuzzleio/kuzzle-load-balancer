var
  LoadBalancer = require('./lib/core/LoadBalancer'),
  loadBalancer = new LoadBalancer();

loadBalancer.initPlugins();
loadBalancer.initBroker();
loadBalancer.initHttpProxy();

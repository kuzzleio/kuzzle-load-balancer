var config = require('../lib/config');
var ClientListener = require('../lib/ClientListener.js');
var Broker = require('../lib/Broker.js');

var listener = new ClientListener();
var broker = new Broker();

broker
  .initializeBroker(config.servers, config.serverMode, config.webSocketOptions, listener.listenerCallback)
  .then(() => {
    return listener.initilizeServer(config.clientPort, config.clientRoom, broker.brokerCallback);
  })
  .then(() => {
    console.log('Rock & Roll');
  })
  .catch((error) => {
    console.error(error.message);
  });

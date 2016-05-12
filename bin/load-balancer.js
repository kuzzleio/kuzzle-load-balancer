var config = require('../lib/config');
var ClientListener = require('../lib/ClientListener.js');
var Broker = require('../lib/Broker.js');

var listener = new ClientListener();
var broker = new Broker();

broker.initializeBroker(config.serverMode, config.serverOptions, listener.listenerCallback);
listener.initilizeServer(config.clientPort, config.clientRoom, broker.brokerCallback);


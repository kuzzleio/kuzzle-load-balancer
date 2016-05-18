var
  ClientConnectionStore = require('./store/ClientConnection'),
  PluginStore = require('./store/Plugin'),
  Router = require('./service/Router');

/**
 * Context constructor
 * @constructor
 */
function Context () {
  /** @type {Broker} */
  this.broker = null;

  /** @type {ClientConnection} */
  this.clientConnectionStore = new ClientConnectionStore();

  /** @type {Plugin} */
  this.pluginStore = new PluginStore();

  /** @type {Router} */
  this.router = null;
}

/**
 * Mocks a Kuzzle RequestObject used by the plugins
 *
 * @param object
 */
Context.prototype.RequestObject = object => object;

/**
 * Dependency injection of the broker
 *
 * @param {Broker} broker
 */
Context.prototype.setBroker = broker => {
  this.broker = broker;
  this.router = new Router(this.broker);
};

/**
 * Return the router used by the plugins
 *
 * @returns {Router}
 */
Context.prototype.getRouter = () => {
  return this.router;
};

module.exports = Context;
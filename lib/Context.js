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
  this.router = new Router(this);
}

/**
 * Mocks a Kuzzle RequestObject used by the plugins
 *
 * @param object
 */
Context.prototype.RequestObject = function (object) {
  return object;
};

/**
 * Dependency injection of the broker
 *
 * @param {Broker} broker
 */
Context.prototype.setBroker = function (broker) {
  this.broker = broker;
};

/**
 * Return the router used by the plugins
 *
 * @returns {Router}
 */
Context.prototype.getRouter = function () {
  return this.router;
};

module.exports = Context;
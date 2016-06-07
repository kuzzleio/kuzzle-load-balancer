var
  ClientConnectionStore = require('../store/ClientConnection'),
  PluginStore = require('../store/Plugin'),
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  Router = require('../service/Router');

/**
 * Context constructor
 * 
 * @param {ProxyBackendHandler} BackendHandler
 * @param {String} backendMode
 * @constructor
 */
function Context (BackendHandler, backendMode) {
  /** @type {Broker} */
  this.broker = null;

  /** @type {ClientConnection} */
  this.clientConnectionStore = new ClientConnectionStore();

  /** @note Context is provided to the Handler to implement more complex handlers */
  /** @type {ProxyBackendHandler} */
  this.backendHandler = new BackendHandler(backendMode, this);

  /** @type {Plugin} */
  this.pluginStore = new PluginStore();

  /** @type {Router} */
  this.router = new Router(this);
}

/**
 * A Kuzzle RequestObject used by the plugins
 *
 * @param object
 */
Context.prototype.RequestObject = RequestObject;

/**
 * A Kuzzle ResponseObject used by the plugins
 *
 * @param object
 */
Context.prototype.ResponseObject = ResponseObject;

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
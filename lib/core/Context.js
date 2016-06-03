var
  ClientConnectionStore = require('../store/ClientConnection'),
  BackendConnectionStore = require('../store/BackendConnection'),
  PluginStore = require('../store/Plugin'),
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  Router = require('../service/Router');

/**
 * Context constructor
 * @constructor
 */
function Context () {
  /** @type {Broker} */
  this.broker = null;

  /** @type {ClientConnection} */
  this.clientConnectionStore = new ClientConnectionStore();

  /** @type {BackendConnection} */
  this.backendConnectionStore = new BackendConnectionStore();

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
 * A Kuzzle ResponseObject for the plugins
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
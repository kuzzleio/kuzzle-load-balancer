var
  ClientConnectionStore = require('../store/ClientConnection'),
  ServerConnectionStore = require('../store/ServerConnection'),
  PluginStore = require('../store/Plugin'),
  ResponseObject = require('../model/ResponseObject'),
  RequestObject = require('../model/RequestObject'),
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

  /** @type {ServerConnection} */
  this.serverConnectionStore = new ServerConnectionStore();

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
Context.prototype.RequestObject = RequestObject;

/**
 * Mocks a Kuzzle ResponseObject for the plugins
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
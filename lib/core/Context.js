var
  _ = require('lodash'),
  ClientConnectionStore = require('../store/ClientConnection'),
  PluginStore = require('../store/Plugin'),
  Request = require('kuzzle-common-objects').Request,
  errors = require('kuzzle-common-objects').errors,
  Router = require('../service/Router');

/**
 * Context constructor
 *
 * @param {ProxyBackendHandler} BackendHandler
 * @param {String} backendMode
 * @constructor
 */
function Context (BackendHandler, backendMode) {
  var self = this; // used to allow property getters to access this context object

  /**
   Constructors exposed to plugins
   @namespace {Object} constructors
   @property {Request} Request - Constructor for Kuzzle Request objects
   */
  this.constructors = {
    Request
  };

  /**
   Kuzzle error objects
   @namespace {Object} errors
   */
  this.errors = {};

  // Injects error constructors in the "errors" object
  _.forOwn(errors, (constructor, name) => {
    this.errors[name] = constructor;
  });

  /**
   Accessors to instanciated objects
   @namespace {Object} accessors
   */
  this.accessors = {};

  /**
   @property router - Accessor to routing functions
   @memberof accessors
   */
  Object.defineProperty(this.accessors, 'router', {
    enumerable: true,
    get: function () {
      return self.router;
    }
  });

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
 * Dependency injection of the broker
 *
 * @param {Broker} broker
 */
Context.prototype.setBroker = function (broker) {
  this.broker = broker;
};


module.exports = Context;

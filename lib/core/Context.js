'use strict';

var
  ClientConnection = require('./clientConnection'),
  Request = require('kuzzle-common-objects').Request,
  errors = require('kuzzle-common-objects').errors;

let _proxy;


/**
 * Context constructor
 *
 * @param {KuzzleProxy} proxy
 * @constructor
 */
function Context (proxy) {
  _proxy = proxy;

  /**
   Constructors exposed to plugins
   @namespace {Object} constructors
   @property {Request} Request - Constructor for Kuzzle Request objects
   */
  this.constructors = {
    ClientConnection,
    Request
  };

  /**
   Kuzzle error objects
   @namespace {Object} errors
   */
  this.errors = errors;

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
      return _proxy.router;
    }
  });

  this.log = _proxy.log;
}


module.exports = Context;

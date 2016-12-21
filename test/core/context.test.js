'use strict';

const
  errors = require('kuzzle-common-objects').errors,
  should = require('should'),
  ClientConnection = require('../../lib/core/clientConnection'),
  Context = require('../../lib/core/Context'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  Request = require('kuzzle-common-objects').Request,
  Router = require.main.require('lib/service/Router');

describe('Test: core/Context', function () {

  it('constructor must initialize internal members', () => {
    const context = new Context({foo: 'bar'});

    should(context.constructors.ClientConnection)
      .be.exactly(ClientConnection);
    should(context.constructors.Request)
      .be.exactly(Request);
    should(context.errors)
      .be.exactly(errors);
  });

  it('method getRouter must return the router', () => {
    const
      proxy = {
        router: {foo: 'bar'}
      },
      context = new Context(proxy);

    should (context.accessors.router)
      .be.exactly(proxy.router);
  });

});

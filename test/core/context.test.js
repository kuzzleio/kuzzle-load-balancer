'use strict';

const
  errors = require('kuzzle-common-objects').errors,
  should = require('should'),
  ClientConnection = require('../../lib/core/clientConnection'),
  Context = require('../../lib/core/Context');

describe('Test: core/Context', function () {

  it('constructor must initialize internal members', () => {
    const context = new Context({foo: 'bar'});

    should(context.constructors.ClientConnection)
      .be.exactly(ClientConnection);
    should(context.errors)
      .be.exactly(errors);
  });

  it('method getRouter must return the router', () => {
    const
      proxy = {
        router: {foo: 'bar'}
      },
      context = new Context(proxy);

    should (context.accessors.router).be.exactly(proxy.router);
  });

  it('log getter should return the proxy error logger', () => {
    const
      proxy = {
        loggers: {
          error: {foo: 'bar'}
        }
      };

    const context = new Context(proxy);
    should(context.log)
      .be.exactly(proxy.loggers.errors);
  });

});

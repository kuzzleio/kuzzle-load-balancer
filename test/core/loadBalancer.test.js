var
  sinon = require('sinon'),
  should = require('should'),
  LoadBalancer = require.main.require('lib/core/LoadBalancer'),
  Broker = require.main.require('lib/service/Broker'),
  HttpProxy = require.main.require('lib/service/HttpProxy'),
  Context = require.main.require('lib/core/Context');

describe('Test: core/LoadBalancer', function () {
  var
    sandbox;

  before(() => {
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('constructor must initialize internal members', () => {
    var loadBalancer;

    sandbox.stub(LoadBalancer.prototype, 'getRCConfig', () => {
      return {
        serverMode: 'failover'
      };
    });

    loadBalancer = new LoadBalancer();

    should(loadBalancer.context).be.instanceOf(Context);
    should(loadBalancer.broker).be.instanceOf(Broker);
    should(loadBalancer.httpProxy).be.instanceOf(HttpProxy);
    should(loadBalancer.isDummy).be.false();
    should(loadBalancer.config).be.an.Object();
  });

  it('constructor must throw an error if serverMode is bad', () => {

    sandbox.stub(LoadBalancer.prototype, 'getRCConfig', () => {
      return {
        serverMode: 'unknown'
      };
    });

    try {
      new LoadBalancer();
    }
    catch (error) {
      should(error).be.deepEqual(new Error('Server mode option must be either set to "failover" or "round-robin"; "unknown" given'));
    }
  });

  it('method getConfig must return an object', () => {
    var loadBalancer = new LoadBalancer();

    should(loadBalancer.getRCConfig()).be.an.Object();
  });

  it('method getConfig must return an object', () => {
    var loadBalancer = new LoadBalancer();

    should(loadBalancer.getRCConfig()).be.an.Object();
  });
});
var
  should = require('should'),
  sinon = require('sinon'),
  ProxyBackendHandler = require.main.require('lib/service/ProxyBackendHandler');

describe('Test: service/ProxyBackendHandler', function () {
  var
    sandbox;

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('method constructor must throw an error if the backendMode is not standard', () => {
    var
      badBackendMode = 'not standard';

    (function() {
      new ProxyBackendHandler(badBackendMode);
    }).should.throw(new Error(`Backend mode option must be set to "standard"; "${badBackendMode}" given`));
  });

  it('method constructor must initialize the object if the backendMode is standard', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode);

    should(backendHandler.backendMode).be.eql(backendMode);
    should(backendHandler.currentBackend).be.eql(null);
  });

  it('method addBackend close the previous backend connection before attaching a new one if it exists', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'},
      onCloseSpy = sandbox.spy();

    backendHandler.currentBackend = {onConnectionClose: onCloseSpy};

    backendHandler.addBackend(dummyBackend);

    should(onCloseSpy.calledOnce).be.true();
    should(backendHandler.currentBackend).be.eql(dummyBackend);
  });

  it('method addBackend does not close the previous backend connection before attaching a new one if it does not exist', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'};

    backendHandler.currentBackend = null;

    backendHandler.addBackend(dummyBackend);

    should(backendHandler.currentBackend).be.eql(dummyBackend);
  });

  it('method removeBackend removes the backend if it corresponds to the current one', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'};

    backendHandler.currentBackend = dummyBackend;

    backendHandler.removeBackend(dummyBackend);

    should(backendHandler.currentBackend).be.eql(null);
  });

  it('method removeBackend does nothing if the provided backend does not correspond to the current one', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'};

    backendHandler.currentBackend = dummyBackend;

    backendHandler.removeBackend({});

    should(backendHandler.currentBackend).be.eql(dummyBackend);
  });

  it('method getBackend', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'};

    backendHandler.currentBackend = dummyBackend;

    should(backendHandler.getBackend()).be.eql(dummyBackend);
  });

  it('method getAllBackends', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'};

    backendHandler.currentBackend = dummyBackend;

    should(backendHandler.getAllBackends()).be.deepEqual([dummyBackend]);
  });

  it('method getAllBackends', () => {
    var
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode);

    backendHandler.currentBackend = null;

    should(backendHandler.getAllBackends()).be.deepEqual([]);
  });
});

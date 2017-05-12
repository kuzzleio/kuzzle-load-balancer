var
  should = require('should'),
  sinon = require('sinon'),
  ProxyBackendHandler = require.main.require('lib/service/ProxyBackendHandler');

describe('Test: service/ProxyBackendHandler', function () {
  let
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
      // eslint-disable-next-line no-new
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

  it('method addBackend sets the incoming backend as pending to keep the object alive', () => {
    const
      backend = {foo: 'bar'},
      backendHandler = new ProxyBackendHandler('standard');

    backendHandler.addBackend(backend);

    should(backendHandler.pendingBackend)
      .be.exactly(backend);
  });

  it('method activateBackend close the previous backend connection before attaching a new one if it exists', () => {
    const
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'},
      onCloseSpy = sandbox.spy();

    backendHandler.currentBackend = {onConnectionClose: onCloseSpy};
    backendHandler.pendingBackend = dummyBackend;

    backendHandler.activateBackend();

    should(onCloseSpy.calledOnce).be.true();
    should(backendHandler.currentBackend).be.eql(dummyBackend);
  });

  it('method activateBackend does not close the previous backend connection before attaching a new one if it does not exist', () => {
    const
      backendMode = 'standard',
      backendHandler = new ProxyBackendHandler(backendMode),
      dummyBackend = {dummy: 'backend'};

    backendHandler.pendingBackend = dummyBackend;
    backendHandler.currentBackend = null;

    backendHandler.activateBackend();

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

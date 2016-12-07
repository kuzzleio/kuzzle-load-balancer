var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Promise = require('bluebird'),
  KuzzleProxy = rewire('../../lib/core/KuzzleProxy');

describe('lib/core/KuzzleProxy', () => {
  var
    backendHandler = {foo: 'bar'},
    reset,
    proxy;

  beforeEach(() => {
    reset = KuzzleProxy.__set__({
      console: {
        log: sinon.spy(),
        error: sinon.spy()
      },
      Broker: sinon.spy(function () {
        this.init = sinon.spy();                // eslint-disable-line no-invalid-this
      }),
      Context: sinon.spy(function (backend, mode) {
        this.backend = backend;                 // eslint-disable-line no-invalid-this
        this.mode = mode;                       // eslint-disable-line no-invalid-this
        this.pluginStore = {                    // eslint-disable-line no-invalid-this
          add: sinon.spy(),
          count: sinon.stub().returns(2)
        };
        this.setBroker = sinon.spy();           // eslint-disable-line no-invalid-this
      }),
      HttpProxy: sinon.spy(function () {
        this.init = sinon.spy();                // eslint-disable-line no-invalid-this
      }),
      PluginPackage: sinon.spy(function () {
        this.needsInstall = sinon.stub().returns(true);   // eslint-disable-line no-invalid-this
        this.install = sinon.stub().returns(Promise.resolve((function () { return this; })())); // eslint-disable-line no-invalid-this
      })
    });

    proxy = new KuzzleProxy(backendHandler);
  });

  afterEach(() => {
    reset();
  });

  describe('#start', () => {
    it('should call proper methods in order', () => {
      proxy.installPluginsIfNeeded = sinon.stub().returns(Promise.resolve());
      proxy.initPlugins = sinon.spy();
      proxy.initBroker = sinon.spy();
      proxy.initHttpProxy = sinon.spy();

      return proxy.start()
        .then(() => {
          should(proxy.installPluginsIfNeeded)
            .be.calledOnce();
          should(proxy.initPlugins)
            .be.calledOnce();
          should(proxy.initBroker)
            .be.calledOnce();
          should(proxy.initHttpProxy)
            .be.calledOnce();

          sinon.assert.callOrder(
            proxy.installPluginsIfNeeded,
            proxy.initPlugins,
            proxy.initBroker,
            proxy.initHttpProxy
          );
        });
    });
  });

  describe('#installPluginsIfNeeded', () => {
    it('should install plugins if needed', () => {
      return proxy.installPluginsIfNeeded()
        .then((response) => {
          should(KuzzleProxy.__get__('PluginPackage'))
            .be.calledTwice()
            .be.calledWith('kuzzle-plugin-socketio')
            .be.calledWith('kuzzle-plugin-websocket');

          should(response)
            .be.an.Array()
            .have.length(2);
        });
    });
  });

  describe('#initPlugins', () => {
    it('should init plugins', () => {
      var
        pkg = {
          init: sinon.spy()
        };

      return KuzzleProxy.__with__({
        require: sinon.stub().returns(function () { return pkg; })
      })(() => {
        proxy.config.protocolPlugins = {
          foo: {
            activated: true,
            config: {}
          }
        };

        proxy.initPlugins();

        should(pkg.init)
          .be.calledOnce()
          .be.calledWith(proxy.config.protocolPlugins.foo.config, proxy.context);

        should(proxy.context.pluginStore.add)
          .be.calledOnce()
          .be.calledWith(pkg);
      });
    });

    it('should log require errors and not fail', () => {
      proxy.config.protocolPlugins = {
        foo: {
          activated: false,
          config: {}
        },
        bar: {
          activated: true,
          config: {}
        }
      };

      proxy.initPlugins();

      should(KuzzleProxy.__get__('console.log'))
        .be.calledOnce()
        .be.calledWith('Initializing protocol plugin bar');

      should(KuzzleProxy.__get__('console.error'))
        .be.calledOnce()
        .be.calledWith('Initialization of plugin bar has failed; Reason: ');
    });

    it('should fail if no plugin could be init', () => {
      proxy.config.protocolPlugins = {};
      proxy.context.pluginStore.count.returns(0);

      return should(() => proxy.initPlugins())
        .throw('No plugin has been initialized properly. Shutting down.');
    });
  });

  describe('#initBroker', () => {
    it('should init the broker', () => {
      proxy.initBroker();

      should(proxy.context.setBroker)
        .be.calledOnce()
        .be.calledWith(proxy.broker);

      should(proxy.broker.init)
        .be.calledOnce()
        .be.calledWith(proxy.context, proxy.config.backend);
    });
  });

  describe('#initHttpProxy', () => {
    it('should init the http proxy', () => {
      proxy.initHttpProxy();

      should(proxy.httpProxy.init)
        .be.calledOnce()
        .be.calledWith(proxy.context, proxy.config);
    });
  });

});

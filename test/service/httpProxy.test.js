var
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  HttpProxy = rewire('../../lib/service/HttpProxy');

describe('Test: service/HttpProxy', function () {
  var
    sandbox = sinon.sandbox.create(),
    listenerSpy = sandbox.spy(),
    bouncyCallback,
    bouncySpy = sandbox.spy((callback) => {
      bouncyCallback = callback;
      return {listen: listenerSpy};
    }),
    bounceSpy = sandbox.spy();

  before(() => {
    HttpProxy.__set__('bouncy', bouncySpy);
  });

  beforeEach(() => {
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('method init provides the callback to bouncy, call the listen method and call the bounce method if a backend is available when a request is received', () => {
    var
      httpProxy = new HttpProxy(),
      dummySocketIp = 'a socket ip',
      dummyHttpPort = 1234,
      getBackendStub = sandbox.stub().returns({socketIp: dummySocketIp, httpPort: dummyHttpPort}),
      dummyContext = {backendHandler: {getBackend: getBackendStub}};

    httpProxy.init(dummyContext, dummyHttpPort);

    should(bouncySpy.calledOnce).be.true();
    should(bouncySpy.getCall(0).args[0]).be.instanceOf(Function);
    should(listenerSpy.calledOnce).be.true();
    should(listenerSpy.calledWith(dummyHttpPort)).be.true();

    bouncyCallback({}, {}, bounceSpy);

    should(getBackendStub.calledOnce).be.true();
    should(bounceSpy.calledOnce).be.true();
    should(bounceSpy.calledWith(dummySocketIp, dummyHttpPort)).be.true();
  });
  it('method init provides the callback to bouncy, call the listen method and does not call the bounce method if no backend is available when a request is received', () => {
    var
      httpProxy = new HttpProxy(),
      dummyHttpPort = 1234,
      getBackendStub = sandbox.stub().returns(false),
      dummyContext = {backendHandler: {getBackend: getBackendStub}};

    bouncySpy.reset();
    listenerSpy.reset();
    bounceSpy.reset();
    bouncyCallback = null;

    httpProxy.init(dummyContext, dummyHttpPort);

    should(bouncySpy.calledOnce).be.true();
    should(bouncySpy.getCall(0).args[0]).be.instanceOf(Function);
    should(listenerSpy.calledOnce).be.true();
    should(listenerSpy.calledWith(dummyHttpPort)).be.true();

    should(bouncyCallback({}, {}, bounceSpy)).be.false();

    should(getBackendStub.calledOnce).be.true();
    should(bounceSpy.callCount).be.eql(0);
  });
});

'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  PendingRequest = rewire('../../lib/store/PendingRequest'),
  PendingItem = require('../../lib/store/PendingItem'),
  GatewayTimeoutError = require('kuzzle-common-objects').errors.GatewayTimeoutError;

describe('Test: store/PendingRequest', function () {
  let
    spyClearTimeout,
    spySetTimeout;

  beforeEach(() => {
    spyClearTimeout = sinon.stub();
    spySetTimeout = sinon.stub();

    PendingRequest.__set__('setTimeout', spySetTimeout);
    PendingRequest.__set__('clearTimeout', spyClearTimeout);
  });

  afterEach(() => {
  });

  it('constructor must initialize pending', () => {
    let pendingRequest = new PendingRequest(132);

    should(pendingRequest.pending).be.an.Object();
    should(pendingRequest.backendTimeout).be.eql(132);
  });

  it('should add an item to the pending list', () => {
    let
      pendingRequest = new PendingRequest(),
      cb = sinon.stub();

    spySetTimeout.returns('foobar');

    pendingRequest.add('id', {foo: 'bar'}, cb);

    should(spySetTimeout.calledOnce).be.true();
    should(pendingRequest.pending.id).be.instanceOf(PendingItem);
    should(pendingRequest.pending.id.timeout).be.eql('foobar');
    should(pendingRequest.pending.id.callback).be.eql(cb);
  });

  it('should resolve an existing pending item', () => {
    let
      pendingRequest = new PendingRequest(),
      cb = sinon.stub();

    pendingRequest.add('id', {foo: 'bar'}, cb);
    pendingRequest.resolve('id', 'foo', 'bar');

    should(pendingRequest.pending).be.empty();
    should(cb.calledWith('foo', 'bar')).be.true();
  });

  it('should not resolve existing pending items if an unknown id is provided', () => {
    let
      pendingRequest = new PendingRequest(),
      cb = sinon.stub();

    pendingRequest.add('id', {foo: 'bar'}, cb);
    pendingRequest.resolve('foobar', 'foo', 'bar');

    should(pendingRequest.pending.id).be.instanceOf(PendingItem);
    should(cb.called).be.false();
  });

  it('should abort all existing pending items when asked to', () => {
    let
      pendingRequest = new PendingRequest(),
      cb = sinon.stub(),
      cb2 = sinon.stub(),
      error = new Error('foobar');

    spySetTimeout.returns('foobar');

    pendingRequest.add('id', {foo: 'bar'}, cb);
    pendingRequest.add('id2', {foo: 'bar'}, cb2);

    pendingRequest.abortAll(error);

    should(pendingRequest.pending).be.empty();
    should(spyClearTimeout.calledTwice).be.true();
    should(spyClearTimeout.alwaysCalledWith('foobar')).be.true();
    should(cb.calledWith(error)).be.true();
    should(cb2.calledWith(error)).be.true();
  });

  it('should timeout an existing pending item when no response has been received in time', () => {
    let
      pendingRequest,
      cb = sinon.stub(),
      clock = sinon.useFakeTimers();

    PendingRequest.__set__('setTimeout', setTimeout);

    pendingRequest = new PendingRequest(10);

    pendingRequest.add('id', {foo: 'bar'}, cb);

    clock.tick(10);

    should(cb.called).be.true();
    should(cb.firstCall.args.length).be.eql(1);
    should(cb.firstCall.args[0]).be.instanceOf(GatewayTimeoutError);
    should(cb.firstCall.args[0].message).startWith('Kuzzle was too long to respond');

    clock.restore();
  });
});

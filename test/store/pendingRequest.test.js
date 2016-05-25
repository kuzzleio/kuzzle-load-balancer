var
  should = require('should'),
  PendingRequest = require.main.require('lib/store/PendingRequest');

describe('Test: store/PendingRequest', function () {
  var
    dummyPendingExist = {
      connection: {},
      request: {
        requestId: 'exists'
      },
      promise: {}
    },
    dummyPendingDoesNotExist = {
      connection: {},
      request: {
        requestId: 'doesnotexist'
      },
      promise: {}
    };

  it('method add must add an item to the pending', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.add(dummyPendingExist);

    should(pendingRequest.pending[dummyPendingExist.request.requestId]).be.deepEqual(dummyPendingExist);
  });

  it('method getByRequestId must return an item to the pending if it exists', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    should(pendingRequest.getByRequestId(dummyPendingExist.request.requestId)).be.deepEqual(dummyPendingExist);
  });

  it('method getByRequestId must return undefined if an item does not exist in pending', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    should(pendingRequest.getByRequestId(dummyPendingDoesNotExist.request.requestId)).be.undefined();
  });

  it('method existsByRequestId must return true if the item exists', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    should(pendingRequest.existsByRequestId(dummyPendingExist.request.requestId)).be.true();
  });

  it('method existsByRequestId must return false if the item does not exist', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    should(pendingRequest.existsByRequestId(dummyPendingDoesNotExist.request.requestId)).be.false();
  });

  it('method removeByRequestId must remove an item from pending if it exist', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    pendingRequest.removeByRequestId(dummyPendingExist.request.requestId);

    should(Object.keys(pendingRequest.pending).length).be.eql(0);
  });

  it('method removeByRequestId must not remove an item from pending if it does not exist', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    pendingRequest.removeByRequestId(dummyPendingDoesNotExist.request.requestId);

    should(Object.keys(pendingRequest.pending).length).be.eql(1);
  });

  it('method remove must remove an item from pending if it exist', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    pendingRequest.remove(dummyPendingExist);

    should(Object.keys(pendingRequest.pending).length).be.eql(0);
  });

  it('method remove must not remove an item from pending if it does not exist', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    pendingRequest.remove(dummyPendingDoesNotExist);

    should(Object.keys(pendingRequest.pending).length).be.eql(1);
  });

  it('method clear must empty the pending', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    pendingRequest.clear();

    should(Object.keys(pendingRequest.pending).length).be.eql(0);
  });

  it('method getAll must return the pending', () => {
    var pendingRequest = new PendingRequest();

    pendingRequest.pending = {
      [dummyPendingExist.request.requestId]: dummyPendingExist
    };

    ;

    should(pendingRequest.getAll()).be.deepEqual(pendingRequest.pending);
  });
});
var
  CircularList = require('easy-circular-list'),
  should = require('should'),
  BackendConnection = require.main.require('lib/store/BackendConnection');

describe('Test: store/BackendConnection', function () {
  var
    dummyBackendExists = {
      backend: 'exists'
    },
    dummyBackendExistsBis = {
      backend: 'exists_bis'
    },
    dummyBackendDoesNotExist = {
      backend: 'doesnotexist'
    };

  it('constructor must initialize backendConnections', () => {
    var backendConnection = new BackendConnection();

    should(backendConnection.backendConnections).be.an.instanceof(CircularList);
  });

  it('method add must add an item to the backendConnections', () => {
    var backendConnection = new BackendConnection();

    backendConnection.add(dummyBackendExists);

    should(backendConnection.backendConnections.getSize()).be.eql(1);
  });

  it('method remove must remove an item from backendConnections if it exists', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.remove(dummyBackendExists);

    should(backendConnection.backendConnections.getSize()).be.eql(0);
  });

  it('method remove must not remove an item from backendConnections if it does not exist', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.remove(dummyBackendDoesNotExist);

    should(backendConnection.backendConnections.getSize()).be.eql(1);
  });

  it('method count must return the number of stored items', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.backendConnections.add(dummyBackendExistsBis);

    should(backendConnection.count()).be.eql(2);
  });

  it('method getOneBackend must return the expected backend in failover mode', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.backendConnections.add(dummyBackendExistsBis);

    should(backendConnection.getOneBackend('failover')).be.deepEqual(dummyBackendExists);
    should(backendConnection.getOneBackend('failover')).be.deepEqual(dummyBackendExists);
  });

  it('method getOneBackend must return the expected backend in round-robin mode', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.backendConnections.add(dummyBackendExistsBis);

    should(backendConnection.getOneBackend('round-robin')).be.deepEqual(dummyBackendExists);
    should(backendConnection.getOneBackend('round-robin')).be.deepEqual(dummyBackendExistsBis);
    should(backendConnection.getOneBackend('round-robin')).be.deepEqual(dummyBackendExists);
  });

  it('method getOneBackend must throw an exception if mode is unknown', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.backendConnections.add(dummyBackendExistsBis);

    backendConnection.getOneBackend.bind(null, 'unknown').should.throw('Unknown backend mode unknown');
  });

  it('method count must return the number of stored items', () => {
    var backendConnection = new BackendConnection();

    backendConnection.backendConnections.add(dummyBackendExists);
    backendConnection.backendConnections.add(dummyBackendExistsBis);

    should(backendConnection.getAllBackends()).be.deepEqual(backendConnection.backendConnections.getArray());
  });
});
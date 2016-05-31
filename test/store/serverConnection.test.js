var
  CircularList = require('easy-circular-list'),
  should = require('should'),
  ServerConnection = require.main.require('lib/store/ServerConnection');

describe('Test: store/ServerConnection', function () {
  var
    dummyServerExist = {
      server: 'exists'
    },
    dummyServerExistBis = {
      server: 'exists_bis'
    },
    dummyServerDoesNotExist = {
      server: 'doesnotexist'
    };

  it('constructor must initialize serverConnections', () => {
    var serverConnection = new ServerConnection();

    should(serverConnection.serverConnections).be.an.instanceof(CircularList);
  });

  it('method add must add an item to the serverConnections', () => {
    var serverConnection = new ServerConnection();

    serverConnection.add(dummyServerExist);

    should(serverConnection.serverConnections.getSize()).be.eql(1);
  });

  it('method remove must remove an item from serverConnections if it exists', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.remove(dummyServerExist);

    should(serverConnection.serverConnections.getSize()).be.eql(0);
  });

  it('method remove must not remove an item from serverConnections if it does not exist', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.remove(dummyServerDoesNotExist);

    should(serverConnection.serverConnections.getSize()).be.eql(1);
  });

  it('method count must return the number of stored items', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.serverConnections.add(dummyServerExistBis);

    should(serverConnection.count()).be.eql(2);
  });

  it('method getOneServer must return the expected server in failover mode', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.serverConnections.add(dummyServerExistBis);

    should(serverConnection.getOneServer('failover')).be.deepEqual(dummyServerExist);
    should(serverConnection.getOneServer('failover')).be.deepEqual(dummyServerExist);
  });

  it('method getOneServer must return the expected server in round-robin mode', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.serverConnections.add(dummyServerExistBis);

    should(serverConnection.getOneServer('round-robin')).be.deepEqual(dummyServerExist);
    should(serverConnection.getOneServer('round-robin')).be.deepEqual(dummyServerExistBis);
    should(serverConnection.getOneServer('round-robin')).be.deepEqual(dummyServerExist);
  });

  it('method getOneServer must throw an exception if mode is unknown', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.serverConnections.add(dummyServerExistBis);

    serverConnection.getOneServer.bind(null, 'unknown').should.throw('Unknown server mode unknown');
  });

  it('method count must return the number of stored items', () => {
    var serverConnection = new ServerConnection();

    serverConnection.serverConnections.add(dummyServerExist);
    serverConnection.serverConnections.add(dummyServerExistBis);

    should(serverConnection.getAllServers()).be.deepEqual(serverConnection.serverConnections.getArray());
  });
});
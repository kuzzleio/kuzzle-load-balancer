var
  should = require('should'),
  ClientConnection = require.main.require('lib/store/ClientConnection');

describe('Test: store/ClientConnection', function () {
  var
    dummyConnectionExist = {
      socketId: 'exists',
      protocol: 'dummy'
    },
    dummyConnectionDoesNotExist = {
      socketId: 'doesnotexist',
      protocol: 'dummy'
    };

  it('method add must add an item to the clientConnections', () => {
    var clientConnection = new ClientConnection();

    clientConnection.add(dummyConnectionExist);
    should(clientConnection.clientConnections[dummyConnectionExist.socketId]).be.deepEqual(dummyConnectionExist);
  });

  it('method remove must remove an item from the clientConnections if it exists', () => {
    var clientConnection = new ClientConnection();

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    clientConnection.remove(dummyConnectionExist);
    should(Object.keys(clientConnection.clientConnections).length).be.eql(0);
  });

  it('method remove must not remove an item from the clientConnections if it does not exist', () => {
    var clientConnection = new ClientConnection();

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    clientConnection.remove(dummyConnectionDoesNotExist);
    should(Object.keys(clientConnection.clientConnections).length).be.eql(1);
  });

  it('method get must return an item from clientConnections if it exists', () => {
    var clientConnection = new ClientConnection();

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    should(clientConnection.get(dummyConnectionExist)).be.deepEqual(dummyConnectionExist);
  });

  it('method get must return undefined if the item doesn not exist in clientConnections', () => {
    var clientConnection = new ClientConnection();

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    should(clientConnection.get(dummyConnectionDoesNotExist)).be.undefined();
  });

  it('method getBySocketId must return an item from clientConnections if it exists', () => {
    var clientConnection = new ClientConnection()

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    should(clientConnection.getBySocketId(dummyConnectionExist.socketId)).be.deepEqual(dummyConnectionExist);
  });

  it('method get must return undefined if the item doesn not exist in clientConnections', () => {
    var clientConnection = new ClientConnection();

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    should(clientConnection.getBySocketId(dummyConnectionDoesNotExist.socketId)).be.undefined();
  });

  it('method getAll must return clientConnections', () => {
    var clientConnection = new ClientConnection();

    clientConnection.clientConnections = {
      [dummyConnectionExist.socketId]: dummyConnectionExist
    };

    should(clientConnection.getAll()).be.deepEqual(clientConnection.clientConnections);
  });
});

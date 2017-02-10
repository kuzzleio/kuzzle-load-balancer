'use strict';

const
  should = require('should'),
  ClientConnection = require('../../lib/store/ClientConnection');

describe('store/clientConnection', () => {
  let
    store;

  beforeEach(() => {
    store = new ClientConnection();
  });

  describe('#add', () => {
    it('should add a new connection', () => {
      const connection = {id: 'connectionId'};
      store.add(connection);

      should(store.clientConnections.connectionId)
        .be.exactly(connection);
    });
  });

  describe('#remove', () => {
    it('should do nothing is the connection is unknown', () => {
      store.clientConnections.id = {foo: 'bar'};
      store.remove('wrong id');

      should(Object.keys(store.clientConnections))
        .have.length(1);
    });

    it('should remove the conneciton', () => {
      store.clientConnections.id = {foo: 'bar'};
      store.remove('id');

      should(store.clientConnections)
        .be.empty();
    });
  });

  describe('#get', () => {
    it('should, given a connection Id, return the matching connection', () => {
      const connection = {foo: 'bar'};
      store.clientConnections.id = connection;

      should(store.get('id'))
        .be.exactly(connection);
    });

    it('should return undefined if the given id does not match any connection in the store', () => {
      should(store.get('id'))
        .be.undefined();
    });
  });

  describe('#getAll', () => {
    it('should return the store connections as an array', () => {
      store.clientConnections.foo = 'bar';
      store.clientConnections.bar = 'baz';
      store.clientConnections.blah = 'blah';

      should(store.getAll())
        .match([
          'bar',
          'baz',
          'blah'
        ]);
    });
  });
});

var
  should = require('should'),
  ProtocolStore = require.main.require('lib/store/Protocol');

describe('Test: store/Protocol', function () {
  var
    dummyProtocol = {foo: 'bar'};

  it('constructor must initialize protocols', () => {
    var protocolStore = new ProtocolStore();

    should(protocolStore.protocols).be.an.Object();
  });


  it('method add must add an item to the protocols', () => {
    var
      protocolStore = new ProtocolStore();

    protocolStore.add('dummy', dummyProtocol);
    should(protocolStore.protocols.dummy).be.deepEqual(dummyProtocol);
  });

  it('method get must return an item if protocol exists', () => {
    var protocolStore = new ProtocolStore();

    protocolStore.protocols = {dummy: dummyProtocol};

    should(protocolStore.get('dummy')).be.deepEqual(dummyProtocol);
  });

  it('method get must return undefined if protocol does not exist', () => {
    var protocolStore = new ProtocolStore();

    protocolStore.protocols = {dummy: dummyProtocol};

    should(protocolStore.get('notexists')).be.undefined();
  });

  it('method count must count the number of declared protocols properly', () => {
    var protocolStore = new ProtocolStore();

    protocolStore.protocols = {dummy: dummyProtocol};

    should(protocolStore.count()).be.eql(1);
  });
});

const
  should = require('should'),
  ClientConnection = require('../../lib/core/clientConnection');

describe('core/clientConnection', () => {
  describe('#constructor', () => {
    it('should throw if ips is not an array', () => {
      return should(() => new ClientConnection('protocol', 'ips'))
        .throw(TypeError, {message: 'Expected ips to be an Array, got string'});
    });
  });
});

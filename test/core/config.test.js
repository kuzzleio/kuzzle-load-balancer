var
  rewire = require('rewire'),
  should = require('should'),
  Config = rewire('../../lib/core/config');

describe('lib/core/config', () => {
  describe('#unstringify', () => {
    it('should parse arguments properly', () => {
      var
        unstringify = Config.__get__('unstringify'),
        response = unstringify({
          foo: {
            bar: {
              bool: 'true',
              version: '1.1',
              float: '42.5',
              int: '42',
              nested: {
                bool: 'false',
                version: '2.0',
                float: '0.5',
                int: '24'
              }
            }
          }
        });

      should(response).match({
        foo: {
          bar: {
            bool: true,
            version: '1.1',
            float: 42.5,
            int: 42,
            nested: {
              bool: false,
              version: '2.0',
              float: 0.5,
              int: 24
            }
          }
        }
      });
    });
  });
});

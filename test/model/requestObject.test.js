var
  should = require('should'),
  RequestObject = require.main.require('lib/model/RequestObject');

describe('Test: model/RequestObject', function () {

  it('Contructor must return the same data as provided in argument', () => {
    var
      data = {
        dummy: 'data'
      },
      requestObject = new RequestObject(data);

    should(requestObject).be.deepEqual(data);
  });
});

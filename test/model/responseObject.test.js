var
  should = require('should'),
  ResponseObject = require.main.require('lib/model/ResponseObject');

describe('Test: model/ResponseObject', function () {

  it('method toJson must return the same data as provided in constructor argument', () => {
    var
      data = {
        dummy: 'data'
      },
      responseObject = new ResponseObject(data);

    should(responseObject.toJson()).be.deepEqual(data);
  });
});

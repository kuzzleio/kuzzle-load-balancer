var
  bouncy = require('bouncy'),
  ServiceUnavailableError = require('kuzzle-common-objects').Errors.serviceUnavailableError;

function HttpProxy () {

}

HttpProxy.prototype.init = function (context, httpPort) {
  bouncy((req, res, bounce) => {
    var
      backend = context.backendHandler.getBackend(),
      err;

    if (!backend) {
      err = new ServiceUnavailableError('No Kuzzle instance available');
      res.writeHead(err.status, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(err));
      return false;
    }

    // Proxyfy the request to a backend
    bounce(backend.socketIp, backend.httpPort);
  }).listen(httpPort);
};

module.exports = HttpProxy;

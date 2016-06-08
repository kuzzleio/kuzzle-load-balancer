var bouncy = require('bouncy');

function HttpProxy () {

}

HttpProxy.prototype.init = function (backendMode, context, httpPort) {
  bouncy((req, res, bounce) => {
    var backend = context.backendHandler.getBackend();

    if (!backend) {
      /** TODO: return an error to the client "No backend found" or manage a pending */
      return false;
    }

    // Proxyfy the request to a backend
    bounce(backend.socketIp, backend.httpPort);
  }).listen(httpPort);
};

module.exports = HttpProxy;

var bouncy = require('bouncy');

function HttpProxy () {

}

HttpProxy.prototype.init = function (serverMode, context, httpPort) {
  bouncy((req, res, bounce) => {
    var server = context.serverConnectionStore.getOneServer(serverMode);

    if (!server) {
      /** TODO: return an error to the client "No server found" or something */
      return false;
    }

    // Proxyfy the request to a Kuzzle server
    bounce(server.socketIp, server.httpPort);
  }).listen(httpPort);
};

module.exports = HttpProxy;

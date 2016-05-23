var bouncy = require('bouncy');

function HttpProxy () {

}

HttpProxy.prototype.init = function (serverMode, context, httpPort) {
  bouncy((req, res, bounce) => {
    var server = context.serverConnectionStore.getOneServer(serverMode);

    // Proxyfy the request to a Kuzzle server
    bounce(server.socketIp, server.httpPort);
  }).listen(httpPort);
};

module.exports = HttpProxy;
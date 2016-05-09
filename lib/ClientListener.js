var
  q = require('q');

module.exports = function ClientListener () {
  var
    http = require('http').Server(),
    ioServer = require('socket.io')(http);

  this.initilizeServer = (clientPort, clientRoom, brokerCallback) => {
    ioServer.set('origins', '*:*');

    ioServer.on('connection', (socket) => {
      socket.on(clientRoom, function (message) {
        console.log(message.requestId, socket.id);
        brokerCallback(socket, message);
      });
    });

    return q
      .ninvoke(http, 'listen', clientPort)
      .then(() => {
        console.log(`Listening on *: ${clientPort}`);
        return q({});
      });
  };
  
  this.listenerCallback = (socketId, data) => {
    console.log(data);
    if (ioServer.sockets.connected[socketId]) {
      //this.io.sockets.connected[data.id].emit(data.channel, data.payload);
    }
  };
};


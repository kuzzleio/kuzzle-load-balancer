var
  q = require('q');

module.exports = function ClientListener () {
  var
    http = require('http').Server(),
    ioServer = require('socket.io')(http);

  this.initilizeServer = (clientPort, clientRoom, brokerCallback) => {
    ioServer.set('origins', '*:*');

    ioServer.on('connection', (socket) => {
      brokerCallback(socket.id, {
        webSocketId: socket.id,
        webSocketMessageType: 'connection'
      });

      socket.on(clientRoom, function (message) {
        // Add multiplexer specific fields
        message.webSocketId = socket.id;
        message.webSocketMessageType = 'message';

        brokerCallback(socket.id, message);
      });

      socket.on('disconnect', () => {
        brokerCallback(socket.id, {
          webSocketId: socket.id,
          webSocketMessageType: 'disconnect'
        });
      });

      socket.on('error', () => {
        brokerCallback(socket.id, {
          webSocketId: socket.id,
          webSocketMessageType: 'error'
        });
      });
    });

    return q
      .ninvoke(http, 'listen', clientPort)
      .then(() => {
        console.log(`Listening on *: ${clientPort}`);
        return q({});
      });
  };
  
  this.listenerCallback = (request, data) => {
    if (data.payload && data.channel && data.webSocketId && ioServer.sockets.connected[data.webSocketId]) {
      ioServer.to(data.webSocketId).emit(data.channel, data.payload);
    } else if (request && ioServer.sockets.connected[request.socketId]) {
      ioServer.to(request.socketId).emit(data.requestId, data);
    }
  };
};


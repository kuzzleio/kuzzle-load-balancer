var
  WebSocketServer = require('ws').Server,
  CircularList = require('easy-circular-list'),
  q = require('q');

module.exports = function Broker () {
  var
    serverConnections = new CircularList(),
    serverMode,
    socketOptions,
    pending = {};

  this.initializeBroker = (mode, webSocketOptions, listenerCallback) => {
    socketOptions = webSocketOptions || {reconnectionAttempts: 3};

    if (['sticky', 'roundrobin'].indexOf(mode) === -1) {
      q.reject(new Error(`Server mode must be either sticky or roundrobin; "${mode}" given`));
    }

    serverMode = mode;
    
    this.initiateServer(socketOptions, listenerCallback);
  };

  this.initiateServer = (webSocketOptions, listenerCallback) => {
    var webSocket;

    console.log(`Waiting for connections on port ${webSocketOptions.port}`);

    webSocket = new WebSocketServer({port: webSocketOptions.port});

    webSocket.on('connection', (serverSocket) => {
      console.log(`A connection has been established with server ${serverSocket.upgradeReq.connection.remoteAddress}`);
      console.log(serverSocket);

      serverConnections.add(serverSocket);

      if (serverConnections.getSize() === 1) {
        this.resendPending();
      }

      serverSocket.on('close', () => {
        console.log(`Connection with server ${serverSocket.upgradeReq.connection.remoteAddress} closed.`);
        serverConnections.remove(serverSocket);
        if (serverConnections.getSize() > 0) {
          this.resendPending();
        }
      });

      serverSocket.on('error', (error) => {
        console.error(error);
      });

      serverSocket.on('message', (data) => {
        var dataObject = JSON.parse(data);
        console.log('listener', dataObject);

        if (dataObject.requestId) {
          listenerCallback(pending[dataObject.requestId], dataObject);
          delete pending[dataObject.requestId];
        } else {
          listenerCallback(null, dataObject);
        }
      });
    });
  };

  this.resendPending = () => {
    Object.keys(pending).forEach((requestId) => {
      this.brokerCallback(pending[requestId].socketId, pending[requestId].request);
    });
  };

  /**
   * Sends the client's message to one of the servers
   *
   * @param socketId Client socket
   * @param message Client message
   */
  this.brokerCallback = (socketId, message) => {
    var serverSocket = this.getOneServer();
    if (!serverSocket) {
      // TODO : trigger 503
      console.error('No server is connected yet');
    } else if (typeof message === 'object' && (message.requestId || message.webSocketMessageType !== 'message')) {
      pending[message.requestId] = {
        socketId: socketId,
        request: message
      };

      serverSocket.send(JSON.stringify(message));
    } else {
      console.error(`Bad message : ${message}`);
    }
  };

  this.getOneServer = () => {
    switch (serverMode) {
      case 'sticky':
        if (serverConnections.getCurrent()) {
          return serverConnections.getCurrent();
        }

        return serverConnections.getNext();
      case 'roundrobin':
        return serverConnections.getNext();
    }
  };
};
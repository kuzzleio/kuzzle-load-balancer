var
  WebSocketServer = require('ws').Server,
  CircularList = require('easy-circular-list'),
  ResponseObjectWrapper = require('./ResponseObjectWrapper'),
  q = require('q');

module.exports = function Broker () {
  var
    serverConnections = new CircularList(),
    serverMode,
    socketOptions,
    pluginObjects,
    clientConnections = {},
    pending = {};

  this.initializeBroker = (mode, webSocketOptions, plugins) => {
    pluginObjects = plugins;
    socketOptions = webSocketOptions || {reconnectionAttempts: 3};

    if (['failover', 'roundrobin'].indexOf(mode) === -1) {
      q.reject(new Error(`Server mode option must be either set to "failover" or "roundrobin"; "${mode}" given`));
    }

    serverMode = mode;
    
    this.initiateServer(socketOptions);
  };

  this.initiateServer = (webSocketOptions) => {
    var webSocket;

    console.log(`Waiting for connections on port ${webSocketOptions.port}`);

    webSocket = new WebSocketServer({port: webSocketOptions.port});

    webSocket.on('connection', (serverSocket) => {
      var deferred = q.defer();
      // TODO initialize all client connections, don't add the server in the system before it is fully initialized
      console.log(`A connection has been established with server ${serverSocket.upgradeReq.connection.remoteAddress}`);

      deferred.promise.then(() => {
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
          var
            dataObject = JSON.parse(data),
            responseObjectWrapper,
            clientProtocol;

          if (dataObject.requestId && pending[dataObject.requestId]) {
            responseObjectWrapper = new ResponseObjectWrapper(dataObject);
            pending[dataObject.requestId].promise.resolve(responseObjectWrapper);
            delete pending[dataObject.requestId];
          } else if (dataObject.webSocketId && clientConnections[dataObject.webSocketId]) {
            clientProtocol = clientConnections[dataObject.webSocketId];
            dataObject.id = dataObject.webSocketId;
            pluginObjects[clientProtocol].notify(dataObject);
          } else {
            // We discard the message as the recipient is unknown and we can't do anything about it
          }
        });
      })

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
   * @param connection Client connection descriptor
   * @param message Client message
   * @param promise Client promise to resolve
   */
  this.brokerCallback = (connection, message, promise) => {
    var serverSocket = this.getOneServer();
    if (!serverSocket) {
      pending[message.requestId] = {
        connection,
        request: message,
        promise
      };
    } else if (typeof message === 'object' && (message.requestId || message.webSocketMessageType !== 'message')) {
      pending[message.requestId] = {
        connection,
        request: message,
        promise
      };

      serverSocket.send(JSON.stringify(message));
    } else {
      console.error(`Bad message : ${message}`);
    }
  };

  this.addClientConnection = (connection) => {
    this.broadcastMessage({
      webSocketId: connection.socketId,
      webSocketMessageType: 'connection'
    });

    clientConnections[connection.socketId] = connection.protocol;
  };

  this.removeClientConnection = (connection) => {
    this.broadcastMessage({
      webSocketId: connection.socketId,
      webSocketMessageType: 'disconnect'
    });
    delete clientConnections[connection.socketId];
  };

  this.getClientConnection = (connection) => {
    return clientConnections[connection.socketId];
  };

  this.broadcastMessage = (messageObject) => {
    var servers = this.getAllServers();
    var message = JSON.stringify(messageObject);
    servers.forEach((serverSocket) => {
      serverSocket.send(message);
    });
  };

  this.getOneServer = () => {
    switch (serverMode) {
      case 'failover':
        if (serverConnections.getCurrent()) {
          return serverConnections.getCurrent();
        }

        return serverConnections.getNext();
      case 'roundrobin':
        return serverConnections.getNext();
    }
  };

  this.getAllServers = () => {
    return serverConnections.getArray();
  };
};
var
  WebSocket = require('ws'),
  CircularList = require('easy-circular-list'),
  q = require('q'),
  async = require('async'),
  leftPad = require('left-pad');

module.exports = function Broker () {
  var
    serverConnections = new CircularList(),
    serverMode,
    socketOptions,
    pending = {};

  this.initializeBroker = (serverUrls, mode, webSocketOptions, listenerCallback) => {
    var deferred;
    socketOptions = webSocketOptions || {reconnectionAttempts: 3};

    if (!serverUrls || serverUrls.length === 0) {
      q.reject(new Error('At least one server must be specified'));
    }

    if (['sticky', 'roundrobin'].indexOf(mode) === -1) {
      q.reject(new Error(`Server mode must be either sticky or roundrobin; "${mode}" given`));
    }

    deferred = q.defer();
    serverMode = mode;

    async.each(
      serverUrls,
      (serverUrl, asyncCallback) => {
        var attempt = 0;

        this.initiateConnection(serverUrl, attempt, listenerCallback, asyncCallback);
      },
      (error) => {
        if (error) {
          return deferred.reject(error);
        }

        if (serverConnections.getSize() === 0) {
          deferred.reject(new Error('All servers were unreachable, check configuration'));
        }

        if (serverMode === 'sticky') {
          // We iterate to the first server in the list
          serverConnections.iterate();
        }

        return deferred.resolve({});
      }
    );

    return deferred.promise;
  };

  this.initiateConnection = (serverUrl, attempt, listenerCallback, asyncCallback) => {
    var webSocket;

    console.log(`Connection attempt with ${serverUrl}`);

    webSocket = new WebSocket(serverUrl);
    webSocket.on('open', () => {
      attempt = 0;
      console.log(`Connection established with ${serverUrl}`);

      serverConnections.add(webSocket);
      if (asyncCallback) {
        asyncCallback();
      }
    });

    webSocket.on('close', () => {
      attempt++;
      serverConnections.remove(webSocket);
      if (attempt <= socketOptions.reconnectionAttempts || socketOptions.reconnectionAttempts === -1) {
        console.log(`[Attempt n°${leftPad(attempt, 4)}] Connection failed with ${serverUrl}; will retry in a ${socketOptions.retryInterval} ms`);

        setTimeout(() => {
          this.initiateConnection(serverUrl, attempt, listenerCallback);
        }, socketOptions.retryInterval);
      } else {
        console.warn(`Server is unreachable ${serverUrl}; it will be removed from server pool`);
        if (asyncCallback) {
          asyncCallback();
        }
      }
    });

    webSocket.on('error', (error) => {
      console.error(error);
    });

    webSocket.on('message', (data) => {
      console.log('listener', data);

      if (data.requestId) {
        listenerCallback(pending[data.requestId], data);
        delete pending[data.requestId];
      } else {
        console.error(`Data doesn't contain requestId : ${data}`);
      }
    });
  };

  /**
   * Sends the client's message to on of the servers
   *
   * @param socket Client socket
   * @param message Client message
   */
  this.brokerCallback = (socket, message) => {
    var serverSocket = this.getOneServer();
    if (typeof message === 'object' && message.requestId) {
      pending[message.requestId] = socket.id;

      // Add multiplexer specific fields
      message.webSocketId = socket.id;
      message.webSocketMessageType = 'message';

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
var
  q = require('q');

module.exports = function Context (broker) {
  this.RequestObject = function(object, additionalData, protocol) {
    return object;
  };

  this.getRouter = function () {
    return {
      newConnection: function (protocol, socketId) {
        var
          connectionAttempt = {
            socketId,
            protocol
        };
        var currentConnection = broker.getClientConnection(connectionAttempt);
        if (!currentConnection || connectionAttempt.protocol !== currentConnection.protocol) {
          broker.addClientConnection(connectionAttempt);
        }

        return q(connectionAttempt);
      },
      execute: function (requestObject, connection, callback) {
        var deferred = q.defer();
        requestObject.webSocketId = connection.socketId;
        requestObject.webSocketMessageType = 'message';

        broker.brokerCallback(connection, requestObject, deferred);

        return deferred.promise
          .then((responseObject) => {
            callback(null, responseObject);
          })
          .catch((error) => {
            callback(error);
          });
      },
      removeConnection: function(connection) {
        if (connection.socketId && broker.getClientConnection(connection)) {
          broker.removeClientConnection(connection);
        }
      }
    };
  };
};
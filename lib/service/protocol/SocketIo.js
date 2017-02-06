'use strict';

const
  _protocol = 'socketio',
  ClientConnection = require('../../core/clientConnection'),
  Request = require('kuzzle-common-objects').Request;

let
  _proxy = {};

/**
 * @constructor
 */
function SocketIo () {
  this.sockets = {};
  this.io = null;

  this.init = function (proxy) {
    _proxy = proxy;

    if (_proxy.config.socketio.enabled) {
      this.io = require('socket.io')(proxy.httpProxy.server);
      this.io.set('origins', '*:*');

      this.io.on('connection', this.onConnection.bind(this));
      this.io.on('error', this.onServerError.bind(this));

      _proxy.protocolStore.add(_protocol, this);
    }
  };

  this.onServerError = function (error) {
    _proxy.log.error('[socketio] An error has occured:\n' + error.stack);
  };

  this.onConnection = function (socket) {
    let ips = [socket.handshake.address];
    if (socket.handshake.headers['x-forwarded-for']) {
      ips = socket.handshake.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection(_protocol, ips, socket.handshake.headers);

    try {
      _proxy.router.newConnection(connection);
    }
    catch (err) {
      _proxy.log.error('[socketio] Unable to register connection to the proxy\n%s', err.stack);
      return socket.disconnect();
    }

    this.sockets[connection.id] = socket;

    socket.on('disconnect', () => {
      this.onClientDisconnection(connection.id);
    });

    socket.on('error', () => {
      this.onClientDisconnection(connection.id);
    });

    socket.on('kuzzle', data => {
      this.onClientMessage(socket, connection.id, data);
    });
  };

  this.onClientDisconnection = function (clientId) {
    if (this.sockets[clientId]) {
      delete this.sockets[clientId];
      _proxy.router.removeConnection(clientId);
    }
  };

  this.onClientMessage = function (socket, clientId, data) {
    if (data && this.sockets[clientId]) {
      let request;

      try {
        request = new Request(data, {
          connectionId: clientId,
          protocol: _protocol
        });
      }
      catch (e) {
        return this.io.to(socket.id).emit(data.requestId, {
          status: 400,
          error: {
            message: e.message
          }
        });
      }

      _proxy.router.execute(request, response => {
        this.io.to(socket.id).emit(request.id, response.content);
      });
    }
  };

  this.broadcast = function (data) {
    data.channels.forEach(channel => {
      this.io.to(channel).emit(channel, data.payload);
    });
  };

  this.notify = function (data) {
    if (this.sockets[data.connectionId]) {
      data.channels.forEach(channel => {
        this.sockets[data.connectionId].emit(channel, data.payload);
      });
    }
  };

  this.joinChannel = function (data) {
    if (this.sockets[data.connectionId]) {
      this.sockets[data.connectionId].join(data.channel);
    }
  };

  this.leaveChannel = function (data) {
    if (this.sockets[data.connectionId]) {
      this.sockets[data.connectionId].leave(data.channel);
    }
  };

  this.disconnect = function (connectionId) {
    if (this.sockets[connectionId]) {
      this.sockets[connectionId].disconnect();
    }
  };
}

module.exports = SocketIo;

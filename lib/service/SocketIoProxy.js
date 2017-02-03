'use strict';

const
  _protocol = 'socketio',
  ClientConnection = require('../core/clientConnection'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

let
  _proxy = {};

/**
 * @constructor
 */
function SocketIoProxy () {
  this.sockets = {};
  this.socketIdToConnectionId = {};
  this.io = null;

  this.init = function (proxy) {
    _proxy = proxy;

    this.io = require('socket.io')(proxy.httpProxy.server);
    this.io.set('origins', '*:*');

    this.io.on('connection', this.onConnection.bind(this));
    this.io.on('error', this.onServerError.bind(this));

    _proxy.protocolStore.add(_protocol, this);

    return this;
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
      return;
    }

    this.sockets[connection.id] = socket;
    this.socketIdToConnectionId[socket.id] = connection.id;

    socket.on('disconnect', () => {
      this.onClientDisconnection(socket.id);
    });

    socket.on('error', () => {
      this.onClientDisconnection(socket.id);
    });

    socket.on('kuzzle', data => {
      this.onClientMessage(socket.id, data);
    });
  };

  this.onClientDisconnection = function (socketId) {
    const connectionId = this.socketIdToConnectionId[socketId];

    if (connectionId) {
      delete this.sockets[connectionId];
      delete this.socketIdToConnectionId[socketId];
    }
    _proxy.router.removeConnection(socketId);
  };

  this.onClientMessage = function (socketId, data) {
    if (data && this.socketIdToConnectionId[socketId]) {
      let request;

      try {
        request = new Request(data, {
          connectionId: this.socketIdToConnectionId[socketId],
          protocol: _protocol
        });
      }
      catch (e) {
        this.io.to(socketId).emit(socketId, JSON.stringify(new BadRequestError(e.message)));
        return;
      }

      _proxy.router.execute(request, response => {
        this.io.to(socketId).emit(request.id, response.content);
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

module.exports = SocketIoProxy;

'use strict';

const
  _protocol = 'socketio',
  debug = require('debug')('kuzzle-proxy:socketio-protocol'),
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
    debug('initializing socketIo Server with config:\n%O', proxy.config.socketio);

    if (! proxy.config.socketio.enabled) {
      return;
    }

    _proxy = proxy;

    // SocketIo server listens by default to "/socket.io" path
    // (see (http://socket.io/docs/server-api/#server#path(v:string):server))
    this.io = require('socket.io')(proxy.httpProxy.server);

    this.io.set('origins', proxy.config.socketio.origins);

    this.io.on('connection', this.onConnection.bind(this));
    this.io.on('error', this.onServerError.bind(this));

    _proxy.protocolStore.add(_protocol, this);
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
    debug('[%s] creating SocketIO connection on socket %s', connection.id, socket.id);

    try {
      _proxy.router.newConnection(connection);
    }
    catch (err) {
      _proxy.log.error('[socketio] Unable to register connection to the proxy\n%s', err.stack);
      return socket.disconnect();
    }

    this.sockets[connection.id] = socket;

    socket.on('disconnect', () => {
      debug('[%s] receiving a `disconnect` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('error', () => {
      debug('[%s] receiving a `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('kuzzle', data => {
      debug('[%s] receiving a `kuzzle` event', connection.id);
      this.onClientMessage(socket, connection.id, data);
    });
  };

  this.onClientDisconnection = function (clientId) {
    debug('[%s] onClientDisconnection', clientId);

    if (this.sockets[clientId]) {
      delete this.sockets[clientId];
      _proxy.router.removeConnection(clientId);
    }
  };

  this.onClientMessage = function (socket, clientId, data) {
    if (data && this.sockets[clientId]) {
      let request;

      if (data.toString().length > _proxy.httpProxy.maxRequestSize) {
        _proxy.log.error('[socketio] Input message length(' + data.length + ') exceed maxRequestSize: ' + _proxy.httpProxy.maxRequestSize);
        return this.io.to(socket.id).emit(data.requestId, {
          status: 413,
          error: {message: 'Error: maximum input request size exceeded'}
        });
      }

      debug('[%s] onClientMessage:\n%O', clientId, data);

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
    debug('broadcast:\n%O', data);

    data.channels.forEach(channel => {
      this.io.to(channel).emit(channel, data.payload);
    });
  };

  this.notify = function (data) {
    debug('notify:\n%O', data);

    if (this.sockets[data.connectionId]) {
      data.channels.forEach(channel => {
        this.sockets[data.connectionId].emit(channel, data.payload);
      });
    }
  };

  this.joinChannel = function (data) {
    debug('joinChannel:\n%O', data);

    if (this.sockets[data.connectionId]) {
      this.sockets[data.connectionId].join(data.channel);
    }
  };

  this.leaveChannel = function (data) {
    debug('leaveChannel:\n%O', data);

    if (this.sockets[data.connectionId]) {
      this.sockets[data.connectionId].leave(data.channel);
    }
  };

  this.disconnect = function (connectionId) {
    debug('[%s]disconnect', connectionId);
    if (this.sockets[connectionId]) {
      this.sockets[connectionId].disconnect();
    }
  };
}

module.exports = SocketIo;

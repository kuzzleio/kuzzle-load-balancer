'use strict';

const
  _protocol = 'websocket',
  WebSocketServer = require('ws').Server,
  ClientConnection = require('../../core/clientConnection'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

let
  _proxy = {};

/**
 * @constructor
 */
function Websocket () {
  this.channels = {};
  this.connectionPool = {};
  this.server = null;

  this.init = function (proxy) {
    if (! _proxy.config.websocket.enabled) {
      return;
    }

    _proxy = proxy;

    this.server = new WebSocketServer({server: proxy.httpProxy.server}, {perMessageDeflate: false});

    this.server.on('connection', this.onConnection.bind(this));
    this.server.on('error', this.onServerError.bind(this));

    _proxy.protocolStore.add(_protocol, this);
  };

  this.onServerError = function (error) {
    _proxy.log.error('[websocket] An error has occured:\n' + error.stack);
  };

  this.onConnection = function (clientSocket) {
    let ips = [clientSocket.upgradeReq.connection.remoteAddress];
    if (clientSocket.upgradeReq.headers['x-forwarded-for']) {
      ips = clientSocket.upgradeReq.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection(_protocol, ips, clientSocket.upgradeReq.headers);

    try {
      _proxy.router.newConnection(connection);
    }
    catch (err) {
      _proxy.log.error('[websocket] Unable to register connection to the proxy\n%s', err.stack);
      // Using the 4xxx code range, as the current implementation of
      // the "ws" library does not support the 1013 (Try Again Later)
      // error event
      return clientSocket.close(4000 + err.status, err.message);
    }

    this.connectionPool[connection.id] = {
      alive: true,
      socket: clientSocket,
      channels: []
    };

    clientSocket.on('close', () => {
      this.onClientDisconnection(connection.id);
    });

    clientSocket.on('error', () => {
      this.onClientDisconnection(connection.id);
    });

    clientSocket.on('message', data => {
      this.onClientMessage(connection.id, data);
    });
  };

  this.onClientDisconnection = function (clientId) {
    if (this.connectionPool[clientId]) {
      this.connectionPool[clientId].alive = false;
      _proxy.router.removeConnection(clientId);

      this.connectionPool[clientId].channels.forEach(channel => {
        if (this.channels[channel] && this.channels[channel].count > 1) {
          delete this.channels[channel][clientId];
          this.channels[channel].count--;
        }
        else {
          delete this.channels[channel];
        }
      });

      delete this.connectionPool[clientId];
    }
  };

  this.onClientMessage = function (clientId, data) {
    if (data && this.connectionPool[clientId]) {
      let parsed;

      try {
        parsed = JSON.parse(data);
      }
      catch (e) {
        /*
         we cannot add a "room" information since we need to extract
         a request ID from the incoming data, which is apparently
         not a valid JSON
         So... the error is forwarded to the client, hoping he know
         what to do with it.
         */
        return send(this.connectionPool, clientId, JSON.stringify(new BadRequestError(e.message)));
      }

      let request;

      try {
        request = new Request(parsed, {
          connectionId: clientId,
          protocol: _protocol
        });
      }
      catch (e) {
        let errobj = {
          room: parsed.requestId,
          status: 400,
          error: {
            message: e.message
          }
        };

        return send(this.connectionPool, clientId, JSON.stringify(errobj));
      }

      _proxy.router.execute(request, response => {
        if (response.content && typeof response.content === 'object') {
          response.content.room = response.requestId;
        }
        send(this.connectionPool, clientId, JSON.stringify(response.content));
      });
    }
  };

  this.broadcast = function (data) {
    /*
     Avoids stringifying the payload multiple times just to update the room:
      - we start deleting the last character, which is the closing JSON bracket ('}')
      - we then only have to inject the following string to each channel:
        ,"room":"<roomID>"}

      So, instead of stringifying the payload for each channel, we only concat
      a new substring to the original payload.
     */
    const payload = JSON.stringify(data.payload).slice(0, -1) + ',"room":"';

    data.channels.forEach(channel => {
      if (this.channels[channel]) {
        const channelPayload = payload + channel + '"}';

        Object.keys(this.channels[channel]).forEach(connectionId => {
          send(this.connectionPool, connectionId, channelPayload);
        });
      }
    });
  };

  this.notify = function (data) {
    const payload = data.payload;

    data.channels.forEach(channel => {
      payload.room = channel;
      send(this.connectionPool, data.connectionId, JSON.stringify(payload));
    });
  };

  this.joinChannel = function (data) {
    if (this.connectionPool[data.connectionId] && this.connectionPool[data.connectionId].alive) {
      if (!this.channels[data.channel]) {
        this.channels[data.channel] = {
          count: 0
        };
      }

      this.channels[data.channel][data.connectionId] = true;
      this.channels[data.channel].count++;
      this.connectionPool[data.connectionId].channels.push(data.channel);
    }
  };

  this.leaveChannel = function (data) {
    var index;

    if (this.connectionPool[data.connectionId] && this.connectionPool[data.connectionId].alive && this.channels[data.channel] && this.channels[data.channel][data.connectionId]) {
      if (this.channels[data.channel].count > 1) {
        delete this.channels[data.channel][data.connectionId];
        this.channels[data.channel].count--;
      }
      else {
        delete this.channels[data.channel];
      }

      index = this.connectionPool[data.connectionId].channels.indexOf(data.channel);

      if (index !== -1) {
        this.connectionPool[data.connectionId].channels.splice(index, 1);
      }
    }
  };

  this.disconnect = function (clientId) {
    if (this.connectionPool[clientId]) {
      this.connectionPool[clientId].socket.close('CLOSEDONREQUEST', 'Connection closed by remote host');
    }
  };
}

function send(pool, id, data) {
  if (pool[id] && pool[id].alive && pool[id].socket.readyState === pool[id].socket.OPEN) {
    pool[id].socket.send(data);
  }
}

module.exports = Websocket;

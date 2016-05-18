var
  CircularList = require('easy-circular-list'),
  serverConnections = new CircularList();

function ServerConnection() {
}

ServerConnection.prototype.add = server => {
  serverConnections.add(server);
};

ServerConnection.prototype.remove = server => {
  serverConnections.remove(server);
};

ServerConnection.prototype.count = () => {
  serverConnections.getSize();
};

ServerConnection.prototype.getArray = () => {
  serverConnections.getArray();
};

ServerConnection.prototype.getNext = () => {
  return serverConnections.getNext();
};

ServerConnection.prototype.getCurrent = () => {
  return serverConnections.getCurrent();
};

module.exports = ServerConnection;
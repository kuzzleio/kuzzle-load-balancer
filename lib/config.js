module.exports = {
  clientPort: 3001,
  clientRoom: 'kuzzle',
  servers: [
    'http://localhost:7513'
  ],
  serverMode: 'sticky',
  webSocketOptions: {
    retryInterval: 1000,
    reconnectionAttempts: -1
  }
};
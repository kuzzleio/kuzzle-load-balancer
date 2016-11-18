var
  config,
  rc = require('rc');

function unstringify (cfg) {
  Object.keys(cfg).forEach(k => {
    // exception - *version entries need to be kept as string
    if (/version$/i.test(k)) {
      return;
    }

    if (typeof cfg[k] === 'string') {
      if (cfg[k] === 'true') {
        cfg[k] = true;
      }
      else if (cfg[k] === 'false') {
        cfg[k] = false;
      }
      else if (/^[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseInt(cfg[k]);
      }
      else if (/^[0-9]+\.[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseFloat(cfg[k]);
      }
    }
    else if (cfg[k] instanceof Object) {
      cfg[k] = unstringify(cfg[k]);
    }
  });

  return cfg;
}

config = rc('proxy', {
  protocolPlugins: {
    'kuzzle-plugin-websocket': {
      version: '1.0.4',
      activated: true,
      config: {
        port: 7513,
        room: 'kuzzle'
      }
    },
    'kuzzle-plugin-socketio': {
      version: '2.0.1',
      activated: true,
      config: {
        port: 7512,
        room: 'kuzzle'
      }
    }
  },
  backend: {
    port: 7331,
    mode: 'standard',
    timeout: 10000
  },
  http: {
    port: 7511
  }
});

module.exports = unstringify(config);
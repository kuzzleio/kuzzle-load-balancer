'use strict';

let
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
  logs: {
    access: [
      {
        transport: 'console',
        level: 'info',
        stderrLevels: []
      }
    ],
    errors: [
      {
        transport: 'console',
        level: 'info',
        stderrLevels: ['warn', 'error', 'debug']
      }
    ],
    accessLogFormat: 'combined',
    accessLogIpOffset: 0
  },
  backend: {
    port: 7331,
    mode: 'standard',
    timeout: 10000
  },
  port: 7512,
  maxRequestSize: '1MB',
  http: {
    enabled: true,
    maxFormFileSize: '1MB'
  },
  websocket: {
    enabled: true
  },
  socketio: {
    enabled: true,
    origins: '*:*'
  }
});

module.exports = unstringify(config);

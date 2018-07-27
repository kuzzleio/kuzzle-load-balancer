/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  rc = require('rc'),
  config = rc('proxy', {
    logs: {
      access: [
        {
          transport: 'console',
          level: 'info',
          stderrLevels: [],
          silent: true,
          format: 'simple'
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
      maxFormFileSize: '1MB',
      allowCompression: true,
      maxEncodingLayers: 3
    },
    websocket: {
      enabled: true
    },
    socketio: {
      enabled: true,
      origins: '*:*'
    }
  });

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
        cfg[k] = Number.parseInt(cfg[k]);
      }
      else if (/^[0-9]+\.[0-9]+$/.test(cfg[k])) {
        cfg[k] = Number.parseFloat(cfg[k]);
      }
    }
    else if (cfg[k] instanceof Object) {
      cfg[k] = unstringify(cfg[k]);
    }
  });

  return cfg;
}

module.exports = unstringify(config);

'use strict';

let
  debug = require('debug')('kuzzle-proxy:plugins'),
  Broker = require('../service/Broker'),
  ClientConnectionStore = require('../store/ClientConnection'),
  Context = require('./Context'),
  HttpProxy = require('../service/HttpProxy'),
  Websocket = require('../service/protocol/Websocket'),
  SocketIo = require('../service/protocol/SocketIo'),
  moment = require('moment'),
  ProtocolStore = require('../store/Protocol'),
  Router = require('../service/Router'),
  winston = require('winston'),
  WinstonElasticsearch = require('winston-elasticsearch'),
  WinstonSyslog = require('winston-syslog'),
  path = require('path'),
  fs = require('fs'),
  config = require('./config');


/**
 * KuzzleProxy constructor
 *
 * @param {ProxyBackendHandler} BackendHandler
 */
class KuzzleProxy {
  constructor (BackendHandler) {
    /** @type {Object} */
    this.config = config;

    /** @type {Context} */
    this.context = new Context(this);
    this.backendHandler = new BackendHandler(this.config.backend.mode, this);

    /** @type {Broker} */
    this.broker = new Broker();

    /** @type {HttpProxy} */
    this.httpProxy = new HttpProxy();

    /** @type {Websocket} */
    this.ws = new Websocket();

    /** @type {SocketIo} */
    this.io = new SocketIo();

    /** @type {ClientConnection} */
    this.clientConnectionStore = new ClientConnectionStore();

    /** @type {Plugin} */
    this.protocolStore = new ProtocolStore();

    /** @type {Router} */
    this.router = new Router(this);

    this.loggers = {
      errors: {

      }
    };
  }

  /**
   *
   * @type {{
   *  silly: {Function},
   *  debug: {Function} ,
   *  verbose: {Function},
   *  info: {Function},
   *  warn: {Function},
   *  error: {Function}
   * }}
   */
  get log () {
    return this.loggers.errors;
  }

  start () {
    this.initLogger();

    try {
      this.broker.init(this, this.config.backend);
      this.httpProxy.init(this);
      this.ws.init(this);
      this.io.init(this);
      this.loadPlugins(this.config);
    } catch (e) {
      this.log.error(e);
      throw e;
    }
  }

  /**
   * Loads installed plugins in memory
   *
   * @param plugins - list of installed plugins to load
   */
  loadPlugins () {
    const pluginsDir = path.resolve(path.join('plugins', 'enabled'));

    const pluginList = fs.readdirSync(pluginsDir)
      .filter((element) => {
        const elStat = fs.statSync(path.join(pluginsDir, element));
        return elStat.isDirectory();
      });

    pluginList.forEach((pluginDirName) => {
      const pluginPath = path.resolve(pluginsDir, pluginDirName);
      try {
        let pluginDefinition = this.loadPlugin(pluginPath);
        debug('[%s] initializing plugin with definition:\n%O', pluginDirName, pluginDefinition);
        this.initPlugin(pluginDefinition);
      } catch (e) {
        this.log.error(`Unable to load plugin ${pluginDirName}. ${e}`); // eslint-disable-line no-console
        return;
      }
    });

    debug('plugins initialized');
  }

  loadPlugin (pluginPath) {
    const
      PluginClass = require(pluginPath),
      pluginObject = new PluginClass(),
      packageJsonPath = path.resolve(pluginPath, 'package.json'),
      packageJson = fs.existsSync(packageJsonPath) && require(packageJsonPath),
      pluginName = packageJson && packageJson.name || path.basename(pluginPath);

    return {
      name: pluginName,
      protocol: pluginObject.protocol,
      object: pluginObject,
      config: this.config[pluginName] || {},
      path: pluginPath
    };
  }

  initPlugin (pluginDefinition) {
    this.log.info(`Initializing protocol plugin ${pluginDefinition.name}`);
    try {
      pluginDefinition.object.init(pluginDefinition.config, this.context);
      this.protocolStore.add(pluginDefinition.protocol, pluginDefinition.object);
    } catch (error) {
      this.log.error(`Initialization of plugin ${pluginDefinition.name} failed. `, error.stack);
    }
  }

  initLogger () {
    [
      'access',
      'errors'
    ].forEach(type => {
      const transports = [];

      this.config.logs[type].forEach(conf => {
        const opts = {
          level: conf.level || 'info',
          silent: conf.silent || false,
          colorize: conf.colorize || false,
          timestamp: conf.timestamp || false,
          json: conf.json || false,
          stringify: conf.stringify || false,
          prettyPrint: conf.prettyPrint || false,
          depth: conf.depth || false,
          showLevel: conf.showLevel || false
        };

        switch (conf.transport || 'console') {
          case 'console':
            transports.push(new (winston.transports.Console)(Object.assign(opts, {
              humanReadableUnhandledException: conf.humanReadableUnhandledException || true,
              stderrLevels: conf.stderrLevels || ['error', 'debug']
            })));
            break;
          case 'elasticsearch':
            transports.push(new WinstonElasticsearch(Object.assign(opts, {
              index: conf.index,
              indexPrefix: conf.indexPrefix || 'proxy',
              indexSuffixPattern: conf.indexSuffixPattern || 'YYYY.MM',
              messageType: conf.messageType || type,
              ensureMappingTemplate: conf.ensureMappingTemplate !== false,
              mappingTemplate: conf.mappingTemplate || `${type}.log.mapping.json`,
              flushInterval: conf.flushInterval || 2000,
              clientOpts: conf.clientOpts || {}
            })));
            break;
          case 'file':
            transports.push(new (winston.transports.File)(Object.assign(opts, {
              filename: conf.filename || `proxy.${type}.log`,
              maxSize: conf.maxSize,
              maxFiles: conf.maxFiles,
              eol: conf.eol || '\n',
              logstash: conf.logstash || false,
              tailable: conf.tailable,
              maxRetries: conf.maxRetries || 2,
              zippedArchive: conf.zippedArchive || false
            })));
            break;
          case 'syslog': {
            transports.push(new WinstonSyslog(Object.assign(opts, {
              host: conf.host || 'localhost',
              port: conf.port || 514,
              protocol: conf.protocol || 'udp4',
              path: conf.path || '/dev/log',
              pid: conf.pid || process.pid,
              facility: conf.facility || 'local0',
              localhost: conf.localhost || 'localhost',
              type: conf.type || 'BSD',
              app_name: conf.app_name || process.title,
              eol: conf.eol
            })));
          }
        }
      });

      this.loggers[type] = new (winston.Logger)({transports});

    });
  }

  /**
   * @param {string} connectionId
   * @param {object} request - Custom format for HTTP, Request.serialize() output for other protocols
   * @param {Error} error - Low level protocol error (NB: result can also contain an error)
   * @param {RequestResponse} result - The response from Kuzzle
   */
  logAccess (connectionId, request, error, result) {
    const
      connection = this.clientConnectionStore.get(connectionId);

    if (!connection) {
      return this.log.warn(`[access log] No connection retrieved for connection id: ${connectionId}\n` +
        'Most likely, the connection was closed before the response we received.');
    }

    switch (this.config.logs.accessLogFormat) {
      case 'logstash': {
        // custom kuzzle logs to be exported to logstash
        this.loggers.access.info({
          connection,
          request,
          error: error ? error.toString() : null,
          status: error && error.status || result.status
        });
        break;
      }
      default: {
        // = apache combined
        let
          verb = 'DO',
          protocol = connection.protocol.toUpperCase(),
          url = '',
          user,
          status;

        if (error) {
          url = '/error';
          if (error.status) {
            status = error.status;
          }
          else {
            status = 500;
          }
        }
        else {
          status = result.status;
        }

        if (connection && connection.protocol.startsWith('HTTP/')) {
          verb = request.method;
          url = request.url;

          // try to get plain user name, 1st form jwt token if present, then from basic auth
          if (connection.headers.authorization) {
            try {
              if (/^Bearer /i.test(connection.headers.authorization)) {
                const
                  b64Payload = connection.headers.authorization.split('.')[1],
                  payload = new Buffer(b64Payload, 'base64').toString('utf8');

                user = JSON.parse(payload)._id;
              }
              else {
                user = new Buffer(connection.headers.authorization, 'base64')
                  .toString('utf8')
                  .split(':')[0];
              }
            }
            catch (err) {
              this.log.warn('Unable to extract user from authorization header: ' + connection.headers.authorization);
            }
          }
        }
        else {
          // for other protocols than http, we reconstruct a pseudo url
          url = `/${request.data.controller}/${request.data.action}`;
          if (request.data.index) {
            url += '/' + request.data.index;
          }
          if (request.data.collection) {
            url += '/' + request.data.collection;
          }
          if (request.data._id) {
            url += '/' + request.data._id;
          }

          const queryString = Object.keys(request.data)
            .filter(k => [
              'timestamp',
              'requestId',
              'jwt',
              'metadata',
              'body',
              'controller',
              'action',
              'index',
              'collection',
              '_id'
            ].indexOf(k) < 0)
            .map(k => k + '=' + request.data[k])
            .join('&');
          if (queryString !== '') {
            url += '?' + queryString;
          }

          if (request.data.jwt) {
            try {
              const
                b64Paylod = request.data.jwt.split('.')[1],
                payload = new Buffer(b64Paylod, 'base64').toString('utf8');
              user = JSON.parse(payload)._id;
            }
            catch (err) {
              this.log.warn('Unable to extract user from jwt token: ' + request.data.jwt);
            }
          }
        }

        this.loggers.access.info([
          connection.ips[connection.ips.length - 1 - this.config.logs.accessLogIpOffset],
          '-',
          user || '-',
          '[' + moment().format('DD/MMM/YYYY:HH:mm:ss ZZ') + ']',
          `"${verb} ${url} ${protocol}"`,
          status || '-',
          result ? Buffer.byteLength(result.raw ? result.content : JSON.stringify(result.content)) : '-',
          connection.headers.referer ? `"${connection.headers.referer}"` : '-',
          connection.headers['user-agent'] ? `"${connection.headers['user-agent']}"` : '-'
        ].join(' '));
      }
    }
  }

}


module.exports = KuzzleProxy;

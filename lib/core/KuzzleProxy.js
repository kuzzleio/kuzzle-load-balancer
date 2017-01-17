'use strict';

let
  Broker = require('../service/Broker'),
  ClientConnectionStore = require('../store/ClientConnection'),
  Context = require('./Context'),
  HttpProxy = require('../service/HttpProxy'),
  WsProxy = require('../service/WsProxy'),
  moment = require('moment'),
  PluginPackage = require('../plugins/package'),
  ProtocolStore = require('../store/Protocol'),
  Router = require('../service/Router'),
  winston = require('winston'),
  WinstonElasticsearch = require('winston-elasticsearch'),
  WinstonSyslog = require('winston-syslog'),
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

    /** @type {WsProxy} */
    this.wsProxy = new WsProxy();

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

    return this.installPluginsIfNeeded()
      .then(() => {
        this.broker.init(this, this.config.backend);
        this.httpProxy.init(this);
      })
      .then(() => {
        this.wsProxy.init(this);
        this.initPlugins();
      })
      .catch(error => {
        this.log.error(error);
        throw error;
      });
  }

  installPluginsIfNeeded () {
    const promises = [];

    Object.keys(this.config.protocolPlugins).forEach(pluginName => {
      const pluginPackage = new PluginPackage(pluginName, this.config.protocolPlugins[pluginName]);
      if (pluginPackage.needsInstall()) {
        promises.push(pluginPackage.install());
      }
    });

    return Promise.all(promises);
  }

  /**
   * Reads configuration files and initializes plugins
   */
  initPlugins () {
    Object.keys(this.config.protocolPlugins).forEach(pluginName => {
      let
        plugin,
        pluginDefinition = this.config.protocolPlugins[pluginName];

      if (!pluginDefinition.activated) {
        return;
      }

      this.log.info(`Initializing protocol plugin ${pluginName}`);
      try {
        plugin = new (require(pluginName))();
        plugin.init(pluginDefinition.config, this.context);

        this.protocolStore.add(plugin.protocol, plugin);
      } catch (error) {
        this.log.error(`Initialization of plugin ${pluginName} has failed; Reason: `, error.stack);
      }
    });
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

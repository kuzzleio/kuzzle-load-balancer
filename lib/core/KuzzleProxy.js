'use strict';

const
  Broker = require('../service/Broker'),
  ClientConnectionStore = require('../store/ClientConnection'),
  Context = require('./Context'),
  HttpProxy = require('../service/HttpProxy'),
  moment = require('moment'),
  PluginPackage = require('../plugins/package'),
  PluginStore = require('../store/Plugin'),
  Router = require('../service/Router'),
  winston = require('winston'),
  WinstonElasticsearch = require('winston-elasticsearch'),
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
    this.backendHandler = new BackendHandler(this.config.backend.mode, this.context);

    /** @type {Broker} */
    this.broker = new Broker();

    /** @type {HttpProxy} */
    this.httpProxy = new HttpProxy();

    /** @type {ClientConnection} */
    this.clientConnectionStore = new ClientConnectionStore();

    /** @type {Plugin} */
    this.pluginStore = new PluginStore();

    /** @type {Router} */
    this.router = new Router(this);

    this.loggers = {};
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
    return this.installPluginsIfNeeded()
      .then(() => {
        this.initLogger();
        this.initPlugins();
        this.broker.init(this, this.config.backend);
        this.httpProxy.init(this);
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
      var
        plugin,
        pluginDefinition = this.config.protocolPlugins[pluginName];

      if (!pluginDefinition.activated) {
        return;
      }

      this.log.info(`Initializing protocol plugin ${pluginName}`);
      try {
        plugin = new (require(pluginName))();
        plugin.init(pluginDefinition.config, this.context);

        this.pluginStore.add(plugin);
      } catch (error) {
        this.log.error(`Initialization of plugin ${pluginName} has failed; Reason: `, error.stack);
      }
    });

    if (this.pluginStore.count() === 0) {
      throw new Error('No plugin has been initialized properly. Shutting down.');
    }
  }

  initLogger () {

    [
      'access',
      'errors'
    ].forEach(type => {
      this.config.logs[type].forEach(conf => {
        const transports = [];

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

        switch (conf.type || 'console') {
          case 'console':
            transports.push(new (winston.transports.Console)(Object.assign(opts, {
              humanReadableUnhandledException: conf.humanReadableUnhandledException || true
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
        }

        this.loggers[type] = new (winston.Logger)({transports});
      });

    });
  }

  /**
   * @param {string} connectionId
   * @param {Error} error
   * @param {RequestResponse} result
   */
  logAccess (connectionId, request, error, result) {
    const
      connection = this.clientConnectionStore.getByConnectionId(connectionId);

    if (!connection) {
      return this.log.warn(`[access log] no connection retrieved for connection id: ${connectionId}\n` +
        'Most likely, the connection was closed before the response we received.');
    }

    switch (this.config.logs.accessLogFormat) {
      case 'logstash': {
        // custom kuzzle logs to be exported to logstash
        this.loggers.access.info({
          connection,
          error: error,
          result: result
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
          status = 200;

        if (error) {
          url = '/error';
          if (error.status) {
            status = error.status;
          }
        }
        else {
          status = result.status;
        }

        // try to get plain user name, 1st form jwt token if present, then from basic auth
        if (connection.headers.authorization) {
          try {
            if (/^Bearer /i.test(connection.headers.authorization)) {
              const
                b64Payload = connection.headers.authorization.replace(/^Bearer .*?\.(.*?)\..*$/i, '$1'),
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
            this.loggers.error.warn('Unable to extract user from authorization header: ' + connection.headers.authorization);
          }
        }

        if (connection && connection.protocol === 'http') {
          verb = request.method;
          url = request.url;
        }
        else {
          // for other protocols than http, we reconstruct a pseudo url
          url = `/${request.data.controller}/${request.data.action}`;
          if (request.data.index) {
            url += '/' + request.index;
          }
          if (request.data.collection) {
            url += '/' + request.collection;
          }
          if (request.data._id) {
            url += '/' + request._id;
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
        }

        this.loggers.access.info([
          connection.ips.reverse()[this.config.logs.accessLogIpOffset],
          '-',
          user || '-',
          '[' + moment().format('DD/MMM/YYYY:HH:mm:ss ZZ') + ']',
          `"${verb} ${url} ${protocol}"`,
          status,
          result ? Buffer.byteLength(JSON.stringify(result)) : '-',
          connection.headers.referer ? `"${connection.headers.referer}"` : '-',
          connection.headers['user-agent'] ? `"${connection.headers['user-agent']}"` : '-'
        ].join(' '));
      }
    }
  }

}


module.exports = KuzzleProxy;

var
  fs = require('fs'),
  path = require('path'),
  q = require('q'),
  childProcess = require('child_process'),
  lockfile = require('proper-lockfile'),
  _ = require('lodash'),
  clc = require('cli-color'),
  configuration = require('rc')('lb'),
  clcError = clc.red,
  clcOk = clc.green.bold;

function pluginsInstall () {
  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-plugins: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

  // Prevents multiple plugins install at the same time.
  lockfile.lock('./node_modules', {retries: 1000, minTimeout: 200, maxTimeout: 1000, stale: 60000, update: 10000}, (err, release) => {
    if (err) {
      console.error(clcError('███ kuzzle-plugins: Unable to acquire lock: '), err);
      process.exit(1);
    }

    q.fcall(() => {
      console.log('███ kuzzle-plugins: Starting plugins installation...');

      return acquirePlugins(configuration.protocolPlugins);
    })
    .then(() => {
      release();

      console.log(clcOk('███ kuzzle-plugins: Plugins installed'));

      process.exit(0);
    })
    .catch(error => {
      release();

      console.error(clcError('Error: '), error);
      process.exit(error.status);
    });
  });
}

/**
 * Download given plugins
 *
 * @param {*} plugins
 * @returns {boolean}
 */
function acquirePlugins(plugins) {
  var
    newInstalled = false,
    installViaNpm = true,
    pluginInstallId;

  _.forEach(plugins, (plugin, name) => {
    /** @var {{gitUrl: String, npmVersion: String}} plugin */
    if (plugin.path) {
      console.log('███ kuzzle-plugins: Plugin', name, 'uses local plugin. Config will be overrided with local changes.');
      installViaNpm = false;
    }
    else if (plugin.gitUrl) {
      pluginInstallId = plugin.gitUrl;
    }
    else if (plugin.npmVersion) {
      pluginInstallId = name + '@' + plugin.npmVersion;
    }
    else {
      console.error(clcError('███ kuzzle-plugins: Plugin'), name, 'provides no means of installation. Expected: path, git URL or npm version');
      process.exit(1);
    }

    if (!plugin.path && !needInstall(plugin, name, pluginInstallId)) {
      console.log('███ kuzzle-plugins: Plugin', name, 'is already installed. Skipping...');
      return true;
    }

    console.log('███ kuzzle-plugins: Downloading plugin: ', name);

    newInstalled = true;
    if (installViaNpm) {
      npmInstall(pluginInstallId);
    }

    console.log('███ kuzzle-plugins: Plugin', name, 'downloaded');
  });

  return newInstalled;
}

/**
 * Install a plugin with NPM
 * @param plugin
 */
function npmInstall(plugin) {
  return childProcess
    .execSync('npm install ' + plugin)
    .toString();
}


/**
 * Detects if the configured plugin must be installed
 * If the plugin is configured with an url from GIT, the plugin is installed every time
 *   to ensure getting the latest release
 * If the plugin come from NPM or , the plugin is installed only if the required version
 *   is different from the version of the already installed plugin
 *
 * @param plugin
 * @param name
 * @param from previously installation information with version or git url with branch
 * @returns {boolean} true if the plugin must be installed, false if not
 */
function needInstall(plugin, name, from) {
  var
    packageDefinition,
    packagePath,
    pluginPath = getPathPlugin(plugin, name);

  // If we want to install a plugin with git, maybe there is no version and we want to 'pull' the plugin
  if (from.indexOf('git') !== -1) {
    return true;
  }

  if (!fs.existsSync(pluginPath)) {
    return true;
  }

  packagePath = path.join(pluginPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return true;
  }

  /** @type {{_from: String}} */
  packageDefinition = require(path.join(pluginPath, 'package.json'));


  // If version in package.json is different from the version the plugins.json, we want to install the updated plugin
  return (packageDefinition._from !== from);
}

/**
 * Return the real plugin path
 *
 * @param pluginConfig
 * @param pluginName
 * @returns {String}
 */
function getPathPlugin (pluginConfig, pluginName) {
  if (pluginConfig.path) {
    return pluginConfig.path;
  }
  return path.join(__dirname, 'node_modules', pluginName);
}

pluginsInstall();
var
  compareVersions = require('compare-versions'),
  exec = require('child_process').exec,
  path = require('path'),
  Promise = require('bluebird'),
  rootDir = path.join(__dirname, '..', '..');

function PluginPackage (name, definition) {
  this.name = name;
  this.activated = true;

  if (definition) {
    this.setDefinition(definition);
  }
}

PluginPackage.prototype.setDefinition = function pkgSetDefinition (definition) {
  [
    'path',
    'url',
    'version',
    'activated'
  ].forEach(k => {
    this[k] = definition[k];
  });
};

PluginPackage.prototype.isInstalled = function pkgIsInstalled () {
  var isInstalled = false;

  try {
    require(`${rootDir}/node_modules/${this.name}/package.json`);
    isInstalled = true;
  }
  catch (error) {
    // do nothing
  }

  return isInstalled;
};

PluginPackage.prototype.needsInstall = function pkgNeedsInstall () {
  if (!this.isInstalled()) {
    return true;
  }

  return compareVersions(this.version, this.localConfiguration().version) > 0;
};

PluginPackage.prototype.localConfiguration = function pkgLocalConfiguration () {
  var config = {
    version: '0.0.0'
  };

  try {
    config = require(`${rootDir}/node_modules/${this.name}/package.json`);
  }
  catch (error) {
    // do nothing
  }

  return config;
};

PluginPackage.prototype.install = function pkgInstall () {
  var
    pkg = this.name;

  if (this.path) {
    pkg = this.path;
  }
  if (this.url) {
    pkg = this.url;
  }

  if (this.version) {
    if (/\.git$/.test(pkg)) {
      pkg += '#' + this.version;
    }
    else if (!/^https?:\/\//.test(pkg)) {
      pkg += '@' + this.version;
    }
  }

  return Promise.promisify(exec)(`npm install ${pkg}`);
};


module.exports = PluginPackage;

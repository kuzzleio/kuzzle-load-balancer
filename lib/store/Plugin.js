function Plugin() {
  /** @type {Object[]} plugins */
  this.plugins = {};
}

Plugin.prototype.add = function (plugin) {
  if (plugin.protocol) {
    this.plugins[plugin.protocol] = plugin;
  }
};

Plugin.prototype.getByProtocol = function (protocol) {
  return this.plugins[protocol];
};

Plugin.prototype.count = function () {
  return Object.keys(this.plugins).length;
};

module.exports = Plugin;
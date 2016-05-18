function Plugin() {
  /** @type {Object[]} plugins */
  this.plugins = {};
}

Plugin.prototype.add = plugin => {
  if (plugin.protocol) {
    this.plugins[plugin.protocol] = plugin;
  }
};

Plugin.prototype.count = () => {
  return Object.keys(this.plugins).length;
};

module.exports = Plugin;
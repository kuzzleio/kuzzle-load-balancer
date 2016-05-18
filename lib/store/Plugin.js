var
  plugins;

function Plugin() {
}

Plugin.prototype.add = plugin => {
  if (plugin.protocol) {
    plugins[plugin.protocol] = plugin;
  }
};

Plugin.prototype.count = () => {
  return Object.keys(plugins).length;
};

module.exports = Plugin;
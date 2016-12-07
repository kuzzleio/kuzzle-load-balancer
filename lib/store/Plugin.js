/**
 * Plugin store constructor
 *
 * @constructor
 */
function Plugin() {
  /** @type {Object[]} plugins */
  this.plugins = {};
}

/**
 * Add a plugin to the store
 *
 * @param plugin
 */
Plugin.prototype.add = function (plugin) {
  if (plugin.protocol) {
    this.plugins[plugin.protocol] = plugin;
  }
};

/**
 * Get a plugin by protocol name
 *
 * @param {string} protocol
 * @returns {Object|undefined}
 */
Plugin.prototype.getByProtocol = function (protocol) {
  return this.plugins[protocol];
};

/**
 * Return the count of plugins
 *
 * @returns {Number}
 */
Plugin.prototype.count = function () {
  return Object.keys(this.plugins).length;
};

module.exports = Plugin;